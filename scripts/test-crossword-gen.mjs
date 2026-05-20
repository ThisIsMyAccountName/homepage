#!/usr/bin/env node
/**
 * Standalone sanity check for the crossword generator. Mirrors the
 * runtime's adaptive (non-symmetric, edge-biased) pipeline closely
 * enough to verify that the committed clue bank can still produce a
 * valid puzzle for the next 30 daily seeds. Intended as a quick offline
 * gate before booting the dev server.
 *
 *   node scripts/test-crossword-gen.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "src", "games", "crossword", "data");
const patterns = JSON.parse(
  readFileSync(join(ROOT, "crossword-patterns.json"), "utf-8")
);
const bank = JSON.parse(readFileSync(join(ROOT, "crossword-clues.json"), "utf-8"));

// Must match src/games/crossword/types.ts exactly.
const SHAPE_DIMS = {
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
};
const ALL_SHAPES = Object.keys(SHAPE_DIMS);
const MIN_ENTRY_LEN = 3;

const BLACK_RANGE = {
  "4x6": [0, 2],
  "6x4": [0, 2],
  "5x5": [2, 6],
  "5x6": [2, 8],
  "6x5": [2, 8],
  "6x6": [4, 10],
  "5x7": [4, 10],
  "7x5": [4, 10],
  "6x7": [6, 14],
  "7x6": [6, 14],
  "7x7": [6, 16],
};

// Mirror of src/lib/daily.ts.
function createSeededRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function getDailySeed(date) {
  const d = date ?? new Date();
  const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Normalised, clue-presence-filtered word bank — matches the runtime
// `clueBankByUpper` / `bankByLen` build so the test never wanders into
// "placed a word with no clue" territory.
const clueBankByUpper = {};
for (const [w, c] of Object.entries(bank)) {
  if (!Array.isArray(c) || c.length === 0) continue;
  const upper = w.toUpperCase();
  const bucket = (clueBankByUpper[upper] ??= []);
  for (const cl of c) if (typeof cl === "string" && cl.length) bucket.push(cl);
}
const bankByLen = {};
for (const upper of Object.keys(clueBankByUpper)) {
  if (!/^[A-Z0-9]+$/.test(upper)) continue;
  (bankByLen[upper.length] ??= []).push(upper);
}
const bankSet = {};
for (const [len, words] of Object.entries(bankByLen)) {
  bankSet[Number(len)] = new Set(words);
}

console.log("Bank lengths available:");
for (const k of Object.keys(bankByLen).sort((a, b) => +a - +b)) {
  console.log(`  ${k}-letter: ${bankByLen[k].length}`);
}

/* --------------------------- Mask + validators --------------------------- */

function emptyMask(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}
function edgeDistance(r, c, rows, cols) {
  return Math.min(r, rows - 1 - r, c, cols - 1 - c);
}
function hasValidEntries(mask, rows, cols) {
  const check = (length, isBlack) => {
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
  for (let r = 0; r < rows; r++) if (!check(cols, (c) => mask[r][c])) return false;
  for (let c = 0; c < cols; c++) if (!check(rows, (r) => mask[r][c])) return false;
  return true;
}
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
function addRandomValidBlack(mask, rows, cols, rng) {
  const candidates = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c]) continue;
      candidates.push({ r, c, score: edgeDistance(r, c, rows, cols) + rng() * 1.5 });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  for (const { r, c } of candidates) {
    mask[r][c] = true;
    if (hasValidEntries(mask, rows, cols) && whiteIsConnected(mask, rows, cols)) return true;
    mask[r][c] = false;
  }
  return false;
}
function generateProceduralMask(rows, cols, target, rng) {
  const mask = emptyMask(rows, cols);
  for (let i = 0; i < target; i++) {
    if (!addRandomValidBlack(mask, rows, cols, rng)) break;
  }
  return mask;
}
function countBlacks(mask) {
  let n = 0;
  for (const row of mask) for (const b of row) if (b) n++;
  return n;
}

/* ------------------------------ Fill solver ------------------------------ */

