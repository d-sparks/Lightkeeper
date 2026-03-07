TODOs

## Game Feel & Core Loop (Highest Impact — Make It Fun)

- Add placeholder sound effects for core actions (weapon_attack, ability_fire, monster_hit, monster_death, item_pickup, door_open, floor_transition, player_hurt) using Web Audio API synthesized tones. Wire them into client/audio.js. The audio system exists — it just needs content. Even simple beeps/clicks dramatically improve the experience.
- Combat juice pass: add screen shake on player hit and on heavy attacks, add monster death fade-out animation, tint monster projectiles by type (not all blue), add ambush monster fade-in reveal effect. These are small visual improvements that compound into a much better feel.
- Implement death penalty: when the player dies, drain 25-50% of current energy and drop one random non-quest item. Respawn at the room entrance. This completes the risk/reward loop — dungeon runs should feel meaningful. Dying should sting, not enrage.
- Add boss health bar UI for Crystal Guardian. The 3-phase boss_crystal AI exists and sends boss=true and bossPhase in monster data, but the client has no boss health bar or phase transition visual effects. This is the game's first boss — it should feel special.

## Content Wiring (Stuff Built But Not Connected)

- Add dungeon triggers and loot drops for acquiring the 4 non-starter sol units: nightcaster_frame (Frost Crypts chest/boss drop), array_precision_core (MERIDIAN-7 trade reward), greenway_bioframe (Fungal Forest quest reward), underlumen_nexus (deep ruins discovery). These are defined in sol_units.json but currently unobtainable in-game.
- Add explicit patrolPath waypoint arrays to dungeon spawns that use patrol AI without paths (nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02). Currently they auto-generate basic back-and-forth paths — hand-crafted waypoints would feel more intentional.
- Add minimap quest waypoints / markers for active quest objectives. The quest panel shows text but the player has no spatial guidance toward their next goal. Even a simple colored dot on the minimap for the target room would help enormously.

## Automation & Progression

- Build the automation grid UI (Phase 1 — server-side grid state). Update automation.js to track structure placements with {x, y} coordinates instead of just counts. Update build() to accept/validate gridX, gridY. Update getStateForClient() to include grid data, blocked cells, and stats. See docs/automation_screen.md Phase 1.
- Build the automation grid UI (Phase 2 — client CSS grid). Replace the list-based auto panel with a full-screen 12x12 top-down grid placement screen. Build palette, resource sidebar, progress bar. Opened by interacting with MERIDIAN-7. See docs/automation_screen.md Phase 2.

## Content & Story

- Extend Act II Array questline deeper: add an Array overseer mini-boss in array_deep_processing, wire the array_secret_discovered flag into escalating MERIDIAN-7 demands, and add confrontation-path dialogue where the player can challenge MERIDIAN-7 about Project Autotroph.
- Begin Act III content: create nightside_passage dungeon for Sable's deep-dark guide sequence. Add Nightside expedition quest JSON (joint Ring/Unbounded/Array exploration). Wire act3_asha_alliance flag trigger in meridian_civic.json. This opens the path to the three endings.
- Add Crystal Guardian boss intro: brief scripted animation/camera effect when entering the boss room for the first time. Dedicated boss music track (or at least a distinct combat music override). The boss fight exists mechanically — it needs the presentation to match.

## Quality & Testing

- Tier 3 unit tests: physics.test.js (collision detection + resolution, wall sliding, diagonal normalization, corner cases, tight corridors). Physics bugs are hard to debug manually and the module is pure geometry — easy to test.
- Game balance pass: tune combat numbers across a full playthrough. Use the headless sim stats (damage dealt/taken, deaths, time-to-kill) to identify outliers. Energy economy is completely untuned — verify that ability costs, regen rates, and battery capacity create a satisfying loop at each game phase.
- Fix headless sim main quest timeout: the bot gets stuck after 4 rooms (9.8% coverage). Investigate whether it's a pathfinding issue, a missing trigger, or a combat bottleneck. Getting the sim to complete the main quest reliably would catch future content regressions automatically.

## Art & Audio

- Add placeholder sprites for newer monsters missing from PLACEHOLDER_ASSETS.md: dusk_crawler, crystal_guardian, garden_mite, nest_mother, shade_stalker, shade_stalker_alpha, ravine_lurker, gloom_wraith, rime_stalker, frostfang_hunter, vent_spewer, magma_brute. Update tools/generate-sprites.js to use art style guide palette hex values.
- Add per-biome ambient audio definitions to content/audio/music.json — even silent placeholder entries that the engine can reference. This prepares the audio pipeline for real assets without requiring them yet.

## Meta
- Take a look at any outstanding items or ongoing projects in the docs folder. Think carefully about the big picture. We want to make this game as fun and complete as possible. What are the best short and long term investments we can make to improve the game and add to it? If we need to spin up a new big project store a roadmap in the docs folder. If a project is done, mark it as done in its documentation so we know to stop thinking about it. This should cover testing, game quality, fun, content, theme, design, graphics, etc. Then, come up with 10-20 next tasks. Then, replace all tasks in TODOS.md (except the last one!) with those tasks.
