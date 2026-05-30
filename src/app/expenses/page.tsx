"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  supplier_name: string;
};

type ShopExpense = {
  id: string;
  supplier_id: string | null;
  purchase_invoice_id: string | null;
  expense_date: string;
  expense_category: string;
  description: string;
  amount: number;
  gst_amount: number;
  total_amount: number;
  payment_status: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  suppliers: {
    supplier_name: string;
  } | null;
};

const expenseCategories = [
  "Workshop Consumables",
  "Fluids / Oils",
  "Tools & Equipment",
  "Rent",
  "Utilities",
  "Insurance",
  "Software / Subscriptions",
  "Waste Disposal",
  "Cleaning Supplies",
  "Office / Admin",
  "Repairs & Maintenance",
  "Marketing",
  "Bank Fees",
  "Fuel / Travel",
  "Other",
];

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function monthStartDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU");
}

function badgeClass(status?: string | null) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "partial":
      return "bg-yellow-100 text-yellow-700";
    case "unpaid":
    case "overdue":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function ExpensesPage() {
  const supabase = createClient();

  const [expenses, setExpenses] = useState<ShopExpense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [filters, setFilters] = useState({
    date_from: monthStartDate(),
    date_to: todayDate(),
    category: "all",
    payment_status: "all",
    search: "",
  });

  const [form, setForm] = useState({
    supplier_id: "",
    expense_date: todayDate(),
    expense_category: "Workshop Consumables",
    description: "",
    amount: "",
    gst_amount: "",
    total_amount: "",
    payment_status: "paid",
    payment_method: "card",
    reference: "",
    notes: "",
  });

  const filteredExpenses = useMemo(() => {
    const from = filters.date_from ? new Date(filters.date_from) : null;
    const to = filters.date_to ? new Date(filters.date_to + "T23:59:59") : null;
    const query = filters.search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.expense_date);

      const inDateRange =
        (!from || expenseDate >= from) && (!to || expenseDate <= to);

      const categoryMatch =
        filters.category === "all" || expense.expense_category === filters.category;

      const paymentMatch =
        filters.payment_status === "all" ||
        expense.payment_status === filters.payment_status;

      const searchable = [
        expense.description,
        expense.expense_category,
        expense.reference,
        expense.payment_method,
        expense.notes,
        expense.suppliers?.supplier_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = !query || searchable.includes(query);

      return inDateRange && categoryMatch && paymentMatch && searchMatch;
    });
  }, [expenses, filters]);

  const stats = useMemo(() => {
    const subtotal = filteredExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );

    const gst = filteredExpenses.reduce(
      (sum, expense) => sum + Number(expense.gst_amount || 0),
      0
    );

    const total = filteredExpenses.reduce(
      (sum, expense) => sum + Number(expense.total_amount || 0),
      0
    );

    const paid = filteredExpenses
      .filter((expense) => expense.payment_status === "paid")
      .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

    const unpaid = filteredExpenses
      .filter((expense) => expense.payment_status !== "paid")
      .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

    const byCategory = new Map<string, number>();

    filteredExpenses.forEach((expense) => {
      byCategory.set(
        expense.expense_category,
        (byCategory.get(expense.expense_category) || 0) +
          Number(expense.total_amount || 0)
      );
    });

    const topCategory =
      Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    return {
      count: filteredExpenses.length,
      subtotal,
      gst,
      total,
      paid,
      unpaid,
      topCategory,
    };
  }, [filteredExpenses]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, { category: string; count: number; total: number; gst: number }>();

    filteredExpenses.forEach((expense) => {
      const current = map.get(expense.expense_category) || {
        category: expense.expense_category,
        count: 0,
        total: 0,
        gst: 0,
      };

      current.count += 1;
      current.total += Number(expense.total_amount || 0);
      current.gst += Number(expense.gst_amount || 0);

      map.set(expense.expense_category, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  function updateFilter(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "amount") {
        const amount = Number(value || 0);
        const gst = Number((amount * 0.1).toFixed(2));
        updated.gst_amount = String(gst);
        updated.total_amount = String(Number((amount + gst).toFixed(2)));
      }

      if (field === "gst_amount") {
        const amount = Number(updated.amount || 0);
        const gst = Number(value || 0);
        updated.total_amount = String(Number((amount + gst).toFixed(2)));
      }

      return updated;
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      supplier_id: "",
      expense_date: todayDate(),
      expense_category: "Workshop Consumables",
      description: "",
      amount: "",
      gst_amount: "",
      total_amount: "",
      payment_status: "paid",
      payment_method: "card",
      reference: "",
      notes: "",
    });
  }

  function startEdit(expense: ShopExpense) {
    setEditingId(expense.id);

    setForm({
      supplier_id: expense.supplier_id || "",
      expense_date: expense.expense_date || todayDate(),
      expense_category: expense.expense_category || "Other",
      description: expense.description || "",
      amount: String(expense.amount ?? ""),
      gst_amount: String(expense.gst_amount ?? ""),
      total_amount: String(expense.total_amount ?? ""),
      payment_status: expense.payment_status || "paid",
      payment_method: expense.payment_method || "card",
      reference: expense.reference || "",
      notes: expense.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supplierRes = await supabase
      .from("suppliers")
      .select("id, supplier_name")
      .eq("active", true)
      .order("supplier_name", { ascending: true });

    const expenseRes = await supabase
      .from("shop_expenses")
      .select(`
        *,
        suppliers(supplier_name)
      `)
      .order("expense_date", { ascending: false });

    const errors = [
      supplierRes.error ? `Suppliers: ${supplierRes.error.message}` : "",
      expenseRes.error ? `Expenses: ${expenseRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setSuppliers((supplierRes.data || []) as Supplier[]);
    setExpenses((expenseRes.data || []) as ShopExpense[]);
    setLoading(false);
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    if (!form.description.trim()) {
      setMessage("Description is required.");
      setSaving(false);
      return;
    }

    if (!form.expense_category.trim()) {
      setMessage("Expense category is required.");
      setSaving(false);
      return;
    }

    const amount = Number(form.amount || 0);
    const gstAmount = Number(form.gst_amount || 0);
    const totalAmount =
      form.total_amount.trim() !== ""
        ? Number(form.total_amount || 0)
        : amount + gstAmount;

    if (amount <= 0 && totalAmount <= 0) {
      setMessage("Expense amount must be greater than 0.");
      setSaving(false);
      return;
    }

    const payload = {
      supplier_id: form.supplier_id || null,
      expense_date: form.expense_date,
      expense_category: form.expense_category,
      description: form.description.trim(),
      amount,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      payment_status: form.payment_status,
      payment_method: form.payment_method || null,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("shop_expenses")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }

      setMessage("Expense updated successfully.");
      resetForm();
      await loadData();
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("shop_expenses").insert(payload);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Expense added successfully.");
    resetForm();
    await loadData();
    setSaving(false);
  }

  async function deleteExpense(id: string) {
    const confirmed = window.confirm(
      "Delete this expense? This should only be used for mistakes. Reports will update after deletion."
    );

    if (!confirmed) return;

    const { error } = await supabase.from("shop_expenses").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Expense deleted.");
    await loadData();
  }

  function resetFilters() {
    setFilters({
      date_from: monthStartDate(),
      date_to: todayDate(),
      category: "all",
      payment_status: "all",
      search: "",
    });
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Shop Expenses
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Track rent, utilities, consumables, tools, subscriptions and operating costs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/owner/reports"
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Owner Reports
            </Link>

            <Link
              href="/inventory"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Inventory
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm text-red-300">Expenses</p>
            <p className="mt-2 text-3xl font-bold">{stats.count}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Subtotal</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {money(stats.subtotal)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">GST</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {money(stats.gst)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Total</p>
            <p className="mt-2 text-2xl font-bold text-red-700">
              {money(stats.total)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Unpaid</p>
            <p className="mt-2 text-2xl font-bold text-red-700">
              {money(stats.unpaid)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Top Category</p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {stats.topCategory}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <form onSubmit={saveExpense} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">
              {editingId ? "Edit Expense" : "New Expense"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {editingId ? "Update shop expense" : "Add shop expense"}
            </h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Date</label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => updateForm("expense_date", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Expense category *</label>
                <select
                  value={form.expense_category}
                  onChange={(e) => updateForm("expense_category", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Description *"
              />

              <div>
                <label className="text-sm font-medium text-slate-700">Supplier optional</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => updateForm("supplier_id", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="">No supplier / not required</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => updateForm("amount", e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Amount ex GST"
                />

                <input
                  type="number"
                  step="0.01"
                  value={form.gst_amount}
                  onChange={(e) => updateForm("gst_amount", e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="GST"
                />

                <input
                  type="number"
                  step="0.01"
                  value={form.total_amount}
                  onChange={(e) => updateForm("total_amount", e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Total inc GST"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Payment status</label>
                  <select
                    value={form.payment_status}
                    onChange={(e) => updateForm("payment_status", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  >
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Payment method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => updateForm("payment_method", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  >
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="eftpos">EFTPOS</option>
                    <option value="account">Account</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <input
                value={form.reference}
                onChange={(e) => updateForm("reference", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Receipt / reference number"
              />

              <textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                className="min-h-24 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Notes"
              />

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Preview</p>
                <p className="mt-1">
                  Total expense:{" "}
                  <span className="font-bold text-red-700">
                    {money(Number(form.total_amount || 0))}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Expense"
                      : "Add Expense"}
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

          <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Expense Records</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Shop Expense History
                </h2>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset Filters
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => updateFilter("date_from", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              />

              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => updateFilter("date_to", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              />

              <select
                value={filters.category}
                onChange={(e) => updateFilter("category", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="all">All categories</option>
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={filters.payment_status}
                onChange={(e) => updateFilter("payment_status", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="all">All status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>

              <input
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Search expense, ref, supplier..."
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_280px]">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">GST</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                          Loading expenses...
                        </td>
                      </tr>
                    ) : filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                          No expenses found.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">{formatDate(expense.expense_date)}</td>

                          <td className="px-4 py-3 text-slate-700">
                            {expense.expense_category}
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {expense.description}
                            </p>
                            {expense.notes && (
                              <p className="mt-1 text-xs text-slate-500">
                                {expense.notes}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {expense.suppliers?.supplier_name || "-"}
                          </td>

                          <td className="px-4 py-3">{expense.reference || "-"}</td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(
                                expense.payment_status
                              )}`}
                            >
                              {expense.payment_status}
                            </span>
                          </td>

                          <td className="px-4 py-3">{money(Number(expense.gst_amount || 0))}</td>

                          <td className="px-4 py-3 font-semibold text-red-700">
                            {money(Number(expense.total_amount || 0))}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(expense)}
                                className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteExpense(expense.id)}
                                className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-medium text-red-600">Category Summary</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Breakdown
                </h3>

                <div className="mt-4 grid gap-3">
                  {expensesByCategory.length === 0 ? (
                    <p className="text-sm text-slate-500">No categories to show.</p>
                  ) : (
                    expensesByCategory.map((item) => (
                      <div
                        key={item.category}
                        className="rounded-xl bg-white p-3 text-sm shadow-sm"
                      >
                        <div className="flex justify-between gap-3">
                          <span className="font-semibold text-slate-900">
                            {item.category}
                          </span>
                          <span className="font-bold text-red-700">
                            {money(item.total)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.count} records | GST {money(item.gst)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Expenses entered here are used by Owner Reports to calculate real net profit.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
