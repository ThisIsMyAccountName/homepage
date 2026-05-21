"use client";

/**
 * Daily-crossword wrapper component.
 *
 * Today's puzzle is fetched from `/api/crossword/daily` (which picks
 * from the server-stored pool — approved-pool first, then the bundled
 * fallback) instead of being generated client-side. The previous
 * seeded-runtime-generator path took multi-second hitches on harder
 * shapes and occasionally landed on the symmetric-pattern fallback,
 * both of which are gone now.
 *
 * In-progress letters are persisted to localStorage keyed by date *and*
 * puzzle id; mismatched ids invalidate the saved grid so a session
 * carried over from a different puzzle can't make today's grid
 * unsolvable (the "stuck the next day" bug).
 *
 * Completion fires `onComplete(time, errors, puzzleId)` so the daily
 * hub can offer an upvote action on the completion card.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTodayKey } from "@/lib/daily";
import { useBoardSize } from "@/lib/useBoardSize";
import { ClueBanner } from "@/games/crossword/ClueBanner";
import { ClueList } from "@/games/crossword/ClueList";
import { CrosswordBoard, type Selection } from "@/games/crossword/CrosswordBoard";
import { fetchDailyCrossword } from "@/games/crossword/dailyFetch";
import {
  clearDailySession,
  loadDailySession,
  saveDailySession,
} from "@/games/crossword/session";
import type { StoredPuzzle } from "@/games/crossword/storedPuzzle";
import type { Direction, Entry } from "@/games/crossword/types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Build the initial all-empty grid for `puzzle`. */
function emptyGridFor(puzzle: StoredPuzzle): string[][] {
  return Array.from({ length: puzzle.rows }, (_, r) =>
    Array.from({ length: puzzle.cols }, (_, c) =>
      puzzle.black[r][c] ? "#" : "."
    )
  );
}

function initialSelection(puzzle: StoredPuzzle): Selection {
  const first =
    puzzle.entries.across[0] ?? puzzle.entries.down[0] ?? null;
  if (!first) {
    return { row: 0, col: 0, direction: "across" };
  }
  return {
    row: first.cells[0].row,
    col: first.cells[0].col,
    direction: first.direction,
  };
}

