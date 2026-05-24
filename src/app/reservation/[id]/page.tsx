"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

type Reservation = {
  id: string;
  quantity: number;
  status: string;
  expiresAt: string;

  product: {
    name: string;
    sku: string;
  };

  warehouse: {
    name: string;
    location: string;
  };
};

export default function ReservationPage() {
  const params = useParams();
  const router = useRouter();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchReservation() {
    try {
      const response = await axios.get(
        `/api/reservations/${params.id}`
      );
      setReservation(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load reservation");
    } finally {
      setLoading(false);
    }
  }

  async function confirmReservation() {
    try {
      await axios.post(
        `/api/reservations/${params.id}/confirm`
      );
      toast.success("Purchase confirmed");
      fetchReservation();
    } catch (error: any) {
      console.error(error);

      if (error?.response?.status === 410) {
        toast.error("Reservation expired");
        return;
      }
      if (error?.response?.status === 409) {
        toast.error("Reservation already processed");
        return;
      }
      toast.error("Confirmation failed");
    }
  }

  async function releaseReservation() {
    try {
      await axios.post(
        `/api/reservations/${params.id}/release`
      );
      toast.success("Reservation cancelled");
      fetchReservation();
    } catch (error: any) {
      console.error(error);

      if (error?.response?.status === 409) {
        toast.error("Reservation already processed");
        return;
      }
      toast.error("Cancellation failed");
    }
  }

  useEffect(() => {
    fetchReservation();
  }, []);

  const remainingTime = useMemo(() => {
    if (!reservation) return "";

    const now = new Date().getTime();
    const expiry = new Date(reservation.expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) {
      return "Expired";
    }

    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return `${minutes}m ${seconds}s`;
  }, [reservation]);

  if (loading) {
    return <div className="p-10 text-lg">Loading reservation...</div>;
  }

  if (!reservation) {
    return <div className="p-10 text-lg">Reservation not found</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-3xl font-bold">
          Reservation Details
        </h1>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Product</p>
            <h2 className="text-xl font-semibold">
              {reservation.product.name}
            </h2>
            <p className="text-sm text-gray-500">
              SKU: {reservation.product.sku}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Warehouse</p>
            <h3 className="font-medium">
              {reservation.warehouse.name}
            </h3>
            <p className="text-sm text-gray-500">
              {reservation.warehouse.location}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Quantity</p>
              <p className="text-2xl font-bold">
                {reservation.quantity}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-2xl font-bold">
                {reservation.status}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-orange-300 bg-orange-50 p-4">
            <p className="text-sm text-orange-700">
              Reservation expires in
            </p>
            <p className="text-3xl font-bold text-orange-900">
              {remainingTime}
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={confirmReservation}
              disabled={reservation.status !== "PENDING"}
              className="flex-1 rounded-lg bg-black px-4 py-3 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Confirm Purchase
            </button>

            <button
              onClick={releaseReservation}
              disabled={reservation.status !== "PENDING"}
              className="flex-1 rounded-lg border border-black px-4 py-3 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
            >
              Cancel Reservation
            </button>
          </div>

          <button
            onClick={() => router.push("/")}
            className="mt-4 w-full text-sm text-gray-500 underline"
          >
            Back to Products
          </button>
        </div>
      </div>
    </main>
  );
}
