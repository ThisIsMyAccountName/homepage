"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { siteConfig } from "@/lib/config";
import { projects } from "@/content/projects";
import { games } from "@/content/games";
import { links } from "@/content/links";
import { sanitizeName } from "@/lib/security";

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

interface LeaderboardEntry {
  name: string;
  time: number;
  errors: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

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
] as const;
type DailyTab = (typeof DAILY_TABS)[number]["key"];

function DailySection() {
  const [active, setActive] = useState<DailyTab>("sudoku");

  return (
    <section className="mb-12">
      <div className="flex items-center justify-center gap-1 mb-4">
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
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          {active === "sudoku" ? <DailyGameSection /> : <DailyNonogramSection />}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted mb-3">
            Today&apos;s Leaderboard
          </h3>
          {active === "sudoku" ? (
            <LeaderboardSection />
          ) : (
            <NonogramLeaderboardSection />
          )}
        </div>
      </div>
    </section>
  );
}

/* --- Daily Game + Submit --- */

function DailyGameSection() {
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
        <SubmitScore time={completionData.time} errors={completionData.errors} />
      )}
    </div>
  );
}

function SubmitScore({ time, errors }: { time: number; errors: number }) {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [easterEgg, setEasterEgg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitted) return;

    // Client-side pre-check
    const { exploitDetected } = sanitizeName(name);
    if (exploitDetected) {
      setEasterEgg(
        "Nice try! Your hacking skills are impressive, but maybe use them on CTFs instead?"
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), time, errors }),
      });

      const data = await res.json();

      if (data.easterEgg) {
        setEasterEgg(data.error);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Submission failed");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Try again.");
    }
    setSubmitting(false);
  };

  if (easterEgg) {
    return (
      <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-3 text-center">
        <p className="text-xs text-accent font-mono">{easterEgg}</p>
        <p className="text-[10px] text-muted mt-1">
          Your attempt has been logged. Better luck next time.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <p className="mt-4 text-center text-sm text-accent">
        Score submitted! Check the leaderboard.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "..." : "Submit"}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </form>
  );
}

/* --- Leaderboard --- */

function LeaderboardSection() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/leaderboard")
        .then((r) => r.json())
        .then((data) => setEntries(data.entries || []))
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <p className="text-xs text-muted">Loading...</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted text-center py-4">
        No scores yet today. Be the first!
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry, i) => (
        <div
          key={`${entry.name}-${entry.time}-${i}`}
          className="flex items-center gap-2 rounded-md px-2 py-1.5"
        >
          <span
            className={`w-5 text-xs font-bold ${
              i === 0
                ? "text-accent"
                : i === 1
                  ? "text-foreground"
                  : "text-muted"
            }`}
          >
            {i + 1}.
          </span>
          <span className="flex-1 text-sm text-foreground truncate">
            {entry.name}
          </span>
          <span className="font-mono text-xs text-foreground">
            {formatTime(entry.time)}
          </span>
          {entry.errors > 0 && (
            <span className="text-[10px] text-red-400">
              +{entry.errors}err
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* --- Daily Nonogram + Nonogram Leaderboard --- */

function DailyNonogramSection() {
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
        <SubmitNonogramScore
          time={completionData.time}
          errors={completionData.errors}
        />
      )}
    </div>
  );
}

function SubmitNonogramScore({
  time,
  errors,
}: {
  time: number;
  errors: number;
}) {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [easterEgg, setEasterEgg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitted) return;

    const { exploitDetected } = sanitizeName(name);
    if (exploitDetected) {
      setEasterEgg(
        "Nice try! Your hacking skills are impressive, but maybe use them on CTFs instead?"
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/nonogram-leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), time, errors }),
      });

      const data = await res.json();

      if (data.easterEgg) {
        setEasterEgg(data.error);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Submission failed");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Try again.");
    }
    setSubmitting(false);
  };

  if (easterEgg) {
    return (
      <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-3 text-center">
        <p className="text-xs text-accent font-mono">{easterEgg}</p>
        <p className="text-[10px] text-muted mt-1">
          Your attempt has been logged. Better luck next time.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <p className="mt-4 text-center text-sm text-accent">
        Score submitted! Check the leaderboard.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "..." : "Submit"}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </form>
  );
}

function NonogramLeaderboardSection() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/nonogram-leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/nonogram-leaderboard")
        .then((r) => r.json())
        .then((data) => setEntries(data.entries || []))
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <p className="text-xs text-muted">Loading...</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted text-center py-4">
        No scores yet today. Be the first!
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry, i) => (
        <div
          key={`${entry.name}-${entry.time}-${i}`}
          className="flex items-center gap-2 rounded-md px-2 py-1.5"
        >
          <span
            className={`w-5 text-xs font-bold ${
              i === 0
                ? "text-accent"
                : i === 1
                  ? "text-foreground"
                  : "text-muted"
            }`}
          >
            {i + 1}.
          </span>
          <span className="flex-1 text-sm text-foreground truncate">
            {entry.name}
          </span>
          <span className="font-mono text-xs text-foreground">
            {formatTime(entry.time)}
          </span>
          {entry.errors > 0 && (
            <span className="text-[10px] text-red-400">
              +{entry.errors}err
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
