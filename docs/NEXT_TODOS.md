# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOs.md tasks.

Last cleaned: 2026-03-15 late (full three-act playtest audit; content validator: 0 errors, 4 warnings; sim explore mode: 14/124 rooms (11.3%); all-quests mode blocked by proc room nesting bug).

## Full Three-Act Campaign Playtest Audit (2026-03-15 late)

Comprehensive end-to-end audit of all 124 rooms across 3 acts, all 3 ending paths, 22 quests, and 66 monsters. Sim coverage limited by pathfinding/combat AI, but manual content review covers Acts 2-3 fully.

### Fixes Applied This Session

7. **`projectile_burst` special attack not implemented**: 5 monsters (bulwark_engineer, hybrid_drone, radiance_construct, solar_core_warden, underlumen_emergence) had `projectile_burst` specials that were silently ignored by the engine. Converted all to `thrown_projectile` with appropriate damage/range/speed values. These are Act 2-3 enemies — their ranged specials now actually fire.

8. **lighthouse_mara_caverns disconnected map section**: The southeast quadrant (rows 10-16, x=16-22) containing the `mara_power_cell` item, chest, and several monsters was completely unreachable from the player spawn. A diagonal wall barrier from (13,10) to (9,14) had no passage connecting the two halves. Added a 5-tile corridor at y=13 (x=10-14: wall → frozen_stone) to connect the sections.

9. **Sim navigate_to_room infinite loop**: When move_to_position goals timed out, navigate_to_room would retry indefinitely, creating loops where the bot bounced between two rooms forever. Added retry counter (max 6 attempts / 1500 ticks) before abandoning navigation. Explore mode improved from 6.5% to 11.3% room coverage with zero soft locks.

### Content Audit Results

**Dungeon connectivity**: All 124 rooms reachable from spawn. No orphaned dungeons. 15 conditional exits properly gated. 2 intentional one-way exits (merge_nexus→array_deep_processing, underlumen_threshold→train_station).

**Quest flag chains**: All 22 quests have valid start condition sources. The only "missing" completion flag (`damage_booster_equipped`) is correctly set by engine code.

**Monster balance curve**: Proper HP/damage scaling from Act 1 (10-130 HP, 0-16 dmg) → Act 2 (40-450 HP, 8-24 dmg) → Act 3 (110-900 HP, 12-26 dmg). Boss progression: quarantine_warlord(120HP) → dural_voss(600) → general_thorne(650) → threshold_keeper(750) → nexus_guardian(800) → solar_core_warden(900).

**Ending paths**: All three endings fully implemented with:
- SHUTDOWN (array_control_center): defeat overseer → activate terminal → `ending_shutdown_complete`
- CONTROL (array_command_throne): defeat overseer → seize throne → `ending_control_complete`
- MERGE (merge_nexus): defeat elder sporecap → convergence communion → `ending_merge_complete`
- Each has intel-match bonuses, intel-mismatch dialogue, boss fight, multi-page ending text, post-ending atmosphere

**NPC dialogue**: 74 NPCs across campaign. All have dialogue via `dialogues.default` or `dialogue` array. corporal_venn (5 sets) and keeper_mara (4 sets) have the most state-dependent dialogue.

### Outstanding Issues

1. **[opus] Sim bot can't traverse outpost_perimeter**: The 45x43 map with 27-30 monsters is a death trap for the sim bot (735 deaths in explore mode). The bot can't pathfind through dense monster rooms and lacks the combat AI to survive. This blocks all content beyond Act 1 outpost. Consider sim-only monster reduction or passthrough option for perimeter.

2. **[opus] Proc room nesting bug**: In all-quests mode, the bot enters `proc:proc_quarantine:proc:proc_quarantine:proc:proc_quarantine:...` — a triply-nested procedural room. The exit at (24,4) has no A* path (returns null). The proc room generator may be creating recursive entries from the same exit tile.

3. **[opus] `spire_radiance_cleared` flag set but never checked**: Content validator warning. If any future content gates on Spire of Radiance completion, this flag exists but currently nothing reads it.

4. **[sonnet] Ending path quest tracking**: No quest definition covers the Act 3 ending choice (choosing shutdown/control/merge path and completing it). The `nightside_expedition` quest tracks the path choice but not the actual ending execution. Consider adding an `endgame` quest.

5. **[opus] Sim explore mode combat**: The bot deals 0 damage and kills 0 monsters in explore mode despite taking 90,120 damage (735 deaths). The combat AI appears completely broken in explore mode — investigate `skipCombat` flag or weapon/ability initialization.

6. **[sonnet] Act 2-3 NPC conditional dialogue**: Most NPCs (70/74) have only 1 dialogue set with 0 conditions. Only corporal_venn (5 sets), keeper_mara (4 sets), wounded_unbounded_scout (2), and unbounded_elder (2) react to game state. Key NPCs like councillor_asha, warden_holt, and MERIDIAN-7 should have state-dependent dialogue as the player progresses through acts.

7. **[sonnet] Merge ending NPC interaction ordering**: The merge_nexus has three NPCs (asha_merge, sable_merge, meridian_7_merge) but the ending trigger (`symbiosis_communion_begin`) fires on tile interaction at (12,11), not on NPC conversations. Consider requiring all three NPCs to be spoken to before the communion can begin — adds narrative weight.

## Three-Act Campaign Playtest Audit (2026-03-15 earlier session)

Full end-to-end audit of Acts 1-3, ending paths, and endgame loop. Sim verified through Act 1 midpoint; everything beyond Lighthouse Mara required manual content review.

### Fixes Applied

1. **Missing `spire_radiance_cleared` flag**: Added to `spire_radiance_core.json` pedestal activation trigger. This Act 3 critical path flag was never set — would block any content gated on completing the final Spire.

2. **Luddite Crossbowman damage spike**: Reduced damage 20 → 15. At 20 damage with 8-tile range and 0.6 attack speed, this Act 1 mid enemy was dealing 33 DPS — killing players in ~3 seconds. Now aligned with other Nightside enemies (14-16 damage range).

3. **Biolab enemies too weak for Act 2**: Buffed `biolab_tendril` (35→60 HP, 8→12 dmg, 6→8 XP) and `biolab_spitter` (45→70 HP, 12→14 dmg). Previously weaker than Act 1 Nightside enemies, creating a difficulty dip at Act 2 entry.

4. **Solar Core Warden phase 3 overtuned**: Phase 3 was dealing 68 DPS from projectiles alone (34 dmg × 0.5s interval), with a 68-damage ground slam. Reduced phase 3 damage 34→28, projectile interval 0.5→0.9, slam multiplier 2.0→1.6, burst count 6→5, wound duration 8→6s, wound heal reduction 0.6→0.5. Still the hardest boss but no longer mathematically impossible solo.

5. **Act 3 healing drought**: Added `field_medkit` (weight 3) to `array_sentinel` loot table. Array sentinels had zero healing drops — the most common Act 3 enemy was the only enemy type in the game with no consumable drops at all.

6. **Shade Stalker Alpha death loop (lighthouse_mara_core)**: Bot died 78 times due to compounding boss damage + environmental cold. Reduced alpha HP 110→80, damage 18→14, lunge multiplier 1.6→1.4, stun duration 1.0→0.8s. Reduced core cold hazard from 3 dmg/2.5s (1.2 DPS) to 2 dmg/3.5s (0.57 DPS). Added frost_salve spawn at (8,11) near boss corridor entrance. Sim bot navigation currently stalls in early outpost rooms (pre-existing issue) — cannot verify fix via sim; needs manual playtest.

### Outstanding — Manual Playtest Required

These issues were identified through content review but need human playtesting to confirm severity:

**HIGH priority (potential blockers):**
- [ ] **Nexus Guardian stun+wound combo**: 1.5s stun guarantees a free 50-damage slam, wound then reduces healing 60% for 7s. Solo players may find this mechanically impossible. Consider: make wound and stun mutually exclusive on the same boss, or add a 2s stun immunity window after being stunned.
- [ ] **General Thorne phase 3**: 28-damage projectiles at 0.9s interval + conscript summons creates an overwhelming combination. May need longer summon interval (10→15s) or lower phase 3 projectile damage.
- [x] **Player max HP never scales**: Fixed — hpPerLevel increased 10→15 (max level 20 = 385 HP), added 7 accessory-slot equipment items with +maxHP (25/40/60/60/80/100/125 by rarity tier), distributed across loot tables from Act 1 through endgame. With best accessory at level 20: 510 HP. Follow-up: consider per-Spire-cleared +25 HP permanent bonus and HP-boosting sol components as future enhancements.

**MEDIUM priority (pacing/balance):**
- [ ] **Weapon progression plateau**: Between Sol Unit (12 attackDamage) and epic sol units (14-18), there is no intermediate weapon. Players may feel stagnant through most of Act 2. Consider a rare-tier weapon drop from General Thorne or Spire Winds content.
- [ ] **Ranged weapon cap too low**: Best ranged weapon is Bulwark Combat Rifle at +8 attackDamage. Ranged builds fall behind melee by Act 3. Need a rare/epic ranged weapon.
- [ ] **Bulwark Shock Baton drop rate**: Only Act 2 melee upgrade has 2.5% effective drop rate (50% drop × weight 1/20 from Bulwark Sergeant). Players could go through all of Act 2 without finding it. Consider increasing weight to 3.
- [ ] **Spire Radiance Forge hazard**: 6 damage per 1.8s (3.3 DPS) heat combined with combat is extremely punishing without Array Precision Frame's heat resist. Need a warning NPC or make heat resist available earlier.
- [ ] **Act 2-3 regular enemy difficulty flattens**: Act 3 Array enemies (12-18 dmg) aren't significantly harder than Act 2 Bulwark enemies (12-16 dmg). The difficulty curve plateaus for non-boss encounters. Consider +2-3 damage or +30 HP bump for Act 3 regular enemies.

**LOW priority (narrative/polish):**
- [ ] **~10 dead visit-tracking flags**: Flags like `visited_lighthouse_mara_f02` through `f19` are set but never checked by any trigger or NPC. Harmless but could be wired to NPC dialogue for flavor.
- [ ] **Ending path dungeons need pacing verification**: The three ending paths (shutdown/merge/control via `meridian_civic.json`) each lead to distinct dungeon branches. Verify each path takes roughly equal time to complete and has adequate narrative payoff.
- [ ] **Endgame loop entry**: `endgame_active` flag is set once per path choice. Verify Expedition Board, Siege Warden, and Spire replay systems all correctly gate on this flag.
- [ ] **Quarantine Warlord still feels trivial at 120 HP** (dies in 3 seconds with starter weapons). The earlier balance pass intentionally reduced it, but it may need re-evaluation if playtests confirm it's not satisfying as a boss encounter.

