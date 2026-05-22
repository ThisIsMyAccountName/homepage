"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { siteConfig } from "@/lib/config";
import {
  ADVANCE_LABELS,
  DailyCompletionCard,
} from "@/components/daily/DailyCompletionCard";
import { DailyLeaderboardPanel } from "@/components/daily/DailyLeaderboardPanel";
import { DailyRecap } from "@/components/daily/DailyRecap";
import { DailyStepper } from "@/components/daily/DailyStepper";
import { fetchDailyCrossword } from "@/games/crossword/dailyFetch";
import { getTodayKey } from "@/lib/daily";
import {
  DAILY_GAMES,
  GAME_LABELS,
  allComplete,
  nextIncompleteGame,
  readDailyProgress,
  recordCompletion,
  type DailyGameId,
  type DailyProgress,
} from "@/lib/dailyProgress";

const GameLoader = (
  <div className="flex items-center justify-center p-8 text-sm text-muted">
    Loading daily puzzle...
  </div>
);

const DailySudoku = dynamic(
  () =>
    import("@/games/daily/DailySudoku").then((m) => ({
      default: m.DailySudoku,
    })),
  { ssr: false, loading: () => GameLoader }
);

const DailyNonogram = dynamic(
  () =>
    import("@/games/daily/DailyNonogram").then((m) => ({
      default: m.DailyNonogram,
    })),
  { ssr: false, loading: () => GameLoader }
);

const DailyXColoring = dynamic(
  () =>
    import("@/games/daily/DailyXColoring").then((m) => ({
      default: m.DailyXColoring,
    })),
  { ssr: false, loading: () => GameLoader }
);

const DailyCrossword = dynamic(
  () =>
    import("@/games/daily/DailyCrossword").then((m) => ({
      default: m.DailyCrossword,
    })),
  { ssr: false, loading: () => GameLoader }
);

const DailyCryptic = dynamic(
  () =>
    import("@/games/daily/DailyCryptic").then((m) => ({
      default: m.DailyCryptic,
    })),
  { ssr: false, loading: () => GameLoader }
);

const DailyCrosswordSolution = dynamic(
  () =>
    import("@/games/daily/DailyCrosswordSolution").then((m) => ({
      default: m.DailyCrosswordSolution,
    })),
  { ssr: false, loading: () => GameLoader }
);

/**
 * Lookup for the games that share the simple `(time, errors)` completion
 * signature. Crossword reports an extra `puzzleId` so it's rendered out
 * of band below — keeping it out of this map preserves the strict type
 * on the shared dispatcher.
 */
const SIMPLE_GAME_COMPONENT: Record<
  Exclude<DailyGameId, "crossword">,
  React.ComponentType<{ onComplete: (time: number, errors: number) => void }>
> = {
  sudoku: DailySudoku,
  nonogram: DailyNonogram,
  "x-coloring": DailyXColoring,
  cryptic: DailyCryptic,
};

type Step = DailyGameId | "recap";

/**
 * Top-level coordinator for the daily section. Owns progress state, decides
 * which step is active, swaps in either the playable game or the completion
 * card for that step, and renders the leaderboard alongside.
 */
