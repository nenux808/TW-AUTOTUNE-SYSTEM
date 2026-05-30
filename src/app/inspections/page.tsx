"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import InspectionForm from "@/components/inspections/InspectionForm";
import type { Job } from "@/types/job";
import type { InspectionChecklistItem } from "@/types/inspection";

export default function InspectionsPage() {
  const supabase = createClient();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [checklistItems, setChecklistItems] = useState<InspectionChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugMessage, setDebugMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setDebugMessage("");

    const jobRes = await supabase
      .from("jobs")
      .select("*, customers(full_name, phone), vehicles(registration, make, model, year)")
      .order("created_at", { ascending: false });

    const checklistRes = await supabase
      .from("inspection_checklist_items")
      .select("*, inspection_categories(name, sort_order)")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    const errors = [
      jobRes.error ? `Jobs: ${jobRes.error.message}` : "",
      checklistRes.error ? `Checklist: ${checklistRes.error.message}` : "",
    ].filter(Boolean);

    const loadedInfo = `Loaded jobs: ${jobRes.data?.length || 0}, checklist items: ${checklistRes.data?.length || 0}`;

    if (errors.length > 0) {
      setDebugMessage(`${loadedInfo} | ${errors.join(" | ")}`);
    } else {
      setDebugMessage(loadedInfo);
    }

    setJobs((jobRes.data || []) as Job[]);
    setChecklistItems((checklistRes.data || []) as InspectionChecklistItem[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-3xl font-bold text-slate-900">
              Inspection Checklist
            </h1>
            <p className="mt-1 text-slate-600">
              Quick mechanic checklist for brakes, tyres, suspension, fluids,
              battery, lights and attention required items.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {debugMessage && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Debug: {debugMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            Loading inspection checklist...
          </div>
        ) : (
          <InspectionForm
            jobs={jobs}
            checklistItems={checklistItems}
            onInspectionSaved={loadData}
          />
        )}
      </div>
    </main>
  );
}
