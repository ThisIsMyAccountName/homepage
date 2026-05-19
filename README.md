# Homepage

Personal homepage built with Next.js 16, React 19, Tailwind v4, and TypeScript.
Features a project showcase, mini-games (daily Sudoku, Nonogram, X-Coloring, physics sandbox, etc.), file hosting, external links, and traffic analytics. Dark minimalist design, dockerised, no database (mutable data lives as JSON in `data/`).

## Configuration

Personal info (your name, GitHub username, site URLs, etc.) is read from environment variables so it can stay out of this repo.

1. Copy the template:
   ```bash
   cp .env.example .env.local
   ```
2. Edit `.env.local` and fill in your values:

   | Variable | Used for |
   |----------|----------|
   | `NEXT_PUBLIC_SITE_NAME` | Name on the lander hero, e.g. `Simon Andersen` |
   | `NEXT_PUBLIC_SITE_TITLE` | `<title>` tag and tab title |
   | `NEXT_PUBLIC_SITE_DESCRIPTION` | Hero subtitle and `<meta description>` |
   | `NEXT_PUBLIC_GITHUB_USER` | GitHub username used to build links on Projects and Links pages |
   | `NEXT_PUBLIC_SITE_URL` | Primary domain, e.g. `https://siand.net` (used as the "live" link for the homepage project) |
   | `NEXT_PUBLIC_REDDIT_READER_URL` | Live URL for the Reddit Reader project's embed and live link |

`.env*` is gitignored, so your `.env.local` stays on the server. Commit `.env.example` only.

> **Note:** these are `NEXT_PUBLIC_*` because they're used in client components. They're inlined at build time, so you must **rebuild** after changing them — runtime env changes do not take effect.

## Local development

```bash
npm install
npm run dev
```

`npm run dev` reads `.env.local` automatically. Open <http://localhost:3000>.

## Docker

Build and run with compose, pointing at your env file:

```bash
docker compose --env-file .env.local up --build -d
```

Compose substitutes the `NEXT_PUBLIC_*` vars into the build args defined in `docker-compose.yml`, which the `Dockerfile` inlines into the Next.js client bundle during `npm run build`. If you rename `.env.local` to `.env`, compose will pick it up by default and the `--env-file` flag becomes optional.

To pick up changes to `.env.local`, force a rebuild:

```bash
docker compose --env-file .env.local up --build -d --force-recreate
```

## Content (projects, games, files, links)

Everything else lives as static TypeScript arrays in `src/content/`:

- `projects.ts` — project cards
- `games.ts` — game metadata
- `files.ts` — hosted files (drop the actual files in `public/files/`)
- `links.ts` — external links

The personal bits inside these arrays (GitHub URLs, your live site URL) read from the env vars above. Project descriptions and titles are still inline — edit them directly if they don't match your projects.

## Project structure

```
src/
  app/         Next.js app router routes (pages + API)
  components/  Layout, UI, game components
  content/     Static content arrays (projects, games, files, links)
  games/       Game implementations (Sudoku, Nonogram, Flow, etc.)
  lib/         Shared utilities, types, site config
data/          Runtime data (leaderboard, traffic) — gitignored
public/        Static assets
```

Knowledge-base docs are in `ai_docs/` (gitignored, local only).
