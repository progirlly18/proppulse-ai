import { z } from "zod";
import { ANALYSIS_SYSTEM, analysisUserPrompt } from "@/lib/prompts";
import { AnalysisJsonSchema, AnalysisSchema, LeadInputSchema } from "@/lib/schemas";
import { computePriority } from "@/lib/scoring";
import { MODEL, generateJson } from "@/lib/server/gemini";
import { aiErrorResponse, parseBody } from "@/lib/server/http";

const Body = z.object({ lead: LeadInputSchema });

/** POST /api/analyze: one Gemini call (plus at most one repair call) per lead. */
export async function POST(req: Request) {
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;

  try {
    const analysis = await generateJson({
      system: ANALYSIS_SYSTEM,
      prompt: analysisUserPrompt(body.data.lead),
      jsonSchema: AnalysisJsonSchema,
      validator: AnalysisSchema,
      maxOutputTokens: 4096,
      temperature: 0.2,
    });
    return Response.json({
      analysis,
      priority: computePriority(analysis),
      model: MODEL,
      analyzedAt: Date.now(),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
