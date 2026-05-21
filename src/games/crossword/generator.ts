/**
 * Crossword puzzle generator — now used only by the freeform `/games`
 * crossword (the daily reads from the server-stored pool built by
 * `scripts/build-crossword-pool.mjs`).
 *
 * Generation is fully procedural: black cells are placed one at a time
 * with no symmetry constraint, biased toward whichever cell sits in the
 * longest current white run (so blacks bisect the worst slots first —
 * crucial given the small clue bank). The fill solver then tries to
 * complete the grid from the length-indexed bank; if it can't, the
 * adaptive loop grows the mask by another valid black and retries.
 *
 * The previous 180°-rotationally-symmetric pattern library
 * (`crossword-patterns.json` + `scripts/generate-patterns.mjs`) was
 * removed at the same time as the daily moved to the server pool — it
 * was only ever a last-resort fallback, and the static masks biased the
 * look toward newspaper-style crosswords that the small bank couldn't
 * always fill anyway.
 */

import { createSeededRng } from "@/lib/daily";
import { fillGrid, findSlots } from "./fill";
import clueBankData from "./data/crossword-clues.json";
import {
  ALL_SHAPES,
  FREEFORM_MAX_DIM,
  FREEFORM_MIN_DIM,
  SHAPE_DIMS,
  type BlackMask,
  type ClueBank,
  type Entry,
  type Puzzle,
  type ShapeKey,
} from "./types";

// FREEFORM_MIN_DIM / FREEFORM_MAX_DIM live in `./types` so UI code can pull
// them statically without making the clue bank reachable from the daily
// bundle. Re-export here so any historical callers that imported them
// from this module keep working.
export { FREEFORM_MIN_DIM, FREEFORM_MAX_DIM };

const clueBank = clueBankData as ClueBank;

/** Minimum length of any entry. Matches `scripts/generate-patterns.mjs`. */
const MIN_ENTRY_LEN = 3;

/**
 * Uppercase-keyed view of the on-disk clue bank. Merges any case variants
 * and drops entries with no clues so a single `clueBankByUpper[ANSWER]`
 * lookup is the authoritative source for "does this answer have a clue?".
 * Both `bankByLen` (below) and `pickClue` read through this map, which
 * makes the "(N letters)" placeholder unreachable by construction.
 */
const clueBankByUpper: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [word, clues] of Object.entries(clueBank)) {
    if (!Array.isArray(clues) || clues.length === 0) continue;
    const upper = word.toUpperCase();
    let bucket = out[upper];
    if (!bucket) {
      bucket = [];
      out[upper] = bucket;
    }
    for (const clue of clues) {
      if (typeof clue === "string" && clue.length > 0) bucket.push(clue);
    }
    // If every clue string was empty / non-string, drop the empty bucket
    // so length checks below stay accurate.
    if (bucket.length === 0) delete out[upper];
  }
  return out;
})();

/**
 * Length-bucketed view of *cluable* words only. The fill solver picks
 * words from here, so every entry in a generated puzzle is guaranteed
 * to have at least one clue attached — `pickClue` becomes a total
 * function and the "(N letters)" placeholder cannot fire.
 *
 * Accepts both letter-only and letter+digit answers (e.g. `1AM`, `3DTV`,
 * `101`) so the puzzle can include the bank's number-bearing entries.
 */
const bankByLen: Record<number, string[]> = (() => {
  const out: Record<number, string[]> = {};
  for (const upper of Object.keys(clueBankByUpper)) {
    if (!/^[A-Z0-9]+$/.test(upper)) continue;
    const len = upper.length;
    if (!out[len]) out[len] = [];
    out[len].push(upper);
  }
  return out;
})();

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------------ */
/* Procedural mask generation                                         */
/* ------------------------------------------------------------------ */

function emptyMask(rows: number, cols: number): BlackMask {
  return Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
}

/**
 * Length of the current white run through `(r, c)` in whichever direction
 * (across or down) is longer. Precondition: `mask[r][c]` is white.
 *
 * Used to bias black-square placement toward cells sitting in the longest
 * uninterrupted runs — placing a black there shortens the worst-case slot
 * length first, which is exactly what a small clue bank with sparse 6+
 * letter buckets needs to stay solvable.
 */
