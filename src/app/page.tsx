"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package, MapPin, Box, ShieldAlert, CheckCircle2 } from "lucide-react";

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

  async function reserveProduct(productId: string, warehouseId: string) {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
          <p className="text-sm font-medium text-slate-500">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Inventory Operations
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage multi-warehouse stock and real-time reservations.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="border-b border-slate-100 bg-slate-50/50 p-6 sm:p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-slate-900">
                        {product.name}
                      </h2>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        SKU: {product.sku}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                      {product.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Warehouse Availability
                </h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {product.inventories.map((inventory) => {
                    const isOutOfStock = inventory.availableStock <= 0;

                    return (
                      <div
                        key={inventory.inventoryId}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div>
                          <div className="mb-4">
                            <h4 className="flex items-center gap-2 font-semibold text-slate-900">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              {inventory.warehouse.name}
                            </h4>
                            <p className="ml-6 text-xs text-slate-500">
                              {inventory.warehouse.location}
                            </p>
                          </div>

                          <div className="mb-6 space-y-3">
                            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 text-sm">
                              <span className="flex items-center gap-2 text-slate-600">
                                <Box className="h-4 w-4" /> Total
                              </span>
                              <span className="font-semibold text-slate-900">
                                {inventory.totalStock}
                              </span>
                            </div>

                            <div className="flex items-center justify-between rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-500/20">
                              <span className="flex items-center gap-2 font-medium">
                                <ShieldAlert className="h-4 w-4" /> Reserved
                              </span>
                              <span className="font-bold">
                                {inventory.reservedStock}
                              </span>
                            </div>

                            <div
                              className={`flex items-center justify-between rounded-lg p-2.5 text-sm ring-1 ring-inset ${
                                isOutOfStock
                                  ? "bg-red-50 text-red-900 ring-red-500/20"
                                  : "bg-emerald-50 text-emerald-900 ring-emerald-500/20"
                              }`}
                            >
                              <span className="flex items-center gap-2 font-medium">
                                <CheckCircle2 className="h-4 w-4" /> Available
                              </span>
                              <span className="font-bold">
                                {inventory.availableStock}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            reserveProduct(product.id, inventory.warehouse.id)
                          }
                          disabled={isOutOfStock}
                          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                        >
                          {isOutOfStock ? "Out of Stock" : "Reserve 1 Unit"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
