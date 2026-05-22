"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { formatTime } from "@/lib/gameUtils";
import { useAutoPause } from "@/lib/useAutoPause";
import { PausedRules } from "@/components/games/PausedRules";
import { compactAnswer, parseClue, parsePattern } from "./parsing";
import { rateCryptic } from "./fetch";
import type { CrypticDailySession } from "./session";
import type { CrypticResponse } from "./types";

const CRYPTIC_RULES = [
  "Cryptic clues have two halves: a definition (somewhere at the start or end) and wordplay leading to the same answer.",
  "Type letters to fill the cells. Press Submit to check.",
  "Hints reveal the definition or one letter — each costs a point.",
];

interface ClueBoardProps {
  entry: CrypticResponse;
  onComplete: (time: number, errors: number) => void;
  initialSession?: CrypticDailySession | null;
  onSessionChange?: (state: CrypticDailySession) => void;
  /** Daily wrapper passes "daily" to get the pause/rules overlay; free-play uses "free" for an inline start. */
  variant?: "daily" | "free";
  /** Free-play only: callback for the "Next clue" button after solving. */
  onNext?: () => void;
  /** Daily wrapper passes false to skip thumbs (they live on the completion card instead). */
  showThumbs?: boolean;
}

export function ClueBoard({
  entry,
  onComplete,
  initialSession = null,
  onSessionChange,
  variant = "free",
  onNext,
  showThumbs = true,
}: ClueBoardProps) {
  const pattern = useMemo(() => parsePattern(entry.pattern), [entry.pattern]);
  const parsed = useMemo(() => parseClue(entry.clue), [entry.clue]);
  const targetCompact = useMemo(() => compactAnswer(entry.answer), [entry.answer]);
  const totalCells = pattern.totalLetters;

  const validInitial =
    initialSession && initialSession.clueId === entry.id && initialSession.cells.length === totalCells
      ? initialSession
      : null;

  const [cells, setCells] = useState<string[]>(() =>
    validInitial ? [...validInitial.cells] : Array(totalCells).fill("")
  );
  const [revealed, setRevealed] = useState<Set<number>>(
    () => new Set(validInitial?.revealed ?? [])
  );
  const [defRevealed, setDefRevealed] = useState<boolean>(
    validInitial?.defRevealed ?? false
  );
  const [errorCount, setErrorCount] = useState<number>(
    validInitial?.errorCount ?? 0
  );
  const [timer, setTimer] = useState<number>(validInitial?.timer ?? 0);
  const [paused, setPaused] = useState<boolean>(variant === "daily");
  const [caret, setCaret] = useState<number>(() => {
    if (!validInitial) return 0;
    const firstEmpty = validInitial.cells.findIndex((c, i) => !c && !validInitial.revealed.includes(i));
    return firstEmpty >= 0 ? firstEmpty : 0;
  });
  const [solved, setSolved] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const [upStatus, setUpStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [downStatus, setDownStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [voteMessage, setVoteMessage] = useState<string | null>(null);

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Reset state whenever the entry changes (e.g. free-play "next clue").
  const lastEntryIdRef = useRef(entry.id);
  useEffect(() => {
    if (lastEntryIdRef.current === entry.id) return;
    lastEntryIdRef.current = entry.id;
    setCells(Array(totalCells).fill(""));
    setRevealed(new Set());
    setDefRevealed(false);
    setErrorCount(0);
    setTimer(0);
    setPaused(variant === "daily");
    setCaret(0);
    setSolved(false);
    setUpStatus("idle");
    setDownStatus("idle");
    setVoteMessage(null);
  }, [entry.id, totalCells, variant]);

  // Hydrate sticky vote state per clue.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(`cryptic-rated-up-${entry.id}`) === "1") {
        setUpStatus("done");
      }
      if (localStorage.getItem(`cryptic-rated-down-${entry.id}`) === "1") {
        setDownStatus("done");
      }
    } catch {
      // ignore
    }
  }, [entry.id]);

  // Timer
  useEffect(() => {
    if (paused || solved) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [paused, solved]);

  useAutoPause(setPaused, solved);

  // Persist session
  useEffect(() => {
    if (!onSessionChange || solved) return;
    onSessionChange({
      clueId: entry.id,
      cells,
      revealed: Array.from(revealed),
      defRevealed,
      timer,
      errorCount,
    });
  }, [cells, revealed, defRevealed, timer, errorCount, entry.id, onSessionChange, solved]);

  // Auto-focus the hidden input when active.
  useEffect(() => {
    if (paused || solved) return;
    hiddenInputRef.current?.focus();
  }, [paused, solved, caret]);

  // Caret helpers — skip revealed/locked cells.
  const advanceCaret = useCallback(
    (from: number): number => {
      for (let i = from + 1; i < totalCells; i++) {
        if (!revealed.has(i)) return i;
      }
      return from;
    },
    [revealed, totalCells]
  );

  const retreatCaret = useCallback(
    (from: number): number => {
      for (let i = from - 1; i >= 0; i--) {
        if (!revealed.has(i)) return i;
      }
      return from;
    },
    [revealed]
  );

  const placeLetter = useCallback(
    (letter: string) => {
      if (paused || solved) return;
      const idx = caret;
      if (revealed.has(idx)) return;
      const next = [...cells];
      next[idx] = letter;
      setCells(next);
      setCaret(advanceCaret(idx));
    },
    [paused, solved, caret, cells, revealed, advanceCaret]
  );

  const handleBackspace = useCallback(() => {
    if (paused || solved) return;
    const idx = caret;
    if (cells[idx] && !revealed.has(idx)) {
      const next = [...cells];
      next[idx] = "";
      setCells(next);
      return;
    }
    const prev = retreatCaret(idx);
    if (prev === idx) return;
    const next = [...cells];
    if (!revealed.has(prev)) next[prev] = "";
    setCells(next);
    setCaret(prev);
  }, [paused, solved, caret, cells, revealed, retreatCaret]);

  // Filled = every non-revealed cell has a letter (revealed cells are auto-filled by the reveal hint).
  const filled = cells.every((c, i) => revealed.has(i) || c.length === 1);

  const handleSubmit = useCallback(() => {
    if (!filled || solved || paused) return;
    const guess = cells.map((c, i) => (revealed.has(i) ? c : c.toUpperCase())).join("");
    if (guess === targetCompact) {
      setSolved(true);
      onComplete(timer, errorCount);
    } else {
      setErrorCount((c) => c + 1);
      setShake(true);
      setTimeout(() => setShake(false), 320);
    }
  }, [filled, solved, paused, cells, revealed, targetCompact, onComplete, timer, errorCount]);

  // Keyboard input via the hidden input.
  const onHiddenKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (paused || solved) return;
      const key = e.key;
      if (/^[a-zA-Z]$/.test(key)) {
        e.preventDefault();
        placeLetter(key.toUpperCase());
        return;
      }
      if (key === "Backspace") {
        e.preventDefault();
        handleBackspace();
        return;
      }
      if (key === "Delete") {
        e.preventDefault();
        if (!revealed.has(caret)) {
          const next = [...cells];
          next[caret] = "";
          setCells(next);
        }
        return;
      }
      if (key === "ArrowLeft") {
        e.preventDefault();
        setCaret((c) => retreatCaret(c));
        return;
      }
      if (key === "ArrowRight") {
        e.preventDefault();
        setCaret((c) => advanceCaret(c));
        return;
      }
      if (key === "Home") {
        e.preventDefault();
        for (let i = 0; i < totalCells; i++) {
          if (!revealed.has(i)) {
            setCaret(i);
            return;
          }
        }
        return;
      }
      if (key === "End") {
        e.preventDefault();
        for (let i = totalCells - 1; i >= 0; i--) {
          if (!revealed.has(i)) {
            setCaret(i);
            return;
          }
        }
        return;
      }
      if (key === "Enter") {
        e.preventDefault();
        if (filled) handleSubmit();
        return;
      }
    },
    [paused, solved, caret, cells, revealed, totalCells, placeLetter, handleBackspace, retreatCaret, advanceCaret, filled, handleSubmit]
  );

  // Paste distribution.
  const onHiddenPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (paused || solved) return;
      const text = e.clipboardData
        .getData("text")
        .toUpperCase()
        .replace(/[^A-Z]/g, "");
      if (!text) return;
      const next = [...cells];
      let pos = caret;
      for (const ch of text) {
        while (pos < totalCells && revealed.has(pos)) pos++;
        if (pos >= totalCells) break;
        next[pos] = ch;
        pos++;
      }
      setCells(next);
      setCaret(Math.min(pos, totalCells - 1));
    },
    [paused, solved, cells, caret, revealed, totalCells]
  );

  const handleRevealDefinition = useCallback(() => {
    if (solved || paused || defRevealed) return;
    setDefRevealed(true);
    setErrorCount((c) => c + 1);
  }, [solved, paused, defRevealed]);

  const handleRevealLetter = useCallback(() => {
    if (solved || paused) return;
    const candidates: number[] = [];
    for (let i = 0; i < totalCells; i++) {
      if (revealed.has(i)) continue;
      if (cells[i] === targetCompact[i]) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const next = [...cells];
    next[pick] = targetCompact[pick];
    setCells(next);
    setRevealed((prev) => {
      const out = new Set(prev);
      out.add(pick);
      return out;
    });
    setErrorCount((c) => c + 1);
    if (caret === pick) setCaret(advanceCaret(pick));
  }, [solved, paused, cells, revealed, targetCompact, totalCells, caret, advanceCaret]);

  const handleStart = useCallback(() => {
    setPaused(false);
    setTimeout(() => hiddenInputRef.current?.focus(), 0);
  }, []);

  const submitVote = useCallback(
    async (direction: "up" | "down") => {
      const status = direction === "up" ? upStatus : downStatus;
      if (status === "submitting" || status === "done") return;
      const setStatus = direction === "up" ? setUpStatus : setDownStatus;
      setStatus("submitting");
      setVoteMessage(null);
      const res = await rateCryptic(entry.id, direction);
      if (!res.ok) {
        setStatus("error");
        setVoteMessage(res.error ?? "Vote failed");
        return;
      }
      setStatus("done");
      setVoteMessage(
        direction === "up" ? "Thanks — added to the good pool." : "Flagged for review."
      );
      try {
        localStorage.setItem(`cryptic-rated-${direction}-${entry.id}`, "1");
      } catch {
        // ignore
      }
    },
    [entry.id, upStatus, downStatus]
  );

  // ── Rendering helpers ──────────────────────────────────────────────────────
  const clueChunks = useMemo(() => buildClueChunks(parsed.display, parsed.defRanges), [parsed]);

  const cellLayout = useMemo(() => layoutCells(pattern), [pattern]);

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Header: timer / errors / pause */}
      <div className="flex w-full max-w-xl items-center justify-between text-sm">
        <span className="font-mono text-muted">{formatTime(timer)}</span>
        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <span className="text-xs text-red-400">
              {errorCount} {errorCount === 1 ? "penalty" : "penalties"}
            </span>
          )}
          {solved ? (
            <span className="text-sm font-medium text-accent">Solved!</span>
          ) : (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="rounded border border-border bg-card px-2 py-0.5 text-xs font-mono text-muted transition-colors hover:text-foreground"
            >
              {paused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </div>

      {/* Clue card with pause overlay */}
      <div className="relative w-full max-w-xl rounded-lg border border-border bg-card p-5">
        <div
          className={`transition-[filter] duration-200 ${
            paused && !solved ? "blur-md pointer-events-none select-none" : ""
          }`}
          aria-hidden={paused && !solved}
        >
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Cryptic clue
            </span>
            <span className="font-mono text-[11px] text-muted">
              ({entry.pattern})
            </span>
          </div>
          <p className="text-lg leading-relaxed text-foreground">
            {clueChunks.map((chunk, i) =>
              chunk.isDef ? (
                <mark
                  key={i}
                  className={
                    defRevealed
                      ? "rounded bg-accent/20 px-0.5 text-foreground"
                      : "bg-transparent text-foreground"
                  }
                >
                  {chunk.text}
                </mark>
              ) : (
                <span key={i}>{chunk.text}</span>
              )
            )}
          </p>
        </div>

        {paused && !solved && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
            <span className="text-sm font-medium text-foreground tracking-wide">
              {timer === 0 ? "Cryptic" : "Paused"}
            </span>
            <PausedRules rules={CRYPTIC_RULES} />
            <button
              type="button"
              onClick={handleStart}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              {timer === 0 ? "Start" : "Resume"}
            </button>
          </div>
        )}
      </div>

      {/* Letter cells */}
      <div
        className={`relative flex w-full max-w-xl flex-wrap items-center justify-center gap-y-2 ${
          shake ? "animate-cryptic-shake" : ""
        }`}
        role="textbox"
        aria-label={`Cryptic answer, ${pattern.totalLetters} letters`}
      >
        {cellLayout.map((slot, slotIdx) => {
          if (slot.type === "sep") {
            return (
              <span
                key={`sep-${slotIdx}`}
                className="mx-1 select-none text-xl text-muted font-mono"
                aria-hidden
              >
                {slot.char === "-" ? "-" : " "}
              </span>
            );
          }
          const i = slot.index;
          const value = cells[i] ?? "";
          const isRevealed = revealed.has(i);
          const isCaret = !paused && !solved && caret === i;
          const baseColor = solved
            ? "border-accent/60 bg-accent/15 text-accent"
            : isRevealed
            ? "border-accent/40 bg-accent/10 text-accent"
            : isCaret
            ? "border-accent bg-card text-foreground"
            : "border-border bg-card text-foreground";
          return (
            <button
              key={`cell-${i}`}
              type="button"
              onClick={() => {
                if (paused || solved) return;
                if (!revealed.has(i)) setCaret(i);
                hiddenInputRef.current?.focus();
              }}
              className={`flex h-10 w-9 sm:h-12 sm:w-10 items-center justify-center border-2 rounded-sm font-mono text-lg sm:text-xl font-bold transition-colors ${baseColor} ${
                shake ? "" : ""
              }`}
              aria-label={`Letter ${i + 1} of ${totalCells}${
                isRevealed ? ", revealed" : value ? `, ${value}` : ", empty"
              }`}
              disabled={paused && !solved}
            >
              {value}
            </button>
          );
        })}
        {/* Off-screen input that owns all keystrokes. */}
        <input
          ref={hiddenInputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          value=""
          onChange={() => {
            // Controlled but ignored — we read keys from onKeyDown.
          }}
          onKeyDown={onHiddenKeyDown}
          onPaste={onHiddenPaste}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
        />
      </div>

      {/* Action row */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!filled || solved || paused}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {solved ? "Solved" : "Submit"}
        </button>
        <button
          type="button"
          onClick={handleRevealDefinition}
          disabled={solved || paused || defRevealed}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-50"
        >
          {defRevealed ? "Definition shown" : "Show definition (+1)"}
        </button>
        <button
          type="button"
          onClick={handleRevealLetter}
          disabled={solved || paused}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-50"
        >
          Reveal a letter (+1)
        </button>
      </div>

      {/* Post-solve panel */}
      {solved && (
        <div className="w-full max-w-xl space-y-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <div className="space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-accent">
              Answer
            </span>
            <p className="font-mono text-xl tracking-widest text-foreground">
              {entry.answer}
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Wordplay
            </span>
            <p className="font-mono text-sm leading-relaxed text-foreground">
              {entry.wordplay || "—"}
            </p>
          </div>

          {showThumbs && (
            <div className="flex flex-col items-start gap-1.5 border-t border-border pt-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Rate this clue
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => submitVote("up")}
                  disabled={upStatus === "submitting" || upStatus === "done"}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-60"
                  aria-label="Add this clue to the good pool"
                >
                  {upStatus === "done"
                    ? "👍 Liked"
                    : upStatus === "submitting"
                    ? "Saving…"
                    : "👍 Good clue"}
                </button>
                <button
                  type="button"
                  onClick={() => submitVote("down")}
                  disabled={downStatus === "submitting" || downStatus === "done"}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-60"
                  aria-label="Flag this clue for review"
                  title="Flag for review on /cluereview"
                >
                  {downStatus === "done"
                    ? "👎 Flagged"
                    : downStatus === "submitting"
                    ? "Flagging…"
                    : "👎 Bad clue"}
                </button>
              </div>
              {voteMessage && (
                <p className="text-[11px] text-muted">{voteMessage}</p>
              )}
            </div>
          )}

          {variant === "free" && onNext && (
            <button
              type="button"
              onClick={onNext}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              Next clue →
            </button>
          )}
        </div>
      )}

    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type ClueChunk = { text: string; isDef: boolean };

function buildClueChunks(display: string, ranges: [number, number][]): ClueChunk[] {
  if (ranges.length === 0) return [{ text: display, isDef: false }];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const chunks: ClueChunk[] = [];
  let cursor = 0;
  for (const [start, end] of sorted) {
    if (start > cursor) chunks.push({ text: display.slice(cursor, start), isDef: false });
    if (end > start) chunks.push({ text: display.slice(start, end), isDef: true });
    cursor = end;
  }
  if (cursor < display.length) chunks.push({ text: display.slice(cursor), isDef: false });
  return chunks;
}

type CellSlot = { type: "cell"; index: number } | { type: "sep"; char: "-" | "," };

function layoutCells(pattern: {
  segments: number[];
  separators: ("," | "-")[];
}): CellSlot[] {
  const out: CellSlot[] = [];
  let idx = 0;
  for (let s = 0; s < pattern.segments.length; s++) {
    for (let c = 0; c < pattern.segments[s]; c++) {
      out.push({ type: "cell", index: idx++ });
    }
    if (s < pattern.separators.length) {
      out.push({ type: "sep", char: pattern.separators[s] });
    }
  }
  return out;
}

