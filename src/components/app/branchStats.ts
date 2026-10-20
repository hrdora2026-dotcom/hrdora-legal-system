import type { BillSummary, Opinion } from "@/lib/data";

export type Stats = {
  opinions: number;
  notSubmitted: number;
  bills: number;
  billed: number;
  received: number;
  outstanding: number;
  unpaid: number;
  partial: number;
  paid: number;
};

export function computeStats(ops: Opinion[], bills: BillSummary[]): Stats {
  const fin = bills.filter((b) => b.bill_status === "finalized");
  return {
    opinions: ops.length,
    notSubmitted: ops.filter((o) => o.status !== "submitted").length,
    bills: fin.length,
    billed: fin.reduce((s, b) => s + Number(b.total), 0),
    received: fin.reduce((s, b) => s + Number(b.received), 0),
    outstanding: fin.reduce((s, b) => s + Math.max(0, Number(b.outstanding)), 0),
    unpaid: fin.filter((b) => b.payment_status === "unpaid").length,
    partial: fin.filter((b) => b.payment_status === "partial").length,
    paid: fin.filter((b) => b.payment_status === "paid" || b.payment_status === "settled").length,
  };
}
