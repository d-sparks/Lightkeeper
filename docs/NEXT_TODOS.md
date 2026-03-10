# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOS.md tasks.

## Testing

- **Headless sim stuck at discover_array_secret** — bot can't navigate to `array_deep_processing` room. Gets stuck in `dayside_solar_fields`. Next CI mainline blocker.
- Content validator: expedition flag errors now resolved — expedition_active, expedition_tier_N_cleared flags are set/cleared by engine code in game-loop.js completeExpedition().
- Run content validator grep for remaining orphaned flags (setFlag without matching hasFlag consumers).

## Endgame Loop (see docs/endgame-loop.md)

### Phase 2 — Expedition Tiers 1-3 (Remaining)
- ~~Multi-floor expedition progression~~ ✓ Implemented — floor exits chain with scaling, boss from bossPool on final floor.
- ~~Expedition completion detection~~ ✓ Implemented — sets expedition_tier_N_cleared on boss kill, clears expedition_active.
- ~~Boss spawning on final floor from bossPool~~ ✓ Implemented — generator overrides boss type from expedition config.
- Silicon cost deduction at expedition start.
- Mid-run loot banking checkpoints.
- Death penalty (forfeit floor loot, return to meridian_station) — partial: death clears expedition state but doesn't have special loot forfeit logic yet.
- Expedition boss loot table selection (expedition_tier_N_boss table should be rolled on boss kill).

### Phase 3 — Modifier Crafting
- Add `craft` action type to `server/scripting/actions.js`.
- Create `content/entities/crafting.json` with reforge/fuse/attune recipes.
- Add MERIDIAN-7 crafting dialogue branch gated on `endgame_active`.

### Phase 4 — Automation Levels 6-10
- New structures (silicon_refinery, auto_turret, fabricator, expedition_beacon).
- Milestone rewards for levels 6-10.
- Structure adjacency bonus calculation.
- Ending-path-specific structure variants.

### Phase 5 — Boss Affixes + Tiers 4-5
- Boss affix data format and pool in `content/expeditions/affixes.json`.
- Apply affix buffs to boss entities at spawn.
- Tier 4-5 configs requiring multiple players.
- Wire path-specific boss loot table selection (check `chose_path_*` flag for Tier 3+ bosses).
- Wire `unlockFlag` checking in loot resolver for legendary drops.

### Phase 6 — Cooperative Challenges
- Wave defense system, player-count gating, challenge configs.
- Cooperative-only legendary modifier pool.

### Phase 7 — Raids + Faction Rally
- Timed raid events, structure HP/repair, server-wide flag aggregation.

## Content Gaps

- Place feral_hound_alpha and frostfang_alpha as rare spawns in nightside_caverns and frost proc templates.
- Place skeleton_archer in crypt_01/crypt_02 and add loot table.
- Add explicit patrolPath waypoints to patrol spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02.
- Phase 3 investigation quest after Autotroph confrontation (mechanical meaningfulness beyond dialogue).
- Post-ending Sable dialogue for Shutdown/Merge paths (expedition quest-giver).
- Post-ending atmospheric changes for outpost_entrance and outpost_comms.

## Sessions & Persistence

- Periodic auto-save during play (currently only saves on disconnect).
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
- Throttle `getOverlayedMapData` call frequency (currently every tick per player).

## Art & Sprites

- Replace all placeholder sprites with proper pixel art per art-style-guide.md (long-term).
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
