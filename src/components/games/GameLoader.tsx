"use client";

import { GameCanvas } from "./GameCanvas";
import { use, type ComponentType } from "react";
import type { GameDefinition } from "@/lib/types";

interface GameLoaderProps {
  slug: string;
}

type GameEntry =
  | { type: "canvas"; load: () => Promise<{ default: GameDefinition<any> }> } // eslint-disable-line @typescript-eslint/no-explicit-any
  | { type: "component"; load: () => Promise<{ default: ComponentType }> }
  | { type: "iframe"; src: string };

// Registry of available games - add new games here
const gameRegistry: Record<string, GameEntry> = {
  "example-game": {
    type: "component",
    load: () =>
      import("@/games/example-game/SandboxGame").then((mod) => ({
        default: mod.SandboxGame as unknown as ComponentType,
      })),
  },
  sudoku: {
    type: "component",
    load: () =>
      import("@/games/sudoku").then((mod) => ({
        default: mod.SudokuGame as unknown as ComponentType,
      })),
  },
  nonogram: {
    type: "component",
    load: () =>
      import("@/games/nonogram").then((mod) => ({
        default: mod.NonogramGame as unknown as ComponentType,
      })),
  },
  "x-coloring": {
    type: "component",
    load: () =>
      import("@/games/x-coloring").then((mod) => ({
        default: mod.XColoringGame as unknown as ComponentType,
      })),
  },
  flow: {
    type: "component",
    load: () =>
      import("@/games/flow").then((mod) => ({
        default: mod.FlowGame as unknown as ComponentType,
      })),
  },
  crossword: {
    type: "component",
    load: () =>
      import("@/games/crossword").then((mod) => ({
        default: mod.CrosswordGame as unknown as ComponentType,
      })),
  },
  idealer: {
    type: "iframe",
    src: "/games/idealer/index.html",
  },
};

type LoadResult =
  | { type: "canvas"; game: GameDefinition }
  | { type: "component"; Component: ComponentType }
  | { type: "iframe"; src: string };

// Cache promises to avoid re-fetching
const promiseCache = new Map<string, Promise<LoadResult>>();

function loadGame(slug: string): Promise<LoadResult> {
  if (!promiseCache.has(slug)) {
    const entry = gameRegistry[slug];
    if (!entry) {
      promiseCache.set(
        slug,
        Promise.reject(new Error(`Game "${slug}" not found in registry.`))
      );
    } else if (entry.type === "iframe") {
      promiseCache.set(
        slug,
        Promise.resolve({ type: "iframe" as const, src: entry.src })
      );
    } else if (entry.type === "canvas") {
      promiseCache.set(
        slug,
        entry.load().then((mod) => ({
          type: "canvas" as const,
          game: mod.default as unknown as GameDefinition,
        }))
      );
    } else {
      promiseCache.set(
        slug,
        entry.load().then((mod) => ({
          type: "component" as const,
          Component: mod.default,
        }))
      );
    }
  }
  return promiseCache.get(slug)!;
}

export function GameLoader({ slug }: GameLoaderProps) {
  const result = use(loadGame(slug));

  if (result.type === "canvas") {
    return <GameCanvas game={result.game} />;
  }

  if (result.type === "iframe") {
    return (
      <iframe
        src={result.src}
        className="w-full border-0"
        style={{ height: "80vh", minHeight: "500px" }}
        title="Game"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  const Component = result.Component;
  return <Component />;
}
