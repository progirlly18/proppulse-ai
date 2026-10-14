import type { FollowUp, FollowUpState, Lead } from "./types";

/** Derived, never stored: a pending follow-up becomes overdue as time passes. */
export function followUpState(f: FollowUp, now: number): FollowUpState {
  if (f.status === "done") return "done";
  if (f.dueAt < now) return "overdue";
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return f.dueAt <= end.getTime() ? "due_today" : "upcoming";
}

export function nextOpenFollowUp(lead: Lead): FollowUp | undefined {
  return lead.followUps
    .filter((f) => f.status === "pending")
    .sort((a, b) => a.dueAt - b.dueAt)[0];
}

export interface FollowUpRow {
  lead: Lead;
  followUp: FollowUp;
  state: FollowUpState;
}

export function allFollowUps(leads: Lead[], now: number): FollowUpRow[] {
  return leads
    .flatMap((lead) => lead.followUps.map((followUp) => ({ lead, followUp, state: followUpState(followUp, now) })))
    .sort((a, b) => a.followUp.dueAt - b.followUp.dueAt);
}

export function formatDue(dueAt: number, now: number): string {
  const diff = dueAt - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const span = mins < 60 ? `${Math.max(1, mins)} min` : hours < 36 ? `${hours} h` : `${days} d`;
  return diff < 0 ? `${span} overdue` : `in ${span}`;
}
