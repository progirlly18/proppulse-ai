"use client";

import clsx from "clsx";
import { CalendarClock, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { allFollowUps, formatDue, type FollowUpRow } from "@/lib/followups";
import { tickNow } from "@/lib/hooks";
import { actions, type AppState } from "@/lib/store";
import type { FollowUpState } from "@/lib/types";
import { ChannelIcon } from "./icons";
import { Card, EmptyState, SampleBadge, SourceTag, StateBadge, TierBadge } from "./ui";

const GROUPS: { state: FollowUpState; title: string }[] = [
  { state: "overdue", title: "Overdue" },
  { state: "due_today", title: "Due today" },
  { state: "upcoming", title: "Upcoming" },
  { state: "done", title: "Completed" },
];

export function FollowUpsView({ state, now, onOpenLead }: { state: AppState; now: number; onOpenLead: (id: string) => void }) {
  const rows = useMemo(() => allFollowUps(state.leads, now), [state.leads, now]);
  const [showDone, setShowDone] = useState(false);
  const open = rows.filter((r) => r.state !== "done").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted">
            {open} open across {state.leads.length} leads. Overdue status updates automatically.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          Show completed
        </label>
      </div>

      {rows.length === 0 && (
        <Card>
          <EmptyState icon={CalendarClock} title="No follow-ups yet">
            Analyze a lead: its recommended next action becomes a follow-up here.
          </EmptyState>
        </Card>
      )}

      <div className="space-y-6">
        {GROUPS.filter((g) => g.state !== "done" || showDone).map((g) => {
          const items = rows.filter((r) => r.state === g.state);
          if (!items.length) return null;
          const list = g.state === "done" ? [...items].reverse() : items;
          return (
            <section key={g.state}>
              <h2 className={clsx("mb-2 flex items-center gap-2 text-sm font-semibold", g.state === "overdue" ? "text-danger" : "text-ink-2")}>
                {g.title} <span className="font-normal text-muted tabular-nums">{items.length}</span>
              </h2>
              <Card className="divide-y divide-line overflow-hidden">
                {list.map((r) => (
                  <Row key={r.followUp.id} row={r} now={now} onOpenLead={onOpenLead} />
                ))}
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Row({ row, now, onOpenLead }: { row: FollowUpRow; now: number; onOpenLead: (id: string) => void }) {
  const { lead, followUp: f, state } = row;
  const done = state === "done";
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <button
        onClick={() => {
          actions.updateFollowUp(lead.id, f.id, (x) =>
            done ? { ...x, status: "pending", completedAt: undefined } : { ...x, status: "done", completedAt: Date.now() },
          );
          tickNow();
        }}
        className={clsx(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
          done ? "border-accent bg-accent text-white" : "border-line-strong hover:border-accent hover:bg-accent-soft",
        )}
        aria-label={done ? `Reopen: ${f.title}` : `Mark done: ${f.title}`}
      >
        {done ? <Check className="size-3" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={clsx("text-sm font-medium", done && "text-muted line-through decoration-line-strong")}>{f.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <button onClick={() => onOpenLead(lead.id)} className="font-medium text-ink-2 hover:text-accent hover:underline">
            {lead.input.name}
          </button>
          {lead.analysis && <TierBadge tier={lead.analysis.priority.tier} />}
          {lead.isSample && <SampleBadge />}
          <span className="flex items-center gap-1">
            <ChannelIcon channel={f.channel} className="size-3.5" />
          </span>
          <SourceTag source={f.origin} />
          {f.outcome && <span className="text-ink-2">Outcome: {f.outcome}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StateBadge state={state} />
        <span className="text-[11px] text-muted tabular-nums">{done ? "completed" : formatDue(f.dueAt, now)}</span>
      </div>
    </div>
  );
}
