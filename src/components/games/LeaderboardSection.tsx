"use client";

import { useEffect, useState } from "react";

export type GameId = "sudoku" | "nonogram" | "x-coloring";

interface LeaderboardEntry {
  name: string;
  time: number;
  errors: number;
  game?: GameId;
}

interface LeaderboardSectionProps {
  /** If set, show only entries for this game. Otherwise show combined view. */
  game?: GameId;
  /** Poll interval in ms; default 30s. Set 0 to disable polling. */
  pollMs?: number;
  /** Bump this to force an immediate refetch (e.g. right after a score submit). */
  refreshKey?: number;
}

const GAME_LABEL: Record<GameId, string> = {
  sudoku: "Sudoku",
  nonogram: "Nonogram",
  "x-coloring": "X Color",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function LeaderboardSection({
  game,
  pollMs = 30_000,
  refreshKey = 0,
}: LeaderboardSectionProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = game
      ? `/api/leaderboard?game=${encodeURIComponent(game)}`
      : "/api/leaderboard";

    let cancelled = false;
    const load = () =>
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setEntries(data.entries || []);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoading(false);
        });

    load();
    if (pollMs > 0) {
      const interval = setInterval(load, pollMs);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [game, pollMs, refreshKey]);

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
          key={`${entry.name}-${entry.time}-${entry.game ?? ""}-${i}`}
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
          {!game && entry.game && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
              {GAME_LABEL[entry.game] ?? entry.game}
            </span>
          )}
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