### Dungeon Connection Audit — CLEAN

- 0 broken exit links across 120 dungeons
- 0 unreachable dungeons (all connected)
- 0 dead-end dungeons (all have exits)
- 2 intentional one-way connections (fast-travel shortcuts, not soft locks)
- 15 gated exits, all with obtainable prerequisites
- No soft locks from flag/item dependencies
- All 41 items flagged by tileset-level audit confirmed to have valid spawn sources

## Quarantine Warlord Balance (2026-03-15)

Fixes applied:
- Reduced `quarantine_warlord` HP from 200 → 120 (67 hits → 40 hits with Standard Blaster)
- Added `precision_blaster` (weight 2) to `outpost_biome_uncommon` loot table so it can drop from the depth-2 treasure chest

Outcomes (approximate):
- With Standard Blaster (3 dmg): 40 hits to kill — hard but survivable
- With Precision Blaster (6 dmg, ~14% chance from depth-2 chest): 20 hits — clean fight

Outstanding:
- [ ] Consider a guaranteed weapon cache in depth-1 supply_alcove if playtests show players still feeling under-geared

## Placeholder Sprite Replacements (2026-03-15)

Generated 17 new placeholder sprites to resolve missing-file errors:
- Bio-lab enemies: `biolab_tendril`, `biolab_spitter`, `biolab_construct`, `biolab_guardian`, `biolab_alpha`
- Hybrid/Radiance: `hybrid_drone`, `hybrid_stalker`, `radiance_construct`, `nexus_guardian`, `solar_core_warden`
- Bosses/Named: `general_thorne` (wired, was using `bulwark_captain.png`)
- Underlumen replay variants: `underlumen_warden`, `underlumen_channeler`, `underlumen_sentinel`, `underlumen_shade` (wired, were using reused sprites)
- NPCs: `bulwark_patrol_meridian`, `greenway_npc` (Researcher Tova)
- Wired existing sprites: `corporal_venn.png`, `councillor_asha_denn.png` (files existed but NPCs had no `sprite` field)

Outstanding art tasks:
- [ ] All generated sprites need replacement with proper pixel art (see `PLACEHOLDER_ASSETS.md`)
- [ ] **Batch 1 commission ready** — `docs/art-commission-brief.md` covers 10 priority entities (14 files). Send to artist when ready. All sprites are 64x16 horizontal strips (4 frames: idle1, idle2, attack, hit).
- [ ] Once commissioned art is received, replace PNGs in `content/sprites/` — no engine changes needed
- [ ] Test commissioned sprites against dark tilesets (Dark Perimeter, Stone Crypt) for readability at 32x32 upscale
- [ ] `liaison_thorne` NPC (Array Liaison Thorne) still uses `npc_default.png` — create `liaison_thorne.png`
- [ ] `frostfang_alpha` monster still reuses `frostfang_hunter.png` — create `frostfang_alpha.png`
- [ ] `bulwark_soldier_doubter` (Private Yenn) has a sprite file but no `sprite` field in npcs.json — wire it

## Full Campaign Playtest Audit (2026-03-15)

### Fixes Applied This Session

1. **Fixed 3 broken item references in Spire Vigil**: `umbral_amplifier` → `umbral_amplifier_chip`, `resonance_detector` → `resonance_detector_chip`, `shadow_conduit` → `shadow_conduit_chip` in `spire_vigil_aerie.json`, `spire_vigil_archives.json`, `spire_vigil_fortress.json`.

2. **Improved headless sim** with tile interaction puzzle support:
   - New `interact_with_tile` goal type for junction/conduit puzzles
   - `findDoorThatSetsFlag` now handles `tileName` filters (not just tileX/tileY)
   - Recursive prerequisite chain resolution for multi-step puzzles (e.g., conduit A → conduit B → hatch)
   - Pathfinding fix: self-toggling tiles (`togglesTo === tileId`) treated as permanently solid
   - `doInteractWithTile` retries when item pickup steals the interaction
   - Door flag resolution tries tile interactions before falling back to NPCs

### CRITICAL — Lighthouse Mara Pacing (MOSTLY DONE)

Split into narrative segments with intermediate quest objectives, healing caches, waypoint, and ambient triggers.

- [x] **Split `restore_lighthouse_core` into 2-3 quest steps** — added "Reach the Deep Tower" (f10) and "Reach the Sub-Basement" (f15) in both lighthouse_mara.json and main_quest.json
- [x] **Add healing items to mid-tower floors** — added field_medkit + frost_salve + bandage caches to f05, f10, f15
- [x] **Add ambient narrative triggers** — f02 descent warning, f05 crystal/pulse, f07 Keeper Renn wall note, f10 waypoint camp, f12 cave-to-infrastructure transition, f15 survey camp, f17 final descent warning
- [x] **Add descent warning trigger on f02 entry** — warns about the long descent and encourages stocking up
- [x] **Add Keeper Mara presence** — Keeper Renn's handwriting on f07 wall, abandoned survey notes on f15
- [x] **Add mid-tower waypoint beacon** — waypoint_beacon on f10 near Dasha's camp, registered as "Mara Deep Tower" in settings.json
- [ ] **Lighthouse cold damage variety** — floors 2-10 still use identical cold hazard params. Consider varying damage/interval or adding brief warm zones on milestone floors
- [ ] **New Mara monster sprites** — permafrost_hulk, cave_borer_drone, and seismic_leech currently reuse existing sprites (glacial_maw, tunnel_creeper, rime_stalker). Need unique 16x16 sprites.
- [ ] **New frost_crypt tile sprites** — tiles 23-26 (ice_stalagmite, collapsed_rubble, frozen_pipe, seismic_crack) need unique 16x16 sprites in tilesets/frost_crypt.png
- [ ] **Place more decorative tiles on Mara floors** — new tileset tiles (23-26) are only placed on a few floors. Use the visual editor to add more ice_stalagmite, collapsed_rubble, frozen_pipe, and seismic_crack tiles across F02-F10 for richer visual variety

### HIGH — Balance Issues

- [ ] **Quarantine Warlord vs starting weapon**: Standard Blaster (3 dmg) vs 200 HP boss is a war of attrition. Ensure weapon upgrade drops in quarantine OR require weapon upgrade before warlord quest step.
- [ ] **Lighthouse cold damage resource drain**: 2-4 dmg/1.5-3s is tedious, not threatening. Floors 2-10 are visually and mechanically identical — needs variety.
- [ ] **relay_station Nest Mother**: 300 HP boss with stun + ground slam combo in a confined corridor. 4 Dusk Crawlers (speed 2.2) rush simultaneously. Consider reducing crawler count to 2 or increasing stun cooldown.

### HIGH — Quest Connectivity

- [ ] **`spire_vigil.json` format inconsistency**: Uses old array-based step format instead of object-based. May cause quest tracker parser issues. Convert to standard format.
- [x] **Greenway → Spire of Winds exit has no flag gate**: `greenway_supply_depot` exit to `spire_winds_approach` at (22,11) has no conditions. Player can skip supply sabotage quest. Add `{ "hasFlag": "supply_sabotage_complete" }`. — DONE
- [ ] **`spire_winds_cleared` flag never checked**: Player can skip Spire of Winds core and still progress to Act 3. Consider gating Dayside entry on this flag.

### MODERATE — Sim Improvements Needed

- [x] **Sim can't solve lighthouse_mara_core conduit puzzle reliably** — FIXED: added `tryInteractTile()` to game-loop.js for targeted tile interaction, bot now uses it in `doInteractWithTile`. Core hatch auto-opens via `conduits_reopen_hatch` trigger on room re-entry.
- [ ] **Sim can't kill shade_stalker_alpha in lighthouse_mara_core** — bot reaches boss area (hatch opens correctly) but dies repeatedly to boss (110 HP, 18 dmg, lunge+stun) + environmental cold damage (3 dmg/2.5s). 92 deaths in a single run. Consider: reducing boss HP, adding healing spawns near boss area, or improving bot combat AI for boss fights.
- [x] **Sim `into_the_expanse` stuck** — FIXED: A* upgraded to binary heap + octile heuristic (was O(n²) linear scan). Added doors to 48 enclosed rooms in outer_expanse. Bot now reaches map and pathfinds correctly; remaining stuck is combat-related (monster density blocks movement).
- [ ] **Sim `lighthouse_mara` side quest stuck** — A* failure from (21,12) in caverns room. Likely pathing issue near solid tiles.
- [ ] **Sim doesn't handle `showChoice` actions** — ending path choice (Asha's three-path choice in meridian_civic) requires player input the bot can't provide. Need bot choice-selection logic for quest resolution.

### MODERATE — Narrative Gaps

- [x] **No NPC guidance for 19-floor Mara descent** — FIXED: quest now has 4 steps with descriptions, f02 descent warning, f10/f15 milestone messages
- [x] **Lighthouse Mara floors 2-10 are functionally identical** — DONE: added 3 new monster types (permafrost_hulk, cave_borer_drone, seismic_leech), 4 new decorative tiles (ice_stalagmite, collapsed_rubble, frozen_pipe, seismic_crack), unique monster encounters per floor, and ambient geological instability triggers. Cold damage variety still needed.
- [x] **Missing waypoint in Lighthouse Mara** — FIXED: waypoint beacon added on f10 ("Mara Deep Tower")

### LOW — Orphaned Content

- [x] 54 orphaned flags wired to NPC reactions (2026-03-15): narrative flags → Warden Holt/Old Keeper/Asha/Solen/Sable/Sol Engineer dialogue; spire tier flags → Holt congratulations + title grants; visited_* flags → grouped milestone dialogue across 6 NPCs; misc flags → minor NPC reactions. Remaining: 1 engine flag (`expedition_party`) not appropriate for NPC dialogue.
- [ ] 2 intentional one-way exits (merge_nexus → array_deep_processing, underlumen_threshold → train_station) — document as intentional in dungeon comments.
- [x] Spire replay tier flags wired — `spire_*_hard_cleared` / `spire_*_legendary_cleared` now trigger Warden Holt congratulation dialogue with title grants (Vigil Breaker, Radiance Walker, Windwalker).

## MERIDIAN-7 Array Alliance — Act 2 Content (2026-03-15)

Wired Act 2 "Array Alliance" content for the Greenway/Spire of Winds assault. MERIDIAN-7 now offers tactical intel, Bulwark position data, and equipment upgrades when gated by `supply_sabotage_complete` + `spire_vigil_cleared`. Outstanding items:

- [x] **Quest log entry added**: `content/quests/greenway_assault.json` created with three steps (secure_alliance → receive_intel → choose_equipment), gated on `supply_sabotage_complete`. Players now get quest log entries and waypoints for the full alliance flow.
- **Spire of Winds door override integration**: The `array_door_override` key item is given to the player but no locked doors in `spire_winds_fortress.json` or `spire_winds_approach.json` currently check for it. Add `hasItem: "array_door_override"` conditions to Bulwark security door tiles.
- **Signal Tap combat effect**: The `array_signal_tap` sol component has stat bonuses but no runtime mechanic for enemy accuracy/reaction debuff. Would need engine support in `game-loop.js` for area debuff effects.
- **Greenway supply depot routing**: The final briefing tells player to approach through supply depot. Verify the exit chain `greenway_farmstead → greenway_supply_depot → spire_winds_approach` is navigable and the sim bot can path through it.
- **Bulwark soldier doubters**: Storyboard mentions conflicted Bulwark soldiers. The NPC `bulwark_soldier_doubter` exists but has no dialogue gated on `array_alliance_accepted`. Could add conditional dialogue where doubters help the player if alliance is active.

## Spire Puzzle Variety Follow-ups (2026-03-15)

Added beam reflection puzzle to Radiance Observatory and wind resonance sequence to Winds Antechamber. Outstanding items:

- **Manual playtesting needed**: The beam puzzle in the Observatory requires deploying a light sentry and positioning it so the beam bounces through 3 mirrors to hit the photosensor. Verify mirror angles (135°, 45°, 135°) produce a valid path from west→south→east→south.
- **Light sentry availability**: Added `light_sentry_chip` to Radiance Forge (depth 7, one floor before Observatory). Verify players can realistically acquire and equip it before reaching the Observatory at depth 8.
- **Winds Antechamber pedestal tiles**: Changed tiles at (3,3), (14,3), (3,14), (14,14) from `full_wall` (25) to `resonance_pedestal` (26). The old valve puzzle used `tileName: "energy_conduit"` filter but no such tile exists in the spire_winds tileset — the old puzzle may have been non-functional.
- **Spire of Vigil unchanged**: Vigil still uses the standard pedestal patterns (armory dual pedestal, resonance chamber sequential). Could add a third distinct mechanic here in a future pass.
- **Crucible puzzle unchanged**: The Radiance Crucible (depth 11) still uses a 3-pedestal activate-all pattern. Could convert to use beam mechanics for consistency with the Observatory.

## Remaining Unchecked Flags (2026-03-15) — RESOLVED

All 54 content-side orphaned flags have been wired to NPC reactions. Only `expedition_party` (engine-set) remains unchecked.

Flags wired by NPC:
- **Warden Holt**: underlumen_emergence_defeated, seen_mara_breach, seen_mara_fractures, found_raider_journal, found_raider_manifest, crypt_hint_from_scout, has_mara_power_cell, spire tier completions (6 flags), spire core reached (3 flags), spire vigil military visited (4 flags)
- **Old Keeper**: found_geometric_tablet, aerie_lore_found, resonance_complete, visited_frost_crypt, mara mid-floors (f06-f09), spire vigil explorer (aerie/watchtower/descent/core), archives_alcove_looted, fortress_pool_looted
- **Archivist Solen**: resonance_complete, found_geometric_tablet, has_spire_data, aerie_lore_found, spire vigil scholarly (archives/resonance/underlumen)
- **Councillor Asha**: underlumen_emergence_defeated, seen_mara_breach, has_spire_data, mara upper floors (f11-f14), spire_radiance_approach_visited
- **Sol Engineer**: has_mara_power_cell, seen_mara_fractures, seen_mara_breach, mara lower floors (f02-f05)
- **Sable (meridian)**: underlumen_emergence_defeated, seen_mara_breach, seen_mara_fractures, found_raider_journal, mara deep floors (f16-f19), ren_warned_creatures, deep_depot_looted

## Orphaned Room Integration Follow-ups (2026-03-15)

Wired 6 orphaned rooms into quest flow. Outstanding items:

- **void_frequency_log delivery**: The void_flats signal beacon gives a `void_frequency_log` item but there's no NPC turn-in trigger for it yet. Add a delivery trigger to Archivist Solen or Councillor Asha that grants XP and advances lore about structures beyond the mapped frontier.
- **perimeter_outer_ring side quest**: Room now has exploration XP and Sgt. Fenn breadcrumb, but could benefit from a formal 1-step side quest (e.g., "Survey the Outer Ring") triggered by the Warden or Fenn.
- **expedition_checkpoint bankLoot action**: The `bankLoot` action type may not be implemented in the engine yet. Verify `server/scripting/actions.js` handles it — if not, it's a no-op that needs engine work.
- **homestead_interior**: Now reachable via salvage_yard main quest step, but the umbral_seed growth mechanic depends on Sable (Nightside NPC). Verify Sable's quest chain properly provides the umbral_seed item.
- **warrens_contact quest breadcrumbs**: Asha's undercity hint fires on `arrived_meridian` + first interaction. Consider whether other NPCs (Calloway, market NPCs) should also hint at undercity activity.

## Act 2 Political Crisis — Meridian (2026-03-15)

Bulwark checkpoint atmosphere added to all three Meridian hubs after `spire_vigil_cleared`. Outstanding items:

- **Bulwark NPC sprites**: `bulwark_patrol_meridian` and `bulwark_checkpoint_civic` use default NPC sprites. Consider reusing `bulwark_soldier_doubter.png` (now exists) or adding dedicated sprites for these Meridian patrol types.
- **Greenway corridor_sign timing**: The `greenway_corridor_sign` trigger in `meridian_civic.json` fires on `arrived_meridian` (before Vigil is cleared), showing grey-uniform soldiers. This creates mild narrative overlap with the Act 2 escalation — consider gating it on `spire_vigil_cleared` instead, or differentiating the pre-crisis vs. post-crisis patrol presence more clearly.
- **Market merchant stock disruption**: Weaponsmith Garro has no post-vigil dialogue variant — he could note increased demand from Bulwark soldiers or supply chain disruption. Low priority.
- **Checkpoint blocking**: The Bulwark checkpoint officer in `meridian_civic` is narrative-only — players can still pass through the Greenway exit if they have the pass. Consider whether the spawned checkpoint officer should physically block the path (engine change needed) or remain dialogue-only.

## Spire Replay System (2026-03-15)

Spire replay with difficulty tiers implemented. Outstanding items:

- **Spire replay sprites**: underlumen_warden, underlumen_channeler, underlumen_sentinel, underlumen_shade, spire_resonance_boss still reuse existing sprites (crystal_guardian, threshold_watcher, abyssal_tendril). Need unique placeholder sprites in `sprites/`.
- **Spire replay room reset**: Rooms are currently cached once created — returning to an inner floor mid-replay reuses the same room instance. Rooms should reset between separate replay runs (clear killed monsters, reset items). May need a "leave spire" trigger that clears the replay tier flag.
- **Tier pedestal visual feedback**: The tier_pedestal tiles use a generic interactable appearance. Consider adding visual differentiation (e.g., different glow colors) for Normal/Hard/Legendary.
- **Replay XP scaling**: The xpMult from tier scaling affects monster XP but is not shown in UI. Consider a HUD indicator for active replay tier.
- **spire_winds_chest loot table**: Missing — the Spire of Winds core references `spire_winds_chest` as its first-clear loot table, but this table doesn't exist in any loot file. Add it to `content/loot/` (similar to `spire_vigil_chest` in frost.json).
- **Multiplayer replay coordination**: If multiple players enter the same inner floor with different tier flags, the first player's tier wins (room scaling is applied once). Consider per-party tier consensus or preventing mismatched tier entry.
- **Replay completion flag gating**: `spire_vigil_hard_cleared`, `spire_vigil_legendary_cleared` (and winds/radiance equivalents) are now set on chest interaction in each core. Wire these to NPC dialogue reactions (e.g., Archivist Solen, Councillor Asha) or cosmetic unlock triggers once those rewards are designed.

## Content — Greenway Zones & Bulwark Faction (2026-03-13)

Act 2 Greenway agricultural corridor and Bulwark military faction content added:

- **Greenway tileset** (`content/tilesets/greenway.json`) — 31 tiles: dirt paths, grass, crop rows, plowed fields, irrigation canals, hedge/stone/trellis walls, greenhouse, barricades, checkpoint gates, supply crates, elevated walkways, watchtower walls
- **Bulwark monsters** (7 types in `monsters.json`) — bulwark_conscript (melee), bulwark_rifleman (ranged), bulwark_sergeant (pack_leader w/ aura), bulwark_engineer (ranged, projectile burst), bulwark_shieldwall (guard, high HP), bulwark_captain (boss), bulwark_patrol_drone (patrol)
- **Greenway NPCs** (7 in `npcs.json`) — Checkpoint Officer Maren, Farmer Dael, Farmer Lissa, Merchant Orin, Councillor Asha Denn, Pvt. Yenn (doubting soldier), Elder Moss; all with conditional dialogue tied to quest flags
- **Items** (15 new in `items.json`) — bulwark_requisition_key, depot_access_key, greenway_pass, field_ration_greenway, bio_graft, compact_orders, bulwark_combat_rifle, bulwark_shock_baton, military_medkit, bulwark_dog_tags, greenway_seed_sample, confiscated_supplies, bulwark_patrol_log, bio_leech_node_chip, symbiotic_core_chip
- **Loot tables** (`content/loot/bulwark.json`) — bulwark_common, bulwark_sergeant, bulwark_captain, bulwark_drone
- **4 dungeons** — greenway_checkpoint (entry from Civic Center, pass required), greenway_farmstead (agricultural fields under patrol), greenway_supply_depot (combat-heavy, confiscated supplies), greenway_settlement (safe hub with Asha Denn + waypoint)
- **Quest: Greenway Liberation** — Talk to Dael → supply sabotage starts → find depot key (Lissa hint) → recover confiscated supplies → deliver to Asha Denn for XP + symbiotic_core_chip
- **Meridian connection** — Added exit from meridian_civic (23,11) to greenway_checkpoint; added greenway_pass grant trigger via Registrar Hollis; added greenway_settlement waypoint to settings.json

