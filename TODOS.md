# Lightkeeper — Next Tasks

Prioritized task list. Updated 2026-03-07.

---

## Game Feel (highest impact for player experience)

- [ ] **1. Placeholder sound effects** — Add synthesized tones for weapon attack, ability fire, monster hit, monster death, item pickup, door open, floor transition. The audio system and per-biome music are wired — it just needs sound effect content in client/audio.js and content/audio/sounds.json.

- [ ] **2. Combat juice pass** — Screen shake on player hit, monster death fade-out animation, ambush monster fade-in reveal, projectile tinting by monster type (fire=orange, ice=blue, acid=green). Small VFX that compound into satisfying combat.

- [ ] **3. Death penalty implementation** — When the player dies: drain energy, drop a random non-quest item, respawn at room entrance. This completes the risk/reward loop that makes dungeon runs meaningful. See architecture-plan.md for dropBehavior rules (lose_on_death, durability_loss, soulbound).

## Content Completion (making the game playable end-to-end)

- [ ] **4. Sol unit acquisition paths** — The 4 non-starter sol units (nightcaster_frame, array_precision_core, greenway_bioframe, underlumen_nexus) are defined but unobtainable. Wire them as chest drops, NPC rewards, or quest completions in thematically appropriate locations.

- [ ] **5. Wire generators into loot/rewards** — basic_generator and improved_generator items exist in items.json but aren't obtainable via any loot table or quest reward. Add them to appropriate dungeon chests or NPC trade pools.

- [ ] **6. Loot tables for Act III monsters** — threshold_watcher, abyssal_tendril, and threshold_keeper have no loot tables. Create nightside/underlumen loot tables with thematic drops (umbracite resources, rare sol components).

- [ ] **7. Post-choice NPC dialogue** — Add dialogue variants for Asha, Sable, and MERIDIAN-7 that react to the player's chosen ending path (chose_path_shutdown/merge/control flags). Makes the three-way choice feel consequential.

## Story & Endgame Content

- [ ] **8. Three ending path dungeons** — Create ending dungeons for each path: array_control_center (shutdown), underlumen_nexus_chamber (merge), array_command_core (control). Each needs a final boss encounter and resolution triggers.

- [ ] **9. Unbounded elder NPC** — Add a deep Nightside elder NPC (referenced by Sable's Act III dialogue). Provides Underlumen lore, Unbounded perspective, and gates the merge path's deeper requirements.

- [ ] **10. Late-game monster XP scaling** — Late-game monsters (magma_brute 240 HP, frost_warden 280 HP, elder_sporecap 320 HP) give 55-65 XP which may feel low for 4-6 second fights. Scale XP to match post-balance-pass durability.

## Features & Systems

- [ ] **11. Automation grid Phase 3 — Screen access** — Add `openAutomation` scripting action, MERIDIAN-7 interaction trigger, and client handler for `AUTO_STATE` with `openScreen: true`. See docs/automation_screen.md Phase 3.

- [ ] **12. Minimap quest waypoints** — Add colored dots on the minimap for active quest objectives. The text-only quest panel gives no spatial guidance to players.

- [ ] **13. Extended adjacency modifiers** — Implement radius-2 and row/column-spanning modifiers for rare/legendary sol components. Currently all modifiers only affect orthogonally adjacent cells.

## Testing & Quality

- [ ] **14. Integration tests (Tier 4)** — Add tests for combat flow (attack -> damage -> death -> loot), equipment system (equip/unequip -> ability rebuild), sol grid (placement + adjacency calc), and room lifecycle.

- [ ] **15. Improve headless sim bot AI** — Bot currently gets stuck at NPC interactions and only visits ~4/43 rooms. Improve pathfinding and NPC interaction handling so the sim can validate more quest paths automatically.

## Polish & Content Quality

- [ ] **16. Explicit patrol waypoints** — Add specific patrolPath arrays to patrol monster spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02. Currently they auto-generate default paths.

- [ ] **17. Placeholder sprites for remaining entities** — array_overseer (unique sprite, currently copied from array_sentinel), sable_nightside_guide, sable_threshold NPCs. These are the last entities without distinct sprites.

- [ ] **18. Crystal Guardian boss music** — Add a dedicated boss music track for the Crystal Guardian encounter. Currently uses dungeon ambient music. The audio system already supports boss music triggers.

## Standing Tasks

- [ ] Run ralph to check for quality issues.
