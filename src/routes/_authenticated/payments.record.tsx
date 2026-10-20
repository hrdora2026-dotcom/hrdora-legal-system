import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card2, Field, NativeSelect, PageHeader, PayBadge, StatCard } from "@/components/app/ui";
import { useBillSummary } from "@/lib/data";
import { useMe } from "@/lib/auth";
import { errMsg, fmtDate, inr, todayIST } from "@/lib/format";
import { outstanding as calcOut, round2 } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/payments/record")({
  validateSearch: (s: Record<string, unknown>) => ({ bill: typeof s.bill === "string" ? s.bill : undefined }),
  head: () => ({ meta: [{ title: "Record Payment — H R DORA, ADVOCATE" }] }),
  component: RecordPayment,
});

type Kind = "partial" | "full" | "settlement";


function makeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}


function RecordPayment() {
  const me = useMe().data!;
  const search = Route.useSearch();
  const qc = useQueryClient();
  const bills = useBillSummary();
  const [q, setQ] = useState("");
  const [billId, setBillId] = useState<string | undefined>(search.bill);
  const [kind, setKind] = useState<Kind>("partial");
  const [f, setF] = useState({ amount: "", date: todayIST(), method: "", reference: "", remarks: "", reason: "" });
  const [key, setKey] = useState(() => makeUuid());
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const open = useMemo(
    () => (bills.data ?? []).filter((b) => b.bill_status === "finalized" && Number(b.outstanding) > 0),
    [bills.data],
  );
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return open.slice(0, 15);
    return open
      .filter((b) => [b.borrower_name, b.opinion_no, b.bill_no, b.bank_name, b.branch_name].some((x) => x?.toLowerCase().includes(s)))
      .slice(0, 30);
  }, [open, q]);
  const bill = (bills.data ?? []).find((b) => b.bill_id === billId);

  if (!me.can("record_payments"))
    return (
      <div>
        <PageHeader title="Record Payment" />
        <Card2><p className="text-sm">You do not have permission to record payments. Please ask Sir to grant the permission.</p></Card2>
      </div>
    );

  const out = bill ? Number(bill.outstanding) : 0;
  const amt = kind === "full" ? out : Number(f.amount || 0);
  const after = bill ? calcOut(Number(bill.total), Number(bill.received) + amt, Number(bill.adjusted)) : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!bill || busy) return;
    if (amt <= 0 || amt > out) return toast.error(`Amount must be between ₹1 and ${inr(out)}`);
    if (kind === "settlement" && !f.reason.trim()) return toast.error("Enter the reason for final settlement");
    setBusy(true);
    const { data, error } = await supabase.rpc("record_payment", {
      _bill_id: bill.bill_id!,
      _amount: round2(amt),
      _payment_date: f.date,
      _kind: kind,
      _method: f.method,
      _reference: f.reference,
      _remarks: f.remarks,
      _idempotency_key: key,
      _settlement_reason: kind === "settlement" ? f.reason : undefined,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    const dup = (data as { duplicate?: boolean })?.duplicate;
    toast.success(dup ? "This payment was already saved — no duplicate created." : `Payment of ${inr(amt)} recorded for ${bill.bill_no}`);
    setLast(`${inr(amt)} recorded on ${fmtDate(f.date)} for ${bill.borrower_name} (${bill.bill_no}).`);
    setKey(makeUuid());
    setF({ amount: "", date: todayIST(), method: "", reference: "", remarks: "", reason: "" });
    setKind("partial");
    await Promise.all(["bill_summary", "payments", "adjustments"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Record Payment" subtitle="Enter money actually received. This software does not collect payments online." />
      {last && <div className="rounded-md border border-success bg-success/10 p-3 text-sm text-success">{last}</div>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card2 title="1. Find the bill">
          <Input placeholder="Borrower, opinion no., bill no., bank or branch" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-3 max-h-[28rem] divide-y overflow-y-auto rounded-md border">
            {matches.map((b) => (
              <li key={b.bill_id}>
                <button
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${b.bill_id === billId ? "bg-accent" : ""}`}
                  onClick={() => { setBillId(b.bill_id!); setKey(crypto.randomUUID()); }}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{b.borrower_name}</span>
                    <span className="font-semibold">{inr(b.outstanding)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{b.bill_no} · {b.opinion_no} · {b.bank_name} / {b.branch_name}</div>
                </button>
              </li>
            ))}
            {!matches.length && <li className="p-4 text-center text-sm text-muted-foreground">No bills with an outstanding balance match.</li>}
          </ul>
        </Card2>
        <Card2 title="2. Enter payment received">
          {!bill ? (
            <p className="text-sm text-muted-foreground">Select a bill on the left.</p>
          ) : (
            <form onSubmit={save} className="space-y-4">
              <div className="text-sm">
                <Link to="/bills/$id" params={{ id: bill.bill_id! }} className="font-semibold text-primary hover:underline">{bill.bill_no}</Link>{" "}
                · {bill.borrower_name} · {bill.bank_name} / {bill.branch_name} <PayBadge s={bill.payment_status} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="Bill total" value={inr(bill.total)} />
                <StatCard label="Already received" value={inr(bill.received)} sub={Number(bill.adjusted) ? `Adjusted ${inr(bill.adjusted)}` : undefined} />
                <StatCard tone="gold" label="Outstanding" value={inr(out)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([["partial", "Partial Payment"], ["full", "Full Payment"], ["settlement", "Final Settlement"]] as const).map(([k, l]) =>
                  k === "settlement" && !me.can("approve_adjustments") ? null : (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setKind(k)}
                      className={`rounded-md border px-2 py-2 text-sm font-medium ${kind === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
                    >
                      {l}
                    </button>
                  ),
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Amount received (₹) *">
                  {kind === "full" ? (
                    <Input value={out} disabled />
                  ) : (
                    <Input type="number" required min="0.01" max={out} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
                  )}
                </Field>
                <Field label="Date received *">
                  <Input type="date" required max={todayIST()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
                </Field>
                <Field label="Payment method (optional)">
                  <NativeSelect value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
                    <option value="">—</option>
                    {["Cash", "Cheque", "Bank transfer / NEFT", "UPI", "Demand draft", "Other"].map((m) => <option key={m}>{m}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Transaction reference (optional)">
                  <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
                </Field>
              </div>
              <Field label="Remarks (optional)"><Input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
              {kind === "settlement" && (
                <div className="rounded-md border border-warning bg-warning/10 p-3 text-sm">
                  <p className="mb-2">
                    The amount received is recorded as money received. The remaining{" "}
                    <strong>{inr(Math.max(0, out - amt))}</strong> will be recorded as an <strong>approved settlement adjustment</strong> — not as money received.
                  </p>
                  <Field label="Reason for settlement *">
                    <Textarea required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
                  </Field>
                </div>
              )}
              <div className="rounded-md bg-muted p-3 text-sm">
                After saving: received <strong>{inr(Number(bill.received) + amt)}</strong>, outstanding{" "}
                <strong>{inr(kind === "settlement" ? 0 : Math.max(0, after))}</strong>
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                {busy ? "Saving…" : "Save payment record"}
              </Button>
            </form>
          )}
        </Card2>
      </div>
    </div>
  );
}