/** True iff every white cell matches the solution. */
function isCorrect(grid: string[][], solution: string[][]): boolean {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (solution[r][c] === "#") continue;
      if (grid[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

/** True iff every white cell has a letter (correct or not). */
function isFilled(grid: string[][]): boolean {
  for (const row of grid) {
    for (const ch of row) {
      if (ch === ".") return false;
    }
  }
  return true;
}

interface DailyCrosswordProps {
  /**
   * Completion handler. `puzzleId` is the stable id of the puzzle that
   * was just solved, so the parent can wire an upvote action on the
   * completion card.
   */
  onComplete: (time: number, errors: number, puzzleId: string) => void;
}

export function DailyCrossword({ onComplete }: DailyCrosswordProps) {
  const todayKey = getTodayKey();
  const [puzzle, setPuzzle] = useState<StoredPuzzle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch today's puzzle once on mount. The fetcher caches the response
  // in sessionStorage so subsequent mounts (strict-mode double-invoke,
  // tab switches) are instant.
  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    fetchDailyCrossword(todayKey, ac.signal)
      .then((res) => {
        if (cancelled) return;
        setPuzzle(res.puzzle);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [todayKey]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Couldn&apos;t load today&apos;s crossword.
        </p>
        <p className="max-w-sm text-xs text-muted">{loadError}</p>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted">
        Loading today&apos;s crossword…
      </div>
    );
  }

  return (
    <DailyCrosswordInner
      puzzle={puzzle}
      todayKey={todayKey}
      onComplete={onComplete}
    />
  );
}

interface InnerProps {
  puzzle: StoredPuzzle;
  todayKey: string;
  onComplete: (time: number, errors: number, puzzleId: string) => void;
}

/**
 * The actual game. Split out from the wrapper so the loading / error
 * branches above can early-return without violating rules-of-hooks.
 */
function DailyCrosswordInner({ puzzle, todayKey, onComplete }: InnerProps) {
  const puzzleId = puzzle.id;

  const [grid, setGrid] = useState<string[][]>(() => {
    const saved = loadDailySession(
      todayKey,
      puzzleId,
      puzzle.rows,
      puzzle.cols
    );
    return saved?.grid ?? emptyGridFor(puzzle);
  });
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(puzzle)
  );
  const [errors, setErrors] = useState<Set<string>>(() => new Set());
  // Cells highlighted green by the most recent Check pass. Cleared (per
  // cell) on any user input so feedback never stays stale.
  const [corrects, setCorrects] = useState<Set<string>>(() => new Set());
  const [errorCount, setErrorCount] = useState<number>(
    () =>
      loadDailySession(todayKey, puzzleId, puzzle.rows, puzzle.cols)
        ?.errorCount ?? 0
  );
  const [timer, setTimer] = useState<number>(
    () =>
      loadDailySession(todayKey, puzzleId, puzzle.rows, puzzle.cols)?.timer ?? 0
  );
  const [paused, setPaused] = useState(true);
  const [won, setWon] = useState<boolean>(() => {
    const saved = loadDailySession(
      todayKey,
      puzzleId,
      puzzle.rows,
      puzzle.cols
    );
    return !!saved && isCorrect(saved.grid, puzzle.solution);
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Adapt cell size to the board column's actual width. The clue sidebar
  // takes ~240px on `lg+`, so the board column gets the remainder; the
  // hook handles the recompute via ResizeObserver. Bounds match
  // `CrosswordGame` so the daily and the freeform game look consistent.
  const { ref: boardRef, cell: cellPx } = useBoardSize({
    count: Math.max(puzzle.rows, puzzle.cols),
    cols: puzzle.cols,
    rows: puzzle.rows,
    reserveBelow: 240,
    min: 36,
    max: 72,
    deps: [won, paused],
  });

  // Timer
  useEffect(() => {
    if (!paused && !won) {
      intervalRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, won]);

  // Persist on every meaningful change so a refresh restores exactly.
  useEffect(() => {
    if (won) return;
    saveDailySession(todayKey, puzzleId, grid, timer, errorCount);
  }, [grid, timer, errorCount, won, todayKey, puzzleId]);

  // Tracks whether we have already fired the parent's `onComplete`. Without
  // this, React's strict-mode double-invoke of the event handler (or a
  // stray second keystroke after the win) could record completion twice.
  const completedRef = useRef(false);

  const handleCellInput = useCallback(
    (r: number, c: number, letter: string) => {
      if (won || paused) return;
      if (grid[r][c] === "#") return;
      const newCh = letter || ".";
      if (grid[r][c] === newCh) return;

      const next = grid.map((row) => [...row]);
      next[r][c] = newCh;
      setGrid(next);

      // Clear any pending Check feedback (red or green) on this cell —
      // the player has changed it, so the previous result is stale.
      const key = `${r},${c}`;
      setErrors((cur) => {
        if (!cur.has(key)) return cur;
        const out = new Set(cur);
        out.delete(key);
        return out;
      });
      setCorrects((cur) => {
        if (!cur.has(key)) return cur;
        const out = new Set(cur);
        out.delete(key);
        return out;
      });

      // Detect completion synchronously off `next` (not committed state) so
      // the parent's `onComplete` fires on the same gesture that finishes
      // the grid — no extra effect, no extra render.
      if (
        !completedRef.current &&
        isFilled(next) &&
        isCorrect(next, puzzle.solution)
      ) {
        completedRef.current = true;
        setWon(true);
        clearDailySession(todayKey);
        onComplete(timer, errorCount, puzzleId);
      }
    },
    [
      won,
      paused,
      grid,
      puzzle.solution,
      timer,
      errorCount,
      todayKey,
      puzzleId,
      onComplete,
    ]
  );

  const handleCheck = useCallback(() => {
    if (won) return;
    const wrong = new Set<string>();
    const right = new Set<string>();
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (puzzle.solution[r][c] === "#") continue;
        if (grid[r][c] === ".") continue;
        const key = `${r},${c}`;
        if (grid[r][c] !== puzzle.solution[r][c]) wrong.add(key);
        else right.add(key);
      }
    }
    setErrors(wrong);
    setCorrects(right);
    if (wrong.size > 0) {
      // Match the sudoku convention: one Check press = one error bump.
      setErrorCount((n) => n + 1);
    }
  }, [grid, puzzle.solution, puzzle.rows, puzzle.cols, won]);

  // Active entry derivation for the banner + clue list.
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
      // Cell may only have one direction; fall back to the other.
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

  const jumpToEntry = useCallback(
    (entry: Entry) => {
      // Land on the first empty cell of the entry (or its head if the
      // entry is already full) so jumping to a partially solved word
      // puts the caret on the next blank, not back on cell #1.
      let target = entry.cells[0];
      for (const cell of entry.cells) {
        if (grid[cell.row][cell.col] === ".") {
          target = cell;
          break;
        }
      }
      setSelection({
        row: target.row,
        col: target.col,
        direction: entry.direction,
      });
    },
    [grid]
  );

  const boardW = puzzle.cols * cellPx;
  const boardH = puzzle.rows * cellPx;
  const disabled = paused || won;
  // The board itself never blurs (so the player can see the finished grid
  // when they win and the puzzle structure while paused). The clue UI is
  // blurred on pause so the player can't peek at clues without playing.
  const clueBlurred = paused && !won;
  const clueBlurClass = clueBlurred
    ? "blur-md pointer-events-none transition-[filter] duration-200"
    : "transition-[filter] duration-200";

  return (
    <div className="flex flex-col gap-3">
      {/* Top status row — timer, error count, pause toggle. Lives outside
          the blurred clue region so the player can always read the timer
          and resume. */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
        <span className="font-mono text-sm text-muted">{formatTime(timer)}</span>
        {errorCount > 0 && (
          <span className="text-red-400">
            {errorCount} check{errorCount === 1 ? "" : "s"}
          </span>
        )}
        {won && <span className="font-medium text-accent">Solved!</span>}
        {!won && (
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded border border-border bg-card px-2 py-0.5 font-mono text-muted transition-colors hover:text-foreground"
          >
            {paused ? (timer === 0 ? "Start" : "Resume") : "Pause"}
          </button>
        )}
      </div>

      {/* Main split: clue sidebar on the left at `lg+`, board on the
          right. Stacked on smaller screens with the board on top so the
          player's eye lands on the puzzle first. Matches the freeform
          Crossword game's layout. */}
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Clue sidebar — blurred on pause (not on win) so pausing
            actually hides the clues. */}
        <aside
          className={`order-2 lg:order-1 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1 ${clueBlurClass}`}
        >
          <ClueList
            puzzle={puzzle}
            grid={grid}
            activeNumber={activeEntry?.number ?? null}
            activeDirection={activeEntry?.direction ?? null}
            onJump={jumpToEntry}
            stacked
          />
        </aside>

        {/* Board column */}
        <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
          {/* Active-clue banner — part of the "clue group" so it follows
              the same blur rule as the sidebar. */}
          <div className={clueBlurClass} style={{ width: boardW }}>
            <ClueBanner
              entry={activeEntry}
              disabled={disabled}
              width={boardW}
              onFlipDirection={flipDirection}
            />
          </div>

          {/* The board stays fully visible at all times. A transparent
              full-area button catches taps while paused and surfaces a
              Start/Resume pill; the underlying grid is never blurred. */}
          <div ref={boardRef} className="relative flex w-full justify-center">
            <div
              className="relative"
              style={{ width: boardW, height: boardH }}
            >
              <CrosswordBoard
                puzzle={puzzle}
                grid={grid}
                selection={selection}
                errors={errors}
                corrects={corrects}
                cellPx={cellPx}
                disabled={disabled}
                onSelectionChange={setSelection}
                onCellInput={handleCellInput}
              />
              {paused && !won && (
                <button
                  type="button"
                  onClick={() => setPaused(false)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-transparent"
                  aria-label={timer === 0 ? "Start daily crossword" : "Resume"}
                >
                  <span className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-background shadow-lg">
                    {timer === 0 ? "Start" : "Resume"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Daily intentionally has no Reveal buttons — there's only one
              shot at the daily, so giving away letters trivialises the
              leaderboard. Just a Check pass to surface red/green
              feedback. */}
          {!won && (
            <button
              onClick={handleCheck}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Check for errors
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
