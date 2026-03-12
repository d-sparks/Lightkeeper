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

// ---- Art-style post-processing for entity sprites ----

// Add 1-pixel Void Black outline around all opaque regions.
// Per art-style-guide: "1-pixel black outline separates sprites from environment."
function addOutline(png) {
  const { width, height } = png;
  const original = Buffer.from(png.data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (original[idx + 3] > 0) continue; // only process transparent pixels
      // If any cardinal neighbor is opaque, paint this pixel Void Black
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          const nIdx = (ny * width + nx) * 4;
          if (original[nIdx + 3] > 128) {
            png.data[idx]     = 0x0a; // Void Black R
            png.data[idx + 1] = 0x0a; // Void Black G
            png.data[idx + 2] = 0x0f; // Void Black B
            png.data[idx + 3] = 255;
            break;
          }
        }
      }
    }
  }
}

// Apply a top-left lighting pass to opaque pixels.
// Per art-style-guide: "top-left light source (~10 o'clock), highlights on
// upper-left, shadows on lower-right."
// Only affects pixels at opaque/transparent boundaries (surface pixels).
function applyTopLeftLighting(png) {
  const { width, height } = png;
  const original = Buffer.from(png.data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (original[idx + 3] < 128) continue; // skip transparent
      const topEmpty  = y === 0          || original[((y - 1) * width + x) * 4 + 3] < 128;
      const leftEmpty = x === 0          || original[(y * width + (x - 1)) * 4 + 3] < 128;
      const botEmpty  = y === height - 1 || original[((y + 1) * width + x) * 4 + 3] < 128;
      const rightEmpty = x === width - 1 || original[(y * width + (x + 1)) * 4 + 3] < 128;
      // Top-left facing surfaces get highlights; bottom-right shadows
      let delta = 0;
      if (topEmpty)   delta += 28;
      if (leftEmpty)  delta += 18;
      if (botEmpty)   delta -= 22;
      if (rightEmpty) delta -= 12;
      if (delta !== 0) {
        png.data[idx]     = Math.min(255, Math.max(0, original[idx]     + delta));
        png.data[idx + 1] = Math.min(255, Math.max(0, original[idx + 1] + delta));
        png.data[idx + 2] = Math.min(255, Math.max(0, original[idx + 2] + delta));
      }
    }
  }
}

// Clone a PNG so we can modify it without affecting the original
function clonePNG(src) {
  const dst = createPNG(src.width, src.height);
  src.data.copy(dst.data);
  return dst;
}

// Create a copy of a 16x16 sprite shifted by (dx, dy) pixels
function createShiftedFrame(src, dx, dy) {
  const frame = createPNG(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const srcX = x - dx;
      const srcY = y - dy;
      if (srcX >= 0 && srcX < 16 && srcY >= 0 && srcY < 16) {
        const srcIdx = (srcY * 16 + srcX) * 4;
        const dstIdx = (y * 16 + x) * 4;
        frame.data[dstIdx]     = src.data[srcIdx];
        frame.data[dstIdx + 1] = src.data[srcIdx + 1];
        frame.data[dstIdx + 2] = src.data[srcIdx + 2];
        frame.data[dstIdx + 3] = src.data[srcIdx + 3];
      }
    }
  }
  return frame;
}

// Copy a processed 16x16 frame into a horizontal strip at the given frame index
function copyFrameToStrip(frame, strip, frameIndex) {
  const stripW = strip.width;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const srcIdx = (y * 16 + x) * 4;
      const dstIdx = (y * stripW + (frameIndex * 16 + x)) * 4;
      strip.data[dstIdx]     = frame.data[srcIdx];
      strip.data[dstIdx + 1] = frame.data[srcIdx + 1];
      strip.data[dstIdx + 2] = frame.data[srcIdx + 2];
      strip.data[dstIdx + 3] = frame.data[srcIdx + 3];
    }
  }
}

