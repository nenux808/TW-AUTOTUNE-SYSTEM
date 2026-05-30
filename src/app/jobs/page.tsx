"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import JobForm from "@/components/jobs/JobForm";
import JobList from "@/components/jobs/JobList";
import type { Customer } from "@/types/customer";
import type { Vehicle } from "@/types/vehicle";
import type { Job } from "@/types/job";

export default function JobsPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customer_id") || "";
  const preselectedVehicleId = searchParams.get("vehicle_id") || "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugMessage, setDebugMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setDebugMessage("");

    const customerRes = await supabase
      .from("customers")
      .select("*")
      .order("full_name", { ascending: true });

    const vehicleRes = await supabase
      .from("vehicles")
      .select("*, customers(full_name, phone)")
      .order("created_at", { ascending: false });

    const jobRes = await supabase
      .from("jobs")
      .select("*, customers(full_name, phone), vehicles(registration, make, model, year)")
      .order("created_at", { ascending: false });

    const errors = [
      customerRes.error ? `Customers: ${customerRes.error.message}` : "",
      vehicleRes.error ? `Vehicles: ${vehicleRes.error.message}` : "",
      jobRes.error ? `Jobs: ${jobRes.error.message}` : "",
    ].filter(Boolean);

    const loadedInfo = `Loaded customers: ${customerRes.data?.length || 0}, vehicles: ${vehicleRes.data?.length || 0}, jobs: ${jobRes.data?.length || 0}`;

    if (errors.length > 0) {
      setDebugMessage(`${loadedInfo} | ${errors.join(" | ")}`);
    } else {
      setDebugMessage(loadedInfo);
    }

    setCustomers((customerRes.data || []) as Customer[]);
    setVehicles((vehicleRes.data || []) as Vehicle[]);
    setJobs((jobRes.data || []) as Job[]);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Jobs / Repair Orders
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Fast job intake with job type, customer, vehicle, priority and mechanic notes.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {debugMessage && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
            Debug: {debugMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">Loading jobs...</div>
        ) : (
          <div className="grid w-full gap-6 xl:grid-cols-[440px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)]">
            <div className="min-w-0">
              <JobForm customers={customers} vehicles={vehicles} initialCustomerId={preselectedCustomerId} initialVehicleId={preselectedVehicleId} onJobAdded={loadData} />
            </div>

            <div className="min-w-0">
              <JobList jobs={jobs} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}







