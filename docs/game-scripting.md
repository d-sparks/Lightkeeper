# Game Event Scripting System

The scripting system lets you create reactive game behaviors — dialogue that changes after events, doors that require keys, entities that appear or disappear — all through JSON data. No code changes needed.

## Architecture Overview

The system follows a **Trigger-Condition-Action (TCA)** pattern:

```
Event happens → Triggers with matching event are found
             → Conditions are checked against player/room state
             → If conditions pass, Actions are executed
```

### Core Components

| Component | File | Purpose |
|---|---|---|
| **Event Bus** | `server/scripting/event-bus.js` | Emits game events (item pickup, monster kill, etc.) |
| **Flag Store** | `server/scripting/flag-store.js` | Per-player and per-room key-value state |
| **Condition Evaluator** | `server/scripting/conditions.js` | Evaluates declarative conditions against game state |
| **Action Executor** | `server/scripting/actions.js` | Runs actions that modify game state |
| **Trigger Registry** | `server/scripting/trigger-registry.js` | Loads triggers from content JSON files |

All of these are wired into `game-loop.js` automatically.

---

## Quick Start: Three Common Patterns

### 1. Dialogue changes after an event

The Old Keeper says different things depending on what the player has done.

**In `content/entities/npcs.json`:**

```json
{
  "old_keeper": {
    "name": "Old Keeper",
    "dialogue": [
      { "speaker": "Old Keeper", "text": "Default line for backwards compatibility." }
    ],
    "dialogues": {
      "default": [
        { "speaker": "Old Keeper", "text": "Go find the iron key." }
      ],
      "has_key": [
        { "speaker": "Old Keeper", "text": "You found the key! Use it on the locked door." }
      ],
      "explored_deep": [
        { "speaker": "Old Keeper", "text": "You've been to the deep crypt. Impressive." }
      ]
    },
    "dialogueRules": [
      {
        "conditions": [{ "hasFlag": "visited_crypt_02" }],
        "use": "explored_deep"
      },
      {
        "conditions": [{ "hasItem": "iron_key" }],
        "use": "has_key"
      }
    ]
  }
}
```

**How it works:**
- `dialogues` is a map of named dialogue sets (arrays of `{ speaker, text }` lines)
- `dialogueRules` is evaluated top-to-bottom; the first rule whose conditions pass selects its dialogue set
- If no rules match, the `"default"` dialogue set is used
- The flat `dialogue` array is kept as a fallback for backward compatibility

### 2. Locked door that requires a key

**In `content/tilesets/crypt.json`:**

```json
{
  "9": {
    "name": "locked_door",
    "solid": true,
    "interactable": "door",
    "togglesTo": 5,
    "conditions": [{ "hasItem": "iron_key" }],
    "failMessage": "The door is locked. You need a key.",
    "onInteract": [{ "type": "removeItem", "itemType": "iron_key" }]
  }
}
```

**How it works:**
- `conditions` on a tile are checked when the player tries to interact
- If conditions fail, `failMessage` is shown to the player and the interaction is blocked
- If conditions pass, `onInteract` actions run (here: consume the key), then the door toggles normally
- Place tile ID `9` in a dungeon's `data` array to use this locked door

### 3. Destroy/spawn entities after an event

**In `content/dungeons/crypt_01.json`:**

```json
{
  "triggers": [
    {
      "id": "skeleton_clear_reward",
      "event": "monster_killed",
      "filter": { "monsterType": "skeleton" },
      "conditions": [
        { "hasFlag": "skeletons_killed", "value": 3 }
      ],
      "actions": [
        { "type": "showMessage", "text": "The last skeleton crumbles. The crypt grows quiet." },
        { "type": "spawnItem", "itemType": "health_potion", "x": 10, "y": 7 },
        { "type": "removeEntity", "entityType": "npc", "npcType": "old_keeper" }
      ]
    }
  ]
}
```

**How it works:**
- Dungeon-level triggers fire when events happen in that room
- `filter` narrows which events match (only skeleton kills here)
- `conditions` add further checks (only after 3 kills)
- `actions` run in order: show message, spawn a reward, remove an NPC

---

## Reference

### Events

Events are emitted automatically by the game loop. You don't create them — you react to them.

| Event | When it fires | Payload fields |
|---|---|---|
| `item_picked_up` | Player picks up a ground item | `itemType`, `itemName` |
| `monster_killed` | Player kills a monster | `monsterType`, `monsterId` |
| `npc_interacted` | Player talks to an NPC | `npcType`, `npcId` |
| `door_interacted` | Player opens/closes a door | `tileX`, `tileY`, `tileName` |
| `room_entered` | Player enters a room | `dungeonId` |
| `player_death` | Player dies | — |
| `flag_changed` | A flag was set/changed | `flag`, `value`, `scope` |

All events also include `playerId` and `roomId`.

### Conditions

Conditions are JSON objects that evaluate to true or false.

#### `hasFlag` — Check if a flag is set

```json
{ "hasFlag": "visited_crypt_02" }
```

