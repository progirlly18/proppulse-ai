import type { Analysis, FactorKey, Timing } from "./schemas";

/**
 * Lead priority scoring.
 *
 * The model never outputs the final score. It rates five factors on a 0–5
 * rubric and quotes the evidence for each; this file turns those ratings into
 * a 0–100 score with fixed weights. That keeps the score explainable (every
 * point traces back to a factor and a quote) and consistent (the same ratings
 * always give the same score, whatever the model's mood).
 *
 * Budget size is deliberately not a factor: a large budget says nothing about
 * whether the person will buy.
 */

export type Tier = "hot" | "warm" | "cold";

export interface FactorDef {
  key: FactorKey;
  label: string;
  weight: number; // max points this factor can contribute
  inverted?: boolean; // higher rating = worse (friction)
  rubric: string; // shown in the UI and given to the model
}

export const FACTORS: FactorDef[] = [
  {
    key: "timeline",
    label: "Timeline urgency",
    weight: 30,
    rubric: "5 = must buy/move within weeks with a concrete reason; 0 = no timeline or 'just browsing'.",
  },
  {
    key: "intent",
    label: "Explicit intent",
    weight: 25,
    rubric: "5 = customer explicitly asks to visit, book or negotiate; 0 = no stated wish to buy.",
  },
  {
    key: "clarity",
    label: "Requirement clarity",
    weight: 20,
    rubric: "5 = location, configuration and must-haves are specific; 0 = vague or contradictory.",
  },
  {
    key: "engagement",
    label: "Engagement",
    weight: 15,
    rubric: "5 = detailed message, asks specific questions, shares availability; 0 = one-line or auto-generated.",
  },
  {
    key: "friction",
    label: "Blocking concerns",
    weight: 10,
    inverted: true,
    rubric: "5 = serious unresolved blockers (e.g. needs to sell first, family not aligned); 0 = no concerns.",
  },
];

export const TIER_THRESHOLDS = { hot: 70, warm: 45 } as const;

export interface FactorBreakdown {
  key: FactorKey;
  label: string;
  rating: number; // 0–5 as given by the model
  points: number; // contribution to the 0–100 score
  maxPoints: number;
  evidence: string;
  inverted: boolean;
}

export interface PriorityResult {
  score: number;
  tier: Tier;
  breakdown: FactorBreakdown[];
  /** Short human-readable reasons, strongest signals first. */
  reasons: string[];
  /** True when the model itself said it is unsure; the UI flags these. */
  needsQualification: boolean;
}

const clampRating = (n: number) => Math.max(0, Math.min(5, Math.round(n)));

export function tierFor(score: number): Tier {
  if (score >= TIER_THRESHOLDS.hot) return "hot";
  if (score >= TIER_THRESHOLDS.warm) return "warm";
  return "cold";
}

export function computePriority(analysis: Pick<Analysis, "scoring" | "confidence">): PriorityResult {
  const breakdown: FactorBreakdown[] = FACTORS.map((f) => {
    const raw = analysis.scoring[f.key];
    const rating = clampRating(raw.score);
    const effective = f.inverted ? 5 - rating : rating;
    return {
      key: f.key,
      label: f.label,
      rating,
      points: Math.round((effective / 5) * f.weight * 10) / 10,
      maxPoints: f.weight,
      evidence: raw.evidence,
      inverted: !!f.inverted,
    };
  });

  const score = Math.round(breakdown.reduce((sum, b) => sum + b.points, 0));

  const reasons = [...breakdown]
    .map((b) => {
      const share = b.points / b.maxPoints; // 0..1, already "good = high"
      const strength = b.inverted ? (b.rating >= 3 ? -1 : 0) : share >= 0.7 ? 1 : share <= 0.3 ? -1 : 0;
      return { b, strength, share };
    })
    .filter((r) => r.strength !== 0)
    .sort((a, b) => b.strength - a.strength || b.b.maxPoints - a.b.maxPoints)
    .map(({ b, strength }) => `${strength > 0 ? "+" : "−"} ${b.label}: ${b.evidence}`);

  return {
    score,
    tier: tierFor(score),
    breakdown,
    reasons,
    needsQualification: analysis.confidence.level === "low",
  };
}

/** How many hours from now a recommended timing should be due. */
export const TIMING_HOURS: Record<Timing, number> = {
  within_1_hour: 1,
  today: 6,
  within_2_days: 48,
  this_week: 120,
  next_week: 168,
};

export const TIMING_LABEL: Record<Timing, string> = {
  within_1_hour: "Within the hour",
  today: "Today",
  within_2_days: "Within 2 days",
  this_week: "This week",
  next_week: "Next week",
};

export function dueAtFor(timing: Timing, from: number): number {
  return from + TIMING_HOURS[timing] * 60 * 60 * 1000;
}
