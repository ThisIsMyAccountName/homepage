import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { sanitizeName, validateSubmission } from "@/lib/security";
import { getTodayKey } from "@/lib/daily";

export const GAMES = ["sudoku", "nonogram", "x-coloring"] as const;
export type GameId = (typeof GAMES)[number];

export interface LeaderboardEntry {
  name: string;
  time: number;
  errors: number;
  date: string;
  timestamp: number;
  game: GameId;
}

type EntryWithIp = LeaderboardEntry & { ip?: string };

/**
 * Unified leaderboard data: keyed by date, then by game.
 * Legacy shape (date -> array) is auto-migrated to {sudoku: [...]} on read.
 */
interface LeaderboardData {
  [dateKey: string]: { [game in GameId]?: EntryWithIp[] };
}

const DATA_DIR = path.join(process.cwd(), "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const LEGACY_NONOGRAM_FILE = path.join(DATA_DIR, "nonogram-leaderboard.json");
const MAX_ENTRIES_PER_DAY = 50;

// Per-IP rate limiting (in-memory, per process).
const rateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  rateLimit.set(ip, recent);
  return recent.length >= RATE_LIMIT_MAX;
}

function recordRequest(ip: string): void {
  const timestamps = rateLimit.get(ip) || [];
  timestamps.push(Date.now());
  rateLimit.set(ip, timestamps);
}

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function isLegacyArray(v: unknown): v is EntryWithIp[] {
  return Array.isArray(v);
}

/**
 * Read the unified leaderboard. Lazily migrates from:
 *   (a) the legacy flat shape   `{ "date": [entries] }`        (sudoku only)
 *   (b) the legacy nonogram file `data/nonogram-leaderboard.json`
 * Migration is idempotent — re-running has no effect.
 */
async function readLeaderboard(): Promise<{
  data: LeaderboardData;
  migrated: boolean;
}> {
  let raw: string;
  try {
    raw = await fs.readFile(LEADERBOARD_FILE, "utf-8");
  } catch {
    raw = "{}";
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  let migrated = false;
  const data: LeaderboardData = {};
  for (const [date, value] of Object.entries(parsed)) {
    if (isLegacyArray(value)) {
      data[date] = {
        sudoku: value.map((e) => ({ ...e, game: "sudoku" as const })),
      };
      migrated = true;
    } else if (value && typeof value === "object") {
      const bucket = value as Record<string, EntryWithIp[]>;
      const next: { [game in GameId]?: EntryWithIp[] } = {};
      for (const g of GAMES) {
        if (Array.isArray(bucket[g])) {
          next[g] = bucket[g].map((e) => ({ ...e, game: g }));
        }
      }
      data[date] = next;
    }
  }

  // Merge legacy nonogram file if present.
  try {
    const nonoRaw = await fs.readFile(LEGACY_NONOGRAM_FILE, "utf-8");
    const nonoParsed = JSON.parse(nonoRaw) as Record<string, unknown>;
    for (const [date, value] of Object.entries(nonoParsed)) {
      if (!isLegacyArray(value)) continue;
      const dayBucket = data[date] ?? {};
      const existing = dayBucket.nonogram ?? [];
      const merged = [...existing];
      for (const entry of value) {
        const key = `${entry.name}|${entry.time}|${entry.errors}|${entry.timestamp}`;
        if (!merged.some((e) => `${e.name}|${e.time}|${e.errors}|${e.timestamp}` === key)) {
          merged.push({ ...entry, game: "nonogram" });
        }
      }
      dayBucket.nonogram = merged;
      data[date] = dayBucket;
      migrated = true;
    }
  } catch {
    // No legacy nonogram file, nothing to merge.
  }

  return { data, migrated };
}

async function writeLeaderboard(data: LeaderboardData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(data, null, 2));
}

/**
 * After a successful migration, delete the legacy nonogram file so we don't
 * keep re-merging it on every read.
 */
async function cleanupLegacyNonogram(): Promise<void> {
  try {
    await fs.unlink(LEGACY_NONOGRAM_FILE);
  } catch {
    // already gone
  }
}

