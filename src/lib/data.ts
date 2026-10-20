import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Bank = Tables<"banks">;
export type Branch = Tables<"branches">;
export type Opinion = Tables<"opinions">;
export type Bill = Tables<"bills">;
export type BillItem = Tables<"bill_items">;
export type BillSummary = Tables<"bill_summary">;
export type Payment = Tables<"payments"> & { reversal: Tables<"payment_reversals"> | null };
export type Adjustment = Tables<"adjustments">;
export type Profile = Tables<"profiles">;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Fetch every row by paging past the 1000-row API limit. */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

export const keys = {
  me: ["me"],
  banks: ["banks"],
  branches: ["branches"],
  profiles: ["profiles"],
  opinions: ["opinions"],
  bills: ["bill_summary"],
  payments: ["payments"],
  adjustments: ["adjustments"],
};

export const useBanks = () =>
  useQuery({
    queryKey: keys.banks,
    queryFn: () => fetchAll<Bank>((f, t) => supabase.from("banks").select("*").order("name").range(f, t)),
  });

export const useBranches = () =>
  useQuery({
    queryKey: keys.branches,
    queryFn: () => fetchAll<Branch>((f, t) => supabase.from("branches").select("*").order("name").range(f, t)),
  });

export const useProfiles = () =>
  useQuery({
    queryKey: keys.profiles,
    queryFn: () => fetchAll<Profile>((f, t) => supabase.from("profiles").select("*").order("full_name").range(f, t)),
  });

export const useOpinions = () =>
  useQuery({
    queryKey: keys.opinions,
    queryFn: () =>
      fetchAll<Opinion>((f, t) =>
        supabase.from("opinions").select("*").order("created_at", { ascending: false }).range(f, t),
      ),
  });

export const useBillSummary = () =>
  useQuery({
    queryKey: keys.bills,
    queryFn: () =>
      fetchAll<BillSummary>((f, t) =>
        supabase.from("bill_summary").select("*").order("created_at", { ascending: false }).range(f, t),
      ),
  });

export const usePayments = () =>
  useQuery({
    queryKey: keys.payments,
    queryFn: async () => {
      const rows = await fetchAll<Tables<"payments"> & { payment_reversals: unknown }>((f, t) =>
        supabase
          .from("payments")
          .select("*, payment_reversals(*)")
          .order("created_at", { ascending: false })
          .range(f, t),
      );
      return rows.map((r) => {
        const rv = r.payment_reversals as Tables<"payment_reversals"> | Tables<"payment_reversals">[] | null;
        const { payment_reversals: _omit, ...rest } = r;
        return { ...rest, reversal: Array.isArray(rv) ? (rv[0] ?? null) : rv } as Payment;
      });
    },
  });

export const useAdjustments = () =>
  useQuery({
    queryKey: keys.adjustments,
    queryFn: () =>
      fetchAll<Adjustment>((f, t) =>
        supabase.from("adjustments").select("*").order("created_at", { ascending: false }).range(f, t),
      ),
  });

/** Name lookups for ids. */
export function useLookups() {
  const banks = useBanks().data ?? [];
  const branches = useBranches().data ?? [];
  const profiles = useProfiles().data ?? [];
  return useMemo(() => {
    const b = new Map(banks.map((x) => [x.id, x.name]));
    const br = new Map(branches.map((x) => [x.id, x.name]));
    const p = new Map(profiles.map((x) => [x.id, x.full_name || x.email || "—"]));
    return {
      bankName: (id?: string | null) => (id ? (b.get(id) ?? "—") : "—"),
      branchName: (id?: string | null) => (id ? (br.get(id) ?? "—") : "—"),
      userName: (id?: string | null) => (id ? (p.get(id) ?? "—") : "—"),
      banks,
      branches,
      profiles,
    };
  }, [banks, branches, profiles]);
}

/** Live sync: any change on another device refreshes data here. */
export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" }), 300);
    };
    const tables = [
      "opinions",
      "bills",
      "bill_items",
      "payments",
      "payment_reversals",
      "adjustments",
      "followup_notes",
      "banks",
      "branches",
    ];
    let ch = supabase.channel("hr-dora-sync");
    for (const t of tables) ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, refresh);
    ch.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
