"use client";

import { useId, useMemo } from "react";
import type { FlowPuzzle } from "@/games/flow/solver";

interface PathStepView {
  edgeIdx: number;
  forward: boolean;
}

interface FlowBoardProps {
  puzzle: FlowPuzzle;
  /** length === puzzle.edges.length */
  flow: number[];
  /** Node IDs the player has clicked so far (always starts with s). */
  selectedPath: number[];
  /** Resolved residual hops for selectedPath; same length as selectedPath - 1. */
  selectedSteps: PathStepView[];
  /** Node IDs the player may click next (highlighted with a ring). */
  candidateNodes: Set<number>;
  onNodeClick?: (id: number) => void;
  size?: number;
}

export function FlowBoard({
  puzzle,
  flow,
  selectedPath,
  selectedSteps,
  candidateNodes,
  onNodeClick,
  size = 480,
}: FlowBoardProps) {
  const idPrefix = useId();
  const arrowFwd = `${idPrefix}-arrow-fwd`;
  const arrowBack = `${idPrefix}-arrow-back`;
  const arrowSelectedFwd = `${idPrefix}-arrow-sel-fwd`;
  const arrowSelectedBack = `${idPrefix}-arrow-sel-back`;

  // Scale node/edge/text sizes with graph density. At 8 nodes everything is at
  // baseline; denser graphs shrink so labels and arrows don't crowd each other.
  const scale = Math.max(
    0.55,
    Math.min(1.1, Math.sqrt(8 / Math.max(1, puzzle.nodes.length)))
  );
  const nodeRadius = 0.038 * scale;
  const basePipeWidth = 0.011 * scale;
  const fillWidth = 0.008 * scale;
  const selectedWidth = 0.015 * scale;
  const labelFontSize = 0.026 * scale;
  const labelOffset = 0.022 * scale;
  const nodeFontSourceSink = 0.032 * scale;
  const nodeFontRegular = 0.026 * scale;
  const nodeStrokeSourceSink = 0.008 * scale;
  const nodeStrokeRegular = 0.005 * scale;
  const candidateStrokeWidth = 0.006 * scale;

  const selectedEdgeMap = useMemo(() => {
    const m = new Map<number, boolean>(); // edgeIdx → forward?
    selectedSteps.forEach((s) => m.set(s.edgeIdx, s.forward));
    return m;
  }, [selectedSteps]);

  const selectedNodeSet = useMemo(
    () => new Set(selectedPath),
    [selectedPath]
  );

  return (
    <div
      className="relative"
      style={{ width: `min(100%, ${size}px)`, aspectRatio: "1" }}
    >
      <svg
        viewBox="0 0 1 1"
        className="block h-full w-full select-none"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Flow board"
      >
        <defs>
          <marker
            id={arrowFwd}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="3.5"
            markerHeight="3.5"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-zinc-400, #9ca3af)" />
          </marker>
          <marker
            id={arrowBack}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="3.5"
            markerHeight="3.5"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-zinc-400, #9ca3af)" />
          </marker>
          <marker
            id={arrowSelectedFwd}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="3"
            markerHeight="3"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
          </marker>
          <marker
            id={arrowSelectedBack}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="3"
            markerHeight="3"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
        </defs>

        {/* Edges */}
        {puzzle.edges.map((edge, i) => {
          const a = puzzle.nodes[edge.from];
          const b = puzzle.nodes[edge.to];
          if (!a || !b) return null;

          // Shorten the line by nodeRadius at each end so the arrowhead doesn't
          // overlap the node disc.
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const trim = nodeRadius * 0.95;
          const x1 = a.x + ux * trim;
          const y1 = a.y + uy * trim;
          const x2 = b.x - ux * trim;
          const y2 = b.y - uy * trim;

          const f = flow[i] ?? 0;
          const saturated = f >= edge.cap;
          const fillFrac = edge.cap > 0 ? Math.min(1, Math.max(0, f / edge.cap)) : 0;

          // Capacity label position — offset perpendicular to the edge so it
          // doesn't sit on top of the pipe.
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const nx = -uy;
          const ny = ux;
          const labelX = midX + nx * labelOffset;
          const labelY = midY + ny * labelOffset;

          const baseColor = saturated && fillFrac >= 1
            ? "var(--color-zinc-600, #52525b)"
            : "var(--color-border, #3f3f46)";
          const fillColor = "#38bdf8"; // flow fill = cyan

          // For the inner fill bar, we render a second line on top whose length
          // is proportional to fillFrac, starting at x1,y1.
          const fillX2 = x1 + (x2 - x1) * fillFrac;
          const fillY2 = y1 + (y2 - y1) * fillFrac;

          const sel = selectedEdgeMap.get(i);
          const isSelected = sel !== undefined;

          return (
            <g key={`${idPrefix}-edge-${i}`}>
              {/* Base pipe (capacity track) */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={baseColor}
                strokeWidth={basePipeWidth}
                strokeLinecap="round"
                opacity={saturated && fillFrac >= 1 ? 0.7 : 1}
                markerEnd={`url(#${arrowFwd})`}
              />
              {/* Flow fill — grows from `from` end toward `to` end */}
              {fillFrac > 0 && (
                <line
                  x1={x1}
                  y1={y1}
                  x2={fillX2}
                  y2={fillY2}
                  stroke={fillColor}
                  strokeWidth={fillWidth}
                  strokeLinecap="round"
                  opacity={0.85}
                  pointerEvents="none"
                />
              )}
              {/* Selected-path overlay (drawn last so it sits on top) */}
              {isSelected && (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={sel ? "#38bdf8" : "#f59e0b"}
                  strokeWidth={selectedWidth}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.55}
                  pointerEvents="none"
                  markerEnd={
                    sel
                      ? `url(#${arrowSelectedFwd})`
                      : undefined
                  }
                  markerStart={
                    sel
                      ? undefined
                      : `url(#${arrowSelectedBack})`
                  }
                />
              )}
              {/* Capacity label — idle edges show capacity only; carrying flow shows f/cap */}
              {(() => {
                const labelText = f > 0 ? `${f}/${edge.cap}` : String(edge.cap);
                const charWidth = labelFontSize * 0.62;
                const padX = labelFontSize * 0.32;
                const padY = labelFontSize * 0.18;
                const boxW = labelText.length * charWidth + padX * 2;
                const boxH = labelFontSize + padY * 2;
                return (
                  <g pointerEvents="none">
                    <rect
                      x={labelX - boxW / 2}
                      y={labelY - boxH / 2}
                      width={boxW}
                      height={boxH}
                      rx={0.004 * scale}
                      fill="var(--color-background, #0a0a0a)"
                      opacity={0.85}
                    />
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={labelFontSize}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fill={
                        fillFrac >= 1
                          ? "var(--color-foreground, #ededed)"
                          : f > 0
                          ? "#38bdf8"
                          : "var(--color-muted, #a1a1aa)"
                      }
                    >
                      {labelText}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Nodes */}
        {puzzle.nodes.map((node) => {
          const isSource = node.id === puzzle.s;
          const isSink = node.id === puzzle.t;
          const isSelected = selectedNodeSet.has(node.id);
          const isCandidate = candidateNodes.has(node.id);
          const fill = isSource
            ? "#10b981"
            : isSink
            ? "#f43f5e"
            : isSelected
            ? "#38bdf8"
            : "var(--color-card, #141414)";
          const labelColor = isSource || isSink
            ? "#0a0a0a"
            : isSelected
            ? "#0a0a0a"
            : "var(--color-muted, #a1a1aa)";
          return (
            <g key={`${idPrefix}-node-${node.id}`}>
              {isCandidate && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius * 1.45}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={candidateStrokeWidth}
                  opacity={0.75}
                  pointerEvents="none"
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={nodeRadius}
                fill={fill}
                stroke="var(--color-foreground, #ededed)"
                strokeWidth={isSource || isSink ? nodeStrokeSourceSink : nodeStrokeRegular}
                style={{
                  cursor: onNodeClick ? "pointer" : "default",
                  transition: "fill 120ms ease",
                }}
                onClick={(ev) => {
                  if (!onNodeClick) return;
                  ev.stopPropagation();
                  onNodeClick(node.id);
                }}
              />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isSource || isSink ? nodeFontSourceSink : nodeFontRegular}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontWeight={isSource || isSink ? 700 : 500}
                fill={labelColor}
                pointerEvents="none"
              >
                {isSource ? "S" : isSink ? "T" : node.id}
              </text>
              {/* Larger transparent hit target */}
              <circle
                cx={node.x}
                cy={node.y}
                r={nodeRadius * 1.8}
                fill="transparent"
                style={{
                  cursor: onNodeClick ? "pointer" : "default",
                  pointerEvents: "auto",
                  touchAction: "manipulation",
                }}
                onClick={(ev) => {
                  if (!onNodeClick) return;
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
