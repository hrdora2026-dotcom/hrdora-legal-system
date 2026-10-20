import { ServiceFilter } from "@/components/app/ServiceFilter";
import { serviceLabel, matchesService } from "@/lib/services";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBillSummary, useLookups } from "@/lib/data";
import { useMe } from "@/lib/auth";
import { ageBucket, ageDays, type AgeBucket } from "@/lib/finance";
import { errMsg, fmtDate, inr, PAYMENT_STATUS, todayIST } from "@/lib/format";
import { exportRows } from "@/lib/export";
import { DataTable, ExportButtons, Field, Loading, NativeSelect, PageHeader, PayBadge, StatCard, Td } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/pending")({
  head: () => ({ meta: [{ title: "Pending Bills — H R DORA, ADVOCATE" }] }),
  component: Pending,
});

function Pending() {
  const bills = useBillSummary();
  const L = useLookups();
  const me = useMe().data!;
  const today = todayIST();
  const [f, setF] = useState({ q: "", service: "", bank: "", branch: "", pay: "", from: "", to: "", min: "", age: "" });
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState({ note: "", next: "" });

  const all = useMemo(
    () =>
      (bills.data ?? [])
        .filter((b) => b.bill_status === "finalized" && Number(b.outstanding) > 0)
        .map((b) => {
          const days = ageDays(b.submission_date ?? b.bill_date!, today);
          return { ...b, days, bucket: ageBucket(days) as AgeBucket };
        }),
    [bills.data, today],
  );
  const rows = all.filter((b) => {
    const q = f.q.trim().toLowerCase();
    return (
      (!q || [b.borrower_name, b.opinion_no, b.bill_no].some((x) => x?.toLowerCase().includes(q))) &&
      matchesService(b.service_type, f.service) &&
      (!f.bank || b.bank_id === f.bank) &&
      (!f.branch || b.branch_id === f.branch) &&
      (!f.pay || b.payment_status === f.pay) &&
      (!f.from || (b.bill_date ?? "") >= f.from) &&
      (!f.to || (b.bill_date ?? "") <= f.to) &&
      (!f.min || Number(b.outstanding) >= Number(f.min)) &&
      (!f.age || b.bucket === f.age)
    );
  });
  if (bills.isLoading) return <Loading />;
  const bucketSum = (k: AgeBucket) => rows.filter((r) => r.bucket === k).reduce((s, r) => s + Number(r.outstanding), 0);

  return (
    <div>
      <PageHeader
        title="Pending Bills"
        subtitle="Finalized bills with an outstanding balance. Paid or settled bills are excluded."
        actions={
          <ExportButtons
            onExport={(fmt) =>
              exportRows(rows, [
                { header: "Borrower", value: (b) => b.borrower_name },
                { header: "Service Type", value: (b) => serviceLabel(b.service_type) },
                { header: "Opinion No", value: (b) => b.opinion_no },
                { header: "Bill No", value: (b) => b.bill_no },
                { header: "Bank", value: (b) => b.bank_name },
                { header: "Branch", value: (b) => b.branch_name },
                { header: "Submission Date", value: (b) => fmtDate(b.submission_date) },
                { header: "Bill Total (₹)", value: (b) => Number(b.total), total: true },
                { header: "Received (₹)", value: (b) => Number(b.received), total: true },
                { header: "Adjusted (₹)", value: (b) => Number(b.adjusted), total: true },
                { header: "Outstanding (₹)", value: (b) => Number(b.outstanding), total: true },
                { header: "Last Payment", value: (b) => fmtDate(b.last_payment_date) },
                { header: "Status", value: (b) => PAYMENT_STATUS[b.payment_status!] },
                { header: "Age (days)", value: (b) => b.days },
                { header: "Ageing", value: (b) => b.bucket },
              ], "pending-bills", fmt, "H R DORA, ADVOCATE — Pending bills")
            }
          />
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard tone="navy" label="Total outstanding" value={inr(rows.reduce((s, r) => s + Number(r.outstanding), 0))} sub={`${rows.length} bills`} />
        {(["0-30", "31-60", "61-90", "90+"] as AgeBucket[]).map((k) => (
          <button key={k} onClick={() => setF({ ...f, age: f.age === k ? "" : k })} className="text-left">
            <StatCard tone={f.age === k ? "gold" : undefined} label={k === "90+" ? "Over 90 days" : `${k} days`} value={inr(bucketSum(k))} />
          </button>
        ))}
      </div>
      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Borrower / opinion / bill"><Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></Field>
        <ServiceFilter value={f.service} onChange={(service) => setF({ ...f, service })} />
        <Field label="Bank">
          <NativeSelect value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value, branch: "" })}>
            <option value="">All</option>{L.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Branch">
          <NativeSelect value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>
            <option value="">All</option>{L.branches.filter((b) => !f.bank || b.bank_id === f.bank).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Payment status">
          <NativeSelect value={f.pay} onChange={(e) => setF({ ...f, pay: e.target.value })}>
            <option value="">Unpaid & partial</option><option value="unpaid">Unpaid</option><option value="partial">Partially Paid</option>
          </NativeSelect>
        </Field>
        <Field label="Bill date from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Bill date to"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Minimum outstanding (₹)"><Input type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></Field>
        <Field label="Ageing">
          <NativeSelect value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })}>
            <option value="">All</option><option value="0-30">0–30 days</option><option value="31-60">31–60 days</option><option value="61-90">61–90 days</option><option value="90+">Over 90 days</option>
          </NativeSelect>
        </Field>
      </div>
      <DataTable head={["Borrower", "Service Type", "Opinion", "Bank", "Branch", "Submitted", "Bill total", "Received", "Outstanding", "Last payment", "Status", "Age", ""]} empty={!rows.length}>
        {rows.map((b) => (
          <tr key={b.bill_id} className="hover:bg-muted/50">
            <Td className="font-medium">{b.borrower_name}</Td><Td>{serviceLabel(b.service_type)}</Td>
            <Td><Link to="/bills/$id" params={{ id: b.bill_id! }} className="text-primary hover:underline">{b.opinion_no}</Link></Td>
            <Td>{b.bank_name}</Td>
            <Td>{b.branch_name}</Td>
            <Td>{fmtDate(b.submission_date)}</Td>
            <Td>{inr(b.total)}</Td>
            <Td>{inr(b.received)}</Td>
            <Td className="font-semibold">{inr(b.outstanding)}</Td>
            <Td>{fmtDate(b.last_payment_date)}</Td>
            <Td><PayBadge s={b.payment_status} /></Td>
            <Td>{b.days}d</Td>
            <Td><Button size="sm" variant="ghost" onClick={() => setNoteFor(b.bill_id!)}>Follow-up</Button></Td>
          </tr>
        ))}
      </DataTable>
      <Dialog open={!!noteFor} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add follow-up note</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await supabase.from("followup_notes").insert({ bill_id: noteFor!, note: note.note, next_followup_date: note.next || null, created_by: me.id });
              if (error) return toast.error(errMsg(error));
              toast.success("Note saved");
              setNote({ note: "", next: "" });
              setNoteFor(null);
            }}
          >
            <Field label="Note"><Input required value={note.note} onChange={(e) => setNote({ ...note, note: e.target.value })} /></Field>
            <Field label="Next follow-up date"><Input type="date" value={note.next} onChange={(e) => setNote({ ...note, next: e.target.value })} /></Field>
            <Button type="submit">Save note</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