function longestRunThrough(
  mask: BlackMask,
  rows: number,
  cols: number,
  r: number,
  c: number
): number {
  let aLen = 1;
  for (let cc = c - 1; cc >= 0 && !mask[r][cc]; cc--) aLen++;
  for (let cc = c + 1; cc < cols && !mask[r][cc]; cc++) aLen++;
  let dLen = 1;
  for (let rr = r - 1; rr >= 0 && !mask[rr][c]; rr--) dLen++;
  for (let rr = r + 1; rr < rows && !mask[rr][c]; rr++) dLen++;
  return aLen > dLen ? aLen : dLen;
}

/**
 * Returns true iff every row + column, after applying the mask, has only
 * white runs of length 0 or ≥ `MIN_ENTRY_LEN`. Catches both length-1
 * unchecked cells and length-2 runs (which the bank can't always cover).
 */
function hasValidEntries(mask: BlackMask, rows: number, cols: number): boolean {
  const check = (length: number, isBlack: (i: number) => boolean): boolean => {
    let run = 0;
    for (let i = 0; i <= length; i++) {
      const black = i === length ? true : isBlack(i);
      if (black) {
        if (run > 0 && run < MIN_ENTRY_LEN) return false;
        run = 0;
      } else {
        run++;
      }
    }
    return true;
  };
  for (let r = 0; r < rows; r++) {
    if (!check(cols, (c) => mask[r][c])) return false;
  }
  for (let c = 0; c < cols; c++) {
    if (!check(rows, (r) => mask[r][c])) return false;
  }
  return true;
}

/** 4-connectivity flood-fill across white cells. */
function whiteIsConnected(mask: BlackMask, rows: number, cols: number): boolean {
  let start: [number, number] | null = null;
  let whiteCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c]) {
        whiteCount++;
        if (!start) start = [r, c];
      }
    }
  }
  if (!start || whiteCount === 0) return false;

  const seen = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const stack: Array<[number, number]> = [start];
  seen[start[0]][start[1]] = true;
  let reached = 0;
  while (stack.length) {
    const [r, c] = stack.pop()!;
    reached++;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (seen[nr][nc] || mask[nr][nc]) continue;
      seen[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }
  return reached === whiteCount;
}

/**
 * Build one procedurally-placed black-square mask. The placement is fully
 * unconstrained by symmetry — symmetry was hindering the solver too much
 * given the small word bank. Cells are weighted by the length of the
 * longest current white run they sit in, so blacks preferentially break
 * up long uninterrupted slots first; that's what keeps a bank short on
 * 6+ letter words solvable on bigger grids.
 *
 * Each pick is validated against the same two invariants:
 *   • no resulting white run is shorter than `MIN_ENTRY_LEN`;
 *   • the white region stays one connected component.
 *
 * Stops once the running black count hits `targetBlack`; undershooting is
 * fine — the adaptive caller can grow the mask further if the fill fails.
 */
function generateProceduralMask(
  rows: number,
  cols: number,
  targetBlack: number,
  rng: () => number
): BlackMask {
  const mask = emptyMask(rows, cols);
  for (let i = 0; i < targetBlack; i++) {
    if (!addRandomValidBlack(mask, rows, cols, rng)) break;
  }
  return mask;
}

/** Count black cells in a mask. */
function countBlacks(mask: BlackMask): number {
  let n = 0;
  for (const row of mask) for (const b of row) if (b) n++;
  return n;
}

/**
 * Mutate `mask` by turning ONE white cell black, preserving the two
 * validity invariants (min entry length 3 + connected white region).
 * Returns `true` on success, `false` if no further valid placement is
 * reachable from the current state.
 *
 * The cell choice is randomised but longest-run-biased: each candidate
 * gets a score of `-longestRunThrough + rng() * 1.5` and we try cells in
 * ascending order. The 1.5-unit jitter lets cells inside runs of the
 * same length still vary in pick order between seeds, while cells in
 * the longest current run almost always get a shot first. The result is
 * that blacks bisect the worst slots rather than just framing the grid —
 * crucial when the bank is thin on 6+ letter words.
 */
