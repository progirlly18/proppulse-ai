"use client";

import type { Analysis, Channel, FollowUpDraft, Tone } from "./schemas";
import type { PriorityResult } from "./scoring";
import { dueAtFor } from "./scoring";
import { actions, getState, hashInput, uid } from "./store";
import type { Lead } from "./types";

/**
 * Browser-side wrappers for the three AI endpoints. They own the busy/error
 * flags (so a button can't fire twice) and write results into the store.
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("Network error. Check your connection and retry.", 0, "network");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(
      data?.error ?? `Request failed (${res.status}).`,
      res.status,
      data?.code ?? "unknown",
      data?.details,
    );
  }
  return data as T;
}

const errMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export function isAnalysisStale(lead: Lead): boolean {
  return !!lead.analysis && lead.analysis.inputHash !== hashInput(lead.input);
}

export async function analyzeLead(leadId: string): Promise<boolean> {
  const key = `analyze:${leadId}`;
  const s = getState();
  if (s.busy[key]) return false; // already running: ignore double clicks
  const lead = s.leads.find((l) => l.id === leadId);
  if (!lead) return false;

  actions.setBusy(key, "analyzing");
  actions.setError(key, undefined);
  try {
    const res = await postJson<{ analysis: Analysis; priority: PriorityResult; model: string; analyzedAt: number }>(
      "/api/analyze",
      { lead: lead.input },
    );
    actions.patchLead(leadId, (l) => {
      const hasOpen = l.followUps.some((f) => f.status === "pending");
      const next = res.analysis.nextAction;
      return {
        ...l,
        analysis: {
          data: res.analysis,
          priority: res.priority,
          model: res.model,
          analyzedAt: res.analyzedAt,
          inputHash: hashInput(l.input),
        },
        // First analysis seeds the follow-up plan with the AI's recommendation.
        // It is labelled "Suggested by AI" until the salesperson acts on it.
        followUps: hasOpen
          ? l.followUps
          : [
              ...l.followUps,
              {
                id: uid(),
                title: next.action,
                channel: next.channel,
                dueAt: dueAtFor(next.timing, Date.now()),
                status: "pending",
                origin: "ai",
                createdAt: Date.now(),
              },
            ],
      };
    });
    return true;
  } catch (e) {
    actions.setError(key, errMessage(e));
    return false;
  } finally {
    actions.setBusy(key, undefined);
  }
}

/** Analyze several leads with limited concurrency to respect free-tier rate limits. */
export async function analyzeMany(ids: string[], concurrency = 2) {
  const queue = [...ids];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift()!;
      await analyzeLead(id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
}

/**
 * Send a chat message about one lead. Pass `null` to retry the last
 * unanswered message after a failure (it is not appended twice).
 */
export async function sendChat(leadId: string, text: string | null): Promise<boolean> {
  const key = `chat:${leadId}`;
  const s = getState();
  if (s.busy[key]) return false;
  const lead = s.leads.find((l) => l.id === leadId);
  if (!lead) return false;

  let history = lead.chat;
  if (text === null) {
    if (history[history.length - 1]?.role !== "user") return false;
  } else {
    if (!text.trim()) return false;
    const userMsg = { id: uid(), role: "user" as const, content: text.trim(), at: Date.now() };
    history = [...history, userMsg];
    actions.patchLead(leadId, (l) => ({ ...l, chat: [...l.chat, userMsg] }));
  }
  actions.setBusy(key, "chatting");
  actions.setError(key, undefined);
  try {
    const messages = history.map(({ role, content }) => ({ role, content }));
    const res = await postJson<{ reply: string }>("/api/chat", {
      lead: lead.input,
      analysis: lead.analysis?.data,
      messages,
    });
    actions.patchLead(leadId, (l) => ({
      ...l,
      chat: [...l.chat, { id: uid(), role: "assistant", content: res.reply, at: Date.now() }],
    }));
    return true;
  } catch (e) {
    actions.setError(key, errMessage(e));
    return false;
  } finally {
    actions.setBusy(key, undefined);
  }
}

export async function draftFollowUp(
  leadId: string,
  followUpId: string,
  opts: { channel: Channel; tone: Tone },
): Promise<boolean> {
  const key = `draft:${followUpId}`;
  const s = getState();
  if (s.busy[key]) return false;
  const lead = s.leads.find((l) => l.id === leadId);
  const fu = lead?.followUps.find((f) => f.id === followUpId);
  if (!lead || !fu) return false;

  const lastDone = lead.followUps
    .filter((f) => f.status === "done" && f.outcome)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];

  actions.setBusy(key, "drafting");
  actions.setError(key, undefined);
  try {
    const res = await postJson<{ draft: FollowUpDraft; model: string; generatedAt: number }>("/api/followup", {
      lead: lead.input,
      analysis: lead.analysis?.data,
      channel: opts.channel,
      tone: opts.tone,
      goal: fu.title,
      previousOutcome: lastDone?.outcome,
    });
    actions.updateFollowUp(leadId, followUpId, (f) => ({
      ...f,
      draft: {
        message: res.draft.message,
        subject: res.draft.subject ?? "",
        addresses: res.draft.addresses,
        tone: opts.tone,
        channel: opts.channel,
        model: res.model,
        generatedAt: res.generatedAt,
      },
    }));
    return true;
  } catch (e) {
    actions.setError(key, errMessage(e));
    return false;
  } finally {
    actions.setBusy(key, undefined);
  }
}
