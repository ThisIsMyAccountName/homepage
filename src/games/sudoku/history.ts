/**
 * Completed puzzles log stored in localStorage.
 */

export interface CompletedPuzzle {
  id: string;
  size: number;
  time: number; // seconds
  date: string; // ISO string
  puzzleEncoded?: string; // encoded puzzle for sharing
}

const STORAGE_KEY = "sudoku-completed";

export function getCompletedPuzzles(): CompletedPuzzle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CompletedPuzzle[];
  } catch {
    return [];
  }
}

export function logCompletion(entry: CompletedPuzzle): void {
  if (typeof window === "undefined") return;
  const list = getCompletedPuzzles();
  list.unshift(entry); // newest first
  // Keep max 100 entries
  if (list.length > 100) list.length = 100;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearCompletedPuzzles(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
