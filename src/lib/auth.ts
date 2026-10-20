import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export type Permission = Enums<"app_permission">;

export type Me = {
  id: string;
  email: string | null;
  name: string;
  active: boolean;
  roles: Enums<"app_role">[];
  perms: Permission[];
  isAdmin: boolean;
  isMember: boolean;
  can: (p: Permission) => boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [prof, roles, perms] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("user_permissions").select("permission").eq("user_id", u.user.id),
      ]);
      const r = (roles.data ?? []).map((x) => x.role);
      const p = (perms.data ?? []).map((x) => x.permission);
      const active = prof.data?.active ?? false;
      const isAdmin = active && r.includes("admin");
      const isMember = active && r.length > 0;
      return {
        id: u.user.id,
        email: u.user.email ?? null,
        name: prof.data?.full_name || u.user.email || "User",
        active,
        roles: r,
        perms: p,
        isAdmin,
        isMember,
        can: (x) => isMember && (isAdmin || p.includes(x)),
      };
    },
    staleTime: 60_000,
  });
}
