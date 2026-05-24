import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const confirmed = await prisma.$transaction(async (tx) => {

      // STEP 1: Lock reservation row
      // Prevents duplicate payment webhooks / retries from double-decrementing
      const reservations = await tx.$queryRaw<
        Array<{
          id:          string;
          productId:   string;
          warehouseId: string;
          quantity:    number;
          status:      string;
          expiresAt:   Date;
        }>
      >`
        SELECT id, "productId", "warehouseId", quantity, status::text, "expiresAt"
        FROM   "Reservation"
        WHERE  id = ${id}
        FOR UPDATE
      `;

      // VALIDATION 1: Reservation exists
      if (reservations.length === 0) {
        throw new Error("RESERVATION_NOT_FOUND");
      }

      const reservation = reservations[0];

      // VALIDATION 2: Must still be PENDING
      // Guards against: duplicate webhook, retry after confirm, confirm after release
      if (reservation.status !== "PENDING") {
        throw new Error("RESERVATION_NOT_PENDING");
      }

      // VALIDATION 3: Must not have expired
      // Guards against: slow payment gateway, user abandonment, timeout
      if (new Date(reservation.expiresAt) < new Date()) {
        throw new Error("RESERVATION_EXPIRED");
      }

      // STEP 2: Lock inventory row
      const inventories = await tx.$queryRaw<
        Array<{ id: string; totalStock: number; reservedStock: number }>
      >`
        SELECT id, "totalStock", "reservedStock"
        FROM   "Inventory"
        WHERE  "productId"   = ${reservation.productId}
        AND    "warehouseId" = ${reservation.warehouseId}
        FOR UPDATE
      `;

      if (inventories.length === 0) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      const inventory = inventories[0];

      // STEP 3: Permanently consume stock
      //
      // Before: total=10, reserved=2, available=8
      // After:  total=8,  reserved=0, available=8   ← available stays constant
      //
      // This is the key accounting invariant:
      //   available = total - reserved  must not change on confirm
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          totalStock:    { decrement: reservation.quantity },
          reservedStock: { decrement: reservation.quantity },
        },
      });

      // STEP 4: Mark reservation as CONFIRMED — preserve record for audit trail
      const updated = await tx.reservation.update({
        where: { id },
        data:  { status: "CONFIRMED" },
        include: {
          product:   true,
          warehouse: true,
        },
      });

      return updated;
    });

    return NextResponse.json(confirmed, { status: 200 });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RESERVATION_NOT_FOUND") {
        return NextResponse.json(
          { error: "Reservation not found" },
          { status: 404 }
        );
      }
      if (error.message === "RESERVATION_NOT_PENDING") {
        return NextResponse.json(
          { error: "Reservation is not in PENDING state" },
          { status: 409 }
        );
      }
      if (error.message === "RESERVATION_EXPIRED") {
        return NextResponse.json(
          { error: "Reservation has expired" },
          { status: 410 }  // 410 Gone — explicitly required by assignment
        );
      }
      if (error.message === "INVENTORY_NOT_FOUND") {
        return NextResponse.json(
          { error: "Inventory record not found" },
          { status: 404 }
        );
      }
    }

    console.error("CONFIRM_RESERVATION_ERROR", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
