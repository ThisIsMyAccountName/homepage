export type ShareGame = "sudoku" | "nonogram" | "x-coloring";

const GAME_META: Record<ShareGame, { emoji: string; label: string }> = {
  sudoku: { emoji: "🔢", label: "Daily Sudoku" },
  nonogram: { emoji: "🖼️", label: "Daily Nonogram" },
  "x-coloring": { emoji: "🎨", label: "Daily X Coloring" },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

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
