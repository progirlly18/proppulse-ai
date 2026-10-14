import { beforeEach, describe, expect, it, vi } from "vitest";
import { analysis, lead } from "./fixtures";

// Mock the Gemini SDK, not our wrapper, so the real validation/repair/error
// mapping code in src/lib/server/gemini.ts is exercised.
const generateContent = vi.fn();
vi.mock("@google/genai", () => {
  class ApiError extends Error {
    status: number;
    constructor(o: { message: string; status: number }) {
      super(o.message);
      this.status = o.status;
    }
  }
  class GoogleGenAI {
    models = { generateContent };
  }
  return { GoogleGenAI, ApiError };
});

const ok = (text: string) => ({ text, candidates: [{ finishReason: "STOP" }] });
const post = (body: unknown, ip = String(Math.random())) =>
  new Request("http://test/api", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } });

beforeEach(() => {
  generateContent.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("POST /api/analyze", async () => {
  const { POST } = await import("@/app/api/analyze/route");

  it("rejects invalid input before calling the model", async () => {
    const res = await POST(post({ lead: { ...lead, timeline: "whenever" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).details["lead.timeline"]).toBeDefined();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("returns validated analysis plus a server-computed priority", async () => {
    generateContent.mockResolvedValueOnce(ok(JSON.stringify(analysis())));
    const res = await POST(post({ lead }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.priority.score).toBeGreaterThan(70);
    expect(body.priority.tier).toBe("hot");
    const call = generateContent.mock.calls[0][0];
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.contents).toContain("<customer_message>");
  });

  it("repairs malformed output once, then succeeds", async () => {
    generateContent.mockResolvedValueOnce(ok("{not json")).mockResolvedValueOnce(ok(JSON.stringify(analysis())));
    const res = await POST(post({ lead }));
    expect(res.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].contents).toContain("did not match the required JSON format");
  });

  it("fails loudly (no canned answer) when output stays invalid", async () => {
    generateContent.mockResolvedValue(ok(JSON.stringify({ summary: "only this" })));
    const res = await POST(post({ lead }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("invalid_output");
  });

  it("maps provider rate limits to 429", async () => {
    const { ApiError } = await import("@google/genai");
    generateContent.mockRejectedValueOnce(new (ApiError as unknown as new (o: object) => Error)({ message: "quota", status: 429 }));
    const res = await POST(post({ lead }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("rate_limited");
  });

  it("returns 503 when no API key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    vi.resetModules();
    const fresh = await import("@/app/api/analyze/route");
    const res = await fresh.POST(post({ lead }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("not_configured");
  });

  it("rate-limits a single client", async () => {
    generateContent.mockResolvedValue(ok(JSON.stringify(analysis())));
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await POST(post({ lead }, "same-ip"))).status;
    expect(last).toBe(429);
  });
});

describe("POST /api/chat", async () => {
  const { POST } = await import("@/app/api/chat/route");

  it("puts the selected lead in the system prompt", async () => {
    generateContent.mockResolvedValueOnce(ok("Emphasise water supply."));
    const res = await POST(post({ lead, analysis: analysis(), messages: [{ role: "user", content: "What should I emphasize?" }] }));
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toBe("Emphasise water supply.");
    const call = generateContent.mock.calls[0][0];
    expect(call.config.systemInstruction).toContain("Test Buyer");
    expect(call.config.systemInstruction).toContain("Maintenance charges");
    expect(call.contents).toContain("Salesperson: What should I emphasize?");
  });

  it("requires the last message to be from the user", async () => {
    const res = await POST(post({ lead, messages: [{ role: "assistant", content: "hi" }] }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/followup", async () => {
  const { POST } = await import("@/app/api/followup/route");

  it("drafts a message for the chosen channel and tone", async () => {
    generateContent.mockResolvedValueOnce(ok(JSON.stringify({ subject: "", message: "Hi!", addresses: ["visit"] })));
    const res = await POST(post({ lead, analysis: analysis(), channel: "whatsapp", tone: "warm", goal: "Confirm visit" }));
    expect(res.status).toBe(200);
    expect((await res.json()).draft.message).toBe("Hi!");
  });
});
