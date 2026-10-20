import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdjustments, useBillSummary, useLookups, useOpinions, usePayments, fetchAll } from "@/lib/data";
import { useMe } from "@/lib/auth";
import { inRange, resolveRange, type DateRange } from "@/lib/dates";
import { ADJ_TYPE, fmtDate, fmtDateTime, inr, OPINION_STATUS, PAYMENT_STATUS } from "@/lib/format";
import { buildSheet, exportRows, type ExportCol } from "@/lib/export";
import { Card2, ExportButtons, Field, Loading, NativeSelect, PageHeader, RangePicker } from "@/components/app/ui";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — H R DORA, ADVOCATE" }] }),
  component: Reports,
});

type Row = Record<string, string | number | null>;
const REPORTS = {
  monthly_billed: "Monthly billed amount",
  monthly_received: "Monthly payments actually received",
  bank_outstanding: "Bank-wise outstanding bills",
  branch_pending: "Branch-wise pending bills",
  not_submitted: "Opinions not submitted",
  submitted_unpaid: "Submitted opinions with unpaid bills",
  paid_partial: "Paid and partially paid bills",
  borrower: "Borrower-wise billing and payment history",
  datewise_payments: "Date-wise manually recorded payments",
  adjustments: "Approved discounts and write-offs",
  staff_activity: "Staff activity",
  import_results: "Excel import results",
} as const;
type RKey = keyof typeof REPORTS;

