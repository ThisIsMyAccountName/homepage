/**
 * Completed-crossword log stored in localStorage. Mirrors the per-game
 * `history.ts` convention used by sudoku, nonogram, x-coloring, and flow
 * — crossword was the lone game without one. Both the freeform game and
 * the daily wrapper log here on win so a future "history" tab can show
 * solved puzzles uniformly across all five games.
 *
 * Storage key: `"crossword-completed"`.
 * The list is capped at 100 entries (newest first), same policy as the
 * other history modules.
 */

export interface CompletedCrossword {
  /** Stable puzzle id (16-hex FNV) — same value used by the vote routes. */
  id: string;
  rows: number;
  cols: number;
  /** Shape tag (e.g. "5x5", "7x7"). Mirrors `Puzzle.shape`. */
  shape: string;
  /** Solve time in seconds. */
  time: number;
  /** ISO timestamp captured at completion. */
  date: string;
  /** YYYY-MM-DD daily key when the win came from the daily wrapper;
   *  absent for freeform games. */
  puzzleDate?: string;
}

const STORAGE_KEY = "crossword-completed";

export function getCompletedCrosswords(): CompletedCrossword[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CompletedCrossword[];
  } catch {
    return [];
  }
}

export function logCompletion(entry: CompletedCrossword): void {
  if (typeof window === "undefined") return;
  const list = getCompletedCrosswords();
  list.unshift(entry);
  if (list.length > 100) list.length = 100;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearCompletedCrosswords(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
