/**
 * Pure max-flow primitives for the Flow game. The graph is a DAG (edges
 * oriented by x-coordinate), but the player works on the *residual* graph,
 * so back-edges become traversable once flow > 0.
 */

import type { GraphNode } from "@/lib/graph";

export interface FlowEdge {
  from: number;
  to: number;
  cap: number;
}

export interface FlowPuzzle {
  difficulty: "easy" | "medium" | "hard";
  seed: number;
  nodes: GraphNode[];
  edges: FlowEdge[];
  s: number;
  t: number;
  /** Adjacency: nodeId → list of edge indices where edge.from === nodeId. */
  outIdx: number[][];
  /** Adjacency: nodeId → list of edge indices where edge.to === nodeId. */
  inIdx: number[][];
  maxFlow: number;
}

export interface PathStep {
  edgeIdx: number;
  forward: boolean;
}

export function buildAdjacency(
  nodeCount: number,
  edges: FlowEdge[]
): { outIdx: number[][]; inIdx: number[][] } {
  const outIdx: number[][] = Array.from({ length: nodeCount }, () => []);
  const inIdx: number[][] = Array.from({ length: nodeCount }, () => []);
  edges.forEach((e, i) => {
    outIdx[e.from].push(i);
    inIdx[e.to].push(i);
  });
  return { outIdx, inIdx };
}

export function emptyFlow(edgeCount: number): number[] {
  return new Array<number>(edgeCount).fill(0);
}

/** Forward residual capacity of an edge. */
export function residualForward(edge: FlowEdge, flow: number): number {
  return edge.cap - flow;
}

/** Backward residual capacity (i.e. how much flow can be cancelled). */
export function residualBackward(flow: number): number {
  return flow;
}

/**
 * Nodes reachable from `start` (without including start) via residual edges:
 * a forward edge if cap - flow > 0, a backward edge if flow > 0.
 */
export function residualNeighbors(
  puzzle: FlowPuzzle,
  flow: number[],
  node: number
): Array<{ to: number; edgeIdx: number; forward: boolean }> {
  const out: Array<{ to: number; edgeIdx: number; forward: boolean }> = [];
  for (const i of puzzle.outIdx[node]) {
    if (residualForward(puzzle.edges[i], flow[i]) > 0) {
      out.push({ to: puzzle.edges[i].to, edgeIdx: i, forward: true });
    }
  }
  for (const i of puzzle.inIdx[node]) {
    if (residualBackward(flow[i]) > 0) {
      out.push({ to: puzzle.edges[i].from, edgeIdx: i, forward: false });
    }
  }
  return out;
}

/** BFS on residual graph from s; returns whether t is reachable + the parent map. */
export function bfsResidual(
  puzzle: FlowPuzzle,
  flow: number[]
): {
  reachable: Set<number>;
  parent: Map<number, { prev: number; edgeIdx: number; forward: boolean }>;
} {
  const reachable = new Set<number>([puzzle.s]);
  const parent = new Map<number, { prev: number; edgeIdx: number; forward: boolean }>();
  const queue: number[] = [puzzle.s];
  while (queue.length) {
    const v = queue.shift()!;
    if (v === puzzle.t) break;
    for (const nb of residualNeighbors(puzzle, flow, v)) {
      if (reachable.has(nb.to)) continue;
      reachable.add(nb.to);
      parent.set(nb.to, { prev: v, edgeIdx: nb.edgeIdx, forward: nb.forward });
      queue.push(nb.to);
    }
  }
  return { reachable, parent };
}

/**
 * Find an augmenting path in the residual graph from s to t (BFS = shortest).
 * Returns null if none exists.
 */
export function findAugmentingPath(
  puzzle: FlowPuzzle,
  flow: number[]
): { nodes: number[]; steps: PathStep[]; bottleneck: number } | null {
  const { reachable, parent } = bfsResidual(puzzle, flow);
  if (!reachable.has(puzzle.t)) return null;

  // Reconstruct path from t back to s.
  const nodes: number[] = [puzzle.t];
  const steps: PathStep[] = [];
  let cur = puzzle.t;
  while (cur !== puzzle.s) {
    const p = parent.get(cur)!;
    nodes.push(p.prev);
    steps.push({ edgeIdx: p.edgeIdx, forward: p.forward });
    cur = p.prev;
  }
  nodes.reverse();
  steps.reverse();

  const bottleneck = stepsBottleneck(puzzle, flow, steps);
  return { nodes, steps, bottleneck };
}

