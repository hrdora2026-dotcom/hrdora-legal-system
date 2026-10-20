import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect } from "@/components/app/ui";
import { useLookups, useOpinions, type Opinion } from "@/lib/data";
import { OPINION_STATUS, fmtDate } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

import { SERVICE_TYPES, type ServiceType } from "@/lib/services";

export type OpinionInput = {
  service_type: ServiceType | "";
  borrower_name: string;
  bank_id: string;
  branch_id: string;
  docs_received_date: string | null;
  docs_description: string | null;
  assigned_to: string | null;
  remarks: string | null;
  status: Opinion["status"];
  submission_date: string | null;
  submission_ref: string | null;
};

export function OpinionForm({
  initial,
  onSubmit,
  busy,
  submitLabel,
}: {
  initial?: Opinion;
  onSubmit: (v: OpinionInput) => void;
  busy?: boolean;
  submitLabel: string;
}) {
  const L = useLookups();
  const all = useOpinions().data ?? [];
  const [v, setV] = useState<OpinionInput>({
    borrower_name: initial?.borrower_name ?? "",
    service_type: (initial?.service_type as ServiceType | null) ?? "",
    bank_id: initial?.bank_id ?? "",
    branch_id: initial?.branch_id ?? "",
    docs_received_date: initial?.docs_received_date ?? null,
    docs_description: initial?.docs_description ?? null,
    assigned_to: initial?.assigned_to ?? null,
    remarks: initial?.remarks ?? null,
    status: initial?.status ?? "received",
    submission_date: initial?.submission_date ?? null,
    submission_ref: initial?.submission_ref ?? null,
  });
  const set = <K extends keyof OpinionInput>(k: K, val: OpinionInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const branches = L.branches.filter((b) => b.bank_id === v.bank_id && (b.active || b.id === initial?.branch_id));

  const dupes = useMemo(() => {
    const n = v.borrower_name.trim().toLowerCase();
    if (n.length < 3) return [];
    return all.filter(
      (o) =>
        o.id !== initial?.id &&
        o.borrower_name.trim().toLowerCase() === n &&
        (!v.branch_id || o.branch_id === v.branch_id),
    );
  }, [v.borrower_name, v.branch_id, all, initial?.id]);

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...v,
          borrower_name: v.borrower_name.trim(),
          docs_received_date: v.docs_received_date || null,
          submission_date: v.submission_date || null,
          assigned_to: v.assigned_to || null,
        });
      }}
    >
      <Field label="Borrower name *" className="md:col-span-2">
        <Input required value={v.borrower_name} onChange={(e) => set("borrower_name", e.target.value)} />
      </Field>
      {dupes.length > 0 && (
        <div className="flex gap-2 rounded-md border border-warning bg-warning/15 p-3 text-sm md:col-span-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground" />
          <div>
            <strong>Possible duplicate:</strong> {dupes.length} existing opinion(s) for this borrower
            {v.branch_id ? " at this branch" : ""}:{" "}
            {dupes.slice(0, 4).map((d) => `${d.opinion_no} (${fmtDate(d.docs_received_date)})`).join(", ")}. You can still save if this
            is a genuine repeat case.
          </div>
        </div>
      )}
      <Field label="Service Type *"><NativeSelect required value={v.service_type} onChange={(e) => set("service_type", e.target.value as ServiceType)}><option value="">Select service type</option>{SERVICE_TYPES.map((type) => <option key={type}>{type}</option>)}</NativeSelect></Field>
      <Field label="Bank *">
        <NativeSelect required value={v.bank_id} onChange={(e) => setV((p) => ({ ...p, bank_id: e.target.value, branch_id: "" }))}>
          <option value="">Select bank</option>
          {L.banks
            .filter((b) => b.active || b.id === initial?.bank_id)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </NativeSelect>
      </Field>
      <Field label="Branch *" hint={v.bank_id && !branches.length ? "No branches yet — add one in Banks & Branches." : undefined}>
        <NativeSelect required value={v.branch_id} disabled={!v.bank_id} onChange={(e) => set("branch_id", e.target.value)}>
          <option value="">Select branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Documents received date">
        <Input type="date" value={v.docs_received_date ?? ""} onChange={(e) => set("docs_received_date", e.target.value)} />
      </Field>
      <Field label="Assigned staff">
        <NativeSelect value={v.assigned_to ?? ""} onChange={(e) => set("assigned_to", e.target.value)}>
          <option value="">Unassigned</option>
          {L.profiles
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
        </NativeSelect>
      </Field>
      <Field label="Description of documents received" className="md:col-span-2">
        <Textarea rows={3} value={v.docs_description ?? ""} onChange={(e) => set("docs_description", e.target.value)} />
      </Field>
      <Field label="Opinion status">
        <NativeSelect value={v.status} onChange={(e) => set("status", e.target.value as Opinion["status"])}>
          {Object.entries(OPINION_STATUS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Submission date" hint={v.status === "submitted" && !v.submission_date ? "Will default to today" : undefined}>
        <Input type="date" value={v.submission_date ?? ""} onChange={(e) => set("submission_date", e.target.value)} />
      </Field>
      <Field label="Submission reference">
        <Input value={v.submission_ref ?? ""} onChange={(e) => set("submission_ref", e.target.value)} />
      </Field>
      <Field label="Remarks">
        <Input value={v.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} />
      </Field>
      <div className="md:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
