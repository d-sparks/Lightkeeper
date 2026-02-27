#!/usr/bin/env node
// ============================================================================
// PLACEHOLDER SPRITE GENERATOR
// ============================================================================
// Generates simple but recognizable 16x16 pixel art sprites using pngjs.
// All generated sprites are PLACEHOLDERS — see PLACEHOLDER_ASSETS.md.
// They must be replaced with properly licensed or original art before release.
// ============================================================================

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

// ---- Color helpers ----

function rgba(r, g, b, a = 255) {
  return { r, g, b, a };
}

function hex(hexStr) {
  const h = hexStr.replace('#', '');
  return rgba(
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  );
}

const C = {
  transparent: rgba(0, 0, 0, 0),
  black:       rgba(0, 0, 0),
  darkGray:    rgba(40, 40, 50),
  gray:        rgba(90, 90, 110),
  lightGray:   rgba(140, 140, 160),
  white:       rgba(220, 220, 230),
  brown:       rgba(140, 100, 60),
  darkBrown:   rgba(90, 65, 40),
  red:         rgba(200, 50, 50),
  darkRed:     rgba(140, 30, 30),
  blue:        rgba(60, 120, 200),
  darkBlue:    rgba(30, 60, 120),
  teal:        rgba(50, 170, 150),
  darkTeal:    rgba(30, 100, 90),
  purple:      rgba(130, 60, 170),
  darkPurple:  rgba(80, 35, 110),
  green:       rgba(70, 160, 70),
  orange:      rgba(220, 150, 50),
  yellow:      rgba(240, 220, 80),
  bone:        rgba(200, 190, 170),
  darkBone:    rgba(150, 140, 120),
  skin:        rgba(200, 160, 120),
  darkSkin:    rgba(150, 110, 80),
  floorDark:   rgba(35, 35, 55),
  floorMid:    rgba(45, 45, 65),
  floorLight:  rgba(55, 55, 75),
  wallDark:    rgba(70, 70, 100),
  wallMid:     rgba(90, 90, 122),
  wallLight:   rgba(110, 110, 140),
  wallTop:     rgba(120, 120, 150),
  water1:      rgba(30, 60, 100),
  water2:      rgba(40, 75, 120),
  water3:      rgba(50, 90, 140),
  voidColor:   rgba(10, 10, 20),
};

// ---- PNG creation helpers ----

function createPNG(w, h) {
  const png = new PNG({ width: w, height: h, filterType: -1 });
  // Fill with transparent
  for (let i = 0; i < w * h * 4; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }
  return png;
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = color.a;
}

function fillRect(png, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(png, x + dx, y + dy, color);
    }
  }
}

// Draw from a 2D array of color references (null = transparent)
function drawPixelArt(png, offsetX, offsetY, rows) {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const c = rows[y][x];
      if (c) setPixel(png, offsetX + x, offsetY + y, c);
    }
  }
}

function savePNG(png, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filePath, buffer);
  console.log(`  wrote ${filePath}`);
}

// ---- Shorthand aliases for pixel art ----
const _ = null;             // transparent
const K = C.black;
const W = C.white;
const G = C.gray;
const D = C.darkGray;
const B = C.bone;
const b = C.darkBone;
const R = C.red;
const r = C.darkRed;
const S = C.skin;
const s = C.darkSkin;
const N = C.brown;
const n = C.darkBrown;
const T = C.teal;
const t = C.darkTeal;
const P = C.purple;
const p = C.darkPurple;

// ============================================================================
// TILESET: Crypt (10 tiles in a horizontal strip: 160x16)
// Tile order by ID: 0=void, 1=stone_floor, 2=cracked_floor, 3=stone_wall,
//   4=door_closed, 5=door_open, 6=stairs_down, 7=water, 8=stairs_up, 9=locked_door
// ============================================================================

