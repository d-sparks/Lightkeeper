#!/usr/bin/env node
// Generator for outer_expanse dungeon (200x120 tiles)
// This dungeon leverages the fog-of-war streaming system (chunk size 16x16)
// Map is ~12.5 x 7.5 chunks — far larger than any existing dungeon

const fs = require('fs');
const path = require('path');

const W = 200, H = 120;
const FLOOR = 1, CRACKED = 2, WALL = 3, DOOR = 4, STAIRS_DOWN = 6, WATER = 7, STAIRS_UP = 8;

const data = new Array(W * H).fill(FLOOR);

function set(x, y, t) {
  if (x >= 0 && x < W && y >= 0 && y < H) data[y * W + x] = t;
}
function fillRect(x1, y1, x2, y2, t) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      set(x, y, t);
}
// Draw walls only on the perimeter of a rect; interior left untouched
function borderRect(x1, y1, x2, y2) {
  for (let x = x1; x <= x2; x++) { set(x, y1, WALL); set(x, y2, WALL); }
  for (let y = y1; y <= y2; y++) { set(x1, y, WALL); set(x2, y, WALL); }
}
// Horizontal wall segment with optional door opening
function hwall(x1, x2, y, ...doorXs) {
  for (let x = x1; x <= x2; x++) set(x, y, WALL);
  for (const dx of doorXs) set(dx, y, DOOR);
}
// Vertical wall segment with optional door opening
function vwall(y1, y2, x, ...doorYs) {
  for (let y = y1; y <= y2; y++) set(x, y, WALL);
  for (const dy of doorYs) set(x, dy, DOOR);
}

// ==================== OUTER BORDER ====================
borderRect(0, 0, W - 1, H - 1);

// ==================== ZONE 1: ENTRY CHECKPOINT (x:0–50) ====================
// Player arrives from deep_perimeter_east via west border
set(1, 60, STAIRS_UP);  // Entry stairs

// Guard post: two-room structure
borderRect(5, 54, 20, 66);
set(5, 60, DOOR);   // west entrance
set(20, 60, DOOR);  // east exit
vwall(54, 66, 12, 60);  // interior divider with door

// Northern observation post (ruin)
borderRect(8, 12, 18, 22);
set(13, 22, DOOR);  // south door

// Southern storage depot
borderRect(8, 88, 22, 100);
set(15, 88, DOOR);  // north door
set(22, 94, DOOR);  // east door

// Rocky ridge running north–south, broken in middle (natural terrain)
vwall(1, 40, 35, 18, 25, 32);   // north section with 3 gaps
vwall(42, 52, 35, 47);           // brief gap
vwall(54, 75, 35, 65, 70);      // south section

// Small ruin cluster x:25–32
borderRect(25, 30, 33, 40);
set(29, 40, DOOR);

borderRect(28, 72, 36, 80);
set(32, 72, DOOR);

// Debris scatter (cracked floors)
const debris1 = [[3,45],[4,55],[4,65],[6,35],[7,80],[22,42],[23,48],[31,20],[32,85]];
for (const [x,y] of debris1) set(x, y, CRACKED);

// Pond in SW entry corner
fillRect(5, 103, 22, 115, WATER);
fillRect(10, 107, 17, 112, FLOOR); // island

// ==================== ZONE 2: CENTRAL RUINS NORTH (x:51–110, y:1–58) ====================

// Building A – large two-storey ruin x:58–76, y:6–24
borderRect(58, 6, 76, 24);
set(67, 24, DOOR);   // south
set(58, 15, DOOR);   // west
hwall(58, 76, 15, 67); // interior floor divider

// Building B – comms tower footprint x:83–97, y:4–18
borderRect(83, 4, 97, 18);
set(90, 4, DOOR);    // north (toward border)
set(90, 18, DOOR);   // south
set(97, 11, DOOR);   // east

// Building C – barracks x:55–72, y:28–42
borderRect(55, 28, 72, 42);
set(63, 28, DOOR);   // north
set(63, 42, DOOR);   // south
set(72, 35, DOOR);   // east
vwall(28, 42, 63, 35); // interior divider

// Building D – command centre x:82–102, y:25–45
borderRect(82, 25, 102, 45);
set(92, 25, DOOR);   // north
set(92, 45, DOOR);   // south
set(82, 35, DOOR);   // west
set(102, 35, DOOR);  // east
// Interior: 4 rooms
hwall(82, 102, 35, 92);
vwall(25, 45, 92, 35);

// Small ruin x:60–68, y:48–54
borderRect(60, 48, 68, 54);
set(64, 48, DOOR);
set(68, 51, DOOR);