const EASTER_EGGS = [
  "Nice try, hacker. The puzzle is the only thing to crack here.",
  "SQL injection? In a JSON file? Bold strategy.",
  "XSS attempt detected. Your name has been changed to 'Script Kiddie'.",
  "I see you're a person of culture. Unfortunately, this isn't that kind of form.",
  "Alert(1) won't work here, but A+ for effort.",
  "Trying to break things? The daily puzzle is harder, promise.",
];

function isValidGame(g: unknown): g is GameId {
  return typeof g === "string" && (GAMES as readonly string[]).includes(g);
}

function stripIp(e: EntryWithIp): LeaderboardEntry {
  const { ip: _ip, ...rest } = e;
  void _ip;
  return rest;
}

function sortEntries(entries: EntryWithIp[]): EntryWithIp[] {
  return [...entries].sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.errors - b.errors;
  });
}

export async function GET(request: NextRequest) {
  const todayKey = getTodayKey();
  const { data, migrated } = await readLeaderboard();
  if (migrated) {
    await writeLeaderboard(data);
    await cleanupLegacyNonogram();
  }
  const bucket = data[todayKey] ?? {};
  const gameParam = request.nextUrl.searchParams.get("game");

  if (gameParam) {
    if (!isValidGame(gameParam)) {
      return NextResponse.json(
        { error: `Unknown game. Allowed: ${GAMES.join(", ")}` },
        { status: 400 }
      );
    }
    const entries = sortEntries(bucket[gameParam] ?? []).map(stripIp);
    return NextResponse.json({
      date: todayKey,
      game: gameParam,
      entries: entries.slice(0, 10),
      total: entries.length,
    });
  }

  // Combined view: top 10 across all games for today.
  const all: EntryWithIp[] = [];
  for (const g of GAMES) {
    for (const e of bucket[g] ?? []) all.push({ ...e, game: g });
  }
  const combined = sortEntries(all).map(stripIp);
  return NextResponse.json({
    date: todayKey,
    entries: combined.slice(0, 10),
    total: combined.length,
  });
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Slow down. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: {
    name?: string;
    time?: number;
    errors?: number;
    game?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name: rawName, time, errors, game: rawGame } = body;

  if (!rawName || time === undefined || errors === undefined || !rawGame) {
    return NextResponse.json(
      { error: "Missing required fields: name, time, errors, game" },
      { status: 400 }
    );
  }

  if (!isValidGame(rawGame)) {
    return NextResponse.json(
      { error: `Unknown game. Allowed: ${GAMES.join(", ")}` },
      { status: 400 }
    );
  }
  const game: GameId = rawGame;

  if (!validateSubmission(time, errors)) {
    return NextResponse.json(
      { error: "Invalid submission values" },
      { status: 400 }
    );
  }

  const { clean, exploitDetected } = sanitizeName(rawName);

  if (exploitDetected) {
    recordRequest(ip);
    const egg = EASTER_EGGS[Math.floor(Math.random() * EASTER_EGGS.length)];
    return NextResponse.json(
      { error: egg, easterEgg: true, hacker: true },
      { status: 418 }
    );
  }

  recordRequest(ip);

  const todayKey = getTodayKey();
  const { data, migrated } = await readLeaderboard();
  if (!data[todayKey]) data[todayKey] = {};
  const bucket = data[todayKey];
  if (!bucket[game]) bucket[game] = [];
  const list = bucket[game]!;

  // Cap submissions per IP, per game, per day.
  const existingFromIp = list.filter((e) => e.ip === ip);
  if (existingFromIp.length >= 3) {
    return NextResponse.json(
      { error: "Maximum submissions reached for today" },
      { status: 429 }
    );
  }

  const entry: EntryWithIp = {
    name: clean,
    time,
    errors,
    date: todayKey,
    timestamp: Date.now(),
    game,
    ip,
  };
  list.push(entry);

  if (list.length > MAX_ENTRIES_PER_DAY) {
    bucket[game] = sortEntries(list).slice(0, MAX_ENTRIES_PER_DAY);
  }

  await writeLeaderboard(data);
  if (migrated) await cleanupLegacyNonogram();

  return NextResponse.json({ success: true, entry: stripIp(entry) });
}
