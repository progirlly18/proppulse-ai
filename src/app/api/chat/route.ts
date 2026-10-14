import { z } from "zod";
import { chatSystemPrompt } from "@/lib/prompts";
import { AnalysisSchema, ChatMessageSchema, LeadInputSchema } from "@/lib/schemas";
import { computePriority } from "@/lib/scoring";
import { MODEL, generateText } from "@/lib/server/gemini";
import { aiErrorResponse, parseBody } from "@/lib/server/http";

const MAX_TURNS = 12;

const Body = z.object({
  lead: LeadInputSchema,
  analysis: AnalysisSchema.optional(),
  messages: z
    .array(ChatMessageSchema)
    .min(1)
    .refine((m) => m[m.length - 1]?.role === "user", "The last message must be from the user"),
});

/**
 * POST /api/chat: the selected lead's form data and analysis are rebuilt into
 * the system prompt on every call, so the model only ever sees one lead.
 */
export async function POST(req: Request) {
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const { lead, analysis, messages } = body.data;

  const recent = messages.slice(-MAX_TURNS);
  const transcript = recent
    .map((m) => `${m.role === "user" ? "Salesperson" : "PropPulse"}: ${m.content}`)
    .join("\n\n");

  try {
    const reply = await generateText({
      system: chatSystemPrompt(lead, analysis ? { data: analysis, priority: computePriority(analysis) } : undefined),
      prompt: `Conversation so far:\n\n${transcript}\n\nPropPulse:`,
      maxOutputTokens: 2048,
      temperature: 0.5,
    });
    return Response.json({ reply, model: MODEL });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
