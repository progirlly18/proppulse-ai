import { z } from "zod";

/**
 * Shared validation schemas. Used by the browser form, the API routes and the
 * AI-output validator, so all three agree on what a valid lead/analysis is.
 */

export const TIMELINE_OPTIONS = [
  { value: "immediate", label: "Immediately (within 2 weeks)" },
  { value: "1_month", label: "Within 1 month" },
  { value: "1_3_months", label: "1–3 months" },
  { value: "3_6_months", label: "3–6 months" },
  { value: "6_plus_months", label: "6+ months" },
  { value: "exploring", label: "Just exploring / not sure" },
] as const;

export type TimelineValue = (typeof TIMELINE_OPTIONS)[number]["value"];

export function timelineLabel(value: string): string {
  return TIMELINE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

const trimmed = (min: number, max: number, field: string) =>
  z
    .string({ error: `${field} is required` })
    .trim()
    .min(min, min <= 1 ? `${field} is required` : `${field} must be at least ${min} characters`)
    .max(max, `${field} must be at most ${max} characters`);

export const LeadInputSchema = z.object({
  name: trimmed(2, 80, "Name"),
  location: trimmed(2, 120, "Location"),
  propertyRequirement: trimmed(3, 300, "Property requirement"),
  budget: trimmed(1, 80, "Budget"),
  timeline: z.enum(
    TIMELINE_OPTIONS.map((o) => o.value) as [TimelineValue, ...TimelineValue[]],
    { error: "Choose a buying timeline" },
  ),
  customerMessage: trimmed(10, 4000, "Customer message"),
});

export type LeadInput = z.infer<typeof LeadInputSchema>;

/* ------------------------------------------------------------------ */
/* AI analysis output                                                  */
/* ------------------------------------------------------------------ */

export const SOURCE = ["stated", "inferred"] as const;
export const INTENT_CATEGORIES = [
  "ready_to_buy",
  "actively_evaluating",
  "early_research",
  "investment",
  "rental_or_other",
  "unclear",
] as const;
export const CHANNELS = ["call", "whatsapp", "email", "site_visit", "meeting"] as const;
export const TIMINGS = ["within_1_hour", "today", "within_2_days", "this_week", "next_week"] as const;

const factor = z.object({
  score: z.number().int().min(0).max(5),
  evidence: z.string().trim().min(1).max(300),
});

export const AnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  intent: z.object({
    category: z.enum(INTENT_CATEGORIES),
    explanation: z.string().trim().min(1).max(400),
  }),
  requirements: z
    .array(z.object({ item: z.string().trim().min(1).max(200), source: z.enum(SOURCE) }))
    .min(1)
    .max(10),
  objections: z
    .array(
      z.object({
        concern: z.string().trim().min(1).max(240),
        source: z.enum(SOURCE),
        severity: z.enum(["low", "medium", "high"]),
      }),
    )
    .max(8),
  missingInformation: z.array(z.string().trim().min(1).max(200)).max(8),
  scoring: z.object({
    timeline: factor,
    intent: factor,
    clarity: factor,
    engagement: factor,
    friction: factor,
  }),
  nextAction: z.object({
    action: z.string().trim().min(1).max(300),
    channel: z.enum(CHANNELS),
    timing: z.enum(TIMINGS),
    rationale: z.string().trim().min(1).max(400),
  }),
  suggestedReply: z.string().trim().min(1).max(1500),
  confidence: z.object({
    level: z.enum(["high", "medium", "low"]),
    reason: z.string().trim().min(1).max(300),
  }),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type FactorKey = keyof Analysis["scoring"];
export type Channel = (typeof CHANNELS)[number];
export type Timing = (typeof TIMINGS)[number];

/**
 * JSON schema handed to Gemini (structured output). Written by hand so it only
 * uses keywords Gemini's responseJsonSchema accepts; the Zod schema above is
 * the authority and re-validates whatever comes back.
 */
const str = { type: "string" };
const factorJson = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 5 },
    evidence: str,
  },
  required: ["score", "evidence"],
};
const sourceJson = { type: "string", enum: [...SOURCE] };

export const AnalysisJsonSchema = {
  type: "object",
  properties: {
    summary: str,
    intent: {
      type: "object",
      properties: {
        category: { type: "string", enum: [...INTENT_CATEGORIES] },
        explanation: str,
      },
      required: ["category", "explanation"],
    },
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: { item: str, source: sourceJson },
        required: ["item", "source"],
      },
    },
    objections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concern: str,
          source: sourceJson,
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["concern", "source", "severity"],
      },
    },
    missingInformation: { type: "array", items: str },
    scoring: {
      type: "object",
      properties: {
        timeline: factorJson,
        intent: factorJson,
        clarity: factorJson,
        engagement: factorJson,
        friction: factorJson,
      },
      required: ["timeline", "intent", "clarity", "engagement", "friction"],
    },
    nextAction: {
      type: "object",
      properties: {
        action: str,
        channel: { type: "string", enum: [...CHANNELS] },
        timing: { type: "string", enum: [...TIMINGS] },
        rationale: str,
      },
      required: ["action", "channel", "timing", "rationale"],
    },
    suggestedReply: str,
    confidence: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["high", "medium", "low"] },
        reason: str,
      },
      required: ["level", "reason"],
    },
  },
  required: [
    "summary",
    "intent",
    "requirements",
    "objections",
    "missingInformation",
    "scoring",
    "nextAction",
    "suggestedReply",
    "confidence",
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Follow-up message drafting                                          */
/* ------------------------------------------------------------------ */

export const TONES = ["warm", "assertive", "concise"] as const;
export type Tone = (typeof TONES)[number];

export const FollowUpDraftSchema = z.object({
  subject: z.string().trim().max(150).optional().default(""),
  message: z.string().trim().min(1).max(2000),
  addresses: z.array(z.string().trim().min(1).max(200)).max(6),
});
export type FollowUpDraft = z.infer<typeof FollowUpDraftSchema>;

export const FollowUpDraftJsonSchema = {
  type: "object",
  properties: {
    subject: str,
    message: str,
    addresses: { type: "array", items: str },
  },
  required: ["message", "addresses"],
} as const;

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});
export type ChatTurn = z.infer<typeof ChatMessageSchema>;
