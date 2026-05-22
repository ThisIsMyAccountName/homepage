/**
 * `POST /api/cluereview/cryptic-dismiss`
 *
 * Body: `{ "key": "SEDATE" }`
 *
 * Removes a cryptic clue from `data/cryptic-flagged.json` without
 * touching the source dataset. Use this when the reviewer has decided
 * the flagged clue is fine after all.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readJsonFile, writeJsonFile } from "@/lib/apiUtils";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const FLAGGED_FILE = path.join(DATA_DIR, "cryptic-flagged.json");

function authorized(request: NextRequest): boolean {
  const pw = process.env.CLUE_REVIEW_PASSWORD;
  if (!pw) return false;
  return request.headers.get("x-review-password") === pw;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const flagged = await readJsonFile<Array<{ key?: string }>>(FLAGGED_FILE, []);
  const filtered = flagged.filter((f) => f.key !== key);
  await writeJsonFile(FLAGGED_FILE, filtered);

  return NextResponse.json({
    ok: true,
    removed: flagged.length - filtered.length,
  });
}
