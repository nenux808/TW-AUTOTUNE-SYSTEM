"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type EmailLog = {
  id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
  job_id: string | null;
  invoice_id: string | null;
  subject: string;
  status: string;
  provider: string;
  provider_message_id: string | null;
  error_message: string | null;
  scheduled_for: string | null;
  created_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function cleanText(value: string | null | undefined) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "sent") return "bg-green-100 text-green-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
}

function typeClass(type: string) {
  if (type.includes("invoice")) return "bg-blue-100 text-blue-700";
  if (type.includes("service_reminder")) return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
}

export default function EmailLogsPage() {
  const supabase = createClient();

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      const matchesType = typeFilter === "all" || log.email_type === typeFilter;

      const searchable = [
        log.email_type,
        log.recipient_email,
        log.recipient_name,
        log.subject,
        log.status,
        log.error_message,
        log.provider_message_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [logs, search, statusFilter, typeFilter]);

  const summary = useMemo(() => {
    return {
      total: logs.length,
      sent: logs.filter((log) => log.status === "sent").length,
      failed: logs.filter((log) => log.status === "failed").length,
      invoice: logs.filter((log) => log.email_type === "invoice").length,
      reminders: logs.filter((log) => log.email_type.includes("service_reminder")).length,
    };
  }, [logs]);

  async function loadLogs() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("email_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setMessage(error.message);
    } else {
      setLogs((data || []) as EmailLog[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-3xl font-bold text-slate-900">Email Logs</h1>
            <p className="mt-1 text-slate-600">
              Track invoice emails, service reminders, delivery status and Resend errors.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadLogs}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Refresh
            </button>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Emails</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summary.total}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-green-600">Sent</p>
            <p className="mt-2 text-3xl font-bold text-green-700">{summary.sent}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Failed</p>
            <p className="mt-2 text-3xl font-bold text-red-700">{summary.failed}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-blue-600">Invoices</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">{summary.invoice}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-purple-600">Reminders</p>
            <p className="mt-2 text-3xl font-bold text-purple-700">{summary.reminders}</p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
              placeholder="Search recipient, subject, error..."
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            >
              <option value="all">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            >
              <option value="all">All types</option>
              <option value="invoice">Invoice</option>
              <option value="service_reminder_3_days">Service reminder - 3 days</option>
              <option value="service_reminder_1_day">Service reminder - 1 day</option>
            </select>
          </div>

          {loading ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Loading email logs...
            </p>
          ) : filteredLogs.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              No email logs found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Error / Provider</th>
                    <th className="px-4 py-3">Links</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-3 text-slate-700">
                        {formatDateTime(log.created_at)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${typeClass(
                            log.email_type
                          )}`}
                        >
                          {cleanText(log.email_type)}
                        </span>

                        {log.scheduled_for && (
                          <p className="mt-2 text-xs text-slate-500">
                            Scheduled for {log.scheduled_for}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {log.recipient_name || "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {log.recipient_email}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {log.subject}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(
                            log.status
                          )}`}
                        >
                          {cleanText(log.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {log.error_message ? (
                          <p className="max-w-sm rounded-xl bg-red-50 p-3 text-xs text-red-700">
                            {log.error_message}
                          </p>
                        ) : (
                          <div className="text-xs text-slate-500">
                            <p>Provider: {log.provider || "resend"}</p>
                            <p className="mt-1">
                              ID: {log.provider_message_id || "-"}
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {log.invoice_id && (
                            <Link
                              href={`/invoices/${log.invoice_id}`}
                              className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                            >
                              Invoice
                            </Link>
                          )}

                          {log.job_id && (
                            <Link
                              href={`/jobs/${log.job_id}`}
                              className="rounded-lg bg-yellow-100 px-3 py-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-200"
                            >
                              Job
                            </Link>
                          )}

                          {log.customer_id && (
                            <Link
                              href={`/customers?customer_id=${log.customer_id}`}
                              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              Customer
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
