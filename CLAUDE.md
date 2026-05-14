@AGENTS.md

## Project overview
Personal homepage for Simon Andersen — Next.js 16 / React 19 / Tailwind v4 / TypeScript / Docker.
Dark minimalist design. Features: project showcase, mini-games (daily Sudoku, physics sandbox), file hosting, external links, and traffic analytics.
Content is static TypeScript arrays in `src/content/`. Mutable data (leaderboard, traffic) is persisted as JSON in `data/`. No database.

## Knowledge base
Full codebase docs live in `ai_docs/` (gitignored — local only). Read these before writing code:

| File | What it covers |
|------|----------------|
| `ai_docs/architecture.md` | Route map, data flow, file structure, key conventions |
| `ai_docs/content-system.md` | How to add projects, games, files, links |
| `ai_docs/game-system.md` | GameDefinition interface, canvas loop, daily puzzle, Sudoku engine |
| `ai_docs/api-routes.md` | All API endpoints with request/response shapes |
| `ai_docs/design-system.md` | Tailwind v4 usage, color tokens, component patterns |
| `ai_docs/deployment.md` | Docker 3-stage build, docker-compose, standalone output |
| `ai_docs/types-reference.md` | All TypeScript interfaces |
| `ai_docs/security.md` | Input sanitization, rate limiting, IP hashing |

## Plans
Feature and task plans live in `plan/` (gitignored — local only).
Before implementing a non-trivial feature, create a markdown plan file in `plan/` first.
