"use client";

/**
 * Up/down vote pair shown on the daily-crossword completion card.
 *
 * 👍 routes through `/api/crossword/upvote`, which promotes the puzzle
 * into the approved pool that future days draw from first.
 *
 * 👎 routes through `/api/crossword/downvote`, which appends the
 * puzzle's answer+clue list to `data/crossword-flagged.json` so the
 * maintainer can review the clues offline.
 *
 * Each vote is sticky per-puzzle in localStorage so a refresh doesn't
 * tease repeat clicks. The two are independent — voting one direction
 * doesn't block the other (some players will want to upvote for being
 * fun while still flagging a single bad clue).
 */

import { useCallback, useEffect, useState } from "react";
import type { Puzzle } from "@/games/crossword/types";

interface CrosswordVoteButtonsProps {
  puzzleId: string;
  /**
   * Optional full-puzzle payload. The daily flow omits this — the
   * server already has the puzzle in its pools. The freeform
   * `/games/crossword` flow generates puzzles client-side that aren't
   * in any pool; passing the puzzle here lets the vote endpoints
   * verify + accept the inline JSON.
   */
  puzzle?: Puzzle;
}

const UP_PREFIX = "crossword-upvoted-";
const DOWN_PREFIX = "crossword-downvoted-";

type Direction = "up" | "down";
type Status = "idle" | "submitting" | "done" | "error";

function storageKey(dir: Direction, puzzleId: string): string {
  return `${dir === "up" ? UP_PREFIX : DOWN_PREFIX}${puzzleId}`;
}

export function CrosswordVoteButtons({
  puzzleId,
  puzzle,
}: CrosswordVoteButtonsProps) {
  const [upStatus, setUpStatus] = useState<Status>("idle");
  const [downStatus, setDownStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<{
    direction: Direction;
    text: string;
    tone: "ok" | "error";
  } | null>(null);

  // Hydrate sticky state on mount so a refresh doesn't tempt the user
  // into voting twice. Server dedupes anyway, but the UX should match.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(storageKey("up", puzzleId)) === "1") {
        setUpStatus("done");
      }
      if (window.localStorage.getItem(storageKey("down", puzzleId)) === "1") {
        setDownStatus("done");
      }
    } catch {
      // localStorage off — leave both idle; the server will dedupe.
    }
  }, [puzzleId]);

  const submit = useCallback(
    async (direction: Direction) => {
      const status = direction === "up" ? upStatus : downStatus;
      if (status === "submitting" || status === "done") return;

      const setStatus = direction === "up" ? setUpStatus : setDownStatus;
      setStatus("submitting");
      setMessage(null);

      try {
        const endpoint =
          direction === "up"
            ? "/api/crossword/upvote"
            : "/api/crossword/downvote";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            // Only send the puzzle inline when the caller provided one
            // — keeps the daily POST body small (~30 bytes vs ~3 KB).
            puzzle ? { puzzleId, puzzle } : { puzzleId }
          ),
        });
        const data = (await res.json().catch(() => null)) as
          | {
              ok?: boolean;
              upvotes?: number;
              flags?: number;
              error?: string;
            }
          | null;

        if (!res.ok) {
          setStatus("error");
          setMessage({
            direction,
            text: data?.error ?? `Vote failed (${res.status})`,
            tone: "error",
          });
          return;
        }

        setStatus("done");
        const count =
          direction === "up" ? data?.upvotes : data?.flags;
        setMessage({
          direction,
          tone: "ok",
          text:
            direction === "up"
              ? typeof count === "number"
                ? `Thanks — ${count} upvote${count === 1 ? "" : "s"} so far`
                : "Thanks for the upvote!"
              : "Flagged — clues queued for review",
        });
        try {
          window.localStorage.setItem(storageKey(direction, puzzleId), "1");
        } catch {
          // ignore — server dedup keeps things honest
        }
      } catch (err) {
        setStatus("error");
        setMessage({
          direction,
          tone: "error",
          text: err instanceof Error ? err.message : "Network error",
        });
      }
    },
    [puzzleId, puzzle, upStatus, downStatus]
  );

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => submit("up")}
          disabled={upStatus === "submitting" || upStatus === "done"}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-60 disabled:hover:bg-card disabled:hover:text-muted"
          aria-label="Upvote today's crossword"
        >
          {upStatus === "done"
            ? "👍 Upvoted"
            : upStatus === "submitting"
              ? "Upvoting…"
              : "👍 Liked it"}
        </button>
        <button
          type="button"
          onClick={() => submit("down")}
          disabled={downStatus === "submitting" || downStatus === "done"}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-60 disabled:hover:bg-card disabled:hover:text-muted"
          aria-label="Flag today's crossword for clue review"
          title="Flag the clues for the maintainer to review"
        >
          {downStatus === "done"
            ? "👎 Flagged"
            : downStatus === "submitting"
              ? "Flagging…"
              : "👎 Bad clue?"}
        </button>
      </div>
      {message && (
        <p
          className={`text-[11px] ${
            message.tone === "error" ? "text-red-400" : "text-muted"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
