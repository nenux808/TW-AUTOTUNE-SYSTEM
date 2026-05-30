"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type SearchResult = {
  id: string;
  type: "customer" | "vehicle" | "job" | "invoice";
  title: string;
  subtitle: string;
  href: string;
  actionHref?: string;
  actionLabel?: string;
};

function typeBadge(type: SearchResult["type"]) {
  if (type === "customer") return "Customer";
  if (type === "vehicle") return "Vehicle";
  if (type === "job") return "Job";
  return "Invoice";
}

function typeClass(type: SearchResult["type"]) {
  if (type === "customer") return "bg-blue-100 text-blue-700";
  if (type === "vehicle") return "bg-purple-100 text-purple-700";
  if (type === "job") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

function safeText(value: any) {
  return String(value || "").toLowerCase();
}

function formatJobNumber(value: any) {
  if (!value) return "JOB";
  const text = String(value);
  if (text.toUpperCase().startsWith("JOB-")) return text;
  return `JOB-${text.padStart(5, "0")}`;
}

function formatInvoiceNumber(value: any) {
  if (!value) return "INV";
  const text = String(value);
  if (text.toUpperCase().startsWith("INV-")) return text;
  return `INV-${text.padStart(5, "0")}`;
}

export default function GlobalSearch() {
  const supabase = createClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  async function runSearch(value: string) {
    const searchText = value.trim();
    const lower = searchText.toLowerCase();

    setQuery(value);
    setMessage("");

    if (searchText.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    const pattern = `%${searchText}%`;

    const [customersRes, vehiclesRes, jobsRes, invoicesRes] = await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .or(`full_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
        .limit(8),

      supabase
        .from("vehicles")
        .select("id, registration, make, model, vin, customer_id")
        .or(`registration.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern},vin.ilike.${pattern}`)
        .limit(8),

      supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const nextResults: SearchResult[] = [];

    if (customersRes.data) {
      customersRes.data.forEach((customer: any) => {
        nextResults.push({
          id: customer.id,
          type: "customer",
          title: customer.full_name || "Unnamed customer",
          subtitle: `${customer.phone || "No phone"} ${customer.email ? `| ${customer.email}` : ""}`,
          href: `/customers?customer_id=${customer.id}`,
        });
      });
    }

    if (vehiclesRes.data) {
      vehiclesRes.data.forEach((vehicle: any) => {
        nextResults.push({
          id: vehicle.id,
          type: "vehicle",
          title: vehicle.registration || "No rego",
          subtitle: `${vehicle.make || ""} ${vehicle.model || ""} ${vehicle.vin ? `| VIN ${vehicle.vin}` : ""}`,
          href: `/vehicles?vehicle_id=${vehicle.id}`,
          actionHref: `/jobs?customer_id=${vehicle.customer_id || ""}&vehicle_id=${vehicle.id}`,
          actionLabel: "Create Job",
        });
      });
    }

    if (jobsRes.data) {
      jobsRes.data
        .filter((job: any) => {
          const combined = [
            formatJobNumber(job.job_number),
            job.job_number,
            job.job_type,
            job.job_status || job.status || job.job_state || job.safety_status,
          ]
            .map(safeText)
            .join(" ");

          return lower === "job" || combined.includes(lower);
        })
        .slice(0, 8)
        .forEach((job: any) => {
          nextResults.push({
            id: job.id,
            type: "job",
            title: formatJobNumber(job.job_number),
            subtitle: `${job.job_type || "Job"} | ${job.job_status || job.status || job.job_state || "No status"}`,
            href: `/jobs/${job.id}`,
          });
        });
    }

    if (invoicesRes.data) {
      invoicesRes.data
        .filter((invoice: any) => {
          const combined = [
            formatInvoiceNumber(invoice.invoice_number),
            invoice.invoice_number,
            invoice.invoice_status || invoice.status || invoice.payment_status,
          ]
            .map(safeText)
            .join(" ");

          return lower === "inv" || lower === "invoice" || combined.includes(lower);
        })
        .slice(0, 8)
        .forEach((invoice: any) => {
          nextResults.push({
            id: invoice.id,
            type: "invoice",
            title: formatInvoiceNumber(invoice.invoice_number),
            subtitle: `${invoice.invoice_status || invoice.status || invoice.payment_status || "No status"} | Balance $${Number(invoice.balance_due || 0).toFixed(2)}`,
            href: `/invoices/${invoice.id}`,
          });
        });
    }

    const errors = [
      customersRes.error ? `Customers: ${customersRes.error.message}` : "",
      vehiclesRes.error ? `Vehicles: ${vehiclesRes.error.message}` : "",
      jobsRes.error ? `Jobs: ${jobsRes.error.message}` : "",
      invoicesRes.error ? `Invoices: ${invoicesRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      console.warn("Global search warnings:", errors);
      setMessage(errors.join(" | "));
    }

    setResults(nextResults);
    setLoading(false);
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-red-600">Quick Search</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Find customer, vehicle, job or invoice
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Search by rego, phone, name, VIN, job number or invoice number.
          </p>
        </div>

        <div className="w-full lg:max-w-xl">
          <input
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold uppercase outline-none focus:border-red-500"
            placeholder="Search rego, phone, name..."
          />
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      {trimmedQuery.length >= 2 && (
        <div className="mt-5">
          {loading ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Searching...
            </p>
          ) : results.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              <p>No results found.</p>
              <Link
                href="/customers"
                className="mt-3 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Add new customer
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {results.map((result) => (
                <Link
                  key={`${result.type}-${result.id}`}
                  href={result.href}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeClass(result.type)}`}>
                        {typeBadge(result.type)}
                      </span>

                      <p className="font-bold text-slate-900">
                        {result.title}
                      </p>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {result.subtitle}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {result.actionHref && (
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = result.actionHref || result.href;
                        }}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        {result.actionLabel || "Action"} →
                      </span>
                    )}

                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-slate-200">
                      Open →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}



