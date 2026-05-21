/**
 * `GET /api/crossword/daily`
 *
 * Picks today's crossword from the on-disk pool. Server-stored puzzles
 * have replaced the client-side seeded generator that used to run on
 * every daily-step open — generation was multi-second on harder shapes
 * and occasionally hit the fallback path, which was the root cause of
 * the "very long load" report. This route is O(read) instead.
 *
 * Pool sources (preference order):
 *   1. `data/crossword-approved.json` — community-upvoted puzzles. Used
 *      first when non-empty so the rotation surfaces what players liked.
 *   2. `src/games/crossword/data/crossword-pool.json` — the static pool
 *      built offline by `scripts/build-crossword-pool.mjs`. Always
 *      present in the bundle; used as the fallback.
 *
 * Today's puzzle is `pool[ getDailySeed() % pool.length ]`, so the pick
 * is deterministic for everyone visiting on the same date and stable
 * across cold starts — important for the "stuck the next day" bug,
 * which was rooted in the client generating subtly different puzzles
 * across reloads.
 */

import { NextResponse } from "next/server";
import path from "path";
import { getDailySeed } from "@/lib/daily";
import bundledPool from "@/games/crossword/data/crossword-pool.json";
import {
  publicView,
  type StoredPuzzle,
} from "@/games/crossword/storedPuzzle";
import { readJsonFile } from "@/lib/apiUtils";

const APPROVED_FILE = path.join(
  process.cwd(),
  "data",
  "crossword-approved.json"
);

export async function GET() {
  const approved = await readJsonFile<StoredPuzzle[]>(APPROVED_FILE, []);
  const pool: StoredPuzzle[] =
    approved.length > 0 ? approved : (bundledPool as StoredPuzzle[]);

  if (pool.length === 0) {
    return NextResponse.json(
      { error: "Crossword pool is empty. Run `node scripts/build-crossword-pool.mjs`." },
      { status: 503 }
    );
  }

  const seed = getDailySeed();
  const idx = seed % pool.length;
  const puzzle = pool[idx];

  return NextResponse.json({
    puzzle: publicView(puzzle),
    fromApproved: approved.length > 0,
  });
}
