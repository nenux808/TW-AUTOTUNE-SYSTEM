"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  supplier_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  abn: string | null;
  notes: string | null;
  active: boolean;
};

export default function SuppliersPage() {
  const supabase = createClient();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplier_name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    abn: "",
    notes: "",
  });

  const [message, setMessage] = useState("");

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      supplier_name: "",
      contact_name: "",
      phone: "",
      email: "",
      address: "",
      abn: "",
      notes: "",
    });
  }

  function startEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setForm({
      supplier_name: supplier.supplier_name || "",
      contact_name: supplier.contact_name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      abn: supplier.abn || "",
      notes: supplier.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadSuppliers() {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("active", true)
      .order("supplier_name", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSuppliers((data || []) as Supplier[]);
  }

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!form.supplier_name.trim()) {
      setMessage("Supplier name is required.");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("suppliers")
        .update({
          supplier_name: form.supplier_name.trim(),
          contact_name: form.contact_name.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          abn: form.abn.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq("id", editingId);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Supplier updated.");
      resetForm();
      loadSuppliers();
      return;
    }

    const { error } = await supabase.from("suppliers").insert({
      supplier_name: form.supplier_name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      abn: form.abn.trim() || null,
      notes: form.notes.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Supplier added.");
    resetForm();
    loadSuppliers();
  }

  async function deactivateSupplier(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this supplier? Existing purchase records will stay saved."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("suppliers")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Supplier deactivated.");
    loadSuppliers();
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">Inventory</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Suppliers
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Add, edit and manage supplier details for bought invoices and stock purchasing.
            </p>
          </div>

          <Link
            href="/inventory"
            className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Inventory
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={saveSupplier} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">
              {editingId ? "Edit Supplier" : "New Supplier"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {editingId ? "Update supplier" : "Add supplier"}
            </h2>

            <div className="mt-5 grid gap-4">
              <input
                value={form.supplier_name}
                onChange={(e) => updateField("supplier_name", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Supplier name *"
              />

              <input
                value={form.contact_name}
                onChange={(e) => updateField("contact_name", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Contact name"
              />

              <input
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Phone"
              />

              <input
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Email"
              />

              <input
                value={form.abn}
                onChange={(e) => updateField("abn", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="ABN"
              />

              <textarea
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                className="min-h-20 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Address"
              />

              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="min-h-20 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Notes"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
                >
                  {editingId ? "Update Supplier" : "Add Supplier"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Supplier Records</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Suppliers</h2>
              </div>

              <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {suppliers.length} total
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">ABN</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        No suppliers yet.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {supplier.supplier_name}
                        </td>
                        <td className="px-4 py-3">{supplier.contact_name || "-"}</td>
                        <td className="px-4 py-3">{supplier.phone || "-"}</td>
                        <td className="px-4 py-3">{supplier.email || "-"}</td>
                        <td className="px-4 py-3">{supplier.abn || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(supplier)}
                              className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => deactivateSupplier(supplier.id)}
                              className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Deactivating a supplier hides it from new purchase invoices but keeps old invoice records safe.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
