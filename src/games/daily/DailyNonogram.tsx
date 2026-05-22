"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createSeededRng, getDailySeed, getTodayKey } from "@/lib/daily";
import {
  generatePuzzle,
  emptyGrid,
  isComplete,
  getErrors,
  isLineSatisfied,
  type Grid,
} from "@/games/nonogram/generator";
import {
  saveDailySession,
  loadDailySession,
  clearDailySession,
} from "@/games/nonogram/session";
import { logCompletion } from "@/games/nonogram/history";
import { formatTime } from "@/lib/gameUtils";
import { useBoardSize, DAILY_BOARD } from "@/lib/useBoardSize";
import { PausedRules } from "@/components/games/PausedRules";
import { useAutoPause } from "@/lib/useAutoPause";

const ROWS = 7;
const COLS = 7;

const NONOGRAM_RULES = [
  "Clues list the lengths of consecutive filled groups in each row and column.",
  "Groups are separated by at least one empty cell.",
  "Left-click to fill, right-click to mark a cross.",
];

function generateDailyPuzzle() {
  const seed = getDailySeed();
  const rng = createSeededRng(seed);
  return generatePuzzle(ROWS, COLS, rng);
}

interface DailyNonogramProps {
  onComplete: (time: number, errors: number) => void;
}

export function DailyNonogram({ onComplete }: DailyNonogramProps) {
  const todayKey = getTodayKey();
  const [puzzle] = useState(generateDailyPuzzle);
  const [grid, setGrid] = useState<Grid>(
    () => loadDailySession(todayKey, ROWS, COLS)?.grid ?? emptyGrid(ROWS, COLS)
  );
  const [timer, setTimer] = useState(
    () => loadDailySession(todayKey, ROWS, COLS)?.timer ?? 0
  );
  const [errorCount, setErrorCount] = useState(
    () => loadDailySession(todayKey, ROWS, COLS)?.errorCount ?? 0
  );
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [paused, setPaused] = useState(true);
  const [won, setWon] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      intervalRef.current = setInterval(
        () => setTimer((t) => t + 1),
        1000
      );
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [won, paused]);

  useAutoPause(setPaused, won);

  // Auto-save
  useEffect(() => {
    if (won) return;
    saveDailySession(todayKey, grid, timer, errorCount);
  }, [grid, timer, errorCount, won, todayKey]);

  const applyToggle = useCallback(
    (r: number, c: number, applyMode: "fill" | "mark") => {
      if (won || paused) return;

      const newGrid = grid.map((row) => [...row]) as Grid;
      const cur = newGrid[r][c];

      if (applyMode === "fill") {
        newGrid[r][c] = cur === "filled" ? "empty" : "filled";
      } else {
        newGrid[r][c] = cur === "marked" ? "empty" : "marked";
      }

      setGrid(newGrid);
      setErrors(new Set());

      if (isComplete(newGrid, puzzle.solution)) {
        setWon(true);
        clearDailySession(todayKey);
        logCompletion({
          id: `daily-${todayKey}`,
          rows: ROWS,
          cols: COLS,
          time: timer,
          errors: errorCount,
          date: new Date().toISOString(),
          puzzleDate: todayKey,
        });
        onComplete(timer, errorCount);
      }
    },
    [won, paused, grid, puzzle.solution, timer, errorCount, onComplete, todayKey]
  );

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      setSelected([r, c]);
      applyToggle(r, c, "fill");
    },
    [applyToggle]
  );

  const handleCellRightClick = useCallback(
    (e: React.MouseEvent, r: number, c: number) => {
      e.preventDefault();
      setSelected([r, c]);
      applyToggle(r, c, "mark");
    },
    [applyToggle]
  );

  const checkBoard = useCallback(() => {
    const errs = getErrors(grid, puzzle.solution);
    setErrors(new Set(errs.map(([r, c]) => `${r}-${c}`)));
    if (errs.length > 0) setErrorCount((n) => n + errs.length);
  }, [grid, puzzle.solution]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (paused) return;
      if (e.key === "ArrowUp" && selected) {
        e.preventDefault();
        setSelected([Math.max(0, selected[0] - 1), selected[1]]);
      } else if (e.key === "ArrowDown" && selected) {
        e.preventDefault();
        setSelected([Math.min(ROWS - 1, selected[0] + 1), selected[1]]);
      } else if (e.key === "ArrowLeft" && selected) {
        e.preventDefault();
        setSelected([selected[0], Math.max(0, selected[1] - 1)]);
      } else if (e.key === "ArrowRight" && selected) {
        e.preventDefault();
        setSelected([selected[0], Math.min(COLS - 1, selected[1] + 1)]);
      } else if ((e.key === " " || e.key === "Enter") && selected) {
        e.preventDefault();
        applyToggle(selected[0], selected[1], "fill");
      } else if ((e.key === "x" || e.key === "X") && selected) {
        applyToggle(selected[0], selected[1], "mark");
      } else if (e.key === "Backspace" && selected) {
        const [r, c] = selected;
        const newGrid = grid.map((row) => [...row]) as Grid;
        newGrid[r][c] = "empty";
        setGrid(newGrid);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, paused, applyToggle, grid]);

  const { rowClues, colClues } = puzzle;
  const maxRowClueLen = Math.max(...rowClues.map((r) => r.length));
  const maxColClueLen = Math.max(...colClues.map((c) => c.length));
  // Clue gutter dims are picked so the *entire* puzzle — row gutter + grid —
  // fits inside the shared daily square, even on a 320px-viewport phone.
  // Each clue digit ≈ 12px wide / 11px tall in the 10px mono font below.
  const CLUE_DIGIT_W = 12;
  const CLUE_DIGIT_H = 11;
  const rowClueW = maxRowClueLen * CLUE_DIGIT_W + 6;
  const colClueH = maxColClueLen * CLUE_DIGIT_H + 4;
  // Available room for cells = boardPx minus the gutter on whichever axis
  // it lives. Take the smaller side so cells stay square.
  const cellSize = Math.max(
    24,
    Math.floor(Math.min(boardPx - rowClueW, boardPx - colClueH) / COLS)
  );
  const clueFontPx = Math.max(9, Math.min(11, Math.round(cellSize * 0.34)));

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

      {/* Puzzle */}
      <div
        ref={boardRef}
        className="relative flex w-full select-none flex-col items-center mt-8"
      >
        {/* Column clues */}
        <div
          className={`flex transition-[filter] duration-200 ${paused ? "blur-md" : ""}`}
          style={{ paddingLeft: rowClueW }}
        >
          {colClues.map((clue, c) => {
            const colLine = grid.map((row) => row[c]);
            const satisfied = isLineSatisfied(colLine, clue);
            return (
              <div
                key={c}
                className="flex flex-col items-center justify-end pb-0.5"
                style={{ width: cellSize, height: colClueH }}
              >
                {clue.map((n, i) => (
                  <span
                    key={i}
                    className={`font-mono ${
                      satisfied ? "text-foreground/25" : "text-muted"
                    }`}
                  >
                    {n === 0 ? " " : n}
                  </span>
                ))}
              </div>
            );
          })}
        </div>

        {/* Grid rows */}
        <div
          className={`transition-[filter] duration-200 ${
            paused ? "blur-md pointer-events-none" : ""
          }`}
          aria-hidden={paused}
        >
          {grid.map((row, r) => {
            const satisfied = isLineSatisfied(row, rowClues[r]);
            return (
              <div key={r} className="flex">
                {/* Row clue */}
                <div
                  className="flex items-center justify-end gap-1 pr-2"
                  style={{ width: rowClueW, height: cellSize }}
                >
                  {rowClues[r].map((n, i) => (
                    <span
                      key={i}
                      className={`font-mono text-[11px] ${
                        satisfied ? "text-foreground/25" : "text-muted"
                      }`}
                    >
                      {n === 0 ? " " : n}
                    </span>
                  ))}
                </div>
                {/* Cells */}
                {row.map((cell, c) => {
                  const isErr = errors.has(`${r}-${c}`);
                  const isSel =
                    selected?.[0] === r && selected?.[1] === c;
                  return (
                    <button
                      key={c}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        fontSize: Math.max(11, Math.round(cellSize * 0.45)),
                      }}
                      onClick={() => handleCellClick(r, c)}
                      onContextMenu={(e) => handleCellRightClick(e, r, c)}
                      className={[
                        "border border-border flex items-center justify-center text-xs font-mono transition-colors",
                        cell === "filled" && !isErr
                          ? "bg-accent border-accent text-background"
                          : "",
                        cell === "filled" && isErr
                          ? "bg-red-500/40 border-red-400"
                          : "",
                        cell === "marked"
                          ? "bg-card text-muted"
                          : "",
                        cell === "empty" && !isSel
                          ? "bg-card hover:bg-card-hover"
                          : "",
                        isSel && cell === "empty"
                          ? "bg-accent/15 ring-1 ring-inset ring-foreground/30"
                          : "",
                        isSel && cell !== "empty"
                          ? "ring-1 ring-inset ring-foreground/30"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {cell === "marked" ? "×" : ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Pause overlay */}
        {paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3">
            <span className="text-sm font-medium text-foreground tracking-wide">
              {timer === 0 ? "Daily Nonogram" : "Paused"}
            </span>
            <PausedRules rules={NONOGRAM_RULES} />
            <button
              onClick={() => setPaused(false)}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-background transition-colors hover:bg-accent-hover"
            >
              {timer === 0 ? "Start" : "Resume"}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      {!won && (
        <button
          onClick={checkBoard}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          Check for errors
        </button>
      )}
    </div>
  );
}
