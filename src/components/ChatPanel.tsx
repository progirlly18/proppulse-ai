"use client";

import clsx from "clsx";
import { ArrowUp, Check, Copy, Eraser, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sendChat } from "@/lib/ai-client";
import { actions, type AppState } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { Button, Card, ErrorNote } from "./ui";

const SUGGESTIONS = [
  "What should I emphasize on the call?",
  "Make my reply more assertive",
  "How do I handle their main concern?",
  "What questions should I ask to qualify them?",
];

export function ChatPanel({
  lead,
  state,
  aiOk,
  prefill,
  onPrefillUsed,
}: {
  lead: Lead;
  state: AppState;
  aiOk: boolean;
  prefill: string | null;
  onPrefillUsed: () => void;
}) {
  const key = `chat:${lead.id}`;
  const busy = !!state.busy[key];
  const error = state.errors[key];
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A prefill from elsewhere (e.g. "Make it more assertive") is sent straight away.
  useEffect(() => {
    if (prefill && aiOk && !busy) {
      onPrefillUsed();
      void sendChat(lead.id, prefill);
    }
  }, [prefill, aiOk, busy, lead.id, onPrefillUsed]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [lead.chat.length, busy]);

  const submit = (value: string) => {
    if (!value.trim() || busy || !aiOk) return;
    setText("");
    void sendChat(lead.id, value);
    inputRef.current?.focus();
  };

  return (
    <Card className="flex h-[min(640px,calc(100dvh-220px))] min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-xs text-muted">
          Answers use only <span className="font-medium text-ink-2">{lead.input.name}</span>&apos;s details
          {lead.analysis ? " and analysis" : ""}.
        </p>
        {lead.chat.length > 0 && (
          <button
            onClick={() => actions.patchLead(lead.id, (l) => ({ ...l, chat: [] }))}
            disabled={busy}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink"
            aria-label="Clear conversation"
          >
            <Eraser className="size-3.5" /> Clear
          </button>
        )}
      </div>

      <div ref={listRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {lead.chat.length === 0 && (
          <div className="pt-4">
            <p className="mb-3 text-center text-sm text-muted">Ask anything about working this lead.</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  disabled={!aiOk || busy}
                  onClick={() => submit(s)}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink-2 transition-colors hover:border-accent/40 hover:bg-accent-soft/40 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {lead.chat.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="size-4 animate-pulse text-accent" /> Thinking about {lead.input.name.split(" ")[0]}…
          </div>
        )}
        {error && !busy && <ErrorNote message={error} onRetry={() => sendChat(lead.id, null)} />}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
          <label htmlFor={`chat-${lead.id}`} className="sr-only">
            Ask about this lead
          </label>
          <textarea
            id={`chat-${lead.id}`}
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(text);
              }
            }}
            rows={1}
            maxLength={2000}
            disabled={!aiOk}
            placeholder={aiOk ? `Ask about ${lead.input.name.split(" ")[0]}…` : "AI is not configured"}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-faint"
          />
          <Button type="submit" variant="primary" size="sm" className="size-8 px-0" disabled={!text.trim() || busy || !aiOk} aria-label="Send">
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10.5px] text-faint">AI answers can be wrong. Check facts with the customer before promising anything.</p>
      </form>
    </Card>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={clsx("group flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          role === "user" ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md border border-line bg-paper text-ink",
        )}
      >
        {content}
        {role === "assistant" && (
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {}
            }}
            className="absolute -right-2 -bottom-2 rounded-md border border-line bg-surface p-1 text-muted opacity-0 shadow-card transition-opacity group-hover:opacity-100 focus:opacity-100"
            aria-label="Copy answer"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
