#!/usr/bin/env bash
#
# sync-idealer.sh — fetch the Dimensional Alchemy game into the site.
#
# Dimensional Alchemy ("idealer") is a standalone static game (vanilla ES
# modules, no build step) embedded via iframe at /games/idealer/index.html.
# It lives in its OWN public GitHub repo and is NOT committed to this repo
# (public/games/idealer/ is gitignored). This script clones that repo into
# public/games/idealer/.
#
# It runs automatically before `npm run build` and `npm run dev` (see the
# "prebuild" / "predev" hooks in package.json), so the Docker image build
# bakes in whatever is latest at build time. You can also run it by hand:
#
#   npm run sync:idealer                       # latest default branch
#   IDEALER_BRANCH=dev npm run sync:idealer    # a specific branch/tag
#   IDEALER_REPO_URL=https://github.com/you/x.git npm run sync:idealer
#
# Set IDEALER_AUTO=1 for hook/CI use: quieter, and if the clone fails but a
# previous copy exists it keeps that copy instead of breaking the build.

set -euo pipefail

# ---------------------------------------------------------------------------
# CONFIG — the public Dimensional Alchemy GitHub repo.
# (Override per-run with the IDEALER_REPO_URL env var.)
# ---------------------------------------------------------------------------
REPO_URL="${IDEALER_REPO_URL:-https://github.com/ThisIsMyAccountName/Idealer.git}"
BRANCH="${IDEALER_BRANCH:-}"   # empty = repo's default branch
SUBPATH="${IDEALER_SUBPATH:-}" # empty = repo root maps to served root
AUTO="${IDEALER_AUTO:-0}"      # 1 = hook/CI mode (quiet, tolerant of offline)
# ---------------------------------------------------------------------------

# Resolve repo paths relative to this script so it works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="$REPO_ROOT/public/games/idealer"

log() { [ "$AUTO" = "1" ] && echo "[idealer] $*" || echo "$*"; }

if [ "$REPO_URL" = "https://github.com/CHANGE_ME/dimensional-alchemy.git" ]; then
  echo "ERROR: Set REPO_URL in scripts/sync-idealer.sh (or the IDEALER_REPO_URL" >&2
  echo "       env var) to your public Dimensional Alchemy repo, then re-run." >&2
  exit 1
fi

command -v git >/dev/null 2>&1 || {
  echo "ERROR: git not found (the Docker builder installs it via apk)" >&2
  exit 1
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Existing copy we can fall back to if an auto-mode clone fails (offline build).
have_existing() { [ -f "$DEST/index.html" ]; }

log "Cloning $REPO_URL${BRANCH:+ (branch: $BRANCH)} ..."
clone_ok=1
if [ -n "$BRANCH" ]; then
  git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/src" || clone_ok=0
else
  git clone --quiet --depth 1 "$REPO_URL" "$TMP/src" || clone_ok=0
fi

if [ "$clone_ok" -ne 1 ]; then
  if [ "$AUTO" = "1" ] && have_existing; then
    log "WARNING: clone failed — keeping the existing copy at public/games/idealer."
    exit 0
  fi
  echo "ERROR: failed to clone $REPO_URL and no usable copy exists." >&2
  exit 1
fi

SRC="$TMP/src${SUBPATH:+/$SUBPATH}"

if [ ! -f "$SRC/index.html" ]; then
  echo "ERROR: $SRC/index.html not found after clone." >&2
  echo "       Check REPO_URL / IDEALER_SUBPATH — the game's index.html must" >&2
  echo "       sit at the source root being mirrored." >&2
  exit 1
fi

CLONED_SHA="$(git -C "$TMP/src" rev-parse --short HEAD)"

# Strip VCS/CI metadata, then replace the destination wholesale (a fresh copy
# means files deleted upstream also disappear here — no rsync needed).
log "Installing into public/games/idealer ..."
rm -rf "$SRC/.git" "$SRC/.github" "$SRC/.gitignore" "$SRC/.gitattributes"
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -R "$SRC" "$DEST"

log "✓ Dimensional Alchemy @ $CLONED_SHA ready (gitignored — baked at build time)"
