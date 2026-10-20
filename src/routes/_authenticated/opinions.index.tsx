import { ServiceFilter } from "@/components/app/ServiceFilter";
import { serviceLabel, matchesService } from "@/lib/services";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBillSummary, useLookups, useOpinions } from "@/lib/data";
import { fmtDate, OPINION_STATUS, PAYMENT_STATUS } from "@/lib/format";
import { exportRows } from "@/lib/export";
import { DataTable, ExportButtons, Field, Loading, NativeSelect, OpinionBadge, PageHeader, PayBadge, Td } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/opinions/")({
  head: () => ({ meta: [{ title: "Opinion Register — H R DORA, ADVOCATE" }] }),
  component: Register,
});

function Register() {
  const ops = useOpinions();
  const bills = useBillSummary();
  const L = useLookups();
  const [f, setF] = useState({ q: "", service: "", bank: "", branch: "", status: "", pay: "", staff: "", rFrom: "", rTo: "", sFrom: "", sTo: "" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v, ...(k === "bank" ? { branch: "" } : {}) }));

  const payByOp = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bills.data ?? []) if (b.bill_status === "finalized") m.set(b.opinion_id!, b.payment_status!);
    return m;
  }, [bills.data]);

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return (ops.data ?? []).filter((o) => {
      if (q && !o.borrower_name.toLowerCase().includes(q) && !o.opinion_no.toLowerCase().includes(q)) return false;
      if (!matchesService(o.service_type, f.service)) return false;
      if (f.bank && o.bank_id !== f.bank) return false;
      if (f.branch && o.branch_id !== f.branch) return false;
      if (f.status && o.status !== f.status) return false;
      if (f.staff && o.assigned_to !== f.staff) return false;
      if (f.pay && (payByOp.get(o.id) ?? "nobill") !== f.pay) return false;
      if (f.rFrom && (!o.docs_received_date || o.docs_received_date < f.rFrom)) return false;
      if (f.rTo && (!o.docs_received_date || o.docs_received_date > f.rTo)) return false;
      if (f.sFrom && (!o.submission_date || o.submission_date < f.sFrom)) return false;
      if (f.sTo && (!o.submission_date || o.submission_date > f.sTo)) return false;
      return true;
    });
  }, [ops.data, f, payByOp]);

  if (ops.isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Legal Opinion Register"
        subtitle={`${rows.length} of ${ops.data?.length ?? 0} opinions`}
        actions={
          <>
            <ExportButtons
              onExport={(fmt) =>
                exportRows(
                  rows,
                  [
                    { header: "Opinion No", value: (o) => o.opinion_no },
                    { header: "Borrower", value: (o) => o.borrower_name },
                    { header: "Service Type", value: (o) => serviceLabel(o.service_type) },
                    { header: "Bank", value: (o) => L.bankName(o.bank_id) },
                    { header: "Branch", value: (o) => L.branchName(o.branch_id) },
                    { header: "Docs Received", value: (o) => fmtDate(o.docs_received_date) },
                    { header: "Status", value: (o) => OPINION_STATUS[o.status] },
                    { header: "Submission Date", value: (o) => fmtDate(o.submission_date) },
                    { header: "Submission Ref", value: (o) => o.submission_ref },
                    { header: "Assigned", value: (o) => L.userName(o.assigned_to) },
                    { header: "Payment", value: (o) => PAYMENT_STATUS[payByOp.get(o.id) ?? ""] ?? "No bill" },
                    { header: "Remarks", value: (o) => o.remarks },
                  ],
                  "opinion-register",
                  fmt,
                  "H R DORA, ADVOCATE — Opinion Register",
                )
              }
            />
            <Button asChild>
              <Link to="/opinions/new">
                <Plus className="mr-1 h-4 w-4" /> New opinion
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search borrower / opinion no." className="sm:col-span-2">
          <Input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Type to search…" />
        </Field>
        <ServiceFilter value={f.service} onChange={(service) => setF({ ...f, service })} />
        <Field label="Bank">
          <NativeSelect value={f.bank} onChange={(e) => set("bank", e.target.value)}>
            <option value="">All banks</option>
            {L.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Branch">
          <NativeSelect value={f.branch} onChange={(e) => set("branch", e.target.value)}>
            <option value="">All branches</option>
            {L.branches.filter((b) => !f.bank || b.bank_id === f.bank).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Opinion status">
          <NativeSelect value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">All</option>
            {Object.entries(OPINION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Payment status">
          <NativeSelect value={f.pay} onChange={(e) => set("pay", e.target.value)}>
            <option value="">All</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="nobill">No finalized bill</option>
          </NativeSelect>
        </Field>
        <Field label="Staff member">
          <NativeSelect value={f.staff} onChange={(e) => set("staff", e.target.value)}>
            <option value="">All</option>
            {L.profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </NativeSelect>
        </Field>

        <Field label="Received from / to" className="sm:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="date"
              value={f.rFrom}
              onChange={(e) => set("rFrom", e.target.value)}
              className="w-full min-w-0"
              aria-label="Received date from"
            />
            <Input
              type="date"
              value={f.rTo}
              onChange={(e) => set("rTo", e.target.value)}
              className="w-full min-w-0"
              aria-label="Received date to"
            />
          </div>
        </Field>


        <Field label="Submitted from / to" className="sm:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="date"
              value={f.sFrom}
              onChange={(e) => set("sFrom", e.target.value)}
              className="w-full min-w-0"
              aria-label="Submission date from"
            />
            <Input
              type="date"
              value={f.sTo}
              onChange={(e) => set("sTo", e.target.value)}
              className="w-full min-w-0"
              aria-label="Submission date to"
            />
          </div>
        </Field>

      </div>
      <DataTable head={["Opinion No", "Borrower", "Service Type", "Bank", "Branch", "Received", "Status", "Submitted", "Assigned", "Payment"]} empty={!rows.length}>
        {rows.slice(0, 500).map((o) => (
          <tr key={o.id} className="hover:bg-muted/50">
            <Td><Link to="/opinions/$id" params={{ id: o.id }} className="font-medium text-primary hover:underline">{o.opinion_no}</Link></Td>
            <Td className="font-medium">{o.borrower_name}</Td><Td>{serviceLabel(o.service_type)}</Td>
            <Td>{L.bankName(o.bank_id)}</Td>
            <Td>{L.branchName(o.branch_id)}</Td>
            <Td>{fmtDate(o.docs_received_date)}</Td>
            <Td><OpinionBadge s={o.status} /></Td>
            <Td>{fmtDate(o.submission_date)}</Td>
            <Td>{L.userName(o.assigned_to)}</Td>
            <Td><PayBadge s={payByOp.get(o.id)} /></Td>
          </tr>
        ))}
      </DataTable>
      {rows.length > 500 && <p className="mt-2 text-xs text-muted-foreground">Showing first 500 rows — refine filters or export for the full list.</p>}
    </div>
  );
}
