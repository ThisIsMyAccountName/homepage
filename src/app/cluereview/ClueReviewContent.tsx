"use client";

import { useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

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
    </PageContainer>
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
