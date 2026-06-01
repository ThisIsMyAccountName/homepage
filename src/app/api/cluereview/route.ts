/**
 * `GET /api/cluereview`
 *
 * Returns the crossword flagged-puzzle list, the crossword deleted-clue
 * log, plus the cryptic flagged / good / deleted-clue lists. Also returns
 * the *accepted pools* the daily games draw from: the approved-crossword
 * puzzles and the resolved cryptic "good" clues. Protected by
 * `CLUE_REVIEW_PASSWORD` env var — pass it as the `x-review-password`
 * header. Fails secure when the env var is unset.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readJsonFile } from "@/lib/apiUtils";
import type { StoredPuzzle } from "@/games/crossword/storedPuzzle";
import { getEntryByKey } from "@/games/cryptic/serverPool";

const DATA_DIR = path.join(process.cwd(), "data");
const FLAGGED_FILE = path.join(DATA_DIR, "crossword-flagged.json");
const DELETED_FILE = path.join(DATA_DIR, "crossword-deleted-clues.json");
const APPROVED_FILE = path.join(DATA_DIR, "crossword-approved.json");
const CRYPTIC_FLAGGED_FILE = path.join(DATA_DIR, "cryptic-flagged.json");
const CRYPTIC_GOOD_FILE = path.join(DATA_DIR, "cryptic-good.json");
const CRYPTIC_DELETED_FILE = path.join(DATA_DIR, "cryptic-deleted-clues.json");

interface ApprovedEntry extends StoredPuzzle {
  /** Hashed upvoter IPs — never sent to the client. */
  voters?: string[];
}

function authorized(request: NextRequest): boolean {
  const pw = process.env.CLUE_REVIEW_PASSWORD;
  if (!pw) return false;
  return request.headers.get("x-review-password") === pw;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    flagged,
    deletedLog,
    approved,
    crypticFlagged,
    crypticGood,
    crypticDeletedLog,
  ] = await Promise.all([
    readJsonFile<unknown[]>(FLAGGED_FILE, []),
    readJsonFile<unknown[]>(DELETED_FILE, []),
    readJsonFile<ApprovedEntry[]>(APPROVED_FILE, []),
    readJsonFile<unknown[]>(CRYPTIC_FLAGGED_FILE, []),
    readJsonFile<string[]>(CRYPTIC_GOOD_FILE, []),
    readJsonFile<unknown[]>(CRYPTIC_DELETED_FILE, []),
  ]);

  // Strip hashed upvoter IPs before exposing the approved crossword pool.
  const crosswordApproved = approved.map(({ voters: _voters, ...rest }) => {
    void _voters;
    return rest;
  });

  // Resolve the cryptic "good" keys to full clue records so the pool view
  // can show the clue / pattern / wordplay, not just the bare answer.
  // A key whose source row has since been deleted resolves to null and is
  // dropped from the list.
  const crypticGoodEntries = (
    await Promise.all(
      crypticGood.map(async (key) => {
        const entry = await getEntryByKey(key);
        if (!entry) return null;
        return {
          key: entry.key,
          clue: entry.clue,
          pattern: entry.pattern,
          wordplay: entry.wordplay,
        };
      })
    )
  ).filter((e): e is NonNullable<typeof e> => e !== null);

  return NextResponse.json({
    flagged,
    deletedLog,
    crosswordApproved,
    crypticFlagged,
    crypticGood,
    crypticGoodEntries,
    crypticDeletedLog,
  });
}
