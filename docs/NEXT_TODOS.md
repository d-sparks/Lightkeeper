# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOS.md tasks.

## Testing

- ~~Headless sim stuck at discover_array_secret~~ ✓ Fixed — redundant prereq goals eliminated, timeout increased, pathfinding stall recovery added.
- ~~Headless sim quarantine loop regression~~ ✓ Fixed — three issues: (1) bot settled diagonally from chest tile, exceeding Euclidean door range despite Manhattan-distance tolerance check; (2) `_findInteractableTile` returned corridor doors instead of quest-relevant chests; (3) combat blocked tile interaction indefinitely when monsters near chest. Now passes ~85% of runs.
- **Headless sim remaining intermittent failures** — ~25% failure rate from three sources: (a) `umbrasite_retrieval` side quest injected as prereq when navigating exits; the quest gets stuck because `refined_umbrasite` has no accessible source — needs skip-unresolvable-prereq logic; (b) `titanium_cylinders` chest at proc_quarantine depth 2 sometimes fails to open (bot moves to chest, has supply_crate_key, but interaction doesn't trigger) — investigate tryInteract targeting priority; (c) ~2.5% of layouts still have truly unreachable monsters at proc_quarantine depth 3 after 5 kill retries.
- ~~Content validator expedition flag errors~~ ✓ Resolved — added automation_established, expedition_active, and expedition_tier_1-5_cleared to engineSetFlags array in content-validator.js. Validator now reports 0 errors.
- Run content validator grep for remaining orphaned flags (setFlag without matching hasFlag consumers).

## Endgame Loop (see docs/endgame-loop.md)

### Phase 2 — Expedition Tiers 1-3 (Remaining)
- ~~Multi-floor expedition progression~~ ✓ Implemented — floor exits chain with scaling, boss from bossPool on final floor. Off-by-one in maxDepth fixed (maxFloors-1).
- ~~Expedition completion detection~~ ✓ Implemented — sets expedition_tier_N_cleared on boss kill, clears expedition_active.
- ~~Boss spawning on final floor from bossPool~~ ✓ Implemented — generator overrides boss type from expedition config.
- ~~Return portal on boss kill~~ ✓ Implemented — stairs-up exit spawned at boss death position, leads to expedition origin.
- ~~Silicon cost deduction at expedition start.~~ ✓ Implemented — `startExpedition()` checks and deducts `siliconCost` from automation resources; returns `insufficientSilicon` error if player can't afford it.
- ~~Death penalty (forfeit floor loot, return to meridian_station).~~ ✓ Implemented — expedition death forfeits all non-quest inventory (destroyed, not dropped) and respawns player at `expedition_origin` (defaults to `meridian_station`).
- Mid-run loot banking checkpoints — design concept exists but no checkpoint system yet; currently all loot picked up on a floor is forfeited on death.
- ~~Expedition boss loot table selection (expedition_tier_N_boss table should be rolled on boss kill).~~ ✓ Implemented — `_rollLoot` now overrides the monster's default loot table with `expedition_tier_N_boss` (or `expedition_tier_N_boss_[path]`) when the killed mob matches the expedition boss type.
- Client-side expedition HUD (floor counter, boss health bar).

### Phase 3 — Modifier Crafting
- ~~Add `craft` action type to `server/scripting/actions.js`.~~ ✓ Implemented — craft action opens crafting menu filtered by player inventory; executeCraftRecipe() handles recipe execution via choice menu (choiceId: meridian_craft).
- ~~Create `content/entities/crafting.json` with reforge/fuse/attune recipes.~~ ✓ Implemented — 6 reforge recipes and 3 fuse recipes defined.
- ~~Add MERIDIAN-7 crafting dialogue branch gated on `endgame_active` — craft action exists but NPC dialogue trigger for endgame crafting not yet wired.~~ ✓ Implemented — hub menu split into pre/post-endgame variants; Fabrication option appears only when `endgame_active` set; craft trigger fires on menu selection (choice_made) not raw npc_interacted; endgame_fabrication dialogue added to NPC.

### Phase 4 — Automation Levels 6-10
- ~~New structures (silicon_refinery, auto_turret, fabricator, expedition_beacon).~~ ✓ Implemented — 4 new structures with unlockLevel gating (levels 7-10), silicon as new resource produced by refineries, auto_turret defense rating, fabricator fast salvage production, expedition_beacon cost reduction.
- ~~Milestone rewards for levels 6-10.~~ ✓ Implemented — 5 new milestones at thresholds 20/25/30/40/50 granting area_expander, improved_generator, sol_shield, guardian_core, advanced_rechargeable_battery.
- ~~Automation levels 6-10 defined.~~ ✓ Implemented — Grid Expansion (20), Refinery (25), Defense Grid (30), Fabrication Bay (40), Array Subnet (50).
- ~~Client locked structure display.~~ ✓ Implemented — locked structures shown grayed out with level requirement, silicon resource display in sidebar.
- ~~Expedition beacon cost reduction integration.~~ ✓ Implemented — game-loop.js applies getExpeditionCostReduction() to silicon costs.
- ~~Structure adjacency bonus calculation (silicon_refinery boosting adjacent harvesters).~~ ✓ Implemented — `adjacencyBonus` field added to `silicon_refinery` in structures.json (targets: salvage_harvester, multiplier: 2.0). `_getAdjacencyMultiplier()` checks orthogonal neighbors; `_getTotalEffectiveAmount()` sums per-placement production with bonuses; `updateProduction()` and client stat rates both use the boosted values. Multiple adjacent refineries stack additively.
- Ending-path-specific structure variants (bio_harvester, symbiotic_node, array_drone_bay).
- ~~Grid expansion to 16x16 at automation level 6 (currently grid size is fixed at 12x12).~~ ✓ Implemented — `gridExpanded` flag added to per-player automation state; `getGridConfig(playerId)` returns a cached 16×16 config (offset 9,3 same as 12×12) when the flag is set; `checkMilestones()` sets the flag and emits a `grid_expansion` reward at threshold 20; `_gridConfigExpanded` defined in structures.json; client already renders grid size dynamically from `autoState.grid.width/height`.
- Raid event system for auto_turret defense value (auto_turret defense_value stat tracked but raids not implemented).

### Phase 5 — Boss Affixes + Tiers 4-5
- ~~Boss affix data format and pool in `content/expeditions/affixes.json`.~~ ✓ Implemented — 8 affixes (berserker, ironhide, swift, volatile, regenerating, empowered_slam, relentless, juggernaut) with stat mods, regen, special attack mods, and damageTakenMult.
- ~~Apply affix buffs to boss entities at spawn.~~ ✓ Implemented — `_applyBossAffixes()` in game-loop.js modifies boss stats, phases, special attacks, and title at spawn time; regen ticks in monster update loop; damageTakenMult applied at all 4 damage points.
- ~~Tier 4-5 expedition configs.~~ ✓ Implemented — tier_4.json (1 affix, 2.4x/2.0x scaling) and tier_5.json (2 affixes, 3.2x/2.5x scaling) with full affix pools.
- Tier 4-5 requiring multiple players (cooperative gating not yet implemented).
- ~~Wire path-specific boss loot table selection (check `chose_path_*` flag for Tier 3+ bosses).~~ ✓ Implemented — `_rollLoot` checks `chose_path_shutdown/merge/control` flags and selects `expedition_tier_N_boss_[path]` if the table exists, falling back to general boss table.
- ~~Tier 4-5 loot tables (expedition_tier_4, expedition_tier_5) not yet created.~~ ✓ Implemented — floor loot tables (expedition_tier_4/5) and boss tables (expedition_tier_4/5_boss, plus path-specific variants for shutdown/merge/control) added to content/loot/expeditions.json. Epic items dominant in floors; legendary items primary in boss tables.
- ~~Wire `unlockFlag` checking in loot resolver for legendary drops.~~ ✓ Implemented — `_rollLoot` and `doRollLootTable` now filter eligible rolls by `unlockFlag`, checking the player's flags before including path-specific legendaries in the weighted pool.

### Phase 6 — Cooperative Challenges
- Wave defense system, player-count gating, challenge configs.
- Cooperative-only legendary modifier pool.

### Phase 7 — Raids + Faction Rally
- Timed raid events, structure HP/repair, server-wide flag aggregation.

## Content Gaps

- Place feral_hound_alpha and frostfang_alpha as rare spawns in nightside_caverns and frost proc templates.
- ~~Place skeleton_archer in crypt_01/crypt_02 and add loot table.~~ ✓ Both crypts already had one archer; added a second patrolling archer to crypt_01; added `skeleton_archer` loot table to outpost.json.
- Add explicit patrolPath waypoints to patrol spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02.
- ~~Phase 3 investigation quest after Autotroph confrontation (mechanical meaningfulness beyond dialogue).~~ ✓ Implemented — Directive 11-Kappa quest: infiltrate Array Extraction Outpost, collect three evidence types, deliver to Sable/Asha/MERIDIAN-7 for path-specific epic sol components. Intel flags provide mechanical bonuses in ending dungeons.
- Phase 3 investigation: add worldmap entry for Array Extraction Outpost and connection from dayside_solar_fields.
- Phase 3 investigation: consider adding mismatched-path intel triggers (e.g., bringing shutdown intel to Control ending should have flavor text acknowledging the contradiction).
- ~~Post-ending Sable dialogue for Shutdown/Merge paths (expedition quest-giver).~~ ✓ Implemented — `post_shutdown` and `post_merge` extended with expedition quest-giver lines; added `shutdown_tier_N_complete` and `merge_tier_N_complete` dialogue sets gated on `expedition_tier_N_cleared` flags; dialogueRules updated to route to tier-specific sets with higher priority than base post-ending dialogue.
- ~~Post-ending atmospheric changes for outpost_entrance and outpost_comms.~~ ✓ Implemented — room_entered triggers for all three paths (shutdown/merge/control) with atmospheric messages and tile changes; post-ending dialogue added to Warden Holt, Guard Patel, Cpl. Reyes, Pvt. Dunnmore, Sgt. Ellers, Comms Officer Daley; registrar_hollis reaction trigger and civic center endgame atmosphere in meridian_civic; all gated on endgame_active flag.

## Sessions & Persistence

- ~~Periodic auto-save during play (currently only saves on disconnect).~~ ✓ Implemented — 5-minute auto-save interval in server/index.js.
- Handle name collisions more gracefully (warn on duplicate character names).
- Consider SQLite backend for deployed environments.

## Sol Grid & Progression

- Battery math: capacity per tier, energy costs per ability, casts per full charge.
- Harvester scaling: silicon rate, max harvesters, late-game upgrades.
- Light Sentry enhancements: multiple sentries, light/mirror puzzles, range indicator, upgrade paths.
- Playtest single-use battery degradation feel — 100 capacity may need tuning.
- Additional battery capacity tiers (50/200 cap variants).

## Map Streaming

- outer_expanse patrol paths — many spawns lack explicit patrolPath waypoints.
- Editor reload paths still send full map data (no fog of war chunking).
- Consider reducing chunk reveal radius for bigger maps.

## Art & Sprites

- ~~Redesign player sprites as helmeted frontier engineers with Sol Gold chest accent.~~ ✓ Done
- ~~Add warm hostile eyes (orange/red) to skeleton, luddite, and warlord sprites.~~ ✓ Done
- ~~Add distinguishing features to key NPCs (NPC default hair, Sable teal nightside eyes).~~ ✓ Done
- ~~Improve priority items: health potion self-colored outline, Sol Gold iron key, geometric sol unit.~~ ✓ Done
- ~~Replace remaining monster sprites with proper pixel art per art-style-guide.md: nightside creatures (dusk_crawler, shade_stalker, gloom_wraith), ice enemies (rime_stalker, frostfang_hunter, frost_warden), fire enemies (vent_spewer, magma_brute), fungal enemies, array/threshold bosses.~~ ✓ Done — all 20 target sprites redesigned: warm orange eyes on all hostile creatures, distinctive silhouettes (dusk_crawler antenna+legs, shade_stalker wide-reach arms, nest_mother 8-leg spider, gloom_wraith wispy ghost, frost warden icicle crown, crystal guardian faceted crown, magma_brute flame crown, elder sporecap wide cap, abyssal_tendril radiating tendrils, threshold_keeper void crown, etc.).
- ~~Add 1-pixel dark outlines to all entity sprites.~~ ✓ Done — `addOutline()` in generate-sprites.js fills transparent pixels adjacent to opaque regions with Void Black (#0a0a0f).
- ~~Add top-left lighting pass across all entity sprites.~~ ✓ Done — `applyTopLeftLighting()` brightens top/left surface edges (+28/+18) and darkens bottom/right edges (-22/-12). Both applied auto in `savePNG()` for any path under `sprites/`.
- Improve tileset sprites: crypt, outpost, quarantine tiles need texture refinement per zone color identity.
- Animation frames (idle, attack, hit) when engine supports sprite animation.
- New tileset strips for dark_city, quarantine, outpost templates (PNG files exist, need wiring).

## Combat & AI

- Tune special attack cooldowns and damage multipliers after playtesting.
- Automation controller support for grid (d-pad navigation, A to place, B to cancel).

## Balance

- Crystal Guardian at 700 HP — verify feels epic, not grindy.
- Rechargeable Battery L1 (30 energy) may need bump to 40.
- Automation milestone reward thresholds may need tuning.

## Quest Graph

- Remaining orphaned flags audit.
- Map markers for Nightside Caverns entrance.
- Ensure sol grid tutorial flow accommodates umbracite trade giving sol_shield_chip.
