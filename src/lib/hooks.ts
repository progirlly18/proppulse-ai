"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/* A shared clock so overdue states update without a refresh. */
let now = 0;
const clockListeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      clockListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    clockListeners.delete(cb);
    if (!clockListeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getNow() {
  if (!now) now = Date.now();
  return now;
}

export function useNow(): number {
  return useSyncExternalStore(subscribeClock, getNow, () => 0);
}

/** Lets other code nudge the clock (e.g. right after marking something done). */
export function tickNow() {
  now = Date.now();
  clockListeners.forEach((l) => l());
}

export interface Health {
  aiConfigured: boolean;
  model: string;
  provider: string;
}

let healthPromise: Promise<Health> | null = null;
let healthValue: Health | "error" | null = null;

/** One /api/health request per page load, shared by every component. */
export function useHealth(): Health | null | "error" {
  const [health, setHealth] = useState<Health | null | "error">(healthValue);
  useEffect(() => {
    if (healthValue) return;
    let alive = true;
    healthPromise ??= fetch("/api/health").then((r) => (r.ok ? (r.json() as Promise<Health>) : Promise.reject()));
    healthPromise
      .then((h) => {
        healthValue = h;
        if (alive) setHealth(h);
      })
      .catch(() => {
        healthValue = "error";
        healthPromise = null;
        if (alive) setHealth("error");
      });
    return () => {
      alive = false;
    };
  }, []);
  return health;
}