function Reports() {
  const me = useMe().data!;
  const L = useLookups();
  const ops = useOpinions();
  const bills = useBillSummary();
  const pays = usePayments();
  const adjs = useAdjustments();
  const [rk, setRk] = useState<RKey>("bank_outstanding");
  const [range, setRange] = useState<DateRange>({ key: "fy" });
  const [bank, setBank] = useState("");
  const [branch, setBranch] = useState("");
  const r = resolveRange(range);

  const audit = useQuery({
    queryKey: ["audit_all", r.from, r.to],
    enabled: rk === "staff_activity",
    queryFn: () =>
      fetchAll<Tables<"audit_logs">>((f, t) => {
        let q = supabase.from("audit_logs").select("*").order("changed_at", { ascending: false });
        if (r.from) q = q.gte("changed_at", r.from);
        if (r.to) q = q.lte("changed_at", r.to + "T23:59:59");
        return q.range(f, t);
      }),
  });
  const imports = useQuery({
    queryKey: ["import_rows_all"],
    enabled: rk === "import_results",
    queryFn: async () => (await supabase.from("import_rows").select("*, import_batches(file_name, created_at)").order("row_number").limit(5000)).data ?? [],
  });

  const report = useMemo((): { cols: ExportCol<Row>[]; rows: Row[]; note?: string } => {
    const bf = (b: { bank_id: string | null; branch_id: string | null }) => (!bank || b.bank_id === bank) && (!branch || b.branch_id === branch);
    const fin = (bills.data ?? []).filter((b) => b.bill_status === "finalized" && bf(b));
    const billMap = new Map((bills.data ?? []).map((b) => [b.bill_id, b]));
    const validPays = (pays.data ?? []).filter((p) => !p.reversal && inRange(p.payment_date, r) && billMap.get(p.bill_id) && bf(billMap.get(p.bill_id)!));
    const c = (header: string, key: string, total = false): ExportCol<Row> => ({ header, value: (x) => x[key], total });
    const money = (header: string, key: string) => c(header, key, true);
    const group = <T,>(arr: T[], k: (x: T) => string) => {
      const m = new Map<string, T[]>();
      for (const x of arr) m.set(k(x), [...(m.get(k(x)) ?? []), x]);
      return m;
    };
    switch (rk) {
      case "monthly_billed": {
        const g = group(fin.filter((b) => inRange(b.bill_date, r)), (b) => b.bill_date!.slice(0, 7));
        return {
          cols: [c("Month", "month"), c("Bills", "count", true), money("Billed (₹)", "billed")],
          rows: [...g].sort().map(([m, xs]) => ({ month: `${m.slice(5)}-${m.slice(0, 4)}`, count: xs.length, billed: xs.reduce((s, x) => s + Number(x.total), 0) })),
        };
      }
      case "monthly_received": {
        const g = group(validPays, (p) => p.payment_date.slice(0, 7));
        return {
          cols: [c("Month", "month"), c("Payments", "count", true), money("Received (₹)", "amount"), money("of which historical (₹)", "hist")],
          rows: [...g].sort().map(([m, xs]) => ({ month: `${m.slice(5)}-${m.slice(0, 4)}`, count: xs.length, amount: xs.reduce((s, x) => s + Number(x.amount), 0), hist: xs.filter((x) => x.is_historical).reduce((s, x) => s + Number(x.amount), 0) })),
          note: "Only payments actually recorded; adjustments are excluded.",
        };
      }
      case "bank_outstanding": {
        const g = group(fin.filter((b) => Number(b.outstanding) > 0 && inRange(b.bill_date, r)), (b) => b.bank_name!);
        return {
          cols: [c("Bank", "bank"), c("Pending bills", "count", true), money("Billed (₹)", "total"), money("Received (₹)", "received"), money("Adjusted (₹)", "adjusted"), money("Outstanding (₹)", "outstanding")],
          rows: [...g].map(([k, xs]) => ({ bank: k, count: xs.length, total: sum(xs, "total"), received: sum(xs, "received"), adjusted: sum(xs, "adjusted"), outstanding: sum(xs, "outstanding") })),
        };
      }
      case "branch_pending": {
        const g = group(fin.filter((b) => Number(b.outstanding) > 0 && inRange(b.bill_date, r)), (b) => `${b.bank_name}|${b.branch_name}`);
        return {
          cols: [c("Bank", "bank"), c("Branch", "branch"), c("Pending bills", "count", true), c("Unpaid", "unpaid", true), c("Partial", "partial", true), money("Billed (₹)", "total"), money("Received (₹)", "received"), money("Outstanding (₹)", "outstanding")],
          rows: [...g].map(([k, xs]) => ({ bank: k.split("|")[0], branch: k.split("|")[1], count: xs.length, unpaid: xs.filter((x) => x.payment_status === "unpaid").length, partial: xs.filter((x) => x.payment_status === "partial").length, total: sum(xs, "total"), received: sum(xs, "received"), outstanding: sum(xs, "outstanding") })),
        };
      }
      case "not_submitted":
        return {
          cols: [c("Opinion No", "no"), c("Borrower", "borrower"), c("Bank", "bank"), c("Branch", "branch"), c("Docs received", "received"), c("Status", "status"), c("Assigned", "staff")],
          rows: (ops.data ?? []).filter((o) => o.status !== "submitted" && bf(o) && inRange(o.docs_received_date ?? o.created_at, r)).map((o) => ({ no: o.opinion_no, borrower: o.borrower_name, bank: L.bankName(o.bank_id), branch: L.branchName(o.branch_id), received: fmtDate(o.docs_received_date), status: OPINION_STATUS[o.status], staff: L.userName(o.assigned_to) })),
        };
      case "submitted_unpaid":
        return {
          cols: billCols(c, money),
          rows: fin.filter((b) => b.opinion_status === "submitted" && Number(b.outstanding) > 0 && inRange(b.submission_date, r)).map(billRow),
        };
      case "paid_partial":
        return {
          cols: billCols(c, money),
          rows: fin.filter((b) => ["paid", "partial", "settled"].includes(b.payment_status!) && inRange(b.bill_date, r)).map(billRow),
        };
      case "borrower": {
        const g = group(fin.filter((b) => inRange(b.bill_date, r)), (b) => b.borrower_name!);
        return {
          cols: [c("Borrower", "borrower"), c("Bills", "count", true), money("Billed (₹)", "total"), money("Received (₹)", "received"), money("Adjusted (₹)", "adjusted"), money("Outstanding (₹)", "outstanding"), c("Last payment", "last")],
          rows: [...g].sort().map(([k, xs]) => ({ borrower: k, count: xs.length, total: sum(xs, "total"), received: sum(xs, "received"), adjusted: sum(xs, "adjusted"), outstanding: sum(xs, "outstanding"), last: fmtDate(xs.map((x) => x.last_payment_date ?? "").sort().at(-1) || null) })),
        };
      }
      case "datewise_payments":
        return {
          cols: [c("Payment date", "date"), c("Bill", "bill"), c("Borrower", "borrower"), c("Bank", "bank"), c("Branch", "branch"), money("Amount (₹)", "amount"), c("Method", "method"), c("Reference", "ref"), c("Type", "type"), c("Recorded by", "by"), c("Entered", "at")],
          rows: [...validPays].sort((a, b) => a.payment_date.localeCompare(b.payment_date)).map((p) => { const b = billMap.get(p.bill_id)!; return { date: fmtDate(p.payment_date), bill: b.bill_no, borrower: b.borrower_name, bank: b.bank_name, branch: b.branch_name, amount: Number(p.amount), method: p.method, ref: p.reference, type: p.is_historical ? "Historical" : "Recorded", by: L.userName(p.recorded_by), at: fmtDateTime(p.created_at) }; }),
        };
      case "adjustments":
        return {
          cols: [c("Date", "date"), c("Bill", "bill"), c("Borrower", "borrower"), c("Bank", "bank"), c("Branch", "branch"), c("Type", "type"), money("Amount (₹)", "amount"), c("Reason", "reason"), c("Approved by", "by")],
          rows: (adjs.data ?? []).filter((a) => !a.reversed_at && inRange(a.adjustment_date, r) && billMap.get(a.bill_id) && bf(billMap.get(a.bill_id)!)).map((a) => { const b = billMap.get(a.bill_id)!; return { date: fmtDate(a.adjustment_date), bill: b.bill_no, borrower: b.borrower_name, bank: b.bank_name, branch: b.branch_name, type: ADJ_TYPE[a.type], amount: Number(a.amount), reason: a.reason, by: L.userName(a.approved_by) }; }),
          note: "Adjustments are not money received and are excluded from collections.",
        };
      case "staff_activity": {
        const g = group(audit.data ?? [], (a) => `${a.changed_by ?? ""}|${a.table_name}|${a.action}`);
        return {
          cols: [c("Staff", "staff"), c("Record type", "table"), c("Action", "action"), c("Count", "count", true), c("Last activity", "last")],
          rows: [...g].map(([k, xs]) => { const [u, t, a] = k.split("|"); return { staff: u ? L.userName(u) : "System", table: t.replace(/_/g, " "), action: a, count: xs.length, last: fmtDateTime(xs[0].changed_at) }; }).sort((a, b) => String(a.staff).localeCompare(String(b.staff))),
        };
      }
      case "import_results":
        return {
          cols: [c("File", "file"), c("Imported on", "at"), c("Row", "row"), c("Result", "status"), c("Messages", "msg")],
          rows: (imports.data ?? []).map((x) => { const b = x.import_batches as { file_name: string; created_at: string } | null; return { file: b?.file_name ?? "", at: fmtDateTime(b?.created_at), row: x.row_number, status: x.status, msg: (x.messages ?? []).join(" | ") }; }),
        };
    }
  }, [rk, bills.data, pays.data, adjs.data, ops.data, audit.data, imports.data, r.from, r.to, bank, branch, L]);

  if (bills.isLoading || ops.isLoading) return <Loading />;
  const sheet = buildSheet(report.rows, report.cols);
  const available = (Object.keys(REPORTS) as RKey[]).filter((k) => k !== "staff_activity" || me.isAdmin);

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Filters apply to the preview and to exports. Totals are included." />
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Field label="Report">
          <NativeSelect value={rk} onChange={(e) => setRk(e.target.value as RKey)}>
            {available.map((k) => <option key={k} value={k}>{REPORTS[k]}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Period"><RangePicker value={range} onChange={setRange} /></Field>
        <Field label="Bank">
          <NativeSelect value={bank} onChange={(e) => { setBank(e.target.value); setBranch(""); }}>
            <option value="">All banks</option>{L.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Branch">
          <NativeSelect value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">All branches</option>{L.branches.filter((b) => !bank || b.bank_id === bank).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Card2
        title={REPORTS[rk]}
        actions={<ExportButtons onExport={(f) => exportRows(report.rows, report.cols, rk.replace(/_/g, "-"), f, `H R DORA, ADVOCATE — ${REPORTS[rk]}`)} />}
      >
        {report.note && <p className="mb-3 text-xs text-muted-foreground">{report.note}</p>}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>{sheet[0].map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {sheet.slice(1).map((row, i) => {
                const isTotal = row[0] === "TOTAL" && i === sheet.length - 2;
                return (
                  <tr key={i} className={isTotal ? "bg-accent font-semibold" : ""}>
                    {row.map((v, j) => (
                      <td key={j} className="whitespace-nowrap px-3 py-2">
                        {typeof v === "number" && String(report.cols[j]?.header).includes("₹") ? inr(v) : v}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!report.rows.length && <div className="p-6 text-center text-sm text-muted-foreground">No data for these filters.</div>}
        </div>
      </Card2>
    </div>
  );
}

function sum<T extends Record<string, unknown>>(xs: T[], k: keyof T) {
  return Math.round(xs.reduce((s, x) => s + Number(x[k] ?? 0), 0) * 100) / 100;
}
function billCols(c: (h: string, k: string, t?: boolean) => ExportCol<Row>, money: (h: string, k: string) => ExportCol<Row>) {
  return [c("Bill", "bill"), c("Opinion", "op"), c("Borrower", "borrower"), c("Bank", "bank"), c("Branch", "branch"), c("Submitted", "sub"), money("Total (₹)", "total"), money("Received (₹)", "received"), money("Adjusted (₹)", "adjusted"), money("Outstanding (₹)", "outstanding"), c("Status", "status")];
}
function billRow(b: Tables<"bill_summary">): Row {
  return { bill: b.bill_no, op: b.opinion_no, borrower: b.borrower_name, bank: b.bank_name, branch: b.branch_name, sub: fmtDate(b.submission_date), total: Number(b.total), received: Number(b.received), adjusted: Number(b.adjusted), outstanding: Number(b.outstanding), status: PAYMENT_STATUS[b.payment_status!] };
}
