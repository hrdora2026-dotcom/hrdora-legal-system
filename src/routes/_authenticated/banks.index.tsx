import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card2, DataTable, Field, Loading, PageHeader, Td } from "@/components/app/ui";
import { useBanks, useBillSummary, useBranches, useOpinions, type Bank } from "@/lib/data";
import { useMe } from "@/lib/auth";
import { computeStats } from "@/components/app/branchStats";
import { errMsg, inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/banks/")({
  head: () => ({ meta: [{ title: "Banks & Branches — H R DORA, ADVOCATE" }] }),
  component: Banks,
});

function Banks() {
  const me = useMe().data!;
  const banks = useBanks();
  const branches = useBranches().data ?? [];
  const ops = useOpinions().data ?? [];
  const bills = useBillSummary().data ?? [];
  const qc = useQueryClient();
  const [v, setV] = useState({ name: "", short_code: "" });
  const [edit, setEdit] = useState<Bank | null>(null);
  const can = me.can("manage_masters");
  if (banks.isLoading) return <Loading />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name: (edit ? edit.name : v.name).trim(), short_code: (edit ? edit.short_code : v.short_code) || null };
    const { error } = edit
      ? await supabase.from("banks").update(payload).eq("id", edit.id)
      : await supabase.from("banks").insert(payload);
    if (error) return toast.error(error.message.includes("banks_name_uq") ? "A bank with this name already exists" : errMsg(error));
    toast.success(edit ? "Bank updated" : "Bank added");
    setEdit(null);
    setV({ name: "", short_code: "" });
    qc.invalidateQueries({ queryKey: ["banks"] });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Banks & Branches" subtitle="Bank master list. Open a bank to manage its branches." />
      {can && (
        <Card2 title={edit ? `Edit ${edit.name}` : "Add bank"}>
          <form onSubmit={save} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto]">
            <Field label="Bank name">
              <Input required value={edit ? edit.name : v.name} onChange={(e) => (edit ? setEdit({ ...edit, name: e.target.value }) : setV({ ...v, name: e.target.value }))} />
            </Field>
            <Field label="Short code">
              <Input value={(edit ? edit.short_code : v.short_code) ?? ""} onChange={(e) => (edit ? setEdit({ ...edit, short_code: e.target.value }) : setV({ ...v, short_code: e.target.value }))} />
            </Field>
            <Button type="submit" className="self-end">{edit ? "Save" : "Add bank"}</Button>
            {edit && <Button type="button" variant="ghost" className="self-end" onClick={() => setEdit(null)}>Cancel</Button>}
          </form>
        </Card2>
      )}
      <DataTable head={["Bank", "Branches", "Opinions", "Not submitted", "Billed", "Received", "Outstanding", "Status", ""]} empty={!banks.data?.length}>
        {(banks.data ?? []).map((b) => {
          const s = computeStats(ops.filter((o) => o.bank_id === b.id), bills.filter((x) => x.bank_id === b.id));
          return (
            <tr key={b.id} className={b.active ? "" : "text-muted-foreground"}>
              <Td><Link to="/banks/$id" params={{ id: b.id }} className="font-medium text-primary hover:underline">{b.name}</Link> {b.short_code && <span className="text-xs text-muted-foreground">({b.short_code})</span>}</Td>
              <Td>{branches.filter((x) => x.bank_id === b.id).length}</Td>
              <Td>{s.opinions}</Td>
              <Td>{s.notSubmitted}</Td>
              <Td>{inr(s.billed)}</Td>
              <Td>{inr(s.received)}</Td>
              <Td className="font-semibold">{inr(s.outstanding)}</Td>
              <Td>{b.active ? "Active" : "Inactive"}</Td>

              <Td>
                {can && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEdit(b)}
                    >
                      Edit
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const { error } = await supabase
                          .from("banks")
                          .update({ active: !b.active })
                          .eq("id", b.id);

                        if (error) return toast.error(errMsg(error));

                        await qc.invalidateQueries({ queryKey: ["banks"] });
                        toast.success(b.active ? "Bank deactivated" : "Bank activated");
                      }}
                    >
                      {b.active ? "Deactivate" : "Activate"}
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const linkedBranches = branches.filter(
                          (branch) => branch.bank_id === b.id
                        );

                        const linkedOpinions = ops.filter(
                          (opinion) => opinion.bank_id === b.id
                        );

                        if (linkedBranches.length > 0 || linkedOpinions.length > 0) {
                          toast.error(
                            "This bank has linked branches or opinions. Deactivate it instead of deleting it."
                          );
                          return;
                        }

                        if (
                          !window.confirm(
                            `Delete bank "${b.name}"?\n\nThis action cannot be undone.`
                          )
                        ) {
                          return;
                        }

                        const { error } = await supabase
                          .from("banks")
                          .delete()
                          .eq("id", b.id);

                        if (error) {
                          toast.error(errMsg(error));
                          return;
                        }

                        await qc.invalidateQueries({ queryKey: ["banks"] });
                        toast.success("Bank deleted");
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </Td>

            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
