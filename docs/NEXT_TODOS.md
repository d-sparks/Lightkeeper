# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOS.md tasks.

## Map Streaming & Fog of War

Chunk-based map streaming and fog of war are implemented. Outstanding work:

- ~~Create 10x bigger dungeon content (200x120+ tile maps) to take advantage of the streaming system.~~ — DONE: `outer_expanse` created (200x120, 104 chunks, 27 monster spawns, 17 items, 6 triggers). Reachable via new east exit added to `deep_perimeter_east`. Generator script at `scripts/gen_outer_expanse.js`.
- ~~**outer_expanse east exit**~~ — DONE: East stairs at (198,60) now lead to `void_flats`, a new stub dungeon (25×18, outpost tileset) representing the far eastern desolation. `void_flats` exits back to outer_expanse at (196,60). Future Act III content can expand this area eastward.
- **outer_expanse patrol paths** — Many monster spawns lack explicit patrolPath waypoints. Add them to improve AI variety across the large map's distinct zones.
- Optimize iso rendering for very large maps: skip iteration of unrevealed chunk regions entirely instead of checking each tile.
- ~~Add a smooth fog-of-war edge effect at the border of revealed/unrevealed chunks (gradient or dithered fade).~~ — DONE: `_getFogEdgeAlpha()` method computes per-tile alpha based on distance to nearest unrevealed chunk boundary (3-tile fade depth, checks all 8 neighbors including diagonals). Applied in both flat and iso renderers.
- Editor reload paths still send full map data (no fog of war). Consider chunking those too if needed.
- Consider reducing chunk reveal radius (currently 3 chunks = 48 tiles) for bigger maps to increase exploration feel.
- Tune the `getOverlayedMapData` call frequency — currently checked every tick for every player; could throttle to every N ticks.

## Sessions & Persistence

Session save/load is implemented (JSON files in `saves/`). Outstanding work:

- ~~Add authentication or simple password protection to prevent session hijacking (anyone can resume any character by name).~~ — DONE: Session tokens (48-char hex via crypto.randomBytes) generated on character creation, stored in save files and client localStorage. Token required to resume existing characters; concurrent logins blocked. Old saves without tokens are backfilled on first login.
- Add a delete character button on the session select screen.
- Save automation/dayside state per session (currently not persisted).
- Periodic auto-save during play (currently only saves on disconnect).
- Handle name collisions more gracefully (warn if creating a character with an existing name).
- Consider a database backend (SQLite) for deployed environments where filesystem is ephemeral.

## Controls

- ~~Touch joystick and gamepad analog sticks send raw screen-space dx/dy — they should be rotated 45° for isometric screen-orthogonal movement, same as the WASD fix applied in `client/input.js`.~~ — DONE: `sendInput()` now rotates joystick and gamepad analog inputs with `(worldX = screenX + screenY, worldY = -screenX + screenY)` before accumulating into dx/dy, matching the existing WASD isometric rotation.

## Game Feel (Critical Gap)

- ~~Death penalty: when the player dies, drain energy, drop non-quest items (per dropBehavior rules in architecture-plan.md), respawn at room entrance.~~ — DONE: 25% energy drain + non-quest item drop + respawn-at-entrance teleport + death screen overlay all implemented.
- ~~Sound effects~~ — DONE: All 24 SFX wired.
- ~~Combat juice~~ — DONE: Screen shake, death anims, projectile tinting, ambush reveal.

## Progression Wiring

- ~~Generator wiring~~ — DONE: basic_generator via Tech Maren, improved_generator in Array loot.
- Rechargeable battery (100 cap, uncommon) and single-use battery (100 cap, common) now exist as mid-tier bridge items. Consider additional tiers (50/200 cap variants).
- Automation milestone reward thresholds (2/4/6/10/15) may need tuning — particularly whether rechargeable battery at 6 structures feels too early or too late.
- Milestone reward claiming has no dedicated UI notification (toast/popup). Consider adding a "Reward Unlocked!" flash.
- The umbracite trade now gives sol_shield_chip as the second ability. Ensure the sol grid tutorial flow accommodates this.

## Content Completion

