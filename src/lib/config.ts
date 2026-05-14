import { NavItem } from "./types";

export const siteConfig = {
  name: "Simon Andersen",
  title: "Homepage",
  description: "My projects, games, and links.",
};

export const navigation: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Projects",
    href: "/projects",
    children: [
      { label: "Reddit Reader", href: "/projects/reddit-reader" },
      { label: "Personal Homepage", href: "/projects/homepage" },
      { label: "Dimensional Alchemy", href: "/projects/idealer" },
    ],
  },
  {
    label: "Games",
    href: "/games",
    children: [
      { label: "Sudoku", href: "/games/sudoku" },
      { label: "Dimensional Alchemy", href: "/games/idealer" },
      { label: "Physics Sandbox", href: "/games/example-game" },
      { label: "Nonogram", href: "/games/nonogram" },
      { label: "X Coloring", href: "/games/x-coloring" },
    ],
  },
  { label: "Files", href: "/files" },
  { label: "Links", href: "/links" },
];
