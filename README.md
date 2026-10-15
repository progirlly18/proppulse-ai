# PropPulse AI

**Lead intelligence for real-estate sales teams.** Paste in an inbound enquiry and PropPulse tells the salesperson, in a few seconds, what the customer actually wants, how much the lead matters right now, and exactly what to do next, then helps them do it and keeps track until it's done.

Built for the Masal AI Forward Deployed Engineer assignment (Round 2).

- **Live app:** https://proppulse-ai-three.vercel.app (no login, no setup)
- **Demo video:** _link to be added_

> Sample leads in the app are fictional and marked **Sample**. They ship without any analysis: every analysis you see was produced live by Gemini when someone clicked **Analyze**.

---

## The problem

A sales team gets hundreds of leads a day. Most CRMs show them as a flat list sorted by time. The salesperson has to open each one, read a messy message, guess how serious the person is, write a reply, and remember to follow up. Good leads go cold while bad ones get attention.

**Target user:** a residential real-estate salesperson working an inbound queue (portal enquiries, WhatsApp messages, website forms) between calls and site visits.

## What it does

| Workflow step | What the salesperson sees |
|---|---|
| **1. Add lead** | Intake form: name, location, property requirement, budget, buying timeline, free-text customer message (paste the enquiry or chat transcript). Validated on the client and again on the server. |
| **2. AI analysis** | One Gemini call returns a structured analysis: summary, intent, key requirements, objections/concerns, missing information, recommended next action (channel + timing), a ready-to-send reply, and a confidence level. Each requirement and concern is tagged **Customer said** or **AI inferred**. |
| **3. Priority** | A 0–100 score and a Hot / Warm / Cold tier, with a factor-by-factor breakdown and the evidence behind each factor. The lead queue is ranked by it. |
| **4. Ask follow-ups** | A chat grounded in that one lead ("What should I emphasize on the call?", "Make my reply more assertive"). Each lead keeps its own conversation. |
| **5. Follow-up Copilot** *(my feature)* | The AI's next action becomes a tracked follow-up with a due time. Draft a personalised message for it (channel + tone), mark it done with an outcome, and schedule the next touchpoint. Overdue items surface on the dashboard. |
| **6. Overview** | KPIs that drive action (hot leads, overdue and due-today follow-ups), a "work these first" list, and today's follow-ups. |

Also: search, tier/follow-up/source filters, four sort orders, edit and delete leads, "analysis out of date" detection after edits, keyboard shortcuts (`N` new lead, `/` search), responsive layout down to phone width.

## My feature: Follow-up Copilot

**Why this one.** The assignment asks what happens *before, during and after* this screen. Analysis tells you what to do; most lost deals are lost *after* that, when the follow-up slips. In real estate the follow-up cadence (call today, visit Saturday, check in after the family discusses) is the job.

**How it works end to end:**

1. When a lead is analyzed for the first time, the AI's recommended next action (e.g. *"Call to book a Saturday site visit", Call, Today*) becomes a pending follow-up, labelled **Suggested by AI**. The due time comes from the AI's timing bucket (`within_1_hour` → 1 h, `today` → 6 h, `within_2_days` → 48 h, …).
2. **Draft message** calls Gemini with the lead, its analysis, the follow-up goal, a channel (WhatsApp / email / call script / site visit / meeting) and a tone (warm / assertive / concise). The draft lists which of the customer's requirements and concerns it responds to, so the salesperson can see it's personal, not boilerplate. It never invents prices or availability; it uses placeholders like `[time slot]`.
3. **Mark done** asks "What happened?" (optional) and offers to schedule the next touchpoint (1 h / tomorrow / 3 days / next week). The outcome is stored and fed into the *next* draft, so the second message builds on the first conversation.
4. State is derived from time, never stored: a pending follow-up becomes **Due today** and then **Overdue** on its own. Overdue counts show in the sidebar, the dashboard headline and the Follow-ups page.
5. **AI vs fact** is explicit throughout: "Suggested by AI" vs "Added by you" on follow-ups, "Customer said" vs "AI inferred" on requirements and concerns, "From form" on the customer facts card, and "AI draft · review before sending" on every generated message.

## Architecture

```
Browser (Next.js client components)                 Server (Next.js route handlers on Vercel)
┌────────────────────────────────────┐              ┌──────────────────────────────────────────┐
│ Workspace UI                        │  POST JSON   │ /api/analyze   validate → prompt → Gemini │
│  Overview · Lead queue · Detail     │ ───────────▶ │                → Zod validate (1 repair)  │
│  Chat · Follow-up Copilot           │              │                → computePriority()        │
│                                     │ ◀─────────── │ /api/chat      lead + analysis in system  │
│ store.ts  (useSyncExternalStore)    │   JSON       │ /api/followup  structured draft           │
│  └─ localStorage "proppulse.v1"     │              │ /api/health    is a key configured?       │
└────────────────────────────────────┘              │      │                                    │
                                                     │      ▼ @google/genai (GEMINI_API_KEY)     │
                                                     └──────────────────────────────────────────┘
```

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4.** One deployable unit: UI and API on Vercel's free tier.
- **AI calls are server-only.** `src/lib/server/gemini.ts` imports `server-only`, so the key can't be bundled into the browser.
- **Persistence: browser `localStorage`.** Leads, analyses, chats and follow-ups survive refreshes and stay in sync across tabs, with zero database credentials. Limitation: per browser, not shared across devices or teammates (the app says so in the sidebar).
- **State:** a ~150-line store (`src/lib/store.ts`) on React's `useSyncExternalStore`. No Redux, no context tree.

