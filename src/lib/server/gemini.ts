import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { repairPrompt } from "../prompts";

/**
 * The only place the app talks to Gemini. Runs on the server (route handlers),
 * so GEMINI_API_KEY never reaches the browser.
 */

export const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";

export class AIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: "not_configured" | "rate_limited" | "invalid_output" | "upstream" | "blocked" | "timeout",
  ) {
    super(message);
  }
}

let client: GoogleGenAI | null = null;

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AIError(
      "The AI provider is not configured on this server (GEMINI_API_KEY is missing).",
      503,
      "not_configured",
    );
  }
  client ??= new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 45_000, retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 4 } },
  });
  return client;
}

function mapError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof ApiError) {
    if (err.status === 429)
      return new AIError("Gemini rate limit reached. Wait a minute and try again.", 429, "rate_limited");
    if (err.status === 400 || err.status === 401 || err.status === 403)
      return new AIError(`Gemini rejected the request (${err.status}). Check the API key and model name.`, 502, "upstream");
    return new AIError(`Gemini returned an error (${err.status}). Please retry.`, 502, "upstream");
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/timed? ?out|abort/i.test(msg)) return new AIError("Gemini took too long to respond. Please retry.", 504, "timeout");
  return new AIError("Could not reach Gemini. Please retry.", 502, "upstream");
}

interface CallOptions {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  jsonSchema?: unknown;
}

async function call({ system, prompt, maxOutputTokens, temperature, jsonSchema }: CallOptions): Promise<string> {
  try {
    const res = await getClient().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature,
        maxOutputTokens,
        ...(jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: jsonSchema } : {}),
      },
    });
    const candidate = res.candidates?.[0];
    const finish = candidate?.finishReason;
    if (res.promptFeedback?.blockReason || finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
      throw new AIError("Gemini declined to answer this request (safety filter).", 422, "blocked");
    }
    const text = res.text?.trim();
    if (!text) {
      throw new AIError(
        finish === "MAX_TOKENS" ? "Gemini ran out of output tokens. Please retry." : "Gemini returned an empty response.",
        502,
        "invalid_output",
      );
    }
    return text;
  } catch (err) {
    throw mapError(err);
  }
}

export async function generateText(opts: Omit<CallOptions, "jsonSchema">): Promise<string> {
  return call(opts);
}

/**
 * Structured generation: ask for JSON matching `jsonSchema`, validate with
 * Zod, and if the output is malformed ask the model once to repair it. If it
 * is still invalid we fail loudly; there is no canned fallback.
 */
export async function generateJson<T>(
  opts: CallOptions & { jsonSchema: unknown; validator: z.ZodType<T> },
): Promise<T> {
  const attempt = async (prompt: string) => {
    const text = await call({ ...opts, prompt });
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(text));
    } catch {
      return { ok: false as const, problems: "response was not valid JSON" };
    }
    const result = opts.validator.safeParse(parsed);
    if (result.success) return { ok: true as const, data: result.data };
    return {
      ok: false as const,
      problems: result.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  };

  const first = await attempt(opts.prompt);
  if (first.ok) return first.data;
  const second = await attempt(repairPrompt(opts.prompt, first.problems));
  if (second.ok) return second.data;
  throw new AIError(`Gemini returned an answer in an unexpected format (${second.problems}). Please retry.`, 502, "invalid_output");
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
