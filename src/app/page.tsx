"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { siteConfig } from "@/lib/config";
import { SubmitScore } from "@/components/games/SubmitScore";
import { ShareScore } from "@/components/games/ShareScore";
import { LeaderboardSection } from "@/components/games/LeaderboardSection";

// Dynamic import with ssr:false prevents hydration mismatch from localStorage/window access
const DailyGame = dynamic(
  () => import("@/games/daily/DailyGame").then((m) => ({ default: m.DailyGame })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8 text-sm text-muted">
        Loading daily puzzle...
      </div>
    ),
  }
);

const DailyNonogram = dynamic(
  () =>
    import("@/games/daily/DailyNonogram").then((m) => ({
      default: m.DailyNonogram,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8 text-sm text-muted">
        Loading daily puzzle...
      </div>
    ),
  }
);

const DailyXColoring = dynamic(
  () =>
    import("@/games/daily/DailyXColoring").then((m) => ({
      default: m.DailyXColoring,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8 text-sm text-muted">
        Loading daily puzzle...
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
      {/* Hero */}
      <div className="text-center space-y-3 mb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          {siteConfig.name}
        </h1>
        <p className="text-muted text-base sm:text-lg max-w-md mx-auto">
          A new set of daily puzzles every day — race the clock and climb the
          leaderboard.
        </p>
      </div>

      {/* Daily Puzzles */}
      <DailySection />
    </main>
  );
}

/* --- Daily Section with tabs --- */

const DAILY_TABS = [
  { key: "sudoku", label: "Sudoku", sub: "6×6" },
  { key: "nonogram", label: "Nonogram", sub: "7×7" },
  { key: "x-coloring", label: "X Coloring", sub: "graph" },
  { key: "all", label: "All", sub: "combined" },
] as const;
type DailyTab = (typeof DAILY_TABS)[number]["key"];

function DailySection() {
  const [active, setActive] = useState<DailyTab>("sudoku");
  // Bumped whenever a score is submitted so the leaderboard refetches at once.
  const [refreshKey, setRefreshKey] = useState(0);
  const handleScoreSubmitted = useCallback(
    () => setRefreshKey((k) => k + 1),
    []
  );

  return (
    <section className="mb-12">
      <div className="flex items-center justify-center gap-1 mb-4 flex-wrap">
        {DAILY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active === t.key
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            <span
              className={`ml-1.5 font-mono text-[11px] ${
                active === t.key ? "text-background/70" : "text-muted/60"
              }`}
            >
              {t.sub}
            </span>
          </button>
        ))}
      </div>
      {active === "all" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {(["sudoku", "nonogram", "x-coloring"] as const).map((g) => (
            <div key={g} className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium text-muted mb-3 capitalize">
                {g === "x-coloring" ? "X Coloring" : g}
              </h3>
              <LeaderboardSection game={g} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[7fr_3fr]">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            {active === "sudoku" && (
              <DailyGameSection onScoreSubmitted={handleScoreSubmitted} />
            )}
            {active === "nonogram" && (
              <DailyNonogramSection onScoreSubmitted={handleScoreSubmitted} />
            )}
            {active === "x-coloring" && (
              <DailyXColoringSection onScoreSubmitted={handleScoreSubmitted} />
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-muted mb-3">
              Today&apos;s Leaderboard
            </h3>
            <LeaderboardSection game={active} refreshKey={refreshKey} />
          </div>
        </div>
      )}
    </section>
  );
}

function DailyGameSection({
  onScoreSubmitted,
}: {
  onScoreSubmitted: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const [completionData, setCompletionData] = useState<{
    time: number;
    errors: number;
  } | null>(null);

  const handleComplete = useCallback((time: number, errors: number) => {
    setCompleted(true);
    setCompletionData({ time, errors });
  }, []);

  return (
    <div>
      <DailyGame onComplete={handleComplete} />
      {completed && completionData && (
        <>
          <SubmitScore
            game="sudoku"
            time={completionData.time}
            errors={completionData.errors}
            onSubmitted={onScoreSubmitted}
          />
          <ShareScore
            game="sudoku"
            time={completionData.time}
            errors={completionData.errors}
          />
        </>
      )}
    </div>
  );
}

function DailyNonogramSection({
  onScoreSubmitted,
}: {
  onScoreSubmitted: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const [completionData, setCompletionData] = useState<{
    time: number;
    errors: number;
  } | null>(null);

  const handleComplete = useCallback((time: number, errors: number) => {
    setCompleted(true);
    setCompletionData({ time, errors });
  }, []);

  return (
    <div>
      <DailyNonogram onComplete={handleComplete} />
      {completed && completionData && (
        <>
          <SubmitScore
            game="nonogram"
            time={completionData.time}
            errors={completionData.errors}
            onSubmitted={onScoreSubmitted}
          />
          <ShareScore
            game="nonogram"
            time={completionData.time}
            errors={completionData.errors}
          />
        </>
      )}
    </div>
  );
}

function DailyXColoringSection({
  onScoreSubmitted,
}: {
  onScoreSubmitted: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const [completionData, setCompletionData] = useState<{
    time: number;
    errors: number;
  } | null>(null);

  const handleComplete = useCallback((time: number, errors: number) => {
    setCompleted(true);
    setCompletionData({ time, errors });
  }, []);

  return (
    <div>
      <DailyXColoring onComplete={handleComplete} />
      {completed && completionData && (
        <>
          <SubmitScore
            game="x-coloring"
            time={completionData.time}
            errors={completionData.errors}
            onSubmitted={onScoreSubmitted}
          />
          <ShareScore
            game="x-coloring"
            time={completionData.time}
            errors={completionData.errors}
          />
        </>
      )}
    </div>
  );
}
