"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NenuxCredit from "@/components/branding/NenuxCredit";

function timeout(ms: number) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timed out. Please check Supabase connection and try again.")), ms);
  });
}

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

      window.location.href = "/dashboard";
    } catch (error: any) {
      setMessage(error?.message || "Login failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="text-center">
          <p className="text-sm font-semibold text-red-600">TW AUTO TUNE</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
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
            className="mt-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          TW AUTO TUNE Management System
        </p>

        <NenuxCredit />
      </div>
    </main>
  );
}
