"use client";

/**
 * Sticky banner above the crossword grid showing the currently active clue.
 * Tapping the banner flips direction (Across ↔ Down) when the active cell
 * has entries in both — mirrors the NYT mini's gesture.
 */

import type { Entry } from "./types";

interface ClueBannerProps {
  entry: Entry | null;
  /** When true the banner is rendered but the flip-direction action no-ops. */
  disabled?: boolean;
  /** Width to match the board width above. */
  width: number;
  onFlipDirection: () => void;
}

export function ClueBanner({ entry, disabled, width, onFlipDirection }: ClueBannerProps) {
  return (
    <button
      type="button"
      onClick={onFlipDirection}
      disabled={disabled}
      style={{ width }}
      className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-accent/40 disabled:opacity-60"
      aria-label="Tap to flip direction"
    >
      <span className="mt-0.5 shrink-0 rounded-sm bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
        {entry ? `${entry.number} ${entry.direction === "across" ? "A" : "D"}` : "—"}
      </span>
      {/* Long clues wrap onto multiple lines rather than getting clipped —
          critical for the bank's wordier entries on narrow boards. */}
      <span className="min-w-0 flex-1 whitespace-normal break-words text-sm leading-snug text-foreground">
        {entry?.clue ?? "Select a cell"}
      </span>
    </button>
  );
}
