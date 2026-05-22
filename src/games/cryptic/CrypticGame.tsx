"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameTabs } from "@/components/games/GameTabs";
import { GameHistory, type HistoryEntry } from "@/components/games/GameHistory";
import { formatTime } from "@/lib/gameUtils";
import { ClueBoard } from "./ClueBoard";
import { fetchRandomCryptic } from "./fetch";
import {
  clearCompletedCryptics,
  getCompletedCryptics,
  getSeenIds,
  logCryptic,
  recordSeen,
} from "./history";
import type { CrypticResponse } from "./types";

type Tab = "play" | "history";

export function CrypticGame() {
  const [tab, setTab] = useState<Tab>("play");
  const [entry, setEntry] = useState<CrypticResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadNext = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const seen = getSeenIds();
      const res = await fetchRandomCryptic(seen, ac.signal);
      if (ac.signal.aborted) return;
      setEntry(res);
    } catch (err) {
      if (ac.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNext();
    return () => abortRef.current?.abort();
  }, [loadNext]);

  const handleComplete = useCallback(
    (time: number, errors: number) => {
      if (!entry) return;
      recordSeen(entry.id);
      logCryptic({
        id: `${Date.now().toString(36)}-${entry.id}`,
        answer: entry.answer,
        pattern: entry.pattern,
        time,
        errors,
        date: new Date().toISOString(),
      });
      setHistoryTick((t) => t + 1);
    },
    [entry]
  );

  const historyEntries: HistoryEntry[] = (() => {
    void historyTick; // tick is just a re-render trigger.
    return getCompletedCryptics().map((c) => ({
      id: c.id,
      label: c.answer,
      timeLabel: formatTime(c.time),
      dateLabel: new Date(c.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      badge: c.errors > 0 ? `+${c.errors}` : undefined,
    }));
  })();

  const handleClearHistory = useCallback(() => {
    clearCompletedCryptics();
    setHistoryTick((t) => t + 1);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 sm:p-6">
      <GameTabs
        tabs={["play", "history"] as const}
        active={tab}
        onChange={(t) => setTab(t as Tab)}
      />

      {tab === "play" ? (
        <div className="flex w-full flex-col items-center gap-4">
          {loading && !entry && (
            <p className="py-12 text-sm text-muted">Loading a cryptic clue...</p>
          )}
          {error && (
            <div className="w-full rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
              {error}
              <button
                type="button"
                onClick={loadNext}
                className="ml-3 underline hover:text-red-200"
              >
                Retry
              </button>
            </div>
          )}
          {entry && (
            <ClueBoard
              entry={entry}
              onComplete={handleComplete}
              variant="free"
              onNext={loadNext}
              showThumbs
            />
          )}
        </div>
      ) : (
        <GameHistory entries={historyEntries} onClear={handleClearHistory} />
      )}
    </div>
  );
}
