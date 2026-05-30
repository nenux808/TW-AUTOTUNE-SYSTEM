"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCurrentRole() {
  const supabase = createClient();

  const [role, setRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    async function loadRole() {
      setLoadingRole(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRole(null);
        setLoadingRole(false);
        return;
      }

      const { data } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setRole(data?.role || null);
      setLoadingRole(false);
    }

    loadRole();
  }, []);

  return {
    role,
    loadingRole,
    isOwner: role === "owner",
    isMechanic: role === "mechanic",
    isFrontDesk: role === "front_desk",
  };
}
