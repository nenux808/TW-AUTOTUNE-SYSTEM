"use client";

import GlobalSearch from "@/components/search/GlobalSearch";
import ServiceReminderWidget from "@/components/reminders/ServiceReminderWidget";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  job_number: number;
  job_type: string;
  status: string;
  priority: string | null;
  created_at: string;
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

type Invoice = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  total_cost: number | null;
  customers: {
    full_name: string;
  } | null;
  vehicles: {
    registration: string;
  } | null;
};

type PurchaseInvoice = {
  id: string;
  supplier_invoice_number: string;
  purchase_date: string;
  payment_status: string;
  total_amount: number;
  amount_paid: number | null;
  balance_due: number | null;
  suppliers: {
    supplier_name: string;
  } | null;
};

type ShopExpense = {
  id: string;
  expense_date: string;
  expense_category: string;
  description: string;
  amount: number;
  gst_amount: number;
  total_amount: number;
  payment_status: string;
};

type Part = {
  id: string;
  part_name: string;
  part_number: string | null;
  supplier: string | null;
  quantity_in_stock: number | null;
  reorder_level: number | null;
  item_type: string | null;
  track_stock: boolean | null;
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

function formatJobNumber(value?: number) {
  return "JOB-" + String(value || 0).padStart(5, "0");
}

function formatInvoiceNumber(value?: number) {
  return "INV-" + String(value || 0).padStart(5, "0");
}

function statusBadge(status?: string | null) {
  switch (status) {
    case "paid":
    case "completed":
      return "bg-green-100 text-green-700";
    case "partial":
    case "preparing":
    case "in_progress":
      return "bg-yellow-100 text-yellow-700";
    case "unpaid":
    case "overdue":
    case "urgent":
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "sent":
      return "bg-blue-100 text-blue-700";
    case "draft":
    case "new":
    case "open":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function cleanStatus(status?: string | null) {
  if (!status) return "-";
  return status.replaceAll("_", " ");
}

export default function DashboardPage() {
  const { isOwner } = useCurrentRole();
  const supabase = createClient();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [expenses, setExpenses] = useState<ShopExpense[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  const today = todayDate();
  const monthStart = monthStartDate();

  const stats = useMemo(() => {
    const todayJobs = jobs.filter((job) => {
      return job.created_at?.startsWith(today);
    }).length;

    const openJobs = jobs.filter((job) => {
      const status = job.status || "open";
      return !["completed", "cancelled", "closed"].includes(status);
    }).length;

    const urgentJobs = jobs.filter((job) => {
      return job.priority === "urgent" || job.priority === "high";
    }).length;

    const monthInvoices = invoices.filter((invoice) => {
      return invoice.invoice_date >= monthStart && invoice.invoice_date <= today;
    });

    const monthlyRevenue = monthInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount || 0),
      0
    );

    const monthlyPaid = monthInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount_paid || 0),
      0
    );

    const customerBalance = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.balance_due || 0),
      0
    );

    const unpaidInvoices = invoices.filter((invoice) => {
      return Number(invoice.balance_due || 0) > 0 || ["unpaid", "partial", "overdue"].includes(invoice.status);
    }).length;

    const supplierBalance = purchaseInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.balance_due ?? invoice.total_amount ?? 0),
      0
    );

    const monthExpenses = expenses.filter((expense) => {
      return expense.expense_date >= monthStart && expense.expense_date <= today;
    });

    const monthlyExpenses = monthExpenses.reduce(
      (sum, expense) => sum + Number(expense.total_amount || 0),
      0
    );

    const monthlyPartCost = monthInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_cost || 0),
      0
    );

    const monthlyNetProfit = monthlyRevenue - monthlyPartCost - monthlyExpenses;

    const lowStockCount = parts.filter((part) => {
      if (part.track_stock === false) return false;
      const qty = Number(part.quantity_in_stock || 0);
      const reorder = Number(part.reorder_level || 0);
      return reorder > 0 && qty <= reorder;
    }).length;

    return {
      todayJobs,
      openJobs,
      urgentJobs,
      monthlyRevenue,
      monthlyPaid,
      customerBalance,
      unpaidInvoices,
      supplierBalance,
      monthlyExpenses,
      monthlyNetProfit,
      lowStockCount,
    };
  }, [jobs, invoices, purchaseInvoices, expenses, parts, today, monthStart]);

  const recentJobs = useMemo(() => jobs.slice(0, 6), [jobs]);
  const recentInvoices = useMemo(() => invoices.slice(0, 6), [invoices]);

  const lowStockParts = useMemo(() => {
    return parts
      .filter((part) => {
        if (part.track_stock === false) return false;
        const qty = Number(part.quantity_in_stock || 0);
        const reorder = Number(part.reorder_level || 0);
        return reorder > 0 && qty <= reorder;
      })
      .slice(0, 6);
  }, [parts]);


  async function loadCurrentRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setCurrentRole(data?.role || null);
  }
  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    const jobRes = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        job_type,
        status,
        priority,
        created_at,
        customers(full_name, phone),
        vehicles(registration, make, model)
      `)
      .order("created_at", { ascending: false })
      .limit(30);

    const invoiceRes = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_date,
        status,
        total_amount,
        amount_paid,
        balance_due,
        total_cost,
        customers(full_name),
        vehicles(registration)
      `)
      .order("invoice_date", { ascending: false })
      .limit(50);

    const purchaseRes = await supabase
      .from("purchase_invoices")
      .select(`
        id,
        supplier_invoice_number,
        purchase_date,
        payment_status,
        total_amount,
        amount_paid,
        balance_due,
        suppliers(supplier_name)
      `)
      .order("purchase_date", { ascending: false })
      .limit(50);

    const expenseRes = await supabase
      .from("shop_expenses")
      .select("id, expense_date, expense_category, description, amount, gst_amount, total_amount, payment_status")
      .order("expense_date", { ascending: false })
      .limit(80);

    const partsRes = await supabase
      .from("parts")
      .select("id, part_name, part_number, supplier, quantity_in_stock, reorder_level, item_type, track_stock")
      .eq("active", true)
      .order("part_name", { ascending: true });

    const errors = [
      jobRes.error ? `Jobs: ${jobRes.error.message}` : "",
      invoiceRes.error ? `Invoices: ${invoiceRes.error.message}` : "",
      purchaseRes.error ? `Supplier invoices: ${purchaseRes.error.message}` : "",
      expenseRes.error ? `Expenses: ${expenseRes.error.message}` : "",
      partsRes.error ? `Inventory: ${partsRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setJobs((jobRes.data || []) as Job[]);
    setInvoices((invoiceRes.data || []) as Invoice[]);
    setPurchaseInvoices((purchaseRes.data || []) as PurchaseInvoice[]);
    setExpenses((expenseRes.data || []) as ShopExpense[]);
    setParts((partsRes.data || []) as Part[]);
    setLoading(false);
  }

  useEffect(() => {
    loadCurrentRole();
    loadDashboard();
  }, []);

  const navigationCards = [
    {
      title: "Customers",
      description: "Add and manage customer records.",
      href: "/customers",
    },
    {
      title: "Vehicles",
      description: "Manage customer vehicles and registrations.",
      href: "/vehicles",
    },
    {
      title: "Jobs",
      description: "Create job cards, service jobs and repair orders.",
      href: "/jobs",
    },
    {
      title: "Invoices",
      description: "Customer invoices, payments and owner copies.",
      href: "/invoices",
    },
    {
      title: "Inventory",
      description: "Parts, consumables, tools and stock control.",
      href: "/inventory",
    },
    {
      title: "Bought Invoices",
      description: "Supplier purchases, stock updates and supplier payments.",
      href: "/inventory/purchases",
    },
    {
      title: "Expenses",
      description: "Rent, utilities, consumables and operating costs.",
      href: "/expenses",
    },
    {
      title: "Owner Reports",
      description: "Revenue, expenses, balances and net profit.",
      href: "/owner/reports",
    },
    {
      title: "Packages",
      description: "Configure service packages and promotions.",
      href: "/packages",
    },
    {
      title: "Workshop Settings",
      description: "Business details, bank details, ABN and invoice footer.",
      href: "/settings",
    },
  ];

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-red-300">TW AUTO TUNE</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Management Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Live overview of jobs, invoices, inventory, expenses and profit.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Refresh
            </button>

            <LogoutButton />

            <Link
              href="/jobs"
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              New Job
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <GlobalSearch />
        </div>

        <div className="mb-6">
          <ServiceReminderWidget />
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">Loading dashboard...</div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
                <p className="text-sm text-red-300">Today’s Jobs</p>
                <p className="mt-2 text-3xl font-bold">{stats.todayJobs}</p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Open Jobs</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.openJobs}</p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Unpaid Invoices</p>
                <p className="mt-2 text-3xl font-bold text-red-700">{stats.unpaidInvoices}</p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Low Stock</p>
                <p className="mt-2 text-3xl font-bold text-red-700">{stats.lowStockCount}</p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Urgent / High Jobs</p>
                <p className="mt-2 text-3xl font-bold text-orange-700">{stats.urgentJobs}</p>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Monthly Revenue</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {money(stats.monthlyRevenue)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Monthly Paid</p>
                <p className="mt-2 text-2xl font-bold text-green-700">
                  {money(stats.monthlyPaid)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Customer Balance</p>
                <p className="mt-2 text-2xl font-bold text-red-700">
                  {money(stats.customerBalance)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Supplier Balance</p>
                <p className="mt-2 text-2xl font-bold text-red-700">
                  {money(stats.supplierBalance)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-600">Monthly Net Profit</p>
                <p
                  className={`mt-2 text-2xl font-bold ${
                    stats.monthlyNetProfit >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {money(stats.monthlyNetProfit)}
                </p>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-red-600">Recent Jobs</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">Latest Repair Orders</h2>
                  </div>

                  <Link
                    href="/jobs"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Jobs
                  </Link>
                </div>

                <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3">Job</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentJobs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            No recent jobs.
                          </td>
                        </tr>
                      ) : (
                        recentJobs.map((job) => (
                          <tr key={job.id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-bold text-slate-900">
                              <Link href={`/jobs/${job.id}`} className="hover:text-red-600">
                                {formatJobNumber(job.job_number)}
                              </Link>
                              <div className="text-xs font-normal text-slate-500">
                                {formatDate(job.created_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">
                                {job.customers?.full_name || "-"}
                              </div>
                              <div className="text-xs text-slate-500">
                                {job.customers?.phone || ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 uppercase">
                              {job.vehicles?.registration || "-"}
                              <div className="text-xs normal-case text-slate-500">
                                {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ")}
                              </div>
                            </td>
                            <td className="px-4 py-3 capitalize">{cleanStatus(job.job_type)}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadge(
                                  job.status
                                )}`}
                              >
                                {cleanStatus(job.status)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-red-600">Stock Alerts</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">Low Stock Items</h2>
                  </div>

                  <Link
                    href="/inventory"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Inventory
                  </Link>
                </div>

                <div className="mt-6 grid gap-3">
                  {lowStockParts.length === 0 ? (
                    <p className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">
                      No low stock items right now.
                    </p>
                  ) : (
                    lowStockParts.map((part) => (
                      <div key={part.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-bold text-slate-900">{part.part_name}</p>
                            <p className="text-xs text-slate-500">
                              {part.part_number || "No SKU"} | {part.supplier || "No supplier"}
                            </p>
                          </div>

                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                            {part.quantity_in_stock || 0}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          Reorder level: {part.reorder_level || 0}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-red-600">Recent Invoices</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">Latest Customer Invoices</h2>
                  </div>

                  <Link
                    href="/invoices"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Invoices
                  </Link>
                </div>

                <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Balance</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            No recent invoices.
                          </td>
                        </tr>
                      ) : (
                        recentInvoices.map((invoice) => (
                          <tr key={invoice.id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-bold text-slate-900">
                              <Link href={`/invoices/${invoice.id}`} className="hover:text-red-600">
                                {formatInvoiceNumber(invoice.invoice_number)}
                              </Link>
                              <div className="text-xs font-normal text-slate-500">
                                {formatDate(invoice.invoice_date)}
                              </div>
                            </td>
                            <td className="px-4 py-3">{invoice.customers?.full_name || "-"}</td>
                            <td className="px-4 py-3 uppercase">{invoice.vehicles?.registration || "-"}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadge(
                                  invoice.status
                                )}`}
                              >
                                {cleanStatus(invoice.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-red-700">
                              {money(Number(invoice.balance_due || 0))}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-red-600">Quick Actions</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Navigation</h2>
                </div>

                <div className="mt-6 grid gap-3">
                  {navigationCards.map((card) => (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="rounded-xl border border-slate-200 p-4 hover:border-red-200 hover:bg-red-50"
                    >
                      <p className="font-bold text-slate-900">{card.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}












