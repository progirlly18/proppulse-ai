"use client";

import clsx from "clsx";
import { AlarmClock, Check, CheckCircle2, Copy, History, Plus, RotateCcw, Sparkles, Undo2, Wand2, X } from "lucide-react";
import { useState } from "react";
import { draftFollowUp } from "@/lib/ai-client";
import { followUpState, formatDue } from "@/lib/followups";
import { tickNow } from "@/lib/hooks";
import { CHANNELS, TONES, type Channel, type Tone } from "@/lib/schemas";
import { actions, type AppState } from "@/lib/store";
import type { FollowUp, Lead } from "@/lib/types";
import { CHANNEL_META, ChannelIcon } from "./icons";
import { Button, Card, ErrorNote, SourceTag, StateBadge } from "./ui";

/**
 * Follow-up Copilot: turns the AI's recommended next action into a tracked
 * task, drafts a personalised message for it, and closes the loop when the
 * salesperson marks it done (outcome feeds the next draft).
 */

const HOUR = 3_600_000;
const QUICK_DUE: { label: string; ms: number }[] = [
  { label: "In 1 hour", ms: HOUR },
  { label: "Tomorrow", ms: 24 * HOUR },
  { label: "In 3 days", ms: 72 * HOUR },
  { label: "Next week", ms: 168 * HOUR },
];

