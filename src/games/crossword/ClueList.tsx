"use client";

/**
 * Full Across + Down clue lists below the grid. Each clue is clickable —
 * tapping a clue jumps the active selection to its first cell. The active
 * entry is highlighted; entries the user has fully filled (correct or not)
 * are dimmed so it's easy to scan for unsolved clues.
 */

import type { Direction, Entry, Puzzle } from "./types";

interface ClueListProps {
  puzzle: Puzzle;
  /** Current letters grid so we can tell which entries are fully filled. */
  grid: string[][];
  activeNumber: number | null;
  activeDirection: Direction | null;
  onJump: (entry: Entry) => void;
  /**
   * When true, the Across + Down sections always stack vertically (used
   * for the sidebar layout in the game-section variant). Default is the
   * original behaviour: stacked on narrow screens, side-by-side on `sm+`.
   */
  stacked?: boolean;
}

function isEntryFilled(grid: string[][], entry: Entry): boolean {
  for (const { row, col } of entry.cells) {
    const ch = grid[row]?.[col];
    if (!ch || ch === "." || ch === "#") return false;
  }
  return true;
}

function Column({
  title,
  entries,
  grid,
  activeNumber,
  activeDirection,
  direction,
  onJump,
}: {
  title: string;
  entries: Entry[];
  grid: string[][];
  activeNumber: number | null;
  activeDirection: Direction | null;
  direction: Direction;
  onJump: (entry: Entry) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <h4 className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted">
        {title}
      </h4>
      <ol className="flex flex-col">
        {entries.map((entry) => {
          const isActive =
            activeDirection === direction && activeNumber === entry.number;
          const filled = isEntryFilled(grid, entry);
          return (
            <li key={`${direction}-${entry.number}`}>
              <button
                type="button"
                onClick={() => onJump(entry)}
                className={`flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                  isActive
                    ? "bg-accent/20 text-foreground"
                    : filled
                      ? "text-muted hover:bg-card-hover hover:text-foreground"
                      : "text-foreground hover:bg-card-hover"
                }`}
              >
                <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted">
                  {entry.number}
                </span>
                {/* Wrap instead of truncating so wordy clues stay readable
                    inside the (often narrow) clue column. */}
                <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                  {entry.clue}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ClueList({
  puzzle,
  grid,
  activeNumber,
  activeDirection,
  onJump,
  stacked = false,
}: ClueListProps) {
  const layout = stacked
    ? "flex w-full flex-col gap-3"
    : "flex w-full flex-col gap-3 sm:flex-row sm:gap-6";
  return (
    <div className={layout}>
      <Column
        title="Across"
        entries={puzzle.entries.across}
        grid={grid}
        activeNumber={activeNumber}
        activeDirection={activeDirection}
        direction="across"
        onJump={onJump}
      />
      <Column
        title="Down"
        entries={puzzle.entries.down}
        grid={grid}
        activeNumber={activeNumber}
        activeDirection={activeDirection}
        direction="down"
        onJump={onJump}
      />
    </div>
  );
}
