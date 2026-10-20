import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card2, DataTable, Field, Loading, PageHeader, Td } from "@/components/app/ui";
import { useBanks, useBillSummary, useBranches, useOpinions, type Branch } from "@/lib/data";
import { useMe } from "@/lib/auth";
import { computeStats } from "@/components/app/branchStats";
import { errMsg, inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/banks/$id")({
  head: () => ({ meta: [{ title: "Bank — H R DORA, ADVOCATE" }] }),
  component: BankPage,
});

function BankPage() {
  const { id } = Route.useParams();
  const me = useMe().data!;
  const qc = useQueryClient();
  const bank = (useBanks().data ?? []).find((b) => b.id === id);
  const branches = (useBranches().data ?? []).filter((b) => b.bank_id === id);
  const ops = useOpinions().data ?? [];
  const bills = useBillSummary().data ?? [];
  const [v, setV] = useState({ name: "", city: "", contact: "" });
  const [edit, setEdit] = useState<Branch | null>(null);
  const can = me.can("manage_masters");
  if (!bank) return <Loading />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const src = edit ?? v;
    const payload = { name: src.name.trim(), city: src.city || null, contact: src.contact || null };
    const { error } = edit
      ? await supabase.from("branches").update(payload).eq("id", edit.id)
      : await supabase.from("branches").insert({ ...payload, bank_id: id });
    if (error) return toast.error(error.message.includes("branches_name_uq") ? "This branch already exists for the bank" : errMsg(error));
    toast.success(edit ? "Branch updated" : "Branch added");
    setEdit(null);
    setV({ name: "", city: "", contact: "" });
    qc.invalidateQueries({ queryKey: ["branches"] });
  }

  const src = edit ?? v;
  const setSrc = (k: "name" | "city" | "contact", val: string) => (edit ? setEdit({ ...edit, [k]: val }) : setV({ ...v, [k]: val }));

  return (
    <div className="space-y-5">
      <PageHeader title={bank.name} subtitle="Branch-wise register" actions={<Button variant="outline" asChild><Link to="/banks">All banks</Link></Button>} />
      {can && (
        <Card2 title={edit ? `Edit branch ${edit.name}` : "Add branch"}>
          <form onSubmit={save} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
            <Field label="Branch name"><Input required value={src.name} onChange={(e) => setSrc("name", e.target.value)} /></Field>
            <Field label="City"><Input value={src.city ?? ""} onChange={(e) => setSrc("city", e.target.value)} /></Field>
            <Field label="Contact"><Input value={src.contact ?? ""} onChange={(e) => setSrc("contact", e.target.value)} /></Field>
            <Button type="submit" className="self-end">{edit ? "Save" : "Add branch"}</Button>
            {edit && <Button type="button" variant="ghost" className="self-end" onClick={() => setEdit(null)}>Cancel</Button>}
          </form>
        </Card2>
      )}
      <DataTable head={["Branch", "Opinions", "Not submitted", "Bills", "Billed", "Received", "Outstanding", "Unpaid", "Partial", "Paid/Settled", ""]} empty={!branches.length}>
        {branches.map((b) => {
          const s = computeStats(ops.filter((o) => o.branch_id === b.id), bills.filter((x) => x.branch_id === b.id));
          return (
            <tr key={b.id} className={b.active ? "" : "text-muted-foreground"}>
              <Td><Link to="/branches/$id" params={{ id: b.id }} className="font-medium text-primary hover:underline">{b.name}</Link>{!b.active && " (inactive)"}</Td>
              <Td>{s.opinions}</Td><Td>{s.notSubmitted}</Td><Td>{s.bills}</Td>
              <Td>{inr(s.billed)}</Td><Td>{inr(s.received)}</Td><Td className="font-semibold">{inr(s.outstanding)}</Td>
              <Td>{s.unpaid}</Td><Td>{s.partial}</Td><Td>{s.paid}</Td>
              <Td>
                {can && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(b)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      const { error } = await supabase.from("branches").update({ active: !b.active }).eq("id", b.id);
                      if (error) return toast.error(errMsg(error));
                      qc.invalidateQueries({ queryKey: ["branches"] });
                    }}>{b.active ? "Deactivate" : "Activate"}</Button>
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
