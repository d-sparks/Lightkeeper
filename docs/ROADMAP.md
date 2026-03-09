# Lightkeeper Roadmap

Last updated: 2026-03-08

## Big Picture

Lightkeeper is a multiplayer browser dungeon crawler with a solid engine, complete Act I, and deep progression systems. The game needs three things to go from "tech demo" to "fun, complete game":

1. **Game feel** — Death penalty, sound effects, and combat juice transform hollow clicking into tense dungeon runs
2. **Progression wiring** — Sol units and generators are designed but unobtainable; players can't feel growth
3. **Story completion** — Act II needs deepening, Act III needs its three endings built

## Project Status Overview

| Area | Status | Notes |
|------|--------|-------|
| Core Engine | Done | Physics, combat, abilities, AI, scripting, networking, rendering all functional |
| Act I Content | Done | Main quest (13 steps), 11 quests total, 41 dungeons, 39 NPCs, 26 monster types |
| Monster AI | Done | 5 AI types: melee_chase, ranged_kite, ambush, patrol, pack |
| Procedural Generation | Done | Template-based generation working (4 templates: quarantine, quarantine_deep, frost_crypt, fungal_forest, geothermal) |
| Scripting System | Done | Trigger-Condition-Action fully implemented, quest DAG system working |
| Testing Tools | Done | Content validator + headless simulator both functional. Wired into `npm test` |
| Sol Grid / Progression | Done | Grid placement + adjacency modifiers + 25 components. Design decisions resolved |
| Loot System | Done | Engine supports loot tables with weighted drops. 22 loot tables across 6 files. All combat monsters wired |
| Item Rarity UI | Done | Rarity colors (common to legendary) displayed in inventory and sol grid |
| Art Style Guide | Done | Master palette, sprite conventions, zone color identity documented |
| Content Validation CI | Done | `npm test` runs content-validator.js + headless-sim.js --mainline |
| Automation System | Partial | Server grid state + client CSS grid UI done (Phases 1-2). In-game access not yet wired (Phase 3+). See docs/automation_screen.md |
| Environmental Hazards | Done | Cold, heat, and poison damage in biome dungeons |
| Act II Content | Partial | Dayside, Array complex, Crystal Guardian boss, MERIDIAN-7 umbrasite quest done. Deeper Array questlines + more bosses needed |
| Act III Content | Stub | Underlumen approach + crypts exist. Three ending paths not built |
| Game Feel | Not Started | No death penalty, no sound effects, minimal combat juice. Highest-priority gap |
| Game Balance | Partial | Initial balance pass done (monster HP, ability costs). Further playtesting needed |
| Player Onboarding | Partial | WASD/interact prompts exist. Could be smoother |
| Unit Tests | Done | Tiers 1-3: flag-store, event-bus, automation, conditions, actions, trigger-registry, physics (223 tests). Tier 4 integration tests remain. Note: 1 pre-existing physics test failure (large dt wall skip) |
| Per-Biome Music | Done | Ambient music definitions and tileset-based track selection wired |
| Monster Sprites | Done | Placeholder sprites for all monsters, palette aligned to art style guide |
| Crystal Guardian Boss | Done | 3-phase boss AI, boss health bar, phase transition VFX, intro presentation |
| Array Complex Gating | Done | Exit conditions gate synthesis lab and deep processing behind quest/item progression |

---

## Short-Term Priorities (Next 1-2 Sprints)

Focus: **Quest graph connectivity — extend the main quest and connect disconnected content**

1. **Extend main quest into Act II** — Add steps 14-17 directing player from Meridian to dayside, through Array discovery, and into Act III preparation. Currently the main quest dead-ends at "meet Yun" with no guidance toward Act II content.
2. **NPC breadcrumbs to dayside** — No NPC directs players to dayside_solar_fields. Add dialogue hooks after `met_crafter_yun`.
3. **Wire autotroph_path flags** — `autotroph_path_defiant/cooperative` are set but never checked. Should gate Act III dialogue.
4. **Wire boss-kill flags** — `frost_warden_defeated`, `elder_sporecap_defeated`, `magma_core_cleared` are set but never checked. Add NPC reactions.
5. **Death penalty** — When the player dies, drain energy and drop non-quest items. Respawn at entrance. Biggest game-feel gap.
6. **Wire generators into loot/rewards** — basic_generator and improved_generator exist but can't be obtained. Critical for energy progression pacing.

## Medium-Term Priorities (Next 1-3 Months)

Focus: **Content depth, boss variety, and feature completion**

7. **Additional boss encounters** — Crystal Guardian sets the pattern. Add bosses for Nightside (shade_stalker_alpha?), Array (array_overseer), and Fungal (elder_sporecap) arcs. Each with unique phases.
8. **Act II quest expansion** — Extend Array questline: escalating umbrasite demands, MERIDIAN-7 confrontation, wire secrets into Act III hooks.
9. **Automation grid Phase 3** — Wire `openAutomation` action so players can access the grid UI via MERIDIAN-7 interaction. Phases 1-2 are done but the screen isn't reachable.
10. **Minimap quest waypoints** — Colored dots on minimap for active quest objectives. Players currently have no spatial guidance.
11. **Integration tests (Tier 4)** — Combat flow, equipment system, sol grid adjacency, room lifecycle. Catches regressions as content grows.
12. **Improve headless sim bot** — Bot gets stuck at 4/43 rooms. Better pathfinding enables automated balance testing and quest validation.

