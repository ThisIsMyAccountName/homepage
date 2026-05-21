import { formatTime } from "@/lib/gameUtils";

export type ShareGame = "sudoku" | "nonogram" | "x-coloring" | "crossword";

const GAME_META: Record<ShareGame, { emoji: string; label: string }> = {
  sudoku: { emoji: "🔢", label: "Daily Sudoku" },
  nonogram: { emoji: "🖼️", label: "Daily Nonogram" },
  "x-coloring": { emoji: "🎨", label: "Daily X Coloring" },
  crossword: { emoji: "📝", label: "Daily Crossword" },
};

/** Short labels (no "Daily " prefix) for the combined per-game lines. */
const SHORT_LABELS: Record<ShareGame, string> = {
  sudoku: "Sudoku",
  nonogram: "Nonogram",
  "x-coloring": "X Coloring",
  crossword: "Crossword",
};

/** A tiny medal based on how fast the solve was. */
function medal(seconds: number): string {
  if (seconds < 90) return "🥇";
  if (seconds < 180) return "🥈";
  if (seconds < 360) return "🥉";
  return "🧩";
}

export interface ShareParams {
  game: ShareGame;
  /** Solve time in seconds. */
  time: number;
  /** Number of mistakes made. */
  errors: number;
  /** Date key (YYYY-MM-DD) of the puzzle. */
  date: string;
  /** Where to play — typically the site origin. */
  url: string;
}

/**
 * Build the clipboard-friendly share block for a completed daily puzzle.
 * Plain text with emojis so it pastes nicely into chats / social.
 */
export function buildShareText({
  game,
  time,
  errors,
  date,
  url,
}: ShareParams): string {
  const { emoji, label } = GAME_META[game];
  const accuracy =
    errors === 0
      ? "✨ Flawless"
      : `❌ ${errors} mistake${errors === 1 ? "" : "s"}`;

  return [
    `${emoji} ${label} — ${date}`,
    `${medal(time)} ⏱️ ${formatTime(time)}   ${accuracy}`,
    `🏆 Think you can beat me?`,
    `▶️ ${url}`,
  ].join("\n");
}

export interface CombinedShareEntry {
  game: ShareGame;
  /** Solve time in seconds. Pass 0 for legacy completions with unknown time. */
  time: number;
  errors: number;
}

export interface CombinedShareParams {
  /** Daily games to include — typically every completion with a known time. */
  entries: CombinedShareEntry[];
  date: string;
  url: string;
}

/**
 * Render a single combined share block for the full daily set. Replaces the
 * old "concatenate four solo blocks" approach which read like spam when
 * pasted into chats. Per-game lines mirror the solo share's time + accuracy
 * cadence; the footer totals everything and crowns a flawless run.
 */
export function buildCombinedShareText({
  entries,
  date,
  url,
}: CombinedShareParams): string {
  const totalTime = entries.reduce((sum, e) => sum + e.time, 0);
  const totalErrors = entries.reduce((sum, e) => sum + e.errors, 0);

  const accuracy = (errors: number): string =>
    errors === 0 ? "✨ Flawless" : `❌ ${errors} mistake${errors === 1 ? "" : "s"}`;

  const lines = entries.map((e) => {
    const time = e.time > 0 ? formatTime(e.time) : "  — ";
    return `${GAME_META[e.game].emoji} ${SHORT_LABELS[e.game]} — ⏱️ ${time}   ${accuracy(e.errors)}`;
  });

  const totalLine =
    totalErrors === 0
      ? `🏁 Daily set — total ${formatTime(totalTime)}   ✨ All flawless`
      : `🏁 Daily set — total ${formatTime(totalTime)}   ❌ ${totalErrors} total mistake${totalErrors === 1 ? "" : "s"}`;

  return [
    `🗓️ Daily Games — ${date}`,
    "",
    ...lines,
    "",
    totalLine,
    `▶️ ${url}`,
  ].join("\n");
}
