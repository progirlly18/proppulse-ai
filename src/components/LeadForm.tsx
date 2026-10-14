"use client";

import clsx from "clsx";
import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { analyzeLead } from "@/lib/ai-client";
import { LeadInputSchema, TIMELINE_OPTIONS, type LeadInput } from "@/lib/schemas";
import { actions } from "@/lib/store";
import { Button } from "./ui";

type Draft = Record<keyof LeadInput, string>;

const EMPTY: Draft = { name: "", location: "", propertyRequirement: "", budget: "", timeline: "", customerMessage: "" };

const EXAMPLE: Draft = {
  name: "Neha Kulkarni",
  location: "Hinjewadi Phase 1, Pune",
  propertyRequirement: "2 BHK near IT park, covered parking, good ventilation",
  budget: "₹70–80 L",
  timeline: "1_3_months",
  customerMessage:
    "Hello, I work in Hinjewadi and am tired of the commute from Kothrud. Looking for a 2BHK that I can move into by March. Is the bank loan process handled by your team? Also want to know if there are any hidden charges beyond the agreement value. Weekends work best for a visit.",
};

export function LeadForm({
  open,
  onClose,
  onCreated,
  aiAvailable,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  aiAvailable: boolean;
  editing?: { id: string; input: LeadInput };
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="lead-form-title"
      className="m-auto w-[min(640px,calc(100vw-24px))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]"
    >
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {open && <LeadFormBody onClose={onClose} onCreated={onCreated} aiAvailable={aiAvailable} editing={editing} dialog={ref} />}
    </dialog>
  );
}

function LeadFormBody({
  onClose,
  onCreated,
  aiAvailable,
  editing,
  dialog,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
  aiAvailable: boolean;
  editing?: { id: string; input: LeadInput };
  dialog: React.RefObject<HTMLDialogElement | null>;
}) {
  const [draft, setDraft] = useState<Draft>(() => (editing ? { ...editing.input } : EMPTY));
  const [errors, setErrors] = useState<Partial<Record<keyof LeadInput, string>>>({});
  const [analyzeNow, setAnalyzeNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const update = (k: keyof LeadInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setDraft((d) => ({ ...d, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // guards against double submit
    const parsed = LeadInputSchema.safeParse(draft);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof LeadInput;
        next[k] ??= issue.message;
      }
      setErrors(next);
      const first = Object.keys(next)[0];
      dialog.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setSubmitting(true);
    let id: string;
    if (editing) {
      actions.updateLeadInput(editing.id, parsed.data);
      id = editing.id;
    } else {
      id = actions.addLead(parsed.data);
    }
    if (analyzeNow && aiAvailable) void analyzeLead(id);
    onCreated?.(id);
    onClose();
  };

  return (
      <form onSubmit={submit} noValidate className="flex max-h-[min(860px,calc(100dvh-24px))] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 id="lead-form-title" className="font-display text-xl font-semibold">
              {editing ? "Edit lead" : "New lead"}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {editing ? "Changing details marks the analysis as out of date." : "Enter what the customer told you. All fields are required."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-sunken" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="scroll-thin grid gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <input name="name" value={draft.name} onChange={update("name")} autoComplete="off" placeholder="Customer name" className={input(errors.name)} />
          </Field>
          <Field label="Location" error={errors.location}>
            <input name="location" value={draft.location} onChange={update("location")} placeholder="Area, city" className={input(errors.location)} />
          </Field>
          <Field label="Property requirement" error={errors.propertyRequirement} wide>
            <input
              name="propertyRequirement"
              value={draft.propertyRequirement}
              onChange={update("propertyRequirement")}
              placeholder="e.g. 3 BHK, ready to move, near metro"
              className={input(errors.propertyRequirement)}
            />
          </Field>
          <Field label="Budget" error={errors.budget}>
            <input name="budget" value={draft.budget} onChange={update("budget")} placeholder="e.g. ₹1.2–1.4 Cr" className={input(errors.budget)} />
          </Field>
          <Field label="Buying timeline" error={errors.timeline}>
            <select name="timeline" value={draft.timeline} onChange={update("timeline")} className={input(errors.timeline)}>
              <option value="" disabled>
                Select…
              </option>
              {TIMELINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Customer message" error={errors.customerMessage} wide hint="Paste the enquiry, email or chat transcript as-is.">
            <textarea
              name="customerMessage"
              value={draft.customerMessage}
              onChange={update("customerMessage")}
              rows={6}
              maxLength={4000}
              placeholder="What did the customer write or say?"
              className={clsx(input(errors.customerMessage), "h-auto resize-y py-2 leading-relaxed")}
            />
            <span className="mt-1 block text-right text-[11px] text-faint tabular-nums">{draft.customerMessage.length}/4000</span>
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-line bg-paper/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <label className={clsx("flex items-center gap-2 text-sm", !aiAvailable && "opacity-50")}>
              <input
                type="checkbox"
                checked={analyzeNow && aiAvailable}
                disabled={!aiAvailable}
                onChange={(e) => setAnalyzeNow(e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              Analyze with AI after saving
            </label>
            {!editing && (
              <button type="button" onClick={() => setDraft(EXAMPLE)} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
                Fill example
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting} icon={Sparkles}>
              {editing ? "Save changes" : "Save lead"}
            </Button>
          </div>
        </div>
      </form>
  );
}

const input = (error?: string) =>
  clsx(
    "h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-faint transition-colors",
    "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
    error ? "border-danger/60" : "border-line hover:border-line-strong",
  );

function Field({ label, error, wide, hint, children }: { label: string; error?: string; wide?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("block", wide && "sm:col-span-2")}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
}
