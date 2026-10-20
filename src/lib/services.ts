export const SERVICE_TYPES = ["Legal Opinion", "Vetting", "Supplementary Opinion"] as const;
export type ServiceType = typeof SERVICE_TYPES[number];
export const serviceLabel = (value?: string | null) => value || "Unknown — review required";
export function matchesService(value: string | null | undefined, filter: string) {
  return !filter || (filter === "unknown" ? !value : value === filter);
}
export function parseService(value: unknown): ServiceType | null {
  const text = String(value ?? "").trim().toLowerCase();
  return SERVICE_TYPES.find((s) => s.toLowerCase() === text) ?? null;
}