Remaining follow-ups:
- ~~**Spire of Winds dungeon chain**~~ — DONE: 5-floor dungeon chain added (spire_winds_approach, spire_winds_fortress, spire_winds_shaft, spire_winds_underlumen, spire_winds_core). Connected from greenway_supply_depot.
- ~~**General Thorne boss fight**~~ — DONE: bulwark_general_thorne boss monster (650 HP, 3-phase) placed in spire_winds_fortress.
- ~~**Hover ability unlock**~~ — DONE: hover_chip granted at spire_winds_core resonance pedestal with full narrative sequence.
- ~~**Bulwark sprites**~~ — DONE: All 7 Bulwark monster types have placeholder sprites (bulwark_conscript, bulwark_rifleman, bulwark_sergeant, bulwark_engineer, bulwark_shieldwall, bulwark_captain, bulwark_drone). Also added dural_voss.png (unique sprite for Dural Voss boss).
- ~~**Greenway NPC sprites**~~ — DONE: checkpoint_officer_maren, farmer_dael, farmer_lissa, greenway_merchant_orin, bulwark_soldier_doubter (Pvt. Yenn), greenway_elder_moss, corporal_venn all generated. Also old_keeper.png (Keeper Renn), wounded_unbounded_scout.png, ice_borer.png, glacial_maw.png, frost_revenant.png, underlumen_emergence.png added.
- **Councillor Asha Denn sprite** — Greenway settlement NPC uses npc_default. Needs a distinct sprite (diplomat/councillor look, not a farmer or soldier).
- **bulwark_patrol_meridian / bulwark_checkpoint_civic sprites** — These Meridian NPC types still use npc_default. They can reuse bulwark_soldier_doubter.png or get dedicated sprites.
- **Greenway tileset PNG** — `tilesets/greenway.png` sprite strip needed for the 31 tile definitions.
- **Meridian political crisis content** — Per storyboard, Meridian itself should transform with Bulwark checkpoints and political tension when Act 2 begins. Needs flag-gated atmosphere triggers in existing Meridian rooms.
- **MERIDIAN-7 / Array alliance content** — Per storyboard, the Array provides intelligence through MERIDIAN-7 during Act 2. Needs triggers/dialogue tying Array Hub to Greenway operations.
- ~~**Greenway bio-lab dungeon**~~ — DONE: 4-floor optional dungeon added (greenway_biolab_f01 through f04). Bio-themed enemies (Rogue Tendril, Sap Spitter, Bio-Construct, Feral Cultivar, Apex Overgrowth boss). Environmental storytelling via research terminals about Project Verdant. Sol component rewards: Photosynthesis Node (rare, greenway), Adaptive Tissue Graft (epic, greenway). Researcher Tova NPC on F01 with state-reactive dialogue. Accessible from greenway_settlement (stairs_down at east edge).
- **Bio-lab sprites needed** — biolab_tendril, biolab_spitter, biolab_construct, biolab_guardian, biolab_alpha, greenway_npc (for Researcher Tova) all need placeholder sprite PNGs.
- **Bio-lab tileset PNG needed** — `tilesets/biolab.png` sprite strip for the 21 tile definitions.
- **Elder Moss bio-lab dialogue** — Elder Moss already mentions bio-labs in dialogue. Could add a conditional dialogue variant when `biolab_alpha_defeated` is set, acknowledging the labs are safe again.
- **Bulwark encounter difficulty tuning** — Stats set at Act 2 level (HP 40-400, DMG 10-20). Needs playtesting to confirm balance vs. post-Act 1 player power.
- **Supply depot combat encounter balance** — 7 monsters in a single room may be overwhelming. Consider adjusting spawn positions or adding wave triggers.

## Content — Spire of Winds (2026-03-13)

Act 2 climax dungeon chain added — 5 floors from Bulwark fortress outer layer through vertical Underlumen core:

- **spire_winds tileset** (`content/tilesets/spire_winds.json`) — 31 tiles: fortress walls, metal walls, security/blast doors, wind chasms, wind bridges, ancient floors/walls, wind grates, elevated platforms, ramps (N/S/E/W), resonance pedestal, supply crates, control panels, barricades
- **spire_winds_approach** — Bulwark perimeter with outdoor fortifications, barricades, guardhouse. 8 monster spawns (conscripts, riflemen, drone, sergeant). Corporal Venn NPC (sympathetic Bulwark soldier with conditional dialogue). Connects from greenway_supply_depot.
- **spire_winds_fortress** — Interior military installation. 12 monster spawns including General Thorne boss. Security door (keycard), blast door (thorne defeated flag), supply crates. Command terminal with escalating excavation logs.
- **spire_winds_shaft** — Vertical transition zone. Wind chasms with stone bridges. Mixed enemy types (Bulwark stragglers + Nightside fauna). Environmental storytelling about abandoned excavation.
- **spire_winds_underlumen** — Elevation puzzle floor with multiple platform tiers connected by ramps, wind chasms between sections, wind bridges. Nightside fauna enemies.
- **spire_winds_core** — Resonance chamber (16x16). Pedestal interaction unlocks Hover ability (hover_chip) with full narrative sequence. Chest unlocks post-pedestal. Mirrors spire_vigil_core structure.
- **General Thorne** (`bulwark_general_thorne` in monsters.json) — 650 HP, 3-phase boss (melee → ranged energy bolts → summon conscripts). Drops thorne_command_tablet on death.
- **Corporal Venn** (`corporal_venn` in npcs.json) — Sympathetic Bulwark soldier, 5 dialogue lines explaining the excavation + Thorne's fear. Post-defeat dialogue variant.
- **New items** — spire_winds_keycard (fortress security doors), bulwark_command_key (restricted sections), thorne_command_tablet (quest item for Asha Denn)
- **Waypoint** — Added spire_winds_approach to settings.json waypoints

Remaining follow-ups:
- **Spire of Winds tileset PNG** — `tilesets/spire_winds.png` sprite strip needed for the 31 tile definitions
- **General Thorne sprite** — Currently uses `bulwark_captain.png`. Needs dedicated `sprites/bulwark_general_thorne.png`
- **Corporal Venn sprite** — Needs dedicated `sprites/corporal_venn.png` (conflicted young soldier)
- **Wind mechanics** — The shaft and underlumen floors narratively describe wind currents but there's no engine-level wind hazard/push mechanic. Consider adding `environmentalHazard: { type: "wind_push" }` or wind current tiles that move entities
- **Elevation puzzle depth** — The underlumen floor uses ramps and elevated platforms but the puzzles are navigational only. Consider adding pressure plates, timed bridges, or enemies on different elevations to add mechanical depth
- ~~**Hover ability integration**~~ — DONE: Added hover_unlocked-gated content to 3 Spire of Vigil floors plus a new hidden room. Watchtower: transit portal to new `spire_vigil_aerie` room (observation platform with umbral_amplifier + underlumen_etching + lore). Fortress: setTile opens path across central dark pools, spawns shadow_conduit. Archives: setTile opens pool alcove, spawns resonance_detector with lore about the anomalous signal. All three floors have teaser triggers for pre-hover players showing inaccessible content.
- ~~**Thorne command tablet turn-in**~~ — DONE: `asha_tablet_delivery` trigger added to meridian_civic.json (removes item, sets `thorne_tablet_delivered` + `compact_crimes_exposed`, grants 75 XP). `has_command_tablet` dialogue + dialogueRule added to `councillor_asha` in npcs.json. `act3_asha_alliance_trigger` now requires `thorne_tablet_delivered` to gate Act 3 access behind the delivery.
- ~~**Post-Spire narrative triggers**~~ — DONE: flag-gated `room_entered` and `npc_interacted` triggers added to meridian_station, meridian_archives, meridian_array_hub, and meridian_civic for both `spire_vigil_cleared` and `spire_winds_cleared`. Vigil: station atmosphere shift (raider-doubt rumor), Solen reveals pre-human Spire tech, MERIDIAN-7 acknowledges gap in Array data, Compact rep gives defensive response, civic advisory posted. Winds: MERIDIAN-7 goes intermittent (Deep Array interference, ancient frequency), station ads glitch + transit delays, Solen confronts Compact's concealment role, Compact rep's legitimacy openly challenged, Asha asks for direct Spire account.
- **Spire replay difficulty** — Both Spires should reconfigure for replay visits with harder enemies and better loot
- ~~**Main quest integration**~~ — DONE: main_quest steps 15-19 now route through Act 2 content (clear_spire_vigil → report_to_asha → enter_greenway → greenway_operations → assault_monument). Old dayside steps removed (dayside is Act 3 per storyboard)
- **Bulwark encounter balance** — General Thorne at 650 HP with 3 phases needs playtesting. Phase 3 summons conscripts which may overwhelm in tight spaces
- ~~**Act 3 main quest steps**~~ — DONE: 5 Act 3 steps added to main_quest.json (explore_dayside → discover_array_secret → build_alliance → forge_expedition → ending_choice). Gated behind assault_monument (general_thorne_defeated). Routes through dayside_solar_fields → array_deep_processing → meridian_civic (Asha authorization) → spire_radiance_approach → spire_radiance_core. Added `asha_authorizes_expedition` trigger in meridian_civic.json that sets `expedition_authorized` flag when player talks to Asha with `array_secret_discovered`.
- ~~**Dayside content still accessible**~~ — DONE: dayside_solar_fields and array_deep_processing now have main_quest steps directing players there
- **NPC dayside dialogue cleanup** — Sable, Hollis, and MERIDIAN-7 have dialogue states gated on `visited_dayside` flag. These still work but won't fire until a player visits the dayside independently. Verify no dialogue state is softlocked by the quest reordering
- **Asha spire briefing grants greenway_pass** — The new `asha_spire_briefing` trigger gives the player a `greenway_pass` item. Verify this integrates correctly with greenway_checkpoint's `greenway_pass_granted` gating

## Content — Spire Dungeon Scaling (2026-03-15)

All three Spire dungeons expanded from 5-6 floors to 12 floors each, adding combat, puzzle, lore, and pacing variety for multi-hour dungeon runs.

**Spire of Vigil (6 → 12 floors):**
- 6 new floors: watchtower (sniper nests), armory (pedestal puzzle), barracks (ambush encounters), archives (lore/exploration), descent (atmospheric transition), resonance_chamber (3-pedestal puzzle)
- Pacing: dense combat early (watchtower → barracks), boss fight mid (sanctum/Dural Voss), quiet exploration late (descent → puzzles → core)
- Total monster count: ~95 across 12 floors

**Spire of Winds (5 → 12 floors):**
- 7 new floors: guardpost (Bulwark checkpoint), laboratory (wind research), excavation (transition zone), gallery (wind murals/lore), bridge (void bridges combat), depths (dense fauna), antechamber (valve puzzle)
- Pacing: military opposition early, fauna encounters mid, puzzles late
- Total monster count: ~103 across 12 floors

**Spire of Radiance (5 → 12 floors):**
- 7 new floors: perimeter (Array defenses), processing (data halls), cooling (failing systems), forge (ancient lore), observatory (lens puzzle), threshold (combat gauntlet), crucible (focusing puzzle)
- Pacing: Array military early, escalating heat hazard throughout, lore/puzzle mid, gauntlet + puzzle late
- Total monster count: ~96 across 12 floors

