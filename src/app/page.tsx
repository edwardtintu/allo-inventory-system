"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Inventory = {
  inventoryId: string;

  warehouse: {
    id: string;
    name: string;
    location: string;
  };

  totalStock: number;
  reservedStock: number;
  availableStock: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  description: string;
  inventories: Inventory[];
};

export default function HomePage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchProducts() {
    try {
      const response = await axios.get("/api/products");

      setProducts(response.data);
    } catch (error) {
      console.error(error);

      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  async function reserveProduct(
    productId: string,
    warehouseId: string
  ) {
    try {
      const response = await axios.post("/api/reservations", {
        productId,
        warehouseId,
        quantity: 1,
      });

      toast.success("Reservation created");

      router.push(`/reservation/${response.data.id}`);
    } catch (error: any) {
      console.error(error);

      if (error?.response?.status === 409) {
        toast.error("Not enough stock available");
        return;
      }

      toast.error("Reservation failed");
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="p-10 text-lg">
        Loading products...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-4xl font-bold">
          Inventory Reservation System
        </h1>

        <div className="space-y-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border bg-white p-6 shadow-sm"
            >
              <div className="mb-4">
                <h2 className="text-2xl font-semibold">
                  {product.name}
                </h2>

                <p className="text-sm text-gray-500">
                  SKU: {product.sku}
                </p>

                <p className="mt-2 text-gray-700">
                  {product.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {product.inventories.map((inventory) => (
                  <div
                    key={inventory.inventoryId}
                    className="rounded-xl border p-4"
                  >
                    <div className="mb-3">
                      <h3 className="font-semibold">
                        {inventory.warehouse.name}
                      </h3>

                      <p className="text-sm text-gray-500">
                        {inventory.warehouse.location}
                      </p>
                    </div>

                    <div className="space-y-1 text-sm">
                      <p>
                        Total Stock:{" "}
                        <span className="font-medium">
                          {inventory.totalStock}
                        </span>
                      </p>

                      <p>
                        Reserved Stock:{" "}
                        <span className="font-medium">
                          {inventory.reservedStock}
                        </span>
                      </p>

                      <p>
                        Available Stock:{" "}
                        <span className="font-medium">
                          {inventory.availableStock}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        reserveProduct(
                          product.id,
                          inventory.warehouse.id
                        )
                      }
                      disabled={
                        inventory.availableStock <= 0
                      }
                      className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      Reserve 1 Unit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
