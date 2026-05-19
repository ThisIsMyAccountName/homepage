"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseBoardSizeOptions {
  /** Cells along one axis of a square N×N board. Use 1 for a single square board. */
  count: number;
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
 * **square** cell that lets an N×N board fit on screen without scrolling.
 *
 * Attach `ref` to a `w-full` element placed where the board starts; render the
 * board at `cell * count` px so cells are guaranteed square.
 */
export function useBoardSize({
  count,
  reserveBelow = 160,
  min = 28,
  max = Number.POSITIVE_INFINITY,
  deps = [],
}: UseBoardSizeOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(min);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const widthBudget = rect.width;
    const heightBudget = window.innerHeight - rect.top - reserveBelow;
    const side = Math.min(widthBudget, heightBudget);
    const next = Math.floor(side / count);
    setCell(Math.max(min, Math.min(max, next || min)));
  }, [count, reserveBelow, min, max]);

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