Remaining follow-ups:
- **New floor sprites** — All 20 new floors use existing tileset tiles. No new tileset tiles were added, but layouts should be visually verified in-game.
- **Puzzle mechanic variety** — New puzzle floors use pedestal/valve activation patterns. Consider adding timed sequences, beam reflection, or environmental manipulation puzzles for more variety.
- **Room-entry dialogue suppression** — All 20 new floors have room_entered + showMessage triggers that fire during combat. Apply the noHostilesInRoom + room_cleared pattern from station_junction.
- **Monster type variety for new floors** — Some new floors reuse the same enemy compositions. Consider adding 2-3 new monster types per Spire for mid-dungeon encounters.
- **Loot table balance** — New floors use existing loot tables. Item economy across 12 floors (health potions, frost salves, medkits) needs playtesting.
- **Quest step updates** — The spire_vigil quest (7 steps) was designed for 6 floors. May need additional steps for the expanded chain. Similar for any Winds/Radiance quest chains.
- **Depth display** — Verify client shows floor depth correctly for 12-floor dungeons.
- **Garrison battle plans lore update** — The garrison_battle_plans item says "The Spire has five levels." Should be updated to reflect the expanded 12-floor layout.

## Content — Nightside Lore Item Reactions (2026-03-15)

Connected scattered Nightside lore items to Sable and Old Keeper:

- **Sable (`sable_nightside_guide`)** — Added `hasItem` dialogue rules for `ancestors_listening_stone`, `unbounded_trail_tablet`, `living_crystal_shard`, and `crypt_geometric_tablet`. Each triggers multi-line dialogue where Sable explains the Unbounded significance of the item and connects it to the Underlumen narrative.
- **Old Keeper** — Added `hasItem: frozen_expedition_log` dialogue rule. He recognizes Survey Corps Team Echo as an expedition he personally sent 30 years ago, confirming the Underlumen's heartbeat pulse was known and suppressed by the Corps.

Note: The task referred to `found_geometric_tablet` by name, but that is a flag (set when `crypt_geometric_tablet` is picked up). The Sable rule uses `hasItem: "crypt_geometric_tablet"` to check for the actual item in inventory.

