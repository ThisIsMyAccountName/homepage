/**
 * Kamada-Kawai spring layout.
 *
 * Key idea: every pair of nodes has an ideal Euclidean distance proportional
 * to their graph-theoretic (shortest-path) distance. The energy is minimized
 * by iteratively relocating the highest-gradient node via Newton's method,
 * which produces even edge lengths and reflects graph structure visually.
 *
 * Complexity: O(n²) per outer iteration. Fine for n ≤ 25.
 */

import type { Graph } from "./types";

interface RelaxOptions {
  /** Max outer iterations (one node move each). Defaults to 200. */
  iterations?: number;
  /** Convergence threshold for gradient magnitude. Defaults to 1e-3. */
  epsilon?: number;
  /** Unused — kept for API compatibility with the previous F-R implementation. */
  rng?: () => number;
}

export function relaxLayout(graph: Graph, opts: RelaxOptions = {}): Graph {
  const { iterations = 200, epsilon = 1e-3 } = opts;
  const n = graph.nodes.length;
  if (n < 2) return graph;

  // --- 1. All-pairs shortest path via BFS -----------------------------------

  const INF = n + 1;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of graph.edges) {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }

  const spDist = Array.from({ length: n }, () => new Array<number>(n).fill(INF));
  for (let s = 0; s < n; s++) {
    spDist[s][s] = 0;
    const queue = [s];
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      for (const v of adj[u]) {
        if (spDist[s][v] === INF) {
          spDist[s][v] = spDist[s][u] + 1;
          queue.push(v);
        }
      }
    }
  }

  const dMax = Math.max(...spDist.flat().filter((d) => d < INF));
  if (dMax === 0) return graph;

  // --- 2. Spring parameters -------------------------------------------------
  // l_ij = L * dist[i][j]   — ideal Euclidean distance
  // k_ij = K / dist[i][j]²  — spring constant (weaker for distant pairs)
  const L = 1.0 / dMax;
  const K = 1.0;

  // --- 3. Initial positions from the Delaunay layout ------------------------
  const px = graph.nodes.map((p) => p.x);
  const py = graph.nodes.map((p) => p.y);

  // --- 4. Kamada-Kawai outer loop -------------------------------------------
  // Each iteration: move the node with the highest gradient to its local minimum.

  const grad = (m: number): { dEdx: number; dEdy: number } => {
    let dEdx = 0;
    let dEdy = 0;
    for (let j = 0; j < n; j++) {
      if (j === m || spDist[m][j] >= INF) continue;
      const dx = px[m] - px[j];
      const dy = py[m] - py[j];
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const lmj = L * spDist[m][j];
      const kmj = K / (spDist[m][j] * spDist[m][j]);
      const c = kmj * (1 - lmj / d);
      dEdx += c * dx;
      dEdy += c * dy;
    }
    return { dEdx, dEdy };
  };

  for (let outer = 0; outer < iterations; outer++) {
    // Find the node with the largest gradient magnitude.
    let worstNode = 0;
    let worstDelta = -1;
    for (let m = 0; m < n; m++) {
      const { dEdx, dEdy } = grad(m);
      const delta = Math.sqrt(dEdx * dEdx + dEdy * dEdy);
      if (delta > worstDelta) {
        worstDelta = delta;
        worstNode = m;
      }
    }

    if (worstDelta < epsilon) break;

    // Newton's method: move worstNode to its local energy minimum.
    const m = worstNode;
    for (let inner = 0; inner < 10; inner++) {
      let dEdx = 0, dEdy = 0;
      let d2Edx2 = 0, d2Edy2 = 0, d2Edxy = 0;

      for (let j = 0; j < n; j++) {
        if (j === m || spDist[m][j] >= INF) continue;
        const dx = px[m] - px[j];
        const dy = py[m] - py[j];
        const d2 = dx * dx + dy * dy || 1e-12;
        const d = Math.sqrt(d2);
        const d3 = d2 * d;
        const lmj = L * spDist[m][j];
        const kmj = K / (spDist[m][j] * spDist[m][j]);

        dEdx  += kmj * (1 - lmj / d) * dx;
        dEdy  += kmj * (1 - lmj / d) * dy;
        d2Edx2 += kmj * (1 - lmj * dy * dy / d3);
        d2Edy2 += kmj * (1 - lmj * dx * dx / d3);
        d2Edxy += kmj * lmj * dx * dy / d3;
      }

      const delta2 = dEdx * dEdx + dEdy * dEdy;
      if (Math.sqrt(delta2) < epsilon) break;

      // Solve 2×2 system via Cramer's rule.
      const det = d2Edx2 * d2Edy2 - d2Edxy * d2Edxy;
      if (Math.abs(det) < 1e-12) break;

      px[m] += (-dEdx * d2Edy2 + dEdy * d2Edxy) / det;
      py[m] += (-dEdy * d2Edx2 + dEdx * d2Edxy) / det;
    }
  }

  // --- 5. Normalize into [margin, 1 - margin] ------------------------------
  const margin = 0.08;
  const minX = Math.min(...px);
  const maxX = Math.max(...px);
  const minY = Math.min(...py);
  const maxY = Math.max(...py);
  const spanX = Math.max(maxX - minX, 1e-3);
  const spanY = Math.max(maxY - minY, 1e-3);
  const range = 1 - 2 * margin;

  return {
    nodes: graph.nodes.map((node, i) => ({
      id: node.id,
      x: margin + ((px[i] - minX) / spanX) * range,
      y: margin + ((py[i] - minY) / spanY) * range,
    })),
    edges: graph.edges.map((e) => ({ ...e })),
  };
}
