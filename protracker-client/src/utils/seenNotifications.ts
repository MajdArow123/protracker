import { useSyncExternalStore } from 'react';

// Tracks which derived notifications the user has already seen/dismissed.
// Notifications are computed from existing data (not a DB table), so "seen" state
// lives in localStorage keyed by a stable-per-rule id. Date-based keys make some
// notifications reappear the next day (e.g. still-overdue tasks).

const STORAGE_KEY = 'protracker_seen_notifications';

type SeenMap = Record<string, boolean>;

function load(): SeenMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed?.seenNotifications ?? {};
  } catch {
    return {};
  }
}

let seen: SeenMap = load();
let version = 0;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenNotifications: seen }));
  } catch { /* ignore quota/serialization errors */ }
}

function emit() {
  version++;
  listeners.forEach(l => l());
}

export function markSeen(keys: string[]) {
  let changed = false;
  for (const k of keys) {
    if (!seen[k]) { seen[k] = true; changed = true; }
  }
  if (changed) { persist(); emit(); }
}

export function isSeen(key: string): boolean {
  return !!seen[key];
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// Re-render subscribers whenever the seen set changes.
export function useSeenVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

// ── Stable key builders (per the persistence rules) ─────────────────────────
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (local-ish, sufficient for daily reset)
}

// Overdue tasks reappear each day they remain overdue → include the date.
export const overdueTaskKey = (id: number) => `overdue_${id}_${todayStr()}`;
// Athlete's own tasks: once seen, gone for that task (unless it changes completion) → stable.
export const myTaskKey = (id: number) => `task_${id}`;
// Injury reappears if a new injury (new id) or it worsens (severity changes).
export const injuryKey = (id: number, severity: string) => `injury_${id}_${severity}`;
// Upcoming session reappears each day it's within the window → include the date.
export const sessionKey = (id: number) => `session_${id}_${todayStr()}`;
