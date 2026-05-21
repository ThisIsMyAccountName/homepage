"use client";

/**
 * Upvote button surfaced on the daily-crossword completion card.
 *
 * Posts the puzzle's stable id to `/api/crossword/upvote`. The server
 * dedupes by hashed-IP so a refresh-and-retry doesn't multiply the
 * count, but client-side we also disable the button after a successful
 * vote so the UX matches.
 *
 * To resist the obvious "I'll just close and reopen the tab to vote
 * again" pattern, the success state is cached in localStorage keyed by
 * puzzle id. (A determined user can still clear it — this is a vibes
 * curation signal, not a security boundary.)
 */

import { useCallback, useEffect, useState } from "react";

interface CrosswordUpvoteProps {
  puzzleId: string;
}

const STORAGE_PREFIX = "crossword-upvoted-";

type Status = "idle" | "submitting" | "done" | "error";

export function CrosswordUpvote({ puzzleId }: CrosswordUpvoteProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Hydrate "already upvoted" state from localStorage so the button
  // doesn't tease repeat clicks after a refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (
        window.localStorage.getItem(`${STORAGE_PREFIX}${puzzleId}`) === "1"
      ) {
        setStatus("done");
      }
    } catch {
      // localStorage off — leave idle; the server dedup will catch repeats.
    }
  }, [puzzleId]);

  const handleClick = useCallback(async () => {
    if (status === "submitting" || status === "done") return;
    setStatus("submitting");
    setMessage(null);
    try {
      const res = await fetch("/api/crossword/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; upvotes?: number; error?: string }
        | null;
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error ?? `Upvote failed (${res.status})`);
        return;
      }
      setStatus("done");
      setMessage(
        typeof data?.upvotes === "number"
          ? `Thanks — ${data.upvotes} upvote${data.upvotes === 1 ? "" : "s"} so far`
          : "Thanks for the upvote!"
      );
      try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${puzzleId}`, "1");
      } catch {
        // ignore — server dedup keeps things honest
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Network error");
    }
  }, [puzzleId, status]);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "submitting" || status === "done"}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-60 disabled:hover:bg-card disabled:hover:text-muted"
        aria-label="Upvote today's crossword"
      >
        {status === "done"
          ? "👍 Upvoted"
          : status === "submitting"
            ? "Upvoting…"
            : "👍 I liked this puzzle"}
      </button>
      {message && (
        <p
          className={`text-[11px] ${
            status === "error" ? "text-red-400" : "text-muted"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
