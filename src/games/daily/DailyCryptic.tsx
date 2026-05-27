"use client";

import { useCallback, useEffect, useState } from "react";
import { getTodayKey } from "@/lib/daily";
import { ClueBoard } from "@/games/cryptic/ClueBoard";
import { fetchDailyCryptic } from "@/games/cryptic/fetch";
import {
  clearDailySession,
  loadDailySession,
  saveDailySession,
  type CrypticDailySession,
} from "@/games/cryptic/session";
import type { CrypticResponse } from "@/games/cryptic/types";

interface DailyCrypticProps {
  /** Fires once when the daily puzzle is solved. */
  onComplete: (time: number, errors: number) => void;
  /**
   * Revisit mode: mount with the answer filled in and solved=true so the
   * player sees the solved board (and the post-solve answer/wordplay
   * panel) without being prompted to play again.
   */
  alreadySolved?: boolean;
}

export function DailyCryptic({
  onComplete,
  alreadySolved = false,
}: DailyCrypticProps) {
  const todayKey = getTodayKey();
  const [entry, setEntry] = useState<CrypticResponse | null>(null);
  const [initial, setInitial] = useState<CrypticDailySession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchDailyCryptic(todayKey, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        setEntry(res);
        setInitial(loadDailySession(todayKey, res.id));
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load daily cryptic");
      });
    return () => ac.abort();
  }, [todayKey]);

  const handleSessionChange = useCallback(
    (state: CrypticDailySession) => {
      saveDailySession(todayKey, state);
    },
    [todayKey]
  );

  const handleComplete = useCallback(
    (time: number, errors: number) => {
      clearDailySession(todayKey);
      onComplete(time, errors);
    },
    [todayKey, onComplete]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-sm">
        <p className="text-red-400">{error}</p>
        <p className="text-muted text-xs">
          The maintainer needs to drop a cryptic-clues.json in src/games/cryptic/data.
        </p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted">
        Loading daily cryptic...
      </div>
    );
  }

  return (
    <ClueBoard
      entry={entry}
      onComplete={handleComplete}
      initialSession={initial}
      onSessionChange={handleSessionChange}
      variant="daily"
      showThumbs
      alreadySolved={alreadySolved}
    />
  );
}
