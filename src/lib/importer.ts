import { parseService, type ServiceType } from "@/lib/services";
import * as XLSX from "xlsx";

export const IMPORT_FIELDS = [
  { key: "service_type", label: "Service Type", hints: ["service type", "service", "case type"] },
  { key: "borrower_name", label: "Borrower name", required: true, hints: ["borrower", "name", "party", "customer"] },
  { key: "bank", label: "Bank", required: true, hints: ["bank"] },
  { key: "branch", label: "Branch", required: true, hints: ["branch"] },
  { key: "opinion_no", label: "Opinion number", hints: ["opinion no", "opinion number", "op no", "sl", "ref"] },
  { key: "docs_received_date", label: "Documents received date", hints: ["received", "doc date", "date of receipt"] },
  { key: "submission_date", label: "Submission date", hints: ["submission", "submitted"] },
  { key: "legal_opinion", label: "Legal Opinion charges", hints: ["legal opinion", "opinion charge", "lo charge", "fees"] },
  { key: "ec", label: "EC charges", hints: ["ec"] },
  { key: "single_search", label: "Single Search charges", hints: ["search"] },
  { key: "document", label: "Document charges", hints: ["document charge", "doc charge"] },
  { key: "other", label: "Other charges", hints: ["other"] },
  { key: "total", label: "Total bill", hints: ["total", "bill amount"] },
  { key: "received", label: "Amount already received", hints: ["received amount", "amount received", "paid", "collected"] },
  { key: "outstanding", label: "Outstanding balance", hints: ["outstanding", "balance", "pending", "due"] },
  { key: "payment_date", label: "Payment date", hints: ["payment date", "paid on", "date of payment"] },
  { key: "remarks", label: "Remarks", hints: ["remark", "note"] },
] as const;

export type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Partial<Record<FieldKey, string>>;
const CHARGE_KEYS = ["legal_opinion", "ec", "single_search", "document", "other"] as const;

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<string>();
  // more specific fields first
  const order = [...IMPORT_FIELDS].sort((a, b) => Math.max(...b.hints.map((h) => h.length)) - Math.max(...a.hints.map((h) => h.length)));
  for (const f of order) {
    const h = headers.find((x) => !used.has(x) && f.hints.some((hint) => x.toLowerCase().includes(hint)));
    if (h) {
      m[f.key] = h;
      used.add(h);
    }
  }
  return m;
}

const pad = (n: number) => String(n).padStart(2, "0");
function validYMD(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y > 1950 && y < 2100;
}

/** Returns YYYY-MM-DD, null for blank, or undefined when invalid. */
export function parseDate(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p || !validYMD(p.y, p.m, p.d)) return undefined;
    return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  }
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validYMD(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : undefined;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return validYMD(y, +m[2], +m[1]) ? `${y}-${pad(+m[2])}-${pad(+m[1])}` : undefined;
  }
  return undefined;
}

