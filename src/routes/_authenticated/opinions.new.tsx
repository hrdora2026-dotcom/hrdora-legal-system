import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card2, PageHeader } from "@/components/app/ui";
import { OpinionForm } from "@/components/app/OpinionForm";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/opinions/new")({
  head: () => ({ meta: [{ title: "New Opinion — H R DORA, ADVOCATE" }] }),
  component: NewOpinion,
});

function NewOpinion() {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="New Legal Opinion" subtitle="Opinion number is generated automatically when you save." />
      <Card2>
        <OpinionForm
          submitLabel="Save opinion"
          busy={busy}
          onSubmit={async (v) => {
            setBusy(true);
            const { data, error } = await supabase.from("opinions").insert({ ...v, opinion_no: "" }).select("id, opinion_no").single();
            setBusy(false);
            if (error) return toast.error(errMsg(error));
            toast.success(`Opinion ${data.opinion_no} created`);
            qc.invalidateQueries({ queryKey: ["opinions"] });
            navigate({ to: "/opinions/$id", params: { id: data.id } });
          }}
        />
      </Card2>
    </div>
  );
}
