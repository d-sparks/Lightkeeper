# Dungeon Crawler — Architecture Plan

## Game Concept

A **top-down, multiplayer dungeon crawler** played in the browser. Players explore procedurally-placed or hand-designed dungeon floors, fight monsters, and collect loot. The core tension:

> **When you die, you lose items or they take permanent durability damage.**

This creates meaningful stakes around every decision: which gear to equip vs. stash, when to retreat, whether that treasure room is worth the risk. It also creates a natural economy — good items are scarce because they get destroyed.

### Core Gameplay Loop

```
Enter dungeon → Explore rooms → Fight monsters → Find loot
       ↑                                            │
       │         ┌──────────────────────┐           │
       │         │   DEATH = LOSS       │           ▼
       │         │  • Drop equipped items│     Equip / stash loot
       │         │  • Durability damage  │           │
       │         │  • Respawn in town    │           │
       │         └──────────┬───────────┘           │
       │                    │                        │
       └── Return to town ←─┴── Go deeper ──────────┘
```

### Key Design Pillars

1. **Loot is precious.** Items degrade and can be permanently lost. Finding a rare weapon *matters*.
2. **Risk vs. reward.** Deeper floors have better loot but harder enemies. Dying costs you real progress.
3. **Multiplayer cooperation.** Exploring with friends is safer but you split the loot.
4. **Extensible content.** New items, enemies, dungeon tiles, and floor layouts are all data — no code changes needed.

---

## Core Principle: Data-Driven Design

The engine reads data, it doesn't contain content. Maps, entity types, item definitions, loot tables, and game rules are all defined in JSON. A future visual editor produces this same JSON.

```
┌─────────────────────────────────────────────────────┐
│                    CONTENT (JSON)                    │
│  Dungeons, monsters, items, loot tables, tilesets   │
└────────────────────────┬────────────────────────────┘
                         │ loaded by
                         ▼
┌─────────────────────────────────────────────────────┐
│                   ENGINE (Code)                      │
│  Renderer, combat, networking, inventory, game loop  │
└─────────────────────────────────────────────────────┘
```

---

## Data Formats

### Dungeon Floor Format (`content/dungeons/*.json`)

```json
{
  "id": "crypt_01",
  "name": "The Shallow Crypt",
  "depth": 1,
  "tileSize": 32,
  "width": 30,
  "height": 30,
  "layers": [
    {
      "name": "ground",
      "data": [1,1,1,2,2,1, "... (width × height tile IDs)"]
    },
    {
      "name": "walls",
      "data": [0,0,3,3,0,0, "..."]
    }
  ],
  "rooms": [
    {
      "id": "entrance",
      "x": 2, "y": 2, "w": 6, "h": 5,
      "tags": ["safe", "spawn"]
    },
    {
      "id": "treasure_room",
      "x": 20, "y": 22, "w": 5, "h": 5,
      "tags": ["treasure", "locked"],
      "lootTable": "crypt_rare"
    }
  ],
  "spawns": [
    { "x": 4, "y": 4, "type": "player_start" }
  ],
  "monsterSpawns": [
    { "type": "skeleton", "x": 15, "y": 10, "count": 3, "patrol": "wander" },
    { "type": "skeleton_archer", "x": 22, "y": 23, "count": 1, "patrol": "guard" }
  ],
  "exits": [
    { "x": 28, "y": 28, "leadsTo": "crypt_02", "type": "stairs_down" }
  ]
}
```

- **Rooms** are tagged regions. Tags drive behavior: `"treasure"` rooms get loot containers, `"safe"` rooms suppress monster spawns, `"locked"` rooms need a key.
- **Monster spawns** reference entity definitions. `patrol` is a simple AI behavior keyword the engine understands.
- **Exits** connect floors. The editor can wire up dungeon progression visually.

### Tileset Format (`content/tilesets/*.json`)

```json
{
  "id": "crypt",
  "image": "tilesets/crypt.png",
  "tileSize": 16,
  "tiles": {
    "1": { "name": "stone_floor", "solid": false },
    "2": { "name": "cracked_floor","solid": false, "trap": "spike", "damage": 10 },
    "3": { "name": "stone_wall",   "solid": true },
    "4": { "name": "door_closed",  "solid": true,  "interactable": "door" },
    "5": { "name": "door_open",    "solid": false, "interactable": "door" }
  }
}
```

### Monster Definitions (`content/entities/monsters.json`)

