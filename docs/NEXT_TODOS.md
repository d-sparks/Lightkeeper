# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOs.md tasks.

Last cleaned: 2026-03-12 evening (fresh sim — mainline PASSES consistently: 26 min, 112 kills, 0 deaths, 28/57 rooms, 5/52 items, 20/60 NPCs; all-quests: 8/14 pass, 6 fail — main_quest STUCK at underlumen_threshold→meridian_civic nav, broken_signal/lost_tool/the_deserter/phase3_investigation TIMEOUT; relay_recovery FIXED; explore mode broken at 7/57 rooms, blocked by engineer_briefing_complete flag).

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
- **Bulwark sprites** — All 7 Bulwark monster types need dedicated sprites (currently using default/placeholder).
- **Greenway NPC sprites** — Checkpoint Officer Maren, Farmer Dael, Farmer Lissa, Merchant Orin, Councillor Asha Denn, Pvt. Yenn, Elder Moss all need sprites.
- **Greenway tileset PNG** — `tilesets/greenway.png` sprite strip needed for the 31 tile definitions.
- **Meridian political crisis content** — Per storyboard, Meridian itself should transform with Bulwark checkpoints and political tension when Act 2 begins. Needs flag-gated atmosphere triggers in existing Meridian rooms.
- **MERIDIAN-7 / Array alliance content** — Per storyboard, the Array provides intelligence through MERIDIAN-7 during Act 2. Needs triggers/dialogue tying Array Hub to Greenway operations.
- **Greenway bio-lab dungeon** — The Greenway's bio-tech labs are referenced in dialogue but have no dungeon. Could be an optional area with sol component rewards.
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
- **Hover ability integration** — After unlocking Hover, players should be able to revisit Spire of Vigil to access previously unreachable paths (per storyboard). Needs new exits/areas in vigil floors gated by `hover_unlocked` flag
- **Thorne command tablet turn-in** — thorne_command_tablet has no receiving NPC. Add `hasItem: thorne_command_tablet` dialogue rule to Councillor Asha Denn
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
- **Frost salve economy** — 20 floors of cold damage requires significant healing. Verify frost_salve drop rates from frost_biome loot tables are sufficient. Consider adding a mid-dungeon NPC vendor or supply cache.
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
- **Frost crypt connection to Sable** — Add dialogue rules to sable_nightside_guide/sable_companion reacting to `found_geometric_tablet` and `visited_frost_crypt` flags.
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
- **Death target tuning (2-4 deaths)** — Second tuning pass (2026-03-13): raised damage 25-50% on 15 mid-game monsters (luddite_brawler 12→16, scrapper 14→18, shade_stalker 14→18, gloom_wraith 12→16, dusk_crawler 7→10, rime_stalker 16→20, frostfang_hunter 11→15, etc.), added luddite_crossbowman to quarantine pool, raised quarantine budget (base 5→7, perDepth 3→4, maxPerRoom 3→4), removed bandage from perimeter_breach, downgraded field_medkit→bandage in nightside_caverns, raised cold hazard 3→4, halved medical_supplies in both quarantine templates. Sim damage taken jumped 1,840→5,205 but bot still shows 0 deaths (Sol Shield heals 3.5 HP/s passively). **Needs manual playtest** to confirm 2-4 deaths — sim bot can't reach target zones due to quest progression bugs.
- ~~**Quarantine sim loop (CRITICAL — blocks mainline)**~~ — FIXED (2026-03-15): Changed warlord key drop from `spawnItem` to `giveItem` (key goes directly to inventory on kill, survives death). Raised depth recovery limit from 5→12 attempts. Bot now consistently clears quarantine and reaches perimeter/station content.
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