function generateCryptTileset() {
  const png = createPNG(160, 16);

  // --- Tile 0: Void (near-black with subtle noise) ---
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = 8 + ((x * 7 + y * 13) % 5);
      setPixel(png, x, y, rgba(v, v, Math.floor(v * 1.3)));
    }
  }

  // --- Tile 1: Stone Floor (dark flagstones with mortar lines) ---
  const ox1 = 16;
  fillRect(png, ox1, 0, 16, 16, C.floorMid);
  // Mortar lines (horizontal at y=7, vertical at x=7)
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox1 + i, 7, C.floorDark);
    setPixel(png, ox1 + 7, i, C.floorDark);
  }
  // Highlight edges
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox1 + i, 0, C.floorLight);
    setPixel(png, ox1, i, C.floorLight);
    setPixel(png, ox1 + 8 + i, 8, C.floorLight);
    setPixel(png, ox1 + 8, 8 + i, C.floorLight);
  }
  // Scattered detail pixels
  setPixel(png, ox1 + 3, 3, C.floorLight);
  setPixel(png, ox1 + 11, 12, C.floorLight);
  setPixel(png, ox1 + 5, 10, C.floorDark);
  setPixel(png, ox1 + 13, 4, C.floorDark);

  // --- Tile 2: Cracked Floor (similar to stone but with crack line) ---
  const ox2 = 32;
  fillRect(png, ox2, 0, 16, 16, C.floorMid);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox2 + i, 7, C.floorDark);
    setPixel(png, ox2 + 7, i, C.floorDark);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox2 + i, 0, C.floorLight);
    setPixel(png, ox2, i, C.floorLight);
  }
  // Crack: diagonal line
  const crackPixels = [[3,2],[4,3],[4,4],[5,5],[6,6],[5,7],[6,8],[7,9],[8,10],[9,11],[10,11],[11,12],[12,13]];
  for (const [cx, cy] of crackPixels) {
    setPixel(png, ox2 + cx, cy, C.darkGray);
  }

  // --- Tile 3: Stone Wall (plain stone, no brick pattern — sci-fi aesthetic) ---
  const ox3 = 48;
  // Solid base
  fillRect(png, ox3, 0, 16, 16, C.wallMid);
  // Top edge highlight
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 0, C.wallTop);
  // Bottom and right edge shadow for depth
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 15, C.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + 15, i, C.wallDark);
  // Subtle stone grain: scattered light/dark pixels (organic, not grid-aligned)
  const stoneLight = [[2,2],[3,4],[7,2],[10,3],[13,5],[5,7],[9,6],[1,9],[6,11],[11,8],[3,13],[8,13]];
  const stoneDark  = [[5,3],[1,5],[8,4],[11,6],[4,8],[7,10],[2,11],[10,9],[13,12],[6,14],[9,12],[12,2]];
  for (const [sx, sy] of stoneLight) setPixel(png, ox3 + sx, sy, C.wallLight);
  for (const [sx, sy] of stoneDark)  setPixel(png, ox3 + sx, sy, C.wallDark);

  // --- Tile 4: Door Closed (wooden planks with iron bands) ---
  const ox4 = 64;
  fillRect(png, ox4, 0, 16, 16, C.brown);
  // Darker edges
  fillRect(png, ox4, 0, 1, 16, C.darkBrown);
  fillRect(png, ox4 + 15, 0, 1, 16, C.darkBrown);
  // Iron bands (horizontal dark stripes)
  fillRect(png, ox4, 3, 16, 2, C.gray);
  fillRect(png, ox4, 11, 16, 2, C.gray);
  // Planks (vertical lines)
  for (let vy = 0; vy < 16; vy++) {
    setPixel(png, ox4 + 5, vy, C.darkBrown);
    setPixel(png, ox4 + 10, vy, C.darkBrown);
  }
  // Door handle
  setPixel(png, ox4 + 12, 7, C.lightGray);
  setPixel(png, ox4 + 12, 8, C.lightGray);

  // --- Tile 5: Door Open (recessed dark opening with frame) ---
  const ox5 = 80;
  fillRect(png, ox5, 0, 16, 16, C.floorDark);
  // Frame on left and right
  fillRect(png, ox5, 0, 2, 16, C.darkBrown);
  fillRect(png, ox5 + 14, 0, 2, 16, C.darkBrown);
  // Slightly lighter center
  fillRect(png, ox5 + 4, 2, 8, 12, rgba(25, 25, 40));

  // --- Tile 6: Stairs Down (floor with descending steps pattern) ---
  const ox6 = 96;
  fillRect(png, ox6, 0, 16, 16, C.floorMid);
  // Steps getting darker toward bottom
  fillRect(png, ox6 + 2, 2, 12, 3, C.floorLight);
  fillRect(png, ox6 + 3, 5, 10, 3, C.floorMid);
  fillRect(png, ox6 + 4, 8, 8, 3, C.floorDark);
  fillRect(png, ox6 + 5, 11, 6, 3, rgba(20, 20, 35));
  // Down arrow
  setPixel(png, ox6 + 7, 13, C.purple);
  setPixel(png, ox6 + 8, 13, C.purple);
  setPixel(png, ox6 + 6, 12, C.purple);
  setPixel(png, ox6 + 9, 12, C.purple);

  // --- Tile 7: Water (dark blue with wavey highlights) ---
  const ox7 = 112;
  fillRect(png, ox7, 0, 16, 16, C.water1);
  // Wave highlights
  const wavePixels = [[2,3],[3,3],[4,3],[8,5],[9,5],[10,5],[1,9],[2,9],[3,9],[7,11],[8,11],[9,11],[12,7],[13,7],[4,14],[5,14]];
  for (const [wx, wy] of wavePixels) {
    setPixel(png, ox7 + wx, wy, C.water2);
  }
  const waveHighPixels = [[3,2],[9,4],[2,8],[8,10],[13,6],[5,13]];
  for (const [wx, wy] of waveHighPixels) {
    setPixel(png, ox7 + wx, wy, C.water3);
  }

  // --- Tile 8: Stairs Up (floor with ascending steps pattern) ---
  const ox8 = 128;
  fillRect(png, ox8, 0, 16, 16, C.floorMid);
  // Steps getting lighter toward top
  fillRect(png, ox8 + 5, 2, 6, 3, rgba(20, 20, 35));
  fillRect(png, ox8 + 4, 5, 8, 3, C.floorDark);
  fillRect(png, ox8 + 3, 8, 10, 3, C.floorMid);
  fillRect(png, ox8 + 2, 11, 12, 3, C.floorLight);
  // Up arrow
  setPixel(png, ox8 + 7, 1, C.teal);
  setPixel(png, ox8 + 8, 1, C.teal);
  setPixel(png, ox8 + 6, 2, C.teal);
  setPixel(png, ox8 + 9, 2, C.teal);

  // --- Tile 9: Locked Door (like closed door but with lock symbol) ---
  const ox9 = 144;
  fillRect(png, ox9, 0, 16, 16, C.brown);
  fillRect(png, ox9, 0, 1, 16, C.darkBrown);
  fillRect(png, ox9 + 15, 0, 1, 16, C.darkBrown);
  fillRect(png, ox9, 3, 16, 2, C.gray);
  fillRect(png, ox9, 11, 16, 2, C.gray);
  for (let vy = 0; vy < 16; vy++) {
    setPixel(png, ox9 + 5, vy, C.darkBrown);
    setPixel(png, ox9 + 10, vy, C.darkBrown);
  }
  // Lock symbol (yellow rectangle with keyhole)
  fillRect(png, ox9 + 6, 6, 4, 4, C.yellow);
  setPixel(png, ox9 + 7, 7, C.darkGray);
  setPixel(png, ox9 + 8, 7, C.darkGray);
  setPixel(png, ox9 + 7, 8, C.darkGray);

  savePNG(png, path.join(CONTENT_DIR, 'tilesets', 'crypt.png'));
}

// ============================================================================
// MONSTER SPRITES (16x16 each)
// ============================================================================

