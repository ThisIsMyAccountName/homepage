"use client";

import { useEffect, useState } from "react";
import { getTodayKey } from "@/lib/daily";
import { sanitizeName } from "@/lib/security";

export type GameId = "sudoku" | "nonogram" | "x-coloring" | "crossword";

interface SubmitScoreProps {
  game: GameId;
  time: number;
  errors: number;
  /** Fires after the score is accepted by the API. Receives the sanitized name. */
  onSubmitted?: (name: string) => void;
}

/**
 * Per-day, per-game sticky flag so a page refresh doesn't re-show the submit
 * form after the user has already claimed a leaderboard slot. The server
 * enforces the same one-per-day cap by IP — this is the UX half of that.
 */
const SUBMIT_FLAG_PREFIX = "daily-submitted-v1-";
function submitFlagKey(game: GameId, dateKey: string): string {
  return `${SUBMIT_FLAG_PREFIX}${dateKey}-${game}`;
}

function readSubmittedName(game: GameId): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(submitFlagKey(game, getTodayKey()));
  } catch {
    return null;
  }
}

function writeSubmittedName(game: GameId, name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(submitFlagKey(game, getTodayKey()), name);
  } catch {
    // quota / private-mode — silently drop; the server still enforces.
  }
}

export function SubmitScore({ game, time, errors, onSubmitted }: SubmitScoreProps) {
  const [name, setName] = useState("");
  // Initialize from localStorage so a refresh after submitting keeps the
  // form hidden. Safe to read in the initializer because this component
  // only mounts on the client (the daily hub is `dynamic({ ssr: false })`).
  const [submitted, setSubmitted] = useState(() => readSubmittedName(game) !== null);
  const [error, setError] = useState<string | null>(null);
  const [easterEgg, setEasterEgg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // On mount (or when the game prop changes), tell the parent the
  // already-submitted name so the leaderboard can highlight the row even
  // after a refresh — otherwise the user loses that visual anchor.
  useEffect(() => {
    const stored = readSubmittedName(game);
    if (stored) onSubmitted?.(stored);
    // Intentionally not depending on `onSubmitted` — the parent passes a
    // fresh function each render, and we only want to fire this once per
    // game change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitted) return;

    const { exploitDetected } = sanitizeName(name);
    if (exploitDetected) {
      setEasterEgg(
        "Nice try! Your hacking skills are impressive, but maybe use them on CTFs instead?"
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), time, errors, game }),
      });
      const data = await res.json();

      if (data.easterEgg) {
        setEasterEgg(data.error);
        setSubmitting(false);
        return;
      }

      // Server rejected because this IP already submitted today — treat as
      // a successful "already done" so the form stays out of the way.
      if (data.alreadySubmitted) {
        writeSubmittedName(game, name.trim());
        setSubmitted(true);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Submission failed");
        setSubmitting(false);
        return;
      }

      writeSubmittedName(game, name.trim());
      setSubmitted(true);
      onSubmitted?.(name.trim());
    } catch {
      setError("Network error. Try again.");
    }
    setSubmitting(false);
  };

  if (easterEgg) {
    return (
      <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-3 text-center">
        <p className="text-xs text-accent font-mono">{easterEgg}</p>
        <p className="text-[10px] text-muted mt-1">
          Your attempt has been logged. Better luck next time.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <p className="mt-4 text-center text-sm text-accent">
        Score submitted! Check the leaderboard.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "..." : "Submit"}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </form>
  );
}
