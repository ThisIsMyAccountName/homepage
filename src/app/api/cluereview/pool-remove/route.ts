/**
 * `POST /api/cluereview/pool-remove`
 *
 * Removes a single entry from an *accepted pool* so it stops feeding the
 * daily games. Two shapes:
 *
 *  - `{ "type": "crossword", "puzzleId": "<16-hex-id>" }`
 *      Drops the matching puzzle from `data/crossword-approved.json`. When
 *      that file empties, the daily crossword falls back to the bundled
 *      pool automatically.
 *
 *  - `{ "type": "cryptic", "key": "SEDATE" }`
 *      Drops the answer key from `data/cryptic-good.json`. The clue itself
 *      stays in the dataset (use cryptic-delete to purge it entirely) — it
 *      just leaves the curated "good" pool.
 *
 * Auth: `x-review-password` (same gate as the rest of /api/cluereview/*).
 * Idempotent: removing an entry that isn't present returns `removed: false`.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readJsonFile, writeJsonFile } from "@/lib/apiUtils";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const APPROVED_FILE = path.join(DATA_DIR, "crossword-approved.json");
const GOOD_FILE = path.join(DATA_DIR, "cryptic-good.json");

function authorized(request: NextRequest): boolean {
  const pw = process.env.CLUE_REVIEW_PASSWORD;
  if (!pw) return false;
  return request.headers.get("x-review-password") === pw;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: unknown; puzzleId?: unknown; key?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.type === "crossword") {
    const puzzleId = typeof body.puzzleId === "string" ? body.puzzleId : "";
    if (!puzzleId) {
      return NextResponse.json({ error: "Missing puzzleId" }, { status: 400 });
    }
    const approved = await readJsonFile<Array<{ id?: string }>>(
      APPROVED_FILE,
      []
    );
    const next = approved.filter((p) => p.id !== puzzleId);
    const removed = next.length !== approved.length;
    if (removed) await writeJsonFile(APPROVED_FILE, next);
    return NextResponse.json({ ok: true, removed, poolSize: next.length });
  }

  if (body.type === "cryptic") {
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }
    const good = await readJsonFile<string[]>(GOOD_FILE, []);
    const next = good.filter((k) => k !== key);
    const removed = next.length !== good.length;
    if (removed) await writeJsonFile(GOOD_FILE, next);
    return NextResponse.json({ ok: true, removed, poolSize: next.length });
  }

  return NextResponse.json(
    { error: "type must be 'crossword' or 'cryptic'" },
    { status: 400 }
  );
}
