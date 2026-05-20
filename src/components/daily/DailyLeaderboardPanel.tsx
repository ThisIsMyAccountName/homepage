"use client";

import { useCallback, useEffect, useState } from "react";
import { DAILY_GAMES, GAME_LABELS, type DailyGameId } from "@/lib/dailyProgress";

/**
 * Self-contained leaderboard with tabs for each game plus a "Combined" tab
 * that ranks by sum of best per-game times (no error penalty). Renders inline
 * on wide screens (sidebar) and inside an accordion on narrow screens — the
 * hub controls layout, this panel just renders.
 */

type Tab = DailyGameId | "combined";
const TABS: { id: Tab; label: string }[] = [
  ...DAILY_GAMES.map((g) => ({ id: g as Tab, label: GAME_LABELS[g] })),
  { id: "combined" as Tab, label: "Combined" },
];

interface PerGameEntry {
  name: string;
  time: number;
  errors: number;
  game?: DailyGameId;
}

interface CombinedEntry {
  name: string;
  time: number;
  errors: number;
  /** Server returns an entry per game in `DAILY_GAMES`. */
  perGame: Partial<Record<DailyGameId, { time: number; errors: number }>>;
}

/** Single-letter row prefix per daily game (S / N / X / C). */
const COMBINED_ABBR: Record<DailyGameId, string> = {
  sudoku: "S",
  nonogram: "N",
  "x-coloring": "X",
  crossword: "C",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface DailyLeaderboardPanelProps {
  /** Bumped by the hub after a submission to force an immediate refetch. */
  refreshKey?: number;
  /** Tab to open by default. */
  initialTab?: Tab;
  /** Highlight rows where the player name matches (case-insensitive). */
  highlightName?: string | null;
}

export function DailyLeaderboardPanel({
  refreshKey = 0,
  initialTab = DAILY_GAMES[0],
  highlightName,
}: DailyLeaderboardPanelProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [perGame, setPerGame] = useState<PerGameEntry[] | null>(null);
  const [combined, setCombined] = useState<CombinedEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const switchTab = useCallback((next: Tab) => {
    setLoading(true);
    setTab(next);
  }, []);

  useEffect(() => {
    const url =
      tab === "combined"
        ? "/api/leaderboard?game=combined"
        : `/api/leaderboard?game=${encodeURIComponent(tab)}`;

    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (tab === "combined") {
          setCombined(data.entries ?? []);
        } else {
          setPerGame(data.entries ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    // Poll every 30s while this tab is open.
    const interval = setInterval(() => {
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (tab === "combined") setCombined(data.entries ?? []);
          else setPerGame(data.entries ?? []);
        })
        .catch(() => {});
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tab, refreshKey]);

  const matchName = highlightName?.trim().toLowerCase() ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`flex-1 min-w-[64px] rounded px-2 py-1 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="px-2 py-4 text-center text-xs text-muted">Loading…</p>
        ) : tab === "combined" ? (
          <CombinedList entries={combined ?? []} matchName={matchName} />
        ) : (
          <PerGameList entries={perGame ?? []} matchName={matchName} />
        )}
      </div>
    </div>
  );
}

function PerGameList({
  entries,
  matchName,
}: {
  entries: PerGameEntry[];
  matchName: string | null;
}) {
  if (entries.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-muted">
        No scores yet today. Be the first!
      </p>
    );
  }
  return (
    <div className="space-y-0.5">
      {entries.map((e, i) => {
        const mine = matchName && e.name.trim().toLowerCase() === matchName;
        return (
          <div
            key={`${e.name}-${e.time}-${i}`}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
              mine ? "bg-accent/10" : ""
            }`}
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
            <span className="flex-1 truncate text-sm text-foreground">
              {e.name}
              {mine && <span className="ml-1 text-[10px] text-accent">you</span>}
            </span>
            <span className="font-mono text-xs text-foreground">
              {formatTime(e.time)}
            </span>
            {e.errors > 0 && (
              <span className="text-[10px] text-red-400">+{e.errors}err</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CombinedList({
  entries,
  matchName,
}: {
  entries: CombinedEntry[];
  matchName: string | null;
}) {
  if (entries.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-muted">
        Players who finish all {DAILY_GAMES.length} puzzles today land here.
        Ranked by total time only — errors don&apos;t count.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {entries.map((e, i) => {
        const mine = matchName && e.name.trim().toLowerCase() === matchName;
        return (
          <div
            key={`${e.name}-${e.time}-${i}`}
            className={`rounded-md px-2 py-1.5 ${mine ? "bg-accent/10" : ""}`}
          >
            <div className="flex items-center gap-2">
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
              <span className="flex-1 truncate text-sm text-foreground">
                {e.name}
                {mine && (
                  <span className="ml-1 text-[10px] text-accent">you</span>
                )}
              </span>
              <span className="font-mono text-xs text-foreground">
                {formatTime(e.time)}
              </span>
            </div>
            <div className="ml-7 mt-0.5 flex flex-wrap gap-2 font-mono text-[10px] text-muted">
              {DAILY_GAMES.map((g) => {
                const rec = e.perGame[g];
                if (!rec) return null;
                return (
                  <span key={g}>
                    {COMBINED_ABBR[g]} {formatTime(rec.time)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
