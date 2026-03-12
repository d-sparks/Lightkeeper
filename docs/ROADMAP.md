# Lightkeeper Roadmap

Last updated: 2026-03-12

## Big Picture

Lightkeeper is a multiplayer browser dungeon crawler with a solid engine, deep endgame systems, and a complete Act I. The engine, progression, and endgame loop are mature. **The critical gap is the story campaign itself** — the three-act narrative that gets players from tutorial to endgame.

The game needs three things to go from "deep tech demo" to "complete game":

1. **Story campaign dungeons** — No Spires, no Lighthouse Mara, no Greenway zones exist. These are the climax dungeons for all three acts. Without them, the 30-40 hour storyboard is ~40% realized.
2. **Bug fixes & game feel** — Proc quarantine bot combat, nightside caverns rendering, flare item, multiplayer chat, quest log UX. These hurt the experience for anyone playing today.
3. **Art & audio replacement** — All 62 sprites are procedural placeholders. All 15 music tracks are synthesized. Even partial replacement would transform first impressions.

## Project Status Overview

| Area | Status | Notes |
|------|--------|-------|
| Core Engine | Done | Physics, combat, abilities, AI, scripting, networking, rendering all functional |
| Act I Content | Done | Main quest (22 steps through Act II bridge), 13 quests, 50 dungeons, 106 NPCs, 33 monster types |
| Monster AI | Done | 5 AI types: melee_chase, ranged_kite, ambush, patrol, pack |
| Procedural Generation | Done | Template-based generation working (5 templates: quarantine, quarantine_deep, frost_crypt, fungal_forest, geothermal) |
| Scripting System | Done | Trigger-Condition-Action fully implemented, quest DAG system working |
| Testing Tools | Done | Content validator + headless simulator + 320 unit tests. Wired into `npm test` |
| Sol Grid / Progression | Done | Grid placement + adjacency modifiers (incl. legendary extended-adjacency) + 63 components |
| Loot System | Done | Engine supports loot tables with weighted drops. 22 loot tables across 6 files. All combat monsters wired |
| Item Rarity UI | Done | Rarity colors (common to legendary) displayed in inventory and sol grid |
| Art Style Guide | Done | Master palette, sprite conventions, zone color identity documented |
| Content Validation CI | Done | `npm test` runs content-validator.js + headless-sim.js --mainline |
| Automation System | Done (Phases 1-5) | All phases complete: grid state, UI, MERIDIAN-7 wiring, dungeon sync, tooltips, placement sounds, touch support. See docs/automation_screen.md |
| Environmental Hazards | Done | Cold, heat, and poison damage in biome dungeons |
| Act II Content | Partial | Dayside, Array complex, Crystal Guardian boss, MERIDIAN-7 quest, quest steps 19-22 bridge to Act III. Missing: Greenway zones, Bulwark faction content, Spire of Winds |
| Act III Content | Partial | Three ending dungeons built. Post-choice dialogue and world state done. Missing: Spire of Radiance, Deep Array climax, full Dayside approach |
| Story Campaign Dungeons | Not Started | No Spires, no Lighthouse Mara, no Greenway. These are the Act 1-3 climax dungeons per storyboard |
| Game Feel | Done | Sound effects (24 SFX), combat juice, death penalty (energy drain + item drop + respawn teleport + death screen overlay) all done |
| Game Balance | Done | Mid-game energy pacing tuned, Pulse Rifle reward feel improved, combat balance pass complete |
| Player Onboarding | Done | WASD/interact prompts, first-time tutorial for combat, NPC interaction, and healing |
| Unit Tests | Done | Tiers 1-4: 320 tests (flag-store, event-bus, automation, conditions, actions, trigger-registry, physics, combat, equipment, sol-grid, room-lifecycle). All passing |
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

Focus: **Fix bugs, improve game feel, lay groundwork for story dungeons**

1. **Fix headless sim bot combat** — Bot gets stuck in proc_quarantine, can't fight past monsters. Blocks all-quests testing.
2. **Fix nightside caverns rendering** — Room renders entirely inside a wall. Players/enemies invisible.
3. **Fix flare item** — Placing a flare gives "undefined" in inventory.
4. **Quest log UX** — Collapse completed steps. Show max 3 rows for long quests.
5. **Side quest guidance** — Ensure every quest item pickup hints at next step.
6. **Multiplayer chat reliability** — Messages disappear or don't show.
7. **Distribute crafting materials** — Add to biome-specific loot tables (frost, fungal, geothermal, nightside, array).

## Medium-Term Priorities (Next 1-3 Months)

Focus: **Build the story campaign dungeons that connect Acts 1-3**

8. **Build Lighthouse Mara** — Multi-floor frozen cavern expedition. Core Act 1 beat. Uses frost_crypt tileset.
9. **Build Spire of Vigil** — Raider stronghold (outer) + Underlumen puzzle core (inner). Act 1 climax. Unlocks Light Sentry.
10. **Add Dural Voss boss** — Named raider warlord with retreat mechanic. Key narrative moment.
11. **Build Greenway corridors** — Agricultural zones under Bulwark occupation. Act 2 setting.
12. **Build Spire of Winds** — Bulwark fortress (outer) + vertical puzzle core (inner). Act 2 climax. Unlocks Hover.
13. **Wire Spire ability unlocks** — Light Sentry from Vigil, Hover from Winds, Photonic Pulse from Radiance.
14. **Level-up stat screen** — Show HP, damage, energy improvements on level up.

