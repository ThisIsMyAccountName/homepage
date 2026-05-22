/**
 * `POST /api/cluereview/delete-clue`
 *
 * Body: `{ "word": "SPY", "clue": "Shadow, maybe" }`
 *
 * Two things happen:
 *  1. The specific clue string is removed from
 *     `src/games/crossword/data/crossword-clues.json` (the source file
 *     used by `npm run build:crossword-pool`).  This silently skips if
 *     the file isn't accessible — e.g. in a Docker standalone build where
 *     the source tree isn't present.
 *  2. The deletion is always appended to `data/crossword-deleted-clues.json`
 *     (gitignored, survives git pulls) so the maintainer can re-apply
 *     deletions after a restore.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { readJsonFile, writeJsonFile } from "@/lib/apiUtils";

const DATA_DIR = path.join(process.cwd(), "data");
const DELETED_FILE = path.join(DATA_DIR, "crossword-deleted-clues.json");
const CLUES_FILE = path.join(
  process.cwd(),
  "src",
  "games",
  "crossword",
  "data",
  "crossword-clues.json"
);

interface DeletedClueEntry {
  word: string;
  clue: string;
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

  let body: { word?: unknown; clue?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const word =
    typeof body.word === "string" ? body.word.toUpperCase().trim() : null;
  const clue = typeof body.clue === "string" ? body.clue.trim() : null;

  if (!word || !clue) {
    return NextResponse.json({ error: "Missing word or clue" }, { status: 400 });
  }

  // Attempt to remove from source clue bank (dev / non-standalone only).
  let removedFromSource = false;
  try {
    const raw = await fs.readFile(CLUES_FILE, "utf-8");
    const bank: Record<string, string[]> = JSON.parse(raw);
    if (Array.isArray(bank[word])) {
      const before = bank[word].length;
      bank[word] = bank[word].filter((c) => c !== clue);
      if (bank[word].length === 0) delete bank[word];
      if (bank[word] === undefined || bank[word].length < before) {
        removedFromSource = true;
        await fs.writeFile(CLUES_FILE, JSON.stringify(bank, null, 2));
      }
    }
  } catch {
    // Source file not accessible — log-only mode (Docker standalone etc.)
  }

  // Always record to the persistent deleted-clues log.
  const log = await readJsonFile<DeletedClueEntry[]>(DELETED_FILE, []);
  if (!log.some((e) => e.word === word && e.clue === clue)) {
    log.push({ word, clue, deletedAt: Date.now() });
    await writeJsonFile(DELETED_FILE, log);
  }

  return NextResponse.json({ ok: true, removedFromSource });
}
