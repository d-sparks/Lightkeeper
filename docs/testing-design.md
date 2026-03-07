# Automated Content Testing — Design Document

> **STATUS: IMPLEMENTED.** Both the static content analyzer (`tools/content-validator.js`) and the headless game simulator (`tools/headless-sim.js`) are built and functional. See `tools/` directory. The `npm test` pipeline runs unit tests (Tiers 1-3: scripting, automation, physics), content validation, and headless simulation.

## 1. Overview & Goals

Lightkeeper is entirely data-driven: quests, dialogue, monster spawns, exits, and triggers are all defined in JSON under `content/`. This makes content the most likely source of bugs — broken references, unreachable rooms, impossible quests, soft locks. Manual testing catches obvious issues but can't exhaustively validate the combinatorial space of flags, items, and room transitions.

This document describes two complementary testing systems:

| System | What it does | Speed | Catches |
|--------|-------------|-------|---------|
| **Static Content Analyzer** | Validates JSON cross-references, builds dependency graphs, proves reachability | Instant (<1s) | Broken references, orphaned content, impossible conditions, unreachable rooms |
| **Headless Game Simulator** | Runs the real engine with a bot player, executing quests end-to-end | Fast (~seconds for full run at 1000x speed) | Soft locks, combat balance issues, timing bugs, quest progression failures |

**When to use each:**
- Static analyzer: every content change (CI hook, pre-commit, editor save)
- Headless simulator: before releases, after significant content additions, for balance tuning

---

## 2. Static Content Analyzer

**File:** `tools/content-validator.js`

A Node.js script that loads all content JSON and performs structural validation without running the game engine.

### 2.1 Cross-Reference Validation

Every ID reference in content must point to something that exists.

| Source | References | Target |
|--------|-----------|--------|
| Dungeon `monsterSpawns[].type` | Monster ID | `monsters.json` |
| Dungeon `npcSpawns[].type` | NPC ID | `npcs.json` |
| Dungeon `itemSpawns[].type` | Item ID | `items.json` |
| Dungeon `tileset` | Tileset ID | `tilesets/*.json` |
| Dungeon `exits[].leadsTo` | Dungeon ID | `dungeons/*.json` |
| NPC dialogue `conditions[].hasItem` | Item ID | `items.json` |
| Trigger `actions[].itemType` | Item ID | `items.json` |
| Quest `steps[].room` | Dungeon ID | `dungeons/*.json` |
| Sol unit `defaultGrid[].componentId` | Component ID | `sol_components.json` |
| Worldmap location `entryDungeon` | Dungeon ID | `dungeons/*.json` |
| Worldmap location `dungeons[]` | Dungeon ID | `dungeons/*.json` |

**Output:** List of broken references with file, field path, and the missing ID.

### 2.2 Exit Graph Validation

Build a directed graph of all dungeon exits and verify:

1. **Reachability from spawn:** Every dungeon is reachable from `outpost_entrance` (the spawn room defined in `settings.json`) by following exits. Flag any orphaned dungeons.
2. **Bidirectional consistency:** For every exit `A → B`, verify that `B` has a return exit to `A` (unless explicitly one-way, like the dayside shuttle from `train_station → dayside_solar_fields`).
3. **Exit tile validity:** Every exit's `(x, y)` tile position falls within the dungeon's `width × height` grid.
4. **Worldmap consistency:** Every dungeon listed in a worldmap location's `dungeons[]` array actually exists. Every dungeon's exits stay within its location or lead to a connected location.

### 2.3 Flag Dependency Analysis

Build a bipartite graph: flags that are **set** (by trigger actions) and flags that are **checked** (by trigger/NPC conditions).

**Validation rules:**
- Every flag checked in a condition must be settable by at least one trigger action somewhere
- Every flag set by a trigger should be checked somewhere (warning for unused flags — may indicate dead content)
- No circular dependencies where flag A requires flag B and flag B requires flag A with no entry point

**Flag sources to scan:**

| Where flags are set | Where flags are checked |
|--------------------|-----------------------|
| Trigger actions: `setFlag`, `incrementFlag` | Trigger conditions: `hasFlag`, `flagGreaterThan`, `flagLessThan` |
| NPC interaction triggers | NPC dialogue conditions |
| Quest step completion callbacks | Quest step `conditions` |

