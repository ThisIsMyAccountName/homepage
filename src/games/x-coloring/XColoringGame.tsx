"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { conflicts as computeConflicts } from "@/lib/graph";
import {
  generatePuzzle,
  randomSeed,
  encodePuzzle,
  decodePuzzle,
  type Puzzle,
} from "./generator";
import {
  DIFFICULTIES,
  DIFFICULTY_KEYS,
  type DifficultyKey,
} from "./difficulty";
import {
  saveRegularSession,
  loadRegularSession,
  clearRegularSession,
} from "./session";
import {
  logCompletion,
  getCompletedPuzzles,
  clearCompletedPuzzles,
  type CompletedPuzzle,
} from "./history";
import { GameTabs } from "@/components/games/GameTabs";
import { GameHistory, type HistoryEntry } from "@/components/games/GameHistory";
import { ConfirmDialog } from "@/components/games/ConfirmDialog";
import { GraphBoard } from "@/components/games/GraphBoard";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type Tab = "play" | "history";

interface GameState {
  puzzle: Puzzle;
  /** -1 means uncolored, else palette index. */
  coloring: number[];
}

function emptyColoring(n: number): number[] {
  return new Array<number>(n).fill(-1);
}

function applyGivens(puzzle: Puzzle, coloring: number[]): number[] {
  const next = [...coloring];
  for (const [idStr, colorIdx] of Object.entries(puzzle.givens)) {
    next[parseInt(idStr)] = colorIdx;
  }
  return next;
}

function newGame(difficulty: DifficultyKey): GameState {
  const seed = randomSeed();
  const puzzle = generatePuzzle(difficulty, seed);
  return { puzzle, coloring: applyGivens(puzzle, emptyColoring(puzzle.graph.nodes.length)) };
}

