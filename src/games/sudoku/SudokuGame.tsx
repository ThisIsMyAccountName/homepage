"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  generatePuzzle,
  isBoardComplete,
  getErrors,
  encodeBoard,
  decodeBoard,
  solvePuzzle,
  CONFIGS,
  type Board,
  type SudokuConfig,
} from "./generator";
import {
  logCompletion,
  getCompletedPuzzles,
  clearCompletedPuzzles,
  type CompletedPuzzle,
} from "./history";
import {
  saveRegularSession,
  loadRegularSession,
  clearRegularSession,
} from "./session";
import { GameTabs } from "@/components/games/GameTabs";
import { GameHistory, type HistoryEntry } from "@/components/games/GameHistory";
import { ConfirmDialog } from "@/components/games/ConfirmDialog";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type GameSize = 6 | 9 | 16;

interface GameState {
  puzzle: Board;
  solution: Board;
  board: Board;
  config: SudokuConfig;
  size: GameSize;
}

function createGame(size: GameSize): GameState {
  const { puzzle, solution, config } = generatePuzzle(size);
  return { puzzle, solution, board: puzzle.map((r) => [...r]), config, size };
}

function loadFromURL(
  sizeParam: string | null,
  puzzleParam: string | null
): GameState | null {
  if (!sizeParam || !puzzleParam) return null;
  const size = parseInt(sizeParam) as GameSize;
  const config = CONFIGS[size];
  if (!config) return null;
  const puzzle = decodeBoard(puzzleParam, size);
  if (!puzzle) return null;
  const solution = solvePuzzle(puzzle, size);
  if (!solution) return null;
  return { puzzle, solution, board: puzzle.map((r) => [...r]), config, size };
}

type Tab = "play" | "history";

