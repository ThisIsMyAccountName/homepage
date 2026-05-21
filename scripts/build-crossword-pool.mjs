#!/usr/bin/env node
/**
 * Offline pre-generator for the daily-crossword pool.
 *
 * Runs the same procedural mask + backtracking-fill pipeline used at
 * runtime, but ahead of time, and writes the results to a JSON file the
 * server reads from on every daily request. Moving the work offline
 * eliminates the multi-second hitch the player used to see when opening
 * the crossword step — `/api/crossword/daily` now just picks an entry
 * out of an array.
 *
 * Output:
 *   src/games/crossword/data/crossword-pool.json
 *
 * Run with:
 *   node scripts/build-crossword-pool.mjs [--size 100]
 *
 * The pool is committed-with-the-bundle (lives under src/) because:
 *   - it's static reference data, generated once per repo build, and
 *   - keeping it out of /data avoids the gitignored-bootstrap problem
 *     (production needs the file present at startup).
 *
 * Procedural placement is *not* symmetric — we deliberately removed the
 * 180°-rotational pattern library because it constrained the look too
 * much given how small the clue bank is. Black cells are placed one at
 * a time, biased toward the longest current white run, validated for
 * MIN_ENTRY_LEN=3 + white-connectivity, and rolled back on failure.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DATA_DIR = join(REPO_ROOT, "src", "games", "crossword", "data");
const OUT_FILE = join(DATA_DIR, "crossword-pool.json");
const CLUES_FILE = join(DATA_DIR, "crossword-clues.json");

// --- CLI args ---
const args = process.argv.slice(2);
function parseFlag(name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  const v = Number(args[idx + 1]);
  return Number.isFinite(v) ? v : fallback;
}
const TARGET_SIZE = parseFlag("--size", 100);
const RNG_BASE = parseFlag("--seed", Date.now() & 0x7fffffff);

// --- Shape & range tables (kept in sync with src/games/crossword/types.ts
//     and src/games/crossword/generator.ts) ---
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
const MIN_ENTRY_LEN = 3;
const FILL_BUDGET = 60000;
const ADAPTIVE_ATTEMPTS = 8;
const MAX_BLACK_RATIO = 0.55;

// --- Clue bank ingest (same filter as the runtime) ---
const rawBank = JSON.parse(readFileSync(CLUES_FILE, "utf-8"));
const clueBankByUpper = {};
for (const [w, c] of Object.entries(rawBank)) {
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

// --- Mulberry32 (mirror of src/lib/daily.ts) ---
function rngFrom(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Mask validators (mirror of generator.ts) ---
function emptyMask(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}
function longestRunThrough(mask, rows, cols, r, c) {
  let aLen = 1;
  for (let cc = c - 1; cc >= 0 && !mask[r][cc]; cc--) aLen++;
  for (let cc = c + 1; cc < cols && !mask[r][cc]; cc++) aLen++;
  let dLen = 1;
  for (let rr = r - 1; rr >= 0 && !mask[rr][c]; rr--) dLen++;
  for (let rr = r + 1; rr < rows && !mask[rr][c]; rr++) dLen++;
  return aLen > dLen ? aLen : dLen;
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
  for (let r = 0; r < rows; r++)
    if (!check(cols, (c) => mask[r][c])) return false;
  for (let c = 0; c < cols; c++)
    if (!check(rows, (r) => mask[r][c])) return false;
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
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
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
  const cands = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c]) continue;
      cands.push({
        r,
        c,
        score: -longestRunThrough(mask, rows, cols, r, c) + rng() * 1.5,
      });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  for (const { r, c } of cands) {
    mask[r][c] = true;
    if (hasValidEntries(mask, rows, cols) && whiteIsConnected(mask, rows, cols))
      return true;
    mask[r][c] = false;
  }
  return false;
}
function countBlacks(mask) {
  let n = 0;
  for (const row of mask) for (const b of row) if (b) n++;
  return n;
}
function generateProceduralMask(rows, cols, target, rng) {
  const mask = emptyMask(rows, cols);
  for (let i = 0; i < target; i++) {
    if (!addRandomValidBlack(mask, rows, cols, rng)) break;
  }
  return mask;
}

// --- Slot enumeration + backtracking fill ---
function findSlots(rows, cols, black) {
  const slots = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (black[r][c]) {
        c++;
        continue;
      }
      const start = c;
      const cells = [];
      while (c < cols && !black[r][c]) {
        cells.push({ r, c });
        c++;
      }
      if (cells.length >= 2)
        slots.push({
          direction: "across",
          row: r,
          col: start,
          length: cells.length,
          cells,
        });
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (black[r][c]) {
        r++;
        continue;
      }
      const start = r;
      const cells = [];
      while (r < rows && !black[r][c]) {
        cells.push({ r, c });
        r++;
      }
      if (cells.length >= 2)
        slots.push({
          direction: "down",
          row: start,
          col: c,
          length: cells.length,
          cells,
        });
    }
  }
  return slots;
}
function isMaskFeasible(rows, cols, mask) {
  const slots = findSlots(rows, cols, mask);
  if (slots.length === 0) return false;
  const bins = {};
  for (const s of slots) bins[s.length] = (bins[s.length] ?? 0) + 1;
  for (const [lenStr, count] of Object.entries(bins)) {
    const len = Number(lenStr);
    if ((bankByLen[len]?.length ?? 0) < count) return false;
  }
  return true;
}
function fillGrid(rows, cols, black, rng, stepBudget = FILL_BUDGET) {
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (black[r][c] ? "#" : "."))
  );
  const slots = findSlots(rows, cols, black);
  const used = new Set();
  let steps = 0;
  const read = (s) => s.cells.map(({ r, c }) => grid[r][c]).join("");
  const matches = (p, w) => {
    if (p.length !== w.length) return false;
    for (let i = 0; i < p.length; i++)
      if (p[i] !== "." && p[i] !== w[i]) return false;
    return true;
  };
  function recur() {
    let best = null;
    for (const s of slots) {
      const p = read(s);
      if (!p.includes(".")) {
        const set = bankSet[s.length];
        if (!set || !set.has(p)) return false;
        continue;
      }
      const buc = bankByLen[s.length] ?? [];
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
      // Reject grids where two slots of the same length collapsed to
      // identical words via their intersections.
      const seen = {};
      for (const s of slots) {
        const w = read(s);
        const set = (seen[s.length] ??= new Set());
        if (set.has(w)) return false;
        set.add(w);
      }
      return true;
    }
    shuffle(best.cand, rng);
    for (const w of best.cand) {
      if (++steps > stepBudget) return false;
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
  return recur() ? { solution: grid, slots } : null;
}

// --- Puzzle assembly (mirror of buildPuzzle in generator.ts) ---
function buildNumbering(rows, cols, slots) {
  const numbers = Array.from({ length: rows }, () => Array(cols).fill(null));
  const startSet = new Set();
  for (const s of slots) {
    const { r, c } = s.cells[0];
    startSet.add(`${r},${c}`);
  }
  let n = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (startSet.has(`${r},${c}`)) numbers[r][c] = n++;
    }
  }
  return numbers;
}
function pickClue(answer, rng) {
  const list = clueBankByUpper[answer];
  if (!list || list.length === 0) return null;
  return list[Math.floor(rng() * list.length)];
}
function buildPuzzle(shape, rows, cols, black, filled, rng) {
  const numbers = buildNumbering(rows, cols, filled.slots);
  const across = [];
  const down = [];
  for (const slot of filled.slots) {
    const { r, c } = slot.cells[0];
    const number = numbers[r][c];
    if (number === null) continue;
    let answer = "";
    for (const cell of slot.cells)
      answer += filled.solution[cell.r][cell.c];
    const clue = pickClue(answer, rng);
    if (clue === null) return null;
    (slot.direction === "across" ? across : down).push({
      number,
      direction: slot.direction,
      row: r,
      col: c,
      length: slot.length,
      answer,
      clue,
      cells: slot.cells.map(({ r: cr, c: cc }) => ({ row: cr, col: cc })),
    });
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

function generateAdaptivePuzzle(shape, rows, cols, initialTarget, rng) {
  const mask = generateProceduralMask(rows, cols, initialTarget, rng);
  const maxBlacks = Math.floor(rows * cols * MAX_BLACK_RATIO);
  for (let attempt = 0; attempt < rows * cols; attempt++) {
    if (isMaskFeasible(rows, cols, mask)) {
      const filled = fillGrid(rows, cols, mask, rng);
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
function tryShape(shape, rng) {
  const { rows, cols } = SHAPE_DIMS[shape];
  const [lo, hi] = BLACK_RANGE[shape];
  for (let attempt = 0; attempt < ADAPTIVE_ATTEMPTS; attempt++) {
    const startTarget = lo + Math.floor(rng() * (hi - lo + 1));
    const puzzle = generateAdaptivePuzzle(shape, rows, cols, startTarget, rng);
    if (puzzle) return puzzle;
  }
  return null;
}

/**
 * Stable puzzle id — must produce identical output for identical input to
 * the client-side `computePuzzleId` in src/games/crossword/storedPuzzle.ts.
 * Both use two parallel FNV-1a 32-bit streams concatenated to 16 hex chars.
 * Don't swap this for SHA-1 / crypto.* — the client can't reproduce those
 * without pulling in a hashing dependency.
 */
