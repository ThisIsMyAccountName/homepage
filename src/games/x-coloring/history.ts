/**
 * Completed X Coloring puzzles log.
 */

import type { DifficultyKey } from "./difficulty";

export interface CompletedPuzzle {
  id: string;
  difficulty: DifficultyKey;
  time: number;
  date: string;
  errors: number;
  encoded?: string;
}

const STORAGE_KEY = "xcoloring-completed";

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
  list.unshift(entry);
  if (list.length > 100) list.length = 100;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearCompletedPuzzles(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
