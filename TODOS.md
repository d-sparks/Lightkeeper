# Lightkeeper — Next Tasks

Prioritized task list. Updated 2026-03-07.

---

## Core Loop (makes the game feel like a game)

- [ ] **1. Death penalty implementation** — When the player dies: drain energy, drop non-quest items per dropBehavior rules (lose_on_death, durability_loss_on_death, soulbound), respawn at room entrance. This single feature transforms risk-free wandering into tense dungeon runs. See architecture-plan.md for the full death flow spec.

- [ ] **2. Placeholder sound effects** — Add synthesized tones for: weapon attack, ability fire, monster hit, monster death, item pickup, door open, floor transition. The audio system and per-biome music are already wired — it just needs sound effect content in the audio pipeline. Even basic tones dramatically change game feel.

- [ ] **3. Combat juice pass** — Screen shake on player hit (not just monster hit), monster death fade-out animation, ambush monster fade-in reveal effect, projectile tinting by monster type (fire=orange, ice=blue, acid=green). Small VFX that compound into satisfying combat.

## Progression Wiring (players need to feel growth)

- [ ] **4. Sol unit acquisition paths** — The 4 non-starter sol units (nightcaster_frame, array_precision_core, greenway_bioframe, underlumen_nexus) are defined in sol_units.json but unobtainable. Wire as: nightcaster_frame from deep Nightside chest, array_precision_core from MERIDIAN-7 quest reward, greenway_bioframe from Asha/Cultivar Corps, underlumen_nexus from Underlumen Threshold exploration.

- [ ] **5. Wire generators into loot/rewards** — basic_generator and improved_generator items exist in items.json but can't be obtained. Add basic_generator to mid-game quest reward (e.g. relay_recovery completion). Add improved_generator to Array complex loot or MERIDIAN-7 trade. Critical for energy progression pacing.

- [ ] **6. Assign biome tilesets to remaining dungeons** — Dungeons using generic "crypt" tileset should use their zone's tileset (outpost_* -> outpost, station_* -> station, meridian_* -> meridian). This auto-activates per-biome ambient music and visual identity with zero engine changes — pure content fix.

## Content Depth (make the game longer and richer)

- [ ] **7. Additional boss encounters** — Crystal Guardian sets the pattern. Add at least 2 more bosses: a Nightside boss (shade_stalker_alpha or gloom_wraith variant with multi-phase AI) and an Array boss (array_overseer with summoning + area denial phases). Each needs boss_* AI type, boss health bar, and intro presentation.

- [ ] **8. Act II quest expansion** — Extend the Array questline beyond the initial umbrasite retrieval: escalating demands from MERIDIAN-7, confrontation after array_secret_discovered flag, and wiring the secret into Sable/Asha dialogue as Act III hooks. This is the bridge from "finished Act I" to "story continues."

- [ ] **9. Crystal Guardian boss music** — Wire the existing `boss_crystal` music track (already defined in music.json) into the Crystal Guardian encounter via triggers. Quick win — the track exists but isn't played during the fight.

- [ ] **10. Late-game monster XP scaling** — Late-game monsters (magma_brute 240 HP, frost_warden 280 HP, elder_sporecap 320 HP) give 55-65 XP which feels low for 4-6 second fights post-balance-pass. Scale XP proportionally to new HP values. Pure JSON content fix.

## Features & Systems

- [ ] **11. Automation grid Phase 3 — Screen access** — Add `openAutomation` scripting action to actions.js, MERIDIAN-7 interaction trigger that opens the automation screen, and client handler for AUTO_STATE with openScreen: true. Phases 1-2 (server state + client UI) are done but unreachable in-game. See docs/automation_screen.md.

- [ ] **12. Minimap quest waypoints** — Add colored dots on the minimap for active quest objectives. The text-only quest panel gives no spatial guidance. Show objective room locations as pulsing dots in the quest's color.

## Testing & Quality

- [ ] **13. Integration tests (Tier 4)** — Add tests for: combat flow (attack -> damage -> death -> loot drop), equipment system (equip/unequip -> stat recalc -> ability rebuild), sol grid (placement + adjacency modifier calc), room lifecycle (enter -> spawn monsters -> clear -> exit). Use existing test fixtures pattern.

- [ ] **14. Improve headless sim bot AI** — Bot currently gets stuck at NPC interactions and only visits ~4/43 rooms. Improve: NPC dialogue auto-advance, door interaction logic, multi-room pathfinding. This unlocks automated balance testing and quest validation across the full game.

## Polish

- [ ] **15. Explicit patrol waypoints** — Add specific patrolPath arrays to patrol monster spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02. Currently auto-generated paths may not match dungeon layout intent. Pure JSON content.

- [ ] **16. Loot tables for Act III monsters** — threshold_watcher, abyssal_tendril, and threshold_keeper have no loot tables. Create an underlumen loot table with thematic drops (umbracite resources, rare sol components, Underlumen-themed modifiers).

- [ ] **17. Placeholder sprites for remaining entities** — array_overseer needs a unique sprite (currently copied from array_sentinel). sable_nightside_guide and sable_threshold NPCs need sprites. Last entities without distinct visuals.

## Standing Tasks

- [ ] Run ralph to check for quality issues.
