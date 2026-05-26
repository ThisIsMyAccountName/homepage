/**
 * `POST /api/cluereview/approve`
 *
 * Promotes a moderator-generated puzzle into the daily-crossword pool.
 *
 * Body: `{ "puzzleId": "<16-hex-id>", "puzzle": <Puzzle> }`
 *
 * Effect: appends the verified puzzle to `data/crossword-approved.json`
 * (the same file the upvote endpoint writes to). Once that file has any
 * entries, `/api/crossword/daily` prefers it over the bundled pool — so
 * an approved puzzle starts showing up in the daily rotation immediately.
 *
 * Auth: `x-review-password` (same gate as the rest of /api/cluereview/*).
 * The puzzle body is independently validated against the claimed id via
 * `verifyInlinePuzzle` so a tampered body can't smuggle a different grid
 * into the pool.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { verifyInlinePuzzle } from "@/games/crossword/serverValidation";
import type { StoredPuzzle } from "@/games/crossword/storedPuzzle";
import type { Puzzle } from "@/games/crossword/types";
import { readJsonFile, writeJsonFile } from "@/lib/apiUtils";

const APPROVED_FILE = path.join(process.cwd(), "data", "crossword-approved.json");

interface ApprovedEntry extends StoredPuzzle {
  /** Hashed IPs of upvoters — unused for moderator approvals but kept on
   *  the type so this file shares schema with the upvote-promoted entries. */
  voters?: string[];
}

function authorized(request: NextRequest): boolean {
  const pw = process.env.CLUE_REVIEW_PASSWORD;
  if (!pw) return false;
  return request.headers.get("x-review-password") === pw;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { puzzleId?: unknown; puzzle?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const puzzleId = typeof body.puzzleId === "string" ? body.puzzleId : null;
  if (!puzzleId || !/^[a-f0-9]{16}$/i.test(puzzleId)) {
    return NextResponse.json(
      { error: "Missing or malformed puzzleId" },
      { status: 400 }
    );
  }

  if (!body.puzzle || typeof body.puzzle !== "object") {
    return NextResponse.json({ error: "Missing puzzle body" }, { status: 400 });
  }

  const verified = verifyInlinePuzzle(body.puzzle as Puzzle, puzzleId);
  if (!verified) {
    return NextResponse.json(
      { error: "Puzzle failed verification (id ↔ grid mismatch)" },
      { status: 400 }
    );
  }

  const approved = await readJsonFile<ApprovedEntry[]>(APPROVED_FILE, []);

  if (approved.some((p) => p.id === puzzleId)) {
    return NextResponse.json({
      ok: true,
      alreadyApproved: true,
      poolSize: approved.length,
    });
  }

  // Mod-approved entries enter with `upvotes: 1` so the daily route's
  // "prefer non-empty approved file" branch picks them up immediately,
  // and so a future organic upvote can still increment off this number
  // rather than landing on `undefined`.
  const promoted: ApprovedEntry = {
    ...verified,
    id: puzzleId,
    upvotes: 1,
    voters: [],
  };
  approved.push(promoted);
  await writeJsonFile(APPROVED_FILE, approved);

  return NextResponse.json({
    ok: true,
    alreadyApproved: false,
    poolSize: approved.length,
  });
}
