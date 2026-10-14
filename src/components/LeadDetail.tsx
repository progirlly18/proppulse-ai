"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CornerDownRight,
  Copy,
  Gauge,
  ListChecks,
  MessageSquareQuote,
  MessagesSquare,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { analyzeLead, isAnalysisStale } from "@/lib/ai-client";
import { useHealth } from "@/lib/hooks";
import { timelineLabel } from "@/lib/schemas";
import { FACTORS, TIMING_LABEL } from "@/lib/scoring";
import { actions, type AppState } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import { CopilotPanel } from "./CopilotPanel";
import { CHANNEL_META, ChannelIcon } from "./icons";
import { LeadForm } from "./LeadForm";
import { Button, Card, ErrorNote, SampleBadge, ScoreDial, SectionLabel, SourceTag, TierBadge } from "./ui";

const INTENT_LABEL: Record<string, string> = {
  ready_to_buy: "Ready to buy",
  actively_evaluating: "Actively evaluating",
  early_research: "Early research",
  investment: "Investment purchase",
  rental_or_other: "Rental / other",
  unclear: "Unclear",
};

export function LeadDetail({ lead, state, now }: { lead: Lead; state: AppState; now: number }) {
  const health = useHealth();
  const aiOk = !!health && health !== "error" && health.aiConfigured;
  const [editing, setEditing] = useState(false);
  // Below 2xl the workspace is tabbed; at 2xl analysis and the side panel sit side by side.
  const [tab, setTab] = useState<"analysis" | "copilot" | "chat">("analysis");
  const panelTab = tab === "analysis" ? "copilot" : tab;
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const busy = !!state.busy[`analyze:${lead.id}`];
  const error = state.errors[`analyze:${lead.id}`];
  const a = lead.analysis;
  const stale = isAnalysisStale(lead);

  const openCount = lead.followUps.filter((f) => f.status === "pending").length;

  const askInChat = (text: string) => {
    setChatPrefill(text);
    setTab("chat");
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="z-10 border-b border-line bg-paper/90 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:px-8">
        <button onClick={() => actions.select(null)} className="mb-2 flex items-center gap-1 text-sm text-muted lg:hidden">
          <ArrowLeft className="size-4" /> Queue
        </button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {a && <ScoreDial score={a.priority.score} tier={a.priority.tier} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight">{lead.input.name}</h1>
              {a && <TierBadge tier={a.priority.tier} />}
              {lead.isSample && <SampleBadge />}
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {lead.input.location} · {lead.input.budget} · {timelineLabel(lead.input.timeline)}
            </p>
          </div>
          <div className="flex w-full gap-1.5 sm:w-auto">
            <Button
              variant={a && !stale ? "secondary" : "primary"}
              size="sm"
              icon={a ? RefreshCw : Sparkles}
              loading={busy}
              disabled={!aiOk}
              title={!aiOk ? "AI is not configured on this server" : undefined}
              onClick={() => analyzeLead(lead.id)}
            >
              {busy ? "Analyzing…" : a ? "Re-analyze" : "Analyze"}
            </Button>
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)} aria-label="Edit lead" />
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              aria-label="Delete lead"
              onClick={() => confirm(`Delete ${lead.input.name}? This removes the analysis, chat and follow-ups.`) && actions.deleteLead(lead.id)}
            />
          </div>
        </div>
        {stale && !busy && (
          <p className="mt-2 text-xs text-warm">Lead details changed since this analysis. Re-analyze to refresh the priority.</p>
        )}
      </header>

      <div className="px-4 pt-4 lg:px-8 2xl:hidden">
        <div className="flex rounded-lg border border-line bg-sunken p-0.5" role="tablist" aria-label="Lead workspace">
          {(
            [
              ["analysis", "AI analysis", Sparkles],
              ["copilot", "Follow-up Copilot", Wand2],
              ["chat", "Ask AI", MessagesSquare],
            ] as const
          ).map(([id, label, Icon]) => (
            <TabButton key={id} active={tab === id} onClick={() => setTab(id)} icon={Icon} label={label} badge={id === "copilot" ? openCount : undefined} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 px-4 py-4 lg:px-8 2xl:grid-cols-[minmax(0,1fr)_400px] 2xl:py-6">
        <div className={clsx("min-w-0 space-y-4", tab !== "analysis" && "hidden 2xl:block")}>
          {error && <ErrorNote message={error} onRetry={() => analyzeLead(lead.id)} retrying={busy} />}

          {!a && busy && <AnalysisSkeleton />}
          {!a && !busy && (
            <Card className="p-6 text-center">
              <Sparkles className="mx-auto mb-2 size-6 text-accent" aria-hidden />
              <p className="font-display text-lg">Not analyzed yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Gemini will read the form and message, then return a summary, intent, requirements, concerns, a priority
                score with reasons, a next action and a reply you can send.
              </p>
              <Button variant="primary" icon={Sparkles} className="mt-4" disabled={!aiOk} onClick={() => analyzeLead(lead.id)}>
                Analyze with AI
              </Button>
            </Card>
          )}

          {a && (
            <div className={clsx("space-y-4 transition-opacity", busy && "pointer-events-none opacity-60")}>
              {/* Summary + intent */}
              <Card className="p-5">
                <SectionLabel icon={ClipboardList} right={<AiMark />}>
                  Lead summary
                </SectionLabel>
                <p className="font-display text-[17px] leading-snug text-ink">{a.data.summary}</p>
                <div className="mt-4 flex flex-wrap items-start gap-3 rounded-lg bg-paper p-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ink px-2 py-1 text-xs font-semibold text-paper">
                    <Target className="size-3.5" aria-hidden /> {INTENT_LABEL[a.data.intent.category] ?? a.data.intent.category}
                  </span>
                  <p className="min-w-0 flex-1 text-sm text-ink-2">{a.data.intent.explanation}</p>
                </div>
              </Card>

              {/* Next action + reply */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-accent/30 p-5">
                  <SectionLabel icon={CornerDownRight} right={<AiMark />}>
                    Recommended next action
                  </SectionLabel>
                  <p className="text-[15px] font-medium">{a.data.nextAction.action}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 font-medium text-accent-strong">
                      <ChannelIcon channel={a.data.nextAction.channel} className="size-3.5" />
                      {CHANNEL_META[a.data.nextAction.channel].label}
                    </span>
                    <span className="rounded-md bg-sunken px-2 py-1 font-medium text-ink-2">{TIMING_LABEL[a.data.nextAction.timing]}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted">{a.data.nextAction.rationale}</p>
                  <Button size="sm" variant="ghost" icon={Wand2} className="mt-2 -ml-2" onClick={() => setTab("copilot")}>
                    Plan it in Follow-up Copilot
                  </Button>
                </Card>
                <ReplyCard text={a.data.suggestedReply} onRefine={() => askInChat("Make my reply more assertive")} />
              </div>

              {/* Requirements + concerns */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <SectionLabel icon={ListChecks}>Key requirements</SectionLabel>
                  <ul className="space-y-2">
                    {a.data.requirements.map((r, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-sm">
                        <span>{r.item}</span>
                        <SourceTag source={r.source} />
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card className="p-5">
                  <SectionLabel icon={ShieldAlert}>Objections & concerns</SectionLabel>
                  {a.data.objections.length === 0 ? (
                    <p className="text-sm text-muted">No concerns identified.</p>
                  ) : (
                    <ul className="space-y-2">
                      {a.data.objections.map((o, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <span
                            className={clsx(
                              "mt-1.5 size-2 shrink-0 rounded-full",
                              o.severity === "high" ? "bg-hot" : o.severity === "medium" ? "bg-warm" : "bg-line-strong",
                            )}
                            title={`${o.severity} severity`}
                            aria-label={`${o.severity} severity`}
                          />
                          <span className="flex-1">{o.concern}</span>
                          <SourceTag source={o.source} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {/* Priority breakdown */}
              <Card className="p-5">
                <SectionLabel
                  icon={Gauge}
                  right={
                    <span className="text-[11px] text-faint">AI rates each factor 0–5 · app applies fixed weights · budget size is not a factor</span>
                  }
                >
                  Why this priority
                </SectionLabel>
                {a.priority.needsQualification && (
                  <p className="mb-3 rounded-md bg-warm-soft px-3 py-2 text-sm text-warm">
                    Low confidence: qualify this lead on a call before trusting the score.
                  </p>
                )}
                <div className="space-y-3">
                  {a.priority.breakdown.map((b) => {
                    const def = FACTORS.find((f) => f.key === b.key);
                    return (
                      <div key={b.key} className="grid gap-x-4 gap-y-1 sm:grid-cols-[170px_1fr_auto] sm:items-center">
                        <span className="text-sm font-medium" title={def?.rubric}>
                          {b.label}
                        </span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                          <div
                            className={clsx("h-full rounded-full", b.points / b.maxPoints >= 0.6 ? "bg-accent" : b.points / b.maxPoints >= 0.3 ? "bg-warm" : "bg-hot")}
                            style={{ width: `${(b.points / b.maxPoints) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted tabular-nums">
                          {Math.round(b.points)}/{b.maxPoints} pts
                        </span>
                        <p className="text-xs text-muted sm:col-span-3">
                          {b.inverted ? `Severity ${b.rating}/5 — ` : `${b.rating}/5 — `}
                          {b.evidence}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                  <span className="font-medium text-ink-2">Confidence: {a.data.confidence.level}.</span> {a.data.confidence.reason}
                </p>
              </Card>

              {a.data.missingInformation.length > 0 && (
                <Card className="p-5">
                  <SectionLabel icon={CircleHelp}>Still need to find out</SectionLabel>
                  <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    {a.data.missingInformation.map((m, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full border border-muted" aria-hidden />
                        {m}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <p className="text-[11px] text-faint">
                Analyzed by {a.model} · {new Date(a.analyzedAt).toLocaleString()} · cached in this browser
              </p>
            </div>
          )}

          <CustomerFacts lead={lead} />
        </div>

        {/* Side panel: Copilot / Chat */}
        <aside className={clsx("min-w-0 2xl:sticky 2xl:top-[120px] 2xl:self-start", tab === "analysis" && "hidden 2xl:block")}>
          <div className="mb-3 hidden rounded-lg border border-line bg-sunken p-0.5 2xl:flex" role="tablist" aria-label="Assistant">
            <TabButton active={panelTab === "copilot"} onClick={() => setTab("copilot")} icon={Wand2} label="Follow-up Copilot" badge={openCount} />
            <TabButton active={panelTab === "chat"} onClick={() => setTab("chat")} icon={MessagesSquare} label="Ask about this lead" />
          </div>
          {panelTab === "copilot" ? (
            <CopilotPanel lead={lead} state={state} now={now} aiOk={aiOk} />
          ) : (
            <ChatPanel lead={lead} state={state} aiOk={aiOk} prefill={chatPrefill} onPrefillUsed={() => setChatPrefill(null)} />
          )}
        </aside>
      </div>

      <LeadForm open={editing} onClose={() => setEditing(false)} aiAvailable={aiOk} editing={{ id: lead.id, input: lead.input }} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Wand2;
  label: string;
  badge?: number;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-1 py-1.5 text-[13px] font-medium transition-colors",
        active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden /> <span className="truncate">{label}</span>
      {!!badge && <span className="rounded-full bg-accent-soft px-1.5 text-[10.5px] text-accent-strong tabular-nums">{badge}</span>}
    </button>
  );
}

function AiMark() {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-faint">
      <Sparkles className="size-3" aria-hidden /> AI generated
    </span>
  );
}

function ReplyCard({ text, onRefine }: { text: string; onRefine: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="flex flex-col p-5">
      <SectionLabel icon={MessageSquareQuote} right={<AiMark />}>
        Suggested reply
      </SectionLabel>
      <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{text}</p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          icon={copied ? Check : Copy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked; user can still select the text */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" variant="ghost" icon={Wand2} onClick={onRefine}>
          Make it more assertive
        </Button>
      </div>
    </Card>
  );
}

function CustomerFacts({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(!lead.analysis);
  const rows: [string, string][] = [
    ["Location", lead.input.location],
    ["Property requirement", lead.input.propertyRequirement],
    ["Budget", lead.input.budget],
    ["Buying timeline", timelineLabel(lead.input.timeline)],
  ];
  return (
    <Card className="p-5">
      <SectionLabel icon={UserRound} right={<SourceTag source="entered" />}>
        Customer facts (as entered)
      </SectionLabel>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-4 flex items-center gap-1 text-xs font-medium text-accent">
        <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} /> Original customer message
      </button>
      {open && (
        <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">
          {lead.input.customerMessage}
        </blockquote>
      )}
      {lead.isSample && <p className="mt-3 text-[11px] text-faint">Sample lead: fictional data for demonstration, not a real customer.</p>}
    </Card>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Analyzing lead">
      <Card className="space-y-3 p-5">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Sparkles className="size-4 animate-pulse text-accent" /> Gemini is reading the lead…
        </p>
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-5 w-1/2" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
    </div>
  );
}
