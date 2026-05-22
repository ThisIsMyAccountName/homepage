/**
 * Free-play completion log + "seen" set for the standalone Cryptic
 * game. Daily completions are tracked separately by `lib/dailyProgress`.
 */

const COMPLETED_KEY = "cryptic-completed-v1";
const SEEN_KEY = "cryptic-seen-v1";
const MAX_COMPLETED = 100;
const MAX_SEEN = 200;

export interface CompletedCryptic {
  id: string;
  /** Answer key with spaces/hyphens, for display. */
  answer: string;
  /** Original pattern string, for display. */
  pattern: string;
  time: number; // seconds
  errors: number;
  /** ISO string. */
  date: string;
}

function safeReadArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeWriteArray<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function getCompletedCryptics(): CompletedCryptic[] {
  return safeReadArray<CompletedCryptic>(COMPLETED_KEY);
}

export function logCryptic(entry: CompletedCryptic): void {
  const list = getCompletedCryptics();
  list.unshift(entry);
  if (list.length > MAX_COMPLETED) list.length = MAX_COMPLETED;
  safeWriteArray(COMPLETED_KEY, list);
}

export function clearCompletedCryptics(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(COMPLETED_KEY);
}

export function getSeenIds(): string[] {
  return safeReadArray<string>(SEEN_KEY);
}

export function recordSeen(id: string): string[] {
  const current = getSeenIds();
  if (current.includes(id)) return current;
  const next = [...current, id];
  if (next.length > MAX_SEEN) next.splice(0, next.length - MAX_SEEN);
  safeWriteArray(SEEN_KEY, next);
  return next;
}

export function clearSeenIds(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SEEN_KEY);
}
