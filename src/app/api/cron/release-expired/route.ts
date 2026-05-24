import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET is standard for Vercel Cron endpoints
export async function GET() {
  try {
    // 1. Identify expired reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      select: {
        id: true,
        productId: true,
        warehouseId: true,
        quantity: true,
      },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({ message: "No expired reservations to clean up" });
    }

    let releasedCount = 0;

    // 2. Process sequentially to prevent massive DB locks and deadlocks
    for (const res of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // STEP 1: Lock reservation to ensure it wasn't confirmed in the exact millisecond between fetch and here
          const lockedRes = await tx.$queryRaw<Array<{ status: string }>>`
            SELECT status::text 
            FROM "Reservation" 
            WHERE id = ${res.id} 
            FOR UPDATE
          `;

          if (lockedRes.length === 0 || lockedRes[0].status !== "PENDING") {
            return; // Already processed
          }

          // STEP 2: Lock the inventory row
          const lockedInv = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id 
            FROM "Inventory" 
            WHERE "productId" = ${res.productId} 
            AND "warehouseId" = ${res.warehouseId} 
            FOR UPDATE
          `;

          if (lockedInv.length === 0) return;

          // STEP 3: Free the hold — totalStock remains unchanged
          await tx.inventory.update({
            where: { id: lockedInv[0].id },
            data: { reservedStock: { decrement: res.quantity } },
          });

          // STEP 4: Mark as RELEASED
          await tx.reservation.update({
            where: { id: res.id },
            data: { status: "RELEASED" },
          });
        });

        releasedCount++;
      } catch (err) {
        console.error(`Failed to process expired reservation ${res.id}:`, err);
        // Continue processing others even if one fails
      }
    }

    return NextResponse.json({
      message: `Successfully released ${releasedCount} expired reservations`,
    });
  } catch (error) {
    console.error("CRON_RELEASE_EXPIRED_ERROR", error);
    return NextResponse.json(
      { error: "Failed to run cleanup cron" },
      { status: 500 }
    );
  }
}
