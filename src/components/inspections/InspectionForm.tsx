"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/types/job";
import type {
  InspectionChecklistItem,
  JobInspectionItemInput,
} from "@/types/inspection";

type Props = {
  jobs: Job[];
  checklistItems: InspectionChecklistItem[];
  onInspectionSaved: () => void;
};

const statuses = [
  { value: "not_checked", label: "Not Checked" },
  { value: "good", label: "Good" },
  { value: "monitor", label: "Monitor" },
  { value: "attention_required", label: "Attention" },
  { value: "urgent", label: "Urgent" },
  { value: "repaired", label: "Repaired" },
  { value: "not_applicable", label: "N/A" },
];

function statusClass(status: string, active: boolean) {
  if (!active) {
    return "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  }

  switch (status) {
    case "good":
      return "border-green-600 bg-green-600 text-white";
    case "monitor":
      return "border-yellow-500 bg-yellow-500 text-white";
    case "attention_required":
      return "border-orange-600 bg-orange-600 text-white";
    case "urgent":
      return "border-red-700 bg-red-700 text-white";
    case "repaired":
      return "border-blue-600 bg-blue-600 text-white";
    case "not_applicable":
      return "border-slate-600 bg-slate-600 text-white";
    default:
      return "border-slate-950 bg-slate-950 text-white";
  }
}

function formatJobNumber(jobNumber: number) {
  return "JOB-" + String(jobNumber).padStart(5, "0");
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function categoryCounts(items: JobInspectionItemInput[]) {
  return {
    total: items.length,
    good: items.filter((item) => item.status === "good").length,
    monitor: items.filter((item) => item.status === "monitor").length,
    attention: items.filter((item) => item.status === "attention_required").length,
    urgent: items.filter((item) => item.status === "urgent").length,
    repaired: items.filter((item) => item.status === "repaired").length,
    checked: items.filter((item) => item.status !== "not_checked").length,
  };
}

export default function InspectionForm({
  jobs,
  checklistItems,
  onInspectionSaved,
}: Props) {
  const supabase = createClient();

  const [selectedJobId, setSelectedJobId] = useState("");
  const [items, setItems] = useState<JobInspectionItemInput[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [overallStatus, setOverallStatus] = useState("not_checked");
  const [customerVisibleNotes, setCustomerVisibleNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedJob = jobs.find((job) => job.id === selectedJobId);

  const groupedItems = useMemo(() => {
    const groups: Record<string, JobInspectionItemInput[]> = {};

    items.forEach((item) => {
      if (!groups[item.category_name]) {
        groups[item.category_name] = [];
      }

      groups[item.category_name].push(item);
    });

    return groups;
  }, [items]);

  const categories = Object.keys(groupedItems);

  const activeItems = activeCategory ? groupedItems[activeCategory] || [] : [];

  function loadChecklistForJob(jobId: string) {
    setSelectedJobId(jobId);
    setMessage("");

    if (!jobId) {
      setItems([]);
      setActiveCategory("");
      return;
    }

    const preparedItems = checklistItems.map((item) => ({
      checklist_item_id: item.id,
      category_name: item.inspection_categories?.name || "General",
      item_name: item.item_name,
      status: "not_checked",
      measurement_value: "",
      measurement_unit: item.measurement_unit || "",
      mechanic_note: "",
      recommendation: "",
      repaired_during_job: false,
      show_on_invoice: item.default_customer_visible,
      quote_required: false,
    }));

    setItems(preparedItems);

    const firstCategory = preparedItems[0]?.category_name || "";
    setActiveCategory(firstCategory);
  }

  function updateItem(
    categoryName: string,
    itemName: string,
    field: keyof JobInspectionItemInput,
    value: string | boolean
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.category_name === categoryName && item.item_name === itemName
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function setItemStatus(categoryName: string, itemName: string, status: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.category_name === categoryName && item.item_name === itemName
          ? {
              ...item,
              status,
              repaired_during_job: status === "repaired",
              quote_required:
                status === "attention_required" || status === "urgent"
                  ? true
                  : item.quote_required,
            }
          : item
      )
    );
  }

  function setWholeCategoryStatus(categoryName: string, status: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.category_name === categoryName
          ? {
              ...item,
              status,
              repaired_during_job: status === "repaired",
              quote_required:
                status === "attention_required" || status === "urgent"
                  ? true
                  : item.quote_required,
            }
          : item
      )
    );
  }

  async function handleSaveInspection() {
    setLoading(true);
    setMessage("");

    if (!selectedJob) {
      setMessage("Select a job first.");
      setLoading(false);
      return;
    }

    const { data: inspection, error: inspectionError } = await supabase
      .from("job_inspections")
      .insert({
        job_id: selectedJob.id,
        vehicle_id: selectedJob.vehicle_id,
        overall_status: overallStatus,
        odometer: selectedJob.odometer,
        customer_visible_notes: customerVisibleNotes.trim() || null,
        internal_notes: internalNotes.trim() || null,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (inspectionError || !inspection) {
      setMessage(inspectionError?.message || "Could not create inspection.");
      setLoading(false);
      return;
    }

    const checkedItems = items.filter(
      (item) =>
        item.status !== "not_checked" ||
        item.measurement_value ||
        item.mechanic_note ||
        item.recommendation
    );

    if (checkedItems.length > 0) {
      const payload = checkedItems.map((item) => ({
        inspection_id: inspection.id,
        checklist_item_id: item.checklist_item_id,
        category_name: item.category_name,
        item_name: item.item_name,
        status: item.status,
        measurement_value: item.measurement_value || null,
        measurement_unit: item.measurement_unit || null,
        mechanic_note: item.mechanic_note || null,
        recommendation: item.recommendation || null,
        repaired_during_job: item.repaired_during_job,
        show_on_invoice: item.show_on_invoice,
        quote_required: item.quote_required,
      }));

      const { error: itemError } = await supabase
        .from("job_inspection_items")
        .insert(payload);

      if (itemError) {
        setMessage(itemError.message);
        setLoading(false);
        return;
      }
    }

    setMessage("Inspection saved successfully.");
    setSelectedJobId("");
    setItems([]);
    setActiveCategory("");
    setOverallStatus("not_checked");
    setCustomerVisibleNotes("");
    setInternalNotes("");
    onInspectionSaved();
    setLoading(false);
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-red-600">Mechanic Checklist</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">
          Vehicle Inspection
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Fast category-based inspection. Select a category, tap status, add notes only when needed.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Select job</label>
          <select
            value={selectedJobId}
            onChange={(e) => loadChecklistForJob(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="">Select job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {formatJobNumber(job.job_number)} - {job.customers?.full_name} -{" "}
                {job.vehicles?.registration}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">
            Overall status
          </label>
          <select
            value={overallStatus}
            onChange={(e) => setOverallStatus(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="not_checked">Not Checked</option>
            <option value="good">Good</option>
            <option value="monitor">Monitor</option>
            <option value="attention_required">Attention Required</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {selectedJob && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {formatJobNumber(selectedJob.job_number)} -{" "}
            {selectedJob.customers?.full_name}
          </p>
          <p>
            Vehicle:{" "}
            <span className="font-semibold uppercase">
              {selectedJob.vehicles?.registration}
            </span>{" "}
            {[selectedJob.vehicles?.make, selectedJob.vehicles?.model]
              .filter(Boolean)
              .join(" ")}
          </p>
          <p>Odometer: {selectedJob.odometer?.toLocaleString() || "-"} km</p>
        </div>
      )}

      {selectedJob && categories.length > 0 && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Categories</p>
                <p className="text-xs text-slate-500">
                  {categories.length} inspection groups
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {categories.map((category) => {
                const counts = categoryCounts(groupedItems[category] || []);
                const active = activeCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={
                      active
                        ? "rounded-xl border border-slate-950 bg-slate-950 p-3 text-left text-white"
                        : "rounded-xl border border-slate-200 bg-white p-3 text-left text-slate-700 hover:border-red-300 hover:bg-red-50"
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{category}</span>
                      <span
                        className={
                          active
                            ? "rounded-full bg-white/10 px-2 py-1 text-xs text-white"
                            : "rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                        }
                      >
                        {counts.checked}/{counts.total}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                        G {counts.good}
                      </span>
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">
                        M {counts.monitor}
                      </span>
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">
                        A {counts.attention}
                      </span>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                        U {counts.urgent}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="rounded-t-2xl bg-slate-950 px-5 py-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{activeCategory}</h3>
                  <p className="text-sm text-slate-300">
                    Mark all items quickly. Use notes only when needed.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setWholeCategoryStatus(activeCategory, "good")}
                    className="rounded-full bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    Mark Category Good
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setWholeCategoryStatus(activeCategory, "not_checked")
                    }
                    className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    Reset Category
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-4">
              {activeItems.map((item) => (
                <div
                  key={`${item.category_name}-${item.item_name}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-4 2xl:grid-cols-[260px_1fr]">
                    <div>
                      <p className="font-bold text-slate-900">{item.item_name}</p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        Current: {formatStatus(item.status)}
                      </p>

                      {item.measurement_unit && (
                        <div className="mt-3">
                          <label className="text-xs font-semibold text-slate-600">
                            Measurement ({item.measurement_unit})
                          </label>
                          <input
                            value={item.measurement_value}
                            onChange={(e) =>
                              updateItem(
                                item.category_name,
                                item.item_name,
                                "measurement_value",
                                e.target.value
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                            placeholder={item.measurement_unit}
                          />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        {statuses.map((status) => (
                          <button
                            key={status.value}
                            type="button"
                            onClick={() =>
                              setItemStatus(
                                item.category_name,
                                item.item_name,
                                status.value
                              )
                            }
                            className={`rounded-full border px-3 py-2 text-xs font-semibold ${statusClass(
                              status.value,
                              item.status === status.value
                            )}`}
                          >
                            {status.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <input
                          value={item.mechanic_note}
                          onChange={(e) =>
                            updateItem(
                              item.category_name,
                              item.item_name,
                              "mechanic_note",
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                          placeholder="Optional mechanic note"
                        />

                        <input
                          value={item.recommendation}
                          onChange={(e) =>
                            updateItem(
                              item.category_name,
                              item.item_name,
                              "recommendation",
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                          placeholder="Recommendation"
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.show_on_invoice}
                            onChange={(e) =>
                              updateItem(
                                item.category_name,
                                item.item_name,
                                "show_on_invoice",
                                e.target.checked
                              )
                            }
                          />
                          Show on invoice
                        </label>

                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.quote_required}
                            onChange={(e) =>
                              updateItem(
                                item.category_name,
                                item.item_name,
                                "quote_required",
                                e.target.checked
                              )
                            }
                          />
                          Quote required
                        </label>

                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.repaired_during_job}
                            onChange={(e) =>
                              updateItem(
                                item.category_name,
                                item.item_name,
                                "repaired_during_job",
                                e.target.checked
                              )
                            }
                          />
                          Repaired during job
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {selectedJob && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Customer-visible summary
            </label>
            <textarea
              value={customerVisibleNotes}
              onChange={(e) => setCustomerVisibleNotes(e.target.value)}
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Short summary shown to customer..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Internal notes
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Private staff notes..."
            />
          </div>
        </div>
      )}

      {message && (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      )}

      {selectedJob && (
        <button
          type="button"
          onClick={handleSaveInspection}
          disabled={loading}
          className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Inspection"}
        </button>
      )}
    </div>
  );
}
