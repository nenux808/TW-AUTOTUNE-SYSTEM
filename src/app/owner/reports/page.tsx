"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  status: string;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  total_cost: number | null;
  total_profit: number | null;
  profit_margin: number | null;
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

type InvoiceItem = {
  id: string;
  invoice_id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  profit_amount: number | null;
  supplier: string | null;
};

type PurchaseInvoice = {
  id: string;
  supplier_invoice_number: string;
  purchase_date: string;
  payment_status: string;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number | null;
  balance_due: number | null;
  suppliers: {
    supplier_name: string;
  } | null;
};

type PurchaseItem = {
  id: string;
  purchase_invoice_id: string;
  part_name: string;
  part_number: string | null;
  category: string | null;
  supplier: string | null;
  quantity: number;
  unit_cost: number;
  unit_selling_price: number;
  item_type: string | null;
  expense_category: string | null;
  track_stock: boolean | null;
  customer_billable: boolean | null;
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
  suppliers: {
    supplier_name: string;
  } | null;
};

type Part = {
  id: string;
  part_name: string;
  part_number: string | null;
  category: string | null;
  supplier: string | null;
  cost_price: number | null;
  selling_price: number;
  quantity_in_stock: number | null;
  reorder_level: number | null;
  location: string | null;
  item_type: string | null;
  track_stock: boolean | null;
  expense_category: string | null;
  customer_billable: boolean | null;
};

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

function formatInvoiceNumber(value?: number) {
  return "INV-" + String(value || 0).padStart(5, "0");
}

