"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type InvoiceLine = {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  included_in_package: boolean;
  visibility: string;
  billing_mode: string;
  cost_affects_profit: boolean;
  included_note: string | null;
  part_id: string | null;
  cost_price: number;
  supplier: string | null;
};

type InvoiceData = {
  id: string;
  invoice_number: number;
  job_id: string | null;
  customer_id: string;
  vehicle_id: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  internal_notes: string | null;
  customers: { full_name: string; phone: string | null; email: string | null } | null;
  vehicles: { registration: string; make: string | null; model: string | null } | null;
  jobs: { job_number: number; job_type: string } | null;
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

function formatJobNumber(value?: number) {
  return "JOB-" + String(value || 0).padStart(5, "0");
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function billingBadgeLabel(mode: string) {
  if (mode === "included_in_package") return "Included";
  if (mode === "internal_cost_only") return "Owner only";
  return "Billable";
}

function billingBadgeClass(mode: string) {
  if (mode === "included_in_package") return "bg-blue-100 text-blue-700";
  if (mode === "internal_cost_only") return "bg-purple-100 text-purple-700";
  return "bg-green-100 text-green-700";
}

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [gstRate, setGstRate] = useState(10);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const subtotal = useMemo(() => {
    return lines.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  }, [lines]);

  const gstForcedOn = paymentMethod === "eftpos" || paymentMethod === "bank_transfer";
  const finalGstEnabled = gstForcedOn || gstEnabled;

  const gstAmount = useMemo(() => {
    return finalGstEnabled ? subtotal * (gstRate / 100) : 0;
  }, [finalGstEnabled, subtotal, gstRate]);

  const total = useMemo(() => subtotal + gstAmount, [subtotal, gstAmount]);
  const balanceDue = useMemo(() => Math.max(total - Number(amountPaid || 0), 0), [total, amountPaid]);

  const totalCost = useMemo(() => {
    return lines.reduce((sum, item) => {
      if (item.item_type !== "part") return sum;
      return sum + Number(item.quantity || 0) * Number(item.cost_price || 0);
    }, 0);
  }, [lines]);

  const totalProfit = useMemo(() => subtotal - totalCost, [subtotal, totalCost]);
  const profitMargin = useMemo(() => (subtotal > 0 ? (totalProfit / subtotal) * 100 : 0), [subtotal, totalProfit]);

  async function loadInvoice() {
    setLoading(true);
    setMessage("");

    const invoiceRes = await supabase
      .from("invoices")
      .select(`
        *,
        customers(full_name, phone, email),
        vehicles(registration, make, model),
        jobs(job_number, job_type)
      `)
      .eq("id", params.id)
      .single();

    const itemsRes = await supabase
      .from("invoice_items")
      .select("id, item_type, description, quantity, unit_price, tax_rate, included_in_package, sort_order, part_id, cost_price, supplier, visibility, billing_mode, cost_affects_profit, included_note")
      .eq("invoice_id", params.id)
      .order("sort_order", { ascending: true });

    const settingsRes = await supabase
      .from("business_settings")
      .select("gst_rate")
      .limit(1)
      .maybeSingle();

    if (invoiceRes.error || !invoiceRes.data) {
      setMessage(invoiceRes.error?.message || "Invoice not found.");
      setLoading(false);
      return;
    }

    const loadedInvoice = invoiceRes.data as InvoiceData;
    const loadedItems = (itemsRes.data || []).map((item: any) => ({
      id: item.id || makeId(),
      item_type: item.item_type || "custom",
      description: item.description || "",
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      tax_rate: Number(item.tax_rate || 0),
      included_in_package: Boolean(item.included_in_package),
      visibility: item.visibility || "customer",
      billing_mode: item.billing_mode || (item.included_in_package ? "included_in_package" : "billable"),
      cost_affects_profit: item.cost_affects_profit !== false,
      included_note: item.included_note || null,
      part_id: item.part_id || null,
      cost_price: Number(item.cost_price || 0),
      supplier: item.supplier || null,
    })) as InvoiceLine[];

    setInvoice(loadedInvoice);
    setLines(loadedItems);
    setInvoiceDate(loadedInvoice.invoice_date || new Date().toISOString().split("T")[0]);
    setDueDate(loadedInvoice.due_date || new Date().toISOString().split("T")[0]);
    setNotes(loadedInvoice.notes || "");
    setInternalNotes(loadedInvoice.internal_notes || "");
    setStatus(loadedInvoice.status || "draft");
    setAmountPaid(Number(loadedInvoice.amount_paid || 0));

    const existingGstRate = loadedItems.find((item) => Number(item.tax_rate || 0) > 0)?.tax_rate;
    const savedGstRate = Number(settingsRes.data?.gst_rate || existingGstRate || 10);
    setGstRate(savedGstRate);

    if (Number(loadedInvoice.gst_amount || 0) <= 0) {
      setPaymentMethod("cash");
      setGstEnabled(false);
    } else {
      setPaymentMethod("bank_transfer");
      setGstEnabled(true);
    }

    if (itemsRes.error) {
      setMessage(`Items: ${itemsRes.error.message}`);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  function handlePaymentMethodChange(value: string) {
    setPaymentMethod(value);
    if (value === "eftpos" || value === "bank_transfer") {
      setGstEnabled(true);
      return;
    }
    if (value === "cash") setGstEnabled(false);
  }

  function updateLine(id: string, field: keyof InvoiceLine, value: string | number | boolean) {
    setLines((prev) =>
      prev.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]:
                field === "quantity" || field === "unit_price" || field === "tax_rate" || field === "cost_price"
                  ? Number(value)
                  : value,
            }
          : line
      )
    );
  }

  function applyBillingModeToLine(line: InvoiceLine, mode: string): InvoiceLine {
    if (mode === "included_in_package") {
      return {
        ...line,
        billing_mode: "included_in_package",
        visibility: "customer",
        unit_price: 0,
        included_in_package: true,
        included_note: "Included in selected service package",
      };
    }

    if (mode === "internal_cost_only") {
      return {
        ...line,
        billing_mode: "internal_cost_only",
        visibility: "owner_only",
        unit_price: 0,
        included_in_package: false,
        included_note: "Internal workshop cost only",
      };
    }

    return {
      ...line,
      billing_mode: "billable",
      visibility: "customer",
      included_in_package: false,
      included_note: null,
    };
  }

  function addLine(type = "custom") {
    setLines((prev) => [
      ...prev,
      {
        id: makeId(),
        item_type: type,
        description: type === "labour" ? "Labour charge" : type === "part" ? "Manual part / item" : "Custom charge",
        quantity: 1,
        unit_price: 0,
        tax_rate: finalGstEnabled ? gstRate : 0,
        included_in_package: false,
        visibility: "customer",
        billing_mode: "billable",
        cost_affects_profit: true,
        included_note: null,
        part_id: null,
        cost_price: 0,
        supplier: null,
      },
    ]);
  }

  async function saveInvoice() {
    if (!invoice) return;
    setSaving(true);
    setMessage("");

    if (lines.length === 0) {
      setMessage("Add at least one invoice line item.");
      setSaving(false);
      return;
    }

    const nextStatus = balanceDue <= 0 && Number(amountPaid || 0) > 0 ? "paid" : status;
    const paymentNote = `Last edited payment method: ${paymentMethod.replaceAll("_", " ")}.`;
    const gstNote = `GST ${finalGstEnabled ? "included" : "not charged"} on latest edit.`;
    const cleanedInternalNotes = [
      internalNotes.replace(/Last edited payment method:.*\n?/gi, "").replace(/GST .* on latest edit\.\n?/gi, "").trim(),
      paymentNote,
      gstNote,
    ]
      .filter(Boolean)
      .join("\n");

    const invoiceUpdate = await supabase
      .from("invoices")
      .update({
        status: nextStatus,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        subtotal,
        gst_amount: gstAmount,
        total_amount: total,
        amount_paid: Number(amountPaid || 0),
        balance_due: balanceDue,
        notes: notes.trim() || null,
        internal_notes: cleanedInternalNotes || null,
        total_cost: totalCost,
        total_profit: totalProfit,
        profit_margin: profitMargin,
      })
      .eq("id", invoice.id);

    if (invoiceUpdate.error) {
      setMessage(invoiceUpdate.error.message);
      setSaving(false);
      return;
    }

    const deleteRes = await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
    if (deleteRes.error) {
      setMessage(deleteRes.error.message);
      setSaving(false);
      return;
    }

    const payload = lines.map((line, index) => {
      const lineSellingTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
      const lineCostTotal = line.item_type === "part" ? Number(line.quantity || 0) * Number(line.cost_price || 0) : 0;
      const lineProfit = lineSellingTotal - lineCostTotal;
      const lineMargin = lineSellingTotal > 0 ? (lineProfit / lineSellingTotal) * 100 : 0;

      return {
        invoice_id: invoice.id,
        item_type: line.item_type,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: finalGstEnabled ? gstRate : 0,
        included_in_package: line.included_in_package,
        sort_order: index + 1,
        part_id: line.part_id,
        cost_price: line.cost_price,
        profit_amount: lineProfit,
        profit_margin: lineMargin,
        supplier: line.supplier,
        owner_visible: true,
        visibility: line.visibility || "customer",
        billing_mode: line.billing_mode || (line.included_in_package ? "included_in_package" : "billable"),
        cost_affects_profit: line.cost_affects_profit !== false,
        included_note:
          line.included_note ||
          (line.billing_mode === "included_in_package"
            ? "Included in selected service package"
            : line.billing_mode === "internal_cost_only"
              ? "Internal workshop cost only"
              : null),
      };
    });

    const itemRes = await supabase.from("invoice_items").insert(payload);
    if (itemRes.error) {
      setMessage(itemRes.error.message);
      setSaving(false);
      return;
    }

    setMessage("Invoice updated successfully.");
    setSaving(false);
    router.push(`/invoices/${invoice.id}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">Loading invoice editor...</div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-semibold text-red-600">Invoice not found.</p>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
          <Link href="/invoices" className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-2 text-white">Back to invoices</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Edit Invoice {formatInvoiceNumber(invoice.invoice_number)}</h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              {invoice.jobs?.job_number ? formatJobNumber(invoice.jobs.job_number) : "No job"} - {invoice.customers?.full_name || "Customer"} - {invoice.vehicles?.registration || "Vehicle"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/invoices/${invoice.id}`} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">View Invoice</Link>
            <Link href="/invoices" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Invoices</Link>
          </div>
        </div>

        {message && <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div>}

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-red-600">Line Items</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Edit charges</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => addLine("labour")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">Add Labour</button>
                <button type="button" onClick={() => addLine("part")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">Add Part</button>
                <button type="button" onClick={() => addLine("custom")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">Add Custom</button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Qty / Hours</th>
                    <th className="px-4 py-3">Selling</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Profit</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {lines.map((line) => {
                    const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
                    const lineCost = line.item_type === "part" ? Number(line.quantity || 0) * Number(line.cost_price || 0) : 0;
                    const lineProfit = lineTotal - lineCost;

                    return (
                      <tr key={line.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">
                          <select value={line.item_type} onChange={(e) => updateLine(line.id, "item_type", e.target.value)} className="w-32 rounded-lg border border-slate-300 px-3 py-2">
                            <option value="package">Package</option>
                            <option value="service">Service</option>
                            <option value="labour">Labour</option>
                            <option value="part">Part</option>
                            <option value="custom">Custom</option>
                          </select>

                          <div className="mt-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${billingBadgeClass(line.billing_mode || "billable")}`}>
                              {billingBadgeLabel(line.billing_mode || "billable")}
                            </span>
                          </div>

                          <select
                            value={line.billing_mode || "billable"}
                            onChange={(e) => setLines((prev) => prev.map((current) => current.id === line.id ? applyBillingModeToLine(current, e.target.value) : current))}
                            className="mt-2 w-52 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                          >
                            <option value="billable">Billable extra</option>
                            <option value="included_in_package">Included in package</option>
                            <option value="internal_cost_only">Owner-only internal cost</option>
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                          <input value={line.included_note || ""} onChange={(e) => updateLine(line.id, "included_note", e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" placeholder="Included note / owner note" />
                        </td>

                        <td className="px-4 py-3">
                          <input type="number" step="0.1" value={line.quantity} onChange={(e) => updateLine(line.id, "quantity", e.target.value)} className="w-24 rounded-lg border border-slate-300 px-3 py-2" />
                        </td>

                        <td className="px-4 py-3">
                          <input type="number" step="0.01" value={line.unit_price} onChange={(e) => updateLine(line.id, "unit_price", e.target.value)} disabled={line.billing_mode === "included_in_package" || line.billing_mode === "internal_cost_only"} className="w-28 rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" />
                        </td>

                        <td className="px-4 py-3">
                          <input type="number" step="0.01" value={line.cost_price} onChange={(e) => updateLine(line.id, "cost_price", e.target.value)} disabled={line.item_type !== "part"} className="w-28 rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-green-700">{money(lineProfit)}</td>

                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setLines((prev) => prev.filter((item) => item.id !== line.id))} className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200">Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Customer-visible notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Internal notes</label>
                <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500" />
              </div>
            </div>
          </div>

          <aside className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-sm text-red-300">Invoice Summary</p>

            <div className="mt-5 grid gap-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label className="text-slate-300">Invoice date</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="text-slate-300">Due date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white" />
                </div>
              </div>

              <div>
                <label className="text-slate-300">Invoice status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white">
                  <option className="text-slate-900" value="draft">Draft</option>
                  <option className="text-slate-900" value="sent">Sent</option>
                  <option className="text-slate-900" value="paid">Paid</option>
                  <option className="text-slate-900" value="overdue">Overdue</option>
                  <option className="text-slate-900" value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300">Payment method</label>
                <select value={paymentMethod} onChange={(e) => handlePaymentMethodChange(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white">
                  <option className="text-slate-900" value="bank_transfer">Bank Transfer - GST automatic</option>
                  <option className="text-slate-900" value="eftpos">EFTPOS - GST automatic</option>
                  <option className="text-slate-900" value="cash">Cash - GST optional</option>
                </select>
              </div>

              {paymentMethod === "cash" ? (
                <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">GST for cash invoice</p>
                      <p className="text-xs text-slate-300">Cash invoices can be saved with GST on or off.</p>
                    </div>
                    <button type="button" onClick={() => setGstEnabled((prev) => !prev)} className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${gstEnabled ? "bg-green-600" : "bg-slate-600"}`}>
                      {gstEnabled ? "GST ON" : "GST OFF"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-200">GST is automatically ON for EFTPOS and bank transfer payments.</div>
              )}

              <div className="flex justify-between"><span className="text-slate-300">Subtotal</span><span className="font-semibold">{money(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">GST {finalGstEnabled ? `${gstRate}%` : "not charged"}</span><span className="font-semibold">{money(gstAmount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">Owner Cost</span><span className="font-semibold">{money(totalCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">Profit</span><span className="font-semibold text-green-300">{money(totalProfit)}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">Margin</span><span className="font-semibold text-green-300">{profitMargin.toFixed(2)}%</span></div>

              <div className="border-t border-white/10 pt-4 text-lg font-bold"><div className="flex justify-between"><span>Total</span><span>{money(total)}</span></div></div>

              <div>
                <label className="text-slate-300">Amount paid</label>
                <input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value || 0))} className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white" />
              </div>

              <div className="flex justify-between text-red-300"><span>Balance due</span><span className="font-semibold">{money(balanceDue)}</span></div>

              <button type="button" onClick={saveInvoice} disabled={saving} className="mt-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {saving ? "Saving..." : "Update Invoice"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
