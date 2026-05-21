/**
 * Crossword grid helpers shared between the freeform game
 * (`CrosswordGame.tsx`) and the daily wrapper (`DailyCrossword.tsx`).
 *
 * The grid representation is the project-wide crossword convention:
 *   `"."` — empty white cell
 *   `"#"` — black cell
 *   `"A"`–`"Z"` — filled letter
 *
 * Kept under `src/games/crossword/` rather than `src/lib/` because the
 * sentinel conventions and `Puzzle`-shaped inputs are crossword-specific
 * — other games' grids have different empty/filled markers and don't
 * benefit from sharing here.
 */

import type { Puzzle } from "./types";

/** Build the initial all-empty grid for `puzzle` — black cells filled with
 *  the `"#"` sentinel, everything else with `"."`. Accepts both `Puzzle`
 *  and `StoredPuzzle` (which extends `Puzzle`). */
export function emptyGridFor(puzzle: Puzzle): string[][] {
  return Array.from({ length: puzzle.rows }, (_, r) =>
    Array.from({ length: puzzle.cols }, (_, c) =>
      puzzle.black[r][c] ? "#" : "."
    )
  );
}

/** True iff every white cell in `grid` matches the corresponding cell in
 *  `solution`. Black-cell positions are skipped (they're already in sync
 *  by construction). */
export function isCorrect(
  grid: string[][],
  solution: string[][]
): boolean {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (solution[r][c] === "#") continue;
      if (grid[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

/** True iff every white cell has a letter (correct or not). Used as the
 *  cheap gate before the more-expensive `isCorrect` check. */
export function isFilled(grid: string[][]): boolean {
  for (const row of grid) {
    for (const ch of row) {
      if (ch === ".") return false;
    }
  }
  return true;
}

/** True iff the player has typed at least one letter into a white cell.
 *  Drives the "lose progress?" confirmation on freeform's "New puzzle"
 *  button. Only used by the freeform game today; centralized here so a
 *  future daily-side "Start over" affordance can reuse it. */
export function gridHasProgress(grid: string[][]): boolean {
  for (const row of grid) {
    for (const ch of row) {
      if (ch !== "." && ch !== "#") return true;
    }
  }
  return false;
}