Check if a flag equals a specific value:
```json
{ "hasFlag": "skeletons_killed", "value": 3 }
```

Check a room-scoped flag:
```json
{ "hasFlag": "boss_defeated", "scope": "room" }
```

#### `hasItem` — Check player inventory

```json
{ "hasItem": "iron_key" }
```

Returns true if the player has at least one item of this type.

#### `flagGreaterThan` / `flagLessThan` — Numeric comparisons

```json
{ "flagGreaterThan": { "flag": "kills", "value": 5 } }
{ "flagLessThan": { "flag": "health_potions_used", "value": 3 } }
```

#### `and` / `or` / `not` — Logical operators

```json
{ "and": [
  { "hasFlag": "talked_to_keeper" },
  { "hasItem": "iron_key" }
]}

{ "or": [
  { "hasItem": "iron_key" },
  { "hasItem": "master_key" }
]}

{ "not": { "hasFlag": "quest_complete" } }
```

You can nest these arbitrarily.

#### Implicit AND

An array of conditions at the top level is treated as an implicit AND:

```json
"conditions": [
  { "hasFlag": "talked_to_keeper" },
  { "hasItem": "iron_key" }
]
```

is equivalent to:

```json
"conditions": [{ "and": [
  { "hasFlag": "talked_to_keeper" },
  { "hasItem": "iron_key" }
]}]
```

### Actions

Actions modify game state when a trigger fires.

#### `setFlag` — Set a flag

```json
{ "type": "setFlag", "flag": "found_crystal", "value": true, "scope": "player" }
```

- `value` defaults to `true` if omitted
- `scope` defaults to `"player"` if omitted. Use `"room"` for room-scoped flags.

#### `removeFlag` — Remove a flag

```json
{ "type": "removeFlag", "flag": "temporary_buff" }
```

#### `incrementFlag` — Add to a numeric flag

```json
{ "type": "incrementFlag", "flag": "skeletons_killed", "amount": 1 }
```

- Creates the flag with the given `amount` if it doesn't exist (starts from 0)
- `amount` defaults to `1` if omitted

#### `setDialogue` — Change NPC dialogue

```json
{ "type": "setDialogue", "npc": "old_keeper", "dialogueId": "post_quest" }
```

Sets the active dialogue for all NPCs of this type in the current room. The `dialogueId` must match a key in the NPC's `dialogues` map.

Note: This overrides `dialogueRules` evaluation. Use this for trigger-driven changes; use `dialogueRules` for condition-based selection.

#### `removeEntity` — Remove an entity

```json
{ "type": "removeEntity", "entityType": "npc", "npcType": "old_keeper" }
{ "type": "removeEntity", "entityType": "monster", "entityId": "mob_3" }
{ "type": "removeEntity", "entityType": "item", "itemType": "torch" }
```

You can target by `entityId` (specific instance) or by type (first match is removed).

#### `spawnNpc` — Spawn an NPC at a tile position

```json
{ "type": "spawnNpc", "npcType": "outpost_warden", "x": 4, "y": 10 }
```

Spawns an NPC of the given type at the specified tile coordinates. If an NPC of that type already exists in the room, the action is skipped (no duplicates).

#### `spawnItem` — Spawn a ground item

```json
{ "type": "spawnItem", "itemType": "health_potion", "x": 10, "y": 7 }
```

Coordinates are in tile units.

#### `giveItem` — Add to player inventory

```json
{ "type": "giveItem", "itemType": "iron_key" }
```

#### `rollLootTable` — Roll from a loot table and spawn the result

```json
{ "type": "rollLootTable", "lootTable": "frost_biome_common", "x": 5, "y": 3 }
```

Picks a random item from the named loot table (weighted selection, ignores `dropChance`) and spawns it as a ground item. Coordinates are in tile units. If `x`/`y` are omitted, falls back to the `door_interacted` event's tile position, then the player's position.

#### `removeItem` — Remove from player inventory

```json
{ "type": "removeItem", "itemType": "iron_key" }
```

Removes the first matching item.

#### `showMessage` — Display text to the player

```json
{ "type": "showMessage", "text": "You hear a rumbling sound from the east." }
```

Shown as a dialogue popup.

#### `toggleTile` — Toggle a tile remotely

```json
{ "type": "toggleTile", "x": 15, "y": 8 }
```

Toggles a tile using its `togglesTo` property (e.g., open a distant door when a lever is pulled).

### Triggers

Triggers tie events to conditions and actions.

