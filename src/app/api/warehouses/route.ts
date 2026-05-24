import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(warehouses);
  } catch (error) {
    console.error("GET_WAREHOUSES_ERROR", error);

    return NextResponse.json(
      { error: "Failed to fetch warehouses" },
      { status: 500 }
    );
  }
}
