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

- **Spire of Vigil outer floors** — Currently only the sanctum (boss room) exists. The full Spire needs 2-3 outer raider stronghold floors (Phase 1 per storyboard) before the boss encounter.
- **Spire of Vigil inner puzzle floors** — Ancient core puzzle rooms that teach/unlock the Light Sentry ability (Phase 2 per storyboard). Replayable with difficulty tiers.
- **Dural Voss sprite** — Currently uses `luddite_warlord.png`. Needs a dedicated `sprites/dural_voss.png` (armored raider warlord, distinct silhouette).
- **Voss retreat VFX** — Client-side visual for the `boss_retreat` event (flash, smoke, dramatic exit animation).
- **Post-Voss quest integration** — The `spire_vigil_data_core` item needs a turn-in step at Warden Holt / Councillor Asha Denn. Connect to main_quest progression.
- **Raider guard dialogue** — Add NPC raider sentries in outer floors with conditional dialogue (threats, then fear when Spire awakens).
- **Nightside depths exit hint** — Add a trigger in nightside_depths near the new stairs_down (15,14) hinting at the Spire.

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
- **Item discovery rate** — Only 5/52 items collected in mainline (9/52 in all-quests). Most ground items are off the main path or lack visibility.
- **NPC engagement** — Only 20/60 NPCs talked to in mainline (29/60 in all-quests). Many NPCs have no quest reason to visit.
- **Death target tuning (2-4 deaths)** — Buffed mainline monster damage, added shade_stalkers to station_junction, increased quarantine density, reduced healing availability. Sim cannot validate due to quarantine loop bug. Needs manual playtest to confirm 2-4 deaths target.
- **Quarantine sim loop (CRITICAL — blocks mainline)** — Bot stuck cycling quarantine depth 1-3 indefinitely. Root cause: `traverse_procedural` goal requires `supply_crate_key` item but bot exits quarantine before reaching depth 3 where warlord spawns. Goal stays active, bot re-enters from outpost_workshop. Fix: either improve depth targeting in `doTraverseProcedural()`, or add retry limit/goal failure handling. This is a sim bug, not a content bug — the game itself plays fine manually.

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

## Quest Graph

- Map markers for Nightside Caverns entrance.
- Ensure sol grid tutorial flow accommodates umbracite trade giving sol_shield_chip.

## Harvester Scaling (Levels 11-20)

- **Dayside map expansion** — The 20×20 grid config may overlap walls in dayside_solar_fields. Verify layout.
- **Loot table integration** — New milestone items only obtainable via automation. Consider adding to late-game loot tables.
- **Raid scaling** — Level 20 raids would have 29 monsters (580 damage). Verify balance against reinforced_turret (+100 defense).
- **Client automation UI** — Verify structure list and grid render correctly at 20×20 grid size.
- **Late-game structure sprites** — All new structures use `scrap_drone` visual. Need dedicated sprites.
