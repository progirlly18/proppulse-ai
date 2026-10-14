import { z } from "zod";
import { FOLLOWUP_SYSTEM, followUpUserPrompt } from "@/lib/prompts";
import {
  AnalysisSchema,
  CHANNELS,
  FollowUpDraftJsonSchema,
  FollowUpDraftSchema,
  LeadInputSchema,
  TONES,
} from "@/lib/schemas";
import { computePriority } from "@/lib/scoring";
import { MODEL, generateJson } from "@/lib/server/gemini";
import { aiErrorResponse, parseBody } from "@/lib/server/http";

const Body = z.object({
  lead: LeadInputSchema,
  analysis: AnalysisSchema.optional(),
  channel: z.enum(CHANNELS),
  tone: z.enum(TONES),
  goal: z.string().trim().min(3).max(300),
  previousOutcome: z.string().trim().max(500).optional(),
});

/** POST /api/followup: drafts a personalised follow-up for one task. */
export async function POST(req: Request) {
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const { analysis, ...rest } = body.data;

  try {
    const draft = await generateJson({
      system: FOLLOWUP_SYSTEM,
      prompt: followUpUserPrompt({
        ...rest,
        analysis: analysis ? { data: analysis, priority: computePriority(analysis) } : undefined,
      }),
      jsonSchema: FollowUpDraftJsonSchema,
      validator: FollowUpDraftSchema,
      maxOutputTokens: 2048,
      temperature: 0.6,
    });
    return Response.json({ draft, model: MODEL, generatedAt: Date.now() });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
