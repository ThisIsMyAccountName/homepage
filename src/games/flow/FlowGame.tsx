"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  generatePuzzle,
  randomSeed,
  encodePuzzle,
  decodePuzzle,
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
  type PushRecord,
} from "./session";
import {
  logCompletion,
  getCompletedPuzzles,
  clearCompletedPuzzles,
  type CompletedPuzzle,
} from "./history";
import {
  emptyFlow,
  flowValue,
  isPathValid,
  pushPath,
  candidateNextNodes,
  findAugmentingPath,
  type FlowPuzzle,
  type PathStep,
} from "./solver";
import { GameTabs } from "@/components/games/GameTabs";
import { GameHistory, type HistoryEntry } from "@/components/games/GameHistory";
import { ConfirmDialog } from "@/components/games/ConfirmDialog";
import { FlowBoard } from "@/components/games/FlowBoard";
import { formatTime } from "@/lib/gameUtils";

type Tab = "play" | "history";

interface GameState {
  puzzle: FlowPuzzle;
  flow: number[];
  pushes: PushRecord[];
}

function newGame(difficulty: DifficultyKey): GameState {
  const seed = randomSeed();
  const puzzle = generatePuzzle(difficulty, seed);
  return { puzzle, flow: emptyFlow(puzzle.edges.length), pushes: [] };
}

