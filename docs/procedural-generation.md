# Procedural Dungeon Generation

## Overview

Lightkeeper supports procedural dungeon generation alongside hand-authored dungeons. Procedural dungeons are defined by **templates** (JSON files in `content/dungeons/templates/`) that specify constraints — room counts, monster pools, item distributions, corridor properties — and the server generates playable layouts at runtime.

Once generated, a procedural dungeon is indistinguishable from a hand-authored one. It uses the exact same dungeon JSON format and flows through the same `createRoom()` pipeline.

## How It Works

1. A hand-authored dungeon exit has `"leadsTo": "proc_quarantine_deep"` (a template ID)
2. When a player steps on that exit, `getOrCreateRoom()` detects the template
3. `DungeonGenerator.generate()` produces a standard dungeon JSON object
4. The dungeon is cached with a deterministic instance ID
5. All subsequent players entering the same exit get the same dungeon

## Template Format

Templates live in `content/dungeons/templates/*.json`. Example:

```json
{
  "id": "proc_quarantine_deep",
  "type": "procedural",
  "namePattern": "Quarantine Depth {depth}",
  "tileset": "crypt",
  "tileSize": 32,
  "depth": { "min": 4, "max": 10 },

  "grid": {
    "width": 60, "height": 40,
    "wallTile": 3, "floorTile": 1,
    "altFloorTile": 2, "altFloorChance": 0.05
  },

  "rooms": {
    "count": { "min": 6, "max": 10 },
    "width": { "min": 5, "max": 12 },
    "height": { "min": 5, "max": 10 },
    "padding": 2,
    "maxPlacementAttempts": 200
  },

  "corridors": {
    "width": { "min": 2, "max": 3 },
    "doorChance": 0.4,
    "doorTile": 4,
    "extraConnectionChance": 0.25
  },

  "requiredRooms": [
    { "tag": "entrance", "isEntrance": true,
      "width": { "min": 5, "max": 7 }, "height": { "min": 5, "max": 7 } },
    { "tag": "exit_room", "isExit": true,
      "width": { "min": 4, "max": 6 }, "height": { "min": 4, "max": 6 } },
    { "tag": "treasure",
      "width": { "min": 4, "max": 5 }, "height": { "min": 4, "max": 5 },
      "itemSpawns": [{ "type": "health_potion", "position": "center" }] }
  ],

  "exits": {
    "entrance": { "tile": 8, "position": "entrance_room", "leadsTo": "$source" },
    "descent":  { "tile": 6, "position": "exit_room", "leadsTo": "$next" }
  },

  "monsters": {
    "budget": { "base": 5, "perDepth": 2 },
    "pool": [
      { "type": "skeleton", "weight": 3, "cost": 1, "minDepth": 0 },
      { "type": "luddite_brawler", "weight": 2, "cost": 1, "minDepth": 0 }
    ],
    "maxPerRoom": 4,
    "avoidEntranceRoom": true
  },

  "items": {
    "pool": [
      { "type": "health_potion", "weight": 5, "max": 3 },
      { "type": "bandage", "weight": 3, "max": 2 }
    ],
    "countRange": { "min": 1, "max": 4 }
  },

  "triggers": [
    { "id": "enter_{instanceId}", "event": "room_entered",
      "actions": [{ "type": "showMessage", "text": "The tunnels stretch deeper." }],
      "once": true }
  ],

  "spawns": { "count": 4, "position": "entrance_room" }
}
```

## Template Fields Reference

### Top-level

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique template identifier. Exits reference this. |
| `type` | string | Must be `"procedural"` |
| `namePattern` | string | Display name. `{depth}` is replaced with current depth. |
| `tileset` | string | Tileset ID from `content/tilesets/` |
| `tileSize` | number | Tile size in pixels (usually 32) |
| `depth` | object | `{ min, max }` — depth range for this template |

### `grid`

| Field | Type | Description |
|-------|------|-------------|
| `width`, `height` | number | Grid dimensions in tiles |
| `wallTile` | number | Tile ID for walls |
| `floorTile` | number | Tile ID for floors |
| `altFloorTile` | number | Alternative floor tile for variety |
| `altFloorChance` | number | Probability (0-1) of using alt floor |

