"use client";

/**
 * Read-only view of today's solved crossword grid. Rendered after a
 * player has completed the daily and asked to "view the solution" from
 * the completion card — the puzzle itself is regenerated locally from
 * the daily seed (deterministic), so we don't need to persist the
 * solution anywhere.
 *
 * The grid is sized identically to `DailyCrossword` so the visual
 * footprint stays consistent across the two states.
 */

import { useCallback, useMemo, useState } from "react";
import { getDailySeed } from "@/lib/daily";
import { ClueBanner } from "@/games/crossword/ClueBanner";
import { ClueList } from "@/games/crossword/ClueList";
import { CrosswordBoard, type Selection } from "@/games/crossword/CrosswordBoard";
import { generateCrosswordPuzzle } from "@/games/crossword/generator";
import type { Direction, Entry, Puzzle } from "@/games/crossword/types";
import { useBoardSize } from "@/lib/useBoardSize";

interface DailyCrosswordSolutionProps {
  /** Fires when the player wants to return to the completion card. */
  onBack: () => void;
}

function initialSelection(puzzle: Puzzle): Selection {
  const first = puzzle.entries.across[0] ?? puzzle.entries.down[0] ?? null;
  if (!first) return { row: 0, col: 0, direction: "across" };
  return {
    row: first.cells[0].row,
    col: first.cells[0].col,
    direction: first.direction,
  };
}

export function DailyCrosswordSolution({
  onBack,
}: DailyCrosswordSolutionProps) {
  // Regenerate today's puzzle from the daily seed. Deterministic, so the
  // solution shown here is exactly what the player just finished.
  const puzzle = useMemo<Puzzle>(
    () => generateCrosswordPuzzle(getDailySeed()),
    []
  );
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(puzzle)
  );

  const { ref: boardRef, cell: cellPx } = useBoardSize({
    count: Math.max(puzzle.rows, puzzle.cols),
    cols: puzzle.cols,
    rows: puzzle.rows,
    reserveBelow: 240,
    min: 36,
    max: 72,
    deps: [],
  });

  // Every cell is shown filled with its solution letter. The board's
  // `disabled` prop blocks typing; the click-driven cell navigation
  // still works so the player can browse the entries and read clues.
  const solutionGrid = useMemo<string[][]>(
    () => puzzle.solution.map((row) => [...row]),
    [puzzle]
  );

  const activeEntry = useMemo<Entry | null>(() => {
    const list =
      selection.direction === "across"
        ? puzzle.entries.across
        : puzzle.entries.down;
    return (
      list.find((entry) =>
        entry.cells.some(
          (cell) => cell.row === selection.row && cell.col === selection.col
        )
      ) ??
      (
        selection.direction === "across"
          ? puzzle.entries.down
          : puzzle.entries.across
      ).find((entry) =>
        entry.cells.some(
          (cell) => cell.row === selection.row && cell.col === selection.col
        )
      ) ??
      null
    );
  }, [selection, puzzle.entries]);

  const flipDirection = useCallback(() => {
    setSelection((sel) => ({
      ...sel,
      direction: (sel.direction === "across" ? "down" : "across") as Direction,
    }));
  }, []);

  const jumpToEntry = useCallback((entry: Entry) => {
    // Every cell is filled, so just land on the entry's head.
    setSelection({
      row: entry.cells[0].row,
      col: entry.cells[0].col,
      direction: entry.direction,
    });
  }, []);

  const boardW = puzzle.cols * cellPx;
  const boardH = puzzle.rows * cellPx;

  return (
    <div className="flex flex-col gap-3">
      {/* Header with "back" — pinned outside the grid split so the
          control is always reachable. */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-mono uppercase tracking-wider text-muted">
          Today&apos;s solution
        </span>
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-border bg-card px-2 py-1 font-mono text-muted transition-colors hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      {/* Sidebar + board, matching DailyCrossword's layout. Nothing
          blurs — the puzzle is solved. */}
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="order-2 lg:order-1 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
          <ClueList
            puzzle={puzzle}
            grid={solutionGrid}
            activeNumber={activeEntry?.number ?? null}
            activeDirection={activeEntry?.direction ?? null}
            onJump={jumpToEntry}
            stacked
          />
        </aside>

        <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
          <div style={{ width: boardW }}>
            <ClueBanner
              entry={activeEntry}
              width={boardW}
              onFlipDirection={flipDirection}
            />
          </div>
          <div ref={boardRef} className="relative flex w-full justify-center">
            <div
              className="relative"
              style={{ width: boardW, height: boardH }}
            >
              {/* `disabled` blocks typing so the read-only intent is
                  obvious; selection / direction flip still work. */}
              <CrosswordBoard
                puzzle={puzzle}
                grid={solutionGrid}
                selection={selection}
                errors={new Set()}
                cellPx={cellPx}
                disabled
                onSelectionChange={setSelection}
                onCellInput={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
