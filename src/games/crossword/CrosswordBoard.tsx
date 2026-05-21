"use client";

/**
 * Interactive crossword board. Renders a `rows × cols` grid of cells where
 * black squares are fixed, white cells hold a single uppercase A–Z letter,
 * and each white cell is a tiny `<input>` so mobile keyboards pop up
 * naturally when a cell is tapped.
 *
 * The board owns the *interaction* (focus management, key handling, advance-
 * after-type) but reports everything back up via callbacks — selection and
 * grid state live in the parent so the clue banner / clue list / completion
 * detection can react to the same source of truth.
 */

import { useEffect, useMemo, useRef } from "react";
import type { Direction, Entry, Puzzle } from "./types";

export interface Selection {
  row: number;
  col: number;
  direction: Direction;
}

interface CrosswordBoardProps {
  puzzle: Puzzle;
  /** Current letters: `"."` for empty white, `"#"` for black, A–Z otherwise. */
  grid: string[][];
  selection: Selection;
  /** Cells flagged as wrong by a Check pass — keys like `"r,c"`. */
  errors: Set<string>;
  /**
   * Cells flagged as right by a Check pass — keys like `"r,c"`. Drawn in
   * green so the player can see at a glance which letters they nailed.
   */
  corrects?: Set<string>;
  /**
   * Cells whose letter was filled in by Reveal Cell / Reveal Word. Drawn
   * in blue so the player can see which letters they gave up on, even
   * after a later Check or Reveal pass.
   */
  revealed?: Set<string>;
  /** Pixel size of one cell (square). */
  cellPx: number;
  /**
   * When true, typing / arrow nav are no-ops (input is `readOnly`). The
   * board itself stays fully visible — pause/win blurring is done by the
   * parent on the surrounding clue UI, never on the board.
   */
  disabled: boolean;
  onSelectionChange: (next: Selection) => void;
  /** Called when the user types or clears a letter at (r, c). */
  onCellInput: (r: number, c: number, letter: string) => void;
}

const cellKey = (r: number, c: number) => `${r},${c}`;

/** Look up the across/down entry passing through (r, c), if any. */
function buildCellEntryMap(puzzle: Puzzle): Map<string, { across?: Entry; down?: Entry }> {
  const map = new Map<string, { across?: Entry; down?: Entry }>();
  for (const entry of puzzle.entries.across) {
    for (const { row, col } of entry.cells) {
      const key = cellKey(row, col);
      const cur = map.get(key) ?? {};
      cur.across = entry;
      map.set(key, cur);
    }
  }
  for (const entry of puzzle.entries.down) {
    for (const { row, col } of entry.cells) {
      const key = cellKey(row, col);
      const cur = map.get(key) ?? {};
      cur.down = entry;
      map.set(key, cur);
    }
  }
  return map;
}

/**
 * Active entry passing through `selection` in the current direction. If the
 * cell has no entry in that direction (rare — corner cell of a 1-direction
 * entry), falls back to the other direction.
 */
function activeEntryFor(
  cellMap: Map<string, { across?: Entry; down?: Entry }>,
  sel: Selection
): Entry | null {
  const cur = cellMap.get(cellKey(sel.row, sel.col));
  if (!cur) return null;
  return (
    (sel.direction === "across" ? cur.across : cur.down) ??
    cur.across ??
    cur.down ??
    null
  );
}

