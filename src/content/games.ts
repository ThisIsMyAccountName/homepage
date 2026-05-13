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
];
