# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOS.md tasks.

## Game Feel (Critical Gap)

- Death penalty: when the player dies, drain energy, drop non-quest items (per dropBehavior rules in architecture-plan.md), respawn at room entrance. Completes the core risk/reward loop.
- Placeholder sound effects for core actions: weapon attack, ability fire, monster hit, monster death, item pickup, door open, level transition. Audio system and per-biome music are wired — needs sound effect content.
- Combat juice pass: screen shake on player hit, monster death fade-out animation, ambush monster fade-in reveal, projectile tinting by monster type (fire=orange, ice=blue, acid=green).

## Progression Wiring

- Sol unit acquisition paths: 4 non-starter sol units (nightcaster_frame, array_precision_core, greenway_bioframe, underlumen_nexus) are defined but unobtainable. Wire as chest drops, NPC rewards, or quest completions in thematic locations.
- Wire generators into loot/rewards: basic_generator and improved_generator items exist but aren't obtainable via any loot table or quest reward.
- Consider adding a "basic_battery" sol component (uncommon, +30-50 capacity) as a mid-tier bridge.

## Content Completion

- Loot tables for Act III monsters: threshold_watcher, abyssal_tendril, threshold_keeper have no loot tables. Create nightside/underlumen loot tables with thematic drops.
- Three ending path dungeons: array_control_center (shutdown), underlumen_nexus_chamber (merge), array_command_core (control). Each needs a final boss encounter and resolution triggers.
- Post-choice NPC dialogue: Asha, Sable, and MERIDIAN-7 dialogue variants reacting to the player's chosen ending path (chose_path_shutdown/merge/control flags).
- Unbounded elder NPC for deep Nightside (referenced by Sable). Provides Underlumen lore, gates merge path.
- Council faction NPCs (Steward, Compact, Root representatives) for political branching.

## Combat & AI Polish

- Monster projectiles use generic blue color — tint by monster type or add distinct sprite.
- Add explicit patrolPath waypoints to remaining patrol spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02.
- Pack AI "pack leader" variant that buffs nearby pack members.

## Balance

- Late-game monsters (magma_brute 240 HP, frost_warden 280 HP, elder_sporecap 320 HP) may need XP increases to match their post-balance-pass durability.
- Playtest energy pacing at mid-game (improved_generator @ 5/s) to confirm Sol Beam spam isn't trivial.
- Crystal Guardian at 700 HP — verify this feels epic, not grindy.
- Pulse Rifle DPS (60) close to Sol Beam DPS (~84) — monitor whether rare weapon feels unrewarding.
- Rechargeable Battery L1 (30 energy) may need bump to 40 given higher ability usage.

## Audio

- Assign biome-appropriate tilesets to dungeons still using generic "crypt" (outpost_* should use "outpost", station_* should use "station", meridian_* should use "meridian"). Activates per-biome music automatically.
- Wire `boss_crystal` music track into Crystal Guardian encounter triggers (track exists but isn't triggered).

## Testing

- Integration tests (Tier 4): combat flow, equipment system, sol grid adjacency, room lifecycle.
- Headless sim bot stuck at ~4/43 rooms — needs pathfinding/NPC interaction improvements for useful sim-based testing.

## Automation Grid (Phases 3-5)

Phase 3: Add `openAutomation` scripting action, MERIDIAN-7 trigger, client handler for AUTO_STATE with openScreen.
Phase 4: Dungeon sync — merge automation placements into tile data for dayside_solar_fields.
Phase 5: Tooltips, sound effects, mobile/touch, controller support.

## Sol Grid

- Extended-adjacency modifiers (radius 2, row/column) for rare/legendary tier.
- Battery math: capacity per tier, energy costs per ability, casts per full charge.
- Harvester scaling: silicon rate, max harvesters, late-game upgrades.
- Multiplayer implications: shared grid builds? Specialization?

## Art & Sprites

- Replace all placeholder sprites with proper pixel art per art-style-guide.md (long-term).
- Placeholder sprites needed: array_overseer (unique), sable_nightside_guide, sable_threshold.
- Tileset strips for each zone theme.
- Animation frames (idle, attack, hit) when engine supports sprite animation.

## Act II Quest Follow-ups

- Wire autotroph_path_defiant / autotroph_path_cooperative flags into Act III branching.
- Phase 3 investigation quest after Autotroph confrontation.
- Map markers for Nightside Caverns entrance.
