/**
 * `POST /api/crossword/downvote`
 *
 * "I didn't like this one" — appends today's puzzle's answer + clue
 * pairs to `data/crossword-flagged.json` so the maintainer can review
 * which clues are misleading / wrong / dated and prune them from the
 * bank later.
 *
 * The flagged file is *append-only* per puzzle and dedupes voters by
 * hashed-IP (same approach as the upvote route). Each record holds the
 * full entry list of the flagged puzzle so the review file reads as a
 * self-contained worksheet — no cross-reference back to the pool
 * required to make a verdict on whether a clue is acceptable.
 *
 * Unlike the upvote, a downvote does *not* move the puzzle into the
 * approved pool — it's a moderation signal, not a recommendation.
 *
 * Body: `{ "puzzleId": "<16-hex-id>", "puzzle"?: <inline puzzle> }`
 * Response: `{ ok: true, flags: N }` on success.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import bundledPool from "@/games/crossword/data/crossword-pool.json";
import { verifyInlinePuzzle } from "@/games/crossword/serverValidation";
import type { StoredPuzzle } from "@/games/crossword/storedPuzzle";
import type { Puzzle } from "@/games/crossword/types";
import {
  clientIp,
  hashIp,
  makeRateLimiter,
  readJsonFile,
  writeJsonFile,
} from "@/lib/apiUtils";

const DATA_DIR = path.join(process.cwd(), "data");
const FLAGGED_FILE = path.join(DATA_DIR, "crossword-flagged.json");
const APPROVED_FILE = path.join(DATA_DIR, "crossword-approved.json");

/** One reviewable clue+answer pair extracted from a flagged puzzle. */
interface FlaggedEntry {
  direction: "across" | "down";
  number: number;
  answer: string;
  clue: string;
}

/** Per-puzzle record in the flagged file. */
interface FlaggedRecord {
  puzzleId: string;
  shape: string;
  /** ms-epoch of the first flag this puzzle received. */
  firstFlaggedAt: number;
  /** ms-epoch of the most recent flag. */
  lastFlaggedAt: number;
  /** Distinct voters (= length of `voters`). */
  flagCount: number;
  /** Hashed-IP fingerprints; dedupes repeat flags from the same source. */
  voters: string[];
  /** All across + down entries from the puzzle, ready for review. */
  entries: FlaggedEntry[];
}

// Separate per-IP limiter from the upvote route's — kept independent so
// an honest player can up- and down-vote without burning a shared quota.
const limiter = makeRateLimiter(60_000, 10);

function extractEntries(puzzle: StoredPuzzle): FlaggedEntry[] {
  const out: FlaggedEntry[] = [];
  for (const e of puzzle.entries.across) {
    out.push({
      direction: "across",
      number: e.number,
      answer: e.answer,
      clue: e.clue,
    });
  }
  for (const e of puzzle.entries.down) {
    out.push({
      direction: "down",
      number: e.number,
      answer: e.answer,
      clue: e.clue,
    });
  }
  // Stable order so re-flags produce identical entry arrays — diffs in
  // the review file stay focused on what changed (vote count, voters)
  // rather than shuffled entry order.
  out.sort((a, b) => {
    if (a.direction !== b.direction)
      return a.direction === "across" ? -1 : 1;
    return a.number - b.number;
  });
  return out;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  if (limiter.check(ip)) {
    return NextResponse.json(
      { error: "Too many votes. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: { puzzleId?: unknown; puzzle?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const puzzleId = typeof body.puzzleId === "string" ? body.puzzleId : null;
  if (!puzzleId || !/^[a-f0-9]{16}$/i.test(puzzleId)) {
    return NextResponse.json(
      { error: "Missing or malformed puzzleId" },
      { status: 400 }
    );
  }

  limiter.record(ip);

  // The puzzle could live in either pool. Most flag targets live in the
  // bundled pool, so check that first and skip the approved-file read
  // entirely on the hot path. Inline (freeform) puzzles fall through to
  // the verifier — the approved file only gets read if the puzzle isn't
  // bundled AND no inline puzzle was supplied (rare edge: someone
  // flagged a freeform puzzle that was previously upvoted into approved).
  let source: StoredPuzzle | null =
    (bundledPool as StoredPuzzle[]).find((p) => p.id === puzzleId) ?? null;

  if (!source && body.puzzle && typeof body.puzzle === "object") {
    const verified = verifyInlinePuzzle(body.puzzle as Puzzle, puzzleId);
    if (verified) source = verified;
  }

  if (!source) {
    const approved = await readJsonFile<StoredPuzzle[]>(APPROVED_FILE, []);
    source = approved.find((p) => p.id === puzzleId) ?? null;
  }

  if (!source) {
    return NextResponse.json(
      {
        error:
          "Puzzle not found in any pool and no valid inline puzzle provided",
      },
      { status: 404 }
    );
  }

  const voterHash = hashIp(ip);
  const records = await readJsonFile<FlaggedRecord[]>(FLAGGED_FILE, []);
  const existing = records.find((r) => r.puzzleId === puzzleId);
  const now = Date.now();

  if (existing) {
    if (existing.voters.includes(voterHash)) {
      return NextResponse.json({
        ok: true,
        flags: existing.flagCount,
        dedup: true,
      });
    }
    existing.voters.push(voterHash);
    existing.flagCount = existing.voters.length;
    existing.lastFlaggedAt = now;
    // Entries snapshot was taken at first flag — don't re-extract on
    // repeat flags. The puzzle hash is identity here (same id ⇒ same
    // solution + black mask), so the clue/answer list is by definition
    // unchanged from what we stored initially.
    await writeJsonFile(FLAGGED_FILE, records);
    return NextResponse.json({ ok: true, flags: existing.flagCount });
  }

  const newRecord: FlaggedRecord = {
    puzzleId,
    shape: source.shape,
    firstFlaggedAt: now,
    lastFlaggedAt: now,
    flagCount: 1,
    voters: [voterHash],
    entries: extractEntries(source),
  };
  records.push(newRecord);
  await writeJsonFile(FLAGGED_FILE, records);
  return NextResponse.json({ ok: true, flags: 1, first: true });
}
