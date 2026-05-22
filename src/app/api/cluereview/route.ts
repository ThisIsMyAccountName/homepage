/**
 * `GET /api/cluereview`
 *
 * Returns the crossword flagged-puzzle list, the crossword deleted-clue
 * log, plus the cryptic flagged / good / deleted-clue lists. Protected
 * by `CLUE_REVIEW_PASSWORD` env var — pass it as the `x-review-password`
 * header. Fails secure when the env var is unset.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readJsonFile } from "@/lib/apiUtils";

const DATA_DIR = path.join(process.cwd(), "data");
const FLAGGED_FILE = path.join(DATA_DIR, "crossword-flagged.json");
const DELETED_FILE = path.join(DATA_DIR, "crossword-deleted-clues.json");
const CRYPTIC_FLAGGED_FILE = path.join(DATA_DIR, "cryptic-flagged.json");
const CRYPTIC_GOOD_FILE = path.join(DATA_DIR, "cryptic-good.json");
const CRYPTIC_DELETED_FILE = path.join(DATA_DIR, "cryptic-deleted-clues.json");

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
    crypticFlagged,
    crypticGood,
    crypticDeletedLog,
  ] = await Promise.all([
    readJsonFile<unknown[]>(FLAGGED_FILE, []),
    readJsonFile<unknown[]>(DELETED_FILE, []),
    readJsonFile<unknown[]>(CRYPTIC_FLAGGED_FILE, []),
    readJsonFile<string[]>(CRYPTIC_GOOD_FILE, []),
    readJsonFile<unknown[]>(CRYPTIC_DELETED_FILE, []),
  ]);

  return NextResponse.json({
    flagged,
    deletedLog,
    crypticFlagged,
    crypticGood,
    crypticDeletedLog,
  });
}
