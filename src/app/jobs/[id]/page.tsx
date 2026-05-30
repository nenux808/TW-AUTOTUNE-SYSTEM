"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type JobDetail = {
  id: string;
  job_number: number;
  job_type: string;
  priority: string;
  status: string;
  safety_status: string | null;
  odometer: number | null;
  next_service_interval_km: number | null;
  next_service_odometer: number | null;
  next_service_due_date: string | null;
  customer_complaint: string | null;
  initial_notes: string | null;
  diagnosis_summary: string | null;
  work_completed: string | null;
  recommendations: string | null;
  created_at: string;
  customer_id: string;
  vehicle_id: string;
  customers: {
    full_name: string;
    phone: string;
    email: string | null;
    address: string | null;
    customer_type: string;
  } | null;
  vehicles: {
    registration: string;
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string | null;
    fuel_type: string | null;
    transmission: string | null;
    vehicle_type: string | null;
  } | null;
};

type Inspection = {
  id: string;
  overall_status: string | null;
  customer_visible_notes: string | null;
  internal_notes: string | null;
  completed_at: string | null;
  created_at: string;
};

type InspectionItem = {
  id: string;
  category_name: string;
  item_name: string;
  status: string;
  measurement_value: string | null;
  measurement_unit: string | null;
  mechanic_note: string | null;
  recommendation: string | null;
  repaired_during_job: boolean;
  quote_required: boolean;
  show_on_invoice: boolean;
};

type DiagnosticCode = {
  id: string;
  code: string;
  system: string | null;
  description: string | null;
  status: string | null;
  severity: string | null;
  mechanic_note: string | null;
  recommendation: string | null;
  cleared_after_service: boolean;
  created_at: string;
};

