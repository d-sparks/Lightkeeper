# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOS.md tasks.

## Content — Nightside Path Discovery

- **`visited_dead_road` flag not yet set** — The `perimeter_gate_nightside_hint` trigger in `outpost_perimeter` uses `hasFlag: received_sol_unit` but does not gate on `not visited_dead_road` because that flag is never set. When dead_road.json is updated (e.g. via `dead_road_enter` trigger), consider adding `setFlag: visited_dead_road` there so the hint can be suppressed for players who've already been.
- **Wren Alcott NPC dialogue rules** — `wren_nightside_hint` is currently a dungeon trigger. If Wren gets full NPC dialogue rules defined in npcs.json, the hint should migrate there for consistency.

## Content — Undercity / dark_city Tileset

- **Second dark_city floor** — `meridian_undercity` (Warrens) exists as the first floor; create a `meridian_undercity_deep` floor accessible via stairs_down from the north zone (currently no stairs_down exit). Narratively: the deep warrens connect to Underlumen-adjacent tunnels or a Nightside maintenance junction.
- **Undercity discovery trigger in meridian_market** — the new stairs_down at (14, 9) has no first-discovery message in the market. Consider adding a `door_interacted` trigger or a positional flavor note so players know the passage exists before stepping in.
- **Loot table for Luddite gang** — the east-wing `luddite_brawler` monsters have no drop. Once the loot table system is implemented, give the gang cell a chance to drop `supply_crate_key` instead of (or in addition to) the static item spawn, so the pacing feels more organic.
- **Elara shop follow-up** — Fence Elara currently provides information and the supply crate reward, but no repeatable purchase option. A return-visit shop (smuggled goods, consumables) would give the undercity a reason to revisit after clearing the gang.

## Testing

