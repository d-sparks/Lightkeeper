# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOS.md tasks.

## Map Streaming & Fog of War

Chunk-based map streaming and fog of war are implemented. Outstanding work:

- Create 10x bigger dungeon content (200x120+ tile maps) to take advantage of the streaming system.
- Optimize iso rendering for very large maps: skip iteration of unrevealed chunk regions entirely instead of checking each tile.
- Add a smooth fog-of-war edge effect at the border of revealed/unrevealed chunks (gradient or dithered fade).
- Editor reload paths still send full map data (no fog of war). Consider chunking those too if needed.
- Consider reducing chunk reveal radius (currently 3 chunks = 48 tiles) for bigger maps to increase exploration feel.
- Tune the `getOverlayedMapData` call frequency — currently checked every tick for every player; could throttle to every N ticks.

## Sessions & Persistence

Session save/load is implemented (JSON files in `saves/`). Outstanding work:

- Add authentication or simple password protection to prevent session hijacking (anyone can resume any character by name).
- Add a delete character button on the session select screen.
- Save automation/dayside state per session (currently not persisted).
- Periodic auto-save during play (currently only saves on disconnect).
- Handle name collisions more gracefully (warn if creating a character with an existing name).
- Consider a database backend (SQLite) for deployed environments where filesystem is ephemeral.

## Controls

- Touch joystick and gamepad analog sticks send raw screen-space dx/dy — they should be rotated 45° for isometric screen-orthogonal movement, same as the WASD fix applied in `client/input.js`.

## Game Feel (Critical Gap)

- Death penalty: when the player dies, drain energy, drop non-quest items (per dropBehavior rules in architecture-plan.md), respawn at room entrance. Completes the core risk/reward loop.
- Placeholder sound effects for core actions: weapon attack, ability fire, monster hit, monster death, item pickup, door open, level transition. Audio system and per-biome music are wired — needs sound effect content.
- Combat juice pass: screen shake on player hit, monster death fade-out animation, ambush monster fade-in reveal, projectile tinting by monster type (fire=orange, ice=blue, acid=green).

## Progression Wiring

- Wire generators into loot/rewards: basic_generator and improved_generator items exist but aren't obtainable via any loot table or quest reward. Critical for energy progression pacing.
- Rechargeable battery (100 cap, uncommon) and single-use battery (100 cap, common) now exist as mid-tier bridge items. Consider additional tiers (50/200 cap variants).
- Automation milestone rewards are now data-driven in structures.json `_milestoneRewards`. Current thresholds (2/4/6/10/15) may need tuning after playtesting — particularly whether the rechargeable battery at 6 structures feels too early or too late.
- Milestone reward claiming shows a message via INVENTORY update but has no dedicated UI notification (toast/popup). Consider adding a "Reward Unlocked!" flash in the automation screen when a milestone is claimed.
- The umbracite trade now gives sol_shield_chip as the second ability. Ensure the sol grid tutorial flow accommodates this (player may need guidance to slot it).

## Content Completion

- **Frost biome** loot is wired to `nightside_caverns` and `proc_frost_crypt` (all three tiers by depth). Consider adding `frost_biome_uncommon/rare` to deeper static nightside dungeons (nightside_depths, nightside_passage) if story chests are supplemented with loot crates.
- Loot tables for Act III monsters: threshold_watcher, abyssal_tendril, threshold_keeper have no loot tables. Create nightside/underlumen loot tables with thematic drops.
- Three ending path dungeons: array_control_center (shutdown), underlumen_nexus_chamber (merge), array_command_core (control). Each needs a final boss encounter and resolution triggers.
- Post-choice NPC dialogue: Asha, Sable, and MERIDIAN-7 dialogue variants reacting to the player's chosen ending path (chose_path_shutdown/merge/control flags).
- Unbounded elder NPC for deep Nightside (referenced by Sable). Provides Underlumen lore, gates merge path.
- Council faction NPCs (Steward, Compact, Root representatives) for political branching. These should react to `array_secret_discovered` and `chose_path_*` flags — referenced in Asha's `array_secret_crisis` dialogue but not yet embodied by spawnable NPCs in `meridian_civic`.
- Add `registrar_hollis` `array_secret_discovered` dialogue variant: the civic bureaucracy should have ambient reactions to the Council fracturing.

## Combat & AI Polish

