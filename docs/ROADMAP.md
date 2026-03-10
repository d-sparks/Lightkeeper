# Lightkeeper Roadmap

Last updated: 2026-03-09 (refreshed: task audit, completed items moved)

## Big Picture

Lightkeeper is a multiplayer browser dungeon crawler with a solid engine, complete Act I, and deep progression systems. The game needs three things to go from "tech demo" to "fun, complete game":

1. ~~**Death penalty & game feel**~~ — DONE. Energy drain, item drop, respawn teleport, death screen overlay all implemented
2. ~~**Automation access**~~ — DONE. Phase 3 wired (openAutomation action + MERIDIAN-7 trigger + client handler)
3. **Story polish** — Act III ending dungeons and post-choice NPC dialogue exist. Remaining: registrar_hollis reactions, post-ending world state changes

## Project Status Overview

| Area | Status | Notes |
|------|--------|-------|
| Core Engine | Done | Physics, combat, abilities, AI, scripting, networking, rendering all functional |
| Act I Content | Done | Main quest (22 steps through Act II bridge), 13 quests, 50 dungeons, 106 NPCs, 33 monster types |
| Monster AI | Done | 5 AI types: melee_chase, ranged_kite, ambush, patrol, pack |
| Procedural Generation | Done | Template-based generation working (5 templates: quarantine, quarantine_deep, frost_crypt, fungal_forest, geothermal) |
| Scripting System | Done | Trigger-Condition-Action fully implemented, quest DAG system working |
| Testing Tools | Done | Content validator + headless simulator + 284 unit tests. Wired into `npm test` |
| Sol Grid / Progression | Done | Grid placement + adjacency modifiers (incl. legendary extended-adjacency) + 63 components |
| Loot System | Done | Engine supports loot tables with weighted drops. 22 loot tables across 6 files. All combat monsters wired |
| Item Rarity UI | Done | Rarity colors (common to legendary) displayed in inventory and sol grid |
| Art Style Guide | Done | Master palette, sprite conventions, zone color identity documented |
| Content Validation CI | Done | `npm test` runs content-validator.js + headless-sim.js --mainline |
| Automation System | Partial | Server grid state + client CSS grid UI done (Phases 1-2). Phase 3 done (openAutomation action + MERIDIAN-7 trigger + client handler). Dungeon sync (Phase 4) still needed. See docs/automation_screen.md |
| Environmental Hazards | Done | Cold, heat, and poison damage in biome dungeons |
| Act II Content | Partial | Dayside, Array complex, Crystal Guardian boss, MERIDIAN-7 quest, quest steps 19-22 bridge to Act III. Deeper questlines needed |
| Act III Content | Partial | All three ending dungeons built (shutdown, merge, control). Post-choice NPC dialogue and Unbounded elder NPC still needed |
| Game Feel | Done | Sound effects (24 SFX), combat juice, death penalty (energy drain + item drop + respawn teleport + death screen overlay) all done |
| Game Balance | Partial | Initial balance pass done. Further playtesting needed |
| Player Onboarding | Partial | WASD/interact prompts exist. Could be smoother |
| Unit Tests | Done | Tiers 1-4: 304 tests (flag-store, event-bus, automation, conditions, actions, trigger-registry, physics, combat, equipment, sol-grid, room-lifecycle). All passing |
| Per-Biome Music | Done | Ambient music definitions and tileset-based track selection wired |
| Monster Sprites | Done | Placeholder sprites for all monsters, palette aligned to art style guide |
| Crystal Guardian Boss | Done | 3-phase boss AI, boss health bar, phase transition VFX, intro presentation |
| Array Complex Gating | Done | Exit conditions gate synthesis lab and deep processing behind quest/item progression |
| Session Auth | Done | Token-based session auth prevents character hijacking |
| Stun/Knockback Immunity | Done | Immunity windows prevent stun-locks |
| Map Streaming / Fog of War | Done | Chunk-based streaming for large maps (outer_expanse 200x120), edge gradient fade |
| Extended Adjacency Modifiers | Done | Radius-2, row, column patterns for legendary tier |
| Quest Graph Connectivity | Done | Main quest extended to step 22, NPC breadcrumbs, boss-kill flags, autotroph paths all wired |
| Generator Wiring | Done | basic_generator via Tech Maren, improved_generator in Array loot tables |
| Council Faction NPCs | Done | Steward, Compact, Root representatives spawned in meridian_civic |

---

## Short-Term Priorities (Next 1-2 Sprints)

Focus: **Connect disconnected systems, fix testing gaps, implement death penalty**

1. ~~**Death penalty polish**~~ — DONE. Respawn teleport + death screen overlay implemented.
2. ~~**Automation grid Phase 3**~~ — DONE. `openAutomation` action, MERIDIAN-7 trigger, and client handler all wired.
3. **Fix headless sim board_train** — Bot clears junction and gets transit pass but can't navigate to train exit at (12,0). Blocks CI mainline testing past step 11.
4. ~~**Post-choice NPC dialogue**~~ — DONE. Asha, Sable, MERIDIAN-7, Wren all have post-choice variants.
5. **Minimap quest waypoints** — No spatial guidance for quest objectives currently.
6. **Automation dungeon sync (Phase 4)** — Player-placed structures should appear as tiles in dayside_solar_fields.

## Medium-Term Priorities (Next 1-3 Months)

Focus: **Content polish, quest feel, endgame depth**

