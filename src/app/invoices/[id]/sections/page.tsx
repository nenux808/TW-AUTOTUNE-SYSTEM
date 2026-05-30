"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  invoice_number: number;
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

type InvoiceSection = {
  id: string;
  invoice_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;
  section_id: string | null;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function formatInvoiceNumber(value?: number) {
  return "INV-" + String(value || 0).padStart(5, "0");
}

function defaultSectionForItem(item: InvoiceItem) {
  const text = `${item.item_type} ${item.description}`.toLowerCase();

  if (item.item_type === "part") return "PARTS";
  if (item.item_type === "labour") return "LABOUR";
  if (item.item_type === "package") return "SERVICE AS PER SCHEDULE";
  if (text.includes("brake")) return "BRAKES";
  if (text.includes("gearbox") || text.includes("transmission")) return "GEARBOX / TRANSMISSION";
  if (text.includes("waste") || text.includes("consumable")) return "DISPOSAL / WORKSHOP CONSUMABLES";

  return "OTHER CHARGES";
}

export default function InvoiceSectionsPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [sections, setSections] = useState<InvoiceSection[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newSection, setNewSection] = useState({
    title: "",
    description: "",
  });

  const unassignedItems = useMemo(() => {
    return items.filter((item) => !item.section_id);
  }, [items]);

  const sectionTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    sections.forEach((section) => {
      totals[section.id] = items
        .filter((item) => item.section_id === section.id)
        .reduce((sum, item) => {
          return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
        }, 0);
    });

    return totals;
  }, [sections, items]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const invoiceRes = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        customers(full_name, phone),
        vehicles(registration, make, model)
      `)
      .eq("id", params.id)
      .single();

    const sectionRes = await supabase
      .from("invoice_sections")
      .select("*")
      .eq("invoice_id", params.id)
      .order("sort_order", { ascending: true });

    const itemRes = await supabase
      .from("invoice_items")
      .select("id, invoice_id, section_id, item_type, description, quantity, unit_price, sort_order")
      .eq("invoice_id", params.id)
      .order("sort_order", { ascending: true });

    const errors = [
      invoiceRes.error ? `Invoice: ${invoiceRes.error.message}` : "",
      sectionRes.error ? `Sections: ${sectionRes.error.message}` : "",
      itemRes.error ? `Items: ${itemRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setInvoice((invoiceRes.data || null) as Invoice | null);
    setSections((sectionRes.data || []) as InvoiceSection[]);
    setItems((itemRes.data || []) as InvoiceItem[]);
    setLoading(false);
  }

  async function addSection(e: React.FormEvent) {
    e.preventDefault();

    if (!newSection.title.trim()) {
      setMessage("Section title is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("invoice_sections").insert({
      invoice_id: params.id,
      title: newSection.title.trim().toUpperCase(),
      description: newSection.description.trim() || null,
      sort_order: sections.length + 1,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setNewSection({ title: "", description: "" });
    await loadData();
    setSaving(false);
  }

  async function updateSection(
    sectionId: string,
    field: "title" | "description" | "sort_order",
    value: string
  ) {
    const payload =
      field === "sort_order"
        ? { sort_order: Number(value || 0) }
        : { [field]: value };

    const { error } = await supabase
      .from("invoice_sections")
      .update(payload)
      .eq("id", sectionId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadData();
  }

  async function assignItem(itemId: string, sectionId: string) {
    const { error } = await supabase
      .from("invoice_items")
      .update({
        section_id: sectionId || null,
      })
      .eq("id", itemId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadData();
  }

  async function deleteSection(sectionId: string) {
    const confirmed = window.confirm(
      "Delete this section? Items will stay on the invoice but become unassigned."
    );

    if (!confirmed) return;

    await supabase
      .from("invoice_items")
      .update({ section_id: null })
      .eq("section_id", sectionId);

    const { error } = await supabase
      .from("invoice_sections")
      .delete()
      .eq("id", sectionId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadData();
  }

  async function autoCreateSections() {
    setSaving(true);
    setMessage("");

    if (sections.length > 0) {
      const confirmed = window.confirm(
        "Sections already exist. Auto-create will only assign unassigned items. Continue?"
      );

      if (!confirmed) {
        setSaving(false);
        return;
      }
    }

    const currentSections = [...sections];

    for (const item of items) {
      if (item.section_id) continue;

      const sectionTitle = defaultSectionForItem(item);
      let section = currentSections.find((s) => s.title === sectionTitle);

      if (!section) {
        const { data, error } = await supabase
          .from("invoice_sections")
          .insert({
            invoice_id: params.id,
            title: sectionTitle,
            description:
              sectionTitle === "SERVICE AS PER SCHEDULE"
                ? "Service to vehicle including oil, filters, safety checks, fluid checks and road test as required."
                : null,
            sort_order: currentSections.length + 1,
          })
          .select("*")
          .single();

        if (error || !data) {
          setMessage(error?.message || "Could not create section.");
          setSaving(false);
          return;
        }

        section = data as InvoiceSection;
        currentSections.push(section);
      }

      const { error: assignError } = await supabase
        .from("invoice_items")
        .update({ section_id: section.id })
        .eq("id", item.id);

      if (assignError) {
        setMessage(assignError.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Sections auto-created and items assigned.");
    await loadData();
    setSaving(false);
  }

  useEffect(() => {
    loadData();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          Loading invoice sections...
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          Invoice not found.
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
              Invoice Sections {formatInvoiceNumber(invoice.invoice_number)}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Group invoice items into real workshop-style service, repair and parts sections.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/invoices/${invoice.id}/workshop-print`}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Workshop Print
            </Link>

            <Link
              href={`/invoices/${invoice.id}`}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Customer Invoice
            </Link>

            <Link
              href="/invoices"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Back
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
            <p className="text-sm font-medium text-red-600">Customer</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {invoice.customers?.full_name || "-"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {invoice.customers?.phone || "-"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Vehicle</p>
            <h2 className="mt-1 text-xl font-bold uppercase text-slate-900">
              {invoice.vehicles?.registration || "-"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {[invoice.vehicles?.make, invoice.vehicles?.model].filter(Boolean).join(" ") || "-"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Unassigned Items</p>
            <h2 className="mt-1 text-3xl font-bold text-slate-900">
              {unassignedItems.length}
            </h2>
            <button
              type="button"
              onClick={autoCreateSections}
              disabled={saving}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? "Working..." : "Auto Create Sections"}
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={addSection} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">New Section</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Add Work Section
            </h2>

            <div className="mt-5 grid gap-4">
              <input
                value={newSection.title}
                onChange={(e) =>
                  setNewSection((prev) => ({ ...prev, title: e.target.value }))
                }
                className="rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-red-500"
                placeholder="Example: BRAKES"
              />

              <textarea
                value={newSection.description}
                onChange={(e) =>
                  setNewSection((prev) => ({ ...prev, description: e.target.value }))
                }
                className="min-h-36 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Work description shown under this section..."
              />

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add Section"}
              </button>
            </div>
          </form>

          <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-red-600">Sections</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Assign Invoice Items
              </h2>
            </div>

            <div className="mt-6 grid gap-5">
              {sections.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                  No sections yet. Add a section or click Auto Create Sections.
                </div>
              ) : (
                sections.map((section) => {
                  const sectionItems = items.filter((item) => item.section_id === section.id);

                  return (
                    <div key={section.id} className="rounded-2xl border border-slate-200">
                      <div className="grid gap-3 border-b border-slate-200 bg-slate-950 p-4 text-white md:grid-cols-[80px_1fr_180px_auto] md:items-center">
                        <input
                          type="number"
                          value={section.sort_order}
                          onChange={(e) =>
                            updateSection(section.id, "sort_order", e.target.value)
                          }
                          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white"
                        />

                        <input
                          value={section.title}
                          onChange={(e) =>
                            updateSection(section.id, "title", e.target.value.toUpperCase())
                          }
                          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-bold uppercase text-white"
                        />

                        <div className="text-sm font-semibold">
                          {money(sectionTotals[section.id] || 0)}
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteSection(section.id)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="p-4">
                        <textarea
                          value={section.description || ""}
                          onChange={(e) =>
                            updateSection(section.id, "description", e.target.value)
                          }
                          className="min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500"
                          placeholder="Section work description..."
                        />

                        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-slate-100 text-slate-700">
                              <tr>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3">Qty</th>
                                <th className="px-4 py-3">Unit</th>
                                <th className="px-4 py-3">Total</th>
                                <th className="px-4 py-3">Move</th>
                              </tr>
                            </thead>

                            <tbody>
                              {sectionItems.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-4 py-5 text-center text-slate-500">
                                    No items assigned to this section.
                                  </td>
                                </tr>
                              ) : (
                                sectionItems.map((item) => (
                                  <tr key={item.id} className="border-t border-slate-200">
                                    <td className="px-4 py-3 capitalize">{item.item_type}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-900">
                                      {item.description}
                                    </td>
                                    <td className="px-4 py-3">{item.quantity}</td>
                                    <td className="px-4 py-3">{money(Number(item.unit_price || 0))}</td>
                                    <td className="px-4 py-3 font-semibold">
                                      {money(Number(item.quantity || 0) * Number(item.unit_price || 0))}
                                    </td>
                                    <td className="px-4 py-3">
                                      <select
                                        value={item.section_id || ""}
                                        onChange={(e) => assignItem(item.id, e.target.value)}
                                        className="rounded-lg border border-slate-300 px-3 py-2"
                                      >
                                        <option value="">Unassigned</option>
                                        {sections.map((s) => (
                                          <option key={s.id} value={s.id}>
                                            {s.title}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {unassignedItems.length > 0 && (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5">
                <p className="font-bold text-red-700">Unassigned Items</p>
                <div className="mt-4 grid gap-3">
                  {unassignedItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-xl bg-white p-3 text-sm md:grid-cols-[1fr_220px]"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.description}</p>
                        <p className="text-xs text-slate-500">
                          {item.item_type} | {item.quantity} x {money(Number(item.unit_price || 0))}
                        </p>
                      </div>

                      <select
                        value=""
                        onChange={(e) => assignItem(item.id, e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value="">Assign to...</option>
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