function generateMonsterSprites() {
  // --- Skeleton: white bones on dark, humanoid shape ---
  const skeleton = createPNG(16, 16);
  drawPixelArt(skeleton, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],  // 0
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],  // 1
    [_, _, _, _, _, B, B, B, B, B, B, _, _, _, _, _],  // 2
    [_, _, _, _, _, B, K, B, B, K, B, _, _, _, _, _],  // 3  eyes
    [_, _, _, _, _, B, B, b, b, B, B, _, _, _, _, _],  // 4  jaw
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],  // 5
    [_, _, _, _, _, _, _, B, B, _, _, _, _, _, _, _],  // 6  neck
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],  // 7  shoulders
    [_, _, _, B, _, _, _, B, B, _, _, _, B, _, _, _],  // 8  arms
    [_, _, _, B, _, _, _, B, B, _, _, _, B, _, _, _],  // 9
    [_, _, _, b, _, _, _, B, B, _, _, _, b, _, _, _],  // 10
    [_, _, _, _, _, _, _, B, B, _, _, _, _, _, _, _],  // 11 spine
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],  // 12 pelvis
    [_, _, _, _, _, _, B, _, _, B, _, _, _, _, _, _],  // 13 legs
    [_, _, _, _, _, _, B, _, _, B, _, _, _, _, _, _],  // 14
    [_, _, _, _, _, B, B, _, _, B, B, _, _, _, _, _],  // 15 feet
  ]);
  savePNG(skeleton, path.join(CONTENT_DIR, 'sprites', 'skeleton.png'));

  // --- Skeleton Archer: skeleton with a bow ---
  const archer = createPNG(16, 16);
  drawPixelArt(archer, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],
    [_, _, _, _, _, B, B, B, B, B, B, _, _, _, _, _],
    [_, _, _, _, _, B, K, B, B, K, B, _, _, _, _, _],
    [_, _, _, _, _, B, B, b, b, B, B, _, _, _, _, _],
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, B, B, _, _, _, _, _, _, _],
    [_, _, n, B, B, B, B, B, B, B, B, B, _, _, _, _],  // bow in left hand
    [_, _, n, B, _, _, _, B, B, _, _, _, _, _, _, _],
    [_, _, n, _, _, _, _, B, B, _, _, _, _, _, _, _],
    [_, _, n, _, _, _, _, B, B, _, _, _, _, _, _, _],
    [_, _, n, _, _, _, _, B, B, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],
    [_, _, _, _, _, _, B, _, _, B, _, _, _, _, _, _],
    [_, _, _, _, _, _, B, _, _, B, _, _, _, _, _, _],
    [_, _, _, _, _, B, B, _, _, B, B, _, _, _, _, _],
  ]);
  savePNG(archer, path.join(CONTENT_DIR, 'sprites', 'skeleton_archer.png'));

  // --- Luddite Brawler: burly humanoid, dark clothes, no tech ---
  const brawler = createPNG(16, 16);
  const Br = rgba(100, 70, 50);  // brown clothing
  const Bd = rgba(70, 50, 35);   // dark clothing
  drawPixelArt(brawler, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
    [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
    [_, _, _, _, _, S, K, S, S, K, S, _, _, _, _, _],
    [_, _, _, _, _, S, S, s, s, S, S, _, _, _, _, _],
    [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Br,Br, _, _, _, _, _, _, _],
    [_, _, _, S,Br,Br,Br,Br,Br,Br,Br,Br, S, _, _, _],
    [_, _, _, S, _,Br,Br,Br,Br,Br,Br, _, S, _, _, _],
    [_, _, _, S, _, _,Br,Br,Br,Br, _, _, S, _, _, _],
    [_, _, _, s, _, _,Br,Br,Br,Br, _, _, s, _, _, _],
    [_, _, _, _, _, _,Bd,Br,Br,Bd, _, _, _, _, _, _],
    [_, _, _, _, _, _,Bd,Bd,Bd,Bd, _, _, _, _, _, _],
    [_, _, _, _, _, _,Bd, _,  _,Bd, _, _, _, _, _, _],
    [_, _, _, _, _, _,Bd, _,  _,Bd, _, _, _, _, _, _],
    [_, _, _, _, _, N,Bd, _,  _,Bd, N, _, _, _, _, _],
  ]);
  savePNG(brawler, path.join(CONTENT_DIR, 'sprites', 'luddite_brawler.png'));

  // --- Luddite Scrapper: thinner, hooded, ranged ---
  const scrapper = createPNG(16, 16);
  const Hd = rgba(60, 55, 50);  // hood color
  const Hk = rgba(45, 40, 35);  // dark hood
  drawPixelArt(scrapper, 0, 0, [
    [_, _, _, _, _, _,Hd,Hd,Hd,Hd, _, _, _, _, _, _],
    [_, _, _, _, _,Hd,Hd,Hd,Hd,Hd,Hd, _, _, _, _, _],
    [_, _, _, _, _,Hd,Hd,Hd,Hd,Hd,Hd, _, _, _, _, _],
    [_, _, _, _, _,Hd, K,Hk,Hk, K,Hd, _, _, _, _, _],
    [_, _, _, _, _, _,Hk,Hk,Hk,Hk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Hd,Hd,Hd,Hd, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Hd,Hd, _, _, _, _, _, _, _],
    [_, _, _, S,Hd,Hd,Hd,Hd,Hd,Hd,Hd,Hd, S, _, _, _],
    [_, _, _, _, _,Hd,Hd,Hd,Hd,Hd,Hd, _, _, _, _, _],
    [_, _, _, _, _,Hd,Hd,Hd,Hd,Hd,Hd, _, _, _, _, _],
    [_, _, _, _, _, _,Hd,Hd,Hd,Hd, _, _, _, _, _, _],
    [_, _, _, _, _, _,Hd,Hd,Hd,Hd, _, _, _, _, _, _],
    [_, _, _, _, _, _,Hk,Hd,Hd,Hk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Hk, _, _,Hk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Hk, _, _,Hk, _, _, _, _, _, _],
    [_, _, _, _, _,Hk,Hk, _, _,Hk,Hk, _, _, _, _, _],
  ]);
  savePNG(scrapper, path.join(CONTENT_DIR, 'sprites', 'luddite_scrapper.png'));

  // --- Luddite Warlord: bigger, armored, menacing (boss) ---
  const warlord = createPNG(16, 16);
  const Ar = rgba(80, 80, 95);   // armor
  const Ad = rgba(55, 55, 70);   // dark armor
  const Rr = rgba(180, 40, 40);  // red accent
  drawPixelArt(warlord, 0, 0, [
    [_, _, _, _, _,Rr,Ar,Ar,Ar,Ar,Rr, _, _, _, _, _],
    [_, _, _, _, _,Ar,Ar,Ar,Ar,Ar,Ar, _, _, _, _, _],
    [_, _, _, _, _,Ar, K,Ar,Ar, K,Ar, _, _, _, _, _],
    [_, _, _, _, _,Ar,Rr,Ad,Ad,Rr,Ar, _, _, _, _, _],
    [_, _, _, _, _, _,Ar,Ar,Ar,Ar, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Ar,Ar, _, _, _, _, _, _, _],
    [_, _,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar, _, _],
    [_, _,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar,Ar, _, _],
    [_, _, S,Ad, _,Ar,Ar,Ar,Ar,Ar,Ar, _,Ad, S, _, _],
    [_, _, S, _, _,Ad,Ar,Ar,Ar,Ar,Ad, _, _, S, _, _],
    [_, _, _, _, _,Ad,Ar,Ar,Ar,Ar,Ad, _, _, _, _, _],
    [_, _, _, _, _,Ad,Ad,Ar,Ar,Ad,Ad, _, _, _, _, _],
    [_, _, _, _, _,Ad,Ad,Ad,Ad,Ad,Ad, _, _, _, _, _],
    [_, _, _, _, _,Ad, _, _, _, _,Ad, _, _, _, _, _],
    [_, _, _, _, _,Ad, _, _, _, _,Ad, _, _, _, _, _],
    [_, _, _, _,Ad,Ad, _, _, _, _,Ad,Ad, _, _, _, _],
  ]);
  savePNG(warlord, path.join(CONTENT_DIR, 'sprites', 'luddite_warlord.png'));
}

// ============================================================================
// PLAYER SPRITES (16x16, 4 color variants)
// ============================================================================

