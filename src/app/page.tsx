import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          TW AUTO TUNE Management System
        </div>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
          Mechanic shop management, invoicing, inspections and service history.
        </h1>

        <p className="mt-6 max-w-2xl text-slate-300">
          Built for TW AUTO TUNE to manage customers, vehicles, job cards,
          inspection checklists, diagnostic codes, invoices and payments.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
          >
            Open Dashboard
          </Link>

          <Link
            href="/login"
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-white hover:bg-slate-900"
          >
            Staff Login
          </Link>
        </div>
      </section>
    </main>
  );
}
