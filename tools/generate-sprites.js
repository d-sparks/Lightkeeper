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

// Master palette from docs/art-style-guide.md — all hex values match the guide
const C = {
  transparent: rgba(0, 0, 0, 0),
  // Core Grays
  black:       hex('#0a0a0f'),   // Void Black
  darkSlate:   hex('#1e1e2a'),   // Dark Slate
  midGray:     hex('#3d3d50'),   // Mid Gray
  darkGray:    hex('#1e1e2a'),   // alias: Dark Slate (legacy compat)
  gray:        hex('#5a5a6e'),   // Stone Gray
  lightGray:   hex('#8c8ca0'),   // Light Gray
  paleGray:    hex('#c0c0d0'),   // Pale Gray
  white:       hex('#dcdce6'),   // White
  // Warm Tones
  darkBrown:   hex('#5a4128'),   // Dark Brown
  brown:       hex('#8c6440'),   // Brown
  tan:         hex('#c4a070'),   // Tan
  darkRed:     hex('#8c1e1e'),   // Dark Red
  red:         hex('#c83232'),   // Red
  lightRed:    hex('#e06060'),   // Light Red
  rust:        hex('#a05a28'),   // Rust
  orange:      hex('#dc9632'),   // Orange
  yellow:      hex('#f0dc50'),   // Yellow
  // Cool Tones
  darkBlue:    hex('#1e3c78'),   // Dark Blue
  blue:        hex('#3c78c8'),   // Blue
  lightBlue:   hex('#6ea0e0'),   // Light Blue
  darkTeal:    hex('#1e6450'),   // Dark Teal
  teal:        hex('#32aa96'),   // Teal
  lightTeal:   hex('#64d2b4'),   // Light Teal
  // Purple / Nightside
  darkPurple:  hex('#50236e'),   // Dark Purple
  purple:      hex('#823caa'),   // Purple
  lightPurple: hex('#b478d2'),   // Light Purple
  // Greens
  darkGreen:   hex('#1e5a28'),   // Dark Green
  green:       hex('#46a046'),   // Green
  lightGreen:  hex('#78c878'),   // Light Green
  // Special
  bone:        hex('#c8beaa'),   // Bone
  solGold:     hex('#f0c850'),   // Sol Gold
  // Legacy aliases (used by existing sprites)
  darkBone:    hex('#968c78'),
  skin:        hex('#c8a078'),
  darkSkin:    hex('#966e50'),
  // Tileset colors (crypt)
  floorDark:   hex('#232337'),
  floorMid:    hex('#2d2d41'),
  floorLight:  hex('#37374b'),
  wallDark:    hex('#464664'),
  wallMid:     hex('#5a5a7a'),
  wallLight:   hex('#6e6e8c'),
  wallTop:     hex('#787896'),
  water1:      hex('#1e3c64'),
  water2:      hex('#284b78'),
  water3:      hex('#325a8c'),
  voidColor:   hex('#0a0a14'),
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
  const Br = C.brown;
  const Bd = C.darkBrown;
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
  const Hd = C.midGray;
  const Hk = C.darkSlate;
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
  const Ar = C.gray;
  const Ad = C.midGray;
  const Rr = C.red;
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

  // --- Training Target: wooden practice dummy ---
  const target = createPNG(16, 16);
  const Tw = C.tan;
  const Tk = C.darkBrown;
  drawPixelArt(target, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, R, R, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,Tw,Tw,Tw,Tw, _, _, _, _, _, _],
    [_, _, _, _, _, _,Tw,Tw,Tw,Tw, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Tw,Tw, _, _, _, _, _, _, _],
    [_, _, _, _,Tw,Tw,Tw,Tw,Tw,Tw,Tw,Tw, _, _, _, _],
    [_, _, _, _,Tw, R,Tw,Tw,Tw,Tw, R,Tw, _, _, _, _],
    [_, _, _, _,Tw,Tw,Tw, R, R,Tw,Tw,Tw, _, _, _, _],
    [_, _, _, _,Tw,Tw,Tw,Tw,Tw,Tw,Tw,Tw, _, _, _, _],
    [_, _, _, _,Tw,Tw,Tw,Tw,Tw,Tw,Tw,Tw, _, _, _, _],
    [_, _, _, _, _,Tk,Tw,Tw,Tw,Tw,Tk, _, _, _, _, _],
    [_, _, _, _, _, _, _,Tk,Tk, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Tk,Tk, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Tk,Tk, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,Tk,Tk,Tk,Tk, _, _, _, _, _, _],
    [_, _, _, _, _,Tk,Tk,Tk,Tk,Tk,Tk, _, _, _, _, _],
  ]);
  savePNG(target, path.join(CONTENT_DIR, 'sprites', 'training_target.png'));

  // --- Scrap Drone: small metallic flying bot ---
  const drone = createPNG(16, 16);
  const Mt = C.lightGray;
  const Md = C.gray;
  const Yl = C.yellow;
  drawPixelArt(drone, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Mt,Mt, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,Mt,Mt,Mt,Mt, _, _, _, _, _, _],
    [_, _, _, _, _, _,Mt,Yl,Yl,Mt, _, _, _, _, _, _],
    [_, _, _,Md,Mt,Mt,Mt,Mt,Mt,Mt,Mt,Mt,Md, _, _, _],
    [_, _, _,Md,Mt,Mt,Mt,Mt,Mt,Mt,Mt,Mt,Md, _, _, _],
    [_, _, _, _,Md,Mt,Mt,Mt,Mt,Mt,Mt,Md, _, _, _, _],
    [_, _, _, _, _,Md,Mt,Mt,Mt,Mt,Md, _, _, _, _, _],
    [_, _, _, _, _, _,Md,Md,Md,Md, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(drone, path.join(CONTENT_DIR, 'sprites', 'scrap_drone.png'));

  // --- Shadow Ambusher: dark cloaked figure with glowing eyes ---
  const ambusher = createPNG(16, 16);
  const Sh = C.darkSlate;
  const Sd2 = C.black;
  const Ey = C.lightPurple;
  drawPixelArt(ambusher, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sh,Sh,Sh,Sh, _, _, _, _, _, _],
    [_, _, _, _, _,Sh,Sh,Sh,Sh,Sh,Sh, _, _, _, _, _],
    [_, _, _, _, _,Sh,Ey,Sh,Sh,Ey,Sh, _, _, _, _, _],
    [_, _, _, _, _, _,Sh,Sh,Sh,Sh, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sh,Sh,Sh,Sh, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Sh,Sh, _, _, _, _, _, _, _],
    [_, _, _,Sh,Sh,Sh,Sh,Sh,Sh,Sh,Sh,Sh,Sh, _, _, _],
    [_, _, _, _,Sh,Sh,Sh,Sh,Sh,Sh,Sh,Sh, _, _, _, _],
    [_, _, _, _, _,Sh,Sh,Sh,Sh,Sh,Sh, _, _, _, _, _],
    [_, _, _, _, _,Sd2,Sh,Sh,Sh,Sh,Sd2, _, _, _, _],
    [_, _, _, _, _, _,Sd2,Sh,Sh,Sd2, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sd2,Sd2,Sd2,Sd2, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sd2, _, _,Sd2, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sd2, _, _,Sd2, _, _, _, _, _, _],
    [_, _, _, _, _,Sd2,Sd2, _, _,Sd2,Sd2, _, _, _, _],
  ]);
  savePNG(ambusher, path.join(CONTENT_DIR, 'sprites', 'shadow_ambusher.png'));

  // --- Tunnel Creeper: pale insectoid crawler ---
  const creeper = createPNG(16, 16);
  const Tn = C.tan;
  const Td2 = C.brown;
  drawPixelArt(creeper, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _,Td2, _, _, _, _,Td2, _, _, _, _, _],
    [_, _, _, _,Td2,Tn, _, _, _, _,Tn,Td2, _, _, _, _],
    [_, _, _, _, _,Tn,Tn,Tn,Tn,Tn,Tn, _, _, _, _, _],
    [_, _, _,Td2, _,Tn, R,Tn,Tn, R,Tn, _,Td2, _, _, _],
    [_, _, _, _,Tn,Tn,Tn,Tn,Tn,Tn,Tn,Tn, _, _, _, _],
    [_, _, Td2,Tn,Tn,Tn,Tn,Tn,Tn,Tn,Tn,Tn,Tn,Td2, _, _],
    [_, _, _, _,Tn,Tn,Tn,Tn,Tn,Tn,Tn,Tn, _, _, _, _],
    [_, _, _,Td2, _,Td2,Tn,Tn,Tn,Tn,Td2, _,Td2, _, _, _],
    [_, _, _, _, _, _,Td2,Tn,Tn,Td2, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(creeper, path.join(CONTENT_DIR, 'sprites', 'tunnel_creeper.png'));

  // --- Feral Hound: dark wolf-like creature ---
  const hound = createPNG(16, 16);
  const Fur = C.darkBrown;
  const Frl = C.brown;
  drawPixelArt(hound, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _,Fur,Fur, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, Fur,Frl,Frl,Fur, _, _, _, _, _, _, _, _, _, _],
    [_, _, Fur, R,Frl, R,Fur, _, _, _, _, _, _, _, _, _],
    [_, _, _,Fur,Frl,Fur,Fur,Fur, _, _, _, _, _, _, _, _],
    [_, _, _, _,Fur,Frl,Frl,Frl,Fur,Fur,Fur,Fur, _, _, _, _],
    [_, _, _, _,Fur,Frl,Frl,Frl,Frl,Frl,Frl,Fur, _, _, _, _],
    [_, _, _, _, _,Fur,Frl,Frl,Frl,Frl,Fur,Fur,Fur, _, _, _],
    [_, _, _, _, _,Fur, _,Fur,Fur, _,Fur, _, _, _, _, _],
    [_, _, _, _, _,Fur, _,Fur,Fur, _,Fur, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(hound, path.join(CONTENT_DIR, 'sprites', 'feral_hound.png'));

  // --- Frost Warden: icy blue armored boss ---
  const fwarden = createPNG(16, 16);
  const Ic = C.lightBlue;
  const Id = C.blue;
  const Ik = C.darkBlue;
  drawPixelArt(fwarden, 0, 0, [
    [_, _, _, _, _,Ic,Id,Id,Id,Id,Ic, _, _, _, _, _],
    [_, _, _, _, _,Id,Id,Id,Id,Id,Id, _, _, _, _, _],
    [_, _, _, _, _,Id, W,Id,Id, W,Id, _, _, _, _, _],
    [_, _, _, _, _,Id,Ic,Ik,Ik,Ic,Id, _, _, _, _, _],
    [_, _, _, _, _, _,Id,Id,Id,Id, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Id,Id, _, _, _, _, _, _, _],
    [_, _,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id, _, _],
    [_, _,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id, _, _],
    [_, _, W,Ik, _,Id,Ic,Id,Id,Ic,Id, _,Ik, W, _, _],
    [_, _, W, _, _,Ik,Id,Id,Id,Id,Ik, _, _, W, _, _],
    [_, _, _, _, _,Ik,Id,Id,Id,Id,Ik, _, _, _, _, _],
    [_, _, _, _, _,Ik,Ik,Id,Id,Ik,Ik, _, _, _, _, _],
    [_, _, _, _, _,Ik,Ik,Ik,Ik,Ik,Ik, _, _, _, _, _],
    [_, _, _, _, _,Ik, _, _, _, _,Ik, _, _, _, _, _],
    [_, _, _, _, _,Ik, _, _, _, _,Ik, _, _, _, _, _],
    [_, _, _, _,Ik,Ik, _, _, _, _,Ik,Ik, _, _, _, _],
  ]);
  savePNG(fwarden, path.join(CONTENT_DIR, 'sprites', 'frost_warden.png'));

  // --- Sporecap Shambler: mushroom-headed creature ---
  const shambler = createPNG(16, 16);
  const Sp = C.lightGreen;
  const Sk = C.darkGreen;
  const Cap = C.rust;
  const Cd = C.darkBrown;
  drawPixelArt(shambler, 0, 0, [
    [_, _, _, _, _, _,Cd,Cap,Cap,Cd, _, _, _, _, _, _],
    [_, _, _, _, _,Cd,Cap,Cap,Cap,Cap,Cd, _, _, _, _, _],
    [_, _, _, _,Cd,Cap,Cap,Cap,Cap,Cap,Cap,Cd, _, _, _, _],
    [_, _, _, _,Cap,Cap, W,Cap,Cap, W,Cap,Cap, _, _, _, _],
    [_, _, _, _, _,Cd,Cap,Cap,Cap,Cap,Cd, _, _, _, _, _],
    [_, _, _, _, _, _,Sp,Sp,Sp,Sp, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Sp,Sp, _, _, _, _, _, _, _],
    [_, _, _, _,Sp,Sp,Sp,Sp,Sp,Sp,Sp,Sp, _, _, _, _],
    [_, _, _, _, _,Sp,Sp,Sp,Sp,Sp,Sp, _, _, _, _, _],
    [_, _, _, _, _,Sk,Sp,Sp,Sp,Sp,Sk, _, _, _, _, _],
    [_, _, _, _, _, _,Sk,Sp,Sp,Sk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sk,Sp,Sp,Sk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sk,Sk,Sk,Sk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sk, _, _,Sk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Sk, _, _,Sk, _, _, _, _, _, _],
    [_, _, _, _, _,Sk,Sk, _, _,Sk,Sk, _, _, _, _, _],
  ]);
  savePNG(shambler, path.join(CONTENT_DIR, 'sprites', 'sporecap_shambler.png'));

  // --- Mycelium Lurker: pale fungal ambusher ---
  const mycelium = createPNG(16, 16);
  const My = C.paleGray;
  const Mk = C.lightGray;
  const Mg = C.green;
  drawPixelArt(mycelium, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,My,My,My,My, _, _, _, _, _, _],
    [_, _, _, _, _,My,My,My,My,My,My, _, _, _, _, _],
    [_, _, _, _, _,My,Mg,My,My,Mg,My, _, _, _, _, _],
    [_, _, _, _, _, _,My,Mk,Mk,My, _, _, _, _, _, _],
    [_, _, _, _, _, _,My,My,My,My, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Mk,Mk, _, _, _, _, _, _, _],
    [_, _, _,My,My,My,My,My,My,My,My,My,My, _, _, _],
    [_, _, _, _,Mk,My,My,My,My,My,My,Mk, _, _, _, _],
    [_, _, _, _, _,Mk,My,My,My,My,Mk, _, _, _, _, _],
    [_, _, _, _, _,Mk,Mk,My,My,Mk,Mk, _, _, _, _, _],
    [_, _, _, _, _, _,Mk,My,My,Mk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Mk,Mk,Mk,Mk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Mk, _, _,Mk, _, _, _, _, _, _],
    [_, _, _, _, _, Mk,Mk, _, _,Mk,Mk, _, _, _, _, _],
    [_, _, _, _, Mk,Mk, _, _, _, _,Mk,Mk, _, _, _, _],
  ]);
  savePNG(mycelium, path.join(CONTENT_DIR, 'sprites', 'mycelium_lurker.png'));

  // --- Fungal Sprayer: squat mushroom with spore nozzle ---
  const sprayer = createPNG(16, 16);
  const Fg = C.green;
  const Fk = C.darkGreen;
  const Yw = C.yellow;
  drawPixelArt(sprayer, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _,Yw, _, _],
    [_, _, _, _, _, _,Fg,Fg,Fg,Fg, _, _,Yw, _, _, _],
    [_, _, _, _, _,Fg,Fg,Fg,Fg,Fg,Fg,Yw, _, _, _, _],
    [_, _, _, _,Fg,Fg,Fg,Fg,Fg,Fg,Fg,Fg, _, _, _, _],
    [_, _, _, _,Fg, W,Fg,Fg,Fg, W,Fg,Fg, _, _, _, _],
    [_, _, _, _,Fk,Fg,Fg,Fg,Fg,Fg,Fg,Fk, _, _, _, _],
    [_, _, _, _, _,Fk,Fg,Fg,Fg,Fg,Fk, _, _, _, _, _],
    [_, _, _, _, _, _,Fk,Fk,Fk,Fk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Fk,Fg,Fg,Fk, _, _, _, _, _, _],
    [_, _, _, _, _, _,Fk,Fg,Fg,Fk, _, _, _, _, _, _],
    [_, _, _, _, _, Fk,Fk,Fg,Fg,Fk,Fk, _, _, _, _, _],
    [_, _, _, _, _, Fk,Fk,Fk,Fk,Fk,Fk, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(sprayer, path.join(CONTENT_DIR, 'sprites', 'fungal_sprayer.png'));

  // --- Elder Sporecap: large fungal boss ---
  const elder = createPNG(16, 16);
  const Ec = C.brown;
  const Ed = C.darkBrown;
  const Es = C.green;
  const Ek = C.darkGreen;
  drawPixelArt(elder, 0, 0, [
    [_, _, _, _,Ed,Ec,Ec,Ec,Ec,Ec,Ec,Ed, _, _, _, _],
    [_, _, _,Ed,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ed, _, _, _],
    [_, _,Ed,Ec,Ec, W,Ec,Ec,Ec,Ec, W,Ec,Ec,Ed, _, _],
    [_, _,Ed,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ed, _, _],
    [_, _, _,Ed,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ed, _, _, _],
    [_, _, _, _,Ed,Ed,Ec,Ec,Ec,Ec,Ed,Ed, _, _, _, _],
    [_, _, _, _, _, _,Es,Es,Es,Es, _, _, _, _, _, _],
    [_, _,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es, _, _],
    [_, _,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es, _, _],
    [_, _, _,Ek,Es,Es,Es,Es,Es,Es,Es,Es,Ek, _, _, _],
    [_, _, _, _,Ek,Es,Es,Es,Es,Es,Es,Ek, _, _, _, _],
    [_, _, _, _, _,Ek,Es,Es,Es,Es,Ek, _, _, _, _, _],
    [_, _, _, _, _,Ek,Ek,Es,Es,Ek,Ek, _, _, _, _, _],
    [_, _, _, _, _,Ek, _, _, _, _,Ek, _, _, _, _, _],
    [_, _, _, _, _,Ek, _, _, _, _,Ek, _, _, _, _, _],
    [_, _, _, _,Ek,Ek, _, _, _, _,Ek,Ek, _, _, _, _],
  ]);
  savePNG(elder, path.join(CONTENT_DIR, 'sprites', 'elder_sporecap.png'));

  // --- Dusk Crawler: low insectoid nightside creature, purple/teal ---
  const dcrawl = createPNG(16, 16);
  const Dp = C.darkPurple;
  const Pp = C.purple;
  const Lp = C.lightPurple;
  const Tg = C.teal;
  drawPixelArt(dcrawl, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, Dp, _, _, _, _, _, _, _, _, Dp, _, _, _],
    [_, _, Dp, Pp, Dp, _, _, _, _, _, Dp, Pp, Dp, _, _, _],
    [_, _, _, Dp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Dp, _, _, _, _],
    [_, _, Dp, _, Pp, Tg, Pp, Pp, Pp, Tg, Pp, _, Dp, _, _, _],
    [_, _, _, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, _, _, _, _],
    [_, Dp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Dp, _, _],
    [_, _, _, Pp, Pp, Lp, Pp, Pp, Pp, Pp, Lp, Pp, _, _, _, _],
    [_, _, Dp, _, Dp, Pp, Pp, Pp, Pp, Pp, Pp, Dp, _, Dp, _, _],
    [_, _, _, _, _, Dp, Dp, Pp, Pp, Dp, Dp, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(dcrawl, path.join(CONTENT_DIR, 'sprites', 'dusk_crawler.png'));

  // --- Crystal Guardian: imposing crystalline boss, icy blues ---
  const cguard = createPNG(16, 16);
  const Cb = C.lightBlue;
  const Cm = C.blue;
  const Cd2 = C.darkBlue;
  const Cw = C.white;
  const Pg = C.paleGray;
  drawPixelArt(cguard, 0, 0, [
    [_, _, _, _, _, Cw, Cb, _, _, Cb, Cw, _, _, _, _, _],
    [_, _, _, _, Cb, Cm, Cb, Cm, Cm, Cb, Cm, Cb, _, _, _, _],
    [_, _, _, _, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Cm, _, _, _, _],
    [_, _, _, _, Cm, Cw, Cm, Cm, Cm, Cw, Cm, Cm, _, _, _, _],
    [_, _, _, _, Cd2, Cm, Cm, Cm, Cm, Cm, Cm, Cd2, _, _, _, _],
    [_, _, _, _, _, Cd2, Cm, Cm, Cm, Cm, Cd2, _, _, _, _, _],
    [_, _, _, _, _, _, Cd2, Cm, Cm, Cd2, _, _, _, _, _, _],
    [_, _, Cb, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Cb, _, _],
    [_, _, Pg, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Cm, Pg, _, _],
    [_, _, _, Cd2, _, Cm, Cb, Cm, Cm, Cb, Cm, _, Cd2, _, _, _],
    [_, _, _, _, _, Cd2, Cm, Cm, Cm, Cm, Cd2, _, _, _, _, _],
    [_, _, _, _, _, Cd2, Cd2, Cm, Cm, Cd2, Cd2, _, _, _, _, _],
    [_, _, _, _, _, Cd2, Cd2, Cd2, Cd2, Cd2, Cd2, _, _, _, _, _],
    [_, _, _, _, _, Cd2, _, _, _, _, Cd2, _, _, _, _, _],
    [_, _, _, _, _, Cd2, _, _, _, _, Cd2, _, _, _, _, _],
    [_, _, _, _, Cd2, Cd2, _, _, _, _, Cd2, Cd2, _, _, _, _],
  ]);
  savePNG(cguard, path.join(CONTENT_DIR, 'sprites', 'crystal_guardian.png'));

  // --- Garden Mite: tiny green-brown insect pest ---
  const gmite = createPNG(16, 16);
  const Gn = C.green;
  const Gd = C.darkGreen;
  const Gb = C.brown;
  drawPixelArt(gmite, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Gd, Gd, Gd, Gd, _, _, _, _, _, _],
    [_, _, _, _, Gd, _, Gn, R, R, Gn, _, Gd, _, _, _, _],
    [_, _, _, _, _, Gn, Gn, Gn, Gn, Gn, Gn, _, _, _, _, _],
    [_, _, _, Gd, Gn, Gn, Gb, Gn, Gn, Gb, Gn, Gn, Gd, _, _, _],
    [_, _, _, _, _, Gn, Gn, Gn, Gn, Gn, Gn, _, _, _, _, _],
    [_, _, _, _, Gd, _, Gd, Gn, Gn, Gd, _, Gd, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(gmite, path.join(CONTENT_DIR, 'sprites', 'garden_mite.png'));

  // --- Nest Mother: large spider-like boss, purple with teal glow ---
  const nmother = createPNG(16, 16);
  const Nm = C.purple;
  const Nd = C.darkPurple;
  const Nt = C.teal;
  drawPixelArt(nmother, 0, 0, [
    [_, _, _, _, _, _, Nd, Nm, Nm, Nd, _, _, _, _, _, _],
    [_, _, _, _, _, Nd, Nm, Nm, Nm, Nm, Nd, _, _, _, _, _],
    [_, _, _, _, Nd, Nm, Nt, Nm, Nm, Nt, Nm, Nd, _, _, _, _],
    [_, _, _, _, Nd, Nm, Nm, Nm, Nm, Nm, Nm, Nd, _, _, _, _],
    [_, _, _, _, _, Nd, Nm, Nm, Nm, Nm, Nd, _, _, _, _, _],
    [_, _, _, _, _, _, Nd, Nm, Nm, Nd, _, _, _, _, _, _],
    [_, Nd, _, Nd, Nm, Nm, Nm, Nm, Nm, Nm, Nm, Nm, Nd, _, Nd, _],
    [Nd, _, Nd, Nm, Nm, Nm, Nm, Nm, Nm, Nm, Nm, Nm, Nm, Nd, _, Nd],
    [_, Nd, _, Nm, Nm, Nt, Nm, Nm, Nm, Nm, Nt, Nm, Nm, _, Nd, _],
    [Nd, _, _, Nd, Nm, Nm, Nm, Nm, Nm, Nm, Nm, Nm, Nd, _, _, Nd],
    [_, _, _, _, Nd, Nm, Nm, Nm, Nm, Nm, Nm, Nd, _, _, _, _],
    [_, _, _, Nd, _, Nd, Nd, Nm, Nm, Nd, Nd, _, Nd, _, _, _],
    [_, _, Nd, _, _, _, _, Nd, Nd, _, _, _, _, Nd, _, _],
    [_, Nd, _, _, _, _, _, _, _, _, _, _, _, _, Nd, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(nmother, path.join(CONTENT_DIR, 'sprites', 'nest_mother.png'));

  // --- Shade Stalker: stealthy nightside predator, dark with teal eyes ---
  const sstalker = createPNG(16, 16);
  const Ss = C.darkSlate;
  const Sm = C.midGray;
  const St = C.teal;
  drawPixelArt(sstalker, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Ss, Ss, Ss, Ss, _, _, _, _, _, _],
    [_, _, _, _, _, Ss, Ss, Ss, Ss, Ss, Ss, _, _, _, _, _],
    [_, _, _, _, _, Ss, St, Ss, Ss, St, Ss, _, _, _, _, _],
    [_, _, _, _, _, _, Ss, Sm, Sm, Ss, _, _, _, _, _, _],
    [_, _, _, _, _, _, Ss, Ss, Ss, Ss, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Ss, Ss, _, _, _, _, _, _, _],
    [_, _, _, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, _, _, _],
    [_, _, _, _, Sm, Ss, Ss, Ss, Ss, Ss, Ss, Sm, _, _, _, _],
    [_, _, _, _, _, Ss, Ss, Ss, Ss, Ss, Ss, _, _, _, _, _],
    [_, _, _, _, _, Sm, Ss, Ss, Ss, Ss, Sm, _, _, _, _, _],
    [_, _, _, _, _, _, Sm, Ss, Ss, Sm, _, _, _, _, _, _],
    [_, _, _, _, _, _, Ss, Ss, Ss, Ss, _, _, _, _, _, _],
    [_, _, _, _, _, _, Ss, _, _, Ss, _, _, _, _, _, _],
    [_, _, _, _, _, _, Ss, _, _, Ss, _, _, _, _, _, _],
    [_, _, _, _, _, Ss, Ss, _, _, Ss, Ss, _, _, _, _, _],
  ]);
  savePNG(sstalker, path.join(CONTENT_DIR, 'sprites', 'shade_stalker.png'));

  // --- Shade Stalker Alpha: larger, glowing purple accents ---
  const ssalpha = createPNG(16, 16);
  const Sa = C.darkSlate;
  const Sam = C.midGray;
  const Sat = C.teal;
  const Sap = C.lightPurple;
  drawPixelArt(ssalpha, 0, 0, [
    [_, _, _, _, _, Sap, Sa, Sa, Sa, Sa, Sap, _, _, _, _, _],
    [_, _, _, _, _, Sa, Sa, Sa, Sa, Sa, Sa, _, _, _, _, _],
    [_, _, _, _, _, Sa, Sat, Sa, Sa, Sat, Sa, _, _, _, _, _],
    [_, _, _, _, _, Sa, Sap, Sam, Sam, Sap, Sa, _, _, _, _, _],
    [_, _, _, _, _, _, Sa, Sa, Sa, Sa, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Sa, Sa, _, _, _, _, _, _, _],
    [_, _, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, _, _],
    [_, _, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, _, _],
    [_, _, Sap, Sam, _, Sa, Sap, Sa, Sa, Sap, Sa, _, Sam, Sap, _, _],
    [_, _, _, _, _, Sam, Sa, Sa, Sa, Sa, Sam, _, _, _, _, _],
    [_, _, _, _, _, Sam, Sa, Sa, Sa, Sa, Sam, _, _, _, _, _],
    [_, _, _, _, _, Sam, Sam, Sa, Sa, Sam, Sam, _, _, _, _, _],
    [_, _, _, _, _, Sa, Sa, Sa, Sa, Sa, Sa, _, _, _, _, _],
    [_, _, _, _, _, Sa, _, _, _, _, Sa, _, _, _, _, _],
    [_, _, _, _, _, Sa, _, _, _, _, Sa, _, _, _, _, _],
    [_, _, _, _, Sa, Sa, _, _, _, _, Sa, Sa, _, _, _, _],
  ]);
  savePNG(ssalpha, path.join(CONTENT_DIR, 'sprites', 'shade_stalker_alpha.png'));

  // --- Ravine Lurker: earthy ambush predator, hunched and wide ---
  const rlurk = createPNG(16, 16);
  const Rl = C.brown;
  const Rd = C.darkBrown;
  const Rrs = C.rust;
  const Re = C.orange;
  drawPixelArt(rlurk, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Rd, Rd, Rd, Rd, _, _, _, _, _, _],
    [_, _, _, _, _, Rd, Rl, Rl, Rl, Rl, Rd, _, _, _, _, _],
    [_, _, _, _, Rd, Rl, Re, Rl, Rl, Re, Rl, Rd, _, _, _, _],
    [_, _, _, _, Rd, Rl, Rl, Rrs, Rrs, Rl, Rl, Rd, _, _, _, _],
    [_, _, _, _, _, Rd, Rl, Rl, Rl, Rl, Rd, _, _, _, _, _],
    [_, _, Rd, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rd, _, _],
    [_, Rd, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rd, _],
    [_, _, Rd, Rl, Rrs, Rl, Rl, Rl, Rl, Rl, Rl, Rrs, Rl, Rd, _, _],
    [_, _, _, Rd, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rl, Rd, _, _, _],
    [_, _, _, _, Rd, Rd, Rl, Rl, Rl, Rl, Rd, Rd, _, _, _, _],
    [_, _, _, Rd, _, _, Rd, Rl, Rl, Rd, _, _, Rd, _, _, _],
    [_, _, Rd, _, _, _, Rd, _, _, Rd, _, _, _, Rd, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(rlurk, path.join(CONTENT_DIR, 'sprites', 'ravine_lurker.png'));

  // --- Gloom Wraith: ghostly ethereal figure, purple translucent ---
  const gwraith = createPNG(16, 16);
  const Gw = C.purple;
  const Gwl = C.lightPurple;
  const Gwd = C.darkPurple;
  const Gwe = C.orange;
  drawPixelArt(gwraith, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Gwl, Gwl, Gwl, Gwl, _, _, _, _, _, _],
    [_, _, _, _, _, Gw, Gw, Gwl, Gwl, Gw, Gw, _, _, _, _, _],
    [_, _, _, _, _, Gw, Gwe, Gw, Gw, Gwe, Gw, _, _, _, _, _],
    [_, _, _, _, _, _, Gw, Gwd, Gwd, Gw, _, _, _, _, _, _],
    [_, _, _, _, _, _, Gw, Gw, Gw, Gw, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Gw, Gw, _, _, _, _, _, _, _],
    [_, _, _, Gwl, Gw, Gw, Gw, Gw, Gw, Gw, Gw, Gw, Gwl, _, _, _],
    [_, _, _, _, Gw, Gw, Gw, Gw, Gw, Gw, Gw, Gw, _, _, _, _],
    [_, _, _, _, _, Gw, Gwl, Gw, Gw, Gwl, Gw, _, _, _, _, _],
    [_, _, _, _, _, Gwd, Gw, Gw, Gw, Gw, Gwd, _, _, _, _, _],
    [_, _, _, _, _, _, Gwd, Gw, Gw, Gwd, _, _, _, _, _, _],
    [_, _, _, _, _, _, Gwd, Gwl, Gwl, Gwd, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Gwl, Gwl, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Gwl, _, _, Gwl, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(gwraith, path.join(CONTENT_DIR, 'sprites', 'gloom_wraith.png'));

  // --- Rime Stalker: icy predator, sharp crystalline edges ---
  const rstalker = createPNG(16, 16);
  const Ri = C.lightBlue;
  const Rm = C.blue;
  const Rdk = C.darkBlue;
  const Rw = C.white;
  drawPixelArt(rstalker, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Rm, Rm, Rm, Rm, _, _, _, _, _, _],
    [_, _, _, _, _, Rm, Ri, Rm, Rm, Ri, Rm, _, _, _, _, _],
    [_, _, _, _, _, Rm, Rw, Rm, Rm, Rw, Rm, _, _, _, _, _],
    [_, _, _, _, _, _, Rm, Rdk, Rdk, Rm, _, _, _, _, _, _],
    [_, _, _, _, _, _, Rm, Rm, Rm, Rm, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Rm, Rm, _, _, _, _, _, _, _],
    [_, _, _, Ri, Rm, Rm, Rm, Rm, Rm, Rm, Rm, Rm, Ri, _, _, _],
    [_, _, _, _, Rdk, Rm, Rm, Rm, Rm, Rm, Rm, Rdk, _, _, _, _],
    [_, _, _, _, _, Rm, Ri, Rm, Rm, Ri, Rm, _, _, _, _, _],
    [_, _, _, _, _, Rdk, Rm, Rm, Rm, Rm, Rdk, _, _, _, _, _],
    [_, _, _, _, _, _, Rdk, Rm, Rm, Rdk, _, _, _, _, _, _],
    [_, _, _, _, _, _, Rdk, Rdk, Rdk, Rdk, _, _, _, _, _, _],
    [_, _, _, _, _, _, Rdk, _, _, Rdk, _, _, _, _, _, _],
    [_, _, _, _, _, _, Rdk, _, _, Rdk, _, _, _, _, _, _],
    [_, _, _, _, _, Rdk, Rdk, _, _, Rdk, Rdk, _, _, _, _, _],
  ]);
  savePNG(rstalker, path.join(CONTENT_DIR, 'sprites', 'rime_stalker.png'));

  // --- Frostfang Hunter: icy wolf-like predator ---
  const fhunter = createPNG(16, 16);
  const Fi = C.lightBlue;
  const Fm = C.blue;
  const Fd = C.darkBlue;
  const Fw = C.white;
  drawPixelArt(fhunter, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, Fm, Fi, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, Fm, Fi, Fi, Fm, _, _, _, _, _, _, _, _, _, _],
    [_, _, Fm, Fw, Fi, Fw, Fm, _, _, _, _, _, _, _, _, _],
    [_, _, _, Fm, Fw, Fm, Fm, Fm, _, _, _, _, _, _, _, _],
    [_, _, _, _, Fm, Fi, Fi, Fi, Fm, Fm, Fm, Fm, _, _, _, _],
    [_, _, _, _, Fm, Fi, Fi, Fi, Fi, Fi, Fi, Fm, _, _, _, _],
    [_, _, _, _, _, Fm, Fi, Fi, Fi, Fi, Fm, Fd, Fd, _, _, _],
    [_, _, _, _, _, Fd, _, Fm, Fm, _, Fd, _, _, _, _, _],
    [_, _, _, _, _, Fd, _, Fm, Fm, _, Fd, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(fhunter, path.join(CONTENT_DIR, 'sprites', 'frostfang_hunter.png'));

  // --- Vent Spewer: volcanic stationary creature, red/orange with yellow vents ---
  const vspew = createPNG(16, 16);
  const Vr = C.red;
  const Vd = C.darkRed;
  const Vo = C.orange;
  const Vy = C.yellow;
  drawPixelArt(vspew, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Vy, Vy, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Vy, Vo, Vo, Vy, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Vy, Vy, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Vr, Vr, Vr, Vr, _, _, _, _, _, _],
    [_, _, _, _, _, Vr, Vr, Vo, Vo, Vr, Vr, _, _, _, _, _],
    [_, _, _, _, Vr, Vr, Vy, Vr, Vr, Vy, Vr, Vr, _, _, _, _],
    [_, _, _, Vd, Vr, Vr, Vr, Vr, Vr, Vr, Vr, Vr, Vd, _, _, _],
    [_, _, _, Vd, Vr, Vo, Vr, Vr, Vr, Vr, Vo, Vr, Vd, _, _, _],
    [_, _, _, Vd, Vr, Vr, Vr, Vr, Vr, Vr, Vr, Vr, Vd, _, _, _],
    [_, _, _, _, Vd, Vr, Vr, Vr, Vr, Vr, Vr, Vd, _, _, _, _],
    [_, _, _, _, _, Vd, Vr, Vr, Vr, Vr, Vd, _, _, _, _, _],
    [_, _, _, _, _, Vd, Vd, Vr, Vr, Vd, Vd, _, _, _, _, _],
    [_, _, _, _, _, _, Vd, Vd, Vd, Vd, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(vspew, path.join(CONTENT_DIR, 'sprites', 'vent_spewer.png'));

  // --- Magma Brute: large volcanic boss, red/orange/yellow core ---
  const mbrute = createPNG(16, 16);
  const Mr = C.red;
  const Md2 = C.darkRed;
  const Mo = C.orange;
  const My2 = C.yellow;
  const Mlr = C.lightRed;
  drawPixelArt(mbrute, 0, 0, [
    [_, _, _, _, _, Mo, Md2, Md2, Md2, Md2, Mo, _, _, _, _, _],
    [_, _, _, _, _, Mr, Mr, Mr, Mr, Mr, Mr, _, _, _, _, _],
    [_, _, _, _, _, Mr, My2, Mr, Mr, My2, Mr, _, _, _, _, _],
    [_, _, _, _, _, Mr, Mo, Md2, Md2, Mo, Mr, _, _, _, _, _],
    [_, _, _, _, _, _, Mr, Mr, Mr, Mr, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Mr, Mr, _, _, _, _, _, _, _],
    [_, _, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, _, _],
    [_, _, Mr, Mr, Mr, Mr, Mr, Mo, Mo, Mr, Mr, Mr, Mr, Mr, _, _],
    [_, _, Mlr, Md2, _, Mr, My2, Mr, Mr, My2, Mr, _, Md2, Mlr, _, _],
    [_, _, Mlr, _, _, Md2, Mr, Mr, Mr, Mr, Md2, _, _, Mlr, _, _],
    [_, _, _, _, _, Md2, Mo, Mr, Mr, Mo, Md2, _, _, _, _, _],
    [_, _, _, _, _, Md2, Md2, Mr, Mr, Md2, Md2, _, _, _, _, _],
    [_, _, _, _, _, Md2, Md2, Md2, Md2, Md2, Md2, _, _, _, _, _],
    [_, _, _, _, _, Md2, _, _, _, _, Md2, _, _, _, _, _],
    [_, _, _, _, _, Md2, _, _, _, _, Md2, _, _, _, _, _],
    [_, _, _, _, Md2, Md2, _, _, _, _, Md2, Md2, _, _, _, _],
  ]);
  savePNG(mbrute, path.join(CONTENT_DIR, 'sprites', 'magma_brute.png'));

  // --- Array Sentinel: floating tech sentry, teal energy with gray chassis ---
  const asent = createPNG(16, 16);
  const At = C.teal;
  const Am = C.lightGray;
  const Adk = C.midGray;
  drawPixelArt(asent, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, At, At, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, At, At, At, At, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, At, At, _, _, _, _, _, _, _],
    [_, _, _, _, _, Adk,Am,Am,Am,Am,Adk, _, _, _, _, _],
    [_, _, _, _, Adk,Am,Am,Am,Am,Am,Am,Adk, _, _, _, _],
    [_, _, _, _, Adk,Am, At,Am,Am, At,Am,Adk, _, _, _, _],
    [_, _, _, _, Adk,Am,Am,Am,Am,Am,Am,Adk, _, _, _, _],
    [_, _, _, At,Adk,Am,Am,Am,Am,Am,Am,Adk, At, _, _, _],
    [_, _, _, _, Adk,Am,Am,Am,Am,Am,Am,Adk, _, _, _, _],
    [_, _, _, _, _, Adk,Am,Am,Am,Am,Adk, _, _, _, _, _],
    [_, _, _, _, _, _, Adk,Adk,Adk,Adk, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, At, At, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(asent, path.join(CONTENT_DIR, 'sprites', 'array_sentinel.png'));

  // --- Array Fabricator: bulky tech construct, gray/teal ---
  const afab = createPNG(16, 16);
  const Ft = C.teal;
  const Fam = C.lightGray;
  const Fad = C.gray;
  const Fak = C.midGray;
  drawPixelArt(afab, 0, 0, [
    [_, _, _, _, _, Fak,Fad,Fad,Fad,Fad,Fak, _, _, _, _, _],
    [_, _, _, _, _, Fad,Fam,Fam,Fam,Fam,Fad, _, _, _, _, _],
    [_, _, _, _, _, Fad, Ft,Fam,Fam, Ft,Fad, _, _, _, _, _],
    [_, _, _, _, _, Fad,Fam,Fak,Fak,Fam,Fad, _, _, _, _, _],
    [_, _, _, _, _, _, Fad,Fad,Fad,Fad, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,Fad,Fad, _, _, _, _, _, _, _],
    [_, _, Fad,Fad,Fad,Fad,Fad,Fad,Fad,Fad,Fad,Fad,Fad,Fad, _, _],
    [_, _, Fad,Fam,Fam,Fam,Fam,Fam,Fam,Fam,Fam,Fam,Fam,Fad, _, _],
    [_, _, Ft,Fak, _,Fam, Ft,Fam,Fam, Ft,Fam, _,Fak, Ft, _, _],
    [_, _, _, _, _, Fak,Fam,Fam,Fam,Fam,Fak, _, _, _, _, _],
    [_, _, _, _, _, Fak,Fam,Fam,Fam,Fam,Fak, _, _, _, _, _],
    [_, _, _, _, _, Fak,Fak,Fam,Fam,Fak,Fak, _, _, _, _, _],
    [_, _, _, _, _, Fak,Fak,Fak,Fak,Fak,Fak, _, _, _, _, _],
    [_, _, _, _, _, Fak, _, _, _, _,Fak, _, _, _, _, _],
    [_, _, _, _, _, Fak, _, _, _, _,Fak, _, _, _, _, _],
    [_, _, _, _, Fak,Fak, _, _, _, _,Fak,Fak, _, _, _, _],
  ]);
  savePNG(afab, path.join(CONTENT_DIR, 'sprites', 'array_fabricator.png'));

  // --- Array Overseer: imposing tech boss, teal/purple energy ---
  const aoverseer = createPNG(16, 16);
  const Ot = C.teal;
  const Op = C.lightPurple;
  const Om = C.lightGray;
  const Od = C.gray;
  const Ok = C.midGray;
  drawPixelArt(aoverseer, 0, 0, [
    [_, _, _, _, _, Op, Ot, Ot, Ot, Ot, Op, _, _, _, _, _],
    [_, _, _, _, Od, Om, Om, Om, Om, Om, Om, Od, _, _, _, _],
    [_, _, _, _, Od, Om, Ot, Om, Om, Ot, Om, Od, _, _, _, _],
    [_, _, _, _, Od, Om, Op, Ok, Ok, Op, Om, Od, _, _, _, _],
    [_, _, _, _, _, Od, Om, Om, Om, Om, Od, _, _, _, _, _],
    [_, _, _, _, _, _, Od, Om, Om, Od, _, _, _, _, _, _],
    [_, _, Od, Om, Om, Om, Om, Om, Om, Om, Om, Om, Om, Od, _, _],
    [_, _, Od, Om, Om, Om, Om, Op, Op, Om, Om, Om, Om, Od, _, _],
    [_, _, Op, Ok, _, Om, Ot, Om, Om, Ot, Om, _, Ok, Op, _, _],
    [_, _, _, _, _, Ok, Om, Om, Om, Om, Ok, _, _, _, _, _],
    [_, _, _, _, _, Ok, Op, Om, Om, Op, Ok, _, _, _, _, _],
    [_, _, _, _, _, Ok, Ok, Om, Om, Ok, Ok, _, _, _, _, _],
    [_, _, _, _, _, Ok, Ok, Ok, Ok, Ok, Ok, _, _, _, _, _],
    [_, _, _, _, _, Ok, _, _, _, _, Ok, _, _, _, _, _],
    [_, _, _, _, _, Ok, _, _, _, _, Ok, _, _, _, _, _],
    [_, _, _, _, Ok, Ok, _, _, _, _, Ok, Ok, _, _, _, _],
  ]);
  savePNG(aoverseer, path.join(CONTENT_DIR, 'sprites', 'array_overseer.png'));

  // --- Threshold Watcher: ethereal sentinel, purple/blue with glowing eyes ---
  const twatcher = createPNG(16, 16);
  const Wp = C.purple;
  const Wd = C.darkPurple;
  const Wl = C.lightPurple;
  const Wb = C.blue;
  drawPixelArt(twatcher, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Wl, Wl, Wl, Wl, _, _, _, _, _, _],
    [_, _, _, _, _, Wp, Wp, Wl, Wl, Wp, Wp, _, _, _, _, _],
    [_, _, _, _, _, Wp, Wb, Wp, Wp, Wb, Wp, _, _, _, _, _],
    [_, _, _, _, _, Wd, Wp, Wp, Wp, Wp, Wd, _, _, _, _, _],
    [_, _, _, _, _, _, Wp, Wd, Wd, Wp, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Wp, Wp, _, _, _, _, _, _, _],
    [_, _, _, Wl, Wp, Wp, Wp, Wp, Wp, Wp, Wp, Wp, Wl, _, _, _],
    [_, _, _, _, Wd, Wp, Wp, Wp, Wp, Wp, Wp, Wd, _, _, _, _],
    [_, _, _, _, _, Wp, Wb, Wp, Wp, Wb, Wp, _, _, _, _, _],
    [_, _, _, _, _, Wd, Wp, Wp, Wp, Wp, Wd, _, _, _, _, _],
    [_, _, _, _, _, Wd, Wd, Wp, Wp, Wd, Wd, _, _, _, _, _],
    [_, _, _, _, _, Wd, Wl, Wd, Wd, Wl, Wd, _, _, _, _, _],
    [_, _, _, _, _, _, Wl, _, _, Wl, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(twatcher, path.join(CONTENT_DIR, 'sprites', 'threshold_watcher.png'));

  // --- Abyssal Tendril: dark writhing tentacle creature ---
  const atendril = createPNG(16, 16);
  const Tb2 = C.darkSlate;
  const Tm = C.midGray;
  const Tp2 = C.darkPurple;
  const Te = C.red;
  drawPixelArt(atendril, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, Tp2, _, _, _, _, _, _, _, _, Tp2, _, _, _],
    [_, _, _, Tb2, Tp2, _, _, _, _, _, Tp2, Tb2, _, _, _, _],
    [_, _, _, _, Tb2, _, _, _, _, _, Tb2, _, _, _, _, _],
    [_, _, _, _, _, Tb2, Tb2, Tb2, Tb2, Tb2, _, _, _, _, _, _],
    [_, _, _, _, Tb2, Tb2, Te, Tb2, Tb2, Te, Tb2, _, _, _, _, _],
    [_, _, _, _, Tb2, Tm, Tb2, Tb2, Tb2, Tb2, Tm, _, _, _, _, _],
    [_, _, _, _, _, Tb2, Tb2, Tb2, Tb2, Tb2, _, _, _, _, _, _],
    [_, _, _, _, _, _, Tb2, Tm, Tm, Tb2, _, _, _, _, _, _],
    [_, _, Tp2, _, _, Tb2, Tb2, Tb2, Tb2, Tb2, _, _, Tp2, _, _, _],
    [_, _, Tb2, _, Tb2, Tb2, Tb2, Tb2, Tb2, Tb2, Tb2, _, Tb2, _, _, _],
    [_, _, _, Tb2, _, Tb2, _, Tb2, Tb2, _, Tb2, Tb2, _, _, _, _],
    [_, _, _, Tp2, _, _, _, Tb2, Tb2, _, _, Tp2, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(atendril, path.join(CONTENT_DIR, 'sprites', 'abyssal_tendril.png'));

  // --- Threshold Keeper: imposing dark boss, purple/red with void energy ---
  const tkeeper = createPNG(16, 16);
  const Kp = C.purple;
  const Kd = C.darkPurple;
  const Kl = C.lightPurple;
  const Kr = C.red;
  const Kk = C.darkSlate;
  drawPixelArt(tkeeper, 0, 0, [
    [_, _, _, _, _, Kl, Kd, Kd, Kd, Kd, Kl, _, _, _, _, _],
    [_, _, _, _, Kd, Kp, Kp, Kp, Kp, Kp, Kp, Kd, _, _, _, _],
    [_, _, _, _, Kd, Kp, Kr, Kp, Kp, Kr, Kp, Kd, _, _, _, _],
    [_, _, _, _, Kd, Kp, Kl, Kd, Kd, Kl, Kp, Kd, _, _, _, _],
    [_, _, _, _, _, Kd, Kp, Kp, Kp, Kp, Kd, _, _, _, _, _],
    [_, _, _, _, _, _, Kd, Kp, Kp, Kd, _, _, _, _, _, _],
    [_, _, Kd, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kd, _, _],
    [_, _, Kd, Kp, Kp, Kp, Kp, Kr, Kr, Kp, Kp, Kp, Kp, Kd, _, _],
    [_, _, Kl, Kk, _, Kp, Kl, Kp, Kp, Kl, Kp, _, Kk, Kl, _, _],
    [_, _, _, _, _, Kk, Kp, Kp, Kp, Kp, Kk, _, _, _, _, _],
    [_, _, _, _, _, Kk, Kr, Kp, Kp, Kr, Kk, _, _, _, _, _],
    [_, _, _, _, _, Kk, Kk, Kp, Kp, Kk, Kk, _, _, _, _, _],
    [_, _, _, _, _, Kk, Kk, Kk, Kk, Kk, Kk, _, _, _, _, _],
    [_, _, _, _, _, Kk, _, _, _, _, Kk, _, _, _, _, _],
    [_, _, _, _, _, Kk, _, _, _, _, Kk, _, _, _, _, _],
    [_, _, _, _, Kk, Kk, _, _, _, _, Kk, Kk, _, _, _, _],
  ]);
  savePNG(tkeeper, path.join(CONTENT_DIR, 'sprites', 'threshold_keeper.png'));
}

// ============================================================================
// PLAYER SPRITES (16x16, 4 color variants)
// ============================================================================

function generatePlayerSprites() {
  const playerColors = [
    { name: 'blue',   body: C.blue,      dark: C.darkBlue    },
    { name: 'red',    body: C.red,       dark: C.darkRed     },
    { name: 'green',  body: C.green,     dark: C.darkGreen   },
    { name: 'orange', body: C.orange,    dark: C.rust        },
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

  // --- Sable (nightside guide): dark-hooded figure, purple cloak, teal accent ---
  const Pu = C.purple;
  const pu = C.darkPurple;
  const Lt = C.lightPurple;
  const Te = C.teal;
  const sable = createPNG(16, 16);
  drawPixelArt(sable, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
    [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
    [_, _, _, _, _,pu, S, S, S, S,pu, _, _, _, _, _],
    [_, _, _, _, _, S, S, s, s, S, S, _, _, _, _, _],
    [_, _, _, _, _,pu,pu, S, S,pu,pu, _, _, _, _, _],
    [_, _, _, _, _, _,pu,Pu,Pu,pu, _, _, _, _, _, _],
    [_, _, _, _,pu,Pu,Pu,Pu,Pu,Pu,Pu,pu, _, _, _, _],
    [_, _, _, _,Pu,Pu,Pu,Pu,Pu,Pu,Pu,Pu, _, _, _, _],
    [_, _, _, _,Pu,Pu,Pu,Te,Te,Pu,Pu,Pu, _, _, _, _],
    [_, _, _, _, _,Pu,Pu,Pu,Pu,Pu,Pu, _, _, _, _, _],
    [_, _, _, _, _,pu,Pu,Pu,Pu,Pu,pu, _, _, _, _, _],
    [_, _, _, _, _,pu,pu,Pu,Pu,pu,pu, _, _, _, _, _],
    [_, _, _, _, _,pu,pu, _, _,pu,pu, _, _, _, _, _],
    [_, _, _, _, _,pu,pu, _, _,pu,pu, _, _, _, _, _],
    [_, _, _, _, n,pu,pu, _, _,pu,pu, n, _, _, _, _],
  ]);
  savePNG(sable, path.join(CONTENT_DIR, 'sprites', 'sable_nightside_guide.png'));

  // --- Sable at threshold: same character, slightly different pose (teal glow shifted) ---
  const sableT = createPNG(16, 16);
  drawPixelArt(sableT, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
    [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
    [_, _, _, _, _,pu, S, S, S, S,pu, _, _, _, _, _],
    [_, _, _, _, _, S, S, s, s, S, S, _, _, _, _, _],
    [_, _, _, _, _,pu,pu, S, S,pu,pu, _, _, _, _, _],
    [_, _, _, _, _, _,pu,Pu,Pu,pu, _, _, _, _, _, _],
    [_, _, _, _,pu,Pu,Pu,Pu,Pu,Pu,Pu,pu, _, _, _, _],
    [_, _, _, _,Pu,Pu,Pu,Pu,Pu,Pu,Pu,Pu, _, _, _, _],
    [_, _, _, _,Pu,Te,Pu,Pu,Pu,Pu,Te,Pu, _, _, _, _],
    [_, _, _, _, _,Pu,Pu,Pu,Pu,Pu,Pu, _, _, _, _, _],
    [_, _, _, _, _,pu,Pu,Pu,Pu,Pu,pu, _, _, _, _, _],
    [_, _, _, _, _,pu,pu,Pu,Pu,pu,pu, _, _, _, _, _],
    [_, _, _, _, _,pu,pu, _, _,pu,pu, _, _, _, _, _],
    [_, _, _, _, _,pu,pu, _, _,pu,pu, _, _, _, _, _],
    [_, _, _, _, n,pu,pu, _, _,pu,pu, n, _, _, _, _],
  ]);
  savePNG(sableT, path.join(CONTENT_DIR, 'sprites', 'sable_threshold.png'));

  // --- Elder Vael (unbounded_elder): ancient hooded elder, pale/silver with light-purple aura ---
  const Lg = C.lightGray;
  const Pg = C.paleGray;
  const Lp = C.lightPurple;
  const lp = C.purple;
  const elder = createPNG(16, 16);
  drawPixelArt(elder, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],
    [_, _, _, _, _, B, B, B, B, B, B, _, _, _, _, _],
    [_, _, _, _, _,Pg, B, B, B, B,Pg, _, _, _, _, _],
    [_, _, _, _, _, B, B, b, b, B, B, _, _, _, _, _],
    [_, _, _, _, _,Pg,Pg, B, B,Pg,Pg, _, _, _, _, _],
    [_, _, _, _, _, _,Pg,Lp,Lp,Pg, _, _, _, _, _, _],
    [_, _, _, _,Pg,Lp,Lp,Lp,Lp,Lp,Lp,Pg, _, _, _, _],
    [_, _, _, _,Lp,Lp,Lg,Lp,Lp,Lg,Lp,Lp, _, _, _, _],
    [_, _, _, _,Lp,Lp,Lp,Lp,Lp,Lp,Lp,Lp, _, _, _, _],
    [_, _, _, _, _,Lp,Lp,Lp,Lp,Lp,Lp, _, _, _, _, _],
    [_, _, _, _, _,lp,Lp,Lp,Lp,Lp,lp, _, _, _, _, _],
    [_, _, _, _, _,lp,lp,Lp,Lp,lp,lp, _, _, _, _, _],
    [_, _, _, _, _,lp,lp, _, _,lp,lp, _, _, _, _, _],
    [_, _, _, _, _,lp,lp, _, _,lp,lp, _, _, _, _, _],
    [_, _, _, _, b,lp,lp, _, _,lp,lp, b, _, _, _, _],
  ]);
  savePNG(elder, path.join(CONTENT_DIR, 'sprites', 'unbounded_elder.png'));
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
  const Ru = C.tan;
  const Rd = C.rust;
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
  const Fl = C.yellow;
  const Fd = C.orange;
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
  const Tb = C.lightBlue;
  const Td = C.blue;
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
  const Sg = C.yellow;
  const Sm = C.solGold;
  const Sd = C.orange;
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
    floorDark:  hex('#2a2823'),
    floorMid:   hex('#35332e'),
    floorLight: hex('#413e37'),
    wallDark:   hex('#504b44'),
    wallMid:    hex('#645f55'),
    wallLight:  hex('#736e64'),
    wallTop:    hex('#7d766c'),
    doorMid:    hex('#6a7a8a'),
    doorDark:   hex('#505f6e'),
    doorLight:  hex('#8291a0'),
    voidColor:  hex('#0f0e0c'),
    water1:     hex('#232a20'),
    water2:     hex('#303728'),
    water3:     hex('#3a4430'),
    teal:       C.teal,
    purple:     hex('#82643c'),
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
    floorDark:  hex('#1c261c'),
    floorMid:   hex('#252e25'),
    floorLight: hex('#303a2d'),
    wallDark:   hex('#374632'),
    wallMid:    hex('#4a5a45'),
    wallLight:  hex('#586950'),
    wallTop:    hex('#5f7058'),
    doorMid:    hex('#8a7a30'),
    doorDark:   hex('#64581e'),
    doorLight:  hex('#a5943c'),
    voidColor:  hex('#0a100a'),
    water1:     hex('#142d12'),
    water2:     hex('#23411c'),
    water3:     hex('#325526'),
    teal:       hex('#32aa64'),
    purple:     hex('#643c82'),
    contamGreen: hex('#50a03c'),
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
    floorDark:  hex('#1e1c1c'),
    floorMid:   hex('#2a2828'),
    floorLight: hex('#373432'),
    wallDark:   hex('#443732'),
    wallMid:    hex('#5a4a45'),
    wallLight:  hex('#695852'),
    wallTop:    hex('#705f58'),
    doorMid:    hex('#6a5c4e'),
    doorDark:   hex('#4b3e32'),
    doorLight:  hex('#82705f'),
    voidColor:  hex('#080808'),
    water1:     hex('#161c23'),
    water2:     hex('#202832'),
    water3:     hex('#2a3441'),
    teal:       hex('#328c82'),
    purple:     hex('#643c50'),
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
