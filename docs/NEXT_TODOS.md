# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOS.md tasks.

## Game Feel

- Add placeholder sound effects for core actions: weapon attack, ability fire, monster hit, monster death, item pickup, door open, level transition. Audio system and per-biome music are wired — needs sound effect content in client/audio.js.
- Combat juice pass: screen shake on player hit, monster death fade-out animation, ambush monster fade-in reveal, projectile tinting by monster type (fire=orange, ice=blue, acid=green).
- Death penalty: when the player dies, drain energy, drop a random non-quest item, respawn at room entrance. See architecture-plan.md for dropBehavior rules.

## Content Completion

- Sol unit acquisition paths: 4 non-starter sol units (nightcaster_frame, array_precision_core, greenway_bioframe, underlumen_nexus) are defined but unobtainable. Wire as chest drops, NPC rewards, or quest completions in thematic locations.
- Wire generators into loot/rewards: basic_generator and improved_generator items exist in items.json but aren't obtainable via any loot table or quest reward.
- Loot tables for Act III monsters: threshold_watcher, abyssal_tendril, threshold_keeper have no loot tables. Create nightside/underlumen loot tables with thematic drops.
- Three ending path dungeons: array_control_center (shutdown), underlumen_nexus_chamber (merge), array_command_core (control). Each needs a final boss encounter and resolution triggers.
- Post-choice NPC dialogue: Asha, Sable, and MERIDIAN-7 dialogue variants reacting to the player's chosen ending path (chose_path_shutdown/merge/control flags).

## Combat & AI Polish

- Monster projectiles (from ranged_kite) use generic blue color — tint by monster type or add distinct sprite.
- Add explicit patrolPath waypoints to remaining dungeon spawns that use patrol AI (nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02) — currently auto-generate default paths.
- Pack AI could be extended with a "pack leader" variant that buffs nearby pack members.

## Balance Pass Follow-ups

- Headless sim bot can't navigate past early rooms (gets stuck at NPC interactions, only visits ~4/43 rooms) — needs bot pathfinding/AI improvements before sim-based balance testing is useful.
- Verify basic_generator and improved_generator items are obtainable via loot tables or quest rewards.
- Playtest energy pacing at mid-game (improved_generator @ 5/s) to confirm Sol Beam spam isn't trivial with energy cost reduction modifiers stacked.
- Crystal Guardian at 700 HP — verify this feels appropriately epic in manual play, not grindy.
- Consider adding a "basic_battery" sol component (uncommon, +30-50 capacity) as a mid-tier bridge.
- Late-game monsters (magma_brute 240 HP, frost_warden 280 HP, elder_sporecap 320 HP) may need XP increases to match their new durability.
- Pulse Rifle DPS (60) is close to Sol Beam DPS (~84 with sol_unit) — monitor whether rare weapon makes energy investment feel unrewarding.
- Rechargeable Battery L1 (30 energy) may need bump to 40 given higher ability usage in longer fights.

## Sol Grid Follow-ups

- Design and implement extended-adjacency modifiers (radius 2, entire row/column) for rare/legendary tier.
- Add dungeon triggers/loot for acquiring new sol units (nightcaster_frame, array_precision_core, greenway_bioframe, underlumen_nexus).

## Act II Quest Follow-ups

- Crystal Guardian boss: add dedicated boss music track (currently uses dungeon music).
- Make sure initial MERIDIAN-7 trade at train station flows into Array Hub quest.
- Add map/minimap markers or quest waypoints for Nightside Caverns entrance.

## Array Complex Follow-ups

- Replace placeholder sprite for array_overseer (currently copied from array_sentinel).
- Wire autotroph_path_defiant / autotroph_path_cooperative flags into Act III quest branching.
- Add Phase 3 investigation quest after Autotroph confrontation (player explores deep Array sub-tiers).

## Act III Follow-ups

- Add Unbounded elder NPC for deep Nightside encounters (referenced by Sable).
- Add Council faction NPCs (Steward representative, Compact representative, Root representative) for political branching.
- Add three ending path dungeons/sequences (shutdown, merge, control) — each path needs its own dungeon(s) with final encounters and resolution triggers.
- Add post-choice NPC dialogue variants for Asha, Sable, and MERIDIAN-7 based on chosen path.
- Add final boss encounters for each ending path.
- Add loot tables for threshold_watcher, abyssal_tendril, threshold_keeper monsters.
- Add sable_nightside_guide sprite placeholder.
- Consider further umbrasite escalation tiers (repeatable with diminishing returns).

## Art & Sprites

- Create tileset strips for each zone theme (currently only stone_crypt has a full tileset).
- Add animation frames (idle, attack, hit) once the engine supports sprite animation.
- Add placeholder chest/crate sprites to frost_crypt (tiles 10/11), fungal_forest (tiles 10/11), and crypt (tiles 30/31) tilesets.
- Add placeholder sprites for: array_overseer (unique), sable_nightside_guide, sable_threshold.

## Automation Grid Follow-ups

Phases 1-2 complete. Remaining phases:

### Phase 3: Automation Screen Access (Engine + Content)
- Add `openAutomation` scripting action to `server/scripting/actions.js`
- Add MERIDIAN-7 interaction trigger that opens the automation screen
- Client handler for `AUTO_STATE` with `openScreen: true`
- Remove the auto tab from the menu (or keep it as a read-only summary)

### Phase 4: Dungeon Sync (Engine)
- Modify MAP data sending in `game-loop.js` — merge automation placements into tile data for dayside_solar_fields
- Grid-to-dungeon coordinate conversion using offset from grid config
- Visual-only harvester entities at harvester positions

### Phase 5: Polish
- Add tooltips on hover/click for placed structures
- Add sound effects for placement confirmation and level-up
- Mobile/touch support — tap to select, tap to place
- Controller support — d-pad navigation of grid cells

## Progression System Open Questions

- Battery math: capacity per tier, energy costs per ability, casts per full charge at each game phase.
- Harvester scaling: silicon collection rate, max harvesters, late-game harvester upgrades.
- Ability list: full catalog of abilities from MERIDIAN-7, organized by unlock order.
- Multiplayer implications: do players see each others' grid builds? Does this encourage specialization?
