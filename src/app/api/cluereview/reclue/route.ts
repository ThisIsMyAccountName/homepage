/**
 * `POST /api/cluereview/reclue`
 *
 * Picks an alternate clue for `answer` from the source clue bank,
 * skipping `excludeClue` (the one currently shown in the preview).
 * Used by the cluereview generator: when the mod doesn't like a clue
 * but the *answer* is fine, they swap the clue without regenerating
 * the whole puzzle. The grid (and therefore the puzzle id) stays
 * untouched, so a later Approve still verifies cleanly.
 *
 * Body: `{ "answer": "SPY", "excludeClue": "Shadow, maybe" }`
 * Response: `{ ok: true, clue: "Covert operative", remaining: 3 }`
 *   or `404 { error: "No alternate clues for SPY" }` when the bank has
 *   only the excluded one left.
 *
 * Auth: `x-review-password` (same gate as the rest of /api/cluereview/*).
 *
 * Reads the source file used by `npm run build:crossword-pool` so the
 * pool already excludes any clue earlier moderation deleted — the dev
 * tree has it; production Docker standalone builds don't, in which
 * case this returns 500 (caller surfaces it as "no alternates").
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const CLUES_FILE = path.join(
  process.cwd(),
  "src",
  "games",
  "crossword",
  "data",
  "crossword-clues.json"
);

function authorized(request: NextRequest): boolean {
  const pw = process.env.CLUE_REVIEW_PASSWORD;
  if (!pw) return false;
  return request.headers.get("x-review-password") === pw;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { answer?: unknown; excludeClue?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const answer =
    typeof body.answer === "string" ? body.answer.toUpperCase().trim() : null;
  const excludeClue =
    typeof body.excludeClue === "string" ? body.excludeClue.trim() : "";

  if (!answer) {
    return NextResponse.json({ error: "Missing answer" }, { status: 400 });
  }

  let bank: Record<string, string[]>;
  try {
    const raw = await fs.readFile(CLUES_FILE, "utf-8");
    bank = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Clue bank not accessible in this environment" },
      { status: 500 }
    );
  }

  // Bank keys may be stored case-mixed; merge any variant under the
  // uppercased answer the same way the runtime generator does.
  const candidates: string[] = [];
  for (const [word, clues] of Object.entries(bank)) {
    if (typeof word !== "string" || word.toUpperCase() !== answer) continue;
    if (!Array.isArray(clues)) continue;
    for (const c of clues) {
      if (typeof c === "string" && c.length > 0 && c !== excludeClue) {
        candidates.push(c);
      }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: `No alternate clues for ${answer}` },
      { status: 404 }
    );
  }

  const clue = candidates[Math.floor(Math.random() * candidates.length)];
  return NextResponse.json({ ok: true, clue, remaining: candidates.length });
}