```json
{
  "skeleton": {
    "name": "Skeleton",
    "sprite": "sprites/skeleton.png",
    "size": [16, 16],
    "health": 30,
    "speed": 1.5,
    "damage": 8,
    "attackRange": 1,
    "attackSpeed": 1.0,
    "ai": "melee_chase",
    "lootTable": "skeleton_common",
    "xp": 10
  },
  "skeleton_archer": {
    "name": "Skeleton Archer",
    "sprite": "sprites/skeleton_archer.png",
    "size": [16, 16],
    "health": 20,
    "speed": 1.0,
    "damage": 12,
    "attackRange": 8,
    "attackSpeed": 0.7,
    "projectile": "arrow_bone",
    "ai": "ranged_kite",
    "lootTable": "skeleton_common",
    "xp": 15
  }
}
```

- `ai` is a keyword selecting a built-in behavior (`melee_chase`, `ranged_kite`, `wander`, `guard`, `boss_pattern_1`). Start with 3-4 AI types; they cover a lot.

---

## Item & Inventory System

This is the heart of the game's identity, so it deserves careful design.

### Item Definitions (`content/items/weapons.json`, `armor.json`, `consumables.json`)

```json
{
  "iron_sword": {
    "name": "Iron Sword",
    "type": "weapon",
    "slot": "mainhand",
    "sprite": "sprites/items/iron_sword.png",
    "rarity": "common",
    "stats": {
      "damage": 12,
      "attackSpeed": 1.0,
      "range": 1.5
    },
    "maxDurability": 100,
    "dropBehavior": "lose_on_death",
    "flavorText": "Standard issue. Won't be missed."
  },
  "flamebrand": {
    "name": "Flamebrand",
    "type": "weapon",
    "slot": "mainhand",
    "sprite": "sprites/items/flamebrand.png",
    "rarity": "rare",
    "stats": {
      "damage": 28,
      "attackSpeed": 0.9,
      "range": 1.5,
      "bonusFire": 10
    },
    "maxDurability": 60,
    "dropBehavior": "durability_loss_on_death",
    "durabilityLossOnDeath": 20,
    "flavorText": "Forged in the deep furnace. Handle with care — in every sense."
  },
  "health_potion": {
    "name": "Health Potion",
    "type": "consumable",
    "sprite": "sprites/items/health_potion.png",
    "rarity": "common",
    "effect": { "type": "heal", "amount": 40 },
    "stackable": true,
    "maxStack": 10,
    "dropBehavior": "lose_on_death"
  }
}
```

### Death Penalty — The `dropBehavior` Property

Each item defines what happens to it when the player dies:

| `dropBehavior` | On Death | Typical Use |
|---|---|---|
| `"lose_on_death"` | Item is **permanently lost** (dropped in dungeon or destroyed) | Common items, consumables |
| `"durability_loss_on_death"` | Item takes **permanent durability damage** (defined by `durabilityLossOnDeath`). If durability hits 0, item is destroyed. | Rare / valuable gear |
| `"soulbound"` | Item is **kept** but cannot be traded | Quest rewards, starter gear |
| `"drop_in_dungeon"` | Item is **left at death location** — can be retrieved on a corpse run | Optional high-risk mode |

This is extremely editor-friendly: a designer just picks a behavior from a dropdown when creating an item. The engine handles the rest.

### Durability System

```
Item has: currentDurability / maxDurability

Durability decreases from:
  1. Normal use (combat, blocking)       → small loss per hit
  2. Death penalty                        → large fixed loss (durabilityLossOnDeath)

Durability affects:
  - Item effectiveness (optional: reduced stats below 25%?)
  - Visual indicator (health bar on item icon)

Repair:
  - Town NPC / anvil (costs gold, restores to max)
  - Repair kits (consumable item, restores partial durability)

At 0 durability:
  - Item is DESTROYED permanently
```

### Inventory Model (Server State)

```json
{
  "playerId": "p1",
  "equipment": {
    "mainhand": { "itemId": "flamebrand", "currentDurability": 45 },
    "offhand": null,
    "armor": { "itemId": "leather_vest", "currentDurability": 80 },
    "accessory": null
  },
  "backpack": [
    { "itemId": "health_potion", "quantity": 3 },
    { "itemId": "iron_sword", "currentDurability": 70 },
    null, null, null, null, null, null
  ],
  "stash": [
    { "itemId": "flamebrand", "currentDurability": 60 },
    "... (safe storage in town, unaffected by death)"
  ],
  "gold": 240
}
```

Key distinction: **`equipment` and `backpack` are at risk. `stash` is safe.** This creates the core decision: what do you bring into the dungeon?

### Loot Tables (`content/loot/*.json`)

