# AGENTS.md

Guide for AI agents working on Lightkeeper.

## Branch Workflow

Always develop on a `claude/` prefixed branch (e.g. `claude/dev-...`). Never push directly to `main`. Open a PR when the work is ready for review.

## Running the Project

```bash
npm install
npm start        # starts server on http://localhost:3000
```

No build step. Vanilla JS served directly. Open multiple browser tabs to test multiplayer.

## Architecture

Lightkeeper is a multiplayer browser dungeon crawler with an authoritative Node.js server and an HTML5 Canvas client connected over WebSockets.

```
server/              Authoritative game server (Node.js)
  index.js           Entry point — HTTP server, WebSocket setup, message routing
  game-loop.js       Fixed-tick loop (15 Hz), room management, combat, AI
  physics.js         Circle-vs-AABB collision, movement with wall sliding
  content-loader.js  Loads all JSON content at startup

client/              Browser client
  index.html         Canvas container, HUD, dialogue overlay
  main.js            Entry point — game flow, event wiring
  renderer.js        Canvas drawing — tile map, entities, effects, camera
  input.js           Keyboard input (WASD/arrows, E to interact)
  net.js             WebSocket client, message handling

shared/
  constants.js       Tick rate, tile size, colors, message types

content/             Pure JSON data — no code
  dungeons/          Floor layouts (tile grids, spawns, exits)
  tilesets/          Tile definitions and properties (solid, interactable)
  entities/          Monster and NPC definitions (stats, AI type)
  items/             (Planned) Weapon, armor, consumable definitions
  loot/              (Planned) Loot table definitions

editor/              (Future) Visual level editor
docs/                Standalone demo page
```

### Server-Client Split

- **Server** owns all game state. It runs physics, combat, monster AI, and loot at a fixed 15 ticks/sec. Clients cannot cheat.
- **Client** captures input and renders. It receives full room state each tick and draws it.
- **Messages** are defined in `shared/constants.js` under `NET`. Client sends `join`, `input`, `interact`. Server sends `welcome`, `state`, `player_join`, `player_leave`, `floor_change`, `dialogue`.

## Design Philosophy

### Data-Driven Content

The engine reads data — it doesn't contain content. All dungeons, monsters, items, loot tables, and tilesets are JSON files in `content/`. This separation is fundamental to the project:

- New content can be added without touching engine code.
- A future visual editor will produce the same JSON.
- Non-programmers can author content.

When adding a new monster, floor, item, or loot table, **add a JSON entry in `content/`** — don't hardcode it in server logic.

### Modularity

Each system is its own module. New features should follow this pattern:

- New server system → new file in `server/` (e.g. `server/inventory.js`)
- New client system → new file in `client/` (e.g. `client/hud.js`)
- New content type → new directory or file under `content/`
- Shared constants → add to `shared/constants.js`

Keep modules focused. The game loop in `game-loop.js` orchestrates systems but shouldn't contain their internals.

### Vanilla JS, Minimal Dependencies

The project uses plain JavaScript with no transpilation, no frameworks, and a single runtime dependency (`ws` for WebSockets). Keep it that way. Don't introduce build tools, TypeScript, or frontend frameworks unless explicitly discussed.

## Where to Put New Features

| What you're adding | Where it goes |
|---|---|
| New monster type | `content/entities/monsters.json` — add an entry with stats and AI type |
| New dungeon floor | `content/dungeons/` — new JSON file following the existing floor format |
| New tileset | `content/tilesets/` — new JSON file defining tile properties |
| New item | `content/items/` — JSON file (weapons.json, armor.json, etc.) |
| New loot table | `content/loot/` — JSON file with weighted item rolls |
| New server system | `server/` — new module, wire it into `game-loop.js` |
| New client feature | `client/` — new module, wire it into `main.js` |
| New message type | Add to `shared/constants.js` NET object, handle in server and client |

## Key Data Formats

Monster definitions use an `ai` keyword (`melee_chase`, `ranged_kite`, `wander`, `guard`) that selects a built-in behavior in the game loop. Dungeon floors are tile grids with spawn points and exits that reference other floors. See `architecture-plan.md` for full format specs.

## Testing

No automated test suite yet. Test manually:

1. `npm start`
2. Open `http://localhost:3000` in multiple browser tabs
3. Verify movement, combat, floor transitions, NPC dialogue

## Key Files to Read First

For any task, start with these to orient yourself:

- `shared/constants.js` — all game constants and message types
- `server/game-loop.js` — the heart of the server; update loop, combat, AI
- `server/content-loader.js` — how JSON content becomes runtime data
- `client/renderer.js` — how the game is drawn
- `architecture-plan.md` — full technical design and data format reference
