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

interface LeaderboardData {
  [dateKey: string]: LeaderboardEntry[];
}

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

export async function GET() {
  const data = await readLeaderboard();

  // Compute daily completion counts for last 30 days
  const dailyCounts: { date: string; completions: number }[] = [];
  const today = new Date();
  let totalCompletions = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getTodayKey(d);
    const count = data[key]?.length ?? 0;
    totalCompletions += count;
    dailyCounts.push({ date: key, completions: count });
  }

  // Also count all-time completions
  const allTimeTotal = Object.values(data).reduce(
    (sum, entries) => sum + entries.length,
    0
  );

  return NextResponse.json({
    totalCompletions: allTimeTotal,
    last30Days: totalCompletions,
    daily: dailyCounts,
  });
}
