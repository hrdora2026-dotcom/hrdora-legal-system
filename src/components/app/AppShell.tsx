import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  IndianRupee,
  Clock,
  Landmark,
  FileUp,
  BarChart3,
  Users,
  History,
  LogOut,
  Menu,
  X,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Me } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof FileText; show?: (m: Me) => boolean };
const NAV: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/opinions", label: "Opinion Register", icon: FileText },
  { to: "/bills", label: "Bills", icon: Receipt },
  { to: "/payments/record", label: "Record Payment", icon: IndianRupee, show: (m) => m.can("record_payments") },
  { to: "/payments", label: "Payment Ledger", icon: Wallet },
  { to: "/pending", label: "Pending Bills", icon: Clock },
  { to: "/banks", label: "Banks & Branches", icon: Landmark },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/staff", label: "Staff & Permissions", icon: Users, show: (m) => m.isAdmin },
];

export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const nav = NAV.filter((n) => !n.show || n.show(me));

  const side = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5">
        <div className="font-serif text-lg font-bold tracking-wide text-sidebar-primary">H R DORA</div>
        <div className="text-xs tracking-[0.3em] text-sidebar-foreground/80">ADVOCATE</div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            activeOptions={{ exact: n.to === "/payments" }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/85 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-accent !text-sidebar-primary font-semibold" }}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-sm">
        <div className="truncate font-medium">{me.name}</div>
        <div className="text-xs text-sidebar-foreground/70">{me.isAdmin ? "Admin" : "Staff"}</div>
        <button
          className="mt-3 flex items-center gap-2 text-xs text-sidebar-foreground/80 hover:text-sidebar-primary"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{side}</aside>
      <div className={cn("fixed inset-0 z-40 lg:hidden", open ? "block" : "hidden")}>
        <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
        <aside className="absolute inset-y-0 left-0 w-64">{side}</aside>
      </div>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground lg:hidden">
        <button onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="font-serif font-bold tracking-wide">H R DORA, ADVOCATE</span>
        <span className="w-5" />
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
