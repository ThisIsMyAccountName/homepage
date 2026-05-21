/**
 * Shared helpers for `/api/*` route handlers — extracted from the
 * crossword vote routes (`upvote/route.ts`, `downvote/route.ts`) where
 * the same rate-limit / IP-hash / JSON-file pattern was copy-pasted.
 *
 * Keep this file dependency-light: no per-feature imports, no Next/React
 * imports beyond `NextRequest`. Anything in here should be safe to drop
 * into any new route handler.
 */

import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";

/**
 * Best-effort client IP extraction. Mirrors what the leaderboard and
 * vote routes did inline: prefer the first hop in `x-forwarded-for`,
 * fall back to `x-real-ip`, fall back to `"unknown"`. The result is
 * intentionally never returned to clients — it only feeds `hashIp` and
 * the in-memory rate limiter.
 */
export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Non-reversible IP fingerprint (FNV-1a, 32-bit, padded hex). Two
 * requests from the same source produce the same hash; we can dedupe
 * votes without ever storing the raw IP. This matches the
 * traffic-tracker hash so analytic dedup and vote dedup speak the same
 * dialect.
 */
export function hashIp(ip: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Per-IP sliding-window rate limiter. Returns an object with
 * `check(ip)` (true ⇒ already over quota) and `record(ip)` (call after
 * `check` lets the request through).
 *
 * In-memory only, per Node process — same trade-off the leaderboard
 * route has always accepted. Multi-server deploys would need Redis or
 * a persisted store; until then, an attacker that load-balances across
 * processes can multiply the limit by the worker count, which is fine
 * for a personal site.
 */
export function makeRateLimiter(windowMs: number, max: number) {
  const buckets = new Map<string, number[]>();
  return {
    check(ip: string): boolean {
      const now = Date.now();
      const recent = (buckets.get(ip) ?? []).filter(
        (t) => now - t < windowMs
      );
      buckets.set(ip, recent);
      return recent.length >= max;
    },
    record(ip: string): void {
      const ts = buckets.get(ip) ?? [];
      ts.push(Date.now());
      buckets.set(ip, ts);
    },
  };
}

/**
 * Read a JSON file, returning `fallback` on any failure (missing,
 * unreadable, malformed JSON, or wrong top-level shape). The
 * array-vs-object check matches what every hand-rolled reader used to
 * do inline — a file that started as `[]` but somehow contains `{}` (or
 * vice versa) shouldn't poison a typed caller.
 */
export async function readJsonFile<T>(
  file: string,
  fallback: T
): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) !== Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Write JSON atomically: serialize → write to a unique tmp file in the
 * same directory → `fs.rename` into place. The rename is atomic on POSIX,
 * so concurrent vote requests can't tear a file mid-write (the previous
 * non-atomic implementation had a small race where two near-simultaneous
 * upvotes both read the file, both incremented, and the later write
 * clobbered the earlier). `fs.mkdir … recursive: true` keeps callers from
 * needing their own `ensureDataDir` helper.
 */
export async function writeJsonFile(
  file: string,
  data: unknown
): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2)}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}
