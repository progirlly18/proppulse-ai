"use client";

import clsx from "clsx";
import { ArrowRight, CalendarClock, Flame, Inbox, Plus, Sparkles, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { analyzeMany } from "@/lib/ai-client";
import { allFollowUps, formatDue, nextOpenFollowUp } from "@/lib/followups";
import type { AppState } from "@/lib/store";
import { rankLeads } from "@/lib/queue";
import { ChannelIcon } from "./icons";
import { Button, Card, SampleBadge, ScoreDial, SectionLabel, StateBadge, TierBadge } from "./ui";
import type { View } from "./Workspace";

export function OverviewView({
  state,
  now,
  onOpenLead,
  onNewLead,
  onGoTo,
}: {
  state: AppState;
  now: number;
  onOpenLead: (id: string) => void;
  onNewLead: () => void;
  onGoTo: (v: View) => void;
}) {
  const { leads } = state;
  const stats = useMemo(() => {
    const analyzed = leads.filter((l) => l.analysis);
    const rows = allFollowUps(leads, now);
    return {
      total: leads.length,
      analyzed: analyzed.length,
      unanalyzed: leads.filter((l) => !l.analysis),
      hot: analyzed.filter((l) => l.analysis!.priority.tier === "hot").length,
      warm: analyzed.filter((l) => l.analysis!.priority.tier === "warm").length,
      cold: analyzed.filter((l) => l.analysis!.priority.tier === "cold").length,
      overdue: rows.filter((r) => r.state === "overdue"),
      dueToday: rows.filter((r) => r.state === "due_today"),
      doneToday: rows.filter((r) => r.state === "done" && (r.followUp.completedAt ?? 0) > now - 86_400_000).length,
    };
  }, [leads, now]);

  const actNow = useMemo(() => rankLeads(leads, now).filter((l) => l.analysis).slice(0, 5), [leads, now]);
  const busyAnalyzing = Object.entries(state.busy).some(([k, v]) => k.startsWith("analyze:") && v);
  const greeting = now ? (new Date(now).getHours() < 12 ? "Good morning" : new Date(now).getHours() < 17 ? "Good afternoon" : "Good evening") : "Hello";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{greeting}</p>
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight">
            {stats.overdue.length > 0
              ? `${stats.overdue.length} follow-up${stats.overdue.length > 1 ? "s are" : " is"} overdue`
              : stats.hot > 0
                ? `${stats.hot} hot lead${stats.hot > 1 ? "s" : ""} need attention`
                : "Your pipeline at a glance"}
          </h1>
        </div>
        <Button variant="secondary" icon={Plus} onClick={onNewLead}>
          Add lead
        </Button>
      </div>

      {stats.unanalyzed.length > 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-accent/25 bg-accent-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="font-medium">
                {stats.unanalyzed.length} lead{stats.unanalyzed.length > 1 ? "s" : ""} waiting for AI analysis
              </p>
              <p className="text-sm text-ink-2">
                {stats.unanalyzed.some((l) => l.isSample) ? "The sample leads ship without analysis. " : ""}
                Each one is a live Gemini call; results are cached in this browser until the lead changes.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            icon={Sparkles}
            loading={busyAnalyzing}
            onClick={() => analyzeMany(stats.unanalyzed.map((l) => l.id))}
            className="shrink-0"
          >
            {busyAnalyzing ? "Analyzing…" : `Analyze ${stats.unanalyzed.length}`}
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Leads in pipeline" value={stats.total} sub={`${stats.analyzed} analyzed`} icon={Inbox} />
        <Kpi label="Hot leads" value={stats.hot} sub={`${stats.warm} warm · ${stats.cold} cold`} icon={Flame} tone="hot" />
        <Kpi
          label="Overdue follow-ups"
          value={stats.overdue.length}
          sub={stats.overdue.length ? "Act on these first" : "Nothing overdue"}
          icon={TriangleAlert}
          tone={stats.overdue.length ? "danger" : undefined}
          onClick={() => onGoTo("followups")}
        />
        <Kpi
          label="Due today"
          value={stats.dueToday.length}
          sub={`${stats.doneToday} completed in last 24 h`}
          icon={CalendarClock}
          onClick={() => onGoTo("followups")}
        />
      </div>

      {stats.analyzed > 0 && <TierBar hot={stats.hot} warm={stats.warm} cold={stats.cold} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionLabel
            right={
              <button onClick={() => onGoTo("leads")} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                All leads <ArrowRight className="size-3" />
              </button>
            }
          >
            Work these first
          </SectionLabel>
          <Card className="divide-y divide-line overflow-hidden">
            {actNow.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">Analyze a lead to see it ranked here.</p>
            )}
            {actNow.map((l) => {
              const a = l.analysis!;
              const fu = nextOpenFollowUp(l);
              return (
                <button
                  key={l.id}
                  onClick={() => onOpenLead(l.id)}
                  className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-paper"
                >
                  <ScoreDial score={a.priority.score} tier={a.priority.tier} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{l.input.name}</span>
                      <TierBadge tier={a.priority.tier} />
                      {l.isSample && <SampleBadge />}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted">{a.data.summary}</p>
                    {fu && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">
                        <ChannelIcon channel={fu.channel} className="size-3.5 text-muted" />
                        <span className="truncate">{fu.title}</span>
                        <span className={clsx("shrink-0", fu.dueAt < now ? "font-medium text-danger" : "text-faint")}>· {formatDue(fu.dueAt, now)}</span>
                      </p>
                    )}
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-faint" aria-hidden />
                </button>
              );
            })}
          </Card>
        </section>

        <section>
          <SectionLabel
            right={
              <button onClick={() => onGoTo("followups")} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                Follow-ups <ArrowRight className="size-3" />
              </button>
            }
          >
            Today&apos;s follow-ups
          </SectionLabel>
          <Card className="divide-y divide-line overflow-hidden">
            {[...stats.overdue, ...stats.dueToday].length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">Nothing due today. Follow-ups appear after a lead is analyzed.</p>
            )}
            {[...stats.overdue, ...stats.dueToday].slice(0, 6).map(({ lead, followUp, state: s }) => (
              <button
                key={followUp.id}
                onClick={() => onOpenLead(lead.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
              >
                <ChannelIcon channel={followUp.channel} className="mt-0.5 size-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{followUp.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {lead.input.name} · {formatDue(followUp.dueAt, now)}
                  </p>
                </div>
                <StateBadge state={s} />
              </button>
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  sub: string;
  icon: typeof Inbox;
  tone?: "hot" | "danger";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={clsx("text-left", onClick && "group")}>
      <Card className={clsx("h-full p-4 transition-colors", onClick && "group-hover:border-line-strong")}>
        <div className="flex items-center justify-between text-muted">
          <span className="text-[12.5px] font-medium">{label}</span>
          <Icon className={clsx("size-4", tone === "hot" && "text-hot", tone === "danger" && "text-danger")} aria-hidden />
        </div>
        <p className={clsx("mt-2 font-display text-3xl font-semibold tabular-nums", tone === "danger" && "text-danger")}>{value}</p>
        <p className="mt-0.5 text-xs text-muted">{sub}</p>
      </Card>
    </Comp>
  );
}

function TierBar({ hot, warm, cold }: { hot: number; warm: number; cold: number }) {
  const total = hot + warm + cold || 1;
  const segs = [
    { k: "Hot", v: hot, c: "bg-hot" },
    { k: "Warm", v: warm, c: "bg-warm" },
    { k: "Cold", v: cold, c: "bg-cold" },
  ];
  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`Hot ${hot}, warm ${warm}, cold ${cold}`}>
        {segs.map((s) => (
          <div key={s.k} className={clsx(s.c, "transition-all")} style={{ width: `${(s.v / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex gap-4 text-xs text-muted">
        {segs.map((s) => (
          <span key={s.k} className="flex items-center gap-1.5">
            <span className={clsx("size-2 rounded-full", s.c)} /> {s.k} {s.v}
          </span>
        ))}
      </div>
    </div>
  );
}
