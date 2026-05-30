import { createServerSupabaseClient } from "@/lib/supabase/server";
import PublicPrintButton from "@/components/invoices/PublicPrintButton";

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

function formatInvoiceNumber(value: any) {
  if (!value) return "INV";
  const text = String(value);
  if (text.toUpperCase().startsWith("INV-")) return text;
  return `INV-${text.padStart(5, "0")}`;
}

function cleanText(value: any) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ");
}

export default async function PublicInvoicePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      customers(full_name, email, phone, address),
      vehicles(registration, make, model, year, vin),
      invoice_items(
        id,
        item_type,
        description,
        quantity,
        unit_price,
        tax_rate,
        visibility,
        billing_mode,
        included_note,
        sort_order
      )
    `)
    .eq("public_token", token)
    .eq("public_enabled", true)
    .single();

  if (error || !invoice) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Invoice not available
          </h1>
          <p className="mt-3 text-slate-600">
            This invoice link is invalid or no longer available. Please contact TW AUTO TUNE.
          </p>
        </div>
      </main>
    );
  }

  await supabase
    .from("invoices")
    .update({ public_last_viewed_at: new Date().toISOString() })
    .eq("id", invoice.id);

  const invoiceItems = (invoice.invoice_items || [])
    .filter((item: any) => item.visibility !== "owner_only")
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <main className="min-h-screen bg-slate-100 p-6 print:bg-white">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-red-400">TW AUTO TUNE</p>

          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Tax Invoice {formatInvoiceNumber(invoice.invoice_number)}
              </h1>
              <p className="mt-1 text-slate-200">
                Customer invoice and service summary.
              </p>
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
              <p>Invoice Date: {invoice.invoice_date || "-"}</p>
              <p>Due Date: {invoice.due_date || "-"}</p>
              <p>Status: {cleanText(invoice.status)}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Customer</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {invoice.customers?.full_name || "-"}
            </h2>

            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Phone: {invoice.customers?.phone || "-"}</p>
              <p>Email: {invoice.customers?.email || "-"}</p>
              <p>Address: {invoice.customers?.address || "-"}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Vehicle</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {invoice.vehicles?.registration || "-"}
            </h2>

            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>
                Vehicle: {invoice.vehicles?.make || ""} {invoice.vehicles?.model || ""}
              </p>
              <p>Year: {invoice.vehicles?.year || "-"}</p>
              <p>VIN: {invoice.vehicles?.vin || "-"}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Invoice Items</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Charges</h2>

            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {invoiceItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No customer-visible invoice items.
                      </td>
                    </tr>
                  ) : (
                    invoiceItems.map((item: any) => {
                      const lineTotal =
                        Number(item.quantity || 0) * Number(item.unit_price || 0);
                      const isIncluded = item.billing_mode === "included_in_package";

                      return (
                        <tr key={item.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 capitalize text-slate-700">
                            {cleanText(item.item_type)}
                          </td>

                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {item.description}

                            {isIncluded && (
                              <p className="mt-1 text-xs font-normal text-blue-600">
                                Included in selected service package
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {item.quantity}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {isIncluded ? "Included" : money(Number(item.unit_price || 0))}
                          </td>

                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {isIncluded ? "Included" : money(lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-sm font-medium text-red-400">Payment Summary</p>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <strong>{money(Number(invoice.subtotal || 0))}</strong>
              </div>

              <div className="flex justify-between">
                <span>GST</span>
                <strong>{money(Number(invoice.gst_amount || 0))}</strong>
              </div>

              <div className="border-t border-white/10 pt-4 text-lg">
                <div className="flex justify-between">
                  <span>Total</span>
                  <strong>{money(Number(invoice.total_amount || 0))}</strong>
                </div>
              </div>

              <div className="flex justify-between text-green-300">
                <span>Paid</span>
                <strong>{money(Number(invoice.amount_paid || 0))}</strong>
              </div>

              <div className="flex justify-between text-red-300">
                <span>Balance Due</span>
                <strong>{money(Number(invoice.balance_due || 0))}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm">
          <p>Thank you for choosing TW AUTO TUNE.</p>
          <p className="mt-2 text-xs text-slate-400">
            System designed and developed by Nenux Web Solutions.
          </p>
        </section>
      </div>
    </main>
  );
}

