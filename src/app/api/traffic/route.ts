import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getTodayKey } from "@/lib/daily";

interface PageView {
  path: string;
  count: number;
}

interface DailyTraffic {
  date: string;
  totalViews: number;
  uniqueVisitors: number;
  pages: PageView[];
}

interface TrafficData {
  [dateKey: string]: {
    pages: Record<string, number>;
    visitors: string[]; // hashed IPs
  };
}

const DATA_DIR = path.join(process.cwd(), "data");
const TRAFFIC_FILE = path.join(DATA_DIR, "traffic.json");

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Already exists
  }
}

async function readTraffic(): Promise<TrafficData> {
  try {
    const raw = await fs.readFile(TRAFFIC_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeTraffic(data: TrafficData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(TRAFFIC_FILE, JSON.stringify(data, null, 2));
}

// Simple hash for IP anonymization
function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash + ip.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// POST - Record a page view
export async function POST(request: NextRequest) {
  let body: { path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const pagePath = body.path;
  if (!pagePath || typeof pagePath !== "string") {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  // Sanitize path
  const cleanPath = pagePath.replace(/[^a-zA-Z0-9/\-_]/g, "").slice(0, 100);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const hashedIp = hashIP(ip);

  const todayKey = getTodayKey();
  const data = await readTraffic();

  if (!data[todayKey]) {
    data[todayKey] = { pages: {}, visitors: [] };
  }

  data[todayKey].pages[cleanPath] = (data[todayKey].pages[cleanPath] || 0) + 1;

  if (!data[todayKey].visitors.includes(hashedIp)) {
    data[todayKey].visitors.push(hashedIp);
  }

  await writeTraffic(data);

  return NextResponse.json({ ok: true });
}

// GET - Return traffic stats (last 30 days)
export async function GET() {
  const data = await readTraffic();

  // Build last 30 days of stats
  const stats: DailyTraffic[] = [];
  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getTodayKey(d);
    const dayData = data[key];

    if (dayData) {
      const pages: PageView[] = Object.entries(dayData.pages)
        .map(([p, count]) => ({ path: p, count }))
        .sort((a, b) => b.count - a.count);

      stats.push({
        date: key,
        totalViews: Object.values(dayData.pages).reduce((s, c) => s + c, 0),
        uniqueVisitors: dayData.visitors.length,
        pages,
      });
    } else {
      stats.push({
        date: key,
        totalViews: 0,
        uniqueVisitors: 0,
        pages: [],
      });
    }
  }

  return NextResponse.json({ stats });
}
