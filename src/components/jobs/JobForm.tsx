"use client";



import SearchableVehicleSelect from "@/components/forms/SearchableVehicleSelect";
import SearchableCustomerSelect from "@/components/forms/SearchableCustomerSelect";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/types/customer";
import type { Vehicle } from "@/types/vehicle";

type Props = {
  customers: Customer[];
  vehicles: Vehicle[];
  onJobAdded: () => void; initialCustomerId?: string; initialVehicleId?: string;
};

const jobTypes = [
  { value: "service", label: "Service" },
  { value: "repair", label: "Repair" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "inspection", label: "Inspection" },
  { value: "maintenance", label: "Maintenance" },
  { value: "warranty_check", label: "Warranty Check" },
  { value: "roadworthy_style_check", label: "Roadworthy-style Check" },
  { value: "tyres_wheels", label: "Tyres & Wheels" },
  { value: "4x4_service", label: "4X4 Service" },
  { value: "custom", label: "Custom Job" },
];

const quickReasons = [
  "General service",
  "Logbook service",
  "Student service package",
  "Premium service package",
  "4X4 service package",
  "Engine light on",
  "Brake noise",
  "Battery issue",
  "Oil leak",
  "Coolant leak",
  "Suspension noise",
  "Tyre check",
  "Pre-purchase inspection",
  "Roadworthy-style safety check",
];

function addMonths(date: Date, months: number) {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
}

function toDateInputValue(date: Date) {
  return date.toISOString().split("T")[0];
}

