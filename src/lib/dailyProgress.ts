"use client";

/**
 * Tracks today's completion state for each of the three daily puzzles
 * (sudoku, nonogram, x-coloring) in localStorage so the homepage can show a
 * stepper and the all-done recap across reloads.
 *
 * Schema: `daily-progress-v1-${YYYY-MM-DD}` → `{ [game]: CompletionRecord }`.
 * Older `daily-completed-…` / `daily-nonogram-completed-…` / `daily-x-coloring-completed-…`
 * `=1` flags from the previous design are read lazily so anyone who solved
 * a puzzle on the old build keeps their day's progress.
 */

import { getTodayKey } from "@/lib/daily";

export type DailyGameId =
  | "sudoku"
  | "nonogram"
  | "x-coloring"
  | "crossword"
  | "cryptic";

export const DAILY_GAMES: readonly DailyGameId[] = [
  "sudoku",
  "nonogram",
  "x-coloring",
  "crossword",
  "cryptic",
] as const;

export interface CompletionRecord {
  /** Solve time in seconds. */
  time: number;
  /** Mistakes the user made before solving. */
  errors: number;
  /** ms epoch when the puzzle was marked solved. */
  completedAt: number;
}

export type DailyProgress = Partial<Record<DailyGameId, CompletionRecord>>;

const STORAGE_PREFIX = "daily-progress-v1-";

const LEGACY_FLAG_KEY: Record<DailyGameId, (key: string) => string> = {
  sudoku: (k) => `daily-completed-${k}`,
  nonogram: (k) => `daily-nonogram-completed-${k}`,
  "x-coloring": (k) => `daily-x-coloring-completed-${k}`,
  // Crossword is post-legacy; no v0 flag to migrate. A key that can't match
  // any stored value keeps the type complete without ever firing a merge.
  crossword: () => "__no-legacy-key__",
  cryptic: () => "__no-legacy-key__",
};

function storageKey(dateKey: string): string {
  return `${STORAGE_PREFIX}${dateKey}`;
}

function safeParse(raw: string | null): DailyProgress {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: DailyProgress = {};
    for (const game of DAILY_GAMES) {
      const rec = (parsed as Record<string, unknown>)[game];
      if (
        rec &&
        typeof rec === "object" &&
        typeof (rec as CompletionRecord).time === "number"
      ) {
        out[game] = {
          time: (rec as CompletionRecord).time,
          errors:
            typeof (rec as CompletionRecord).errors === "number"
              ? (rec as CompletionRecord).errors
              : 0,
          completedAt:
            typeof (rec as CompletionRecord).completedAt === "number"
              ? (rec as CompletionRecord).completedAt
              : 0,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Merge any leftover "=1" flags from the previous design into the v1 record
 * so the stepper marks them as done. We don't know the time/errors any more,
 * so they're treated as completed with zeroes (recap is best-effort there).
 */
function mergeLegacyFlags(dateKey: string, progress: DailyProgress): DailyProgress {
  if (typeof window === "undefined") return progress;
  let next = progress;
  for (const game of DAILY_GAMES) {
    if (next[game]) continue;
    const flag = window.localStorage.getItem(LEGACY_FLAG_KEY[game](dateKey));
    if (flag === "1") {
      next = {
        ...next,
        [game]: { time: 0, errors: 0, completedAt: 0 },
      };
    }
  }
  return next;
}

export function readDailyProgress(dateKey: string = getTodayKey()): DailyProgress {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(storageKey(dateKey));
  return mergeLegacyFlags(dateKey, safeParse(raw));
}

export function writeDailyProgress(
  dateKey: string,
  progress: DailyProgress
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(dateKey), JSON.stringify(progress));
  } catch {
    // quota / private-mode — silently drop
  }
}

export function recordCompletion(
  game: DailyGameId,
  time: number,
  errors: number,
  dateKey: string = getTodayKey()
): DailyProgress {
  const current = readDailyProgress(dateKey);
  // Don't clobber a faster solve if the user replays in the same day.
  const existing = current[game];
  if (existing && existing.time > 0 && existing.time <= time) {
    return current;
  }
  const next: DailyProgress = {
    ...current,
    [game]: { time, errors, completedAt: Date.now() },
  };
  writeDailyProgress(dateKey, next);
  return next;
}

/** Which game should the stepper open by default? First incomplete one, or null when all done. */
export function nextIncompleteGame(
  progress: DailyProgress
): DailyGameId | null {
  for (const game of DAILY_GAMES) {
    if (!progress[game]) return game;
  }
  return null;
}

export function allComplete(progress: DailyProgress): boolean {
  return DAILY_GAMES.every((g) => !!progress[g]);
}

export const GAME_LABELS: Record<DailyGameId, string> = {
  sudoku: "Sudoku",
  nonogram: "Nonogram",
  "x-coloring": "X Coloring",
  crossword: "Crossword",
  cryptic: "Cryptic",
};

export const GAME_SUBTITLES: Record<DailyGameId, string> = {
  sudoku: "6×6 grid",
  nonogram: "7×7 picross",
  "x-coloring": "graph paint",
  crossword: "mini puzzle",
  cryptic: "one clue",
};
