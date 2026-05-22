/**
 * In-progress daily Cryptic session, persisted to localStorage so the
 * player can resume after a refresh. Mirrors the API of
 * `src/games/sudoku/session.ts` so the pattern is greppable.
 */

const DAILY_KEY_PREFIX = "cryptic-daily-session-";

export interface CrypticDailySession {
  /** Answer key the session was started against. Sessions for a different
   *  clue (e.g. day rolled over locally) are ignored. */
  clueId: string;
  /** One letter per cell; empty string for blanks. */
  cells: string[];
  /** Indices of cells revealed by the "reveal letter" hint. */
  revealed: number[];
  /** Whether the definition has been revealed. */
  defRevealed: boolean;
  timer: number;
  errorCount: number;
}

function dailyKey(todayKey: string): string {
  return `${DAILY_KEY_PREFIX}${todayKey}`;
}

export function saveDailySession(todayKey: string, data: CrypticDailySession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(dailyKey(todayKey), JSON.stringify(data));
  } catch {
    // quota / private-mode — ignore
  }
}

export function loadDailySession(
  todayKey: string,
  expectedClueId: string
): CrypticDailySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(dailyKey(todayKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CrypticDailySession> | null;
    if (
      !parsed ||
      parsed.clueId !== expectedClueId ||
      !Array.isArray(parsed.cells) ||
      !Array.isArray(parsed.revealed)
    ) {
      return null;
    }
    return {
      clueId: parsed.clueId,
      cells: parsed.cells.map((c) => (typeof c === "string" ? c : "")),
      revealed: parsed.revealed.filter((n) => typeof n === "number"),
      defRevealed: parsed.defRevealed === true,
      timer: typeof parsed.timer === "number" ? parsed.timer : 0,
      errorCount: typeof parsed.errorCount === "number" ? parsed.errorCount : 0,
    };
  } catch {
    return null;
  }
}

export function clearDailySession(todayKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(dailyKey(todayKey));
}
