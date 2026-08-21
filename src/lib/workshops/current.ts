import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CurrentWorkshop = {
  id: string;
  name: string;
  slug: string | null;
  role: string;
  subscription_status: string | null;
};

export async function getCurrentWorkshop(): Promise<CurrentWorkshop | null> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("workshop_members")
    .select(`
      role,
      workshops(
        id,
        name,
        slug,
        subscription_status
      )
    `)
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.workshops) return null;

  const workshop = Array.isArray(data.workshops)
    ? data.workshops[0]
    : data.workshops;

  if (!workshop) return null;

  return {
    id: workshop.id,
    name: workshop.name,
    slug: workshop.slug,
    role: data.role,
    subscription_status: workshop.subscription_status,
  };
}
