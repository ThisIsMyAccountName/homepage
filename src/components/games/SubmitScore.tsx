"use client";

import { useState } from "react";
import { sanitizeName } from "@/lib/security";

export type GameId = "sudoku" | "nonogram" | "x-coloring" | "crossword";

interface SubmitScoreProps {
  game: GameId;
  time: number;
  errors: number;
  /** Fires after the score is accepted by the API. Receives the sanitized name. */
  onSubmitted?: (name: string) => void;
}

export function SubmitScore({ game, time, errors, onSubmitted }: SubmitScoreProps) {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [easterEgg, setEasterEgg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

      if (!res.ok) {
        setError(data.error || "Submission failed");
        setSubmitting(false);
        return;
      }

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
