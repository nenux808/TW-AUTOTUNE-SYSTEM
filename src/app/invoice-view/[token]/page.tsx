import { headers } from "next/headers";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import PublicPrintButton from "@/components/invoices/PublicPrintButton";
import {
  checkRateLimit,
  getClientIpFromHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU");
}

function formatInvoiceNumber(value: any) {
  if (!value) return "INV";
  const text = String(value);
  if (text.toUpperCase().startsWith("INV-")) return text;
  return `INV-${text.padStart(5, "0")}`;
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

function UnavailableInvoice({ title = "Invoice not available", message = "This invoice link is invalid, expired, or no longer available. Please contact TW AUTO TUNE." }) {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-red-600">TW AUTO TUNE</p>
        <h1 className="mt-3 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      </div>
    </main>
  );
}

export default async function PublicInvoicePage({ params }: PageProps) {
  const { token } = await params;
  const requestHeaders = await headers();
  const clientIp = getClientIpFromHeaders(requestHeaders);

  const ipLimit = await checkRateLimit({
    namespace: "public-invoice:ip",
    key: clientIp,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!ipLimit.allowed) {
    return (
      <UnavailableInvoice
        title="Too many requests"
        message="This invoice link has been opened too many times recently. Please wait a moment and try again."
      />
    );
  }

  const tokenLimit = await checkRateLimit({
    namespace: "public-invoice:token",
    key: token,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });

  if (!tokenLimit.allowed) {
    return (
      <UnavailableInvoice
        title="Temporarily unavailable"
        message="This invoice link has reached its temporary view limit. Please contact TW AUTO TUNE if you need a new link."
      />
    );
  }

  const supabase = createServiceRoleSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      invoice_date,
      due_date,
      status,
      subtotal,
      discount_amount,
      gst_amount,
      total_amount,
      amount_paid,
      balance_due,
      notes,
      job_id,
      vehicle_id,
      public_enabled,
      public_token,
      public_expires_at,
      customers(full_name, email, phone, address),
      vehicles(registration, make, model, year, vin),
      jobs(
        job_number,
        odometer,
        customer_complaint,
        work_completed,
        recommendations,
        next_service_odometer,
        next_service_due_date
      ),
      invoice_items(
        id,
        item_type,
        description,
        quantity,
        unit_price,
        sort_order,
        visibility,
        billing_mode,
        included_in_package,
        included_note
      )
    `)
    .eq("public_token", token)
    .eq("public_enabled", true)
    .maybeSingle();

  if (error || !invoice) {
    return <UnavailableInvoice />;
  }

  if (invoice.public_expires_at && new Date(invoice.public_expires_at) < new Date()) {
    return (
      <UnavailableInvoice
        title="Invoice link expired"
        message="This secure invoice link has expired. Please contact TW AUTO TUNE for a new copy."
      />
    );
  }

  await supabase
    .from("invoices")
    .update({ public_last_viewed_at: new Date().toISOString() })
    .eq("id", invoice.id);

  const invoiceJobId = invoice.job_id || null;
  const invoiceVehicleId = invoice.vehicle_id || null;

  const paymentRes = await supabase
    .from("invoice_payments")
    .select("id, amount, payment_date, payment_method, reference")
    .eq("invoice_id", invoice.id)
    .order("payment_date", { ascending: false });

  const payments = paymentRes.data || [];

  const settingsRes = await supabase
    .from("workshop_settings")
    .select(
      "business_name, business_tagline, abn, address_line_1, address_line_2, phone, email, bank_name, bank_account_name, bank_bsb, bank_account_number, invoice_footer_note"
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const settings = settingsRes.data || null;

  let latestInspection: any = null;

  if (invoiceJobId) {
    const inspectionByJobRes = await supabase
      .from("job_inspections")
      .select("id, overall_status, customer_visible_notes")
      .eq("job_id", invoiceJobId)
      .order("created_at", { ascending: false })
      .limit(1);

    latestInspection = inspectionByJobRes.data?.[0] || null;
  }

  if (!latestInspection && invoiceVehicleId) {
    const inspectionByVehicleRes = await supabase
      .from("job_inspections")
      .select("id, overall_status, customer_visible_notes")
      .eq("vehicle_id", invoiceVehicleId)
      .order("created_at", { ascending: false })
      .limit(1);

    latestInspection = inspectionByVehicleRes.data?.[0] || null;
  }

  const inspectionItemRes = latestInspection
    ? await supabase
        .from("job_inspection_items")
        .select("id, category_name, item_name, status, measurement_value, measurement_unit, mechanic_note, recommendation, show_on_invoice")
        .eq("inspection_id", latestInspection.id)
        .eq("show_on_invoice", true)
        .order("category_name", { ascending: true })
    : { data: [] as any[] };

  const inspectionItems = inspectionItemRes.data || [];

  const diagnosticRes = invoiceJobId
    ? await supabase
        .from("diagnostic_codes")
        .select("id, code, system, description, status, recommendation")
        .eq("job_id", invoiceJobId)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const diagnosticCodes = diagnosticRes.data || [];

  const invoiceItems = (invoice.invoice_items || [])
    .filter((item: any) => item.visibility !== "owner_only")
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  const paidTotal =
    payments.length > 0
      ? payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)
      : Number(invoice.amount_paid || 0);

  const balanceDue = Math.max(Number(invoice.total_amount || 0) - paidTotal, 0);

  const nextServiceText =
    invoice.jobs?.next_service_odometer || invoice.jobs?.next_service_due_date
      ? `${
          invoice.jobs?.next_service_odometer
            ? invoice.jobs.next_service_odometer.toLocaleString() + " km"
            : "-"
        } or ${invoice.jobs?.next_service_due_date || "-"}, whichever comes first.`
      : "";

  const attentionItems = inspectionItems.filter((item: any) =>
    ["monitor", "attention_required", "urgent"].includes(item.status)
  );

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-bold text-red-500">TW AUTO TUNE</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Tax Invoice {formatInvoiceNumber(invoice.invoice_number)}
              </h1>
              <p className="mt-1 text-slate-200">Customer invoice and service summary.</p>
            </div>
            <PublicPrintButton />
          </div>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Invoice Details</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {formatInvoiceNumber(invoice.invoice_number)}
            </h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Invoice Date: {formatDate(invoice.invoice_date)}</p>
              <p>Due Date: {formatDate(invoice.due_date)}</p>
              <p>Status: {formatStatus(invoice.status)}</p>
              <p>Job: {invoice.jobs?.job_number ? `JOB-${String(invoice.jobs.job_number).padStart(5, "0")}` : "-"}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Customer</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{invoice.customers?.full_name || "-"}</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Phone: {invoice.customers?.phone || "-"}</p>
              <p>Email: {invoice.customers?.email || "-"}</p>
              <p>Address: {invoice.customers?.address || "-"}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Vehicle</p>
            <h2 className="mt-2 text-xl font-bold uppercase text-slate-900">
              {invoice.vehicles?.registration || "-"}
            </h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Vehicle: {[invoice.vehicles?.make, invoice.vehicles?.model].filter(Boolean).join(" ") || "-"}</p>
              <p>Year: {invoice.vehicles?.year || "-"}</p>
              <p>VIN: {invoice.vehicles?.vin || "-"}</p>
              <p>Odometer: {invoice.jobs?.odometer ? `${invoice.jobs.odometer.toLocaleString()} km` : "-"}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Invoice Items</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Charges</h2>
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
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
                  {invoiceItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No invoice items found.</td></tr>
                  ) : (
                    invoiceItems.map((item: any) => {
                      const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                      const included = item.billing_mode === "included_in_package" || item.included_in_package;
                      return (
                        <tr key={item.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 capitalize text-slate-700">{formatStatus(item.item_type)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {item.description || "-"}
                            {item.included_note && <p className="mt-1 text-xs font-normal text-slate-500">{item.included_note}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-slate-700">{included ? "Included" : money(Number(item.unit_price || 0))}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{included ? "Included" : money(lineTotal)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {(invoice.jobs?.customer_complaint || invoice.jobs?.work_completed || invoice.jobs?.recommendations) && (
              <div className="mt-6 grid gap-4">
                {invoice.jobs?.customer_complaint && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">Customer Request</p><p className="mt-1 whitespace-pre-wrap">{invoice.jobs.customer_complaint}</p></div>}
                {invoice.jobs?.work_completed && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">Work Completed</p><p className="mt-1 whitespace-pre-wrap">{invoice.jobs.work_completed}</p></div>}
                {invoice.jobs?.recommendations && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">Recommendations</p><p className="mt-1 whitespace-pre-wrap">{invoice.jobs.recommendations}</p></div>}
              </div>
            )}
          </div>

          <aside className="grid gap-6">
            <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-sm font-medium text-red-400">Payment Summary</p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><strong>{money(Number(invoice.subtotal || 0))}</strong></div>
                {Number(invoice.discount_amount || 0) > 0 && <div className="flex justify-between"><span>Discount</span><strong>-{money(Number(invoice.discount_amount || 0))}</strong></div>}
                <div className="flex justify-between"><span>GST</span><strong>{money(Number(invoice.gst_amount || 0))}</strong></div>
                <div className="border-t border-white/10 pt-4 text-lg"><div className="flex justify-between"><span>Total</span><strong>{money(Number(invoice.total_amount || 0))}</strong></div></div>
                <div className="flex justify-between text-green-300"><span>Paid</span><strong>{money(paidTotal)}</strong></div>
                <div className="flex justify-between text-red-300"><span>Balance Due</span><strong>{money(balanceDue)}</strong></div>
              </div>
            </div>

            {balanceDue <= 0 && <p className="rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">This invoice is fully paid.</p>}
            {nextServiceText && <div className="rounded-2xl border border-red-100 bg-red-50 p-6 shadow-sm"><p className="text-sm font-medium text-red-600">Next Service Reminder</p><h2 className="mt-1 text-xl font-bold text-slate-900">Next service due</h2><p className="mt-3 text-sm font-semibold text-slate-700">{nextServiceText}</p></div>}

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-red-600">Workshop Details</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">TW AUTO TUNE</h2>
              <div className="mt-4 grid gap-2 text-sm text-slate-700">
                <p>{[settings?.address_line_1, settings?.address_line_2].filter(Boolean).join(", ") || "Unit 2/119 Box St, Dandenong South"}</p>
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

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-600">Inspection Report</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Vehicle Inspection Summary</h2>
            </div>
            {latestInspection ? <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(latestInspection.overall_status)}`}>{formatStatus(latestInspection.overall_status)}</span> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">No inspection recorded</span>}
          </div>

          {!latestInspection ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No inspection checklist has been attached to this invoice.</p>
          ) : (
            <>
              {latestInspection.customer_visible_notes && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">Customer-visible Summary</p><p className="mt-1 whitespace-pre-wrap">{latestInspection.customer_visible_notes}</p></div>}
              <div className="mt-6">
                <h3 className="font-bold text-slate-900">Attention Required / Monitor Items</h3>
                {attentionItems.length === 0 ? <p className="mt-3 rounded-xl bg-green-50 p-4 text-sm text-green-700">No attention required items were recorded.</p> : (
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Measurement</th><th className="px-4 py-3">Recommendation</th></tr></thead>
                      <tbody>{attentionItems.map((item: any) => <tr key={item.id} className="border-t border-slate-200"><td className="px-4 py-3">{item.category_name}</td><td className="px-4 py-3 font-semibold text-slate-900">{item.item_name}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(item.status)}`}>{formatStatus(item.status)}</span></td><td className="px-4 py-3">{item.measurement_value ? `${item.measurement_value} ${item.measurement_unit || ""}` : "-"}</td><td className="px-4 py-3">{item.recommendation || item.mechanic_note || "-"}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-600">Diagnostic Codes</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Scan Results</h2>
          {diagnosticCodes.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No diagnostic codes were recorded for this job.</p> : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">System</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Recommendation</th></tr></thead>
                <tbody>{diagnosticCodes.map((code: any) => <tr key={code.id} className="border-t border-slate-200"><td className="px-4 py-3 font-bold text-slate-900">{code.code}</td><td className="px-4 py-3">{code.system || "-"}</td><td className="px-4 py-3">{code.description || "-"}</td><td className="px-4 py-3 capitalize">{formatStatus(code.status)}</td><td className="px-4 py-3">{code.recommendation || "-"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">This customer invoice does not display internal owner details such as part cost, supplier cost, profit margin, or internal notes.</p>
        </section>
      </div>
    </main>
  );
}
