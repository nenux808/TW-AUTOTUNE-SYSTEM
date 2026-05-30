"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type PurchaseInvoice = {
  id: string;
  supplier_id: string;
  supplier_invoice_number: string;
  purchase_date: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number | null;
  balance_due: number | null;
  notes: string | null;
  created_at: string;
  suppliers: {
    supplier_name: string;
    phone: string | null;
    email: string | null;
  } | null;
};

type PurchaseInvoiceItem = {
  id: string;
  purchase_invoice_id: string;
  part_id: string | null;
  part_name: string;
  part_number: string | null;
  category: string | null;
  supplier: string | null;
  quantity: number;
  unit_cost: number;
  unit_selling_price: number;
  gst_rate: number;
  line_total: number;
};

type PurchasePayment = {
  id: string;
  purchase_invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU");
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function paymentBadge(status: string) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "partial":
      return "bg-yellow-100 text-yellow-700";
    case "unpaid":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function PurchaseHistoryPage() {
  const supabase = createClient();

  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [items, setItems] = useState<PurchaseInvoiceItem[]>([]);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
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

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const matchesPayment =
        paymentFilter === "all" || purchase.payment_status === paymentFilter;

      const searchable = [
        purchase.supplier_invoice_number,
        purchase.suppliers?.supplier_name,
        purchase.payment_status,
        purchase.payment_method,
        purchase.purchase_date,
        purchase.total_amount,
        purchase.amount_paid,
        purchase.balance_due,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      return matchesPayment && matchesSearch;
    });
  }, [purchases, search, paymentFilter]);

  const selectedPurchase = purchases.find((item) => item.id === selectedPurchaseId);

  const selectedItems = items.filter(
    (item) => item.purchase_invoice_id === selectedPurchaseId
  );

  const selectedPayments = payments.filter(
    (payment) => payment.purchase_invoice_id === selectedPurchaseId
  );

  const selectedPaidTotal = selectedPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const selectedBalance = selectedPurchase
    ? Math.max(Number(selectedPurchase.total_amount || 0) - selectedPaidTotal, 0)
    : 0;

  const stats = useMemo(() => {
    const totalSpent = filteredPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.total_amount || 0),
      0
    );

    const unpaidTotal = filteredPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.balance_due ?? purchase.total_amount ?? 0),
      0
    );

    const paidTotal = filteredPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.amount_paid || 0),
      0
    );

    return {
      invoiceCount: filteredPurchases.length,
      totalSpent,
      unpaidTotal,
      paidTotal,
    };
  }, [filteredPurchases]);

  function updatePaymentForm(field: string, value: string) {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  }

  async function loadPurchases() {
    setLoading(true);
    setMessage("");

    const purchaseRes = await supabase
      .from("purchase_invoices")
      .select(`
        *,
        suppliers(supplier_name, phone, email)
      `)
      .order("purchase_date", { ascending: false });

    const itemRes = await supabase
      .from("purchase_invoice_items")
      .select("*")
      .order("created_at", { ascending: false });

    const paymentRes = await supabase
      .from("purchase_invoice_payments")
      .select("*")
      .order("payment_date", { ascending: false });

    const errors = [
      purchaseRes.error ? `Purchases: ${purchaseRes.error.message}` : "",
      itemRes.error ? `Items: ${itemRes.error.message}` : "",
      paymentRes.error ? `Payments: ${paymentRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setPurchases((purchaseRes.data || []) as PurchaseInvoice[]);
    setItems((itemRes.data || []) as PurchaseInvoiceItem[]);
    setPayments((paymentRes.data || []) as PurchasePayment[]);
    setLoading(false);
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedPurchase) return;

    setSavingPayment(true);
    setMessage("");

    const amount = Number(paymentForm.amount || 0);

    if (amount <= 0) {
      setMessage("Payment amount must be greater than 0.");
      setSavingPayment(false);
      return;
    }

    if (amount > selectedBalance) {
      setMessage(`Payment cannot be more than remaining balance: ${money(selectedBalance)}.`);
      setSavingPayment(false);
      return;
    }

    const { error: paymentError } = await supabase
      .from("purchase_invoice_payments")
      .insert({
        purchase_invoice_id: selectedPurchase.id,
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

    const newPaidTotal = selectedPaidTotal + amount;
    const newBalance = Math.max(Number(selectedPurchase.total_amount || 0) - newPaidTotal, 0);

    let newStatus = "unpaid";
    if (newBalance <= 0) {
      newStatus = "paid";
    } else if (newPaidTotal > 0) {
      newStatus = "partial";
    }

    const { error: updateError } = await supabase
      .from("purchase_invoices")
      .update({
        amount_paid: newPaidTotal,
        balance_due: newBalance,
        payment_status: newStatus,
      })
      .eq("id", selectedPurchase.id);

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

    setMessage("Payment recorded successfully.");
    await loadPurchases();
    setSavingPayment(false);
  }

  useEffect(() => {
    loadPurchases();
  }, []);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">Inventory</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Bought Invoice History
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Track supplier invoices, partial payments, balances and purchased items.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/inventory/purchases/new"
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Add Bought Invoice
            </Link>

            <Link
              href="/inventory"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Inventory
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm text-red-300">Invoices</p>
            <p className="mt-2 text-3xl font-bold">{stats.invoiceCount}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Total Purchases</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {money(stats.totalSpent)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Paid to Suppliers</p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              {money(stats.paidTotal)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Supplier Balance</p>
            <p className="mt-2 text-2xl font-bold text-red-700">
              {money(stats.unpaidTotal)}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Purchase Records</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Supplier Bought Invoices
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Search invoice, supplier, date..."
                />

                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="all">All payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Supplier Invoice No.</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Purchase Date</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        Loading purchase history...
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        No bought invoices found.
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((purchase) => (
                      <tr key={purchase.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {purchase.supplier_invoice_number}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {purchase.suppliers?.supplier_name || "-"}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {formatDate(purchase.purchase_date)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${paymentBadge(
                              purchase.payment_status
                            )}`}
                          >
                            {purchase.payment_status}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {money(Number(purchase.total_amount || 0))}
                        </td>

                        <td className="px-4 py-3 text-green-700 font-semibold">
                          {money(Number(purchase.amount_paid || 0))}
                        </td>

                        <td className="px-4 py-3 text-red-700 font-semibold">
                          {money(Number(purchase.balance_due ?? purchase.total_amount ?? 0))}
                        </td>

                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedPurchaseId(purchase.id)}
                            className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Invoice Details</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {selectedPurchase
                    ? selectedPurchase.supplier_invoice_number
                    : "Select Invoice"}
                </h2>
              </div>

              {selectedPurchaseId && (
                <button
                  type="button"
                  onClick={() => setSelectedPurchaseId(null)}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Clear
                </button>
              )}
            </div>

            {!selectedPurchase ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Select a bought invoice to view items and record payments.
              </p>
            ) : (
              <>
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Supplier:</span>{" "}
                    {selectedPurchase.suppliers?.supplier_name || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Date:</span>{" "}
                    {formatDate(selectedPurchase.purchase_date)}
                  </p>
                  <p>
                    <span className="font-semibold">Total:</span>{" "}
                    {money(Number(selectedPurchase.total_amount || 0))}
                  </p>
                  <p>
                    <span className="font-semibold">Paid:</span>{" "}
                    {money(selectedPaidTotal)}
                  </p>
                  <p>
                    <span className="font-semibold">Balance:</span>{" "}
                    {money(selectedBalance)}
                  </p>
                </div>

                {selectedBalance > 0 && (
                  <form onSubmit={addPayment} className="mt-4 rounded-2xl border border-slate-200 p-4">
                    <p className="font-bold text-slate-900">Record Payment</p>

                    <div className="mt-3 grid gap-3">
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
                        placeholder={`Amount, max ${money(selectedBalance)}`}
                      />

                      <select
                        value={paymentForm.payment_method}
                        onChange={(e) => updatePaymentForm("payment_method", e.target.value)}
                        className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="card">Card</option>
                        <option value="cash">Cash</option>
                        <option value="supplier_account">Supplier Account</option>
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

                {selectedBalance <= 0 && (
                  <p className="mt-4 rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">
                    This supplier invoice is fully paid.
                  </p>
                )}

                <div className="mt-4">
                  <p className="font-bold text-slate-900">Payment History</p>

                  <div className="mt-3 grid gap-2">
                    {selectedPayments.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                        No payments recorded yet.
                      </p>
                    ) : (
                      selectedPayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="rounded-xl border border-slate-200 p-3 text-sm"
                        >
                          <div className="flex justify-between gap-3">
                            <span className="font-semibold text-slate-900">
                              {money(Number(payment.amount || 0))}
                            </span>
                            <span className="text-slate-500">
                              {formatDate(payment.payment_date)}
                            </span>
                          </div>
                          <p className="mt-1 text-slate-600 capitalize">
                            {payment.payment_method || "-"}
                          </p>
                          {payment.reference && (
                            <p className="text-slate-600">
                              Ref: {payment.reference}
                            </p>
                          )}
                          {payment.notes && (
                            <p className="text-slate-600">
                              Note: {payment.notes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="font-bold text-slate-900">Purchased Items</p>

                  <div className="mt-3 grid gap-3">
                    {selectedItems.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                        No items found for this invoice.
                      </p>
                    ) : (
                      selectedItems.map((item) => {
                        const profitPerUnit =
                          Number(item.unit_selling_price || 0) -
                          Number(item.unit_cost || 0);

                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-slate-200 p-4 text-sm"
                          >
                            <p className="font-bold text-slate-900">
                              {item.part_name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.part_number || "No SKU"} |{" "}
                              {item.category || "No category"}
                            </p>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-slate-700">
                              <p>Qty: {item.quantity}</p>
                              <p>Cost: {money(Number(item.unit_cost || 0))}</p>
                              <p>Selling: {money(Number(item.unit_selling_price || 0))}</p>
                              <p className="font-semibold text-green-700">
                                Profit/unit: {money(profitPerUnit)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
