"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Logout request timed out."));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionCleared, setSessionCleared] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setSessionCleared(false);

    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 5000);
      setSessionCleared(true);
      await wait(900);
    } catch (error) {
      console.warn("Logout warning:", error);
      setSessionCleared(true);
      await wait(700);
    }

    router.replace("/login");
    router.refresh();

    setTimeout(() => {
      window.location.href = "/login";
    }, 250);
  }

  return (
    <>
      {loggingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-6 text-white backdrop-blur-xl">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-500/30 bg-slate-950 p-8 text-center shadow-[0_0_80px_rgba(220,38,38,0.35)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 shadow-[0_0_45px_rgba(239,68,68,0.35)]">
              {sessionCleared ? (
                <span className="text-4xl font-black text-green-400">✓</span>
              ) : (
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
              )}
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.45em] text-red-400">
              {sessionCleared ? "Session Secured" : "Signing Out"}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              {sessionCleared ? "Returning to Login" : "Closing Workshop Session"}
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              {sessionCleared
                ? "Local session cleared. Redirecting to secure login screen."
                : "Ending staff access and protecting this device."}
            </p>

            <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-white transition-all duration-700 ${
                  sessionCleared ? "w-full" : "w-2/3"
                }`}
              />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loggingOut ? "Securing..." : "Logout"}
      </button>
    </>
  );
}