### AI model and how it's called

- **Provider:** Google Gemini via the official `@google/genai` SDK (free tier).
- **Model:** `gemini-flash-latest` by default, overridable with `GEMINI_MODEL`. Flash is fast and cheap enough for a queue of hundreds of leads.
- **Analysis** (`POST /api/analyze`): `generateContent` with a system instruction, `responseMimeType: "application/json"` and a JSON schema (`responseJsonSchema`), temperature 0.2. The response is parsed and validated with Zod. If it doesn't validate, the model is asked **once** to repair it with the exact validation errors; if it still fails the user gets an error with **Retry**. There is no canned fallback anywhere.
- **Chat** (`POST /api/chat`): every call rebuilds the system prompt from the selected lead's form data and analysis, plus the last 12 turns. The model never sees another lead.
- **Follow-up drafts** (`POST /api/followup`): structured JSON (`subject`, `message`, `addresses[]`), temperature 0.6.
- **Reliability:** 45 s timeout, SDK retry capped at 2 attempts, provider 429 → "rate limit, wait a minute", blocked/empty/truncated output → clear message, plus a best-effort per-IP limit (20 req/min) to protect the free quota. Analyses are cached per lead with a hash of the input and only re-run when the lead changes or the user asks.
- **Prompt safety:** the customer message is untrusted public text, so it is fenced in `<customer_message>` tags and the model is told to treat it as data. The prompt forbids inventing listings or prices and forbids claims about affordability, loan eligibility, identity or conversion probability.

### Lead scoring

The model does **not** output the score. It rates five factors 0–5 against a written rubric and quotes the evidence; the app turns ratings into a score with fixed weights (`src/lib/scoring.ts`):

| Factor | Weight | 5 means… |
|---|---|---|
| Timeline urgency | 30 | Must buy/move within weeks, with a concrete reason |
| Explicit intent | 25 | Asks to visit, book or negotiate |
| Requirement clarity | 20 | Location, configuration and must-haves are specific |
| Engagement | 15 | Detailed message, specific questions, shares availability |
| Blocking concerns | 10 (inverted) | 5 = serious blockers (must sell first, family not aligned) |

Score ≥ 70 is **Hot**, 45–69 **Warm**, below 45 **Cold**. Low-confidence analyses are flagged "qualify before trusting the score".

Why this design: LLMs are good at reading a messy message and judging "how urgent does this sound, and why"; they're inconsistent at producing a calibrated number. Splitting the two makes the score **explainable** (every point traces to a factor and a quote), **consistent** (same ratings, same score) and **tunable** (a sales manager can change weights without touching prompts). **Budget size is deliberately not a factor**: a ₹3 Cr budget with "just browsing" is a colder lead than a ₹70 L budget with "need to move by December".

## Run locally

Requires Node 20+.

```bash
git clone <this repo>
cd proppulse-ai
npm install
cp .env.example .env.local        # then put your Gemini key in it
npm run dev                       # http://localhost:3000
```

Get a free key at <https://aistudio.google.com/apikey>. Without a key the app still runs, shows a banner saying AI is not configured, and disables AI buttons. It never shows fake output.

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Server-side Gemini key. Never exposed to the browser. |
| `GEMINI_MODEL` | no | Gemini model id. Default `gemini-flash-latest`. |

## Tests

```bash
npm test            # Vitest: 37 tests
npm run lint
npm run typecheck
npm run build
```

- `tests/scoring.test.ts`: weights, bounds, determinism, friction penalty, explanations, tiers.
- `tests/schemas.test.ts`: lead-input and AI-output validation.
- `tests/queue.test.ts`: ranking, filters, search, follow-up states.
- `tests/prompts.test.ts`: untrusted-message fencing, grounding, outcome carried into drafts.
- `tests/api.test.ts`: the real route handlers with the Gemini SDK mocked: input rejection, server-side scoring, the repair-once loop, failing loudly on invalid output, 429 mapping, missing key, rate limiting, and that chat receives only the selected lead.

A browser walkthrough (Playwright, 32 checks) covered the UI flows: analyze-all, error + retry, every analysis section, stated/inferred tags, draft + complete + reschedule, per-lead chat isolation, form validation, persistence across refresh, overdue detection, mobile layout. It ran with the AI endpoints intercepted, so it proves the UI wiring, not the model.

