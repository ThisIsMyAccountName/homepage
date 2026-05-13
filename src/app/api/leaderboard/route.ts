import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { sanitizeName, validateSubmission } from "@/lib/security";
import { getTodayKey } from "@/lib/daily";

export interface LeaderboardEntry {
  name: string;
  time: number;
  errors: number;
  date: string;
  timestamp: number;
}

interface LeaderboardData {
  [dateKey: string]: LeaderboardEntry[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const MAX_ENTRIES_PER_DAY = 50;

// Simple in-memory rate limiting
const rateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 submissions per minute

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
    // Already exists
  }
}

async function readLeaderboard(): Promise<LeaderboardData> {
  try {
    const raw = await fs.readFile(LEADERBOARD_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeLeaderboard(data: LeaderboardData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(data, null, 2));
}

// Easter egg responses for exploit attempts
const EASTER_EGGS = [
  "Nice try, hacker. The puzzle is the only thing to crack here.",
  "SQL injection? In a JSON file? Bold strategy.",
  "XSS attempt detected. Your name has been changed to 'Script Kiddie'.",
  "I see you're a person of culture. Unfortunately, this isn't that kind of form.",
  "Alert(1) won't work here, but A+ for effort.",
  "Trying to break things? The daily puzzle is harder, promise.",
];

export async function GET() {
  const todayKey = getTodayKey();
  const data = await readLeaderboard();
  const entries = data[todayKey] || [];

  // Sort by time (fastest first), then by errors (fewer first)
  const sorted = [...entries].sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.errors - b.errors;
  });

  return NextResponse.json({
    date: todayKey,
    entries: sorted.slice(0, 10), // Top 10
    total: sorted.length,
  });
}

export async function POST(request: NextRequest) {
  // Rate limiting
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

  let body: { name?: string; time?: number; errors?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name: rawName, time, errors } = body;

  if (!rawName || time === undefined || errors === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: name, time, errors" },
      { status: 400 }
    );
  }

  // Validate time/errors are plausible
  if (!validateSubmission(time, errors)) {
    return NextResponse.json(
      { error: "Invalid submission values" },
      { status: 400 }
    );
  }

  // Sanitize name + detect exploits
  const { clean, exploitDetected } = sanitizeName(rawName);

  if (exploitDetected) {
    recordRequest(ip);
    const egg = EASTER_EGGS[Math.floor(Math.random() * EASTER_EGGS.length)];
    return NextResponse.json(
      {
        error: egg,
        easterEgg: true,
        hacker: true,
      },
      { status: 418 } // I'm a teapot
    );
  }

  recordRequest(ip);

  // Write to leaderboard
  const todayKey = getTodayKey();
  const data = await readLeaderboard();
  if (!data[todayKey]) data[todayKey] = [];

  // Prevent duplicate submissions from same IP for today
  const existingFromIp = data[todayKey].filter(
    (e) => (e as LeaderboardEntry & { ip?: string }).ip === ip
  );
  if (existingFromIp.length >= 3) {
    return NextResponse.json(
      { error: "Maximum submissions reached for today" },
      { status: 429 }
    );
  }

  const entry: LeaderboardEntry & { ip: string } = {
    name: clean,
    time,
    errors,
    date: todayKey,
    timestamp: Date.now(),
    ip,
  };

  data[todayKey].push(entry);

  // Keep only top entries per day
  if (data[todayKey].length > MAX_ENTRIES_PER_DAY) {
    data[todayKey] = data[todayKey]
      .sort((a, b) => a.time - b.time)
      .slice(0, MAX_ENTRIES_PER_DAY);
  }

  await writeLeaderboard(data);

  // Return without IP in response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ip: _ip, ...publicEntry } = entry;
  return NextResponse.json({ success: true, entry: publicEntry });
}
