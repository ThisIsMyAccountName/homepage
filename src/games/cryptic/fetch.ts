"use client";

/**
 * Client-side fetchers for the Cryptic API. The daily call is cached
 * in `sessionStorage` keyed by date so refreshes / step toggles don't
 * re-hit the server; the random call is never cached.
 */

import type { CrypticResponse } from "./types";

const DAILY_CACHE_PREFIX = "cryptic-daily-";

function dailyCacheKey(todayKey: string): string {
  return `${DAILY_CACHE_PREFIX}${todayKey}`;
}

function readDailyCache(todayKey: string): CrypticResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(dailyCacheKey(todayKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrypticResponse;
    if (!parsed?.id || !parsed?.answer) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDailyCache(todayKey: string, data: CrypticResponse): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(dailyCacheKey(todayKey), JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function fetchDailyCryptic(
  todayKey: string,
  signal?: AbortSignal
): Promise<CrypticResponse> {
  const cached = readDailyCache(todayKey);
  if (cached) return cached;

  const res = await fetch(`/api/cryptic/daily?date=${encodeURIComponent(todayKey)}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const j = (await res.json()) as { error?: string };
      detail = j?.error;
    } catch {
      // ignore
    }
    throw new Error(detail ?? `Failed to load daily cryptic (${res.status})`);
  }
  const data = (await res.json()) as CrypticResponse;
  writeDailyCache(todayKey, data);
  return data;
}

export async function fetchRandomCryptic(
  excludeIds: readonly string[],
  signal?: AbortSignal
): Promise<CrypticResponse> {
  const params = new URLSearchParams();
  if (excludeIds.length > 0) params.set("exclude", excludeIds.join(","));
  const url = `/api/cryptic/random${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const j = (await res.json()) as { error?: string };
      detail = j?.error;
    } catch {
      // ignore
    }
    throw new Error(detail ?? `Failed to load cryptic (${res.status})`);
  }
  return (await res.json()) as CrypticResponse;
}

export async function rateCryptic(
  key: string,
  rating: "up" | "down"
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch("/api/cryptic/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, rating }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; count?: number; error?: string }
      | null;
    if (!res.ok) {
      return { ok: false, error: data?.error ?? `Rating failed (${res.status})` };
    }
    return { ok: true, count: data?.count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
