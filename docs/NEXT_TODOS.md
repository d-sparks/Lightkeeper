# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOs.md tasks.

Last cleaned: 2026-03-12 evening (fresh sim — mainline PASSES consistently: 26 min, 112 kills, 0 deaths, 28/57 rooms, 5/52 items, 20/60 NPCs; all-quests: 8/14 pass, 6 fail — main_quest STUCK at underlumen_threshold→meridian_civic nav, broken_signal/lost_tool/the_deserter/phase3_investigation TIMEOUT; relay_recovery FIXED; explore mode broken at 7/57 rooms, blocked by engineer_briefing_complete flag).

## Checkpoint Tool — Autosave History

- **MAX_HISTORY constant** — Currently hardcoded to 5 in `server/session-store.js`. Could be exposed as an env var.
- **In-game autosave indicator** — Consider sending a message to the client when an autosave fires.
- **Autosave on checkpoint room entry** — Trigger an extra autosave when a player reaches a checkpoint room.

## Content — Lighthouse Mara

- **Lighthouse Mara sprites** — New tiles (power_conduit_a/b, core_hatch, survey_marker, cracked_ice_wall) in frost_crypt tileset need dedicated sprite art in the tileset PNG strip.
- **Keeper Renn sprite** — Currently uses `old_keeper` sprite. Needs a dedicated `sprites/keeper_renn.png` (frost-worn technician).
- **Post-restoration NPC reactions** — NPCs at Outpost Balor (Warden Holt, Sgt. Ellers, Tech Maren) should have dialogue updates when `lighthouse_mara_restored` flag is set.
- **Relay recovery quest chain** — The existing `relay_recovery` quest ends at the nest_mother. Consider linking it to the new `lighthouse_mara` quest or adding a bridge step.
- **Seismic survey data delivery** — The seismic_survey_data item has no turn-in NPC yet. Should go to someone at the Deep Array or Meridian (MERIDIAN-7 or a geologist NPC).
- **Lighthouse Mara siege variant** — The existing `lighthouse_siege_arena` challenge could be narratively connected to Lighthouse Mara post-restoration (defend the restored lighthouse).
- **Environmental hazard tuning** — Cold damage in caverns (2/3s) and core (3/2.5s) needs playtesting. May be too punishing for early Act 1 without frost_salve stockpile.

## Content — Dural Voss / Spire of Vigil

- ~~**Spire of Vigil outer floors**~~ — DONE: spire_vigil_approach (outer defenses) and spire_vigil_fortress (raider stronghold with captain mini-boss) added.
- ~~**Spire of Vigil inner puzzle floors**~~ — DONE: spire_vigil_underlumen (light pedestal puzzles) and spire_vigil_core (resonance chamber, Light Sentry unlock) added.
- **Spire replayability / difficulty tiers** — Inner puzzle floors should reconfigure on replay visits. Implement Normal/Hard/Legendary difficulty scaling with better modifier drops at higher tiers.
- **Dural Voss sprite** — Currently uses `luddite_warlord.png`. Needs a dedicated `sprites/dural_voss.png` (armored raider warlord, distinct silhouette).
- **New raider sprites** — luddite_crossbowman uses luddite_scrapper sprite, luddite_shieldbearer uses luddite_brawler sprite, luddite_captain uses luddite_warlord sprite. All need dedicated sprites.
- **Voss retreat VFX** — Client-side visual for the `boss_retreat` event (flash, smoke, dramatic exit animation).
- **Post-Voss quest integration** — The `spire_vigil_data_core` item needs a turn-in step at Warden Holt / Councillor Asha Denn. Connect to main_quest progression.
- **Raider guard dialogue NPCs** — Add NPC raider sentries in approach/fortress floors with conditional dialogue (threats before captain killed, fear/retreat after).
- **Nightside depths exit hint** — Add a trigger in nightside_depths near the stairs_down (15,14) hinting at the Spire.
- **Underlumen puzzle variety** — Current puzzles are activate-all-pedestals. Consider adding timed sequences, mirror/beam-reflection puzzles, and enemy wave defense puzzles for replay variants.
- **Spire of Vigil waypoint** — Consider adding a waypoint beacon in spire_vigil_approach for fast travel after first clear.

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
- **`dayside_solar_fields` / `dayside_raid_defense`** — Dayside content exists but may not be reachable without a formal quest directing players there.
- **`perimeter_outer_ring`** — Reachable from perimeter_gate and relay_station but no quest targets it directly.
- **`salvage_yard`** — Has homestead exit and lore but no quest requires visiting.
- **`expedition_checkpoint`** — Unknown connection; verify in sim.
- **`meridian_undercity_deep`** — Pathfinder Ren NPC may need a quest step.
- **`array_*` rooms** — array_access quest connects some; verify all 5 array rooms are reachable in all-quests mode.

