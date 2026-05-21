"use client";

/**
 * Freeform Crossword game for the /games section. Unlike `DailyCrossword`
 * this version lets the player pick the grid dimensions (rows × cols,
 * each 3-7), generates a fresh random puzzle on demand using the same
 * procedural mask + clue-bank pipeline as the daily, and provides the
 * standard play loop (timer, pause, check, new game).
 *
 * Layout: two-column on `lg+` with the clue lists on the left and the
 * board on the right; stacked (board first) on smaller viewports.
 *
 * Reuses `CrosswordBoard`, `ClueBanner`, and `ClueList` from the daily
 * — the only thing different here is the surrounding controls and the
 * freeform puzzle source.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClueBanner } from "@/games/crossword/ClueBanner";
import { ClueList } from "@/games/crossword/ClueList";
import { CrosswordBoard, type Selection } from "@/games/crossword/CrosswordBoard";
import {
  emptyGridFor,
  gridHasProgress,
  isCorrect,
  isFilled,
} from "@/games/crossword/gridUtils";
import { logCompletion } from "@/games/crossword/history";
import {
  clearFreeformSession,
  loadFreeformSession,
  saveFreeformSession,
} from "@/games/crossword/session";
import { computePuzzleId } from "@/games/crossword/storedPuzzle";
import {
  FREEFORM_MAX_DIM,
  FREEFORM_MIN_DIM,
  type Direction,
  type Entry,
  type Puzzle,
} from "@/games/crossword/types";
import { formatTime } from "@/lib/gameUtils";
import { useBoardSize } from "@/lib/useBoardSize";
import { ConfirmDialog } from "@/components/games/ConfirmDialog";
import { CrosswordVoteButtons } from "@/components/daily/CrosswordVoteButtons";

/**
 * The generator + 2.4 MB clue bank are heavy — the daily route never needs
 * them (it fetches from `/api/crossword/daily`), so they're behind a
 * dynamic import here. The promise is cached at module scope, so the first
 * call pays the chunk-fetch cost (~50–100 ms, hidden behind the
 * "Generating…" spinner the UI already shows) and subsequent calls resolve
 * synchronously to the same module ref.
 */
type GeneratorMod = typeof import("@/games/crossword/generator");
let generatorPromise: Promise<GeneratorMod> | null = null;
function loadGenerator(): Promise<GeneratorMod> {
  if (!generatorPromise) {
    generatorPromise = import("@/games/crossword/generator");
  }
  return generatorPromise;
}

function initialSelection(puzzle: Puzzle): Selection {
  const first = puzzle.entries.across[0] ?? puzzle.entries.down[0] ?? null;
  if (!first) return { row: 0, col: 0, direction: "across" };
  return {
    row: first.cells[0].row,
    col: first.cells[0].col,
    direction: first.direction,
  };
}

interface GameState {
  puzzle: Puzzle;
  grid: string[][];
  selection: Selection;
  seed: number;
}

/** Try the requested dims; if the bank can't fill them, retry with a few
 *  seeds before giving up so the user isn't sent to the error path for
 *  a transient solver miss. Async because the generator is lazy-loaded;
 *  every caller already shows the "Generating…" spinner across the
 *  setTimeout(0) hop, so the dynamic-import latency is hidden there. */
async function buildGame(
  rows: number,
  cols: number
): Promise<GameState | null> {
  const { generateCrosswordForDims } = await loadGenerator();
  for (let attempt = 0; attempt < 6; attempt++) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const puzzle = generateCrosswordForDims(rows, cols, seed);
    if (!puzzle) continue;
    return {
      puzzle,
      grid: emptyGridFor(puzzle),
      selection: initialSelection(puzzle),
      seed,
    };
  }
  return null;
}

/** Rebuild a saved puzzle from its seed and restore the player's grid. */
async function buildGameFromSeed(
  rows: number,
  cols: number,
  seed: number,
  savedGrid: string[][]
): Promise<GameState | null> {
  const { generateCrosswordForDims } = await loadGenerator();
  const puzzle = generateCrosswordForDims(rows, cols, seed);
  if (!puzzle) return null;
  return {
    puzzle,
    grid: savedGrid,
    selection: initialSelection(puzzle),
    seed,
  };
}

