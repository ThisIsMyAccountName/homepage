"use client";

import {
  DAILY_GAMES,
  GAME_LABELS,
  GAME_SUBTITLES,
  type DailyGameId,
  type DailyProgress,
} from "@/lib/dailyProgress";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface DailyStepperProps {
  /** Currently displayed step. `null` while showing the all-done recap. */
  active: DailyGameId | "recap";
  progress: DailyProgress;
  onSelect: (step: DailyGameId | "recap") => void;
}

/**
 * Top progression bar — three numbered chips for the daily puzzles plus an
 * implicit "recap" finish line. Any step is clickable so players can revisit
 * a completed game's stats. Sized to stay compact on mobile (numbers only)
 * and expand with labels on sm+ screens.
 */
export function DailyStepper({ active, progress, onSelect }: DailyStepperProps) {
  return (
    <ol className="flex w-full items-stretch gap-1 sm:gap-2">
      {DAILY_GAMES.map((game, i) => {
        const isActive = active === game;
        const record = progress[game];
        const done = !!record;
        return (
          <li key={game} className="flex flex-1 items-stretch">
            <button
              type="button"
              onClick={() => onSelect(game)}
              aria-current={isActive ? "step" : undefined}
              className={`group flex flex-1 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors sm:gap-3 sm:px-3 ${
                isActive
                  ? "border-accent/60 bg-accent/10"
                  : done
                    ? "border-accent/30 bg-card hover:border-accent/50"
                    : "border-border bg-card hover:border-foreground/30"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 sm:text-sm ${
                  done
                    ? "bg-accent text-background"
                    : isActive
                      ? "border border-accent text-accent"
                      : "border border-border text-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="hidden min-w-0 flex-1 flex-col sm:flex">
                <span
                  className={`truncate text-sm font-medium ${
                    isActive || done ? "text-foreground" : "text-muted"
                  }`}
                >
                  {GAME_LABELS[game]}
                </span>
                <span className="truncate text-[11px] font-mono text-muted">
                  {done && record && record.time > 0
                    ? formatTime(record.time)
                    : GAME_SUBTITLES[game]}
                </span>
              </span>
              <span className="ml-auto flex flex-col text-right sm:hidden">
                <span
                  className={`text-[11px] font-medium ${
                    isActive || done ? "text-foreground" : "text-muted"
                  }`}
                >
                  {GAME_LABELS[game].split(" ")[0]}
                </span>
                {done && record && record.time > 0 && (
                  <span className="font-mono text-[10px] text-muted">
                    {formatTime(record.time)}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
      {/* Recap finish chip — visible once at least one game is done. */}
      {Object.keys(progress).length > 0 && (
        <li className="flex items-stretch">
          <button
            type="button"
            onClick={() => onSelect("recap")}
            aria-current={active === "recap" ? "step" : undefined}
            className={`flex items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-colors sm:px-3 ${
              active === "recap"
                ? "border-accent/60 bg-accent/10 text-foreground"
                : "border-border bg-card text-muted hover:border-foreground/30 hover:text-foreground"
            }`}
            aria-label="Recap"
            title="Recap"
          >
            🏁
          </button>
        </li>
      )}
    </ol>
  );
}
