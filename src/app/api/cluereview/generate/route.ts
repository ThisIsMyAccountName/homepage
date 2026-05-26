/**
 * `POST /api/cluereview/generate`
 *
 * Runs the procedural crossword generator on the server and returns one
 * fully-clued puzzle (shape, grid, numbering, entries, and a stable id).
 * The puzzle is *not* persisted — the caller previews it and posts to
 * `/api/cluereview/approve` to add it to the daily pool.
 *
 * Body (all optional): `{ "shape": "5x5" | "6x6" | ... }`
 *   - `shape` constrains the dims; omit to let the generator pick.
 *
 * Response: `{ "puzzle": <StoredPuzzle> }` on success.
 *
 * Auth: same `x-review-password` header used by every other cluereview
 * endpoint. The generator is CPU-heavy on larger shapes — gating it
 * behind the password keeps it from being a free DoS handle.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateCrosswordForDims,
  generateCrosswordPuzzle,
} from "@/games/crossword/generator";
import { computePuzzleId, type StoredPuzzle } from "@/games/crossword/storedPuzzle";
import { ALL_SHAPES, SHAPE_DIMS, type ShapeKey } from "@/games/crossword/types";

// Node runtime — the generator does long-running CPU work (multi-second
// on harder shapes) and won't fit Edge's deadlines.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const pw = process.env.CLUE_REVIEW_PASSWORD;
  if (!pw) return false;
  return request.headers.get("x-review-password") === pw;
}

function isShapeKey(value: unknown): value is ShapeKey {
  return typeof value === "string" && (ALL_SHAPES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { shape?: unknown } = {};
  try {
    if (request.headers.get("content-length") !== "0") {
      body = await request.json();
    }
  } catch {
    // Empty / non-JSON body is fine — fall through to random shape.
  }

  const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;

  let puzzle: ReturnType<typeof generateCrosswordPuzzle> | null = null;
  try {
    if (isShapeKey(body.shape)) {
      const { rows, cols } = SHAPE_DIMS[body.shape];
      puzzle = generateCrosswordForDims(rows, cols, seed);
    } else {
      puzzle = generateCrosswordPuzzle(seed);
    }
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Generator failed — clue bank may be too small.",
      },
      { status: 500 }
    );
  }

  if (!puzzle) {
    return NextResponse.json(
      { error: "Generator could not fill that shape — try again." },
      { status: 503 }
    );
  }

  const id = computePuzzleId(puzzle.rows, puzzle.cols, puzzle.solution, puzzle.black);
  const stored: StoredPuzzle = { ...puzzle, id };

  return NextResponse.json({ puzzle: stored });
}
