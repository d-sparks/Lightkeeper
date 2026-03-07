# Lightkeeper Roadmap

Last updated: 2026-03-07

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
| Environmental Hazards | Done | Cold, heat, and poison damage in biome dungeons. Engine support in game-loop.js |
| Act II Content | Partial | Dayside locations, Array complex floors, Crystal Guardian boss (3-phase AI), MERIDIAN-7 umbrasite quest, Disappeared Courier. Deeper Array questlines needed |
| Act III Content | Stub | Underlumen approach + crypts exist. array_secret_discovered flag partially wired. Story revelation content not built |
| Art / Audio | Placeholder | Generated placeholder sprites. Art style guide exists. Audio system wired but no real assets |
| Game Balance | Needs Work | Combat functional but untuned. Energy economy untested at scale |
| Player Onboarding | Partial | WASD/interact prompts exist. Could be smoother |
| Content Validation Errors | Done | All 6 known broken refs/flags resolved |
| Monster Loot Wiring | Done | All 25 combat monsters have lootTable refs. 22 biome-specific tables across 6 files |
| Sol Grid UI | Done | healOnHit, energyCostReduction, boostedEnergyRegen, innateBonus name/perks displayed |
| Unit Tests (Tier 1) | Done | flag-store, event-bus, automation tests written with Node built-in test runner |
| Crystal Guardian Boss | Done | 3-phase boss_crystal AI: melee, projectiles, summons. Needs client VFX and health bar |
| Array Complex Gating | Done | Exit conditions gate synthesis lab and deep processing behind quest/item progression |

---

## Short-Term Priorities (Next 1-2 Sprints)

Focus: **Game feel, missing content wiring, and the core death/reward loop**

1. **Sound effects** — Even placeholder synthesized tones dramatically improve game feel. Wire basic sounds for attacks, hits, deaths, pickups, doors, and transitions. Audio system exists — it just needs content.
2. **Combat juice pass** — Screen shake on player hit, monster death fade-out, ambush monster fade-in reveal, monster projectile tinting by type. Small visual improvements that compound.
3. **Death penalty** — When the player dies, drain energy and drop a non-quest item. Respawn at room entrance. This completes the risk/reward loop that makes dungeon runs meaningful.
4. **Deploy new monsters to dungeons** — ambush/patrol/pack AI monsters are defined but not placed in actual dungeon floors. Place them in thematically appropriate biome dungeons.
5. **Boss health bar UI** — Crystal Guardian has 3-phase AI but no client-side boss health bar or phase transition effects. Add these for the game's first real boss encounter.
6. **Sol unit acquisition paths** — The 4 non-starter sol units need actual in-game acquisition (chest drops, NPC rewards, quest completions). Currently defined but unobtainable.

## Medium-Term Priorities (Next 1-3 Months)

Focus: **Automation UI, Act II deepening, and multiplayer**

7. **Automation grid UI** — Full-screen grid placement screen per docs/automation_screen.md. Server-side coordinate tracking (Phase 1) then client CSS grid (Phase 2). Next major feature.
8. **Act II quest expansion** — Extend Array questline: escalating umbrasite demands, MERIDIAN-7 confrontation after array_secret_discovered, Array overseer mini-boss, wire secret into Sable/Asha dialogue for Act III hooks.
9. **Minimap quest waypoints** — Colored dots on minimap for active quest objectives. Text-only quest panel gives no spatial guidance.
10. **Multiplayer polish** — Party indicators, shared quest progress display, co-op balance tuning.
11. **Proc geothermal template** — Add procedural geothermal dungeon with chest tiles wired to geothermal loot tables.
12. **Wire patrol field into engine** — The patrol field on dungeon monsterSpawns exists in JSON but the engine ignores it. Patrol monsters currently wander randomly instead of following paths.

## Long-Term Vision (3+ Months)

Focus: **Complete the story, real art, audio, and endgame**

13. **Act III content** — Underlumen revelation, three ending paths, faction choice system. Requires significant quest/dialogue/dungeon work.
14. **Real art assets** — Replace all placeholder sprites with proper pixel art following docs/art-style-guide.md.
15. **Music and ambient audio** — Per-biome music, combat music, ambient sounds.
16. **Additional boss encounters** — Crystal Guardian sets the pattern. Add bosses for Nightside, Array, and Underlumen arcs.
17. **Endgame loop** — Post-story sandbox with escalating procedural dungeons, legendary modifier chase, automation scaling.
18. **Tier 2 unit tests** — conditions.js, actions.js, trigger-registry.js, quest-tracker.js (Tier 1 done).
19. **Mobile/touch optimization** — Touch controls exist but need polish for real mobile play.
20. **Game balance pass** — Tune combat numbers, energy economy, loot drop rates across full playthrough.

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

## Active Design Docs

| Doc | Status | Next Action |
|-----|--------|-------------|
| docs/progression-system.md | Active | Core decisions + sol unit variants resolved. Remaining: modifier stat ranges, battery math |
| docs/automation_screen.md | Active | Grid UI not yet built — next major feature |
| docs/storyboard.md | Active | Act I implemented, Act II started, Acts II-III need more content |
| docs/testing-design.md | Done | Both tools built and functional, wired into npm test |
| docs/procedural-generation.md | Done | Engine + 4 templates implemented |
| docs/TESTING.md | Active | Tier 1 done. Tier 2 (conditions, actions, trigger-registry) still valuable |
| docs/art-style-guide.md | Done | Complete style guide with master palette |
