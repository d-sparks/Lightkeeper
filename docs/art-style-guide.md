# Lightkeeper Art Style Guide

A reference for all sprite and tileset art in Lightkeeper. The goal is visual consistency across all assets — current placeholders were generated independently and lack a unified look. This document defines the target aesthetic so replacement art is cohesive.

---

## Technical Specifications

| Property | Value |
|----------|-------|
| Sprite size | 16x16 pixels native |
| Display size | 32x32 pixels (2x nearest-neighbor upscale) |
| Format | PNG with alpha transparency |
| Smoothing | Disabled (`imageSmoothingEnabled = false`) — hard pixel edges |
| Tileset layout | Horizontal strip, tile N at pixel offset `N * 16` |
| Isometric tiles | ~64x32 diamond footprint for ground tiles |

---

## Target Aesthetic

### Style Reference

**Dark sci-fi pixel art** in the tradition of classic 16-bit dungeon crawlers, but with a science fiction edge. Think the visual language of games like Caves of Qud, Cogmind, or DUSK — functional, readable, atmospheric. Not cute or cartoony. Not hyper-detailed either. Every sprite should be **legible at 32x32** and **identifiable at a glance**.

### Guiding Principles

1. **Readability first.** At 16x16, clarity beats detail. Use strong silhouettes and high-contrast outlines. A player should instantly distinguish a monster from an item from an NPC.
2. **Consistent lighting.** All entity sprites assume a single top-left light source (~10 o'clock). Highlights on upper-left edges, shadows on lower-right. This unifies sprites that appear together on screen.
3. **Transparent backgrounds.** All entity sprites (characters, monsters, items) use fully transparent backgrounds. No colored bounding boxes or halos.
4. **1-pixel black outline.** All entity sprites use a 1-pixel dark outline (not pure black — use the darkest palette shade for that sprite's color family). This separates sprites from the environment cleanly.
5. **Limited internal detail.** At 16x16, suggest detail rather than rendering it. A face is 2 eyes and maybe a mouth. Armor is a color shift and a highlight. Weapons are a silhouette with one accent color.
6. **Dithering sparingly.** Use checkerboard dithering only for large gradient areas (e.g., fog, energy fields). Avoid dithering on small sprites — it reads as noise at this scale.

---

## Master Color Palette

All sprites should draw from this unified palette. Each color has a **dark**, **mid**, and **light** variant for shading. Using a shared palette is the single most important factor for visual consistency.

### Core Grays (universal)

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Void Black | `#0a0a0f` | 10, 10, 15 | Outlines, deep shadow |
| Dark Slate | `#1e1e2a` | 30, 30, 42 | Dark surfaces, night sky |
| Mid Gray | `#3d3d50` | 61, 61, 80 | Stone, metal shadow |
| Stone Gray | `#5a5a6e` | 90, 90, 110 | Stone surfaces, base metal |
| Light Gray | `#8c8ca0` | 140, 140, 160 | Highlights on stone, light metal |
| Pale Gray | `#c0c0d0` | 192, 192, 208 | Bright highlights, pale surfaces |

### Warm Tones

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Dark Brown | `#5a4128` | 90, 65, 40 | Wood shadow, leather dark |
| Brown | `#8c6440` | 140, 100, 64 | Wood, leather, earth |
| Tan | `#c4a070` | 196, 160, 112 | Wood highlight, sand, skin |
| Dark Red | `#8c1e1e` | 140, 30, 30 | Blood, danger, deep fire |
| Red | `#c83232` | 200, 50, 50 | Health, damage, fire |
| Light Red | `#e06060` | 224, 96, 96 | Fire highlight, warning glow |
| Rust | `#a05a28` | 160, 90, 40 | Corroded metal, aged surfaces |
| Orange | `#dc9632` | 220, 150, 50 | Flame, warmth, torchlight |
| Yellow | `#f0dc50` | 240, 220, 80 | Sparks, energy, bright accent |

### Cool Tones

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Dark Blue | `#1e3c78` | 30, 60, 120 | Deep water, night accent |
| Blue | `#3c78c8` | 60, 120, 200 | Player default, water, ice |
| Light Blue | `#6ea0e0` | 110, 160, 224 | Sky, ice highlight, UI |
| Dark Teal | `#1e6450` | 30, 100, 80 | Deep bioluminescence |
| Teal | `#32aa96` | 50, 170, 150 | Bioluminescence, tech glow |
| Light Teal | `#64d2b4` | 100, 210, 180 | Bright glow, healing |

### Purple / Nightside

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Dark Purple | `#50236e` | 80, 35, 110 | Nightside shadow, umbra |
| Purple | `#823caa` | 130, 60, 170 | Nightside creatures, umbrasite |
| Light Purple | `#b478d2` | 180, 120, 210 | Nightside glow, magic |

### Greens

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Dark Green | `#1e5a28` | 30, 90, 40 | Foliage shadow, poison |
| Green | `#46a046` | 70, 160, 70 | Foliage, Ring vegetation, health |
| Light Green | `#78c878` | 120, 200, 120 | Bright foliage, heal effect |

### Special

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Bone | `#c8beaa` | 200, 190, 170 | Skeletons, ancient material |
| Sol Gold | `#f0c850` | 240, 200, 80 | Sol energy, Array tech, UI gold |
| White | `#dcdce6` | 220, 220, 230 | Brightest highlight, Dayside glare |

---

## Sprite Categories & Conventions

### Players (16x16)

- Front-facing, standing pose. Symmetrical where possible.
- Distinct **color accent** per variant (blue, red, green, orange) using the palette above.
- Base body in mid/dark gray (armor). Color accent on chest plate, helmet crest, or visor.
- Should look like a frontier engineer in light armor — not a fantasy knight. Think jumpsuit + helmet + utility belt.
- Sol unit visible as a small glowing element (Sol Gold) on the chest or belt.

### Monsters (16x16)

Each monster should be immediately distinguishable by **silhouette** alone.

| Type | Silhouette Goal | Palette Emphasis |
|------|----------------|------------------|
| Skeletons | Thin, angular, bone-colored | Bone, Dark Brown, Dark Red (eyes) |
| Luddites | Bulky humanoid, improvised gear | Brown, Rust, Dark Gray |
| Nightside creatures | Organic, alien, fluid shapes | Purple family, Teal (glow accents) |
| Crypt undead | Hunched, decayed, shambling | Bone, Dark Slate, Dark Green |
| Ice/cold enemies | Sharp, crystalline edges | Light Blue, White, Pale Gray |
| Fire/heat enemies | Jagged, glowing core | Red family, Orange, Yellow |

**Monster visual rules:**
- Hostile creatures get **warm-colored eyes** (red, orange, yellow) — 1-2 bright pixels for the eyes make any monster feel alive and threatening.
- Nightside creatures should incorporate at least one bioluminescent accent (teal or purple glow).
- Larger/boss monsters can use bolder outlines (2px where needed for mass).

### NPCs (16x16)

- Front-facing like players, but **no helmet** (visible face/hair distinguishes them from players).
- Each named NPC should have a unique color accent or accessory detail.
- Friendly NPCs use cooler, calmer palette selections. No red eyes.
- Should read as "person" not "threat" — posture is upright and relaxed versus the aggressive stances of monsters.

### Items (16x16)

Items have the least space to work with and must be instantly recognizable.

| Category | Convention |
|----------|-----------|
| Weapons | Diagonal orientation (lower-left to upper-right). Handle in brown, blade/head in gray or accent color. |
| Consumables | Centered, upright. Potions are a flask silhouette with colored fill. |
| Keys / quest items | Centered, distinctive shape. Use Sol Gold or unique accent to signal importance. |
| Sol components | Geometric shapes with Sol Gold + Teal glow. Should feel technological. |
| Materials / resources | Rough organic or mineral shapes. Use contextual colors (umbrasite = purple, metal = gray). |

**Item visual rules:**
- Items should **not** have outlines as heavy as entities. Use a 1px outline in a dark shade of the item's own color rather than black.
- Items sit on fully transparent backgrounds with no shadow (the engine doesn't do drop shadows for item sprites).

### Tilesets (16x16 per tile, horizontal strip)

Tiles define the environment and set the mood. Each tileset corresponds to a location theme (see `content/sprites/iso/*/prompt.md` for detailed per-theme direction).

**General tileset rules:**
- Floor tiles should be **lower contrast** than entity sprites. The environment is the backdrop — entities must pop against it.
- Wall tiles should be visibly denser/darker than floors to clearly communicate impassability.
- Interactive tiles (doors, switches, chests) get a subtle accent color that floors and walls don't use — typically Sol Gold or Teal for "something you can interact with."
- Tile transitions: adjacent tiles in a strip should be designed to tile seamlessly when placed next to themselves.

---

## Zone Color Identity

Each major zone of Erith has a dominant color identity. This helps players immediately sense where they are.

| Zone | Dominant Colors | Mood |
|------|----------------|------|
| Outpost / Hub | Stone Gray, Brown, warm Orange (torchlight) | Safe, worn, lived-in |
| Stone Crypt | Cold Gray, Slate Blue, Bone White | Ancient, still, oppressive |
| Dark Perimeter | Dark Slate, Purple, Teal (bioluminescence) | Hostile, alien, cold |
| Nightside Deep | Near-Black, Purple, bright Teal accents | Abyssal, dangerous, beautiful |
| Dayside Solar | White, Chrome (Pale Gray), Sol Gold, Circuit Blue | Blinding, sterile, inhuman |
| Quarantine Zone | Gray-Green, Rust, warning Red | Toxic, abandoned, decaying |
| Underlumen Depths | Dark Blue, Teal, crystalline Light Purple | Mysterious, vast, echoing |
| Natural Cave | Dark Brown, Stone Gray, Dark Green | Organic, damp, primal |
| Transit Infrastructure | Mid Gray, Blue, functional Orange | Industrial, utilitarian |
| Meridian City | Light Gray, Blue, Green accents | Civilized, orderly, alive |
| Homestead / Residential | Brown, Tan, warm Green | Homey, agricultural, calm |
| Abandoned Frontier | Rust, Dark Brown, faded Tan | Desolate, weathered, forgotten |

---

## Anti-Patterns (What to Avoid)

- **Pure black (#000000) fills.** Use Void Black (`#0a0a0f`) instead — pure black looks like a rendering hole.
- **Pure white (#ffffff) fills.** Use White (`#dcdce6`) — pure white is too harsh and implies a bug.
- **Excessive color count per sprite.** A single 16x16 sprite should use **6-10 colors max** (including transparency). More than that and it becomes muddy.
- **Off-palette colors.** Don't introduce one-off colors that only appear in a single sprite. If a new color is genuinely needed, add it to this palette first.
- **Symmetry on organic creatures.** Slight asymmetry makes monsters feel alive. Perfect symmetry is for machines and UI elements.
- **Sub-pixel detail.** Don't try to render details smaller than one pixel. If it can't be a full pixel, leave it out.
- **Dark sprites on dark tiles.** Nightside creatures need at least one bright accent (eyes, glow) or they'll vanish against dark tilesets. Always test sprites against the darkest tileset they'll appear on.

---

## Isometric Ground Tiles

The `content/sprites/iso/` directory contains isometric ground templates (~64x32 diamond). These follow the same palette but have additional constraints:

- Ground tiles use a **3-tone shading** approach: top face (lightest), left face (mid), right face (darkest).
- The top face is the primary visible surface and carries texture detail.
- Edge pixels define the diamond shape and use the darkest tone.
- Each theme directory has a `prompt.md` with detailed visual direction and a `ground_template.png` showing the base shape.

---

## Workflow for Adding New Sprites

1. Identify which category the sprite belongs to (player, monster, NPC, item, tile).
2. Select colors from the master palette above. Stay within 6-10 colors.
3. Follow the silhouette and convention rules for that category.
4. Test the sprite against the tileset(s) where it will appear — ensure it's readable.
5. If generating placeholders, update `tools/generate-sprites.js` using palette hex values from this guide.
6. Add the sprite path to `PLACEHOLDER_ASSETS.md` if it's a placeholder.

---

## Reference: Current Placeholder Inventory

See `PLACEHOLDER_ASSETS.md` for the full list of placeholder sprites that need replacement. The `tools/generate-sprites.js` script generates them programmatically. When replacing placeholders with final art, simply overwrite the PNG files — no engine changes needed.
