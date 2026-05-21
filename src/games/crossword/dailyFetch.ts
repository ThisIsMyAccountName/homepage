"use client";

/**
 * Client-side fetcher for today's daily crossword.
 *
 * Hits `/api/crossword/daily` once per day, then caches the response in
 * `sessionStorage` keyed by the date so a refresh of the daily page (or
 * a hop to the solution view and back) reuses the same JSON without a
 * round-trip. The cache also keeps the puzzle stable across the brief
 * unmount/remount that React's strict-mode dev runs do.
 */

import type { StoredPuzzle } from "./storedPuzzle";

interface DailyResponse {
  puzzle: StoredPuzzle;
  fromApproved: boolean;
}

const CACHE_PREFIX = "crossword-daily-puzzle-";

function cacheKey(todayKey: string): string {
  return `${CACHE_PREFIX}${todayKey}`;
}

function readCache(todayKey: string): DailyResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(todayKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyResponse;
    if (!parsed?.puzzle?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(todayKey: string, data: DailyResponse): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cacheKey(todayKey), JSON.stringify(data));
  } catch {
    // quota / private mode — silently drop; refetch on next mount is fine.
  }
}

/**
 * Fetch today's puzzle, preferring the sessionStorage cache. Throws on
 * a non-OK response so the caller can surface a friendly error state.
 */
export async function fetchDailyCrossword(
  todayKey: string,
  signal?: AbortSignal
): Promise<DailyResponse> {
  const cached = readCache(todayKey);
  if (cached) return cached;

  const res = await fetch("/api/crossword/daily", {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const j = (await res.json()) as { error?: string };
      detail = j?.error;
    } catch {
      // ignore — fall through to generic message
    }
    throw new Error(detail ?? `Failed to load crossword (${res.status})`);
  }
  const data = (await res.json()) as DailyResponse;
  writeCache(todayKey, data);
  return data;
}
