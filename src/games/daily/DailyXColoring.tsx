"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getDailySeed, getTodayKey } from "@/lib/daily";
import { conflicts as computeConflicts, findColoring } from "@/lib/graph";
import { generatePuzzle } from "@/games/x-coloring/generator";
import {
  saveDailySession,
  loadDailySession,
  clearDailySession,
} from "@/games/x-coloring/session";
import { logCompletion } from "@/games/x-coloring/history";
import { GraphBoard } from "@/components/games/GraphBoard";
import { formatTime } from "@/lib/gameUtils";
import { useBoardSize, DAILY_BOARD } from "@/lib/useBoardSize";
import { PausedRules } from "@/components/games/PausedRules";
import { useAutoPause } from "@/lib/useAutoPause";

const X_COLORING_RULES = [
  "Color every node so no two nodes joined by an edge share a color.",
  "Dashed edges link nodes that must also not share a color.",
  "Ringed nodes must have all neighbours in different colors.",
];

/** Daily puzzle is always Hard so everyone faces the same full-featured puzzle. */
const DAILY_DIFFICULTY = "hard" as const;

function emptyColoring(n: number): number[] {
  return new Array<number>(n).fill(-1);
}

/** Overlay locked given nodes onto a coloring array. */
function applyGivens(
  givens: Record<number, number>,
  coloring: number[]
): number[] {
  const next = [...coloring];
  for (const [idStr, colorIdx] of Object.entries(givens)) {
    next[parseInt(idStr)] = colorIdx;
  }
  return next;
}

interface DailyXColoringProps {
  onComplete: (time: number, errors: number) => void;
  /** Revisit mode: mount with a valid coloring, won=true, no overlay. */
  alreadySolved?: boolean;
}

