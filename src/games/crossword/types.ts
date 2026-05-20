/**
 * Type definitions shared across the daily-crossword pipeline (pattern
 * generation, fill solver, runtime puzzle generator, UI components, and
 * session persistence).
 *
 * Grid model — black squares are explicit `boolean[][]` masks (true ⇒ black);
 * everything else is a filled cell. Solutions use uppercase A–Z.
 */

/** The handful of grid shapes the daily generator chooses from. */
export type ShapeKey =
  | "4x6"
  | "6x4"
  | "5x5"
  | "5x6"
  | "6x5"
  | "6x6"
  | "5x7"
  | "7x5"
  | "6x7"
  | "7x6"
  | "7x7";

export const SHAPE_DIMS: Record<ShapeKey, { rows: number; cols: number }> = {
  "4x6": { rows: 4, cols: 6 },
  "6x4": { rows: 6, cols: 4 },
  "5x5": { rows: 5, cols: 5 },
  "5x6": { rows: 5, cols: 6 },
  "6x5": { rows: 6, cols: 5 },
  "6x6": { rows: 6, cols: 6 },
  "5x7": { rows: 5, cols: 7 },
  "7x5": { rows: 7, cols: 5 },
  "6x7": { rows: 6, cols: 7 },
  "7x6": { rows: 7, cols: 6 },
  "7x7": { rows: 7, cols: 7 },
} as const;

export const ALL_SHAPES: readonly ShapeKey[] = [
  "4x6",
  "6x4",
  "5x5",
  "5x6",
  "6x5",
  "6x6",
  "5x7",
  "7x5",
  "6x7",
  "7x6",
  "7x7",
] as const;

/** Direction of a crossword entry. */
export type Direction = "across" | "down";

/**
 * A black-square mask: `mask[r][c] = true` means that cell is black.
 * Masks are 180°-rotationally symmetric by construction.
 */
export type BlackMask = boolean[][];

/**
 * One across/down entry in a puzzle (a word + its clue + where it lives).
 *
 * `cells` lists the (row, col) coordinates the entry occupies in order so the
 * UI can highlight the active word without recomputing geometry.
 */
export interface Entry {
  /** Crossword-style entry number (1, 2, 3, …). */
  number: number;
  direction: Direction;
  /** Top/left cell of the entry. */
  row: number;
  col: number;
  length: number;
  /** Uppercase answer. */
  answer: string;
  clue: string;
  /** Ordered list of cells this entry covers, head → tail. */
  cells: Array<{ row: number; col: number }>;
}

/** A fully generated daily puzzle, ready to render. */
export interface Puzzle {
  /**
   * Shape label. For the daily generator this is always one of the
   * `ShapeKey` values; the freeform game-section generator may emit any
   * `"<rows>x<cols>"` string (e.g. "3x4") so the type is widened here.
   */
  shape: string;
  rows: number;
  cols: number;
  /** Black-square mask (true ⇒ black cell). */
  black: BlackMask;
  /**
   * Solution grid in row-major order. Black cells use the sentinel `"#"`;
   * filled cells hold a single uppercase letter.
   */
  solution: string[][];
  /**
   * Per-cell crossword number, or `null` if no entry starts there.
   * Same shape as `solution`. Black cells are `null`.
   */
  numbers: Array<Array<number | null>>;
  entries: {
    across: Entry[];
    down: Entry[];
  };
}

/** Persisted clue bank shape on disk (`data/crossword-clues.json`). */
export type ClueBank = Record<string, string[]>;

/** Persisted black-square pattern library (`data/crossword-patterns.json`). */
export type PatternLibrary = Record<ShapeKey, BlackMask[]>;
