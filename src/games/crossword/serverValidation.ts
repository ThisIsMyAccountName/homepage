/**
 * Server-side puzzle validation. Used by `/api/crossword/upvote` and
 * `/api/crossword/downvote` to vet inline (freeform) puzzles before they
 * land in the approved or flagged file. Lives under `src/games/crossword/`
 * because it depends on crossword types and the deterministic puzzle-id
 * hash; importing it from a route handler is fine — `storedPuzzle` and
 * `types` are pure modules with no React or DOM deps.
 */

import { computePuzzleId, type StoredPuzzle } from "./storedPuzzle";
import type { Puzzle } from "./types";

/**
 * Sanity-check an inline (freeform) puzzle: every required field is the
 * right shape, dimensions agree, and the recomputed id matches the
 * claimed `puzzleId`. Returns `null` on any mismatch so the caller can
 * 404 rather than poisoning the approved pool / flagged log with a
 * fabricated entry.
 */
export function verifyInlinePuzzle(
  candidate: Puzzle,
  claimedId: string
): StoredPuzzle | null {
  if (
    !candidate ||
    typeof candidate.rows !== "number" ||
    typeof candidate.cols !== "number" ||
    typeof candidate.shape !== "string" ||
    !Array.isArray(candidate.solution) ||
    !Array.isArray(candidate.black) ||
    !Array.isArray(candidate.numbers) ||
    !candidate.entries ||
    !Array.isArray(candidate.entries.across) ||
    !Array.isArray(candidate.entries.down)
  ) {
    return null;
  }
  const { rows, cols, solution, black } = candidate;
  if (
    solution.length !== rows ||
    black.length !== rows ||
    solution.some((row) => !Array.isArray(row) || row.length !== cols) ||
    black.some((row) => !Array.isArray(row) || row.length !== cols)
  ) {
    return null;
  }
  const recomputed = computePuzzleId(rows, cols, solution, black);
  if (recomputed !== claimedId) return null;
  return { ...candidate, id: claimedId };
}
