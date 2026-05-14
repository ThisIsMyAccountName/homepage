/**
 * Shared graph data model. Reused across graph-theory games (coloring, paths,
 * matching, etc). Node positions live in normalized [0,1] coordinates so the
 * renderer can scale them to any board size.
 */

export interface GraphNode {
  id: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  a: number;
  b: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphGenParams {
  nodeCount: number;
  /** Fraction of triangulation edges to keep, 0..1. Default 1 = full triangulation. */
  density?: number;
  /** If set, regenerate until chromatic number === requiredChromatic (best effort). */
  requiredChromatic?: number;
}

export interface GraphGenerator {
  generate(rng: () => number, params: GraphGenParams): Graph;
}
