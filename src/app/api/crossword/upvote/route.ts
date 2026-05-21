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
 * Body: `{ "puzzleId": "<16-hex-id>" }`
 * Response: `{ ok: true, upvotes: N }` on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import bundledPool from "@/games/crossword/data/crossword-pool.json";
import type { StoredPuzzle } from "@/games/crossword/storedPuzzle";

const DATA_DIR = path.join(process.cwd(), "data");
const APPROVED_FILE = path.join(DATA_DIR, "crossword-approved.json");

/** Server-side voter list per approved puzzle. Never sent to clients. */
interface ApprovedEntry extends StoredPuzzle {
  /** Hashed IPs of voters, for one-vote-per-puzzle-per-IP dedup. */
  voters?: string[];
}

// Per-IP rate limit (in-memory, per process). Mirrors the leaderboard
// route's approach so cross-server consistency isn't worse than what we
// already accept there.
const rateLimit = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateLimit.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  rateLimit.set(ip, recent);
  return recent.length >= RATE_MAX;
}
function recordRequest(ip: string): void {
  const ts = rateLimit.get(ip) ?? [];
  ts.push(Date.now());
  rateLimit.set(ip, ts);
}

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

async function readApproved(): Promise<ApprovedEntry[]> {
  try {
    const raw = await fs.readFile(APPROVED_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ApprovedEntry[];
    return [];
  } catch {
    return [];
  }
}

async function writeApproved(entries: ApprovedEntry[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(APPROVED_FILE, JSON.stringify(entries, null, 2));
}

/**
 * Lightweight non-reversible IP fingerprint — same property as the
 * traffic-tracker hash: we can tell whether two requests came from the
 * same source, but never reverse to the IP.
 */
function hashIp(ip: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many upvotes. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: { puzzleId?: unknown };
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

  recordRequest(ip);

  const voterHash = hashIp(ip);
  const approved = await readApproved();

  // Already in the approved pool? Just bump or noop on duplicate vote.
  const existing = approved.find((p) => p.id === puzzleId);
  if (existing) {
    const voters = existing.voters ?? [];
    if (voters.includes(voterHash)) {
      return NextResponse.json(
        { ok: true, upvotes: existing.upvotes ?? voters.length, dedup: true }
      );
    }
    voters.push(voterHash);
    existing.voters = voters;
    existing.upvotes = (existing.upvotes ?? 0) + 1;
    await writeApproved(approved);
    return NextResponse.json({ ok: true, upvotes: existing.upvotes });
  }

  // Not yet approved — pull from the bundled pool and promote.
  const fromBundled = (bundledPool as StoredPuzzle[]).find(
    (p) => p.id === puzzleId
  );
  if (!fromBundled) {
    return NextResponse.json(
      { error: "Puzzle not found in pool" },
      { status: 404 }
    );
  }

  const promoted: ApprovedEntry = {
    ...fromBundled,
    upvotes: 1,
    approvedAt: Date.now(),
    voters: [voterHash],
  };
  approved.push(promoted);
  await writeApproved(approved);

  return NextResponse.json({ ok: true, upvotes: 1, promoted: true });
}
