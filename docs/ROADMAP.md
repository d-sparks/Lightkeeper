# Lightkeeper Roadmap

Last updated: 2026-03-06

## Project Status Overview

| Area | Status | Notes |
|------|--------|-------|
| Core Engine | Done | Physics, combat, abilities, AI, scripting, networking, rendering all functional |
| Act I Content | Done | Main quest (13 steps), 11 quests total, 41 dungeons, 39 NPCs, 26 monster types |
| Monster AI | Done | 5 AI types: melee_chase, ranged_kite, ambush, patrol, pack |
| Procedural Generation | Done | Template-based generation working (4 templates: quarantine, quarantine_deep, frost_crypt, fungal_forest) |
| Scripting System | Done | Trigger-Condition-Action fully implemented, quest DAG system working |
| Testing Tools | Done | Content validator + headless simulator both functional. Wired into `npm test` |
| Sol Grid / Progression | Done | Grid placement + adjacency modifiers + 25 components. Design decisions resolved (stacking caps, modifier-generator adjacency, component limits) |
| Loot System | Done | Engine supports loot tables with weighted drops. 22 loot tables across common.json and nightside.json. All combat monsters wired |
| Item Rarity UI | Done | Rarity colors (common→legendary) displayed in inventory and sol grid |
| Art Style Guide | Done | Master palette, sprite conventions, zone color identity documented (docs/art-style-guide.md) |
| Content Validation CI | Done | `npm test` runs content-validator.js + headless-sim.js --mainline |
| Automation System | Partial | Basic automation works (solar panels, harvesters, silicon). Grid placement UI not yet built |
| Act II Content | Partial | Dayside locations exist, MERIDIAN-7 umbrasite quest created. Deeper Array questlines needed |
| Act III Content | Stub | Underlumen approach + crypts exist. Story revelation content not built |
| Art / Audio | Placeholder | Generated placeholder sprites. Art style guide exists. No audio content |
| Game Balance | Needs Work | Combat functional but untuned. Energy economy untested at scale |
| Player Onboarding | Partial | WASD/interact prompts exist. Could be smoother |
| Content Validation Errors | Needs Work | 6 known broken refs/flags (see docs/NEXT_TODOS.md) |
| Monster Loot Wiring | Done | All 25 combat monsters have lootTable refs. 22 biome-specific tables across 2 files |

---

## Short-Term Priorities (Next 1-2 Sprints)

Focus: **Fix broken content, wire up existing systems, and polish the core loop**

1. **Fix content validation errors** — 6 known broken references/flags. These are real bugs players can hit. Fix them before adding more content.
2. **Wire monster loot drops** — The loot engine exists but most monsters have no lootTable reference. Add lootTable refs to all monster types and create biome-specific loot tables.
3. **Combat feel polish** — Enhance remaining rough edges: screen shake, ability-specific visual effects, monster death variety. Some effects exist but the overall feel needs another pass.
4. **Sound effects** — Even placeholder beeps dramatically improve game feel. Wire basic sounds for attacks, hits, deaths, pickups, doors, and transitions.
5. **Deploy new monsters to dungeons** — 26 monster types exist but the newer ones (ambush, patrol, pack AI) aren't spawned in actual dungeon floors.

## Medium-Term Priorities (Next 1-3 Months)

Focus: **Build the automation UI, expand Act II, and deepen the game loop**

6. **Automation grid UI** — Implement the full-screen grid placement screen per docs/automation_screen.md. This is the next major feature — transforms the factory/automation feel.
7. **Act II quest expansion** — Extend the MERIDIAN-7 relationship: Array complex exploration, advanced trades, escalating umbrasite demands. The narrative hook is planted; flesh it out.
8. **Sol unit variants** — Design and implement the 5-6 sol unit models with different grid sizes and innate perks. This is the main progression differentiator.
9. **Death penalty** — Implement meaningful consequences for dying (item loss, energy drain). Needs careful tuning.
10. **Multiplayer polish** — Party indicators, shared quest progress display, co-op balance tuning.
11. **Environmental hazards** — Cold damage in nightside, heat in geothermal, poison in fungal. Makes biomes feel distinct and dangerous.

## Long-Term Vision (3+ Months)

Focus: **Complete the story, real art, audio, and endgame**

12. **Act III content** — Underlumen revelation, three ending paths, faction choice system.
13. **Real art assets** — Replace all placeholder sprites with proper pixel art following the style guide.
14. **Music and ambient audio** — Per-biome music, combat music, ambient sounds.
15. **Boss encounters** — Multi-phase bosses with unique mechanics, arena design, and rewards.
16. **Endgame loop** — Post-story sandbox with escalating procedural dungeons, legendary modifier chase, automation scaling.
17. **Unit tests** — Implement Tier 1-2 unit tests per docs/TESTING.md (flag-store, event-bus, conditions, actions). High value per effort.
18. **Mobile/touch optimization** — Touch controls exist but need polish for real mobile play.

---

## Completed Projects

These are done and don't need further investment:

- **Core engine architecture** — Server-authoritative model, WebSocket networking, PixiJS rendering
- **Scripting system** — Trigger-Condition-Action with full quest DAG support (docs/game-scripting.md)
- **Procedural generation engine** — 4 templates across biomes, depth chaining (docs/procedural-generation.md)
- **Content validator tool** — tools/content-validator.js validates all JSON cross-references
- **Headless game simulator** — tools/headless-sim.js runs quests end-to-end without a browser
- **Visual content editor** — editor/ with REST API, git integration, dungeon/entity editing
- **Act I main quest** — 13-step quest from Outpost Balor to Meridian City, fully playable
- **Act I side quests** — 10 side quests with discovery mechanisms (NPC-offer, found-item, hidden NPC)
- **Monster AI expansion** — 5 AI types (melee_chase, ranged_kite, ambush, patrol, pack)
- **Sol grid design decisions** — Modifier-generator adjacency, stacking caps, component limits all resolved
- **Biome monster roster** — 26 monster types covering frost, geothermal, fungal, nightside, outpost
- **Sol component catalog** — 25 components (abilities, modifiers, generators)
- **Loot table engine** — Drop system implemented, weighted rolls, biome tables
- **Item rarity UI** — Color-coded inventory and sol grid display
- **Art style guide** — Master palette, sprite conventions, zone identity (docs/art-style-guide.md)
- **Color palette** — Unified hex palette for all sprites
- **CI test pipeline** — `npm test` runs validator + headless sim
- **Act II initial content** — MERIDIAN-7 umbrasite retrieval quest, Nightside Caverns/Depths dungeons
- **Sable dialogue expansion** — Conditional dialogue branches reacting to quest progress
- **Environmental lore items** — 5 lore items across Outpost Balor and Perimeter dungeons

## Active Design Docs

| Doc | Status | Next Action |
|-----|--------|-------------|
| docs/progression-system.md | Active | Core decisions resolved. Remaining: sol unit variants, modifier stat ranges, battery math |
| docs/automation_screen.md | Active | Grid UI not yet built — next major feature |
| docs/storyboard.md | Active | Act I implemented, Act II started, Acts II-III need more content |
| docs/testing-design.md | Done | Both tools built and functional, wired into npm test |
| docs/procedural-generation.md | Done | Engine + 4 templates implemented |
| docs/TESTING.md | Done | Testing plan executed — tools exist |
| docs/art-style-guide.md | Done | Complete style guide with master palette |