### 2.4 Item Flow Validation

For every item referenced in a quest step or NPC condition (`hasItem`):

1. Verify the item exists in `items.json`
2. Verify the item is obtainable — it must appear as:
   - A ground spawn in some dungeon's `itemSpawns[]`
   - A trigger action `giveItem` or `spawnItem`
   - A monster drop (if loot tables are implemented)
3. If the item is consumed by a `removeItem` action, verify it's obtainable *before* the consumption point in the quest's dependency chain

### 2.5 Quest Completability Proof

For each quest in `content/quests/`:

1. Load the quest's step sequence
2. For each step, verify:
   - The target room exists and is reachable from the previous step's room
   - The completion condition (flag or item) can be satisfied given the flags/items available at that point
   - Any prerequisite flags listed in the step's conditions are set by earlier steps or by pre-quest triggers
3. Flag any step where the completion condition cannot be traced to a reachable trigger

### 2.6 Output Format

```
=== Content Validation Report ===

ERRORS (must fix):
  [REF] dungeons/signal_cave.json: monsterSpawns[2].type "shadow_lurker_v2" not found in monsters.json
  [EXIT] dungeons/old_watchtower.json: exit to "watchtower_upper" — dungeon does not exist
  [FLAG] Flag "kade_intel_received" checked in relay_recovery.json step 1 but never set by any trigger
  [ITEM] Item "survey_marker_data" required by the_collector.json step 1 but not spawned in old_survey_point.json

WARNINGS (review):
  [FLAG] Flag "met_crafter_yun" is set in meridian_workshop.json but never checked anywhere
  [EXIT] Dungeon "proc_quarantine" has no return exit (procedural — may be intentional)

STATS:
  66 dungeons validated, 35 worldmap locations, 14 quests
  173 exits checked, 42 flags tracked, 28 quest items verified
  0 errors, 2 warnings
```

---

## 3. Headless Game Simulator

**File:** `tools/headless-sim.js`

The primary testing tool. Imports the real game engine modules and runs them in-process with a virtual player controlled by a bot brain.

### 3.1 Architecture

```
┌─────────────────────────────────────────────┐
│  headless-sim.js                            │
│                                             │
│  ┌──────────┐    ┌──────────────────────┐   │
│  │ Bot Brain│───▶│  Virtual Player      │   │
│  │ (AI)     │    │  (mock player obj)   │   │
│  └──────────┘    └──────────────────────┘   │
│       │                    │                │
│       │ goals/actions      │ state          │
│       ▼                    ▼                │
│  ┌──────────────────────────────────────┐   │
│  │         Game Engine (real)           │   │
│  │  game-loop.js + physics + scripting  │   │
│  └──────────────────────────────────────┘   │
│       │                                     │
│       ▼                                     │
│  ┌──────────┐    ┌──────────────────────┐   │
│  │ Stats    │    │  Content Loader      │   │
│  │ Collector│    │  (real, from JSON)   │   │
│  └──────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Key design decisions:**

1. **Import real engine modules directly.** `ContentLoader`, `GameLoop`, `Physics`, and the full scripting stack (`EventBus`, `FlagStore`, `ConditionEvaluator`, `ActionExecutor`, `TriggerRegistry`) are used as-is. No mocking of game logic.

2. **No WebSocket layer.** The simulator creates player objects directly via `gameLoop.addPlayer(roomId, playerId, name)` and drives input via `gameLoop.setPlayerInput(roomId, playerId, input)`. Actions like interact, attack, and ability use are called directly: `gameLoop.tryInteract()`, `gameLoop.tryAttack()`, `gameLoop.tryUseAbility()`.

3. **Synchronous tight loop.** Instead of `setInterval` at 66ms, the simulator calls `gameLoop.update(dt)` in a tight `for` loop with a fixed `dt = 1/15` (one tick = 66ms of game time). This means 1000 iterations = ~66 seconds of game time, executed in milliseconds of real time.

4. **Message capture.** The engine's `sendToPlayer` and `broadcastToRoom` callbacks are wired to a message log instead of WebSocket sends. The bot brain reads these messages to understand dialogue, quest updates, and events.

### 3.2 Engine Initialization

```javascript
// Pseudocode for the simulator harness
const ContentLoader = require('../server/content-loader');
const GameLoop = require('../server/game-loop');

