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
  type CellState,
  type Solution,
} from "@/games/nonogram/generator";
import {
  saveDailySession,
  loadDailySession,
  clearDailySession,
} from "@/games/nonogram/session";
import { logCompletion } from "@/games/nonogram/history";

const ROWS = 7;
const COLS = 7;
const CELL_SIZE = 36;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function generateDailyPuzzle() {
  const seed = getDailySeed();
  const rng = createSeededRng(seed);
  return generatePuzzle(ROWS, COLS, rng);
}

function buildShareText(
  solution: Solution,
  time: number,
  errors: number,
  dateKey: string
): string {
  const rows = solution
    .map((row) => row.map((cell) => (cell ? "🟩" : "⬛")).join(""))
    .join("\n");
  const errStr = errors > 0 ? ` · ${errors} errors` : "";
  return `Nonogram ${dateKey} (${solution.length}×${solution[0].length})\n${rows}\n⏱ ${formatTime(time)}${errStr}`;
}

function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-xs text-muted hover:text-foreground transition-colors"
    >
      {copied ? "Copied!" : "Share result"}
    </button>
  );
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
  const [mode, setMode] = useState<"fill" | "mark">("fill");
  const [paused, setPaused] = useState(true);
  const [won, setWon] = useState(false);
  const [alreadyCompleted] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(`daily-nonogram-completed-${todayKey}`) === "1"
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (!won && !paused && !alreadyCompleted) {
      intervalRef.current = setInterval(
        () => setTimer((t) => t + 1),
        1000
      );
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [won, paused, alreadyCompleted]);

  // Auto-save
  useEffect(() => {
    if (won || alreadyCompleted) return;
    saveDailySession(todayKey, grid, timer, errorCount);
  }, [grid, timer, errorCount, won, alreadyCompleted, todayKey]);

  const applyToggle = useCallback(
    (r: number, c: number, applyMode: "fill" | "mark") => {
      if (won || alreadyCompleted || paused) return;

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
        localStorage.setItem(`daily-nonogram-completed-${todayKey}`, "1");
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
    [won, alreadyCompleted, paused, grid, puzzle.solution, timer, errorCount, onComplete, todayKey]
  );

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      setSelected([r, c]);
      applyToggle(r, c, mode);
    },
    [applyToggle, mode]
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

  if (alreadyCompleted && !won) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-sm text-accent font-medium">
          You already completed today&apos;s puzzle!
        </p>
        <p className="text-xs text-muted">Come back tomorrow for a new one.</p>
      </div>
    );
  }

  const { rowClues, colClues, solution } = puzzle;
  const maxRowClueLen = Math.max(...rowClues.map((r) => r.length));
  const maxColClueLen = Math.max(...colClues.map((c) => c.length));
  const rowClueW = maxRowClueLen * 18 + 8;
  const colClueH = maxColClueLen * 14 + 6;

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

      {/* Fill / Mark mode toggle */}
      {!won && (
        <div className="flex gap-1 rounded-md border border-border bg-card p-0.5 text-xs font-mono">
          <button
            onClick={() => setMode("fill")}
            className={`rounded px-2.5 py-1 transition-colors ${
              mode === "fill"
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            Fill
          </button>
          <button
            onClick={() => setMode("mark")}
            className={`rounded px-2.5 py-1 transition-colors ${
              mode === "mark"
                ? "bg-accent/30 text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            Mark ×
          </button>
        </div>
      )}

      {/* Puzzle */}
      <div className="relative select-none">
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
                style={{ width: CELL_SIZE, height: colClueH }}
              >
                {clue.map((n, i) => (
                  <span
                    key={i}
                    className={`font-mono text-[11px] leading-[14px] ${
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
                  style={{ width: rowClueW, height: CELL_SIZE }}
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
                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-sm font-medium text-foreground tracking-wide">
              Paused
            </span>
            <button
              onClick={() => setPaused(false)}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-background transition-colors hover:bg-accent-hover"
            >
              Resume
            </button>
          </div>
        )}
      </div>

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
        {won && (
          <ShareButton
            text={buildShareText(solution, timer, errorCount, todayKey)}
          />
        )}
      </div>
    </div>
  );
}
