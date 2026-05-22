/**
 * `GET /api/cryptic/daily?date=YYYY-MM-DD`
 *
 * Returns one deterministic cryptic clue keyed off the date. Defaults
 * to today (server time) when no `date` param is provided. Falls back
 * to the bundled pool if the user-supplied dataset is absent.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDailySeed, getTodayKey } from "@/lib/daily";
import { getDailyEntry } from "@/games/cryptic/serverPool";
import type { CrypticResponse } from "@/games/cryptic/types";

export const runtime = "nodejs";

function parseDateParam(raw: string | null): Date {
  if (!raw) return new Date();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (!m) return new Date();
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const d = new Date(year, month, day);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const date = parseDateParam(dateParam);
  const seed = getDailySeed(date);
  const entry = await getDailyEntry(seed);

  if (!entry) {
    return NextResponse.json(
      { error: "No cryptic clues available. Drop cryptic-clues.json in /data." },
      { status: 503 }
    );
  }

  const response: CrypticResponse = {
    id: entry.key,
    clue: entry.clue,
    pattern: entry.pattern,
    wordplay: entry.wordplay,
    answer: entry.key,
  };

  return NextResponse.json({ date: getTodayKey(date), ...response });
}
