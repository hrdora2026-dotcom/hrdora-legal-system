import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/ui";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set new password — H R DORA, ADVOCATE" },
      { name: "description", content: "Choose a new password." },
      { property: "og:title", content: "Set new password — H R DORA, ADVOCATE" },
      { property: "og:description", content: "Choose a new password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        className="w-full max-w-sm space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.auth.updateUser({ password: pw });
          if (error) return toast.error(errMsg(error));
          toast.success("Password updated");
          navigate({ to: "/dashboard" });
        }}
      >
        <h1 className="text-xl font-bold text-primary">Set a new password</h1>
        <Field label="New password">
          <Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Button className="w-full" type="submit">
          Save password
        </Button>
      </form>
    </div>
  );
}
