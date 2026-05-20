"use client";

import { ShareScore } from "@/components/games/ShareScore";
import { SubmitScore } from "@/components/games/SubmitScore";
import {
  DAILY_GAMES,
  GAME_LABELS,
  type DailyGameId,
} from "@/lib/dailyProgress";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface DailyCompletionCardProps {
  game: DailyGameId;
  time: number;
  errors: number;
  /** Receives the submitted name so the leaderboard can highlight the player. */
  onScoreSubmitted: (name: string) => void;
  /** Advances to the next step (or recap). */
  onAdvance: () => void;
  /** CTA label like "Go to Nonogram" or "See recap". */
  advanceLabel: string;
  /** Whether the player just won this in-session (vs revisiting a completed step). */
  justWon: boolean;
  /**
   * Optional secondary action — currently only wired up for crossword to
   * surface a "View solution" link. When provided, a low-emphasis text
   * button is rendered just below the primary CTA.
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Replaces the puzzle board once the daily game is solved (or when the user
 * revisits a completed step from the stepper). Shows time/errors, share +
 * submit, and a prominent "Next: …" CTA so the daily flow keeps moving.
 */
export function DailyCompletionCard({
  game,
  time,
  errors,
  onScoreSubmitted,
  onAdvance,
  advanceLabel,
  justWon,
  secondaryAction,
}: DailyCompletionCardProps) {
  // If the puzzle was completed before this session and we don't know the
  // time (legacy "=1" flag), show a softer "already done" message instead.
  const unknownTime = !justWon && time === 0;

  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-lg border border-accent/30 bg-accent/5 p-5 text-center sm:p-6">
      <div className="space-y-1">
        <p className="text-xs font-mono uppercase tracking-wider text-accent">
          {justWon ? "Solved" : "Completed"} · {GAME_LABELS[game]}
        </p>
        {unknownTime ? (
          <p className="text-sm text-muted">
            You already finished today&apos;s {GAME_LABELS[game]}.
          </p>
        ) : (
          <p className="font-mono text-4xl font-bold text-foreground">
            {formatTime(time)}
          </p>
        )}
        {!unknownTime && (
          <p className="text-xs text-muted">
            {errors === 0 ? "Flawless" : `${errors} mistake${errors === 1 ? "" : "s"}`}
          </p>
        )}
      </div>

      {!unknownTime && (
        <div className="w-full max-w-sm space-y-3">
          <SubmitScore
            game={game}
            time={time}
            errors={errors}
            onSubmitted={onScoreSubmitted}
          />
          <ShareScore game={game} time={time} errors={errors} />
        </div>
      )}

      <button
        type="button"
        onClick={onAdvance}
        className="mt-1 rounded-md bg-accent px-5 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover"
      >
        {advanceLabel} →
      </button>

      {secondaryAction && (
        <button
          type="button"
          onClick={secondaryAction.onClick}
          className="text-xs text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}

/** Pre-computed CTA labels for each step → "Go to Nonogram", "See recap", … */
export const ADVANCE_LABELS: Record<DailyGameId, string> = (() => {
  const out = {} as Record<DailyGameId, string>;
  for (let i = 0; i < DAILY_GAMES.length; i++) {
    const next = DAILY_GAMES[i + 1];
    out[DAILY_GAMES[i]] = next ? `Go to ${GAME_LABELS[next]}` : "See recap";
  }
  return out;
})();
