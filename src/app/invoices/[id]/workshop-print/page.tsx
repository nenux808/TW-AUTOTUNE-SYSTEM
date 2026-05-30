"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  job_id: string | null;
  vehicle_id: string | null;
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
    id: string;
    job_number: number;
    job_type: string;
    odometer: number | null;
    customer_complaint: string | null;
    diagnosis_summary: string | null;
    work_completed: string | null;
    recommendations: string | null;
    next_service_odometer: number | null;
    next_service_due_date: string | null;
  } | null;
};

type InvoiceSection = {
  id: string;
  invoice_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;
  section_id: string | null;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
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
  recommendation: string | null;
  cleared_after_service: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function number(value: number) {
  return Number(value || 0).toFixed(2);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU");
}

function formatInvoiceNumber(value?: number) {
  return String(value || 0).padStart(5, "0");
}

function formatJobNumber(value?: number) {
  return String(value || 0).padStart(5, "0");
}

function cleanStatus(value?: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function defaultSectionTitle(item: InvoiceItem) {
  if (item.item_type === "part") return "PARTS";
  if (item.item_type === "labour") return "LABOUR";
  if (item.item_type === "package") return "SERVICE AS PER SCHEDULE";
  return "OTHER CHARGES";
}

export default function WorkshopPrintInvoicePage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [sections, setSections] = useState<InvoiceSection[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [inspection, setInspection] = useState<JobInspection | null>(null);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [diagnosticCodes, setDiagnosticCodes] = useState<DiagnosticCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const groupedSections = useMemo(() => {
    if (sections.length > 0) {
      return sections
        .map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          sort_order: section.sort_order,
          items: items.filter((item) => item.section_id === section.id),
        }))
        .filter((section) => section.items.length > 0 || section.description)
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    }

    const map = new Map<string, InvoiceItem[]>();

    items.forEach((item) => {
      const title = defaultSectionTitle(item);
      const current = map.get(title) || [];
      current.push(item);
      map.set(title, current);
    });

    return Array.from(map.entries()).map(([title, groupItems], index) => ({
      id: title,
      title,
      description: null as string | null,
      sort_order: index + 1,
      items: groupItems,
    }));
  }, [sections, items]);

  const attentionItems = useMemo(() => {
    return inspectionItems.filter((item) =>
      ["monitor", "attention_required", "urgent"].includes(item.status)
    );
  }, [inspectionItems]);

  const repairedItems = useMemo(() => {
    return inspectionItems.filter((item) => item.repaired_during_job);
  }, [inspectionItems]);

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

  async function loadData() {
    setLoading(true);
    setMessage("");

    const invoiceRes = await supabase
      .from("invoices")
      .select(`
        *,
        customers(full_name, phone, email, address),
        vehicles(registration, make, model, year, vin),
        jobs(id, job_number, job_type, odometer, customer_complaint, diagnosis_summary, work_completed, recommendations, next_service_odometer, next_service_due_date)
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
      .select("id, invoice_id, section_id, item_type, description, quantity, unit_price, tax_rate, sort_order")
      .eq("invoice_id", params.id)
      .order("sort_order", { ascending: true });

    const loadedInvoice = (invoiceRes.data || null) as Invoice | null;
    const jobId = loadedInvoice?.job_id || loadedInvoice?.jobs?.id || null;
    const vehicleId = loadedInvoice?.vehicle_id || null;

    let latestInspection: JobInspection | null = null;
    let loadedInspectionItems: InspectionItem[] = [];
    let loadedDiagnosticCodes: DiagnosticCode[] = [];

    if (jobId) {
      const inspectionByJobRes = await supabase
        .from("job_inspections")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);

      latestInspection = (inspectionByJobRes.data?.[0] || null) as JobInspection | null;

      const diagnosticRes = await supabase
        .from("diagnostic_codes")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      loadedDiagnosticCodes = (diagnosticRes.data || []) as DiagnosticCode[];
    }

    if (!latestInspection && vehicleId) {
      const inspectionByVehicleRes = await supabase
        .from("job_inspections")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false })
        .limit(1);

      latestInspection = (inspectionByVehicleRes.data?.[0] || null) as JobInspection | null;
    }

    if (latestInspection) {
      const inspectionItemRes = await supabase
        .from("job_inspection_items")
        .select("*")
        .eq("inspection_id", latestInspection.id)
        .order("category_name", { ascending: true });

      loadedInspectionItems = (inspectionItemRes.data || []) as InspectionItem[];
    }

    const errors = [
      invoiceRes.error ? `Invoice: ${invoiceRes.error.message}` : "",
      sectionRes.error ? `Sections: ${sectionRes.error.message}` : "",
      itemRes.error ? `Items: ${itemRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setInvoice(loadedInvoice);
    setSections((sectionRes.data || []) as InvoiceSection[]);
    setItems((itemRes.data || []) as InvoiceItem[]);
    setInspection(latestInspection);
    setInspectionItems(loadedInspectionItems);
    setDiagnosticCodes(loadedDiagnosticCodes);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
          Loading workshop print invoice...
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
          Invoice not found.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-6 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print {
            display: none !important;
          }

          .invoice-page {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            padding: 0 !important;
          }

          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap justify-end gap-2">
        <Link
          href={`/invoices/${invoice.id}/sections`}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Manage Sections
        </Link>

        <Link
          href={`/invoices/${invoice.id}`}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Customer View
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
        >
          Print / Save PDF
        </button>
      </div>

      {message && (
        <div className="no-print mx-auto mb-4 max-w-4xl rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      <article className="invoice-page mx-auto min-h-[1123px] max-w-4xl bg-white p-10 text-[12px] text-slate-950 shadow-xl">
        <header className="grid grid-cols-[1fr_220px] gap-6 border-b border-slate-300 pb-4">
          <div>
            <h1 className="text-center text-2xl font-bold tracking-wide">TW AUTO TUNE</h1>
            <p className="text-center text-xs font-semibold">AUTOMOTIVE SERVICE & REPAIR</p>

            <div className="mt-8 grid grid-cols-[90px_1fr] gap-y-1">
              <p className="font-semibold">Tax Invoice</p>
              <p>{formatInvoiceNumber(invoice.invoice_number)}</p>

              <p className="font-semibold">Invoice Date</p>
              <p>{formatDate(invoice.invoice_date)}</p>
            </div>
          </div>

          <div className="text-right text-xs leading-relaxed">
            <p className="font-bold">TW AUTO TUNE</p>
            <p>Unit 2/119 Box St</p>
            <p>Dandenong South VIC</p>
            <p>Phone: 0403 965 946</p>
            <p className="mt-2">ABN: To be added</p>
            <p>Email: To be added</p>

            <div className="mt-4 text-left">
              <div className="grid grid-cols-[95px_1fr] gap-y-1">
                <p className="font-semibold">Service Due</p>
                <p>
                  {invoice.jobs?.next_service_due_date
                    ? formatDate(invoice.jobs.next_service_due_date)
                    : "-"}{" "}
                  {invoice.jobs?.next_service_odometer
                    ? `${invoice.jobs.next_service_odometer.toLocaleString()} km`
                    : ""}
                </p>

                <p className="font-semibold">Rego Num</p>
                <p>{invoice.vehicles?.registration || "-"}</p>

                <p className="font-semibold">Vehicle</p>
                <p>
                  {[invoice.vehicles?.make, invoice.vehicles?.model]
                    .filter(Boolean)
                    .join(" ") || "-"}
                </p>

                <p className="font-semibold">Speedo</p>
                <p>{invoice.jobs?.odometer?.toLocaleString() || "-"} km</p>

                <p className="font-semibold">Job</p>
                <p>{formatJobNumber(invoice.jobs?.job_number)}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-[90px_1fr] gap-4">
          <p className="font-semibold">Bill To</p>
          <div>
            <p className="text-lg font-bold uppercase">{invoice.customers?.full_name || "-"}</p>
            <p className="whitespace-pre-wrap text-sm uppercase">
              {invoice.customers?.address || "-"}
            </p>
            <p className="mt-1 text-xs">
              {invoice.customers?.phone || ""} {invoice.customers?.email || ""}
            </p>
          </div>
        </section>

        {(invoice.jobs?.customer_complaint ||
          invoice.jobs?.diagnosis_summary ||
          invoice.jobs?.work_completed ||
          invoice.jobs?.recommendations) && (
          <section className="avoid-break mt-6 rounded border border-slate-300 p-3">
            <p className="mb-2 font-bold uppercase">Job Summary</p>

            {invoice.jobs?.customer_complaint && (
              <div className="mb-2">
                <p className="font-semibold uppercase">Customer Request</p>
                <p className="whitespace-pre-wrap text-xs">{invoice.jobs.customer_complaint}</p>
              </div>
            )}

            {invoice.jobs?.diagnosis_summary && (
              <div className="mb-2">
                <p className="font-semibold uppercase">Diagnosis Summary</p>
                <p className="whitespace-pre-wrap text-xs">{invoice.jobs.diagnosis_summary}</p>
              </div>
            )}

            {invoice.jobs?.work_completed && (
              <div className="mb-2">
                <p className="font-semibold uppercase">Work Completed</p>
                <p className="whitespace-pre-wrap text-xs">{invoice.jobs.work_completed}</p>
              </div>
            )}

            {invoice.jobs?.recommendations && (
              <div>
                <p className="font-semibold uppercase">Recommendations</p>
                <p className="whitespace-pre-wrap text-xs">{invoice.jobs.recommendations}</p>
              </div>
            )}
          </section>
        )}

        <section className="mt-8">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border border-slate-400">
                <th className="px-2 py-1 font-semibold">Description-Text</th>
                <th className="w-20 px-2 py-1 text-right font-semibold">Qty</th>
                <th className="w-28 px-2 py-1 text-right font-semibold">Unit Price</th>
                <th className="w-28 px-2 py-1 text-right font-semibold">Amount</th>
              </tr>
            </thead>

            <tbody>
              {groupedSections.map((section) => (
                <tr key={section.id} className="avoid-break">
                  <td colSpan={4} className="pt-6">
                    <div className="mb-2">
                      <p className="text-lg font-bold uppercase">*{section.title}.</p>

                      {section.description && (
                        <div className="mt-1 whitespace-pre-wrap text-xs uppercase leading-relaxed">
                          {section.description}
                        </div>
                      )}
                    </div>

                    <table className="w-full border-collapse">
                      <tbody>
                        {section.items.map((item) => {
                          const lineTotal =
                            Number(item.quantity || 0) * Number(item.unit_price || 0);

                          const isLabour = item.item_type === "labour";

                          return (
                            <tr key={item.id}>
                              <td className="py-1 align-top uppercase">
                                {isLabour ? "Labour" : item.description}
                              </td>
                              <td className="w-20 py-1 text-right align-top">
                                {number(Number(item.quantity || 0))}
                              </td>
                              <td className="w-28 py-1 text-right align-top">
                                {number(Number(item.unit_price || 0))}
                              </td>
                              <td className="w-28 py-1 text-right align-top">
                                {number(lineTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="avoid-break mt-10 border-t border-slate-300 pt-5">
          <p className="text-lg font-bold uppercase">*Vehicle Inspection Summary.</p>

          {!inspection ? (
            <p className="mt-2 text-xs">No inspection checklist was recorded for this job.</p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-[120px_1fr] gap-y-1 text-xs">
                <p className="font-semibold">Overall Status</p>
                <p className="uppercase">{cleanStatus(inspection.overall_status)}</p>

                <p className="font-semibold">Inspection Date</p>
                <p>{formatDate(inspection.completed_at || inspection.created_at)}</p>
              </div>

              {inspection.customer_visible_notes && (
                <div className="mt-3">
                  <p className="font-semibold uppercase">Inspection Notes</p>
                  <p className="whitespace-pre-wrap text-xs">
                    {inspection.customer_visible_notes}
                  </p>
                </div>
              )}

              {attentionItems.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold uppercase">Attention Required / Monitor Items</p>

                  <table className="mt-2 w-full border-collapse text-xs">
                    <thead>
                      <tr className="border border-slate-300">
                        <th className="px-2 py-1 text-left">Category</th>
                        <th className="px-2 py-1 text-left">Item</th>
                        <th className="px-2 py-1 text-left">Status</th>
                        <th className="px-2 py-1 text-left">Recommendation</th>
                      </tr>
                    </thead>

                    <tbody>
                      {attentionItems.map((item) => (
                        <tr key={item.id} className="border-b border-slate-200">
                          <td className="px-2 py-1">{item.category_name}</td>
                          <td className="px-2 py-1 font-semibold">{item.item_name}</td>
                          <td className="px-2 py-1 uppercase">{cleanStatus(item.status)}</td>
                          <td className="px-2 py-1">
                            {item.recommendation || item.mechanic_note || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {repairedItems.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold uppercase">Repaired During This Job</p>
                  <p className="mt-1 text-xs uppercase">
                    {repairedItems.map((item) => item.item_name).join(", ")}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        <section className="avoid-break mt-8">
          <p className="text-lg font-bold uppercase">*Checked Items.</p>

          {Object.entries(inspectionGroups).length === 0 ? (
            <p className="mt-2 text-xs">No customer-visible checked items recorded.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {Object.entries(inspectionGroups).map(([category, groupItems]) => {
                const goodItems = groupItems.filter((item) => item.status === "good");
                const monitorItems = groupItems.filter((item) => item.status === "monitor");
                const attentionGroupItems = groupItems.filter((item) =>
                  ["attention_required", "urgent"].includes(item.status)
                );

                return (
                  <div key={category} className="avoid-break rounded border border-slate-300 p-2">
                    <p className="mb-1 font-bold uppercase">{category}</p>

                    {goodItems.length > 0 && (
                      <p className="text-xs">
                        <span className="font-semibold">Good:</span>{" "}
                        {goodItems.map((item) => item.item_name).join(", ")}
                      </p>
                    )}

                    {monitorItems.length > 0 && (
                      <p className="text-xs">
                        <span className="font-semibold">Monitor:</span>{" "}
                        {monitorItems.map((item) => item.item_name).join(", ")}
                      </p>
                    )}

                    {attentionGroupItems.length > 0 && (
                      <p className="text-xs">
                        <span className="font-semibold">Attention:</span>{" "}
                        {attentionGroupItems.map((item) => item.item_name).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="avoid-break mt-8">
          <p className="text-lg font-bold uppercase">*Diagnostic Scan Results.</p>

          {diagnosticCodes.length === 0 ? (
            <p className="mt-2 text-xs">No diagnostic codes were recorded for this job.</p>
          ) : (
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border border-slate-300">
                  <th className="px-2 py-1 text-left">Code</th>
                  <th className="px-2 py-1 text-left">System</th>
                  <th className="px-2 py-1 text-left">Description</th>
                  <th className="px-2 py-1 text-left">Status</th>
                  <th className="px-2 py-1 text-left">Recommendation</th>
                </tr>
              </thead>

              <tbody>
                {diagnosticCodes.map((code) => (
                  <tr key={code.id} className="border-b border-slate-200">
                    <td className="px-2 py-1 font-bold">{code.code}</td>
                    <td className="px-2 py-1">{code.system || "-"}</td>
                    <td className="px-2 py-1">{code.description || "-"}</td>
                    <td className="px-2 py-1 uppercase">
                      {cleanStatus(code.status)}
                      {code.cleared_after_service ? " / CLEARED" : ""}
                    </td>
                    <td className="px-2 py-1">{code.recommendation || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {invoice.notes && (
          <section className="avoid-break mt-8">
            <p className="font-bold uppercase">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-xs">{invoice.notes}</p>
          </section>
        )}

        <section className="avoid-break mt-12 grid grid-cols-[1fr_260px] gap-8">
          <div className="text-xs leading-relaxed">
            <div>
              <p className="font-bold uppercase">Direct Deposit Details</p>
              <div className="mt-2 grid grid-cols-[90px_1fr] gap-y-1">
                <p className="font-semibold">Bank</p>
                <p>TO BE ADDED</p>

                <p className="font-semibold">Account Name</p>
                <p>TW AUTO TUNE</p>

                <p className="font-semibold">BSB</p>
                <p>000-000</p>

                <p className="font-semibold">Account No</p>
                <p>000000000</p>

                <p className="font-semibold">Reference</p>
                <p>Invoice {formatInvoiceNumber(invoice.invoice_number)}</p>
              </div>
            </div>

            <p className="mt-4 font-semibold">
              *THANK YOU FOR CHOOSING TW AUTO TUNE*
            </p>
          </div>

          <div className="text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <p>Subtotal</p>
              <p className="text-right">{money(Number(invoice.subtotal || 0))}</p>

              <p>Add GST</p>
              <p className="text-right">{money(Number(invoice.gst_amount || 0))}</p>

              <p className="border-t border-slate-400 pt-2 font-bold">Total</p>
              <p className="border-t border-slate-400 pt-2 text-right font-bold">
                {money(Number(invoice.total_amount || 0))}
              </p>

              <p>Paid</p>
              <p className="text-right">{money(Number(invoice.amount_paid || 0))}</p>

              <p className="font-bold">Amount Outstanding</p>
              <p className="text-right font-bold">
                {money(Number(invoice.balance_due || 0))}
              </p>
            </div>
          </div>
        </section>

        <footer className="avoid-break mt-10 border border-slate-400 px-3 py-2 text-xs">
          <div className="grid grid-cols-3">
            <p>Payable to TW AUTO TUNE</p>
            <p className="text-center">Page</p>
            <p className="text-right">PH 0403 965 946</p>
          </div>
        </footer>
      </article>
    </main>
  );
}


