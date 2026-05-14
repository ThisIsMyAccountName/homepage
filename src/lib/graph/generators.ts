/**
 * Graph generators. Each implements GraphGenerator and is registered in
 * GENERATORS so future games can pick one by name.
 *
 * Currently:
 *   - planar: Delaunay-triangulation-based planar graph with optional thinning.
 */

import type { Graph, GraphEdge, GraphGenerator, GraphNode } from "./types";
import { chromaticNumber } from "./coloring";
import { relaxLayout } from "./layout";

// --- Point sampling -------------------------------------------------------

/**
 * Generate points in [margin, 1-margin]² with a minimum pairwise distance.
 * Falls back to plain random if min-distance can't be honored.
 */
function samplePoints(
  rng: () => number,
  count: number,
  margin = 0.1,
  minDist = 0.15
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const range = 1 - 2 * margin;
  const maxAttempts = count * 60;
  let attempts = 0;
  let d = minDist;

  while (pts.length < count && attempts < maxAttempts) {
    const cand = { x: margin + rng() * range, y: margin + rng() * range };
    let ok = true;
    for (const p of pts) {
      const dx = p.x - cand.x;
      const dy = p.y - cand.y;
      if (dx * dx + dy * dy < d * d) {
        ok = false;
        break;
      }
    }
    if (ok) pts.push(cand);
    attempts++;
    // Relax constraint progressively if we struggle to fit.
    if (attempts % (count * 10) === 0) d *= 0.85;
  }

  while (pts.length < count) {
    pts.push({ x: margin + rng() * range, y: margin + rng() * range });
  }
  return pts;
}

// --- Bowyer-Watson Delaunay triangulation ---------------------------------

interface Tri {
  a: number;
  b: number;
  c: number;
}

function circumcircleContains(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): boolean {
  const ax = a.x - p.x;
  const ay = a.y - p.y;
  const bx = b.x - p.x;
  const by = b.y - p.y;
  const cx = c.x - p.x;
  const cy = c.y - p.y;
  const det =
    (ax * ax + ay * ay) * (bx * cy - cx * by) -
    (bx * bx + by * by) * (ax * cy - cx * ay) +
    (cx * cx + cy * cy) * (ax * by - bx * ay);
  return det > 0;
}

function delaunay(points: { x: number; y: number }[]): Tri[] {
  const n = points.length;
  if (n < 3) return [];

  // Super-triangle large enough to contain all points.
  const pts = [...points, { x: -10, y: -10 }, { x: 10, y: -10 }, { x: 0, y: 10 }];
  const s1 = n;
  const s2 = n + 1;
  const s3 = n + 2;

  // Ensure CCW winding so circumcircleContains det sign is consistent.
  const orient = (a: number, b: number, c: number) => {
    const A = pts[a];
    const B = pts[b];
    const C = pts[c];
    return (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
  };
  const ccw = (a: number, b: number, c: number): Tri => {
    if (orient(a, b, c) > 0) return { a, b, c };
    return { a, b: c, c: b };
  };

  let tris: Tri[] = [ccw(s1, s2, s3)];

  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const bad: Tri[] = [];
    const good: Tri[] = [];
    for (const t of tris) {
      if (circumcircleContains(p, pts[t.a], pts[t.b], pts[t.c])) {
        bad.push(t);
      } else {
        good.push(t);
      }
    }

    // Boundary edges of the cavity (edges appearing exactly once in bad).
    const edgeCount = new Map<string, [number, number, number]>();
    const inc = (u: number, v: number) => {
      const k = u < v ? `${u}|${v}` : `${v}|${u}`;
      const existing = edgeCount.get(k);
      if (existing) existing[2]++;
      else edgeCount.set(k, [u, v, 1]);
    };
    for (const t of bad) {
      inc(t.a, t.b);
      inc(t.b, t.c);
      inc(t.c, t.a);
    }

    tris = good;
    for (const [u, v, count] of edgeCount.values()) {
      if (count === 1) tris.push(ccw(u, v, i));
    }
  }

  // Drop triangles touching super-triangle vertices.
  return tris.filter((t) => t.a < n && t.b < n && t.c < n);
}

// --- Helpers --------------------------------------------------------------

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(x: number, y: number): boolean {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return false;
    this.parent[rx] = ry;
    return true;
  }
}

function edgesFromTriangles(tris: Tri[]): GraphEdge[] {
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const add = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const k = `${lo}|${hi}`;
    if (!seen.has(k)) {
      seen.add(k);
      edges.push({ a: lo, b: hi });
    }
  };
  for (const t of tris) {
    add(t.a, t.b);
    add(t.b, t.c);
    add(t.c, t.a);
  }
  return edges;
}

/**
 * Thin out edges to a target fraction while keeping the graph connected.
 * Edges that would disconnect the graph if removed are forced to stay.
 */
function thinEdges(
  edges: GraphEdge[],
  nodeCount: number,
  density: number,
  rng: () => number
): GraphEdge[] {
  const targetCount = Math.max(
    nodeCount - 1, // need at least a spanning tree
    Math.round(edges.length * density)
  );
  if (edges.length <= targetCount) return edges;

  // Try removing edges in random order, accepting removals that don't
  // disconnect the graph.
  const order = shuffle(
    edges.map((_, i) => i),
    rng
  );
  const removed = new Set<number>();

  const isConnectedWithout = (candidate: number): boolean => {
    const uf = new UnionFind(nodeCount);
    for (let i = 0; i < edges.length; i++) {
      if (i === candidate || removed.has(i)) continue;
      uf.union(edges[i].a, edges[i].b);
    }
    const root = uf.find(0);
    for (let v = 1; v < nodeCount; v++) {
      if (uf.find(v) !== root) return false;
    }
    return true;
  };

  let remaining = edges.length;
  for (const i of order) {
    if (remaining <= targetCount) break;
    if (isConnectedWithout(i)) {
      removed.add(i);
      remaining--;
    }
  }

  return edges.filter((_, i) => !removed.has(i));
}

// --- Planar generator -----------------------------------------------------

function buildPlanar(
  rng: () => number,
  params: { nodeCount: number; density: number }
): Graph {
  const points = samplePoints(rng, params.nodeCount);
  const tris = delaunay(points);
  let edges = edgesFromTriangles(tris);
  edges = thinEdges(edges, params.nodeCount, params.density, rng);

  const nodes: GraphNode[] = points.map((p, i) => ({ id: i, x: p.x, y: p.y }));
  return relaxLayout({ nodes, edges }, { rng });
}

export const planarGenerator: GraphGenerator = {
  generate(rng, params) {
    const density = params.density ?? 1;
    const target = params.requiredChromatic;
    const maxAttempts = target ? 25 : 1;

    let best: Graph | null = null;
    let bestScore = Infinity;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const g = buildPlanar(rng, { nodeCount: params.nodeCount, density });
      if (target === undefined) return g;

      const chi = chromaticNumber(g);
      if (chi === target) return g;
      const score = Math.abs(chi - target);
      if (score < bestScore) {
        bestScore = score;
        best = g;
      }
    }
    return best ?? buildPlanar(rng, { nodeCount: params.nodeCount, density });
  },
};

export const GENERATORS: Record<string, GraphGenerator> = {
  planar: planarGenerator,
};

export function generatePlanarGraph(
  rng: () => number,
  params: { nodeCount: number; density?: number; requiredChromatic?: number }
): Graph {
  return planarGenerator.generate(rng, params);
}
