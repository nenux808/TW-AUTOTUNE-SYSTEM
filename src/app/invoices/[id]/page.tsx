"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type WorkshopSettings = {
  business_name: string;
  business_tagline: string | null;
  abn: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_bsb: string | null;
  bank_account_number: string | null;
  invoice_footer_note: string | null;
};


type Invoice = {
  id: string;
  job_id: string | null;
  vehicle_id: string | null;
  invoice_number: number;
  status: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  discount_amount: number | null;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
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
  included_in_package: boolean;
  sort_order: number | null;
  visibility: string | null;
  billing_mode: string | null;
  cost_affects_profit: boolean | null;
  included_note: string | null;
  cost_price: number | null;
  supplier: string | null;
};

type InvoicePayment = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
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
  recommendation: string | null;
  cleared_after_service: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function itemDisplayAmount(item: any, fallbackAmount: number) {
  if (item.billing_mode === "included_in_package") return "Included";
  if (item.billing_mode === "internal_cost_only") return "Owner only";
  return money(fallbackAmount);
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
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
    case "partial":
    case "monitor":
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

export default function CustomerInvoicePage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [settings, setSettings] = useState<WorkshopSettings | null>(null);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const customerVisibleItems = items.filter((item: any) => item.visibility !== "owner_only");
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [latestInspection, setLatestInspection] = useState<JobInspection | null>(null);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [diagnosticCodes, setDiagnosticCodes] = useState<DiagnosticCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [message, setMessage] = useState("");

  const [paymentForm, setPaymentForm] = useState({
    payment_date: todayDate(),
    amount: "",
    payment_method: "bank_transfer",
    reference: "",
    notes: "",
  });

  const groupedItems = useMemo(() => {
    const groups: Record<string, InvoiceItem[]> = {
      package: [],
      service: [],
      labour: [],
      part: [],
      custom: [],
    };

    items.forEach((item) => {
      const key = item.item_type || "custom";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [items]);

  const inspectionGroups = useMemo(() => {
    const groups: Record<string, InspectionItem[]> = {};

    inspectionItems
      .filter((item) => item.show_on_invoice)
      .forEach((item) => {
        if (!groups[item.category_name]) groups[item.category_name] = [];
        groups[item.category_name].push(item);
      });

    return groups;
  }, [inspectionItems]);

  const attentionItems = useMemo(() => {
    return inspectionItems.filter((item) =>
      ["monitor", "attention_required", "urgent"].includes(item.status)
    );
  }, [inspectionItems]);

  const paidTotal = useMemo(() => {
    return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [payments]);

  const balanceDue = invoice
    ? Math.max(Number(invoice.total_amount || 0) - paidTotal, 0)
    : 0;

  function updatePaymentForm(field: string, value: string) {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  }

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
      .select("id, item_type, description, quantity, unit_price, tax_rate, included_in_package, sort_order, visibility, billing_mode, cost_affects_profit, included_note, cost_price, supplier")
      .eq("invoice_id", params.id)
      .order("sort_order", { ascending: true });

    const paymentRes = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", params.id)
      .order("payment_date", { ascending: false });

    const invoiceJobId = invoiceRes.data?.job_id || null;
    const invoiceVehicleId = invoiceRes.data?.vehicle_id || null;

    let latestInspectionRecord: JobInspection | null = null;
    let inspectionItemData: InspectionItem[] = [];
    let diagnosticData: DiagnosticCode[] = [];

    if (invoiceJobId) {
      const inspectionByJobRes = await supabase
        .from("job_inspections")
        .select("*")
        .eq("job_id", invoiceJobId)
        .order("created_at", { ascending: false })
        .limit(1);

      latestInspectionRecord = (inspectionByJobRes.data?.[0] || null) as JobInspection | null;

      const diagnosticRes = await supabase
        .from("diagnostic_codes")
        .select("*")
        .eq("job_id", invoiceJobId)
        .order("created_at", { ascending: false });

      diagnosticData = (diagnosticRes.data || []) as DiagnosticCode[];
    }

    if (!latestInspectionRecord && invoiceVehicleId) {
      const inspectionByVehicleRes = await supabase
        .from("job_inspections")
        .select("*")
        .eq("vehicle_id", invoiceVehicleId)
        .order("created_at", { ascending: false })
        .limit(1);

      latestInspectionRecord = (inspectionByVehicleRes.data?.[0] || null) as JobInspection | null;
    }

    if (latestInspectionRecord) {
      const inspectionItemRes = await supabase
        .from("job_inspection_items")
        .select("*")
        .eq("inspection_id", latestInspectionRecord.id)
        .order("category_name", { ascending: true });

      inspectionItemData = (inspectionItemRes.data || []) as InspectionItem[];
    }    const settingsRes = await supabase
      .from("workshop_settings")
      .select("business_name, business_tagline, abn, address_line_1, address_line_2, phone, email, bank_name, bank_account_name, bank_bsb, bank_account_number, invoice_footer_note")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const errors = [
      invoiceRes.error ? `Invoice: ${invoiceRes.error.message}` : "",
      itemRes.error ? `Items: ${itemRes.error.message}` : "",
      paymentRes.error ? `Payments: ${paymentRes.error.message}` : "",      settingsRes.error ? `Settings: ${settingsRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setInvoice((invoiceRes.data || null) as Invoice | null);
    setItems((itemRes.data || []) as InvoiceItem[]);
    setPayments((paymentRes.data || []) as InvoicePayment[]);
    setLatestInspection(latestInspectionRecord);
    setInspectionItems(inspectionItemData);
    setDiagnosticCodes(diagnosticData);
    setSettings((settingsRes.data || null) as WorkshopSettings | null);
    setLoading(false);
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();

    if (!invoice) return;

    setSavingPayment(true);
    setMessage("");

    const amount = Number(paymentForm.amount || 0);

    if (amount <= 0) {
      setMessage("Payment amount must be greater than 0.");
      setSavingPayment(false);
      return;
    }

    if (amount > balanceDue) {
      setMessage(`Payment cannot be more than remaining balance: ${money(balanceDue)}.`);
      setSavingPayment(false);
      return;
    }

    const { error: paymentError } = await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id,
      payment_date: paymentForm.payment_date,
      amount,
      payment_method: paymentForm.payment_method || null,
      reference: paymentForm.reference.trim() || null,
      notes: paymentForm.notes.trim() || null,
    });

    if (paymentError) {
      setMessage(paymentError.message);
      setSavingPayment(false);
      return;
    }

    const newPaidTotal = paidTotal + amount;
    const newBalance = Math.max(Number(invoice.total_amount || 0) - newPaidTotal, 0);

    let newStatus = "draft";
    if (newBalance <= 0) {
      newStatus = "paid";
    } else if (newPaidTotal > 0) {
      newStatus = "partial";
    } else {
      newStatus = invoice.status || "draft";
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        amount_paid: newPaidTotal,
        balance_due: newBalance,
        status: newStatus,
      })
      .eq("id", invoice.id);

    if (updateError) {
      setMessage(updateError.message);
      setSavingPayment(false);
      return;
    }

    setPaymentForm({
      payment_date: todayDate(),
      amount: "",
      payment_method: "bank_transfer",
      reference: "",
      notes: "",
    });

    setMessage("Customer payment recorded successfully.");
    await loadInvoice();
    setSavingPayment(false);
  }


  async function sendInvoiceEmail() {
    if (!invoice?.id) return;

    setMessage("Sending invoice email...");

    const response = await fetch("/api/email/send-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invoiceId: invoice.id }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Failed to send invoice email.");
      return;
    }

    setMessage("Invoice email sent successfully.");
  }
  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          Loading invoice...
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-semibold text-red-600">Invoice not found.</p>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
          <Link
            href="/invoices"
            className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-2 text-white"
          >
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
    <main className="customer-invoice-print-compact min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="print-card mb-6 flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-red-300">TW AUTO TUNE</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Tax Invoice {formatInvoiceNumber(invoice.invoice_number)}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Customer invoice and service summary.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={sendInvoiceEmail}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Email Invoice
            </button>

            <Link
              href="/invoices"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Back to Invoices
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-3 print-avoid-break">
          <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Invoice Details</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {formatInvoiceNumber(invoice.invoice_number)}
            </h2>

            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p><span className="font-semibold">Invoice Date:</span> {formatDate(invoice.invoice_date)}</p>
              <p><span className="font-semibold">Due Date:</span> {formatDate(invoice.due_date)}</p>
              <p>
                <span className="font-semibold">Status:</span>{" "}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(invoice.status)}`}>
                  {formatStatus(invoice.status)}
                </span>
              </p>
              <p><span className="font-semibold">Job:</span> {formatJobNumber(invoice.jobs?.job_number)}</p>
            </div>
          </div>

          <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Customer</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {invoice.customers?.full_name || "-"}
            </h2>

            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p><span className="font-semibold">Phone:</span> {invoice.customers?.phone || "-"}</p>
              <p><span className="font-semibold">Email:</span> {invoice.customers?.email || "-"}</p>
              <p><span className="font-semibold">Address:</span> {invoice.customers?.address || "-"}</p>
            </div>
          </div>

          <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Vehicle</p>
            <h2 className="mt-1 text-xl font-bold uppercase text-slate-900">
              {invoice.vehicles?.registration || "-"}
            </h2>

            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Vehicle:</span>{" "}
                {[invoice.vehicles?.make, invoice.vehicles?.model].filter(Boolean).join(" ") || "-"}
              </p>
              <p><span className="font-semibold">Year:</span> {invoice.vehicles?.year || "-"}</p>
              <p><span className="font-semibold">VIN:</span> {invoice.vehicles?.vin || "-"}</p>
              <p>
                <span className="font-semibold">Odometer:</span>{" "}
                {invoice.jobs?.odometer ? `${invoice.jobs.odometer.toLocaleString()} km` : "-"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] print-full-width">
          <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-red-600">Invoice Items</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Charges</h2>
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Qty / Hours</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {customerVisibleItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No invoice items found.
                      </td>
                    </tr>
                  ) : (
                    customerVisibleItems.map((item) => {
                      const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);

                      return (
                        <tr key={item.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 capitalize text-slate-700">
                            {formatStatus(item.item_type)}
                          </td>

                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {item.description}
                            {item.included_in_package && (
                              <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                Included
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-700">{item.quantity}</td>

                          <td className="px-4 py-3 text-slate-700">
                            {item.billing_mode === "included_in_package" ? "Included" : money(Number(item.unit_price || 0))}
                          </td>

                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {itemDisplayAmount(item, lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {(invoice.jobs?.customer_complaint ||
              invoice.jobs?.work_completed ||
              invoice.jobs?.recommendations) && (
              <div className="mt-6 grid gap-4">
                {invoice.jobs?.customer_complaint && (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Customer Request</p>
                    <p className="mt-1 whitespace-pre-wrap">{invoice.jobs.customer_complaint}</p>
                  </div>
                )}

                {invoice.jobs?.work_completed && (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Work Completed</p>
                    <p className="mt-1 whitespace-pre-wrap">{invoice.jobs.work_completed}</p>
                  </div>
                )}

                {invoice.jobs?.recommendations && (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Recommendations</p>
                    <p className="mt-1 whitespace-pre-wrap">{invoice.jobs.recommendations}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="grid gap-6 print-page-break-before">
            <div className="print-card rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-sm text-red-300">Payment Summary</p>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Subtotal</span>
                  <span className="font-semibold">{money(Number(invoice.subtotal || 0))}</span>
                </div>

                {Number(invoice.discount_amount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Discount</span>
                    <span className="font-semibold">-{money(Number(invoice.discount_amount || 0))}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-300">GST</span>
                  <span className="font-semibold">{money(Number(invoice.gst_amount || 0))}</span>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{money(Number(invoice.total_amount || 0))}</span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-300">Paid</span>
                  <span className="font-semibold text-green-300">{money(paidTotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-300">Balance Due</span>
                  <span className="font-semibold text-red-300">{money(balanceDue)}</span>
                </div>
              </div>
            </div>

            <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-red-600">Payment History</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Customer Payments</h2>

              <div className="mt-4 grid gap-3">
                {payments.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    No payments recorded yet.
                  </p>
                ) : (
                  payments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold text-slate-900">
                          {money(Number(payment.amount || 0))}
                        </span>
                        <span className="text-slate-500">
                          {formatDate(payment.payment_date)}
                        </span>
                      </div>
                      <p className="mt-1 capitalize text-slate-600">
                        {formatStatus(payment.payment_method)}
                      </p>
                      {payment.reference && (
                        <p className="text-slate-600">Ref: {payment.reference}</p>
                      )}
                      {payment.notes && (
                        <p className="text-slate-600">Note: {payment.notes}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {balanceDue > 0 && (
              <form onSubmit={addPayment} className="no-print payment-form-print-hide print-card rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-red-600">Record Payment</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Add Customer Payment</h2>

                <div className="mt-4 grid gap-3">
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => updatePaymentForm("payment_date", e.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  />

                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => updatePaymentForm("amount", e.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    placeholder={`Amount, max ${money(balanceDue)}`}
                  />

                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => updatePaymentForm("payment_method", e.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="eftpos">EFTPOS</option>
                    <option value="other">Other</option>
                  </select>

                  <input
                    value={paymentForm.reference}
                    onChange={(e) => updatePaymentForm("reference", e.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    placeholder="Reference / receipt number"
                  />

                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => updatePaymentForm("notes", e.target.value)}
                    className="min-h-20 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    placeholder="Payment notes"
                  />

                  <button
                    type="submit"
                    disabled={savingPayment}
                    className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {savingPayment ? "Saving..." : "Record Payment"}
                  </button>
                </div>
              </form>
            )}

            {balanceDue <= 0 && (
              <p className="print-card rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">
                This invoice is fully paid.
              </p>
            )}

            {nextServiceText && (
              <div className="print-card rounded-2xl border border-red-100 bg-red-50 p-6 shadow-sm">
                <p className="text-sm font-medium text-red-600">Next Service Reminder</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Next service due</h2>
                <p className="mt-3 text-sm font-semibold text-slate-700">{nextServiceText}</p>
              </div>
            )}

            {invoice.notes && (
              <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-red-600">Notes</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Customer Notes</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{invoice.notes}</p>
              </div>
            )}

            <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-red-600">Workshop Details</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">TW AUTO TUNE</h2>
              <div className="mt-4 grid gap-2 text-sm text-slate-700">
                <p>
                  {[settings?.address_line_1, settings?.address_line_2]
                    .filter(Boolean)
                    .join(", ") || "Unit 2/119 Box St, Dandenong South"}
                </p>

                <p>Phone: {settings?.phone || "0403 965 946"}</p>

                {settings?.email && <p>Email: {settings.email}</p>}

                {settings?.abn && <p>ABN: {settings.abn}</p>}

                <div className="mt-3 rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Direct Deposit Details</p>
                  <p>Bank: {settings?.bank_name || "TO BE ADDED"}</p>
                  <p>Account Name: {settings?.bank_account_name || "TW AUTO TUNE"}</p>
                  <p>BSB: {settings?.bank_bsb || "000-000"}</p>
                  <p>Account No: {settings?.bank_account_number || "000000000"}</p>
                  <p>Reference: {formatInvoiceNumber(invoice.invoice_number)}</p>
                </div>

                <p>{settings?.invoice_footer_note || "Thank you for choosing TW AUTO TUNE."}</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="print-card mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-600">Inspection Report</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Vehicle Inspection Summary
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
              No inspection checklist has been attached to this invoice.
            </p>
          ) : (
            <>
              {latestInspection.customer_visible_notes && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Customer-visible Summary</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {latestInspection.customer_visible_notes}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-bold text-slate-900">Attention Required / Monitor Items</h3>

                {attentionItems.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                    No attention required items were recorded.
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
                          <th className="px-4 py-3">Recommendation</th>
                        </tr>
                      </thead>

                      <tbody>
                        {attentionItems.map((item) => (
                          <tr key={item.id} className="border-t border-slate-200">
                            <td className="px-4 py-3">{item.category_name}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {item.item_name}
                            </td>
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
                            <td className="px-4 py-3">
                              {item.recommendation || item.mechanic_note || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-bold text-slate-900">Checked Categories</h3>

                {Object.entries(inspectionGroups).length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    No customer-visible checklist items were saved.
                  </p>
                ) : (
                  <div className="checked-category-grid mt-3 grid gap-4 md:grid-cols-2">
                    {Object.entries(inspectionGroups).map(([category, groupItems]) => {
                      const goodItems = groupItems.filter((item) => item.status === "good");
                      const monitorItems = groupItems.filter((item) => item.status === "monitor");
                      const attentionGroupItems = groupItems.filter((item) =>
                        ["attention_required", "urgent"].includes(item.status)
                      );
                      const repairedItems = groupItems.filter((item) => item.status === "repaired");

                      return (
                        <div key={category} className="checked-category-card rounded-2xl border border-slate-200">
                          <div className="rounded-t-2xl bg-slate-950 px-4 py-3 text-white">
                            <h4 className="font-bold">{category}</h4>
                          </div>

                          <div className="grid gap-3 p-4 text-sm">
                            {goodItems.length > 0 && (
                              <p><span className="font-semibold text-green-700">Good:</span>{" "}
                                {goodItems.map((item) => item.item_name).join(", ")}
                              </p>
                            )}

                            {monitorItems.length > 0 && (
                              <p><span className="font-semibold text-yellow-700">Monitor:</span>{" "}
                                {monitorItems.map((item) => item.item_name).join(", ")}
                              </p>
                            )}

                            {attentionGroupItems.length > 0 && (
                              <p><span className="font-semibold text-red-700">Attention:</span>{" "}
                                {attentionGroupItems.map((item) => item.item_name).join(", ")}
                              </p>
                            )}

                            {repairedItems.length > 0 && (
                              <p><span className="font-semibold text-blue-700">Repaired:</span>{" "}
                                {repairedItems.map((item) => item.item_name).join(", ")}
                              </p>
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

        <section className="print-card mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-red-600">Diagnostic Codes</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Scan Results</h2>
          </div>

          {diagnosticCodes.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              No diagnostic codes were recorded for this job.
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
                    <th className="px-4 py-3">Recommendation</th>
                  </tr>
                </thead>

                <tbody>
                  {diagnosticCodes.map((code) => (
                    <tr key={code.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-bold text-slate-900">{code.code}</td>
                      <td className="px-4 py-3">{code.system || "-"}</td>
                      <td className="px-4 py-3">{code.description || "-"}</td>
                      <td className="px-4 py-3 capitalize">{formatStatus(code.status)}</td>
                      <td className="px-4 py-3">{code.recommendation || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="privacy-note-print print-card mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            This customer invoice does not display internal owner details such as part cost,
            supplier cost, profit margin, or internal notes.
          </p>
        </section>
      </div>
    </main>
  );
}












