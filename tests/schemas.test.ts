import { describe, expect, it } from "vitest";
import { AnalysisSchema, LeadInputSchema } from "@/lib/schemas";
import { analysis, lead } from "./fixtures";

describe("LeadInputSchema", () => {
  it("accepts a complete lead and trims whitespace", () => {
    const r = LeadInputSchema.safeParse({ ...lead, name: "  Asha  " });
    expect(r.success && r.data.name).toBe("Asha");
  });

  it("rejects missing and invalid fields with readable messages", () => {
    const r = LeadInputSchema.safeParse({ name: "A", location: "", budget: " ", timeline: "someday", customerMessage: "hi" });
    expect(r.success).toBe(false);
    const fields = Object.fromEntries(r.error!.issues.map((i) => [i.path[0], i.message]));
    expect(Object.keys(fields).sort()).toEqual(["budget", "customerMessage", "location", "name", "propertyRequirement", "timeline"]);
    expect(fields.timeline).toBe("Choose a buying timeline");
  });

  it("caps the customer message length", () => {
    expect(LeadInputSchema.safeParse({ ...lead, customerMessage: "x".repeat(4001) }).success).toBe(false);
  });
});

describe("AnalysisSchema", () => {
  it("accepts a well-formed analysis", () => {
    expect(AnalysisSchema.safeParse(analysis()).success).toBe(true);
  });
  it("rejects unknown enum values and missing fields", () => {
    const bad = { ...analysis(), intent: { category: "definitely_buying", explanation: "x" } };
    expect(AnalysisSchema.safeParse(bad).success).toBe(false);
    const missing: Partial<ReturnType<typeof analysis>> = analysis();
    delete missing.suggestedReply;
    expect(AnalysisSchema.safeParse(missing).success).toBe(false);
  });
  it("rejects factor scores outside 0–5", () => {
    const a = analysis();
    a.scoring.timeline.score = 7;
    expect(AnalysisSchema.safeParse(a).success).toBe(false);
  });
});