function generatePlayerSprites() {
  const playerColors = [
    { name: 'blue',   body: rgba(60, 150, 220),  dark: rgba(40, 100, 160)  },
    { name: 'red',    body: rgba(220, 70, 70),    dark: rgba(160, 45, 45)   },
    { name: 'green',  body: rgba(80, 170, 80),    dark: rgba(50, 120, 50)   },
    { name: 'orange', body: rgba(220, 150, 60),   dark: rgba(170, 110, 40)  },
  ];

  for (const pc of playerColors) {
    const png = createPNG(16, 16);
    const M = pc.body;
    const m = pc.dark;
    drawPixelArt(png, 0, 0, [
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
      [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
      [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
      [_, _, _, _, _, S, W, S, S, W, S, _, _, _, _, _],
      [_, _, _, _, _, S, S, s, s, S, S, _, _, _, _, _],
      [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, M, M, _, _, _, _, _, _, _],
      [_, _, _, S, M, M, M, M, M, M, M, M, S, _, _, _],
      [_, _, _, _, _, M, M, M, M, M, M, _, _, _, _, _],
      [_, _, _, _, _, M, M, M, M, M, M, _, _, _, _, _],
      [_, _, _, _, _, m, M, M, M, M, m, _, _, _, _, _],
      [_, _, _, _, _, _, m, M, M, m, _, _, _, _, _, _],
      [_, _, _, _, _, _, m, m, m, m, _, _, _, _, _, _],
      [_, _, _, _, _, _, m, _, _, m, _, _, _, _, _, _],
      [_, _, _, _, _, _, m, _, _, m, _, _, _, _, _, _],
      [_, _, _, _, _, n, m, _, _, m, n, _, _, _, _, _],
    ]);
    savePNG(png, path.join(CONTENT_DIR, 'sprites', `player_${pc.name}.png`));
  }
}

// ============================================================================
// NPC SPRITES (16x16)
// ============================================================================

function generateNPCSprites() {
  const Bl = C.blue;
  const bl = C.darkBlue;

  // Generic NPC: blue-robed figure
  const npc = createPNG(16, 16);
  drawPixelArt(npc, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
    [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
    [_, _, _, _, _, S, W, S, S, W, S, _, _, _, _, _],
    [_, _, _, _, _, S, S, s, s, S, S, _, _, _, _, _],
    [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Bl,Bl, _, _, _, _, _, _, _],
    [_, _, _,Bl,Bl,Bl,Bl,Bl,Bl,Bl,Bl,Bl,Bl, _, _, _],
    [_, _, _,Bl,Bl,Bl,Bl,Bl,Bl,Bl,Bl,Bl,Bl, _, _, _],
    [_, _, _, _,Bl,Bl,Bl,Bl,Bl,Bl,Bl,Bl, _, _, _, _],
    [_, _, _, _, _,Bl,Bl,Bl,Bl,Bl,Bl, _, _, _, _, _],
    [_, _, _, _, _,bl,Bl,Bl,Bl,Bl,bl, _, _, _, _, _],
    [_, _, _, _, _,bl,bl,Bl,Bl,bl,bl, _, _, _, _, _],
    [_, _, _, _, _,bl,bl, _, _,bl,bl, _, _, _, _, _],
    [_, _, _, _, _,bl,bl, _, _,bl,bl, _, _, _, _, _],
    [_, _, _, _, n,bl,bl, _, _,bl,bl, n, _, _, _, _],
  ]);
  savePNG(npc, path.join(CONTENT_DIR, 'sprites', 'npc_default.png'));
}

// ============================================================================
// ITEM SPRITES (16x16)
// ============================================================================

function generateItemSprites() {
  // --- Health Potion: red bottle ---
  const potion = createPNG(16, 16);
  drawPixelArt(potion, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _],
    [_, _, _, _, _, G, R, R, R, R, G, _, _, _, _, _],
    [_, _, _, _, G, R, R, R, R, R, R, G, _, _, _, _],
    [_, _, _, _, G, R, R, W, R, R, R, G, _, _, _, _],
    [_, _, _, _, G, R, R, R, R, R, R, G, _, _, _, _],
    [_, _, _, _, G, R, R, R, R, R, R, G, _, _, _, _],
    [_, _, _, _, G, R, R, R, R, R, R, G, _, _, _, _],
    [_, _, _, _, G, R, R, R, R, R, R, G, _, _, _, _],
    [_, _, _, _, _, G, R, R, R, R, G, _, _, _, _, _],
    [_, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(potion, path.join(CONTENT_DIR, 'sprites', 'health_potion.png'));

  // --- Bandage: white cloth roll ---
  const bandage = createPNG(16, 16);
  const Wh = C.white;
  const Lg = C.lightGray;
  drawPixelArt(bandage, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _,Wh,Wh,Wh,Wh,Wh,Wh, _, _, _, _, _],
    [_, _, _, _, Wh,Wh,Wh,Wh,Wh,Wh,Wh,Wh, _, _, _, _],
    [_, _, _, _, Wh,Lg,Wh,Wh,Wh,Lg,Wh,Wh, _, _, _, _],
    [_, _, _, _, Wh,Wh,Wh,Wh,Wh,Wh,Wh,Wh, _, _, _, _],
    [_, _, _, _, Wh,Wh,Wh,Wh,Wh,Wh,Wh,Wh, _, _, _, _],
    [_, _, _, _, Wh,Lg,Wh,Wh,Wh,Lg,Wh,Wh, _, _, _, _],
    [_, _, _, _, Wh,Wh,Wh,Wh,Wh,Wh,Wh,Wh, _, _, _, _],
    [_, _, _, _, _,Wh,Wh,Wh,Wh,Wh,Wh, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(bandage, path.join(CONTENT_DIR, 'sprites', 'bandage.png'));

  // --- Rusty Sword: brown-orange blade ---
  const sword = createPNG(16, 16);
  const Ru = rgba(180, 130, 80);  // rusty
  const Rd = rgba(130, 90, 55);   // dark rust
  drawPixelArt(sword, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _,Lg, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _,Lg,Ru, _, _],
    [_, _, _, _, _, _, _, _, _, _, _,Lg,Ru, _, _, _],
    [_, _, _, _, _, _, _, _, _, _,Lg,Ru, _, _, _, _],
    [_, _, _, _, _, _, _, _, _,Lg,Ru, _, _, _, _, _],
    [_, _, _, _, _, _, _, _,Lg,Ru, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Lg,Ru, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Ru,Ru, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, Rd,Ru, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, N,Rd, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, N, G, N, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _,Rd, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, n, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(sword, path.join(CONTENT_DIR, 'sprites', 'rusty_sword.png'));

  // --- Torch: wooden handle with flame ---
  const torch = createPNG(16, 16);
  const Fl = rgba(255, 200, 60);   // flame
  const Fd = rgba(255, 140, 30);   // dark flame
  drawPixelArt(torch, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Fl, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Fl,Fl,Fl, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,Fd,Fl,Fd, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,Fd,Fl,Fd, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Fd, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, N, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, N, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, N, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, N, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, n, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, n, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, n, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, n, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(torch, path.join(CONTENT_DIR, 'sprites', 'torch.png'));

  // --- Iron Key: small gray key ---
  const key = createPNG(16, 16);
  drawPixelArt(key, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, G, G, G, G, _, _, _, _, _, _, _],
    [_, _, _, _, G, _, _, _, _, G, _, _, _, _, _, _],
    [_, _, _, _, G, _, _, _, _, G, _, _, _, _, _, _],
    [_, _, _, _, _, G, G, G, G, G, G, G, G, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, G, _, G, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, G, G, G, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(key, path.join(CONTENT_DIR, 'sprites', 'iron_key.png'));

  // --- Titanium Cylinders: metallic blue cylinders ---
  const cyl = createPNG(16, 16);
  const Tb = rgba(100, 160, 200);  // titanium bright
  const Td = rgba(70, 120, 160);   // titanium dark
  drawPixelArt(cyl, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _,Tb,Tb, _, _, _, _,Tb,Tb, _, _, _, _],
    [_, _, _, Td,Tb,Tb,Td, _, Td,Tb,Tb,Td, _, _, _, _],
    [_, _, _, Td,Tb,Tb,Td, _, Td,Tb,Tb,Td, _, _, _, _],
    [_, _, _, Td,Tb,Tb,Td, _, Td,Tb,Tb,Td, _, _, _, _],
    [_, _, _, Td,Tb,Tb,Td, _, Td,Tb,Tb,Td, _, _, _, _],
    [_, _, _, Td,Tb,Tb,Td, _, Td,Tb,Tb,Td, _, _, _, _],
    [_, _, _, Td,Tb,Tb,Td, _, Td,Tb,Tb,Td, _, _, _, _],
    [_, _, _, Td,Tb,Tb,Td, _, Td,Tb,Tb,Td, _, _, _, _],
    [_, _, _, Td,Tb,Tb,Td, _, Td,Tb,Tb,Td, _, _, _, _],
    [_, _, _, _,Td,Td, _, _, _, _,Td,Td, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(cyl, path.join(CONTENT_DIR, 'sprites', 'titanium_cylinders.png'));

  // --- Sol Unit: glowing energy weapon ---
  const sol = createPNG(16, 16);
  const Sg = rgba(255, 220, 100);  // sol glow
  const Sm = rgba(220, 180, 60);   // sol mid
  const Sd = rgba(180, 140, 40);   // sol dark
  drawPixelArt(sol, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, Sg, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, Sg,Sm, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, Sg,Sm, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, Sg,Sm, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, Sg,Sm, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Sg,Sm, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Sm,Sm, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, Sd,Sm, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, G,Sd, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, G,Lg, G, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _,Sd, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, K, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(sol, path.join(CONTENT_DIR, 'sprites', 'sol_unit.png'));
}

// ============================================================================
// TILESET: Outpost (10 tiles in a horizontal strip: 160x16)
// Warm industrial/military colors — metal plating, concrete, steel doors
// ============================================================================

function generateOutpostTileset() {
  const png = createPNG(160, 16);

  // Outpost palette
  const O = {
    floorDark:  rgba(42, 40, 35),
    floorMid:   rgba(53, 51, 46),
    floorLight: rgba(65, 62, 55),
    wallDark:   rgba(80, 75, 68),
    wallMid:    rgba(100, 95, 85),
    wallLight:  rgba(115, 110, 100),
    wallTop:    rgba(125, 118, 108),
    doorMid:    rgba(106, 122, 138),
    doorDark:   rgba(80, 95, 110),
    doorLight:  rgba(130, 145, 160),
    voidColor:  rgba(15, 14, 12),
    water1:     rgba(35, 42, 32),
    water2:     rgba(48, 55, 40),
    water3:     rgba(58, 68, 48),
    teal:       rgba(50, 170, 150),
    purple:     rgba(130, 100, 60),
  };

  // --- Tile 0: Void (near-black warm) ---
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = 10 + ((x * 7 + y * 13) % 5);
      setPixel(png, x, y, rgba(v, Math.floor(v * 0.95), Math.floor(v * 0.85)));
    }
  }

  // --- Tile 1: Metal Floor (warm gray plating with seam lines) ---
  const ox1 = 16;
  fillRect(png, ox1, 0, 16, 16, O.floorMid);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox1 + i, 7, O.floorDark);
    setPixel(png, ox1 + 7, i, O.floorDark);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox1 + i, 0, O.floorLight);
    setPixel(png, ox1, i, O.floorLight);
    setPixel(png, ox1 + 8 + i, 8, O.floorLight);
    setPixel(png, ox1 + 8, 8 + i, O.floorLight);
  }
  // Rivet details
  setPixel(png, ox1 + 2, 2, O.floorLight);
  setPixel(png, ox1 + 13, 2, O.floorLight);
  setPixel(png, ox1 + 2, 13, O.floorLight);
  setPixel(png, ox1 + 13, 13, O.floorLight);

  // --- Tile 2: Worn Metal Floor (scuffed) ---
  const ox2 = 32;
  fillRect(png, ox2, 0, 16, 16, O.floorMid);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox2 + i, 7, O.floorDark);
    setPixel(png, ox2 + 7, i, O.floorDark);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox2 + i, 0, O.floorLight);
    setPixel(png, ox2, i, O.floorLight);
  }
  // Scuff marks
  const scuffs = [[3,3],[4,4],[5,4],[8,6],[9,7],[10,8],[6,10],[7,11],[11,12],[12,13]];
  for (const [sx, sy] of scuffs) setPixel(png, ox2 + sx, sy, O.floorDark);

  // --- Tile 3: Concrete Wall ---
  const ox3 = 48;
  fillRect(png, ox3, 0, 16, 16, O.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 0, O.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 15, O.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + 15, i, O.wallDark);
  const concrLight = [[2,3],[6,2],[10,4],[13,6],[4,8],[8,7],[1,10],[7,12],[11,9],[3,14]];
  const concrDark  = [[5,2],[1,5],[9,3],[12,7],[3,9],[7,11],[2,12],[10,10],[14,13],[8,14]];
  for (const [sx, sy] of concrLight) setPixel(png, ox3 + sx, sy, O.wallLight);
  for (const [sx, sy] of concrDark)  setPixel(png, ox3 + sx, sy, O.wallDark);

  // --- Tile 4: Steel Door Closed ---
  const ox4 = 64;
  fillRect(png, ox4, 0, 16, 16, O.doorMid);
  fillRect(png, ox4, 0, 1, 16, O.doorDark);
  fillRect(png, ox4 + 15, 0, 1, 16, O.doorDark);
  fillRect(png, ox4, 2, 16, 2, O.doorLight);
  fillRect(png, ox4, 12, 16, 2, O.doorLight);
  for (let vy = 0; vy < 16; vy++) setPixel(png, ox4 + 8, vy, O.doorDark);
  setPixel(png, ox4 + 12, 7, O.floorLight);
  setPixel(png, ox4 + 12, 8, O.floorLight);

  // --- Tile 5: Door Open ---
  const ox5 = 80;
  fillRect(png, ox5, 0, 16, 16, O.floorDark);
  fillRect(png, ox5, 0, 2, 16, O.doorDark);
  fillRect(png, ox5 + 14, 0, 2, 16, O.doorDark);
  fillRect(png, ox5 + 4, 2, 8, 12, rgba(30, 28, 25));

  // --- Tile 6: Stairs Down ---
  const ox6 = 96;
  fillRect(png, ox6, 0, 16, 16, O.floorMid);
  fillRect(png, ox6 + 2, 2, 12, 3, O.floorLight);
  fillRect(png, ox6 + 3, 5, 10, 3, O.floorMid);
  fillRect(png, ox6 + 4, 8, 8, 3, O.floorDark);
  fillRect(png, ox6 + 5, 11, 6, 3, rgba(25, 24, 20));
  setPixel(png, ox6 + 7, 13, O.purple);
  setPixel(png, ox6 + 8, 13, O.purple);
  setPixel(png, ox6 + 6, 12, O.purple);
  setPixel(png, ox6 + 9, 12, O.purple);

  // --- Tile 7: Drainage/Sludge ---
  const ox7 = 112;
  fillRect(png, ox7, 0, 16, 16, O.water1);
  const oWave = [[2,3],[3,3],[4,3],[8,5],[9,5],[10,5],[1,9],[2,9],[3,9],[7,11],[8,11],[9,11],[12,7],[13,7],[4,14],[5,14]];
  for (const [wx, wy] of oWave) setPixel(png, ox7 + wx, wy, O.water2);
  const oWaveH = [[3,2],[9,4],[2,8],[8,10],[13,6],[5,13]];
  for (const [wx, wy] of oWaveH) setPixel(png, ox7 + wx, wy, O.water3);

  // --- Tile 8: Stairs Up ---
  const ox8 = 128;
  fillRect(png, ox8, 0, 16, 16, O.floorMid);
  fillRect(png, ox8 + 5, 2, 6, 3, rgba(25, 24, 20));
  fillRect(png, ox8 + 4, 5, 8, 3, O.floorDark);
  fillRect(png, ox8 + 3, 8, 10, 3, O.floorMid);
  fillRect(png, ox8 + 2, 11, 12, 3, O.floorLight);
  setPixel(png, ox8 + 7, 1, O.teal);
  setPixel(png, ox8 + 8, 1, O.teal);
  setPixel(png, ox8 + 6, 2, O.teal);
  setPixel(png, ox8 + 9, 2, O.teal);

  // --- Tile 9: Locked Steel Door ---
  const ox9 = 144;
  fillRect(png, ox9, 0, 16, 16, O.doorMid);
  fillRect(png, ox9, 0, 1, 16, O.doorDark);
  fillRect(png, ox9 + 15, 0, 1, 16, O.doorDark);
  fillRect(png, ox9, 2, 16, 2, O.doorLight);
  fillRect(png, ox9, 12, 16, 2, O.doorLight);
  for (let vy = 0; vy < 16; vy++) setPixel(png, ox9 + 8, vy, O.doorDark);
  fillRect(png, ox9 + 6, 6, 4, 4, C.yellow);
  setPixel(png, ox9 + 7, 7, C.darkGray);
  setPixel(png, ox9 + 8, 7, C.darkGray);
  setPixel(png, ox9 + 7, 8, C.darkGray);

  savePNG(png, path.join(CONTENT_DIR, 'tilesets', 'outpost.png'));
}

// ============================================================================
// TILESET: Quarantine (10 tiles in a horizontal strip: 160x16)
// Sickly green/contaminated — biohazard zone
// ============================================================================

function generateQuarantineTileset() {
  const png = createPNG(160, 16);

  // Quarantine palette
  const Q = {
    floorDark:  rgba(28, 38, 28),
    floorMid:   rgba(37, 46, 37),
    floorLight: rgba(48, 58, 45),
    wallDark:   rgba(55, 70, 50),
    wallMid:    rgba(74, 90, 69),
    wallLight:  rgba(88, 105, 80),
    wallTop:    rgba(95, 112, 88),
    doorMid:    rgba(138, 122, 48),
    doorDark:   rgba(100, 88, 30),
    doorLight:  rgba(165, 148, 60),
    voidColor:  rgba(10, 16, 10),
    water1:     rgba(20, 45, 18),
    water2:     rgba(35, 65, 28),
    water3:     rgba(50, 85, 38),
    teal:       rgba(50, 170, 100),
    purple:     rgba(100, 60, 130),
    contamGreen: rgba(80, 160, 60),
  };

  // --- Tile 0: Void (dark green-black) ---
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = 8 + ((x * 7 + y * 13) % 5);
      setPixel(png, x, y, rgba(Math.floor(v * 0.7), v, Math.floor(v * 0.7)));
    }
  }

  // --- Tile 1: Contaminated Floor ---
  const ox1 = 16;
  fillRect(png, ox1, 0, 16, 16, Q.floorMid);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox1 + i, 7, Q.floorDark);
    setPixel(png, ox1 + 7, i, Q.floorDark);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox1 + i, 0, Q.floorLight);
    setPixel(png, ox1, i, Q.floorLight);
    setPixel(png, ox1 + 8 + i, 8, Q.floorLight);
    setPixel(png, ox1 + 8, 8 + i, Q.floorLight);
  }
  // Green contamination spots
  setPixel(png, ox1 + 4, 3, Q.contamGreen);
  setPixel(png, ox1 + 11, 10, Q.contamGreen);

  // --- Tile 2: Cracked Contaminated Floor ---
  const ox2 = 32;
  fillRect(png, ox2, 0, 16, 16, Q.floorMid);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox2 + i, 7, Q.floorDark);
    setPixel(png, ox2 + 7, i, Q.floorDark);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox2 + i, 0, Q.floorLight);
    setPixel(png, ox2, i, Q.floorLight);
  }
  // Green-tinted cracks
  const qCracks = [[3,2],[4,3],[4,4],[5,5],[6,6],[5,7],[6,8],[7,9],[8,10],[9,11],[10,11],[11,12],[12,13]];
  for (const [cx, cy] of qCracks) setPixel(png, ox2 + cx, cy, Q.contamGreen);

  // --- Tile 3: Quarantine Wall ---
  const ox3 = 48;
  fillRect(png, ox3, 0, 16, 16, Q.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 0, Q.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 15, Q.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + 15, i, Q.wallDark);
  const qwLight = [[2,2],[7,3],[10,4],[13,6],[4,8],[8,7],[1,10],[6,12],[11,9],[3,14]];
  const qwDark  = [[5,3],[1,6],[9,4],[12,7],[3,9],[7,11],[2,12],[10,10],[14,13],[8,14]];
  for (const [sx, sy] of qwLight) setPixel(png, ox3 + sx, sy, Q.wallLight);
  for (const [sx, sy] of qwDark)  setPixel(png, ox3 + sx, sy, Q.wallDark);

  // --- Tile 4: Hazard Door Closed ---
  const ox4 = 64;
  fillRect(png, ox4, 0, 16, 16, Q.doorMid);
  fillRect(png, ox4, 0, 1, 16, Q.doorDark);
  fillRect(png, ox4 + 15, 0, 1, 16, Q.doorDark);
  // Hazard stripes
  fillRect(png, ox4, 3, 16, 2, Q.doorLight);
  fillRect(png, ox4, 11, 16, 2, Q.doorLight);
  for (let vy = 0; vy < 16; vy++) {
    setPixel(png, ox4 + 5, vy, Q.doorDark);
    setPixel(png, ox4 + 10, vy, Q.doorDark);
  }
  setPixel(png, ox4 + 12, 7, Q.floorLight);
  setPixel(png, ox4 + 12, 8, Q.floorLight);

  // --- Tile 5: Door Open ---
  const ox5 = 80;
  fillRect(png, ox5, 0, 16, 16, Q.floorDark);
  fillRect(png, ox5, 0, 2, 16, Q.doorDark);
  fillRect(png, ox5 + 14, 0, 2, 16, Q.doorDark);
  fillRect(png, ox5 + 4, 2, 8, 12, rgba(20, 28, 18));

  // --- Tile 6: Stairs Down ---
  const ox6 = 96;
  fillRect(png, ox6, 0, 16, 16, Q.floorMid);
  fillRect(png, ox6 + 2, 2, 12, 3, Q.floorLight);
  fillRect(png, ox6 + 3, 5, 10, 3, Q.floorMid);
  fillRect(png, ox6 + 4, 8, 8, 3, Q.floorDark);
  fillRect(png, ox6 + 5, 11, 6, 3, rgba(18, 25, 16));
  setPixel(png, ox6 + 7, 13, Q.purple);
  setPixel(png, ox6 + 8, 13, Q.purple);
  setPixel(png, ox6 + 6, 12, Q.purple);
  setPixel(png, ox6 + 9, 12, Q.purple);

  // --- Tile 7: Toxic Waste ---
  const ox7 = 112;
  fillRect(png, ox7, 0, 16, 16, Q.water1);
  const qWave = [[2,3],[3,3],[4,3],[8,5],[9,5],[10,5],[1,9],[2,9],[3,9],[7,11],[8,11],[9,11],[12,7],[13,7],[4,14],[5,14]];
  for (const [wx, wy] of qWave) setPixel(png, ox7 + wx, wy, Q.water2);
  const qWaveH = [[3,2],[9,4],[2,8],[8,10],[13,6],[5,13]];
  for (const [wx, wy] of qWaveH) setPixel(png, ox7 + wx, wy, Q.water3);

  // --- Tile 8: Stairs Up ---
  const ox8 = 128;
  fillRect(png, ox8, 0, 16, 16, Q.floorMid);
  fillRect(png, ox8 + 5, 2, 6, 3, rgba(18, 25, 16));
  fillRect(png, ox8 + 4, 5, 8, 3, Q.floorDark);
  fillRect(png, ox8 + 3, 8, 10, 3, Q.floorMid);
  fillRect(png, ox8 + 2, 11, 12, 3, Q.floorLight);
  setPixel(png, ox8 + 7, 1, Q.teal);
  setPixel(png, ox8 + 8, 1, Q.teal);
  setPixel(png, ox8 + 6, 2, Q.teal);
  setPixel(png, ox8 + 9, 2, Q.teal);

  // --- Tile 9: Locked Hazard Door ---
  const ox9 = 144;
  fillRect(png, ox9, 0, 16, 16, Q.doorMid);
  fillRect(png, ox9, 0, 1, 16, Q.doorDark);
  fillRect(png, ox9 + 15, 0, 1, 16, Q.doorDark);
  fillRect(png, ox9, 3, 16, 2, Q.doorLight);
  fillRect(png, ox9, 11, 16, 2, Q.doorLight);
  for (let vy = 0; vy < 16; vy++) {
    setPixel(png, ox9 + 5, vy, Q.doorDark);
    setPixel(png, ox9 + 10, vy, Q.doorDark);
  }
  fillRect(png, ox9 + 6, 6, 4, 4, C.yellow);
  setPixel(png, ox9 + 7, 7, C.darkGray);
  setPixel(png, ox9 + 8, 7, C.darkGray);
  setPixel(png, ox9 + 7, 8, C.darkGray);

  savePNG(png, path.join(CONTENT_DIR, 'tilesets', 'quarantine.png'));
}

