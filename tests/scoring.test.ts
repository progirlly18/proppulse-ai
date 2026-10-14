import { describe, expect, it } from "vitest";
import { computePriority, dueAtFor, FACTORS, tierFor } from "@/lib/scoring";
import { analysis } from "./fixtures";

describe("computePriority", () => {
  it("weights sum to 100 so the score is a 0–100 scale", () => {
    expect(FACTORS.reduce((s, f) => s + f.weight, 0)).toBe(100);
  });

  it("gives 100 for perfect ratings and no friction, 0 for the opposite", () => {
    expect(computePriority(analysis({ timeline: 5, intent: 5, clarity: 5, engagement: 5, friction: 0 })).score).toBe(100);
    expect(computePriority(analysis({ timeline: 0, intent: 0, clarity: 0, engagement: 0, friction: 5 })).score).toBe(0);
  });

  it("is deterministic for the same ratings", () => {
    const a = analysis({ timeline: 3, intent: 4, clarity: 2, engagement: 3, friction: 2 });
    expect(computePriority(a)).toEqual(computePriority(a));
  });

  it("treats friction as a penalty", () => {
    const low = computePriority(analysis({ friction: 0 })).score;
    const high = computePriority(analysis({ friction: 5 })).score;
    expect(low - high).toBe(10);
  });

  it("weights timeline more than engagement", () => {
    const t = computePriority(analysis({ timeline: 5, engagement: 0 })).score;
    const e = computePriority(analysis({ timeline: 0, engagement: 5 })).score;
    expect(t).toBeGreaterThan(e);
  });

  it("clamps out-of-range ratings", () => {
    const p = computePriority(analysis({ timeline: 9, intent: -3 }));
    expect(p.breakdown.find((b) => b.key === "timeline")!.rating).toBe(5);
    expect(p.breakdown.find((b) => b.key === "intent")!.rating).toBe(0);
  });

  it("explains itself with evidence-backed reasons", () => {
    const p = computePriority(analysis({ timeline: 5, intent: 5, friction: 4 }));
    expect(p.reasons[0]).toMatch(/^\+ /);
    expect(p.reasons.some((r) => r.startsWith("− Blocking concerns"))).toBe(true);
    expect(p.reasons.join(" ")).toContain("before December");
  });

  it("flags low-confidence analyses for qualification", () => {
    expect(computePriority(analysis({}, "low")).needsQualification).toBe(true);
    expect(computePriority(analysis({}, "high")).needsQualification).toBe(false);
  });
});

describe("tiers and timing", () => {
  it("uses fixed thresholds", () => {
    expect(tierFor(70)).toBe("hot");
    expect(tierFor(69)).toBe("warm");
    expect(tierFor(45)).toBe("warm");
    expect(tierFor(44)).toBe("cold");
  });
  it("converts AI timing into a due date", () => {
    expect(dueAtFor("within_1_hour", 0)).toBe(3_600_000);
    expect(dueAtFor("within_2_days", 0)).toBe(48 * 3_600_000);
  });
});
