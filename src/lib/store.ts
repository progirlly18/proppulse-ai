"use client";

import { useSyncExternalStore } from "react";
import type { LeadInput } from "./schemas";
import { SAMPLE_LEADS } from "./samples";
import type { FollowUp, Lead } from "./types";

/**
 * Browser-local persistence. Leads, analyses, chats and follow-ups live in
 * localStorage on this device only: no account, no sync across devices. This
 * keeps the demo deployable on free tiers with zero database credentials; the
 * README explains the trade-off and how to swap in a database.
 */

const STORAGE_KEY = "proppulse.v1";

export interface PersistedState {
  version: 1;
  leads: Lead[];
  selectedLeadId: string | null;
}

/** Transient UI state that must not survive a refresh. */
export interface RuntimeState {
  busy: Record<string, "analyzing" | "chatting" | "drafting" | undefined>;
  errors: Record<string, string | undefined>;
  storageError: string | null;
}

export interface AppState extends PersistedState, RuntimeState {}

let state: AppState | null = null;
const listeners = new Set<() => void>();

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Cheap stable fingerprint, used to tell whether an analysis is stale. */
export function hashInput(input: LeadInput): string {
  const s = JSON.stringify([
    input.name,
    input.location,
    input.propertyRequirement,
    input.budget,
    input.timeline,
    input.customerMessage,
  ]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function seedLeads(now: number): Lead[] {
  return SAMPLE_LEADS.map((s, i) => ({
    id: `sample-${i + 1}`,
    createdAt: now - s.receivedMinutesAgo * 60_000,
    updatedAt: now - s.receivedMinutesAgo * 60_000,
    isSample: true,
    input: s.input,
    chat: [],
    followUps: [],
  }));
}

function emptyRuntime(): RuntimeState {
  return { busy: {}, errors: {}, storageError: null };
}

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed?.version === 1 && Array.isArray(parsed.leads)) {
        return { ...parsed, ...emptyRuntime() };
      }
    }
  } catch {
    // Corrupt or blocked storage: fall through to a fresh seed.
  }
  return { version: 1, leads: seedLeads(Date.now()), selectedLeadId: null, ...emptyRuntime() };
}

function persist(s: AppState) {
  try {
    const data: PersistedState = { version: 1, leads: s.leads, selectedLeadId: s.selectedLeadId };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (s.storageError) state = { ...s, storageError: null };
  } catch {
    state = { ...s, storageError: "Your browser blocked saving. Changes will be lost on refresh." };
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): AppState {
  if (!state) state = load();
  return state;
}

function set(update: (s: AppState) => AppState, { save = true } = {}) {
  state = update(ensure());
  if (save) persist(state);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep two open tabs consistent.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    const runtime = state ? { busy: state.busy, errors: state.errors, storageError: state.storageError } : emptyRuntime();
    state = { ...load(), ...runtime };
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, ensure, () => null);
}

export function getState(): AppState {
  return ensure();
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function patchLead(id: string, fn: (l: Lead) => Lead) {
  set((s) => ({
    ...s,
    leads: s.leads.map((l) => (l.id === id ? { ...fn(l), updatedAt: Date.now() } : l)),
  }));
}

export const actions = {
  addLead(input: LeadInput): string {
    const id = uid();
    const now = Date.now();
    set((s) => ({
      ...s,
      selectedLeadId: id,
      leads: [{ id, createdAt: now, updatedAt: now, isSample: false, input, chat: [], followUps: [] }, ...s.leads],
    }));
    return id;
  },

  updateLeadInput(id: string, input: LeadInput) {
    patchLead(id, (l) => ({ ...l, input }));
  },

  deleteLead(id: string) {
    set((s) => ({
      ...s,
      leads: s.leads.filter((l) => l.id !== id),
      selectedLeadId: s.selectedLeadId === id ? null : s.selectedLeadId,
    }));
  },

  select(id: string | null) {
    set((s) => ({ ...s, selectedLeadId: id }));
  },

  patchLead,

  addFollowUp(leadId: string, f: Omit<FollowUp, "id" | "createdAt" | "status">) {
    patchLead(leadId, (l) => ({
      ...l,
      followUps: [...l.followUps, { ...f, id: uid(), createdAt: Date.now(), status: "pending" }],
    }));
  },

  updateFollowUp(leadId: string, followUpId: string, fn: (f: FollowUp) => FollowUp) {
    patchLead(leadId, (l) => ({ ...l, followUps: l.followUps.map((f) => (f.id === followUpId ? fn(f) : f)) }));
  },

  removeFollowUp(leadId: string, followUpId: string) {
    patchLead(leadId, (l) => ({ ...l, followUps: l.followUps.filter((f) => f.id !== followUpId) }));
  },

  setBusy(key: string, value: RuntimeState["busy"][string]) {
    set((s) => ({ ...s, busy: { ...s.busy, [key]: value } }), { save: false });
  },

  setError(key: string, message: string | undefined) {
    set((s) => ({ ...s, errors: { ...s.errors, [key]: message } }), { save: false });
  },

  resetDemo() {
    set((s) => ({ ...s, leads: seedLeads(Date.now()), selectedLeadId: null, busy: {}, errors: {} }));
  },
};
