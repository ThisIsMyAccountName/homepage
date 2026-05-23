/**
 * `GET /api/cryptic/random?exclude=key1,key2,...`
 *
 * Returns one random cryptic clue. The optional `exclude` query param
 * is a comma-separated list of answer keys the caller has already seen
 * — used by the free-play mode to avoid repeats within a session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRandomEntry } from "@/games/cryptic/serverPool";
import type { CrypticResponse } from "@/games/cryptic/types";

export const runtime = "nodejs";

const MAX_EXCLUDE = 300;

function parseExclude(raw: string | null): Set<string> {
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const piece of raw.split(",")) {
    const key = decodeURIComponent(piece).trim();
    if (key) out.add(key);
    if (out.size >= MAX_EXCLUDE) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const exclude = parseExclude(request.nextUrl.searchParams.get("exclude"));
  const entry = await getRandomEntry(exclude);

  if (!entry) {
    return NextResponse.json(
      { error: "No cryptic clues available. Drop cryptic-clues.json in src/games/cryptic/data." },
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

  return NextResponse.json(response);
}
