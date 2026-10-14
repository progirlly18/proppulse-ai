import "server-only";
import type { z } from "zod";
import { AIError } from "./gemini";

/**
 * Best-effort per-IP limiter. In-memory, so on serverless each warm instance
 * keeps its own counter; good enough to stop a runaway loop from burning the
 * free Gemini quota, not a security control.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

export function rateLimited(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export function jsonError(status: number, error: string, code: string, details?: unknown) {
  return Response.json({ error, code, ...(details ? { details } : {}) }, { status });
}

const MAX_BODY_BYTES = 64_000;

export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  if (rateLimited(req)) {
    return { ok: false, res: jsonError(429, "Too many requests. Wait a minute and try again.", "rate_limited") };
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, res: jsonError(413, "Request is too large.", "too_large") };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, res: jsonError(400, "Request body must be JSON.", "bad_json") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return { ok: false, res: jsonError(400, "Some fields are missing or invalid.", "invalid_input", fields) };
  }
  return { ok: true, data: parsed.data };
}

export function aiErrorResponse(err: unknown) {
  if (err instanceof AIError) return jsonError(err.status, err.message, err.code);
  console.error("Unexpected error", err instanceof Error ? err.message : err);
  return jsonError(500, "Something went wrong on the server. Please retry.", "internal");
}