// Rocky ridges (east-west fractures in terrain)
hwall(51, 80, 55, 58, 65, 72);
hwall(51, 80, 48, 55, 62, 71);

// ==================== ZONE 2: CENTRAL RUINS SOUTH (x:51–110, y:62–118) ====================

// Building E – long hall x:56–78, y:70–84
borderRect(56, 70, 78, 84);
set(67, 70, DOOR);   // north
set(67, 84, DOOR);   // south
hwall(56, 78, 77, 67); // interior
vwall(70, 84, 67, 77);

// Building F – storage x:84–100, y:74–88
borderRect(84, 74, 100, 88);
set(92, 74, DOOR);   // north
set(100, 81, DOOR);  // east

// Building G – southern ruin cluster x:62–85, y:96–112
borderRect(62, 96, 85, 112);
set(73, 96, DOOR);   // north
set(85, 104, DOOR);  // east
hwall(62, 85, 104, 73); // interior

// Water feature: large pond centre of map
fillRect(89, 58, 110, 72, WATER);
fillRect(93, 62, 106, 68, FLOOR); // big island
set(99, 58, FLOOR);  // bridge north
set(99, 72, FLOOR);  // bridge south

// ==================== ZONE 3: FORTIFICATION CORRIDOR (x:111–155) ====================

// Northern defensive wall
hwall(111, 155, 30, 118, 128, 138, 148);
// Southern defensive wall
hwall(111, 155, 90, 118, 128, 138, 148);

// Canal along north wall interior
fillRect(111, 20, 155, 28, WATER);
for (const bx of [118, 128, 138, 148]) {
  for (let y = 20; y <= 28; y++) set(bx, y, FLOOR); // bridges
}

// Command bunker x:115–135, y:40–60
borderRect(115, 40, 135, 60);
set(125, 40, DOOR);  // north
set(125, 60, DOOR);  // south
set(115, 50, DOOR);  // west
set(135, 50, DOOR);  // east
hwall(115, 135, 50, 125);
vwall(40, 60, 125, 50);

// Supply depot x:140–152, y:44–58
borderRect(140, 44, 152, 58);
set(146, 44, DOOR);  // north
set(140, 51, DOOR);  // west
set(152, 51, DOOR);  // east

// Fortified gate structure x:140–155, y:64–78
borderRect(140, 64, 155, 78);
set(140, 71, DOOR);  // west
set(155, 71, DOOR);  // east
vwall(64, 78, 147, 71);

// Arms cache x:115–127, y:70–82
borderRect(115, 70, 127, 82);
set(121, 70, DOOR);  // north
set(127, 76, DOOR);  // east

// Scattered rubble
const debris2 = [[113,35],[114,42],[136,55],[153,35],[154,42],[153,87],[113,87],[124,92]];
for (const [x,y] of debris2) set(x, y, CRACKED);

// ==================== ZONE 4: EASTERN EXPANSE (x:156–199) ====================

// Watchtower ruin x:160–170, y:6–18
borderRect(160, 6, 170, 18);
set(165, 18, DOOR);

// Settlement cluster
// House A x:164–178, y:24–36
borderRect(164, 24, 178, 36);
set(171, 24, DOOR);
set(164, 30, DOOR);
set(178, 30, DOOR);

// House B x:160–173, y:42–54
borderRect(160, 42, 173, 54);
set(166, 54, DOOR);
set(173, 48, DOOR);

// House C x:178–192, y:44–58
borderRect(178, 44, 192, 58);
set(185, 44, DOOR);
set(178, 51, DOOR);
vwall(44, 58, 185, 51);

// Industrial complex x:162–190, y:64–82
borderRect(162, 64, 190, 82);
set(176, 64, DOOR);   // north
set(190, 73, DOOR);   // east
set(162, 73, DOOR);   // west
vwall(64, 82, 176, 73);

// Rocky ridgeline east
vwall(1, 45, 158, 18, 30);
vwall(48, 118, 158, 65, 90);

// Southern marsh / wetlands
fillRect(156, 88, 196, 115, WATER);
// Islands
fillRect(161, 93, 169, 101, FLOOR);
fillRect(174, 91, 182, 98, FLOOR);
fillRect(168, 104, 178, 113, FLOOR);
fillRect(184, 103, 192, 112, FLOOR);

// Deep relay terminal x:185–195, y:52–68
borderRect(185, 52, 195, 68);
set(185, 60, DOOR);   // west entrance
set(190, 52, DOOR);   // north

// Eastern exit stairs
set(198, 60, STAIRS_DOWN);

// ==================== SPAWN / ITEM / EXIT DATA ====================

const spawns = [
  { x: 3, y: 60, type: "player_start" },
  { x: 4, y: 60, type: "player_start" },
  { x: 3, y: 59, type: "player_start" },
  { x: 4, y: 59, type: "player_start" }
];

