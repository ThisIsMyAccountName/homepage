"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared sizing for every daily-puzzle board on the homepage. All three daily
 * games feed this into `useBoardSize` so each renders at an identical
 * on-screen square footprint regardless of puzzle type. Tweak here to resize
 * all daily boards at once.
 */
export const DAILY_BOARD = {
  /** Vertical px kept free below the board (controls + page padding). */
  reserveBelow: 200,
  /**
   * Smallest allowed play square. Set low enough that narrow phones
   * (≤320px viewport) don't overflow their containing card; the per-game
   * components adapt their cell/gutter dims off of this.
   */
  min: 240,
  /** Never grow it past this, so wide screens don't get a huge board. */
  max: 640,
} as const;

interface UseBoardSizeOptions {
  /** Cells along one axis of a square N×N board. Use 1 for a single square board. */
  count: number;
  /**
   * Override `count` for the horizontal axis only — i.e. number of columns
   * when the board is non-square. Defaults to `count`.
   */
  cols?: number;
  /**
   * Override `count` for the vertical axis only — i.e. number of rows when
   * the board is non-square. Defaults to `count`.
   */
  rows?: number;
  /** Vertical px to keep free below the board start (controls, page padding, …). */
  reserveBelow?: number;
  /** Clamp: smallest allowed cell. */
  min?: number;
  /** Clamp: largest allowed cell. */
  max?: number;
  /** Re-measure whenever any of these values change (e.g. layout-shifting state). */
  deps?: unknown[];
}

/**
 * Measures the available width of a full-width wrapper and the vertical space
 * from its top edge to the bottom of the viewport, then returns the largest
 * cell size that lets a `cols × rows` board fit on screen without scrolling.
 *
 * Defaults to square (`cols = rows = count`) so existing daily games keep
 * their behavior; pass `cols` and `rows` explicitly for a rectangular board
 * (e.g. crossword). Cells are always square — the board is then rendered at
 * `cell * cols × cell * rows` px.
 */
export function useBoardSize({
  count,
  cols,
  rows,
  reserveBelow = 160,
  min = 28,
  max = Number.POSITIVE_INFINITY,
  deps = [],
}: UseBoardSizeOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(min);

  const colCount = cols ?? count;
  const rowCount = rows ?? count;

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const widthBudget = rect.width;
    const heightBudget = window.innerHeight - rect.top - reserveBelow;
    const next = Math.floor(
      Math.min(widthBudget / colCount, heightBudget / rowCount)
    );
    setCell(Math.max(min, Math.min(max, next || min)));
  }, [colCount, rowCount, reserveBelow, min, max]);

  useEffect(() => {
    measure();
    const el = ref.current;
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // deps is intentionally spread so consumers can force a re-measure on layout shifts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return { ref, cell };
}
