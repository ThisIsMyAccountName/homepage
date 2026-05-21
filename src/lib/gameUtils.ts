/**
 * Cross-game utilities. Things in here are tiny and universal — any
 * helper that gets copy-pasted into a third game file should land here
 * first. Keep it free of React, DOM, or per-game type imports so it
 * stays usable from server and client code alike.
 */

/**
 * Format a duration in seconds as "MM:SS" with both fields
 * zero-padded. Used by every game's timer + every daily summary card.
 * Previously copy-pasted across 14 call sites.
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