const content = new ContentLoader('./content');
content.loadAll();

const gameLoop = new GameLoop(content);

// Override the message-sending functions to capture instead of transmit
gameLoop.sendToPlayer = (playerId, message) => {
  messageLog.push({ to: playerId, ...message });
};
gameLoop.broadcastToRoom = (roomId, message) => {
  messageLog.push({ room: roomId, ...message });
};

// Don't call gameLoop.start() — we drive the loop manually
```

### 3.3 Virtual Player

The virtual player is a real player object created by `gameLoop.addPlayer()`. It has the full state structure the engine expects:

```javascript
const player = gameLoop.addPlayer('outpost_entrance', 'bot_1', 'TestBot');
// player now has: x, y, health, maxHealth, inventory, equipment,
// solGrid, energy, abilities, cooldowns, questObjective, etc.
```

The bot manipulates this player exclusively through the engine's public API — never by modifying state directly. This ensures triggers fire, conditions evaluate, and the scripting system behaves identically to a real game session.

### 3.4 Bot Brain — Goal-Based Quest Runner

The bot operates on a **goal stack**. High-level quest goals decompose into mid-level navigation/interaction goals, which decompose into low-level input commands.

#### Goal Hierarchy

```
Quest Goal:    "Complete step 3 of main_quest (talk to engineer)"
  ├─ Nav Goal:   "Go to room outpost_workshop"
  │    ├─ Exit Route: outpost_entrance → outpost_workshop (1 hop)
  │    └─ Move Goal: "Walk to exit tile at (14, 2)"
  │         └─ Input: { right: true, up: true } (per tick, from A*)
  └─ Action Goal: "Interact with NPC sol_engineer"
       ├─ Move Goal: "Walk within 2.5 tiles of NPC position"
       └─ Input: tryInteract()
```

#### Quest Walkthrough Loading

Each quest in `content/quests/` defines its step sequence. The bot loads the quest definition and translates each step into goals:

```javascript
// From main_quest.json step structure:
// { "label": "Talk to the Engineer", "room": "outpost_workshop",
//   "conditions": [{ "hasFlag": "quest_cylinders_active" }] }

