/**
 * Shared types for the Cryptic game — used by both server (API routes,
 * pool loader) and client (board, daily wrapper, history).
 */

/** Raw record from `src/games/cryptic/data/cryptic-clues.json`. The object is keyed by answer. */
export interface RawClueValue {
  clue: string;
  pattern: string;
  wordplay: string;
}

/** Normalized entry that lives in the in-memory pool. */
export interface CrypticEntry {
  /** Answer key as it appears in the dataset, e.g. "TOP SECRET". */
  key: string;
  /** Letters only, uppercase. Used for comparing player input. */
  compact: string;
  clue: string;
  pattern: string;
  wordplay: string;
}

/** Shape returned by `/api/cryptic/daily` and `/api/cryptic/random`. */
export interface CrypticResponse {
  id: string;
  clue: string;
  pattern: string;
  wordplay: string;
  answer: string;
}

export interface ParsedPattern {
  /** Letter counts per segment. */
  segments: number[];
  /** Length is `segments.length - 1`. "," = visible space, "-" = hyphen glyph. */
  separators: ("," | "-")[];
  totalLetters: number;
}

export interface ParsedClue {
  /** Clue text with `{}` markers stripped. */
  display: string;
  /** Half-open ranges in `display` coordinates that should be highlighted as the definition. */
  defRanges: [number, number][];
}