// ============================================================================
// TILESET: Dark City (10 tiles in a horizontal strip: 160x16)
// Outdoor urban ruins — dark asphalt, crumbling brick, rusted metal
// ============================================================================

function generateDarkCityTileset() {
  const png = createPNG(160, 16);

  // Dark city palette
  const DC = {
    floorDark:  rgba(30, 28, 28),
    floorMid:   rgba(42, 40, 40),
    floorLight: rgba(55, 52, 50),
    wallDark:   rgba(68, 55, 50),
    wallMid:    rgba(90, 74, 69),
    wallLight:  rgba(105, 88, 82),
    wallTop:    rgba(112, 95, 88),
    doorMid:    rgba(106, 92, 78),
    doorDark:   rgba(75, 62, 50),
    doorLight:  rgba(130, 112, 95),
    voidColor:  rgba(8, 8, 8),
    water1:     rgba(22, 28, 35),
    water2:     rgba(32, 40, 50),
    water3:     rgba(42, 52, 65),
    teal:       rgba(50, 140, 130),
    purple:     rgba(100, 60, 80),
  };

  // --- Tile 0: Void (near-black) ---
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = 6 + ((x * 7 + y * 13) % 5);
      setPixel(png, x, y, rgba(v, v, v));
    }
  }

  // --- Tile 1: Asphalt Floor ---
  const ox1 = 16;
  fillRect(png, ox1, 0, 16, 16, DC.floorMid);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox1 + i, 7, DC.floorDark);
    setPixel(png, ox1 + 7, i, DC.floorDark);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox1 + i, 0, DC.floorLight);
    setPixel(png, ox1, i, DC.floorLight);
    setPixel(png, ox1 + 8 + i, 8, DC.floorLight);
    setPixel(png, ox1 + 8, 8 + i, DC.floorLight);
  }
  // Gravel texture
  setPixel(png, ox1 + 3, 4, DC.floorLight);
  setPixel(png, ox1 + 10, 3, DC.floorDark);
  setPixel(png, ox1 + 12, 11, DC.floorLight);
  setPixel(png, ox1 + 5, 12, DC.floorDark);

  // --- Tile 2: Cracked Pavement ---
  const ox2 = 32;
  fillRect(png, ox2, 0, 16, 16, DC.floorMid);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox2 + i, 7, DC.floorDark);
    setPixel(png, ox2 + 7, i, DC.floorDark);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox2 + i, 0, DC.floorLight);
    setPixel(png, ox2, i, DC.floorLight);
  }
  // Deep cracks
  const dcCracks = [[2,1],[3,2],[4,3],[4,4],[5,5],[6,6],[5,7],[6,8],[7,9],[8,10],[9,11],[10,12],[11,13],[12,14]];
  for (const [cx, cy] of dcCracks) setPixel(png, ox2 + cx, cy, rgba(15, 15, 15));

  // --- Tile 3: Brick/Building Wall ---
  const ox3 = 48;
  fillRect(png, ox3, 0, 16, 16, DC.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 0, DC.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 15, DC.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + 15, i, DC.wallDark);
  // Brick mortar lines
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox3 + i, 4, DC.wallDark);
    setPixel(png, ox3 + i, 8, DC.wallDark);
    setPixel(png, ox3 + i, 12, DC.wallDark);
  }
  setPixel(png, ox3 + 4, 1, DC.wallDark);
  setPixel(png, ox3 + 4, 2, DC.wallDark);
  setPixel(png, ox3 + 4, 3, DC.wallDark);
  setPixel(png, ox3 + 12, 1, DC.wallDark);
  setPixel(png, ox3 + 12, 2, DC.wallDark);
  setPixel(png, ox3 + 12, 3, DC.wallDark);
  setPixel(png, ox3 + 8, 5, DC.wallDark);
  setPixel(png, ox3 + 8, 6, DC.wallDark);
  setPixel(png, ox3 + 8, 7, DC.wallDark);
  // Weathering
  const brkLight = [[2,2],[6,6],[10,10],[14,3]];
  for (const [sx, sy] of brkLight) setPixel(png, ox3 + sx, sy, DC.wallLight);

  // --- Tile 4: Rusted Door Closed ---
  const ox4 = 64;
  fillRect(png, ox4, 0, 16, 16, DC.doorMid);
  fillRect(png, ox4, 0, 1, 16, DC.doorDark);
  fillRect(png, ox4 + 15, 0, 1, 16, DC.doorDark);
  fillRect(png, ox4, 3, 16, 2, DC.doorLight);
  fillRect(png, ox4, 11, 16, 2, DC.doorLight);
  for (let vy = 0; vy < 16; vy++) {
    setPixel(png, ox4 + 5, vy, DC.doorDark);
    setPixel(png, ox4 + 10, vy, DC.doorDark);
  }
  // Rust spots
  setPixel(png, ox4 + 3, 6, rgba(120, 70, 40));
  setPixel(png, ox4 + 12, 9, rgba(120, 70, 40));
  setPixel(png, ox4 + 7, 8, DC.doorLight);

  // --- Tile 5: Door Open ---
  const ox5 = 80;
  fillRect(png, ox5, 0, 16, 16, DC.floorDark);
  fillRect(png, ox5, 0, 2, 16, DC.doorDark);
  fillRect(png, ox5 + 14, 0, 2, 16, DC.doorDark);
  fillRect(png, ox5 + 4, 2, 8, 12, rgba(18, 18, 18));

  // --- Tile 6: Stairs Down ---
  const ox6 = 96;
  fillRect(png, ox6, 0, 16, 16, DC.floorMid);
  fillRect(png, ox6 + 2, 2, 12, 3, DC.floorLight);
  fillRect(png, ox6 + 3, 5, 10, 3, DC.floorMid);
  fillRect(png, ox6 + 4, 8, 8, 3, DC.floorDark);
  fillRect(png, ox6 + 5, 11, 6, 3, rgba(15, 15, 15));
  setPixel(png, ox6 + 7, 13, DC.purple);
  setPixel(png, ox6 + 8, 13, DC.purple);
  setPixel(png, ox6 + 6, 12, DC.purple);
  setPixel(png, ox6 + 9, 12, DC.purple);

  // --- Tile 7: Dark Puddle ---
  const ox7 = 112;
  fillRect(png, ox7, 0, 16, 16, DC.water1);
  const dcWave = [[2,3],[3,3],[4,3],[8,5],[9,5],[10,5],[1,9],[2,9],[3,9],[7,11],[8,11],[9,11],[12,7],[13,7],[4,14],[5,14]];
  for (const [wx, wy] of dcWave) setPixel(png, ox7 + wx, wy, DC.water2);
  const dcWaveH = [[3,2],[9,4],[2,8],[8,10],[13,6],[5,13]];
  for (const [wx, wy] of dcWaveH) setPixel(png, ox7 + wx, wy, DC.water3);

  // --- Tile 8: Stairs Up ---
  const ox8 = 128;
  fillRect(png, ox8, 0, 16, 16, DC.floorMid);
  fillRect(png, ox8 + 5, 2, 6, 3, rgba(15, 15, 15));
  fillRect(png, ox8 + 4, 5, 8, 3, DC.floorDark);
  fillRect(png, ox8 + 3, 8, 10, 3, DC.floorMid);
  fillRect(png, ox8 + 2, 11, 12, 3, DC.floorLight);
  setPixel(png, ox8 + 7, 1, DC.teal);
  setPixel(png, ox8 + 8, 1, DC.teal);
  setPixel(png, ox8 + 6, 2, DC.teal);
  setPixel(png, ox8 + 9, 2, DC.teal);

  // --- Tile 9: Locked Rusted Door ---
  const ox9 = 144;
  fillRect(png, ox9, 0, 16, 16, DC.doorMid);
  fillRect(png, ox9, 0, 1, 16, DC.doorDark);
  fillRect(png, ox9 + 15, 0, 1, 16, DC.doorDark);
  fillRect(png, ox9, 3, 16, 2, DC.doorLight);
  fillRect(png, ox9, 11, 16, 2, DC.doorLight);
  for (let vy = 0; vy < 16; vy++) {
    setPixel(png, ox9 + 5, vy, DC.doorDark);
    setPixel(png, ox9 + 10, vy, DC.doorDark);
  }
  fillRect(png, ox9 + 6, 6, 4, 4, C.yellow);
  setPixel(png, ox9 + 7, 7, C.darkGray);
  setPixel(png, ox9 + 8, 7, C.darkGray);
  setPixel(png, ox9 + 7, 8, C.darkGray);
  // Rust spots
  setPixel(png, ox9 + 3, 8, rgba(120, 70, 40));
  setPixel(png, ox9 + 13, 5, rgba(120, 70, 40));

  savePNG(png, path.join(CONTENT_DIR, 'tilesets', 'dark_city.png'));
}

// ============================================================================
// MAIN
// ============================================================================

console.log('Generating placeholder sprites...');
generateCryptTileset();
generateOutpostTileset();
generateQuarantineTileset();
generateDarkCityTileset();
generateMonsterSprites();
generatePlayerSprites();
generateNPCSprites();
generateItemSprites();
console.log('Done! All sprites generated.');