function puzzleId(puzzle) {
  const lettersFlat = puzzle.solution.map((row) => row.join("")).join("");
  const blackFlat = puzzle.black
    .map((row) => row.map((b) => (b ? "1" : "0")).join(""))
    .join("");
  const input = `${puzzle.rows}x${puzzle.cols}|${lettersFlat}|${blackFlat}`;
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

// --- Main loop: build TARGET_SIZE unique puzzles ---
const out = [];
const seen = new Set();
let nextSeed = RNG_BASE;
let attempts = 0;
const startedAt = Date.now();
const HARD_ATTEMPT_CAP = TARGET_SIZE * 8;

while (out.length < TARGET_SIZE && attempts < HARD_ATTEMPT_CAP) {
  attempts++;
  const rng = rngFrom(nextSeed++);
  const shapes = shuffle([...ALL_SHAPES], rng);
  let puzzle = null;
  for (const shape of shapes) {
    const p = tryShape(shape, rng);
    if (p) {
      puzzle = p;
      break;
    }
  }
  if (!puzzle) continue;
  const id = puzzleId(puzzle);
  if (seen.has(id)) continue;
  seen.add(id);
  out.push({ id, ...puzzle });
}

if (out.length < TARGET_SIZE) {
  console.warn(
    `Only produced ${out.length}/${TARGET_SIZE} puzzles in ${attempts} attempts. ` +
      "Bank may be too small for higher diversity — try again or expand the clue bank."
  );
}

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(out));
const ms = Date.now() - startedAt;
console.log(
  `Wrote ${out.length} puzzles to ${OUT_FILE} (${attempts} attempts, ${ms}ms).`
);
