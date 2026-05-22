/**
 * `GET /api/cluereview`
 *
 * Returns the flagged-puzzle list and the persistent deleted-clues log.
 * Protected by `CLUE_REVIEW_PASSWORD` env var — pass it as the
 * `x-review-password` header.  Fails secure when the env var is unset.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readJsonFile } from "@/lib/apiUtils";

const DATA_DIR = path.join(process.cwd(), "data");
const FLAGGED_FILE = path.join(DATA_DIR, "crossword-flagged.json");
const DELETED_FILE = path.join(DATA_DIR, "crossword-deleted-clues.json");

function authorized(request: NextRequest): boolean {
  const pw = process.env.CLUE_REVIEW_PASSWORD;
  if (!pw) return false;
  return request.headers.get("x-review-password") === pw;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [flagged, deletedLog] = await Promise.all([
    readJsonFile<unknown[]>(FLAGGED_FILE, []),
    readJsonFile<unknown[]>(DELETED_FILE, []),
  ]);

  return NextResponse.json({ flagged, deletedLog });
}
