// Verifies that the deployed PropPulse AI returns REAL Gemini output.
// Run (Node 18+):   node scripts/verify-live.mjs
// Optional: node scripts/verify-live.mjs https://your-url.vercel.app
//
// How it proves the output is real, not canned: every run invents a random
// "canary" word, puts it inside the customer message, and checks the model
// repeats it back. A hardcoded response cannot know a word made up seconds ago.
// It makes 4 Gemini calls in total (free tier is fine).

const BASE = (process.argv[2] ?? "https://proppulse-ai-three.vercel.app").replace(/\/$/, "");
const canary = `Zorbex-${Math.floor(1000 + Math.random() * 9000)}`;
let failures = 0;
const ok = (cond, label, detail = "") => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `\n      ${detail}` : ""}`);
};

async function post(path, body) {
  const t = Date.now();
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, ms: Date.now() - t };
}

const lead = {
  name: "Verification Test",
  location: "Koramangala, Bengaluru",
  propertyRequirement: "2 BHK near a park, east facing",
  budget: "₹1 Cr",
  timeline: "1_month",
  customerMessage: `Hi, I need to move before my lease ends next month. Our project code word is ${canary}. Can we visit this Sunday? I'm worried about parking for two cars.`,
};

console.log(`Testing ${BASE}  (canary word: ${canary})\n`);

const h = await (await fetch(`${BASE}/api/health`)).json();
ok(h.aiConfigured === true, "health: AI configured", JSON.stringify(h));

const bad = await post("/api/analyze", { lead: { ...lead, timeline: "someday" } });
ok(bad.status === 400, "invalid input rejected with 400 (no AI call)", `status ${bad.status}`);

const a = await post("/api/analyze", { lead });
ok(a.status === 200, `analyze: HTTP 200 in ${a.ms} ms`, a.status !== 200 ? JSON.stringify(a.json) : "");
if (a.status === 200) {
  const an = a.json.analysis;
  const fields = ["summary", "intent", "requirements", "objections", "nextAction", "suggestedReply", "scoring", "confidence"];
  ok(fields.every((f) => an[f] !== undefined), "analyze: all required fields present");
  ok(typeof a.json.model === "string" && a.json.model.length > 0, `analyze: model reported = ${a.json.model}`);
  ok(/park/i.test(JSON.stringify(an.objections) + JSON.stringify(an.requirements)), "analyze: picked up the parking concern from the message");
  console.log(`      score ${a.json.priority.score} (${a.json.priority.tier}) · intent ${an.intent.category}`);
  console.log(`      summary: ${an.summary}`);
  console.log(`      next action: ${an.nextAction.action} [${an.nextAction.channel}, ${an.nextAction.timing}]`);

  const c = await post("/api/chat", {
    lead,
    analysis: an,
    messages: [{ role: "user", content: "What exact code word did the customer mention? Reply with just the word." }],
  });
  ok(c.status === 200 && c.json.reply.includes(canary), `chat: answered from THIS lead's message (canary found) in ${c.ms} ms`, c.json?.reply ?? JSON.stringify(c.json));

  const f = await post("/api/followup", { lead, analysis: an, channel: "whatsapp", tone: "assertive", goal: an.nextAction.action });
  ok(f.status === 200 && f.json.draft.message.length > 20, `follow-up draft generated in ${f.ms} ms`, f.json?.draft?.message ?? JSON.stringify(f.json));
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed: the live app is returning real Gemini output.");
process.exit(failures ? 1 : 0);