function savePNG(png, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const isEntity = filePath.includes(`${path.sep}sprites${path.sep}`) || filePath.includes('/sprites/');
  if (isEntity) {
    // Generate 4-frame animation strip:
    //   Frame 0: idle pose 1 (base)
    //   Frame 1: idle pose 2 (bob — shift up 1px)
    //   Frame 2: attack (lunge — shift right 2px, up 1px)
    //   Frame 3: hit (recoil — shift left 1px)
    const frames = [
      clonePNG(png),                     // idle 1
      createShiftedFrame(png, 0, -1),    // idle 2 (bob up)
      createShiftedFrame(png, 2, -1),    // attack (lunge right + up)
      createShiftedFrame(png, -1, 0),    // hit (recoil left)
    ];
    // Apply art-style post-processing to each frame individually
    for (const f of frames) {
      applyTopLeftLighting(f);
      addOutline(f);
    }
    // Assemble into horizontal strip (64x16)
    const strip = createPNG(64, 16);
    for (let i = 0; i < 4; i++) {
      copyFrameToStrip(frames[i], strip, i);
    }
    const buffer = PNG.sync.write(strip);
    fs.writeFileSync(filePath, buffer);
    console.log(`  wrote ${filePath} (4-frame strip)`);
  } else {
    const buffer = PNG.sync.write(png);
    fs.writeFileSync(filePath, buffer);
    console.log(`  wrote ${filePath}`);
  }
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
const Oe = C.orange;     // hostile warm eyes
const Lr = C.lightRed;   // highlight for red items
const SG = C.solGold;    // sol unit glow
const H = C.gray;        // helmet/armor main
const Hd = C.midGray;    // helmet/armor dark
const Hl = C.lightGray;  // helmet highlight

// ============================================================================
// TILESET: Crypt (10 tiles in a horizontal strip: 160x16)
// Tile order by ID: 0=void, 1=stone_floor, 2=cracked_floor, 3=stone_wall,
//   4=door_closed, 5=door_open, 6=stairs_down, 7=water, 8=stairs_up, 9=locked_door
// ============================================================================

function generateCryptTileset() {
  const png = createPNG(640, 16); // 40 tiles × 16px

  // --- Tile 0: Void (cold blue-black, oppressive ancient dark) ---
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = 8 + ((x * 7 + y * 13) % 5);
      setPixel(png, x, y, rgba(Math.floor(v * 0.7), Math.floor(v * 0.75), v));
    }
  }

  // --- Tile 1: Stone Floor (dark flagstones with mortar lines) ---
  const ox1 = 16;
  fillRect(png, ox1, 0, 16, 16, C.floorMid);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox1 + i, 7, C.floorDark);
    setPixel(png, ox1 + 7, i, C.floorDark);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox1 + i, 0, C.floorLight);
    setPixel(png, ox1, i, C.floorLight);
    setPixel(png, ox1 + 8 + i, 8, C.floorLight);
    setPixel(png, ox1 + 8, 8 + i, C.floorLight);
  }
  setPixel(png, ox1 + 3, 3, C.floorLight);
  setPixel(png, ox1 + 11, 12, C.floorLight);
  setPixel(png, ox1 + 5, 10, C.floorDark);
  setPixel(png, ox1 + 13, 4, C.floorDark);

  // --- Tile 2: Cracked Floor (stone floor with diagonal crack) ---
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
  const crackPixels = [[3,2],[4,3],[4,4],[5,5],[6,6],[5,7],[6,8],[7,9],[8,10],[9,11],[10,11],[11,12],[12,13]];
  for (const [cx, cy] of crackPixels) setPixel(png, ox2 + cx, cy, C.darkGray);

  // --- Tile 3: Stone Wall (ancient burial chamber, cold crypt aesthetic) ---
  const ox3 = 48;
  fillRect(png, ox3, 0, 16, 16, C.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 0, C.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 15, C.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + 15, i, C.wallDark);
  const stoneLight = [[2,2],[3,4],[7,2],[10,3],[13,5],[5,7],[9,6],[1,9],[6,11],[11,8],[3,13],[8,13]];
  const stoneDark  = [[5,3],[1,5],[8,4],[11,6],[4,8],[7,10],[2,11],[10,9],[13,12],[6,14],[9,12],[12,2]];
  for (const [sx, sy] of stoneLight) setPixel(png, ox3 + sx, sy, C.wallLight);
  for (const [sx, sy] of stoneDark)  setPixel(png, ox3 + sx, sy, C.wallDark);
  const boneSpecks = [[4,6],[11,4],[2,13],[9,10]];
  for (const [bx, by] of boneSpecks) setPixel(png, ox3 + bx, by, C.bone);
  setPixel(png, ox3 + 7, 5, C.lightGray);

  // --- Tile 4: Door Closed (iron-banded stone, teal ring) ---
  const ox4 = 64;
  fillRect(png, ox4, 0, 16, 16, C.midGray);
  fillRect(png, ox4, 0, 1, 16, C.darkGray);
  fillRect(png, ox4 + 15, 0, 1, 16, C.darkGray);
  fillRect(png, ox4 + 1, 0, 14, 1, C.darkGray);
  fillRect(png, ox4 + 1, 15, 14, 1, C.darkGray);
  fillRect(png, ox4 + 1, 3, 14, 2, C.gray);
  fillRect(png, ox4 + 1, 11, 14, 2, C.gray);
  for (let vy = 0; vy < 16; vy++) setPixel(png, ox4 + 7, vy, C.darkGray);
  setPixel(png, ox4 + 3, 4, C.lightGray); setPixel(png, ox4 + 12, 4, C.lightGray);
  setPixel(png, ox4 + 3, 12, C.lightGray); setPixel(png, ox4 + 12, 12, C.lightGray);
  setPixel(png, ox4 + 12, 7, C.teal); setPixel(png, ox4 + 12, 8, C.teal);

  // --- Tile 5: Door Open (recessed dark opening with frame) ---
  const ox5 = 80;
  fillRect(png, ox5, 0, 16, 16, C.floorDark);
  fillRect(png, ox5, 0, 2, 16, C.darkBrown);
  fillRect(png, ox5 + 14, 0, 2, 16, C.darkBrown);
  fillRect(png, ox5 + 4, 2, 8, 12, rgba(25, 25, 40));

  // --- Tile 6: Stairs Down (descending steps, teal glow arrow) ---
  const ox6 = 96;
  fillRect(png, ox6, 0, 16, 16, C.floorMid);
  fillRect(png, ox6 + 2, 2, 12, 3, C.floorLight);
  fillRect(png, ox6 + 3, 5, 10, 3, C.floorMid);
  fillRect(png, ox6 + 4, 8, 8, 3, C.floorDark);
  fillRect(png, ox6 + 5, 11, 6, 3, rgba(15, 18, 30));
  setPixel(png, ox6 + 7, 13, C.lightTeal); setPixel(png, ox6 + 8, 13, C.lightTeal);
  setPixel(png, ox6 + 6, 12, C.lightTeal); setPixel(png, ox6 + 9, 12, C.lightTeal);

  // --- Tile 7: Water (dark blue with wave highlights) ---
  const ox7 = 112;
  fillRect(png, ox7, 0, 16, 16, C.water1);
  const wavePixels = [[2,3],[3,3],[4,3],[8,5],[9,5],[10,5],[1,9],[2,9],[3,9],[7,11],[8,11],[9,11],[12,7],[13,7],[4,14],[5,14]];
  for (const [wx, wy] of wavePixels) setPixel(png, ox7 + wx, wy, C.water2);
  const waveHighPixels = [[3,2],[9,4],[2,8],[8,10],[13,6],[5,13]];
  for (const [wx, wy] of waveHighPixels) setPixel(png, ox7 + wx, wy, C.water3);

  // --- Tile 8: Stairs Up (ascending steps, bone-white arrow) ---
  const ox8 = 128;
  fillRect(png, ox8, 0, 16, 16, C.floorMid);
  fillRect(png, ox8 + 5, 2, 6, 3, rgba(15, 18, 30));
  fillRect(png, ox8 + 4, 5, 8, 3, C.floorDark);
  fillRect(png, ox8 + 3, 8, 10, 3, C.floorMid);
  fillRect(png, ox8 + 2, 11, 12, 3, C.floorLight);
  setPixel(png, ox8 + 7, 1, C.bone); setPixel(png, ox8 + 8, 1, C.bone);
  setPixel(png, ox8 + 6, 2, C.bone); setPixel(png, ox8 + 9, 2, C.bone);

  // --- Tile 9: Locked Door (iron-banded stone with Sol Gold lock) ---
  const ox9 = 144;
  fillRect(png, ox9, 0, 16, 16, C.midGray);
  fillRect(png, ox9, 0, 1, 16, C.darkGray);
  fillRect(png, ox9 + 15, 0, 1, 16, C.darkGray);
  fillRect(png, ox9 + 1, 0, 14, 1, C.darkGray);
  fillRect(png, ox9 + 1, 15, 14, 1, C.darkGray);
  fillRect(png, ox9 + 1, 3, 14, 2, C.gray);
  fillRect(png, ox9 + 1, 11, 14, 2, C.gray);
  for (let vy = 0; vy < 16; vy++) setPixel(png, ox9 + 7, vy, C.darkGray);
  setPixel(png, ox9 + 3, 4, C.lightGray); setPixel(png, ox9 + 12, 4, C.lightGray);
  setPixel(png, ox9 + 3, 12, C.lightGray); setPixel(png, ox9 + 12, 12, C.lightGray);
  fillRect(png, ox9 + 6, 6, 4, 4, C.solGold);
  setPixel(png, ox9 + 7, 7, C.darkGray); setPixel(png, ox9 + 8, 7, C.darkGray);
  setPixel(png, ox9 + 7, 8, C.darkGray);

  // --- Tile 10: Chest Closed (stone chest, bone corner studs, Sol Gold lock) ---
  const ox10 = 160;
  fillRect(png, ox10, 0, 1, 16, C.wallDark);
  fillRect(png, ox10 + 15, 0, 1, 16, C.wallDark);
  fillRect(png, ox10 + 1, 0, 14, 16, C.midGray);
  fillRect(png, ox10 + 1, 0, 14, 5, C.wallMid);       // lid
  fillRect(png, ox10 + 1, 5, 14, 1, C.darkGray);       // lid seam
  fillRect(png, ox10 + 1, 14, 14, 2, C.wallDark);      // bottom shadow
  for (let i = 2; i < 14; i++) setPixel(png, ox10 + i, 1, C.wallLight); // lid highlight
  setPixel(png, ox10 + 2, 1, C.bone); setPixel(png, ox10 + 13, 1, C.bone); // corner studs
  setPixel(png, ox10 + 2, 13, C.bone); setPixel(png, ox10 + 13, 13, C.bone);
  fillRect(png, ox10 + 6, 7, 4, 4, C.solGold);         // Sol Gold lock
  setPixel(png, ox10 + 7, 8, C.darkGray); setPixel(png, ox10 + 8, 8, C.darkGray);

  // --- Tile 11: Chest Opened (dark interior, bone corner studs, open rim) ---
  const ox11 = 176;
  fillRect(png, ox11, 0, 1, 16, C.wallDark);
  fillRect(png, ox11 + 15, 0, 1, 16, C.wallDark);
  fillRect(png, ox11 + 1, 0, 14, 16, C.midGray);
  fillRect(png, ox11 + 1, 14, 14, 2, C.wallDark);
  fillRect(png, ox11 + 2, 1, 12, 10, C.darkGray);      // open interior
  fillRect(png, ox11 + 3, 2, 10, 8, rgba(18, 18, 28));
  setPixel(png, ox11 + 2, 12, C.bone); setPixel(png, ox11 + 13, 12, C.bone);
  for (let i = 2; i < 14; i++) setPixel(png, ox11 + i, 0, C.bone); // open rim

  // --- Tile 12: Sealed Gate (iron bars, teal phosphorescent seal) ---
  const ox12 = 192;
  fillRect(png, ox12, 0, 16, 16, C.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox12 + bar, 0, 2, 16, C.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox12 + bar, i, C.wallDark);
  }
  fillRect(png, ox12, 7, 16, 2, C.wallMid);
  setPixel(png, ox12 + 7, 8, C.teal); setPixel(png, ox12 + 8, 8, C.teal);

  // --- Tile 13: Sealed Gate Workshop (Sol Gold indicator — weapon required) ---
  const ox13 = 208;
  fillRect(png, ox13, 0, 16, 16, C.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox13 + bar, 0, 2, 16, C.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox13 + bar, i, C.wallDark);
  }
  fillRect(png, ox13, 7, 16, 2, C.wallMid);
  setPixel(png, ox13 + 7, 8, C.solGold); setPixel(png, ox13 + 8, 8, C.solGold);

  // --- Tile 14: Sealed Gate Charger (light teal — Sol unit required) ---
  const ox14 = 224;
  fillRect(png, ox14, 0, 16, 16, C.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox14 + bar, 0, 2, 16, C.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox14 + bar, i, C.wallDark);
  }
  fillRect(png, ox14, 7, 16, 2, C.wallMid);
  setPixel(png, ox14 + 7, 8, C.lightTeal); setPixel(png, ox14 + 8, 8, C.lightTeal);

  // --- Tile 15: Hidden Passage (looks like wall, faint vertical seam) ---
  const ox15 = 240;
  fillRect(png, ox15, 0, 16, 16, C.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox15 + i, 0, C.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox15 + i, 15, C.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox15 + 15, i, C.wallDark);
  for (let i = 1; i < 15; i++) setPixel(png, ox15 + 8, i, C.wallLight); // subtle seam
  const hp15L = [[2,3],[6,2],[10,4],[4,9],[1,11]];
  const hp15D = [[5,4],[1,6],[9,3],[3,10],[11,8]];
  for (const [sx, sy] of hp15L) setPixel(png, ox15 + sx, sy, C.wallLight);
  for (const [sx, sy] of hp15D) setPixel(png, ox15 + sx, sy, C.wallDark);

  // --- Tile 16: Blast Door (heavy reinforced, near-black, thick bands) ---
  const ox16 = 256;
  fillRect(png, ox16, 0, 16, 16, C.darkGray);
  fillRect(png, ox16 + 1, 1, 14, 14, C.midGray);
  fillRect(png, ox16 + 1, 1, 14, 2, C.gray);   // top band
  fillRect(png, ox16 + 1, 6, 14, 2, C.gray);   // mid band
  fillRect(png, ox16 + 1, 11, 14, 2, C.gray);  // lower band
  fillRect(png, ox16 + 7, 1, 2, 14, C.darkGray); // bold center seam
  setPixel(png, ox16 + 2, 2, C.lightGray); setPixel(png, ox16 + 13, 2, C.lightGray);
  setPixel(png, ox16 + 2, 13, C.lightGray); setPixel(png, ox16 + 13, 13, C.lightGray);

  // --- Tile 17: Junction Box B (wall panel with status indicators) ---
  const ox17 = 272;
  fillRect(png, ox17, 0, 16, 16, C.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox17 + i, 0, C.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox17 + i, 15, C.wallDark);
  fillRect(png, ox17 + 3, 4, 10, 8, C.darkGray);   // panel inset
  fillRect(png, ox17 + 4, 5, 8, 6, C.midGray);
  setPixel(png, ox17 + 5, 7, C.teal);     // active indicator
  setPixel(png, ox17 + 7, 7, C.solGold);  // power indicator
  setPixel(png, ox17 + 9, 7, C.lightGray); // neutral indicator

  // --- Tile 18: Maintenance Hatch (floor with hatch outline, teal handle) ---
  const ox18 = 288;
  fillRect(png, ox18, 0, 16, 16, C.floorMid);
  fillRect(png, ox18 + 2, 2, 12, 1, C.wallMid); fillRect(png, ox18 + 2, 13, 12, 1, C.wallMid);
  fillRect(png, ox18 + 2, 2, 1, 12, C.wallMid); fillRect(png, ox18 + 13, 2, 1, 12, C.wallMid);
  fillRect(png, ox18 + 3, 3, 10, 10, C.floorDark);
  setPixel(png, ox18 + 7, 7, C.teal); setPixel(png, ox18 + 8, 7, C.teal);
  setPixel(png, ox18 + 7, 8, C.teal); setPixel(png, ox18 + 8, 8, C.teal);

  // --- Tile 19: Transit Gate (framed turnstile, blue indicator) ---
  const ox19 = 304;
  fillRect(png, ox19, 0, 16, 16, C.floorDark);
  fillRect(png, ox19, 0, 2, 16, C.wallMid);
  fillRect(png, ox19 + 14, 0, 2, 16, C.wallMid);
  fillRect(png, ox19 + 2, 0, 12, 2, C.wallMid);
  fillRect(png, ox19 + 2, 14, 12, 2, C.wallMid);
  fillRect(png, ox19 + 7, 2, 2, 12, C.gray);    // vertical bar
  fillRect(png, ox19 + 2, 7, 12, 2, C.gray);    // horizontal bar
  setPixel(png, ox19 + 12, 3, C.blue); setPixel(png, ox19 + 12, 4, C.blue);

  // --- Tile 20: Garden Plot (dark soil with green growth hints) ---
  const ox20 = 320;
  fillRect(png, ox20, 0, 16, 16, hex('#1a1a12'));
  const soilL = [[2,2],[5,1],[9,3],[12,2],[1,6],[7,5],[14,4],[3,8],[10,7],[6,10],[13,9],[2,13],[11,12]];
  const soilD = [[4,3],[8,2],[11,4],[3,6],[6,7],[9,9],[1,11],[7,12],[12,11],[5,14]];
  for (const [sx, sy] of soilL) setPixel(png, ox20 + sx, sy, C.darkBrown);
  for (const [sx, sy] of soilD) setPixel(png, ox20 + sx, sy, C.darkGray);
  const sprouts = [[3,1],[8,0],[12,1],[5,3],[10,4],[1,7],[13,6]];
  for (const [gx, gy] of sprouts) setPixel(png, ox20 + gx, gy, C.darkGreen);

  // --- Tile 21: Notice Board (dark frame, parchment face with text lines) ---
  const ox21 = 336;
  fillRect(png, ox21, 0, 16, 16, C.wallMid);
  fillRect(png, ox21 + 2, 1, 12, 13, C.darkBrown);
  fillRect(png, ox21 + 3, 2, 10, 11, C.tan);
  fillRect(png, ox21 + 4, 4, 8, 1, C.bone);
  fillRect(png, ox21 + 4, 6, 8, 1, C.bone);
  fillRect(png, ox21 + 4, 8, 6, 1, C.bone);
  fillRect(png, ox21 + 4, 10, 7, 1, C.bone);

  // --- Tile 22: Seed Pot (clay pot on floor, green sprout) ---
  const ox22 = 352;
  fillRect(png, ox22, 0, 16, 16, C.floorMid);
  fillRect(png, ox22 + 3, 10, 10, 5, C.brown);
  fillRect(png, ox22 + 4, 9, 8, 2, hex('#1a1a12'));  // soil
  fillRect(png, ox22 + 3, 10, 10, 1, C.tan);          // rim highlight
  fillRect(png, ox22 + 4, 14, 8, 1, C.darkBrown);     // base shadow
  setPixel(png, ox22 + 8, 8, C.darkGreen); setPixel(png, ox22 + 7, 7, C.darkGreen);
  setPixel(png, ox22 + 9, 7, C.green); setPixel(png, ox22 + 7, 6, C.green);

  // --- Tile 23: Personal Log (book with parchment pages) ---
  const ox23 = 368;
  fillRect(png, ox23, 0, 16, 16, C.floorMid);
  fillRect(png, ox23 + 3, 2, 10, 12, C.darkBrown);    // cover
  fillRect(png, ox23 + 3, 2, 2, 12, C.brown);          // spine
  fillRect(png, ox23 + 5, 2, 8, 12, hex('#d0c8b0'));   // parchment pages
  fillRect(png, ox23 + 6, 4, 6, 1, C.darkBrown);
  fillRect(png, ox23 + 6, 6, 6, 1, C.darkBrown);
  fillRect(png, ox23 + 6, 8, 5, 1, C.darkBrown);
  fillRect(png, ox23 + 6, 10, 6, 1, C.darkBrown);
  setPixel(png, ox23 + 3, 2, C.tan); setPixel(png, ox23 + 3, 3, C.tan);

  // --- Tile 24: Homestead Gate (thin iron bars, teal accent tips) ---
  const ox24 = 384;
  fillRect(png, ox24, 0, 16, 16, C.floorDark);
  for (let bar = 2; bar <= 14; bar += 3) fillRect(png, ox24 + bar, 0, 1, 16, C.gray);
  fillRect(png, ox24 + 1, 2, 14, 2, C.gray);    // top rail
  fillRect(png, ox24 + 1, 12, 14, 2, C.gray);   // bottom rail
  for (let bar = 2; bar <= 14; bar += 3) setPixel(png, ox24 + bar, 0, C.teal); // teal tips

  // --- Tile 25: Cache Entrance (collapsed rubble, dark recess) ---
  const ox25 = 400;
  fillRect(png, ox25, 0, 16, 16, C.wallMid);
  fillRect(png, ox25 + 5, 5, 6, 6, C.darkGray);  // collapsed gap
  fillRect(png, ox25 + 6, 6, 4, 4, rgba(15, 15, 25));
  const rubble = [[1,14],[2,13],[3,14],[4,15],[5,13],[6,14],[7,12],[8,13],[9,14],[10,12],[11,13],[12,14],[13,15],[14,13]];
  for (const [rx, ry] of rubble) setPixel(png, ox25 + rx, ry, C.wallDark);
  setPixel(png, ox25 + 5, 5, C.wallLight); setPixel(png, ox25 + 10, 5, C.wallLight);
  setPixel(png, ox25 + 5, 10, C.bone); // bone fragment visible in rubble

  // --- Tile 26: Resonance Point (Sol Gold/teal radiant glow on floor) ---
  const ox26 = 416;
  fillRect(png, ox26, 0, 16, 16, C.floorMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox26 + i, 7, C.floorDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox26 + 7, i, C.floorDark);
  setPixel(png, ox26 + 8, 8, C.solGold); // bright center
  setPixel(png, ox26 + 7, 8, C.teal); setPixel(png, ox26 + 9, 8, C.teal);
  setPixel(png, ox26 + 8, 7, C.teal); setPixel(png, ox26 + 8, 9, C.teal);
  setPixel(png, ox26 + 6, 8, C.darkTeal); setPixel(png, ox26 + 10, 8, C.darkTeal);
  setPixel(png, ox26 + 8, 6, C.darkTeal); setPixel(png, ox26 + 8, 10, C.darkTeal);

  // --- Tile 27: Survey Marker (floor with bone-white post/stake) ---
  const ox27 = 432;
  fillRect(png, ox27, 0, 16, 16, C.floorMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox27 + i, 7, C.floorDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox27 + 7, i, C.floorDark);
  fillRect(png, ox27 + 7, 3, 2, 9, C.bone);    // post
  fillRect(png, ox27 + 6, 3, 4, 2, C.bone);    // top cap
  setPixel(png, ox27 + 7, 2, C.lightGray);      // tip highlight
  fillRect(png, ox27 + 5, 11, 6, 2, C.darkBone); // base anchor

  // --- Tile 28: Sealed Gate Briefing (Sol Gold pair indicator) ---
  const ox28 = 448;
  fillRect(png, ox28, 0, 16, 16, C.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox28 + bar, 0, 2, 16, C.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox28 + bar, i, C.wallDark);
  }
  fillRect(png, ox28, 7, 16, 2, C.wallMid);
  setPixel(png, ox28 + 6, 8, C.solGold); setPixel(png, ox28 + 9, 8, C.solGold);

  // --- Tile 29: Sealed Gate Training (teal pair indicator) ---
  const ox29 = 464;
  fillRect(png, ox29, 0, 16, 16, C.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox29 + bar, 0, 2, 16, C.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox29 + bar, i, C.wallDark);
  }
  fillRect(png, ox29, 7, 16, 2, C.wallMid);
  setPixel(png, ox29 + 6, 8, C.teal); setPixel(png, ox29 + 9, 8, C.teal);

  // --- Tile 30: Crate Closed (wooden supply crate with stamp marking) ---
  const ox30 = 480;
  fillRect(png, ox30, 0, 16, 1, C.darkGray);
  fillRect(png, ox30, 0, 1, 16, C.darkGray);
  fillRect(png, ox30 + 15, 0, 1, 16, C.darkGray);
  fillRect(png, ox30, 15, 16, 1, C.darkGray);
  fillRect(png, ox30 + 1, 1, 14, 14, C.brown);
  fillRect(png, ox30 + 1, 5, 14, 1, C.darkBrown);  // horizontal slat
  fillRect(png, ox30 + 1, 10, 14, 1, C.darkBrown);
  fillRect(png, ox30 + 7, 1, 1, 14, C.darkBrown);  // vertical slat
  for (let i = 2; i < 14; i++) setPixel(png, ox30 + i, 1, C.tan); // lid highlight
  fillRect(png, ox30 + 9, 6, 3, 3, C.tan); // stamp marking

  // --- Tile 31: Crate Opened (open supply crate, dark interior) ---
  const ox31 = 496;
  fillRect(png, ox31, 0, 16, 1, C.darkGray);
  fillRect(png, ox31, 0, 1, 16, C.darkGray);
  fillRect(png, ox31 + 15, 0, 1, 16, C.darkGray);
  fillRect(png, ox31, 15, 16, 1, C.darkGray);
  fillRect(png, ox31 + 1, 1, 14, 14, C.brown);
  fillRect(png, ox31 + 1, 5, 14, 1, C.darkBrown);
  fillRect(png, ox31 + 7, 1, 1, 14, C.darkBrown);
  fillRect(png, ox31 + 2, 2, 12, 8, C.darkGray);   // open interior
  fillRect(png, ox31 + 3, 3, 10, 6, rgba(15, 12, 10));
  for (let i = 2; i < 14; i++) setPixel(png, ox31 + i, 1, C.tan);

  // --- Tile 32: Elevated Floor (slightly lighter stone floor variant) ---
  const ox32 = 512;
  fillRect(png, ox32, 0, 16, 16, C.floorLight);
  for (let i = 0; i < 16; i++) {
    setPixel(png, ox32 + i, 7, C.floorMid);
    setPixel(png, ox32 + 7, i, C.floorMid);
  }
  for (let i = 0; i < 7; i++) {
    setPixel(png, ox32 + i, 0, C.wallDark);
    setPixel(png, ox32, i, C.wallDark);
  }
  setPixel(png, ox32 + 4, 4, C.wallDark);
  setPixel(png, ox32 + 11, 11, C.floorLight);

  // --- Tile 33: Ramp North (bright at bottom, dark at top) ---
  const ox33 = 528;
  for (let y = 0; y < 16; y++) {
    const t = y / 15;
    const r = Math.round(C.floorLight.r * t + C.floorDark.r * (1 - t));
    const g = Math.round(C.floorLight.g * t + C.floorDark.g * (1 - t));
    const b = Math.round(C.floorLight.b * t + C.floorDark.b * (1 - t));
    for (let x = 0; x < 16; x++) setPixel(png, ox33 + x, y, rgba(r, g, b));
  }
  setPixel(png, ox33 + 8, 3, C.wallLight); setPixel(png, ox33 + 7, 4, C.wallLight);
  setPixel(png, ox33 + 8, 4, C.wallLight); setPixel(png, ox33 + 9, 4, C.wallLight);
  setPixel(png, ox33 + 8, 5, C.wallLight); setPixel(png, ox33 + 8, 6, C.wallLight);

  // --- Tile 34: Ramp South (dark at bottom, bright at top) ---
  const ox34 = 544;
  for (let y = 0; y < 16; y++) {
    const t = (15 - y) / 15;
    const r = Math.round(C.floorLight.r * t + C.floorDark.r * (1 - t));
    const g = Math.round(C.floorLight.g * t + C.floorDark.g * (1 - t));
    const b = Math.round(C.floorLight.b * t + C.floorDark.b * (1 - t));
    for (let x = 0; x < 16; x++) setPixel(png, ox34 + x, y, rgba(r, g, b));
  }
  setPixel(png, ox34 + 8, 13, C.wallLight); setPixel(png, ox34 + 7, 12, C.wallLight);
  setPixel(png, ox34 + 8, 12, C.wallLight); setPixel(png, ox34 + 9, 12, C.wallLight);
  setPixel(png, ox34 + 8, 11, C.wallLight); setPixel(png, ox34 + 8, 10, C.wallLight);

  // --- Tile 35: Ramp East (bright at left, dark at right) ---
  const ox35 = 560;
  for (let x = 0; x < 16; x++) {
    const t = x / 15;
    const r = Math.round(C.floorDark.r * t + C.floorLight.r * (1 - t));
    const g = Math.round(C.floorDark.g * t + C.floorLight.g * (1 - t));
    const b = Math.round(C.floorDark.b * t + C.floorLight.b * (1 - t));
    for (let y = 0; y < 16; y++) setPixel(png, ox35 + x, y, rgba(r, g, b));
  }
  setPixel(png, ox35 + 13, 8, C.wallLight); setPixel(png, ox35 + 12, 7, C.wallLight);
  setPixel(png, ox35 + 12, 8, C.wallLight); setPixel(png, ox35 + 12, 9, C.wallLight);
  setPixel(png, ox35 + 11, 8, C.wallLight); setPixel(png, ox35 + 10, 8, C.wallLight);

  // --- Tile 36: Ramp West (dark at left, bright at right) ---
  const ox36 = 576;
  for (let x = 0; x < 16; x++) {
    const t = (15 - x) / 15;
    const r = Math.round(C.floorDark.r * t + C.floorLight.r * (1 - t));
    const g = Math.round(C.floorDark.g * t + C.floorLight.g * (1 - t));
    const b = Math.round(C.floorDark.b * t + C.floorLight.b * (1 - t));
    for (let y = 0; y < 16; y++) setPixel(png, ox36 + x, y, rgba(r, g, b));
  }
  setPixel(png, ox36 + 3, 8, C.wallLight); setPixel(png, ox36 + 4, 7, C.wallLight);
  setPixel(png, ox36 + 4, 8, C.wallLight); setPixel(png, ox36 + 4, 9, C.wallLight);
  setPixel(png, ox36 + 5, 8, C.wallLight); setPixel(png, ox36 + 6, 8, C.wallLight);

  // --- Tile 37: Full Wall (same look as stone_wall, full-height variant) ---
  const ox37 = 592;
  fillRect(png, ox37, 0, 16, 16, C.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox37 + i, 0, C.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox37 + i, 15, C.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox37 + 15, i, C.wallDark);
  const fw37L = [[1,3],[4,1],[8,3],[12,2],[6,6],[2,8],[10,7],[3,11],[9,10],[13,8],[5,13],[11,12]];
  const fw37D = [[6,2],[2,5],[9,4],[13,6],[4,9],[8,11],[1,12],[10,13],[12,10],[7,14]];
  for (const [sx, sy] of fw37L) setPixel(png, ox37 + sx, sy, C.wallLight);
  for (const [sx, sy] of fw37D) setPixel(png, ox37 + sx, sy, C.wallDark);
  setPixel(png, ox37 + 7, 6, C.bone); // embedded bone fragment

  // --- Tile 38: Elevated Wall (darker base, raised platform edge) ---
  const ox38 = 608;
  fillRect(png, ox38, 0, 16, 16, C.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox38 + i, 0, C.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox38 + i, 15, C.darkGray);
  for (let i = 0; i < 16; i++) setPixel(png, ox38 + 15, i, C.darkGray);
  const ew38L = [[3,3],[7,2],[11,4],[2,7],[8,6],[5,10],[12,8],[4,13],[9,11]];
  const ew38D = [[5,4],[1,6],[10,3],[13,7],[3,9],[7,11],[11,10],[2,13]];
  for (const [sx, sy] of ew38L) setPixel(png, ox38 + sx, sy, C.wallMid);
  for (const [sx, sy] of ew38D) setPixel(png, ox38 + sx, sy, C.darkGray);

  // --- Tile 39: Cracked Wall (stone wall with diagonal fracture lines) ---
  const ox39 = 624;
  fillRect(png, ox39, 0, 16, 16, C.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox39 + i, 0, C.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox39 + i, 15, C.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox39 + 15, i, C.wallDark);
  const cw39L = [[2,2],[10,3],[5,7],[13,5],[1,9],[8,13]];
  const cw39D = [[5,3],[1,5],[8,4],[4,8],[11,6],[3,13]];
  for (const [sx, sy] of cw39L) setPixel(png, ox39 + sx, sy, C.wallLight);
  for (const [sx, sy] of cw39D) setPixel(png, ox39 + sx, sy, C.wallDark);
  const crack39 = [[4,1],[4,2],[5,3],[5,4],[6,5],[7,5],[8,6],[8,7],[9,8],[9,9],[10,10],[10,11],[11,12],[11,13]];
  for (const [cx, cy] of crack39) setPixel(png, ox39 + cx, cy, C.darkGray);
  const crack39b = [[6,6],[7,7],[6,8],[7,9]]; // secondary branch
  for (const [cx, cy] of crack39b) setPixel(png, ox39 + cx, cy, C.darkGray);

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
    [_, _, _, _, _, B,Oe, B, B,Oe, B, _, _, _, _, _],  // 3  orange eyes (hostile)
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
    [_, _, _, _, _, B,Oe, B, B,Oe, B, _, _, _, _, _],
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
    [_, _, _, _, _, S, R, S, S, R, S, _, _, _, _, _],
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
    [_, _, _, _, _,Hd,Oe,Hk,Hk,Oe,Hd, _, _, _, _, _],
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
    [_, _, _, _, _,Ar,Oe,Ar,Ar,Oe,Ar, _, _, _, _, _],
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

  // --- Shadow Ambusher: flowing dark cloak, orange hostile eyes, trailing shadow point ---
  const ambusher = createPNG(16, 16);
  const Sh = C.darkSlate;
  const Sd2 = C.black;
  const Ey = C.lightPurple;
  const ShM = C.midGray;
  drawPixelArt(ambusher, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _,Sd2, Sh, Sh, Sh, Sh,Sd2, _, _, _, _, _],  // deep hood top
    [_, _, _, _,Sd2, Sh, Sh, Sh, Sh, Sh, Sh,Sd2, _, _, _, _],  // hood body
    [_, _, _, _,Sd2, Sh,Oe, Sh, Sh,Oe, Sh,Sd2, _, _, _, _],  // orange hostile eyes
    [_, _, _, _, _,Sd2, Sh, Sh, Sh, Sh,Sd2, _, _, _, _, _],  // face shadow
    [_, _, _, _, _, _, Sh, Sh, Sh, Sh, _, _, _, _, _, _],  // neck
    [_, _, _, _, _, _, _, Sh, Sh, _, _, _, _, _, _, _],  // neck taper
    [_, _, Sh, Sh, Sh, Sh, Sh, Sh, Sh, Sh, Sh, Sh, Sh, Sh, _, _],  // very wide cloak
    [_, _, Sh,ShM, Sh, Sh, Sh, Sh, Sh, Sh, Sh, Sh,ShM, Sh, _, _],  // cloak fold highlights
    [_, _, _, Sh, Sh, Sh, Sh, Sh, Sh, Sh, Sh, Sh, _, _, _, _],  // cloak narrows
    [_, _, _, Sd2, Sh,Sd2, Sh, Sh, Sh,Sd2, Sh,Sd2, _, _, _, _],  // shadow fold creases
    [_, _, _, _, Sd2, Sh, Sh, Sh, Sh, Sh,Sd2, _, _, _, _, _],  // lower cloak
    [_, _, _, _, Sd2,Sd2, Sh, Sh, Sh,Sd2,Sd2, _, _, _, _, _],  // cloak taper
    [_, _, _, _, _,Sd2,Sd2, Sh, Sh,Sd2,Sd2, _, _, _, _, _],  // trailing shadow
    [_, _, _, _, _, _,Sd2,Sd2,Sd2,Sd2, _, _, _, _, _, _],  // shadow tip
    [_, _, _, _, _, _, _,Sd2,Sd2, _, _, _, _, _, _, _],  // shadow point
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

  // --- Frost Warden: imposing ice boss, icicle crown, heavy armor, orange eyes ---
  const fwarden = createPNG(16, 16);
  const Ic = C.lightBlue;
  const Id = C.blue;
  const Ik = C.darkBlue;
  drawPixelArt(fwarden, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _,Ic, _,Ic, _, _, _, _, _,Ic, _,Ic, _, _, _],  // icicle crown tips
    [_, _,Id,Ic,Id,Ic,Id,Id,Id,Id,Ic,Id,Ic, _, _, _],  // icicle crown base
    [_, _, _,Id,Id,Id,Id,Id,Id,Id,Id,Id, _, _, _, _],  // head
    [_, _, _,Id,Oe,Id,Id,Id,Id,Oe,Id,Id, _, _, _, _],  // orange hostile eyes
    [_, _, _,Id,Ic,Ik,Ik,Ik,Ik,Ic,Id, _, _, _, _, _],  // visor shadow
    [_, _, _, _,Id,Id,Id,Id,Id,Id,Id, _, _, _, _, _],  // neck
    [_, _, _, _, _, _,Id,Id,Id, _, _, _, _, _, _, _],  // neck taper
    [_, _,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id, _, _],  // full boss shoulders
    [_, _,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id,Id, _, _],  // chest
    [_, _,Ic,Ik, _,Id,Ic,Id,Id,Ic,Id, _,Ik,Ic, _, _],  // ice shoulder accents
    [_, _, _,Ik, _,Ik,Id,Id,Id,Id,Ik, _,Ik, _, _, _],  // torso
    [_, _, _, _,Ik,Ik,Id,Id,Id,Id,Ik,Ik, _, _, _, _],  // lower torso
    [_, _, _, _, _,Ik,Ik,Ik,Ik,Ik,Ik, _, _, _, _, _],  // hips
    [_, _, _, _, _,Ik, _, _, _, _,Ik, _, _, _, _, _],  // legs
    [_, _, _, _, _,Ik, _, _, _, _,Ik, _, _, _, _, _],  // legs
    [_, _, _, _,Ik,Ik, _, _, _, _,Ik,Ik, _, _, _, _],  // wide armored feet
  ]);
  savePNG(fwarden, path.join(CONTENT_DIR, 'sprites', 'frost_warden.png'));

  // --- Sporecap Shambler: mushroom cap with spore spots, shambling body, orange eyes ---
  const shambler = createPNG(16, 16);
  const Sp = C.lightGreen;
  const Sk = C.darkGreen;
  const Cap = C.rust;
  const Cd = C.darkBrown;
  const CapH = C.orange;  // spore spots / cap highlights
  drawPixelArt(shambler, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _,Cd,Cap,Cap,Cap,Cap,Cap,Cap,Cd, _, _, _, _],  // cap top (wider)
    [_, _, _,Cd,Cap,Cap,Cap,Cap,Cap,Cap,Cap,Cap,Cd, _, _, _],  // cap
    [_, _,Cd,Cap,Cap,CapH,Cap,Cap,Cap,Cap,CapH,Cap,Cap,Cd, _, _],  // spore spots
    [_, _,Cd,Cap,Cap,Cap,Cap,Cap,Cap,Cap,Cap,Cap,Cap,Cd, _, _],  // cap wide
    [_, _, _,Cd,Cap,Cap,Cap,Cap,Cap,Cap,Cap,Cap,Cd, _, _, _],  // cap lower
    [_, _, _, _, _,Cd,Cd,Cap,Cap,Cd,Cd, _, _, _, _, _],  // gills
    [_, _, _, _, _, _, _,Sp,Sp, _, _, _, _, _, _, _],  // neck stem
    [_, _, _, _,Sp,Sp,Sp,Sp,Sp,Sp,Sp,Sp, _, _, _, _],  // shoulders
    [_, _, _, _, _,Sp,Sp,Sp,Sp,Sp,Sp, _, _, _, _, _],  // upper body
    [_, _, _, _, _,Oe,Sp,Sp,Sp,Sp,Oe, _, _, _, _, _],  // orange hostile eyes (on body)
    [_, _, _, _, _, _,Sk,Sp,Sp,Sk, _, _, _, _, _, _],  // waist dark
    [_, _, _, _, _, _,Sk,Sp,Sp,Sk, _, _, _, _, _, _],  // lower body
    [_, _, _, _, _, _,Sk,Sk,Sk,Sk, _, _, _, _, _, _],  // hips
    [_, _, _, _, _, _,Sk, _, _,Sk, _, _, _, _, _, _],  // legs
    [_, _, _, _, _, _,Sk, _, _,Sk, _, _, _, _, _, _],  // legs
    [_, _, _, _, _,Sk,Sk, _, _,Sk,Sk, _, _, _, _, _],  // splayed feet
  ]);
  savePNG(shambler, path.join(CONTENT_DIR, 'sprites', 'sporecap_shambler.png'));

  // --- Mycelium Lurker: pale fungal ambusher, mycelium tendrils, orange hostile eyes ---
  const mycelium = createPNG(16, 16);
  const My = C.paleGray;
  const Mk = C.lightGray;
  const Mg = C.green;
  const MkD = C.gray;  // darker gray for shadow
  drawPixelArt(mycelium, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _,My, _, _, _, _, _, _, _, _,My, _, _, _],  // tendril tips
    [_, _, _,My,My, _, _, _, _, _, _,My,My, _, _, _],  // tendrils
    [_, _, _, _,My,My,My,My,My,My,My,My, _, _, _, _],  // head
    [_, _, _, _,My,Oe,My,My,My,Oe,My,My, _, _, _, _],  // orange hostile eyes
    [_, _, _, _, _,My,MkD,MkD,MkD,My, _, _, _, _, _],  // shadow under
    [_, _, _, _, _,My,Mg, My, My,Mg,My, _, _, _, _, _],  // green mold patches on neck
    [_, _, _, _, _, _, _,My,My, _, _, _, _, _, _, _],  // neck taper
    [_, _, _,My,My,My,My,My,My,My,My,My,My, _, _, _],  // wide mycelium shoulders
    [_, _, _, _,Mk,My,My,My,My,My,My,Mk, _, _, _, _],  // shoulder shadow
    [_, _, _, _, _,Mk,My,Mg,Mg,My,Mk, _, _, _, _, _],  // green mold torso patches
    [_, _, _, _, _,MkD,Mk,My,My,Mk,MkD, _, _, _, _, _],  // lower torso shadow
    [_, _, _, _, _, _,Mk,My,My,Mk, _, _, _, _, _, _],  // waist
    [_, _, _, _, _, _,Mk,Mk,Mk,Mk, _, _, _, _, _, _],  // hips
    [_, _, _, _, _, _,Mk, _, _,Mk, _, _, _, _, _, _],  // legs
    [_, _, _, _, _,Mk,Mk, _, _,Mk,Mk, _, _, _, _, _],  // spreading tendril feet
    [_, _, _, _,Mk,Mk, _, _, _, _,Mk,Mk, _, _, _, _],  // outstretched tendrils
  ]);
  savePNG(mycelium, path.join(CONTENT_DIR, 'sprites', 'mycelium_lurker.png'));

  // --- Fungal Sprayer: squat spore-shooter, visible nozzle arm, orange hostile eyes ---
  const sprayer = createPNG(16, 16);
  const Fg = C.green;
  const Fk = C.darkGreen;
  const Yw = C.yellow;
  const FgL = C.lightGreen;  // highlight
  drawPixelArt(sprayer, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _, _, _,Yw, _, _, _, _, _, _, _, _],  // spore burst
    [_, _, _, _, _, _,Yw,Yw,Yw, _, _, _, _, _, _, _],  // spore cloud
    [_, _, _, _, _, _,Fg,Fg,Fg,Fg, _, _, _, _, _, _],  // cap
    [_, _, _, _,Fk,Fg,Fg,Fg,Fg,Fg,Fg,Fk, _, _, _, _],  // cap wide
    [_, _, _, _,Fg,Oe,Fg,Fg,Fg,Oe,Fg,Fg, _, _, _, _],  // orange hostile eyes on cap
    [_, _, _, _,Fk,Fg,FgL,Fg,Fg,FgL,Fg,Fk, _, _, _, _],  // cap highlight
    [_, _, _, _, _,Fk,Fk,Fg,Fg,Fk,Fk, _, _, _, _, _],  // gills (dark)
    [_, _, _, _, _, _,Fk,Fg,Fg,Fk, _, _, _, _, _, _],  // neck/stem
    [_, _,Fk,Fk,Fk,Fk,Fk,Fg,Fg,Fk,Fk,Yw,Yw,Yw, _, _],  // body + nozzle arm extends right
    [_, _, _,Fk,Fg,Fg,Fg,Fg,Fg,Fg,Fk, _, _, _, _, _],  // body
    [_, _, _, _,Fk,Fg,Fg,Fg,Fg,Fk, _, _, _, _, _, _],  // lower body
    [_, _, _, _, Fk,Fk,Fg,Fg,Fk,Fk, _, _, _, _, _, _],  // hips
    [_, _, _, _, _, Fk,Fk,Fk,Fk,Fk, _, _, _, _, _, _],  // base
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(sprayer, path.join(CONTENT_DIR, 'sprites', 'fungal_sprayer.png'));

  // --- Elder Sporecap: massive fungal boss, wide spotty cap, orange hostile eyes, drooping gills ---
  const elder = createPNG(16, 16);
  const Ec = C.brown;
  const Ed = C.darkBrown;
  const Es = C.green;
  const Ek = C.darkGreen;
  const EcH = C.rust;   // cap highlight / spots
  const EsL = C.lightGreen;  // body glow
  drawPixelArt(elder, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _,Ed,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ed, _, _, _],  // massive cap top
    [_,Ed,Ec,Ec,Ec,EcH,Ec,Ec,Ec,Ec,EcH,Ec,Ec,Ed, _, _],  // cap with large spore spots
    [Ed,Ec,Ec,EcH,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,EcH,Ec,Ed, _],  // widest cap
    [Ed,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ed, _],  // cap solid
    [_,Ed,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ec,Ed, _, _],  // cap lower
    [_, _,Ed,Ed,Ed,Ec,Ed,Ec,Ec,Ed,Ec,Ed,Ed,Ed, _, _],  // drooping gills
    [_, _, _, _, _,Es,Oe,Es,Es,Oe,Es, _, _, _, _, _],  // orange hostile eyes on stem
    [_, _,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es,Es, _, _],  // wide body
    [_, _,Es,EsL,Es,Es,Es,Es,Es,Es,Es,Es,EsL,Es, _, _],  // body highlights
    [_, _, _,Ek,Es,Es,EsL,Es,Es,EsL,Es,Es,Ek, _, _, _],  // body side shadow
    [_, _, _, _,Ek,Es,Es,Es,Es,Es,Es,Ek, _, _, _, _],  // lower body
    [_, _, _, _, _,Ek,Es,Es,Es,Es,Ek, _, _, _, _, _],  // taper
    [_, _, _, _, _,Ek,Ek,Es,Es,Ek,Ek, _, _, _, _, _],  // hips
    [_, _, _, _, _,Ek, _, _, _, _,Ek, _, _, _, _, _],  // wide leg stance
    [_, _, _, _, _,Ek, _, _, _, _,Ek, _, _, _, _, _],  // legs
    [_, _, _, _,Ek,Ek, _, _, _, _,Ek,Ek, _, _, _, _],  // wide base feet
  ]);
  savePNG(elder, path.join(CONTENT_DIR, 'sprites', 'elder_sporecap.png'));

  // --- Dusk Crawler: low alien insectoid, antennae + 4 leg pairs, orange hostile eyes + teal body glow ---
  const dcrawl = createPNG(16, 16);
  const Dp = C.darkPurple;
  const Pp = C.purple;
  const Lp = C.lightPurple;
  const Tg = C.teal;
  drawPixelArt(dcrawl, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, Dp, _, _, _, _, _, _, _, _, Dp, _, _, _],  // antenna tips
    [_, _, Dp, Pp, Dp, _, _, _, _, _, Dp, Pp, Dp, _, _, _],  // antennae
    [_, _, _, Dp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Dp, _, _, _, _],  // head
    [_, _, _, Dp, Pp,Oe, Pp, Pp, Pp,Oe, Pp, Dp, _, _, _, _],  // orange hostile eyes
    [_, _, _, _, Dp, Dp, Lp, Pp, Lp, Dp, Dp, _, _, _, _, _],  // jaw/neck taper
    [_, Dp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Dp, _, _, _],  // upper body
    [Dp, Pp, Pp, Pp, Lp, Pp, Pp, Pp, Pp, Pp, Lp, Pp, Pp, Dp, _, _],  // widest body
    [Dp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Dp, _, _],  // body center
    [_, Dp, Pp, Pp, Tg, Pp, Pp, Pp, Pp, Pp, Tg, Pp, Dp, _, _, _],  // teal bioluminescent accents
    [_, _, Dp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Pp, Dp, _, _, _, _],  // lower body
    [_, Dp, _, Dp, Pp, Pp, Pp, Pp, Pp, Pp, Dp, _, Dp, _, _, _],  // rear leg joints
    [Dp, _, _, _, Dp, Pp, Pp, Pp, Pp, Dp, _, _, _, Dp, _, _],  // rear leg tips
    [_, _, _, _, _, Dp, Dp, Pp, Dp, Dp, _, _, _, _, _, _],  // tail taper
    [_, _, _, _, _, _, Dp, Dp, Dp, _, _, _, _, _, _, _],  // tail tip
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(dcrawl, path.join(CONTENT_DIR, 'sprites', 'dusk_crawler.png'));

  // --- Crystal Guardian: geometric crystalline boss, faceted body, orange eyes ---
  const cguard = createPNG(16, 16);
  const Cb = C.lightBlue;
  const Cm = C.blue;
  const Cd2 = C.darkBlue;
  const Cw = C.white;
  const Cpg = C.paleGray;
  drawPixelArt(cguard, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _,Cw, _,Cb, _,Cb, _,Cw, _, _, _, _, _],  // crystal crown spires
    [_, _, _, _,Cb,Cw,Cm,Cm,Cm,Cw,Cb, _, _, _, _, _],  // crown base with white facets
    [_, _, _, _,Cm,Cb,Cm,Cm,Cm,Cb,Cm, _, _, _, _, _],  // head faceted
    [_, _, _, _,Cm,Oe,Cm,Cm,Cm,Oe,Cm, _, _, _, _, _],  // orange hostile eyes
    [_, _, _, _,Cd2,Cm,Cb,Cd2,Cd2,Cb,Cm,Cd2, _, _, _, _],  // lower face crystal facets
    [_, _, _, _, _,Cd2,Cm,Cm,Cm,Cm,Cd2, _, _, _, _, _],  // neck
    [_, _, _, _, _, _,Cd2,Cm,Cm,Cd2, _, _, _, _, _, _],  // neck taper
    [_, _,Cw,Cb,Cm,Cm,Cm,Cm,Cm,Cm,Cm,Cm,Cb,Cw, _, _],  // crystal shard shoulders
    [_, _,Cpg,Cm,Cm,Cm,Cm,Cm,Cm,Cm,Cm,Cm,Cm,Cpg, _, _],  // wide chest
    [_, _, _,Cd2,Cb,Cm,Cw,Cm,Cm,Cw,Cm,Cb,Cd2, _, _, _],  // chest facet shine
    [_, _, _, _,Cd2,Cm,Cb,Cm,Cm,Cb,Cm,Cd2, _, _, _, _],  // lower torso
    [_, _, _, _, _,Cd2,Cm,Cw,Cw,Cm,Cd2, _, _, _, _, _],  // crystal core glow
    [_, _, _, _, _,Cd2,Cd2,Cd2,Cd2,Cd2,Cd2, _, _, _, _, _],  // hips
    [_, _, _, _, _,Cd2, _, _, _, _,Cd2, _, _, _, _, _],  // legs
    [_, _, _, _, _,Cd2, _, _, _, _,Cd2, _, _, _, _, _],  // legs
    [_, _, _, _,Cd2,Cd2, _, _, _, _,Cd2,Cd2, _, _, _, _],  // feet
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

  // --- Nest Mother: spider boss, 8 visible legs, teal glow body, orange hostile eyes ---
  const nmother = createPNG(16, 16);
  const Nm = C.purple;
  const Nd = C.darkPurple;
  const Nt = C.teal;
  const Nl = C.lightPurple;
  drawPixelArt(nmother, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _,Nd, _, _, _, _, _, _, _, _, _, _,Nd, _, _],  // front-leg tips
    [_, _,Nd,Nd, _, _, _, _, _, _, _, _,Nd,Nd, _, _],  // front legs
    [_, _, _,Nd,Nm,Nm,Nm,Nm,Nm,Nm,Nm,Nd, _, _, _, _],  // head segment
    [_, _, _,Nd,Nm,Oe,Nm,Nm,Nm,Oe,Nm,Nd, _, _, _, _],  // orange hostile eyes
    [_, _, _, _,Nd,Nm,Nm,Nm,Nm,Nm,Nd, _, _, _, _, _],  // head taper
    [_,Nd, _, _,Nd,Nm,Nm,Nm,Nm,Nd, _, _,Nd, _, _, _],  // mid forelegs
    [_,Nd,Nm, _, _,Nd,Nm,Nm,Nd, _, _, _,Nm,Nd, _, _],  // body + legs
    [_, _,Nm,Nd, _,Nm,Nl,Nt,Nt,Nl,Nm, _,Nd,Nm, _, _],  // body center glow
    [_, _,Nm, _,Nd,Nm,Nm,Nm,Nm,Nm,Nm,Nd, _,Nm, _, _],  // body
    [_,Nd, _,Nd,Nm,Nm,Nm,Nm,Nm,Nm,Nm,Nm,Nd, _,Nd, _],  // rear mid legs
    [Nd, _, _, _,Nd,Nm,Nm,Nm,Nm,Nm,Nd, _, _, _,Nd, _],  // rear body + leg bases
    [_,Nd,Nm, _, _,Nd,Nd,Nm,Nm,Nd,Nd, _, _,Nm,Nd, _],  // rear leg joints
    [_, _,Nd,Nm,Nd, _, _, _, _, _, _,Nd,Nm,Nd, _, _],  // rear leg tips
    [_, _, _,Nd, _, _, _, _, _, _, _,Nd, _, _, _, _],  // outermost leg tips
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(nmother, path.join(CONTENT_DIR, 'sprites', 'nest_mother.png'));

  // --- Shade Stalker: predatory nightside hunter, hunched + wide reach, orange hostile eyes ---
  const sstalker = createPNG(16, 16);
  const Ss = C.darkSlate;
  const Sm = C.midGray;
  const St = C.teal;
  drawPixelArt(sstalker, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Ss, Ss, Ss, Ss, _, _, _, _, _, _],  // head
    [_, _, _, _, _, Ss, Sm, Sm, Sm, Sm, Ss, _, _, _, _, _],  // head body
    [_, _, _, _, _, Ss,Oe, Ss, Ss,Oe, Ss, _, _, _, _, _],  // orange hostile eyes
    [_, _, _, _, _, _, Ss, Sm, Sm, Ss, _, _, _, _, _, _],  // jaw
    [_, _, _, _, _, _, _, Ss, Ss, _, _, _, _, _, _, _],  // neck
    [_, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, _],  // wide hunched shoulders
    [_, Ss, Sm, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Sm, Ss, _, _],  // shoulder highlight detail
    [_, _, Ss, Sm, Ss, Ss, Ss, Ss, Ss, Ss, Ss, Sm, Ss, _, _, _],  // arms taper inward
    [_, _, Ss, _, Sm, Ss, Ss, Ss, Ss, Ss, Sm, _, Ss, _, _, _],  // arms reaching out
    [_, Ss, _, _, _, Ss, Sm, Ss, Ss, Sm, Ss, _, _, _, Ss, _],  // long claw reach
    [_, _, _, _, _, _, Ss, Ss, Ss, Ss, _, _, _, _, _, _],  // lower torso
    [_, _, _, _, _, _, Ss, Ss, Ss, Ss, _, _, _, _, _, _],  // hips
    [_, _, _, _, _, _, Ss, _, _, Ss, _, _, _, _, _, _],  // legs
    [_, _, _, _, _, _, Ss, _, _, Ss, _, _, _, _, _, _],  // legs
    [_, _, _, _, _, Ss, Ss, _, _, Ss, Ss, _, _, _, _, _],  // feet
  ]);
  savePNG(sstalker, path.join(CONTENT_DIR, 'sprites', 'shade_stalker.png'));

  // --- Shade Stalker Alpha: boss nightside predator, crown glow + orange eyes + full arm reach ---
  const ssalpha = createPNG(16, 16);
  const Sa = C.darkSlate;
  const Sam = C.midGray;
  const Sat = C.teal;
  const Sap = C.lightPurple;
  const Sg = C.purple;
  drawPixelArt(ssalpha, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_,Sap, Sa, _, _, _, _, _, _, _, _, _, _, Sa,Sap, _],  // crown glow tendrils
    [_,Sap, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa,Sap, _, _],  // wide crown row
    [_, _,  Sa,Sam,Sam,Sam,Sam,Sam,Sam,Sam,Sam, Sa, _, _, _, _],  // head
    [_, _,  Sa,Oe, Sam,Sam,Sam,Sam,Sam,Oe, Sam, Sa, _, _, _, _],  // orange hostile eyes
    [_, _,  Sa,Sap,Sam, Sa, Sa, Sa, Sa,Sam,Sap, Sa, _, _, _, _],  // purple glow cheekbones
    [_, _, _,  Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, _, _, _, _],  // neck
    [_, _,  Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, _, _],  // wide boss shoulders
    [_, _,  Sa,Sam, Sa, Sa, Sa,Sam,Sam, Sa, Sa, Sa,Sam, Sa, _, _],  // shoulder plates
    [_,Sap,Sg, Sa, _, Sa,Sat, Sa, Sa,Sat, Sa, _, Sa,Sg,Sap, _],  // full glow arm spread (teal accents)
    [_, _, Sg, Sa, _, Sa,Sam, Sa, Sa,Sam, Sa, _, Sa, Sg, _, _],  // arms reaching
    [_, _, _,  Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, Sa, _, _, _, _],  // torso
    [_, _, _, _, Sa, Sa,Sam, Sa, Sa,Sam, Sa, Sa, _, _, _, _],  // lower torso
    [_, _, _, _, _, Sa, Sa, Sa, Sa, Sa, Sa, _, _, _, _, _],  // hips
    [_, _, _, _, _, Sa, _, _, _, _, Sa, _, _, _, _, _],  // legs
    [_, _, _, _, _, Sa, _, _, _, _, Sa, _, _, _, _, _],  // legs
    [_, _, _, _, Sa, Sa, _, _, _, _, Sa, Sa, _, _, _, _],  // wide feet
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

  // --- Gloom Wraith: ghostly spectral figure, wispy trailing form, teal soul-core, orange eyes ---
  const gwraith = createPNG(16, 16);
  const Gw = C.purple;
  const Gwl = C.lightPurple;
  const Gwd = C.darkPurple;
  const Gwe = C.orange;
  const Gwt = C.teal;
  drawPixelArt(gwraith, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _, _, _, Gwl, _, _, _, _, _, _, _, _],  // wispy top tendril
    [_, _, _, _, _, _, Gwl,Gwl,Gwl,Gwl, _, _, _, _, _, _],  // head glow
    [_, _, _, _, _, Gw, Gw,Gwl,Gwl, Gw, Gw, _, _, _, _, _],  // head
    [_, _, _, _, _, Gw,Gwe, Gw, Gw,Gwe, Gw, _, _, _, _, _],  // warm orange eyes
    [_, _, _, _, _, _, Gw,Gwd,Gwd, Gw, _, _, _, _, _, _],  // shadow under eyes
    [_, _, _, _, _, _,Gwl,Gwl,Gwl,Gwl, _, _, _, _, _, _],  // bright glow collar
    [_, _, _, _, _, _, _, Gw, Gw, _, _, _, _, _, _, _],  // neck
    [_, _, _,Gwl, Gw, Gw, Gw, Gw, Gw, Gw, Gw, Gw,Gwl, _, _, _],  // wide spectral body
    [_, _, _, _, Gw, Gw, Gw, Gw, Gw, Gw, Gw, Gw, _, _, _, _],  // body
    [_, _, _, _,Gwl, Gw,Gwt,Gwt,Gwt,Gwt, Gw,Gwl, _, _, _, _],  // teal soul core glow
    [_, _, _, _, _,Gwd, Gw, Gw, Gw, Gw,Gwd, _, _, _, _, _],  // body shadow
    [_, _, _, _, _, _,Gwd,Gwl,Gwl,Gwd, _, _, _, _, _, _],  // spectral waist
    [_, _, _, _, _,Gwl, _,Gwd,Gwd, _,Gwl, _, _, _, _, _],  // wispy spread bottom
    [_, _, _, _,Gwl, _, _, _, _, _, _,Gwl, _, _, _, _],  // wider wisp
    [_, _, _,Gwl, _, _, _, _, _, _, _, _,Gwl, _, _, _],  // widest wisp fringe
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(gwraith, path.join(CONTENT_DIR, 'sprites', 'gloom_wraith.png'));

  // --- Rime Stalker: crystalline ice predator, icicle shoulder spikes, orange hostile eyes ---
  const rstalker = createPNG(16, 16);
  const Ri = C.lightBlue;
  const Rm = C.blue;
  const Rdk = C.darkBlue;
  const Rw = C.white;
  drawPixelArt(rstalker, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _,Rw, _, _, _, _, _,Rw, _, _, _, _],  // icicle tips (crown)
    [_, _, _, _, _,Rm,Ri, _, _, _,Ri,Rm, _, _, _, _],  // icicle bases
    [_, _, _, _, _,Rm,Ri,Rm,Rm,Ri,Rm, _, _, _, _, _],  // head top
    [_, _, _, _, _,Rm,Oe,Rm,Rm,Oe,Rm, _, _, _, _, _],  // orange hostile eyes
    [_, _, _, _, _,Rm,Ri,Rdk,Rdk,Ri,Rm, _, _, _, _, _],  // lower face
    [_, _, _, _, _, _,Rm,Rm,Rm,Rm, _, _, _, _, _, _],  // neck
    [_, _, _, _, _, _, _,Rm,Rm, _, _, _, _, _, _, _],  // neck taper
    [_, _,Rw,Ri,Rm,Rm,Rm,Rm,Rm,Rm,Rm,Rm,Ri,Rw, _, _],  // icicle shoulder pauldrons
    [_, _,Rdk,Rm,Rm,Rm,Rm,Rm,Rm,Rm,Rm,Rm,Rm,Rdk, _, _],  // wide shoulders
    [_, _, _,Rdk,Rm,Ri,Rm,Rm,Rm,Rm,Ri,Rm,Rdk, _, _, _],  // chest highlight
    [_, _, _, _,Rdk,Rm,Rm,Rm,Rm,Rm,Rm,Rdk, _, _, _, _],  // torso
    [_, _, _, _, _,Rdk,Rw,Rm,Rm,Rw,Rdk, _, _, _, _, _],  // ice crystal belt accent
    [_, _, _, _, _, _,Rdk,Rdk,Rdk,Rdk, _, _, _, _, _, _],  // hips
    [_, _, _, _, _, _,Rdk, _, _, _,Rdk, _, _, _, _, _],  // legs (wider stance)
    [_, _, _, _, _, _,Rdk, _, _, _,Rdk, _, _, _, _, _],  // legs
    [_, _, _, _, _,Rdk,Rdk, _, _, _,Rdk,Rdk, _, _, _, _],  // feet
  ]);
  savePNG(rstalker, path.join(CONTENT_DIR, 'sprites', 'rime_stalker.png'));

  // --- Frostfang Hunter: icy wolf quadruped, snarling jaws, orange hostile eyes ---
  const fhunter = createPNG(16, 16);
  const Fi = C.lightBlue;
  const Fm = C.blue;
  const Fd = C.darkBlue;
  const Fw = C.white;
  drawPixelArt(fhunter, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _,Fd,Fm, _, _, _, _, _, _, _, _, _, _, _, _],  // ear tips
    [_, _,Fm,Fi,Fi,Fm, _, _, _, _, _, _, _, _, _, _],  // wolf head
    [_, _,Fm,Oe,Fi,Oe,Fm, _, _, _, _, _, _, _, _, _],  // orange hostile eyes
    [_, _,Fm,Fw,Fw,Fm,Fm,Fd, _, _, _, _, _, _, _, _],  // snarling teeth
    [_, _, _,Fm,Fm,Fm,Fm,Fm,Fm, _, _, _, _, _, _, _],  // neck/jaw
    [_, _, _, _,Fm,Fi,Fi,Fi,Fm,Fm,Fm,Fm, _, _, _, _],  // body front
    [_, _, _, _,Fm,Fi,Fi,Fi,Fi,Fi,Fi,Fm, _, _, _, _],  // body main
    [_, _, _, _, _,Fm,Fi,Fw,Fw,Fi,Fm,Fd,Fd, _, _, _],  // body rear + tail base
    [_, _, _, _, _,Fd,Fm,Fm,Fm,Fm,Fd, _,Fd, _, _, _],  // rear legs + tail
    [_, _, _, _,Fd, _,Fd,Fm,Fm,Fd, _, _,Fd, _, _, _],  // front/rear paws
    [_, _, _,Fd, _, _,Fd, _, _,Fd, _, _, _, _, _, _],  // paw tips
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(fhunter, path.join(CONTENT_DIR, 'sprites', 'frostfang_hunter.png'));

  // --- Vent Spewer: lava-cracked volcanic creature, flame crown, orange hostile eyes ---
  const vspew = createPNG(16, 16);
  const Vr = C.red;
  const Vd = C.darkRed;
  const Vo = C.orange;
  const Vy = C.yellow;
  drawPixelArt(vspew, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _, _,Vy, _, _,Vy, _, _, _, _, _, _],  // flame tips
    [_, _, _, _, _, _,Vo,Vy,Vy,Vo, _, _, _, _, _, _],  // flame
    [_, _, _, _, _, _,Vr,Vo,Vo,Vr, _, _, _, _, _, _],  // flame base
    [_, _, _, _, _, _,Vd,Vr,Vr,Vd, _, _, _, _, _, _],  // head top
    [_, _, _, _, _,Vd,Vr,Oe,Oe,Vr,Vd, _, _, _, _, _],  // orange hostile eyes
    [_, _, _, _, _,Vr,Vo,Vr,Vr,Vo,Vr, _, _, _, _, _],  // lava cracks face
    [_, _, _, _,Vd,Vr,Vr,Vr,Vr,Vr,Vr,Vd, _, _, _, _],  // neck
    [_, _, _,Vd,Vr,Vr,Vy,Vr,Vr,Vy,Vr,Vr,Vd, _, _, _],  // body with vent glows
    [_, _, _,Vd,Vr,Vo,Vr,Vr,Vr,Vr,Vo,Vr,Vd, _, _, _],  // lava seams
    [_, _, _,Vd,Vr,Vr,Vr,Vo,Vo,Vr,Vr,Vr,Vd, _, _, _],  // central lava core
    [_, _, _, _,Vd,Vr,Vr,Vr,Vr,Vr,Vr,Vd, _, _, _, _],  // lower body
    [_, _, _, _, _,Vd,Vr,Vo,Vo,Vr,Vd, _, _, _, _, _],  // lava vents (belly)
    [_, _, _, _, _,Vd,Vd,Vr,Vr,Vd,Vd, _, _, _, _, _],  // hips
    [_, _, _, _, _, _,Vd,Vd,Vd,Vd, _, _, _, _, _, _],  // rock base
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(vspew, path.join(CONTENT_DIR, 'sprites', 'vent_spewer.png'));

  // --- Magma Brute: volcanic boss, glowing lava core, orange eyes, wide lava-cracked form ---
  const mbrute = createPNG(16, 16);
  const Mr = C.red;
  const Md2 = C.darkRed;
  const Mo = C.orange;
  const My2 = C.yellow;
  const Mlr = C.lightRed;
  drawPixelArt(mbrute, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _,My2, Mo,Md2,Md2,Md2,Md2, Mo,My2, _, _, _, _],  // flame crown
    [_, _, _, _, _,Mr, Mr, Mr, Mr, Mr, Mr, _, _, _, _, _],  // head
    [_, _, _, _, _,Mr,Oe, Mr, Mr,Oe, Mr, _, _, _, _, _],  // orange hostile eyes
    [_, _, _, _, _,Mr, Mo,Md2,Md2, Mo, Mr, _, _, _, _, _],  // lava crack face
    [_, _, _, _, _, _,Mr, Mr, Mr, Mr, _, _, _, _, _, _],  // neck
    [_, _, _, _, _, _, _,Mr, Mr, _, _, _, _, _, _, _],  // neck taper
    [_, _,Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, Mr, _, _],  // full boss shoulders
    [_, _,Mr, Mr, Mr, Mr, Mr,Mo, Mo, Mr, Mr, Mr, Mr, Mr, _, _],  // lava seam shoulders
    [_, _,Mlr,Md2, _,Mr,My2, Mr, Mr,My2, Mr, _,Md2,Mlr, _, _],  // arm lava glow
    [_, _,Mlr, _, _,Md2,Mr, Mr, Mr, Mr,Md2, _, _,Mlr, _, _],  // arms
    [_, _, _, _,Md2,Mo, Mr, Mr, Mr, Mr, Mo,Md2, _, _, _, _],  // torso lava core
    [_, _, _, _,Md2,Md2,My2, Mr, Mr,My2,Md2,Md2, _, _, _, _],  // glowing core accents
    [_, _, _, _, _,Md2,Md2,Md2,Md2,Md2,Md2, _, _, _, _, _],  // hips
    [_, _, _, _, _,Md2, _, _, _, _,Md2, _, _, _, _, _],  // legs
    [_, _, _, _, _,Md2, _, _, _, _,Md2, _, _, _, _, _],  // legs
    [_, _, _, _,Md2,Md2, _, _, _, _,Md2,Md2, _, _, _, _],  // feet
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

  // --- Array Overseer: dominant tech boss, energy crown, teal core, orange hostile eyes ---
  const aoverseer = createPNG(16, 16);
  const Ot = C.teal;
  const Op = C.lightPurple;
  const Om = C.lightGray;
  const Od = C.gray;
  const Ok = C.midGray;
  const OtL = C.lightTeal;
  drawPixelArt(aoverseer, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_,Op, Ot, _, _, _, _, _, _, _, _, _,Ot, Op, _, _],  // energy crown tendrils
    [_,Op, Od, Od, Od, Od, Od, Od, Od, Od, Od, Od, Op, _, _, _],  // crown ring
    [_, _, Od, Om, Om, Om, Om, Om, Om, Om, Om, Od, _, _, _, _],  // head
    [_, _, Od, Om,Oe, Om, Om, Om, Om,Oe, Om, Od, _, _, _, _],  // orange hostile eyes
    [_, _, Od, Om, Ot, Ok, Ok, Ok, Ok, Ot, Om, Od, _, _, _, _],  // teal energy visor
    [_, _, _, _, Od, Om, Om, Om, Om, Om, Od, _, _, _, _, _],  // neck
    [_, _, _, _, _, _, Od, Om, Om, Od, _, _, _, _, _, _],  // neck taper
    [_, _,Od, Om, Om, Om, Om, Om, Om, Om, Om, Om, Om, Od, _, _],  // full boss body
    [_, _,Od, Om, Om, Om, Om,Op, Op, Om, Om, Om, Om, Od, _, _],  // purple shoulder gems
    [_, _,Op,Ok, _,Om, Ot,OtL,OtL,Ot, Om, _,Ok, Op, _, _],  // arm energy accents (teal core glow)
    [_, _, _,Ok, _, Ok, Om, Om, Om, Om, Ok, _, Ok, _, _, _],  // lower arms
    [_, _, _, _, _,Ok, Op, Om, Om, Op, Ok, _, _, _, _, _],  // torso with purple gems
    [_, _, _, _, _,Ok, Ok, Ok, Ok, Ok, Ok, _, _, _, _, _],  // hips
    [_, _, _, _, _,Ok, _, _, _, _, Ok, _, _, _, _, _],  // legs
    [_, _, _, _, _,Ok, _, _, _, _, Ok, _, _, _, _, _],  // legs
    [_, _, _, _,Ok, Ok, _, _, _, _, Ok, Ok, _, _, _, _],  // feet
  ]);
  savePNG(aoverseer, path.join(CONTENT_DIR, 'sprites', 'array_overseer.png'));

  // --- Threshold Watcher: sentinel with void gaze, floating form, orange hostile eyes ---
  const twatcher = createPNG(16, 16);
  const Wp = C.purple;
  const Wd = C.darkPurple;
  const Wl = C.lightPurple;
  const Wb = C.blue;
  const Wt = C.teal;
  drawPixelArt(twatcher, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _, _, _, _,Wl, _,Wl, _, _, _, _, _, _, _],  // void energy wisps
    [_, _, _, _, _, _,Wp,Wl,Wp,Wl, _, _, _, _, _, _],  // head glow halo
    [_, _, _, _, _,Wp,Wp,Wl,Wl,Wp,Wp, _, _, _, _, _],  // head
    [_, _, _, _, _,Wp,Oe,Wp,Wp,Oe,Wp, _, _, _, _, _],  // orange hostile eyes
    [_, _, _, _, _,Wd,Wp,Wt,Wt,Wp,Wd, _, _, _, _, _],  // teal inner eye glow
    [_, _, _, _, _, _,Wp,Wd,Wd,Wp, _, _, _, _, _, _],  // shadow jaw
    [_, _, _, _, _, _, _,Wp,Wp, _, _, _, _, _, _, _],  // neck
    [_, _,Wl,Wp,Wp,Wp,Wp,Wp,Wp,Wp,Wp,Wp,Wl, _, _, _],  // wide floating body
    [_, _, _,Wd,Wp,Wp,Wp,Wp,Wp,Wp,Wp,Wd, _, _, _, _],  // body shadow
    [_, _, _, _,Wp,Wt,Wp,Wp,Wp,Wp,Wt,Wp, _, _, _, _],  // teal energy core
    [_, _, _, _,Wd,Wp,Wp,Wp,Wp,Wp,Wp,Wd, _, _, _, _],  // lower body
    [_, _, _, _, _,Wd,Wd,Wp,Wp,Wd,Wd, _, _, _, _, _],  // void tendrils start
    [_, _, _, _, _,Wd,Wl,Wd,Wd,Wl,Wd, _, _, _, _, _],  // tendril glow
    [_, _, _, _,Wl, _,Wd, _, _,Wd, _,Wl, _, _, _, _],  // floating wisps
    [_, _,Wl, _, _, _, _, _, _, _, _, _,Wl, _, _, _],  // wide float fringe
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(twatcher, path.join(CONTENT_DIR, 'sprites', 'threshold_watcher.png'));

  // --- Abyssal Tendril: writhing void tentacle, multiple arms spreading, red eyes, purple-dark ---
  const atendril = createPNG(16, 16);
  const Tb2 = C.darkSlate;
  const Tm = C.midGray;
  const Tp2 = C.darkPurple;
  const Te = C.red;
  const TpL = C.purple;
  drawPixelArt(atendril, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_, _, _,Tp2, _, _, _, _, _, _, _, _,Tp2, _, _, _],  // tendril tips
    [_, _,Tp2,TpL,Tp2, _, _, _, _, _,Tp2,TpL,Tp2, _, _, _],  // upper tendrils
    [_, _,Tb2,Tp2, _,Tp2,Tb2,Tb2,Tb2,Tp2, _,Tp2,Tb2, _, _, _],  // tendrils converging
    [_, _, _,Tb2, _,Tb2,TpL,Tb2,Tb2,TpL,Tb2, _,Tb2, _, _, _],  // body top
    [_, _, _, _,Tb2,Tb2,Te, Tb2,Tb2,Te, Tb2,Tb2, _, _, _, _],  // RED hostile eyes
    [_, _, _, _,Tb2,Tm, Tb2,Tb2,Tb2,Tb2,Tm, Tb2, _, _, _, _],  // eye row body
    [_, _, _, _, _,Tb2,TpL,Tb2,Tb2,TpL,Tb2, _, _, _, _, _],  // purple glow inner
    [_, _,Tp2, _,Tb2,Tb2,Tb2,Tb2,Tb2,Tb2,Tb2, _,Tp2, _, _, _],  // wide body + tendril stubs
    [_,Tp2,Tb2, _,Tb2,Tb2,Tm, Tb2,Tb2,Tm, Tb2, _,Tb2,Tp2, _, _],  // outer tendrils
    [_,Tb2, _,Tb2, _,Tb2,Tb2,Tb2,Tb2,Tb2, _,Tb2, _,Tb2, _, _],  // tentacle segments
    [Tp2, _, _,Tb2,Tp2, _, _,Tb2,Tb2, _, _,Tp2,Tb2, _, _,Tp2],  // outstretched tips
    [_, _, _,Tp2, _, _, _, _, _, _, _, _,Tp2, _, _, _],  // tip accents
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]);
  savePNG(atendril, path.join(CONTENT_DIR, 'sprites', 'abyssal_tendril.png'));

  // --- Threshold Keeper: void lord boss, radiant crown, red hostile eyes, void corruption ---
  const tkeeper = createPNG(16, 16);
  const Kp = C.purple;
  const Kd = C.darkPurple;
  const Kl = C.lightPurple;
  const Kr = C.red;
  const Kk = C.darkSlate;
  const Krd = C.darkRed;
  drawPixelArt(tkeeper, 0, 0, [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [_,Kl, Kd, _, _,Kl, _, _, _,Kl, _, _,Kd, Kl, _, _],  // void crown spires
    [_,Kl, Kd, Kd,Kd, Kd, Kd, Kd, Kd, Kd,Kd,Kd, Kl, _, _, _],  // crown base ring
    [_, _, Kd, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kd, _, _, _, _],  // head
    [_, _, Kd, Kp, Kr, Kp, Kp, Kp, Kp, Kr, Kp, Kd, _, _, _, _],  // RED hostile eyes
    [_, _, Kd, Kp, Kl, Kd, Kd, Kd, Kd, Kl, Kp, Kd, _, _, _, _],  // void glow lower face
    [_, _, _, _, Kd, Kp, Kp, Kp, Kp, Kp, Kd, _, _, _, _, _],  // neck
    [_, _, _, _, _, _, Kd, Kp, Kp, Kd, _, _, _, _, _, _],  // neck taper
    [_, _,Kd, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kp, Kd, _, _],  // boss width shoulders
    [_, _,Kd, Kp, Kp, Kp, Kp, Kr, Kr, Kp, Kp, Kp, Kp, Kd, _, _],  // red void seam
    [_, _,Kl, Kk, _, Kp, Kl, Kp, Kp, Kl, Kp, _, Kk, Kl, _, _],  // arm void glow
    [_, _, _, _, _, Kk, Krd, Kp, Kp, Krd, Kk, _, _, _, _, _],  // dark red torso corruption
    [_, _, _, _, _, Kk, Kk, Kp, Kp, Kk, Kk, _, _, _, _, _],  // lower torso
    [_, _, _, _, _, Kk, Kk, Kk, Kk, Kk, Kk, _, _, _, _, _],  // hips
    [_, _, _, _, _, Kk, _, _, _, _, Kk, _, _, _, _, _],  // legs
    [_, _, _, _, _, Kk, _, _, _, _, Kk, _, _, _, _, _],  // legs
    [_, _, _, _, Kk, Kk, _, _, _, _, Kk, Kk, _, _, _, _],  // feet
  ]);
  savePNG(tkeeper, path.join(CONTENT_DIR, 'sprites', 'threshold_keeper.png'));
}