function badgeClass(status?: string | null) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "partial":
      return "bg-yellow-100 text-yellow-700";
    case "unpaid":
    case "overdue":
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "sent":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function OwnerReportsPage() {
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [shopExpenses, setShopExpenses] = useState<ShopExpense[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [filters, setFilters] = useState({
    date_from: monthStartDate(),
    date_to: todayDate(),
    customer: "",
    invoice_number: "",
    vehicle_registration: "",
    supplier_invoice_number: "",
    part_name: "",
    supplier: "",
    expense_category: "all",
    payment_status: "all",
  });

  function updateFilter(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  const expenseCategories = useMemo(() => {
    const set = new Set<string>();

    shopExpenses.forEach((expense) => {
      if (expense.expense_category) set.add(expense.expense_category);
    });

    purchaseItems.forEach((item) => {
      if (item.expense_category) set.add(item.expense_category);
    });

    return Array.from(set).sort();
  }, [shopExpenses, purchaseItems]);

  const filteredInvoices = useMemo(() => {
    const from = filters.date_from ? new Date(filters.date_from) : null;
    const to = filters.date_to ? new Date(filters.date_to + "T23:59:59") : null;

    return invoices.filter((invoice) => {
      const invoiceDate = new Date(invoice.invoice_date);

      const inDateRange = (!from || invoiceDate >= from) && (!to || invoiceDate <= to);

      const customerMatch =
        !filters.customer.trim() ||
        invoice.customers?.full_name
          ?.toLowerCase()
          .includes(filters.customer.trim().toLowerCase());

      const invoiceMatch =
        !filters.invoice_number.trim() ||
        formatInvoiceNumber(invoice.invoice_number)
          .toLowerCase()
          .includes(filters.invoice_number.trim().toLowerCase()) ||
        String(invoice.invoice_number).includes(filters.invoice_number.trim());

      const regoMatch =
        !filters.vehicle_registration.trim() ||
        invoice.vehicles?.registration
          ?.toLowerCase()
          .includes(filters.vehicle_registration.trim().toLowerCase());

      const paymentMatch =
        filters.payment_status === "all" || invoice.status === filters.payment_status;

      return inDateRange && customerMatch && invoiceMatch && regoMatch && paymentMatch;
    });
  }, [invoices, filters]);

  const filteredInvoiceIds = useMemo(() => {
    return new Set(filteredInvoices.map((invoice) => invoice.id));
  }, [filteredInvoices]);

  const filteredInvoiceItems = useMemo(() => {
    const partQuery = filters.part_name.trim().toLowerCase();
    const supplierQuery = filters.supplier.trim().toLowerCase();

    return invoiceItems.filter((item) => {
      const invoiceMatch = filteredInvoiceIds.has(item.invoice_id);

      const partMatch =
        !partQuery || item.description.toLowerCase().includes(partQuery);

      const supplierMatch =
        !supplierQuery || item.supplier?.toLowerCase().includes(supplierQuery);

      return invoiceMatch && partMatch && supplierMatch;
    });
  }, [invoiceItems, filteredInvoiceIds, filters.part_name, filters.supplier]);

  const filteredPurchases = useMemo(() => {
    const from = filters.date_from ? new Date(filters.date_from) : null;
    const to = filters.date_to ? new Date(filters.date_to + "T23:59:59") : null;

    return purchaseInvoices.filter((purchase) => {
      const purchaseDate = new Date(purchase.purchase_date);

      const inDateRange = (!from || purchaseDate >= from) && (!to || purchaseDate <= to);

      const supplierInvoiceMatch =
        !filters.supplier_invoice_number.trim() ||
        purchase.supplier_invoice_number
          .toLowerCase()
          .includes(filters.supplier_invoice_number.trim().toLowerCase());

      const supplierMatch =
        !filters.supplier.trim() ||
        purchase.suppliers?.supplier_name
          ?.toLowerCase()
          .includes(filters.supplier.trim().toLowerCase());

      const paymentMatch =
        filters.payment_status === "all" ||
        purchase.payment_status === filters.payment_status;

      return inDateRange && supplierInvoiceMatch && supplierMatch && paymentMatch;
    });
  }, [purchaseInvoices, filters]);

  const filteredPurchaseIds = useMemo(() => {
    return new Set(filteredPurchases.map((purchase) => purchase.id));
  }, [filteredPurchases]);

  const filteredPurchaseItems = useMemo(() => {
    const partQuery = filters.part_name.trim().toLowerCase();
    const supplierQuery = filters.supplier.trim().toLowerCase();

    return purchaseItems.filter((item) => {
      const purchaseMatch = filteredPurchaseIds.has(item.purchase_invoice_id);

      const partMatch =
        !partQuery ||
        item.part_name.toLowerCase().includes(partQuery) ||
        item.part_number?.toLowerCase().includes(partQuery);

      const supplierMatch =
        !supplierQuery || item.supplier?.toLowerCase().includes(supplierQuery);

      const categoryMatch =
        filters.expense_category === "all" ||
        item.expense_category === filters.expense_category;

      return purchaseMatch && partMatch && supplierMatch && categoryMatch;
    });
  }, [
    purchaseItems,
    filteredPurchaseIds,
    filters.part_name,
    filters.supplier,
    filters.expense_category,
  ]);

  const filteredShopExpenses = useMemo(() => {
    const from = filters.date_from ? new Date(filters.date_from) : null;
    const to = filters.date_to ? new Date(filters.date_to + "T23:59:59") : null;
    const supplierQuery = filters.supplier.trim().toLowerCase();
    const partQuery = filters.part_name.trim().toLowerCase();

    return shopExpenses.filter((expense) => {
      const expenseDate = new Date(expense.expense_date);

      const inDateRange = (!from || expenseDate >= from) && (!to || expenseDate <= to);

      const categoryMatch =
        filters.expense_category === "all" ||
        expense.expense_category === filters.expense_category;

      const supplierMatch =
        !supplierQuery ||
        expense.suppliers?.supplier_name?.toLowerCase().includes(supplierQuery);

      const descriptionMatch =
        !partQuery ||
        expense.description.toLowerCase().includes(partQuery) ||
        expense.reference?.toLowerCase().includes(partQuery);

      const paymentMatch =
        filters.payment_status === "all" ||
        expense.payment_status === filters.payment_status;

      return inDateRange && categoryMatch && supplierMatch && descriptionMatch && paymentMatch;
    });
  }, [shopExpenses, filters]);

  const stats = useMemo(() => {
    const revenue = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount || 0),
      0
    );

    const paid = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount_paid || 0),
      0
    );

    const customerBalance = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.balance_due || 0),
      0
    );

    const gstCollected = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.gst_amount || 0),
      0
    );

    const partsSales = filteredInvoiceItems
      .filter((item) => item.item_type === "part")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const partsCost = filteredInvoiceItems
      .filter((item) => item.item_type === "part")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.cost_price || 0), 0);

    const partsProfit = partsSales - partsCost;

    const labourRevenue = filteredInvoiceItems
      .filter((item) => item.item_type === "labour")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const packageRevenue = filteredInvoiceItems
      .filter((item) => item.item_type === "package")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const serviceRevenue = filteredInvoiceItems
      .filter((item) => item.item_type === "service")
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

    const supplierPurchaseTotal = filteredPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.total_amount || 0),
      0
    );

    const supplierPaid = filteredPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.amount_paid || 0),
      0
    );

    const supplierBalance = filteredPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.balance_due ?? purchase.total_amount ?? 0),
      0
    );

    const shopExpenseSubtotal = filteredShopExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );

    const shopExpenseGst = filteredShopExpenses.reduce(
      (sum, expense) => sum + Number(expense.gst_amount || 0),
      0
    );

    const shopExpenseTotal = filteredShopExpenses.reduce(
      (sum, expense) => sum + Number(expense.total_amount || 0),
      0
    );

    const consumableExpenses = filteredShopExpenses
      .filter((expense) => expense.expense_category === "Workshop Consumables")
      .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

    const toolExpenses = filteredShopExpenses
      .filter((expense) => expense.expense_category === "Tools & Equipment")
      .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

    const operatingExpenses = filteredShopExpenses
      .filter(
        (expense) =>
          !["Workshop Consumables", "Tools & Equipment", "Parts Purchase", "Fluids / Oils"].includes(
            expense.expense_category
          )
      )
      .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

    const grossProfitBeforeExpenses = revenue - partsCost;
    const netProfit = grossProfitBeforeExpenses - shopExpenseTotal;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const lowStockCount = parts.filter((part) => {
      if (part.track_stock === false) return false;
      const qty = Number(part.quantity_in_stock || 0);
      const reorder = Number(part.reorder_level || 0);
      return reorder > 0 && qty <= reorder;
    }).length;

    const stockCostValue = parts
      .filter((part) => part.track_stock !== false)
      .reduce((sum, part) => {
        return sum + Number(part.cost_price || 0) * Number(part.quantity_in_stock || 0);
      }, 0);

    return {
      invoiceCount: filteredInvoices.length,
      revenue,
      paid,
      customerBalance,
      gstCollected,
      partsSales,
      partsCost,
      partsProfit,
      labourRevenue,
      packageRevenue,
      serviceRevenue,
      supplierPurchaseTotal,
      supplierPaid,
      supplierBalance,
      grossProfitBeforeExpenses,
      shopExpenseSubtotal,
      shopExpenseGst,
      shopExpenseTotal,
      consumableExpenses,
      toolExpenses,
      operatingExpenses,
      netProfit,
      netMargin,
      lowStockCount,
      stockCostValue,
    };
  }, [filteredInvoices, filteredInvoiceItems, filteredPurchases, filteredShopExpenses, parts]);

  const bestSellingParts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; sales: number; profit: number }>();

    filteredInvoiceItems
      .filter((item) => item.item_type === "part")
      .forEach((item) => {
        const current = map.get(item.description) || {
          name: item.description,
          qty: 0,
          sales: 0,
          profit: 0,
        };

        current.qty += Number(item.quantity || 0);
        current.sales += Number(item.quantity || 0) * Number(item.unit_price || 0);
        current.profit += Number(item.profit_amount || 0);

        map.set(item.description, current);
      });

    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [filteredInvoiceItems]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, { category: string; total: number; gst: number; count: number }>();

    filteredShopExpenses.forEach((expense) => {
      const current = map.get(expense.expense_category) || {
        category: expense.expense_category,
        total: 0,
        gst: 0,
        count: 0,
      };

      current.total += Number(expense.total_amount || 0);
      current.gst += Number(expense.gst_amount || 0);
      current.count += 1;

      map.set(expense.expense_category, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredShopExpenses]);

  const lowStockParts = useMemo(() => {
    return parts
      .filter((part) => {
        if (part.track_stock === false) return false;
        const qty = Number(part.quantity_in_stock || 0);
        const reorder = Number(part.reorder_level || 0);
        return reorder > 0 && qty <= reorder;
      })
      .slice(0, 10);
  }, [parts]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const invoiceRes = await supabase
      .from("invoices")
      .select(`
        *,
        customers(full_name, phone),
        vehicles(registration, make, model)
      `)
      .order("invoice_date", { ascending: false });

    const invoiceItemRes = await supabase
      .from("invoice_items")
      .select("*")
      .order("sort_order", { ascending: true });

    const purchaseRes = await supabase
      .from("purchase_invoices")
      .select(`
        *,
        suppliers(supplier_name)
      `)
      .order("purchase_date", { ascending: false });

    const purchaseItemRes = await supabase
      .from("purchase_invoice_items")
      .select("*")
      .order("created_at", { ascending: false });

    const expenseRes = await supabase
      .from("shop_expenses")
      .select(`
        *,
        suppliers(supplier_name)
      `)
      .order("expense_date", { ascending: false });

    const partsRes = await supabase
      .from("parts")
      .select("*")
      .eq("active", true)
      .order("part_name", { ascending: true });

    const errors = [
      invoiceRes.error ? `Invoices: ${invoiceRes.error.message}` : "",
      invoiceItemRes.error ? `Invoice Items: ${invoiceItemRes.error.message}` : "",
      purchaseRes.error ? `Purchases: ${purchaseRes.error.message}` : "",
      purchaseItemRes.error ? `Purchase Items: ${purchaseItemRes.error.message}` : "",
      expenseRes.error ? `Shop Expenses: ${expenseRes.error.message}` : "",
      partsRes.error ? `Parts: ${partsRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setInvoices((invoiceRes.data || []) as Invoice[]);
    setInvoiceItems((invoiceItemRes.data || []) as InvoiceItem[]);
    setPurchaseInvoices((purchaseRes.data || []) as PurchaseInvoice[]);
    setPurchaseItems((purchaseItemRes.data || []) as PurchaseItem[]);
    setShopExpenses((expenseRes.data || []) as ShopExpense[]);
    setParts((partsRes.data || []) as Part[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetFilters() {
    setFilters({
      date_from: monthStartDate(),
      date_to: todayDate(),
      customer: "",
      invoice_number: "",
      vehicle_registration: "",
      supplier_invoice_number: "",
      part_name: "",
      supplier: "",
      expense_category: "all",
      payment_status: "all",
    });
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-red-300">TW AUTO TUNE</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Owner Reports</h1>
            <p className="mt-1 text-sm text-slate-300">
              Revenue, expenses, stock, supplier balances, customer balances and real net profit.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Print Report
            </button>

            <Link
              href="/expenses"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Expenses
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="print-card mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Report Filters</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Search and Analyse</h2>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Date from</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => updateFilter("date_from", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Date to</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => updateFilter("date_to", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Payment status</label>
              <select
                value={filters.payment_status}
                onChange={(e) => updateFilter("payment_status", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Expense category</label>
              <select
                value={filters.expense_category}
                onChange={(e) => updateFilter("expense_category", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="all">All categories</option>
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <input
              value={filters.customer}
              onChange={(e) => updateFilter("customer", e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Customer name"
            />

            <input
              value={filters.invoice_number}
              onChange={(e) => updateFilter("invoice_number", e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Invoice number"
            />

            <input
              value={filters.vehicle_registration}
              onChange={(e) => updateFilter("vehicle_registration", e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-red-500"
              placeholder="Vehicle registration"
            />

            <input
              value={filters.supplier_invoice_number}
              onChange={(e) => updateFilter("supplier_invoice_number", e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-red-500"
              placeholder="Supplier invoice number"
            />

            <input
              value={filters.part_name}
              onChange={(e) => updateFilter("part_name", e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Part / expense / reference"
            />

            <input
              value={filters.supplier}
              onChange={(e) => updateFilter("supplier", e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Supplier"
            />
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">Loading owner reports...</div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 print-avoid-break">
              <div className="print-card rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
                <p className="text-sm text-red-300">Invoices</p>
                <p className="mt-2 text-3xl font-bold">{stats.invoiceCount}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Revenue</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{money(stats.revenue)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Parts Cost</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{money(stats.partsCost)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Shop Expenses</p>
                <p className="mt-2 text-2xl font-bold text-red-700">{money(stats.shopExpenseTotal)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Net Profit</p>
                <p className={`mt-2 text-2xl font-bold ${stats.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {money(stats.netProfit)}
                </p>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5 print-avoid-break">
              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Customer Paid</p>
                <p className="mt-2 text-2xl font-bold text-green-700">{money(stats.paid)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Customer Balance</p>
                <p className="mt-2 text-2xl font-bold text-red-700">{money(stats.customerBalance)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Supplier Balance</p>
                <p className="mt-2 text-2xl font-bold text-red-700">{money(stats.supplierBalance)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">GST Collected</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{money(stats.gstCollected)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">GST on Expenses</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{money(stats.shopExpenseGst)}</p>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5 print-avoid-break">
              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Parts Sales</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{money(stats.partsSales)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Parts Profit</p>
                <p className="mt-2 text-2xl font-bold text-green-700">{money(stats.partsProfit)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Labour Revenue</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{money(stats.labourRevenue)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Consumables Expense</p>
                <p className="mt-2 text-2xl font-bold text-red-700">{money(stats.consumableExpenses)}</p>
              </div>

              <div className="print-card rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Net Margin</p>
                <p className={`mt-2 text-2xl font-bold ${stats.netMargin >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {stats.netMargin.toFixed(2)}%
                </p>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-red-600">Expense Breakdown</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Shop Expenses by Category</h2>
                </div>

                <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Count</th>
                        <th className="px-4 py-3">GST</th>
                        <th className="px-4 py-3">Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {expensesByCategory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                            No shop expenses in this filter range.
                          </td>
                        </tr>
                      ) : (
                        expensesByCategory.map((expense) => (
                          <tr key={expense.category} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">{expense.category}</td>
                            <td className="px-4 py-3">{expense.count}</td>
                            <td className="px-4 py-3">{money(expense.gst)}</td>
                            <td className="px-4 py-3 font-semibold text-red-700">{money(expense.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-red-600">Best-selling Parts</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Parts Performance</h2>
                </div>

                <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3">Part</th>
                        <th className="px-4 py-3">Qty Sold</th>
                        <th className="px-4 py-3">Sales</th>
                        <th className="px-4 py-3">Profit</th>
                      </tr>
                    </thead>

                    <tbody>
                      {bestSellingParts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                            No parts sold in this filter range.
                          </td>
                        </tr>
                      ) : (
                        bestSellingParts.map((part) => (
                          <tr key={part.name} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">{part.name}</td>
                            <td className="px-4 py-3">{part.qty}</td>
                            <td className="px-4 py-3">{money(part.sales)}</td>
                            <td className="px-4 py-3 font-semibold text-green-700">{money(part.profit)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-red-600">Recent Expenses</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Filtered Shop Expenses</h2>
                </div>

                <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredShopExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                            No matching shop expenses.
                          </td>
                        </tr>
                      ) : (
                        filteredShopExpenses.slice(0, 12).map((expense) => (
                          <tr key={expense.id} className="border-t border-slate-200">
                            <td className="px-4 py-3">{formatDate(expense.expense_date)}</td>
                            <td className="px-4 py-3">{expense.expense_category}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {expense.description}
                              {expense.reference && (
                                <div className="text-xs font-normal text-slate-500">Ref: {expense.reference}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">{expense.suppliers?.supplier_name || "-"}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(expense.payment_status)}`}>
                                {expense.payment_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-red-700">{money(Number(expense.total_amount || 0))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="print-card rounded-2xl bg-white p-6 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-red-600">Stock Warning</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Low Stock Parts</h2>
                </div>

                <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3">Part</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Reorder</th>
                        <th className="px-4 py-3">Location</th>
                      </tr>
                    </thead>

                    <tbody>
                      {lowStockParts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            No low stock parts.
                          </td>
                        </tr>
                      ) : (
                        lowStockParts.map((part) => (
                          <tr key={part.id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {part.part_name}
                              <div className="text-xs font-normal text-slate-500">{part.part_number || ""}</div>
                            </td>
                            <td className="px-4 py-3">{part.supplier || "-"}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                                {part.quantity_in_stock || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3">{part.reorder_level || 0}</td>
                            <td className="px-4 py-3">{part.location || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
