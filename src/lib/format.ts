
const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const inr = (value: number | string | null | undefined): string => {
  const amount = Number(value ?? 0);
  return inrFmt.format(Number.isFinite(amount) ? amount : 0);
};

export const num = (value: number | string | null | undefined): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

export function fmtDate(d?: string | null): string {
  if (!d) return "—";

  // Date-only values must not be shifted by timezone conversion.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [year, month, day] = d.split("-");
    return `${day}-${month}-${year}`;
  }

  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(dt)
    .replace(/\//g, "-");
}

export function fmtDateTime(d?: string | null): string {
  if (!d) return "—";

  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(dt)
    .replace(/\//g, "-");
}

export function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Generate a UUID for payment idempotency keys and other unique identifiers.
 * Uses cryptographically secure browser APIs only.
 */
export function makeUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));

    // Set UUID version 4 and RFC 4122 variant bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
  }

  throw new Error(
    "Secure UUID generation is unavailable. Please open the application using localhost or HTTPS."
  );
}

export const OPINION_STATUS = {
  received: "Received",
  in_progress: "In Progress",
  ready: "Not Yet Submitted",
  submitted: "Submitted to Bank",
  on_hold: "On Hold",
} as const;

export const PAYMENT_STATUS = {
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
} as const;

export const CHARGE_CATEGORY = {
  legal_opinion: "Legal Opinion Charges",
  ec: "EC",
  single_search: "Single Search",
  document: "Document",
  other: "Other",
  custom: "Custom",
} as const;

export const ADJ_TYPE = {
  discount: "Discount",
  write_off: "Write-off",
  settlement: "Settlement",
} as const;

export const PERMISSIONS = [
  "manage_masters",
  "manage_users",
  "manage_opinions",
  "manage_bills",
  "record_payments",
  "approve_adjustments",
  "view_reports",
  "view_audit_logs",
] as const;

export function errMsg(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error ?? "An unexpected error occurred.");
}
