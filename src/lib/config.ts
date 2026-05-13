import { NavItem } from "./types";

export const siteConfig = {
  name: "Simon Andersen",
  title: "Homepage",
  description: "My projects, games, and links.",
};

export const navigation: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "Games", href: "/games" },
  { label: "Files", href: "/files" },
  { label: "Links", href: "/links" },
];
