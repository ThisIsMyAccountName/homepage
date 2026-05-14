export interface CompletedNonogram {
  id: string;
  rows: number;
  cols: number;
  time: number;
  errors: number;
  date: string; // ISO string
  puzzleDate?: string; // YYYY-MM-DD for daily puzzles
}

const STORAGE_KEY = "nonogram-completed";

export function getCompletedNonograms(): CompletedNonogram[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CompletedNonogram[];
  } catch {
    return [];
  }
}

export function logCompletion(entry: CompletedNonogram): void {
  if (typeof window === "undefined") return;
  const list = getCompletedNonograms();
  list.unshift(entry);
  if (list.length > 100) list.length = 100;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearCompletedNonograms(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