- ~~Headless sim stuck at discover_array_secret~~ ✓ Fixed — redundant prereq goals eliminated, timeout increased, pathfinding stall recovery added.
- ~~Headless sim quarantine loop regression~~ ✓ Fixed — three issues: (1) bot settled diagonally from chest tile, exceeding Euclidean door range despite Manhattan-distance tolerance check; (2) `_findInteractableTile` returned corridor doors instead of quest-relevant chests; (3) combat blocked tile interaction indefinitely when monsters near chest. Now passes ~85% of runs.
- **Headless sim remaining intermittent failures** — ~15% failure rate from two sources: ~~(a) `umbrasite_retrieval` side quest injected as prereq when navigating exits~~ ✓ Fixed — added skip-unresolvable-prereq logic: `wait_for_flag` and `wait_for_item` goals time out after 300 ticks for non-mainline quests, failed quests are tracked in `failedQuestPrereqs`, blocked exits are marked unreachable and excluded from BFS pathfinding, navigate goals get fresh condition checks after quest abandonment; (b) `titanium_cylinders` chest at proc_quarantine depth 2 sometimes fails to open (bot moves to chest, has supply_crate_key, but interaction doesn't trigger) — investigate tryInteract targeting priority; (c) ~2.5% of layouts still have truly unreachable monsters at proc_quarantine depth 3 after 5 kill retries.
- ~~Content validator expedition flag errors~~ ✓ Resolved — added automation_established, expedition_active, and expedition_tier_1-5_cleared to engineSetFlags array in content-validator.js. Validator now reports 0 errors.
- ~~Run content validator grep for remaining orphaned flags (setFlag without matching hasFlag consumers).~~ ✓ See Quest Graph section.

## Endgame Loop (see docs/endgame-loop.md)

### Phase 2 — Expedition Tiers 1-3 (Remaining)
- ~~Multi-floor expedition progression~~ ✓ Implemented — floor exits chain with scaling, boss from bossPool on final floor. Off-by-one in maxDepth fixed (maxFloors-1).
- ~~Expedition completion detection~~ ✓ Implemented — sets expedition_tier_N_cleared on boss kill, clears expedition_active.
- ~~Boss spawning on final floor from bossPool~~ ✓ Implemented — generator overrides boss type from expedition config.
- ~~Return portal on boss kill~~ ✓ Implemented — stairs-up exit spawned at boss death position, leads to expedition origin.
- ~~Silicon cost deduction at expedition start.~~ ✓ Implemented — `startExpedition()` checks and deducts `siliconCost` from automation resources; returns `insufficientSilicon` error if player can't afford it.
- ~~Death penalty (forfeit floor loot, return to meridian_station).~~ ✓ Implemented — expedition death forfeits all non-quest inventory (destroyed, not dropped) and respawns player at `expedition_origin` (defaults to `meridian_station`).
- ~~Mid-run loot banking checkpoints~~ ✓ Implemented — checkpoint safe rooms inserted between expedition floors (configured via `checkpointFloors` in tier JSON). Cache Terminal NPC banks non-quest inventory items via `bankLoot` action; banked items stored as `expedition_banked_loot` player flag and survive death. Restored on both death (returned to inventory at respawn) and expedition completion. Client shows toast notification on banking. Tiers 1-3 checkpoint after floor 2; tiers 4-5 checkpoint after floors 2 and 4.
- Checkpoint room equipment banking — currently only inventory items are banked, equipped items are not; consider adding equipment banking option.
- ~~Banked items inventory tab~~ ✓ Implemented — "CACHED" tab appears in inventory UI during expeditions showing all banked items (read-only, hover for stats). Server includes `bankedItems` in initial `INVENTORY` message and `LOOT_BANKED` messages. Tab auto-shows on expedition start, hides on end.
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
- ~~Ending-path-specific structure variants (bio_harvester, symbiotic_node, array_drone_bay).~~ ✓ Implemented — three path-gated structures added to structures.json: bio_harvester (Shutdown, free/self-replicating, salvage production), symbiotic_node (Merge, dual_production: salvage + energy regen), array_drone_bay (Control, structure_repair placeholder). Engine handles requiresFlag gating in build(), dual_production in updateProduction/getEnergyRegenRate/getStateForClient, selfReplication timer in updateProduction. Path flags (chose_path_shutdown/merge/control) passed from AUTO_BUILD handler to build() and getStateForClient().
- Path-specific structures currently appear unlocked in automation screens opened outside the AUTO_BUILD flow (join/room-enter auto state send, scripting openAutomation). Pass pathFlags to all getStateForClient call sites for consistent locked display.
- ~~Path cost modifier (Shutdown +50%, Control -25% on all structure costs).~~ ✓ Implemented — `_getPathCostMultiplier()` in automation.js applies 1.5x (shutdown) or 0.75x (control) with `Math.ceil` rounding; applied in `build()` and reflected in `getStateForClient()` scaled cost display; `pathCostMultiplier` exposed in client stats.
- ~~getRepairRate() for array_drone_bay.~~ ✓ Implemented — `getRepairRate()` method added; `repairRate` (repairs per hour) exposed in client stats. Actual repair execution (applying HP recovery to structures) deferred to Phase 7 raid system — structure HP tracking not yet implemented.
- ~~Grid expansion to 16x16 at automation level 6 (currently grid size is fixed at 12x12).~~ ✓ Implemented — `gridExpanded` flag added to per-player automation state; `getGridConfig(playerId)` returns a cached 16×16 config (offset 9,3 same as 12×12) when the flag is set; `checkMilestones()` sets the flag and emits a `grid_expansion` reward at threshold 20; `_gridConfigExpanded` defined in structures.json; client already renders grid size dynamically from `autoState.grid.width/height`.
- ~~Raid event system for auto_turret defense value.~~ ✓ Implemented — see Phase 7 section.

### Phase 5 — Boss Affixes + Tiers 4-5
- ~~Boss affix data format and pool in `content/expeditions/affixes.json`.~~ ✓ Implemented — 8 affixes (berserker, ironhide, swift, volatile, regenerating, empowered_slam, relentless, juggernaut) with stat mods, regen, special attack mods, and damageTakenMult.
- ~~Apply affix buffs to boss entities at spawn.~~ ✓ Implemented — `_applyBossAffixes()` in game-loop.js modifies boss stats, phases, special attacks, and title at spawn time; regen ticks in monster update loop; damageTakenMult applied at all 4 damage points.
- ~~Tier 4-5 expedition configs.~~ ✓ Implemented — tier_4.json (1 affix, 2.4x/2.0x scaling) and tier_5.json (2 affixes, 3.2x/2.5x scaling) with full affix pools.
- ~~Tier 4-5 requiring multiple players (cooperative gating not yet implemented).~~ ✓ Implemented — `minPlayers: 2` in tier_4/5 JSON; `startExpedition()` validates room player count; shared expedition state (flags, boss kill, floor transitions, completion) tracked via `expedition_party` flag across all party members; party members transition floors together; dead members removed from party; client HUD shows party size.
- ~~Wire path-specific boss loot table selection (check `chose_path_*` flag for Tier 3+ bosses).~~ ✓ Implemented — `_rollLoot` checks `chose_path_shutdown/merge/control` flags and selects `expedition_tier_N_boss_[path]` if the table exists, falling back to general boss table.
- ~~Tier 4-5 loot tables (expedition_tier_4, expedition_tier_5) not yet created.~~ ✓ Implemented — floor loot tables (expedition_tier_4/5) and boss tables (expedition_tier_4/5_boss, plus path-specific variants for shutdown/merge/control) added to content/loot/expeditions.json. Epic items dominant in floors; legendary items primary in boss tables.
- ~~Wire `unlockFlag` checking in loot resolver for legendary drops.~~ ✓ Implemented — `_rollLoot` and `doRollLootTable` now filter eligible rolls by `unlockFlag`, checking the player's flags before including path-specific legendaries in the weighted pool.

### Phase 5.5 — Cooperative Polish
- Expedition party silicon cost splitting — currently only the initiator pays; consider splitting cost across party members.
- Party formation UI — currently all players in the room join automatically; consider explicit party invite/accept flow.
- Party disconnect handling — if a party member disconnects mid-expedition, they are not removed from the party list until death or completion; consider cleanup on disconnect.
- Shared XP/loot distribution across party members (currently individual per-player).

### Phase 6 — Cooperative Challenges
- ~~Wave defense system, player-count gating, challenge configs.~~ ✓ Implemented — Lighthouse Siege: 10-wave defense for 2-4 players with communal energy pool, lighthouse HP, wave scaling, inter-wave phases, siege_legendary reward table. Engine: startSiege()/updateSiege() in game-loop.js, challenge loader in content-loader.js, SIEGE_STATE message type. Content: challenge JSON, arena dungeon, siege loot tables, cooperative legendary modifiers (lighthouse_lens, deep_resonance, prismatic_core) + item chips.
- ~~Cooperative-only legendary modifier pool.~~ ✓ Implemented — 3 cooperative-only legendaries in sol_components.json (lighthouse_lens, deep_resonance, prismatic_core) + corresponding item chips in items.json.
- ~~Siege NPC trigger — need to wire an NPC interaction (e.g. at meridian_station post-endgame) that calls startSiege() via a scripting action or dedicated message type.~~ ✓ Implemented — Siege Warden Kael NPC in meridian_station with startSiege action type in actions.js. Post-endgame gate (expedition_tier_4_cleared), cooldown/player-count error messages, confirmation choice menu.
- Siege lighthouse repair interaction — design doc mentions spending silicon to repair between waves; not yet implemented (requires client interaction + action type for repair).
- Light Sentry placement between waves — design doc mentions placing sentries in inter-wave phase; existing sentry system works but no special siege-mode sentry placement UI.
- Deep Expedition (Tier 6) — 3-4 player, 7-floor no-checkpoint run with abyssal_sovereign boss requiring coordination mechanics. Not yet implemented.
- Siege visual feedback — lighthouse entity rendering, wave start/clear announcements, victory/defeat overlay. Currently only HUD bars and event data are sent.

### Phase 7 — Raids + Faction Rally
- ~~Timed raid events, structure HP/repair.~~ ✓ Implemented — raid timer ticks per-player in game-loop.js; `_raidConfig` in structures.json defines interval (1200s), chance (30%), monster pool, damage, and scaling; `_executeRaid()` computes damage vs defense rating, distributes damage across random non-turret structures, destroys structures at 0 HP; `updateRepairTimer()` applies drone bay HP recovery; `RAID_ALERT` message notifies client of raid outcomes; structure HP included in `AUTO_STATE` payload.
- ~~Client-side raid alert UI (toast/overlay showing raid results, structure HP bars on automation grid).~~ ✓ Implemented — `RAID_ALERT` message triggers `#raid-alert-toast` (red border, 6s display) showing monster count, turrets active, damaged/destroyed structure counts; placed cells in automation grid show a 3px HP bar (green/orange/red by health %) and red-tinge background when damaged; HP info added to cell hover tooltip.
- ~~Player manual defense — teleport to dayside_solar_fields to fight raid monsters in real-time (currently raids are abstract/instant).~~ ✓ Implemented — when raid triggers, player gets 30-second countdown with "Defend Manually" button; clicking teleports to `dayside_raid_defense` arena with raid monsters spawned; killing all monsters prevents structure damage and teleports player back; ignoring the countdown applies abstract damage as before.
- Raid defense death handling — if player dies in raid defense room, abstract damage is not applied (raid was claimed), but structures are undefended. Consider adding partial damage on death as penalty.
- Raid difficulty curve tuning — 5 base monsters + 2 per level above min may need playtesting.
- Server-wide flag aggregation for Faction Rally cooperative event.

## Content Gaps

- ~~Nightside Caverns map markers and NPC breadcrumbs for new players.~~ ✓ Implemented — `perimeter_lookout` NPC added to deep_perimeter_east near south exit; Sable `nightside_hint` dialogue variant added; `nightside_entrance_waypoint` trigger sets minimap waypoint on caverns exit (x:3, y:19); cold air hint trigger; `sable_nightside_breadcrumb` trigger sets waypoint pointing from dead_road toward perimeter; `mark_nightside_visited` trigger in nightside_caverns clears waypoint and sets flag.
- Consider adding Nightside-path hints in earlier rooms (e.g., outpost_perimeter) for players who haven't yet reached the Dead Road.
- Place feral_hound_alpha and frostfang_alpha as rare spawns in nightside_caverns and frost proc templates.
- ~~Place skeleton_archer in crypt_01/crypt_02 and add loot table.~~ ✓ Both crypts already had one archer; added a second patrolling archer to crypt_01; added `skeleton_archer` loot table to outpost.json.
- Add explicit patrolPath waypoints to patrol spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02.
- ~~Phase 3 investigation quest after Autotroph confrontation (mechanical meaningfulness beyond dialogue).~~ ✓ Implemented — Directive 11-Kappa quest: infiltrate Array Extraction Outpost, collect three evidence types, deliver to Sable/Asha/MERIDIAN-7 for path-specific epic sol components. Intel flags provide mechanical bonuses in ending dungeons.
- ~~Phase 3 investigation: add worldmap entry for Array Extraction Outpost and connection from dayside_solar_fields.~~ ✓ Implemented — worldmap location added at (0.07, 0.60) in dayside zone; connection auto-generated from dayside_solar_fields exits.
- ~~Phase 3 investigation: mismatched-path intel triggers.~~ ✓ Implemented — `room_entered` triggers added to all three ending dungeons: `array_control_center.json` (shutdown ending) acknowledges control/merge intel mismatch; `array_command_throne.json` (control ending) acknowledges shutdown/merge intel mismatch; `merge_nexus.json` (merge ending) acknowledges control/shutdown intel mismatch. Each trigger fires once on entry and shows flavor text reflecting the tension between the intel carried and the path chosen. No mechanical penalty — narrative acknowledgment only.
- ~~Post-ending Sable dialogue for Shutdown/Merge paths (expedition quest-giver).~~ ✓ Implemented — `post_shutdown` and `post_merge` extended with expedition quest-giver lines; added `shutdown_tier_N_complete` and `merge_tier_N_complete` dialogue sets gated on `expedition_tier_N_cleared` flags; dialogueRules updated to route to tier-specific sets with higher priority than base post-ending dialogue.
- ~~Post-ending atmospheric changes for outpost_entrance and outpost_comms.~~ ✓ Implemented — room_entered triggers for all three paths (shutdown/merge/control) with atmospheric messages and tile changes; post-ending dialogue added to Warden Holt, Guard Patel, Cpl. Reyes, Pvt. Dunnmore, Sgt. Ellers, Comms Officer Daley; registrar_hollis reaction trigger and civic center endgame atmosphere in meridian_civic; all gated on endgame_active flag.

## Sessions & Persistence

- ~~Periodic auto-save during play (currently only saves on disconnect).~~ ✓ Implemented — 5-minute auto-save interval in server/index.js.
- Handle name collisions more gracefully (warn on duplicate character names).
- Consider SQLite backend for deployed environments.

## Inventory

- Stackable items display correctly in the ITEMS tab (identical `type` values merged with `xN` count badge). Currently display-only: clicking a stack sends the index of the first item; after using a consumable the count auto-decrements on next inventory update.
- If sol_components of the same type ever have meaningfully different stats or adjacency patterns (e.g. upgraded vs base versions), they should be given distinct `type` values so they don't collapse into a single stack.

## Sol Grid & Progression

- ~~Battery math: capacity per tier, energy costs per ability, casts per full charge.~~ ✓ Resolved — battery tiers (L1: 30, L2: 100, L3: 300) documented in progression-system.md with casts-per-charge tables for each game phase. Advanced rechargeable bumped from 150→300 to match 3:1 compression ratio.
- Harvester scaling: silicon rate, max harvesters, late-game upgrades.
- Light Sentry enhancements: multiple sentries, light/mirror puzzles, range indicator, upgrade paths.
- Playtest single-use battery degradation feel — 100 capacity may need tuning.
- Playtest battery balance: early game (60 energy, ~2 fights) should feel tight but fair; late game (500+ energy) should shift constraint from capacity to cooldowns.

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
- ~~Improve tileset sprites: crypt, outpost, quarantine tiles need texture refinement per zone color identity.~~ ✓ Done — crypt: cold slate-blue void, bone wall specks, iron-banded stone doors, cold teal stairs/phosphorescent glow; outpost: warm steel doors (replacing blue-gray), orange torchlight stairs, rust streaks on walls; quarantine: rust+green cracked floors, rust wall streaks, warning-red door indicators + locked door, contamination toxic waste spots.
- ~~Expand tileset PNGs to cover all tile IDs defined in tileset JSONs.~~ ✓ Done — crypt expanded to 640x16 (40 tiles), outpost to 512x16 (32 tiles), quarantine to 208x16 (13 tiles). New tiles include: chest_closed/opened, all sealed_gate variants, blast_door, junction_box_b, maintenance_hatch, transit_gate, garden_plot, notice_board, seed_pot, personal_log, homestead_gate, cache_entrance, resonance_point, survey_marker, crates, ramps, elevated floor/wall, cracked_wall. All use zone-appropriate colors.
- ~~Animation frames (idle, attack, hit) when engine supports sprite animation.~~ ✓ Implemented — 4-frame animation strips (idle1, idle2/bob, attack/lunge, hit/recoil) generated for all entity sprites; renderer cycles idle frames at ~2Hz, shows attack frame when `attacking` flag set, hit frame on damage flash. Future: hand-drawn per-entity animation poses instead of pixel-shift variants.
- New tileset strip for dark_city template (PNG exists but no dungeon JSON uses it yet; needs dungeon content before wiring).
- ~~Checkpoint room visual polish — expedition_checkpoint dungeon uses plain crypt tileset; consider unique tileset or tile decorations for cache points.~~ ✓ Done — expanded to 13×9, added ambientLight: 0.3 (dim emergency lighting), supply crates (tile 30) in four corners, cracked floor (tile 2) scatter for texture. Updated entry message to match the dim amber aesthetic.
## Combat & AI

- Tune special attack cooldowns and damage multipliers after playtesting.
- Automation controller support for grid (d-pad navigation, A to place, B to cancel).

## Balance

- Crystal Guardian at 700 HP — verify feels epic, not grindy.
- Rechargeable Battery L1 (30 energy) may need bump to 40.
- Automation milestone reward thresholds may need tuning.

## Quest Item Pickup Hints

- **Audit future quest items**: Any new key/quest item placed in a dungeon should have an `item_picked_up` trigger with a `showMessage` that includes a clear next-step hint (who to talk to, where to go, what to do with it). All existing items have been updated as of 2026-03-12.
- **Equipment items (sol units, bioframes)**: Currently show flavor text but no usage hint like "equip this in your Sol Grid." Consider adding brief equip instructions for players unfamiliar with the Sol Grid system.
- **Lore items with no NPC connection**: Some lore items (e.g. `lore_soldiers_journal`) point players toward NPCs for flavor, but there's no actual NPC dialogue branch that acknowledges the item. Consider adding `hasItem` dialogue rules for lore items that have pickup hints pointing to specific NPCs.

## Quest Graph

- ~~Remaining orphaned flags audit.~~ ✓ Complete — `tools/audit-flags.py` comprehensively scans all content JSON (dungeons, tilesets, quests, expeditions, NPC entity dialogueRules) and found 0 orphaned setFlag calls and 0 unset hasFlag conditions. All 228 wired flags have both producers and consumers. The 9 "content-invisible" flags (`automation_established`, `automation_level`, `damage_booster_equipped`, `expedition_active`, `expedition_tier_N_cleared`, `has_traded_meridian`) are set directly by engine code (`server/index.js`, `server/game-loop.js`) outside the trigger/action system — this is expected. **Fix applied**: `automation_level` was checked by expedition tier 3–5 unlock conditions but never written; fixed in `server/index.js` `AUTO_BUILD` handler to update `automation_level` to the current total structure count after each build.
- Map markers for Nightside Caverns entrance.
- Ensure sol grid tutorial flow accommodates umbracite trade giving sol_shield_chip.
- Engine-set flags not visible to content audit tool — consider adding a comment block or `docs/engine-flags.md` registry listing flags set directly by engine code so future content authors know not to add setFlag triggers for them.