export function DailyHub() {
  // Progress + initial step read from localStorage. Safe to do here because
  // this component is mounted via `dynamic(..., { ssr: false })` in page.tsx
  // — it only ever runs on the client.
  const [progress, setProgress] = useState<DailyProgress>(() =>
    readDailyProgress()
  );
  const [active, setActive] = useState<Step>(
    () => nextIncompleteGame(readDailyProgress()) ?? "recap"
  );
  // Tracks which games the user solved during *this* page-load so we can
  // distinguish "just solved" (show celebration) from "revisiting".
  const [justWon, setJustWon] = useState<Set<DailyGameId>>(() => new Set());
  // Bumped after a leaderboard submission so the side panel refetches.
  const [refreshKey, setRefreshKey] = useState(0);
  // Last name the user submitted today, used to highlight rows.
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  // Mobile-only: lets the user collapse the leaderboard.
  const [mobileLbOpen, setMobileLbOpen] = useState(false);
  // Crossword-specific: lets the player view today's solution from the
  // completion card. We only need this for crossword — sudoku and friends
  // don't have a meaningful "solution view" beyond the board they just
  // finished. Resets if the active step changes.
  const [viewingCrosswordSolution, setViewingCrosswordSolution] =
    useState(false);
  // Stable id of today's crossword puzzle. Populated either by:
  //   (a) the player solving it in this session (fast path — comes
  //       through `handleCrosswordComplete`), or
  //   (b) a lazy fetch when the user revisits a previously-solved
  //       crossword on a different page-load (effect below).
  // Either way it's the key the upvote / downvote controls need.
  const [todayCrosswordId, setTodayCrosswordId] = useState<string | null>(
    null
  );

  // Resolve today's puzzle id whenever the player lands on the crossword
  // completion card without one set. `fetchDailyCrossword` is
  // sessionStorage-cached, so this is a no-op round-trip once the daily
  // crossword has been opened once during the visit.
  //
  // `fetchingRef` skips kicking off a second fetch if a previous one is
  // still in flight — the AbortController + cleanup pattern below
  // already handles dep-driven re-runs (each new run aborts the old),
  // but the ref closes the door on React strict-mode double-invocations
  // that could otherwise fire two network requests for the same id
  // before the first resolves.
  const fetchingRef = useRef(false);
  useEffect(() => {
    if (todayCrosswordId) return;
    if (active !== "crossword") return;
    if (!progress.crossword) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const ac = new AbortController();
    let cancelled = false;
    fetchDailyCrossword(getTodayKey(), ac.signal)
      .then((res) => {
        if (!cancelled) setTodayCrosswordId(res.puzzle.id);
      })
      .catch(() => {
        // Silent fail — the vote buttons just won't render; the
        // completion card is still functional without them.
      })
      .finally(() => {
        fetchingRef.current = false;
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [active, progress.crossword, todayCrosswordId]);

  const handleComplete = useCallback(
    (game: DailyGameId, time: number, errors: number) => {
      const next = recordCompletion(game, time, errors);
      setProgress(next);
      setJustWon((prev) => {
        if (prev.has(game)) return prev;
        const out = new Set(prev);
        out.add(game);
        return out;
      });
    },
    []
  );

  const handleCrosswordComplete = useCallback(
    (time: number, errors: number, puzzleId: string) => {
      handleComplete("crossword", time, errors);
      setTodayCrosswordId(puzzleId);
    },
    [handleComplete]
  );

  const advanceFrom = useCallback(
    (game: DailyGameId) => {
      // Always drop out of solution view when leaving the step — the
      // completion card is the canonical landing screen.
      setViewingCrosswordSolution(false);
      const idx = DAILY_GAMES.indexOf(game);
      const next = DAILY_GAMES[idx + 1];
      if (next) setActive(next);
      else setActive("recap");
    },
    []
  );

  const setActiveSafe = useCallback((step: Step) => {
    // Switching steps invalidates the crossword solution-view flag.
    setViewingCrosswordSolution(false);
    setActive(step);
  }, []);

  const handleScoreSubmitted = useCallback((name: string) => {
    setSubmittedName(name);
    setRefreshKey((k) => k + 1);
  }, []);

  const activeRecord = useMemo(
    () => (active !== "recap" ? progress[active] : undefined),
    [active, progress]
  );

  // Leaderboard tab follows the active step — same game when on a puzzle,
  // combined when sitting on the recap. The panel resyncs on every change.
  const lbTab = active === "recap" ? "combined" : active;

  return (
    <section className="flex flex-col gap-6">
      {/* Hero */}
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted sm:text-base">
          {DAILY_GAMES.length} puzzles, one timer. Race the clock and climb the
          combined leaderboard.
        </p>
      </header>

      {/* Stepper */}
      <DailyStepper
        active={active}
        progress={progress}
        onSelect={setActiveSafe}
      />

      {/* Body: game + leaderboard */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Game / completion / recap */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          {active === "recap" ? (
            allComplete(progress) ? (
              <DailyRecap progress={progress} onReplay={setActiveSafe} />
            ) : (
              <RecapPreview progress={progress} onJump={setActiveSafe} />
            )
          ) : activeRecord ? (
            active === "crossword" && viewingCrosswordSolution ? (
              <DailyCrosswordSolution
                onBack={() => setViewingCrosswordSolution(false)}
              />
            ) : (
              <DailyCompletionCard
                game={active}
                time={activeRecord.time}
                errors={activeRecord.errors}
                onScoreSubmitted={handleScoreSubmitted}
                onAdvance={() => advanceFrom(active)}
                advanceLabel={ADVANCE_LABELS[active]}
                justWon={justWon.has(active)}
                secondaryAction={
                  active === "crossword"
                    ? {
                        label: "View solution",
                        onClick: () => setViewingCrosswordSolution(true),
                      }
                    : undefined
                }
                crosswordPuzzleId={
                  active === "crossword" && todayCrosswordId
                    ? todayCrosswordId
                    : undefined
                }
              />
            )
          ) : active === "crossword" ? (
            <DailyCrossword onComplete={handleCrosswordComplete} />
          ) : (
            <SimpleActiveGame
              game={active}
              onComplete={(time, errors) => handleComplete(active, time, errors)}
            />
          )}
        </div>

        {/* Leaderboard — sidebar on lg+, collapsible on smaller screens */}
        <aside className="hidden rounded-lg border border-border bg-card p-4 lg:block">
          <h3 className="mb-3 text-xs font-mono uppercase tracking-wider text-muted">
            Today&apos;s leaderboard
          </h3>
          <DailyLeaderboardPanel
            refreshKey={refreshKey}
            activeTab={lbTab}
            highlightName={submittedName}
          />
        </aside>

        {/* Mobile leaderboard: collapsible accordion */}
        <aside className="rounded-lg border border-border bg-card lg:hidden">
          <button
            type="button"
            onClick={() => setMobileLbOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
            aria-expanded={mobileLbOpen}
          >
            <span className="text-xs font-mono uppercase tracking-wider text-muted">
              Today&apos;s leaderboard
            </span>
            <span className="text-xs text-muted">
              {mobileLbOpen ? "Hide ▲" : "Show ▼"}
            </span>
          </button>
          {mobileLbOpen && (
            <div className="border-t border-border p-4">
              <DailyLeaderboardPanel
                refreshKey={refreshKey}
                activeTab={lbTab}
                highlightName={submittedName}
              />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

/**
 * Renders the playable game for any step *except* crossword (which is
 * handled inline above because it needs the puzzle-id from `onComplete`).
 */
function SimpleActiveGame({
  game,
  onComplete,
}: {
  game: Exclude<DailyGameId, "crossword">;
  onComplete: (time: number, errors: number) => void;
}) {
  const Component = SIMPLE_GAME_COMPONENT[game];
  return <Component onComplete={onComplete} />;
}

/**
 * Shown if the user jumps to the recap chip before finishing all three —
 * lists what's still missing with a one-click jump back.
 */
function RecapPreview({
  progress,
  onJump,
}: {
  progress: DailyProgress;
  onJump: (game: DailyGameId) => void;
}) {
  const remaining = DAILY_GAMES.filter((g) => !progress[g]);
  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-foreground">
        Almost there — {remaining.length} puzzle{remaining.length === 1 ? "" : "s"} left.
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {remaining.map((g) => (
          <li key={g}>
            <button
              type="button"
              onClick={() => onJump(g)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/40"
            >
              Play {GAME_LABELS[g]} →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
