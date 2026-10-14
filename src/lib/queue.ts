import { followUpState, nextOpenFollowUp } from "./followups";
import type { Tier } from "./scoring";
import type { Lead } from "./types";

/** Pure queue logic (search, filter, sort) so it can be unit-tested. */

export type SortKey = "priority" | "newest" | "due" | "name";
export type TierFilter = "all" | Tier | "unanalyzed";
export type FollowUpFilter = "any" | "overdue" | "due_today";
export type OriginFilter = "all" | "mine" | "sample";

export interface QueueQuery {
  search: string;
  tier: TierFilter;
  followUp: FollowUpFilter;
  origin: OriginFilter;
  sort: SortKey;
}

export const DEFAULT_QUERY: QueueQuery = { search: "", tier: "all", followUp: "any", origin: "all", sort: "priority" };

const score = (l: Lead) => l.analysis?.priority.score ?? -1;

/** Priority order: highest score first; unanalyzed leads last, newest first. */
export function rankLeads(leads: Lead[], now: number): Lead[] {
  return applyQuery(leads, { ...DEFAULT_QUERY }, now);
}

export function applyQuery(leads: Lead[], q: QueueQuery, now: number): Lead[] {
  const term = q.search.trim().toLowerCase();
  const filtered = leads.filter((l) => {
    if (q.origin === "mine" && l.isSample) return false;
    if (q.origin === "sample" && !l.isSample) return false;
    if (q.tier === "unanalyzed" && l.analysis) return false;
    if (q.tier !== "all" && q.tier !== "unanalyzed" && l.analysis?.priority.tier !== q.tier) return false;
    if (q.followUp !== "any") {
      const states = l.followUps.map((f) => followUpState(f, now));
      if (!states.includes(q.followUp)) return false;
    }
    if (term) {
      const hay = [
        l.input.name,
        l.input.location,
        l.input.propertyRequirement,
        l.input.budget,
        l.input.customerMessage,
        l.analysis?.data.summary ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const due = (l: Lead) => nextOpenFollowUp(l)?.dueAt ?? Number.POSITIVE_INFINITY;
  const sorters: Record<SortKey, (a: Lead, b: Lead) => number> = {
    priority: (a, b) => score(b) - score(a) || b.createdAt - a.createdAt,
    newest: (a, b) => b.createdAt - a.createdAt,
    due: (a, b) => due(a) - due(b) || score(b) - score(a),
    name: (a, b) => a.input.name.localeCompare(b.input.name),
  };
  return [...filtered].sort(sorters[q.sort]);
}
