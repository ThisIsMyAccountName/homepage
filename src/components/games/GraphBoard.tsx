"use client";

import { useId, useState, useMemo } from "react";
import type { Graph } from "@/lib/graph";

interface GraphBoardProps {
  graph: Graph;
  /** node id (matches GraphNode.id) → color index into `palette`. null = uncolored. */
  nodeColors?: (number | null)[];
  /** CSS color strings indexed by color. */
  palette: string[];
  selectedNode?: number | null;
  /** Edge indices (into graph.edges) to render as conflicts. */
  conflicts?: Set<number>;
  /** Non-adjacent node pairs that must not share a color — rendered as dashed arcs. */
  forbiddenPairs?: { a: number; b: number }[];
  /** Indices into forbiddenPairs that are currently violated — rendered in red. */
  forbiddenPairViolators?: Set<number>;
  /** Node ids that are fixed/given and shouldn't accept clicks. */
  givenNodes?: Set<number>;
  /**
   * Node ids that carry the "unique-neighbour" constraint. Rendered with an
   * inner ring marker to signal the rule visually.
   */
  uniqueNodes?: Set<number>;
  /**
   * Subset of `uniqueNodes` that are currently violating their constraint.
   * Rendered with a red marker so the player can find them.
   */
  uniqueViolators?: Set<number>;
  onNodeClick?: (id: number) => void;
  /** Max pixel size (square). The component scales down responsively. */
  size?: number;
  /** Optional override for node radius in viewBox units (default 0.04). */
  nodeRadius?: number;
}

export function GraphBoard({
  graph,
  nodeColors,
  palette,
  selectedNode = null,
  conflicts,
  forbiddenPairs,
  forbiddenPairViolators,
  givenNodes,
  uniqueNodes,
  uniqueViolators,
  onNodeClick,
  size = 480,
  nodeRadius = 0.04,
}: GraphBoardProps) {
  const idPrefix = useId();
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const hoveredEdges = useMemo(() => {
    if (hoveredNode === null) return null;
    const s = new Set<number>();
    graph.edges.forEach((e, i) => {
      if (e.a === hoveredNode || e.b === hoveredNode) s.add(i);
    });
    return s;
  }, [hoveredNode, graph.edges]);

  return (
    <div
      className="relative"
      style={{ width: `min(100%, ${size}px)`, aspectRatio: "1" }}
    >
      <svg
        viewBox="0 0 1 1"
        className="block h-full w-full select-none"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Graph board"
      >
        {/* Edges — straight lines, nodes render on top */}
        {graph.edges.map((e, i) => {
          const a = graph.nodes[e.a];
          const b = graph.nodes[e.b];
          if (!a || !b) return null;
          const isConflict = conflicts?.has(i) ?? false;
          return (
            <line
              key={`${idPrefix}-edge-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={isConflict ? "var(--color-red-500, #ef4444)" : "var(--color-border, #27272a)"}
              strokeWidth={isConflict ? 0.012 : 0.006}
              strokeLinecap="round"
            />
          );
        })}

        {/* Forbidden pair arcs — rendered above regular edges */}
        {forbiddenPairs?.map((fp, i) => {
          const a = graph.nodes[fp.a];
          const b = graph.nodes[fp.b];
          if (!a || !b) return null;
          const isViolated = forbiddenPairViolators?.has(i) ?? false;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const bow = Math.min(len * 0.4, 0.12);
          const cx = (a.x + b.x) / 2 + (-dy / len) * bow;
          const cy = (a.y + b.y) / 2 + (dx / len) * bow;
          return (
            <path
              key={`${idPrefix}-fp-${i}`}
              d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
              fill="none"
              stroke={isViolated ? "var(--color-red-500, #ef4444)" : "var(--color-amber-500, #f59e0b)"}
              strokeWidth={0.005}
              strokeDasharray="0.02 0.013"
              strokeLinecap="round"
              opacity={0.75}
              pointerEvents="none"
            />
          );
        })}

        {/* Hover highlight — re-render hovered node's edges on top in accent colour */}
        {hoveredEdges && graph.edges.map((e, i) => {
          if (!hoveredEdges.has(i)) return null;
          const a = graph.nodes[e.a];
          const b = graph.nodes[e.b];
          if (!a || !b) return null;
          const isConflict = conflicts?.has(i) ?? false;
          return (
            <line
              key={`${idPrefix}-hover-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={isConflict ? "var(--color-red-500, #ef4444)" : "var(--color-accent, #10b981)"}
              strokeWidth={0.01}
              strokeLinecap="round"
              pointerEvents="none"
            />
          );
        })}

        {graph.nodes.map((node) => {
          const colorIdx = nodeColors?.[node.id] ?? null;
          const isSelected = selectedNode === node.id;
          const fill =
            colorIdx !== null && colorIdx !== undefined && palette[colorIdx]
              ? palette[colorIdx]
              : isSelected
              ? "#6b7280"
              : "var(--color-card, #141414)";
          const isGiven = givenNodes?.has(node.id) ?? false;
          const isUnique = uniqueNodes?.has(node.id) ?? false;
          const isUniqueBroken = uniqueViolators?.has(node.id) ?? false;
          const stroke = "var(--color-foreground, #ededed)";
          const strokeWidth = isGiven ? 0.01 : 0.006;
          return (
            <g key={`${idPrefix}-node-${node.id}`}>
              <circle
                cx={node.x}
                cy={node.y}
                r={nodeRadius}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                style={{
                  cursor: onNodeClick && !isGiven ? "pointer" : "default",
                  transition: "fill 120ms ease",
                }}
                onClick={(ev) => {
                  if (!onNodeClick || isGiven) return;
                  ev.stopPropagation();
                  onNodeClick(node.id);
                }}
              />
              {isUnique && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius * 0.55}
                  fill="none"
                  stroke={
                    isUniqueBroken
                      ? "var(--color-red-500, #ef4444)"
                      : "var(--color-foreground, #ededed)"
                  }
                  strokeWidth={isUniqueBroken ? 0.01 : 0.008}
                  pointerEvents="none"
                />
              )}
              {/* Slightly larger transparent hit target — also handles hover tracking */}
              <circle
                cx={node.x}
                cy={node.y}
                r={nodeRadius * 1.8}
                fill="transparent"
                style={{
                  cursor: onNodeClick && !isGiven ? "pointer" : "default",
                  pointerEvents: "auto",
                  touchAction: "manipulation",
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={(ev) => {
                  if (!onNodeClick || isGiven) return;
                  ev.stopPropagation();
                  onNodeClick(node.id);
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
