import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventories: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,

      inventories: product.inventories.map((inventory) => ({
        inventoryId: inventory.id,

        warehouse: {
          id: inventory.warehouse.id,
          name: inventory.warehouse.name,
          location: inventory.warehouse.location,
        },

        totalStock: inventory.totalStock,
        reservedStock: inventory.reservedStock,

        // Derived — never stored in DB to avoid dual-state bugs
        availableStock: inventory.totalStock - inventory.reservedStock,
      })),
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("GET_PRODUCTS_ERROR", error);

    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
