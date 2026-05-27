"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createSeededRng, getDailySeed, getTodayKey } from "@/lib/daily";
import {
  generatePuzzle,
  isBoardComplete,
  getErrors,
  CONFIGS,
  type Board,
} from "@/games/sudoku/generator";
import {
  saveDailySession,
  loadDailySession,
  clearDailySession,
} from "@/games/sudoku/session";
import { formatTime } from "@/lib/gameUtils";
import { useBoardSize, DAILY_BOARD } from "@/lib/useBoardSize";
import { PausedRules } from "@/components/games/PausedRules";
import { useAutoPause } from "@/lib/useAutoPause";

const SUDOKU_RULES = [
  "Fill every row, column, and 2×3 box with digits 1–6.",
  "No digit may repeat in a row, column, or box.",
];

function generateDailyGame(): { puzzle: Board; solution: Board; board: Board } {
  const seed = getDailySeed();
  const rng = createSeededRng(seed);
  const { puzzle, solution } = generatePuzzle(6, undefined, rng);
  return { puzzle, solution, board: puzzle.map((r) => [...r]) };
}

interface DailySudokuProps {
  /** Fires the first time the board is solved. Parent decides what to show next. */
  onComplete: (time: number, errors: number) => void;
  /**
   * When true, the game mounts in its solved state: the board is filled
   * with the solution, the timer/pause overlay is hidden, and no input
   * is accepted. Used when the player revisits a step they completed in
   * an earlier session.
   */
  alreadySolved?: boolean;
}