### Verifying real Gemini output on a deployment

```bash
node scripts/verify-live.mjs https://proppulse-ai-three.vercel.app
```

The script (Node 18+, no dependencies) makes four real model calls. It invents a random code word, puts it in a lead's customer message, and checks that the chat answer repeats it back. A canned or hardcoded response can't know a word made up seconds earlier, so a pass means the deployed app is calling Gemini with that lead's context. It also checks input validation, that every analysis field is present, and that a follow-up draft is generated.

**Result on the live deployment (15 Oct 2026, run from a Windows machine): all checks passed.** Health reported `aiConfigured: true` with `gemini-flash-latest`; invalid input was rejected with HTTP 400 before any AI call; analysis returned HTTP 200 with every required field and correctly extracted the lead's parking concern; the chat reproduced that run's canary word (`Zorbex-4237`); and the Follow-up Copilot generated a personalised message.

## Deploy (Vercel, free tier)

1. Import the GitHub repo at <https://vercel.com/new> (framework preset: Next.js, no build settings to change).
2. Add the environment variable `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`).
3. Deploy. Open `/api/health` on the deployed URL: it should report `"aiConfigured": true`.

## Key decisions and trade-offs

- **Score computed in code, not by the model.** See above. The interview-worthy one.
- **localStorage over a database.** Zero setup for evaluators and no credentials to leak, at the cost of no cross-device sync. The store is the only file that knows about storage, so swapping in Postgres (e.g. Neon/Supabase free tier) means replacing `load`/`persist` with API calls.
- **One structured call per analysis** instead of six separate prompts: cheaper, faster, and the fields are consistent with each other.
- **The AI suggests, the human confirms.** AI next actions land as "Suggested by AI" follow-ups; drafts are labelled "review before sending"; nothing is ever sent automatically.
- **`gemini-flash-latest` alias** keeps the deployed app working when Google retires a pinned model version; the trade-off is that behaviour can shift when the alias moves. Pin `GEMINI_MODEL` for production.
- **No auth.** A single-user demo; adding auth only makes sense alongside a real database.

## Known limitations

- Data is per browser; clearing site data deletes it. No multi-user or team view.
- The per-IP rate limiter is in-memory, so it's per serverless instance (best-effort quota protection, not security).
- Free-tier Gemini quotas are low; "Analyze all" runs two at a time and a burst can still hit 429 (shown with Retry).
- No real calendar, WhatsApp or email integration: drafts are copied, not sent.
- Scoring weights are my judgement, not learned from conversion data.

## What I'd build next

1. Shared database + auth so a team sees one queue, with assignment and SLA timers.
2. Ingest leads directly from portals / WhatsApp Business webhooks instead of manual entry.
3. Calibrate scoring weights against actual conversions.
4. Send drafts through WhatsApp/email from the app and log replies back into the lead.
5. Streaming chat responses.

## Project structure

```
src/
  app/
    page.tsx                 renders <Workspace/>
    api/analyze/route.ts     structured lead analysis
    api/chat/route.ts        lead-grounded chat
    api/followup/route.ts    follow-up message drafts
    api/health/route.ts      reports whether AI is configured
  lib/
    schemas.ts               Zod schemas + Gemini JSON schema (single source of truth)
    scoring.ts               factor weights, score, tiers, explanations
    prompts.ts               every prompt the model sees
    server/gemini.ts         SDK wrapper: JSON mode, validation, repair, error mapping
    server/http.ts           body parsing, size limit, rate limit
    store.ts                 localStorage store + actions
    ai-client.ts             browser calls to the API, busy/error state
    queue.ts, followups.ts   ranking, filtering, follow-up states
    samples.ts               fictional sample leads
  components/                Workspace shell, views, panels, UI primitives
tests/                       Vitest suites
```

## AI usage disclosure

- **Claude (Anthropic), via Claude Code**: used as an autonomous pair-programmer for the whole build. It read the assignment brief, proposed the architecture, and wrote the code (UI, API routes, prompts, scoring, tests), ran lint/type-check/tests/builds and a Playwright browser walkthrough, fixed the issues those found, and drafted this README and the demo script. It also wrote `scripts/verify-live.mjs` and pushed the code to GitHub.
- **ChatGPT (OpenAI)**: Used for development guidance, clarifying technical concepts, troubleshooting.
- **What I did myself:** set the product requirements and scope (including the Follow-up Copilot and the design direction), created the GitHub repository, deployed to Vercel with my Gemini key, tested the deployed application, ran the live verification script, and reviewed the project documentation and key implementation decisions in preparation for the technical interview.
- **Google Gemini** (`gemini-flash-latest`): the runtime model inside the product (lead analysis, chat, follow-up drafts). It was not used to write code.
- No other AI tools were used.