```json
{
  "id": "unique_trigger_name",
  "event": "item_picked_up",
  "filter": { "itemType": "crystal_shard" },
  "conditions": [{ "hasFlag": "some_flag" }],
  "actions": [{ "type": "setFlag", "flag": "found_crystal" }],
  "once": true
}
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes (if `once` is true) | Unique identifier for the trigger |
| `event` | Yes | Which event type to listen for |
| `filter` | No | Object whose keys must match the event payload |
| `conditions` | No | Array of conditions that must all pass |
| `actions` | Yes | Array of actions to execute |
| `once` | No | If `true`, only fires once per player |

#### Where triggers are defined

**Dungeon triggers** — in `content/dungeons/{id}.json` under `"triggers"`:
```json
{
  "id": "crypt_01",
  "triggers": [ ... ]
}
```

**NPC dialogue rules** — in `content/entities/npcs.json` under each NPC's `"dialogueRules"`:
```json
{
  "old_keeper": {
    "dialogueRules": [ ... ]
  }
}
```

**Tile interaction conditions** — in `content/tilesets/{id}.json` on individual tiles:
```json
{
  "9": {
    "conditions": [ ... ],
    "onInteract": [ ... ]
  }
}
```

---

## Flag Scopes

Flags are the memory of the scripting system. They store what has happened.

| Scope | Persists across rooms? | Shared between players? | Use for |
|---|---|---|---|
| `player` (default) | Yes | No | Quest progress, personal achievements, inventory-like state |
| `room` | No (cleared when room is destroyed) | Yes | Room puzzles, shared state (e.g., "boss defeated") |

Player flags persist for the lifetime of the player's connection. Room flags persist for the lifetime of the room instance.

---

## Evaluation Order

1. An event fires (e.g., `item_picked_up`)
2. All triggers in the current room with matching `event` are checked
3. For each trigger:
   a. `filter` is matched against the event payload
   b. `once` check — skip if already fired for this player
   c. `conditions` are evaluated against current player/room state
   d. If all pass, `actions` are executed in order
4. Actions from one trigger do **not** cascade within the same event (fire-and-forget). If an action sets a flag, triggers listening for `flag_changed` will fire on the next event, not immediately.

---

## Editor API

The content editor provides API endpoints for managing triggers.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/editor/dungeons/:id/triggers` | Get all triggers for a dungeon |
| `PUT` | `/api/editor/dungeons/:id/triggers` | Replace all triggers for a dungeon |
| `GET` | `/api/editor/scripting/events` | List all event types, condition types, and action types |

The scripting events endpoint returns a complete reference of available events, conditions, and actions with descriptions — useful for building editor UI.

---

## Quests

Quest files live in `content/quests/`. Each quest has steps arranged as a DAG with prerequisites, completion conditions, and objectives.

### Side Quests with `startConditions`

Quests without `startConditions` activate immediately when a player joins (e.g., the main quest). To create a side quest that activates later, add a `startConditions` array:

```json
{
  "id": "lost_supplies",
  "name": "Lost Supplies",
  "startConditions": [{ "hasFlag": "voss_supply_quest_accepted" }],
  "steps": { ... },
  "startStep": "find_manifest"
}
```

The quest remains hidden from the player's quest log until its `startConditions` are met. When they are, the `startStep` activates and the player sees a "New Quest" toast notification.

**Pattern for side quests:**
1. Define a quest JSON with `startConditions` that check a flag
2. Add a dungeon trigger that sets that flag (e.g., on NPC interaction)
3. The trigger fires → flag is set → quest activates → player gets notified

See `content/quests/lost_supplies.json` for a working example.

---

## Examples in the Codebase

The following content files contain working examples you can study and modify:

- **`content/entities/npcs.json`** — Old Keeper has conditional dialogue (`dialogueRules` + `dialogues`)
- **`content/tilesets/crypt.json`** — Tile 9 is a locked door requiring `iron_key`
- **`content/dungeons/crypt_01.json`** — Triggers: iron key pickup message, skeleton kill counter, kill-all reward
- **`content/dungeons/crypt_02.json`** — Trigger: sets `visited_crypt_02` flag on room entry
- **`content/quests/lost_supplies.json`** — Side quest with `startConditions`, activated by NPC trigger
- **`content/dungeons/outpost_munitions.json`** — Triggers for side quest acceptance and completion

---

## Design Decisions & Tips

**Why declarative JSON instead of a scripting language (Lua, etc.)?**
The entire content pipeline is JSON. Keeping scripts as JSON means the content editor can present them as form fields and dropdowns rather than a code editor. It also eliminates an entire class of runtime errors.

**When to use `dialogueRules` vs `setDialogue` action:**
- Use `dialogueRules` when dialogue should react to current state (e.g., "if player has key, say X"). The rules are evaluated each time the player talks to the NPC.
- Use `setDialogue` action when a trigger should permanently change dialogue (e.g., "after quest is complete, switch to thank-you dialogue"). This overrides rules.

**When to use `once: true`:**
Use it for one-time events like "first time picking up a key" or "entering a room for the first time". The `once` flag is tracked per-player, so each player gets it once.

**Counting things:**
Use `incrementFlag` to count events (kills, pickups, visits), then use `hasFlag` with a specific `value` to trigger on a threshold. See the skeleton kill counter example in `crypt_01.json`.

**Debugging flags:**
Player and room flags are stored in `gameLoop.flagStore`. During development, you can inspect them via the server console or add a debug endpoint.