/** Returns number, null for blank, or NaN when invalid. */
export function parseAmount(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/₹|rs\.?|inr|,|\s/gi, "");
  if (!s || s === "-") return null;
  const n = Number(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export type ValidatedRow = {
  row_number: number;
  status: "accepted" | "rejected" | "duplicate";
  messages: string[];
  raw: Record<string, unknown>;
  service_type: ServiceType | null;
  borrower_name: string;
  bank: string;
  branch: string;
  opinion_no: string;
  docs_received_date: string | null;
  submission_date: string | null;
  payment_date: string | null;
  remarks: string;
  charges: Partial<Record<(typeof CHARGE_KEYS)[number], number>>;
  bill_total: number;
  received: number;
  total_balancing: boolean;
};

export type Existing = { opinionNos: Set<string>; keys: Set<string> };
export const dupKey = (borrower: string, bank: string, branch: string, date: string | null) =>
  [borrower, bank, branch, date ?? ""].map((x) => x.trim().toLowerCase()).join("|");

export function validateRows(raw: Record<string, unknown>[], map: Mapping, existing: Existing): ValidatedRow[] {
  const seenNos = new Set<string>();
  const seenKeys = new Set<string>();
  return raw.map((r, i) => {
    const get = (k: FieldKey) => { const column = map[k]; return column ? r[column] : undefined; };
    const str = (k: FieldKey) => String(get(k) ?? "").trim();
    const msgs: string[] = [];
    let reject = false;
    let dup = false;
    const bad = (m: string) => {
      msgs.push(m);
      reject = true;
    };

    const service_type = parseService(get("service_type"));
    if (!service_type) msgs.push("Unknown service type — review required after import.");
    const borrower_name = str("borrower_name");
    const bank = str("bank");
    const branch = str("branch");
    if (!borrower_name) bad("Borrower name missing");
    if (!bank) bad("Bank missing");
    if (!branch) bad("Branch missing");

    const dates: Record<string, string | null> = {};
    for (const k of ["docs_received_date", "submission_date", "payment_date"] as const) {
      const d = parseDate(get(k));
      if (d === undefined) bad(`Invalid ${k.replace(/_/g, " ")}: "${String(get(k))}"`);
      dates[k] = d ?? null;
    }

    const amt = (k: FieldKey) => {
      const n = parseAmount(get(k));
      if (n !== null && (isNaN(n) || n < 0)) {
        bad(`Invalid amount in ${k.replace(/_/g, " ")}: "${String(get(k))}"`);
        return null;
      }
      return n;
    };
    const charges: ValidatedRow["charges"] = {};
    let sum = 0;
    let anyCharge = false;
    for (const k of CHARGE_KEYS) {
      const n = amt(k);
      if (n !== null && n > 0) {
        charges[k] = n;
        sum += n;
        anyCharge = true;
      }
    }
    sum = Math.round(sum * 100) / 100;
    const total = amt("total");
    let received = amt("received");
    const out = amt("outstanding");
    let total_balancing = false;

    if (anyCharge && total !== null && Math.abs(sum - total) > 0.01)
      bad(`Charges add up to ${sum} but total bill is ${total}`);
    if (!anyCharge && total !== null && total > 0) {
      charges.other = total;
      sum = total;
      total_balancing = true;
      msgs.push("Only a total is given — imported as one 'Other' line (no item breakdown).");
    }
    const bill = sum;
    if (bill === 0 && ((received ?? 0) > 0 || (out ?? 0) > 0)) bad("Received/outstanding given but no bill amount");
    if (received === null && out !== null && bill > 0) {
      received = Math.round((bill - out) * 100) / 100;
      if (received < 0) bad("Outstanding exceeds total bill");
      else if (received > 0) msgs.push(`Received derived from total − outstanding = ${received}.`);
    }
    if (received !== null && received > bill + 0.01) bad(`Received (${received}) exceeds bill total (${bill})`);
    if (received !== null && out !== null && Math.abs(bill - received - out) > 0.01)
      bad(`Does not reconcile: total ${bill} − received ${received} ≠ outstanding ${out}`);
    if ((received ?? 0) > 0)
      msgs.push(
        `Historical collection of ${received} will be stored as ONE clearly marked historical entry${dates.payment_date ? "" : " (payment date not in file)"} — individual payments are not invented.`,
      );

    const opinion_no = str("opinion_no");
    if (opinion_no) {
      const k = opinion_no.toLowerCase();
      if (existing.opinionNos.has(k)) bad(`Opinion number ${opinion_no} already exists in the register`);
      else if (seenNos.has(k)) bad(`Opinion number ${opinion_no} repeats within this file`);
      seenNos.add(k);
    }
    if (borrower_name && bank && branch) {
      const key = dupKey(borrower_name, bank, branch, dates.docs_received_date);
      if (existing.keys.has(key)) {
        dup = true;
        msgs.push("Possible duplicate: same borrower, bank, branch and received date already in the register.");
      } else if (seenKeys.has(key)) {
        dup = true;
        msgs.push("Possible duplicate: same borrower, bank, branch and received date appears earlier in this file.");
      }
      seenKeys.add(key);
    }

    return {
      row_number: i + 2,
      status: reject ? "rejected" : dup ? "duplicate" : "accepted",
      messages: msgs,
      raw: r,
      borrower_name,
      service_type,
      bank,
      branch,
      opinion_no,
      docs_received_date: dates.docs_received_date,
      submission_date: dates.submission_date,
      payment_date: dates.payment_date,
      remarks: str("remarks"),
      charges,
      bill_total: bill,
      received: received ?? 0,
      total_balancing,
    };
  });
}