function stepsBottleneck(
  puzzle: FlowPuzzle,
  flow: number[],
  steps: PathStep[]
): number {
  let min = Infinity;
  for (const s of steps) {
    const e = puzzle.edges[s.edgeIdx];
    const r = s.forward ? residualForward(e, flow[s.edgeIdx]) : residualBackward(flow[s.edgeIdx]);
    if (r < min) min = r;
  }
  return min === Infinity ? 0 : min;
}

/** Apply `amount` units along a path; forward steps +=, backward steps -=. */
export function pushPath(
  flow: number[],
  steps: PathStep[],
  amount: number
): number[] {
  const next = flow.slice();
  for (const s of steps) {
    if (s.forward) next[s.edgeIdx] += amount;
    else next[s.edgeIdx] -= amount;
  }
  return next;
}

/**
 * Validate a player-clicked node sequence: every consecutive pair must
 * correspond to a residual edge (forward or backward). Returns the steps
 * and bottleneck along the path. `ok=false` if any hop is invalid.
 */
export function isPathValid(
  puzzle: FlowPuzzle,
  flow: number[],
  nodeSeq: number[]
): { ok: boolean; steps: PathStep[]; bottleneck: number; failedAt?: number } {
  if (nodeSeq.length < 2) {
    return { ok: false, steps: [], bottleneck: 0 };
  }
  const steps: PathStep[] = [];
  for (let i = 0; i < nodeSeq.length - 1; i++) {
    const a = nodeSeq[i];
    const b = nodeSeq[i + 1];
    const hop = pickHop(puzzle, flow, a, b);
    if (!hop) {
      return { ok: false, steps, bottleneck: 0, failedAt: i };
    }
    steps.push(hop);
  }
  return { ok: true, steps, bottleneck: stepsBottleneck(puzzle, flow, steps) };
}

/**
 * Best single residual hop from `a` to `b`. Prefers a forward edge if both a
 * forward edge (a→b) and a back-edge (b→a with flow>0) exist — forward use is
 * the more common intent.
 */
function pickHop(
  puzzle: FlowPuzzle,
  flow: number[],
  a: number,
  b: number
): PathStep | null {
  // Forward edge a→b with remaining capacity?
  for (const i of puzzle.outIdx[a]) {
    if (puzzle.edges[i].to === b && residualForward(puzzle.edges[i], flow[i]) > 0) {
      return { edgeIdx: i, forward: true };
    }
  }
  // Back-edge: there is an edge b→a with current flow > 0.
  for (const i of puzzle.outIdx[b]) {
    if (puzzle.edges[i].to === a && residualBackward(flow[i]) > 0) {
      return { edgeIdx: i, forward: false };
    }
  }
  return null;
}

/** Edmonds-Karp: BFS-based Ford-Fulkerson. Returns the max flow value. */
export function maxFlow(puzzle: FlowPuzzle): number {
  let flow = emptyFlow(puzzle.edges.length);
  let total = 0;
  // Safety cap: max flow is bounded by sum of capacities out of s.
  const upperBound = puzzle.outIdx[puzzle.s].reduce(
    (sum, i) => sum + puzzle.edges[i].cap,
    0
  );
  for (let iter = 0; iter < upperBound + 1; iter++) {
    const aug = findAugmentingPath(puzzle, flow);
    if (!aug || aug.bottleneck <= 0) break;
    flow = pushPath(flow, aug.steps, aug.bottleneck);
    total += aug.bottleneck;
  }
  return total;
}

/** Current value of an s→t flow assignment = total outflow from s minus inflow. */
export function flowValue(puzzle: FlowPuzzle, flow: number[]): number {
  let out = 0;
  for (const i of puzzle.outIdx[puzzle.s]) out += flow[i];
  for (const i of puzzle.inIdx[puzzle.s]) out -= flow[i];
  return out;
}

/** Nodes that can be reached from `from` in one residual step. */
export function candidateNextNodes(
  puzzle: FlowPuzzle,
  flow: number[],
  from: number
): Set<number> {
  const set = new Set<number>();
  for (const nb of residualNeighbors(puzzle, flow, from)) set.add(nb.to);
  return set;
}