7. **Minimap quest waypoints** — Colored dots on minimap for active quest objectives. No spatial guidance currently.
8. ~~**Wren Alcott dialogue expansion**~~ — DONE. Wren reacts to elder_sporecap_defeated, magma_core_cleared, arrived_meridian, array_secret_discovered, act3_asha_alliance_activated.
9. ~~**Sable trust escalation**~~ — DONE. Trust increments to 2 (guide role) and 3 (Listening Floor). companion_bond gates on sable_trust > 2.
10. **Automation Phase 4 (dungeon sync)** — Structures placed in grid appear as tiles in dayside_solar_fields.
11. ~~**Pack leader AI variant**~~ — DONE. pack_leader AI type with data-driven aura buffs. feral_hound_alpha and frostfang_alpha added.
12. ~~**Touch/gamepad 45° rotation**~~ — DONE. sendInput() rotates joystick and gamepad inputs for isometric movement.

## Long-Term Vision (3+ Months)

Focus: **Real art, endgame loop, mobile**

13. **Real art assets** — Replace all placeholder sprites with proper pixel art following docs/art-style-guide.md.
14. **Endgame loop** — Post-story sandbox with escalating procedural dungeons, legendary modifier chase, automation scaling.
15. **Mobile/touch optimization** — Touch controls exist but need polish. Joystick/gamepad need 45° rotation for iso movement.
16. **Battery math & harvester scaling** — Capacity per tier, energy costs per ability, casts per full charge.

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
- **Quest graph connectivity** — Main quest extended to 22 steps, NPC breadcrumbs, boss-kill/autotroph flags all wired
- **Sound effects** — 24 SFX wired (teleport, ambush, attacks, pickups, doors, etc.)
- **Combat juice** — Screen shake, death animations, projectile tinting, ambush fade-in reveal
- **Generator wiring** — basic_generator via Tech Maren quest, improved_generator in Array loot
- **Stun/knockback immunity** — Immunity windows prevent stun-locks (1.5s post-stun, 0.75s post-knockback)
- **Session token auth** — Prevents character hijacking via crypto tokens
- **Map streaming & fog of war** — Chunk-based streaming for large maps (outer_expanse 200x120)
- **Extended adjacency modifiers** — Radius-2, row, column patterns for legendary sol components
- **Act III ending dungeons** — All three paths built: array_control_center (shutdown), merge_nexus (merge), array_command_throne (control)
- **Council faction NPCs** — Steward, Compact, Root representatives in meridian_civic
- **Tier 4 integration tests** — 61 tests for combat, equipment, sol-grid (284 total)
- **Physics dt fix** — dt clamping + substep movement prevents wall-skipping
- **Headless sim perimeter_gate fix** — Path state bug resolved
- **Headless sim junction_cleared fix** — doInteractNearest navigates to interactable tiles; buildQuestGoals generates door interaction goals
- **Fog-of-war edge gradient** — 3-tile fade depth with 8-neighbor checking in flat and iso renderers
- **Battery visual feedback** — Flash and sound cue on single-use battery depletion
- **Guard Pell dialogue update** — Battery terminology replaces "charge" references
- **Battery chip energy checkpoints** — battery_chip consumables placed in 12 longer dungeons
- **Rechargeable battery loot wiring** — rechargeable_battery_chip in boss and biome rare loot tables
- **Tileset assignments** — All outpost/station/meridian dungeons using correct themed tilesets
- **signal_coordinates item** — Added to items.json for outer_expanse discovery
- **Death penalty core** — 25% energy drain + non-quest item drop on death implemented
- **Automation Phase 3 complete** — openAutomation action, MERIDIAN-7 npc_interacted trigger, and client AUTO_STATE/openScreen handler all wired
- **Death penalty complete** — 25% energy drain + non-quest item drop + respawn-at-entrance teleport + death screen overlay
- **Post-choice NPC dialogue** — Asha, Sable, MERIDIAN-7, Wren all react to chose_path_shutdown/merge/control flags
- **Wren Alcott dialogue expansion** — Reacts to elder_sporecap_defeated, magma_core_cleared, arrived_meridian, array_secret_discovered, act3 coalition
- **Sable trust escalation** — Trust increments to 2/3, companion_bond gates on sable_trust > 2
- **Pack leader AI** — pack_leader AI type with data-driven aura buffs, feral_hound_alpha and frostfang_alpha
- **Touch/gamepad 45° rotation** — Joystick and gamepad analog inputs rotated for isometric movement
- **Room lifecycle tests** — Tier 4 integration tests for createRoom → join → transition → cleanup (304 total tests)
- **Placeholder sprites** — sable_nightside_guide, sable_threshold, unbounded_elder all have sprites

## Active Design Docs

| Doc | Status | Next Action |
|-----|--------|-------------|
| docs/progression-system.md | Active | Core decisions resolved. Remaining: battery math, harvester scaling |
| docs/automation_screen.md | Active | Phases 1-3 done. Next: Phase 4 (dungeon sync) |
| docs/storyboard.md | Active | Act I done, Act II partial, Act III endings built. Post-choice dialogue done. Remaining: registrar_hollis reactions, post-ending world state |
| docs/testing-design.md | Done | Both tools built and functional. 304 tests passing |
| docs/procedural-generation.md | Done | Engine + 5 templates implemented. Fog-of-war streaming working |
| docs/TESTING.md | Done | Tiers 1-4 complete (304 tests including room-lifecycle) |
| docs/art-style-guide.md | Done | Complete style guide with master palette |
| docs/game-scripting.md | Done | TCA system fully implemented and documented |
