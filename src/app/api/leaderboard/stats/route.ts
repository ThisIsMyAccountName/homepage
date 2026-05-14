import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getTodayKey } from "@/lib/daily";

interface LeaderboardEntry {
  name: string;
  time: number;
  errors: number;
  date: string;
  timestamp: number;
}

/** Post-migration schema is nested by game; legacy schema is a flat array. */
type DailyBucket = LeaderboardEntry[] | Record<string, LeaderboardEntry[]>;
type LeaderboardData = Record<string, DailyBucket>;

const DATA_DIR = path.join(process.cwd(), "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");

async function readLeaderboard(): Promise<LeaderboardData> {
  try {
    const raw = await fs.readFile(LEADERBOARD_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function entriesForDay(bucket: DailyBucket | undefined): number {
  if (!bucket) return 0;
  if (Array.isArray(bucket)) return bucket.length;
  return Object.values(bucket).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );
}

export async function GET() {
  const data = await readLeaderboard();

  const dailyCounts: { date: string; completions: number }[] = [];
  const today = new Date();
  let totalLast30 = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getTodayKey(d);
    const count = entriesForDay(data[key]);
    totalLast30 += count;
    dailyCounts.push({ date: key, completions: count });
  }

  const allTimeTotal = Object.values(data).reduce(
    (sum, bucket) => sum + entriesForDay(bucket),
    0
  );

  return NextResponse.json({
    totalCompletions: allTimeTotal,
    last30Days: totalLast30,
    daily: dailyCounts,
  });
}
