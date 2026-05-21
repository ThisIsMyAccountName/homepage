/**
 * Shared types and helpers for the *stored* (pre-generated, server-served)
 * crossword pool. The runtime daily-crossword flow reads puzzles out of
 * `crossword-pool.json` (committed pool) and `data/crossword-approved.json`
 * (mutable upvoted pool) via the `/api/crossword/*` routes — no more
 * seeded generation on the client.
 *
 * A `StoredPuzzle` is structurally the live `Puzzle` shape plus a stable
 * `id` (so the upvote endpoint and the in-progress session can refer to
 * the same puzzle without recomputing geometry) and optional moderation
 * fields the approved file fills in.
 */

import type { Puzzle } from "./types";

export interface StoredPuzzle extends Puzzle {
  /** Stable short SHA-1 of `<rows>x<cols>|<flattened-solution>|<black-mask>`. */
  id: string;
  /** Approved file only — number of distinct-IP upvotes received. */
  upvotes?: number;
  /** Approved file only — ms-epoch of the first upvote that promoted it. */
  approvedAt?: number;
}

/**
 * Compute the stable id for a (live or stored) puzzle. Pure on `solution`
 * + `black` so it doesn't depend on entries / clues — that way an upvote
 * recorded against the bundled puzzle today still matches if we ever
 * re-pick clues from the same grid.
 *
 * Implementation note: the runtime client calls this so we can't use
 * Node's `crypto` here — we ship a tiny FNV-1a hash that yields a 16-hex
 * digest, identical in shape to the offline build script's SHA-1 slice.
 */
export function computePuzzleId(
  rows: number,
  cols: number,
  solution: string[][],
  black: boolean[][]
): string {
  let lettersFlat = "";
  for (const row of solution) lettersFlat += row.join("");
  let blackFlat = "";
  for (const row of black) for (const b of row) blackFlat += b ? "1" : "0";
  const input = `${rows}x${cols}|${lettersFlat}|${blackFlat}`;

  // Two 32-bit FNV-1a streams (different offsets) concatenated → 16 hex
  // chars. Stable, dependency-free, and good enough for "did the pool
  // pick the same puzzle as last time?" — not a security primitive.
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return (
    h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
  );
}

/** Strip approval-pool-only fields before sending to the client. */
export function publicView(p: StoredPuzzle): StoredPuzzle {
  const { upvotes: _u, approvedAt: _a, ...rest } = p;
  void _u;
  void _a;
  return rest as StoredPuzzle;
}