// ============================================================================
// PLAYER SPRITES (16x16, 4 color variants)
// ============================================================================

function generatePlayerSprites() {
  // Players are frontier engineers: gray helmet + visor, light armor, sol unit glow
  const playerColors = [
    { name: 'blue',   body: C.blue,      dark: C.darkBlue    },
    { name: 'red',    body: C.red,       dark: C.darkRed     },
    { name: 'green',  body: C.green,     dark: C.darkGreen   },
    { name: 'orange', body: C.orange,    dark: C.rust        },
  ];

  for (const pc of playerColors) {
    const png = createPNG(16, 16);
    const M = pc.body;   // accent color
    const m = pc.dark;   // dark accent
    drawPixelArt(png, 0, 0, [
      //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],  // 0
      [_, _, _, _, _, _,Hd,Hd,Hd,Hd, _, _, _, _, _, _],  // 1  helmet top
      [_, _, _, _, _,Hd,Hl, H, H, H,Hd, _, _, _, _, _],  // 2  helmet (top-left highlight)
      [_, _, _, _, _,Hd, M, M, M, M,Hd, _, _, _, _, _],  // 3  visor (accent color)
      [_, _, _, _, _,Hd, H,Hd,Hd, H,Hd, _, _, _, _, _],  // 4  lower helmet / mouth guard
      [_, _, _, _, _, _,Hd, H, H,Hd, _, _, _, _, _, _],  // 5  chin
      [_, _, _, _, _, _, _, M, M, _, _, _, _, _, _, _],  // 6  collar (accent)
      [_, _, _, _,Hd, M, M, M, M, M, M,Hd, _, _, _, _],  // 7  shoulder pauldrons
      [_, _, _, _, _, M, M,SG, M, M, M, _, _, _, _, _],  // 8  chest + sol unit glow
      [_, _, _, _, _, M, M, H, H, M, M, _, _, _, _, _],  // 9  torso (belt buckle gray)
      [_, _, _, _, _, m, M, M, M, M, m, _, _, _, _, _],  // 10 waist (shadow on edges)
      [_, _, _, _, _, _, m, M, M, m, _, _, _, _, _, _],  // 11 belt
      [_, _, _, _, _, _, m, m, m, m, _, _, _, _, _, _],  // 12 hips
      [_, _, _, _, _, _, m, _, _, m, _, _, _, _, _, _],  // 13 legs
      [_, _, _, _, _, _, m, _, _, m, _, _, _, _, _, _],  // 14 legs
      [_, _, _, _, _, n, m, _, _, m, n, _, _, _, _, _],  // 15 boots
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

  // Generic NPC: blue-robed figure with brown hair (no helmet — NPC convention)
  const npc = createPNG(16, 16);
  drawPixelArt(npc, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, N, N, N, N, _, _, _, _, _, _],  // brown hair
    [_, _, _, _, _, N, S, S, S, S, N, _, _, _, _, _],  // hair framing face
    [_, _, _, _, _, S, W, S, S, W, S, _, _, _, _, _],  // eyes
    [_, _, _, _, _, S, S, s, s, S, S, _, _, _, _, _],  // mouth
    [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],  // chin
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
    [_, _, _, _, _,pu,pu,pu,pu,pu,pu, _, _, _, _, _],  // deep hood
    [_, _, _, _, _,pu, S, S, S, S,pu, _, _, _, _, _],  // hooded face
    [_, _, _, _, _,pu,Te, S, S,Te,pu, _, _, _, _, _],  // teal-tinged eyes (nightside)
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

  // --- Commander Wren Alcott: military field commander, teal uniform, dark hair, rank insignia ---
  const dt = C.darkTeal;
  const Og = C.orange;
  const wren = createPNG(16, 16);
  drawPixelArt(wren, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, n, n, S, S, n, n, _, _, _, _, _],
    [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
    [_, _, _, _, _, S, W, S, S, W, S, _, _, _, _, _],
    [_, _, _, _, _, S, S, s, s, S, S, _, _, _, _, _],
    [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
    [_, _, _, _, _, _,Te,Te,Te,Te, _, _, _, _, _, _],
    [_, _, dt,Te,Te,Te,Te,Te,Te,Te,Te,Te, dt, _, _, _],
    [_, _, dt,Te,Te,Te,Og,Te,Te,Og,Te,Te, dt, _, _, _],
    [_, _, _, _,Te,Te,Te,Te,Te,Te,Te,Te, _, _, _, _],
    [_, _, _, _, _,Te,Te,Te,Te,Te,Te, _, _, _, _, _],
    [_, _, _, _, _,dt,Te,Te,Te,Te, dt, _, _, _, _, _],
    [_, _, _, _, _,dt, dt,Te,Te, dt, dt, _, _, _, _, _],
    [_, _, _, _, _,dt, dt, _, _, dt, dt, _, _, _, _, _],
    [_, _, _, _, _,dt, dt, _, _, dt, dt, _, _, _, _, _],
    [_, _, _, _, n, dt, dt, _, _, dt, dt, n, _, _, _, _],
  ]);
  savePNG(wren, path.join(CONTENT_DIR, 'sprites', 'wren_alcott.png'));
}

// ============================================================================
// ITEM SPRITES (16x16)
// ============================================================================

function generateItemSprites() {
  // --- Health Potion: red flask with dark-red outline (item convention: self-colored outline) ---
  const potion = createPNG(16, 16);
  drawPixelArt(potion, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, r, r, _, _, _, _, _, _, _],  // cork (dark red)
    [_, _, _, _, _, _, _, r, r, _, _, _, _, _, _, _],  // neck
    [_, _, _, _, _, _, r, r, r, r, _, _, _, _, _, _],  // neck widens
    [_, _, _, _, _, r, R, R, R, R, r, _, _, _, _, _],  // body top
    [_, _, _, _, r, R,Lr, R, R, R, R, r, _, _, _, _],  // body + highlight
    [_, _, _, _, r, R,Lr, R, R, R, R, r, _, _, _, _],  // body + highlight
    [_, _, _, _, r, R, R, R, R, R, R, r, _, _, _, _],  // body
    [_, _, _, _, r, R, R, R, R, R, R, r, _, _, _, _],  // body
    [_, _, _, _, r, R, R, R, R, R, R, r, _, _, _, _],  // body
    [_, _, _, _, r, R, R, R, R, R, R, r, _, _, _, _],  // body
    [_, _, _, _, _, r, R, R, R, R, r, _, _, _, _, _],  // bottom curve
    [_, _, _, _, _, _, r, r, r, r, _, _, _, _, _, _],  // base
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

  // --- Iron Key: Sol Gold key (quest item convention: Sol Gold accent) ---
  const key = createPNG(16, 16);
  const Ky = C.solGold;
  const Kd = C.orange;
  drawPixelArt(key, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _,Kd,Ky,Ky,Kd, _, _, _, _, _, _, _],
    [_, _, _, _, Kd, _,Ky, _, _,Kd, _, _, _, _, _, _],
    [_, _, _, _, Kd, _, _, _, _,Kd, _, _, _, _, _, _],
    [_, _, _, _, _,Kd,Ky,Ky,Ky,Ky,Ky,Ky,Kd, _, _, _],
    [_, _, _, _, _, _, _, _, _, _,Ky, _,Ky, _, _, _],
    [_, _, _, _, _, _, _, _, _, _,Kd,Kd,Kd, _, _, _],
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

  // --- Sol Unit: geometric tech device, Sol Gold + Teal glow (sol component convention) ---
  const sol = createPNG(16, 16);
  const Sg = C.solGold;
  const St = C.teal;
  const Stl = C.lightTeal;
  const So = C.orange;
  drawPixelArt(sol, 0, 0, [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Sg, Sg, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, Sg, Sg, Sg, Sg, _, _, _, _, _, _],
    [_, _, _, _, _, Sg, Sg,Stl, Sg, Sg, Sg, _, _, _, _, _],
    [_, _, _, _, Sg, Sg, St, St, St, St, Sg, Sg, _, _, _, _],
    [_, _, _, _, Sg,Stl, St, Sg, Sg, St,Stl, Sg, _, _, _, _],
    [_, _, _, _, Sg, Sg, St, Sg, Sg, St, Sg, Sg, _, _, _, _],
    [_, _, _, _, Sg, Sg, St, St, St, St, Sg, Sg, _, _, _, _],
    [_, _, _, _, _, Sg, Sg, Sg, Sg, Sg, Sg, _, _, _, _, _],
    [_, _, _, _, _, _, Sg, So, So, Sg, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, So, So, _, _, _, _, _, _, _],
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
  const png = createPNG(512, 16); // 32 tiles × 16px

  // Outpost palette — warm steel, worn concrete, orange torchlight
  const O = {
    floorDark:  hex('#2a2823'),
    floorMid:   hex('#35332e'),
    floorLight: hex('#413e37'),
    wallDark:   hex('#504b44'),
    wallMid:    hex('#645f55'),
    wallLight:  hex('#736e64'),
    wallTop:    hex('#7d766c'),
    doorMid:    hex('#6a6050'),
    doorDark:   hex('#4e4638'),
    doorLight:  hex('#847264'),
    voidColor:  hex('#0f0e0c'),
    water1:     hex('#232a20'),
    water2:     hex('#303728'),
    water3:     hex('#3a4430'),
    rust:       hex('#7a5030'),
    orange:     C.orange,
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
  setPixel(png, ox1 + 2, 2, O.floorLight); setPixel(png, ox1 + 13, 2, O.floorLight);
  setPixel(png, ox1 + 2, 13, O.floorLight); setPixel(png, ox1 + 13, 13, O.floorLight);

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
  const scuffs = [[3,3],[4,4],[5,4],[8,6],[9,7],[10,8],[6,10],[7,11],[11,12],[12,13]];
  for (const [sx, sy] of scuffs) setPixel(png, ox2 + sx, sy, O.floorDark);

  // --- Tile 3: Concrete Wall (worn, with rust streaks) ---
  const ox3 = 48;
  fillRect(png, ox3, 0, 16, 16, O.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 0, O.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 15, O.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + 15, i, O.wallDark);
  const concrLight = [[2,3],[6,2],[10,4],[13,6],[4,8],[8,7],[1,10],[7,12],[11,9],[3,14]];
  const concrDark  = [[5,2],[1,5],[9,3],[12,7],[3,9],[7,11],[2,12],[10,10],[14,13],[8,14]];
  for (const [sx, sy] of concrLight) setPixel(png, ox3 + sx, sy, O.wallLight);
  for (const [sx, sy] of concrDark)  setPixel(png, ox3 + sx, sy, O.wallDark);
  const rustStreaks = [[4,5],[4,6],[4,7],[11,3],[11,4],[11,5],[7,9],[7,10]];
  for (const [rx, ry] of rustStreaks) setPixel(png, ox3 + rx, ry, O.rust);

  // --- Tile 4: Steel Door Closed (warm steel, orange handle) ---
  const ox4 = 64;
  fillRect(png, ox4, 0, 16, 16, O.doorMid);
  fillRect(png, ox4, 0, 1, 16, O.doorDark);
  fillRect(png, ox4 + 15, 0, 1, 16, O.doorDark);
  fillRect(png, ox4 + 1, 2, 14, 2, O.doorLight);
  fillRect(png, ox4 + 1, 12, 14, 2, O.doorLight);
  for (let vy = 0; vy < 16; vy++) setPixel(png, ox4 + 8, vy, O.doorDark);
  setPixel(png, ox4 + 12, 7, O.orange); setPixel(png, ox4 + 12, 8, O.orange);

  // --- Tile 5: Door Open ---
  const ox5 = 80;
  fillRect(png, ox5, 0, 16, 16, O.floorDark);
  fillRect(png, ox5, 0, 2, 16, O.doorDark);
  fillRect(png, ox5 + 14, 0, 2, 16, O.doorDark);
  fillRect(png, ox5 + 4, 2, 8, 12, rgba(30, 28, 25));

  // --- Tile 6: Stairs Down (orange arrow) ---
  const ox6 = 96;
  fillRect(png, ox6, 0, 16, 16, O.floorMid);
  fillRect(png, ox6 + 2, 2, 12, 3, O.floorLight);
  fillRect(png, ox6 + 3, 5, 10, 3, O.floorMid);
  fillRect(png, ox6 + 4, 8, 8, 3, O.floorDark);
  fillRect(png, ox6 + 5, 11, 6, 3, rgba(25, 24, 20));
  setPixel(png, ox6 + 7, 13, O.orange); setPixel(png, ox6 + 8, 13, O.orange);
  setPixel(png, ox6 + 6, 12, O.orange); setPixel(png, ox6 + 9, 12, O.orange);

  // --- Tile 7: Drainage/Sludge ---
  const ox7 = 112;
  fillRect(png, ox7, 0, 16, 16, O.water1);
  const oWave = [[2,3],[3,3],[4,3],[8,5],[9,5],[10,5],[1,9],[2,9],[3,9],[7,11],[8,11],[9,11],[12,7],[13,7],[4,14],[5,14]];
  for (const [wx, wy] of oWave) setPixel(png, ox7 + wx, wy, O.water2);
  const oWaveH = [[3,2],[9,4],[2,8],[8,10],[13,6],[5,13]];
  for (const [wx, wy] of oWaveH) setPixel(png, ox7 + wx, wy, O.water3);

  // --- Tile 8: Stairs Up (orange arrow) ---
  const ox8 = 128;
  fillRect(png, ox8, 0, 16, 16, O.floorMid);
  fillRect(png, ox8 + 5, 2, 6, 3, rgba(25, 24, 20));
  fillRect(png, ox8 + 4, 5, 8, 3, O.floorDark);
  fillRect(png, ox8 + 3, 8, 10, 3, O.floorMid);
  fillRect(png, ox8 + 2, 11, 12, 3, O.floorLight);
  setPixel(png, ox8 + 7, 1, O.orange); setPixel(png, ox8 + 8, 1, O.orange);
  setPixel(png, ox8 + 6, 2, O.orange); setPixel(png, ox8 + 9, 2, O.orange);

  // --- Tile 9: Locked Steel Door (warm steel, Sol Gold lock) ---
  const ox9 = 144;
  fillRect(png, ox9, 0, 16, 16, O.doorMid);
  fillRect(png, ox9, 0, 1, 16, O.doorDark);
  fillRect(png, ox9 + 15, 0, 1, 16, O.doorDark);
  fillRect(png, ox9 + 1, 2, 14, 2, O.doorLight);
  fillRect(png, ox9 + 1, 12, 14, 2, O.doorLight);
  for (let vy = 0; vy < 16; vy++) setPixel(png, ox9 + 8, vy, O.doorDark);
  fillRect(png, ox9 + 6, 6, 4, 4, C.solGold);
  setPixel(png, ox9 + 7, 7, C.darkGray); setPixel(png, ox9 + 8, 7, C.darkGray);
  setPixel(png, ox9 + 7, 8, C.darkGray);

  // --- Tile 10: Chest Closed (metal crate, orange handle, Sol Gold lock) ---
  const ox10 = 160;
  fillRect(png, ox10, 0, 1, 16, O.doorDark);
  fillRect(png, ox10 + 15, 0, 1, 16, O.doorDark);
  fillRect(png, ox10 + 1, 0, 14, 16, O.doorMid);
  fillRect(png, ox10 + 1, 0, 14, 5, O.doorLight);  // lid
  fillRect(png, ox10 + 1, 5, 14, 1, O.doorDark);   // lid seam
  fillRect(png, ox10 + 1, 14, 14, 2, O.doorDark);  // bottom shadow
  for (let i = 2; i < 14; i++) setPixel(png, ox10 + i, 1, O.wallLight); // lid highlight
  setPixel(png, ox10 + 2, 1, O.orange); setPixel(png, ox10 + 13, 1, O.orange); // corner rivets
  setPixel(png, ox10 + 2, 13, O.orange); setPixel(png, ox10 + 13, 13, O.orange);
  fillRect(png, ox10 + 6, 7, 4, 4, C.solGold);     // Sol Gold lock
  setPixel(png, ox10 + 7, 8, O.doorDark); setPixel(png, ox10 + 8, 8, O.doorDark);

  // --- Tile 11: Chest Opened (open metal crate, dark interior) ---
  const ox11 = 176;
  fillRect(png, ox11, 0, 1, 16, O.doorDark);
  fillRect(png, ox11 + 15, 0, 1, 16, O.doorDark);
  fillRect(png, ox11 + 1, 0, 14, 16, O.doorMid);
  fillRect(png, ox11 + 1, 14, 14, 2, O.doorDark);
  fillRect(png, ox11 + 2, 1, 12, 10, O.floorDark);   // interior
  fillRect(png, ox11 + 3, 2, 10, 8, rgba(22, 20, 18));
  setPixel(png, ox11 + 2, 12, O.orange); setPixel(png, ox11 + 13, 12, O.orange);
  for (let i = 2; i < 14; i++) setPixel(png, ox11 + i, 0, O.doorLight); // open rim

  // --- Tile 12: Sealed Gate (iron bars, orange seal indicator) ---
  const ox12 = 192;
  fillRect(png, ox12, 0, 16, 16, O.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox12 + bar, 0, 2, 16, O.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox12 + bar, i, O.wallDark);
  }
  fillRect(png, ox12, 7, 16, 2, O.wallMid);
  setPixel(png, ox12 + 7, 8, O.orange); setPixel(png, ox12 + 8, 8, O.orange);

  // --- Tile 13: Sealed Gate Workshop (Sol Gold indicator) ---
  const ox13 = 208;
  fillRect(png, ox13, 0, 16, 16, O.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox13 + bar, 0, 2, 16, O.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox13 + bar, i, O.wallDark);
  }
  fillRect(png, ox13, 7, 16, 2, O.wallMid);
  setPixel(png, ox13 + 7, 8, C.solGold); setPixel(png, ox13 + 8, 8, C.solGold);

  // --- Tile 14: Sealed Gate Charger (teal indicator) ---
  const ox14 = 224;
  fillRect(png, ox14, 0, 16, 16, O.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox14 + bar, 0, 2, 16, O.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox14 + bar, i, O.wallDark);
  }
  fillRect(png, ox14, 7, 16, 2, O.wallMid);
  setPixel(png, ox14 + 7, 8, C.lightTeal); setPixel(png, ox14 + 8, 8, C.lightTeal);

  // --- Tile 15: Hidden Passage (wall-look, faint seam) ---
  const ox15 = 240;
  fillRect(png, ox15, 0, 16, 16, O.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox15 + i, 0, O.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox15 + i, 15, O.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox15 + 15, i, O.wallDark);
  for (let i = 1; i < 15; i++) setPixel(png, ox15 + 8, i, O.wallLight);
  const hp15L = [[2,3],[6,2],[10,4],[4,9],[1,11]];
  const hp15D = [[5,4],[1,6],[9,3],[3,10],[11,8]];
  for (const [sx, sy] of hp15L) setPixel(png, ox15 + sx, sy, O.wallLight);
  for (const [sx, sy] of hp15D) setPixel(png, ox15 + sx, sy, O.wallDark);

  // --- Tile 16: Blast Door (heavy reinforced metal, thick bands) ---
  const ox16 = 256;
  fillRect(png, ox16, 0, 16, 16, O.doorDark);
  fillRect(png, ox16 + 1, 1, 14, 14, O.doorMid);
  fillRect(png, ox16 + 1, 1, 14, 2, O.doorLight);
  fillRect(png, ox16 + 1, 6, 14, 2, O.doorLight);
  fillRect(png, ox16 + 1, 11, 14, 2, O.doorLight);
  fillRect(png, ox16 + 7, 1, 2, 14, O.doorDark);
  setPixel(png, ox16 + 2, 2, O.wallLight); setPixel(png, ox16 + 13, 2, O.wallLight);
  setPixel(png, ox16 + 2, 13, O.wallLight); setPixel(png, ox16 + 13, 13, O.wallLight);

  // --- Tile 17: Junction Box B (wall panel with indicators) ---
  const ox17 = 272;
  fillRect(png, ox17, 0, 16, 16, O.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox17 + i, 0, O.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox17 + i, 15, O.wallDark);
  fillRect(png, ox17 + 3, 4, 10, 8, O.floorDark);
  fillRect(png, ox17 + 4, 5, 8, 6, O.floorMid);
  setPixel(png, ox17 + 5, 7, O.orange);    // active
  setPixel(png, ox17 + 7, 7, C.solGold);  // power
  setPixel(png, ox17 + 9, 7, O.wallLight); // neutral

  // --- Tile 18: Maintenance Hatch (floor with hatch, orange handle) ---
  const ox18 = 288;
  fillRect(png, ox18, 0, 16, 16, O.floorMid);
  fillRect(png, ox18 + 2, 2, 12, 1, O.wallMid); fillRect(png, ox18 + 2, 13, 12, 1, O.wallMid);
  fillRect(png, ox18 + 2, 2, 1, 12, O.wallMid); fillRect(png, ox18 + 13, 2, 1, 12, O.wallMid);
  fillRect(png, ox18 + 3, 3, 10, 10, O.floorDark);
  setPixel(png, ox18 + 7, 7, O.orange); setPixel(png, ox18 + 8, 7, O.orange);
  setPixel(png, ox18 + 7, 8, O.orange); setPixel(png, ox18 + 8, 8, O.orange);

  // --- Tile 19: Transit Gate (framed turnstile, blue indicator) ---
  const ox19 = 304;
  fillRect(png, ox19, 0, 16, 16, O.floorDark);
  fillRect(png, ox19, 0, 2, 16, O.wallMid);
  fillRect(png, ox19 + 14, 0, 2, 16, O.wallMid);
  fillRect(png, ox19 + 2, 0, 12, 2, O.wallMid);
  fillRect(png, ox19 + 2, 14, 12, 2, O.wallMid);
  fillRect(png, ox19 + 7, 2, 2, 12, O.wallLight);
  fillRect(png, ox19 + 2, 7, 12, 2, O.wallLight);
  setPixel(png, ox19 + 12, 3, C.blue); setPixel(png, ox19 + 12, 4, C.blue);

  // --- Tile 20: Garden Plot (dark soil with green growth) ---
  const ox20 = 320;
  fillRect(png, ox20, 0, 16, 16, hex('#1a1a12'));
  const soilL = [[2,2],[5,1],[9,3],[12,2],[1,6],[7,5],[14,4],[3,8],[10,7],[6,10],[13,9],[2,13],[11,12]];
  const soilD = [[4,3],[8,2],[11,4],[3,6],[6,7],[9,9],[1,11],[7,12],[12,11],[5,14]];
  for (const [sx, sy] of soilL) setPixel(png, ox20 + sx, sy, C.darkBrown);
  for (const [sx, sy] of soilD) setPixel(png, ox20 + sx, sy, C.darkGray);
  const sprouts = [[3,1],[8,0],[12,1],[5,3],[10,4],[1,7],[13,6]];
  for (const [gx, gy] of sprouts) setPixel(png, ox20 + gx, gy, C.darkGreen);

  // --- Tile 21: Notice Board (dark frame, parchment with text lines) ---
  const ox21 = 336;
  fillRect(png, ox21, 0, 16, 16, O.wallMid);
  fillRect(png, ox21 + 2, 1, 12, 13, C.darkBrown);
  fillRect(png, ox21 + 3, 2, 10, 11, C.tan);
  fillRect(png, ox21 + 4, 4, 8, 1, C.bone);
  fillRect(png, ox21 + 4, 6, 8, 1, C.bone);
  fillRect(png, ox21 + 4, 8, 6, 1, C.bone);
  fillRect(png, ox21 + 4, 10, 7, 1, C.bone);

  // --- Tile 22: Seed Pot (clay pot, green sprout) ---
  const ox22 = 352;
  fillRect(png, ox22, 0, 16, 16, O.floorMid);
  fillRect(png, ox22 + 3, 10, 10, 5, C.brown);
  fillRect(png, ox22 + 4, 9, 8, 2, hex('#1a1a12'));
  fillRect(png, ox22 + 3, 10, 10, 1, C.tan);
  fillRect(png, ox22 + 4, 14, 8, 1, C.darkBrown);
  setPixel(png, ox22 + 8, 8, C.darkGreen); setPixel(png, ox22 + 7, 7, C.darkGreen);
  setPixel(png, ox22 + 9, 7, C.green); setPixel(png, ox22 + 7, 6, C.green);

  // --- Tile 23: Personal Log (book with parchment pages) ---
  const ox23 = 368;
  fillRect(png, ox23, 0, 16, 16, O.floorMid);
  fillRect(png, ox23 + 3, 2, 10, 12, C.darkBrown);
  fillRect(png, ox23 + 3, 2, 2, 12, C.brown);
  fillRect(png, ox23 + 5, 2, 8, 12, hex('#d0c8b0'));
  fillRect(png, ox23 + 6, 4, 6, 1, C.darkBrown);
  fillRect(png, ox23 + 6, 6, 6, 1, C.darkBrown);
  fillRect(png, ox23 + 6, 8, 5, 1, C.darkBrown);
  fillRect(png, ox23 + 6, 10, 6, 1, C.darkBrown);
  setPixel(png, ox23 + 3, 2, C.tan); setPixel(png, ox23 + 3, 3, C.tan);

  // --- Tile 24: Homestead Gate (thin bars, orange accent tips) ---
  const ox24 = 384;
  fillRect(png, ox24, 0, 16, 16, O.floorDark);
  for (let bar = 2; bar <= 14; bar += 3) fillRect(png, ox24 + bar, 0, 1, 16, O.wallLight);
  fillRect(png, ox24 + 1, 2, 14, 2, O.wallLight);
  fillRect(png, ox24 + 1, 12, 14, 2, O.wallLight);
  for (let bar = 2; bar <= 14; bar += 3) setPixel(png, ox24 + bar, 0, O.orange);

  // --- Tile 25: Cache Entrance (collapsed rubble, dark recess) ---
  const ox25 = 400;
  fillRect(png, ox25, 0, 16, 16, O.wallMid);
  fillRect(png, ox25 + 5, 5, 6, 6, O.floorDark);
  fillRect(png, ox25 + 6, 6, 4, 4, rgba(22, 20, 18));
  const rubble = [[1,14],[2,13],[3,14],[4,15],[5,13],[6,14],[7,12],[8,13],[9,14],[10,12],[11,13],[12,14],[13,15],[14,13]];
  for (const [rx, ry] of rubble) setPixel(png, ox25 + rx, ry, O.wallDark);
  setPixel(png, ox25 + 5, 5, O.wallLight); setPixel(png, ox25 + 10, 5, O.wallLight);
  setPixel(png, ox25 + 5, 10, O.rust); // rust staining on broken edge

  // --- Tile 26: Resonance Point (Sol Gold/orange radiant glow on floor) ---
  const ox26 = 416;
  fillRect(png, ox26, 0, 16, 16, O.floorMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox26 + i, 7, O.floorDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox26 + 7, i, O.floorDark);
  setPixel(png, ox26 + 8, 8, C.solGold);
  setPixel(png, ox26 + 7, 8, O.orange); setPixel(png, ox26 + 9, 8, O.orange);
  setPixel(png, ox26 + 8, 7, O.orange); setPixel(png, ox26 + 8, 9, O.orange);
  setPixel(png, ox26 + 6, 8, O.rust); setPixel(png, ox26 + 10, 8, O.rust);
  setPixel(png, ox26 + 8, 6, O.rust); setPixel(png, ox26 + 8, 10, O.rust);

  // --- Tile 27: Survey Marker (floor with metal post/stake) ---
  const ox27 = 432;
  fillRect(png, ox27, 0, 16, 16, O.floorMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox27 + i, 7, O.floorDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox27 + 7, i, O.floorDark);
  fillRect(png, ox27 + 7, 3, 2, 9, O.wallLight);  // metal post
  fillRect(png, ox27 + 6, 3, 4, 2, O.wallLight);  // top cap
  setPixel(png, ox27 + 7, 2, C.paleGray);           // tip highlight
  fillRect(png, ox27 + 5, 11, 6, 2, O.wallDark);  // base anchor

  // --- Tile 28: Sealed Gate Briefing (Sol Gold pair indicator) ---
  const ox28 = 448;
  fillRect(png, ox28, 0, 16, 16, O.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox28 + bar, 0, 2, 16, O.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox28 + bar, i, O.wallDark);
  }
  fillRect(png, ox28, 7, 16, 2, O.wallMid);
  setPixel(png, ox28 + 6, 8, C.solGold); setPixel(png, ox28 + 9, 8, C.solGold);

  // --- Tile 29: Sealed Gate Training (orange pair indicator) ---
  const ox29 = 464;
  fillRect(png, ox29, 0, 16, 16, O.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox29 + bar, 0, 2, 16, O.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox29 + bar, i, O.wallDark);
  }
  fillRect(png, ox29, 7, 16, 2, O.wallMid);
  setPixel(png, ox29 + 6, 8, O.orange); setPixel(png, ox29 + 9, 8, O.orange);

  // --- Tile 30: Crate Closed (wooden supply crate with tan stamp) ---
  const ox30 = 480;
  fillRect(png, ox30, 0, 16, 1, C.darkGray);
  fillRect(png, ox30, 0, 1, 16, C.darkGray);
  fillRect(png, ox30 + 15, 0, 1, 16, C.darkGray);
  fillRect(png, ox30, 15, 16, 1, C.darkGray);
  fillRect(png, ox30 + 1, 1, 14, 14, C.brown);
  fillRect(png, ox30 + 1, 5, 14, 1, C.darkBrown);
  fillRect(png, ox30 + 1, 10, 14, 1, C.darkBrown);
  fillRect(png, ox30 + 7, 1, 1, 14, C.darkBrown);
  for (let i = 2; i < 14; i++) setPixel(png, ox30 + i, 1, C.tan);
  fillRect(png, ox30 + 9, 6, 3, 3, C.tan);

  // --- Tile 31: Crate Opened (open supply crate, dark interior) ---
  const ox31 = 496;
  fillRect(png, ox31, 0, 16, 1, C.darkGray);
  fillRect(png, ox31, 0, 1, 16, C.darkGray);
  fillRect(png, ox31 + 15, 0, 1, 16, C.darkGray);
  fillRect(png, ox31, 15, 16, 1, C.darkGray);
  fillRect(png, ox31 + 1, 1, 14, 14, C.brown);
  fillRect(png, ox31 + 1, 5, 14, 1, C.darkBrown);
  fillRect(png, ox31 + 7, 1, 1, 14, C.darkBrown);
  fillRect(png, ox31 + 2, 2, 12, 8, C.darkGray);
  fillRect(png, ox31 + 3, 3, 10, 6, rgba(15, 12, 10));
  for (let i = 2; i < 14; i++) setPixel(png, ox31 + i, 1, C.tan);

  savePNG(png, path.join(CONTENT_DIR, 'tilesets', 'outpost.png'));
}