- **Frost biome** loot is wired to `nightside_caverns` and `proc_frost_crypt` (all three tiers by depth). Consider adding `frost_biome_uncommon/rare` to deeper static nightside dungeons (nightside_depths, nightside_passage) if story chests are supplemented with loot crates.
- ~~Loot tables for Act III monsters: threshold_watcher, abyssal_tendril, threshold_keeper have no loot tables.~~ — DONE: Added to `content/loot/nightside.json` with umbracite/underlumen-themed drops. threshold_keeper (boss) has 0.9 drop chance with epic/legendary items including underlumen_nexus.
- ~~Three ending path dungeons~~ — DONE: All three built (shutdown: array_control_center, merge: merge_nexus, control: array_command_throne).
- ~~Post-choice NPC dialogue~~ — DONE: Asha, Sable, MERIDIAN-7, and Wren all have post_shutdown/post_merge/post_control dialogue variants reacting to chose_path_* flags. Wren and MERIDIAN-7 (trade terminal) added alongside the existing Asha and Sable meridian NPCs.
- ~~Unbounded elder NPC for deep Nightside (referenced by Sable). Provides Underlumen lore, gates merge path.~~ — DONE: `unbounded_elder` (Elder Vael) added to `nightside_depths` at (17,3). Sets `elder_merge_path_revealed` flag on first interaction. `three_paths_choice` gates merge option behind this flag; `three_paths_choice_no_merge` shows only shutdown/control without it. Sable's `sable_nightside_guide` has a new `met_elder` dialogue variant and a `guiding_warmly` reference.
- ~~Council faction NPCs~~ — DONE: Steward, Compact, Root representatives in meridian_civic.
- ~~Add `registrar_hollis` `array_secret_discovered` dialogue variant~~ — DONE: Hollis has `array_secret_discovered` dialogue (pre-existing) and now also has full `post_shutdown`/`post_merge`/`post_control` variants covering property reclassification, tripartite frameworks, and nationalization orders.

## Combat & AI Polish

- ~~Monster projectile tinting~~ — DONE: projColors map for all types.
- Add explicit patrolPath waypoints to remaining patrol spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02.
- ~~Pack AI "pack leader" variant that buffs nearby pack members.~~ — DONE: `pack_leader` AI type added. Pack leaders have a data-driven `aura` (range/damageMult/speedMult) that buffs nearby pack and pack_leader monsters each tick. Two pack leader monsters added: `feral_hound_alpha` (1.3x damage, 1.15x speed) and `frostfang_alpha` (1.25x damage, 1.2x speed). Client shows orange tint on leaders, yellow on buffed pack members.
- Tune special attack cooldowns and damage multipliers after playtesting (lunge, stun, ground slam).
- ~~Stun/knockback immunity~~ — DONE: 1.5s post-stun, 0.75s post-knockback.
- Visual polish: lunge trail effect, ground slam shockwave ring animation, stun stars instead of dots.

## Balance

- Late-game monsters (magma_brute 240 HP, frost_warden 280 HP, elder_sporecap 320 HP) may need XP increases to match their post-balance-pass durability.
- Playtest energy pacing at mid-game (improved_generator @ 5/s) to confirm Sol Beam spam isn't trivial.
- Crystal Guardian at 700 HP — verify this feels epic, not grindy.
- Pulse Rifle DPS (60) close to Sol Beam DPS (~84) — monitor whether rare weapon feels unrewarding.
- Rechargeable Battery L1 (30 energy) may need bump to 40 given higher ability usage.

## Audio

- Assign biome-appropriate tilesets to dungeons still using generic "crypt" (outpost_* should use "outpost", station_* should use "station", meridian_* should use "meridian"). Activates per-biome music automatically.
- ~~Wire `boss_crystal` music track into Crystal Guardian encounter triggers~~ — DONE: boss_intro mechanism was already wired; fixed FLOOR_CHANGE handler and boss-defeat restore to use `resolveAmbientTrack` so biome music (nightside/crypt) plays correctly before/after boss music instead of falling back to generic 'dungeon'.

## Testing

- ~~Integration tests (Tier 4)~~ — DONE: 61 tests (combat, equipment, sol-grid). All pass.
- Integration tests (Tier 4) — remaining: room lifecycle (`createRoom` → join → transition → cleanup). Needs heavier mocking of dungeon/tileset loading; deferred.
- ~~Physics dt fix~~ — DONE: dt clamping + substep movement.
- ~~Headless sim perimeter_gate fix~~ — DONE: Path state bug resolved.
- ~~Headless sim stuck at junction_cleared~~ — DONE: `doInteractNearest` now scans for interactable tiles and navigates to them. `buildQuestGoals` detects `door_interacted` triggers via `findDoorThatSetsFlag()` and generates `kill_monsters` + `move_to_position` goals. Bot now clears station_junction successfully.
- ~~Headless sim stuck at board_train~~ — DONE: `buildQuestGoals` now handles `targetExit` in quest step objectives, finding the matching exit tile and generating a `move_to_position` goal. Bot boards train and reaches meridian_station.
- **Headless sim stuck at visit_civic_center** — bot reaches meridian_civic but can't interact with registrar_hollis. Next blockage after board_train fix.

## Automation Grid (Phases 3-5)

