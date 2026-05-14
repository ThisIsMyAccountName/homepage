/**
 * X Coloring puzzle generator. Thin wrapper around the planar generator,
 * with optional unique-neighbour node selection and URL share encoding.
 */

import { createSeededRng } from "@/lib/daily";
import {
  chromaticNumber,
  degrees,
  findColoring,
  generatePlanarGraph,
  type Graph,
} from "@/lib/graph";
import {
  DIFFICULTIES,
  DIFFICULTY_KEYS,
  PALETTE,
  type Difficulty,
  type DifficultyKey,
} from "./difficulty";

export interface Puzzle {
  difficulty: DifficultyKey;
  seed: number;
  graph: Graph;
  palette: string[];
  colors: number;
  /**
   * Node ids whose neighbours must all be coloured with pairwise-distinct
   * colors (the closed neighbourhood is rainbow-coloured). Always empty for
   * easy/medium puzzles; populated on hard.
   */
  uniqueNeighbourNodes: number[];
  /** Pre-colored locked nodes: node id → color index. Player cannot recolor these. */
  givens: Record<number, number>;
  /** Non-adjacent node pairs that must not share a color (shown as dashed edges). */
  forbiddenPairs: { a: number; b: number }[];
  /** When true, the palette size is maximized and the player must find the minimum coloring. */
  chromaticMode: boolean;
  /** Only set when chromaticMode is true — the actual minimum colors needed. */
  chromaticNumber?: number;
}

/**
 * Derive a count in [0, max] from the seed without consuming the puzzle RNG.
 * `slot` differentiates multiple calls (givens vs forbiddenPairs).
 */
function seedDerivedCount(seed: number, slot: number, max: number): number {
  if (max <= 0) return 0;
  let h = (seed ^ (slot * 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h % (max + 1);
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick `count` nodes as givens from a known-valid coloring. */
function pickGivens(
  graph: Graph,
  validColoring: number[],
  count: number,
  rng: () => number
): Record<number, number> {
  if (count <= 0) return {};
  const ids = shuffle(graph.nodes.map((n) => n.id), rng);
  const givens: Record<number, number> = {};
  for (const id of ids.slice(0, count)) {
    givens[id] = validColoring[id];
  }
  return givens;
}

/**
 * Pick up to `target` non-adjacent node pairs as forbidden pairs. Only selects
 * pairs for which the puzzle remains solvable under all existing constraints.
 */
function pickForbiddenPairs(
  graph: Graph,
  colors: number,
  uniqueNodes: ReadonlySet<number>,
  target: number,
  rng: () => number
): { a: number; b: number }[] {
  if (target <= 0) return [];

  const adjSet = new Set<string>();
  for (const e of graph.edges) {
    adjSet.add(`${Math.min(e.a, e.b)},${Math.max(e.a, e.b)}`);
  }

  const candidates: { a: number; b: number }[] = [];
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      if (!adjSet.has(`${i},${j}`)) candidates.push({ a: i, b: j });
    }
  }

  const shuffled = shuffle(candidates, rng);
  const selected: { a: number; b: number }[] = [];

  for (const pair of shuffled) {
    if (selected.length >= target) break;
    const trial = [...selected, pair];
    if (findColoring(graph, colors, { uniqueNodes, forbiddenPairs: trial })) {
      selected.push(pair);
    }
  }

  return selected;
}

/**
 * Pick up to `target` nodes to mark as unique-neighbour. Only considers
 * candidates whose degree fits (degree + 1 <= colors) and for which the
 * resulting puzzle remains solvable.
 */
function pickUniqueNeighbourNodes(
  graph: Graph,
  colors: number,
  target: number,
  rng: () => number
): number[] {
  if (target <= 0) return [];

  const degs = degrees(graph);
  // Degree ≥ 2 to make the constraint meaningful; degree + 1 ≤ colors so the
  // closed neighbourhood can actually be coloured.
  const candidates = graph.nodes
    .map((n) => n.id)
    .filter((id) => degs[id] >= 2 && degs[id] + 1 <= colors);

  const shuffled = shuffle(candidates, rng);
  const selected: number[] = [];

  for (const id of shuffled) {
    if (selected.length >= target) break;
    const trial = new Set<number>([...selected, id]);
    if (findColoring(graph, colors, { uniqueNodes: trial })) {
      selected.push(id);
    }
  }

  return selected;
}

export function generatePuzzle(
  difficulty: DifficultyKey,
  seed: number
): Puzzle {
  const cfg: Difficulty = DIFFICULTIES[difficulty];
  const rng = createSeededRng(seed);
  const graph = generatePlanarGraph(rng, {
    nodeCount: cfg.nodeCount,
    density: cfg.density,
    // Chromatic mode lets the chromatic number vary freely — that's the puzzle.
    requiredChromatic: cfg.chromaticMode ? undefined : cfg.colors,
  });
  const uniqueNeighbourNodes = pickUniqueNeighbourNodes(
    graph,
    cfg.colors,
    cfg.uniqueNeighbourCount ?? 0,
    rng
  );
  const uniqueNodeSet = new Set(uniqueNeighbourNodes);

  const fpMax = cfg.variableCounts
    ? seedDerivedCount(seed, 1, cfg.forbiddenPairCount ?? 0)
    : (cfg.forbiddenPairCount ?? 0);
  const forbiddenPairs = pickForbiddenPairs(graph, cfg.colors, uniqueNodeSet, fpMax, rng);

  const givensMax = cfg.variableCounts
    ? seedDerivedCount(seed, 0, cfg.givensCount ?? 0)
    : (cfg.givensCount ?? 0);
  const givens: Record<number, number> = {};
  if (givensMax > 0) {
    const coloring = findColoring(graph, cfg.colors, {
      uniqueNodes: uniqueNodeSet,
      forbiddenPairs,
    });
    if (coloring) Object.assign(givens, pickGivens(graph, coloring, givensMax, rng));
  }

  const chromNum = cfg.chromaticMode
    ? chromaticNumber(graph, PALETTE.length)
    : undefined;

  return {
    difficulty,
    seed,
    graph,
    palette: PALETTE.slice(0, cfg.colors),
    colors: cfg.colors,
    uniqueNeighbourNodes,
    givens,
    forbiddenPairs,
    chromaticMode: cfg.chromaticMode ?? false,
    chromaticNumber: chromNum,
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * Compact share-url encoding: difficulty index + base36 seed. The
 * unique-neighbour node list is derived deterministically from
 * `(difficulty, seed)` so it doesn't need to be encoded separately.
 */
export function encodePuzzle(difficulty: DifficultyKey, seed: number): string {
  const d = DIFFICULTY_KEYS.indexOf(difficulty);
  return `${d}${seed.toString(36)}`;
}

export function decodePuzzle(
  encoded: string
): { difficulty: DifficultyKey; seed: number } | null {
  if (!encoded || encoded.length < 2) return null;
  const dChar = encoded[0];
  const d = parseInt(dChar, 10);
  const difficulty = DIFFICULTY_KEYS[d];
  if (!difficulty) return null;
  const seed = parseInt(encoded.slice(1), 36);
  if (!Number.isFinite(seed) || seed < 0) return null;
  return { difficulty, seed };
}
