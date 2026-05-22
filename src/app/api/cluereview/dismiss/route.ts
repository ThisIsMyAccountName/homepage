/**
 * `POST /api/cluereview/dismiss`
 *
 * Body: `{ "puzzleId": "<16-hex-id>" }`
 *
 * Removes the puzzle from `data/crossword-flagged.json` so it no longer
 * appears in the review queue.  Does not affect the pool or the clue bank.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readJsonFile, writeJsonFile } from "@/lib/apiUtils";

const DATA_DIR = path.join(process.cwd(), "data");
const FLAGGED_FILE = path.join(DATA_DIR, "crossword-flagged.json");

function authorized(request: NextRequest): boolean {
  const pw = process.env.CLUE_REVIEW_PASSWORD;
  if (!pw) return false;
  return request.headers.get("x-review-password") === pw;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { puzzleId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const puzzleId =
    typeof body.puzzleId === "string" ? body.puzzleId : null;
  if (!puzzleId || !/^[a-f0-9]{16}$/i.test(puzzleId)) {
    return NextResponse.json({ error: "Invalid puzzleId" }, { status: 400 });
  }

  const records = await readJsonFile<Record<string, unknown>[]>(FLAGGED_FILE, []);
  const filtered = records.filter((r) => r.puzzleId !== puzzleId);
  await writeJsonFile(FLAGGED_FILE, filtered);

  return NextResponse.json({ ok: true, removed: records.length - filtered.length });
}
