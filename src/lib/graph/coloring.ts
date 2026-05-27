/**
 * Graph coloring utilities. Brute-force, fine for the small graphs (N <= ~25)
 * used by puzzle generation. Larger graphs would need a smarter solver.
 *
 * Supports an optional "unique-neighbour" constraint: a node marked as such
 * requires all of its neighbours to receive *pairwise distinct* colors (the
 * closed neighbourhood is rainbow-coloured). This is the basis for the
 * X Coloring "hard" tier.
 */

import type { Graph } from "./types";

function adjacency(graph: Graph): number[][] {
  const adj: number[][] = graph.nodes.map(() => []);
  for (const e of graph.edges) {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  return adj;
}

export function degrees(graph: Graph): number[] {
  return adjacency(graph).map((a) => a.length);
}

export interface ColoringOptions {
  /** Nodes whose neighbours must all be distinctly coloured from each other. */
  uniqueNodes?: ReadonlySet<number>;
  /** Non-adjacent node pairs that must not share a color. */
  forbiddenPairs?: readonly { a: number; b: number }[];
  /** Node → color pre-assignments that the solution must respect. */
  pinned?: Readonly<Record<number, number>>;
}

/**
 * Returns one valid k-coloring (array of color indices per node) or null if
 * not k-colorable under the given constraints.
 */
export function findColoring(
  graph: Graph,
  k: number,
  opts: ColoringOptions = {}
): number[] | null {
  const n = graph.nodes.length;
  if (n === 0) return [];
  const adj = adjacency(graph);
  const colors = new Array<number>(n).fill(-1);
  const uniqueNodes = opts.uniqueNodes;
  const pinned = opts.pinned;

  // Order nodes by descending degree — fail fast on hard nodes. Unique-node
  // neighbours get a slight priority bump since their assignments are the
  // most constrained.
  const priority = (i: number) => {
    let p = adj[i].length;
    if (uniqueNodes?.has(i)) p += 5;
    for (const nb of adj[i]) if (uniqueNodes?.has(nb)) p += 1;
    return p;
  };
  const order = [...Array(n).keys()].sort((a, b) => priority(b) - priority(a));

  const isSafe = (node: number, c: number): boolean => {
    // Adjacent nodes must differ.
    for (const nb of adj[node]) {
      if (colors[nb] === c) return false;
    }
    // Forbidden pairs: non-adjacent nodes that must still differ.
    if (opts.forbiddenPairs) {
      for (const fp of opts.forbiddenPairs) {
        const other = fp.a === node ? fp.b : fp.b === node ? fp.a : -1;
        if (other !== -1 && colors[other] === c) return false;
      }
    }
    // If this node itself is a unique-neighbour node, two of its already-coloured
    // neighbours can't share a color (regardless of `c`, but we check ahead).
    if (uniqueNodes?.has(node)) {
      const seen = new Set<number>();
      for (const nb of adj[node]) {
        const cb = colors[nb];
        if (cb === -1) continue;
        if (seen.has(cb)) return false;
        seen.add(cb);
      }
    }
    // If any unique-neighbour node sees `node` as one of its neighbours,
    // we'd be picking `c` for a sibling. Must not duplicate another sibling.
    if (uniqueNodes) {
      for (const u of adj[node]) {
        if (!uniqueNodes.has(u)) continue;
        for (const sibling of adj[u]) {
          if (sibling === node) continue;
          if (colors[sibling] === c) return false;
        }
      }
    }
    return true;
  };

  const tryAssign = (i: number): boolean => {
    if (i === n) return true;
    const node = order[i];
    // Pinned nodes have a forced color — try only that one (must be in
    // range and safe; otherwise the whole branch is infeasible).
    if (pinned && Object.prototype.hasOwnProperty.call(pinned, node)) {
      const forced = pinned[node];
      if (forced < 0 || forced >= k) return false;
      if (!isSafe(node, forced)) return false;
      colors[node] = forced;
      if (tryAssign(i + 1)) return true;
      colors[node] = -1;
      return false;
    }
    for (let c = 0; c < k; c++) {
      if (!isSafe(node, c)) continue;
      colors[node] = c;
      if (tryAssign(i + 1)) return true;
      colors[node] = -1;
    }
    return false;
  };

  return tryAssign(0) ? colors : null;
}

/**
 * Minimum k for which the graph (with optional unique-node constraints) is
 * k-colorable. Returns maxK if no such k <= maxK exists.
 */
export function chromaticNumber(
  graph: Graph,
  maxK = 8,
  opts: ColoringOptions = {}
): number {
  for (let k = 1; k <= maxK; k++) {
    if (findColoring(graph, k, opts)) return k;
  }
  return maxK;
}

export interface ColoringConflicts {
  /** Edge indices (into graph.edges) where both endpoints share a color. */
  edges: Set<number>;
  /** Unique-constraint nodes whose neighbours are not all pairwise distinct. */
  uniqueViolators: Set<number>;
  /** Forbidden-pair indices (into the forbiddenPairs array) where both nodes share a color. */
  forbiddenPairViolators: Set<number>;
}

/**
 * Find all rule violations in a (possibly partial) coloring. Uncoloured
 * nodes (color === null) never participate in a violation.
 */
export function conflicts(
  graph: Graph,
  coloring: (number | null)[],
  uniqueNodes?: ReadonlySet<number>,
  forbiddenPairs?: readonly { a: number; b: number }[]
): ColoringConflicts {
  const edges = new Set<number>();
  graph.edges.forEach((e, i) => {
    const ca = coloring[e.a];
    const cb = coloring[e.b];
    if (ca !== null && cb !== null && ca === cb) edges.add(i);
  });

  const uniqueViolators = new Set<number>();
  if (uniqueNodes && uniqueNodes.size > 0) {
    const adj = adjacency(graph);
    for (const u of uniqueNodes) {
      const seen = new Set<number>();
      for (const nb of adj[u]) {
        const c = coloring[nb];
        if (c === null || c === undefined) continue;
        if (seen.has(c)) {
          uniqueViolators.add(u);
          break;
        }
        seen.add(c);
      }
    }
  }

  const forbiddenPairViolators = new Set<number>();
  if (forbiddenPairs) {
    forbiddenPairs.forEach((fp, i) => {
      const ca = coloring[fp.a];
      const cb = coloring[fp.b];
      if (ca !== null && cb !== null && ca === cb) forbiddenPairViolators.add(i);
    });
  }

  return { edges, uniqueViolators, forbiddenPairViolators };
}
