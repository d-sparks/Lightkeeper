# Automation Screen — Implementation Plan

The automation UI is a **top-down 2D grid placement screen** opened by interacting with MERIDIAN-7. The player places structures on a grid that maps directly to the `dayside_solar_fields` dungeon floor — so when they later visit the solar fields in person, they walk through the infrastructure they've built.

---

## Design Goals

- **Feel awesome.** Placing structures should have satisfying visual/audio feedback. The grid should feel like a command console — you're a frontier engineer directing drones across a superheated desert from a safe terminal.
- **Dual-reality.** The automation grid IS the dayside map. Structures placed in the UI become tiles/entities on the dungeon floor. One source of truth, two views.
- **Introspection.** Players see production stats, resource flow, and a global progress bar that tracks their automation empire at a glance.

---

## 1. Automation Grid (Core UI)

### Grid View

The automation screen replaces the current auto-panel list UI with a **top-down square grid** rendered as a CSS grid (same pattern as the sol grid UI in `renderSolGrid()`).

**Grid properties:**
- **Size:** Matches the buildable area of `dayside_solar_fields` — a subsection of the 30×30 dungeon. Start with a **12×12 buildable zone** (the inner area, excluding walls and the entry corridor). This can expand as the player progresses.
- **Cell size:** 40px per cell (smaller than sol grid's 80px, since we need more cells visible).
- **View:** Non-isometric, top-down, flat. No perspective transform. Clean and readable.
- **Appearance:** Dark background with a subtle grid overlay. Cells glow faintly with dayside amber tones. Placed structures are bright, empty cells are dim.

**Grid coordinate mapping:**
- The automation grid coordinates map to specific tile positions in `dayside_solar_fields.json`. For example, automation grid (0,0) maps to dungeon tile (5,5), giving an offset so the buildable area avoids walls and the existing structures.
- A mapping table in `structures.json` or a new `content/automation/grid_config.json` defines the offset and bounds.

### Structure Placement

When the player has resources to build a structure:
1. They select a structure type from a **build palette** at the bottom of the grid (styled like the sol grid component inventory).
2. Empty buildable cells highlight with a placement indicator (crosshair cursor, subtle glow).
3. Clicking an empty cell places the structure. The server validates placement (cost, max count, not occupied).
4. On success: a **placement animation** plays — a brief flash/pulse effect on the cell. The structure appears with its icon/color.
5. On failure: the cell flashes red briefly.

**Placement rules:**
- One structure per cell.
- Some cells are pre-occupied (existing solar panel arrays from the dungeon's tile 7 positions — these show as "Array infrastructure" and aren't player-owned).
- Walls (tile 3) and buildings (tile 3/4 groups) are blocked.
- The entry corridor (bottom rows near the exit) stays clear.

### Structure Visuals on Grid

Each structure type has a distinct visual on the grid:

| Structure | Grid Cell Appearance | Color |
|-----------|---------------------|-------|
| Solar Panel | `◻` bordered square with sun rays icon | Amber/gold (#ffa726) |
| Silicon Harvester | `⛏` pickaxe icon or gear icon | Silver/blue (#90caf9) |
| (Future) Border Charger | `⚡` lightning bolt | Electric blue (#4fc3f7) |
| (Future) Relay Node | `◎` concentric circles | Green (#66bb6a) |
| Array Infrastructure | `■` solid square (pre-existing, not player-built) | Dim gray (#555) |

### Cell Interaction

- **Hover:** Shows structure info tooltip (name, production rate, status).
- **Click empty cell (with structure selected):** Place structure.
- **Click placed structure:** Shows detail panel with stats (production since placed, etc.). Could allow removal in the future.
- **Click Array infrastructure:** Shows flavor text ("Array solar collector. Output: classified.").

---

## 2. Automation State Changes

### Server: `automation.js` Updates

The automation state needs to track **grid positions** for each placed structure, not just counts.

**Current state shape:**
```js
{
  resources: { silicon: 0 },
  structures: { solar_panel: 2 },  // just counts
  productionTimers: { solar_panel: 0 },
}
```

**New state shape:**
```js
{
  resources: { silicon: 0 },
  structures: {
    solar_panel: { count: 2, placements: [{ x: 3, y: 5 }, { x: 7, y: 2 }] },
    silicon_harvester: { count: 1, placements: [{ x: 4, y: 8 }] },
  },
  productionTimers: { silicon_harvester: 0 },
  stats: {
    totalSiliconProduced: 0,
    totalSiliconSpent: 0,
    totalEnergyGenerated: 0,
  },
}
```

**Changes to `build()`:**
- Accept `gridX, gridY` parameters in addition to `structureId`.
- Validate that the cell isn't already occupied by any structure.
- Store placement position.
- Deduct cost only after validation.

**Changes to `getStateForClient()`:**
- Include `placements` array for each structure.
- Include `stats` for the introspection panel.
- Include grid configuration (size, offset, blocked cells).

### Network Protocol

**`AUTO_BUILD` message update:**
```js
// Client -> Server
{ type: 'auto_build', structureId: 'solar_panel', gridX: 3, gridY: 5 }

// Server -> Client (AUTO_STATE) now includes:
{
  auto: {
    resources: { silicon: 12 },
    structures: [...],
    grid: {
      width: 12, height: 12,
      offsetX: 5, offsetY: 5,       // mapping to dungeon tiles
      blocked: [{ x: 0, y: 0 }, ...], // cells that can't be built on
      placements: [                  // all player-placed structures
        { structureId: 'solar_panel', x: 3, y: 5 },
        { structureId: 'silicon_harvester', x: 4, y: 8 },
      ],
    },
    stats: {
      totalSiliconProduced: 47,
      siliconPerMinute: 3.0,
      energyRegenPerSecond: 0.3,
      automationLevel: 2,       // derived from total structures
      automationProgress: 0.35, // progress toward next level (0-1)
    },
    trades: [...],
  }
}
```

### Content: Grid Configuration

Add to `content/entities/structures.json` or create `content/automation/grid_config.json`:

```json
{
  "gridWidth": 12,
  "gridHeight": 12,
  "dungeonOffsetX": 9,
  "dungeonOffsetY": 3,
  "dungeonId": "dayside_solar_fields",
  "blockedCells": [
    // Cells occupied by walls, buildings, or Array infrastructure
    // Derived from the dungeon tile data — any cell where the tile is not floor (1) or sand (2)
  ],
  "preBuilt": [
    // Existing Array infrastructure visible on the grid but not player-owned
    { "x": 0, "y": 1, "label": "Array Solar Collector" },
    { "x": 1, "y": 1, "label": "Array Solar Collector" }
  ]
}
```

**How blocked cells are computed:** At startup, `content-loader.js` reads the dungeon tile data for `dayside_solar_fields` and marks any cell within the grid bounds whose corresponding dungeon tile is wall (3), building, or door (4) as blocked. Tile 7 (existing solar panels) shows as Array infrastructure. Tile 1 (floor) and 2 (sand/feature) are buildable.

---

## 3. Introspection Panel

A stats sidebar (or top bar) visible whenever the automation screen is open.

### Resource Display

```
┌─────────────────────────────────┐
│  ⛏ Silicon: 47                  │
│  ▸ +3.0 / min (2 harvesters)   │
│  ▸ 142 total harvested          │
│                                 │
│  ⚡ Energy Regen: +0.3/s        │
│  ▸ 3 solar panels active        │
└─────────────────────────────────┘
```

**Data shown:**
- Current silicon count (already sent via AUTO_STATE).
- Silicon production rate per minute (calculated from harvester count × production rate).
- Total silicon ever produced (new `stats.totalSiliconProduced` field).
- Energy regeneration rate per second from solar panels.
- Structure counts.

### Global Progress Bar

A horizontal progress bar at the top of the automation screen.

**Automation Level system:**
- Level 1: 0 structures → first structure placed
- Level 2: 3 total structures
- Level 3: 6 total structures
- Level 4: 10 total structures (approaching max with current structure types)
- Level 5: 15+ structures (requires new structure types added later)

The progress bar fills toward the next level. Each level has a label:

| Level | Name | Threshold |
|-------|------|-----------|
| 1 | Outpost | 1 structure |
| 2 | Depot | 3 structures |
| 3 | Array Node | 6 structures |
| 4 | Solar Complex | 10 structures |
| 5 | Array Sector | 15 structures |

**Visual:** A glowing amber bar that fills left-to-right. The current level name is displayed above it. When a level is reached, the bar resets and the level name updates (with a brief celebration animation — flash/pulse).

```
┌──────────────────────────────────┐
│  ARRAY NODE ▸▸▸▸▸▸▸▸▸▸▸▸▸░░░░  │
│  Level 3 — 6/10 to Solar Complex │
└──────────────────────────────────┘
```

---

## 4. Dungeon Sync (Walk Through Your Infrastructure)

The key feature: structures placed via the automation grid appear as real tiles/entities when the player visits `dayside_solar_fields`.

### Implementation Approach

**Option A (Recommended): Dynamic tile overlay**

When a player enters `dayside_solar_fields`, the server reads their automation placements and injects additional tile data or entity spawns into the room state sent to the client.

- Each placed `solar_panel` becomes a tile 7 (solar panel tile) at the mapped dungeon position.
- Each placed `silicon_harvester` becomes a simple NPC-like entity (non-interactive, visual only) at the mapped position — a small drone sprite that bobs in place.
- The existing dungeon floor data stays static. Player structures are overlaid on top at room-join time.
- This keeps content/engine separation clean — the dungeon JSON defines the base layout, and automation state adds player structures dynamically.

**Server changes in `game-loop.js`:**
- When sending `MAP` data for `dayside_solar_fields`, merge the player's automation placements into the tile grid.
- Convert automation grid coordinates to dungeon tile coordinates using the offset.
- For entity-type structures (harvesters), spawn visual-only entities at the mapped positions.

**Client rendering:**
- No special client changes needed — the modified tile/entity data is just rendered normally by `renderer.js`.
- Harvesters could have a small animation (sprite bobbing or rotation) to make them feel alive.

### Multiplayer Consideration

Each player has their own automation state, so whose structures appear when multiple players are in `dayside_solar_fields`?

**Approach:** Each player sees their own structures. The tile overlay is per-player, not shared. The server sends different tile overlays to different players in the same room. This is already supported by the per-player state model in `automation.js`.

---

## 5. Opening the Automation Screen

Per the TODOs, the automation UI should NOT be a menu tab. It opens by interacting with MERIDIAN-7.

### Flow

1. Player walks up to MERIDIAN-7 NPC at the train station (or solar terminal).
2. Player presses interact.
3. Instead of (or in addition to) dialogue, the server sends a message that tells the client to open the automation screen.
4. The automation screen is a **full-screen overlay** (like the existing menu/dialogue system) showing the grid, stats, build palette, and progress bar.
5. Player can close it with Escape or a close button.

### Implementation

**New message type:** `AUTO_SCREEN` (or reuse `AUTO_STATE` with a flag indicating "open the UI").

Alternatively, the automation screen opens client-side when the player receives an `AUTO_STATE` message while near MERIDIAN-7 — triggered by an NPC interaction. The existing `npc_interacted` trigger system can fire a new action `openAutomationScreen` that sends the full automation state.

**Scripting approach (preferred — data-driven):**
- Add a new action type `openAutomation` to the scripting system.
- MERIDIAN-7's dialogue trigger fires `openAutomation` as an action.
- The server sends `AUTO_STATE` with a field `{ openScreen: true }`.
- The client checks `openScreen` and opens the automation overlay.

---

## 6. UI Layout (Full Screen)

```
┌──────────────────────────────────────────────────────────────────┐
│  SOLAR ARRAY COMMAND          [X Close]                          │
│  ═══════════════════════════════════════                         │
│  ARRAY NODE ▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸░░░░░░░                          │
│  Level 3 — 6/10 to Solar Complex                                │
├──────────────────────────────────────────┬───────────────────────┤
│                                          │  RESOURCES            │
│    ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐ │  ⛏ Silicon: 47       │
│    │  │  │  │  │  │  │  │  │  │  │  │  │ │  ▸ +3.0/min          │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │  ▸ 142 total         │
│    │  │☀│☀│  │  │  │  │  │  │  │  │  │ │                       │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │  ⚡ Energy: +0.3/s   │
│    │  │  │  │  │⛏│  │  │  │  │  │  │  │ │  ▸ 3 panels active   │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │                       │
│    │  │  │  │  │  │  │  │  │☀│  │  │  │ │  PRODUCTION           │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │  ▸ Silicon/hr: 180   │
│    │  │  │  │  │  │  │  │  │  │  │  │  │ │  ▸ Energy gen: 1080/h │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │                       │
│    │  │  │  │  │  │  │  │  │  │  │  │  │ │───────────────────────│
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │  MERIDIAN-7 TRADES   │
│    │  │  │  │  │  │  │  │  │  │  │  │  │ │  ▸ Damage Booster  5⛏│
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │  ▸ Med Supplies   10⛏│
│    │  │  │  │  │  │  │  │  │  │  │  │  │ │                       │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │                       │
│    │  │  │  │  │  │  │  │  │  │  │  │  │ │                       │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤ │                       │
│    │  │  │  │  │  │  │  │  │  │  │  │  │ │                       │
│    └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘ │                       │
│                                          │                       │
│  BUILD: [☀ Solar Panel (3⛏)] [⛏ Harvester (5⛏)]                │
│  Click grid to place selected structure                          │
└──────────────────────────────────────────┴───────────────────────┘
```

---

## 7. Implementation Steps

### Phase 1: Server-Side Grid State (Engine)

1. **Update `automation.js`** state shape to track placements with `{ x, y }` coordinates, not just counts. Migration path: if a player has old-format state (just counts), convert to new format with placements at arbitrary open positions.
2. **Update `build()`** to accept and validate `gridX, gridY`. Check cell isn't occupied, check it's within grid bounds, check it's not a blocked cell.
3. **Add grid config** to `content-loader.js`: read `dayside_solar_fields.json` tile data and compute which cells are buildable (floor/sand tiles within the grid bounds).
4. **Update `getStateForClient()`** to include grid data: width, height, blocked cells, placements, and stats.
5. **Add tracking stats:** `totalSiliconProduced`, `siliconPerMinute`, `energyRegenPerSecond`.
6. **Update `AUTO_BUILD` handler** in `index.js` to pass grid coordinates to `automation.build()`.

### Phase 2: Client UI (Engine)

7. **Replace `renderAutoTab()`** in `client/main.js` with full automation screen renderer.
8. **Build the grid** as a CSS grid (following `renderSolGrid()` patterns). 12×12 cells, 40px each.
9. **Build palette** at the bottom — list of available structures with costs and affordability styling.
10. **Structure selection + placement flow** — click palette to select, click grid cell to place, send `AUTO_BUILD` with coordinates.
11. **Resource/stats sidebar** — render current resources, production rates, totals.
12. **Progress bar** — horizontal bar with level name, progress fill, and threshold display.
13. **Placement animations** — CSS transitions for cell glow on placement.

### Phase 3: Automation Screen Access (Engine + Content)

14. **Add `openAutomation` scripting action** to `server/scripting/actions.js`.
15. **Add MERIDIAN-7 interaction trigger** that opens the automation screen (fire `openAutomation` action on `npc_interacted` for meridian_7).
16. **Client handler** for `AUTO_STATE` with `openScreen: true` — open full-screen automation overlay.
17. **Remove** the auto tab from the menu (or keep it as a read-only summary).

### Phase 4: Dungeon Sync (Engine)

18. **Modify MAP data sending** in `game-loop.js` — when a player enters `dayside_solar_fields`, merge their automation placements into the tile data before sending.
19. **Grid-to-dungeon coordinate conversion** — use the offset from grid config.
20. **Visual-only harvester entities** — spawn non-interactive entity markers at harvester positions when player enters the room.

### Phase 5: Polish

21. **Tooltip system** — hover/click on placed structures for detail panel.
22. **Sound effects** — placement confirmation sound, level-up sound.
23. **Mobile/touch support** — tap to select, tap to place (same as sol grid).
24. **Controller support** — d-pad navigation of grid cells, A to place, B to cancel.

---

## 8. Content Additions

### `structures.json` Updates

Add visual metadata to each structure for the grid UI:

```json
{
  "solar_panel": {
    "name": "Solar Panel",
    "description": "Generates passive sol energy recharge. +1 energy per panel every 10s on the dayside.",
    "cost": { "silicon": 3 },
    "maxCount": 5,
    "gridIcon": "☀",
    "gridColor": "#ffa726",
    "effect": { ... }
  },
  "silicon_harvester": {
    "name": "Silicon Harvester",
    "description": "Automated drone that harvests silicon. Produces 1 silicon every 60 seconds.",
    "cost": { "silicon": 5 },
    "maxCount": 3,
    "gridIcon": "⛏",
    "gridColor": "#90caf9",
    "effect": { ... }
  }
}
```

### Automation Levels

Add to `content/automation/levels.json` (or inline in `structures.json`):

```json
{
  "levels": [
    { "name": "Outpost", "threshold": 1 },
    { "name": "Depot", "threshold": 3 },
    { "name": "Array Node", "threshold": 6 },
    { "name": "Solar Complex", "threshold": 10 },
    { "name": "Array Sector", "threshold": 15 }
  ]
}
```

---

## 9. Future Expansion Hooks

These aren't part of the initial implementation but the design accommodates them:

- **New structure types** — just add to `structures.json` with grid icon/color. The grid UI auto-discovers them from the build palette.
- **Grid expansion** — increase the buildable area as the player progresses (server sends updated grid bounds). Could be gated by automation level.
- **Structure upgrades** — click a placed structure to upgrade it (tier 2 solar panel, faster harvester). Add upgrade paths to structure definitions.
- **Adjacency bonuses** — structures next to each other could boost production (mirroring the sol grid adjacency system). Solar panels near harvesters could boost collection rate.
- **Co-op building** — multiplayer parties could pool structures on a shared grid. Would require shared automation state (vs current per-player).
- **Array trade routes** — visual lines on the grid showing resource flow between structures.

---

## 10. Summary

| Component | Layer | Files Modified |
|-----------|-------|---------------|
| Grid state tracking | Engine | `server/automation.js` |
| Grid config from dungeon data | Engine | `server/content-loader.js` |
| Build with coordinates | Engine | `server/index.js` |
| Full-screen grid UI | Engine | `client/main.js` |
| Grid + stats CSS | Engine | `client/index.html` (inline styles or style block) |
| Structure grid visuals | Content | `content/entities/structures.json` |
| Automation levels | Content | `content/entities/structures.json` or new file |
| MERIDIAN-7 opens automation | Content | dungeon trigger JSON |
| `openAutomation` action | Engine | `server/scripting/actions.js` |
| Dungeon tile sync | Engine | `server/game-loop.js` |
| Grid config data | Content | `content/automation/grid_config.json` (or computed) |
