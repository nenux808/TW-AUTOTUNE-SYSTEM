"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  job_id: string | null;
  vehicle_id: string | null;
  invoice_number: number;
  owner_copy_code: string | null;
  status: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  total_cost: number | null;
  total_profit: number | null;
  profit_margin: number | null;
  notes: string | null;
  internal_notes: string | null;
  customers: {
    full_name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  vehicles: {
    registration: string;
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string | null;
  } | null;
  jobs: {
    job_number: number;
    job_type: string;
    odometer: number | null;
    customer_complaint: string | null;
    work_completed: string | null;
    recommendations: string | null;
    next_service_odometer: number | null;
    next_service_due_date: string | null;
  } | null;
};

type InvoiceItem = {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  cost_price: number | null;
  profit_amount: number | null;
  profit_margin: number | null;
  supplier: string | null;
  visibility: string | null;
  billing_mode: string | null;
  cost_affects_profit: boolean | null;
  included_note: string | null;
  part_id: string | null;
  sort_order: number | null;
};

type JobInspection = {
  id: string;
  job_id: string;
  vehicle_id: string;
  overall_status: string | null;
  customer_visible_notes: string | null;
  internal_notes: string | null;
  completed_at: string | null;
  created_at: string;
};

type InspectionItem = {
  id: string;
  inspection_id: string;
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
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU");
}

function formatInvoiceNumber(value?: number) {
  return "INV-" + String(value || 0).padStart(5, "0");
}

function formatJobNumber(value?: number) {
  return "JOB-" + String(value || 0).padStart(5, "0");
}

