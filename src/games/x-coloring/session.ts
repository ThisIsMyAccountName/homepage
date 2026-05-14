/**
 * In-progress X Coloring sessions, persisted to localStorage so progress
 * survives reloads. Daily and freeplay are tracked separately.
 */

import type { DifficultyKey } from "./difficulty";

const REGULAR_KEY = "xcoloring-session";
const DAILY_KEY_PREFIX = "xcoloring-daily-session-";

export interface RegularSession {
  difficulty: DifficultyKey;
  seed: number;
  /** length = nodeCount, -1 means uncolored. */
  coloring: number[];
  timer: number;
}

export interface DailySession {
  coloring: number[];
  timer: number;
  errorCount: number;
}

export function saveRegularSession(data: RegularSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REGULAR_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadRegularSession(): RegularSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REGULAR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RegularSession;
    if (!data || !Array.isArray(data.coloring)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearRegularSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REGULAR_KEY);
}

function dailyKey(todayKey: string): string {
  return `${DAILY_KEY_PREFIX}${todayKey}`;
}

export function saveDailySession(
  todayKey: string,
  data: DailySession
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(dailyKey(todayKey), JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadDailySession(todayKey: string): DailySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(dailyKey(todayKey));
    if (!raw) return null;
    const data = JSON.parse(raw) as DailySession;
    if (!data || !Array.isArray(data.coloring)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearDailySession(todayKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(dailyKey(todayKey));
}