## Long-Term Vision (3+ Months)

Focus: **Complete the story, real art, and endgame**

13. **Act III content** — Three ending path dungeons (shutdown, merge, control), faction NPCs, Unbounded elder, post-choice dialogue. The story's climax.
14. **Real art assets** — Replace all placeholder sprites with proper pixel art following docs/art-style-guide.md.
15. **Endgame loop** — Post-story sandbox with escalating procedural dungeons, legendary modifier chase, automation scaling.
16. **Mobile/touch optimization** — Touch controls exist but need polish for real mobile play.
17. **Extended adjacency modifiers** — Radius-2 and row/column modifiers for rare/legendary sol components.

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
- **Environmental hazards** — Cold, heat, and poison damage in biome dungeons
- **Content validation fixes** — All 6 broken refs/flags resolved
- **Monster loot wiring** — All 25 combat monsters have lootTable refs; biome tables in frost/geothermal/fungal/outpost/common/nightside
- **Sol grid UI polish** — healOnHit, energyCostReduction, boostedEnergyRegen displayed in UI
- **Sol unit variants** — 6 variants defined in sol_units.json with innateBonus engine support
- **Array complex content** — Array synthesis lab + deep processing floors with bio-catalyst hints
- **Disappeared Courier quest** — Side quest added in Meridian City
- **Tier 1 unit tests** — flag-store, event-bus, automation tests using Node built-in test runner
- **Crystal Guardian boss AI** — 3-phase boss_crystal AI (melee → projectiles → summons)
- **Array complex gating** — Exit conditions gate synthesis lab and deep processing behind quest/item progression
- **Array monster loot tables** — array_sentinel and array_fabricator wired to loot tables with placeholder sprites
- **Sol unit innateBonus display** — Sol grid screen shows unit name and innate perk descriptions
- **Biome loot to chests/crates** — Biome loot tables wired to dungeon interactable tiles via triggers
- **Biome loot in proc templates** — Procedural dungeon templates reference biome-appropriate loot tables
- **Tier 2 unit tests** — conditions.js, actions.js, trigger-registry.js (178 tests total)
- **Proc geothermal template** — proc_geothermal.json with vent_spewer/magma_brute pool
- **Multiplayer polish** — Party health frames, enhanced minimap dots, shared quest progress
- **Sol modifier stat ranges** — Rarity tiers defined (common->legendary) in progression-system.md and sol_components.json
- **Nightside tileset** — Dedicated nightside tileset with umbracite-vein walls and dark accents
- **Content validation fixes (round 2)** — resonant_umbracite_core and array_harmonic_stabilizer_chip items added
- **Monster deployment** — ambush/patrol/pack AI monsters placed in thematic biome dungeons and proc templates
- **Boss health bar + VFX** — Crystal Guardian boss health bar, phase transition effects, intro presentation
- **Tier 3 physics tests** — Collision detection, wall sliding, diagonal normalization tests
- **Per-biome ambient music** — Tileset-based track selection, boss music support
- **Monster placeholder sprites (round 2)** — 12 newer monsters (dusk_crawler, crystal_guardian, shade_stalker variants, etc.)
- **Combat balance pass** — Monster HP 1.8-2.3x, ability CD/cost tuning, generator output increases
- **Sol unit acquisition paths** — All 4 non-starter sol units wired: nightcaster_frame (frost_warden boss), array_precision_core (MERIDIAN-7 quest), greenway_bioframe (elder_sporecap), underlumen_nexus (deep communion)
- **Array secret wiring** — array_secret_discovered wired into MERIDIAN-7 confrontation and NPC dialogue transitions
- **Crystal Guardian special attacks** — boss_crystal AI integrates specialAttacks; ground_slam + stun
- **Sol unit innate perk display** — Sol grid screen shows unit name and innate perk descriptions
- **Array construct loot tables** — Enhanced with thematic tech drops

## Active Design Docs

| Doc | Status | Next Action |
|-----|--------|-------------|
| docs/progression-system.md | Active | Core decisions resolved. Remaining: battery math, harvester scaling, extended adjacency modifiers |
| docs/automation_screen.md | Active | Phases 1-2 done. Next: Phase 3 (screen access via MERIDIAN-7) |
| docs/storyboard.md | Active | Act I done, Act II partial, Act III stubbed. Three ending paths needed |
| docs/testing-design.md | Done | Both tools built and functional. 1 pre-existing physics test (large dt) needs fix |
| docs/procedural-generation.md | Done | Engine + 5 templates implemented |
| docs/TESTING.md | Done | Tiers 1-3 complete. Tier 4 integration remains for future |
| docs/art-style-guide.md | Done | Complete style guide with master palette |
| docs/game-scripting.md | Done | TCA system fully implemented and documented |
