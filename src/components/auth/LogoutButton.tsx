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

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 5000);
    } catch (error) {
      console.warn("Logout warning:", error);
    }

    router.replace("/login");
    router.refresh();

    setTimeout(() => {
      window.location.href = "/login";
    }, 300);
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}