// Bot translates to:
goals.push({
  type: 'navigate_to_room',
  room: 'outpost_workshop'
});
goals.push({
  type: 'interact_with_npc',
  room: 'outpost_workshop',
  // Find which NPC sets the completion flag
  npcType: findNpcThatSetsFlag('quest_cylinders_active', 'outpost_workshop')
});
goals.push({
  type: 'wait_for_flag',
  flag: 'quest_cylinders_active'
});
```

#### NPC-to-Flag Resolution

Many quest steps complete when a specific flag is set. The bot needs to know *which NPC* (or action) sets that flag. This is resolved by scanning the target room's dungeon triggers:

1. Find triggers with `event: "npc_interacted"` in the target room
2. Check which trigger's actions include `setFlag` for the target flag
3. Extract the NPC type from the trigger's `filter.npcType`

This resolution is done at walkthrough load time, not runtime.

#### Pathfinding

**Intra-room (A\*):** Standard A* on the tile grid. The dungeon's `data[]` array provides the collision map (solid/non-solid via the tileset). Grid coordinates are `(tileX, tileY)`, movement in 8 directions. The bot converts the A* path to a sequence of input vectors.

```javascript
// A* produces: [(3,5), (4,5), (5,4), (5,3), ...]
// Each step becomes an input direction for one or more ticks:
//   (3,5) → (4,5): input = { right: true }
//   (4,5) → (5,4): input = { right: true, up: true }
```

The bot re-plans if it gets stuck (no position change for N ticks despite input).

**Inter-room (Exit Graph BFS):** The full exit graph is pre-computed at startup from all dungeon exits. To navigate from room A to room B, BFS finds the shortest path through intermediate rooms. Each hop requires:

1. A* pathfind to the exit tile in the current room
2. Stand on the exit tile to trigger floor transition
3. Wait for `transitionCooldown` to expire in the new room
4. Continue to next hop

### 3.5 Combat Behavior

When monsters are present in the room, the bot switches to combat mode:

1. **Target selection:** Nearest monster by Euclidean distance
2. **Ranged combat** (if equipped with projectile weapon):
   - Maintain distance of 4–6 tiles from target
   - Fire when `attackTimer <= 0` via `gameLoop.tryAttack()`
   - Kite: move perpendicular to monster's approach vector
3. **Melee combat** (if equipped with melee weapon):
   - Close to within `PLAYER_ATTACK_RANGE` (1.5 tiles)
   - Attack when `attackTimer <= 0`
4. **Ability usage:** Use abilities off cooldown when in combat range, via `gameLoop.tryUseAbility(slotIdx)`
5. **Healing:** Use medipac when health drops below 30% of `maxHealth`
6. **Death handling:** On player death, log the death event and respawn. Track death count for statistics.

Combat is secondary to quest progression — the bot only fights when monsters block its path or when a quest step requires killing enemies (e.g., main quest step 4: "Defeat the Warlord").

### 3.6 Interaction Protocol

The bot interacts with game objects using the engine's API:

| Action | Engine Call | When |
|--------|-----------|------|
| Talk to NPC | `gameLoop.tryInteract(roomId, playerId)` | Within `NPC_INTERACT_RANGE` (2.5 tiles) of target NPC |
| Pick up item | `gameLoop.tryInteract(roomId, playerId)` | Within `ITEM_PICKUP_RANGE` (1.8 tiles) of ground item |
| Open door | `gameLoop.tryInteract(roomId, playerId)` | Within `DOOR_INTERACT_RANGE` (1.8 tiles) of door tile |
| Equip item | `gameLoop.tryEquip(roomId, playerId, inventoryIndex)` | Item in inventory |
| Use item | `gameLoop.tryUseItem(roomId, playerId, inventoryIndex)` | Item in inventory |
| Make choice | `gameLoop.tryChoiceSelect(roomId, playerId, choiceIndex)` | When choice menu is shown |

The bot reads the captured message log to know when dialogue is shown, choices are presented, or quests update.

### 3.7 Fast Loop Execution

```javascript
const TICKS_PER_GAME_SECOND = 15;  // CONSTANTS.TICK_RATE
const DT = 1 / TICKS_PER_GAME_SECOND;  // ~0.0667s