- Monster projectiles use generic blue color — tint by monster type or add distinct sprite.
- Add explicit patrolPath waypoints to remaining patrol spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02.
- Pack AI "pack leader" variant that buffs nearby pack members.
- Tune special attack cooldowns and damage multipliers after playtesting (lunge, stun, ground slam).
- Add stun/knockback immunity window after recovery to prevent stun-locks.
- Visual polish: lunge trail effect, ground slam shockwave ring animation, stun stars instead of dots.

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
- Headless sim bot stuck at perimeter_gate (can't interact with Sgt. Fenn NPC). Bot needs better NPC approach + interact logic for sim-based testing beyond step 9.
- Pre-existing physics bug: "large dt does not skip through walls" test fails — player teleports through wall at high dt values. Needs dt clamping or substep logic in movePlayer.

## Automation Grid (Phases 3-5)

Phase 3: Add `openAutomation` scripting action, MERIDIAN-7 trigger, client handler for AUTO_STATE with openScreen.
Phase 4: Dungeon sync — merge automation placements into tile data for dayside_solar_fields.
Phase 5: Tooltips, sound effects, mobile/touch, controller support.

## Sol Grid

- Light Sentry enhancements: multiple sentries, light/mirror puzzles, lifetime/duration, range indicator, upgrade paths, replace placeholder sprite.
- Extended-adjacency modifiers (radius 2, row/column) for rare/legendary tier.
- Battery math: capacity per tier, energy costs per ability, casts per full charge.
- Harvester scaling: silicon rate, max harvesters, late-game upgrades.
- Multiplayer implications: shared grid builds? Specialization?
- Tech Maren now gives `single_use_battery_chip` on each visit (if player doesn't already have one) instead of charging the sol unit directly. Players install the chip, deplete it, return for another — creating a battery loop. The `received_first_battery` flag gates quest progression.
- Place additional single-use battery chips as item spawns in longer dungeons as energy checkpoints (as described in task — "piece single use batteries throughout as sort of checkpoints").
- Wire rechargeable_battery_chip into loot tables so players can obtain permanent battery upgrades.
- Playtest single-use battery degradation feel — 100 capacity may need tuning based on ability costs.
- Consider visual/audio feedback when a single-use battery degrades or is fully consumed.
- Update Guard Pell's dialogue: he currently says "You need a charge, you talk to her" — update to say "field cells" or "battery" instead of "charge".

## Art & Sprites

- Replace all placeholder sprites with proper pixel art per art-style-guide.md (long-term).
- Placeholder sprites needed: array_overseer (unique), sable_nightside_guide, sable_threshold.
- Tileset strips for each zone theme.
- Animation frames (idle, attack, hit) when engine supports sprite animation.

## Quest Graph Disconnections

Critical gaps in the quest graph where content exists but isn't reachable from the main quest line:

- ~~**Main quest dead-ends at step 18**~~ — DONE: Added steps 19-22 (explore_dayside → discover_array_secret → build_alliance → forge_expedition) bridging Act I to Act III.
- ~~**No NPC directs players to dayside_solar_fields**~~ — DONE: Yun and Hollis now provide dayside breadcrumbs after `met_crafter_yun`.
- ~~**autotroph_path_defiant/cooperative flags orphaned**~~ — DONE: Sable (meridian) now reacts with distinct dialogue for each path; rules fire after array_secret_discovered rules are excluded.
- ~~**Boss-kill flags orphaned**~~ — DONE: Wren Alcott (outpost_comms) reacts to `frost_warden_defeated`; Sable (meridian) reacts to `elder_sporecap_defeated`; Asha reacts to `magma_core_cleared`.
- **Act III paths accept choices but nothing happens** — nightside_expedition quest lets players choose shutdown/merge/control but the ending dungeons don't exist yet.
- ~~**nightside_expedition requires `act3_asha_alliance_activated`**~~ — DONE: Step 22 (forge_expedition) gates on this flag, completing the path from main quest → Act III.
- **Council faction NPCs not spawned** — Steward, Compact, Root representatives referenced in Asha's dialogue but not in meridian_civic as spawnable NPCs.

## Act II Quest Follow-ups

- ~~Wire autotroph_path_defiant / autotroph_path_cooperative flags into Act III branching.~~ — DONE: Sable now reacts differently to each path in meridian dialogue.
- Phase 3 investigation quest after Autotroph confrontation — still needed to make the choice *mechanically* meaningful beyond dialogue.
- Map markers for Nightside Caverns entrance.
- **Wren Alcott sprite** — `wren_alcott` NPC added to outpost_comms but has no unique sprite. Add placeholder or reuse existing outpost sprite.
- **Wren low-trust/post-Meridian variants** — Wren currently has only one non-default state (`post_frost_warden`). Add reactions for `elder_sporecap_defeated`, `magma_core_cleared`, and post-Meridian story beats to complete her arc as mentor figure.
- **sable_trust numeric escalation** — `sable_trust` flag is currently set once to 1 and then never incremented. Wire additional trust-building interactions (e.g., completing Sable's Nightside guide mission) to increment the value, enabling future `flagGreaterThan` checks for deeper relationship stages.
- **autotroph low-trust Sable reaction** — Current autotroph rules require `helped_sable`. Add low-trust variants so Sable has a response even if the player didn't help her earlier.
- **Remaining orphaned flags** — Content validator may still report other orphaned flags not in this batch (e.g., any flags set by side quests without corresponding checks). Run validator post-merge to confirm remaining count.
