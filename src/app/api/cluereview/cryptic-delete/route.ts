/**
 * `POST /api/cluereview/cryptic-delete`
 *
 * Body: `{ "key": "SEDATE" }`
 *
 * Three things happen:
 *  1. The key is removed from `src/games/cryptic/data/cryptic-clues.json`
 *     (the source dataset). Silently skips if the file isn't accessible
 *     (e.g. a Docker standalone build where the source tree isn't present).
 *  2. The deletion is logged to `data/cryptic-deleted-clues.json` so the
 *     maintainer can re-apply it after a dataset restore.
 *  3. The clue is removed from `cryptic-flagged.json` and
 *     `cryptic-good.json` so it doesn't haunt either queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { readJsonFile, writeJsonFile } from "@/lib/apiUtils";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const CLUES_FILE = path.join(
  process.cwd(),
  "src",
  "games",
  "cryptic",
  "data",
  "cryptic-clues.json"
);
const FLAGGED_FILE = path.join(DATA_DIR, "cryptic-flagged.json");
const GOOD_FILE = path.join(DATA_DIR, "cryptic-good.json");
const DELETED_FILE = path.join(DATA_DIR, "cryptic-deleted-clues.json");

interface DeletedEntry {
  key: string;
  clue?: string;
  pattern?: string;
  wordplay?: string;
  deletedAt: number;
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

  // 1. Remove from source dataset if accessible.
  let removedFromSource = false;
  let snapshot: { clue?: string; pattern?: string; wordplay?: string } = {};
  try {
    const raw = await fs.readFile(CLUES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && key in parsed) {
      const value = parsed[key];
      if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        snapshot = {
          clue: typeof v.clue === "string" ? v.clue : undefined,
          pattern: typeof v.pattern === "string" ? v.pattern : undefined,
          wordplay: typeof v.wordplay === "string" ? v.wordplay : undefined,
        };
      }
      delete parsed[key];
      await fs.writeFile(CLUES_FILE, JSON.stringify(parsed, null, 2));
      removedFromSource = true;
    }
  } catch {
    // Source not accessible — log-only mode.
  }

  // 2. Log deletion (idempotent on key).
  const deleted = await readJsonFile<DeletedEntry[]>(DELETED_FILE, []);
  if (!deleted.some((d) => d.key === key)) {
    deleted.push({ key, ...snapshot, deletedAt: Date.now() });
    await writeJsonFile(DELETED_FILE, deleted);
  }

  // 3. Remove from flagged + good queues.
  const flagged = await readJsonFile<Array<{ key?: string }>>(FLAGGED_FILE, []);
  const flaggedNext = flagged.filter((f) => f.key !== key);
  if (flaggedNext.length !== flagged.length) {
    await writeJsonFile(FLAGGED_FILE, flaggedNext);
  }
  const good = await readJsonFile<string[]>(GOOD_FILE, []);
  const goodNext = good.filter((k) => k !== key);
  if (goodNext.length !== good.length) {
    await writeJsonFile(GOOD_FILE, goodNext);
  }

  return NextResponse.json({ ok: true, removedFromSource });
}
