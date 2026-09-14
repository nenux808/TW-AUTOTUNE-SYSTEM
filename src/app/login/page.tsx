"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NenuxCredit from "@/components/branding/NenuxCredit";
import TwAutoTuneLogo from "@/components/branding/TwAutoTuneLogo";

function timeout(ms: number) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timed out. Please check Supabase connection and try again.")), ms);
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/20 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[320px] w-[320px] rounded-full bg-red-500/10 blur-3xl" />
      </div>

      {accessGranted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-6 backdrop-blur-md">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-500/30 bg-slate-950 p-8 text-center text-white shadow-[0_0_80px_rgba(220,38,38,0.35)]">
            <div className="absolute inset-x-0 top-0 h-1 animate-pulse bg-red-600" />
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 shadow-[0_0_45px_rgba(239,68,68,0.35)]">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.45em] text-red-400">
              Access Granted
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Opening Workshop System
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Verifying secure session and loading dashboard...
            </p>
            <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full origin-left animate-[loginLoad_1.35s_ease-in-out_forwards] rounded-full bg-red-500" />
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
          0% {
            transform: scaleX(0.05);
          }
          55% {
            transform: scaleX(0.72);
          }
          100% {
            transform: scaleX(1);
          }
        }
      `}</style>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl">
        <div className="text-center">
          <TwAutoTuneLogo className="mx-auto max-w-[260px]" imageClassName="rounded-xl shadow-sm" />
          <h1 className="mt-5 text-3xl font-bold text-slate-900">
            Staff Login
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to access jobs, invoices, inventory and owner reports.
          </p>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <form onSubmit={login} className="mt-6 grid gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 disabled:bg-slate-100"
              placeholder="owner@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 disabled:bg-slate-100"
              placeholder="Password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative mt-2 overflow-hidden rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-80"
          >
            <span className="absolute inset-y-0 -left-1/2 hidden w-1/2 skew-x-[-20deg] bg-white/20 blur-sm transition-all duration-700 group-hover:left-full sm:block" />
            <span className="relative flex items-center justify-center gap-2">
              {loading && !accessGranted && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {accessGranted ? "Access Granted" : loading ? "Verifying..." : "Login"}
            </span>
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-medium text-slate-400">
          TW AUTO TUNE Management System
        </p>

        <NenuxCredit />
      </div>
    </main>
  );
}