```json
{
  "skeleton_common": {
    "rolls": 1,
    "items": [
      { "itemId": "gold",          "weight": 50, "quantity": [1, 5] },
      { "itemId": "bone_fragment", "weight": 30 },
      { "itemId": "iron_sword",    "weight": 15 },
      { "itemId": "health_potion", "weight": 5 }
    ]
  },
  "crypt_rare": {
    "rolls": 2,
    "guaranteedRarity": "uncommon",
    "items": [
      { "itemId": "flamebrand",      "weight": 5 },
      { "itemId": "shield_of_thorns","weight": 10 },
      { "itemId": "ring_of_haste",   "weight": 10 },
      { "itemId": "gold",            "weight": 40, "quantity": [10, 30] },
      { "itemId": "health_potion",   "weight": 35, "quantity": [1, 3] }
    ]
  }
}
```

- Weighted random rolls. A future editor gives you a nice UI: drag items in, adjust sliders for weight.
- `guaranteedRarity` ensures treasure rooms always feel rewarding.

---

## System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                         SERVER (Node.js)                      │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  Lobby / │  │  Game    │  │  Combat  │  │  Inventory / │ │
│  │  Rooms   │  │  Loop    │  │  System  │  │  Loot / Death│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  Monster │  │  Physics │  │  Content │  │  Player      │ │
│  │  AI      │  │  / Collis│  │  Loader  │  │  Persistence │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│                        WebSocket (ws)                         │
└────────────────────────────┬──────────────────────────────────┘
                             │
┌────────────────────────────┴──────────────────────────────────┐
│                     CLIENT (Browser)                          │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  Input   │  │  Renderer│  │  Net     │  │  Inventory   │ │
│  │  Handler │  │  (Canvas)│  │  Sync    │  │  UI          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│  ┌──────────┐  ┌──────────────────────────────────────────┐  │
│  │  HUD /   │  │  Game State (mirrors server)             │  │
│  │  Minimap │  │                                          │  │
│  └──────────┘  └──────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Server Systems — Detail

| System | Responsibility |
|---|---|
| **Game Loop** | Fixed tick rate (e.g. 15-20/sec). Process inputs → AI → combat → physics → broadcast. |
| **Combat System** | Resolves attacks, applies damage, checks death. On death: invokes the death penalty system. |
| **Inventory / Loot / Death** | Manages player inventories, rolls loot tables on kills, applies `dropBehavior` rules on death, handles item pickup. All server-authoritative. |
| **Monster AI** | Reads `ai` keyword from entity definition, runs the matching behavior (chase, kite, guard, patrol). |
| **Physics / Collision** | Tile-based collision for walls, range checks for attacks, overlap checks for item pickup. |
| **Content Loader** | Reads all JSON from `content/` at startup. Serves content to clients on connect. |
| **Player Persistence** | Saves player inventory, stash, gold, and progress. (Start with JSON file, upgrade to DB later.) |

### Death Flow (Server)

```
Player health reaches 0
  │
  ├── For each item in equipment + backpack:
  │     ├── "lose_on_death"           → remove from inventory
  │     ├── "durability_loss_on_death" → reduce durability by N
  │     │     └── if durability ≤ 0   → destroy item
  │     ├── "drop_in_dungeon"         → place item entity at death location
  │     └── "soulbound"              → keep
  │
  ├── Send "you_died" event to client (shows death screen, item loss summary)
  │
  ├── Respawn player in town
  │
  └── Save updated inventory to persistence
```

---

## Networking Protocol

### Client → Server
```
{ "type": "move", "dir": "up" }
{ "type": "attack", "aim": 1.57 }
{ "type": "use_item", "slot": "backpack", "index": 0 }
{ "type": "pickup", "entityId": "item_drop_42" }
{ "type": "stash_deposit", "backpackIndex": 1 }
{ "type": "stash_withdraw", "stashIndex": 3 }
{ "type": "enter_dungeon", "dungeonId": "crypt_01" }
```

### Server → Client
```
{ "type": "state", "tick": 142, "players": [...], "monsters": [...], "items": [...] }
{ "type": "inventory_update", "inventory": { ... } }
{ "type": "loot_drop", "items": [...], "position": { "x": 15, "y": 10 } }
{ "type": "player_died", "playerId": "p1", "lostItems": ["Iron Sword"], "damagedItems": [{ "name": "Flamebrand", "durabilityLost": 20, "remaining": 25 }] }
{ "type": "damage_number", "target": "m3", "amount": 28, "type": "fire" }
```

---

## Rendering Strategy

### Phase 1 — Colored shapes
- Player = colored circle, monsters = red circles, items = yellow squares
- Walls = gray tiles, floor = dark tiles
- HUD: health bar, inventory grid of colored slots

### Phase 2 — Pixel art (16×16 tiles, scaled up)
- `ctx.imageSmoothingEnabled = false` for crisp retro pixels
- Sprite sheets for player (directional + walk cycle), monsters, items
- Tileset-based dungeon rendering

