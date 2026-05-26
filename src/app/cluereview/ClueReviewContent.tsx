"use client";

import { useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import type { Puzzle } from "@/games/crossword/types";
import type { StoredPuzzle } from "@/games/crossword/storedPuzzle";
import { ALL_SHAPES, type ShapeKey } from "@/games/crossword/types";

const SESSION_KEY = "clue-review-pw";

interface FlaggedEntry {
  direction: "across" | "down";
  number: number;
  answer: string;
  clue: string;
}

interface FlaggedRecord {
  puzzleId: string;
  shape: string;
  firstFlaggedAt: number;
  flagCount: number;
  entries: FlaggedEntry[];
}

interface DeletedClueEntry {
  word: string;
  clue: string;
  deletedAt: number;
}

interface CrypticFlaggedEntry {
  key: string;
  clue: string;
  pattern: string;
  wordplay: string;
  firstFlaggedAt: number;
  lastFlaggedAt: number;
  count: number;
}

interface CrypticDeletedEntry {
  key: string;
  clue?: string;
  pattern?: string;
  wordplay?: string;
  deletedAt: number;
}

function authHeaders(pw: string): HeadersInit {
  return { "x-review-password": pw, "Content-Type": "application/json" };
}

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/cluereview", {
      headers: { "x-review-password": input },
    });
    setBusy(false);
    if (res.status === 401) {
      setError("Wrong password.");
      return;
    }
    if (!res.ok) {
      setError("Server error. Is CLUE_REVIEW_PASSWORD set?");
      return;
    }
    onAuth(input);
  };

  return (
    <PageContainer
      title="Clue Review"
      description="Password-protected moderation queue for flagged crossword clues."
    >
      <form onSubmit={submit} className="max-w-xs space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1.5">Password</label>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            className="w-full bg-card border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
            placeholder="Enter review password"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy || !input}
          className="bg-accent text-background text-sm font-medium px-4 py-2 rounded hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </PageContainer>
  );
}

// ─── Generated-puzzle preview + approve flow ──────────────────────────────────

type ApprovedStatus =
  | { kind: "idle" }
  | { kind: "ok"; poolSize: number; alreadyApproved: boolean }
  | { kind: "error"; message: string };

