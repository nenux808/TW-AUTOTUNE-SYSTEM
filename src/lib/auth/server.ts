import "server-only";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/auth/roles";

const ownerRoles: UserRole[] = ["owner"];
const staffRoles: UserRole[] = ["owner", "mechanic", "front_desk"];

export async function requireApiUser(allowedRoles: UserRole[] = staffRoles) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.active === false) {
    return {
      supabase,
      user,
      profile: null,
      response: NextResponse.json({ error: "Staff profile is inactive or not configured." }, { status: 403 }),
    };
  }

  const role = profile.role as UserRole;

  if (!allowedRoles.includes(role)) {
    return {
      supabase,
      user,
      profile,
      response: NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 }),
    };
  }

  return {
    supabase,
    user,
    profile,
    response: null,
  };
}

export async function requireApiOwner() {
  return requireApiUser(ownerRoles);
}
