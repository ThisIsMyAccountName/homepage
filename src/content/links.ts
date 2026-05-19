import { ExternalLink } from "@/lib/types";

const GITHUB_USER = process.env.NEXT_PUBLIC_GITHUB_USER ?? "your-github-username";

export const links: ExternalLink[] = [
  {
    title: "GitHub",
    url: `https://github.com/${GITHUB_USER}`,
    description: "My projects and (non so far) contributions.",
  },
];
