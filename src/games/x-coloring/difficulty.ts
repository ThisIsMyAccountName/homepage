/**
 * X Coloring difficulty presets. `colors` is both the size of the player's
 * palette AND the chromatic number of the generated graph — the puzzle is
 * exactly solvable with that many colors and no fewer.
 */

export type DifficultyKey = "easy" | "medium" | "hard" | "chromatic";

export interface Difficulty {
  key: DifficultyKey;
  label: string;
  nodeCount: number;
  density: number;
  colors: number;
  /**
   * Number of nodes to mark with the "all-unique neighbour colors" constraint.
   * A node so marked requires every one of its neighbours to receive a
   * distinct color (so the closed neighbourhood is rainbow-coloured).
   */
  uniqueNeighbourCount?: number;
  /** Maximum pre-colored locked nodes. If variableCounts, actual amount is seed-derived 0..max. */
  givensCount?: number;
  /** Maximum forbidden non-adjacent pairs. If variableCounts, actual amount is seed-derived 0..max. */
  forbiddenPairCount?: number;
  /** When true, actual givens/forbiddenPairs counts vary per seed (0 to the max). */
  variableCounts?: boolean;
  /**
   * Chromatic mode: the player is given the full palette and must discover the
   * minimum number of colors needed to solve the puzzle.
   */
  chromaticMode?: boolean;
}

export const DIFFICULTIES: Record<DifficultyKey, Difficulty> = {
  easy: {
    key: "easy",
    label: "Easy",
    nodeCount: 11,
    density: 0.7,
    colors: 4,
    givensCount: 1,
    variableCounts: true,
  },
  medium: {
    key: "medium",
    label: "Medium",
    nodeCount: 16,
    density: 0.85,
    colors: 4,
    givensCount: 2,
    forbiddenPairCount: 1,
    variableCounts: true,
  },
  hard: {
    key: "hard",
    label: "Hard",
    nodeCount: 18,
    density: 0.85,
    colors: 4,
    uniqueNeighbourCount: 3,
    givensCount: 3,
    forbiddenPairCount: 2,
  },
  chromatic: {
    key: "chromatic",
    label: "Chromatic",
    nodeCount: 14,
    density: 0.75,
    colors: 5,
    chromaticMode: true,
  },
};

export const DIFFICULTY_KEYS: DifficultyKey[] = ["easy", "medium", "hard", "chromatic"];

/** Palette used by the X Coloring board. Indexed 0..colors-1. */
export const PALETTE: string[] = [
  "#10b981", // emerald
  "#38bdf8", // sky
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#a855f7", // violet (reserve, in case future difficulties go to 5)
];
