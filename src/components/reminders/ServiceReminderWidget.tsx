"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ReminderJob = {
  id: string;
  job_number: number | null;
  customer_id: string | null;
  vehicle_id: string | null;
  next_service_due_date: string | null;
  next_service_odometer: number | null;
  customers: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  vehicles: {
    registration: string | null;
    make: string | null;
    model: string | null;
  } | null;
};

type EmailLog = {
  id: string;
  email_type: string;
  job_id: string | null;
  recipient_email: string;
  status: string;
  scheduled_for: string | null;
};

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatJobNumber(value: number | null) {
  if (!value) return "JOB";
  return `JOB-${String(value).padStart(5, "0")}`;
}

function reminderTypeForDate(date: string | null) {
  if (!date) return "";

  if (date === addDays(3)) return "service_reminder_3_days";
  if (date === addDays(1)) return "service_reminder_1_day";

  return "";
}

function dueLabel(date: string | null) {
  if (!date) return "No date";

  if (date === addDays(3)) return "Due in 3 days";
  if (date === addDays(1)) return "Due tomorrow";

  return "Upcoming";
}

export default function ServiceReminderWidget() {
  const supabase = createClient();

  const [jobs, setJobs] = useState<ReminderJob[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const targetDates = useMemo(() => [addDays(1), addDays(3)], []);

  async function loadReminders() {
    setLoading(true);
    setMessage("");

    const [jobsRes, logsRes] = await Promise.all([
      supabase
        .from("jobs")
        .select(`
          id,
          job_number,
          customer_id,
          vehicle_id,
          next_service_due_date,
          next_service_odometer,
          customers(full_name, email, phone),
          vehicles(registration, make, model)
        `)
        .in("next_service_due_date", targetDates)
        .order("next_service_due_date", { ascending: true }),

      supabase
        .from("email_logs")
        .select("id, email_type, job_id, recipient_email, status, scheduled_for")
        .in("email_type", ["service_reminder_1_day", "service_reminder_3_days"])
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (jobsRes.error) {
      setMessage(jobsRes.error.message);
    } else {
      setJobs((jobsRes.data || []) as ReminderJob[]);
    }

    if (!logsRes.error) {
      setLogs((logsRes.data || []) as EmailLog[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadReminders();
  }, []);

  function reminderStatus(job: ReminderJob) {
    const type = reminderTypeForDate(job.next_service_due_date);

    if (!job.customers?.email) {
      return {
        label: "Missing email",
        className: "bg-red-100 text-red-700",
      };
    }

    const log = logs.find(
      (item) =>
        item.job_id === job.id &&
        item.email_type === type &&
        item.recipient_email === job.customers?.email
    );

    if (log?.status === "sent") {
      return {
        label: "Sent",
        className: "bg-green-100 text-green-700",
      };
    }

    if (log?.status === "failed") {
      return {
        label: "Failed",
        className: "bg-red-100 text-red-700",
      };
    }

    return {
      label: "Pending",
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  const summary = useMemo(() => {
    return {
      dueTomorrow: jobs.filter((job) => job.next_service_due_date === addDays(1)).length,
      dueInThreeDays: jobs.filter((job) => job.next_service_due_date === addDays(3)).length,
      missingEmail: jobs.filter((job) => !job.customers?.email).length,
    };
  }, [jobs]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-red-600">Service Reminders</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Upcoming reminder emails
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Shows vehicles due tomorrow or in 3 days, plus reminder email status.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadReminders}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Refresh
          </button>

          <Link
            href="/email-logs"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Email Logs
          </Link>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Tomorrow</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.dueTomorrow}</p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">In 3 days</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.dueInThreeDays}</p>
        </div>

        <div className="rounded-xl bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase text-red-500">Missing email</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{summary.missingEmail}</p>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Loading reminders...
          </p>
        ) : jobs.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No service reminders due tomorrow or in 3 days.
          </p>
        ) : (
          <div className="grid gap-3">
            {jobs.map((job) => {
              const status = reminderStatus(job);
              const vehicleText = `${job.vehicles?.registration || "No rego"} ${
                job.vehicles?.make || ""
              } ${job.vehicles?.model || ""}`.trim();

              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
                          {dueLabel(job.next_service_due_date)}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-900">
                        {vehicleText}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {job.customers?.full_name || "No customer"} |{" "}
                        {job.customers?.email || "No email"} | Due{" "}
                        {formatDate(job.next_service_due_date)}
                      </p>

                      {job.next_service_odometer && (
                        <p className="mt-1 text-xs text-slate-500">
                          Due odometer: {job.next_service_odometer} km
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-lg bg-yellow-100 px-3 py-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-200"
                      >
                        Job
                      </Link>

                      {job.customer_id && (
                        <Link
                          href={`/customers?customer_id=${job.customer_id}`}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Customer
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
