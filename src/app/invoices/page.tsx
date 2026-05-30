"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
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
  total_cost: number | null;
  total_profit: number | null;
  profit_margin: number | null;
  owner_copy_code: string | null;
  customers: {
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  vehicles: {
    registration: string;
    make: string | null;
    model: string | null;
  } | null;
  jobs: {
    job_number: number;
    job_type: string;
  } | null;
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

function badgeClass(status: string) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "sent":
      return "bg-blue-100 text-blue-700";
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "overdue":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function InvoicesPage() {
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchesStatus =
        statusFilter === "all" || invoice.status === statusFilter;

      const searchable = [
        formatInvoiceNumber(invoice.invoice_number),
        invoice.customers?.full_name,
        invoice.customers?.phone,
        invoice.vehicles?.registration,
        invoice.vehicles?.make,
        invoice.vehicles?.model,
        invoice.jobs?.job_number ? formatJobNumber(invoice.jobs.job_number) : "",
        invoice.status,
        invoice.invoice_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount || 0),
      0
    );

    const totalPaid = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount_paid || 0),
      0
    );

    const totalBalance = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.balance_due || 0),
      0
    );

    const totalProfit = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_profit || 0),
      0
    );

    return {
      count: filteredInvoices.length,
      totalRevenue,
      totalPaid,
      totalBalance,
      totalProfit,
    };
  }, [filteredInvoices]);

  async function loadInvoices() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        customers(full_name, phone, email),
        vehicles(registration, make, model),
        jobs(job_number, job_type)
      `)
      .order("invoice_date", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setInvoices((data || []) as Invoice[]);
    setLoading(false);
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Invoices
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Search customer invoices, balances, profit snapshots and owner copy records.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/jobs"
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Create from Job
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm text-red-300">Invoices</p>
            <p className="mt-2 text-3xl font-bold">{stats.count}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Revenue</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {money(stats.totalRevenue)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Paid</p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              {money(stats.totalPaid)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Balance</p>
            <p className="mt-2 text-2xl font-bold text-red-700">
              {money(stats.totalBalance)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Profit Snapshot</p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              {money(stats.totalProfit)}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Invoice Records</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Customer Invoices
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Search invoice, customer, rego, job..."
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Profit</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                      Loading invoices...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {formatInvoiceNumber(invoice.invoice_number)}
                        {invoice.owner_copy_code && (
                          <div className="text-xs font-normal text-slate-500">
                            {invoice.owner_copy_code}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {invoice.jobs?.job_number
                          ? formatJobNumber(invoice.jobs.job_number)
                          : "-"}
                        <div className="text-xs capitalize text-slate-500">
                          {invoice.jobs?.job_type || ""}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium">
                          {invoice.customers?.full_name || "-"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {invoice.customers?.phone || ""}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-semibold uppercase">
                          {invoice.vehicles?.registration || "-"}
                        </span>
                        <div className="text-xs text-slate-500">
                          {[invoice.vehicles?.make, invoice.vehicles?.model]
                            .filter(Boolean)
                            .join(" ")}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(invoice.invoice_date)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass(
                            invoice.status
                          )}`}
                        >
                          {invoice.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {money(Number(invoice.total_amount || 0))}
                      </td>

                      <td className="px-4 py-3 font-semibold text-green-700">
                        {money(Number(invoice.amount_paid || 0))}
                      </td>

                      <td className="px-4 py-3 font-semibold text-red-700">
                        {money(Number(invoice.balance_due || 0))}
                      </td>

                      <td className="px-4 py-3 font-semibold text-green-700">
                        {money(Number(invoice.total_profit || 0))}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                          >
                            View
                          </Link>

                          <Link
                            href={`/invoices/${invoice.id}/owner`}
                            className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                          >
                            Owner Copy
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
