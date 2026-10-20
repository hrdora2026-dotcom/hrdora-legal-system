import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { useRealtimeSync } from "@/lib/data";
import { AppShell } from "@/components/app/AppShell";
import { Loading } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return <Loading />;
  if (!me.isMember) return <Pending email={me.email} active={me.active} />;
  return <Member me={me} />;
}

function Member({ me }: { me: NonNullable<ReturnType<typeof useMe>["data"]> }) {
  useRealtimeSync();
  return (
    <AppShell me={me}>
      <Outlet />
    </AppShell>
  );
}

function Pending({ email, active }: { email: string | null; active: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <div className="font-serif text-xl font-bold text-primary">H R DORA, ADVOCATE</div>
        <div className="mx-auto my-3 h-0.5 w-12 bg-gold" />
        <p className="text-sm text-muted-foreground">
          {active
            ? `Your account (${email}) is waiting for approval. Please ask Sir to approve your access from the Staff & Permissions page.`
            : "Your account has been deactivated. Please contact Sir."}
        </p>
        <Button className="mt-6" variant="outline" onClick={() => supabase.auth.signOut().then(() => location.assign("/auth"))}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
