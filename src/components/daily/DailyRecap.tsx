"use client";

import { useState } from "react";
import {
  DAILY_GAMES,
  GAME_LABELS,
  type DailyGameId,
  type DailyProgress,
} from "@/lib/dailyProgress";
import { getTodayKey } from "@/lib/daily";
import { formatTime } from "@/lib/gameUtils";
import { buildCombinedShareText } from "@/lib/share";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface DailyRecapProps {
  progress: DailyProgress;
  /** Jump back to a step from the recap. */
  onReplay: (game: DailyGameId) => void;
}

/**
 * Final view once all three daily puzzles are done. Shows per-game times,
 * combined total, a copy-everything share button, and links back to each
 * step in case the player wants to review their result.
 */
export function DailyRecap({ progress, onReplay }: DailyRecapProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const knownTimes = DAILY_GAMES.filter((g) => (progress[g]?.time ?? 0) > 0);
  const totalTime = knownTimes.reduce((sum, g) => sum + (progress[g]?.time ?? 0), 0);
  const totalErrors = DAILY_GAMES.reduce(
    (sum, g) => sum + (progress[g]?.errors ?? 0),
    0
  );
  const hasUnknown = knownTimes.length < DAILY_GAMES.length;

  const handleShareAll = async () => {
    const today = getTodayKey();
    const url = typeof window !== "undefined" ? `${window.location.origin}/` : "";
    // Only include games we actually have a recorded time for — legacy "=1"
    // completions land here with time=0 and would otherwise pollute the total.
    const entries = DAILY_GAMES.filter(
      (g) => (progress[g]?.time ?? 0) > 0,
    ).map((g) => ({
      game: g,
      time: progress[g]?.time ?? 0,
      errors: progress[g]?.errors ?? 0,
    }));
    const text = buildCombinedShareText({ entries, date: today, url });
    const ok = await copy(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2500);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 rounded-lg border border-accent/30 bg-accent/5 p-6">
      <div className="text-center">
        <p className="text-xs font-mono uppercase tracking-wider text-accent">
          Daily complete
        </p>
        <h2 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
          All {DAILY_GAMES.length} done 🏁
        </h2>
        <p className="mt-1 text-sm text-muted">
          {hasUnknown
            ? "Some times from earlier sessions weren't recorded — your total counts only the games solved on this device."
            : "Total time on today's daily set:"}
        </p>
      </div>

      <div className="text-center">
        <p className="font-mono text-5xl font-bold text-foreground sm:text-6xl">
          {formatTime(totalTime)}
        </p>
        {totalErrors > 0 && (
          <p className="mt-1 text-xs text-muted">
            {totalErrors} mistake{totalErrors === 1 ? "" : "s"} across all{" "}
            {DAILY_GAMES.length} (errors don&apos;t affect combined ranking).
          </p>
        )}
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
        {DAILY_GAMES.map((g) => {
          const r = progress[g];
          return (
            <button
              key={g}
              type="button"
              onClick={() => onReplay(g)}
              className="flex flex-col items-center gap-1 rounded-md border border-border bg-card px-3 py-3 text-center transition-colors hover:border-accent/40"
            >
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                {GAME_LABELS[g]}
              </span>
              <span className="font-mono text-lg font-bold text-foreground">
                {r && r.time > 0 ? formatTime(r.time) : "—"}
              </span>
              {r && r.errors > 0 && (
                <span className="text-[10px] text-red-400">
                  {r.errors} mistake{r.errors === 1 ? "" : "s"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleShareAll}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-card-hover"
      >
        {copied ? (
          <span className="text-accent">✓ Copied daily set to clipboard</span>
        ) : copyFailed ? (
          <span className="text-red-400">Copy failed — try again</span>
        ) : (
          <>
            <span>📋</span>
            <span>Share daily set</span>
          </>
        )}
      </button>

      <p className="text-xs text-muted">
        Come back tomorrow for a fresh set of puzzles.
      </p>
    </div>
  );
}
