"use client";

import { CrosswordVoteButtons } from "@/components/daily/CrosswordVoteButtons";
import { ShareScore } from "@/components/games/ShareScore";
import { SubmitScore } from "@/components/games/SubmitScore";
import {
  DAILY_GAMES,
  GAME_LABELS,
  type DailyGameId,
} from "@/lib/dailyProgress";
import { formatTime } from "@/lib/gameUtils";

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
   * Optional puzzle identifier. When the active game is crossword and a
   * stable id is available, the card surfaces a 👍 / 👎 vote pair so
   * the player can promote today's puzzle into the approved pool or
   * flag its clues for review.
   */
  crosswordPuzzleId?: string;
}

/**
 * Renders below the completed daily puzzle. Shows time/errors, share +
 * submit, and a prominent "Next: …" CTA so the daily flow keeps moving.
 * The puzzle itself stays mounted in its solved state above this card.
 */
export function DailyCompletionCard({
  game,
  time,
  errors,
  onScoreSubmitted,
  onAdvance,
  advanceLabel,
  justWon,
  crosswordPuzzleId,
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

      {/* Crossword-only: surface up/down votes once the player has
          solved today's puzzle. */}
      {game === "crossword" && crosswordPuzzleId && !unknownTime && (
        <CrosswordVoteButtons puzzleId={crosswordPuzzleId} />
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
