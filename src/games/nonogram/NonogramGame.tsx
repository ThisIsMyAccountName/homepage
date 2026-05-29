"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  generatePuzzle,
  emptyGrid,
  isComplete,
  getErrors,
  isLineSatisfied,
  computeRowClues,
  computeColClues,
  type Grid,
  type NonogramPuzzle,
} from "./generator";
import { saveSession, loadSession, clearSession } from "./session";
import { logCompletion, getCompletedNonograms, clearCompletedNonograms, type CompletedNonogram } from "./history";
import { GameTabs } from "@/components/games/GameTabs";
import { GameHistory, type HistoryEntry } from "@/components/games/GameHistory";
import { ConfirmDialog } from "@/components/games/ConfirmDialog";
import { formatTime } from "@/lib/gameUtils";

const SIZES: { rows: number; cols: number; label: string; cellSize: number }[] =
  [
    { rows: 5, cols: 5, label: "5×5", cellSize: 40 },
    { rows: 7, cols: 7, label: "7×7", cellSize: 36 },
    { rows: 10, cols: 10, label: "10×10", cellSize: 32 },
  ];

function buildShareText(puzzle: NonogramPuzzle, time: number, errors: number): string {
  const rows = puzzle.solution
    .map((row) => row.map((cell) => (cell ? "🟩" : "⬛")).join(""))
    .join("\n");
  const errStr = errors > 0 ? ` · ${errors} errors` : "";
  return `Nonogram ${puzzle.rows}×${puzzle.cols}\n${rows}\n⏱ ${formatTime(time)}${errStr}`;
}

interface GameState {
  puzzle: NonogramPuzzle;
  grid: Grid;
  timer: number;
  sizeIdx: number;
}

function newGame(sizeIdx: number): GameState {
  const { rows, cols } = SIZES[sizeIdx];
  const puzzle = generatePuzzle(rows, cols);
  return { puzzle, grid: emptyGrid(rows, cols), timer: 0, sizeIdx };
}

