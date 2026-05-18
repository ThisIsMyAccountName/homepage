"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { siteConfig } from "@/lib/config";
import { projects } from "@/content/projects";
import { games } from "@/content/games";
import { links } from "@/content/links";
import { SubmitScore } from "@/components/games/SubmitScore";
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
      {/* Hero */}
      <div className="text-center space-y-3 mb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          {siteConfig.name}
        </h1>
        <p className="text-muted text-base sm:text-lg max-w-md mx-auto">
          {siteConfig.description}
        </p>
      </div>

      {/* Daily Puzzles */}
      <DailySection />

      {/* Section links — buffed up */}
      <nav className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <SectionCardProjects />
        <SectionCardGames />
        <SectionCardFiles />
        <SectionCardLinks />
      </nav>
    </main>
  );
}

/* --- Section Cards with rotating content --- */

function SectionCardProjects() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % projects.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const project = projects[idx];

  return (
    <Link
      href="/projects"
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:bg-card-hover hover:border-accent/40 hover:scale-[1.02] h-[160px]"
    >
      <div>
        <span className="text-accent font-mono text-xs">&gt; Projects</span>
        <p className="mt-2 text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
          {project.title}
        </p>
        <p className="text-xs text-muted mt-1 line-clamp-2">
          {project.description.slice(0, 80)}...
        </p>
      </div>
      <div className="mt-3 flex gap-1.5 flex-wrap">
        {project.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent"
          >
            {tag}
          </span>
        ))}
      </div>
      {/* Rotation dots */}
      <div className="absolute top-3 right-3 flex gap-1">
        {projects.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-accent" : "bg-border"}`}
          />
        ))}
      </div>
    </Link>
  );
}

function SectionCardGames() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % games.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const game = games[idx];

  return (
    <Link
      href="/games"
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:bg-card-hover hover:border-accent/40 hover:scale-[1.02] h-[160px]"
    >
      <div>
        <span className="text-accent font-mono text-xs">&gt; Games</span>
        <p className="mt-2 text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
          {game.title}
        </p>
        <p className="text-xs text-muted mt-1 line-clamp-2">
          {game.description.slice(0, 80)}...
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-muted font-mono">
          {games.length} games available
        </span>
      </div>
      <div className="absolute top-3 right-3 flex gap-1">
        {games.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-accent" : "bg-border"}`}
          />
        ))}
      </div>
    </Link>
  );
}

function SectionCardFiles() {
  return (
    <Link
      href="/files"
      className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:bg-card-hover hover:border-accent/40 hover:scale-[1.02] h-[160px]"
    >
      <div>
        <span className="text-accent font-mono text-xs">&gt; Files</span>
        <p className="mt-2 text-sm font-medium text-foreground group-hover:text-accent transition-colors">
          Downloads
        </p>
        <p className="text-xs text-muted mt-1">
          Hosted files, configs, and resources available for download.
        </p>
      </div>
      <div className="mt-3">
        <span className="text-[10px] text-muted font-mono">
          Direct links &bull; No login
        </span>
      </div>
    </Link>
  );
}

function SectionCardLinks() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % links.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const link = links[idx];

  return (
    <Link
      href="/links"
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:bg-card-hover hover:border-accent/40 hover:scale-[1.02] h-[160px]"
    >
      <div>
        <span className="text-accent font-mono text-xs">&gt; Links</span>
        <p className="mt-2 text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
          {link.title}
        </p>
        <p className="text-xs text-muted mt-1 line-clamp-2">
          {link.description}
        </p>
      </div>
      <div className="mt-3">
        <span className="text-[10px] text-muted font-mono">
          {links.length} links
        </span>
      </div>
      <div className="absolute top-3 right-3 flex gap-1">
        {links.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-accent" : "bg-border"}`}
          />
        ))}
      </div>
    </Link>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
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
        <SubmitScore
          game="sudoku"
          time={completionData.time}
          errors={completionData.errors}
          onSubmitted={onScoreSubmitted}
        />
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
        <SubmitScore
          game="nonogram"
          time={completionData.time}
          errors={completionData.errors}
          onSubmitted={onScoreSubmitted}
        />
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
        <SubmitScore
          game="x-coloring"
          time={completionData.time}
          errors={completionData.errors}
          onSubmitted={onScoreSubmitted}
        />
      )}
    </div>
  );
}
