import { createClient } from "@/lib/supabase/client";

export type UserRole = "owner" | "mechanic" | "front_desk";

export type UserProfile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
};

export async function getCurrentUserProfile() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return data as UserProfile;
}

export function canViewOwnerData(role?: string | null) {
  return role === "owner";
}

export function canManageSettings(role?: string | null) {
  return role === "owner";
}

export function canViewEmailLogs(role?: string | null) {
  return role === "owner";
}

export function canManageInventoryPurchases(role?: string | null) {
  return role === "owner";
}

export function canCreateInvoices(role?: string | null) {
  return role === "owner" || role === "mechanic" || role === "front_desk";
}

export function canManageJobs(role?: string | null) {
  return role === "owner" || role === "mechanic";
}
