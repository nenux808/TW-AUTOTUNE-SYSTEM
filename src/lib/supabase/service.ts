import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createServiceRoleSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  /**
   * Preferred production path: use the service role key on the server only.
   *
   * Fail-safe path: if Vercel has not been configured with SUPABASE_SERVICE_ROLE_KEY yet,
   * fall back to the anon key instead of crashing customer-facing public invoice links.
   * The anon key does not bypass RLS, so Supabase policies still control access.
   */
  const key = serviceRoleKey || anonKey;

  if (!key) {
    throw new Error("Supabase server key is not configured.");
  }

  if (!serviceRoleKey && process.env.NODE_ENV !== "test") {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Falling back to anon key for server Supabase client."
    );
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