function addRandomValidBlack(
  mask: BlackMask,
  rows: number,
  cols: number,
  rng: () => number
): boolean {
  const candidates: Array<{ r: number; c: number; score: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c]) continue;
      const score = -longestRunThrough(mask, rows, cols, r, c) + rng() * 1.5;
      candidates.push({ r, c, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  for (const { r, c } of candidates) {
    mask[r][c] = true;
    if (
      hasValidEntries(mask, rows, cols) &&
      whiteIsConnected(mask, rows, cols)
    ) {
      return true;
    }
    mask[r][c] = false;
  }
  return false;
}

/**
 * Necessary-condition feasibility check. For each length L that appears in
 * the mask's slot enumeration, we need at least as many distinct bank
 * entries of length L as we have slots of that length (since each slot
 * must be a unique word). If the bank can't even meet that bar, the fill
 * solver is guaranteed to fail — skip the 60k-step attempt and let the
 * adaptive loop grow the mask instead.
 *
 * This is a necessary, not sufficient, condition: even when the counts
 * line up, the intersection constraints can still kill the fill. That's
 * what the actual solver is for. The check just cheaply prunes the
 * obviously-impossible cases.
 */
function isMaskFeasible(
  rows: number,
  cols: number,
  mask: BlackMask
): boolean {
  const slots = findSlots(rows, cols, mask);
  if (slots.length === 0) return false;
  const slotsByLen: Record<number, number> = {};
  for (const s of slots) slotsByLen[s.length] = (slotsByLen[s.length] ?? 0) + 1;
  for (const [lenStr, count] of Object.entries(slotsByLen)) {
    const len = Number(lenStr);
    const have = bankByLen[len]?.length ?? 0;
    if (have < count) return false;
  }
  return true;
}

/**
 * Adaptive puzzle generator. Starts from a procedural mask at
 * `initialTarget` density, attempts a fill, and — if the fill solver
 * can't satisfy the constraints — grows the mask by one valid black
 * (pair or singleton) and retries. Continues until either:
 *
 *   • the fill succeeds and yields a fully-clued puzzle, or
 *   • the black-cell count would exceed `maxBlackRatio` of total cells, or
 *   • there are no further valid black placements available.
 *
 * This is the key trick for living with a small word bank: rather than
 * giving up on a hard mask, we add density on demand, which shortens
 * the longest slots and brings them within the bank's reach.
 */
function generateAdaptivePuzzle(
  shape: string,
  rows: number,
  cols: number,
  initialTarget: number,
  rng: () => number,
  fillBudget: number,
  maxBlackRatio = 0.55
): Puzzle | null {
  const mask = generateProceduralMask(rows, cols, initialTarget, rng);
  const maxBlacks = Math.floor(rows * cols * maxBlackRatio);
  // Safety net so we can't loop forever on truly unsolvable shapes.
  const MAX_RETRIES = rows * cols;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Cheap necessary-condition prune: don't burn the fill solver's step
    // budget on masks whose slot-length distribution the bank obviously
    // can't cover. Saves several seconds on harder shapes.
    if (isMaskFeasible(rows, cols, mask)) {
      const filled = fillGrid(rows, cols, mask, bankByLen, rng, {
        stepBudget: fillBudget,
      });
      if (filled) {
        const puzzle = buildPuzzle(shape, rows, cols, mask, filled, rng);
        if (puzzle) return puzzle;
      }
    }
    if (countBlacks(mask) >= maxBlacks) return null;
    if (!addRandomValidBlack(mask, rows, cols, rng)) return null;
  }
  return null;
}

/**
 * Per-shape preferred density of black cells, expressed as a `[min, max]`
 * inclusive cell-count window. The adaptive generator seeds the loop with
 * a target in this range; the loop then grows the mask if the fill needs
 * more room. Values are calibrated for "newspaper mini" feel.
 */
function blackTargetRange(shape: ShapeKey): [number, number] {
  switch (shape) {
    case "4x6":
    case "6x4":
      return [0, 2];
    case "5x5":
      return [2, 6];
    case "5x6":
    case "6x5":
      return [2, 8];
    case "6x6":
      return [4, 10];
    case "5x7":
    case "7x5":
      return [4, 10];
    case "6x7":
    case "7x6":
      return [6, 14];
    case "7x7":
      return [6, 16];
  }
}

