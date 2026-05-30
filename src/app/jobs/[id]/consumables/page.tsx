"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  job_number: number;
  job_type: string;
  odometer: number | null;
  customers: {
    full_name: string;
    phone: string | null;
  } | null;
  vehicles: {
    registration: string;
    make: string | null;
    model: string | null;
  } | null;
};

type ConsumablePart = {
  id: string;
  part_name: string;
  part_number: string | null;
  category: string | null;
  supplier: string | null;
  cost_price: number | null;
  average_cost: number | null;
  quantity_in_stock: number | null;
  reorder_level: number | null;
  item_type: string | null;
  track_stock: boolean | null;
};

type JobConsumable = {
  id: string;
  job_id: string;
  part_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function formatJobNumber(value?: number) {
  return "JOB-" + String(value || 0).padStart(5, "0");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU");
}

export default function JobConsumablesPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [job, setJob] = useState<Job | null>(null);
  const [parts, setParts] = useState<ConsumablePart[]>([]);
  const [usage, setUsage] = useState<JobConsumable[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    part_id: "",
    quantity: "1",
    notes: "",
  });

  const selectedPart = parts.find((part) => part.id === form.part_id);

  const filteredParts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return parts
      .filter((part) => {
        const searchable = [
          part.part_name,
          part.part_number,
          part.category,
          part.supplier,
          part.item_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return !query || searchable.includes(query);
      })
      .slice(0, 12);
  }, [parts, search]);

  const totalConsumableCost = useMemo(() => {
    return usage.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  }, [usage]);

  const lowStockAfterUse = useMemo(() => {
    if (!selectedPart) return false;

    const currentStock = Number(selectedPart.quantity_in_stock || 0);
    const qty = Number(form.quantity || 0);
    const reorder = Number(selectedPart.reorder_level || 0);
    const after = currentStock - qty;

    return reorder > 0 && after <= reorder;
  }, [selectedPart, form.quantity]);

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const jobRes = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        job_type,
        odometer,
        customers(full_name, phone),
        vehicles(registration, make, model)
      `)
      .eq("id", params.id)
      .single();

    const partsRes = await supabase
      .from("parts")
      .select("id, part_name, part_number, category, supplier, cost_price, average_cost, quantity_in_stock, reorder_level, item_type, track_stock")
      .eq("active", true)
      .eq("track_stock", true)
      .in("item_type", ["consumable", "fluid", "tool"])
      .order("part_name", { ascending: true });

    const usageRes = await supabase
      .from("job_consumables")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false });

    const errors = [
      jobRes.error ? `Job: ${jobRes.error.message}` : "",
      partsRes.error ? `Consumables: ${partsRes.error.message}` : "",
      usageRes.error ? `Usage: ${usageRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setJob((jobRes.data || null) as Job | null);
    setParts((partsRes.data || []) as ConsumablePart[]);
    setUsage((usageRes.data || []) as JobConsumable[]);
    setLoading(false);
  }

  async function addUsage(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedPart) {
      setMessage("Select a consumable item first.");
      return;
    }

    const qty = Number(form.quantity || 0);
    const currentStock = Number(selectedPart.quantity_in_stock || 0);

    if (qty <= 0) {
      setMessage("Quantity must be greater than 0.");
      return;
    }

    if (qty > currentStock) {
      setMessage(`Not enough stock. Current stock is ${currentStock}.`);
      return;
    }

    setSaving(true);
    setMessage("");

    const unitCost = Number(selectedPart.average_cost || selectedPart.cost_price || 0);
    const totalCost = qty * unitCost;
    const newStock = currentStock - qty;

    const { error: usageError } = await supabase.from("job_consumables").insert({
      job_id: params.id,
      part_id: selectedPart.id,
      item_name: selectedPart.part_name,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: totalCost,
      notes: form.notes.trim() || null,
    });

    if (usageError) {
      setMessage(usageError.message);
      setSaving(false);
      return;
    }

    const { error: stockError } = await supabase
      .from("parts")
      .update({
        quantity_in_stock: newStock,
      })
      .eq("id", selectedPart.id);

    if (stockError) {
      setMessage(stockError.message);
      setSaving(false);
      return;
    }

    const { error: movementError } = await supabase.from("stock_movements").insert({
      part_id: selectedPart.id,
      job_id: params.id,
      movement_type: "job_consumable_usage",
      quantity: -qty,
      old_quantity: currentStock,
      new_quantity: newStock,
      notes: `Used on ${job ? formatJobNumber(job.job_number) : "job"}`,
    });

    if (movementError) {
      setMessage(movementError.message);
      setSaving(false);
      return;
    }

    setForm({
      part_id: "",
      quantity: "1",
      notes: "",
    });

    setSearch("");
    setMessage("Consumable usage recorded and stock updated.");
    await loadData();
    setSaving(false);
  }

  async function deleteUsage(item: JobConsumable) {
    const confirmed = window.confirm(
      "Remove this consumable usage and return stock back? Only do this if it was entered by mistake."
    );

    if (!confirmed) return;

    setMessage("");

    const partRes = await supabase
      .from("parts")
      .select("quantity_in_stock")
      .eq("id", item.part_id)
      .single();

    if (partRes.error) {
      setMessage(partRes.error.message);
      return;
    }

    const currentStock = Number(partRes.data?.quantity_in_stock || 0);
    const restoredStock = currentStock + Number(item.quantity || 0);

    const { error: deleteError } = await supabase
      .from("job_consumables")
      .delete()
      .eq("id", item.id);

    if (deleteError) {
      setMessage(deleteError.message);
      return;
    }

    const { error: stockError } = await supabase
      .from("parts")
      .update({
        quantity_in_stock: restoredStock,
      })
      .eq("id", item.part_id);

    if (stockError) {
      setMessage(stockError.message);
      return;
    }

    await supabase.from("stock_movements").insert({
      part_id: item.part_id,
      job_id: params.id,
      movement_type: "job_consumable_reversal",
      quantity: Number(item.quantity || 0),
      old_quantity: currentStock,
      new_quantity: restoredStock,
      notes: `Reversed consumable usage on ${job ? formatJobNumber(job.job_number) : "job"}`,
    });

    setMessage("Consumable usage removed and stock restored.");
    await loadData();
  }

  useEffect(() => {
    loadData();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          Loading job consumables...
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-semibold text-red-600">Job not found.</p>
          <Link href="/jobs" className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-2 text-white">
            Back to Jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-red-300">TW AUTO TUNE</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Job Consumables
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Internal workshop consumables used on {formatJobNumber(job.job_number)}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/jobs/${job.id}`}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Back to Job
            </Link>

            <Link
              href="/inventory"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Inventory
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Job</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {formatJobNumber(job.job_number)}
            </h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>Type: {job.job_type}</p>
              <p>Customer: {job.customers?.full_name || "-"}</p>
              <p>Phone: {job.customers?.phone || "-"}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Vehicle</p>
            <h2 className="mt-1 text-xl font-bold uppercase text-slate-900">
              {job.vehicles?.registration || "-"}
            </h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>
                {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") || "-"}
              </p>
              <p>Odometer: {job.odometer ? `${job.odometer.toLocaleString()} km` : "-"}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-sm text-red-300">Internal Consumable Cost</p>
            <p className="mt-2 text-3xl font-bold">{money(totalConsumableCost)}</p>
            <p className="mt-2 text-sm text-slate-300">
              This is internal job cost and does not appear on customer invoice.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={addUsage} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Add Usage</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Record Consumable
            </h2>

            <div className="mt-5 grid gap-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Search gloves, brake cleaner, wipes..."
              />

              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                {filteredParts.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">
                    No consumables found. Add consumables in Inventory first.
                  </p>
                ) : (
                  filteredParts.map((part) => {
                    const selected = form.part_id === part.id;
                    const stock = Number(part.quantity_in_stock || 0);

                    return (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => updateForm("part_id", part.id)}
                        className={`block w-full border-b border-slate-100 p-3 text-left hover:bg-red-50 ${
                          selected ? "bg-red-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{part.part_name}</p>
                            <p className="text-xs text-slate-500">
                              {part.part_number || "No SKU"} | {part.item_type || "consumable"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Cost {money(Number(part.average_cost || part.cost_price || 0))}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              stock > 0
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            Stock {stock}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedPart && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-bold text-slate-900">{selectedPart.part_name}</p>
                  <p>Current stock: {selectedPart.quantity_in_stock || 0}</p>
                  <p>
                    Unit cost:{" "}
                    {money(Number(selectedPart.average_cost || selectedPart.cost_price || 0))}
                  </p>
                </div>
              )}

              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.quantity}
                onChange={(e) => updateForm("quantity", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Quantity used"
              />

              {lowStockAfterUse && (
                <p className="rounded-xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-700">
                  Warning: this item will be at or below reorder level after use.
                </p>
              )}

              <textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                className="min-h-24 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Optional notes"
              />

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Record Usage"}
              </button>
            </div>
          </form>

          <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Usage Records</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Consumables Used
                </h2>
              </div>

              <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {usage.length} records
              </span>
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Unit Cost</th>
                    <th className="px-4 py-3">Total Cost</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {usage.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No consumables recorded for this job yet.
                      </td>
                    </tr>
                  ) : (
                    usage.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{formatDate(item.created_at)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.item_name}
                        </td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">{money(Number(item.unit_cost || 0))}</td>
                        <td className="px-4 py-3 font-semibold text-red-700">
                          {money(Number(item.total_cost || 0))}
                        </td>
                        <td className="px-4 py-3">{item.notes || "-"}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => deleteUsage(item)}
                            className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-bold text-slate-900">Important</p>
              <p className="mt-1">
                Consumables are internal costs. They reduce stock and help calculate the true
                cost of a job, but they are not added to the customer invoice automatically.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
