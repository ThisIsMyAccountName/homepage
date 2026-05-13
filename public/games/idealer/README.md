# Dimensional Alchemy (Idle Game Prototype)

This is the first implementation slice of a browser idle game.

## Current Status

Implemented:
- Deterministic tick loop (`100ms`)
- Input-safe delegated click handling with throttled rendering (responsive interactions)
- Resource economy (`Matter`, `Fire`, `Shards`)
- Manual action (`Transmute Matter`)
- Conversion action (`100 Matter -> 1 Fire`)
- Generator system (`Furnace`, `Condenser`, `Element Prism`)
- Cost scaling (`baseCost * 1.15^level`)
- Prestige action (`Ascend`) with soft reset and permanent multiplier
- Upgrades tab with unlock-gated permanent run bonuses
- Research tab with level-based unlock-gated progression nodes
- Collection tab for rare expedition drops with hidden placeholders, completion tracking, and claimable milestone perks
- Autosave every 30s + save on tab close
- Offline gains based on elapsed time at 50% efficiency
- Responsive single-screen GUI

## Architecture

- `src/engine`: state, formulas, event bus, tick loop
- `src/game`: generators, actions, resource manager
- `src/persistence`: local save/load and offline replay
- `src/ui`: rendering and interaction bindings
- `src/config`: tuning constants and content definitions

## Currency Icons

Currency displays are now icon-first with automatic text fallback.

Drop files in:
- `assets/icons/currencies/`

Use exact filenames:
- `matter.png`
- `fire.png`
- `intel.png`
- `shards.png`

Recommended source size:
- `64x64` transparent PNG minimum
- `128x128` optional master export for future high-DPI usage

Fallback behavior:
- If an icon loads, UI shows the image.
- If an icon is missing or fails to load, UI shows existing tokens (`MAT/FIR/EXP/SHD` for card badges and `M/F/I/S` inline).

## Expedition Item Icons

Expedition drops (loot tables, collection catalog, blueprint ledger, part inventory) are also icon-first.

Drop files in:
- `assets/icons/expedition-items/`

Filename rule:
- Item ID converted to lowercase kebab-case
- Replace non-alphanumeric characters with `-`

Examples:
- `part:raft:sail:patched-cloth` -> `part-raft-sail-patched-cloth.png`
- `ship:sloop:keel-plan` -> `ship-sloop-keel-plan.png`
- `map:abyssal-atlas` -> `map-abyssal-atlas.png`

Optional hidden-entry placeholder:
- `unknown.png`

## Run

No build tooling is required.

Use any static file server and open `index.html` from that server root.

Example command if Python is available:

```powershell
python -m http.server 5500
```

Then open:

- `http://localhost:5500`

## Next Milestone

- Ascend tab with hexagonal shard tree
- 10 additional upgrades and 10 additional research nodes
- More resource tiers and recipes
- More automation unlocks
- Better progression telemetry and balancing tools
