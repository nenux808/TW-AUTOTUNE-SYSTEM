"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NenuxCredit from "@/components/branding/NenuxCredit";
import TwAutoTuneLogo from "@/components/branding/TwAutoTuneLogo";

function timeout(ms: number) {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error("Request timed out. Please check Supabase connection and try again.")),
      ms
    );
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);

  useEffect(() => {
    async function checkAlreadyLoggedIn() {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        window.location.href = "/dashboard";
      }
    }

    checkAlreadyLoggedIn();
  }, [supabase]);

  async function login(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      const result: any = await Promise.race([
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        timeout(10000),
      ]);

      if (result?.error) {
        setMessage(result.error.message);
        setLoading(false);
        return;
      }

      setAccessGranted(true);
      await wait(1450);
      window.location.href = "/dashboard";
    } catch (error: any) {
      setMessage(error?.message || "Login failed. Please try again.");
      setAccessGranted(false);
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.25),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.16),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:linear-gradient(rgba(255,255,255,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.13)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute left-[-90px] top-28 h-72 w-72 rounded-full border border-red-500/20 shadow-[0_0_80px_rgba(220,38,38,0.15)]" />
      <div className="pointer-events-none absolute bottom-12 right-[-120px] h-96 w-96 rounded-full border border-red-500/10 shadow-[0_0_120px_rgba(220,38,38,0.12)]" />

      {accessGranted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-6 backdrop-blur-xl">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-500/30 bg-slate-950 p-8 text-center text-white shadow-[0_0_80px_rgba(220,38,38,0.35)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 shadow-[0_0_45px_rgba(239,68,68,0.35)]">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
              <div className="absolute h-9 w-9 rounded-full bg-red-500/20" />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.45em] text-red-400">
              Access Granted
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Opening Workshop System
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Staff session verified. Loading protected dashboard workspace...
            </p>
            <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full origin-left animate-[loginLoad_1.35s_ease-in-out_forwards] rounded-full bg-gradient-to-r from-red-700 via-red-500 to-white" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span>Auth</span>
              <span>Secure</span>
              <span>Launch</span>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes loginLoad {
          0% { transform: scaleX(0.05); }
          55% { transform: scaleX(0.72); }
          100% { transform: scaleX(1); }
        }
      `}</style>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_440px]">
        <section className="hidden lg:block">
          <p className="text-sm font-bold uppercase tracking-[0.45em] text-red-400">
            Secure Staff Portal
          </p>
          <h1 className="mt-5 max-w-2xl text-5xl font-black leading-tight tracking-tight">
            Protected workshop operations, built for speed and control.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Manage jobs, invoices, customer records, inventory, reports and reminders from one secured dashboard.
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xl font-black text-white">RBAC</p>
              <p className="mt-1 text-xs text-slate-400">Role-based access</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xl font-black text-white">RLS</p>
              <p className="mt-1 text-xs text-slate-400">Database protection</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xl font-black text-white">SSL</p>
              <p className="mt-1 text-xs text-slate-400">Encrypted access</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-[2rem] border border-white/15 bg-white/[0.98] p-8 text-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="text-center">
            <TwAutoTuneLogo className="mx-auto max-w-[270px]" imageClassName="rounded-2xl shadow-sm" />
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" /> Secure staff access
            </div>
            <h2 className="mt-5 text-3xl font-black text-slate-950">Staff Login</h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter authorised credentials to open the workshop system.
            </p>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {message}
            </div>
          )}

          <form onSubmit={login} className="mt-6 grid gap-4">
            <div>
              <label className="text-sm font-bold text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
                placeholder="owner@example.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
                placeholder="Password"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative mt-2 overflow-hidden rounded-2xl bg-red-600 px-5 py-3 font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-80"
            >
              <span className="absolute inset-y-0 -left-1/2 hidden w-1/2 skew-x-[-20deg] bg-white/20 blur-sm transition-all duration-700 group-hover:left-full sm:block" />
              <span className="relative flex items-center justify-center gap-2">
                {loading && !accessGranted && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {accessGranted ? "Access Granted" : loading ? "Verifying access..." : "Login Securely"}
              </span>
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-bold text-slate-700">Security notice</p>
            <p className="mt-1">
              Authorised staff only. Protected pages require a valid authenticated session.
            </p>
          </div>

          <p className="mt-6 text-center text-xs font-medium text-slate-400">
            TW AUTO TUNE Management System
          </p>

          <NenuxCredit />
        </section>
      </div>
    </main>
  );
}