export function DailyXColoring({
  onComplete,
  alreadySolved = false,
}: DailyXColoringProps) {
  const todayKey = getTodayKey();
  const [puzzle] = useState(() =>
    generatePuzzle(DAILY_DIFFICULTY, getDailySeed())
  );
  const initial = alreadySolved ? null : loadDailySession(todayKey);
  // For revisit, compute a valid coloring honoring givens / uniques /
  // forbidden pairs. Falls back to givens-only if no full solution is
  // found (shouldn't happen for the daily, but keeps the UI safe).
  const solvedColoring = useMemo<number[] | null>(() => {
    if (!alreadySolved) return null;
    const uniqueSet = new Set(puzzle.uniqueNeighbourNodes);
    const found = findColoring(puzzle.graph, puzzle.colors, {
      uniqueNodes: uniqueSet,
      forbiddenPairs: puzzle.forbiddenPairs,
      pinned: puzzle.givens,
    });
    return found ?? null;
  }, [alreadySolved, puzzle]);
  const baseColoring = solvedColoring
    ? solvedColoring
    : initial?.coloring && initial.coloring.length === puzzle.graph.nodes.length
    ? initial.coloring
    : emptyColoring(puzzle.graph.nodes.length);
  // Re-apply givens defensively (session may predate the locked-node feature).
  const [coloring, setColoring] = useState<number[]>(() =>
    applyGivens(puzzle.givens, baseColoring)
  );
  const [timer, setTimer] = useState(alreadySolved ? 0 : initial?.timer ?? 0);
  const [errorCount, setErrorCount] = useState(
    alreadySolved ? 0 : initial?.errorCount ?? 0
  );
  const [shownConflicts, setShownConflicts] = useState<{
    edges: Set<number>;
    uniqueViolators: Set<number>;
    forbiddenPairViolators: Set<number>;
  }>({ edges: new Set(), uniqueViolators: new Set(), forbiddenPairViolators: new Set() });
  const [selected, setSelected] = useState<number | null>(null);
  const [brush, setBrush] = useState<number>(0);
  // Daily games start paused (matches sudoku/nonogram convention).
  const [paused, setPaused] = useState(!alreadySolved);
  const [won, setWon] = useState(alreadySolved);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const givenNodes = useMemo(
    () => new Set(Object.keys(puzzle.givens).map(Number)),
    [puzzle.givens]
  );

  // Largest square board that fits the column width and the screen height.
  // Shared with the other daily games so every board is the same size.
  const { ref: boardRef, cell: boardPx } = useBoardSize({
    count: 1,
    ...DAILY_BOARD,
    deps: [won],
  });

  // Timer
  useEffect(() => {
    if (!won && !paused) {
      intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [won, paused]);

  useAutoPause(setPaused, won);

  // Auto-save
  useEffect(() => {
    if (won) return;
    saveDailySession(todayKey, { coloring, timer, errorCount });
  }, [coloring, timer, errorCount, won, todayKey]);

  const applyColor = useCallback(
    (nodeId: number, colorIdx: number | null) => {
      if (won || paused) return;
      // Given nodes are locked — ignore attempts to recolor or clear them.
      if (nodeId in puzzle.givens) return;
      const next = [...coloring];
      next[nodeId] = colorIdx === null ? -1 : colorIdx;
      setColoring(next);
      setShownConflicts({ edges: new Set(), uniqueViolators: new Set(), forbiddenPairViolators: new Set() });

      if (next.every((c) => c !== -1)) {
        const uniqueSet = new Set(puzzle.uniqueNeighbourNodes);
        const conf = computeConflicts(
          puzzle.graph,
          next.map((c) => (c === -1 ? null : c)),
          uniqueSet,
          puzzle.forbiddenPairs
        );
        if (conf.edges.size === 0 && conf.uniqueViolators.size === 0 && conf.forbiddenPairViolators.size === 0) {
          setWon(true);
          clearDailySession(todayKey);
          logCompletion({
            id: `daily-${todayKey}`,
            difficulty: DAILY_DIFFICULTY,
            time: timer,
            errors: errorCount,
            date: new Date().toISOString(),
          });
          onComplete(timer, errorCount);
        }
      }
    },
    [coloring, won, paused, puzzle, timer, errorCount, todayKey, onComplete]
  );

  const onNodeClick = useCallback(
    (nodeId: number) => {
      setSelected(nodeId);
      applyColor(nodeId, brush);
    },
    [applyColor, brush]
  );

  const checkBoard = useCallback(() => {
    const uniqueSet = new Set(puzzle.uniqueNeighbourNodes);
    const conf = computeConflicts(
      puzzle.graph,
      coloring.map((c) => (c === -1 ? null : c)),
      uniqueSet,
      puzzle.forbiddenPairs
    );
    setShownConflicts(conf);
    const total = conf.edges.size + conf.uniqueViolators.size + conf.forbiddenPairViolators.size;
    if (total > 0) setErrorCount((n) => n + total);
  }, [puzzle, coloring]);

  // Keyboard: digit keys pick color, Backspace clears selected node
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (paused) return;
      const colors = puzzle.colors;
      const num = parseInt(e.key, 10);
      if (Number.isFinite(num) && num >= 1 && num <= colors) {
        setBrush(num - 1);
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selected !== null) {
        applyColor(selected, null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paused, puzzle.colors, selected, applyColor]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Status bar */}
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-muted">
          {formatTime(timer)}
        </span>
        {errorCount > 0 && (
          <span className="text-xs text-red-400">{errorCount} errors</span>
        )}
        {won && (
          <span className="text-sm font-medium text-accent">Solved!</span>
        )}
        {!won && (
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded border border-border bg-card px-2 py-0.5 text-xs font-mono text-muted transition-colors hover:text-foreground"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>

      {/* Board — square, sized to fit screen */}
      <div ref={boardRef} className="flex w-full justify-center">
      <div
        className="relative"
        style={{ width: boardPx, height: boardPx }}
      >
        <div
          className={`transition-[filter] duration-200 ${
            paused ? "blur-md pointer-events-none" : ""
          }`}
          aria-hidden={paused}
        >
          <GraphBoard
            graph={puzzle.graph}
            nodeColors={coloring.map((c) => (c === -1 ? null : c))}
            palette={puzzle.palette}
            selectedNode={selected}
            conflicts={shownConflicts.edges}
            forbiddenPairs={puzzle.forbiddenPairs}
            forbiddenPairViolators={shownConflicts.forbiddenPairViolators}
            givenNodes={givenNodes}
            uniqueNodes={new Set(puzzle.uniqueNeighbourNodes)}
            uniqueViolators={shownConflicts.uniqueViolators}
            onNodeClick={onNodeClick}
            size={boardPx}
          />
        </div>
        {paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3">
            <span className="text-sm font-medium text-foreground tracking-wide">
              {timer === 0 ? "Daily X-Coloring" : "Paused"}
            </span>
            <PausedRules rules={X_COLORING_RULES} />
            <button
              onClick={() => setPaused(false)}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-background transition-colors hover:bg-accent-hover"
            >
              {timer === 0 ? "Start" : "Resume"}
            </button>
          </div>
        )}
      </div>
      </div>

      {/* Palette */}
      {!won && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {puzzle.palette.map((color, i) => {
            const active = brush === i;
            return (
              <button
                key={i}
                onClick={() => setBrush(i)}
                className={`flex h-8 w-8 items-center justify-center rounded-md border-2 font-mono text-xs font-bold transition-colors ${
                  active
                    ? "border-foreground"
                    : "border-border hover:border-accent/40"
                }`}
                style={{ backgroundColor: color, color: "rgba(0,0,0,0.85)" }}
                aria-label={`Color ${i + 1}`}
              >
                {i + 1}
              </button>
            );
          })}
          <button
            onClick={() => {
              if (selected !== null) applyColor(selected, null);
            }}
            disabled={selected === null}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted transition-colors hover:bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Clear selected node"
          >
            &times;
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        {!won && (
          <button
            onClick={checkBoard}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Check for errors
          </button>
        )}
        {!won && (
          <div className="group relative">
            <button
              type="button"
              aria-label="Show rules"
              className="text-xs text-muted transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
            >
              Rules
            </button>
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-60 -translate-x-1/2 rounded-md border border-border bg-card p-3 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <ul className="list-inside list-disc space-y-1 text-xs text-muted">
                <li>No two connected nodes may share a color</li>
                {puzzle.uniqueNeighbourNodes.length > 0 && (
                  <li>
                    <span className="text-foreground">Ringed nodes:</span> all
                    neighbors need distinct colors
                  </li>
                )}
                {puzzle.forbiddenPairs.length > 0 && (
                  <li>
                    <span className="text-amber-400">Dashed lines:</span> those
                    nodes can&apos;t share a color
                  </li>
                )}
                {givenNodes.size > 0 && (
                  <li>
                    <span className="text-foreground">Bold nodes</span> are
                    pre-colored and locked
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