function runSimulation(gameLoop, bot, maxGameSeconds) {
  const maxTicks = maxGameSeconds * TICKS_PER_GAME_SECOND;

  for (let tick = 0; tick < maxTicks; tick++) {
    // 1. Bot decides actions based on current state
    bot.think(gameLoop);

    // 2. Advance the engine one tick
    gameLoop.update(DT);

    // 3. Collect statistics
    stats.record(tick, gameLoop);

    // 4. Check if quest is complete
    if (bot.isQuestComplete()) break;

    // 5. Check for soft lock (no progress for N ticks)
    if (bot.isStuck(tick)) {
      stats.reportSoftLock(tick, bot.getCurrentGoal());
      break;
    }
  }
}
```

**Speed:** At 1000x realtime, 1000 ticks (66 game-seconds) execute in <100ms on modern hardware. A full main quest run (~15 minutes of game time = ~13,500 ticks) completes in roughly 1–2 seconds.

**Stuck detection:** If the bot's position, room, flags, and inventory haven't changed for 300 ticks (20 game-seconds), it's considered stuck. The current goal and game state are logged as a potential soft lock.

### 3.8 Run Modes

```
node tools/headless-sim.js --mainline          # Main quest only
node tools/headless-sim.js --all-quests        # Main + all side quests
node tools/headless-sim.js --quest=lost_tool   # Specific quest
node tools/headless-sim.js --explore           # Visit every room, talk to every NPC
node tools/headless-sim.js --all-quests --json # Output as JSON (for CI)
```

#### `--mainline`
Runs the 13-step main quest from spawn to Meridian arrival. Validates that the critical path is completable.

#### `--all-quests`
Runs mainline first (to unlock side quest prerequisites), then runs each side quest. Quests are ordered by dependency:

```
1. main_quest (mainline)
2. lost_supplies (requires: quest_cylinders_active — set in step 3)
3. relay_recovery (requires: kade_intel_received)
4. tannis_tags (requires: found_tannis_tags — item at perimeter_breach)
5. the_deserter (requires: fen_letter_accepted — hidden NPC in outpost_basement)
6. broken_signal (requires: arrived_meridian + comms_restored)
7. councillors_request (requires: arrived_meridian + asha_quest_accepted)
8. the_collector (requires: relay_log from relay_recovery)
9. array_access (requires: arrived_meridian)
10. lost_tool (requires: found_davi_wrench — item in meridian area)
```

#### `--quest=<id>`
Runs a single quest. If it has prerequisites, the bot first runs the minimum required quests to satisfy them (determined from the flag dependency graph).

#### `--explore`
Exhaustive coverage mode. The bot traverses the full exit graph, visiting every reachable dungeon. In each room:
- Walks to every NPC and interacts
- Walks to every ground item and picks up
- Walks to every interactable tile (doors, chests, levers)
- Notes any monsters present (kills them for access)

This mode is for discovery testing — finding content that's unreachable, NPCs that don't respond, or items that can't be picked up.

---

## 4. Side Quest Testing

Side quests are the hardest content to test because they require discovery — the player must find the quest before they can start it. Each discovery mechanism needs a specific testing strategy.

### 4.1 Discovery Mechanisms

#### A. NPC-Offer Quests (Most Common)

The player talks to an NPC who offers a quest. The `--all-quests` mode handles this by routing the bot to the quest-giving NPC after prerequisites are met.

**Quests using this mechanism:**
| Quest | NPC | Location | Prerequisite |
|-------|-----|----------|-------------|
| `lost_supplies` | Quartermaster Voss | outpost_munitions | `quest_cylinders_active` |
| `broken_signal` | Comms Officer Daley | outpost_comms | `arrived_meridian` + `comms_restored` |
| `councillors_request` | Councillor Asha Denn | meridian_civic | `arrived_meridian` |
| `the_collector` | Archivist Solen | meridian_archives | `relay_log` item |
| `array_access` | Liaison Thorne | meridian_civic | `arrived_meridian` |
| `relay_recovery` | Kade | (activation NPC) | `kade_intel_received` |

**Test approach:** Bot navigates to the NPC's room, pathfinds to the NPC, calls `tryInteract()`, and verifies the quest activation flag is set.

#### B. Found-Item Quests

The quest activates when the player picks up a specific item from the ground.

**Quests using this mechanism:**
| Quest | Item | Location | Discovery Flag |
|-------|------|----------|---------------|
| `lost_tool` | `calibration_wrench` | meridian_workshop area | `found_davi_wrench` |
| `tannis_tags` | `tannis_dog_tags` | perimeter_breach | `found_tannis_tags` |

**Test approach:** The `--explore` mode picks up every ground item. For targeted quest testing, the bot navigates to the item's spawn room, picks it up, and verifies the discovery flag is set. The bot then proceeds to the turn-in NPC.

#### C. Hidden/Exploration Quests

The quest NPC is in an optional area that players might not visit on the main path.

**Quests using this mechanism:**
| Quest | NPC | Location | How to Find |
|-------|-----|----------|-------------|
| `the_deserter` | Fen Maro | outpost_basement | Explore optional basement area |

**Test approach:** The `--explore` mode traverses every exit, including optional ones. For targeted testing, the bot follows the exit graph to the NPC's room.

#### D. Multi-Item Prerequisites

Some quests require the player to have collected specific items before the NPC will offer the quest.

**Example chain:**
```
Broken Signal quest:
  1. Find circuit_board (ground item somewhere in perimeter)
  2. Find backup_power_cell (ground item somewhere in perimeter)
  3. Bring both to Daley at outpost_comms → sets comms_restored
  4. Complete main quest through arrived_meridian
  5. Return to Daley → she gives coordinates (daley_gave_coordinates)
  6. NOW the quest activates
```

**Test approach:** The bot's quest walkthrough includes prerequisite item collection as sub-goals. The walkthrough definition for `broken_signal` would include steps for obtaining both prerequisite items before approaching Daley.

### 4.2 Dependency Ordering

Side quests with cross-dependencies must run in the correct order:

```
relay_recovery ──────────────────┐
  (produces relay_log item)      │
                                 ▼
                          the_collector
                    (requires relay_log to activate)
