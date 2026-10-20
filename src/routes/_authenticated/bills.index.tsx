import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceFilter } from "@/components/app/ServiceFilter";
import { matchesService, serviceLabel } from "@/lib/services";
import { Input } from "@/components/ui/input";
import { useBillSummary, useLookups } from "@/lib/data";
import { fmtDate, inr, PAYMENT_STATUS } from "@/lib/format";
import { exportRows } from "@/lib/export";
import { DataTable, ExportButtons, Field, Loading, NativeSelect, PageHeader, PayBadge, Td } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/bills/")({
  head: () => ({ meta: [{ title: "Bills — H R DORA, ADVOCATE" }] }),
  component: Bills,
});

function Bills() {
  const bills = useBillSummary();
  const L = useLookups();
  const [f, setF] = useState({ q: "", bank: "", branch: "", pay: "", status: "", service: "" });
  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return (bills.data ?? []).filter(
      (b) =>
        (!q || [b.borrower_name, b.bill_no, b.opinion_no].some((x) => x?.toLowerCase().includes(q))) &&
        matchesService(b.service_type, f.service) &&
      (!f.bank || b.bank_id === f.bank) &&
        (!f.branch || b.branch_id === f.branch) &&
        (!f.status || b.bill_status === f.status) &&
        (!f.pay || (b.bill_status === "finalized" && b.payment_status === f.pay)),
    );
  }, [bills.data, f]);
  if (bills.isLoading) return <Loading />;
  if (bills.isError) return <div role="alert">Bills could not be loaded. <Button onClick={() => bills.refetch()}>Retry</Button></div>;
  const sum = (k: "total" | "received" | "adjusted" | "outstanding") => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  return (
    <div>
      <PageHeader
        title="Bills"
        subtitle={`${rows.length} bills`}
        actions={
          <><Button asChild><Link to="/bills/new" search={{ opinion: "" }}><Plus />Create New Bill</Link></Button><ExportButtons
            onExport={(fmt) =>
              exportRows(rows, [
                { header: "Bill No", value: (b) => b.bill_no },
                { header: "Bill Date", value: (b) => fmtDate(b.bill_date) },
                { header: "Opinion No", value: (b) => b.opinion_no },
                { header: "Borrower", value: (b) => b.borrower_name },
                { header: "Service Type", value: (b) => serviceLabel(b.service_type) },
                { header: "Bank", value: (b) => b.bank_name },
                { header: "Branch", value: (b) => b.branch_name },
                { header: "Bill Status", value: (b) => b.bill_status },
                { header: "Total (₹)", value: (b) => Number(b.total), total: true },
                { header: "Received (₹)", value: (b) => Number(b.received), total: true },
                { header: "Adjusted (₹)", value: (b) => Number(b.adjusted), total: true },
                { header: "Outstanding (₹)", value: (b) => Number(b.outstanding), total: true },
                { header: "Payment Status", value: (b) => PAYMENT_STATUS[b.payment_status ?? ""] ?? "—" },
              ], "bills", fmt, "H R DORA, ADVOCATE — Bills")
            }
          /></>
        }
      />
      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Search borrower / bill / opinion"><Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></Field>
        <ServiceFilter value={f.service} onChange={(service) => setF({ ...f, service })} />
        <Field label="Bank">
          <NativeSelect value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value, branch: "" })}>
            <option value="">All</option>
            {L.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Branch">
          <NativeSelect value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>
            <option value="">All</option>
            {L.branches.filter((b) => !f.bank || b.bank_id === f.bank).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Bill status">
          <NativeSelect value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">All</option><option value="draft">Draft</option><option value="finalized">Finalized</option>
          </NativeSelect>
        </Field>
        <Field label="Payment status">
          <NativeSelect value={f.pay} onChange={(e) => setF({ ...f, pay: e.target.value })}>
            <option value="">All</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        <span>Billed: <strong>{inr(sum("total"))}</strong></span>
        <span>Received: <strong>{inr(sum("received"))}</strong></span>
        <span>Adjusted: <strong>{inr(sum("adjusted"))}</strong></span>
        <span>Outstanding: <strong>{inr(sum("outstanding"))}</strong></span>
      </div>
      <DataTable head={["Bill No", "Date", "Borrower", "Service Type", "Bank / Branch", "Status", "Total", "Received", "Outstanding", "Payment"]} empty={!rows.length}>
        {rows.filter((b) => Boolean(b.bill_id)).map((b) => (
          <tr key={b.bill_id} className="hover:bg-muted/50">
            <Td><Link to="/bills/$id" params={{ id: b.bill_id ?? "" }} className="font-medium text-primary hover:underline">{b.bill_no}</Link></Td>
            <Td>{fmtDate(b.bill_date)}</Td>
            <Td>{b.borrower_name}</Td><Td>{serviceLabel(b.service_type)}</Td>
            <Td>{b.bank_name} / {b.branch_name}</Td>
            <Td className="capitalize">{b.bill_status}</Td>
            <Td>{inr(b.total)}</Td>
            <Td>{inr(b.received)}</Td>
            <Td className="font-semibold">{inr(b.outstanding)}</Td>
            <Td><PayBadge s={b.bill_status === "finalized" ? b.payment_status : null} /></Td>
          </tr>
        ))}
      </DataTable>
      {!rows.length && <div className="mt-4"><Button asChild><Link to="/bills/new" search={{ opinion: "" }}><Plus />Create New Bill</Link></Button></div>}
    </div>
  );
}
