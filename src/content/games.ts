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
    title: "Bouncing Ball",
    description: "A simple bouncing ball demo. Click or tap to add more balls.",
    thumbnail: "/images/placeholder.svg",
    controls: "Click/Tap to add balls",
  },
];
