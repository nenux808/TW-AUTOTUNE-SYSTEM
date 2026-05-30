"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VehicleForm from "@/components/vehicles/VehicleForm";
import VehicleList from "@/components/vehicles/VehicleList";
import type { Customer } from "@/types/customer";
import type { Vehicle } from "@/types/vehicle";

export default function VehiclesPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customer_id") || "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    const [{ data: customerData }, { data: vehicleData }] = await Promise.all([
      supabase.from("customers").select("*").order("full_name", { ascending: true }),
      supabase
        .from("vehicles")
        .select("*, customers(full_name, phone)")
        .order("created_at", { ascending: false }),
    ]);

    setCustomers((customerData || []) as Customer[]);
    setVehicles((vehicleData || []) as Vehicle[]);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-3xl font-bold text-slate-900">Vehicles</h1>
            <p className="mt-1 text-slate-600">
              Add and manage customer vehicles for jobs, inspections and invoices.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">Loading vehicles...</div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
            <VehicleForm customers={customers} initialCustomerId={preselectedCustomerId} onVehicleAdded={(vehicleId, customerId) => {
            loadData();

            if (vehicleId && customerId) {
              router.push(`/jobs?customer_id=${customerId}&vehicle_id=${vehicleId}`);
            }
          }} />
            <VehicleList vehicles={vehicles} />
          </div>
        )}
      </div>
    </main>
  );
}







