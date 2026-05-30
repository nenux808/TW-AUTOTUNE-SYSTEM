"use client";

import Link from "next/link";
import type { Job } from "@/types/job";

type Props = {
  jobs: Job[];
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function JobList({ jobs }: Props) {
  return (
    <div className="w-full min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-red-600">Repair Orders</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Jobs</h2>
        </div>

        <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {jobs.length} total
        </div>
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
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  No jobs yet. Create the first repair order from the form.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
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

