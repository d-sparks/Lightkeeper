TODOs

## Game Feel & Polish (Highest Impact)

- Add placeholder sound effects for core actions (weapon_attack, ability_fire, monster_hit, monster_death, item_pickup, door_open, floor_transition, player_hurt) and wire them into client/audio.js. Even synthesized tones dramatically improve the experience. The audio system exists — it just needs content.
- Combat juice pass: add screen shake on player hit and on heavy attacks, add monster death fade-out animation, tint monster projectiles by type (not all blue), add ambush monster fade-in reveal effect. Small visual improvements that compound into a much better feel.
- Implement death penalty: when the player dies, drain 25-50% of current energy and drop one random non-quest item. Respawn at the room entrance. This gives risk to dungeon runs without being punishing enough to frustrate. Tune carefully — dying should sting, not enrage.
- Add minimap quest waypoints / markers for active quest objectives. The quest panel shows text but the player has no spatial guidance toward their next goal. Even a simple colored dot on the minimap for the target room would help enormously.

## Loot & Content Wiring

- Wire biome loot tables (frost.json, geothermal.json, fungal.json, outpost.json) to dungeon chests/crates via triggers. The loot tables and engine exist — interactable containers just don't use them. Add lootTable-based item drops when players interact with chest/crate tiles in each biome.
- Add biome loot table references to procedural dungeon templates (proc_frost_crypt, proc_fungal_forest, proc_quarantine, proc_quarantine_deep). Procedural floors should drop biome-appropriate loot from chests.
- Deploy newer monster types into actual dungeon floors. The ambush, patrol, and pack AI monsters (shadow_ambusher, tunnel_creeper, feral_hound, rime_stalker, frostfang_hunter, vent_spewer, sporecap_shambler, mycelium_lurker, fungal_sprayer) are defined but not placed. Add monsterSpawns entries in thematically appropriate dungeons.
- Wire the patrol field on dungeon monsterSpawns into the patrol AI behavior. The field exists in dungeon JSON but the engine ignores it — patrol monsters currently wander randomly instead of following paths.

## Automation & Progression

- Build the automation grid UI (Phase 1 — server-side grid state). Update automation.js to track structure placements with {x, y} coordinates instead of just counts. Update build() to accept/validate gridX, gridY. Update getStateForClient() to include grid data, blocked cells, and stats. See docs/automation_screen.md Phase 1.
- Build the automation grid UI (Phase 2 — client CSS grid). Replace the list-based auto panel with a full-screen 12x12 top-down grid placement screen. Build palette, resource sidebar, progress bar. Opened by interacting with MERIDIAN-7. See docs/automation_screen.md Phase 2.
- Add dungeon triggers/loot for acquiring new sol units. The 4 non-starter sol units (nightcaster_frame in Frost Crypts, array_precision_core from MERIDIAN-7 trade, greenway_bioframe in Fungal Forests, underlumen_nexus in deep ruins) need actual in-game acquisition paths — chest drops, NPC rewards, or quest completions.

## Content & Story

- Create a Crystal Guardian boss encounter with unique AI. Currently uses generic melee_chase. Design a multi-phase fight: phase 1 melee, phase 2 adds crystal shard projectiles, phase 3 summons minions. This would be the game's first real boss and set the pattern for future encounters.
- Extend Act II: wire array_secret_discovered flag into MERIDIAN-7 confrontation dialogue at the Hub and into Sable/Asha/Council NPC dialogue for Act III progression. The Array complex reveals a secret — NPCs should react to it.
- Gate array_synthesis_lab access behind umbrasite quest completion and wire the array_clearance_badge as a key requirement for array_deep_processing. Currently these areas are freely accessible, undermining the quest progression.
- Add loot tables for array_sentinel and array_fabricator monsters (currently undefined). Generate placeholder sprites for these Array construct monsters.

## Quality & Testing

- Implement Tier 1 unit tests using Node's built-in test runner: flag-store.test.js, event-bus.test.js, automation.test.js. These are standalone logic modules with zero mocks needed — highest value per effort. See docs/TESTING.md for the full plan.
- Display sol unit innateBonus info (perk name and description) on the sol grid screen. Players should understand what makes each sol unit different when they view their grid.

## Meta
- Take a look at any outstanding items or ongoing projects in the docs folder. Think carefully about the big picture. We want to make this game as fun and complete as possible. What are the best short and long term investments we can make to improve the game and add to it? If we need to spin up a new big project store a roadmap in the docs folder. If a project is done, mark it as done in its documentation so we know to stop thinking about it. This should cover testing, game quality, fun, content, theme, design, graphics, etc. Then, come up with 10-20 next tasks. Then, replace all tasks in TODOS.md (except the last one!) with those tasks.
