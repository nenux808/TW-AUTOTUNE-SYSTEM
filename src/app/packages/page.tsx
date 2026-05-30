"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ServicePackage = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  base_price: number;
  price_note: string | null;
  active: boolean;
  created_at: string;
};

const emptyForm = {
  name: "",
  category: "Service",
  description: "",
  base_price: "",
  price_note: "",
  active: true,
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Number(value || 0));
}

export default function PackagesPage() {
  const supabase = createClient();

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const filteredPackages = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return packages;

    return packages.filter((item) =>
      [
        item.name,
        item.category,
        item.description,
        item.price_note,
        String(item.base_price),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [packages, search]);

  async function loadPackages() {
    setLoading(true);

    const { data, error } = await supabase
      .from("service_packages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setPackages((data || []) as ServicePackage[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPackages();
  }, []);

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function startEdit(item: ServicePackage) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      category: item.category || "Service",
      description: item.description || "",
      base_price: String(item.base_price ?? ""),
      price_note: item.price_note || "",
      active: item.active !== false,
    });
    setMessage("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  async function savePackage(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Package name is required.");
      setSaving(false);
      return;
    }

    if (!form.base_price.trim()) {
      setMessage("Base price is required.");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "Service",
      description: form.description.trim() || null,
      base_price: Number(form.base_price || 0),
      price_note: form.price_note.trim() || `From $${Number(form.base_price || 0).toFixed(2)} + GST`,
      active: form.active,
    };

    const result = editingId
      ? await supabase.from("service_packages").update(payload).eq("id", editingId)
      : await supabase.from("service_packages").insert(payload);

    if (result.error) {
      setMessage(result.error.message);
      setSaving(false);
      return;
    }

    setMessage(editingId ? "Package updated successfully." : "Package added successfully.");
    setForm(emptyForm);
    setEditingId(null);
    await loadPackages();
    setSaving(false);
  }

  async function toggleActive(item: ServicePackage) {
    setMessage("");

    const { error } = await supabase
      .from("service_packages")
      .update({ active: !item.active })
      .eq("id", item.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadPackages();
  }

  async function deletePackage(id: string) {
    setMessage("");

    const { error } = await supabase
      .from("service_packages")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage("Could not delete package. It may already be linked to invoices. Deactivate it instead.");
      return;
    }

    setConfirmingId(null);
    setMessage("Package deleted successfully.");
    await loadPackages();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-3xl font-bold text-slate-900">Packages</h1>
            <p className="mt-1 text-slate-600">
              Configure service packages, promotions and fixed-price workshop deals.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">
              {editingId ? "Edit Package" : "New Package"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {editingId ? "Update package" : "Add package"}
            </h2>

            <form onSubmit={savePackage} className="mt-6 grid gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Package name *</label>
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Student Car Service"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  >
                    <option value="Service">Service</option>
                    <option value="Promotion">Promotion</option>
                    <option value="Logbook">Logbook</option>
                    <option value="4X4">4X4</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Base price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.base_price}
                    onChange={(e) => updateField("base_price", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    placeholder="120"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Price note</label>
                <input
                  value={form.price_note}
                  onChange={(e) => updateField("price_note", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="From $120 + GST"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="mt-1 min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Service carried out including oil and filter replacement, fluid checks, tyre check..."
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => updateField("active", e.target.checked)}
                  className="h-4 w-4"
                />
                Active package
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingId ? "Update Package" : "Add Package"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Package Records</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">Service Packages</h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 sm:w-80"
                  placeholder="Search packages..."
                />

                <span className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                  {filteredPackages.length} shown
                </span>
              </div>
            </div>

            {loading ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                Loading packages...
              </p>
            ) : filteredPackages.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No packages found.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3">Package</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPackages.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="mt-1 max-w-xl text-xs text-slate-500">
                            {item.description || "-"}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {item.category || "-"}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">
                            {money(Number(item.base_price || 0))}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.price_note || "-"}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              item.active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleActive(item)}
                              className="rounded-lg bg-yellow-100 px-3 py-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-200"
                            >
                              {item.active ? "Deactivate" : "Activate"}
                            </button>

                            {confirmingId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => deletePackage(item.id)}
                                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingId(null)}
                                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmingId(item.id)}
                                className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
