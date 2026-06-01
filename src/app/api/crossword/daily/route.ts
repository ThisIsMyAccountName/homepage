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
import { getDailySeed, getTodayKey } from "@/lib/daily";
import bundledPool from "@/games/crossword/data/crossword-pool.json";
import {
  publicView,
  type StoredPuzzle,
} from "@/games/crossword/storedPuzzle";
import { readJsonFile, writeJsonFile } from "@/lib/apiUtils";

const APPROVED_FILE = path.join(
  process.cwd(),
  "data",
  "crossword-approved.json"
);

// Append-only ledger of which puzzle was served on which date. Lets us pull
// a puzzle out of rotation right after its turn — it only returns once every
// other puzzle in the active pool has been the daily, so no repeats inside a
// full cycle. Non-destructive: nothing is deleted from the approved pool.
const HISTORY_FILE = path.join(
  process.cwd(),
  "data",
  "crossword-daily-history.json"
);

interface DailyHistoryEntry {
  date: string;
  id: string;
}

export async function GET() {
  const approved = await readJsonFile<StoredPuzzle[]>(APPROVED_FILE, []);
  const usingApproved = approved.length > 0;
  const pool: StoredPuzzle[] = usingApproved
    ? approved
    : (bundledPool as StoredPuzzle[]);

  if (pool.length === 0) {
    return NextResponse.json(
      { error: "Crossword pool is empty. Run `node scripts/build-crossword-pool.mjs`." },
      { status: 503 }
    );
  }

  const today = getTodayKey();
  const history = await readJsonFile<DailyHistoryEntry[]>(HISTORY_FILE, []);
  const byId = new Map(pool.map((p) => [p.id, p]));

  // Already assigned today and still in the pool → serve it, so the daily is
  // stable for everyone for the whole date and across cold starts.
  const todays = history.find((h) => h.date === today);
  if (todays && byId.has(todays.id)) {
    return NextResponse.json({
      puzzle: publicView(byId.get(todays.id)!),
      fromApproved: usingApproved,
    });
  }

  // Exclude the last (pool.length - 1) distinct ids that still exist in the
  // pool. Excluding length-1 means a puzzle can't recur until the whole pool
  // has cycled. Stale ids (a puzzle since removed from the pool) are skipped
  // via byId so the window self-heals when the pool changes.
  const recent = new Set<string>();
  for (let i = history.length - 1; i >= 0 && recent.size < pool.length - 1; i--) {
    const id = history[i].id;
    if (byId.has(id)) recent.add(id);
  }

  let eligible = pool.filter((p) => !recent.has(p.id));
  if (eligible.length === 0) eligible = pool; // safety — shouldn't happen

  // Deterministic pick among the eligible set so two first-of-day requests
  // racing each other still land on the same puzzle (and write the same id).
  eligible.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const puzzle = eligible[getDailySeed() % eligible.length];

  // Record today's assignment: one entry per date, trimmed so the ledger
  // can't grow without bound.
  const nextHistory = history.filter((h) => h.date !== today);
  nextHistory.push({ date: today, id: puzzle.id });
  await writeJsonFile(HISTORY_FILE, nextHistory.slice(-365));

  return NextResponse.json({
    puzzle: publicView(puzzle),
    fromApproved: usingApproved,
  });
}
