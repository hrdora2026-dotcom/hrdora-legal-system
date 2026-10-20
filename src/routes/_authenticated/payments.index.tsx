import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useBillSummary, useLookups, usePayments } from "@/lib/data";
import { inRange, resolveRange, type DateRange } from "@/lib/dates";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { exportRows } from "@/lib/export";
import { DataTable, ExportButtons, Loading, NativeSelect, PageHeader, RangePicker, Td } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/payments/")({
  head: () => ({ meta: [{ title: "Payment Ledger — H R DORA, ADVOCATE" }] }),
  component: Ledger,
});

function Ledger() {
  const pays = usePayments();
  const bills = useBillSummary();
  const L = useLookups();
  const [range, setRange] = useState<DateRange>({ key: "month" });
  const [show, setShow] = useState("valid");
  const r = resolveRange(range);
  const bmap = useMemo(() => new Map((bills.data ?? []).map((b) => [b.bill_id, b])), [bills.data]);
  const rows = (pays.data ?? []).filter(
    (p) => inRange(p.payment_date, r) && (show === "all" || (show === "valid" ? !p.reversal : !!p.reversal)),
  );
  if (pays.isLoading) return <Loading />;
  const total = rows.filter((p) => !p.reversal).reduce((s, p) => s + Number(p.amount), 0);
  return (
    <div>
      <PageHeader
        title="Payment Ledger"
        subtitle="Every manually recorded payment. Reversed entries stay visible."
        actions={
          <>
            <RangePicker value={range} onChange={setRange} />
            <NativeSelect className="w-auto" value={show} onChange={(e) => setShow(e.target.value)}>
              <option value="valid">Valid payments</option><option value="reversed">Reversed only</option><option value="all">All entries</option>
            </NativeSelect>
            <ExportButtons
              onExport={(fmt) =>
                exportRows(rows, [
                  { header: "Payment Date", value: (p) => fmtDate(p.payment_date) },
                  { header: "Bill No", value: (p) => bmap.get(p.bill_id)?.bill_no },
                  { header: "Borrower", value: (p) => bmap.get(p.bill_id)?.borrower_name },
                  { header: "Bank", value: (p) => bmap.get(p.bill_id)?.bank_name },
                  { header: "Branch", value: (p) => bmap.get(p.bill_id)?.branch_name },
                  { header: "Amount (₹)", value: (p) => (p.reversal ? 0 : Number(p.amount)), total: true },
                  { header: "Method", value: (p) => p.method },
                  { header: "Reference", value: (p) => p.reference },
                  { header: "Remarks", value: (p) => p.remarks },
                  { header: "Historical", value: (p) => (p.is_historical ? "Yes" : "") },
                  { header: "Recorded By", value: (p) => L.userName(p.recorded_by) },
                  { header: "Entered At", value: (p) => fmtDateTime(p.created_at) },
                  { header: "Reversed", value: (p) => (p.reversal ? `Yes — ${p.reversal.reason}` : "") },
                ], "payments", fmt, "H R DORA, ADVOCATE — Manually recorded payments")
              }
            />
          </>
        }
      />
      <p className="mb-3 text-sm">Total actually received in view: <strong>{inr(total)}</strong> ({rows.length} entries)</p>
      <DataTable head={["Date", "Bill", "Borrower", "Bank / Branch", "Amount", "Method", "Reference", "Recorded by", "Status"]} empty={!rows.length}>
        {rows.map((p) => {
          const b = bmap.get(p.bill_id);
          return (
            <tr key={p.id} className={p.reversal ? "text-muted-foreground" : ""}>
              <Td>{fmtDate(p.payment_date)}</Td>
              <Td><Link to="/bills/$id" params={{ id: p.bill_id }} className="text-primary hover:underline">{b?.bill_no}</Link></Td>
              <Td>{b?.borrower_name}</Td>
              <Td>{b?.bank_name} / {b?.branch_name}</Td>
              <Td className={p.reversal ? "line-through" : "font-semibold"}>{inr(p.amount)}</Td>
              <Td>{p.method || "—"}</Td>
              <Td>{p.reference || "—"}</Td>
              <Td>{L.userName(p.recorded_by)}</Td>
              <Td className="text-xs">{p.reversal ? "Reversed" : p.is_historical ? "Historical" : "Valid"}</Td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
