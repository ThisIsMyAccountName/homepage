/**
 * In-progress puzzle session, persisted to localStorage so the player can
 * resume after a refresh / tab close. Distinct from history.ts which only
 * tracks completed runs.
 */

import { encodeBoard, decodeBoard, type Board } from "./generator";

const REGULAR_KEY = "sudoku-session";
const DAILY_KEY_PREFIX = "sudoku-daily-session-";

export interface RegularSession {
  size: number;
  puzzle: string; // encoded
  solution: string; // encoded
  board: string; // encoded
  timer: number;
}

export interface DailySession {
  board: string; // encoded
  timer: number;
  errorCount: number;
}

export function saveRegularSession(
  size: number,
  puzzle: Board,
  solution: Board,
  board: Board,
  timer: number
): void {
  if (typeof window === "undefined") return;
  const data: RegularSession = {
    size,
    puzzle: encodeBoard(puzzle),
    solution: encodeBoard(solution),
    board: encodeBoard(board),
    timer,
  };
  try {
    localStorage.setItem(REGULAR_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable (private mode, quota); ignore
  }
}

export function loadRegularSession(): {
  size: number;
  puzzle: Board;
  solution: Board;
  board: Board;
  timer: number;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REGULAR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RegularSession;
    const puzzle = decodeBoard(data.puzzle, data.size);
    const solution = decodeBoard(data.solution, data.size);
    const board = decodeBoard(data.board, data.size);
    if (!puzzle || !solution || !board) return null;
    return { size: data.size, puzzle, solution, board, timer: data.timer ?? 0 };
  } catch {
    return null;
  }
}

export function clearRegularSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REGULAR_KEY);
}

function dailyKey(todayKey: string): string {
  return `${DAILY_KEY_PREFIX}${todayKey}`;
}

export function saveDailySession(
  todayKey: string,
  board: Board,
  timer: number,
  errorCount: number
): void {
  if (typeof window === "undefined") return;
  const data: DailySession = {
    board: encodeBoard(board),
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
  size: number
): { board: Board; timer: number; errorCount: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(dailyKey(todayKey));
    if (!raw) return null;
    const data = JSON.parse(raw) as DailySession;
    const board = decodeBoard(data.board, size);
    if (!board) return null;
    return { board, timer: data.timer ?? 0, errorCount: data.errorCount ?? 0 };
  } catch {
    return null;
  }
}

export function clearDailySession(todayKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(dailyKey(todayKey));
}