function formatStatus(value?: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function badgeClass(status?: string | null) {
  switch (status) {
    case "paid":
    case "good":
    case "safe":
      return "bg-green-100 text-green-700";
    case "sent":
    case "repaired":
    case "completed":
      return "bg-blue-100 text-blue-700";
    case "monitor":
    case "partial":
      return "bg-yellow-100 text-yellow-700";
    case "attention_required":
      return "bg-orange-100 text-orange-700";
    case "urgent":
    case "unsafe":
    case "overdue":
    case "cancelled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function OwnerInvoicePage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [latestInspection, setLatestInspection] = useState<JobInspection | null>(null);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [diagnosticCodes, setDiagnosticCodes] = useState<DiagnosticCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const summary = useMemo(() => {
    const partsSales = items
      .filter((item) => item.item_type === "part")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const partsCost = items
      .filter((item) => item.item_type === "part")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.cost_price || 0), 0);

    const labourRevenue = items
      .filter((item) => item.item_type === "labour")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const packageRevenue = items
      .filter((item) => item.item_type === "package")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const serviceRevenue = items
      .filter((item) => item.item_type === "service")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const customRevenue = items
      .filter((item) => item.item_type === "custom")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const totalCost = Number(invoice?.total_cost || partsCost || 0);
    const totalProfit = Number(invoice?.total_profit || Number(invoice?.subtotal || 0) - totalCost || 0);
    const margin =
      Number(invoice?.subtotal || 0) > 0
        ? (totalProfit / Number(invoice?.subtotal || 0)) * 100
        : 0;

    return {
      partsSales,
      partsCost,
      partsProfit: partsSales - partsCost,
      labourRevenue,
      packageRevenue,
      serviceRevenue,
      customRevenue,
      totalCost,
      totalProfit,
      margin,
    };
  }, [items, invoice]);

  const attentionItems = useMemo(() => {
    return inspectionItems.filter((item) =>
      ["monitor", "attention_required", "urgent"].includes(item.status)
    );
  }, [inspectionItems]);

  const inspectionGroups = useMemo(() => {
    const groups: Record<string, InspectionItem[]> = {};

    inspectionItems.forEach((item) => {
      if (!groups[item.category_name]) {
        groups[item.category_name] = [];
      }

      groups[item.category_name].push(item);
    });

    return groups;
  }, [inspectionItems]);

  async function loadInvoice() {
    setLoading(true);
    setMessage("");

    const invoiceRes = await supabase
      .from("invoices")
      .select(`
        *,
        customers(full_name, phone, email, address),
        vehicles(registration, make, model, year, vin),
        jobs(job_number, job_type, odometer, customer_complaint, work_completed, recommendations, next_service_odometer, next_service_due_date)
      `)
      .eq("id", params.id)
      .single();

    const itemRes = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", params.id)
      .order("sort_order", { ascending: true });

    const invoiceJobId = invoiceRes.data?.job_id || null;
    const invoiceVehicleId = invoiceRes.data?.vehicle_id || null;

    let inspectionRecord: JobInspection | null = null;
    let inspectionItemData: InspectionItem[] = [];
    let diagnosticData: DiagnosticCode[] = [];

    if (invoiceJobId) {
      const inspectionByJobRes = await supabase
        .from("job_inspections")
        .select("*")
        .eq("job_id", invoiceJobId)
        .order("created_at", { ascending: false })
        .limit(1);

      inspectionRecord = (inspectionByJobRes.data?.[0] || null) as JobInspection | null;

      const diagnosticRes = await supabase
        .from("diagnostic_codes")
        .select("*")
        .eq("job_id", invoiceJobId)
        .order("created_at", { ascending: false });

      diagnosticData = (diagnosticRes.data || []) as DiagnosticCode[];
    }

    if (!inspectionRecord && invoiceVehicleId) {
      const inspectionByVehicleRes = await supabase
        .from("job_inspections")
        .select("*")
        .eq("vehicle_id", invoiceVehicleId)
        .order("created_at", { ascending: false })
        .limit(1);

      inspectionRecord = (inspectionByVehicleRes.data?.[0] || null) as JobInspection | null;
    }

    if (inspectionRecord) {
      const inspectionItemRes = await supabase
        .from("job_inspection_items")
        .select("*")
        .eq("inspection_id", inspectionRecord.id)
        .order("category_name", { ascending: true });

      inspectionItemData = (inspectionItemRes.data || []) as InspectionItem[];
    }

    const errors = [
      invoiceRes.error ? `Invoice: ${invoiceRes.error.message}` : "",
      itemRes.error ? `Items: ${itemRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setInvoice((invoiceRes.data || null) as Invoice | null);
    setItems((itemRes.data || []) as InvoiceItem[]);
    setLatestInspection(inspectionRecord);
    setInspectionItems(inspectionItemData);
    setDiagnosticCodes(diagnosticData);
    setLoading(false);
  }

  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  if (loading) {
    return (
      <main className="owner-copy-print-compact min-h-screen bg-slate-100 p-6">
        <div className="owner-print-container mx-auto max-w-7xl owner-print-card rounded-2xl bg-white p-6 shadow-sm">
          Loading owner copy...
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="owner-copy-print-compact min-h-screen bg-slate-100 p-6">
        <div className="owner-print-container mx-auto max-w-7xl owner-print-card rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-semibold text-red-600">Invoice not found.</p>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
          <Link href="/invoices" className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-2 text-white">
            Back to Invoices
          </Link>
        </div>
      </main>
    );
  }

  const nextServiceText =
    invoice.jobs?.next_service_odometer || invoice.jobs?.next_service_due_date
      ? `${invoice.jobs?.next_service_odometer ? invoice.jobs.next_service_odometer.toLocaleString() + " km" : "-"} or ${invoice.jobs?.next_service_due_date || "-"}, whichever comes first.`
      : "";

  return (
    <main className="owner-copy-print-compact min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="owner-print-container mx-auto w-full max-w-[1500px]">
        <div className="print-card mb-6 flex flex-col gap-4 owner-print-header rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-red-300">TW AUTO TUNE - OWNER INTERNAL COPY</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {formatInvoiceNumber(invoice.invoice_number)}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Internal copy with cost, profit, supplier, inspection and payment analysis.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Owner Ref: {invoice.owner_copy_code || "Not generated"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Print / Save Owner PDF
            </button>

            <Link
              href={`/invoices/${invoice.id}`}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Customer View
            </Link>

            <Link
              href="/invoices"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Back to Invoices
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 print-avoid-break">
          <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Invoice Total</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {money(Number(invoice.total_amount || 0))}
            </p>
          </div>

          <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Owner Cost</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {money(summary.totalCost)}
            </p>
          </div>

          <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Gross Profit</p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              {money(summary.totalProfit)}
            </p>
          </div>

          <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Margin</p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              {Number(invoice.profit_margin || summary.margin || 0).toFixed(2)}%
            </p>
          </div>

          <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Balance Due</p>
            <p className="mt-2 text-2xl font-bold text-red-700">
              {money(Number(invoice.balance_due || 0))}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3 print-avoid-break">
          <div className="print-card owner-print-card rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Customer</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {invoice.customers?.full_name || "-"}
            </h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>Phone: {invoice.customers?.phone || "-"}</p>
              <p>Email: {invoice.customers?.email || "-"}</p>
              <p>Address: {invoice.customers?.address || "-"}</p>
            </div>
          </div>

          <div className="print-card owner-print-card rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Vehicle</p>
            <h2 className="mt-1 text-xl font-bold uppercase text-slate-900">
              {invoice.vehicles?.registration || "-"}
            </h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>
                Vehicle: {[invoice.vehicles?.make, invoice.vehicles?.model]
                  .filter(Boolean)
                  .join(" ") || "-"}
              </p>
              <p>Year: {invoice.vehicles?.year || "-"}</p>
              <p>VIN: {invoice.vehicles?.vin || "-"}</p>
              <p>Odometer: {invoice.jobs?.odometer?.toLocaleString() || "-"} km</p>
            </div>
          </div>

          <div className="print-card owner-print-card rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Invoice / Job</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {formatInvoiceNumber(invoice.invoice_number)}
            </h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>Date: {formatDate(invoice.invoice_date)}</p>
              <p>Due: {formatDate(invoice.due_date)}</p>
              <p>
                Status:{" "}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(invoice.status)}`}>
                  {formatStatus(invoice.status)}
                </span>
              </p>
              <p>Job: {formatJobNumber(invoice.jobs?.job_number)}</p>
              <p>Job Type: {formatStatus(invoice.jobs?.job_type)}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] print-full-width">
          <div className="print-card min-w-0 owner-print-card rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-red-600">Internal Line Analysis</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Cost / Selling / Profit Breakdown
              </h2>
            </div>

                        <div className="mt-6 grid gap-3">
              {items.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No invoice items found.
                </div>
              ) : (
                items.map((item) => {
                  const qty = Number(item.quantity || 0);
                  const sellUnit = Number(item.unit_price || 0);
                  const sellTotal = qty * sellUnit;
                  const costUnit = Number(item.cost_price || 0);
                  const costTotal = qty * costUnit;
                  const profit = Number(item.profit_amount ?? sellTotal - costTotal);
                  const margin = sellTotal > 0 ? (profit / sellTotal) * 100 : 0;

                  return (
                    <div
                      key={item.id}
                      className="owner-line-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-base font-bold text-slate-900">
                            {item.description}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Type: {formatStatus(item.item_type)} | Billing: {formatStatus(item.billing_mode)} | Visibility: {formatStatus(item.visibility)} | Supplier: {item.supplier || "-"}
                          </p>
                        </div>

                        <span className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                          Profit {money(profit)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase text-slate-500">Qty</p>
                          <p className="mt-1 font-bold text-slate-900">{qty}</p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase text-slate-500">Sell Unit</p>
                          <p className="mt-1 font-bold text-slate-900">{item.billing_mode === "included_in_package" ? "Included" : money(sellUnit)}</p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase text-slate-500">Sell Total</p>
                          <p className="mt-1 font-bold text-slate-900">{item.billing_mode === "included_in_package" ? "Included" : money(sellTotal)}</p>
                        </div>

                        <div className="rounded-xl bg-red-50 p-3">
                          <p className="text-xs font-semibold uppercase text-red-500">Cost Unit</p>
                          <p className="mt-1 font-bold text-red-700">{money(costUnit)}</p>
                        </div>

                        <div className="rounded-xl bg-red-50 p-3">
                          <p className="text-xs font-semibold uppercase text-red-500">Cost Total</p>
                          <p className="mt-1 font-bold text-red-700">{money(costTotal)}</p>
                        </div>

                        <div className="rounded-xl bg-green-50 p-3">
                          <p className="text-xs font-semibold uppercase text-green-600">Margin</p>
                          <p className="mt-1 font-bold text-green-700">{margin.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <aside className="grid gap-6 print-page-break-before">
            <div className="print-card owner-print-header rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-sm text-red-300">Revenue Split</p>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Parts Sales</span>
                  <span className="font-semibold">{money(summary.partsSales)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-300">Parts Cost</span>
                  <span className="font-semibold">{money(summary.partsCost)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-300">Parts Profit</span>
                  <span className="font-semibold text-green-300">{money(summary.partsProfit)}</span>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Labour Revenue</span>
                    <span className="font-semibold">{money(summary.labourRevenue)}</span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-300">Package Revenue</span>
                  <span className="font-semibold">{money(summary.packageRevenue)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-300">Service Revenue</span>
                  <span className="font-semibold">{money(summary.serviceRevenue)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-300">Custom Revenue</span>
                  <span className="font-semibold">{money(summary.customRevenue)}</span>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Profit</span>
                    <span className="text-green-300">{money(summary.totalProfit)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="print-card owner-print-card rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-red-600">Payment Summary</p>

              <div className="mt-4 grid gap-3 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-semibold">{money(Number(invoice.total_amount || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST Collected</span>
                  <span className="font-semibold">{money(Number(invoice.gst_amount || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span className="font-semibold text-green-700">{money(Number(invoice.amount_paid || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Balance</span>
                  <span className="font-semibold text-red-700">{money(Number(invoice.balance_due || 0))}</span>
                </div>
              </div>
            </div>

            {nextServiceText && (
              <div className="print-card rounded-2xl border border-red-100 bg-red-50 p-6 shadow-sm">
                <p className="text-sm font-medium text-red-600">Next Service</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  {nextServiceText}
                </p>
              </div>
            )}
          </aside>
        </section>

        <section className="print-card mt-6 owner-print-card rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-600">Inspection Report</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Internal Inspection Summary
              </h2>
            </div>

            {latestInspection ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(latestInspection.overall_status)}`}>
                {formatStatus(latestInspection.overall_status)}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                No inspection recorded
              </span>
            )}
          </div>

          {!latestInspection ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              No inspection checklist has been attached to this invoice/job.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Customer-visible Summary</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {latestInspection.customer_visible_notes || "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Internal Inspection Notes</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {latestInspection.internal_notes || "-"}
                  </p>
                </div>
              </div>

              <div className="mt-6 owner-profit-table-wrap overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Measurement</th>
                      <th className="px-4 py-3">Quote?</th>
                      <th className="px-4 py-3">Repaired?</th>
                      <th className="px-4 py-3">Note / Recommendation</th>
                    </tr>
                  </thead>

                  <tbody>
                    {inspectionItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                          No inspection items found.
                        </td>
                      </tr>
                    ) : (
                      inspectionItems.map((item) => (
                        <tr key={item.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">{item.category_name}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{item.item_name}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(item.status)}`}>
                              {formatStatus(item.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {item.measurement_value
                              ? `${item.measurement_value} ${item.measurement_unit || ""}`
                              : "-"}
                          </td>
                          <td className="px-4 py-3">{item.quote_required ? "Yes" : "No"}</td>
                          <td className="px-4 py-3">{item.repaired_during_job ? "Yes" : "No"}</td>
                          <td className="px-4 py-3">
                            {item.recommendation || item.mechanic_note || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="print-card mt-6 owner-print-card rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-red-600">Diagnostic Codes</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Internal Scan Results</h2>
          </div>

          {diagnosticCodes.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              No diagnostic codes were recorded for this job.
            </p>
          ) : (
            <div className="mt-4 owner-profit-table-wrap overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">System</th>
                    <th className="owner-description-col px-4 py-3">Description</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Cleared?</th>
                    <th className="px-4 py-3">Note / Recommendation</th>
                  </tr>
                </thead>

                <tbody>
                  {diagnosticCodes.map((code) => (
                    <tr key={code.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-bold text-slate-900">{code.code}</td>
                      <td className="px-4 py-3">{code.system || "-"}</td>
                      <td className="px-4 py-3">{code.description || "-"}</td>
                      <td className="px-4 py-3 capitalize">{formatStatus(code.status)}</td>
                      <td className="px-4 py-3 capitalize">{formatStatus(code.severity)}</td>
                      <td className="px-4 py-3">{code.cleared_after_service ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">{code.recommendation || code.mechanic_note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2 print-avoid-break">
          <div className="print-card owner-print-card rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Job Notes</p>

            <div className="mt-4 grid gap-4 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Customer Request</p>
                <p className="mt-1 whitespace-pre-wrap">{invoice.jobs?.customer_complaint || "-"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Work Completed</p>
                <p className="mt-1 whitespace-pre-wrap">{invoice.jobs?.work_completed || "-"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Recommendations</p>
                <p className="mt-1 whitespace-pre-wrap">{invoice.jobs?.recommendations || "-"}</p>
              </div>
            </div>
          </div>

          <div className="print-card owner-print-card rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Owner Notes</p>

            <div className="mt-4 grid gap-4 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Customer Invoice Notes</p>
                <p className="mt-1 whitespace-pre-wrap">{invoice.notes || "-"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Internal Invoice Notes</p>
                <p className="mt-1 whitespace-pre-wrap">{invoice.internal_notes || "-"}</p>
              </div>

              <div className="rounded-xl bg-red-50 p-4">
                <p className="font-semibold text-red-700">Private Internal Copy</p>
                <p className="mt-1 text-slate-700">
                  This copy contains cost, profit, supplier and internal notes. Do not send this copy to the customer.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}