### `rooms`

| Field | Type | Description |
|-------|------|-------------|
| `count` | range | Target number of rooms (includes required rooms) |
| `width`, `height` | range | Room dimension ranges |
| `padding` | number | Minimum gap between rooms |
| `maxPlacementAttempts` | number | Retries per room before giving up |

### `requiredRooms`

Array of room definitions that must be placed. Each can have:

| Field | Type | Description |
|-------|------|-------------|
| `tag` | string | Identifies this room (e.g. `"entrance"`, `"exit_room"`) |
| `isEntrance` | boolean | Player spawns and stairs-up go here |
| `isExit` | boolean | Stairs-down go here |
| `width`, `height` | range | Override default room size |
| `itemSpawns` | array | Items to place (`{ type, position: "center" }`) |
| `npcSpawns` | array | NPCs to place (`{ type }`) |

### `corridors`

| Field | Type | Description |
|-------|------|-------------|
| `width` | range | Corridor width in tiles |
| `doorChance` | number | Probability (0-1) of placing doors at chokepoints |
| `doorTile` | number | Tile ID for closed doors |
| `extraConnectionChance` | number | Probability of adding loop connections beyond MST |

### `monsters`

| Field | Type | Description |
|-------|------|-------------|
| `budget` | object | `{ base, perDepth }` — total monsters = base + perDepth * depth |
| `pool` | array | `{ type, weight, cost, minDepth }` — weighted selection pool |
| `maxPerRoom` | number | Cap on monsters per room |
| `avoidEntranceRoom` | boolean | Don't spawn monsters in the entrance |

### `items`

| Field | Type | Description |
|-------|------|-------------|
| `pool` | array | `{ type, weight, max }` — weighted selection with per-type cap |
| `countRange` | range | Total items to place |

### `triggers`

Standard trigger definitions (see `docs/game-scripting.md`). The token `{instanceId}` in trigger IDs is replaced with `templateId_depth` for uniqueness.

## Generation Algorithm

1. **Seeded RNG**: Mulberry32 PRNG seeded from `fromDungeon_exitX_exitY_serverEpoch`. Same exit in the same server session always produces the same dungeon.

2. **Room placement**: Required rooms first, then random rooms up to target count. Each room tries random positions, rejecting overlaps (respecting padding).

3. **Connectivity (MST)**: Prim's algorithm builds a minimum spanning tree over room centers, guaranteeing all rooms are reachable. Extra random edges add loops.

4. **Corridor carving**: L-shaped corridors (horizontal-then-vertical or vertical-then-horizontal, 50/50) connect each MST edge pair.

5. **Door placement**: Scans corridors for chokepoints (floor tiles with walls on two opposite sides). Places doors with configured probability.

6. **Entity placement**: Player spawns in entrance room, stairs-up in entrance, stairs-down in exit room. Monsters distributed by budget across non-entrance rooms. Items placed at random walkable tiles.

## Instance IDs

Generated dungeons get IDs in the format: `proc:{templateId}:{seedString}`

Example: `proc:proc_quarantine_deep:outpost_workshop_12_8_1708435200`

These IDs are used as room IDs and for tracking killed monsters / picked items, just like hand-authored dungeons.

## Depth & Chaining

Each procedural exit increments depth. When `depth >= template.depth.max`, the descent stairs lead back to the source dungeon instead of generating another floor. This creates a finite chain of procedural levels.

## Persistence

- Generated dungeons are cached in `gameLoop.generatedDungeons` (Map)
- Cache persists for the server session (clears on restart)
- Killed monsters and picked items persist via the existing `killedMonsters`/`pickedUpItems` maps
- Multiple players entering the same exit share the same generated dungeon

## Error Handling

If room placement fails, the generator retries up to 3 times with modified seeds. If all retries fail, the player stays in their current room.

## Adding New Templates

1. Create a new JSON file in `content/dungeons/templates/`
2. Set a unique `id`
3. Configure grid, rooms, corridors, monsters, items
4. Add an exit in a hand-authored dungeon pointing to your template's `id`
5. Restart the server — templates are loaded at startup
