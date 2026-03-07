# Lightkeeper — Next Tasks

Prioritized task list. Updated 2026-03-07.

---

## Game Feel (highest impact for player experience)

- [ ] **1. Placeholder sound effects** — Add synthesized tones for weapon attack, ability fire, monster hit, monster death, item pickup, door open, floor transition. The audio system and per-biome music are wired — it just needs sound effect content in client/audio.js.

- [ ] **2. Combat juice pass** — Screen shake on player hit, monster death fade-out animation, ambush monster fade-in reveal, projectile tinting by monster type (fire=orange, ice=blue, acid=green). Small VFX that compound into satisfying combat.

- [ ] **3. Death penalty implementation** — When the player dies: drain energy, drop a random non-quest item, respawn at room entrance. This completes the risk/reward loop that makes dungeon runs meaningful. See architecture-plan.md for dropBehavior rules (lose_on_death, durability_loss, soulbound).

## Content Completion (making the game whole)

- [ ] **4. Sol unit acquisition paths** — The 4 non-starter sol units (nightcaster_frame, array_precision_core, greenway_bioframe, underlumen_nexus) are defined but unobtainable. Wire them as chest drops, NPC rewards, or quest completions in thematically appropriate locations.

- [ ] **5. Wire generators into loot/rewards** — basic_generator and improved_generator items exist in items.json but aren't obtainable via any loot table or quest reward. Add them to appropriate dungeon chests or NPC trade pools.

- [ ] **6. Loot tables for Act III monsters** — threshold_watcher, abyssal_tendril, and threshold_keeper have no loot tables. Create nightside/underlumen loot tables with thematic drops (umbracite resources, rare sol components).

- [ ] **7. Three ending path dungeons** — Create ending dungeons for each path: array_control_center (shutdown), underlumen_nexus_chamber (merge), array_command_core (control). Each needs a final boss encounter and resolution triggers.

- [ ] **8. Post-choice NPC dialogue** — Add dialogue variants for Asha, Sable, and MERIDIAN-7 that react to the player's chosen ending path (chose_path_shutdown/merge/control flags).

## Features & Systems

- [ ] **9. Automation grid UI — Phase 1 (server)** — Update automation.js state to track placements with {x, y} coordinates. Update build() to accept gridX/gridY. Add grid config computed from dayside_solar_fields tile data. See docs/automation_screen.md Phase 1.

- [ ] **10. Automation grid UI — Phase 2 (client)** — Replace renderAutoTab() with full-screen CSS grid placement UI. 12x12 cells, build palette, resource sidebar, progress bar. See docs/automation_screen.md Phase 2.

- [ ] **11. Minimap quest waypoints** — Add colored dots on the minimap for active quest objectives. The text-only quest panel gives no spatial guidance to players.

- [ ] **12. Extended adjacency modifiers** — Implement radius-2 and row/column-spanning modifiers for rare/legendary sol components. Currently all modifiers only affect orthogonally adjacent cells.

## Testing & Quality

- [ ] **13. Integration tests (Tier 4)** — Add tests for combat flow (attack -> damage -> death -> loot), equipment system (equip/unequip -> ability rebuild), sol grid (placement + adjacency calc), and room lifecycle.

- [ ] **14. Improve headless sim bot AI** — Bot currently gets stuck at NPC interactions and only visits ~4/43 rooms. Improve pathfinding and NPC interaction handling so the sim can validate more quest paths automatically.

## Polish & Content Quality

- [ ] **15. Explicit patrol waypoints** — Add specific patrolPath arrays to patrol monster spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02. Currently they auto-generate default paths.

- [ ] **16. Placeholder sprites for remaining entities** — array_overseer (currently copied from array_sentinel), sable_nightside_guide, threshold_watcher, abyssal_tendril, threshold_keeper, sable_threshold NPCs.

- [ ] **17. Placeholder chest/crate sprites** — Add chest/crate tile sprites to frost_crypt (tiles 10/11), fungal_forest (tiles 10/11), and crypt (tiles 30/31) tilesets.

- [ ] **18. Crystal Guardian boss music** — Add a dedicated boss music track for the Crystal Guardian encounter. Currently uses dungeon ambient music.

## Standing Tasks

- [ ] Run ralph to check for quality issues.
