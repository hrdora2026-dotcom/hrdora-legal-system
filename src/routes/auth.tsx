
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/ui";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — H R DORA, ADVOCATE" },
      {
        name: "description",
        content: "Secure sign in for H R DORA, ADVOCATE office staff.",
      },
      { property: "og:title", content: "Sign in — H R DORA, ADVOCATE" },
      { property: "og:description", content: "Secure sign in for office staff." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        await navigate({ to: "/dashboard" });
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          await navigate({ to: "/dashboard" });
        } else {
          toast.success(
            "Account created. Please confirm your email, then sign in."
          );
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${window.location.origin}/reset-password` }
        );

        if (error) throw error;
        toast.success("Password reset link requested. Check your email.");
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      // Supabase redirects the browser to Google when OAuth is configured.
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div>
          <div className="font-serif text-3xl font-bold tracking-wide text-gold">
            H R DORA
          </div>
          <div className="text-sm tracking-[0.4em]">ADVOCATE</div>
        </div>

        <div>
          <h1 className="font-serif text-4xl leading-tight">
            Legal Opinion &amp; Billing Register
          </h1>
          <div className="my-5 h-0.5 w-20 bg-gold" />
          <p className="max-w-md text-primary-foreground/80">
            Opinion records, bills, manually recorded payments and outstanding
            balances — one shared register for the whole office.
          </p>
        </div>

        <div className="text-xs text-primary-foreground/60">
          Private office software. Authorised users only.
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden">
            <div className="font-serif text-2xl font-bold text-primary">
              H R DORA, ADVOCATE
            </div>
            <div className="mt-2 h-0.5 w-12 bg-gold" />
          </div>

          <h2 className="text-xl font-bold text-primary">
            {mode === "in"
              ? "Sign in"
              : mode === "up"
                ? "Create staff account"
                : "Reset password"}
          </h2>

          {mode === "up" && (
            <Field label="Full name">
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}

          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          {mode !== "reset" && (
            <Field label="Password">
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "in"
                ? "Sign in"
                : mode === "up"
                  ? "Create account"
                  : "Send reset link"}
          </Button>

          {mode !== "reset" && (
            <>
              <div className="relative py-1 text-center text-xs text-muted-foreground">
                or
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={signInWithGoogle}
              >
                Continue with Google
              </Button>
            </>
          )}

          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "New staff? Create account" : "Back to sign in"}
            </button>

            {mode === "in" && (
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => setMode("reset")}
              >
                Forgot password?
              </button>
            )}
          </div>

          {mode === "up" && (
            <p className="text-xs text-muted-foreground">
              New accounts need Sir&apos;s approval before they can open any
              records.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