const monsterSpawns = [
  // --- Zone 1: Entry (lighter threats) ---
  { type: "dusk_crawler",      x: 28,  y: 20, count: 2, patrol: "wander" },
  { type: "feral_hound",       x: 22,  y: 75, count: 2, patrol: "wander" },
  { type: "shade_stalker",     x: 30,  y: 47, count: 1, patrol: "guard" },
  { type: "shadow_ambusher",   x: 16,  y: 56, count: 1, patrol: "guard" },

  // --- Zone 2 North: Central ruins (mid-tier) ---
  { type: "shade_stalker",     x: 65,  y: 15, count: 1, patrol: "guard" },
  { type: "gloom_wraith",      x: 90,  y: 11, count: 1, patrol: "patrol",
    patrolPath: [{x:84,y:5},{x:96,y:5},{x:96,y:17},{x:84,y:17}] },
  { type: "shade_stalker",     x: 60,  y: 35, count: 1, patrol: "guard" },
  { type: "shadow_ambusher",   x: 90,  y: 38, count: 1, patrol: "guard" },
  { type: "feral_hound",       x: 75,  y: 50, count: 3, patrol: "wander" },

  // --- Zone 2 South: Central ruins south ---
  { type: "shade_stalker",     x: 68,  y: 78, count: 1, patrol: "guard" },
  { type: "gloom_wraith",      x: 92,  y: 81, count: 1, patrol: "wander" },
  { type: "feral_hound",       x: 73,  y: 103, count: 2, patrol: "wander" },
  { type: "shadow_ambusher",   x: 95,  y: 65, count: 1, patrol: "guard" },

  // --- Zone 3: Fortification (tougher) ---
  { type: "rime_stalker",      x: 120, y: 36, count: 1, patrol: "guard" },
  { type: "rime_stalker",      x: 145, y: 86, count: 1, patrol: "guard" },
  { type: "shade_stalker_alpha", x: 125, y: 70, count: 1, patrol: "patrol",
    patrolPath: [{x:112,y:65},{x:138,y:65},{x:138,y:80},{x:112,y:80}] },
  { type: "frostfang_hunter",  x: 120, y: 15, count: 2, patrol: "wander" },
  { type: "tunnel_creeper",    x: 138, y: 88, count: 1, patrol: "patrol",
    patrolPath: [{x:113,y:86},{x:153,y:86},{x:153,y:94},{x:113,y:94}] },
  { type: "gloom_wraith",      x: 146, y: 50, count: 1, patrol: "guard" },

  // --- Zone 4 East: Ruins (hard) ---
  { type: "gloom_wraith",      x: 165, y: 12, count: 1, patrol: "patrol",
    patrolPath: [{x:161,y:5},{x:185,y:5},{x:185,y:20},{x:161,y:20}] },
  { type: "shade_stalker_alpha", x: 172, y: 30, count: 1, patrol: "guard" },
  { type: "rime_stalker",      x: 165, y: 48, count: 1, patrol: "guard" },
  { type: "shadow_ambusher",   x: 183, y: 50, count: 1, patrol: "guard" },
  { type: "shade_stalker",     x: 170, y: 72, count: 2, patrol: "wander" },
  { type: "frostfang_hunter",  x: 180, y: 70, count: 2, patrol: "wander" },

  // --- Zone 4 Deep (endgame difficulty) ---
  { type: "gloom_wraith",      x: 191, y: 55, count: 1, patrol: "guard" },
  { type: "shade_stalker_alpha", x: 192, y: 63, count: 1, patrol: "guard" }
];

const itemSpawns = [
  // Zone 1
  { type: "bandage",           x: 13, y: 17 },
  { type: "ration_pack",       x: 16, y: 93 },
  { type: "umbracite",         x: 7,  y: 40 },
  // Zone 2 North
  { type: "field_medkit",      x: 67, y: 10 },
  { type: "umbracite",         x: 95, y: 30 },
  { type: "umbracite",         x: 64, y: 34 },
  // Zone 2 South
  { type: "umbracite",         x: 88, y: 82 },
  { type: "signal_coordinates", x: 73, y: 103 },
  // Zone 3
  { type: "bandage",           x: 122, y: 48 },
  { type: "circuit_board",     x: 143, y: 52 },
  { type: "umbracite",         x: 118, y: 75 },
  { type: "field_medkit",      x: 145, y: 71 },
  // Zone 4
  { type: "field_medkit",      x: 165, y: 28 },
  { type: "umbracite",         x: 182, y: 53 },
  { type: "chitin_plate",      x: 170, y: 75 },
  // Deep
  { type: "resonance_fragment", x: 190, y: 60 },
  { type: "umbracite_shard",   x: 188, y: 57 }
];