function findSlots(rows, cols, black) {
  const slots = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (black[r][c]) { c++; continue; }
      const cells = [];
      while (c < cols && !black[r][c]) { cells.push({ r, c }); c++; }
      if (cells.length >= 2) slots.push({ dir: "across", cells, length: cells.length });
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (black[r][c]) { r++; continue; }
      const cells = [];
      while (r < rows && !black[r][c]) { cells.push({ r, c }); r++; }
      if (cells.length >= 2) slots.push({ dir: "down", cells, length: cells.length });
    }
  }
  return slots;
}
function fillGrid(rows, cols, black, byLen, rng, budget = 60000) {
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (black[r][c] ? "#" : "."))
  );
  const slots = findSlots(rows, cols, black);
  const used = new Set();
  let steps = 0;
  const readPat = (s) => s.cells.map(({ r, c }) => grid[r][c]).join("");
  const matches = (p, w) => {
    if (p.length !== w.length) return false;
    for (let i = 0; i < p.length; i++) if (p[i] !== "." && p[i] !== w[i]) return false;
    return true;
  };
  function recur() {
    let best = null;
    for (const s of slots) {
      const p = readPat(s);
      if (!p.includes(".")) {
        const set = bankSet[s.length];
        if (!set || !set.has(p)) return false;
        continue;
      }
      const buc = byLen[s.length] ?? [];
      const cand = [];
      for (const w of buc) {
        if (used.has(w)) continue;
        if (!matches(p, w)) continue;
        cand.push(w);
        if (best && cand.length >= best.cand.length) break;
      }
      if (cand.length === 0) return false;
      if (!best || cand.length < best.cand.length) {
        best = { slot: s, cand };
        if (cand.length === 1) break;
      }
    }
    if (!best) {
      // Cross-check: no two slots of the same length collapsed to the
      // same word via intersections.
      const seen = {};
      for (const s of slots) {
        const w = readPat(s);
        const len = s.length;
        const set = (seen[len] ??= new Set());
        if (set.has(w)) return false;
        set.add(w);
      }
      return true;
    }
    shuffle(best.cand, rng);
    for (const w of best.cand) {
      if (++steps > budget) return false;
      const prev = [];
      for (let i = 0; i < best.slot.cells.length; i++) {
        const { r, c } = best.slot.cells[i];
        prev.push({ r, c, ch: grid[r][c] });
        grid[r][c] = w[i];
      }
      used.add(w);
      if (recur()) return true;
      for (const { r, c, ch } of prev) grid[r][c] = ch;
      used.delete(w);
    }
    return false;
  }
  return recur() ? grid : null;
}

/* ------------------------------ Adaptive shape ----------------------------- */

function tryShape(shape, rng) {
  const { rows, cols } = SHAPE_DIMS[shape];
  const [lo, hi] = BLACK_RANGE[shape];
  const MAX_BLACKS = Math.floor(rows * cols * 0.45);
  const ATTEMPTS = 8;
  for (let a = 0; a < ATTEMPTS; a++) {
    const startTarget = lo + Math.floor(rng() * (hi - lo + 1));
    const mask = generateProceduralMask(rows, cols, startTarget, rng);
    for (let i = 0; i < rows * cols; i++) {
      const g = fillGrid(rows, cols, mask, bankByLen, rng);
      if (g) return { grid: g, mask, blacks: countBlacks(mask) };
      if (countBlacks(mask) >= MAX_BLACKS) break;
      if (!addRandomValidBlack(mask, rows, cols, rng)) break;
    }
  }
  // Static-pattern fallback (kept so the script still tracks the runtime).
  for (const mask of shuffle([...(patterns[shape] ?? [])], rng)) {
    const g = fillGrid(rows, cols, mask, bankByLen, rng);
    if (g) return { grid: g, mask, blacks: countBlacks(mask) };
  }
  return null;
}

// --- Test: 30 daily seeds ---
let ok = 0, fail = 0;
const start = Date.now();
for (let i = 0; i < 30; i++) {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const seed = getDailySeed(d);
  const rng = createSeededRng(seed);
  let filled = null, usedShape, blacks;
  for (const shape of shuffle([...ALL_SHAPES], rng)) {
    const r = tryShape(shape, rng);
    if (r) { filled = r.grid; usedShape = shape; blacks = r.blacks; break; }
  }
  const date = d.toISOString().slice(0, 10);
  if (filled) {
    ok++;
    if (i < 3) {
      console.log(`\n${date} (seed ${seed}, shape ${usedShape}, blacks ${blacks}):`);
      for (const row of filled) console.log("  " + row.map((c) => (c === "#" ? "█" : c)).join(" "));
    }
  } else {
    fail++;
    console.log(`\n${date}: FAILED to fill any shape`);
  }
}
const ms = Date.now() - start;
console.log(`\n→ ${ok}/30 days fillable (${fail} failures) in ${ms}ms total (${(ms / 30).toFixed(1)}ms/day avg)`);
process.exit(fail === 0 ? 0 : 1);
