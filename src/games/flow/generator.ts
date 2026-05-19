/**
 * Flow puzzle generator. Wraps the planar generator, picks s/t as the
 * left/rightmost nodes, orients every edge by x-coordinate (yielding a DAG),
 * and rejects instances where the precomputed max flow is trivial.
 */

import { createSeededRng } from "@/lib/daily";
import { generatePlanarGraph, type Graph, type GraphNode } from "@/lib/graph";
import {
  DIFFICULTIES,
  DIFFICULTY_KEYS,
  type Difficulty,
  type DifficultyKey,
} from "./difficulty";
import {
  buildAdjacency,
  maxFlow,
  type FlowEdge,
  type FlowPuzzle,
} from "./solver";

function pickST(nodes: GraphNode[]): { s: number; t: number } {
  let s = 0;
  let t = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].x < nodes[s].x) s = i;
    if (nodes[i].x > nodes[t].x) t = i;
  }
  return { s, t };
}

function orientEdges(graph: Graph): FlowEdge[] {
  return graph.edges.map((e) => {
    const a = graph.nodes[e.a];
    const b = graph.nodes[e.b];
    const aFirst = a.x < b.x || (a.x === b.x && a.y < b.y);
    return aFirst
      ? { from: e.a, to: e.b, cap: 0 }
      : { from: e.b, to: e.a, cap: 0 };
  });
}

function isReachable(
  outIdx: number[][],
  edges: FlowEdge[],
  from: number,
  to: number
): boolean {
  const seen = new Set<number>([from]);
  const queue = [from];
  while (queue.length) {
    const v = queue.shift()!;
    if (v === to) return true;
    for (const i of outIdx[v]) {
      const nb = edges[i].to;
      if (!seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return false;
}

function buildPuzzleAttempt(
  difficulty: DifficultyKey,
  attemptSeed: number,
  rootSeed: number,
  cfg: Difficulty
): FlowPuzzle | null {
  const rng = createSeededRng(attemptSeed);
  const graph = generatePlanarGraph(rng, {
    nodeCount: cfg.nodeCount,
    density: cfg.density,
  });
  if (graph.nodes.length < 3) return null;

  const { s, t } = pickST(graph.nodes);
  if (s === t) return null;

  const edges = orientEdges(graph);
  for (const e of edges) {
    e.cap = 1 + Math.floor(rng() * cfg.capRange);
  }

  const { outIdx, inIdx } = buildAdjacency(graph.nodes.length, edges);
  if (outIdx[s].length === 0 || inIdx[t].length === 0) return null;
  if (!isReachable(outIdx, edges, s, t)) return null;

  const partial: FlowPuzzle = {
    difficulty,
    seed: rootSeed,
    nodes: graph.nodes,
    edges,
    s,
    t,
    outIdx,
    inIdx,
    maxFlow: 0,
  };
  const mf = maxFlow(partial);
  if (mf < cfg.minMaxFlow) return null;
  partial.maxFlow = mf;
  return partial;
}

export function generatePuzzle(
  difficulty: DifficultyKey,
  seed: number
): FlowPuzzle {
  const cfg = DIFFICULTIES[difficulty];
  // Try the requested seed first; if it doesn't meet the bar, mix in attempt
  // index. Result still deterministic given (difficulty, seed).
  let attemptSeed = seed;
  let last: FlowPuzzle | null = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    const p = buildPuzzleAttempt(difficulty, attemptSeed, seed, cfg);
    if (p) return p;
    last = last; // keep referenced
    attemptSeed = (attemptSeed * 0x45d9f3b + 0x9e3779b1) >>> 0;
  }
  // Fallback: relax minMaxFlow requirement and just return *something*.
  for (let attempt = 0; attempt < 25; attempt++) {
    const relaxed: Difficulty = { ...cfg, minMaxFlow: 1 };
    const p = buildPuzzleAttempt(difficulty, attemptSeed, seed, relaxed);
    if (p) return p;
    attemptSeed = (attemptSeed * 0x45d9f3b + 0x9e3779b1) >>> 0;
  }
  throw new Error("Flow generator: could not produce a valid puzzle");
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** Share-URL encoding: difficulty index + base36 seed. */
export function encodePuzzle(difficulty: DifficultyKey, seed: number): string {
  const d = DIFFICULTY_KEYS.indexOf(difficulty);
  return `${d}${seed.toString(36)}`;
}

export function decodePuzzle(
  encoded: string
): { difficulty: DifficultyKey; seed: number } | null {
  if (!encoded || encoded.length < 2) return null;
  const d = parseInt(encoded[0], 10);
  const difficulty = DIFFICULTY_KEYS[d];
  if (!difficulty) return null;
  const seed = parseInt(encoded.slice(1), 36);
  if (!Number.isFinite(seed) || seed < 0) return null;
  return { difficulty, seed };
}
