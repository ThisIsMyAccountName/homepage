import { Project } from "@/lib/types";

const GITHUB_USER = process.env.NEXT_PUBLIC_GITHUB_USER ?? "your-github-username";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
const REDDIT_READER_URL =
  process.env.NEXT_PUBLIC_REDDIT_READER_URL ?? "https://r.example.com";

const gh = (repo: string) => `https://github.com/${GITHUB_USER}/${repo}`;

export const projects: Project[] = [
  {
    slug: "reddit-reader",
    title: "Reddit Reader",
    description:
      "A custom web app to browse Reddit using the public JSON API. Features Flask backend, AJAX settings, CSRF-protected forms, subreddit/post/comment viewing, and user profile pages.",
    tags: ["Python", "Flask", "Reddit API", "WTForms"],
    images: ["/images/reddit-reader.png"],
    embed: REDDIT_READER_URL,
    links: {
      github: gh("reddit-Reader"),
      live: REDDIT_READER_URL,
    },
  },
  {
    slug: "homepage",
    title: "Personal Homepage",
    description:
      "This site. A modular personal homepage built with Next.js, featuring project showcases, hosted mini games (Sudoku, etc.), file hosting, and external links. Dark minimalist design.",
    tags: ["Next.js", "TypeScript", "Tailwind CSS", "Docker"],
    images: ["/images/placeholder.svg"],
    links: {
      github: gh("homepage"),
      live: SITE_URL,
    },
  },
  {
    slug: "idealer",
    title: "Dimensional Alchemy",
    description:
      "An in-browser idle game with resource economy, generators, prestige system, upgrades, research tree, and expeditions. No build tools required — pure vanilla JS with deterministic tick loop.",
    tags: ["JavaScript", "Idle Game", "Vanilla JS", "HTML5"],
    images: ["/games/idealer/assets/icons/currencies/matter.png"],
    playUrl: "/games/idealer",
    links: {
      github: gh("Idealer"),
    },
  },
];