export function CrosswordBoard({
  puzzle,
  grid,
  selection,
  errors,
  corrects,
  revealed,
  cellPx,
  disabled,
  onSelectionChange,
  onCellInput,
}: CrosswordBoardProps) {
  const cellMap = useMemo(() => buildCellEntryMap(puzzle), [puzzle]);
  const activeEntry = activeEntryFor(cellMap, selection);

  // Refs to every white-cell input so we can imperatively move focus when
  // selection changes (typing → advance, arrows, clue jumps, etc.).
  const inputs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const setInputRef = (r: number, c: number, el: HTMLInputElement | null) => {
    if (el) inputs.current.set(cellKey(r, c), el);
    else inputs.current.delete(cellKey(r, c));
  };

  // Whenever the parent's selection changes, sync focus to that cell so
  // the mobile keyboard tracks the active cell.
  useEffect(() => {
    if (disabled) return;
    const el = inputs.current.get(cellKey(selection.row, selection.col));
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
      // Caret at end so a single keystroke replaces the letter.
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch {
        // some inputs don't support setSelectionRange — ignore
      }
    }
  }, [selection, disabled]);

  // Live ref to the latest `navigateClue` so the document-level keydown
  // listener below can call it without re-registering each render.
  const navigateClueRef = useRef<(axis: Direction, forward: boolean) => void>(
    () => {}
  );

  // Document-level arrow-key catcher. While the board is interactive,
  // arrow keys navigate clues regardless of which element has focus, so
  // the player doesn't lose nav if a tap moved focus off the board (onto
  // a button, the page background, etc.). When focus is already on a
  // board cell the per-input `onKeyDown` runs first and we bail here to
  // avoid double-navigating; other inputs/selects on the page (e.g. the
  // Size selects in `CrosswordGame`) are left alone so the user can still
  // change them with arrow keys.
  useEffect(() => {
    if (disabled) return;
    function onKey(e: KeyboardEvent) {
      if (
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown" &&
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight"
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT") {
          // Focus on one of *our* cell inputs — let the per-input
          // handler take it.
          for (const el of inputs.current.values()) {
            if (el === target) return;
          }
          // Some other input on the page — don't steal it.
          return;
        }
        if (
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        navigateClueRef.current("across", e.key === "ArrowDown");
      } else {
        navigateClueRef.current("down", e.key === "ArrowRight");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [disabled]);


  /** Find the next white cell in `direction` starting at (r,c), wrapping within the active entry. */
  function step(
    r: number,
    c: number,
    direction: Direction,
    forward: boolean
  ): { row: number; col: number } | null {
    const cur = cellMap.get(cellKey(r, c));
    const entry = direction === "across" ? cur?.across : cur?.down;
    if (!entry) return null;
    const idx = entry.cells.findIndex((cell) => cell.row === r && cell.col === c);
    const nextIdx = idx + (forward ? 1 : -1);
    if (nextIdx < 0 || nextIdx >= entry.cells.length) return null;
    return entry.cells[nextIdx];
  }

  /**
   * First empty cell of `entry`, or the entry's head if every cell is
   * already filled. Used when *jumping into* an entry (Tab, arrow-key
   * clue navigation, click on a clue) so a partially-solved word puts the
   * caret on the next blank to fill rather than re-overwriting cell #1.
   */
  function firstEmptyOrHead(entry: Entry): { row: number; col: number } {
    for (const { row, col } of entry.cells) {
      if (grid[row][col] === ".") return { row, col };
    }
    return { row: entry.cells[0].row, col: entry.cells[0].col };
  }

  /** True iff every white cell of `entry` already has a letter (right or wrong). */
  function isEntryFilled(entry: Entry): boolean {
    return entry.cells.every(({ row, col }) => grid[row][col] !== ".");
  }

  /**
   * Walk `list` starting from `curIdx`, moving forward or backward, and
   * return the first entry that still has at least one empty cell. Returns
   * null if every entry in the axis is already filled.
   */
  function nextUnfilledInList(
    list: Entry[],
    curIdx: number,
    forward: boolean
  ): Entry | null {
    const n = list.length;
    for (let i = 1; i <= n; i++) {
      const idx = (((curIdx + (forward ? i : -i)) % n) + n) % n;
      const candidate = list[idx];
      if (!isEntryFilled(candidate)) return candidate;
    }
    return null;
  }

  /**
   * Move to the prev/next clue in `axis`, skipping any entry whose cells
   * are all already filled. When the player is currently in the other
   * direction and the cell lies on an entry in `axis`, the press becomes a
   * direction change *and* moves the caret to the first empty cell of that
   * entry (or the next unfilled entry, if the passing one is also done).
   */
  function navigateClue(axis: Direction, forward: boolean) {
    const list = puzzle.entries[axis];
    if (list.length === 0) return;
    const passingHere = list.find((e) =>
      e.cells.some(
        (cell) => cell.row === selection.row && cell.col === selection.col
      )
    );
    if (selection.direction !== axis && passingHere) {
      // Direction change: jump to the first empty cell of the passing entry,
      // or skip ahead to the next unfilled entry in this axis if it's done.
      const target = isEntryFilled(passingHere)
        ? nextUnfilledInList(list, list.indexOf(passingHere), forward)
        : passingHere;
      if (!target) {
        // Whole axis is complete — just flip direction in place.
        onSelectionChange({
          row: selection.row,
          col: selection.col,
          direction: axis,
        });
        return;
      }
      const cell = firstEmptyOrHead(target);
      onSelectionChange({ row: cell.row, col: cell.col, direction: axis });
      return;
    }
    const curIdx = passingHere ? list.indexOf(passingHere) : -1;
    const nextEntry = nextUnfilledInList(list, curIdx, forward);
    if (!nextEntry) return;
    const target = firstEmptyOrHead(nextEntry);
    onSelectionChange({ row: target.row, col: target.col, direction: axis });
  }

  // Refresh the global-listener target after every render so it always
  // sees the current `selection` / `grid` closures without forcing the
  // keydown listener to re-register.
  useEffect(() => {
    navigateClueRef.current = navigateClue;
  });

  function handleCellClick(r: number, c: number) {
    if (grid[r][c] === "#") return;
    if (selection.row === r && selection.col === c) {
      // Re-clicking the active cell flips direction when the cell supports
      // both. Navigation is driven exclusively by `onClick` (not `onFocus`)
      // so a single tap can't accidentally trigger this branch via the
      // focus/click event pair that fires together on a mouse/touch press.
      const cur = cellMap.get(cellKey(r, c));
      if (cur?.across && cur?.down) {
        onSelectionChange({
          row: r,
          col: c,
          direction: selection.direction === "across" ? "down" : "across",
        });
      }
      return;
    }
    // New cell — keep current direction if the cell supports it, else flip.
    const cur = cellMap.get(cellKey(r, c));
    const direction =
      (selection.direction === "across" && cur?.across) ||
      (selection.direction === "down" && cur?.down)
        ? selection.direction
        : cur?.across
          ? "across"
          : cur?.down
            ? "down"
            : selection.direction;
    onSelectionChange({ row: r, col: c, direction });
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number
  ) {
    if (disabled) return;
    const key = e.key;
    if (key === " ") {
      e.preventDefault();
      const cur = cellMap.get(cellKey(r, c));
      if (cur?.across && cur?.down) {
        onSelectionChange({
          row: r,
          col: c,
          direction: selection.direction === "across" ? "down" : "across",
        });
      }
      return;
    }
    if (key === "Backspace") {
      e.preventDefault();
      // Confirmed-correct cells are locked: backspace on one is a no-op.
      if (corrects?.has(cellKey(r, c))) return;
      if (grid[r][c] && grid[r][c] !== "." && grid[r][c] !== "#") {
        // Cell has a letter — clear it, stay in place.
        onCellInput(r, c, "");
      } else {
        // Cell empty — walk back to the previous non-locked cell and clear
        // that one. Locked cells are skipped over so backspace can still
        // reach editable letters earlier in the word.
        let prev = step(r, c, selection.direction, false);
        while (prev && corrects?.has(cellKey(prev.row, prev.col))) {
          prev = step(prev.row, prev.col, selection.direction, false);
        }
        if (prev) {
          onCellInput(prev.row, prev.col, "");
          onSelectionChange({ ...prev, direction: selection.direction });
        }
      }
      return;
    }
    if (key === "Delete") {
      e.preventDefault();
      if (corrects?.has(cellKey(r, c))) return;
      onCellInput(r, c, "");
      return;
    }
    // Arrow keys navigate *clues* (entries), not individual cells. The
    // mapping treats the arrow direction as scrolling the clue list, not
    // the grid:
    //   - Up/Down  → prev/next clue in the Across list
    //   - Left/Right → prev/next clue in the Down list
    // Already-filled entries are skipped; flipping axis lands on that
    // entry's first empty cell. Cell-level movement happens implicitly
    // via typing + Backspace; click a cell to land on it directly.
    if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      navigateClue("across", key === "ArrowDown");
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      e.preventDefault();
      navigateClue("down", key === "ArrowRight");
      return;
    }
    if (key === "Tab") {
      e.preventDefault();
      navigateClue(selection.direction, !e.shiftKey);
      return;
    }
    // Letter input is handled by onChange, not here.
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>,
    r: number,
    c: number
  ) {
    if (disabled) return;
    // Confirmed-correct cells are locked — ignore any input on them.
    if (corrects?.has(cellKey(r, c))) return;
    const raw = e.target.value;
    // Extract the last typed character; letters are uppercased and digits
    // pass through unchanged so the bank's number-bearing answers (e.g.
    // "1AM", "3DTV", "101") can be entered alongside plain words.
    const ch = raw.replace(/[^a-zA-Z0-9]/g, "").slice(-1).toUpperCase();
    if (!ch) {
      onCellInput(r, c, "");
      return;
    }
    onCellInput(r, c, ch);
    // Advance to the next *empty* cell in the active entry — both locked
    // (green) and plain user-typed letters are skipped, so the caret
    // always lands on the next square that still needs a letter. If
    // every later cell in the entry is filled, advance stops at the end.
    let next = step(r, c, selection.direction, true);
    while (next && grid[next.row][next.col] !== ".") {
      next = step(next.row, next.col, selection.direction, true);
    }
    if (next) onSelectionChange({ ...next, direction: selection.direction });
  }

  // Cells covered by the currently active entry get a soft highlight so the
  // player can see which word they're solving.
  const activeCellSet = useMemo(() => {
    const set = new Set<string>();
    if (activeEntry) {
      for (const { row, col } of activeEntry.cells) set.add(cellKey(row, col));
    }
    return set;
  }, [activeEntry]);

  const boardW = puzzle.cols * cellPx;
  const boardH = puzzle.rows * cellPx;

  return (
    <div
      className="relative grid select-none border-2 border-foreground/60"
      style={{
        width: boardW,
        height: boardH,
        gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)`,
        gridTemplateRows: `repeat(${puzzle.rows}, 1fr)`,
      }}
    >
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const key = cellKey(r, c);
          if (cell === "#") {
            // A clearly-distinct dark gray so blocked cells read as
            // "no-write" at a glance against the dark playable cells. Using
            // a hard hex (not a foreground/opacity blend) keeps the contrast
            // identical regardless of theme tint.
            return (
              <div
                key={key}
                className="border-r border-b border-foreground/60"
                style={{
                  backgroundColor: "#3f3f46",
                  borderRightWidth: c === puzzle.cols - 1 ? 0 : undefined,
                  borderBottomWidth: r === puzzle.rows - 1 ? 0 : undefined,
                }}
              />
            );
          }
          const isSelected =
            selection.row === r && selection.col === c;
          const isActiveWord = activeCellSet.has(key);
          const isError = errors.has(key);
          const isCorrect = corrects?.has(key) ?? false;
          const isRevealed = revealed?.has(key) ?? false;
          const number = puzzle.numbers[r][c];

          // Feedback priority (highest wins): revealed (blue) → error
          // (red) → selected → active-word. Confirmed-correct cells only
          // tint the *letter* green (see input className below) — their
          // background stays in the normal selected/active-word/card flow
          // so a locked square still shows the usual selection highlight
          // when the player navigates onto it.
          let bg = "bg-card";
          if (isRevealed) bg = "bg-blue-500/25";
          else if (isError) bg = "bg-red-500/25";
          else if (isSelected) bg = "bg-accent/35";
          else if (isActiveWord) bg = "bg-accent/12";

          return (
            <div
              key={key}
              className={`relative ${bg} border-r border-b border-foreground/40`}
              style={{
                borderRightWidth: c === puzzle.cols - 1 ? 0 : undefined,
                borderBottomWidth: r === puzzle.rows - 1 ? 0 : undefined,
              }}
              onClick={() => handleCellClick(r, c)}
            >
              {number !== null && (
                <span
                  className="pointer-events-none absolute left-0.5 top-0 font-mono text-[0.55rem] leading-tight text-muted"
                  style={{ fontSize: Math.max(8, Math.floor(cellPx * 0.22)) }}
                >
                  {number}
                </span>
              )}
              <input
                ref={(el) => setInputRef(r, c, el)}
                value={cell === "." ? "" : cell}
                onChange={(e) => handleChange(e, r, c)}
                onKeyDown={(e) => handleKeyDown(e, r, c)}
                // Intentionally no `onFocus → handleCellClick`. Navigation
                // is driven by `onClick` on the wrapping div only; relying
                // on focus too caused a tap to fire both events, with the
                // second pass treating the new cell as a re-click and
                // silently flipping direction.
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={2 /* extra char so onChange fires even when replacing */}
                aria-label={`Cell row ${r + 1} column ${c + 1}`}
                className={`absolute inset-0 h-full w-full bg-transparent text-center font-mono font-bold uppercase outline-none ${
                  isRevealed
                    ? "text-blue-400"
                    : isError
                      ? "text-red-400"
                      : isCorrect
                        ? "text-emerald-400"
                        : "text-foreground"
                } caret-transparent`}
                style={{ fontSize: Math.max(12, Math.floor(cellPx * 0.55)) }}
                tabIndex={isSelected ? 0 : -1}
                readOnly={disabled || isCorrect}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
