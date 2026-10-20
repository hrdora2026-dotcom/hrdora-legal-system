import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card2, DataTable, Loading, OpinionBadge, PageHeader, PayBadge, StatCard, Td } from "@/components/app/ui";
import { useBanks, useBillSummary, useBranches, useOpinions, usePayments } from "@/lib/data";
import { computeStats } from "@/components/app/branchStats";
import { fmtDate, inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/branches/$id")({
  head: () => ({ meta: [{ title: "Branch — H R DORA, ADVOCATE" }] }),
  component: BranchPage,
});

function BranchPage() {
  const { id } = Route.useParams();
  const branch = (useBranches().data ?? []).find((b) => b.id === id);
  const bank = (useBanks().data ?? []).find((b) => b.id === branch?.bank_id);
  const ops = (useOpinions().data ?? []).filter((o) => o.branch_id === id);
  const bills = (useBillSummary().data ?? []).filter((b) => b.branch_id === id);
  const billIds = new Set(bills.map((b) => b.bill_id));
  const pays = (usePayments().data ?? []).filter((p) => billIds.has(p.bill_id));
  if (!branch || !bank) return <Loading />;
  const s = computeStats(ops, bills);
  const bmap = new Map(bills.map((b) => [b.bill_id, b]));
  return (
    <div className="space-y-5">
      <PageHeader
        title={branch.name}
        subtitle={`${bank.name}${branch.city ? ` · ${branch.city}` : ""}${branch.contact ? ` · ${branch.contact}` : ""}`}
        actions={<Button variant="outline" asChild><Link to="/banks/$id" params={{ id: bank.id }}>{bank.name}</Link></Button>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total opinions" value={s.opinions} />
        <StatCard label="Not submitted" value={s.notSubmitted} />
        <StatCard label="Total bills" value={s.bills} />
        <StatCard tone="navy" label="Billed" value={inr(s.billed)} />
        <StatCard tone="navy" label="Payments recorded" value={inr(s.received)} />
        <StatCard tone="gold" label="Outstanding" value={inr(s.outstanding)} />
        <StatCard label="Unpaid bills" value={s.unpaid} />
        <StatCard label="Partially paid" value={s.partial} />
        <StatCard label="Paid / settled" value={s.paid} />
      </div>
      <Card2 title="Opinions">
        <DataTable head={["Opinion", "Borrower", "Received", "Status", "Submitted"]} empty={!ops.length}>
          {ops.map((o) => (
            <tr key={o.id}>
              <Td><Link to="/opinions/$id" params={{ id: o.id }} className="text-primary hover:underline">{o.opinion_no}</Link></Td>
              <Td>{o.borrower_name}</Td><Td>{fmtDate(o.docs_received_date)}</Td><Td><OpinionBadge s={o.status} /></Td><Td>{fmtDate(o.submission_date)}</Td>
            </tr>
          ))}
        </DataTable>
      </Card2>
      <Card2 title="Bills">
        <DataTable head={["Bill", "Borrower", "Total", "Received", "Outstanding", "Status"]} empty={!bills.length}>
          {bills.map((b) => (
            <tr key={b.bill_id}>
              <Td><Link to="/bills/$id" params={{ id: b.bill_id! }} className="text-primary hover:underline">{b.bill_no}</Link></Td>
              <Td>{b.borrower_name}</Td><Td>{inr(b.total)}</Td><Td>{inr(b.received)}</Td><Td className="font-semibold">{inr(b.outstanding)}</Td>
              <Td><PayBadge s={b.bill_status === "finalized" ? b.payment_status : null} /></Td>
            </tr>
          ))}
        </DataTable>
      </Card2>
      <Card2 title="Payment history">
        <DataTable head={["Date", "Bill", "Borrower", "Amount", "Status"]} empty={!pays.length}>
          {pays.map((p) => (
            <tr key={p.id} className={p.reversal ? "text-muted-foreground" : ""}>
              <Td>{fmtDate(p.payment_date)}</Td>
              <Td><Link to="/bills/$id" params={{ id: p.bill_id }} className="text-primary hover:underline">{bmap.get(p.bill_id)?.bill_no}</Link></Td>
              <Td>{bmap.get(p.bill_id)?.borrower_name}</Td>
              <Td className={p.reversal ? "line-through" : ""}>{inr(p.amount)}</Td>
              <Td className="text-xs">{p.reversal ? "Reversed" : p.is_historical ? "Historical" : "Valid"}</Td>
            </tr>
          ))}
        </DataTable>
      </Card2>
    </div>
  );
}
