TODOs

## Game Feel & Core Loop (Highest Impact — Make It Fun)

- Add placeholder sound effects for core actions (weapon_attack, ability_fire, monster_hit, monster_death, item_pickup, door_open, floor_transition, player_hurt) using Web Audio API synthesized tones. Wire them into client/audio.js. The audio system exists — it just needs content. Even simple beeps/clicks dramatically improve the experience.
- Implement death penalty: when the player dies, drain 25-50% of current energy and drop one random non-quest item. Respawn at the room entrance. This completes the risk/reward loop — dungeon runs should feel meaningful. Dying should sting, not enrage.

## Content Wiring (Stuff Built But Not Connected)

- Add dungeon triggers and loot drops for acquiring the 4 non-starter sol units: nightcaster_frame (Frost Crypts chest/boss drop), array_precision_core (MERIDIAN-7 trade reward), greenway_bioframe (Fungal Forest quest reward), underlumen_nexus (deep ruins discovery). These are defined in sol_units.json but currently unobtainable in-game.

## Automation & Progression

- Build the automation grid UI (Phase 2 — client CSS grid). Replace the list-based auto panel with a full-screen 12x12 top-down grid placement screen. Build palette, resource sidebar, progress bar. Opened by interacting with MERIDIAN-7. See docs/automation_screen.md Phase 2.

## Quality & Testing

- Fix headless sim main quest timeout: the bot gets stuck after 4 rooms (9.8% coverage). Investigate whether it's a pathfinding issue, a missing trigger, or a combat bottleneck. Getting the sim to complete the main quest reliably would catch future content regressions automatically.

## Art & Audio

- Add placeholder sprites for newer monsters missing from PLACEHOLDER_ASSETS.md: dusk_crawler, crystal_guardian, garden_mite, nest_mother, shade_stalker, shade_stalker_alpha, ravine_lurker, gloom_wraith, rime_stalker, frostfang_hunter, vent_spewer, magma_brute. Update tools/generate-sprites.js to use art style guide palette hex values.
- Add per-biome ambient audio definitions to content/audio/music.json — even silent placeholder entries that the engine can reference. This prepares the audio pipeline for real assets without requiring them yet.

## Meta
- Take a look at any outstanding items or ongoing projects in the docs folder. Think carefully about the big picture. We want to make this game as fun and complete as possible. What are the best short and long term investments we can make to improve the game and add to it? If we need to spin up a new big project store a roadmap in the docs folder. If a project is done, mark it as done in its documentation so we know to stop thinking about it. This should cover testing, game quality, fun, content, theme, design, graphics, etc. Then, come up with 10-20 next tasks. Then, replace all tasks in TODOS.md (except the last one!) with those tasks.
