/**
 * Flow game difficulty presets.
 *
 * `nodeCount` and `density` feed the planar graph generator; `capRange`
 * controls the spread of edge capacities (capacities sample uniformly from
 * 1..capRange). `minMaxFlow` is the rejection threshold during generation:
 * we regenerate until the precomputed max flow meets this bar, so every
 * puzzle has a non-trivial answer.
 */

export type DifficultyKey = "easy" | "medium" | "hard";

export interface Difficulty {
  key: DifficultyKey;
  label: string;
  nodeCount: number;
  density: number;
  capRange: number;
  minMaxFlow: number;
}

export const DIFFICULTIES: Record<DifficultyKey, Difficulty> = {
  easy: {
    key: "easy",
    label: "Easy",
    nodeCount: 8,
    density: 0.8,
    capRange: 5,
    minMaxFlow: 2,
  },
  medium: {
    key: "medium",
    label: "Medium",
    nodeCount: 12,
    density: 0.85,
    capRange: 7,
    minMaxFlow: 3,
  },
  hard: {
    key: "hard",
    label: "Hard",
    nodeCount: 16,
    density: 0.9,
    capRange: 9,
    minMaxFlow: 4,
  },
};

export const DIFFICULTY_KEYS: DifficultyKey[] = ["easy", "medium", "hard"];