```

The test runner builds a dependency DAG from quest prerequisites and topologically sorts them. If a cycle is detected, it's reported as an error.

### 4.3 Coverage Report

After a full `--all-quests` or `--explore` run, the simulator produces a coverage matrix:

```
=== Side Quest Coverage ===

Quest               | Discovered | Activated | Completed | Method
--------------------|------------|-----------|-----------|--------
lost_supplies       | YES        | YES       | YES       | NPC-offer
broken_signal       | YES        | YES       | YES       | NPC-offer (complex prereqs)
relay_recovery      | YES        | YES       | YES       | NPC-offer
councillors_request | YES        | YES       | YES       | NPC-offer
lost_tool           | YES        | YES       | YES       | Found-item
tannis_tags         | YES        | YES       | YES       | Found-item
the_collector       | YES        | YES       | YES       | NPC-offer (relay_log dep)
the_deserter        | YES        | YES       | YES       | Hidden NPC
array_access        | YES        | YES       | YES       | NPC-offer

=== Coverage Gaps ===
  - Rooms never visited: (none)
  - NPCs never interacted: (none)
  - Items never picked up: (none)
  - Flags never set: met_crafter_yun (not quest-critical, cosmetic only)
```

---

## 5. Digest Output Format

The simulator produces two output formats: JSON (for CI/programmatic use) and human-readable summary (for terminal).

### 5.1 JSON Schema

```json
{
  "runMode": "all-quests",
  "timestamp": "2026-03-03T12:00:00Z",
  "totalGameTime": 892.4,
  "totalTicks": 13386,
  "realTimeMs": 1847,

  "quests": [
    {
      "questId": "main_quest",
      "status": "completed",
      "steps": [
        {
          "stepIndex": 0,
          "label": "Talk to Warden Holt",
          "completedAtTick": 145,
          "completedAtGameTime": 9.67,
          "room": "outpost_entrance"
        }
      ],
      "totalGameTime": 412.3,
      "deaths": 1,
      "monstersKilled": 23
    }
  ],

  "combat": {
    "totalMonstersKilled": 87,
    "byType": {
      "slime": 12,
      "shadow_lurker": 8,
      "quarantine_warlord": 1
    },
    "totalDamageDealt": 4520,
    "totalDamageTaken": 1890,
    "totalHealingUsed": 650,
    "deaths": 3,
    "deathLocations": [
      { "room": "proc_quarantine", "tick": 2340, "cause": "quarantine_warlord" }
    ]
  },

  "exploration": {
    "roomsVisited": 54,
    "totalRooms": 66,
    "coveragePercent": 81.8,
    "roomsNeverVisited": ["old_watchtower", "sigma_barracks"],
    "npcsInteracted": 18,
    "totalNpcs": 22,
    "itemsCollected": 31,
    "totalGroundItems": 35
  },

  "flags": {
    "timeline": [
      { "flag": "talked_to_warden", "tick": 145, "gameTime": 9.67, "room": "outpost_entrance", "trigger": "npc_warden_holt" },
      { "flag": "received_weapon", "tick": 310, "gameTime": 20.67, "room": "outpost_munitions", "trigger": "npc_quartermaster_voss" }
    ],
    "totalFlagsSet": 42,
    "unusedFlags": []
  },

  "softLocks": [],

  "sideQuests": {
    "discovered": 9,
    "total": 9,
    "missed": [],
    "discoveryDetails": [
      { "questId": "lost_tool", "mechanism": "found-item", "discoveredAtTick": 8900, "item": "calibration_wrench" },
      { "questId": "the_deserter", "mechanism": "exploration", "discoveredAtTick": 5600, "room": "outpost_basement" }
    ]
  }
}
```

### 5.2 Human-Readable Summary

```
═══════════════════════════════════════════
  LIGHTKEEPER CONTENT TEST — ALL QUESTS
  2026-03-03 12:00:00
═══════════════════════════════════════════

RESULT: PASS (all quests completed)

  Game time:  892.4s (14m 52s)
  Real time:  1.85s (483x speedup)
  Ticks:      13,386