export default function JobForm({ customers, vehicles, onJobAdded, initialCustomerId, initialVehicleId }: Props) {
  const supabase = createClient();

  const defaultNextServiceDate = toDateInputValue(addMonths(new Date(), 6));

  const [form, setForm] = useState({
    customer_id: initialCustomerId || "",
    vehicle_id: initialVehicleId || "",
    job_type: "service",
    priority: "normal",
    status: "new",
    odometer: "",
    next_service_interval_km: "",
    next_service_odometer: "",
    next_service_due_date: defaultNextServiceDate,
    customer_complaint: "",
    initial_notes: "",
    diagnosis_summary: "",
    work_completed: "",
    recommendations: "",
    safety_status: "not_checked",
  });

  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const filteredVehicles = useMemo(() => {
    if (!form.customer_id) return [];
    return vehicles.filter((vehicle) => vehicle.customer_id === form.customer_id);
  }, [form.customer_id, vehicles]);

  const isServiceJob =
    form.job_type === "service" ||
    form.job_type === "maintenance" ||
    form.job_type === "4x4_service";

  function updateField(field: string, value: string) {
    setForm((prev) => {
      if (field === "customer_id") {
        return { ...prev, customer_id: value, vehicle_id: "" };
      }

      if (field === "job_type") {
        return {
          ...prev,
          job_type: value,
          next_service_interval_km:
            value === "service" || value === "maintenance" || value === "4x4_service"
              ? prev.next_service_interval_km
              : "",
          next_service_odometer:
            value === "service" || value === "maintenance" || value === "4x4_service"
              ? prev.next_service_odometer
              : "",
        };
      }

      if (field === "odometer") {
        const odometer = Number(value);
        const interval = Number(prev.next_service_interval_km);

        return {
          ...prev,
          odometer: value,
          next_service_odometer:
            odometer && interval ? String(odometer + interval) : prev.next_service_odometer,
        };
      }

      return { ...prev, [field]: value };
    });
  }

  function toggleReason(reason: string) {
    setSelectedReasons((prev) => {
      if (prev.includes(reason)) {
        return prev.filter((item) => item !== reason);
      }

      return [...prev, reason];
    });
  }

  function setNextServiceInterval(intervalKm: number) {
    const currentOdometer = Number(form.odometer);

    setForm((prev) => ({
      ...prev,
      next_service_interval_km: String(intervalKm),
      next_service_odometer: currentOdometer
        ? String(currentOdometer + intervalKm)
        : "",
      next_service_due_date: prev.next_service_due_date || defaultNextServiceDate,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!form.customer_id || !form.vehicle_id) {
      setMessage("Customer and vehicle are required.");
      setLoading(false);
      return;
    }

    const complaintFromButtons = selectedReasons.length
      ? selectedReasons.join(", ")
      : "";

    const finalComplaint = [complaintFromButtons, form.customer_complaint.trim()]
      .filter(Boolean)
      .join(" | ");

    const { error } = await supabase.from("jobs").insert({
      customer_id: form.customer_id,
      vehicle_id: form.vehicle_id,
      job_type: form.job_type,
      priority: form.priority,
      status: form.status,
      odometer: form.odometer ? Number(form.odometer) : null,
      next_service_interval_km:
        isServiceJob && form.next_service_interval_km
          ? Number(form.next_service_interval_km)
          : null,
      next_service_odometer:
        isServiceJob && form.next_service_odometer
          ? Number(form.next_service_odometer)
          : null,
      next_service_due_date:
        isServiceJob && form.next_service_due_date
          ? form.next_service_due_date
          : null,
      customer_complaint: finalComplaint || null,
      initial_notes: form.initial_notes.trim() || null,
      diagnosis_summary: form.diagnosis_summary.trim() || null,
      work_completed: form.work_completed.trim() || null,
      recommendations: form.recommendations.trim() || null,
      safety_status: form.safety_status,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setForm({
      customer_id: initialCustomerId || "",
      vehicle_id: initialVehicleId || "",
      job_type: "service",
      priority: "normal",
      status: "new",
      odometer: "",
      next_service_interval_km: "",
      next_service_odometer: "",
      next_service_due_date: defaultNextServiceDate,
      customer_complaint: "",
      initial_notes: "",
      diagnosis_summary: "",
      work_completed: "",
      recommendations: "",
      safety_status: "not_checked",
    });

    setSelectedReasons([]);
    setMessage("Job card created successfully.");
    onJobAdded();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-red-600">New Job Card</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Create job</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fast service intake for mechanic jobs and invoices.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Customer *</label>
          <SearchableCustomerSelect
                customers={customers}
                value={form.customer_id}
                onChange={(customerId) => updateField("customer_id", customerId)}
                placeholder="Search customer name, phone, or email..."
              />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Vehicle *</label>
          <SearchableVehicleSelect
                vehicles={vehicles.filter((vehicle) => vehicle.customer_id === form.customer_id)}
                value={form.vehicle_id}
                disabled={!form.customer_id}
                onChange={(vehicleId) => updateField("vehicle_id", vehicleId)}
                placeholder="Search registration, make, model, or year..."
              />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Job type</label>
          <select
            value={form.job_type}
            onChange={(e) => updateField("job_type", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            {jobTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => updateField("priority", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Job status</label>
          <select
            value={form.status}
            onChange={(e) => updateField("status", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="new">New</option>
            <option value="diagnosing">Diagnosing</option>
            <option value="waiting_approval">Waiting for Approval</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_parts">Waiting for Parts</option>
            <option value="completed">Completed</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Safety status</label>
          <select
            value={form.safety_status}
            onChange={(e) => updateField("safety_status", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="not_checked">Not Checked</option>
            <option value="safe">Safe</option>
            <option value="monitor">Monitor</option>
            <option value="attention_required">Attention Required</option>
            <option value="unsafe">Unsafe</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Current odometer</label>
          <input
            type="number"
            value={form.odometer}
            onChange={(e) => updateField("odometer", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="175350"
          />
        </div>

        {isServiceJob && (
          <div className="md:col-span-2 rounded-2xl border border-red-100 bg-red-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">Next Service Reminder</p>
                <p className="mt-1 text-sm text-slate-600">
                  Select the next service interval. Due date is automatically set to 6 months.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setNextServiceInterval(7000)}
                  className={
                    form.next_service_interval_km === "7000"
                      ? "rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }
                >
                  +7,000 km
                </button>

                <button
                  type="button"
                  onClick={() => setNextServiceInterval(10000)}
                  className={
                    form.next_service_interval_km === "10000"
                      ? "rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }
                >
                  +10,000 km
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Next service odometer
                </label>
                <input
                  type="number"
                  value={form.next_service_odometer}
                  onChange={(e) => updateField("next_service_odometer", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-red-500"
                  placeholder="185350"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Next service date
                </label>
                <input
                  type="date"
                  value={form.next_service_due_date}
                  onChange={(e) => updateField("next_service_due_date", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-red-500"
                />
              </div>
            </div>

            {form.odometer && form.next_service_odometer && (
              <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Next service will show as:{" "}
                {Number(form.next_service_odometer).toLocaleString()} km or{" "}
                {form.next_service_due_date || "6 months"}.
              </p>
            )}
          </div>
        )}

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">
            Quick job reason
          </label>

          <div className="mt-2 flex flex-wrap gap-2">
            {quickReasons.map((reason) => {
              const active = selectedReasons.includes(reason);

              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggleReason(reason)}
                  className={
                    active
                      ? "rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white"
                      : "rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  }
                >
                  {active ? "Selected: " : "+ "}
                  {reason}
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">
            Extra customer complaint / request
          </label>
          <textarea
            value={form.customer_complaint}
            onChange={(e) => updateField("customer_complaint", e.target.value)}
            className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="Only type if extra detail is needed..."
          />
        </div>

        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold text-slate-900">Mechanic note sections</p>
          <p className="mt-1 text-sm text-slate-500">
            Keep these short. Main inspection should be done using the checklist.
          </p>

          <div className="mt-4 grid gap-4">
            <textarea
              value={form.initial_notes}
              onChange={(e) => updateField("initial_notes", e.target.value)}
              className="min-h-16 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Initial notes, optional..."
            />

            <textarea
              value={form.diagnosis_summary}
              onChange={(e) => updateField("diagnosis_summary", e.target.value)}
              className="min-h-16 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Diagnosis summary, optional..."
            />

            <textarea
              value={form.recommendations}
              onChange={(e) => updateField("recommendations", e.target.value)}
              className="min-h-16 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Recommendations, optional..."
            />
          </div>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {loading ? "Saving..." : "Create Job"}
      </button>
    </form>
  );
}