// ============================================================================
// TILESET: Quarantine (10 tiles in a horizontal strip: 160x16)
// Sickly green/contaminated — biohazard zone
// ============================================================================

function generateQuarantineTileset() {
  const png = createPNG(208, 16); // 13 tiles × 16px

  // Quarantine palette — gray-green contamination, rust decay, warning red
  const Q = {
    floorDark:   hex('#1c261c'),
    floorMid:    hex('#252e25'),
    floorLight:  hex('#303a2d'),
    wallDark:    hex('#374632'),
    wallMid:     hex('#4a5a45'),
    wallLight:   hex('#586950'),
    wallTop:     hex('#5f7058'),
    doorMid:     hex('#8a6a30'),
    doorDark:    hex('#64481e'),
    doorLight:   hex('#a5843c'),
    voidColor:   hex('#0a100a'),
    water1:      hex('#142d12'),
    water2:      hex('#23411c'),
    water3:      hex('#325526'),
    teal:        hex('#32aa64'),
    contamGreen: hex('#50a03c'),
    rust:        hex('#904020'),
    rustLight:   hex('#b05030'),
    warningRed:  C.red,
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
  setPixel(png, ox1 + 4, 3, Q.contamGreen); setPixel(png, ox1 + 11, 10, Q.contamGreen);
  setPixel(png, ox1 + 9, 4, Q.rust); setPixel(png, ox1 + 3, 11, Q.rust);

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
  const qCracksGreen = [[3,2],[4,3],[5,5],[6,8],[8,10],[11,12]];
  const qCracksRust  = [[4,4],[6,6],[5,7],[7,9],[9,11],[10,11],[12,13]];
  for (const [cx, cy] of qCracksGreen) setPixel(png, ox2 + cx, cy, Q.contamGreen);
  for (const [cx, cy] of qCracksRust)  setPixel(png, ox2 + cx, cy, Q.rust);

  // --- Tile 3: Quarantine Wall (gray-green, rust streaks) ---
  const ox3 = 48;
  fillRect(png, ox3, 0, 16, 16, Q.wallMid);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 0, Q.wallTop);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + i, 15, Q.wallDark);
  for (let i = 0; i < 16; i++) setPixel(png, ox3 + 15, i, Q.wallDark);
  const qwLight = [[2,2],[7,3],[10,4],[13,6],[4,8],[8,7],[1,10],[6,12],[11,9],[3,14]];
  const qwDark  = [[5,3],[1,6],[9,4],[12,7],[3,9],[7,11],[2,12],[10,10],[14,13],[8,14]];
  for (const [sx, sy] of qwLight) setPixel(png, ox3 + sx, sy, Q.wallLight);
  for (const [sx, sy] of qwDark)  setPixel(png, ox3 + sx, sy, Q.wallDark);
  const qwRust = [[6,4],[6,5],[6,6],[12,8],[12,9],[3,11],[3,12]];
  for (const [rx, ry] of qwRust) setPixel(png, ox3 + rx, ry, Q.rust);

  // --- Tile 4: Hazard Door Closed (rust-brown stripes, red indicator, green pull) ---
  const ox4 = 64;
  fillRect(png, ox4, 0, 16, 16, Q.doorMid);
  fillRect(png, ox4, 0, 1, 16, Q.doorDark);
  fillRect(png, ox4 + 15, 0, 1, 16, Q.doorDark);
  fillRect(png, ox4 + 1, 3, 14, 2, Q.doorLight);
  fillRect(png, ox4 + 1, 11, 14, 2, Q.doorLight);
  for (let vy = 0; vy < 16; vy++) {
    setPixel(png, ox4 + 5, vy, Q.doorDark);
    setPixel(png, ox4 + 10, vy, Q.doorDark);
  }
  setPixel(png, ox4 + 7, 7, Q.warningRed); setPixel(png, ox4 + 8, 7, Q.warningRed);
  setPixel(png, ox4 + 7, 8, Q.warningRed); setPixel(png, ox4 + 8, 8, Q.warningRed);
  setPixel(png, ox4 + 12, 7, Q.contamGreen); setPixel(png, ox4 + 12, 8, Q.contamGreen);

  // --- Tile 5: Door Open ---
  const ox5 = 80;
  fillRect(png, ox5, 0, 16, 16, Q.floorDark);
  fillRect(png, ox5, 0, 2, 16, Q.doorDark);
  fillRect(png, ox5 + 14, 0, 2, 16, Q.doorDark);
  fillRect(png, ox5 + 4, 2, 8, 12, rgba(20, 28, 18));

  // --- Tile 6: Stairs Down (warning red arrow) ---
  const ox6 = 96;
  fillRect(png, ox6, 0, 16, 16, Q.floorMid);
  fillRect(png, ox6 + 2, 2, 12, 3, Q.floorLight);
  fillRect(png, ox6 + 3, 5, 10, 3, Q.floorMid);
  fillRect(png, ox6 + 4, 8, 8, 3, Q.floorDark);
  fillRect(png, ox6 + 5, 11, 6, 3, rgba(18, 25, 16));
  setPixel(png, ox6 + 7, 13, Q.warningRed); setPixel(png, ox6 + 8, 13, Q.warningRed);
  setPixel(png, ox6 + 6, 12, Q.warningRed); setPixel(png, ox6 + 9, 12, Q.warningRed);

  // --- Tile 7: Toxic Waste (contamination green murk with surface film) ---
  const ox7 = 112;
  fillRect(png, ox7, 0, 16, 16, Q.water1);
  const qWave = [[2,3],[3,3],[4,3],[8,5],[9,5],[10,5],[1,9],[2,9],[3,9],[7,11],[8,11],[9,11],[12,7],[13,7],[4,14],[5,14]];
  for (const [wx, wy] of qWave) setPixel(png, ox7 + wx, wy, Q.water2);
  const qWaveH = [[3,2],[9,4],[2,8],[8,10],[13,6],[5,13]];
  for (const [wx, wy] of qWaveH) setPixel(png, ox7 + wx, wy, Q.water3);
  setPixel(png, ox7 + 5, 4, Q.contamGreen);
  setPixel(png, ox7 + 11, 8, Q.contamGreen);
  setPixel(png, ox7 + 3, 12, Q.contamGreen);

  // --- Tile 8: Stairs Up (teal arrow — escape upward) ---
  const ox8 = 128;
  fillRect(png, ox8, 0, 16, 16, Q.floorMid);
  fillRect(png, ox8 + 5, 2, 6, 3, rgba(18, 25, 16));
  fillRect(png, ox8 + 4, 5, 8, 3, Q.floorDark);
  fillRect(png, ox8 + 3, 8, 10, 3, Q.floorMid);
  fillRect(png, ox8 + 2, 11, 12, 3, Q.floorLight);
  setPixel(png, ox8 + 7, 1, Q.teal); setPixel(png, ox8 + 8, 1, Q.teal);
  setPixel(png, ox8 + 6, 2, Q.teal); setPixel(png, ox8 + 9, 2, Q.teal);

  // --- Tile 9: Locked Hazard Door (warning red lock — biohazard sealed) ---
  const ox9 = 144;
  fillRect(png, ox9, 0, 16, 16, Q.doorMid);
  fillRect(png, ox9, 0, 1, 16, Q.doorDark);
  fillRect(png, ox9 + 15, 0, 1, 16, Q.doorDark);
  fillRect(png, ox9 + 1, 3, 14, 2, Q.doorLight);
  fillRect(png, ox9 + 1, 11, 14, 2, Q.doorLight);
  for (let vy = 0; vy < 16; vy++) {
    setPixel(png, ox9 + 5, vy, Q.doorDark);
    setPixel(png, ox9 + 10, vy, Q.doorDark);
  }
  fillRect(png, ox9 + 6, 6, 4, 4, Q.warningRed);
  setPixel(png, ox9 + 7, 7, C.darkGray); setPixel(png, ox9 + 8, 7, C.darkGray);
  setPixel(png, ox9 + 7, 8, C.darkGray);

  // --- Tile 10: Chest Closed (corroded container, rust trim, warning red lock) ---
  const ox10 = 160;
  fillRect(png, ox10, 0, 1, 16, Q.doorDark);
  fillRect(png, ox10 + 15, 0, 1, 16, Q.doorDark);
  fillRect(png, ox10 + 1, 0, 14, 16, Q.doorMid);
  fillRect(png, ox10 + 1, 0, 14, 5, Q.doorLight);   // lid
  fillRect(png, ox10 + 1, 5, 14, 1, Q.doorDark);    // seam
  fillRect(png, ox10 + 1, 14, 14, 2, Q.doorDark);   // shadow
  for (let i = 2; i < 14; i++) setPixel(png, ox10 + i, 1, Q.wallLight); // lid highlight
  setPixel(png, ox10 + 2, 1, Q.rust); setPixel(png, ox10 + 13, 1, Q.rust); // rust corner rivets
  setPixel(png, ox10 + 2, 13, Q.rust); setPixel(png, ox10 + 13, 13, Q.rust);
  // rust stain streaks on lid
  setPixel(png, ox10 + 5, 3, Q.rust); setPixel(png, ox10 + 5, 4, Q.rust);
  setPixel(png, ox10 + 10, 2, Q.rustLight); setPixel(png, ox10 + 10, 3, Q.rust);
  fillRect(png, ox10 + 6, 7, 4, 4, Q.warningRed);   // warning red lock
  setPixel(png, ox10 + 7, 8, C.darkGray); setPixel(png, ox10 + 8, 8, C.darkGray);

  // --- Tile 11: Chest Opened (open corroded container, dark interior) ---
  const ox11 = 176;
  fillRect(png, ox11, 0, 1, 16, Q.doorDark);
  fillRect(png, ox11 + 15, 0, 1, 16, Q.doorDark);
  fillRect(png, ox11 + 1, 0, 14, 16, Q.doorMid);
  fillRect(png, ox11 + 1, 14, 14, 2, Q.doorDark);
  fillRect(png, ox11 + 2, 1, 12, 10, Q.floorDark);  // interior
  fillRect(png, ox11 + 3, 2, 10, 8, rgba(18, 24, 16));
  setPixel(png, ox11 + 2, 12, Q.rust); setPixel(png, ox11 + 13, 12, Q.rust);
  for (let i = 2; i < 14; i++) setPixel(png, ox11 + i, 0, Q.doorLight); // open rim
  setPixel(png, ox11 + 6, 4, Q.contamGreen); // contamination stain inside

  // --- Tile 12: Sealed Gate (bars, warning red seal indicator) ---
  const ox12 = 192;
  fillRect(png, ox12, 0, 16, 16, Q.floorDark);
  for (let bar = 2; bar <= 13; bar += 4) {
    fillRect(png, ox12 + bar, 0, 2, 16, Q.wallMid);
    for (let i = 0; i < 16; i++) setPixel(png, ox12 + bar, i, Q.wallDark);
  }
  fillRect(png, ox12, 7, 16, 2, Q.wallMid);
  setPixel(png, ox12 + 7, 8, Q.warningRed); setPixel(png, ox12 + 8, 8, Q.warningRed);
  // rust spots on gate bars (abandoned, decayed)
  setPixel(png, ox12 + 3, 3, Q.rust); setPixel(png, ox12 + 10, 11, Q.rust);

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
