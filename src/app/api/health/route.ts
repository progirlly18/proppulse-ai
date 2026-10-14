import { connection } from "next/server";
import { MODEL, isConfigured } from "@/lib/server/gemini";

/** GET /api/health: lets the UI say honestly whether real AI is available. */
export async function GET() {
  await connection();
  return Response.json({ aiConfigured: isConfigured(), model: MODEL, provider: "Google Gemini" });
}