const fmtWhen = (t: number) =>
  new Date(t).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function CopilotPanel({ lead, state, now, aiOk }: { lead: Lead; state: AppState; now: number; aiOk: boolean }) {
  const [adding, setAdding] = useState(false);
  const open = lead.followUps.filter((f) => f.status === "pending").sort((a, b) => a.dueAt - b.dueAt);
  const done = lead.followUps.filter((f) => f.status === "done").sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  return (
    <div className="space-y-3">
      {open.length === 0 && !adding && (
        <Card className="p-5 text-center">
          <AlarmClock className="mx-auto mb-2 size-5 text-muted" aria-hidden />
          <p className="font-medium">No open follow-up</p>
          <p className="mt-1 text-sm text-muted">
            {lead.analysis
              ? "Schedule the next touchpoint so this lead doesn't go cold."
              : "Analyze the lead and the AI's recommended next action becomes your first follow-up."}
          </p>
          <Button size="sm" icon={Plus} className="mt-3" onClick={() => setAdding(true)}>
            Add follow-up
          </Button>
        </Card>
      )}

      {open.map((f) => (
        <FollowUpCard key={f.id} lead={lead} f={f} state={state} now={now} aiOk={aiOk} />
      ))}

      {adding ? (
        <AddFollowUp
          lead={lead}
          now={now}
          onDone={() => setAdding(false)}
          defaultChannel={lead.analysis?.data.nextAction.channel ?? "call"}
        />
      ) : (
        open.length > 0 && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-1 text-sm font-medium text-accent hover:underline">
            <Plus className="size-4" /> Add another follow-up
          </button>
        )
      )}

      {done.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
            <History className="size-3.5" /> Completed
          </p>
          <ul className="space-y-2.5">
            {done.map((f) => (
              <li key={f.id} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-ink-2 line-through decoration-line-strong">{f.title}</p>
                  {f.outcome && <p className="mt-0.5 text-xs text-ink-2">Outcome: {f.outcome}</p>}
                  <p className="text-[11px] text-faint">Done {f.completedAt ? fmtWhen(f.completedAt) : ""}</p>
                </div>
                <button
                  onClick={() => {
                    actions.updateFollowUp(lead.id, f.id, (x) => ({ ...x, status: "pending", completedAt: undefined }));
                    tickNow();
                  }}
                  className="rounded p-1 text-muted hover:bg-sunken hover:text-ink"
                  aria-label="Reopen follow-up"
                  title="Reopen"
                >
                  <Undo2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function FollowUpCard({ lead, f, state, now, aiOk }: { lead: Lead; f: FollowUp; state: AppState; now: number; aiOk: boolean }) {
  const st = followUpState(f, now);
  const [mode, setMode] = useState<"idle" | "draft" | "complete">(f.draft ? "draft" : "idle");
  const [channel, setChannel] = useState<Channel>(f.draft?.channel ?? f.channel);
  const [tone, setTone] = useState<Tone>(f.draft?.tone ?? "warm");
  const busy = !!state.busy[`draft:${f.id}`];
  const error = state.errors[`draft:${f.id}`];

  return (
    <Card className={clsx("overflow-hidden", st === "overdue" && "border-danger/30")}>
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <StateBadge state={st} />
          <SourceTag source={f.origin} />
          <span className="ml-auto text-xs text-muted tabular-nums">{formatDue(f.dueAt, now)}</span>
        </div>
        <p className="text-[15px] leading-snug font-medium">{f.title}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <ChannelIcon channel={f.channel} className="size-3.5" /> {CHANNEL_META[f.channel].label} · {fmtWhen(f.dueAt)}
        </p>

        {mode !== "complete" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" icon={Check} onClick={() => setMode("complete")}>
              Mark done
            </Button>
            <Button size="sm" icon={Wand2} onClick={() => setMode(mode === "draft" ? "idle" : "draft")} aria-expanded={mode === "draft"}>
              {f.draft ? "Message" : "Draft message"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={AlarmClock}
              onClick={() => {
                actions.updateFollowUp(lead.id, f.id, (x) => ({ ...x, dueAt: Math.max(x.dueAt, Date.now()) + 24 * HOUR }));
                tickNow();
              }}
            >
              Snooze 1 day
            </Button>
            {f.origin === "user" && (
              <Button size="sm" variant="ghost" icon={X} aria-label="Remove follow-up" onClick={() => actions.removeFollowUp(lead.id, f.id)} />
            )}
          </div>
        )}
      </div>

      {mode === "draft" && (
        <div className="animate-fade-in border-t border-line bg-paper/70 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted">
              Channel
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="mt-1 block rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_META[c].label}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-xs text-muted">
              Tone
              <div className="mt-1 flex rounded-md border border-line bg-white p-0.5" role="radiogroup" aria-label="Tone">
                {TONES.map((t) => (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={tone === t}
                    onClick={() => setTone(t)}
                    className={clsx("rounded px-2 py-1 text-xs font-medium capitalize", tone === t ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              icon={f.draft ? RotateCcw : Sparkles}
              loading={busy}
              disabled={!aiOk}
              onClick={() => draftFollowUp(lead.id, f.id, { channel, tone })}
            >
              {f.draft ? "Regenerate" : "Generate"}
            </Button>
          </div>

          {error && (
            <div className="mt-3">
              <ErrorNote message={error} onRetry={() => draftFollowUp(lead.id, f.id, { channel, tone })} retrying={busy} />
            </div>
          )}
          {busy && !f.draft && <div className="skeleton mt-3 h-24" />}
          {f.draft && <DraftView draft={f.draft} faded={busy} />}
        </div>
      )}

      {mode === "complete" && <CompleteForm lead={lead} f={f} onCancel={() => setMode(f.draft ? "draft" : "idle")} />}
    </Card>
  );
}

function DraftView({ draft, faded }: { draft: NonNullable<FollowUp["draft"]>; faded: boolean }) {
  const [copied, setCopied] = useState(false);
  const full = draft.subject ? `Subject: ${draft.subject}\n\n${draft.message}` : draft.message;
  return (
    <div className={clsx("mt-3 rounded-lg border border-line bg-white p-3 transition-opacity", faded && "opacity-50")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10.5px] font-medium text-faint">
          <Sparkles className="size-3" /> AI draft · {CHANNEL_META[draft.channel].label} · {draft.tone} · review before sending
        </span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(full);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch {}
          }}
          className="flex items-center gap-1 text-xs font-medium text-accent"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {draft.subject && <p className="mb-1 text-sm font-medium">Subject: {draft.subject}</p>}
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{draft.message}</p>
      {draft.addresses.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
          <span className="text-[11px] text-muted">Responds to:</span>
          {draft.addresses.map((a, i) => (
            <span key={i} className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-strong">
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CompleteForm({ lead, f, onCancel }: { lead: Lead; f: FollowUp; onCancel: () => void }) {
  const [outcome, setOutcome] = useState("");
  const [next, setNext] = useState<number | null>(QUICK_DUE[2].ms);
  const [nextTitle, setNextTitle] = useState(`Follow up with ${lead.input.name.split(" ")[0]}`);

  const confirm = () => {
    const at = Date.now();
    actions.updateFollowUp(lead.id, f.id, (x) => ({ ...x, status: "done", completedAt: at, outcome: outcome.trim() || undefined }));
    if (next !== null && nextTitle.trim()) {
      actions.addFollowUp(lead.id, { title: nextTitle.trim(), channel: f.channel, dueAt: at + next, origin: "user" });
    }
    tickNow();
  };

  return (
    <div className="animate-fade-in space-y-3 border-t border-line bg-paper/70 p-4">
      <label className="block text-xs font-medium text-ink-2">
        What happened? <span className="font-normal text-muted">(optional, used to personalise the next draft)</span>
        <textarea
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="e.g. Spoke for 10 min, wants a Saturday visit, still worried about maintenance cost"
          className="mt-1 block w-full rounded-md border border-line bg-white px-2.5 py-2 text-sm font-normal text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </label>
      <div className="text-xs font-medium text-ink-2">
        Schedule next touchpoint
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {QUICK_DUE.map((q) => (
            <Chip key={q.label} active={next === q.ms} onClick={() => setNext(q.ms)}>
              {q.label}
            </Chip>
          ))}
          <Chip active={next === null} onClick={() => setNext(null)}>
            No follow-up
          </Chip>
        </div>
        {next !== null && (
          <input
            value={nextTitle}
            onChange={(e) => setNextTitle(e.target.value)}
            maxLength={200}
            aria-label="Next follow-up title"
            className="mt-2 block w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm font-normal text-ink focus:border-accent focus:outline-none"
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" icon={Check} onClick={confirm}>
          Complete
        </Button>
      </div>
    </div>
  );
}

function AddFollowUp({ lead, now, onDone, defaultChannel }: { lead: Lead; now: number; onDone: () => void; defaultChannel: Channel }) {
  const [title, setTitle] = useState(`Call ${lead.input.name.split(" ")[0]} to confirm next steps`);
  const [channel, setChannel] = useState<Channel>(defaultChannel);
  const [due, setDue] = useState(QUICK_DUE[1].ms);
  return (
    <Card className="animate-fade-in space-y-3 p-4">
      <p className="text-sm font-medium">New follow-up</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        aria-label="Follow-up title"
        className="block w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        {CHANNELS.map((c) => (
          <Chip key={c} active={channel === c} onClick={() => setChannel(c)}>
            {CHANNEL_META[c].label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DUE.map((q) => (
          <Chip key={q.label} active={due === q.ms} onClick={() => setDue(q.ms)}>
            {q.label}
          </Chip>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!title.trim()}
          onClick={() => {
            actions.addFollowUp(lead.id, { title: title.trim(), channel, dueAt: (now || Date.now()) + due, origin: "user" });
            tickNow();
            onDone();
          }}
        >
          Add
        </Button>
      </div>
    </Card>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink-2 hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}
