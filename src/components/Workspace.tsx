"use client";

import clsx from "clsx";
import { AlertTriangle, CalendarClock, LayoutDashboard, Plus, RotateCcw, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { allFollowUps } from "@/lib/followups";
import { useHealth, useNow } from "@/lib/hooks";
import { actions, useAppState } from "@/lib/store";
import { FollowUpsView } from "./FollowUpsView";
import { LeadForm } from "./LeadForm";
import { LeadsView } from "./LeadsView";
import { OverviewView } from "./OverviewView";
import { Button } from "./ui";

export type View = "overview" | "leads" | "followups";

const NAV: { id: View; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: Users },
  { id: "followups", label: "Follow-ups", icon: CalendarClock },
];

export function Workspace() {
  const state = useAppState();
  const now = useNow();
  const health = useHealth();
  const [view, setView] = useState<View>("overview");
  const [formOpen, setFormOpen] = useState(false);

  const openLead = useCallback((id: string) => {
    actions.select(id);
    setView("leads");
  }, []);

  // Keyboard: "n" opens the intake form (when not typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "n") {
        e.preventDefault();
        setFormOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    if (!state || !now) return { overdue: 0, leads: 0 };
    return {
      overdue: allFollowUps(state.leads, now).filter((r) => r.state === "overdue").length,
      leads: state.leads.length,
    };
  }, [state, now]);

  if (!state) return <ShellSkeleton />;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-5 lg:flex">
        <Brand />
        <Button variant="primary" icon={Plus} className="mt-6 w-full" onClick={() => setFormOpen(true)}>
          New lead
          <kbd className="ml-auto rounded border border-white/30 px-1 text-[10px] font-normal text-white/80">N</kbd>
        </Button>
        <nav className="mt-6 flex flex-col gap-0.5" aria-label="Main">
          {NAV.map((n) => (
            <NavItem
              key={n.id}
              item={n}
              active={view === n.id}
              onClick={() => setView(n.id)}
              count={n.id === "followups" ? counts.overdue : n.id === "leads" ? counts.leads : undefined}
              alert={n.id === "followups" && counts.overdue > 0}
            />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <AIStatus health={health} />
          <button
            onClick={() => {
              if (confirm("Reset to the sample leads? This deletes every lead, analysis, chat and follow-up stored in this browser.")) {
                actions.resetDemo();
                setView("overview");
              }
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-sunken hover:text-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Reset demo data
          </button>
          <p className="px-2 text-[11px] leading-relaxed text-faint">
            Data is saved in this browser only. It is not shared across devices or users.
          </p>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand compact />
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setFormOpen(true)}>
          New lead
        </Button>
      </header>

      <main className="min-w-0 flex-1 pb-20 lg:pb-0">
        {health && health !== "error" && !health.aiConfigured && (
          <Banner>
            AI is not configured on this server (missing <code>GEMINI_API_KEY</code>). Analysis, chat and drafting are disabled; nothing is faked.
          </Banner>
        )}
        {health === "error" && <Banner>Could not reach the server. AI features may be unavailable.</Banner>}
        {state.storageError && <Banner>{state.storageError}</Banner>}

        {view === "overview" && <OverviewView state={state} now={now} onOpenLead={openLead} onNewLead={() => setFormOpen(true)} onGoTo={setView} />}
        {view === "leads" && <LeadsView state={state} now={now} onNewLead={() => setFormOpen(true)} />}
        {view === "followups" && <FollowUpsView state={state} now={now} onOpenLead={openLead} />}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Main">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            aria-current={view === n.id ? "page" : undefined}
            className={clsx("relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", view === n.id ? "text-accent" : "text-muted")}
          >
            <n.icon className="size-5" aria-hidden />
            {n.label}
            {n.id === "followups" && counts.overdue > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-20px)] grid size-4 place-items-center rounded-full bg-danger text-[9px] text-white">
                {counts.overdue}
              </span>
            )}
          </button>
        ))}
      </nav>

      <LeadForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        aiAvailable={!!health && health !== "error" && health.aiConfigured}
        onCreated={() => {
          setFormOpen(false);
          setView("leads");
        }}
      />
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid size-8 place-items-center rounded-lg bg-ink text-paper" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l2.5-6 5 12L17 12h4" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="font-display text-[17px] font-semibold tracking-tight">PropPulse</p>
        {!compact && <p className="text-[11px] text-muted">Lead intelligence</p>}
      </div>
    </div>
  );
}

function NavItem({
  item,
  active,
  onClick,
  count,
  alert,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onClick: () => void;
  count?: number;
  alert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken",
      )}
    >
      <item.icon className="size-4" aria-hidden />
      {item.label}
      {count !== undefined && count > 0 && (
        <span
          className={clsx(
            "ml-auto rounded-full px-1.5 text-[11px] tabular-nums",
            alert ? "bg-danger text-white" : active ? "bg-white/15" : "bg-sunken text-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function AIStatus({ health }: { health: ReturnType<typeof useHealth> }) {
  const ok = health && health !== "error" && health.aiConfigured;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[11.5px]">
      <div className="flex items-center gap-1.5 font-medium text-ink-2">
        <span className={clsx("size-1.5 rounded-full", health === null ? "bg-line-strong" : ok ? "bg-accent" : "bg-danger")} aria-hidden />
        {health === null ? "Checking AI…" : ok ? "Gemini connected" : "AI unavailable"}
      </div>
      {health && health !== "error" && <p className="mt-0.5 truncate text-faint">Model: {health.model}</p>}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 border-b border-warm/20 bg-warm-soft px-4 py-2 text-sm text-warm lg:px-8">
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-60 border-r border-line lg:block" />
      <div className="flex-1 space-y-4 p-8">
        <div className="skeleton h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}