export function NonogramGame() {
  const [tab, setTab] = useState<"play" | "history">("play");
  const [game, setGame] = useState<GameState>(() => {
    const saved = loadSession();
    if (saved) {
      const sizeIdx = SIZES.findIndex(
        (s) => s.rows === saved.rows && s.cols === saved.cols
      );
      const puzzle = {
        solution: saved.solution,
        rowClues: computeRowClues(saved.solution),
        colClues: computeColClues(saved.solution),
        rows: saved.rows,
        cols: saved.cols,
      };
      return {
        puzzle,
        grid: saved.grid,
        timer: saved.timer,
        sizeIdx: sizeIdx >= 0 ? sizeIdx : 1,
      };
    }
    return newGame(1); // default 7×7
  });
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [errorCount, setErrorCount] = useState(0);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [won, setWon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingNewSizeIdx, setPendingNewSizeIdx] = useState<number | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [history, setHistory] = useState<CompletedNonogram[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (!won) {
      intervalRef.current = setInterval(
        () => setGame((g) => ({ ...g, timer: g.timer + 1 })),
        1000
      );
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [won]);

  // Auto-save
  useEffect(() => {
    if (won) return;
    saveSession(
      game.puzzle.rows,
      game.puzzle.cols,
      game.puzzle.solution,
      game.grid,
      game.timer
    );
  }, [game, won]);

  // Load history when switching to history tab
  useEffect(() => {
    if (tab === "history") {
      setHistory(getCompletedNonograms());
    }
  }, [tab]);

  const resetPuzzle = useCallback((resetTimer: boolean) => {
    clearSession();
    setGame((g) => ({
      ...g,
      grid: emptyGrid(g.puzzle.rows, g.puzzle.cols),
      ...(resetTimer ? { timer: 0 } : {}),
    }));
    setErrors(new Set());
    setErrorCount(0);
    setWon(false);
  }, []);

  const startNewGame = useCallback(
    (sizeIdx: number) => {
      clearSession();
      const next = newGame(sizeIdx);
      setGame(next);
      setErrors(new Set());
      setErrorCount(0);
      setSelected(null);
      setWon(false);
    },
    []
  );

  const requestNewGame = useCallback(
    (sizeIdx: number) => {
      const hasProgress = game.grid.some((row) =>
        row.some((c) => c !== "empty")
      );
      if (hasProgress && !won) {
        setPendingNewSizeIdx(sizeIdx);
      } else {
        startNewGame(sizeIdx);
      }
    },
    [game.grid, won, startNewGame]
  );

  const applyToggle = useCallback(
    (r: number, c: number, applyMode: "fill" | "mark") => {
      if (won) return;

      const newGrid = game.grid.map((row) => [...row]) as Grid;
      const cur = newGrid[r][c];

      if (applyMode === "fill") {
        newGrid[r][c] = cur === "filled" ? "empty" : "filled";
      } else {
        newGrid[r][c] = cur === "marked" ? "empty" : "marked";
      }

      setGame((g) => ({ ...g, grid: newGrid }));
      setErrors(new Set());

      if (isComplete(newGrid, game.puzzle.rowClues, game.puzzle.colClues)) {
        setWon(true);
        logCompletion({
          id: crypto.randomUUID(),
          rows: game.puzzle.rows,
          cols: game.puzzle.cols,
          time: game.timer,
          errors: errorCount,
          date: new Date().toISOString(),
        });
        clearSession();
      }
    },
    [won, game, errorCount]
  );

  const checkBoard = useCallback(() => {
    const errs = getErrors(game.grid, game.puzzle.rowClues, game.puzzle.colClues);
    setErrors(new Set(errs.map(([r, c]) => `${r}-${c}`)));
    if (errs.length > 0) setErrorCount((n) => n + errs.length);
  }, [game.grid, game.puzzle.rowClues, game.puzzle.colClues]);

  const shareResult = useCallback(() => {
    navigator.clipboard.writeText(buildShareText(game.puzzle, game.timer, errorCount)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [game.puzzle, game.timer, errorCount]);

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (tab !== "play") return;
      if (e.target instanceof HTMLInputElement) return;
      const { rows, cols } = game.puzzle;
      if (e.key === "ArrowUp" && selected) {
        e.preventDefault();
        setSelected([Math.max(0, selected[0] - 1), selected[1]]);
      } else if (e.key === "ArrowDown" && selected) {
        e.preventDefault();
        setSelected([Math.min(rows - 1, selected[0] + 1), selected[1]]);
      } else if (e.key === "ArrowLeft" && selected) {
        e.preventDefault();
        setSelected([selected[0], Math.max(0, selected[1] - 1)]);
      } else if (e.key === "ArrowRight" && selected) {
        e.preventDefault();
        setSelected([selected[0], Math.min(cols - 1, selected[1] + 1)]);
      } else if ((e.key === " " || e.key === "Enter") && selected) {
        e.preventDefault();
        applyToggle(selected[0], selected[1], "fill");
      } else if ((e.key === "x" || e.key === "X") && selected) {
        applyToggle(selected[0], selected[1], "mark");
      } else if (e.key === "Backspace" && selected) {
        const [r, c] = selected;
        const newGrid = game.grid.map((row) => [...row]) as Grid;
        newGrid[r][c] = "empty";
        setGame((g) => ({ ...g, grid: newGrid }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, applyToggle, game, tab]);

  const { puzzle, grid, timer, sizeIdx } = game;
  const { rowClues, colClues, solution } = puzzle;
  const cellSize = SIZES[sizeIdx]?.cellSize ?? 36;

  const maxRowClueLen = Math.max(...rowClues.map((r) => r.length));
  const maxColClueLen = Math.max(...colClues.map((c) => c.length));
  const rowClueW = maxRowClueLen * 18 + 8;
  const colClueH = maxColClueLen * 14 + 6;

  const historyEntries: HistoryEntry[] = history.map((e) => ({
    id: e.id,
    label: `${e.rows}×${e.cols}`,
    timeLabel: formatTime(e.time),
    dateLabel:
      e.puzzleDate ??
      new Date(e.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    badge: e.errors > 0 ? `+${e.errors}err` : undefined,
  }));

  return (
    <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
      {/* Tabs */}
      <GameTabs
        tabs={["play", "history"]}
        active={tab}
        onChange={(t) => setTab(t as "play" | "history")}
        className="max-w-md"
      />

      {tab === "history" && (
        <GameHistory
          entries={historyEntries}
          onClear={() => { clearCompletedNonograms(); setHistory([]); }}
        />
      )}

      {tab === "play" && (
        <>
          {/* Controls bar */}
          <div className="flex w-full max-w-md items-center justify-between">
            <div className="flex gap-1">
              {SIZES.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => requestNewGame(i)}
                  className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
                    sizeIdx === i
                      ? "bg-accent text-background"
                      : "bg-card border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {won && (
                <span className="text-sm font-medium text-accent">Solved!</span>
              )}
              {errorCount > 0 && (
                <span className="text-xs text-red-400">{errorCount} errors</span>
              )}
              <span className="font-mono text-sm text-muted">
                {formatTime(timer)}
              </span>
            </div>
          </div>

          {/* Puzzle grid */}
          <div className="select-none overflow-x-auto">
            {/* Column clues */}
            <div className="flex" style={{ paddingLeft: rowClueW }}>
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
                        className={`font-mono text-[11px] leading-[14px] ${
                          satisfied ? "text-foreground/25" : "text-muted"
                        }`}
                      >
                        {n === 0 ? " " : n}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Grid rows */}
            {grid.map((row, r) => {
              const satisfied = isLineSatisfied(row, rowClues[r]);
              return (
                <div key={r} className="flex">
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
                        {n === 0 ? " " : n}
                      </span>
                    ))}
                  </div>
                  {row.map((cell, c) => {
                    const isErr = errors.has(`${r}-${c}`);
                    const isSel =
                      selected?.[0] === r && selected?.[1] === c;
                    return (
                      <button
                        key={c}
                        style={{ width: cellSize, height: cellSize }}
                        onClick={() => {
                          setSelected([r, c]);
                          applyToggle(r, c, "fill");
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelected([r, c]);
                          applyToggle(r, c, "mark");
                        }}
                        className={[
                          "border border-border flex items-center justify-center text-xs font-mono transition-colors",
                          cell === "filled" && !isErr
                            ? "bg-accent border-accent text-background"
                            : "",
                          cell === "filled" && isErr
                            ? "bg-red-500/40 border-red-400"
                            : "",
                          cell === "marked" ? "bg-card text-muted" : "",
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

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-2">
            {!won && (
              <button
                onClick={checkBoard}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card-hover hover:border-accent/40"
              >
                Check
              </button>
            )}
            {won && (
              <button
                onClick={shareResult}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card-hover hover:border-accent/40"
              >
                {copied ? "Copied!" : "Share result"}
              </button>
            )}
            {!won && (
              <button
                onClick={() => setPendingReset(true)}
                disabled={!game.grid.some((row) => row.some((c) => c !== "empty"))}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card-hover hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            )}
            <button
              onClick={() => requestNewGame(sizeIdx)}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              New Game
            </button>
          </div>

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

          {pendingNewSizeIdx !== null && (
            <ConfirmDialog
              title="Start a new puzzle?"
              message="Your current progress will be lost."
              confirmLabel="New Game"
              onConfirm={() => {
                const target = pendingNewSizeIdx;
                setPendingNewSizeIdx(null);
                startNewGame(target);
              }}
              onCancel={() => setPendingNewSizeIdx(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