export function XColoringGame() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [game, setGame] = useState<GameState | null>(null);
  const [brush, setBrush] = useState<number>(0);
  /** Conflicts shown after a Check press; cleared on next move. */
  const [shownConflicts, setShownConflicts] = useState<{
    edges: Set<number>;
    uniqueViolators: Set<number>;
    forbiddenPairViolators: Set<number>;
  }>({ edges: new Set(), uniqueViolators: new Set(), forbiddenPairViolators: new Set() });
  const [selected, setSelected] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [won, setWon] = useState(false);
  const [tab, setTab] = useState<Tab>("play");
  const [history, setHistory] = useState<CompletedPuzzle[]>([]);
  const [copied, setCopied] = useState(false);
  const [pendingNew, setPendingNew] = useState<DifficultyKey | null | undefined>(
    undefined
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);

  // Initialize once on the client (random puzzle gen → must avoid hydration mismatch).
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setHistory(getCompletedPuzzles());

    const shareParam = searchParams.get("p");
    if (shareParam) {
      const decoded = decodePuzzle(shareParam);
      if (decoded) {
        const puzzle = generatePuzzle(decoded.difficulty, decoded.seed);
        setGame({ puzzle, coloring: emptyColoring(puzzle.graph.nodes.length) });
        setRunning(true);
        return;
      }
    }

    const saved = loadRegularSession();
    if (saved) {
      const puzzle = generatePuzzle(saved.difficulty, saved.seed);
      // Defend against difficulty changes affecting nodeCount.
      let coloring =
        saved.coloring.length === puzzle.graph.nodes.length
          ? saved.coloring
          : emptyColoring(puzzle.graph.nodes.length);
      // Re-apply givens in case the session predates the givens feature.
      coloring = applyGivens(puzzle, coloring);
      setGame({ puzzle, coloring });
      setTimer(saved.timer ?? 0);
      setRunning(true);
      return;
    }

    setGame(newGame("easy"));
    setRunning(true);
  }, [searchParams]);

  // Has the player started coloring? Givens don't count as player progress.
  const hasProgress = useCallback((): boolean => {
    if (!game || won) return false;
    return game.coloring.some((c, i) => c !== -1 && !(i in game.puzzle.givens));
  }, [game, won]);

  const restartCurrentPuzzle = useCallback(() => {
    if (!game) return;
    clearRegularSession();
    const coloring = applyGivens(game.puzzle, emptyColoring(game.puzzle.graph.nodes.length));
    setGame({ puzzle: game.puzzle, coloring });
    setSelected(null);
    setShownConflicts({ edges: new Set(), uniqueViolators: new Set(), forbiddenPairViolators: new Set() });
    setTimer(0);
    setRunning(true);
    setPaused(false);
    setWon(false);
  }, [game]);

  const startNewGame = useCallback(
    (difficulty?: DifficultyKey) => {
      const d = difficulty ?? game?.puzzle.difficulty ?? "easy";
      clearRegularSession();
      setGame(newGame(d));
      setSelected(null);
      setShownConflicts({ edges: new Set(), uniqueViolators: new Set(), forbiddenPairViolators: new Set() });
      setTimer(0);
      setRunning(true);
      setPaused(false);
      setWon(false);
      router.replace("/games/x-coloring", { scroll: false });
    },
    [game?.puzzle.difficulty, router]
  );

  const requestNewGame = useCallback(
    (difficulty?: DifficultyKey) => {
      if (hasProgress()) {
        setPendingNew(difficulty ?? null);
      } else {
        startNewGame(difficulty);
      }
    },
    [hasProgress, startNewGame]
  );

  // Timer
  useEffect(() => {
    if (running && !paused && !won && game) {
      intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, paused, won, game]);

  // Auto-save
  useEffect(() => {
    if (!game || won) return;
    saveRegularSession({
      difficulty: game.puzzle.difficulty,
      seed: game.puzzle.seed,
      coloring: game.coloring,
      timer,
    });
  }, [game, timer, won]);

  const applyColor = useCallback(
    (nodeId: number, colorIdx: number | null) => {
      if (!game || won || paused) return;
      // Given nodes are locked — ignore attempts to recolor them.
      if (nodeId in game.puzzle.givens) return;
      const next = [...game.coloring];
      next[nodeId] = colorIdx === null ? -1 : colorIdx;
      const updated: GameState = { puzzle: game.puzzle, coloring: next };
      setGame(updated);
      setShownConflicts({ edges: new Set(), uniqueViolators: new Set(), forbiddenPairViolators: new Set() });

      // Win check: all nodes colored AND no conflicts (edge, unique-neighbour, forbidden-pair).
      if (next.every((c) => c !== -1)) {
        const coloringNullable = next.map((c) => (c === -1 ? null : c));
        const uniqueSet = new Set(game.puzzle.uniqueNeighbourNodes);
        const conf = computeConflicts(
          game.puzzle.graph,
          coloringNullable,
          uniqueSet,
          game.puzzle.forbiddenPairs
        );
        if (conf.edges.size === 0 && conf.uniqueViolators.size === 0 && conf.forbiddenPairViolators.size === 0) {
          setWon(true);
          setRunning(false);
          clearRegularSession();
          const entry: CompletedPuzzle = {
            id: Date.now().toString(36),
            difficulty: game.puzzle.difficulty,
            time: timer,
            date: new Date().toISOString(),
            errors: 0,
            encoded: encodePuzzle(game.puzzle.difficulty, game.puzzle.seed),
          };
          logCompletion(entry);
          setHistory(getCompletedPuzzles());
        }
      }
    },
    [game, won, paused, timer]
  );

  const onNodeClick = useCallback(
    (nodeId: number) => {
      if (!game || won || paused) return;
      setSelected(nodeId);
      applyColor(nodeId, brush);
    },
    [game, won, paused, brush, applyColor]
  );

  const checkBoard = useCallback(() => {
    if (!game) return;
    const coloringNullable = game.coloring.map((c) => (c === -1 ? null : c));
    const uniqueSet = new Set(game.puzzle.uniqueNeighbourNodes);
    setShownConflicts(
      computeConflicts(game.puzzle.graph, coloringNullable, uniqueSet, game.puzzle.forbiddenPairs)
    );
  }, [game]);

  const shareCurrentPuzzle = useCallback(() => {
    if (!game) return;
    const enc = encodePuzzle(game.puzzle.difficulty, game.puzzle.seed);
    const url = `${window.location.origin}/games/x-coloring?p=${enc}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [game]);

  const shareFromHistory = useCallback((entry: CompletedPuzzle) => {
    if (!entry.encoded) return;
    const url = `${window.location.origin}/games/x-coloring?p=${entry.encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  // Keyboard: digit keys pick color, Backspace clears the last-selected node.
  useEffect(() => {
    if (!game) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (paused) return;
      const colors = game.puzzle.colors;
      const num = parseInt(e.key, 10);
      if (Number.isFinite(num) && num >= 1 && num <= colors) {
        setBrush(num - 1);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selected !== null) applyColor(selected, null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game, paused, selected, applyColor]);

  const filledCount = useMemo(
    () => game?.coloring.filter((c) => c !== -1).length ?? 0,
    [game?.coloring]
  );

  const givenNodes = useMemo(
    () => new Set(Object.keys(game?.puzzle.givens ?? {}).map(Number)),
    [game?.puzzle.givens]
  );

  const colorsUsed = useMemo(
    () => (won && game ? new Set(game.coloring.filter((c) => c !== -1)).size : 0),
    [won, game]
  );

  if (!game) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted">
        Generating puzzle...
      </div>
    );
  }

  const { puzzle } = game;
  const cfg = DIFFICULTIES[puzzle.difficulty];
  const uniqueNodeSet = new Set(puzzle.uniqueNeighbourNodes);

  const historyEntries: HistoryEntry[] = history.map((e) => ({
    id: e.id,
    label: DIFFICULTIES[e.difficulty]?.label ?? e.difficulty,
    timeLabel: formatTime(e.time),
    dateLabel: new Date(e.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    onShare: e.encoded ? () => shareFromHistory(e) : undefined,
  }));

  return (
    <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
      <GameTabs
        tabs={["play", "history"]}
        active={tab}
        onChange={(t) => setTab(t as Tab)}
        className="max-w-md"
      />

      {tab === "history" ? (
        <GameHistory
          entries={historyEntries}
          onClear={() => {
            clearCompletedPuzzles();
            setHistory([]);
          }}
          copied={copied}
        />
      ) : (
        <>
          {/* Difficulty + timer */}
          <div className="flex w-full max-w-md items-center justify-between">
            <div className="flex gap-1">
              {DIFFICULTY_KEYS.map((d) => (
                <button
                  key={d}
                  onClick={() => requestNewGame(d)}
                  className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
                    puzzle.difficulty === d
                      ? "bg-accent text-background"
                      : "bg-card border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {DIFFICULTIES[d].label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {won && (
                <span className="text-sm font-medium text-accent">Solved!</span>
              )}
              <button
                onClick={() => setPaused((p) => !p)}
                disabled={won}
                className="rounded border border-border bg-card px-2 py-1 text-xs font-mono text-muted transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <span className="font-mono text-sm text-muted">
                {formatTime(timer)}
              </span>
            </div>
          </div>

          {/* Board */}
          <div
            className="relative"
            style={{ width: `min(100%, 480px)` }}
          >
            <div
              className={`transition-[filter] duration-200 ${
                paused ? "blur-md pointer-events-none" : ""
              }`}
              aria-hidden={paused}
            >
              <GraphBoard
                graph={puzzle.graph}
                nodeColors={game.coloring.map((c) => (c === -1 ? null : c))}
                palette={puzzle.palette}
                selectedNode={selected}
                conflicts={shownConflicts.edges}
                forbiddenPairs={puzzle.forbiddenPairs}
                forbiddenPairViolators={shownConflicts.forbiddenPairViolators}
                givenNodes={givenNodes}
                uniqueNodes={uniqueNodeSet}
                uniqueViolators={shownConflicts.uniqueViolators}
                onNodeClick={onNodeClick}
                size={480}
              />
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

          {/* Color palette */}
          <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
            {puzzle.palette.map((color, i) => {
              const active = brush === i;
              return (
                <button
                  key={i}
                  onClick={() => setBrush(i)}
                  className={`flex h-10 w-10 items-center justify-center rounded-md border-2 font-mono text-xs font-bold transition-colors ${
                    active
                      ? "border-foreground"
                      : "border-border hover:border-accent/40"
                  }`}
                  style={{
                    backgroundColor: color,
                    color: "rgba(0,0,0,0.85)",
                  }}
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
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-muted transition-colors hover:bg-card-hover hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Clear selected node"
              title="Clear selected node"
            >
              &times;
            </button>
          </div>

          {/* Stats line */}
          <p className="text-xs text-muted">
            {filledCount}/{cfg.nodeCount} nodes colored
            {puzzle.chromaticMode && won && (
              <>
                <span className="ml-2 text-accent">
                  {colorsUsed} color{colorsUsed !== 1 ? "s" : ""} used
                  {puzzle.chromaticNumber !== undefined && (
                    <> · min {puzzle.chromaticNumber}{colorsUsed === puzzle.chromaticNumber ? " — optimal!" : ""}</>
                  )}
                </span>
                {puzzle.chromaticNumber !== undefined && colorsUsed > puzzle.chromaticNumber && (
                  <button
                    onClick={restartCurrentPuzzle}
                    className="ml-2 text-xs text-accent hover:underline"
                  >
                    Try with {puzzle.chromaticNumber}
                  </button>
                )}
              </>
            )}
            {shownConflicts.edges.size > 0 && (
              <span className="ml-2 text-red-400">
                {shownConflicts.edges.size} edge conflict
                {shownConflicts.edges.size === 1 ? "" : "s"}
              </span>
            )}
            {shownConflicts.uniqueViolators.size > 0 && (
              <span className="ml-2 text-red-400">
                {shownConflicts.uniqueViolators.size} ringed-node violation
                {shownConflicts.uniqueViolators.size === 1 ? "" : "s"}
              </span>
            )}
            {shownConflicts.forbiddenPairViolators.size > 0 && (
              <span className="ml-2 text-red-400">
                {shownConflicts.forbiddenPairViolators.size} forbidden-pair conflict
                {shownConflicts.forbiddenPairViolators.size === 1 ? "" : "s"}
              </span>
            )}
          </p>

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
              onClick={() => requestNewGame()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              New Game
            </button>
          </div>

          <ul className="text-xs text-muted space-y-0.5 list-disc list-inside text-left max-w-xs">
            {puzzle.chromaticMode
              ? <li>Use as few colors as possible</li>
              : <li>No two connected nodes may share a color</li>
            }
            {puzzle.uniqueNeighbourNodes.length > 0 && (
              <li><span className="text-foreground">Ringed nodes:</span> all neighbors need distinct colors</li>
            )}
            {puzzle.forbiddenPairs.length > 0 && (
              <li><span className="text-amber-400">Dashed lines:</span> those nodes can&apos;t share a color</li>
            )}
            {givenNodes.size > 0 && (
              <li><span className="text-foreground">Bold nodes</span> are pre-colored and locked</li>
            )}
            <li className="opacity-60">Keys 1–{puzzle.colors} to pick color · Backspace to clear</li>
          </ul>

          {pendingNew !== undefined && (
            <ConfirmDialog
              title="Start a new puzzle?"
              message="Your current progress will be lost."
              confirmLabel="New Game"
              onConfirm={() => {
                const target = pendingNew;
                setPendingNew(undefined);
                startNewGame(target ?? undefined);
              }}
              onCancel={() => setPendingNew(undefined)}
            />
          )}
        </>
      )}
    </div>
  );
}