Remaining follow-ups:
- **Geometric tablet connection to Old Keeper** — The `has_geometric_tablet` Sable dialogue mentions the Old Keeper as the origin of the tablet. Adding a corresponding `hasItem: crypt_geometric_tablet` rule to Old Keeper himself (perhaps after he's already given the etching quest) would strengthen the thread.
- **Expedition log follow-up quest** — Old Keeper's reaction to the frozen_expedition_log is emotionally significant but has no quest attached. A potential follow-up: deliver the log to the Corps historian in Meridian or Archivist Solen to trigger a suppressed-records quest.
- **Listening stone elder dialogue** — The `ancestors_listening_stone` dialogue hints at an archaic name carved on the stone. A corresponding dialogue line from Elder Vael (if the player shows it to them) would close the loop.

## Checkpoint Tool — Autosave History

- **MAX_HISTORY constant** — Currently hardcoded to 5 in `server/session-store.js`. Could be exposed as an env var.
- **In-game autosave indicator** — Consider sending a message to the client when an autosave fires.
- **Autosave on checkpoint room entry** — Trigger an extra autosave when a player reaches a checkpoint room.

## Content — Lighthouse Siege Arena (2026-03-13)

Wired lighthouse_siege_arena — was invisible behind `expedition_tier_4_cleared`. Now unlocks on `perimeter_breach_cleared`.

Changes made:
- **`perimeter_breach.json`** — Added `monster_killed`→`gloom_wraith` trigger that sets `perimeter_breach_cleared` flag and displays a room-cleared message
- **`challenges/lighthouse_siege.json`** — `unlockCondition` changed from `expedition_tier_4_cleared` → `perimeter_breach_cleared`
- **`meridian_station.json`** — Siege Warden Kael's `siege_warden_launch` and `siege_warden_locked` triggers updated to use `perimeter_breach_cleared`; locked message now directs player to clear the breach
- **`entities/npcs.json`** — Warden Holt gains `breach_cleared` dialogue state (mentions Siege Warden Kael + siege arena) and matching dialogueRule that fires post-breach pre-Meridian

Remaining follow-ups:
- **Siege arena monster spawns** — `lighthouse_siege_arena.json` has no monster spawns defined at the dungeon level; wave monsters are spawned by the challenge system (engine). Verify wave spawn positions work with the arena layout.
- **Siege arena solo blocker** — `minPlayers: 2` means solo players can never start the siege. Consider adding an NPC hint about this requirement.
- **Breach clear as a quest step** — perimeter_breach is visited during early exploration but has no quest formally directing players there. The `gloom_wraith` kill flag ties it in organically, but a quest step would make it explicit.

## Content — Lighthouse Mara Main Quest Integration (2026-03-15)

Wired Lighthouse Mara into the main quest flow. The transit pass is already gated behind `mara_core_cleared` in `train_station.json`; the main quest steps now formally route players through the 20-floor dungeon chain.

**Changes made:**
- `main_quest.json` — 3 new steps inserted between `clear_junction_box` and `get_transit_pass`: `yara_lighthouse_briefing` (talk to Yara after junction clear → `yara_lighthouse_briefed`), `enter_lighthouse_mara` (descend to caverns → `visited_mara_caverns`), `restore_lighthouse_core` (clear core → `lighthouse_mara_restored`). `get_transit_pass` prerequisite updated from `clear_junction_box` → `restore_lighthouse_core`.
- `train_station.json` — `yara_mara_not_cleared` trigger now sets `yara_lighthouse_briefed` flag and has `once: true`. Completes the briefing quest step when Yara explains the power grid situation.

**Player flow:** clear_junction → talk to Yara (briefed) → enter lighthouse caverns → restore core + defeat boss → return to Yara (transit pass) → board train.

Remaining follow-ups:
- **`lighthouse_mara` side quest alignment** — `lighthouse_mara.json` side quest (4 steps: descend_caverns → find_keeper → reach_core → restore_power) runs in parallel with the new main quest steps. Verify no step conflicts or double-completion edge cases.
- ~~**Post-restoration NPC reactions**~~ — DONE: Warden Holt, Sgt. Ellers, Tech Maren now react to `lighthouse_mara_restored`. See Lighthouse Mara section for follow-ups.

## Content — Lighthouse Mara (expanded 2026-03-15)

**20-floor dungeon chain built** — Full expedition from relay_station through frozen caverns, fracture zone, frozen depths, sub-basement infrastructure, breach zone, and lighthouse core. Chain: lighthouse_mara_caverns → f02-f19 → lighthouse_mara_core.

**5 zones, progressive difficulty:**
- Zone 1 (F1-F5): Upper Frozen Caverns — frostfang packs, dusk crawlers, tunnel creepers. Natural ice cave layouts.
- Zone 2 (F6-F9): The Fracture — geometric crack patterns appear, shade stalkers, gloom wraiths. Underlumen clue escalation.
- Zone 3 (F10-F13): Frozen Depths — ice_borer swarms (new), glacial_maw (new), frozen lake, fauna nest. Deepening cold.
- Zone 4 (F14-F17): Sub-Basement — infrastructure transition (metal floors), frost wardens, frost revenants (new). Machinery interaction triggers with crew logs.
- Zone 5 (F18-F19): The Breach — geometric Underlumen architecture, underlumen_emergence boss (new, 500 HP 3-phase). Climactic revelation about what broke the lighthouse.
- Zone 6 (F20): Lighthouse Core — existing restoration sequence with conduit puzzle.

**5 new monster types added:**
- `ice_borer` (35 HP, pack, lunge — deep cave swarmer)
- `ice_borer_queen` (70 HP, pack_leader with aura)
- `glacial_maw` (180 HP, ground_slam + stun — large predator)
- `frost_revenant` (120 HP, ranged_kite, frost_bolt projectile — spectral)
- `underlumen_emergence` (500 HP, 3-phase boss — melee/ranged/melee, ground_slam + stun + projectile_burst)

**7 new frost_crypt tileset tiles:** geometric_fracture, broken_machinery, frozen_pillar, ice_rubble, metal_floor, damaged_panel

**Environmental storytelling arc:** Survey team logs (4.7s pulse), crew evacuation records, Chief Engineer Patel's annotations, seismograph data, breach point discovery. Builds to revelation: Underlumen emergence broke the lighthouse from below, connected to planetary Spire network.

Remaining follow-ups:
- **Lighthouse Mara sprites** — New tiles (power_conduit_a/b, core_hatch, survey_marker, cracked_ice_wall, geometric_fracture, broken_machinery, frozen_pillar, ice_rubble, metal_floor, damaged_panel) in frost_crypt tileset need dedicated sprite art in the tileset PNG strip.
- **New monster sprites** — ice_borer, glacial_maw, frost_revenant, underlumen_emergence all need dedicated sprites (currently placeholder paths).
- **Keeper Renn sprite** — Currently uses `old_keeper` sprite. Needs a dedicated `sprites/keeper_renn.png` (frost-worn technician).
- ~~**Post-restoration NPC reactions**~~ — DONE: Warden Holt, Sgt. Ellers, and Tech Maren now have `lighthouse_mara_restored` dialogue sets and matching dialogueRules. Seismic survey turn-in wired to Warden Holt via `seismic_survey_turnin` trigger in `outpost_entrance.json` (removeItem + setFlag + 40 XP). See follow-ups below.
- **Relay recovery quest chain** — The existing `relay_recovery` quest ends at the nest_mother. Consider linking it to the new `lighthouse_mara` quest or adding a bridge step.
- ~~**Seismic survey data delivery**~~ — DONE: `seismic_survey_data` turn-in wired to Warden Holt. Trigger removes item, sets `seismic_survey_delivered`, grants 40 XP. Holt has `has_seismic_survey` and `seismic_survey_delivered` dialogue states. An alternative Meridian geologist turn-in (MERIDIAN-7 or a new NPC) would be a stronger narrative fit per the original quest hint ("might interest someone at the Deep Array") — see follow-ups.
- **Seismic survey Meridian route** — The lighthouse_mara quest completion message says the data "might interest someone at the Deep Array." A geologist NPC in meridian_civic or an MERIDIAN-7 dialogue branch would be more narratively consistent. The Warden Holt route is functional but is the simpler path.
- **Tech Maren restoration dialogue gating** — Tech Maren's `lighthouse_mara_restored` dialogueRule fires before `give_battery`, so after Mara is restored she always shows the restoration reaction rather than offering batteries. Fix: add an `npc_interacted` trigger in `outpost_charging_station.json` that sets `mara_restored_acknowledged_maren` flag on first talk with Maren post-restoration, then add `not: mara_restored_acknowledged_maren` to her restoration dialogueRule. Dialogue would then revert to battery service after first acknowledgment.
- **Lighthouse Mara siege variant** — The existing `lighthouse_siege_arena` challenge could be narratively connected to Lighthouse Mara post-restoration (defend the restored lighthouse).
- **Environmental hazard tuning** — Cold damage escalates from 2/3s (upper caves) through 3/2.5s (mid) to 4/2s (breach) and 3/2.5s (core). Needs playtesting — may be too punishing without frost_salve stockpile across 20 floors.
- **Frost salve economy (follow-up)** — Supply depot added at F10 (Dasha, `cache_runner_mara`). Sells frost_salve (8 cr), bandage (5 cr), field_medkit (35 cr). Fixed supply cache (3 items) placed near her shelter. Follow-up: consider a second resupply point near F16 for the final push to the core once F15 maintenance corridor playtesting confirms demand.
- **Boss arena design (F19)** — The underlumen_emergence boss fight on floor 19 has 4 pillars and side alcoves. Needs playtesting for kiting paths and phase transitions.
- **Floor layout variety** — Generated layouts are functional but could benefit from hand-tuning for visual distinctiveness. Floors 14-17 (sub-basement) use metal floor tiles for infrastructure feel.
- **Quest integration** — The `lighthouse_mara` quest (4 steps) may need updating to reflect the expanded 20-floor expedition. Current steps may complete too early.

## Content — Nightside Scouting & Spire of Vigil (expanded 2026-03-15)

Act 1 climax content expanded — 3 new dungeons, 1 new quest, Act 2 gating, waypoints.

**New dungeons added:**
- **nightside_outpost** — Abandoned raider forward camp between nightside_depths and spire_vigil_approach. Mixed fauna + raider stragglers. Wounded Unbounded scout NPC (Kael) with heal interaction. Supply manifest and camp journal lore items. Side exit to nightside_frost_crypt.
- **nightside_frost_crypt** — Optional side dungeon from outpost. Ancient geometric architecture foreshadowing the Underlumen. Crystal guardian encounters, light pedestal puzzle (same mechanic as Spire underlumen), geometric tablet lore item (Underlumen network map). Dead-end dungeon with rare loot rewards.
- **spire_vigil_garrison** — New floor between spire_vigil_approach and spire_vigil_fortress. Raider garrison with luddite_warlord mini-boss gating the inner fortress exit. Battle plans lore item revealing Spire layout. Heavy combat (12 monster spawns).

**New quest:**
- **spire_vigil** (`content/quests/spire_vigil.json`) — 7-step main quest: find_outpost → reach_spire → breach_garrison → breach_fortress → confront_voss → explore_underlumen → reach_core. Tracks the full Spire of Vigil arc.

**Routing changes:**
- nightside_depths (15,14) exit now routes to nightside_outpost (was spire_vigil_approach)
- spire_vigil_approach back exit (1,1) now routes to nightside_outpost (was nightside_depths)
- spire_vigil_approach forward exit (19,17) now routes to spire_vigil_garrison (was spire_vigil_fortress)
- spire_vigil_fortress back exit (1,1) now routes to spire_vigil_garrison (was spire_vigil_approach)

**Act 2 gating:**
- meridian_civic → greenway_checkpoint exit now requires `spire_vigil_cleared` flag. Fail message: "The Greenway checkpoint is on high alert — the Bulwark has locked down passage until the Nightside threat is resolved."

**New entities:**
- 4 new key items: raider_supply_manifest, raider_camp_journal, crypt_geometric_tablet, garrison_battle_plans
- 1 new NPC: wounded_unbounded_scout (Kael) with default + after_heal dialogue states

**Waypoints added:** nightside_caverns, spire_vigil_approach

**Full dungeon chain (17 rooms):** nightside_caverns → nightside_depths → nightside_outpost → (side: nightside_frost_crypt) → spire_vigil_approach → spire_vigil_watchtower → spire_vigil_garrison → spire_vigil_armory → spire_vigil_barracks → spire_vigil_fortress → spire_vigil_archives → spire_vigil_sanctum → spire_vigil_descent → spire_vigil_underlumen → spire_vigil_resonance_chamber → spire_vigil_core

Remaining follow-ups:
- ~~**Spire of Vigil outer floors**~~ — DONE
- ~~**Spire of Vigil inner puzzle floors**~~ — DONE
- ~~**Nightside scouting intermediate content**~~ — DONE
- ~~**Act 2 gating behind Spire completion**~~ — DONE
- ~~**Spire of Vigil waypoint**~~ — DONE
- **Spire replayability / difficulty tiers** — Inner puzzle floors should reconfigure on replay visits. Implement Normal/Hard/Legendary difficulty scaling with better modifier drops at higher tiers.
- **Dural Voss sprite** — Currently uses `luddite_warlord.png`. Needs a dedicated `sprites/dural_voss.png` (armored raider warlord, distinct silhouette).
- **New raider sprites** — luddite_crossbowman uses luddite_scrapper sprite, luddite_shieldbearer uses luddite_brawler sprite, luddite_captain uses luddite_warlord sprite. All need dedicated sprites.
- **Wounded scout sprite** — wounded_unbounded_scout (Kael) needs dedicated sprite.
- **Voss retreat VFX** — Client-side visual for the `boss_retreat` event (flash, smoke, dramatic exit animation).
- **Post-Voss quest integration** — The `spire_vigil_data_core` item needs a turn-in step at Warden Holt / Councillor Asha Denn. Connect to main_quest progression.
- **Raider guard dialogue NPCs** — Add NPC raider sentries in approach/fortress floors with conditional dialogue (threats before captain killed, fear/retreat after).
- **Underlumen puzzle variety** — Current puzzles are activate-all-pedestals. Consider adding timed sequences, mirror/beam-reflection puzzles, and enemy wave defense puzzles for replay variants.
- [x] **Frost crypt connection to Sable** — `found_geometric_tablet` wired to Old Keeper + Archivist Solen; `visited_frost_crypt` wired to Old Keeper. Sable already has `has_geometric_tablet` dialogue in nightside_guide variant.
- **Garrison warlord vs. existing warlord** — spire_vigil_garrison uses `luddite_warlord` monster type. Verify HP/damage are appropriate for a mid-Spire mini-boss (currently same as the general luddite_warlord used elsewhere).
- **Room-entry dialogue suppression** — nightside_outpost, nightside_frost_crypt, and spire_vigil_garrison all have room_entered + showMessage + monsterSpawns. Need `noHostilesInRoom` condition + `room_cleared` paired triggers (see Room-Entry Dialogue Suppression section).

## Content — Orphaned Rooms (2026-03-13)

Added 4 new quests + dungeon triggers to connect orphaned rooms:
- **`healers_errand`** — Dr. Vasik's moss quest leads players to crypt_01 + crypt_02 (startConditions: `vasik_asked_for_moss`)
- **`watchtower_journal`** — Dead Road watchtower breadcrumb; tracks full chain: scope → journal → Old Keeper (startConditions: `visited_dead_road`)
- **`into_the_expanse`** — Outer Expanse + Void Flats exploration quest (startConditions: `outer_expanse_entered`)
- **`sol_unit_training`** — Formalizes demo room visits (elevation_demo, light_sentry_demo, pulse_cannon_demo); starts on `received_sol_unit`

Remaining orphaned rooms still to connect:
- **`void_flats`** — Currently an endpoint of `into_the_expanse` but has no interior content beyond entry. Needs monsters, loot, and an onward lead.
- **`merge_nexus`** — Accessed from underlumen_threshold. Has `visited_merge_nexus` flag but no quest references it.
- **`homestead_interior`** — Accessed from salvage_yard. Umbral Seed mechanic exists but no quest targets it.
- **`dayside_solar_fields` / `dayside_raid_defense`** — Dayside content exists but is no longer part of the main quest (moved to Act 3). Needs Act 3 quest steps to formally direct players there.
- **`perimeter_outer_ring`** — Reachable from perimeter_gate and relay_station but no quest targets it directly.
- **`salvage_yard`** — Has homestead exit and lore but no quest requires visiting.
- **`expedition_checkpoint`** — Unknown connection; verify in sim.
- **`meridian_undercity_deep`** — Pathfinder Ren NPC may need a quest step.
- **`array_*` rooms** — array_access quest connects some; verify all 5 array rooms are reachable in all-quests mode.

## Content — NPC Engagement (2026-03-13)

Pass completed adding cross-NPC references and quest breadcrumbs to 10 NPCs:

- **`charging_guard_pell`** — Now reacts to quest state; directs player to Daley (comms) and Brannigan (kitchen mystery)
- **`munitions_pvt_korrin`** — Now references Quartermaster's supply manifest quest and directs pre-departure player to Sgt. Fenn
- **`mess_pvt_osei`** — Default dialogue now directs player to Pvt. Tannis; new post-perimeter state; has_sol_unit hints at Brannigan mystery
- **`mess_surveyor_kade`** — Now mentions Sgt. Fenn, Old Keeper, and Daley; new post-perimeter state cross-referencing Daley's signals
- **`gate_sgt_fenn`** — New pre-departure hints (Vasik, Daley, Yara); returned state directs to Warden + Daley; comms_restored state highlights Daley's new signals
- **`perimeter_lookout`** — Now mentions Sable by name; new sable_hint state with Old Keeper/Underlumen breadcrumb; visited state directs to Daley
- **`sable_companion`** — Now reacts to underlumen_etching (directs to Archivist Solen), watchtower journal, and crypt visits
- **`fence_elara`** — Now mentions Quartermaster's manifest; reacts to manifest_found and basement quest completion; admits to helping the shelter-seeker
- **`pathfinder_ren`** — Now directs player to Old Keeper (knows_sable path) and Councillor Asha (has_etching path); reacts to underlumen_etching
- **`keeper_mara`** (Keeper Renn) — After restoration now explicitly names Old Keeper as shared history, directs to Warden Holt and Daley
- **`jorrit`** — References Vell's lost cat; reacts to Archives visit with Solen/Asha cross-references
- **`vell`** — Default now names Archivist Solen; new frontier_visitor state referencing Daley; post-quest state references Jorrit
- **`station_master_calloway`** — Default now names Councillor Asha, Crafter Yun, and Archivist Solen; returning state specifically prompts visiting Asha

Remaining NPC engagement gaps:
- **Post-`lighthouse_mara_restored` reactions** — Warden Holt, Sgt. Ellers, Tech Maren still have no `lighthouse_mara_restored` dialogue states (see Lighthouse Mara section above)
- **`mess_cook_brannigan` default** — Already mentions workshop; consider adding Tannis reference to her default state
- **Hub-to-hub breadcrumbs** — Meridian Market NPCs (merchant_reva, weaponsmith_garro) don't yet reference Council or Archives district
- **`seismic_survey_data` turn-in** — Item found in Lighthouse Mara caverns has no receiving NPC; add to Warden Holt, Daley, or a Meridian NPC
- **`waypoint_beacon` dead end** — Waypoint beacon in train_station_junction could point players to Yara; currently just a fast-travel node

## Content — Nightside Descent Storytelling (2026-03-13)

Environmental storytelling pass across the 4-room nightside chain:

- **`nightside_caverns`** — Added `caverns_ambient_entry` (atmospheric room entry), `frozen_expedition_log` item spawn at (14,8), `caverns_expedition_log_found` pickup trigger with Survey Corps Team Echo's final notes (0.4s crystal pulse, day 21, no further entries)
- **`nightside_depths`** — Added `depths_warmth_anomaly` trigger (temperature inversion — warmer with depth, conduit system), `living_crystal_shard` item spawn at (4,15), `depths_living_crystal_found` pickup trigger ("planet-blood," matches wall rhythm)
- **`nightside_passage`** — Added `unbounded_trail_tablet` item spawn at (11,12), `passage_trail_tablet_found` pickup trigger (Unbounded script: "listen," "third descent, approach in quiet" — they've been going below for generations)
- **`underlumen_threshold`** — Added `threshold_deep_exploration` trigger (fires on return visit — crystal patterns ordered, computational, language-like), `ancestors_listening_stone` item spawn at (17,16), `threshold_listening_stone_found` pickup trigger (Sable's ancestor left this behind: "She listened first. She heard the answer.")
- **`items.json`** — Added 4 new lore items: `frozen_expedition_log`, `living_crystal_shard`, `unbounded_trail_tablet`, `ancestors_listening_stone`

Remaining follow-ups:
- **Sable dialogue for new items** — Add `hasItem` dialogue rules to `sable_companion` / `sable_nightside_guide` / `sable_threshold` for `living_crystal_shard`, `unbounded_trail_tablet`, and `ancestors_listening_stone` so Sable reacts when the player finds these
- **Survey team follow-up** — `frozen_expedition_log` mentions Survey Corps Team Echo, Year 441 (R. Delani, Corporal Fen). Consider adding a quest breadcrumb — Archivist Solen or Warden Holt could react to this log
- **Old Keeper connection** — The expedition log (walls that hum, rhythm from below) connects directly to the Old Keeper's "cryptic ramblings." Add `hasItem: frozen_expedition_log` dialogue rule to `old_keeper` NPC
- **Threshold deep exploration timing** — `threshold_deep_exploration` fires when `reached_underlumen_threshold` is set on re-entry. Verify this feels correctly timed in practice (should fire after player pushes deeper into the chamber, not at the entrance)

## Content — Nightside Path Discovery

- **`visited_dead_road` flag** — The hint triggers don't suppress once the player has already been to the Dead Road. Add `setFlag: visited_dead_road` in dead_road.json.
- **Wren Alcott NPC dialogue rules** — `wren_nightside_hint` is a dungeon trigger; migrate to npcs.json dialogueRules for consistency.

## Content — Undercity / dark_city Tileset

- **Deep Warrens sprite** — Pathfinder Ren NPC needs a dedicated sprite (`sprites/pathfinder_ren.png`).
- **Deep Warrens discovery trigger** — Add flavor message in `meridian_undercity` near the stairs_down at (14,0).
- **Undercity discovery trigger in meridian_market** — Add first-discovery message for stairs_down at (14, 9).

## Room-Entry Dialogue Suppression During Combat (2026-03-15)

Fixed station_junction: room-entry dialogue now deferred until combat clears using `noHostilesInRoom` condition + `room_cleared` event.

**Engine additions:**
- `room_cleared` event — fires for all players when last monster in a room dies
- `noHostilesInRoom` condition — checks `room.monsters.size === 0`

**All 36 Spire floors + 8 other dungeons fixed (2026-03-15):**
- All Spire of Vigil floors (12): vigil_approach, vigil_garrison, vigil_barracks, vigil_fortress, vigil_watchtower, vigil_archives, vigil_armory, vigil_resonance_chamber, vigil_underlumen, vigil_descent, vigil_sanctum, vigil_core
- All Spire of Winds floors (12): winds_approach, winds_guardpost, winds_fortress, winds_bridge, winds_antechamber, winds_shaft, winds_gallery, winds_laboratory, winds_underlumen, winds_depths, winds_excavation, winds_core
- All Spire of Radiance floors (12): radiance_approach, radiance_perimeter, radiance_conduit, radiance_cooling, radiance_forge, radiance_processing, radiance_crucible, radiance_threshold, radiance_nexus, radiance_observatory, radiance_sanctum, radiance_core
- `greenway_supply_depot`, `greenway_farmstead`, `greenway_checkpoint`
- `underlumen_threshold`, `nightside_passage`, `nightside_outpost`, `nightside_frost_crypt`
- `array_deep_processing`

55 spire triggers + 17 non-spire triggers patched. Each modified room_entered trigger gained `noHostilesInRoom: true` + a paired `*_cleared` trigger for players who entered during combat.

## Testing

- **All-quests mode: 19/20 quests fail** — main_quest TIMEOUT (gets to relay_station but can't complete Lighthouse Mara restoration within 40min budget). All side quests with startConditions cascade-fail because main_quest preamble can't progress past relay_station (no transit pass → no meridian access). tannis_tags is the only COMPLETE.
- **Underlumen threshold routing FIXED (2026-03-15)** — Removed `nightside_expedition_started` prerequisite from `threshold_reached_flag` and `threshold_reached_flag_cleared` triggers. Any player entering underlumen_threshold now gets `reached_underlumen_threshold`, unlocking the transit_portal exit to train_station. Previously blocked main_quest + nightside_expedition return path.
- **Quarantine warlord key drop FIXED (2026-03-15)** — Changed `spawnItem` to `giveItem` for supply_crate_key in proc_quarantine warlord_killed trigger. Bot was killing the warlord, key spawned on ground, bot died to remaining monsters, room destroyed, key lost. Now key goes directly to inventory on kill.
- **Sim depth recovery limit raised (2026-03-15)** — Increased from 5 to 12 attempts. Combined with giveItem fix, bot now consistently gets past quarantine.
- **Remaining sim bottleneck: Lighthouse Mara** — Bot gets through quarantine + perimeter + train station but stalls at relay_station. The 20-floor Lighthouse Mara dungeon (clear → get transit_pass → board train) is too long for the 40min per-quest budget. Options: increase MAX_GAME_SECONDS, add sim fast-travel through cleared waypoints, or reduce Lighthouse Mara floor count for sim.
- **Side quest root cause summary** — lost_tool/the_deserter/phase3_investigation all timeout because the main_quest preamble (1200s cap) can't reach meridian. Bot stalls at Lighthouse Mara restoration. Content is correct — these are sim navigation performance issues, not content routing bugs.
- **Explore mode** — Flag-gated at 7/57 rooms (12.3%). Blocked by `engineer_briefing_complete` on outpost_workshop door. Grant story flags in explore mode for content validation.
- **Item discovery rate** — Only 5/52 items collected in mainline (9/52 in all-quests). Partially addressed 2026-03-13: added bandage near outpost_munitions entrance, bandage+ration_pack in station_junction, bandage in outpost_training_range; added pickup hints for medical_supplies, bandage, umbracite (Meridian-7 trade hint), single_use_battery_chip, basic_generator_chip; rechargeable_battery_chip now given on training completion. Many ground items (perimeter zones, dead_road, outer_ring) still only encountered if player explores off-path.
- **NPC engagement** — Only 20/60 NPCs talked to in mainline (29/60 in all-quests). Many NPCs have no quest reason to visit. Cross-NPC references and quest breadcrumbs added 2026-03-13 (see NPC Engagement section below). Re-run sim to measure improvement.
- **Death target tuning (2-4 deaths)** — Second tuning pass (2026-03-13): raised damage 25-50% on 15 mid-game monsters (luddite_brawler 12→16, scrapper 14→18, shade_stalker 14→18, gloom_wraith 12→16, dusk_crawler 7→10, rime_stalker 16→20, frostfang_hunter 11→15, etc.), added luddite_crossbowman to quarantine pool, raised quarantine budget (base 5→7, perDepth 3→4, maxPerRoom 3→4), removed bandage from perimeter_breach, downgraded field_medkit→bandage in nightside_caverns, raised cold hazard 3→4, halved medical_supplies in both quarantine templates. Sol Shield also nerfed (3.5→1.25 HP/s, heal:15/CD:12s). **Needs manual playtest** to confirm 2-4 deaths — sim bot can't reach target zones due to quest progression bugs, and bot doesn't use Sol abilities optimally.
- ~~**Quarantine sim loop (CRITICAL — blocks mainline)**~~ — PARTIALLY FIXED (2026-03-15): Changed warlord key drop from `spawnItem` to `giveItem`, raised depth recovery limit from 5→12→13. **Still failing as of 2026-03-15 evening**: bot cycles quarantine depth 1-3 13 times then gives up with "wait_for_item supply_crate_key exceeded 13 depth recovery attempts." Sim shows 14 deaths, 19 kills, 6/119 rooms, 0/82 items. The giveItem fix may not be firing — investigate warlord kill trigger conditions or whether bot is dying before the warlord dies.
- **junction_cleared trigger fixed (2026-03-13)** — `junction_cleared` flag was only settable via door interaction at (7,7), which the bot never triggers. Fixed by adding `npc_interacted` trigger on `waypoint_beacon` that sets `junction_cleared` when `yara_junction_quest` is active. The door trigger still works as an alternative path for human players who explore the room.
- **receive_medipac deprecated condition format** — `outpost_entrance.json` trigger `receive_medipac` uses `{ "type": "not", "condition": ... }` format that conditions.js no longer parses. The trigger works correctly because `once: true` prevents re-firing, but the condition always returns `true`. Fix: update to `{ "not": { "hasFlag": "received_medipac" } }` format.

## Waypoint / Fast Travel System

- **Waypoint beacon sprite** — `waypoint_beacon` NPC uses default sprite. Needs a dedicated `sprites/waypoint_beacon.png` (glowing transit pillar or similar).
- **Additional waypoint locations** — Currently 6 waypoints (Outpost Balor, Meridian Station, Station Junction, Perimeter Gate, Lighthouse Mara, Frost Crypts). Consider adding: Salvage Yard, Dead Road, Signal Cave, Deep Perimeter as player progresses.
- **Waypoint discovery feedback** — Consider a brief visual/audio effect on first waypoint activation (particle burst, sound cue).
- **Sim integration** — Teach the sim bot to use waypoint beacons for fast travel instead of walking through every room.
- **Expedition fast travel block** — Fast travel is blocked during expeditions. Consider also blocking during siege challenges.

## Endgame Loop

- **Client-side expedition HUD** — Floor counter, boss health bar during expeditions.
- **Expedition party silicon cost splitting** — Currently only the initiator pays.
- **Party formation UI** — Currently all players in the room join automatically; consider invite/accept flow.
- **Shared XP/loot distribution** — Currently individual per-player.
- **Light Sentry placement in siege** — Special sentry placement UI for inter-wave phase.
- **Faction Rally** — Server-wide flag aggregation for cooperative monthly event.
- **Raid defense death handling** — If player dies in raid defense, consider partial damage penalty.
- **Raid difficulty curve tuning** — 5 base monsters + 2 per level may need playtesting.

## Sessions & Persistence

- Handle name collisions more gracefully (warn on duplicate character names).
- Consider SQLite backend for deployed environments.

## Inventory

- If sol_components ever have meaningfully different stats within the same type, give them distinct `type` values to prevent incorrect stacking.

## Stats Panel

- Show sol grid modifier totals (damage boost %, cooldown reduction %, energy efficiency) once server computes aggregated modifier effects.

## Weapon Upgrade System

- **More crafting material tiers** — Add epic/legendary tier materials for endgame weapon progression.
- **Weapon upgrade persistence edge cases** — Test save/load with upgraded weapons, swaps, death scenarios.
- **Weapon upgrade visual feedback** — Show bonuses in EQUIP tab and STATS panel.
- **Ground-spawned crafting materials** — Add static spawns in dungeon rooms.

## Sol Grid & Progression

- Light Sentry enhancements: multiple sentries, light/mirror puzzles, range indicator, upgrade paths.
- Playtest battery balance: early game should feel tight but fair; late game should shift constraint to cooldowns.

## Map Streaming

- Editor reload paths still send full map data (no fog of war chunking).
- Consider reducing chunk reveal radius for bigger maps.

## Art & Sprites

- New tileset strip for dark_city template (PNG exists but no dungeon JSON uses it yet).
- Late-game automation structure sprites (advanced_refinery, deep_extractor, reinforced_turret, quantum_harvester, matter_compiler) all use `scrap_drone` visual — need dedicated sprites.

## Combat & AI

- Tune special attack cooldowns and damage multipliers after playtesting.
- Automation controller support for grid (d-pad navigation, A to place, B to cancel).
- **Spawn spacing audit** — MONSTER_MIN_SPAWN_SPACING (2 tiles) now enforced in engine. Review authored dungeon spawns where multiple monsters share the same (x,y) with count>1 — spacing may push some into walls or off-map in tight rooms. Particularly check spire_winds_fortress (12 spawns) and greenway_supply_depot (7 spawns).

## Death Penalty — Modifier Durability

- **Weapon upgrade degradation on death** — User wants weapon upgrades to also degrade on death (similar to modifier durability). Needs design: what degrades, how much, what happens at 0.
- **Modifier durability tuning** — Default is 3. May need per-rarity defaults (e.g., legendary = 5, common = 2). Can be set via `defaultDurability` in sol_components.json.
- **Salvage economy** — Destroyed modifiers give 1x salvage. Consider scaling salvage by rarity (e.g., epic → 3 salvage).
- **Durability repair mechanic** — Currently no way to restore durability. Consider NPC repair service or crafting recipe.
- **Death penalty balance** — No items drop on death anymore. Verify this feels fair in early game (modifiers are scarce) and late game (modifiers are plentiful).

## Balance

- Crystal Guardian at 700 HP — verify feels epic, not grindy.
- Rechargeable Battery L1 (30 energy) may need bump to 40.
- Automation milestone reward thresholds may need tuning.

## Quest Item Pickup Hints

- **Equipment items (sol units, bioframes)** — Add brief equip instructions for players unfamiliar with the Sol Grid.
- **Lore items with no NPC connection** — Add `hasItem` dialogue rules for lore items that have pickup hints pointing to specific NPCs.
- **Perimeter/Dead Road items** — bandage, ration_pack, salvage, field_medkit in outpost_perimeter / perimeter_outer_ring / perimeter_breach / dead_road have no pickup hints. Add item_picked_up triggers in those dungeons.
- **Sol component discovery** — Most sol chips found in the world (efficiency_core_chip, area_expander_chip, etc.) lack pickup hints explaining what they do. Consider a generic sol_component_hint trigger.

## Quest Graph

- Map markers for Nightside Caverns entrance.
- Ensure sol grid tutorial flow accommodates umbracite trade giving sol_shield_chip.

## Harvester Scaling (Levels 11-20)

- **Dayside map expansion** — The 20×20 grid config may overlap walls in dayside_solar_fields. Verify layout.
- **Loot table integration** — New milestone items only obtainable via automation. Consider adding to late-game loot tables.
- **Raid scaling** — Level 20 raids would have 29 monsters (580 damage). Verify balance against reinforced_turret (+100 defense).
- **Client automation UI** — Verify structure list and grid render correctly at 20×20 grid size.
- **Late-game structure sprites** — All new structures use `scrap_drone` visual. Need dedicated sprites.

## Warlord Anti-Kite & Garrison Differentiation (2026-03-15)

- **`thrown_projectile` special attack** — New engine attack type added to `_trySpecialAttack()`. Fires a projectile from melee mobs when player is outside melee range. Uses existing projectile infrastructure. Consider adding a client-side visual indicator (e.g., distinct projectile sprite) for thrown weapons vs ranged mob shots.
- **`spire_garrison_warlord` sprite** — Currently shares `sprites/luddite_warlord.png`. Could use a unique sprite to visually distinguish the mid-Spire variant.
- **Balance tuning** — Luddite Warlord now has aggressive anti-kite (3.5s lunge CD, range 7, thrown projectile). May need tuning after playtesting. Garrison variant (280 HP, 16 dmg) is scaled for mid-Spire; verify feels appropriately challenging relative to surrounding encounters.

## Wind Push Mechanic — Spire of Winds (2026-03-15)

Wind currents added to 5 Spire of Winds floors (shaft, gallery, bridge, depths, underlumen). Outstanding items:

- **Client-side wind visual** — Wind zones have no visual indicator on the client. Consider adding directional particle effects (drifting motes) in wind current zones so players can see wind direction before entering. Could use the dungeon's `windCurrents` data sent with room state.
- **Wind force tuning** — Forces range from 2–3 tiles/sec. Playtest to verify these feel challenging but fair, especially on narrow bridge tiles near chasms. The bridge map has the strongest winds (force 3) which may need reduction.
- **Wind anchor sprite** — `wind_anchor` item needs a dedicated sprite (`sprites/wind_anchor.png`). Currently uses default item visual.
- **Additional wind anchor placement** — Currently placed in excavation (depth 5) and gallery (depth 7). Consider adding to a shop or NPC trade in the fortress floors for players who miss them.
- **Wind + combat interactions** — Wind pushes entities during combat, which could push players into chasms or separate groups. This is intentional but may need tuning if too punishing in multiplayer.
- **Projectile wind deflection** — Wind currents don't affect projectiles. Could add this as a future enhancement for deeper mechanical identity.

## Sol Shield Nerf — Combat Balance (2026-03-15)

Sol Shield nerfed from heal:35/CD:10s (3.5 HP/s) → heal:15/CD:12s (1.25 HP/s base rate).

**Manual playtest required** to verify 2-4 deaths in a mainline playthrough:

- **Death risk verification** — Sim bot shows 13-14 deaths (bot doesn't use sol abilities optimally), but a skilled human player should see 2-4 deaths. Needs manual verification on a fresh playthrough.
- **CDR interaction** — With heavy cooldown reduction stacking (~44%), effective rate rises to ~2.2 HP/s. If this still trivializes combat, consider reducing heal further to 12 or adding a minimum cooldown floor on sol_shield specifically.
- **Feel check** — At 15 HP per use (15% of max health), the ability should feel meaningful but not game-breaking. Verify it doesn't feel useless compared to medipac (90 HP heal).

## Sprite Art Commission — Priority Batch (2026-03-15)

Created art commission brief (`docs/art-commission-brief.md`) and improved placeholders for the 10 most-seen entities. Added 3 previously missing NPC sprites (outpost_warden, meridian_7, sol_engineer_1). Outstanding items:

- **Commission artist** — Find pixel artist for 13 sprite files (4 player variants + 5 NPCs + 4 monsters). Brief is in `docs/art-commission-brief.md` with full specs, palette, and character descriptions.
- **Custom animation frames** — Current 4-frame strips are auto-generated from base frame (shift offsets). Hand-drawn attack/hit frames would be a major visual upgrade. Discuss with artist whether to include custom animation in scope.
- **Remaining NPC sprites** — Many NPCs beyond the priority 10 still use `npc_default.png` fallback. Next batch should cover: old_keeper, farmer_dael, farmer_lissa, archivist_solen, fence_elara.
- **Remaining monster sprites** — All monster sprites are placeholders. After the priority batch, next priorities: luddite_warlord, gloom_wraith, magma_brute, array_overseer (boss-tier enemies seen in later acts).
- **Tileset art** — All tilesets are also placeholders. Consider commissioning tileset art alongside entity sprites for visual consistency.

## Mara Core Boss Tuning — Sim Death Loop Fix (2026-03-23)

Rebalanced lighthouse_mara_core to fix sim bot death loop (78 deaths to shade_stalker_alpha + cold stacking). Changes: boss HP 80→65, dmg 14→12, lunge CD 5→7s, stun duration 0.8→0.5s, cold interval 3.5→5.0s, removed 1 gloom_wraith, added field_medkit at boss corridor entrance.

- **Re-run sim** — Verify bot can now clear mara_core with <10 deaths and reach rooms beyond Act 1 (target: >60% reachability, up from 38%).
- **Manual playtest** — Confirm the boss fight still feels threatening. The lunge+stun combo is the signature mechanic; reduced cooldown/duration should preserve the danger without being a death sentence.
- **Consider cold resistance item** — If cold damage is still a problem in extended fights, a cold-resist consumable or equipment drop on an earlier Mara floor could help. The nightcaster_frame sol unit already grants cold resist but may not be available at this progression point.
