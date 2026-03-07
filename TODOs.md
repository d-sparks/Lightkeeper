TODOs

## Game Feel & Polish (Highest Impact)

- Add placeholder sound effects for core actions (weapon_attack, ability_fire, monster_hit, monster_death, item_pickup, door_open, floor_transition, player_hurt) using Web Audio API synthesized tones. Wire them into client/audio.js. The audio system exists — it just needs content. Even simple beeps/clicks dramatically improve the experience.
- Combat juice pass: add screen shake on player hit and on heavy attacks, add monster death fade-out animation, tint monster projectiles by type (not all blue), add ambush monster fade-in reveal effect. These are small visual improvements that compound into a much better feel.
- Implement death penalty: when the player dies, drain 25-50% of current energy and drop one random non-quest item. Respawn at the room entrance. This completes the risk/reward loop — dungeon runs should feel meaningful. Dying should sting, not enrage.
- Add boss health bar UI for Crystal Guardian. The 3-phase boss_crystal AI exists and sends boss=true and bossPhase in monster data, but the client has no boss health bar or phase transition visual effects. This is the game's first boss — it should feel special.

## Content Wiring (Stuff Built But Not Connected)

- Deploy newer monster types into actual dungeon floors. The ambush, patrol, and pack AI monsters (shadow_ambusher, tunnel_creeper, feral_hound, rime_stalker, frostfang_hunter, vent_spewer, sporecap_shambler, mycelium_lurker, fungal_sprayer) are defined but not placed. Add monsterSpawns entries in thematically appropriate dungeons (nightside, frost, geothermal, fungal).
- ~~Wire the patrol field on dungeon monsterSpawns into the patrol AI behavior~~ Done — patrol monsters now follow waypoint paths. Add explicit patrolPath arrays to remaining dungeons that use "patrol": "patrol" without paths (they auto-generate for now).
- Add dungeon triggers and loot drops for acquiring the 4 non-starter sol units: nightcaster_frame (Frost Crypts chest/boss drop), array_precision_core (MERIDIAN-7 trade reward), greenway_bioframe (Fungal Forest quest reward), underlumen_nexus (deep ruins discovery). These are defined in sol_units.json but currently unobtainable in-game.
- Add minimap quest waypoints / markers for active quest objectives. The quest panel shows text but the player has no spatial guidance toward their next goal. Even a simple colored dot on the minimap for the target room would help enormously.

## Automation & Progression

- Build the automation grid UI (Phase 1 — server-side grid state). Update automation.js to track structure placements with {x, y} coordinates instead of just counts. Update build() to accept/validate gridX, gridY. Update getStateForClient() to include grid data, blocked cells, and stats. See docs/automation_screen.md Phase 1.
- Build the automation grid UI (Phase 2 — client CSS grid). Replace the list-based auto panel with a full-screen 12x12 top-down grid placement screen. Build palette, resource sidebar, progress bar. Opened by interacting with MERIDIAN-7. See docs/automation_screen.md Phase 2.

## Content & Story

- Extend Act II Array questline: wire array_secret_discovered flag into Sable, Asha, and Council NPC dialogue for Act III progression hooks. Add MERIDIAN-7 confrontation dialogue at the Hub when player knows the secret. Consider escalating umbrasite demands for repeatable trade quest.
- Add a proc_geothermal procedural dungeon template with appropriate monster pool (vent_spewer, magma_brute), chest tiles wired to geothermal loot tables, and dayside tileset. Currently only static dayside dungeons have geothermal content.
- Create a dedicated nightside tileset with umbracite-vein wall tiles, dark floor variants, and bioluminescent accents. Currently nightside dungeons reuse the frost_crypt tileset which doesn't match the thematic identity described in the art style guide.

## Quality & Testing

- Implement Tier 2 unit tests: conditions.test.js, actions.test.js, trigger-registry.test.js. These need light mocks for game state but are high value — they cover the scripting system that drives all quest logic. Tier 1 (flag-store, event-bus, automation) is done. See docs/TESTING.md.
- Define modifier stat ranges per rarity tier (common → legendary number values) for sol components. Currently modifiers have flat bonuses regardless of rarity. Design a scaling table and update sol_components.json so that rarer modifiers provide meaningfully better stats.
- Multiplayer polish pass: add party member health indicators, show other players on the minimap, display shared quest progress. Co-op is functional but bare — these small additions make it feel like you're actually playing together.

## Meta
- Take a look at any outstanding items or ongoing projects in the docs folder. Think carefully about the big picture. We want to make this game as fun and complete as possible. What are the best short and long term investments we can make to improve the game and add to it? If we need to spin up a new big project store a roadmap in the docs folder. If a project is done, mark it as done in its documentation so we know to stop thinking about it. This should cover testing, game quality, fun, content, theme, design, graphics, etc. Then, come up with 10-20 next tasks. Then, replace all tasks in TODOS.md (except the last one!) with those tasks.