function PuzzlePreview({
  puzzle,
  deletedKeys,
  pendingKeys,
  reclueingKeys,
  exhaustedAnswers,
  onDeleteClue,
  onReclue,
}: {
  puzzle: StoredPuzzle;
  deletedKeys: Set<string>;
  pendingKeys: Set<string>;
  reclueingKeys: Set<string>;
  exhaustedAnswers: Set<string>;
  onDeleteClue: (answer: string, clue: string) => void;
  onReclue: (direction: "across" | "down", number: number) => void;
}) {
  const cellPx = 40;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div
        className="relative grid shrink-0 border-2 border-foreground/60"
        style={{
          width: puzzle.cols * cellPx,
          height: puzzle.rows * cellPx,
          gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)`,
          gridTemplateRows: `repeat(${puzzle.rows}, 1fr)`,
        }}
      >
        {puzzle.solution.map((row, r) =>
          row.map((letter, c) => {
            const isBlack = puzzle.black[r][c];
            const number = puzzle.numbers[r][c];
            if (isBlack) {
              return (
                <div
                  key={`${r},${c}`}
                  className="border-r border-b border-foreground/60"
                  style={{
                    backgroundColor: "#3f3f46",
                    borderRightWidth: c === puzzle.cols - 1 ? 0 : undefined,
                    borderBottomWidth: r === puzzle.rows - 1 ? 0 : undefined,
                  }}
                />
              );
            }
            return (
              <div
                key={`${r},${c}`}
                className="relative bg-card border-r border-b border-foreground/40 flex items-center justify-center"
                style={{
                  borderRightWidth: c === puzzle.cols - 1 ? 0 : undefined,
                  borderBottomWidth: r === puzzle.rows - 1 ? 0 : undefined,
                }}
              >
                {number !== null && (
                  <span className="pointer-events-none absolute left-0.5 top-0 font-mono text-[0.55rem] leading-tight text-muted">
                    {number}
                  </span>
                )}
                <span className="font-mono font-bold text-foreground text-lg">
                  {letter}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:flex-1">
        <ClueColumn
          title="Across"
          entries={puzzle.entries.across}
          deletedKeys={deletedKeys}
          pendingKeys={pendingKeys}
          reclueingKeys={reclueingKeys}
          exhaustedAnswers={exhaustedAnswers}
          onDeleteClue={onDeleteClue}
          onReclue={onReclue}
        />
        <ClueColumn
          title="Down"
          entries={puzzle.entries.down}
          deletedKeys={deletedKeys}
          pendingKeys={pendingKeys}
          reclueingKeys={reclueingKeys}
          exhaustedAnswers={exhaustedAnswers}
          onDeleteClue={onDeleteClue}
          onReclue={onReclue}
        />
      </div>
    </div>
  );
}

function clueKey(answer: string, clue: string) {
  return `${answer}|||${clue}`;
}

function ClueColumn({
  title,
  entries,
  deletedKeys,
  pendingKeys,
  reclueingKeys,
  exhaustedAnswers,
  onDeleteClue,
  onReclue,
}: {
  title: string;
  entries: Puzzle["entries"]["across"];
  deletedKeys: Set<string>;
  pendingKeys: Set<string>;
  reclueingKeys: Set<string>;
  exhaustedAnswers: Set<string>;
  onDeleteClue: (answer: string, clue: string) => void;
  onReclue: (direction: "across" | "down", number: number) => void;
}) {
  return (
    <div>
      <h4 className="font-mono text-xs uppercase tracking-wider text-muted mb-1.5">
        {title}
      </h4>
      <ol className="space-y-1">
        {entries.map((e) => {
          const key = clueKey(e.answer, e.clue);
          const deleted = deletedKeys.has(key);
          const pending = pendingKeys.has(key);
          const reclueing = reclueingKeys.has(`${e.direction}-${e.number}`);
          const exhausted = exhaustedAnswers.has(e.answer);
          return (
            <li
              key={`${e.direction}-${e.number}`}
              className={`flex items-start gap-2 leading-snug ${
                deleted ? "opacity-50" : ""
              }`}
            >
              <span className="flex-1">
                <span className="font-mono text-xs text-muted">{e.number}.</span>{" "}
                <span
                  className={`text-foreground ${
                    deleted ? "line-through" : ""
                  }`}
                >
                  {e.clue}
                </span>{" "}
                <span className="font-mono text-xs text-accent">
                  ({e.answer})
                </span>
              </span>
              {deleted ? (
                <span className="text-xs text-muted italic shrink-0">
                  deleted
                </span>
              ) : (
                <span className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onReclue(e.direction, e.number)}
                    disabled={reclueing || pending || exhausted}
                    title={
                      exhausted
                        ? `No other clues available for ${e.answer}`
                        : "Swap in a different clue for this answer"
                    }
                    className="text-xs text-accent hover:text-accent-hover border border-accent/30 hover:border-accent/60 rounded px-2 py-0.5 transition-colors disabled:opacity-50"
                  >
                    {reclueing ? "…" : "New clue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteClue(e.answer, e.clue)}
                    disabled={pending || reclueing}
                    title="Remove this clue from the bank"
                    className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/60 rounded px-2 py-0.5 transition-colors disabled:opacity-50"
                  >
                    {pending ? "…" : "Delete"}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function GeneratorSection({
  password,
  onClueDeleted,
}: {
  password: string;
  onClueDeleted: (entry: DeletedClueEntry) => void;
}) {
  const [shape, setShape] = useState<"auto" | ShapeKey>("auto");
  const [puzzle, setPuzzle] = useState<StoredPuzzle | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [status, setStatus] = useState<ApprovedStatus>({ kind: "idle" });
  // Clues the mod marked bad in this preview — they're already gone from
  // the source bank, but we still block Approve so the bad clue can't
  // ride into the daily pool inside the *current* puzzle. The mod hits
  // Regenerate to get a clean one.
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  // Per-entry reclue spinners (keyed `${direction}-${number}`), and a
  // set of answers we've already learned have no alternates in the bank
  // so the "New clue" button stays disabled instead of round-tripping
  // for another 404.
  const [reclueingKeys, setReclueingKeys] = useState<Set<string>>(new Set());
  const [exhaustedAnswers, setExhaustedAnswers] = useState<Set<string>>(
    new Set()
  );

  const generate = async () => {
    setGenerating(true);
    setGenError(null);
    setStatus({ kind: "idle" });
    setDeletedKeys(new Set());
    setPendingKeys(new Set());
    setReclueingKeys(new Set());
    setExhaustedAnswers(new Set());
    try {
      const res = await fetch("/api/cluereview/generate", {
        method: "POST",
        headers: authHeaders(password),
        body: JSON.stringify(shape === "auto" ? {} : { shape }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPuzzle(null);
        setGenError(data?.error ?? `Generator failed (${res.status})`);
      } else {
        setPuzzle(data.puzzle as StoredPuzzle);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteClue = async (answer: string, clue: string) => {
    const key = clueKey(answer, clue);
    if (deletedKeys.has(key) || pendingKeys.has(key)) return;
    setPendingKeys((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/cluereview/delete-clue", {
        method: "POST",
        headers: authHeaders(password),
        body: JSON.stringify({ word: answer, clue }),
      });
      if (!res.ok) return;
      setDeletedKeys((prev) => new Set(prev).add(key));
      onClueDeleted({ word: answer, clue, deletedAt: Date.now() });

      // Auto-swap: pick a fresh clue for the same answer so the puzzle
      // stays approvable. If the bank has no alternates we leave the
      // entry struck-through and the Approve gate stays on — the mod
      // can regenerate instead.
      const reclueRes = await fetch("/api/cluereview/reclue", {
        method: "POST",
        headers: authHeaders(password),
        body: JSON.stringify({ answer, excludeClue: clue }),
      });
      if (reclueRes.status === 404) {
        setExhaustedAnswers((prev) => new Set(prev).add(answer));
        return;
      }
      if (!reclueRes.ok) return;
      const data = (await reclueRes.json()) as { clue?: string };
      if (typeof data.clue !== "string") return;
      const nextClue = data.clue;
      setPuzzle((cur) => {
        if (!cur) return cur;
        const swap = (e: Puzzle["entries"]["across"][number]) =>
          e.answer === answer && e.clue === clue ? { ...e, clue: nextClue } : e;
        return {
          ...cur,
          entries: {
            across: cur.entries.across.map(swap),
            down: cur.entries.down.map(swap),
          },
        };
      });
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const approve = async () => {
    if (!puzzle) return;
    setApproving(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/cluereview/approve", {
        method: "POST",
        headers: authHeaders(password),
        body: JSON.stringify({ puzzleId: puzzle.id, puzzle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data?.error ?? `Approval failed (${res.status})`,
        });
      } else {
        setStatus({
          kind: "ok",
          poolSize: data.poolSize ?? 0,
          alreadyApproved: !!data.alreadyApproved,
        });
        setPuzzle(null);
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReclue = async (
    direction: "across" | "down",
    number: number
  ) => {
    if (!puzzle) return;
    const list =
      direction === "across" ? puzzle.entries.across : puzzle.entries.down;
    const entry = list.find((e) => e.number === number);
    if (!entry) return;

    const reclueKey = `${direction}-${number}`;
    setReclueingKeys((prev) => new Set(prev).add(reclueKey));
    try {
      const res = await fetch("/api/cluereview/reclue", {
        method: "POST",
        headers: authHeaders(password),
        body: JSON.stringify({ answer: entry.answer, excludeClue: entry.clue }),
      });
      if (res.status === 404) {
        setExhaustedAnswers((prev) => new Set(prev).add(entry.answer));
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { clue?: string };
      if (typeof data.clue !== "string") return;
      const nextClue = data.clue;
      setPuzzle((cur) => {
        if (!cur) return cur;
        const swap = (e: Puzzle["entries"]["across"][number]) =>
          e.direction === direction && e.number === number
            ? { ...e, clue: nextClue }
            : e;
        return {
          ...cur,
          entries: {
            across: cur.entries.across.map(swap),
            down: cur.entries.down.map(swap),
          },
        };
      });
    } finally {
      setReclueingKeys((prev) => {
        const next = new Set(prev);
        next.delete(reclueKey);
        return next;
      });
    }
  };

  const discard = () => {
    setPuzzle(null);
    setStatus({ kind: "idle" });
    setDeletedKeys(new Set());
    setPendingKeys(new Set());
    setReclueingKeys(new Set());
    setExhaustedAnswers(new Set());
  };

  // Approve is gated on whether any clue *currently in the puzzle* has
  // been marked bad. Swapping that clue via "New clue" clears the gate
  // automatically — the deleted entry just lives on in `deletedKeys` as
  // a record of what was purged from the bank.
  const hasBadClueInPuzzle = puzzle
    ? [...puzzle.entries.across, ...puzzle.entries.down].some((e) =>
        deletedKeys.has(clueKey(e.answer, e.clue))
      )
    : false;

  return (
    <section className="mb-12">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg font-semibold">Generate Daily Crossword</h2>
        <span className="font-mono text-xs text-muted">
          on-demand → daily pool
        </span>
      </div>

      <div className="border border-border rounded p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Shape</label>
            <select
              value={shape}
              onChange={(e) =>
                setShape(e.target.value as "auto" | ShapeKey)
              }
              disabled={generating}
              className="bg-card border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent disabled:opacity-50"
            >
              <option value="auto">Auto (random)</option>
              {ALL_SHAPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={generating || approving}
            className="bg-accent text-background text-sm font-medium px-4 py-2 rounded hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating…" : puzzle ? "Regenerate" : "Generate"}
          </button>
          {puzzle && (
            <>
              <button
                type="button"
                onClick={approve}
                disabled={approving || generating || hasBadClueInPuzzle}
                title={
                  hasBadClueInPuzzle
                    ? "This puzzle still contains clues you marked bad — swap them (New clue) or regenerate before approving."
                    : undefined
                }
                className="border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-400/60 text-sm font-medium px-4 py-2 rounded disabled:opacity-50 transition-colors"
              >
                {approving ? "Approving…" : "Approve → add to pool"}
              </button>
              <button
                type="button"
                onClick={discard}
                disabled={approving || generating}
                className="border border-border text-muted hover:text-foreground hover:border-accent/40 text-sm px-4 py-2 rounded disabled:opacity-50 transition-colors"
              >
                Discard
              </button>
            </>
          )}
        </div>

        {genError && (
          <p className="text-red-400 text-sm">{genError}</p>
        )}

        {status.kind === "ok" && (
          <p className="text-emerald-300 text-sm">
            {status.alreadyApproved
              ? "Already in the daily pool."
              : `Added to daily pool (${status.poolSize} approved puzzle${
                  status.poolSize === 1 ? "" : "s"
                }).`}
          </p>
        )}
        {status.kind === "error" && (
          <p className="text-red-400 text-sm">{status.message}</p>
        )}

        {puzzle ? (
          <div className="pt-2 border-t border-border">
            <div className="flex flex-wrap items-baseline gap-3 mb-3 text-xs text-muted">
              <span className="font-mono">{puzzle.id}</span>
              <span className="border border-border rounded px-2 py-0.5">
                {puzzle.shape}
              </span>
              <span>
                {puzzle.entries.across.length + puzzle.entries.down.length} clues
              </span>
              {hasBadClueInPuzzle && (
                <span className="text-amber-300/90">
                  Bad clue still in this puzzle — swap it (New clue) or
                  regenerate before approving.
                </span>
              )}
            </div>
            <PuzzlePreview
              puzzle={puzzle}
              deletedKeys={deletedKeys}
              pendingKeys={pendingKeys}
              reclueingKeys={reclueingKeys}
              exhaustedAnswers={exhaustedAnswers}
              onDeleteClue={handleDeleteClue}
              onReclue={handleReclue}
            />
          </div>
        ) : (
          <p className="text-muted text-sm">
            Generate a puzzle to preview it here. Approving copies it into{" "}
            <code className="font-mono text-amber-300/90">
              data/crossword-approved.json
            </code>{" "}
            so it joins the daily rotation immediately.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Single flagged-puzzle card ───────────────────────────────────────────────

function FlaggedCard({
  record,
  deletedKeys,
  onDelete,
  onDismiss,
}: {
  record: FlaggedRecord;
  deletedKeys: Set<string>;
  onDelete: (word: string, clue: string) => void;
  onDismiss: (puzzleId: string) => void;
}) {
  const flaggedDate = new Date(record.firstFlaggedAt).toLocaleDateString();

  return (
    <div className="border border-border rounded overflow-hidden">
      {/* Card header */}
      <div className="bg-card px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs text-muted">{record.puzzleId}</span>
          <span className="text-xs border border-border rounded px-2 py-0.5 text-muted">
            {record.shape}
          </span>
          <span className="text-xs text-red-400">
            {record.flagCount} flag{record.flagCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-muted">flagged {flaggedDate}</span>
        </div>
        <button
          onClick={() => onDismiss(record.puzzleId)}
          className="text-xs text-muted hover:text-foreground border border-border rounded px-3 py-1 hover:border-accent/40 transition-colors"
        >
          Dismiss puzzle
        </button>
      </div>

      {/* Clue table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border bg-background/50">
              <th className="text-left px-4 py-2 text-muted font-medium text-xs w-16">Dir</th>
              <th className="text-left px-4 py-2 text-muted font-medium text-xs w-8">#</th>
              <th className="text-left px-4 py-2 text-muted font-medium text-xs w-28">Answer</th>
              <th className="text-left px-4 py-2 text-muted font-medium text-xs">Clue</th>
              <th className="px-4 py-2 text-xs w-20" />
            </tr>
          </thead>
          <tbody>
            {record.entries.map((entry, i) => {
              const key = `${entry.answer}|||${entry.clue}`;
              const deleted = deletedKeys.has(key);
              return (
                <tr
                  key={i}
                  className={`border-b border-border last:border-0 transition-opacity ${
                    deleted ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">
                    {entry.direction}
                  </td>
                  <td className="px-4 py-2.5 text-muted text-xs">{entry.number}</td>
                  <td className="px-4 py-2.5 font-mono text-accent text-sm">
                    {entry.answer}
                  </td>
                  <td className="px-4 py-2.5">{entry.clue}</td>
                  <td className="px-4 py-2.5 text-right">
                    {deleted ? (
                      <span className="text-xs text-muted italic">deleted</span>
                    ) : (
                      <button
                        onClick={() => onDelete(entry.answer, entry.clue)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/60 rounded px-2 py-0.5 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main review view ─────────────────────────────────────────────────────────

function ReviewView({ password }: { password: string }) {
  const [flagged, setFlagged] = useState<FlaggedRecord[]>([]);
  const [deletedLog, setDeletedLog] = useState<DeletedClueEntry[]>([]);
  const [crypticFlagged, setCrypticFlagged] = useState<CrypticFlaggedEntry[]>([]);
  const [crypticGood, setCrypticGood] = useState<string[]>([]);
  const [crypticDeletedLog, setCrypticDeletedLog] = useState<CrypticDeletedEntry[]>([]);
  const [crypticHandled, setCrypticHandled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  // "WORD|||clue" keys for optimistic deleted-clue UI
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  const pwRef = useRef(password);

  useEffect(() => {
    pwRef.current = password;
  }, [password]);

  useEffect(() => {
    fetch("/api/cluereview", {
      headers: { "x-review-password": password },
    })
      .then((r) => r.json())
      .then((data) => {
        setFlagged(data.flagged ?? []);
        setDeletedLog(data.deletedLog ?? []);
        setCrypticFlagged(data.crypticFlagged ?? []);
        setCrypticGood(data.crypticGood ?? []);
        setCrypticDeletedLog(data.crypticDeletedLog ?? []);
        setLoading(false);
      });
  }, [password]);

  const handleDelete = async (word: string, clue: string) => {
    const key = `${word}|||${clue}`;
    // Optimistic
    setDeletedKeys((prev) => new Set(prev).add(key));
    const res = await fetch("/api/cluereview/delete-clue", {
      method: "POST",
      headers: authHeaders(pwRef.current),
      body: JSON.stringify({ word, clue }),
    });
    if (!res.ok) {
      setDeletedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setDeletedLog((prev) =>
        prev.some((e) => e.word === word && e.clue === clue)
          ? prev
          : [...prev, { word, clue, deletedAt: Date.now() }]
      );
    }
  };

  const handleDismiss = async (puzzleId: string) => {
    // Optimistic
    setDismissedIds((prev) => new Set(prev).add(puzzleId));
    const res = await fetch("/api/cluereview/dismiss", {
      method: "POST",
      headers: authHeaders(pwRef.current),
      body: JSON.stringify({ puzzleId }),
    });
    if (!res.ok) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(puzzleId);
        return next;
      });
    }
  };

  const handleCrypticDismiss = async (key: string) => {
    setCrypticHandled((prev) => new Set(prev).add(key));
    const res = await fetch("/api/cluereview/cryptic-dismiss", {
      method: "POST",
      headers: authHeaders(pwRef.current),
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      setCrypticHandled((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleCrypticDelete = async (entry: CrypticFlaggedEntry) => {
    setCrypticHandled((prev) => new Set(prev).add(entry.key));
    const res = await fetch("/api/cluereview/cryptic-delete", {
      method: "POST",
      headers: authHeaders(pwRef.current),
      body: JSON.stringify({ key: entry.key }),
    });
    if (!res.ok) {
      setCrypticHandled((prev) => {
        const next = new Set(prev);
        next.delete(entry.key);
        return next;
      });
      return;
    }
    setCrypticDeletedLog((prev) =>
      prev.some((e) => e.key === entry.key)
        ? prev
        : [
            ...prev,
            {
              key: entry.key,
              clue: entry.clue,
              pattern: entry.pattern,
              wordplay: entry.wordplay,
              deletedAt: Date.now(),
            },
          ]
    );
  };

  const visible = flagged.filter((r) => !dismissedIds.has(r.puzzleId));

  return (
    <PageContainer
      title="Clue Review"
      description={
        loading
          ? "Loading…"
          : `${visible.length} flagged puzzle${visible.length !== 1 ? "s" : ""} pending review.`
      }
    >
      <GeneratorSection
        password={password}
        onClueDeleted={(entry) =>
          setDeletedLog((prev) =>
            prev.some((e) => e.word === entry.word && e.clue === entry.clue)
              ? prev
              : [...prev, entry]
          )
        }
      />

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="border border-border rounded p-8 text-center text-muted text-sm">
          No flagged puzzles — queue is clear.
        </div>
      ) : (
        <div className="space-y-6">
          {visible.map((record) => (
            <FlaggedCard
              key={record.puzzleId}
              record={record}
              deletedKeys={deletedKeys}
              onDelete={handleDelete}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {/* ── Deleted clues log ── */}
      <section className="mt-14">
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-semibold">Deleted Clues Log</h2>
          <span className="font-mono text-xs text-muted">
            {deletedLog.length} entr{deletedLog.length !== 1 ? "ies" : "y"}
          </span>
        </div>

        <div className="border border-amber-500/30 bg-amber-500/5 rounded p-4 text-sm text-amber-200/80 mb-5 leading-relaxed">
          Stored in{" "}
          <code className="font-mono text-amber-300/90">
            data/crossword-deleted-clues.json
          </code>{" "}
          (gitignored — survives git pulls). If{" "}
          <code className="font-mono text-amber-300/90">
            crossword-clues.json
          </code>{" "}
          is restored by a pull, use this log to re-apply deletions before the
          next{" "}
          <code className="font-mono text-amber-300/90">
            npm run build:crossword-pool
          </code>
          .
        </div>

        {deletedLog.length === 0 ? (
          <p className="text-muted text-sm">No clues deleted yet.</p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left px-4 py-2.5 text-muted font-medium text-xs">
                    Word
                  </th>
                  <th className="text-left px-4 py-2.5 text-muted font-medium text-xs">
                    Clue
                  </th>
                  <th className="text-left px-4 py-2.5 text-muted font-medium text-xs">
                    Deleted
                  </th>
                </tr>
              </thead>
              <tbody>
                {deletedLog.map((entry, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono text-accent">
                      {entry.word}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{entry.clue}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">
                      {new Date(entry.deletedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Cryptic — flagged clues ── */}
      <section className="mt-14">
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-semibold">Cryptic — Flagged Clues</h2>
          <span className="font-mono text-xs text-muted">
            {crypticFlagged.filter((f) => !crypticHandled.has(f.key)).length}{" "}
            pending
          </span>
          <span className="font-mono text-xs text-muted">
            · {crypticGood.length} in good pool
          </span>
        </div>
        <CrypticFlaggedTable
          entries={crypticFlagged}
          handled={crypticHandled}
          onDismiss={handleCrypticDismiss}
          onDelete={handleCrypticDelete}
        />
      </section>

      {/* ── Cryptic — deleted log ── */}
      <section className="mt-10">
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-semibold">Cryptic — Deleted Clues</h2>
          <span className="font-mono text-xs text-muted">
            {crypticDeletedLog.length} entr
            {crypticDeletedLog.length !== 1 ? "ies" : "y"}
          </span>
        </div>
        <div className="border border-amber-500/30 bg-amber-500/5 rounded p-4 text-sm text-amber-200/80 mb-5 leading-relaxed">
          Stored in{" "}
          <code className="font-mono text-amber-300/90">
            data/cryptic-deleted-clues.json
          </code>
          . Source dataset edits are written to{" "}
          <code className="font-mono text-amber-300/90">
            src/games/cryptic/data/cryptic-clues.json
          </code>{" "}
          (both gitignored — survives git pulls).
        </div>
        {crypticDeletedLog.length === 0 ? (
          <p className="text-muted text-sm">No clues deleted yet.</p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left px-4 py-2.5 text-muted font-medium text-xs">
                    Answer
                  </th>
                  <th className="text-left px-4 py-2.5 text-muted font-medium text-xs">
                    Clue
                  </th>
                  <th className="text-left px-4 py-2.5 text-muted font-medium text-xs">
                    Deleted
                  </th>
                </tr>
              </thead>
              <tbody>
                {crypticDeletedLog.map((entry, i) => (
                  <tr
                    key={`${entry.key}-${i}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono text-accent">
                      {entry.key}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {entry.clue ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">
                      {new Date(entry.deletedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageContainer>
  );
}

function CrypticFlaggedTable({
  entries,
  handled,
  onDismiss,
  onDelete,
}: {
  entries: CrypticFlaggedEntry[];
  handled: Set<string>;
  onDismiss: (key: string) => void;
  onDelete: (entry: CrypticFlaggedEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="border border-border rounded p-8 text-center text-muted text-sm">
        No flagged cryptic clues — queue is clear.
      </div>
    );
  }
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className="text-left px-4 py-2.5 text-muted font-medium text-xs w-32">
              Answer
            </th>
            <th className="text-left px-4 py-2.5 text-muted font-medium text-xs w-16">
              ({"#"})
            </th>
            <th className="text-left px-4 py-2.5 text-muted font-medium text-xs">
              Clue
            </th>
            <th className="text-left px-4 py-2.5 text-muted font-medium text-xs">
              Wordplay
            </th>
            <th className="text-left px-4 py-2.5 text-muted font-medium text-xs w-12">
              Flags
            </th>
            <th className="px-4 py-2.5 text-xs w-44" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const done = handled.has(entry.key);
            return (
              <tr
                key={entry.key}
                className={`border-b border-border last:border-0 align-top transition-opacity ${
                  done ? "opacity-40" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-mono text-accent">{entry.key}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">
                  {entry.pattern}
                </td>
                <td className="px-4 py-2.5">{entry.clue}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">
                  {entry.wordplay || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-red-400">
                  ×{entry.count}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {done ? (
                    <span className="text-xs text-muted italic">handled</span>
                  ) : (
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDismiss(entry.key)}
                        className="text-xs text-muted hover:text-foreground border border-border rounded px-2 py-0.5 hover:border-accent/40 transition-colors"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(entry)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/60 rounded px-2 py-0.5 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function ClueReviewContent() {
  const [password, setPassword] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setPassword(saved);
  }, []);

  const handleAuth = (pw: string) => {
    sessionStorage.setItem(SESSION_KEY, pw);
    setPassword(pw);
  };

  if (!password) return <PasswordGate onAuth={handleAuth} />;
  return <ReviewView password={password} />;
}