/* ------------------------------------------------------------------ */
/* Puzzle assembly                                                    */
/* ------------------------------------------------------------------ */

/**
 * Crossword numbering convention: walk the grid row-major; every cell that
 * starts at least one entry (across or down) gets the next sequential
 * number. The same number is shared between the across and down entries
 * starting from that cell.
 */
function buildNumbering(
  rows: number,
  cols: number,
  slots: ReturnType<typeof fillGrid> extends { slots: infer S } | null ? S : never
): {
  numbers: Array<Array<number | null>>;
  numberAt: (r: number, c: number) => number | null;
} {
  const numbers: Array<Array<number | null>> = Array.from(
    { length: rows },
    () => Array<number | null>(cols).fill(null)
  );
  const startSet = new Set<string>();
  for (const slot of slots) {
    const { r, c } = slot.cells[0];
    startSet.add(`${r},${c}`);
  }

  let n = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (startSet.has(`${r},${c}`)) {
        numbers[r][c] = n++;
      }
    }
  }

  return {
    numbers,
    numberAt: (r, c) => numbers[r]?.[c] ?? null,
  };
}

/**
 * Pick one clue for `answer` from the bank using the seeded RNG so the
 * same day / seed always renders the same clue. The fill solver only
 * places words from `bankByLen`, which is itself filtered through
 * `clueBankByUpper` to drop clue-less entries — so the lookup below is
 * total. If we ever do hit the dead branch (only possible after a future
 * refactor breaks that invariant), `tryShape` will discard the puzzle
 * and try another mask rather than ship a placeholder string.
 */
function pickClue(answer: string, rng: () => number): string | null {
  const list = clueBankByUpper[answer];
  if (!list || list.length === 0) return null;
  return list[Math.floor(rng() * list.length)];
}

/**
 * Build a Puzzle from a fill result, or `null` if any answer turned out
 * to have no clue. Returning null (rather than shipping a placeholder)
 * lets the caller silently try a different mask — the player never sees
 * an "(N letters)" stand-in.
 */
function buildPuzzle(
  shape: string,
  rows: number,
  cols: number,
  black: BlackMask,
  filled: NonNullable<ReturnType<typeof fillGrid>>,
  rng: () => number
): Puzzle | null {
  const { numbers, numberAt } = buildNumbering(rows, cols, filled.slots);

  const across: Entry[] = [];
  const down: Entry[] = [];
  for (const slot of filled.slots) {
    const { r, c } = slot.cells[0];
    const number = numberAt(r, c);
    if (number === null) continue; // shouldn't happen
    let answer = "";
    for (const cell of slot.cells) answer += filled.solution[cell.r][cell.c];
    const clue = pickClue(answer, rng);
    // No clue available → reject the whole puzzle so `tryShape` rolls
    // a different mask. This branch should be unreachable as long as
    // `bankByLen` stays derived from `clueBankByUpper`.
    if (clue === null) return null;
    const entry: Entry = {
      number,
      direction: slot.direction,
      row: r,
      col: c,
      length: slot.length,
      answer,
      clue,
      cells: slot.cells.map(({ r: cr, c: cc }) => ({ row: cr, col: cc })),
    };
    (slot.direction === "across" ? across : down).push(entry);
  }
  across.sort((a, b) => a.number - b.number);
  down.sort((a, b) => a.number - b.number);

  return {
    shape,
    rows,
    cols,
    black,
    solution: filled.solution,
    numbers,
    entries: { across, down },
  };
}

function tryShape(shape: ShapeKey, rng: () => number): Puzzle | null {
  const { rows, cols } = SHAPE_DIMS[shape];
  const [lo, hi] = blackTargetRange(shape);

  // Adaptive attempts: each seed picks a starting density inside the
  // shape's preferred range; if the fill can't satisfy that mask the
  // adaptive loop grows it one black at a time until either the bank
  // can cope or we hit the density ceiling. Trying a few independent
  // seeds gives the search a chance to find a different starting shape
  // when one keeps backtracking on the same dead end.
  const ADAPTIVE_ATTEMPTS = 8;
  const FILL_BUDGET = 60000;
  for (let attempt = 0; attempt < ADAPTIVE_ATTEMPTS; attempt++) {
    const startTarget = lo + Math.floor(rng() * (hi - lo + 1));
    const puzzle = generateAdaptivePuzzle(
      shape,
      rows,
      cols,
      startTarget,
      rng,
      FILL_BUDGET
    );
    if (puzzle) return puzzle;
  }

  // No static-mask fallback any more — the daily uses the server-stored
  // pool (which itself runs this same procedural pipeline offline) and
  // the freeform game can simply tell the player to try different dims.
  return null;
}