Phase 3: DONE — `openAutomation` action in actions.js, `meridian_open_automation` trigger in train_station.json (fires on npc_interacted for meridian_7 when `traded_umbracite_meridian` flag is set), client AUTO_STATE handler with openScreen in main.js.
~~Phase 4: Dungeon sync — merge automation placements into tile data for dayside_solar_fields.~~ — DONE: `getOverlayedMapData()` merges player placements into MAP chunks at room-join, floor-transition, and post-build. `getHarvesterEntities()` spawns visual-only `scrap_drone` NPCs at silicon_harvester positions (per-player, decorative flag skips "[E] Talk" prompt). State broadcast injects harvester entities into npcs array when player is in dayside_solar_fields.
Phase 5: Tooltips, sound effects, mobile/touch, controller support.

## Sol Grid

- Light Sentry enhancements: multiple sentries, light/mirror puzzles, lifetime/duration, range indicator, upgrade paths, replace placeholder sprite.
- ~~Extended-adjacency modifiers~~ — DONE: radius2, row, column patterns for legendary tier.
- Client sol grid UI: visualize extended adjacency ranges when hovering/selecting a legendary modifier (highlight affected cells in radius2/row/column pattern).
- Battery math: capacity per tier, energy costs per ability, casts per full charge.
- Harvester scaling: silicon rate, max harvesters, late-game upgrades.
- Multiplayer implications: shared grid builds? Specialization?
- Tech Maren now gives `single_use_battery_chip` on each visit (if player doesn't already have one) instead of charging the sol unit directly. Players install the chip, deplete it, return for another — creating a battery loop. The `received_first_battery` flag gates quest progression.
- ~~Place battery chips as item spawns in longer dungeons as energy checkpoints~~ — DONE: `battery_chip` consumable added (restores 25 rechargeable energy). Placed 2 chips each in: nightside_passage, nightside_depths, underlumen_threshold, merge_nexus, deep_perimeter_east, dead_road, perimeter_outer_ring, nightside_caverns, void_flats, crypt_01, crypt_02. Four chips spread across outpost_perimeter (50×45).
- ~~Wire rechargeable_battery_chip into loot tables so players can obtain permanent battery upgrades.~~ — DONE: Added weight-1 drops to `luddite_warlord`, `crystal_guardian` (common), `array_fabricator` (weight 1) and `array_overseer` (weight 2) (array), `threshold_keeper` (nightside), `outpost_biome_uncommon` (outpost), `geothermal_biome_rare` (geothermal), and `frost_biome_rare` (frost). Rarer than reinforced_battery_chip given its regeneration bonus.
- Playtest single-use battery degradation feel — 100 capacity may need tuning based on ability costs.
- ~~Consider visual/audio feedback when a single-use battery degrades or is fully consumed.~~ — DONE: Flash and sound cue added when single-use battery is fully depleted.
- ~~Update Guard Pell's dialogue: he currently says "You need a charge, you talk to her" — update to say "field cells" or "battery" instead of "charge".~~ — DONE: Dialogue updated to use battery terminology.

## Art & Sprites

- Replace all placeholder sprites with proper pixel art per art-style-guide.md (long-term).
- Placeholder sprites needed: array_overseer (unique), sable_nightside_guide, sable_threshold, unbounded_elder.
- Tileset strips for each zone theme.
- Animation frames (idle, attack, hit) when engine supports sprite animation.

## Quest Graph Disconnections

Critical gaps in the quest graph where content exists but isn't reachable from the main quest line:

- ~~Main quest extension~~ — DONE: Steps 19-22 bridging Act I to Act III.
- ~~NPC dayside breadcrumbs~~ — DONE: Yun and Hollis provide hints.
- ~~autotroph_path flags~~ — DONE: Sable reacts to each path.
- ~~Boss-kill flags~~ — DONE: Wren, Sable, Asha all react.
- ~~Act III ending dungeons~~ — DONE: All three paths built.
- ~~nightside_expedition gating~~ — DONE: Step 22 gates on `act3_asha_alliance_activated`.
- ~~Council faction NPCs~~ — DONE.
- ~~**Post-ending game state**~~ — DONE: Hub dungeon room triggers (meridian_market, meridian_station, meridian_residential) show atmospheric changes per ending path. NPC dialogue added for merchant_reva, weaponsmith_garro, component_dealer_mira, liaison_thorne, registrar_hollis. Existing post-ending coverage extended; Asha, Wren, Sovell, and council NPCs already had variants.

## Act II Quest Follow-ups

- ~~autotroph_path flag wiring~~ — DONE.
- Phase 3 investigation quest after Autotroph confrontation — still needed to make the choice *mechanically* meaningful beyond dialogue.
- Map markers for Nightside Caverns entrance.
- **Wren Alcott sprite** — `wren_alcott` NPC added to outpost_comms but has no unique sprite. Add placeholder or reuse existing outpost sprite.
- ~~**Wren low-trust/post-Meridian variants**~~ — DONE: Wren now reacts to `elder_sporecap_defeated`, `magma_core_cleared`, `arrived_meridian`, `array_secret_discovered`, and `act3_asha_alliance_activated` in priority order, completing her mentor arc from field ops briefing through Act III coalition.
- ~~**sable_trust numeric escalation**~~ — DONE: Trust now increments to 2 when Sable accepts the guide role (nightside_passage `passage_sable_guide_intro`) and to 3 when she speaks at the Listening Floor (underlumen_threshold `sable_threshold_guide`). The `companion_bond` dialogue rule now gates on `flagGreaterThan sable_trust > 2`, so it only fires after the full deep expedition. Future content can add trust stage 4+ for post-Threshold events.
- **autotroph low-trust Sable reaction** — Current autotroph rules require `helped_sable`. Add low-trust variants so Sable has a response even if the player didn't help her earlier.
- **Remaining orphaned flags** — Content validator may still report other orphaned flags not in this batch (e.g., any flags set by side quests without corresponding checks). Run validator post-merge to confirm remaining count.

## Endgame Loop Implementation (see docs/endgame-loop.md)

Priority-ordered implementation tasks:

### Phase 1 — Post-Ending World State (Content only, no engine changes)
- ~~Wire ending-path room triggers in hub dungeons and NPC dialogue variants per ending.~~ — DONE: meridian_market, meridian_station, meridian_residential all have `once: true` room_entered triggers for each path. merchant_reva, weaponsmith_garro, component_dealer_mira, liaison_thorne, registrar_hollis all have post_shutdown/post_merge/post_control dialogue variants.
- Wire `chose_path_*` flag checks into meridian_station room triggers to set `endgame_active` flag (needed for Phase 2 expedition board gating).
- Add post-ending MERIDIAN-7 dialogue variants for endgame expedition access and modifier crafting.
- Add post-ending Sable dialogue for Shutdown/Merge paths (expedition quest-giver).
- Consider post-ending changes to outpost_entrance and outpost_comms (Wren already has dialogue, but no room-level atmospheric changes).

### Phase 2 — Expedition Tiers 1-3 (Small engine + content)
- Create `content/expeditions/` directory with tier config JSON files.
- Add expedition loot tables to `content/loot/expeditions.json`.
- Engine: Add monster stat scaling multiplier at spawn time (read from expedition context).
- Engine: Add expedition state tracking to flag store (tier, floor, banked loot).
- Add expedition board NPC/interactable in meridian_station (post-ending).
- Create new procedural dungeon templates for expedition variants if needed.

### Phase 3 — Modifier Crafting (Small engine + content)
- Add `craft` action type to `server/scripting/actions.js` (validate inputs, consume cost, produce output).
- Create `content/entities/crafting.json` with reforge/fuse/attune recipes.
- Add MERIDIAN-7 crafting dialogue branch gated on `endgame_active`.

### Phase 4 — Automation Levels 6-10 (Content + small engine)
- Define new structures (silicon_refinery, auto_turret, fabricator, expedition_beacon) in automation config.
- Add milestone rewards for levels 6-10 (grid expansion, structure unlocks, legendary reward at 20).
- Engine: Add structure adjacency bonus calculation (refinery boosting adjacent harvesters).
- Wire ending-path-specific structure variants (bio_harvester, symbiotic_node, array_drone_bay).

### Phase 5 — Boss Affixes + Tiers 4-5 (Moderate engine)
- Define boss affix data format and affix pool in `content/expeditions/affixes.json`.
- Engine: Apply affix buffs to boss entities at spawn (extend existing buff system from pack_leader auras).
- Add Tier 4-5 expedition configs requiring multiple players.
- Create 6 path-specific legendary modifiers in `content/entities/sol_components.json`.

### Phase 6 — Cooperative Challenges (Moderate engine)
- Engine: Wave defense system (timed monster spawns, shared objective tracking).
- Engine: Player-count gating for challenge entry.
- Create `content/challenges/` directory with Lighthouse Siege and Deep Expedition configs.
- Add cooperative-only legendary modifier pool.
- Add weekly cooldown tracking per-player via flags.

### Phase 7 — Raids + Faction Rally (Moderate engine)
- Engine: Timed raid event system (periodic threat to automation structures).
- Engine: Structure HP and damage/repair mechanics.
- Engine: Server-wide flag aggregation for Faction Rally progress.
- Define raid monster pools and scaling in automation config.
- Define monthly Faction Rally objectives.
