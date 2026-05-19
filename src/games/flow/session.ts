/**
 * In-progress Flow sessions persisted to localStorage. Only the per-edge flow
 * vector and the push history are stored — the puzzle itself is regenerated
 * deterministically from (difficulty, seed).
 */

import type { DifficultyKey } from "./difficulty";
import type { PathStep } from "./solver";

const REGULAR_KEY = "flow-session";

export interface PushRecord {
  nodes: number[];
  steps: PathStep[];
  amount: number;
}

export interface RegularSession {
  difficulty: DifficultyKey;
  seed: number;
  flow: number[];
  pushes: PushRecord[];
  timer: number;
}

export function saveRegularSession(data: RegularSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REGULAR_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadRegularSession(): RegularSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REGULAR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RegularSession;
    if (!data || !Array.isArray(data.flow) || !Array.isArray(data.pushes)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearRegularSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REGULAR_KEY);
}
