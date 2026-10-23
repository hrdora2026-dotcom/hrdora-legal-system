import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { OPINION_STATUS, PAYMENT_STATUS } from "@/lib/format";
import { RANGE_LABELS, type DateRange, type RangeKey } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-primary sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-2 h-0.5 w-16 bg-gold" />
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function NativeSelect({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-card px-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-sm", className)}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const opTone: Record<string, string> = {
  received: "bg-secondary text-secondary-foreground",
  in_progress: "bg-info/15 text-info",
  ready: "bg-gold/25 text-gold-foreground",
  submitted: "bg-success/15 text-success",
  on_hold: "bg-muted text-muted-foreground",
};
const payTone: Record<string, string> = {
  unpaid: "bg-destructive/12 text-destructive",
  partial: "bg-warning/25 text-warning-foreground",
  paid: "bg-success/15 text-success",
  settled: "bg-info/15 text-info",
};

export function Badge2({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tone)}>{children}</span>;
}
export const OpinionBadge = ({ s }: { s?: string | null }) =>
  s ? <Badge2 tone={opTone[s] ?? ""}>{OPINION_STATUS[s] ?? s}</Badge2> : null;
export const PayBadge = ({ s }: { s?: string | null }) =>
  s ? <Badge2 tone={payTone[s] ?? ""}>{s === "settled" ? "Settled (Adjusted)" : (PAYMENT_STATUS[s] ?? s)}</Badge2> : <Badge2 tone="bg-muted text-muted-foreground">No bill</Badge2>;

export function StatCard({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: "gold" | "navy"; sub?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm",
        tone === "navy" && "border-primary bg-primary text-primary-foreground",
        tone === "gold" && "border-gold/60",
      )}
    >
      <div className={cn("text-xs font-medium uppercase tracking-wide", tone === "navy" ? "text-primary-foreground/70" : "text-muted-foreground")}>
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold sm:text-2xl">{value}</div>
      {sub && <div className={cn("mt-0.5 text-xs", tone === "navy" ? "text-primary-foreground/70" : "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}

export function RangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect className="w-auto" value={value.key} onChange={(e) => onChange({ ...value, key: e.target.value as RangeKey })}>
        {Object.entries(RANGE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </NativeSelect>
      {value.key === "custom" && (
        <>
          <Input type="date" className="h-9 w-auto" value={value.from ?? ""} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="h-9 w-auto" value={value.to ?? ""} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  );
}

export function ExportButtons({ onExport }: { onExport: (f: "xlsx" | "csv") => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => onExport("xlsx")}>
        <Download className="mr-1 h-4 w-4" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => onExport("csv")}>
        <Download className="mr-1 h-4 w-4" /> CSV
      </Button>
    </div>
  );
}

export function Card2({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          {title && <h2 className="text-base font-bold text-primary">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DataTable({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "whitespace-nowrap px-3 py-2 font-semibold",
                  i === 0 && "sticky left-0 z-30 min-w-16 border-r bg-muted",
                  i === 1 && "sticky left-16 z-30 min-w-40 border-r bg-muted",
                  i === 2 && "sticky left-56 z-30 min-w-48 border-r bg-muted",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
      {empty && <div className="p-6 text-center text-sm text-muted-foreground">No records found.</div>}
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("whitespace-nowrap px-3 py-2", className)}>{children}</td>
);

export function Loading() {
  return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
}
