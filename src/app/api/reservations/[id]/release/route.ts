import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const released = await prisma.$transaction(async (tx) => {

      // STEP 1: Lock reservation row
      // Prevents double-release and race between release + confirm
      const reservations = await tx.$queryRaw<
        Array<{
          id:          string;
          productId:   string;
          warehouseId: string;
          quantity:    number;
          status:      string;
        }>
      >`
        SELECT id, "productId", "warehouseId", quantity, status::text
        FROM   "Reservation"
        WHERE  id = ${id}
        FOR UPDATE
      `;

      // VALIDATION 1: Reservation exists
      if (reservations.length === 0) {
        throw new Error("RESERVATION_NOT_FOUND");
      }

      const reservation = reservations[0];

      // VALIDATION 2: Must be PENDING
      // Guards against:
      //   - Double-release (corrupts reservedStock below 0)
      //   - Releasing a CONFIRMED purchase (would incorrectly restore availability)
      //   - Cron already released → user clicks cancel afterward → 409
      if (reservation.status !== "PENDING") {
        throw new Error("RESERVATION_NOT_PENDING");
      }

      // STEP 2: Lock inventory row
      const inventories = await tx.$queryRaw<
        Array<{ id: string; reservedStock: number }>
      >`
        SELECT id, "reservedStock"
        FROM   "Inventory"
        WHERE  "productId"   = ${reservation.productId}
        AND    "warehouseId" = ${reservation.warehouseId}
        FOR UPDATE
      `;

      if (inventories.length === 0) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      const inventory = inventories[0];

      // STEP 3: Free the hold — totalStock DOES NOT change
      //
      // Before: total=14, reserved=2, available=12
      // After:  total=14, reserved=0, available=14
      //
      // Item was never purchased — physical stock never moved.
      // We only lift the temporary block.
      await tx.inventory.update({
        where: { id: inventory.id },
        data:  { reservedStock: { decrement: reservation.quantity } },
      });

      // STEP 4: Mark as RELEASED — preserve record for audit trail
      const updated = await tx.reservation.update({
        where: { id },
        data:  { status: "RELEASED" },
        include: {
          product:   true,
          warehouse: true,
        },
      });

      return updated;
    });

    return NextResponse.json(released, { status: 200 });

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
          { error: "Only PENDING reservations can be released" },
          { status: 409 }
        );
      }
      if (error.message === "INVENTORY_NOT_FOUND") {
        return NextResponse.json(
          { error: "Inventory record not found" },
          { status: 404 }
        );
      }
    }

    console.error("RELEASE_RESERVATION_ERROR", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
