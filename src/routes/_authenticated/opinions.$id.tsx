import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card2, DataTable, Field, Loading, OpinionBadge, PageHeader, PayBadge, Td } from "@/components/app/ui";
import { OpinionForm } from "@/components/app/OpinionForm";
import { ChangeHistory } from "@/components/app/History";
import { useBillSummary, useLookups, useOpinions } from "@/lib/data";
import { serviceLabel } from "@/lib/services";
import { errMsg, fmtDate, inr, todayIST } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/opinions/$id")({
  head: () => ({ meta: [{ title: "Opinion — H R DORA, ADVOCATE" }] }),
  component: OpinionPage,
});

function OpinionPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const L = useLookups();
  const op = (useOpinions().data ?? []).find((o) => o.id === id);
  const bills = (useBillSummary().data ?? []).filter((b) => b.opinion_id === id);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [submissionChoice, setSubmissionChoice] = useState<
    "ready_for_submission" | "submitted"
  >("ready_for_submission");

  const [submissionDate, setSubmissionDate] = useState(todayIST());
  const [submissionRef, setSubmissionRef] = useState("");
  const [submissionBusy, setSubmissionBusy] = useState(false);

  useEffect(() => {
    if (!op) return;

    setSubmissionChoice(
      op.status === "submitted" ? "submitted" : "ready_for_submission"
    );
    setSubmissionDate(op.submission_date || todayIST());
    setSubmissionRef(op.submission_ref || "");
  }, [op?.id, op?.status, op?.submission_date, op?.submission_ref]);

  async function saveSubmissionStatus() {
    if (submissionBusy) return;

    if (!bills.some((bill) => bill.bill_status === "finalized")) {
      toast.error("Please finalize the bill before updating submission status.");
      return;
    }

    if (submissionChoice === "submitted" && !submissionDate) {
      toast.error("Enter the actual submission date.");
      return;
    }

    if (
      submissionChoice === "submitted" &&
      !window.confirm(
        "Confirm that this legal opinion has actually been submitted to the bank?"
      )
    ) {
      return;
    }

    setSubmissionBusy(true);

    try {
      const update = {
        status: submissionChoice,
        submission_date:
          submissionChoice === "submitted" ? submissionDate : null,
        submission_ref:
          submissionChoice === "submitted"
            ? submissionRef.trim() || null
            : null,
      };

      const { error } = await supabase
        .from("opinions")
        .update(update)
        .eq("id", id);

      if (error) throw error;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["opinions"] }),
        qc.invalidateQueries({ queryKey: ["audit"] }),
      ]);

      toast.success(
        submissionChoice === "submitted"
          ? "Opinion marked as submitted to bank."
          : "Opinion marked as ready — not yet submitted."
      );
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setSubmissionBusy(false);
    }
  }


 

  // PASTE THE deleteOpinion FUNCTION HERE
  async function deleteOpinion() {
    if (busy) return;

    if (bills.length > 0) {
      toast.error(
        "This opinion has bills linked to it. Deletion is blocked to preserve billing history."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete opinion ${op.opinion_no} for ${op.borrower_name}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from("opinions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["opinions"] }),
        qc.invalidateQueries({ queryKey: ["audit"] }),
        qc.invalidateQueries({ queryKey: ["docs", id] }),
        qc.invalidateQueries({ queryKey: ["bill_summary"] }),
      ]);

      toast.success("Opinion deleted.");
      await navigate({ to: "/opinions" });
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  }


  const docs = useQuery({
    queryKey: ["docs", id],
    queryFn: async () => (await supabase.from("opinion_documents").select("*").eq("opinion_id", id).order("created_at")).data ?? [],
  });
  const [doc, setDoc] = useState({ title: "", received_date: "", notes: "" });

  if (!op) return <Loading />;


  return (
    <div className="space-y-5">
      <PageHeader
        title={op.opinion_no}
        subtitle={`${op.borrower_name} · ${L.bankName(op.bank_id)} · ${L.branchName(op.branch_id)}`}
        actions={
          <>
            <OpinionBadge s={op.status} />

            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Cancel edit" : "Edit opinion"}
            </Button>

            <Button
              variant="destructive"
              disabled={busy || bills.length > 0}
              onClick={deleteOpinion}
              title={
                bills.length > 0
                  ? "Cannot delete an opinion with linked bills"
                  : "Delete opinion"
              }
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete opinion
            </Button>
          </>
        }
      />
      {editing ? (
        <Card2 title="Edit opinion">
          <OpinionForm
            initial={op}
            submitLabel="Save changes"
            busy={busy}
            onSubmit={async (v) => {
              setBusy(true);
              const { error } = await supabase.from("opinions").update(v).eq("id", id);
              setBusy(false);
              if (error) return toast.error(errMsg(error));
              toast.success("Opinion updated");
              setEditing(false);
              qc.invalidateQueries({ queryKey: ["opinions"] });
              qc.invalidateQueries({ queryKey: ["audit"] });
            }}
          />
        </Card2>
      ) : (
        <Card2 title="Details">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Borrower", op.borrower_name],
              ["Service Type", serviceLabel(op.service_type)],
              ["Bank", L.bankName(op.bank_id)],
              ["Branch", L.branchName(op.branch_id)],
              ["Documents received", fmtDate(op.docs_received_date)],
              ["Assigned to", L.userName(op.assigned_to)],
              ["Submission date", fmtDate(op.submission_date)],
              ["Submission reference", op.submission_ref || "—"],
              ["Remarks", op.remarks || "—"],
              ["Created by", `${L.userName(op.created_by)}`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Documents received (description)</dt>
              <dd className="whitespace-pre-wrap">{op.docs_description || "—"}</dd>
            </div>
          </dl>
        </Card2>
      )}

      <Card2 title="Opinion Submission Status">
        {!bills.some((bill) => bill.bill_status === "finalized") ? (
          <p className="text-sm text-muted-foreground">
            Finalize a bill to enable the opinion submission options.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                <input
                  type="radio"
                  name="submission-status"
                  value="ready_for_submission"
                  checked={submissionChoice === "ready_for_submission"}
                  onChange={() => setSubmissionChoice("ready_for_submission")}
                  disabled={submissionBusy}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">
                    Ready — Not Yet Submitted
                  </span>
                  <span className="text-sm text-muted-foreground">
                    The opinion is ready, but has not been sent to the bank.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                <input
                  type="radio"
                  name="submission-status"
                  value="submitted"
                  checked={submissionChoice === "submitted"}
                  onChange={() => setSubmissionChoice("submitted")}
                  disabled={submissionBusy}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">
                    Opinion Submitted to Bank
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Select this only after the opinion has actually been submitted.
                  </span>
                </span>
              </label>
            </div>

            {submissionChoice === "submitted" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Actual submission date *">
                  <Input
                    type="date"
                    required
                    value={submissionDate}
                    onChange={(e) => setSubmissionDate(e.target.value)}
                    disabled={submissionBusy}
                  />
                </Field>

                <Field label="Submission reference (optional)">
                  <Input
                    value={submissionRef}
                    onChange={(e) => setSubmissionRef(e.target.value)}
                    placeholder="Enter bank reference"
                    disabled={submissionBusy}
                  />
                </Field>
              </div>
            )}

            <Button
              type="button"
              disabled={submissionBusy}
              onClick={saveSubmissionStatus}
            >
              {submissionBusy ? "Saving..." : "Save Submission Status"}
            </Button>
          </div>
        )}
      </Card2>

      <Card2 title="Bills" actions={<Button asChild><Link to="/bills/new" search={{ opinion: id }}>Create New Bill</Link></Button>}>
        {bills.length ? (
          <DataTable head={["Bill No", "Date", "Status", "Total", "Received", "Adjusted", "Outstanding", "Payment"]}>
            {bills.map((b) => (
              <tr key={b.bill_id}>
                <Td><Link to="/bills/$id" params={{ id: b.bill_id! }} className="font-medium text-primary hover:underline">{b.bill_no}</Link></Td>
                <Td>{fmtDate(b.bill_date)}</Td>
                <Td className="capitalize">{b.bill_status}</Td>
                <Td>{inr(b.total)}</Td>
                <Td>{inr(b.received)}</Td>
                <Td>{inr(b.adjusted)}</Td>
                <Td className="font-semibold">{inr(b.outstanding)}</Td>
                <Td><PayBadge s={b.bill_status === "finalized" ? b.payment_status : null} /></Td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <p className="text-sm text-muted-foreground">No bill yet for this opinion.</p>
        )}
      </Card2>

      <Card2 title="Documents received (records)">
        <div className="mb-3 space-y-2">
          {(docs.data ?? []).map((d) => (
            <div key={d.id} className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{d.title}</span>
              <span className="text-muted-foreground">{fmtDate(d.received_date)} {d.notes && `· ${d.notes}`}</span>
            </div>
          ))}
          {!docs.data?.length && <p className="text-sm text-muted-foreground">No individual documents listed.</p>}
        </div>
        <form
          className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.from("opinion_documents").insert({ opinion_id: id, title: doc.title, received_date: doc.received_date || null, notes: doc.notes || null });
            if (error) return toast.error(errMsg(error));
            setDoc({ title: "", received_date: "", notes: "" });
            docs.refetch();
          }}
        >
          <Field label="Document"><Input required value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} placeholder="e.g. Sale deed copy" /></Field>
          <Field label="Received"><Input type="date" value={doc.received_date} onChange={(e) => setDoc({ ...doc, received_date: e.target.value })} /></Field>
          <Field label="Notes"><Input value={doc.notes} onChange={(e) => setDoc({ ...doc, notes: e.target.value })} /></Field>
          <Button type="submit" className="self-end">Add</Button>
        </form>
      </Card2>


    </div>
  );
}