## Content — Nightside Path Discovery

- **`visited_dead_road` flag** — The hint triggers don't suppress once the player has already been to the Dead Road. Add `setFlag: visited_dead_road` in dead_road.json.
- **Wren Alcott NPC dialogue rules** — `wren_nightside_hint` is a dungeon trigger; migrate to npcs.json dialogueRules for consistency.

## Content — Undercity / dark_city Tileset

- **Deep Warrens sprite** — Pathfinder Ren NPC needs a dedicated sprite (`sprites/pathfinder_ren.png`).
- **Deep Warrens discovery trigger** — Add flavor message in `meridian_undercity` near the stairs_down at (14,0).
- **Undercity discovery trigger in meridian_market** — Add first-discovery message for stairs_down at (14, 9).

## Testing

- **All-quests mode: 5/14 quests fail** — See TODOs.md #1 for full breakdown. Key bugs: underlumen_threshold→meridian_civic has no fast travel (blocks main_quest + nightside_expedition), lost_tool/the_deserter/phase3_investigation all timeout. relay_recovery and broken_signal now pass (relay: junction boxes moved; broken_signal: Daley radios coordinates on Meridian arrival).
- **Explore mode** — Flag-gated at 7/57 rooms (12.3%). Blocked by `engineer_briefing_complete` on outpost_workshop door. Grant story flags in explore mode for content validation.
- **Item discovery rate** — Only 5/52 items collected in mainline (9/52 in all-quests). Partially addressed 2026-03-13: added bandage near outpost_munitions entrance, bandage+ration_pack in station_junction, bandage in outpost_training_range; added pickup hints for medical_supplies, bandage, umbracite (Meridian-7 trade hint), single_use_battery_chip, basic_generator_chip; rechargeable_battery_chip now given on training completion. Many ground items (perimeter zones, dead_road, outer_ring) still only encountered if player explores off-path.
- **NPC engagement** — Only 20/60 NPCs talked to in mainline (29/60 in all-quests). Many NPCs have no quest reason to visit.
- **Death target tuning (2-4 deaths)** — Second tuning pass (2026-03-13): raised damage 25-50% on 15 mid-game monsters (luddite_brawler 12→16, scrapper 14→18, shade_stalker 14→18, gloom_wraith 12→16, dusk_crawler 7→10, rime_stalker 16→20, frostfang_hunter 11→15, etc.), added luddite_crossbowman to quarantine pool, raised quarantine budget (base 5→7, perDepth 3→4, maxPerRoom 3→4), removed bandage from perimeter_breach, downgraded field_medkit→bandage in nightside_caverns, raised cold hazard 3→4, halved medical_supplies in both quarantine templates. Sim damage taken jumped 1,840→5,205 but bot still shows 0 deaths (Sol Shield heals 3.5 HP/s passively). **Needs manual playtest** to confirm 2-4 deaths — sim bot can't reach target zones due to quest progression bugs.
- **Quarantine sim loop (CRITICAL — blocks mainline)** — Bot stuck cycling quarantine depth 1-3 indefinitely. Root cause: `traverse_procedural` goal requires `supply_crate_key` item but bot exits quarantine before reaching depth 3 where warlord spawns. Goal stays active, bot re-enters from outpost_workshop. Fix: either improve depth targeting in `doTraverseProcedural()`, or add retry limit/goal failure handling. This is a sim bug, not a content bug — the game itself plays fine manually.
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
- **Health potion hint** — health_potion has no pickup hint. Add one to outpost_munitions (where it can be obtained via Voss side quest) or in loot tables.

## Quest Graph

- Map markers for Nightside Caverns entrance.
- Ensure sol grid tutorial flow accommodates umbracite trade giving sol_shield_chip.

## Harvester Scaling (Levels 11-20)

- **Dayside map expansion** — The 20×20 grid config may overlap walls in dayside_solar_fields. Verify layout.
- **Loot table integration** — New milestone items only obtainable via automation. Consider adding to late-game loot tables.
- **Raid scaling** — Level 20 raids would have 29 monsters (580 damage). Verify balance against reinforced_turret (+100 defense).
- **Client automation UI** — Verify structure list and grid render correctly at 20×20 grid size.
- **Late-game structure sprites** — All new structures use `scrap_drone` visual. Need dedicated sprites.