export function DailySudoku({
  onComplete,
  alreadySolved = false,
}: DailySudokuProps) {
  const todayKey = getTodayKey();
  const [game, setGame] = useState<{
    puzzle: Board;
    solution: Board;
    board: Board;
  } | null>(() => {
    const base = generateDailyGame();
    if (alreadySolved) {
      return {
        puzzle: base.puzzle,
        solution: base.solution,
        board: base.solution.map((r) => [...r]),
      };
    }
    const saved = loadDailySession(todayKey, 6);
    if (saved) {
      return { puzzle: base.puzzle, solution: base.solution, board: saved.board };
    }
    return base;
  });
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [errors, setErrors] = useState<[number, number][]>([]);
  const [errorCount, setErrorCount] = useState(
    () => (alreadySolved ? 0 : loadDailySession(todayKey, 6)?.errorCount ?? 0)
  );
  const [timer, setTimer] = useState(
    () => (alreadySolved ? 0 : loadDailySession(todayKey, 6)?.timer ?? 0)
  );
  const [paused, setPaused] = useState(!alreadySolved);
  const [won, setWon] = useState(alreadySolved);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = CONFIGS[6];

  // Largest square board that fits the column width and the screen height.
  // Shared with the other daily games so every board is the same size.
  const { ref: boardRef, cell: boardPx } = useBoardSize({
    count: 1,
    ...DAILY_BOARD,
    deps: [won],
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

  useAutoPause(setPaused, won);

  // Auto-save the in-progress daily puzzle
  useEffect(() => {
    if (!game || won) return;
    saveDailySession(todayKey, game.board, timer, errorCount);
  }, [game, timer, errorCount, won, todayKey]);

  const placeNumber = useCallback(
    (num: number | null) => {
      if (!game || !selected || won || paused) return;
      const [row, col] = selected;
      if (game.puzzle[row][col] !== null) return;

      const newBoard = game.board.map((r) => [...r]);
      newBoard[row][col] = num;
      setGame((prev) => (prev ? { ...prev, board: newBoard } : prev));
      setErrors([]);

      if (num !== null && isBoardComplete(newBoard)) {
        const errs = getErrors(newBoard, game.solution);
        if (errs.length === 0) {
          setWon(true);
          clearDailySession(todayKey);
          onComplete(timer, errorCount);
        } else {
          setErrors(errs);
          setErrorCount((c) => c + errs.length);
        }
      }
    },
    [game, selected, won, paused, timer, errorCount, onComplete, todayKey]
  );

  const checkBoard = useCallback(() => {
    if (!game) return;
    const errs = getErrors(game.board, game.solution);
    setErrors(errs);
    if (errs.length > 0) {
      setErrorCount((c) => c + errs.length);
    }
  }, [game]);

  // Keyboard
  useEffect(() => {
    if (!game) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (paused) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 6) {
        placeNumber(num);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        placeNumber(null);
      } else if (e.key === "ArrowUp" && selected) {
        e.preventDefault();
        setSelected([Math.max(0, selected[0] - 1), selected[1]]);
      } else if (e.key === "ArrowDown" && selected) {
        e.preventDefault();
        setSelected([Math.min(5, selected[0] + 1), selected[1]]);
      } else if (e.key === "ArrowLeft" && selected) {
        e.preventDefault();
        setSelected([selected[0], Math.max(0, selected[1] - 1)]);
      } else if (e.key === "ArrowRight" && selected) {
        e.preventDefault();
        setSelected([selected[0], Math.min(5, selected[1] + 1)]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [placeNumber, selected, game, paused]);

  if (!game) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted">
        Loading daily puzzle...
      </div>
    );
  }

  const { board, puzzle } = game;
  const isError = (r: number, c: number) =>
    errors.some(([er, ec]) => er === r && ec === c);
  const isGiven = (r: number, c: number) => puzzle[r][c] !== null;
  const isSelected = (r: number, c: number) =>
    selected !== null && selected[0] === r && selected[1] === c;
  const selectedValue = selected ? board[selected[0]][selected[1]] : null;
  const isSameValue = (r: number, c: number) =>
    selectedValue !== null &&
    board[r][c] === selectedValue &&
    !isSelected(r, c);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Timer + status */}
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-muted">{formatTime(timer)}</span>
        {errorCount > 0 && (
          <span className="text-xs text-red-400">{errorCount} errors</span>
        )}
        {won && <span className="text-sm font-medium text-accent">Solved!</span>}
        {!won && (
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded border border-border bg-card px-2 py-0.5 text-xs font-mono text-muted transition-colors hover:text-foreground"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>

      {/* 6x6 grid — square, sized to fit screen (shared daily board size) */}
      <div ref={boardRef} className="relative flex w-full justify-center">
      <div className="relative" style={{ width: boardPx, height: boardPx }}>
      <div
        className={`grid h-full w-full select-none border-2 border-foreground/60 transition-[filter] duration-200 ${
          paused ? "blur-md pointer-events-none" : ""
        }`}
        style={{
          gridTemplateColumns: "repeat(6, 1fr)",
          gridTemplateRows: "repeat(6, 1fr)",
          containerType: "inline-size",
        }}
        aria-hidden={paused}
      >
        {board.map((row, r) =>
          row.map((cell, c) => {
            const rightBox = c === 2 && c < 5;
            const bottomBox = (r === 1 || r === 3) && r < 5;

            let bg = "bg-card";
            if (isSelected(r, c)) bg = "bg-accent/20";
            else if (isError(r, c)) bg = "bg-red-500/20";
            else if (isSameValue(r, c)) bg = "bg-accent/10";

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => !won && setSelected([r, c])}
                style={{ fontSize: "clamp(0.9rem, 7cqw, 3.25rem)" }}
                className={`
                  flex items-center justify-center
                  font-mono font-bold
                  transition-colors cursor-pointer
                  ${bg}
                  ${rightBox ? "border-r-2 border-r-foreground/60" : "border-r border-r-border"}
                  ${bottomBox ? "border-b-2 border-b-foreground/60" : "border-b border-b-border"}
                  ${c === 5 ? "!border-r-0" : ""}
                  ${r === 5 ? "!border-b-0" : ""}
                  ${isError(r, c) ? "!text-red-400" : isSameValue(r, c) ? "!text-accent" : isGiven(r, c) ? "text-foreground" : "text-accent"}
                  hover:bg-accent/10
                `}
              >
                {cell ? config.symbols[cell - 1] : ""}
              </button>
            );
          })
        )}
      </div>
        {paused && !won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3">
            <span className="text-sm font-medium text-foreground tracking-wide">
              {timer === 0 ? "Daily Sudoku" : "Paused"}
            </span>
            <PausedRules rules={SUDOKU_RULES} />
            <button
              onClick={() => setPaused(false)}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              {timer === 0 ? "Start" : "Resume"}
            </button>
          </div>
        )}
      </div>
      </div>

      {/* Number pad — matches the board width, generously tappable */}
      <div className="flex gap-1.5" style={{ width: boardPx }}>
        {[1, 2, 3, 4, 5, 6].map((num) => (
          <button
            key={num}
            onClick={() => placeNumber(num)}
            disabled={won}
            className="flex flex-1 min-w-0 h-14 items-center justify-center rounded-md border border-border bg-card font-mono text-lg font-bold text-foreground transition-colors hover:bg-card-hover hover:border-accent/40 active:bg-accent/20 disabled:opacity-50"
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => placeNumber(null)}
          disabled={won}
          className="flex flex-1 min-w-0 h-14 items-center justify-center rounded-md border border-border bg-card text-lg text-muted transition-colors hover:bg-card-hover disabled:opacity-50"
          aria-label="Clear cell"
        >
          &times;
        </button>
      </div>

      {/* Check button */}
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
