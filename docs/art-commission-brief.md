# Art Commission Brief — Priority Sprites (Batch 1)

10 entity sprites to replace first. These are the most-seen entities in the game and have the biggest impact on first impressions. All are currently programmatically generated placeholders.

See `docs/art-style-guide.md` for the full technical spec, master palette, and conventions. Key points repeated here for artist convenience.

---

## Technical Requirements

| Property | Value |
|----------|-------|
| Canvas | 16x16 pixels per frame |
| Delivery format | 64x16 PNG horizontal strip (4 frames) |
| Frame layout | Frame 0: idle1, Frame 1: idle2 (bob), Frame 2: attack, Frame 3: hit |
| Background | Fully transparent (PNG alpha) |
| Outline | 1px dark outline around all opaque regions (darkest shade of sprite's color family, not pure black) |
| Lighting | Top-left light source (~10 o'clock). Highlights upper-left, shadows lower-right. |
| Colors per sprite | 6–10 max (including outline shade) |
| Style | Dark sci-fi pixel art. Readable at 32x32 upscale. Legible silhouettes. Not cute/cartoony. |

Palette hex values are in `docs/art-style-guide.md` — please use the master palette colors exclusively.

---

## Entity Briefs

### 1. Player (4 color variants)

**Files:** `content/sprites/player_blue.png`, `player_red.png`, `player_green.png`, `player_orange.png`

**Description:** Frontier engineer in light armor. Think jumpsuit + helmet + utility belt — NOT a fantasy knight. Symmetrical, front-facing standing pose.

**Visual elements:**
- Gray helmet with colored visor (accent color per variant)
- Light body armor in mid/dark gray
- Color accent on chest plate and visor: Blue `#3c78c8`, Red `#c83232`, Green `#46a046`, Orange `#dc9632`
- Small Sol Gold `#f0c850` glow on chest (sol unit)
- Brown `#5a4128` boots

**Palette:** Core Grays + accent color (3 shades) + Sol Gold + Brown

**Priority:** Highest — player sees this sprite 100% of play time.

---

### 2. Warden Holt — Outpost Commander

**File:** `content/sprites/outpost_warden.png`

**NPC ID:** `outpost_warden`

**Description:** The player's commanding officer at Outpost Balor. Practical, experienced, weathered. Military bearing but approachable. No helmet (NPC convention — visible face). First NPC the player meets.

**Visual elements:**
- Short-cropped brown/gray hair (aging veteran)
- Teal `#32aa96` military coat/uniform (Lightkeeper authority color)
- Dark Teal `#1e6450` shadows on coat
- Gray shoulder insignia or rank marking
- Skin tone face, stern but not hostile
- Brown boots, upright stance

**Palette:** Teal family (3 shades) + Core Grays + Brown + Skin tones

**Narrative role:** Mission-giver, authority figure, Act 1 anchor.

---

### 3. MERIDIAN-7 — Array Terminal

**File:** `content/sprites/meridian_7.png`

**NPC ID:** `meridian_7`

**Description:** An AI terminal, not a person. This is the interface through which humans trade with the Array. Should look like a sleek machine terminal — a vertical screen/monolith with a glowing display. NOT humanoid.

**Visual elements:**
- Vertical rectangular terminal form (no legs, no arms)
- Sol Gold `#f0c850` display/screen area (upper portion)
- Teal `#32aa96` accent lines or data readouts
- Dark Slate `#1e1e2a` / Mid Gray `#3d3d50` metal chassis
- Small antenna or sensor nub on top
- Subtle glow effect: 1-2 pixels of Light Teal `#64d2b4` adjacent to screen

**Palette:** Core Grays + Sol Gold + Teal family

**Narrative role:** Trading interface, automation manager, becomes compromised in Act 2.

---

### 4. Apprentice Sol Engineer

**File:** `content/sprites/sol_engineer_1.png`

**NPC ID:** `sol_engineer_1`

**Description:** A young technician at the outpost workshop. Friendly, slightly harried. Wears work coveralls and safety goggles pushed up on forehead. The player's equipment/tutorial NPC.

**Visual elements:**
- Orange `#dc9632` work coveralls/jumpsuit (workshop uniform)
- Rust `#a05a28` shadows on coveralls
- Safety goggles pushed up on head (Sol Gold lens, 2px)
- Skin tone face, no helmet (NPC convention)
- Brown hair
- Small tool belt or wrench detail
- Sol Gold accent on belt/tool (engineer identity)

**Palette:** Orange/Rust (coveralls) + Sol Gold + Brown + Skin tones + Core Grays

**Narrative role:** Quest-giver (sol unit repair), tutorial NPC.

---

### 5. Councillor Asha Denn

**File:** `content/sprites/councillor_asha.png` (also `councillor_asha_denn.png` travel variant)

**NPC ID:** `councillor_asha`

**Description:** Senior Meridian Council member. Biologist by training, politician by necessity. Wears formal crimson robes with gold diplomatic insignia. Precise, composed, authoritative.

**Visual elements:**
- Formal crimson robe: Dark Red `#8c1e1e` body, Red `#c83232` highlight
- Sol Gold `#f0c850` collar and twin insignia marks (Cultivar Corps rank)
- Short dark brown hair (formal cut)
- Skin tone face, calm expression
- Robe is wide/flowing (suggests authority and formal status)

**Travel variant** (`councillor_asha_denn.png`): Same face, but crimson travel cloak (no insignia, single gold clasp at center).

**Palette:** Red family (3 shades) + Sol Gold + Brown + Skin tones

**Narrative role:** Political ally in Act 2, voice of reason.

---

### 6. Dusk Crawler

**File:** `content/sprites/dusk_crawler.png`

**Monster ID:** `dusk_crawler` — 28 HP, melee chase

**Description:** Low, insectoid alien creature from the dark perimeter. Four leg pairs, antennae, bioluminescent accents. The first "real" enemy players fight outside the tutorial.

**Visual elements:**
- Low horizontal body (wider than tall) — crawling insect silhouette
- Purple `#823caa` body with Dark Purple `#50236e` carapace edges
- Orange `#dc9632` hostile eyes (2 bright pixels — key visual rule for all monsters)
- Teal `#32aa96` bioluminescent accent (1-2 pixels on abdomen)
- Antennae extending upward from head
- Asymmetric leg placement (organic, not mechanical)

**Palette:** Purple family (3 shades) + Orange (eyes) + Teal (glow)

---

### 7. Frostfang Hunter

**File:** `content/sprites/frostfang_hunter.png`

**Monster ID:** `frostfang_hunter` — 55 HP, pack hunter, 1.9 speed

**Description:** Icy wolf-like predator. Lean, fast, hunts in packs. Crystalline ice-fur with sharp features. Found in cold perimeter zones.

**Visual elements:**
- Side-facing wolf silhouette (head left, tail right) — motion pose
- Light Blue `#6ea0e0` fur/body
- Blue `#3c78c8` mid-tones
- Dark Blue `#1e3c78` outline and shadow
- Orange `#dc9632` hostile eyes
- White `#dcdce6` teeth/fangs (1-2 pixels)
- Slight crystalline edge to fur (ice accents)

**Palette:** Blue family (3 shades) + White + Orange (eyes)

---

### 8. Shade Stalker

**File:** `content/sprites/shade_stalker.png`

**Monster ID:** `shade_stalker` — 85 HP, melee chase + poison

**Description:** Nightside predator. Hunched humanoid shadow creature with long arms and claws. Wide-shouldered, narrow-waisted. Menacing lurking pose.

**Visual elements:**
- Hunched humanoid silhouette, arms spread wide (threatening)
- Dark Slate `#1e1e2a` / Mid Gray `#3d3d50` shadow body
- Orange `#dc9632` hostile eyes
- Arms extend past body width (long claw reach)
- Slight asymmetry (organic, alive)
- No bioluminescent accents — this creature is shadow, not glow

**Palette:** Dark Grays (3 shades) + Orange (eyes only)

---

### 9. Crystal Guardian (Boss)

**File:** `content/sprites/crystal_guardian.png`

**Monster ID:** `crystal_guardian` — 700 HP, 3-phase boss

**Description:** Ancient crystalline construct guarding the deep tunnels. Geometric, faceted body. Part statue, part living crystal. The first major boss encounter.

**Visual elements:**
- Geometric humanoid silhouette — broad-shouldered, angular
- Crystal crown/spires extending above head (3 points)
- Light Blue `#6ea0e0` crystal body with Blue `#3c78c8` facets
- White `#dcdce6` facet highlights (suggests crystalline shine)
- Orange `#dc9632` hostile eyes
- Dark Blue `#1e3c78` base/legs (grounded, heavy)
- Pale Gray `#c0c0d0` shoulder accents (crystal shard shoulders)
- Should feel massive even at 16x16 — fill the full sprite space

**Palette:** Blue family (3 shades) + White + Pale Gray + Orange (eyes) + Dark Blue

---

### 10. Dural Voss (Boss)

**File:** `content/sprites/dural_voss.png`

**Monster ID:** `dural_voss` — 600 HP, boss_retreat AI, Act 1 climax boss

**Description:** Warlord of the Unbounded — charismatic raider leader who commands the Luddite forces occupying the Spire of Vigil. Brutal, imposing, but not mindless. Heavy scavenged armor with trophies. Retreats at 20% HP rather than dying — he's a survivor, not a martyr.

**Visual elements:**
- Tall humanoid silhouette, broad and imposing — fill the sprite space
- Rust `#a05a28` and Brown `#5a4128` scavenged heavy armor (raider aesthetic)
- Orange `#dc9632` hostile eyes
- Red `#c83232` shoulder marking or war paint (faction identity, matches Luddite colors)
- Dark Red `#8c1e1e` shadows on armor plating
- Mid Gray `#3d3d50` metal pauldron or salvaged tech plating on one shoulder
- Short or shaved head (warlord, no helmet — shows confidence)
- Weapon suggestion: large blade or club shape in attack frame (Frame 2)
- Asymmetric armor — one shoulder heavier than the other (scavenged, not uniform)

**Palette:** Brown/Rust (armor) + Red family (war paint) + Orange (eyes) + Core Grays

**Narrative role:** Act 1 final boss. Retreats and delivers key revelation about the Array's true role.

---

## Delivery Notes

- Replace the PNG files at the paths listed above. No engine changes needed.
- All sprites are loaded at runtime from `/content/sprites/`. Overwriting the file is sufficient.
- Test against dark tilesets (Dark Perimeter, Stone Crypt) — ensure all sprites are readable.
- The engine applies nearest-neighbor upscaling; sub-pixel blending will look wrong.
- Animation: Frame 0 (idle standing), Frame 1 (slight bob up 1px), Frame 2 (attack lunge right 2px), Frame 3 (hit recoil left 1px). These are currently auto-generated from the base frame — custom animation frames would be a major visual upgrade.

## File Checklist

| # | File | Entity | Type |
|---|------|--------|------|
| 1 | `player_blue.png` | Player (blue) | Player |
| 2 | `player_red.png` | Player (red) | Player |
| 3 | `player_green.png` | Player (green) | Player |
| 4 | `player_orange.png` | Player (orange) | Player |
| 5 | `outpost_warden.png` | Warden Holt | NPC |
| 6 | `meridian_7.png` | MERIDIAN-7 Terminal | NPC |
| 7 | `sol_engineer_1.png` | Apprentice Sol Engineer | NPC |
| 8 | `councillor_asha.png` | Councillor Asha Denn | NPC |
| 9 | `dusk_crawler.png` | Dusk Crawler | Monster |
| 10 | `frostfang_hunter.png` | Frostfang Hunter | Monster |
| 11 | `shade_stalker.png` | Shade Stalker | Monster |
| 12 | `crystal_guardian.png` | Crystal Guardian (Boss) | Monster |
| 13 | `dural_voss.png` | Dural Voss (Boss) | Monster |
| 14 | `councillor_asha_denn.png` | Asha Denn (travel variant) | NPC |