function formatStatus(value?: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function formatJobNumber(jobNumber?: number) {
  return "JOB-" + String(jobNumber || 0).padStart(5, "0");
}

function badgeClass(status?: string | null) {
  switch (status) {
    case "good":
    case "safe":
      return "bg-green-100 text-green-700 border-green-200";
    case "monitor":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "attention_required":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "urgent":
    case "unsafe":
      return "bg-red-100 text-red-700 border-red-200";
    case "repaired":
    case "completed":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "not_applicable":
      return "bg-slate-200 text-slate-700 border-slate-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function categorySummary(items: InspectionItem[]) {
  return {
    good: items.filter((item) => item.status === "good").length,
    monitor: items.filter((item) => item.status === "monitor").length,
    attention: items.filter((item) => item.status === "attention_required").length,
    urgent: items.filter((item) => item.status === "urgent").length,
    repaired: items.filter((item) => item.status === "repaired").length,
    na: items.filter((item) => item.status === "not_applicable").length,
  };
}

export default function JobDetailsPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [diagnosticCodes, setDiagnosticCodes] = useState<DiagnosticCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [codeForm, setCodeForm] = useState({
    code: "",
    system: "Engine",
    description: "",
    status: "active",
    severity: "medium",
    mechanic_note: "",
    recommendation: "",
    cleared_after_service: false,
  });

  const latestInspection = inspections[0];

  const attentionItems = useMemo(() => {
    return inspectionItems.filter((item) =>
      ["monitor", "attention_required", "urgent"].includes(item.status)
    );
  }, [inspectionItems]);

  const groupedChecklist = useMemo(() => {
    const groups: Record<string, InspectionItem[]> = {};

    inspectionItems.forEach((item) => {
      if (!groups[item.category_name]) {
        groups[item.category_name] = [];
      }

      groups[item.category_name].push(item);
    });

    return groups;
  }, [inspectionItems]);

  async function loadJobDetails() {
    setLoading(true);
    setMessage("");

    const jobRes = await supabase
      .from("jobs")
      .select(`
        *,
        customers(full_name, phone, email, address, customer_type),
        vehicles(registration, make, model, year, vin, fuel_type, transmission, vehicle_type)
      `)
      .eq("id", params.id)
      .single();

    if (jobRes.error) {
      setMessage(jobRes.error.message);
      setLoading(false);
      return;
    }

    const inspectionRes = await supabase
      .from("job_inspections")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false });

    const diagnosticRes = await supabase
      .from("diagnostic_codes")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false });

    setJob(jobRes.data as JobDetail);
    setInspections((inspectionRes.data || []) as Inspection[]);
    setDiagnosticCodes((diagnosticRes.data || []) as DiagnosticCode[]);

    const latest = inspectionRes.data?.[0];

    if (latest) {
      const itemsRes = await supabase
        .from("job_inspection_items")
        .select("*")
        .eq("inspection_id", latest.id)
        .order("category_name", { ascending: true });

      setInspectionItems((itemsRes.data || []) as InspectionItem[]);
    } else {
      setInspectionItems([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadJobDetails();
  }, [params.id]);

  function updateCodeForm(field: string, value: string | boolean) {
    setCodeForm((prev) => ({ ...prev, [field]: value }));
  }

  async function addDiagnosticCode(e: React.FormEvent) {
    e.preventDefault();

    if (!job) return;

    setMessage("");

    if (!codeForm.code.trim()) {
      setMessage("Diagnostic code is required.");
      return;
    }

    const { error } = await supabase.from("diagnostic_codes").insert({
      job_id: job.id,
      vehicle_id: job.vehicle_id,
      code: codeForm.code.trim().toUpperCase(),
      system: codeForm.system || null,
      description: codeForm.description.trim() || null,
      status: codeForm.status,
      severity: codeForm.severity,
      mechanic_note: codeForm.mechanic_note.trim() || null,
      recommendation: codeForm.recommendation.trim() || null,
      cleared_after_service: codeForm.cleared_after_service,
      show_on_invoice: true,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setCodeForm({
      code: "",
      system: "Engine",
      description: "",
      status: "active",
      severity: "medium",
      mechanic_note: "",
      recommendation: "",
      cleared_after_service: false,
    });

    setMessage("Diagnostic code added.");
    loadJobDetails();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          Loading job card...
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-semibold text-red-600">Job not found.</p>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
          <Link
            href="/jobs"
            className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-2 text-white"
          >
            Back to Jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-3xl font-bold text-slate-900">
              {formatJobNumber(job.job_number)} Job Card
            </h1>
            <p className="mt-1 text-slate-600">
              Job details, compact inspection chart, attention items and diagnostic codes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/inspections"
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Add / Update Inspection
            </Link>

            <Link
              href="/jobs"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Jobs
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-sm text-red-300">Job Overview</p>
            <h2 className="mt-2 text-2xl font-bold">
              {formatJobNumber(job.job_number)}
            </h2>

            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Type</span>
                <span className="font-semibold capitalize">
                  {formatStatus(job.job_type)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Priority</span>
                <span className="font-semibold capitalize">
                  {formatStatus(job.priority)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Status</span>
                <span className="font-semibold capitalize">
                  {formatStatus(job.status)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Safety</span>
                <span className="font-semibold capitalize">
                  {formatStatus(job.safety_status)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Odometer</span>
                <span className="font-semibold">
                  {job.odometer ? `${job.odometer.toLocaleString()} km` : "-"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Next Service</span>
                <span className="text-right font-semibold">
                  {job.next_service_odometer
                    ? `${job.next_service_odometer.toLocaleString()} km`
                    : "-"}
                  {job.next_service_due_date
                    ? ` / ${job.next_service_due_date}`
                    : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Customer</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {job.customers?.full_name || "-"}
            </h2>

            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Phone:</span>{" "}
                {job.customers?.phone || "-"}
              </p>
              <p>
                <span className="font-semibold">Email:</span>{" "}
                {job.customers?.email || "-"}
              </p>
              <p>
                <span className="font-semibold">Type:</span>{" "}
                {job.customers?.customer_type || "-"}
              </p>
              <p>
                <span className="font-semibold">Address:</span>{" "}
                {job.customers?.address || "-"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Vehicle</p>
            <h2 className="mt-2 text-xl font-bold uppercase text-slate-900">
              {job.vehicles?.registration || "-"}
            </h2>

            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Vehicle:</span>{" "}
                {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") ||
                  "-"}
              </p>
              <p>
                <span className="font-semibold">Year:</span>{" "}
                {job.vehicles?.year || "-"}
              </p>
              <p>
                <span className="font-semibold">Fuel:</span>{" "}
                {job.vehicles?.fuel_type || "-"}
              </p>
              <p>
                <span className="font-semibold">Transmission:</span>{" "}
                {job.vehicles?.transmission || "-"}
              </p>
              <p>
                <span className="font-semibold">VIN:</span>{" "}
                {job.vehicles?.vin || "-"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Customer Request</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Complaint / Reason
            </h2>
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              {job.customer_complaint || "No customer request recorded."}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Mechanic Notes</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Notes</h2>

            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Initial Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {job.initial_notes || "-"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Diagnosis Summary</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {job.diagnosis_summary || "-"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Recommendations</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {job.recommendations || "-"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-600">Inspection</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Latest Inspection Results
              </h2>
            </div>

            {latestInspection ? (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${badgeClass(
                  latestInspection.overall_status
                )}`}
              >
                {formatStatus(latestInspection.overall_status)}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                No inspection
              </span>
            )}
          </div>

          {!latestInspection ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600">
                No inspection saved for this job yet.
              </p>
              <Link
                href="/inspections"
                className="mt-4 inline-block rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Start Inspection
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-900">
                    Customer-visible Summary
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    {latestInspection.customer_visible_notes || "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-900">Internal Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    {latestInspection.internal_notes || "-"}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-bold text-slate-900">
                  Attention Required / Monitor Items
                </h3>

                {attentionItems.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                    No attention required items recorded.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <thead className="bg-slate-950 text-white">
                        <tr>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Measurement</th>
                          <th className="px-4 py-3">Note</th>
                          <th className="px-4 py-3">Recommendation</th>
                        </tr>
                      </thead>

                      <tbody>
                        {attentionItems.map((item) => (
                          <tr key={item.id} className="border-t border-slate-200">
                            <td className="px-4 py-3">{item.category_name}</td>
                            <td className="px-4 py-3 font-semibold">
                              {item.item_name}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${badgeClass(
                                  item.status
                                )}`}
                              >
                                {formatStatus(item.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {item.measurement_value
                                ? `${item.measurement_value} ${
                                    item.measurement_unit || ""
                                  }`
                                : "-"}
                            </td>
                            <td className="px-4 py-3">{item.mechanic_note || "-"}</td>
                            <td className="px-4 py-3">
                              {item.recommendation || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-bold text-slate-900">
                  Compact Checklist Chart
                </h3>

                {Object.entries(groupedChecklist).length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    No checklist items saved.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-4">
                    {Object.entries(groupedChecklist).map(([category, items]) => {
                      const summary = categorySummary(items);

                      return (
                        <div
                          key={category}
                          className="rounded-2xl border border-slate-200 bg-white"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl bg-slate-950 px-4 py-3 text-white">
                            <h4 className="font-bold">{category}</h4>

                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-green-500/20 px-3 py-1 font-semibold text-green-100">
                                Good: {summary.good}
                              </span>

                              <span className="rounded-full bg-yellow-500/20 px-3 py-1 font-semibold text-yellow-100">
                                Monitor: {summary.monitor}
                              </span>

                              <span className="rounded-full bg-orange-500/20 px-3 py-1 font-semibold text-orange-100">
                                Attention: {summary.attention}
                              </span>

                              <span className="rounded-full bg-red-500/20 px-3 py-1 font-semibold text-red-100">
                                Urgent: {summary.urgent}
                              </span>

                              <span className="rounded-full bg-blue-500/20 px-3 py-1 font-semibold text-blue-100">
                                Repaired: {summary.repaired}
                              </span>
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {items.map((item) => {
                                const hasExtra =
                                  item.measurement_value ||
                                  item.mechanic_note ||
                                  item.recommendation;

                                return (
                                  <div
                                    key={item.id}
                                    className={`rounded-xl border px-3 py-2 text-xs ${badgeClass(
                                      item.status
                                    )}`}
                                    title={[
                                      item.measurement_value
                                        ? `Measurement: ${item.measurement_value} ${
                                            item.measurement_unit || ""
                                          }`
                                        : "",
                                      item.mechanic_note
                                        ? `Note: ${item.mechanic_note}`
                                        : "",
                                      item.recommendation
                                        ? `Recommendation: ${item.recommendation}`
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" | ")}
                                  >
                                    <div className="font-bold">{item.item_name}</div>

                                    <div className="mt-1 capitalize">
                                      {formatStatus(item.status)}
                                      {item.measurement_value
                                        ? ` - ${item.measurement_value} ${
                                            item.measurement_unit || ""
                                          }`
                                        : ""}
                                    </div>

                                    {hasExtra && (
                                      <div className="mt-1 font-semibold">
                                        Details added
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {items.some(
                              (item) => item.mechanic_note || item.recommendation
                            ) && (
                              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                                <p className="text-sm font-bold text-slate-900">
                                  Notes / Recommendations
                                </p>

                                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                                  {items
                                    .filter(
                                      (item) =>
                                        item.mechanic_note || item.recommendation
                                    )
                                    .map((item) => (
                                      <div
                                        key={`${item.id}-note`}
                                        className="rounded-lg bg-white p-3"
                                      >
                                        <p className="font-semibold text-slate-900">
                                          {item.item_name}
                                        </p>

                                        {item.mechanic_note && (
                                          <p className="mt-1">
                                            <span className="font-semibold">
                                              Note:
                                            </span>{" "}
                                            {item.mechanic_note}
                                          </p>
                                        )}

                                        {item.recommendation && (
                                          <p className="mt-1 text-red-700">
                                            <span className="font-semibold">
                                              Recommendation:
                                            </span>{" "}
                                            {item.recommendation}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={addDiagnosticCode} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Diagnostic Scanner</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Add Error Code</h2>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Code *</label>
                <input
                  value={codeForm.code}
                  onChange={(e) => updateCodeForm("code", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-red-500"
                  placeholder="P0301"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">System</label>
                <select
                  value={codeForm.system}
                  onChange={(e) => updateCodeForm("system", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="Engine">Engine</option>
                  <option value="Transmission">Transmission</option>
                  <option value="ABS">ABS</option>
                  <option value="Airbag">Airbag</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Body Control">Body Control</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <input
                  value={codeForm.description}
                  onChange={(e) => updateCodeForm("description", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Cylinder 1 misfire detected"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={codeForm.status}
                    onChange={(e) => updateCodeForm("status", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="stored">Stored</option>
                    <option value="cleared">Cleared</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Severity</label>
                  <select
                    value={codeForm.severity}
                    onChange={(e) => updateCodeForm("severity", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <textarea
                value={codeForm.mechanic_note}
                onChange={(e) => updateCodeForm("mechanic_note", e.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Mechanic note..."
              />

              <textarea
                value={codeForm.recommendation}
                onChange={(e) => updateCodeForm("recommendation", e.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Recommendation..."
              />

              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={codeForm.cleared_after_service}
                  onChange={(e) =>
                    updateCodeForm("cleared_after_service", e.target.checked)
                  }
                />
                Cleared after service
              </label>
            </div>

            <button
              type="submit"
              className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Add Diagnostic Code
            </button>
          </form>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Diagnostic Codes</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Saved Codes</h2>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {diagnosticCodes.length} codes
              </span>
            </div>

            {diagnosticCodes.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                No diagnostic codes recorded yet.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">System</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">Recommendation</th>
                    </tr>
                  </thead>

                  <tbody>
                    {diagnosticCodes.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {item.code}
                        </td>
                        <td className="px-4 py-3">{item.system || "-"}</td>
                        <td className="px-4 py-3">{item.description || "-"}</td>
                        <td className="px-4 py-3 capitalize">
                          {formatStatus(item.status)}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {formatStatus(item.severity)}
                        </td>
                        <td className="px-4 py-3">{item.recommendation || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm text-red-300">Next Step</p>
          <h2 className="mt-1 text-2xl font-bold">Create Invoice from Job Card</h2>
          <p className="mt-2 text-slate-300">
            Next module will pull this job, inspection checklist, attention items,
            diagnostic codes, packages, labour and parts into the 4-page professional invoice pack.
          </p>

          <Link
            href={`/invoices/new?job_id=${job.id}`}
            className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Create Invoice Draft
          </Link>
        </section>
      </div>
    </main>
  );
}





