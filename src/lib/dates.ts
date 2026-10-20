import { todayIST } from "./format";

export type RangeKey = "all" | "today" | "week" | "month" | "prev_month" | "fy" | "custom";
export type DateRange = { key: RangeKey; from?: string; to?: string };

export const RANGE_LABELS: Record<RangeKey, string> = {
  all: "All time",
  today: "Today",
  week: "This week",
  month: "This month",
  prev_month: "Previous month",
  fy: "Financial year",
  custom: "Custom range",
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function resolveRange(r: DateRange): { from?: string; to?: string } {
  const t = todayIST();
  const today = new Date(t + "T00:00:00Z");
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  switch (r.key) {
    case "today":
      return { from: t, to: t };
    case "week": {
      const dow = (today.getUTCDay() + 6) % 7; // Monday start
      const s = new Date(today);
      s.setUTCDate(today.getUTCDate() - dow);
      return { from: iso(s), to: t };
    }
    case "month":
      return { from: iso(new Date(Date.UTC(y, m, 1))), to: t };
    case "prev_month":
      return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
    case "fy": {
      const fyStart = m >= 3 ? y : y - 1;
      return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
    }
    case "custom":
      return { from: r.from || undefined, to: r.to || undefined };
    default:
      return {};
  }
}

export function inRange(d: string | null | undefined, r: { from?: string; to?: string }) {
  if (!r.from && !r.to) return true;
  if (!d) return false;
  const v = d.slice(0, 10);
  if (r.from && v < r.from) return false;
  if (r.to && v > r.to) return false;
  return true;
}
