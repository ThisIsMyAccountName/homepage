"use client";

export interface HistoryEntry {
  id: string;
  label: string;      // size badge, e.g. "9×9"
  timeLabel: string;  // pre-formatted, e.g. "01:23"
  dateLabel: string;  // pre-formatted, e.g. "Jan 5"
  badge?: string;     // optional extra, e.g. "+2err"
  onShare?: () => void;
}

interface GameHistoryProps {
  entries: HistoryEntry[];
  onClear: () => void;
  /** Pass true while a clipboard copy is in-flight to show "Copied!" on share buttons */
  copied?: boolean;
}

export function GameHistory({
  entries,
  onClear,
  copied = false,
}: GameHistoryProps) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted">
        No completed puzzles yet. Solve one to see it here.
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          {entries.length} puzzle{entries.length !== 1 ? "s" : ""} completed
        </span>
        <button
          onClick={onClear}
          className="text-xs text-muted transition-colors hover:text-red-400"
        >
          Clear history
        </button>
      </div>
      <div className="max-h-80 space-y-1.5 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
          >
            <span className="font-mono text-xs text-accent">{entry.label}</span>
            <span className="flex-1 font-mono text-sm text-foreground">
              {entry.timeLabel}
            </span>
            {entry.badge && (
              <span className="text-xs text-red-400">{entry.badge}</span>
            )}
            {entry.onShare && (
              <button
                onClick={entry.onShare}
                className="text-xs text-muted transition-colors hover:text-accent"
                title="Copy share link"
              >
                {copied ? "Copied!" : "Share"}
              </button>
            )}
            <span className="text-xs text-muted">{entry.dateLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
