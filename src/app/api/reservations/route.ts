import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── Input validation ──────────────────────────────────────────────
const ReserveSchema = z.object({
  productId:   z.string().min(1, "productId is required"),
  warehouseId: z.string().min(1, "warehouseId is required"),
  quantity:    z.number().int().positive("quantity must be a positive integer"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReserveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // ─── Transactional reservation with row locking ──────────────
    //
    // WHY TRANSACTION?
    //   Ensures the entire operation (lock → check → update → insert)
    //   succeeds or fails as a unit. No partial state.
    //
    // WHY SELECT FOR UPDATE?
    //   Locks the inventory row so only ONE transaction can read/write
    //   it at a time. Request B waits until Request A commits.
    //   Without this, two simultaneous requests can both read
    //   available=1 and both succeed — overselling inventory.
    //
    const reservation = await prisma.$transaction(async (tx) => {

      // STEP 1: Lock inventory row — serializes concurrent requests
      const rows = await tx.$queryRaw<
        Array<{ id: string; totalStock: number; reservedStock: number }>
      >`
        SELECT id, "totalStock", "reservedStock"
        FROM   "Inventory"
        WHERE  "productId"   = ${productId}
        AND    "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      const inventory = rows[0];

      // STEP 2: Calculate availability INSIDE the lock
      // Never stored — always derived to prevent dual-state bugs
      const availableStock = inventory.totalStock - inventory.reservedStock;

      // STEP 3: Check availability — return 409 if insufficient
      if (availableStock < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // STEP 4: Increment reservedStock (totalStock unchanged — item not sold yet)
      await tx.inventory.update({
        where: { id: inventory.id },
        data:  { reservedStock: { increment: quantity } },
      });

      // STEP 5: Create PENDING reservation with 10-min expiry window
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const newReservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status:    "PENDING",
          expiresAt,
        },
        include: {
          product:   true,
          warehouse: true,
        },
      });

      return newReservation;
    });

    return NextResponse.json(reservation, { status: 201 });

  } catch (error) {
    // Surface domain errors as correct HTTP codes
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json(
          { error: "Insufficient stock available" },
          { status: 409 }  // 409 Conflict — explicitly required by assignment
        );
      }
      if (error.message === "INVENTORY_NOT_FOUND") {
        return NextResponse.json(
          { error: "No inventory found for this product + warehouse combination" },
          { status: 404 }
        );
      }
    }

    console.error("CREATE_RESERVATION_ERROR", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
