"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Clock, MapPin, Package, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

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
  const [remainingTime, setRemainingTime] = useState("");

  async function fetchReservation() {
    try {
      const response = await axios.get(`/api/reservations/${params.id}`);
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
      await axios.post(`/api/reservations/${params.id}/confirm`);
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
      await axios.post(`/api/reservations/${params.id}/release`);
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

  useEffect(() => {
    if (!reservation) return;

    function updateCountdown() {
      const now = new Date().getTime();
      const expiry = new Date(reservation!.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setRemainingTime("Expired");
        fetchReservation();
        return;
      }

      const minutes = Math.floor(diff / 1000 / 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setRemainingTime(`${minutes}m ${seconds}s`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [reservation]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
          <p className="text-sm font-medium text-slate-500">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Reservation not found</h2>
          <button
            onClick={() => router.push("/")}
            className="mt-4 text-sm font-medium text-blue-600 hover:underline"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isExpired = remainingTime === "Expired";

  const getStatusBadge = () => {
    switch (reservation.status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <CheckCircle2 className="h-4 w-4" /> Confirmed
          </span>
        );
      case "RELEASED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/20">
            <XCircle className="h-4 w-4" /> Released
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
            <Clock className="h-4 w-4" /> Pending
          </span>
        );
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => router.push("/")}
          className="group mb-8 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </button>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-900">Reservation Details</h1>
              {getStatusBadge()}
            </div>
            <p className="mt-2 text-sm text-slate-500 font-mono">ID: {reservation.id}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
                  <Package className="h-4 w-4" /> Product
                </p>
                <h2 className="text-lg font-semibold text-slate-900">{reservation.product.name}</h2>
                <p className="mt-1 text-sm text-slate-500">SKU: {reservation.product.sku}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
                  <MapPin className="h-4 w-4" /> Warehouse
                </p>
                <h3 className="text-lg font-semibold text-slate-900">{reservation.warehouse.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{reservation.warehouse.location}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-5">
              <span className="text-base font-medium text-slate-600">Reserved Quantity</span>
              <span className="text-2xl font-bold text-slate-900">{reservation.quantity} Unit(s)</span>
            </div>

            {isPending && (
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-100 p-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-900">Reservation Hold</p>
                    <p className="text-xs text-amber-700">Stock is temporarily reserved</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold tabular-nums text-amber-600">
                    {remainingTime}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
              <button
                onClick={confirmReservation}
                disabled={!isPending || isExpired}
                className="flex-1 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
              >
                Confirm Purchase
              </button>

              <button
                onClick={releaseReservation}
                disabled={!isPending}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none"
              >
                Cancel Reservation
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
