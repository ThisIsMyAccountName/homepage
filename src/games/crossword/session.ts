/**
 * Per-day in-progress crossword session, persisted to localStorage so the
 * player can refresh / close the tab without losing their work.
 *
 * Mirrors the daily-sudoku session pattern (`src/games/sudoku/session.ts`)
 * but stores the letter grid as a flat row-major string instead of a board
 * of numbers. Black cells stay as `"#"`, empty whites as `"."`, filled
 * cells as uppercase A–Z.
 */

const DAILY_KEY_PREFIX = "crossword-daily-session-";

interface DailySession {
  rows: number;
  cols: number;
  /** Flat row-major: rows*cols chars, one of `.`, `#`, or `A`…`Z`. */
  letters: string;
  timer: number;
  errorCount: number;
}

function dailyKey(todayKey: string): string {
  return `${DAILY_KEY_PREFIX}${todayKey}`;
}

function flatten(grid: string[][]): string {
  let out = "";
  for (const row of grid) for (const cell of row) out += cell;
  return out;
}

function inflate(letters: string, rows: number, cols: number): string[][] | null {
  if (letters.length !== rows * cols) return null;
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(letters[r * cols + c]);
    grid.push(row);
  }
  return grid;
}

export function saveDailySession(
  todayKey: string,
  grid: string[][],
  timer: number,
  errorCount: number
): void {
  if (typeof window === "undefined") return;
  if (grid.length === 0) return;
  const data: DailySession = {
    rows: grid.length,
    cols: grid[0].length,
    letters: flatten(grid),
    timer,
    errorCount,
  };
  try {
    window.localStorage.setItem(dailyKey(todayKey), JSON.stringify(data));
  } catch {
    // quota / private mode — silently drop
  }
}

/**
 * Returns the saved grid only if the stored dimensions match today's puzzle.
 * (They always should, since sessions are date-keyed, but a stale write
 * during local development can leave the wrong shape — better to discard
 * than crash on render.)
 */
export function loadDailySession(
  todayKey: string,
  rows: number,
  cols: number
): { grid: string[][]; timer: number; errorCount: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(dailyKey(todayKey));
    if (!raw) return null;
    const data = JSON.parse(raw) as DailySession;
    if (data.rows !== rows || data.cols !== cols) return null;
    const grid = inflate(data.letters, rows, cols);
    if (!grid) return null;
    return {
      grid,
      timer: typeof data.timer === "number" ? data.timer : 0,
      errorCount: typeof data.errorCount === "number" ? data.errorCount : 0,
    };
  } catch {
    return null;
  }
}

export function clearDailySession(todayKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(dailyKey(todayKey));
}

/* ─── Freeform session ───────────────────────────────────────────────────── */

const FREEFORM_KEY = "crossword-freeform-session";

interface FreeformSession {
  rows: number;
  cols: number;
  seed: number;
  /** Flat row-major: rows*cols chars, one of `.`, `#`, or `A`…`Z`. */
  letters: string;
  timer: number;
  errorCount: number;
  /** Array of "r,c" keys for cells the player revealed. */
  revealed: string[];
}

export function saveFreeformSession(
  rows: number,
  cols: number,
  seed: number,
  grid: string[][],
  timer: number,
  errorCount: number,
  revealed: Set<string>
): void {
  if (typeof window === "undefined") return;
  if (grid.length === 0) return;
  const data: FreeformSession = {
    rows,
    cols,
    seed,
    letters: flatten(grid),
    timer,
    errorCount,
    revealed: Array.from(revealed),
  };
  try {
    window.localStorage.setItem(FREEFORM_KEY, JSON.stringify(data));
  } catch {
    // quota / private mode — silently drop
  }
}

export function loadFreeformSession(): {
  rows: number;
  cols: number;
  seed: number;
  grid: string[][];
  timer: number;
  errorCount: number;
  revealed: Set<string>;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FREEFORM_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as FreeformSession;
    if (
      typeof data.rows !== "number" ||
      typeof data.cols !== "number" ||
      typeof data.seed !== "number" ||
      typeof data.letters !== "string" ||
      !Array.isArray(data.revealed)
    )
      return null;
    const grid = inflate(data.letters, data.rows, data.cols);
    if (!grid) return null;
    return {
      rows: data.rows,
      cols: data.cols,
      seed: data.seed,
      grid,
      timer: typeof data.timer === "number" ? data.timer : 0,
      errorCount: typeof data.errorCount === "number" ? data.errorCount : 0,
      revealed: new Set(data.revealed),
    };
  } catch {
    return null;
  }
}

export function clearFreeformSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FREEFORM_KEY);
}