const DIM_OPTIONS = Array.from(
  { length: FREEFORM_MAX_DIM - FREEFORM_MIN_DIM + 1 },
  (_, i) => FREEFORM_MIN_DIM + i
);

export function CrosswordGame() {
  // `null` = generator hasn't loaded yet, `true` = loaded but the bank is
  // empty (dev hasn't run `scripts/generate-clue-bank.mjs`), `false` =
  // ready to generate. Used to gate the saved-session restore + the
  // "coming soon" empty-bank UI without making the bank reachable at
  // module load.
  const [bankEmpty, setBankEmpty] = useState<boolean | null>(null);

  const [rows, setRows] = useState<number>(() => loadFreeformSession()?.rows ?? 5);
  const [cols, setCols] = useState<number>(() => loadFreeformSession()?.cols ?? 5);
  const [game, setGame] = useState<GameState | null>(null);
  const [errors, setErrors] = useState<Set<string>>(() => new Set());
  // Cells flagged as right by the most recent Check pass — rendered green
  // alongside the red wrong-cells. Cleared per-cell on user input.
  const [corrects, setCorrects] = useState<Set<string>>(() => new Set());
  // Cells whose letter the player asked for via Reveal — drawn blue,
  // persisted across Check passes, cleared per-cell on a manual overwrite.
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [errorCount, setErrorCount] = useState<number>(0);
  const [timer, setTimer] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(true);
  const [won, setWon] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [generationFailed, setGenerationFailed] = useState<boolean>(false);
  // Pending dims for a deferred "New puzzle". Set when the player confirms
  // the dialog; cleared as soon as generation kicks off.
  const [pendingNewGame, setPendingNewGame] = useState<{
    rows: number;
    cols: number;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);

  const startNewPuzzle = useCallback(
    (nextRows: number, nextCols: number) => {
      setGenerating(true);
      setGenerationFailed(false);
      // Defer to next tick so the "generating" spinner can paint before
      // the (potentially expensive) fill solver hogs the main thread. The
      // dynamic-import for the generator chunk also resolves inside this
      // hop on the first call — both costs are masked by the same spinner.
      setTimeout(() => {
        void (async () => {
          const next = await buildGame(nextRows, nextCols);
          if (!next) {
            setGenerationFailed(true);
            setGenerating(false);
            return;
          }
          clearFreeformSession();
          setGame(next);
          setErrors(new Set());
          setCorrects(new Set());
          setRevealed(new Set());
          setErrorCount(0);
          setTimer(0);
          setWon(false);
          setPaused(true);
          setGenerating(false);
        })();
      }, 0);
    },
    []
  );

  /** Requested "New puzzle" — gated by a confirmation dialog if the
   *  player has filled any cells (and hasn't already solved or paused
   *  through to a fresh state). */
  const requestNewPuzzle = useCallback(() => {
    if (game && !won && gridHasProgress(game.grid)) {
      setPendingNewGame({ rows, cols });
      return;
    }
    startNewPuzzle(rows, cols);
  }, [game, won, rows, cols, startNewPuzzle]);

  // First-mount initialization — try to restore a saved session if one
  // exists, otherwise leave the board empty until the player explicitly
  // hits "New puzzle". Auto-generating on page load made `/games/crossword`
  // wait several seconds on the procedural fill before anything could
  // render; gating on a click keeps the page snappy and matches the
  // existing UI prompt ("Pick a size to start").
  //
  // First mount also drives the generator dynamic import: whether or not
  // there's a saved session, we resolve the chunk here so `bankEmpty`
  // flips to a real boolean and the "coming soon" placeholder can fire if
  // the dev hasn't generated the clue bank yet.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const saved = loadFreeformSession();
    if (saved) {
      setGenerating(true);
      // Defer the regeneration so the "Generating…" placeholder paints
      // before the (potentially expensive) fill solver hogs the main thread.
      setTimeout(() => {
        void (async () => {
          const mod = await loadGenerator();
          const empty = mod.clueBankSize() === 0;
          setBankEmpty(empty);
          if (empty) {
            // Stale session predates the (now-missing) clue bank — drop it
            // and stay on the "coming soon" empty-state path.
            clearFreeformSession();
            setGenerating(false);
            return;
          }
          const next = await buildGameFromSeed(
            saved.rows,
            saved.cols,
            saved.seed,
            saved.grid
          );
          if (next) {
            setGame(next);
            setTimer(saved.timer);
            setErrorCount(saved.errorCount);
            setRevealed(saved.revealed);
          } else {
            // Seed couldn't be regenerated (clue bank changed, etc.). Drop
            // the stale session and stay on the empty state — the player
            // can pick dims and click New puzzle to roll a fresh one.
            clearFreeformSession();
          }
          setGenerating(false);
        })();
      }, 0);
    } else {
      // No saved session — still preload the generator so `bankEmpty`
      // resolves before the user clicks "New puzzle". Cheap and hidden.
      void loadGenerator().then((mod) => {
        setBankEmpty(mod.clueBankSize() === 0);
      });
    }
  }, []);

  // Timer
  useEffect(() => {
    if (!paused && !won && game) {
      intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, won, game]);

  // Persist on every meaningful change so a refresh restores exactly.
  useEffect(() => {
    if (!game || won) return;
    saveFreeformSession(
      game.puzzle.rows,
      game.puzzle.cols,
      game.seed,
      game.grid,
      timer,
      errorCount,
      revealed
    );
  }, [game, timer, errorCount, revealed, won]);

  // Adapt board cell size to the right column's width / viewport height.
  // The clue sidebar takes ~240px on `lg+`, so the board column gets the
  // remainder; the hook handles the recompute via ResizeObserver.
  const { ref: boardRef, cell: cellPx } = useBoardSize({
    count: Math.max(game?.puzzle.rows ?? 5, game?.puzzle.cols ?? 5),
    cols: game?.puzzle.cols ?? 5,
    rows: game?.puzzle.rows ?? 5,
    reserveBelow: 220,
    min: 36,
    max: 72,
    deps: [won, paused, game?.puzzle.shape],
  });

  const completedRef = useRef(false);
  // Reset the once-only completion guard when a new puzzle starts.
  useEffect(() => {
    completedRef.current = false;
  }, [game?.puzzle]);

  const handleCellInput = useCallback(
    (r: number, c: number, letter: string) => {
      if (!game || won || paused) return;
      const cur = game.grid[r][c];
      if (cur === "#") return;
      const newCh = letter || ".";
      if (cur === newCh) return;

      const next = game.grid.map((row) => [...row]);
      next[r][c] = newCh;
      setGame((g) => (g ? { ...g, grid: next } : g));

      // Stale check / reveal feedback on this cell goes away as soon as
      // the player overwrites it — the displayed letter no longer matches
      // whatever Check or Reveal saw.
      const key = `${r},${c}`;
      setErrors((curErrs) => {
        if (!curErrs.has(key)) return curErrs;
        const out = new Set(curErrs);
        out.delete(key);
        return out;
      });
      setCorrects((curOk) => {
        if (!curOk.has(key)) return curOk;
        const out = new Set(curOk);
        out.delete(key);
        return out;
      });
      setRevealed((curRev) => {
        if (!curRev.has(key)) return curRev;
        const out = new Set(curRev);
        out.delete(key);
        return out;
      });

      if (
        !completedRef.current &&
        isFilled(next) &&
        isCorrect(next, game.puzzle.solution)
      ) {
        completedRef.current = true;
        clearFreeformSession();
        setWon(true);
      }
    },
    [game, won, paused]
  );

  const handleSelectionChange = useCallback((next: Selection) => {
    setGame((g) => (g ? { ...g, selection: next } : g));
  }, []);

  const handleCheck = useCallback(() => {
    if (!game || won) return;
    const wrong = new Set<string>();
    const right = new Set<string>();
    for (let r = 0; r < game.puzzle.rows; r++) {
      for (let c = 0; c < game.puzzle.cols; c++) {
        if (game.puzzle.solution[r][c] === "#") continue;
        if (game.grid[r][c] === ".") continue;
        const key = `${r},${c}`;
        if (game.grid[r][c] !== game.puzzle.solution[r][c]) wrong.add(key);
        else right.add(key);
      }
    }
    setErrors(wrong);
    setCorrects(right);
    if (wrong.size > 0) setErrorCount((n) => n + 1);
  }, [game, won]);

  /**
   * Fill a set of cells with their solution letters and flag them as
   * revealed (blue). Shared by Reveal Cell and Reveal Word — `cells`
   * is the list to reveal. Errors/corrects flags on those cells are
   * cleared since the next Check would just re-tag them.
   */
  const revealCells = useCallback(
    (cells: Array<{ row: number; col: number }>) => {
      if (!game || won || cells.length === 0) return;
      const next = game.grid.map((row) => [...row]);
      const keys: string[] = [];
      for (const { row, col } of cells) {
        const sol = game.puzzle.solution[row]?.[col];
        if (!sol || sol === "#") continue;
        next[row][col] = sol;
        keys.push(`${row},${col}`);
      }
      if (keys.length === 0) return;

      setGame((g) => (g ? { ...g, grid: next } : g));
      setRevealed((cur) => {
        const out = new Set(cur);
        for (const k of keys) out.add(k);
        return out;
      });
      setErrors((cur) => {
        let changed = false;
        const out = new Set(cur);
        for (const k of keys) if (out.delete(k)) changed = true;
        return changed ? out : cur;
      });
      setCorrects((cur) => {
        let changed = false;
        const out = new Set(cur);
        for (const k of keys) if (out.delete(k)) changed = true;
        return changed ? out : cur;
      });

      // A full reveal can complete the grid — keep the win path consistent
      // with handleCellInput so onComplete-equivalent state fires once.
      if (
        !completedRef.current &&
        isFilled(next) &&
        isCorrect(next, game.puzzle.solution)
      ) {
        completedRef.current = true;
        clearFreeformSession();
        setWon(true);
      }
    },
    [game, won]
  );

  const revealSelectedCell = useCallback(() => {
    if (!game) return;
    const { row, col } = game.selection;
    revealCells([{ row, col }]);
  }, [game, revealCells]);

  /* `activeEntry` is computed further down — `revealSelectedWord`
   *  closes over it via a getter so it stays in sync without a TDZ
   *  reference, see usage below. */
  const activeEntryRef = useRef<Entry | null>(null);
  const revealSelectedWord = useCallback(() => {
    const entry = activeEntryRef.current;
    if (!entry) return;
    revealCells(entry.cells.map(({ row, col }) => ({ row, col })));
  }, [revealCells]);

  // Active entry derivation for the banner + clue list. The ref mirror
  // (kept fresh by the effect below) lets reveal-word fire the latest
  // value without needing to dep on the memoized object.
  const activeEntry = useMemo<Entry | null>(() => {
    if (!game) return null;
    const { selection, puzzle } = game;
    const list =
      selection.direction === "across"
        ? puzzle.entries.across
        : puzzle.entries.down;
    return (
      list.find((entry) =>
        entry.cells.some(
          (cell) => cell.row === selection.row && cell.col === selection.col
        )
      ) ??
      (
        selection.direction === "across"
          ? puzzle.entries.down
          : puzzle.entries.across
      ).find((entry) =>
        entry.cells.some(
          (cell) => cell.row === selection.row && cell.col === selection.col
        )
      ) ??
      null
    );
  }, [game]);

  // Keep the active-entry ref in sync so reveal-word and any other
  // imperative paths can read the latest entry without depending on the
  // memoized object identity in their useCallback deps.
  useEffect(() => {
    activeEntryRef.current = activeEntry;
  }, [activeEntry]);

  // Stable id for the currently-loaded freeform puzzle. Computed only
  // after a win (the vote control is hidden until then), so we avoid
  // hashing the grid on every keystroke. `null` when there's no game.
  const solvedPuzzleId = useMemo<string | null>(() => {
    if (!game || !won) return null;
    return computePuzzleId(
      game.puzzle.rows,
      game.puzzle.cols,
      game.puzzle.solution,
      game.puzzle.black
    );
  }, [game, won]);

  // Log to the per-game history once per win, matching the convention
  // every other game's `history.ts` uses. `solvedPuzzleId` already gates
  // on `won && game`, and resets to null when the next "New puzzle"
  // clears the win state — so this effect fires exactly once per solved
  // puzzle, no extra guard needed.
  const loggedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!solvedPuzzleId || !game) return;
    if (loggedIdRef.current === solvedPuzzleId) return;
    loggedIdRef.current = solvedPuzzleId;
    logCompletion({
      id: solvedPuzzleId,
      rows: game.puzzle.rows,
      cols: game.puzzle.cols,
      shape: game.puzzle.shape,
      time: timer,
      date: new Date().toISOString(),
    });
  }, [solvedPuzzleId, game, timer]);

  const flipDirection = useCallback(() => {
    setGame((g) =>
      g
        ? {
            ...g,
            selection: {
              ...g.selection,
              direction: (g.selection.direction === "across"
                ? "down"
                : "across") as Direction,
            },
          }
        : g
    );
  }, []);

  const jumpToEntry = useCallback((entry: Entry) => {
    // Land on the first empty cell of the entry, falling back to its head
    // when every cell is already filled.
    setGame((g) => {
      if (!g) return g;
      let target = entry.cells[0];
      for (const cell of entry.cells) {
        if (g.grid[cell.row][cell.col] === ".") {
          target = cell;
          break;
        }
      }
      return {
        ...g,
        selection: {
          row: target.row,
          col: target.col,
          direction: entry.direction,
        },
      };
    });
  }, []);

  /* --------------------------- Render branches --------------------------- */

  if (bankEmpty === true) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Crossword — coming soon
        </p>
        <p className="max-w-sm text-xs text-muted">
          The clue bank hasn&apos;t been generated yet. Run{" "}
          <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">
            node scripts/generate-clue-bank.mjs
          </code>{" "}
          to populate it.
        </p>
      </div>
    );
  }

  const boardW = game ? game.puzzle.cols * cellPx : 0;
  const boardH = game ? game.puzzle.rows * cellPx : 0;
  const disabled = paused || won || !game;

  const selectClass =
    "rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-foreground transition-colors hover:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-6">
      {/* Top control row — dimensions, status, pause */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-mono uppercase tracking-wider text-muted">
            Size
          </span>
          <select
            aria-label="Rows"
            value={rows}
            disabled={generating}
            onChange={(e) => setRows(parseInt(e.target.value, 10))}
            className={selectClass}
          >
            {DIM_OPTIONS.map((n) => (
              <option key={`r-${n}`} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-muted">×</span>
          <select
            aria-label="Columns"
            value={cols}
            disabled={generating}
            onChange={(e) => setCols(parseInt(e.target.value, 10))}
            className={selectClass}
          >
            {DIM_OPTIONS.map((n) => (
              <option key={`c-${n}`} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={requestNewPuzzle}
          disabled={generating}
          className="rounded-md bg-accent px-3 py-1 font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {generating ? "Generating…" : "New puzzle"}
        </button>
        <div className="ml-auto flex items-center gap-3">
          {errorCount > 0 && (
            <span className="text-red-400">
              {errorCount} check{errorCount === 1 ? "" : "s"}
            </span>
          )}
          {won && <span className="font-medium text-accent">Solved!</span>}
          <span className="font-mono text-sm text-muted">
            {formatTime(timer)}
          </span>
          {!won && game && (
            <button
              onClick={() => setPaused((p) => !p)}
              className="rounded border border-border bg-card px-2 py-0.5 font-mono text-muted transition-colors hover:text-foreground"
            >
              {paused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </div>

      {/* Generation failure card */}
      {generationFailed && (
        <div className="rounded-md border border-red-400/40 bg-red-500/10 px-4 py-3 text-center text-xs text-red-300">
          Couldn&apos;t generate a puzzle for {rows}×{cols}. Try different
          dimensions or hit &ldquo;New puzzle&rdquo; again.
        </div>
      )}

      {/* Main split: clues left (lg+), board right. Stacked on mobile,
          board on top so the screen still leads with the playable area.
          The board itself never blurs (so winners can see the finished
          grid clearly); pause hides the clues + banner instead. */}
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Clue sidebar — blurred when paused (not when won) */}
        <aside
          className={`order-2 lg:order-1 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1 transition-[filter] duration-200 ${
            paused && !won ? "blur-md pointer-events-none" : ""
          }`}
        >
          {game ? (
            <ClueList
              puzzle={game.puzzle}
              grid={game.grid}
              activeNumber={activeEntry?.number ?? null}
              activeDirection={activeEntry?.direction ?? null}
              onJump={jumpToEntry}
              stacked
            />
          ) : (
            <p className="text-xs text-muted">
              {generating ? "Generating puzzle…" : "Pick a size to start."}
            </p>
          )}
        </aside>

        {/* Board column */}
        <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
          {/* The active-clue banner is part of the "clues" group and so
              follows the same pause-blur rule. */}
          {game && (
            <div
              className={`transition-[filter] duration-200 ${
                paused && !won ? "blur-md pointer-events-none" : ""
              }`}
              style={{ width: boardW }}
            >
              <ClueBanner
                entry={activeEntry}
                disabled={disabled}
                width={boardW}
                onFlipDirection={flipDirection}
              />
            </div>
          )}
          <div ref={boardRef} className="relative flex w-full justify-center">
            {game ? (
              <div
                className="relative"
                style={{ width: boardW, height: boardH }}
              >
                <CrosswordBoard
                  puzzle={game.puzzle}
                  grid={game.grid}
                  selection={game.selection}
                  errors={errors}
                  corrects={corrects}
                  revealed={revealed}
                  cellPx={cellPx}
                  disabled={disabled}
                  onSelectionChange={handleSelectionChange}
                  onCellInput={handleCellInput}
                />
                {paused && !won && (
                  // Transparent full-board button — the grid stays fully
                  // visible behind it; clicking anywhere unpauses, and
                  // a centered pill marks the action for first-timers.
                  <button
                    type="button"
                    onClick={() => setPaused(false)}
                    className="absolute inset-0 flex items-center justify-center bg-transparent"
                    aria-label={timer === 0 ? "Start puzzle" : "Resume"}
                  >
                    <span className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-background shadow-lg">
                      {timer === 0 ? "Start" : "Resume"}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 text-sm text-muted">
                {generating ? "Generating puzzle…" : "Pick a size to start"}
              </div>
            )}
          </div>

          {/* Bottom actions — Reveal splits into cell vs word; a full
              "reveal everything" button is intentionally gone since it
              just trivializes the puzzle. */}
          {game && !won && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <button
                onClick={handleCheck}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-foreground transition-colors hover:bg-card-hover hover:border-accent/40"
              >
                Check
              </button>
              <button
                onClick={revealSelectedCell}
                disabled={paused}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-50"
                title="Reveal the currently selected cell"
              >
                Reveal cell
              </button>
              <button
                onClick={revealSelectedWord}
                disabled={paused || !activeEntry}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-50"
                title="Reveal the active across/down word"
              >
                Reveal word
              </button>
            </div>
          )}

          {/* Post-solve curation: same up/down vote pair the daily
              completion card uses. The freeform puzzle isn't in any
              pool, so we pass the full puzzle JSON inline; the
              endpoints verify the computed id matches before
              accepting. */}
          {game && won && solvedPuzzleId && (
            <CrosswordVoteButtons
              puzzleId={solvedPuzzleId}
              puzzle={game.puzzle}
            />
          )}
        </div>
      </div>

      {/* "New puzzle" confirmation (only when there's unsaved progress) */}
      {pendingNewGame !== null && (
        <ConfirmDialog
          title="Start a new puzzle?"
          message="Your current progress will be lost."
          confirmLabel="New puzzle"
          onConfirm={() => {
            const target = pendingNewGame;
            setPendingNewGame(null);
            startNewPuzzle(target.rows, target.cols);
          }}
          onCancel={() => setPendingNewGame(null)}
        />
      )}
    </div>
  );
}
