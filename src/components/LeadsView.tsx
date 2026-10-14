"use client";

import clsx from "clsx";
import { AlertCircle, Loader2, Plus, Search, SlidersHorizontal, Users } from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import { isAnalysisStale } from "@/lib/ai-client";
import { followUpState, formatDue, nextOpenFollowUp } from "@/lib/followups";
import { applyQuery, DEFAULT_QUERY, type QueueQuery } from "@/lib/queue";
import { timelineLabel } from "@/lib/schemas";
import { actions, type AppState } from "@/lib/store";
import { LeadDetail } from "./LeadDetail";
import { Button, EmptyState, SampleBadge, TierBadge } from "./ui";

export function LeadsView({ state, now, onNewLead }: { state: AppState; now: number; onNewLead: () => void }) {
  const [query, setQuery] = useState<QueueQuery>(DEFAULT_QUERY);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const leads = useMemo(() => applyQuery(state.leads, query, now), [state.leads, query, now]);
  const selected = state.leads.find((l) => l.id === state.selectedLeadId) ?? null;
  const filtersActive = query.tier !== "all" || query.followUp !== "any" || query.origin !== "all";

  // "/" focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !t.closest("input, textarea, select")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-[calc(100dvh-57px)] lg:h-dvh lg:min-h-0">
      {/* Queue */}
      <section
        aria-label="Lead queue"
        className={clsx(
          "flex w-full shrink-0 flex-col border-line bg-surface/40 lg:w-[360px] lg:border-r",
          selected && "hidden lg:flex",
        )}
      >
        <div className="space-y-2.5 border-b border-line px-4 pt-5 pb-3">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-xl font-semibold">Lead queue</h1>
            <span className="text-xs text-muted tabular-nums">
              {leads.length} of {state.leads.length}
            </span>
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search leads</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
              <input
                ref={searchRef}
                value={query.search}
                onChange={(e) => setQuery({ ...query, search: e.target.value })}
                placeholder="Search name, area, need…"
                className="h-9 w-full rounded-lg border border-line bg-white pr-8 pl-8 text-sm placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none"
              />
              <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line px-1 text-[10px] text-faint">/</kbd>
            </label>
            <Button
              variant="secondary"
              icon={SlidersHorizontal}
              aria-expanded={showFilters}
              aria-label="Filters"
              onClick={() => setShowFilters((v) => !v)}
              className={clsx("w-9 shrink-0 px-0 [&_svg]:size-4", filtersActive && "border-accent text-accent")}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Sort
              <select
                value={query.sort}
                onChange={(e) => setQuery({ ...query, sort: e.target.value as QueueQuery["sort"] })}
                className="rounded-md border border-line bg-white px-1.5 py-1 text-xs text-ink"
              >
                <option value="priority">Priority</option>
                <option value="due">Due soonest</option>
                <option value="newest">Newest</option>
                <option value="name">Name</option>
              </select>
            </label>
            <div className="ml-auto flex gap-1" role="group" aria-label="Filter by tier">
              {(["all", "hot", "warm", "cold"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setQuery({ ...query, tier: t })}
                  aria-pressed={query.tier === t}
                  className={clsx(
                    "rounded-md px-1.5 py-1 text-xs font-medium capitalize",
                    query.tier === t ? "bg-ink text-paper" : "text-muted hover:bg-sunken",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {showFilters && (
            <div className="grid animate-fade-in grid-cols-3 gap-2 rounded-lg border border-line bg-white p-2.5 text-xs">
              <FilterSelect
                label="Status"
                value={query.tier}
                onChange={(v) => setQuery({ ...query, tier: v as QueueQuery["tier"] })}
                options={[
                  ["all", "All"],
                  ["hot", "Hot"],
                  ["warm", "Warm"],
                  ["cold", "Cold"],
                  ["unanalyzed", "Not analyzed"],
                ]}
              />
              <FilterSelect
                label="Follow-up"
                value={query.followUp}
                onChange={(v) => setQuery({ ...query, followUp: v as QueueQuery["followUp"] })}
                options={[
                  ["any", "Any"],
                  ["overdue", "Overdue"],
                  ["due_today", "Due today"],
                ]}
              />
              <FilterSelect
                label="Source"
                value={query.origin}
                onChange={(v) => setQuery({ ...query, origin: v as QueueQuery["origin"] })}
                options={[
                  ["all", "All"],
                  ["mine", "My leads"],
                  ["sample", "Samples"],
                ]}
              />
              {filtersActive && (
                <button onClick={() => setQuery({ ...DEFAULT_QUERY, search: query.search, sort: query.sort })} className="col-span-3 text-left text-accent hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <ul className="scroll-thin flex-1 overflow-y-auto" role="listbox" aria-label="Leads">
          {leads.length === 0 && (
            <li>
              <EmptyState
                icon={Users}
                title={state.leads.length ? "No leads match" : "No leads yet"}
                action={
                  state.leads.length ? (
                    <Button size="sm" onClick={() => setQuery(DEFAULT_QUERY)}>
                      Clear search & filters
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" icon={Plus} onClick={onNewLead}>
                      Add your first lead
                    </Button>
                  )
                }
              >
                {state.leads.length ? "Try a different search or filter." : "Add a lead to get an AI analysis and priority."}
              </EmptyState>
            </li>
          )}
          {leads.map((l, i) => {
            const a = l.analysis;
            const busy = state.busy[`analyze:${l.id}`];
            const err = state.errors[`analyze:${l.id}`];
            const fu = nextOpenFollowUp(l);
            const fuState = fu ? followUpState(fu, now) : null;
            const active = l.id === state.selectedLeadId;
            return (
              <li key={l.id} role="option" aria-selected={active}>
                <button
                  onClick={() => actions.select(l.id)}
                  className={clsx(
                    "relative flex w-full gap-3 border-b border-line px-4 py-3.5 text-left transition-colors",
                    active ? "bg-white" : "hover:bg-white/70",
                  )}
                >
                  {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden />}
                  <div className="w-9 shrink-0 pt-0.5 text-center">
                    {busy ? (
                      <Loader2 className="mx-auto size-5 animate-spin text-accent" aria-label="Analyzing" />
                    ) : a ? (
                      <>
                        <span className="block font-display text-xl leading-none font-semibold tabular-nums">{a.priority.score}</span>
                        <span className="text-[10px] text-faint">#{query.sort === "priority" ? i + 1 : "—"}</span>
                      </>
                    ) : (
                      <span className="block text-lg leading-none text-faint">–</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{l.input.name}</span>
                      {l.isSample && <SampleBadge />}
                      <span className="ml-auto shrink-0">{a ? <TierBadge tier={a.priority.tier} /> : null}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      {l.input.location} · {l.input.propertyRequirement}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
                      <span className="text-faint">{l.input.budget}</span>
                      <span className="text-faint">· {timelineLabel(l.input.timeline)}</span>
                      {err && (
                        <span className="flex items-center gap-1 text-danger">
                          <AlertCircle className="size-3" /> Analysis failed
                        </span>
                      )}
                      {!a && !busy && !err && <span className="text-accent">Not analyzed</span>}
                      {a && isAnalysisStale(l) && <span className="text-warm">Out of date</span>}
                    </div>
                    {fu && fuState && (
                      <p
                        className={clsx(
                          "mt-1 truncate text-[11.5px]",
                          fuState === "overdue" ? "font-medium text-danger" : fuState === "due_today" ? "text-warm" : "text-muted",
                        )}
                      >
                        Next: {fu.title} · {formatDue(fu.dueAt, now)}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Detail */}
      <section className={clsx("min-w-0 flex-1 lg:overflow-y-auto", !selected && "hidden lg:block")} aria-label="Lead detail">
        {selected ? (
          <LeadDetail key={selected.id} lead={selected} state={state} now={now} />
        ) : (
          <div className="grid h-full place-items-center">
            <EmptyState icon={Users} title="Select a lead">
              Pick a lead from the queue to see its analysis, ask questions about it, and plan the follow-up.
            </EmptyState>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1 text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-line bg-white px-1.5 py-1 text-ink">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
