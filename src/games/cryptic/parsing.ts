/**
 * Pure parsers for cryptic-clue data. Runs on both server and client.
 *
 * - `parsePattern` turns the raw pattern string ("3-6", "4,5", "5,4-2")
 *   into a list of segment lengths + the separators between them.
 * - `parseClue` strips `{}` definition markers and returns the half-open
 *   ranges in the cleaned text so the UI can highlight them on demand.
 */

import type { ParsedClue, ParsedPattern } from "./types";

const PATTERN_TOKEN_RE = /(\d+)([,\- ])?/g;

export function parsePattern(raw: string): ParsedPattern {
  const segments: number[] = [];
  const separators: ("," | "-")[] = [];
  for (const match of raw.matchAll(PATTERN_TOKEN_RE)) {
    const n = parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0) segments.push(n);
    const sep = match[2];
    if (sep && segments.length > 0) {
      // Whitespace and comma both mean "word break"; only "-" means hyphen glyph.
      separators.push(sep === "-" ? "-" : ",");
    }
  }
  // Drop any trailing separator we may have buffered if the last segment failed.
  while (separators.length >= segments.length && separators.length > 0) {
    separators.pop();
  }
  return {
    segments,
    separators,
    totalLetters: segments.reduce((a, b) => a + b, 0),
  };
}

export function parseClue(raw: string): ParsedClue {
  let display = "";
  const defRanges: [number, number][] = [];
  let start = -1;
  for (const ch of raw) {
    if (ch === "{") {
      // Treat nested or unbalanced opens as resetting the current run.
      start = display.length;
      continue;
    }
    if (ch === "}") {
      if (start >= 0 && display.length > start) {
        defRanges.push([start, display.length]);
      }
      start = -1;
      continue;
    }
    display += ch;
  }
  return { display, defRanges };
}

/**
 * Strip everything but A-Z from an answer key so it can be compared
 * against player input letter-by-letter.
 */
export function compactAnswer(key: string): string {
  return key.toUpperCase().replace(/[^A-Z]/g, "");
}
