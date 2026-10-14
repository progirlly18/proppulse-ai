"use client";

import clsx from "clsx";
import { Loader2, type LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Tier } from "@/lib/scoring";
import type { FollowUpState } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: LucideIcon }
>(function Button({ variant = "secondary", size = "md", loading, icon: Icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors select-none",
        "disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-accent text-white shadow-card hover:bg-accent-strong",
        variant === "secondary" && "border border-line bg-surface text-ink shadow-card hover:border-line-strong hover:bg-white",
        variant === "ghost" && "text-ink-2 hover:bg-sunken",
        variant === "danger" && "text-danger hover:bg-danger-soft",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("rounded-xl border border-line bg-surface shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionLabel({ children, icon: Icon, right }: { children: ReactNode; icon?: LucideIcon; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {children}
      </h3>
      {right}
    </div>
  );
}

const TIER_STYLE: Record<Tier, string> = {
  hot: "bg-hot-soft text-hot",
  warm: "bg-warm-soft text-warm",
  cold: "bg-cold-soft text-cold",
};
const TIER_DOT: Record<Tier, string> = { hot: "bg-hot", warm: "bg-warm", cold: "bg-cold" };
export const TIER_LABEL: Record<Tier, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", TIER_STYLE[tier], className)}>
      <span className={clsx("size-1.5 rounded-full", TIER_DOT[tier])} aria-hidden />
      {TIER_LABEL[tier]}
    </span>
  );
}

export function ScoreDial({ score, tier, size = 56 }: { score: number; tier: Tier; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const stroke = tier === "hot" ? "var(--color-hot)" : tier === "warm" ? "var(--color-warm)" : "var(--color-cold)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Priority score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunken)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-lg font-semibold tabular-nums">{score}</span>
    </div>
  );
}

/** Marks where a piece of information came from. Core to "AI vs customer fact". */
export function SourceTag({ source }: { source: "stated" | "inferred" | "entered" | "ai" | "user" }) {
  const map = {
    stated: { label: "Customer said", cls: "border-accent/25 bg-accent-soft text-accent-strong" },
    entered: { label: "From form", cls: "border-accent/25 bg-accent-soft text-accent-strong" },
    inferred: { label: "AI inferred", cls: "border-dashed border-line-strong bg-transparent text-muted" },
    ai: { label: "Suggested by AI", cls: "border-dashed border-line-strong bg-transparent text-muted" },
    user: { label: "Added by you", cls: "border-line bg-sunken text-ink-2" },
  }[source];
  return (
    <span className={clsx("inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[10.5px] font-medium", map.cls)}>
      {map.label}
    </span>
  );
}

const STATE_STYLE: Record<FollowUpState, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-danger-soft text-danger" },
  due_today: { label: "Due today", cls: "bg-warm-soft text-warm" },
  upcoming: { label: "Upcoming", cls: "bg-cold-soft text-cold" },
  done: { label: "Done", cls: "bg-accent-soft text-accent-strong" },
};

export function StateBadge({ state }: { state: FollowUpState }) {
  const s = STATE_STYLE[state];
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", s.cls)}>{s.label}</span>;
}

export function SampleBadge() {
  return (
    <span
      title="Fictional example lead for demonstration. Not a real customer."
      className="inline-flex items-center rounded-md border border-line bg-sunken px-1.5 py-px text-[10.5px] font-medium text-muted"
    >
      Sample
    </span>
  );
}

export function ErrorNote({ message, onRetry, retrying }: { message: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry} loading={retrying} className="shrink-0">
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-sunken text-muted">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="font-display text-lg text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
