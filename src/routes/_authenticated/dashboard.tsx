import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdjustments, useBillSummary, useLookups, useOpinions, usePayments } from "@/lib/data";
import { inRange, resolveRange, type DateRange } from "@/lib/dates";
import { fmtDate, inr, num } from "@/lib/format";
import { Card2, DataTable, Loading, OpinionBadge, PageHeader, PayBadge, RangePicker, StatCard, Td } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — H R DORA, ADVOCATE" }] }),
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const [range, setRange] = useState<DateRange>({ key: "fy" });
  const r = resolveRange(range);
  const ops = useOpinions();
  const bills = useBillSummary();
  const pays = usePayments();
  const adjs = useAdjustments();
  const L = useLookups();

  const d = useMemo(() => {
    const o = (ops.data ?? []).filter((x) => inRange(x.docs_received_date ?? x.created_at, r));
    const b = (bills.data ?? []).filter((x) => x.bill_status === "finalized" && inRange(x.bill_date, r));
    const p = (pays.data ?? []).filter((x) => !x.reversal && inRange(x.payment_date, r));
    const a = (adjs.data ?? []).filter((x) => !x.reversed_at && inRange(x.adjustment_date, r));
    const cnt = (s: string) => o.filter((x) => x.status === s).length;

    const months = new Map<string, { month: string; billed: number; collected: number }>();
    const mk = (d: string) => d.slice(0, 7);
    for (const x of b) {
      const k = mk(x.bill_date!);
      const m = months.get(k) ?? { month: k, billed: 0, collected: 0 };
      m.billed += num(x.total);
      months.set(k, m);
    }
    for (const x of p) {
      const k = mk(x.payment_date);
      const m = months.get(k) ?? { month: k, billed: 0, collected: 0 };
      m.collected += num(x.amount);
      months.set(k, m);
    }
    const monthly = [...months.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((m) => ({ ...m, label: `${m.month.slice(5)}-${m.month.slice(0, 4)}` }));

    const pending = (bills.data ?? []).filter((x) => x.bill_status === "finalized" && num(x.outstanding) > 0);
    const byBank = new Map<string, number>();
    const byBranch = new Map<string, number>();
    for (const x of pending.filter((x) => inRange(x.bill_date, r))) {
      byBank.set(x.bank_name!, (byBank.get(x.bank_name!) ?? 0) + num(x.outstanding));
      const k = `${x.branch_name} (${x.bank_name})`;
      byBranch.set(k, (byBranch.get(k) ?? 0) + 1);
    }
    return {
      total: o.length,
      submitted: cnt("submitted"),
      billCount: b.length,
      billed: b.reduce((s, x) => s + num(x.total), 0),
      received: p.reduce((s, x) => s + num(x.amount), 0),
      outstanding: b.reduce((s, x) => s + Math.max(0, num(x.outstanding)), 0),
      partial: b.filter((x) => x.payment_status === "partial").length,
      paid: b.filter((x) => x.payment_status === "paid" || x.payment_status === "settled").length,
      adjusted: a.reduce((s, x) => s + num(x.amount), 0),
      adjCount: a.length,
      monthly,
      bank: [...byBank].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
      branch: [...byBranch].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
      recentOps: (ops.data ?? []).slice(0, 6),
      recentPays: (pays.data ?? []).slice(0, 6),
      pendingBills: [...pending].sort((a, b) => num(b.outstanding) - num(a.outstanding)).slice(0, 6),
      awaiting: (ops.data ?? []).filter((x) => x.status === "ready").slice(0, 6),
    };
  }, [ops.data, bills.data, pays.data, adjs.data, r.from, r.to]);

  if (ops.isLoading || bills.isLoading || pays.isLoading) return <Loading />;
  const billNo = new Map((bills.data ?? []).map((b) => [b.bill_id, b]));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Live figures from the shared register" actions={<RangePicker value={range} onChange={setRange} />} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Opinions received" value={d.total} />
        <StatCard label="Submitted" value={d.submitted} />
        <StatCard label="Bills generated" value={d.billCount} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard tone="navy" label="Total billed" value={inr(d.billed)} />
        <StatCard tone="navy" label="Amount received" value={inr(d.received)} sub="Actual money recorded" />
        <StatCard tone="gold" label="Outstanding" value={inr(d.outstanding)} />
        <StatCard label="Partially paid bills" value={d.partial} />
        <StatCard label="Fully paid / settled" value={d.paid} />
        <StatCard label="Discounts & write-offs" value={inr(d.adjusted)} sub={`${d.adjCount} approved`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card2 title="Monthly billing vs collections">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Legend />
                <Bar dataKey="billed" name="Billed" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card2>

        <Card2 title="Bank-wise outstanding">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.bank} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="value" name="Outstanding" fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card2>
        <Card2 title="Branch-wise pending bills">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.branch} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={150} />
                <Tooltip />
                <Bar dataKey="value" name="Pending bills" fill="var(--chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card2 title="Recent opinions" actions={<Link to="/opinions" className="text-sm text-primary hover:underline">View all</Link>}>
          <DataTable head={["Opinion", "Borrower", "Bank", "Status"]} empty={!d.recentOps.length}>
            {d.recentOps.map((o) => (
              <tr key={o.id}>
                <Td><Link to="/opinions/$id" params={{ id: o.id }} className="font-medium text-primary hover:underline">{o.opinion_no}</Link></Td>
                <Td>{o.borrower_name}</Td>
                <Td>{L.bankName(o.bank_id)}</Td>
                <Td><OpinionBadge s={o.status} /></Td>
              </tr>
            ))}
          </DataTable>
        </Card2>
        <Card2 title="Recently recorded payments" actions={<Link to="/payments" className="text-sm text-primary hover:underline">Ledger</Link>}>
          <DataTable head={["Date", "Bill", "Borrower", "Amount"]} empty={!d.recentPays.length}>
            {d.recentPays.map((p) => (
              <tr key={p.id} className={p.reversal ? "text-muted-foreground line-through" : ""}>
                <Td>{fmtDate(p.payment_date)}</Td>
                <Td><Link to="/bills/$id" params={{ id: p.bill_id }} className="text-primary hover:underline">{billNo.get(p.bill_id)?.bill_no}</Link></Td>
                <Td>{billNo.get(p.bill_id)?.borrower_name}</Td>
                <Td>{inr(p.amount)}</Td>
              </tr>
            ))}
          </DataTable>
        </Card2>
        <Card2 title="Top pending bills" actions={<Link to="/pending" className="text-sm text-primary hover:underline">All pending</Link>}>
          <DataTable head={["Bill", "Borrower", "Outstanding", "Status"]} empty={!d.pendingBills.length}>
            {d.pendingBills.map((b) => (
              <tr key={b.bill_id}>
                <Td><Link to="/bills/$id" params={{ id: b.bill_id! }} className="text-primary hover:underline">{b.bill_no}</Link></Td>
                <Td>{b.borrower_name}</Td>
                <Td className="font-semibold">{inr(b.outstanding)}</Td>
                <Td><PayBadge s={b.payment_status} /></Td>
              </tr>
            ))}
          </DataTable>
        </Card2>
       
      </div>
    </div>
  );
}