### Phase 3 — Juice
- Damage numbers floating up from targets
- Screen flash on hit, shake on death
- Item rarity glow effects (colored border: white/green/blue/purple/gold)
- Death screen with dramatic item loss summary
- Loot drop with "burst" particle effect

---

## Town — The Safe Hub

The town is a special non-combat map where players can:

| Feature | Function |
|---|---|
| **Stash** | Transfer items between backpack (at-risk) and stash (safe). The core strategic decision. |
| **Repair NPC** | Spend gold to restore item durability. |
| **Shop NPC** | Buy/sell basic items. Prices defined in content data. |
| **Dungeon entrance** | Choose which dungeon floor to enter. |
| **Other players** | See and chat with other players in town. Social hub. |

Town is defined as a regular map JSON with special tags (`"safe"`, `"no_monsters"`) so the engine treats it differently. A future editor can design the town layout like any other map.

---

## File / Folder Structure

```
project/
├── server/
│   ├── index.js              # Entry point, WebSocket setup
│   ├── game-loop.js          # Fixed-timestep update loop
│   ├── combat.js             # Attack resolution, damage, death
│   ├── death-penalty.js      # Item loss / durability logic
│   ├── inventory.js          # Inventory management, loot pickup
│   ├── loot.js               # Loot table roller
│   ├── monster-ai.js         # AI behaviors
│   ├── physics.js            # Movement, collision detection
│   ├── rooms.js              # Lobby / room management
│   ├── persistence.js        # Save/load player data
│   └── content-loader.js     # Reads JSON content at startup
│
├── client/
│   ├── index.html            # Canvas + UI shell
│   ├── main.js               # Entry point, connects to server
│   ├── renderer.js           # Canvas drawing (map, entities, effects)
│   ├── hud.js                # Health bar, inventory panel, minimap
│   ├── input.js              # Keyboard / mouse capture
│   ├── death-screen.js       # Death recap: what you lost
│   └── net.js                # WebSocket client
│
├── shared/
│   └── constants.js          # Tick rate, tile size, rarity tiers
│
├── content/                  # ALL game content — pure data
│   ├── dungeons/
│   │   ├── town.json
│   │   ├── crypt_01.json
│   │   └── crypt_02.json
│   ├── tilesets/
│   │   ├── town.json
│   │   ├── town.png
│   │   ├── crypt.json
│   │   └── crypt.png
│   ├── entities/
│   │   └── monsters.json
│   ├── items/
│   │   ├── weapons.json
│   │   ├── armor.json
│   │   └── consumables.json
│   └── loot/
│       └── tables.json
│
└── editor/                   # Future: visual editor
    └── (...)
```

---

## Future Editor — How It Plugs In

| Editor Feature | What It Produces | Key UX |
|---|---|---|
| **Dungeon painter** | `dungeons/*.json` | Paint tiles, place monster spawns, define rooms, tag them, wire exits between floors |
| **Item designer** | `items/*.json` | Form: name, stats, rarity, `dropBehavior` dropdown, durability settings, sprite upload |
| **Monster designer** | `entities/monsters.json` | Form: stats, AI behavior dropdown, loot table reference, sprite |
| **Loot table editor** | `loot/tables.json` | Drag items into a table, adjust weight sliders, set roll count |
| **Tileset manager** | `tilesets/*.json` | Upload sprite sheet, click tiles to set properties (solid, trap, door) |
| **Play test** | — | Click "Play" to load the current dungeon in the engine instantly |

---

## Suggested Build Order

| Phase | What to Build | Milestone |
|---|---|---|
| **1** | Server loop, WebSocket, canvas, player movement, tile map rendering | One player moving through a dungeon |
| **2** | Multiplayer sync, second player joins | Two players exploring together |
| **3** | Monsters (spawning, AI, melee) | Things to fight |
| **4** | Combat system (health, damage, death) | Players and monsters can die |
| **5** | Items, inventory, loot drops | Kill monster → loot drops → pick up → equip |
| **6** | **Death penalty system** | Die → lose items / durability damage → respawn in town |
| **7** | Town hub, stash, repair NPC, shop | Strategic inventory management before dungeon runs |
| **8** | Multiple dungeon floors, exits, progression | A real dungeon to crawl through |
| **9** | Pixel art, animation, visual polish | Looks like a real game |
| **10** | Visual dungeon editor | Non-coders can create content |
| **11** | Item / monster / loot table editors | Non-coders can design the full game |

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Server runtime | Node.js |
| WebSocket | `ws` library |
| Client rendering | HTML5 Canvas 2D |
| Content format | JSON files |
| Persistence | JSON files → SQLite/PostgreSQL later |
| Future editor | Web app (HTML/JS or React) |