export function SudokuGame() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Start null to avoid hydration mismatch — puzzle generation is random
  const [game, setGame] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [errors, setErrors] = useState<[number, number][]>([]);
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [won, setWon] = useState(false);
  const [tab, setTab] = useState<Tab>("play");
  const [history, setHistory] = useState<CompletedPuzzle[]>([]);
  const [copied, setCopied] = useState(false);
  // Pending size for a New Game confirmation. undefined = no prompt open.
  // null = confirming reset with current size. number = confirming size switch.
  const [pendingNewGame, setPendingNewGame] = useState<
    GameSize | null | undefined
  >(undefined);
  const [pendingReset, setPendingReset] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);

  // Client-only initialization — must use effect to avoid hydration mismatch
  // since puzzle generation uses Math.random()
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setHistory(getCompletedPuzzles());

    const fromURL = loadFromURL(searchParams.get("s"), searchParams.get("p"));
    if (fromURL) {
      setGame(fromURL);
      setRunning(true);
      return;
    }
    const saved = loadRegularSession();
    if (saved) {
      const cfg = CONFIGS[saved.size];
      if (cfg) {
        setGame({
          puzzle: saved.puzzle,
          solution: saved.solution,
          board: saved.board,
          config: cfg,
          size: saved.size as GameSize,
        });
        setTimer(saved.timer);
        setRunning(true);
        return;
      }
    }
    setGame(createGame(9));
    setRunning(true);
  }, [searchParams]);

  // Has the player made any moves on the current puzzle?
  const hasProgress = useCallback((): boolean => {
    if (!game || won) return false;
    for (let r = 0; r < game.size; r++) {
      for (let c = 0; c < game.size; c++) {
        if (game.puzzle[r][c] === null && game.board[r][c] !== null) {
          return true;
        }
      }
    }
    return false;
  }, [game, won]);

  const resetPuzzle = useCallback(
    (resetTimer: boolean) => {
      if (!game) return;
      clearRegularSession();
      setGame((g) => (g ? { ...g, board: g.puzzle.map((r) => [...r]) } : g));
      setSelected(null);
      setErrors([]);
      if (resetTimer) setTimer(0);
      setRunning(true);
      setPaused(false);
      setWon(false);
    },
    [game]
  );

  // New game (no confirmation — call requestNewGame for the prompt flow)
  const newGame = useCallback(
    (size?: GameSize) => {
      const s = size ?? game?.size ?? 9;
      clearRegularSession();
      setGame(createGame(s));
      setSelected(null);
      setErrors([]);
      setTimer(0);
      setRunning(true);
      setPaused(false);
      setWon(false);
      router.replace("/games/sudoku", { scroll: false });
    },
    [game?.size, router]
  );

  // Request new game — prompts confirmation if there's unsaved progress.
  const requestNewGame = useCallback(
    (size?: GameSize) => {
      if (hasProgress()) {
        setPendingNewGame(size ?? null);
      } else {
        newGame(size);
      }
    },
    [hasProgress, newGame]
  );

  // Timer
  useEffect(() => {
    if (running && !paused && !won && game) {
      intervalRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, paused, won, game]);

  // Auto-save the in-progress puzzle so it survives reloads.
  // Cleared on win / new game.
  useEffect(() => {
    if (!game || won) return;
    saveRegularSession(
      game.size,
      game.puzzle,
      game.solution,
      game.board,
      timer
    );
  }, [game, timer, won]);

  // Place number
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
          setRunning(false);
          clearRegularSession();
          const entry: CompletedPuzzle = {
            id: Date.now().toString(36),
            size: game.size,
            time: timer,
            date: new Date().toISOString(),
            puzzleEncoded: encodeBoard(game.puzzle),
          };
          logCompletion(entry);
          setHistory(getCompletedPuzzles());
        }
      }
    },
    [game, selected, won, paused, timer]
  );

  // Check
  const checkBoard = useCallback(() => {
    if (!game) return;
    setErrors(getErrors(game.board, game.solution));
  }, [game]);

  // Share current puzzle (no solution in URL)
  const shareCurrentPuzzle = useCallback(() => {
    if (!game) return;
    const puzzleEnc = encodeBoard(game.puzzle);
    const url = `${window.location.origin}/games/sudoku?s=${game.size}&p=${puzzleEnc}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [game]);

  // Share from history
  const shareFromHistory = useCallback(
    (entry: CompletedPuzzle) => {
      if (!entry.puzzleEncoded) return;
      const url = `${window.location.origin}/games/sudoku?s=${entry.size}&p=${entry.puzzleEncoded}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    },
    []
  );

  // Keyboard
  useEffect(() => {
    if (!game) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (paused) return;
      const { size, config } = game;

      if (size <= 9) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= size) {
          placeNumber(num);
          return;
        }
      } else {
        const num = parseInt(e.key, 36);
        if (num >= 1 && num <= size) {
          placeNumber(num);
          return;
        }
      }

      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        placeNumber(null);
      } else if (e.key === "ArrowUp" && selected) {
        e.preventDefault();
        setSelected([Math.max(0, selected[0] - 1), selected[1]]);
      } else if (e.key === "ArrowDown" && selected) {
        e.preventDefault();
        setSelected([Math.min(config.size - 1, selected[0] + 1), selected[1]]);
      } else if (e.key === "ArrowLeft" && selected) {
        e.preventDefault();
        setSelected([selected[0], Math.max(0, selected[1] - 1)]);
      } else if (e.key === "ArrowRight" && selected) {
        e.preventDefault();
        setSelected([selected[0], Math.min(config.size - 1, selected[1] + 1)]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [placeNumber, selected, game, paused]);

  const digitCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const row of game?.board ?? []) {
      for (const cell of row) {
        if (cell !== null) counts[cell] = (counts[cell] ?? 0) + 1;
      }
    }
    return counts;
  }, [game?.board]);

  // Loading state (server render + initial client frame)
  if (!game) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted">
        Generating puzzle...
      </div>
    );
  }

  const { config, board, puzzle, size } = game;

  const isError = (r: number, c: number) =>
    errors.some(([er, ec]) => er === r && ec === c);
  const isGiven = (r: number, c: number) => puzzle[r][c] !== null;
  const isSelected = (r: number, c: number) =>
    selected !== null && selected[0] === r && selected[1] === c;

  const cellMax =
    size === 16 ? 28 : size === 9 ? 40 : 48;
  const gridMax = cellMax * size;
  const fontSize =
    size === 16
      ? "text-[10px] sm:text-xs"
      : size === 9
        ? "text-xs sm:text-sm"
        : "text-sm sm:text-base";

  return (
    <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
      {/* Tabs */}
      <GameTabs
        tabs={["play", "history"]}
        active={tab}
        onChange={(t) => setTab(t as Tab)}
        className="max-w-md"
      />

      {tab === "history" ? (
        <GameHistory
          entries={history.map((e) => ({
            id: e.id,
            label: `${e.size}×${e.size}`,
            timeLabel: formatTime(e.time),
            dateLabel: new Date(e.date).toLocaleDateString(),
            onShare: e.puzzleEncoded ? () => shareFromHistory(e) : undefined,
          } satisfies HistoryEntry))}
          onClear={() => { clearCompletedPuzzles(); setHistory([]); }}
          copied={copied}
        />
      ) : (
        <>
          {/* Size selector + Timer */}
          <div className="flex w-full max-w-md items-center justify-between">
            <div className="flex gap-1">
              {([6, 9, 16] as GameSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => requestNewGame(s)}
                  className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
                    size === s
                      ? "bg-accent text-background"
                      : "bg-card border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {s}x{s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {won && (
                <span className="text-sm font-medium text-accent">
                  Solved!
                </span>
              )}
              <button
                onClick={() => setPaused((p) => !p)}
                disabled={won}
                className="rounded border border-border bg-card px-2 py-1 text-xs font-mono text-muted transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={paused ? "Resume" : "Pause"}
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <span className="font-mono text-sm text-muted">
                {formatTime(timer)}
              </span>
            </div>
          </div>

          {/* Grid (with pause overlay) */}
          <div
            className="relative"
            style={{ width: `min(100%, ${gridMax}px)` }}
          >
          <div
            className={`grid select-none border-2 border-foreground/60 transition-[filter] duration-200 ${
              paused ? "blur-md pointer-events-none" : ""
            }`}
            style={{
              gridTemplateColumns: `repeat(${size}, 1fr)`,
              gridTemplateRows: `repeat(${size}, 1fr)`,
              width: "100%",
              aspectRatio: "1",
            }}
            aria-hidden={paused}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const rightBox =
                  (c + 1) % config.boxCols === 0 && c < size - 1;
                const bottomBox =
                  (r + 1) % config.boxRows === 0 && r < size - 1;

                let bg = "bg-card";
                if (isSelected(r, c)) bg = "bg-accent/20";
                else if (isError(r, c)) bg = "bg-red-500/20";

                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => setSelected([r, c])}
                    className={`
                      flex items-center justify-center
                      ${fontSize} font-mono font-bold
                      transition-colors cursor-pointer
                      ${bg}
                      ${rightBox ? "border-r-2 border-r-foreground/60" : "border-r border-r-border"}
                      ${bottomBox ? "border-b-2 border-b-foreground/60" : "border-b border-b-border"}
                      ${c === size - 1 ? "!border-r-0" : ""}
                      ${r === size - 1 ? "!border-b-0" : ""}
                      ${isGiven(r, c) ? "text-foreground" : "text-accent"}
                      ${isError(r, c) ? "!text-red-400" : ""}
                      hover:bg-accent/10
                    `}
                    aria-label={`Row ${r + 1} Column ${c + 1}${cell ? ` value ${config.symbols[cell - 1]}` : " empty"}`}
                  >
                    {cell ? config.symbols[cell - 1] : ""}
                  </button>
                );
              })
            )}
          </div>
            {paused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <span className="text-sm font-medium text-foreground tracking-wide">
                  Paused
                </span>
                <button
                  onClick={() => setPaused(false)}
                  className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
                >
                  Resume
                </button>
              </div>
            )}
          </div>

          {/* Number pad */}
          <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
            {config.symbols.map((sym, i) => {
              const full = (digitCounts[i + 1] ?? 0) >= size;
              return (
                <button
                  key={sym}
                  onClick={() => placeNumber(i + 1)}
                  disabled={full}
                  className={`flex items-center justify-center rounded-md border font-mono font-bold transition-colors ${
                    size === 16 ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-sm"
                  } ${
                    full
                      ? "border-border bg-card text-muted/30 cursor-not-allowed"
                      : "border-border bg-card text-foreground hover:bg-card-hover hover:border-accent/40 active:bg-accent/20"
                  }`}
                >
                  {sym}
                </button>
              );
            })}
            <button
              onClick={() => placeNumber(null)}
              className={`flex items-center justify-center rounded-md border border-border bg-card text-muted transition-colors hover:bg-card-hover hover:border-accent/40 active:bg-accent/20 ${
                size === 16 ? "h-8 w-8 text-xs" : "h-10 w-10 text-xs"
              }`}
              aria-label="Clear cell"
            >
              &times;
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={checkBoard}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card-hover hover:border-accent/40"
            >
              Check
            </button>
            <button
              onClick={shareCurrentPuzzle}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card-hover hover:border-accent/40"
            >
              {copied ? "Copied!" : "Share"}
            </button>
            <button
              onClick={() => setPendingReset(true)}
              disabled={won || !hasProgress()}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card-hover hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              onClick={() => requestNewGame()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              New Game
            </button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <p className="text-sm text-red-400">
              {errors.length} error{errors.length > 1 ? "s" : ""} found
            </p>
          )}

          {/* Controls help */}
          <p className="text-xs text-muted text-center max-w-xs">
            {size === 16
              ? "Keys: 1-9, A-G. Arrow keys to navigate. Backspace to clear."
              : `Keys: 1-${size}. Arrow keys to navigate. Backspace to clear.`}
          </p>

          {pendingReset && (
            <ConfirmDialog
              title="Reset puzzle?"
              message="Clear your progress on the current puzzle."
              confirmLabel="Yes"
              secondaryConfirmLabel="Yes + Timer"
              onConfirm={() => { setPendingReset(false); resetPuzzle(false); }}
              onSecondaryConfirm={() => { setPendingReset(false); resetPuzzle(true); }}
              onCancel={() => setPendingReset(false)}
            />
          )}

          {pendingNewGame !== undefined && (
            <ConfirmDialog
              title="Start a new puzzle?"
              message="Your current progress will be lost."
              confirmLabel="New Game"
              onConfirm={() => {
                const target = pendingNewGame;
                setPendingNewGame(undefined);
                newGame(target ?? undefined);
              }}
              onCancel={() => setPendingNewGame(undefined)}
            />
          )}

        </>
      )}
    </div>
  );
}

