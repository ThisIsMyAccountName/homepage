import { NavItem } from "./types";

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "Your Name",
  title: process.env.NEXT_PUBLIC_SITE_TITLE ?? "Homepage",
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ?? "My projects, games, and links.",
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
      { label: "Flow", href: "/games/flow" },
      { label: "Crossword", href: "/games/crossword" },
      { label: "Cryptic", href: "/games/cryptic" },
    ],
  },
  { label: "Files", href: "/files" },
  { label: "Links", href: "/links" },
];
