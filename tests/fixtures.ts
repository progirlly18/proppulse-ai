import type { Analysis, LeadInput } from "@/lib/schemas";

export const lead: LeadInput = {
  name: "Test Buyer",
  location: "Whitefield, Bengaluru",
  propertyRequirement: "3 BHK ready to move",
  budget: "₹1.5 Cr",
  timeline: "1_month",
  customerMessage: "We need to move before December and want a site visit this Saturday.",
};

export const analysis = (scores: Partial<Record<keyof Analysis["scoring"], number>> = {}, confidence: "high" | "medium" | "low" = "high"): Analysis => ({
  summary: "Relocating family wants a ready 3 BHK near ITPL within a month.",
  intent: { category: "ready_to_buy", explanation: "Asked for a site visit (stated)." },
  requirements: [{ item: "3 BHK", source: "stated" }],
  objections: [{ concern: "Maintenance charges", source: "stated", severity: "medium" }],
  missingInformation: ["Financing status"],
  scoring: {
    timeline: { score: scores.timeline ?? 5, evidence: "before December" },
    intent: { score: scores.intent ?? 5, evidence: "wants a site visit" },
    clarity: { score: scores.clarity ?? 4, evidence: "3 BHK, ready to move" },
    engagement: { score: scores.engagement ?? 3, evidence: "short but specific" },
    friction: { score: scores.friction ?? 1, evidence: "maintenance worry" },
  },
  nextAction: { action: "Call to confirm Saturday visit", channel: "call", timing: "today", rationale: "Time-bound." },
  suggestedReply: "Hi, thanks for reaching out...",
  confidence: { level: confidence, reason: "Clear message" },
});