## Long-Term Vision (3+ Months)

Focus: **Complete campaign, real art, apex endgame**

15. **Build Spire of Radiance + Deep Array climax** — Act 3 climax dungeon. Three-path ending choice.
16. **Real art assets** — Replace top-priority placeholder sprites (player, key NPCs, common monsters).
17. **Real music** — Compose tracks for key moments (outpost, boss, Spire, Meridian).
18. **Deep Expedition (Tier 6)** — 3-4 player, 7-floor apex cooperative content.
19. **Multiplayer quarantine wing bug** — Two players can't coexist in quarantine wing.
20. **Weapon upgrade confirmation dialog** — Prevent accidental disassembly.

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
- **Headless sim board_train fix** — buildQuestGoals handles targetExit in quest objectives, bot boards train successfully
- **Automation Phase 4 (dungeon sync)** — getOverlayedMapData() merges player automation placements into MAP chunks; harvester entities spawn in dayside_solar_fields
- **Automation milestone notifications** — Toast notification on milestone thresholds (2/4/6/10/15)
- **Wren Alcott sprite** — Placeholder sprite generated
- **Extended adjacency visualization** — Sol grid UI highlights legendary modifier ranges on hover/placement
- **Orphaned flags batch 1** — 9 exploration flags wired to NPC dialogue and XP rewards
- **Automation Phase 5 (polish)** — Tooltips, placement sounds, touch/mobile support all implemented
- **Ending-path legendary modifiers** — 6 path-specific legendaries with unlock gating in sol_components.json
- **Iso renderer optimization** — Skip unrevealed/off-screen chunks entirely
- **Delete character button** — Session select screen delete functionality
- **Mid-game energy pacing** — Energy generation tuning and Pulse Rifle reward feel improved
- **Headless sim visit_civic_center fix** — tryInteract compares door vs NPC distance
- **Automation levels 6-10** — 4 new structures (silicon_refinery, auto_turret, fabricator, expedition_beacon), milestones 6-10
- **Boss affix system** — 8 data-driven affixes (berserker, ironhide, swift, volatile, regenerating, empowered_slam, relentless, juggernaut) for Tier 4-5
- **Expedition multi-floor progression** — Floor chaining, boss spawning, completion detection, silicon cost, death penalty
- **Phase 3 investigation quest** — Directive 11-Kappa with path-specific mechanical rewards
- **Priority sprite redesign** — Player, NPC, and common monster sprites updated per art-style-guide
- **Post-ending Sable dialogue** — Expedition quest-giver lines for Shutdown/Merge paths
- **UnlockFlag loot filtering** — Path-specific legendaries gated by ending choice
- **Chunk streaming throttle** — 5 Hz streaming to reduce server load
- **Headless sim discover_array_secret fix** — Redundant prereq goals eliminated
- **Modifier crafting engine** — craft action type in actions.js, crafting.json with reforge/fuse recipes
- **Periodic auto-save** — 5-minute auto-save interval in server/index.js
- **Post-ending world state** — Room-entered triggers for all 3 paths, NPC dialogue shifts, registrar_hollis reactions, endgame_active gating
- **Minimap quest waypoints** — Primary (orange diamond) and secondary (blue dot) waypoints on both renderers
- **Structure adjacency bonuses** — silicon_refinery boosting adjacent harvesters with stacking
- **Grid expansion 16x16** — Triggered at automation level 6 milestone
- **First-time tutorial prompts** — NPC interaction, combat, and healing tutorials
- **Monster sprite redesign** — 20 monsters redesigned with distinctive silhouettes and warm hostile eyes
- **Sprite outlines + lighting** — 1px dark outlines and top-left lighting pass on all entity sprites

## Active Design Docs

| Doc | Status | Next Action |
|-----|--------|-------------|
| docs/storyboard.md | Active | **Primary gap.** Act I partially realized (~70%), Act II ~30%, Act III ~25%. Spire dungeons, Lighthouse Mara, Greenway zones all unbuilt. |
| docs/endgame-loop.md | Active | Phases 1-7 engine done. Remaining: Deep Expedition (Tier 6), Faction Rally |
| docs/progression-system.md | Active | Core systems done. Harvester scaling done (levels 11-20). Spire ability unlocks not yet wired. |
| docs/automation_screen.md | Done | All phases implemented |
| docs/testing-design.md | Done | Both tools built. 320+ unit tests passing. Headless sim ~85% pass rate (proc_quarantine bot combat bug). |
| docs/procedural-generation.md | Done | Engine + 5 templates implemented |
| docs/TESTING.md | Done | Tiers 1-4 complete |
| docs/art-style-guide.md | Done | Complete style guide with master palette |
| docs/game-scripting.md | Done | TCA system fully implemented |
