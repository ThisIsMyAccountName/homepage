/**
 * Backtracking fill solver for the daily crossword.
 *
 * Given a grid skeleton (rows × cols + black-square mask) and a length-indexed
 * word bank, finds an assignment of words to slots such that every white cell
 * carries one letter and every across/down "slot" reads as a real word. The
 * solver is fully deterministic for a given RNG, so two callers with the same
 * seeded RNG will get the same fill.
 *
 * The bank is expected to contain only words we also have clues for — the
 * generator filters the on-disk clue bank into the length-indexed map before
 * calling in. That guarantees every filled word is cluable.
 */

import type { BlackMask, Direction } from "./types";

/** Anchor of one across/down slot in the grid. */
interface Slot {
  direction: Direction;
  row: number;
  col: number;
  length: number;
  /** Ordered list of cell coordinates this slot occupies. */
  cells: Array<{ r: number; c: number }>;
}

/** Result returned by `fillGrid` on success. */
export interface FillResult {
  /** `solution[r][c]` is an uppercase A–Z letter or `"#"` for a black cell. */
  solution: string[][];
  /** Identified slots, in the order they were enumerated (row-major). */
  slots: Slot[];
}

/**
 * Walk the grid in row-major order and collect every maximal run of white
 * cells in each row (across slot) and in each column (down slot) whose length
 * is ≥ 2. Length-1 runs would be unchecked-letter cells and should not exist
 * if the pattern came from `generate-patterns.mjs`, but we tolerate them by
 * simply not creating a slot for them.
 */
export function findSlots(rows: number, cols: number, black: BlackMask): Slot[] {
  const slots: Slot[] = [];

  // Across slots
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (black[r][c]) {
        c++;
        continue;
      }
      const start = c;
      const cells: Array<{ r: number; c: number }> = [];
      while (c < cols && !black[r][c]) {
        cells.push({ r, c });
        c++;
      }
      if (cells.length >= 2) {
        slots.push({
          direction: "across",
          row: r,
          col: start,
          length: cells.length,
          cells,
        });
      }
    }
  }

  // Down slots
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (black[r][c]) {
        r++;
        continue;
      }
      const start = r;
      const cells: Array<{ r: number; c: number }> = [];
      while (r < rows && !black[r][c]) {
        cells.push({ r, c });
        r++;
      }
      if (cells.length >= 2) {
        slots.push({
          direction: "down",
          row: start,
          col: c,
          length: cells.length,
          cells,
        });
      }
    }
  }

  return slots;
}

/** Build an empty working grid: white cells = ".", black cells = "#". */
function makeWorkingGrid(rows: number, cols: number, black: BlackMask): string[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (black[r][c] ? "#" : "."))
  );
}

/** Read the current letter pattern of a slot from the working grid. */
function readPattern(grid: string[][], slot: Slot): string {
  let out = "";
  for (const { r, c } of slot.cells) out += grid[r][c];
  return out;
}

/** Does `word` satisfy the slot's current `pattern` (dots match anything)? */
function patternMatches(pattern: string, word: string): boolean {
  if (pattern.length !== word.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (p === ".") continue;
    if (p !== word[i]) return false;
  }
  return true;
}

/**
 * Fisher–Yates with a seeded RNG. Mutates and returns the same array so the
 * caller can chain — important: we keep the slot's candidate filtering order
 * deterministic for a given seed.
 */
function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface FillOptions {
  /** Hard ceiling on word-placement attempts before bailing out. */
  stepBudget?: number;
}

/**
 * Attempt to fill every slot with a word from the bank. Returns null if the
 * grid is unsolvable within the step budget — the caller is expected to try
 * a different pattern or shape rather than retrying with the same inputs.
 *
 * Correctness note: every slot — including those whose cells happen to be
 * fully determined by the words placed in the perpendicular direction —
 * must read out to a real bank entry at the end of the search. A naïve
 * "skip if no `.` left" check (which we used to do) would happily ship
 * a grid where two valid down words intersected to spell out a non-word
 * across, because the across slot was never independently placed. The
 * solver below validates such fully-filled slots against the bank set
 * so the output is always 100% bank-backed.
 */
export function fillGrid(
  rows: number,
  cols: number,
  black: BlackMask,
  bankByLen: Record<number, string[]>,
  rng: () => number,
  options: FillOptions = {}
): FillResult | null {
  const { stepBudget = 8000 } = options;
  const grid = makeWorkingGrid(rows, cols, black);
  const slots = findSlots(rows, cols, black);
  const used = new Set<string>();

  // O(1) membership view of the bank for validating fully-filled slots
  // without an O(N) scan through `bankByLen[len]`.
  const bankSet: Record<number, Set<string>> = {};
  for (const [len, words] of Object.entries(bankByLen)) {
    bankSet[Number(len)] = new Set(words);
  }

  let steps = 0;

  function tryFill(): boolean {
    // Pick the unfilled slot with the fewest matching candidates (most-
    // constrained variable). Fully-filled slots are *not* skipped — we
    // confirm they spell a real bank word and that the word hasn't
    // already been used elsewhere; failing either is a dead end.
    let best: { slot: Slot; candidates: string[] } | null = null;

    for (const slot of slots) {
      const pattern = readPattern(grid, slot);
      if (!pattern.includes(".")) {
        // Fully filled — must be a real bank word. We don't compare
        // against `used` here because the slot we just placed will of
        // course show its word in `used`; the post-fill cross-check
        // below catches the actual "two different slots collapsed to
        // the same word" case without false-positiving on the slot
        // we're currently committing to.
        const set = bankSet[slot.length];
        if (!set || !set.has(pattern)) return false;
        continue;
      }
      const lengthBucket = bankByLen[slot.length] ?? [];
      const candidates: string[] = [];
      for (const w of lengthBucket) {
        if (used.has(w)) continue;
        if (!patternMatches(pattern, w)) continue;
        candidates.push(w);
        // Early exit if we've already beaten the previous best — no need
        // to keep counting; we want to descend on the most constrained.
        if (best && candidates.length >= best.candidates.length) break;
      }
      if (candidates.length === 0) return false; // dead end
      if (!best || candidates.length < best.candidates.length) {
        best = { slot, candidates };
        if (best.candidates.length === 1) break; // can't do better than 1
      }
    }

    if (!best) {
      // All slots are fully filled and bank-validated above. As a last
      // safety net, ensure no two slots of the same length collapsed to
      // the same word (which the per-slot loop above can't see because
      // it processes them in order without cross-checking).
      const seenByLen: Record<number, Set<string>> = {};
      for (const slot of slots) {
        const word = readPattern(grid, slot);
        const len = slot.length;
        const set = (seenByLen[len] ??= new Set());
        if (set.has(word)) return false;
        set.add(word);
      }
      return true;
    }

    const { slot, candidates } = best;
    shuffleInPlace(candidates, rng);

    for (const word of candidates) {
      if (++steps > stepBudget) return false;

      // Snapshot only the cells we're about to write so we can roll back.
      const prev: Array<{ r: number; c: number; ch: string }> = [];
      for (let i = 0; i < slot.cells.length; i++) {
        const { r, c } = slot.cells[i];
        prev.push({ r, c, ch: grid[r][c] });
        grid[r][c] = word[i];
      }
      used.add(word);

      if (tryFill()) return true;

      // Roll back
      for (const { r, c, ch } of prev) grid[r][c] = ch;
      used.delete(word);
    }
    return false;
  }

  const ok = tryFill();
  if (!ok) return null;
  return { solution: grid, slots };
}
