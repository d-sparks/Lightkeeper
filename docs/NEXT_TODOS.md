# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOs.md tasks.

Last cleaned: 2026-03-12 evening (fresh sim — mainline PASSES consistently: 26 min, 112 kills, 0 deaths, 28/57 rooms, 5/52 items, 20/60 NPCs; all-quests: 8/14 pass, 6 fail — main_quest STUCK at underlumen_threshold→meridian_civic nav, broken_signal/lost_tool/the_deserter/phase3_investigation TIMEOUT; relay_recovery FIXED; explore mode broken at 7/57 rooms, blocked by engineer_briefing_complete flag).

## Checkpoint Tool — Autosave History

- **MAX_HISTORY constant** — Currently hardcoded to 5 in `server/session-store.js`. Could be exposed as an env var.
- **In-game autosave indicator** — Consider sending a message to the client when an autosave fires.
- **Autosave on checkpoint room entry** — Trigger an extra autosave when a player reaches a checkpoint room.

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
- **Zero deaths** — 0 deaths across all sim modes despite death penalty being fully implemented. Damage ratio ~12% (1,185 taken vs 9,525 dealt).

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
