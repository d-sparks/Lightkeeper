# Lightkeeper Roadmap

Last updated: 2026-03-15 night. Sim quarantine loop FIXED — bot now reaches lighthouse_mara_core (37/124 rooms, 90 kills, 2 deaths, 10m12s). Blocks at conduit puzzle (tile interact conflict). All-quests: 2/21 pass (tannis_tags, relay_recovery), 2 STUCK (pathing), 17 TIMEOUT. Content validator: 0 errors, 59 warnings (unused visited_* flags). Major completed: quarantine fix, item ref fixes, sim tile interaction support, Greenway bio-lab, MERIDIAN-7 alliance content, puzzle variety, full campaign audit. Critical remaining: sim conduit puzzle, Sol Shield heal nerf, sol_cone wall penetration, Lighthouse Mara pacing (19 floors with no checkpoints), 15+ missing sprites, spire_winds_chest loot table.

## Big Picture

Lightkeeper is a multiplayer browser dungeon crawler with a solid engine, deep endgame systems, and content across all three acts. The engine, progression, and endgame loop are mature. **The critical gaps are testability, pacing, and polish** — the sim can only verify through Act 1 midpoint, Lighthouse Mara is a 19-floor pacing wall, and Acts 2-3 are untested by automation.

The game needs four things to go from "structurally complete" to "shippable":

1. **Sim coverage** — Bot blocks at Mara core conduit puzzle, can't pathfind in large maps, and can't handle ending choices. Only 37/124 rooms reachable by sim. Everything past Act 1 midpoint is testing-dark.
2. **Pacing & flow** — Lighthouse Mara (19 floors, no checkpoints) is the biggest pacing problem. Greenway → Spire of Winds has no flag gate. Array door override is a dead item. 17/21 quests timeout in sim.
3. **Game feel & balance** — Sol Shield 3.5 HP/s trivializes all content (2 deaths in mainline). Sol cone penetrates walls. Quarantine warlord is a 67-hit slog with starting weapon.
4. **Art & polish** — ~15 entities missing sprites. No real commissioned art yet. 59 orphaned flags represent unrealized narrative connections.

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
| Act II Content | Mostly Done | Greenway zones (4 dungeons + bio-lab 4 floors), Bulwark faction (7 monsters), Spire of Winds (12 floors), General Thorne boss, political crisis atmosphere, MERIDIAN-7 alliance content, post-Spire narrative triggers all done. Missing: spire_winds_chest loot table, array_door_override not wired to doors, greenway_assault quest definition, ~8 missing sprites |
| Act III Content | Structurally Done | Three ending dungeons + Spire of Radiance (12 floors) built. Post-choice dialogue and world state done. Main quest steps route through dayside. Sim can't verify (blocks at Mara core). showChoice handler needed for ending path. |
| Story Campaign Dungeons | Done | Lighthouse Mara (20 floors), all 3 Spires (12 floors each), Greenway (4 zones + 4 bio-lab), Nightside scouting chain all connected. Spire replay tiers implemented. Pacing issues in Mara (19 floors, no checkpoints). |
| Game Feel | Done | Sound effects (24 SFX), combat juice, death penalty, wind push mechanic all done |
| Game Balance | Needs Work | Mid-game energy pacing tuned, but Sol Shield 3.5 HP/s passive heal trivializes content (2 deaths in mainline sim). Sol cone penetrates walls. Quarantine warlord is tedious with starting weapon. |
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

Focus: **Unblock sim, fix game feel, close content gaps**

1. **Fix sim Mara core conduit puzzle** — Bot reaches lighthouse_mara_core but tryInteract picks up ground items instead of conduit tiles. Blocks all testing beyond Act 1 midpoint.
2. **Fix sim pathfinding for large/cavern maps** — 2 quests STUCK (lighthouse_mara caverns A* fail, outer_expanse 200x120 exceeds A* limits). Add waypoint nav or chunked pathfinding.
3. **Teach sim bot showChoice handling** — Ending path choice requires player input bot can't provide. Act 3 untestable.
4. **Nerf Sol Shield passive heal** — 3.5 HP/s trivializes all content (only 2 deaths in mainline). Reduce to 1-1.5 HP/s. Target 4-6 deaths.
5. **Fix sol_cone wall penetration** — Cone damages through solid tiles. Add LOS check.
6. **Split Lighthouse Mara into narrative segments** — 19 floors with zero checkpoints is the biggest pacing problem. Add 2-3 intermediate quest objectives, healing caches, mid-tower waypoint.
7. **Add spire_winds_chest loot table** — Referenced but doesn't exist.
8. **Wire array_door_override into Spire of Winds doors** — Key item given but no doors check for it.
9. **Add Greenway → Spire flag gate** — Players can skip supply sabotage entirely.

