import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card2, DataTable, Field, Loading, NativeSelect, PageHeader, PayBadge, StatCard, Td } from "@/components/app/ui";
import { useAdjustments, useBillSummary, useLookups, usePayments } from "@/lib/data";
import { useMe } from "@/lib/auth";
import { ADJ_TYPE, CHARGE_CATEGORY, errMsg, fmtDate, fmtDateTime, inr, todayIST, makeUuid } from "@/lib/format";
import { serviceLabel } from "@/lib/services";
import { lineAmount } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/bills/$id")({
  head: () => ({ meta: [{ title: "Bill — H R DORA, ADVOCATE" }] }),
  component: BillPage,
});

function useInvalidate() {
  const qc = useQueryClient();
  return () => ["bill_summary", "payments", "adjustments", "items", "audit", "notes"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

function BillPage() {
  const { id } = Route.useParams();
  const me = useMe().data;
  const L = useLookups();
  const refresh = useInvalidate();
  const bill = (useBillSummary().data ?? []).find((b) => b.bill_id === id);
  const pays = (usePayments().data ?? []).filter((p) => p.bill_id === id);
  const adjs = (useAdjustments().data ?? []).filter((a) => a.bill_id === id);
  const items = useQuery({
    queryKey: ["items", id],
    queryFn: async () => (await supabase.from("bill_items").select("*").eq("bill_id", id).order("created_at")).data ?? [],
  });
  const notes = useQuery({
    queryKey: ["notes", id],
    queryFn: async () => (await supabase.from("followup_notes").select("*").eq("bill_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const [item, setItem] = useState({ category: "legal_opinion" as Enums<"charge_category">, description: "", quantity: "1", rate: "" });
  const [note, setNote] = useState({ note: "", next: "" });
  const [reverse, setReverse] = useState<{ kind: "payment" | "adjustment"; id: string } | null>(null);
  const [reason, setReason] = useState("");
  const [adjOpen, setAdjOpen] = useState(false);

  if (!bill || !me) return <Loading />;
  const editable = bill.bill_status === "draft" || me.isAdmin;
  const finalized = bill.bill_status === "finalized";

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("bill_items").insert({
      bill_id: id,
      category: item.category,
      description: item.description || null,
      quantity: Number(item.quantity) || 1,
      rate: Number(item.rate),
    });
    if (error) return toast.error(errMsg(error));
    setItem({ ...item, description: "", quantity: "1", rate: "" });
    refresh();
  }

  async function doReverse() {
    if (!reverse) return;
    const { error } =
      reverse.kind === "payment"
        ? await supabase.rpc("reverse_payment", { _payment_id: reverse.id, _reason: reason })
        : await supabase.rpc("reverse_adjustment", { _adjustment_id: reverse.id, _reason: reason });
    if (error) return toast.error(errMsg(error));
    toast.success("Reversal recorded. Original entry kept in history.");
    setReverse(null);
    setReason("");
    refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Bill ${bill.bill_no}`}
        subtitle={`${serviceLabel(bill.service_type)} · ${bill.borrower_name} · ${bill.bank_name} · ${bill.branch_name} · Bill date ${fmtDate(bill.bill_date)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/opinions/$id" params={{ id: bill.opinion_id ?? "" }}>Opinion {bill.opinion_no}</Link>
            </Button>
            {!finalized && (
              <Button
                disabled={!items.data?.length}
                onClick={async () => {
                  const { error } = await supabase.from("bills").update({ status: "finalized" }).eq("id", id);
                  if (error) return toast.error(errMsg(error));
                  toast.success("Bill finalized");
                  refresh();
                }}
              >
                Finalize bill
              </Button>
            )}
            {finalized && me.isAdmin && Number(bill.received) === 0 && Number(bill.adjusted) === 0 && (
              <Button variant="outline" onClick={async () => {
                const { error } = await supabase.from("bills").update({ status: "draft" }).eq("id", id);
                if (error) return toast.error(errMsg(error));
                refresh();
              }}>Reopen as draft</Button>
            )}
            {finalized && me.can("record_payments") && Number(bill.outstanding) > 0 && (
              <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90">
                <Link to="/payments/record" search={{ bill: id }}>Record payment</Link>
              </Button>
            )}
            {finalized && me.can("approve_adjustments") && Number(bill.outstanding) > 0 && (
              <Button variant="outline" onClick={() => setAdjOpen(true)}>Approve discount / write-off</Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard tone="navy" label="Bill total" value={inr(bill.total)} sub={bill.bill_status === "draft" ? "Draft" : "Finalized"} />
        <StatCard label="Received" value={inr(bill.received)} sub={Number(bill.historical_received) > 0 ? `incl. ${inr(bill.historical_received)} historical` : undefined} />
        <StatCard label="Approved adjustments" value={inr(bill.adjusted)} />
        <StatCard tone="gold" label="Outstanding" value={inr(bill.outstanding)} />
        <div className="flex items-center justify-center rounded-lg border bg-card p-4">
          {finalized ? <PayBadge s={bill.payment_status} /> : <span className="text-sm text-muted-foreground">Finalize to accept payments</span>}
        </div>
      </div>

      {bill.remarks && <p className="text-sm"><strong>Remarks:</strong> {bill.remarks}</p>}
      <Card2 title="Charge items">
        <DataTable head={["Category", "Description", "Qty", "Rate", "Amount", ""]} empty={!items.data?.length}>
          {(items.data ?? []).map((i) => (
            <tr key={i.id}>
              <Td>{CHARGE_CATEGORY[i.category]}</Td>
              <Td className="whitespace-normal">{i.description || "—"}</Td>
              <Td>{Number(i.quantity)}</Td>
              <Td>{inr(i.rate)}</Td>
              <Td className="font-medium">{inr(i.amount)}</Td>
              <Td>
                {editable && (
                  <button
                    aria-label="Remove item"
                    className="text-destructive"
                    onClick={async () => {
                      if (!confirm("Remove this charge item?")) return;
                      const { error } = await supabase.from("bill_items").delete().eq("id", i.id);
                      if (error) return toast.error(errMsg(error));
                      refresh();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </Td>
            </tr>
          ))}
          <tr className="bg-muted/50 font-semibold">
            <Td>Total</Td><Td /><Td /><Td /><Td>{inr(bill.total)}</Td><Td />
          </tr>
        </DataTable>
        {editable ? (
          <form onSubmit={addItem} className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_80px_120px_auto]">
            <Field label="Category">
              <NativeSelect value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value as Enums<"charge_category"> })}>
                {Object.entries(CHARGE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Description"><Input value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} /></Field>
            <Field label="Qty"><Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} /></Field>
            <Field label="Rate (₹)" hint={item.rate ? `= ${inr(lineAmount(Number(item.quantity) || 0, Number(item.rate)))}` : undefined}>
              <Input type="number" min="0" step="0.01" required value={item.rate} onChange={(e) => setItem({ ...item, rate: e.target.value })} />
            </Field>
            <Button type="submit" className="self-start sm:mt-6">Add item</Button>
          </form>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Finalized bill — only Admin can correct charge items. All corrections are kept in history.</p>
        )}
      </Card2>

      <Card2 title="Payment history (manually recorded)">
        <DataTable head={["Payment date", "Amount", "Method", "Reference", "Remarks", "Recorded by", "Entered", "Status", ""]} empty={!pays.length}>
          {pays.map((p) => (
            <tr key={p.id} className={p.reversal ? "bg-destructive/5" : ""}>
              <Td>{fmtDate(p.payment_date)}</Td>
              <Td className={p.reversal ? "line-through" : "font-semibold"}>{inr(p.amount)}</Td>
              <Td>{p.method || "—"}</Td>
              <Td>{p.reference || "—"}</Td>
              <Td className="max-w-xs whitespace-normal">{p.remarks || "—"}</Td>
              <Td>{L.userName(p.recorded_by)}</Td>
              <Td>{fmtDateTime(p.created_at)}</Td>
              <Td className="whitespace-normal">
                {p.reversal ? (
                  <span className="text-xs text-destructive">Reversed {fmtDateTime(p.reversal.created_at)} by {L.userName(p.reversal.reversed_by)}: {p.reversal.reason}</span>
                ) : p.is_historical ? (
                  <span className="text-xs text-info">Historical (imported)</span>
                ) : (
                  <span className="text-xs text-success">Valid</span>
                )}
              </Td>
              <Td>
                {!p.reversal && me.can("reverse_payments") && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setReverse({ kind: "payment", id: p.id })}>
                    Reverse
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card2>

      <Card2 title="Approved adjustments (discounts, write-offs, settlements)">
        <DataTable head={["Date", "Type", "Amount", "Reason", "Approved by", "Status", ""]} empty={!adjs.length}>
          {adjs.map((a) => (
            <tr key={a.id}>
              <Td>{fmtDate(a.adjustment_date)}</Td>
              <Td>{ADJ_TYPE[a.type]}</Td>
              <Td className={a.reversed_at ? "line-through" : "font-semibold"}>{inr(a.amount)}</Td>
              <Td className="max-w-xs whitespace-normal">{a.reason}</Td>
              <Td>{L.userName(a.approved_by)}</Td>
              <Td className="whitespace-normal text-xs">{a.reversed_at ? `Reversed: ${a.reversal_reason}` : "Active"}</Td>
              <Td>
                {!a.reversed_at && me.can("approve_adjustments") && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setReverse({ kind: "adjustment", id: a.id })}>Reverse</Button>
                )}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card2>

      <Card2 title="Follow-up notes">
        <form
          className="mb-4 grid gap-2 sm:grid-cols-[3fr_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.from("followup_notes").insert({ bill_id: id, note: note.note, next_followup_date: note.next || null, created_by: me.id });
            if (error) return toast.error(errMsg(error));
            setNote({ note: "", next: "" });
            notes.refetch();
          }}
        >
          <Field label="Note (does not change financial records)"><Input required value={note.note} onChange={(e) => setNote({ ...note, note: e.target.value })} /></Field>
          <Field label="Next follow-up"><Input type="date" value={note.next} onChange={(e) => setNote({ ...note, next: e.target.value })} /></Field>
          <Button type="submit" className="self-end">Add note</Button>
        </form>
        <ul className="space-y-2 text-sm">
          {(notes.data ?? []).map((n) => (
            <li key={n.id} className="rounded-md border px-3 py-2">
              <div>{n.note}</div>
              <div className="text-xs text-muted-foreground">
                {L.userName(n.created_by)} · {fmtDateTime(n.created_at)} {n.next_followup_date && `· Next: ${fmtDate(n.next_followup_date)}`}
              </div>
            </li>
          ))}
        </ul>
      </Card2>

      <Dialog open={!!reverse} onOpenChange={(o) => !o && setReverse(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reverse {reverse?.kind}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The original entry is kept and marked as reversed. A reason is required.</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for reversal" />
          <Button variant="destructive" disabled={reason.trim().length < 3} onClick={doReverse}>Confirm reversal</Button>
        </DialogContent>
      </Dialog>

      <AdjustDialog open={adjOpen} onClose={() => setAdjOpen(false)} billId={id} outstanding={Number(bill.outstanding)} onDone={refresh} />
    </div>
  );
}

function AdjustDialog({ open, onClose, billId, outstanding, onDone }: { open: boolean; onClose: () => void; billId: string; outstanding: number; onDone: () => void }) {
  const [v, setV] = useState({ type: "write_off" as Enums<"adjustment_type">, amount: "", reason: "", date: todayIST() });
  const [key, setKey] = useState(() => makeUuid());
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve adjustment</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Outstanding: <strong>{inr(outstanding)}</strong>. Adjustments are not money received and are reported separately.</p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await supabase.rpc("approve_adjustment", {
              _bill_id: billId, _type: v.type, _amount: Number(v.amount), _reason: v.reason, _date: v.date, _idempotency_key: key,
            });
            setBusy(false);
            if (error) return toast.error(errMsg(error));
            toast.success("Adjustment approved");
            setKey(makeUuid());
            setV({ ...v, amount: "", reason: "" });
            onDone();
            onClose();
          }}
        >
          <Field label="Type">
            <NativeSelect value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as Enums<"adjustment_type"> })}>
              <option value="discount">Discount</option><option value="write_off">Write-off</option>
            </NativeSelect>
          </Field>
          <Field label="Amount (₹)">
            <div className="flex gap-2">
              <Input type="number" min="0.01" max={outstanding} step="0.01" required value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
              <Button type="button" variant="outline" onClick={() => setV({ ...v, amount: String(outstanding) })}>Full balance</Button>
            </div>
          </Field>
          <Field label="Date"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <Field label="Reason *"><Textarea required minLength={3} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Approve"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
