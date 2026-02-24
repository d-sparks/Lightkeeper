# CLAUDE.md

## Quick Reference

```bash
npm install          # Install dependencies
npm start            # Start server at http://localhost:3000
# Open multiple browser tabs for multiplayer testing
```

Deploy to Fly.io:
```bash
fly deploy           # Build & deploy via Dockerfile
fly logs             # Stream production logs
fly ssh console      # SSH into running machine
```

App name: `lightkeeper-woc3dg`, region: `ams`, internal port: 8080.

## What This Is

Lightkeeper is a multiplayer browser dungeon crawler. Node.js authoritative server + PixiJS client connected via WebSockets. Vanilla JavaScript throughout — no build step, no TypeScript, no frameworks.

## Project Structure

There are two conceptually independent layers: **engine** and **content**. They must stay decoupled.

### Engine (code)

```
server/
  index.js              HTTP + WebSocket server, message routing
  game-loop.js          Fixed 15 Hz tick: physics, combat, AI, sol grid, abilities, energy
  physics.js            Circle-vs-AABB collision, wall sliding
  content-loader.js     Loads all JSON content at startup
  content-git.js        Git branch integration for content management
  editor-api.js         REST API for the visual editor
  editor-auth.js        Editor password auth (env: EDITOR_PASSWORD)
  scripting/            Trigger-Condition-Action system (event-driven, declarative)
    event-bus.js        Event emission
    flag-store.js       Per-player and per-room key-value state
    conditions.js       Condition evaluator (hasFlag, hasItem, logical ops)
    actions.js          Action executor (setFlag, spawnItem, showMessage, etc.)
    trigger-registry.js Trigger management

client/
  index.html            Canvas container, HUD markup
  main.js               Entry point, game flow
  renderer.js           PixiJS 7 rendering (tilemap, entities, camera, minimap)
  input.js              Keyboard + touch input
  net.js                WebSocket client

shared/
  constants.js          Tick rate, tile size, colors, message types (NET object — includes SOL_GRID_*, INVENTORY, ABILITY_STATE, EQUIPMENT, etc.)
```

### Content (pure JSON data — no code)

```
content/
  settings.json         Spawn room config
  dungeons/             Floor layouts (tile grids, spawns, exits, triggers)
  tilesets/             Tile definitions (solid, interactable, conditions)
  entities/
    monsters.json       Monster stats + AI type
    npcs.json           NPC definitions + conditional dialogue
    items.json          Weapons, consumables, keys, sol components
    sol_components.json Ability & modifier definitions (sol grid)
    sol_units.json      Sol unit grid configurations
  sprites/              16x16 placeholder PNGs
  loot/                 (Planned) Loot tables
```

**Rule: new game content goes in `content/` as JSON. Never hardcode content in engine code.** The engine reads data — it doesn't contain it.

## Content vs Engine Guidelines

When working on this codebase, always consider which layer a change belongs to:

| Change | Layer | Location |
|--------|-------|----------|
| New monster, NPC, item | Content | `content/entities/` JSON |
| New dungeon floor | Content | `content/dungeons/` new JSON file |
| New tileset | Content | `content/tilesets/` new JSON file |
| New game behavior (scripted) | Content | Triggers in dungeon JSON (see `docs/game-scripting.md`) |
| New sol component (ability/modifier) | Content | `content/entities/sol_components.json` |
| New sol unit variant | Content | `content/entities/sol_units.json` |
| New AI behavior keyword | Engine | `server/game-loop.js` |
| New server system | Engine | New file in `server/`, wire into `game-loop.js` |
| New client feature | Engine | New file in `client/`, wire into `main.js` |
| New message type | Engine | `shared/constants.js` NET, handle on both sides |

If a behavior can be expressed as a trigger/condition/action in JSON, prefer that over engine code. See `docs/game-scripting.md` for the scripting system reference.

## Key Design Constraints

- **Server-authoritative**: All game state lives on the server. Clients send input, server sends state. No client-side game logic.
- **Vanilla JS only**: No TypeScript, no build tools, no frontend frameworks. Single runtime dep: `ws`.
- **15 Hz fixed tick**: Game loop in `game-loop.js` runs every 66ms.
- **Data-driven**: All content is JSON. The scripting system uses declarative triggers, not embedded code.

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Server port | 3000 (local), 8080 (Docker) |
| `EDITOR_PASSWORD` | Password for `/editor` access | (none — open access) |
| `GITHUB_TOKEN` | GitHub token for editor git (deployed) | (none — uses local SSH) |
| `GITHUB_REPO` | GitHub `owner/repo` for editor git | (none — uses local origin remote) |
| `GITHUB_BASE_BRANCH` | Base branch for editor PRs | `main` |

Editor git has two modes: when `GITHUB_TOKEN`+`GITHUB_REPO` are set, it uses HTTPS token auth (for deployed environments). When neither is set, it falls back to the repo's existing origin remote using SSH/credential helper (local development). PR creation uses `gh` CLI in local mode.

## Testing

No automated tests. Test manually:
1. `npm start`
2. Open http://localhost:3000 in multiple tabs
3. Check: movement, collision, combat, floor transitions, NPC dialogue, inventory

## Key Documentation

- `architecture-plan.md` — Full technical design spec and data format reference
- `docs/game-scripting.md` — Trigger/Condition/Action scripting system
- `docs/progression-system.md` — Sol grid, abilities, energy, and component design
- `docs/storyboard.md` — World lore, factions, narrative
- `AGENTS.md` — AI agent workflow (branch conventions, where to put new features)
- `PLACEHOLDER_ASSETS.md` — Notes on generated sprites needing replacement

## Deployment Details

Docker build (see `Dockerfile`): Node 20 slim, `npm ci --production`, serves on port 8080.

Fly.io config (`fly.toml`): shared CPU, 256 MB RAM, auto-stop/start, force HTTPS. Machines scale to zero when idle.

```bash
fly deploy                    # Deploy current code
fly status                    # Check machine status
fly secrets set KEY=value     # Set env vars (e.g. EDITOR_PASSWORD)
```
