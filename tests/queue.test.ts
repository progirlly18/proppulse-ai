import { describe, expect, it } from "vitest";
import { followUpState, formatDue } from "@/lib/followups";
import { applyQuery, DEFAULT_QUERY } from "@/lib/queue";
import { computePriority } from "@/lib/scoring";
import type { Lead } from "@/lib/types";
import { analysis, lead } from "./fixtures";

const NOW = new Date("2026-10-14T10:00:00").getTime();
const H = 3_600_000;

function mk(id: string, name: string, score: number | null, extra: Partial<Lead> = {}): Lead {
  const a = analysis();
  const priority = score === null ? undefined : { ...computePriority(a), score, tier: score >= 70 ? "hot" : score >= 45 ? "warm" : "cold" } as const;
  return {
    id,
    createdAt: NOW - Number(id) * H,
    updatedAt: NOW,
    isSample: false,
    input: { ...lead, name },
    analysis: priority ? { data: a, priority, model: "m", analyzedAt: NOW, inputHash: "x" } : undefined,
    chat: [],
    followUps: [],
    ...extra,
  };
}

const leads = [
  mk("1", "Cold Carl", 30),
  mk("2", "Hot Hana", 85, { isSample: true }),
  mk("3", "New Nina", null),
  mk("4", "Warm Wes", 60, {
    followUps: [{ id: "f", title: "Call", channel: "call", dueAt: NOW - H, status: "pending", origin: "ai", createdAt: NOW - 5 * H }],
  }),
];

describe("applyQuery", () => {
  it("sorts by priority, unanalyzed last", () => {
    expect(applyQuery(leads, DEFAULT_QUERY, NOW).map((l) => l.input.name)).toEqual(["Hot Hana", "Warm Wes", "Cold Carl", "New Nina"]);
  });
  it("filters by tier, unanalyzed and origin", () => {
    expect(applyQuery(leads, { ...DEFAULT_QUERY, tier: "hot" }, NOW).map((l) => l.id)).toEqual(["2"]);
    expect(applyQuery(leads, { ...DEFAULT_QUERY, tier: "unanalyzed" }, NOW).map((l) => l.id)).toEqual(["3"]);
    expect(applyQuery(leads, { ...DEFAULT_QUERY, origin: "sample" }, NOW).map((l) => l.id)).toEqual(["2"]);
  });
  it("filters overdue follow-ups", () => {
    expect(applyQuery(leads, { ...DEFAULT_QUERY, followUp: "overdue" }, NOW).map((l) => l.id)).toEqual(["4"]);
  });
  it("searches case-insensitively across fields", () => {
    expect(applyQuery(leads, { ...DEFAULT_QUERY, search: "NINA" }, NOW)).toHaveLength(1);
    expect(applyQuery(leads, { ...DEFAULT_QUERY, search: "whitefield" }, NOW)).toHaveLength(4);
  });
  it("sorts by soonest follow-up", () => {
    expect(applyQuery(leads, { ...DEFAULT_QUERY, sort: "due" }, NOW)[0].id).toBe("4");
  });
});

describe("followUpState", () => {
  const base = { id: "f", title: "t", channel: "call" as const, origin: "user" as const, createdAt: NOW };
  it("derives overdue / due today / upcoming / done from time", () => {
    expect(followUpState({ ...base, status: "pending", dueAt: NOW - 1 }, NOW)).toBe("overdue");
    expect(followUpState({ ...base, status: "pending", dueAt: NOW + H }, NOW)).toBe("due_today");
    expect(followUpState({ ...base, status: "pending", dueAt: NOW + 48 * H }, NOW)).toBe("upcoming");
    expect(followUpState({ ...base, status: "done", dueAt: NOW - 1 }, NOW)).toBe("done");
  });
  it("formats relative due times", () => {
    expect(formatDue(NOW - 2 * H, NOW)).toBe("2 h overdue");
    expect(formatDue(NOW + 30 * 60_000, NOW)).toBe("in 30 min");
  });
});
