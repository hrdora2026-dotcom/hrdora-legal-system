import Decimal from "decimal.js";
// Pure helpers mirroring the database rules (the database remains the source of truth).

export const round2 = (n: number) => new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

export function lineAmount(quantity: number, rate: number) {
  return new Decimal(quantity).times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function billTotal(items: { quantity: number; rate: number }[]) {
  return items.reduce((s, i) => s.plus(lineAmount(i.quantity, i.rate)), new Decimal(0)).toNumber();
}

export function outstanding(total: number, received: number, adjusted: number) {
  return new Decimal(total).minus(received).minus(adjusted).toDecimalPlaces(2).toNumber();
}

export type PayStatus = "unpaid" | "partial" | "paid" | "settled";

export function paymentStatus(total: number, received: number, adjusted: number): PayStatus {
  if (total <= 0) return "unpaid";
  const bal = outstanding(total, received, adjusted);
  if (bal <= 0 && adjusted > 0) return "settled";
  if (total - received <= 0) return "paid";
  if (received > 0 || adjusted > 0) return "partial";
  return "unpaid";
}

export type AgeBucket = "0-30" | "31-60" | "61-90" | "90+";

/** Days between two YYYY-MM-DD dates and the ageing bucket. */
export function ageDays(from: string, today: string) {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function ageBucket(days: number): AgeBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}
