"use client";

import { useEffect, useState } from "react";
import { DAILY_GAMES, GAME_LABELS, type DailyGameId } from "@/lib/dailyProgress";
import { formatTime } from "@/lib/gameUtils";

/**
 * Self-contained leaderboard for a single board — the active game (or the
 * combined ranking when the player is on the recap). The hub picks which
 * board via `activeTab`; this panel has no internal switching.
 */

type Tab = DailyGameId | "combined";

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

interface DailyLeaderboardPanelProps {
  /** Bumped by the hub after a submission to force an immediate refetch. */
  refreshKey?: number;
  /**
   * Which board to show — one of the daily games or "combined". The panel
   * has no UI to change this; the hub flips it when the player switches
   * step.
   */
  activeTab?: Tab;
  /** Highlight rows where the player name matches (case-insensitive). */
  highlightName?: string | null;
}

export function DailyLeaderboardPanel({
  refreshKey = 0,
  activeTab = DAILY_GAMES[0],
  highlightName,
}: DailyLeaderboardPanelProps) {
  const [perGame, setPerGame] = useState<PerGameEntry[] | null>(null);
  const [combined, setCombined] = useState<CombinedEntry[] | null>(null);
  // Loading is derived: we're loading until the initial fetch for the
  // current (tab, refreshKey) signature finishes. Background polling
  // doesn't touch this, so refreshed lists swap in silently.
  const [lastFetched, setLastFetched] = useState<{
    tab: Tab;
    refresh: number;
  } | null>(null);
  const loading =
    lastFetched === null ||
    lastFetched.tab !== activeTab ||
    lastFetched.refresh !== refreshKey;

  useEffect(() => {
    const url =
      activeTab === "combined"
        ? "/api/leaderboard?game=combined"
        : `/api/leaderboard?game=${encodeURIComponent(activeTab)}`;

    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (activeTab === "combined") {
          setCombined(data.entries ?? []);
        } else {
          setPerGame(data.entries ?? []);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLastFetched({ tab: activeTab, refresh: refreshKey });
      });

    // Poll every 30s while this board is open. Polling refreshes the list
    // silently — it deliberately doesn't update `lastFetched`, so loading
    // stays false and the rows don't flicker back to "Loading…".
    const interval = setInterval(() => {
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (activeTab === "combined") setCombined(data.entries ?? []);
          else setPerGame(data.entries ?? []);
        })
        .catch(() => {});
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTab, refreshKey]);

  const matchName = highlightName?.trim().toLowerCase() ?? null;
  const boardLabel =
    activeTab === "combined" ? "Combined" : GAME_LABELS[activeTab];

  return (
    <div className="flex flex-col gap-3">
      {/* Caption — replaces the previous tab strip; tells the player which
          board they're looking at since it now follows the active game. */}
      <p className="text-sm font-medium text-foreground">{boardLabel}</p>

      {/* Body */}
      <div className="max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="px-2 py-4 text-center text-xs text-muted">Loading…</p>
        ) : activeTab === "combined" ? (
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