── Quest Progression ──────────────────────

  main_quest .............. COMPLETE (412.3s, 1 death)
    Step 1/13: Talk to Warden Holt .......... 9.7s
    Step 2/13: Get a Weapon ................. 20.7s
    ...
    Step 13/13: Arrive Meridian City ........ 412.3s

  lost_supplies ........... COMPLETE (28.1s, 0 deaths)
  relay_recovery .......... COMPLETE (67.4s, 0 deaths)
  tannis_tags ............. COMPLETE (15.2s, 0 deaths)
  the_deserter ............ COMPLETE (89.7s, 0 deaths)
  broken_signal ........... COMPLETE (43.6s, 0 deaths)
  councillors_request ..... COMPLETE (52.1s, 0 deaths)
  the_collector ........... COMPLETE (38.9s, 0 deaths)
  array_access ............ COMPLETE (8.3s, 0 deaths)
  lost_tool ............... COMPLETE (12.0s, 0 deaths)

── Combat ─────────────────────────────────

  Monsters killed:  87 (slime: 12, shadow_lurker: 8, ...)
  Damage dealt:     4,520
  Damage taken:     1,890
  Healing used:     650
  Deaths:           3

── Exploration ────────────────────────────

  Rooms visited:  54/66 (81.8%)
  NPCs talked to: 18/22
  Items collected: 31/35

── Soft Locks ─────────────────────────────

  None detected.

═══════════════════════════════════════════
```

### 5.3 Failure Output

When a quest can't be completed, the report highlights the blocking point:

```
RESULT: FAIL (1 quest blocked)

  the_collector ........... BLOCKED at step 1
    Goal: Find Survey Marker Delta-7
    Room: old_survey_point
    Missing: Item "survey_marker_data" not present in room
    Bot state: At position (5, 8), inventory has 12 items
    Flags set: solen_quest_accepted, relay_log
    Possible cause: Item spawn missing from old_survey_point.json