/**
 * Generate today's puzzle from a numeric seed. Tries shapes in
 * seed-determined order so the player sees variety across days; falls
 * through to the next shape if no procedural mask + fill combination
 * succeeds.
 *
 * Throws if no shape yields a fillable grid — this indicates the clue
 * bank is too small or unbalanced and is the caller's cue to surface a
 * "coming soon" placeholder.
 */
export function generateCrosswordPuzzle(seed: number): Puzzle {
  const rng = createSeededRng(seed);
  const shapes = shuffle([...ALL_SHAPES], rng);
  for (const shape of shapes) {
    const puzzle = tryShape(shape, rng);
    if (puzzle) return puzzle;
  }
  throw new Error(
    "Crossword generator: no fillable shape — clue bank is empty or too small"
  );
}

/* ------------------------------------------------------------------ */
/* Freeform (game-section) generator                                  */
/* ------------------------------------------------------------------ */

/**
 * Compute a `[min, max]` black-cell window from raw grid dimensions so the
 * freeform generator can target the same "newspaper mini" density as the
 * daily generator without enumerating every (rows × cols) combination by
 * hand. Ratios are picked to roughly match `blackTargetRange()` on the
 * shapes that do have hand-tuned ranges.
 */
function blackTargetRangeForDims(rows: number, cols: number): [number, number] {
  const cells = rows * cols;
  // Lower bound stays gentle — small grids (3×3, 3×4) only support the
  // empty mask under the MIN_ENTRY_LEN=3 rule.
  const lo = Math.max(0, Math.floor(cells * 0.06) - 1);
  const hi = Math.max(lo, Math.floor(cells * 0.28));
  return [lo, hi];
}

/**
 * Generate one puzzle with caller-specified `rows × cols`. Unlike the daily
 * generator this returns `null` (rather than throwing) when no fillable
 * mask is found within budget — the game UI surfaces that as a friendly
 * "couldn't generate" message and offers a retry.
 */
export function generateCrosswordForDims(
  rows: number,
  cols: number,
  seed: number
): Puzzle | null {
  if (rows < FREEFORM_MIN_DIM || rows > FREEFORM_MAX_DIM) return null;
  if (cols < FREEFORM_MIN_DIM || cols > FREEFORM_MAX_DIM) return null;

  const rng = createSeededRng(seed);
  const [lo, hi] = blackTargetRangeForDims(rows, cols);
  const shape = `${rows}x${cols}`;

  // 15 attempts (up from 10) — each attempt is cheaper now that
  // `isMaskFeasible` short-circuits obviously-unfillable masks before they
  // hit the 60k-step solver, so we can afford to roll the dice more.
  const ADAPTIVE_ATTEMPTS = 15;
  const FILL_BUDGET = 60000;
  for (let attempt = 0; attempt < ADAPTIVE_ATTEMPTS; attempt++) {
    const startTarget = lo + Math.floor(rng() * (hi - lo + 1));
    const puzzle = generateAdaptivePuzzle(
      shape,
      rows,
      cols,
      startTarget,
      rng,
      FILL_BUDGET
    );
    if (puzzle) return puzzle;
  }

  // Try the empty mask as a last resort — important for tight grids like
  // 3×3 where almost any black square triggers a sub-3-letter run.
  const emptyBlack = Array.from({ length: rows }, () =>
    Array<boolean>(cols).fill(false)
  );
  const filled = fillGrid(rows, cols, emptyBlack, bankByLen, rng, {
    stepBudget: FILL_BUDGET,
  });
  if (filled) {
    const puzzle = buildPuzzle(shape, rows, cols, emptyBlack, filled, rng);
    if (puzzle) return puzzle;
  }

  return null;
}

/** Lightweight introspection so the UI can detect an empty bank early. */
export function clueBankSize(): number {
  return Object.keys(clueBank).length;
}