const npcSpawns = [
  { type: "sable_nightside_guide", x: 125, y: 48 }
];

const exits = [
  {
    x: 1, y: 60,
    leadsTo: "deep_perimeter_east",
    type: "stairs_up",
    spawnX: 28, spawnY: 10
  },
  // Eastern exit loops back — no outgoing connection yet (exploration dead-end)
  // The east stairs tile (198, 60) is a placeholder for future expansion
];

const triggers = [
  {
    id: "outer_expanse_enter",
    event: "room_entered",
    actions: [
      { type: "setFlag", flag: "outer_expanse_entered" },
      { type: "showMessage", lines: [
        "The land opens — vast, broken, stretching beyond the edge of every perimeter map you have seen.",
        "Ruins of pre-Collapse infrastructure extend as far as visibility allows. Whatever this place was, it was abandoned fast."
      ]}
    ],
    once: true
  },
  {
    id: "outer_expanse_fortline",
    event: "room_entered",
    conditions: [
      { hasFlag: "outer_expanse_entered" },
      { not: { hasFlag: "outer_expanse_fort_seen" } }
    ],
    actions: [
      { type: "setFlag", flag: "outer_expanse_fort_seen" },
      { type: "showMessage", lines: [
        "A fortification line stretches across the terrain — remnants of a last-stand position.",
        "The structure is torn open. Some of the blast craters are decades old. Others are not."
      ]}
    ],
    once: true
  },
  {
    id: "outer_expanse_east_zone",
    event: "room_entered",
    conditions: [
      { not: { hasFlag: "outer_expanse_east_seen" } }
    ],
    actions: [
      { type: "setFlag", flag: "outer_expanse_east_seen" },
      { type: "showMessage", lines: [
        "The terrain grows quieter here — not safer, just emptier.",
        "The ruins are older. Pre-Collapse construction: standard prefab, nothing Nightside."
      ]}
    ],
    once: true
  },
  {
    id: "outer_expanse_relay_terminal",
    event: "room_entered",
    conditions: [
      { not: { hasFlag: "outer_expanse_relay_seen" } }
    ],
    actions: [
      { type: "setFlag", flag: "outer_expanse_relay_seen" },
      { type: "showMessage", lines: [
        "A relay terminal — hardware gutted, stripped for parts long ago.",
        "Scratched into the casing: signal coordinates. Same frequency as the Array broadcast band.",
        "This node was part of their network. Before whatever happened here."
      ]}
    ],
    once: true
  },
  {
    id: "outer_expanse_signal_coords",
    event: "item_picked_up",
    filter: { itemType: "signal_coordinates" },
    conditions: [
      { not: { hasFlag: "signal_coords_expanse_found" } }
    ],
    actions: [
      { type: "setFlag", flag: "signal_coords_expanse_found" },
      { type: "showMessage", lines: [
        "Signal coordinates on a corroded data chip. Active Array transmission frequency.",
        "These were left deliberately. Someone wanted them found."
      ]}
    ],
    once: true
  },
  {
    id: "outer_expanse_sable_encounter",
    event: "npc_interacted",
    filter: { npcType: "sable_nightside_guide" },
    conditions: [
      { hasFlag: "outer_expanse_entered" },
      { not: { hasFlag: "sable_expanse_met" } }
    ],
    actions: [
      { type: "setFlag", flag: "sable_expanse_met" },
      { type: "showMessage", lines: [
        "Sable: \"You made it this far. I mapped these ruins three years ago — never found the far end.\"",
        "\"There's a passage east of the relay terminal. I never had enough to push through. You might.\""
      ]}
    ],
    once: true
  }
];

const dungeon = {
  id: "outer_expanse",
  name: "The Outer Expanse",
  depth: 0,
  tileset: "outpost",
  theme: "dark_perimeter",
  tileSize: 32,
  ambientLight: 0.05,
  environmentalHazard: { type: "cold", damage: 1, interval: 4.0 },
  width: W,
  height: H,
  data,
  spawns,
  monsterSpawns,
  npcSpawns,
  itemSpawns,
  exits,
  triggers
};

// Validate
console.log(`Map size: ${W}x${H} = ${W*H} tiles (expected ${data.length})`);
console.log(`Chunks: ${Math.ceil(W/16)}x${Math.ceil(H/16)} = ${Math.ceil(W/16)*Math.ceil(H/16)}`);

const outPath = path.join(__dirname, '..', 'content', 'dungeons', 'outer_expanse.json');
fs.writeFileSync(outPath, JSON.stringify(dungeon, null, 2));
console.log(`Written to ${outPath}`);