export function FlowGame() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [game, setGame] = useState<GameState | null>(null);
  const [pathInProgress, setPathInProgress] = useState<number[]>([]);
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
  const [pendingReset, setPendingReset] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);

  // Init once on client.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setHistory(getCompletedPuzzles());

    const shareParam = searchParams.get("p");
    if (shareParam) {
      const decoded = decodePuzzle(shareParam);
      if (decoded) {
        const puzzle = generatePuzzle(decoded.difficulty, decoded.seed);
        setGame({ puzzle, flow: emptyFlow(puzzle.edges.length), pushes: [] });
        setPathInProgress([puzzle.s]);
        setRunning(true);
        return;
      }
    }

    const saved = loadRegularSession();
    if (saved) {
      const puzzle = generatePuzzle(saved.difficulty, saved.seed);
      // Defend against shape mismatch from version drift.
      const flow =
        saved.flow.length === puzzle.edges.length
          ? saved.flow
          : emptyFlow(puzzle.edges.length);
      setGame({ puzzle, flow, pushes: saved.pushes });
      setPathInProgress([puzzle.s]);
      setTimer(saved.timer ?? 0);
      setRunning(true);
      return;
    }

    const fresh = newGame("easy");
    setGame(fresh);
    setPathInProgress([fresh.puzzle.s]);
    setRunning(true);
  }, [searchParams]);

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
      flow: game.flow,
      pushes: game.pushes,
      timer,
    });
  }, [game, timer, won]);

  // Resolved residual hops along the current path-in-progress.
  const selectedValidation = useMemo(() => {
    if (!game || pathInProgress.length < 2) {
      return { ok: true, steps: [] as PathStep[], bottleneck: 0 };
    }
    return isPathValid(game.puzzle, game.flow, pathInProgress);
  }, [game, pathInProgress]);

  // Nodes the player may click next from the tail of pathInProgress.
  const candidates = useMemo(() => {
    if (!game || pathInProgress.length === 0) return new Set<number>();
    const tail = pathInProgress[pathInProgress.length - 1];
    return candidateNextNodes(game.puzzle, game.flow, tail);
  }, [game, pathInProgress]);

  const pathComplete =
    !!game &&
    pathInProgress.length >= 2 &&
    pathInProgress[pathInProgress.length - 1] === game.puzzle.t &&
    selectedValidation.ok &&
    selectedValidation.bottleneck > 0;

  const hasProgress = useCallback((): boolean => {
    if (!game || won) return false;
    return game.pushes.length > 0;
  }, [game, won]);

  const clearPath = useCallback(() => {
    if (!game) return;
    setPathInProgress([game.puzzle.s]);
  }, [game]);

  const onNodeClick = useCallback(
    (nodeId: number) => {
      if (!game || won || paused) return;
      // First click must establish s (it's always s, but guard).
      if (pathInProgress.length === 0) {
        if (nodeId === game.puzzle.s) setPathInProgress([game.puzzle.s]);
        return;
      }
      const last = pathInProgress[pathInProgress.length - 1];
      if (nodeId === last) {
        // Click on tail: pop unless we'd remove s.
        if (pathInProgress.length > 1) {
          setPathInProgress(pathInProgress.slice(0, -1));
        }
        return;
      }
      // Click on an earlier node in the path: truncate to that point.
      const existingIdx = pathInProgress.indexOf(nodeId);
      if (existingIdx >= 0) {
        setPathInProgress(pathInProgress.slice(0, existingIdx + 1));
        return;
      }
      // Append if it's a valid next-step.
      if (candidates.has(nodeId)) {
        setPathInProgress([...pathInProgress, nodeId]);
      }
    },
    [game, won, paused, pathInProgress, candidates]
  );

  const commitPush = useCallback(() => {
    if (!game || won) return;
    if (!pathComplete) return;
    const amount = selectedValidation.bottleneck;
    const newFlow = pushPath(game.flow, selectedValidation.steps, amount);
    const record: PushRecord = {
      nodes: pathInProgress.slice(),
      steps: selectedValidation.steps.slice(),
      amount,
    };
    const updated: GameState = {
      puzzle: game.puzzle,
      flow: newFlow,
      pushes: [...game.pushes, record],
    };
    setGame(updated);
    setPathInProgress([game.puzzle.s]);

    // Win check: no more augmenting paths.
    if (!findAugmentingPath(updated.puzzle, updated.flow)) {
      setWon(true);
      setRunning(false);
      clearRegularSession();
      const entry: CompletedPuzzle = {
        id: Date.now().toString(36),
        difficulty: updated.puzzle.difficulty,
        time: timer,
        date: new Date().toISOString(),
        maxFlow: updated.puzzle.maxFlow,
        pushes: updated.pushes.length,
        encoded: encodePuzzle(updated.puzzle.difficulty, updated.puzzle.seed),
      };
      logCompletion(entry);
      setHistory(getCompletedPuzzles());
    }
  }, [game, won, pathComplete, selectedValidation, pathInProgress, timer]);

  const undoPush = useCallback(() => {
    if (!game || game.pushes.length === 0) return;
    const last = game.pushes[game.pushes.length - 1];
    const restored = pushPath(game.flow, last.steps, -last.amount);
    setGame({
      puzzle: game.puzzle,
      flow: restored,
      pushes: game.pushes.slice(0, -1),
    });
    setPathInProgress([game.puzzle.s]);
    if (won) {
      setWon(false);
      setRunning(true);
    }
  }, [game, won]);

  const resetPuzzle = useCallback(
    (resetTimer: boolean) => {
      if (!game) return;
      clearRegularSession();
      setGame({
        puzzle: game.puzzle,
        flow: emptyFlow(game.puzzle.edges.length),
        pushes: [],
      });
      setPathInProgress([game.puzzle.s]);
      if (resetTimer) setTimer(0);
      setRunning(true);
      setPaused(false);
      setWon(false);
    },
    [game]
  );

  const startNewGame = useCallback(
    (difficulty?: DifficultyKey) => {
      const d = difficulty ?? game?.puzzle.difficulty ?? "easy";
      clearRegularSession();
      const fresh = newGame(d);
      setGame(fresh);
      setPathInProgress([fresh.puzzle.s]);
      setTimer(0);
      setRunning(true);
      setPaused(false);
      setWon(false);
      router.replace("/games/flow", { scroll: false });
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

  const shareCurrentPuzzle = useCallback(() => {
    if (!game) return;
    const enc = encodePuzzle(game.puzzle.difficulty, game.puzzle.seed);
    const url = `${window.location.origin}/games/flow?p=${enc}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [game]);

  const shareFromHistory = useCallback((entry: CompletedPuzzle) => {
    if (!entry.encoded) return;
    const url = `${window.location.origin}/games/flow?p=${entry.encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const currentFlowValue = useMemo(
    () => (game ? flowValue(game.puzzle, game.flow) : 0),
    [game]
  );

  if (!game) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted">
        Generating puzzle...
      </div>
    );
  }

  const { puzzle } = game;
  const historyEntries: HistoryEntry[] = history.map((e) => ({
    id: e.id,
    label: DIFFICULTIES[e.difficulty]?.label ?? e.difficulty,
    timeLabel: formatTime(e.time),
    dateLabel: new Date(e.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    badge: `${e.maxFlow}u · ${e.pushes} push${e.pushes === 1 ? "" : "es"}`,
    onShare: e.encoded ? () => shareFromHistory(e) : undefined,
  }));

  let statusMessage = "";
  if (won) {
    statusMessage = `Max flow ${puzzle.maxFlow} reached in ${game.pushes.length} push${game.pushes.length === 1 ? "" : "es"}.`;
  } else if (pathInProgress.length === 1) {
    statusMessage = "Click a neighbor of S to start a path.";
  } else if (pathComplete) {
    statusMessage = `Bottleneck along this path: ${selectedValidation.bottleneck} unit${selectedValidation.bottleneck === 1 ? "" : "s"}. Press Push to commit.`;
  } else if (candidates.size === 0) {
    statusMessage = "Dead end — no residual capacity from here. Click an earlier node or Clear.";
  } else {
    statusMessage = "Keep clicking nodes toward T.";
  }

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
              <FlowBoard
                puzzle={puzzle}
                flow={game.flow}
                selectedPath={pathInProgress}
                selectedSteps={selectedValidation.steps}
                candidateNodes={candidates}
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

          {/* Flow value */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted">
              Current flow:{" "}
              <span className="font-mono text-foreground">{currentFlowValue}</span>
              {" "}/{" "}
              <span className="font-mono text-foreground">{puzzle.maxFlow}</span>
            </span>
            <span className="text-muted">
              Pushes:{" "}
              <span className="font-mono text-foreground">{game.pushes.length}</span>
            </span>
          </div>

          {/* Path status */}
          <p className="text-xs text-muted text-center max-w-md min-h-[1rem]">
            {statusMessage}
          </p>

          {/* Path actions */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={commitPush}
              disabled={!pathComplete || won}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pathComplete
                ? `Push +${selectedValidation.bottleneck}`
                : "Push"}
            </button>
            <button
              onClick={clearPath}
              disabled={pathInProgress.length <= 1 || won}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card-hover hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear Path
            </button>
            <button
              onClick={undoPush}
              disabled={game.pushes.length === 0}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card-hover hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Undo
            </button>
          </div>

          {/* Game actions */}
          <div className="flex flex-wrap justify-center gap-2">
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

          <ul className="text-xs text-muted space-y-0.5 list-disc list-inside text-left max-w-xs">
            <li>
              <span className="text-foreground">Click</span> a sequence of nodes from{" "}
              <span style={{ color: "#10b981" }}>S</span> to{" "}
              <span style={{ color: "#f43f5e" }}>T</span>, then Push.
            </li>
            <li>
              Each push sends the path&apos;s <span className="text-foreground">bottleneck</span> capacity.
            </li>
            <li>
              Once an edge has flow, you can traverse it{" "}
              <span style={{ color: "#f59e0b" }}>backwards</span> to cancel.
            </li>
            <li>Win when no s→t path remains in the residual graph.</li>
          </ul>

          {pendingReset && (
            <ConfirmDialog
              title="Reset puzzle?"
              message="Clear all pushes on the current puzzle."
              confirmLabel="Yes"
              secondaryConfirmLabel="Yes + Timer"
              onConfirm={() => { setPendingReset(false); resetPuzzle(false); }}
              onSecondaryConfirm={() => { setPendingReset(false); resetPuzzle(true); }}
              onCancel={() => setPendingReset(false)}
            />
          )}

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