## Medium-Term Priorities (Next 1-3 Months)

Focus: **Deepen content, connect narrative threads, polish feel**

10. **Differentiate Lighthouse Mara floors 2-10** — All identical frost_crypt. Add visual variety, unique encounters, ambient narrative.
11. **Wire 59 orphaned flags to NPC reactions** — underlumen_emergence_defeated, found_geometric_tablet, resonance_complete, spire replay tiers → NPC dialogue and rewards.
12. **Generate ~15 missing entity sprites** — Bio-lab enemies, General Thorne, Corporal Venn, Asha Denn, Bulwark patrols, Spire replay monsters.
13. **Create greenway_assault quest definition** — Array Alliance flow has no quest log entries or waypoints.
14. **Add Spire of Vigil third puzzle mechanic** — Still only pedestal patterns. Add shadow/light zone manipulation for spatial-control theme.
15. **Quarantine Warlord balance** — 3 dmg blaster vs 200 HP boss is tedious. Drop weapon upgrade or reduce HP.

## Long-Term Vision (3+ Months)

Focus: **Polish campaign, real art, apex endgame**

16. **Commission real sprite art for 10 priority entities** — See docs/art-commission-brief.md.
17. **Full end-to-end human playtest of three-act campaign** — Everything beyond Mara is unverified. Document pacing/balance/gaps across all 3 ending paths.
18. **Deep Expedition (Tier 6)** — 3-4 player, 7-floor apex cooperative content.
19. **Faction Rally** — Server-wide cooperative monthly events.

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
- **Room-entry dialogue suppression** — noHostilesInRoom + room_cleared pattern applied to 44 dungeons (36 Spire floors + 8 others)
- **Lighthouse Mara main quest integration** — 3 quest steps wired, transit pass gated behind mara_core_cleared
- **Act 3 main quest steps** — 5 steps added routing through dayside → array → spire_radiance → ending choice
- **Post-Spire narrative triggers** — Flag-gated atmosphere shifts in 4 Meridian rooms for both vigil and winds completion
- **Sable/Old Keeper lore item connections** — hasItem dialogue rules for 5 lore items across Nightside chain
- **Thorne command tablet wiring** — Turn-in to Asha in meridian_civic, gates Act 3 access
- **NPC reactions to Lighthouse Mara restoration** — Warden Holt, Sgt. Ellers, Tech Maren + seismic survey turn-in
- **Spire replay difficulty tiers** — Normal/Hard/Legendary scaling with modifier drops
- **Act 2 political crisis atmosphere** — Bulwark checkpoints in 3 Meridian hubs after spire_vigil_cleared
- **Placeholder sprites batch** — 21 new entity sprites generated (Bulwark, Greenway NPCs, Mara monsters)
- **Wind push mechanic** — Environmental hazard wind_push type for Spire of Winds shaft/underlumen floors
- **Dasha supply depot** — Frost salve vendor + supply cache at Lighthouse Mara F10

## Active Design Docs

| Doc | Status | Next Action |
|-----|--------|-------------|
| docs/storyboard.md | Active | **Content structurally complete, needs testing + polish.** Act I ~95% (all dungeons wired, quest flow verified by sim through Mara core). Act II ~80% (Greenway + Bulwark + Spire of Winds + bio-lab + MERIDIAN-7 alliance all built; missing spire_winds_chest loot, array_door_override wiring, greenway_assault quest def). Act III ~60% (ending dungeons + Spire of Radiance built, main quest routing done; sim can't verify, showChoice unhandled). |
| docs/endgame-loop.md | Active | Phases 1-7 engine done. Spire replay tiers done. Remaining: Deep Expedition (Tier 6), Faction Rally |
| docs/progression-system.md | Active | Core systems done. Harvester scaling done (levels 11-20). All 3 Spire ability unlocks wired. |
| docs/automation_screen.md | Done | All phases implemented |
| docs/testing-design.md | Done | Both tools built. 320+ unit tests passing. Mainline reaches Mara core (blocks at conduit puzzle). Content validator: 0 errors, 59 warnings. |
| docs/procedural-generation.md | Done | Engine + 5 templates implemented |
| docs/TESTING.md | Done | Tiers 1-4 complete |
| docs/art-style-guide.md | Done | Complete style guide with master palette |
| docs/game-scripting.md | Done | TCA system fully implemented |