```

---

## 6. Implementation Roadmap

### Phase 1: Static Content Validator
**Effort:** Small
**Files:** `tools/content-validator.js`

- Load all content JSON via `ContentLoader`
- Cross-reference validation (IDs exist)
- Exit graph reachability from spawn
- Flag set/check consistency
- Item obtainability check
- Run as: `node tools/content-validator.js`

This catches the most common content bugs immediately and requires no game engine integration.

### Phase 2: Headless Engine Harness
**Effort:** Medium
**Files:** `tools/headless-sim.js`

- Import `GameLoop`, `ContentLoader`, scripting modules
- Override `sendToPlayer`/`broadcastToRoom` with message capture
- Implement synchronous tight loop (`update(dt)` in a for-loop)
- Create virtual player via `addPlayer()`
- Verify: player spawns correctly, can set input, engine ticks without errors

### Phase 3: Bot Navigation
**Effort:** Medium
**Files:** `tools/headless-sim.js` (bot brain module)

- A* pathfinding on dungeon tile grids
- Pre-compute exit graph (BFS between all dungeon pairs)
- Implement goal: `navigate_to_room` (exit graph routing + A* per room)
- Implement goal: `move_to_position` (A* within current room)
- Stuck detection (no movement for N ticks → re-plan or report)

### Phase 4: Bot Combat & Interaction
**Effort:** Medium
**Files:** `tools/headless-sim.js` (bot brain module)

- Implement: `interact_with_npc`, `pick_up_item`, `open_door`
- Implement: combat targeting, attack, kiting, ability use, healing
- Implement: equip items, use consumables
- Implement: choice menu selection (for `showChoice` triggers)
- Implement: death handling and respawn

### Phase 5: Main Quest Walkthrough
**Effort:** Medium
**Files:** `tools/headless-sim.js`

- Quest walkthrough loader (reads `content/quests/*.json`)
- NPC-to-flag resolution (scan room triggers to find which NPC sets which flag)
- Goal decomposition (quest step → navigate + interact + wait_for_flag)
- Run the 13-step main quest end-to-end
- Statistics collection (ticks, deaths, flags, items)

### Phase 6: Side Quest Coverage
**Effort:** Medium
**Files:** `tools/headless-sim.js`

- Dependency DAG construction and topological sort
- Found-item quest handling (navigate to item spawn, pick up, verify discovery flag)
- Hidden NPC quest handling (navigate to NPC room via exit graph)
- Multi-prerequisite quest handling (collect required items before NPC interaction)
- Explore mode (exhaustive room/NPC/item coverage)
- Coverage reporting

### Phase 7: Digest Output & Reporting
**Effort:** Small
**Files:** `tools/headless-sim.js`

- JSON output schema (as defined in section 5.1)
- Human-readable terminal output (as defined in section 5.2)
- Failure diagnostics (blocking step, missing condition, bot state dump)
- CI integration (exit code 0 on pass, 1 on fail)

---

## Appendix A: Current Quest & Flag Reference

For quick reference during implementation, here are the actual quests, flags, and items in the current content.

### Main Quest Steps (main_quest.json)

| # | Label | Room | Completion Flag |
|---|-------|------|-----------------|
| 1 | Talk to Warden Holt | outpost_entrance | `talked_to_warden` |
| 2 | Get a Weapon | outpost_munitions | `received_weapon` |
| 3 | Talk to the Engineer | outpost_workshop | `quest_cylinders_active` |
| 4 | Defeat the Warlord | proc_quarantine (depth 3) | `supply_crate_key` (item) |
| 5 | Open the Supply Crate | proc_quarantine (depth 2) | `titanium_cylinders` (item) |
| 6 | Return to Engineer | outpost_workshop | `received_sol_unit` |
| 7 | Equip Damage Booster | (sol grid) | `damage_booster_equipped` |
| 8 | Complete Sol Training | outpost_training_range | `sol_training_complete` |
| 9 | Charge Sol Unit | outpost_charging_station | `sol_unit_charged` |
| 10 | Cross Dark Perimeter | station_approach | `reached_station_approach` |
| 11 | Get Transit Pass | train_station | `has_transit_pass` |
| 12 | Board Train | train_station | `boarded_train` |
| 13 | Arrive Meridian City | meridian_station | `arrived_meridian` |

### Side Quests

| Quest ID | Discovery | Prerequisite Flags | Key Items | Completion Flag |
|----------|-----------|-------------------|-----------|-----------------|
| `lost_supplies` | NPC (Voss) | `quest_cylinders_active` | `supply_manifest` | `voss_supply_quest_complete` |
| `broken_signal` | NPC (Daley) | `arrived_meridian`, `comms_restored` | `lightkeeper_journal` | `broken_signal_complete` |
| `relay_recovery` | NPC (Kade) | `kade_intel_received` | `relay_log` | `relay_recovery_complete` |
| `councillors_request` | NPC (Asha) | `arrived_meridian` | `biological_samples` | `asha_quest_complete` |
| `lost_tool` | Found item | `found_davi_wrench` | `calibration_wrench` | `davi_wrench_returned` |
| `tannis_tags` | Found item | `found_tannis_tags` | `tannis_dog_tags` | `returned_tannis_tags` |
| `the_collector` | NPC (Solen) | `relay_log` item | `survey_marker_data` | `solen_quest_complete` |
| `the_deserter` | Hidden NPC (Fen) | `fen_letter_accepted` | `fen_letter` | `fen_quest_complete` |
| `array_access` | NPC (Thorne) | `arrived_meridian` | — | `accepted_array_deal` or `declined_array_deal` |

### Key Prerequisite Items

| Item | Found In | Required For |
|------|----------|-------------|
| `circuit_board` | Perimeter area | `comms_restored` (→ broken_signal) |
| `backup_power_cell` | Perimeter area | `comms_restored` (→ broken_signal) |
| `relay_log` | relay_station | `the_collector` activation |
| `calibration_wrench` | Meridian area | `lost_tool` activation |
| `tannis_dog_tags` | perimeter_breach | `tannis_tags` activation |

### Dungeon Count by Region

| Region | Dungeons | Entry Point |
|--------|----------|-------------|
| Outpost Balor | 10 | `outpost_entrance` (spawn) |
| Perimeter | 5 | `outpost_perimeter` |
| Deep Perimeter | 8 | `dead_road` |
| Underlumen Nexus | 5 | `nexus_umbral_road` |
| Train System | 3 | `station_approach` |
| Meridian City | 12 | `meridian_station` |
| Greenway | 6 | `greenway_gate` |
| Lighthouse Sigma | 7 | `sigma_approach_road` |
| Dayside | 6 | `dayside_transit` |
| Procedural | 2 templates | `proc_quarantine` |
| **Total** | **66** | |
