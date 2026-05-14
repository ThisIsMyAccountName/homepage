import {
  encodeGrid,
  decodeGrid,
  encodeSolution,
  decodeSolution,
  type Grid,
  type Solution,
} from "./generator";

const REGULAR_KEY = "nonogram-session";
const DAILY_KEY_PREFIX = "nonogram-daily-session-";

interface RegularSession {
  rows: number;
  cols: number;
  solution: string;
  grid: string;
  timer: number;
}

interface DailySession {
  grid: string;
  timer: number;
  errorCount: number;
}

export function saveSession(
  rows: number,
  cols: number,
  solution: Solution,
  grid: Grid,
  timer: number
): void {
  if (typeof window === "undefined") return;
  const data: RegularSession = {
    rows,
    cols,
    solution: encodeSolution(solution),
    grid: encodeGrid(grid),
    timer,
  };
  try {
    localStorage.setItem(REGULAR_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function loadSession(): {
  rows: number;
  cols: number;
  solution: Solution;
  grid: Grid;
  timer: number;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REGULAR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RegularSession;
    const solution = decodeSolution(data.solution, data.rows, data.cols);
    const grid = decodeGrid(data.grid, data.rows, data.cols);
    if (!solution || !grid) return null;
    return {
      rows: data.rows,
      cols: data.cols,
      solution,
      grid,
      timer: data.timer ?? 0,
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REGULAR_KEY);
}

function dailyKey(todayKey: string): string {
  return `${DAILY_KEY_PREFIX}${todayKey}`;
}

export function saveDailySession(
  todayKey: string,
  grid: Grid,
  timer: number,
  errorCount: number
): void {
  if (typeof window === "undefined") return;
  const data: DailySession = {
    grid: encodeGrid(grid),
    timer,
    errorCount,
  };
  try {
    localStorage.setItem(dailyKey(todayKey), JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadDailySession(
  todayKey: string,
  rows: number,
  cols: number
): { grid: Grid; timer: number; errorCount: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(dailyKey(todayKey));
    if (!raw) return null;
    const data = JSON.parse(raw) as DailySession;
    const grid = decodeGrid(data.grid, rows, cols);
    if (!grid) return null;
    return {
      grid,
      timer: data.timer ?? 0,
      errorCount: data.errorCount ?? 0,
    };
  } catch {
    return null;
  }
}

export function clearDailySession(todayKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(dailyKey(todayKey));
}
