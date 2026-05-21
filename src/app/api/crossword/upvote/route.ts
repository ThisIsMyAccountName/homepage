/**
 * `POST /api/crossword/upvote`
 *
 * One-tap "I liked this puzzle" endpoint. The completion card surfaces
 * the button after the player solves today's daily; clicking POSTs the
 * puzzle's stable id here.
 *
 * Effect: if the puzzle exists in the bundled pool, it's *copied* into
 * `data/crossword-approved.json` with `upvotes = 1`. If it's already in
 * the approved file, `upvotes` is incremented. Same IP voting twice on
 * the same puzzle is deduped via the per-puzzle voter list (stored
 * server-side, not returned).
 *
 * Once any puzzle has been upvoted, `/api/crossword/daily` starts
 * preferring the approved pool — the community curation gradually
 * replaces the algorithmically-seeded rotation.
 *
 * Body: `{ "puzzleId": "<16-hex-id>", "puzzle"?: <inline puzzle> }`
 * Response: `{ ok: true, upvotes: N }` on success.
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

const APPROVED_FILE = path.join(process.cwd(), "data", "crossword-approved.json");

/** Server-side voter list per approved puzzle. Never sent to clients. */
interface ApprovedEntry extends StoredPuzzle {
  /** Hashed IPs of voters, for one-vote-per-puzzle-per-IP dedup. */
  voters?: string[];
}

// Per-IP rate limit (in-memory, per process). Kept separate from the
// downvote limiter so an honest player can vote both ways without
// burning their quota on a single direction.
const limiter = makeRateLimiter(60_000, 10);

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  if (limiter.check(ip)) {
    return NextResponse.json(
      { error: "Too many upvotes. Try again in a minute." },
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

  const voterHash = hashIp(ip);
  const approved = await readJsonFile<ApprovedEntry[]>(APPROVED_FILE, []);

  // Already in the approved pool? Just bump or noop on duplicate vote.
  const existing = approved.find((p) => p.id === puzzleId);
  if (existing) {
    const voters = existing.voters ?? [];
    if (voters.includes(voterHash)) {
      return NextResponse.json({
        ok: true,
        upvotes: existing.upvotes ?? voters.length,
        dedup: true,
      });
    }
    voters.push(voterHash);
    existing.voters = voters;
    existing.upvotes = (existing.upvotes ?? 0) + 1;
    await writeJsonFile(APPROVED_FILE, approved);
    return NextResponse.json({ ok: true, upvotes: existing.upvotes });
  }

  // Not yet approved — first try the bundled pool, then accept an
  // inline puzzle (used by the freeform `/games/crossword` flow, whose
  // puzzles are generated client-side and don't exist in any pool).
  const fromBundled = (bundledPool as StoredPuzzle[]).find(
    (p) => p.id === puzzleId
  );
  let source: StoredPuzzle | null = fromBundled ?? null;

  if (!source && body.puzzle && typeof body.puzzle === "object") {
    const verified = verifyInlinePuzzle(body.puzzle as Puzzle, puzzleId);
    if (verified) source = verified;
  }

  if (!source) {
    return NextResponse.json(
      { error: "Puzzle not found in pool and no valid inline puzzle provided" },
      { status: 404 }
    );
  }

  // `approvedAt` was stored but never read — dropped to keep the file
  // schema lean. `upvotes` + `voters` are the only fields anyone reads
  // (`upvotes` for response, `voters` for dedup).
  const promoted: ApprovedEntry = {
    ...source,
    id: puzzleId,
    upvotes: 1,
    voters: [voterHash],
  };
  approved.push(promoted);
  await writeJsonFile(APPROVED_FILE, approved);

  return NextResponse.json({ ok: true, upvotes: 1, promoted: true });
}
