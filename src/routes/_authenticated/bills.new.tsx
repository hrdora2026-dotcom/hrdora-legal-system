import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { useBillSummary, useLookups, useOpinions } from "@/lib/data";
import { billTotal, lineAmount } from "@/lib/finance";
import { serviceLabel } from "@/lib/services";
import { CHARGE_CATEGORY, errMsg, inr, todayIST } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Loading, NativeSelect, PageHeader } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/bills/new")({
  validateSearch: (search: Record<string, unknown>) => ({ opinion: typeof search.opinion === "string" ? search.opinion : "" }),
  head: () => ({ meta: [{ title: "Create New Bill — H R DORA, ADVOCATE" }, { name: "description", content: "Create and finalize itemized office bills linked to existing opinions." }, { property: "og:title", content: "Create New Bill — H R DORA, ADVOCATE" }, { property: "og:description", content: "Itemized legal-office bill creation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: NewBill,
});
type Item = { key: string; category: Enums<"charge_category">; description: string; quantity: string; rate: string };
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
const blankItem = (): Item => ({ key: makeUuid(), category: "legal_opinion", description: "", quantity: "1", rate: "" });
function NewBill() {
  const search = Route.useSearch();
  const ops = useOpinions(); const bills = useBillSummary(); const L = useLookups();
  const qc = useQueryClient(); const navigate = useNavigate();
  const [opId, setOpId] = useState(search.opinion); const [query, setQuery] = useState("");

  const [date, setDate] = useState(todayIST);
  const [remarks, setRemarks] = useState("");

  const [submissionChoice, setSubmissionChoice] = useState<
    "ready" | "submitted"
  >("ready");
  const [submissionDate, setSubmissionDate] = useState(todayIST());
  const [submissionRef, setSubmissionRef] = useState("");


  const [items, setItems] = useState<Item[]>(() => [blankItem()]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const key = useRef(makeUuid());
  const op = ops.data?.find((o) => o.id === opId);
  const existing = (bills.data ?? []).filter((b) => b.opinion_id === opId);
  const [allowAdditional, setAllowAdditional] = useState(false);
  const total = billTotal(items.map((i) => ({ quantity: Number(i.quantity) || 0, rate: Number(i.rate) || 0 })));
  const update = (id: string, patch: Partial<Item>) => setItems((old) => old.map((i) => i.key === id ? { ...i, ...patch } : i));
  async function save(finalize: boolean) {
    if (lock.current) return;
    if (!op || !date || !items.length) return toast.error("Select an opinion, bill date and at least one charge item.");
    if (existing.length && !allowAdditional) return toast.error("Confirm that this is a legitimate additional bill.");
    if (items.some((i) => !/^\d+(\.\d{1,2})?$/.test(i.quantity) || Number(i.quantity) <= 0 || !/^\d+(\.\d{1,2})?$/.test(i.rate))) return toast.error("Use a positive quantity and nonnegative rate, with up to two decimal places.");
    lock.current = true; setBusy(true);
    try {

      const { data, error } = await supabase.rpc("create_bill", {
        _opinion_id: op.id,
        _bill_date: date,
        _remarks: remarks,
        _items: items.map(({ category, description, quantity, rate }) => ({
          category,
          description,
          quantity,
          rate,
        })),
        _finalize: finalize,
        _key: key.current,
        _allow_additional: allowAdditional,
        _submission_status: submissionChoice,
        _submission_date:
          submissionChoice === "submitted" ? submissionDate : null,
        _submission_ref:
          submissionChoice === "submitted"
            ? submissionRef.trim() || null
            : null,
      });

      if (error) throw error;
      if (!data) throw new Error("The bill could not be saved.");
      await qc.invalidateQueries({ queryKey: ["bill_summary"] });
      toast.success(finalize ? "Bill saved and finalized" : "Draft bill saved");
      await navigate({ to: "/bills/$id", params: { id: data } });
    } catch (error) { toast.error(errMsg(error)); } finally { setBusy(false); lock.current = false; }
  }
  if (ops.isLoading || bills.isLoading) return <Loading />;
  if (ops.isError || bills.isError) return <div role="alert">Could not load opinions or bills. <Button onClick={() => { ops.refetch(); bills.refetch(); }}>Retry</Button></div>;
  return <div className="space-y-5"><PageHeader title="Create New Bill" />
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(false); }}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Search opinions"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Opinion number or borrower" /></Field>
        <Field label="Opinion number *"><NativeSelect required value={opId} onChange={(e) => { setOpId(e.target.value); setAllowAdditional(false); }}><option value="">Select existing opinion</option>{(ops.data ?? []).filter((o) => o.id === opId || [o.opinion_no, o.borrower_name].some((v) => v.toLowerCase().includes(query.toLowerCase()))).map((o) => <option value={o.id} key={o.id}>{o.opinion_no} — {o.borrower_name}</option>)}</NativeSelect></Field>
        <Field label="Bill date *"><Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Borrower"><Input readOnly value={op?.borrower_name ?? ""} /></Field><Field label="Service type"><Input readOnly value={op ? serviceLabel(op.service_type) : ""} /></Field>
        <Field label="Bank"><Input readOnly value={op ? L.bankName(op.bank_id) : ""} /></Field><Field label="Branch"><Input readOnly value={op ? L.branchName(op.branch_id) : ""} /></Field>
      </div>
      {!!existing.length && <div className="border border-warning bg-warning/15 p-3 text-sm"><p>{existing.length} bill(s) already exist for this opinion.</p><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={allowAdditional} onChange={(e) => setAllowAdditional(e.target.checked)} />This is a legitimate additional bill.</label></div>}
      <section className="space-y-3 border-y py-4"><h2 className="text-lg font-semibold">Charge items</h2>{items.map((i, n) => <div key={i.key} className="grid items-end gap-2 border-b pb-3 sm:grid-cols-2 lg:grid-cols-[1fr_2fr_90px_120px_120px_40px]">
        <Field label={`Category ${n + 1}`}><NativeSelect value={i.category} onChange={(e) => update(i.key, { category: e.target.value as Item["category"] })}>{Object.entries(CHARGE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
        <Field label={`Description ${n + 1}`}><Input value={i.description} onChange={(e) => update(i.key, { description: e.target.value })} /></Field>
        <Field label={`Quantity ${n + 1}`}><Input required type="number" min="0.01" step="0.01" value={i.quantity} onChange={(e) => update(i.key, { quantity: e.target.value })} /></Field>
        <Field label={`Unit rate ${n + 1} (₹)`}><Input required type="number" min="0" step="0.01" value={i.rate} onChange={(e) => update(i.key, { rate: e.target.value })} /></Field>
        <div className="pb-2 font-semibold">{inr(lineAmount(Number(i.quantity) || 0, Number(i.rate) || 0))}</div><Button type="button" variant="ghost" size="icon" aria-label={`Remove charge ${n + 1}`} onClick={() => setItems(items.filter((x) => x.key !== i.key))}><Trash2 /></Button>
      </div>)}<Button type="button" variant="outline" onClick={() => setItems([...items, blankItem()])}><Plus />Add charge item</Button></section>
      <div className="text-right"><p>Subtotal: <strong>{inr(total)}</strong></p><p className="text-xl font-bold">Bill total: {inr(total)}</p></div>
      <Field label="Remarks"><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Opinion Submission Status</h2>

        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="radio"
            name="submissionChoice"
            value="ready"
            checked={submissionChoice === "ready"}
            onChange={() => setSubmissionChoice("ready")}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">Ready — Not Yet Submitted</span>
            <span className="text-sm text-muted-foreground">
              The opinion has not yet been sent to the bank.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="radio"
            name="submissionChoice"
            value="submitted"
            checked={submissionChoice === "submitted"}
            onChange={() => setSubmissionChoice("submitted")}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">Opinion Submitted to Bank</span>
            <span className="text-sm text-muted-foreground">
              Choose this only if the opinion has actually been sent.
            </span>
          </span>
        </label>

        {submissionChoice === "submitted" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Actual submission date *">
              <Input
                type="date"
                required
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
              />
            </Field>

            <Field label="Submission reference (optional)">
              <Input
                value={submissionRef}
                onChange={(e) => setSubmissionRef(e.target.value)}
                placeholder="Bank reference"
              />
            </Field>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>Save Draft</Button><Button type="button" disabled={busy} onClick={() => save(true)}>Finalize Bill</Button><Button variant="outline" asChild><Link to="/bills">Cancel</Link></Button></div>
    </form></div>;
}