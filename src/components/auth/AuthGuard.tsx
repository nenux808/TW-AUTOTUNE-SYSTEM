"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/auth/roles";

type AuthState = {
  checking: boolean;
  role: UserRole | null;
  error: string;
};

const ownerOnlyPaths = [
  "/email-logs",
  "/inventory/purchases",
  "/reports",
  "/settings",
];

function isOwnerInvoicePath(pathname: string) {
  return pathname.startsWith("/invoices/") && pathname.includes("/owner");
}

function isPublicRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/invoice-view") ||
    pathname.startsWith("/api")
  );
}

function canAccessPath(role: UserRole | null, pathname: string) {
  if (!role) return false;

  if (role === "owner") return true;

  if (ownerOnlyPaths.some((path) => pathname.startsWith(path))) {
    return false;
  }

  if (isOwnerInvoicePath(pathname)) {
    return false;
  }

  if (role === "mechanic") {
    return true;
  }

  if (role === "front_desk") {
    const allowedFrontDeskPaths = [
      "/dashboard",
      "/customers",
      "/vehicles",
      "/jobs",
      "/invoices",
      "/packages",
    ];

    return allowedFrontDeskPaths.some((path) => pathname.startsWith(path));
  }

  return false;
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  const [authState, setAuthState] = useState<AuthState>({
    checking: true,
    role: null,
    error: "",
  });

  useEffect(() => {
    async function checkAuth() {
      if (isPublicRoute(pathname)) {
        setAuthState({
          checking: false,
          role: null,
          error: "",
        });
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setAuthState({
          checking: false,
          role: null,
          error:
            "Your staff profile is not configured yet. Ask the owner/admin to assign your role.",
        });
        return;
      }

      if (profile.active === false) {
        setAuthState({
          checking: false,
          role: null,
          error: "Your account is inactive. Please contact the owner/admin.",
        });
        return;
      }

      const role = profile.role as UserRole;

      if (!canAccessPath(role, pathname)) {
        setAuthState({
          checking: false,
          role,
          error: "You do not have permission to access this page.",
        });
        return;
      }

      setAuthState({
        checking: false,
        role,
        error: "",
      });
    }

    checkAuth();
  }, [pathname]);

  if (authState.checking && !isPublicRoute(pathname)) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        Loading...
      </main>
    );
  }

  if (authState.error) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Access restricted
          </h1>
          <p className="mt-3 text-slate-600">{authState.error}</p>

          <button
            type="button"
            onClick={() => router.replace("/dashboard")}
            className="mt-6 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
