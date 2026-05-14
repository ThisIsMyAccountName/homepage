import { GameMeta } from "@/lib/types";

export const games: GameMeta[] = [
  {
    slug: "sudoku",
    title: "Sudoku",
    description:
      "6x6, 9x9, and 16x16 (hex) Sudoku with infinite generated puzzles, timer, checker, and completion log.",
    thumbnail: "/images/placeholder.svg",
    controls: "Click cell + number keys, Arrow keys to move, Backspace to clear",
  },
  {
    slug: "idealer",
    title: "Dimensional Alchemy",
    description:
      "An idle game with resources, generators, prestige, upgrades, research, expeditions, and ships. Progress persists in your browser.",
    thumbnail: "/games/idealer/assets/icons/currencies/matter.png",
    controls: "Click to interact. Progress auto-saves.",
  },
  {
    slug: "example-game",
    title: "Physics Sandbox",
    description: "A physics playground with gravity, ball-to-ball collisions, wall drawing, and adjustable parameters. Open the menu to tweak speed, size, gravity, and more.",
    thumbnail: "/images/placeholder.svg",
    controls: "Click to spawn balls, drag to draw walls. Use the menu (top-left) to adjust physics.",
  },
  {
    slug: "nonogram",
    title: "Nonogram",
    description: "Fill cells to reveal a hidden pixel picture. Clue numbers on each row and column tell you the groups of consecutive filled cells. Available in 5×5, 7×7, and 10×10.",
    thumbnail: "/images/placeholder.svg",
    controls: "Left click to fill, right click to mark empty. Arrow keys to navigate, Space to fill, X to mark.",
  },
  {
    slug: "x-coloring",
    title: "X Coloring",
    description: "Color the graph so no two connected nodes share a color.",
    thumbnail: "/images/placeholder.svg",
    controls: "Pick a color, click nodes to paint. Number keys 1-4 select a color. Backspace clears the selected node.",
  },
];
