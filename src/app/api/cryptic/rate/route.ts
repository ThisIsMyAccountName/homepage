/**
 * `POST /api/cryptic/rate`
 *
 * Body: `{ "key": "SEDATE", "rating": "up" | "down" }`
 *
 * `up`   → appends the answer key to `data/cryptic-good.json` (the
 *          curated pool of player-approved clues).
 * `down` → appends a `{ key, clue, pattern, wordplay, flaggedAt, count }`
 *          record to `data/cryptic-flagged.json` so the maintainer can
 *          review it on /cluereview. Repeat flags on the same key bump
 *          `count` rather than duplicating rows.
 *
 * Public endpoint, per-IP rate-limited. The server dedupes both files
 * so refreshing-then-clicking is idempotent.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  clientIp,
  makeRateLimiter,
  readJsonFile,
  writeJsonFile,
} from "@/lib/apiUtils";
import { getEntryByKey } from "@/games/cryptic/serverPool";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const GOOD_FILE = path.join(DATA_DIR, "cryptic-good.json");
const FLAGGED_FILE = path.join(DATA_DIR, "cryptic-flagged.json");

const limiter = makeRateLimiter(60_000, 20);

interface FlaggedEntry {
  key: string;
  clue: string;
  pattern: string;
  wordplay: string;
  firstFlaggedAt: number;
  lastFlaggedAt: number;
  count: number;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (limiter.check(ip)) {
    return NextResponse.json(
      { error: "Slow down. Try again in a minute." },
      { status: 429 }
    );
  }
  limiter.record(ip);

  let body: { key?: unknown; rating?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const rating = body.rating;
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }
  if (rating !== "up" && rating !== "down") {
    return NextResponse.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
  }

  const entry = await getEntryByKey(key);
  if (!entry) {
    return NextResponse.json({ error: "Unknown clue" }, { status: 404 });
  }

  if (rating === "up") {
    const list = await readJsonFile<string[]>(GOOD_FILE, []);
    if (!list.includes(entry.key)) {
      list.push(entry.key);
      await writeJsonFile(GOOD_FILE, list);
    }
    return NextResponse.json({ ok: true, count: list.length });
  }

  const flagged = await readJsonFile<FlaggedEntry[]>(FLAGGED_FILE, []);
  const now = Date.now();
  const existing = flagged.find((f) => f.key === entry.key);
  if (existing) {
    existing.count += 1;
    existing.lastFlaggedAt = now;
  } else {
    flagged.push({
      key: entry.key,
      clue: entry.clue,
      pattern: entry.pattern,
      wordplay: entry.wordplay,
      firstFlaggedAt: now,
      lastFlaggedAt: now,
      count: 1,
    });
  }
  await writeJsonFile(FLAGGED_FILE, flagged);
  return NextResponse.json({ ok: true, count: flagged.length });
}
