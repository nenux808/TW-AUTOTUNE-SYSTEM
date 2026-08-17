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

type ExistingInspectionItem = {
  id: string;
  checklist_item_id: string | null;
  category_name: string;
  item_name: string;
  status: string;
  measurement_value: string | null;
  measurement_unit: string | null;
  mechanic_note: string | null;
  recommendation: string | null;
  repaired_during_job: boolean;
  show_on_invoice: boolean;
  quote_required: boolean;
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

function buildBlankChecklistItems(checklistItems: InspectionChecklistItem[]) {
  return checklistItems.map((item) => ({
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
}

export default function InspectionForm({
  jobs,
  checklistItems,
  onInspectionSaved,
}: Props) {
  const supabase = createClient();

  const [selectedJobId, setSelectedJobId] = useState("");
  const [existingInspectionId, setExistingInspectionId] = useState<string | null>(null);
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

  async function loadChecklistForJob(jobId: string) {
    setSelectedJobId(jobId);
    setExistingInspectionId(null);
    setMessage("");
    setOverallStatus("not_checked");
    setCustomerVisibleNotes("");
    setInternalNotes("");

    if (!jobId) {
      setItems([]);
      setActiveCategory("");
      return;
    }

    setLoading(true);

    const preparedItems = buildBlankChecklistItems(checklistItems);

    const { data: existingInspection, error: inspectionError } = await supabase
      .from("job_inspections")
      .select("id, overall_status, customer_visible_notes, internal_notes, completed_at, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inspectionError) {
      setItems(preparedItems);
      setActiveCategory(preparedItems[0]?.category_name || "");
      setMessage(`Could not load saved inspection. Starting new checklist. ${inspectionError.message}`);
      setLoading(false);
      return;
    }

    if (!existingInspection) {
      setItems(preparedItems);
      setActiveCategory(preparedItems[0]?.category_name || "");
      setMessage("No saved inspection found for this job. Starting a new checklist.");
      setLoading(false);
      return;
    }

    const { data: savedItems, error: itemError } = await supabase
      .from("job_inspection_items")
      .select("id, checklist_item_id, category_name, item_name, status, measurement_value, measurement_unit, mechanic_note, recommendation, repaired_during_job, show_on_invoice, quote_required")
      .eq("inspection_id", existingInspection.id);

    if (itemError) {
      setItems(preparedItems);
      setActiveCategory(preparedItems[0]?.category_name || "");
      setMessage(`Saved inspection found, but checklist items could not be loaded. ${itemError.message}`);
      setLoading(false);
      return;
    }

    const savedItemsByChecklistId = new Map<string, ExistingInspectionItem>();
    const savedItemsByName = new Map<string, ExistingInspectionItem>();

    (savedItems || []).forEach((item: ExistingInspectionItem) => {
      if (item.checklist_item_id) {
        savedItemsByChecklistId.set(item.checklist_item_id, item);
      }

      savedItemsByName.set(`${item.category_name}::${item.item_name}`, item);
    });

    const mergedItems = preparedItems.map((item) => {
      const savedItem =
        savedItemsByChecklistId.get(item.checklist_item_id) ||
        savedItemsByName.get(`${item.category_name}::${item.item_name}`);

      if (!savedItem) return item;

      return {
        ...item,
        status: savedItem.status || "not_checked",
        measurement_value: savedItem.measurement_value || "",
        measurement_unit: savedItem.measurement_unit || item.measurement_unit || "",
        mechanic_note: savedItem.mechanic_note || "",
        recommendation: savedItem.recommendation || "",
        repaired_during_job: savedItem.repaired_during_job || false,
        show_on_invoice: savedItem.show_on_invoice,
        quote_required: savedItem.quote_required || false,
      };
    });

    setExistingInspectionId(existingInspection.id);
    setOverallStatus(existingInspection.overall_status || "not_checked");
    setCustomerVisibleNotes(existingInspection.customer_visible_notes || "");
    setInternalNotes(existingInspection.internal_notes || "");
    setItems(mergedItems);
    setActiveCategory(mergedItems[0]?.category_name || "");
    setMessage("Saved inspection loaded. You are editing the existing checklist for this job.");
    setLoading(false);
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

    const inspectionPayload = {
      job_id: selectedJob.id,
      vehicle_id: selectedJob.vehicle_id,
      overall_status: overallStatus,
      odometer: selectedJob.odometer,
      customer_visible_notes: customerVisibleNotes.trim() || null,
      internal_notes: internalNotes.trim() || null,
      completed_at: new Date().toISOString(),
    };

    let inspectionId = existingInspectionId;

    if (inspectionId) {
      const { error: updateError } = await supabase
        .from("job_inspections")
        .update(inspectionPayload)
        .eq("id", inspectionId);

      if (updateError) {
        setMessage(updateError.message);
        setLoading(false);
        return;
      }
    } else {
      const { data: inspection, error: inspectionError } = await supabase
        .from("job_inspections")
        .insert(inspectionPayload)
        .select("id")
        .single();

      if (inspectionError || !inspection) {
        setMessage(inspectionError?.message || "Could not create inspection.");
        setLoading(false);
        return;
      }

      inspectionId = inspection.id;
      setExistingInspectionId(inspection.id);
    }

    const checkedItems = items.filter(
      (item) =>
        item.status !== "not_checked" ||
        item.measurement_value ||
        item.mechanic_note ||
        item.recommendation ||
        item.quote_required ||
        item.repaired_during_job
    );

    const { error: deleteItemsError } = await supabase
      .from("job_inspection_items")
      .delete()
      .eq("inspection_id", inspectionId);

    if (deleteItemsError) {
      setMessage(deleteItemsError.message);
      setLoading(false);
      return;
    }

    if (checkedItems.length > 0) {
      const payload = checkedItems.map((item) => ({
        inspection_id: inspectionId,
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

    setMessage(existingInspectionId ? "Inspection updated successfully." : "Inspection saved successfully.");
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
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

            <span
              className={
                existingInspectionId
                  ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                  : "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
              }
            >
              {existingInspectionId ? "Editing saved inspection" : "New inspection"}
            </span>
          </div>
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
                    onClick={() => setWholeCategoryStatus(activeCategory, "not_checked")}
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
          {loading ? "Saving..." : existingInspectionId ? "Update Inspection" : "Save Inspection"}
        </button>
      )}
    </div>
  );
}
