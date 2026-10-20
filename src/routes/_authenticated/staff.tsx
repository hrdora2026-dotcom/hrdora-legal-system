import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card2, DataTable, Loading, PageHeader, Td } from "@/components/app/ui";
import { useProfiles } from "@/lib/data";
import { useMe } from "@/lib/auth";
import { errMsg, fmtDate, PERMISSIONS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff & Permissions — H R DORA, ADVOCATE" }] }),
  component: Staff,
});

function Staff() {
  const me = useMe().data!;
  const qc = useQueryClient();
  const profiles = useProfiles();
  const roles = useQuery({ queryKey: ["roles"], queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [] });
  const perms = useQuery({ queryKey: ["perms"], queryFn: async () => (await supabase.from("user_permissions").select("*")).data ?? [] });
  if (!me.isAdmin) return <Card2><p className="text-sm">Only Admin can manage staff.</p></Card2>;
  if (profiles.isLoading) return <Loading />;
  const refresh = () => ["roles", "perms", "profiles", "me"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) toast.error(errMsg(error));
    refresh();
  };
  const roleOf = (id: string) => (roles.data ?? []).filter((r) => r.user_id === id).map((r) => r.role);
  const hasPerm = (id: string, p: string) => (perms.data ?? []).some((x) => x.user_id === id && x.permission === p);

  return (
    <div className="space-y-5">
      <PageHeader title="Staff & Permissions" subtitle="Approve new accounts, grant payment permissions, deactivate users." />
      <Card2>
        <p className="text-sm text-muted-foreground">
          New staff create their own account from the sign-in page (“New staff? Create account”). They appear below as <strong>Awaiting approval</strong> until you approve them.
          Staff can manage opinions and bills; payment actions require the specific permissions below.
        </p>
      </Card2>
      <DataTable head={["Name", "Email", "Joined", "Role", "Special permissions", "Account"]}>
        {(profiles.data ?? []).map((p) => {
          const rs = roleOf(p.id);
          const isAdmin = rs.includes("admin");
          const self = p.id === me.id;
          return (
            <tr key={p.id} className={p.active ? "" : "text-muted-foreground"}>
              <Td className="font-medium">{p.full_name}</Td>
              <Td>{p.email}</Td>
              <Td>{fmtDate(p.created_at)}</Td>
              <Td>
                {isAdmin ? (
                  <span className="font-semibold text-primary">Admin</span>
                ) : rs.includes("staff") ? (
                  <div className="flex items-center gap-2">
                    Staff
                    <Button size="sm" variant="ghost" onClick={() => confirm("Make this user an Admin with full access?") && run(supabase.from("user_roles").insert({ user_id: p.id, role: "admin" }))}>Make Admin</Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => run(supabase.from("user_roles").insert({ user_id: p.id, role: "staff" }))}>Approve as staff</Button>
                )}
                {isAdmin && !self && (
                  <Button size="sm" variant="ghost" onClick={() => run(supabase.from("user_roles").delete().eq("user_id", p.id).eq("role", "admin").then(async (r) => (rs.includes("staff") ? r : await supabase.from("user_roles").insert({ user_id: p.id, role: "staff" }))))}>
                    Remove Admin
                  </Button>
                )}
              </Td>
              <Td className="whitespace-normal">
                {isAdmin ? (
                  <span className="text-xs text-muted-foreground">All permissions</span>
                ) : rs.length ? (
                  <div className="flex flex-col gap-1">
                    {Object.entries(PERMISSIONS).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={hasPerm(p.id, k)}
                          onChange={(e) =>
                            run(
                              e.target.checked
                                ? supabase.from("user_permissions").insert({ user_id: p.id, permission: k as Enums<"app_permission">, granted_by: me.id })
                                : supabase.from("user_permissions").delete().eq("user_id", p.id).eq("permission", k as Enums<"app_permission">),
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-warning-foreground">Awaiting approval</span>
                )}
              </Td>
              <Td>
                {!self && (
                  <Button size="sm" variant="outline" onClick={() => run(supabase.from("profiles").update({ active: !p.active }).eq("id", p.id))}>
                    {p.active ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </Td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
