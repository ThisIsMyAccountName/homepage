#!/usr/bin/env node
/**
 * One-time generator for `data/crossword-patterns.json`.
 *
 * For each shape used by the daily crossword (4x6 … 6x6), enumerate every
 * 180°-rotationally-symmetric black-square mask with a sensible number of
 * black cells, validate that the resulting grid has no entry shorter than
 * three letters and a fully-connected white region, then sample up to
 * `MAX_PER_SHAPE` distinct patterns per shape.
 *
 * Pure offline — no API or runtime dependencies. Run with:
 *
 *   node scripts/generate-patterns.mjs
 *
 * Output is committed to the repo so the runtime never has to compute it.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
// Lives under src/ (not project-root /data) because /data is .gitignored —
// generated patterns ship with the bundle.
const OUT_FILE = join(
  REPO_ROOT,
  "src",
  "games",
  "crossword",
  "data",
  "crossword-patterns.json"
);

/** Mirror of `ShapeKey` / `SHAPE_DIMS` in src/games/crossword/types.ts. */
const SHAPES = {
  "4x6": { rows: 4, cols: 6, blackRange: [0, 0] },
  "6x4": { rows: 6, cols: 4, blackRange: [0, 0] },
  "5x5": { rows: 5, cols: 5, blackRange: [0, 4] },
  "5x6": { rows: 5, cols: 6, blackRange: [0, 4] },
  "6x5": { rows: 6, cols: 5, blackRange: [0, 4] },
  "6x6": { rows: 6, cols: 6, blackRange: [2, 8] },
};

const MIN_ENTRY_LEN = 3;
const MAX_PER_SHAPE = 50;

/**
 * Build the list of pair-representatives. A "pair" is a set of cells that
 * must all be black together to preserve 180° rotational symmetry:
 *   - usually two distinct cells (r, c) and (R-1-r, C-1-c)
 *   - on odd×odd shapes the center cell is its own pair (size 1)
 *
 * We pick the lexicographically smaller cell of each pair as the
 * representative, plus the center if applicable.
 */
function buildPairs(rows, cols) {
  const seen = new Set();
  const pairs = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      if (seen.has(key)) continue;
      const rr = rows - 1 - r;
      const cc = cols - 1 - c;
      const mirrorKey = `${rr},${cc}`;
      if (mirrorKey === key) {
        // Center cell on odd×odd grids — a singleton pair.
        pairs.push({ size: 1, cells: [[r, c]] });
        seen.add(key);
      } else {
        pairs.push({ size: 2, cells: [[r, c], [rr, cc]] });
        seen.add(key);
        seen.add(mirrorKey);
      }
    }
  }
  return pairs;
}

/** Apply a chosen subset of pairs to produce a boolean mask. */
function maskFromPairs(rows, cols, pairs, chosenIdxs) {
  const mask = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (const idx of chosenIdxs) {
    for (const [r, c] of pairs[idx].cells) mask[r][c] = true;
  }
  return mask;
}

/**
 * Every row and every column, after applying the mask, must contain only
 * runs of white cells whose lengths are either 0 or ≥ MIN_ENTRY_LEN.
 *
 * (A run of length 1 or 2 means an unchecked letter / 2-letter entry, both
 * disallowed.)
 */
function hasValidEntries(mask, rows, cols) {
  const checkLine = (length, isBlack) => {
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
    if (!checkLine(cols, (c) => mask[r][c])) return false;
  }
  for (let c = 0; c < cols; c++) {
    if (!checkLine(rows, (r) => mask[r][c])) return false;
  }
  return true;
}

/** 4-connectivity flood-fill across white cells, returns true iff one component. */
function whiteIsConnected(mask, rows, cols) {
  let start = null;
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

  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [start];
  seen[start[0]][start[1]] = true;
  let reached = 0;
  while (stack.length) {
    const [r, c] = stack.pop();
    reached++;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
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
 * Generate every subset of `pairs` indices whose total black-cell count is
 * within `blackRange` (inclusive). Yields arrays of indices.
 */
function* eligibleSubsets(pairs, blackRange) {
  const [lo, hi] = blackRange;
  const sizes = pairs.map((p) => p.size);

  const cur = [];
  function* recurse(start, sum) {
    if (sum >= lo && sum <= hi) yield [...cur];
    if (sum >= hi) return;
    for (let i = start; i < pairs.length; i++) {
      if (sum + sizes[i] > hi) continue;
      cur.push(i);
      yield* recurse(i + 1, sum + sizes[i]);
      cur.pop();
    }
  }
  yield* recurse(0, 0);
}

/**
 * Reservoir-sample down to `MAX_PER_SHAPE` patterns to keep the JSON small
 * while still giving the daily generator visual variety.
 *
 * Uses a deterministic LCG seeded with the shape key so the committed file
 * is reproducible if regenerated.
 */
function sample(patterns, seedStr) {
  if (patterns.length <= MAX_PER_SHAPE) return patterns;
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
  }
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) % 1_000_000) / 1_000_000;
  };
  // Reservoir sampling
  const out = patterns.slice(0, MAX_PER_SHAPE);
  for (let i = MAX_PER_SHAPE; i < patterns.length; i++) {
    const j = Math.floor(rand() * (i + 1));
    if (j < MAX_PER_SHAPE) out[j] = patterns[i];
  }
  return out;
}

const library = {};
for (const [shape, { rows, cols, blackRange }] of Object.entries(SHAPES)) {
  const pairs = buildPairs(rows, cols);
  const valid = [];
  for (const chosen of eligibleSubsets(pairs, blackRange)) {
    const mask = maskFromPairs(rows, cols, pairs, chosen);
    if (!hasValidEntries(mask, rows, cols)) continue;
    if (!whiteIsConnected(mask, rows, cols)) continue;
    valid.push(mask);
  }
  const sampled = sample(valid, shape);
  library[shape] = sampled;
  console.log(
    `${shape}: ${valid.length} valid pattern(s) → kept ${sampled.length}`
  );
}

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(library) + "\n");
console.log(`\nWrote ${OUT_FILE}`);
