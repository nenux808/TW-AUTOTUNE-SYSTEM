"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Job } from "@/types/job";

type Props = {
  jobs: Job[];
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function normaliseSearchText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function jobSearchText(job: Job) {
  return [
    `job${String(job.job_number || "").padStart(5, "0")}`,
    String(job.job_number || ""),
    job.job_type,
    job.status,
    job.safety_status,
    job.customers?.full_name,
    job.customers?.phone,
    job.vehicles?.registration,
    job.vehicles?.make,
    job.vehicles?.model,
    job.vehicles?.year,
    job.odometer,
  ]
    .map(normaliseSearchText)
    .join(" ");
}

export default function JobList({ jobs }: Props) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredJobs = useMemo(() => {
    const query = normaliseSearchText(searchTerm);

    if (!query) {
      return jobs;
    }

    return jobs.filter((job) => jobSearchText(job).includes(query));
  }, [jobs, searchTerm]);

  return (
    <div className="w-full min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-red-600">Repair Orders</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Jobs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Search by customer name, phone, rego, vehicle or job number.
          </p>
        </div>

        <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {filteredJobs.length} of {jobs.length} total
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Find Job
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            placeholder="Type customer name, rego, phone or JOB-00028..."
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>

        {searchTerm && (
          <p className="mt-2 text-xs text-slate-500">
            Showing {filteredJobs.length} matching repair order{filteredJobs.length === 1 ? "" : "s"}.
          </p>
        )}
      </div>

      <div className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Job No.</th>
              <th className="whitespace-nowrap px-4 py-3">Type</th>
              <th className="whitespace-nowrap px-4 py-3">Customer</th>
              <th className="whitespace-nowrap px-4 py-3">Vehicle</th>
              <th className="whitespace-nowrap px-4 py-3">Odometer</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="whitespace-nowrap px-4 py-3">Safety</th>
              <th className="whitespace-nowrap px-4 py-3">Created</th>
              <th className="whitespace-nowrap px-4 py-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  {searchTerm
                    ? "No matching jobs found. Try customer name, phone, registration or job number."
                    : "No jobs yet. Create the first repair order from the form."}
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-200">
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">
                    JOB-{String(job.job_number).padStart(5, "0")}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold capitalize text-red-700">
                      {formatStatus(job.job_type || "service")}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <div className="font-medium">{job.customers?.full_name || "-"}</div>
                    <div className="text-xs text-slate-500">
                      {job.customers?.phone || ""}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <span className="font-semibold uppercase">
                      {job.vehicles?.registration || "-"}
                    </span>
                    <div className="text-xs text-slate-500">
                      {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ")}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {job.odometer ? `${job.odometer.toLocaleString()} km` : "-"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                      {formatStatus(job.status)}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {formatStatus(job.safety_status || "not_checked")}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                      >
                        View Job
                      </Link>
                      <Link
                        href={`/jobs/${job.id}/consumables`}
                        className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                      >
                        Consumables
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
