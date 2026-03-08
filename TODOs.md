TODOs

## Human feedback / inputs
- [sonnet] If we're going to advertise WASD as working, it should at least be orthogonal to the screen - but it ends up being diagonal/isometric.
- [sonnet] The right arrow after a quest name in the minimap is misleading. The arrow that points to the exit on the minimap is nice, but, let's not make it a right arrow. Just make it a circle or dot?
- [sonnet] There's too much dialogue when entering random rooms. Let's prune most of that, unless it's good hint for a quest or exceptionally impactful for flavor/feel.
- [opus] Major project: I want bigger levels. It should take 10x longer or more to clear areas in between quest objectives. To support 10x bigger areas, we may need to stream chunks of room maps instead of sending the entire room as soon as you enter it. Come up with a design for this and implement it. The player can start by not seeing the entire map until they've explored it. (Eventually we'll save a digest of what areas of the map have been revealed to a player, and it will persist with their play sessions, once play sessions persist.)
- [opus] Make the areas of outpost balor larger. Make the dark perimeter leading out to the station significantly longer.
- [opus] Slow enemies down a bit but give them more abilities such as lunge attacks, stun moves, etc. Aiming to make play funner and more dynamic while also being slightly slower with less kiting.
- [opus] Let's introduce sessions to our play. On the main page, we should have the option to either select an existing player from a dropdown or create a new one. For now the create a new one can have a placeholder UI that just lets us select the player's name. We'll need a way of persisting their information: what room / coords they were last in, any flags, inventory, and what parts of map have been revealed to them.
- [opus] Add a "light sentry" sol mod which places a light sentry. The light sentry will last until the next light sentry is placed (maybe at later levels we can have multiple light sentries active). It will project a beam which auto aims at the nearest enemy slowing and damaging them over time. Later we'll also use light sentry for light/mirror puzzles. Add graphics for this and make it awesome!

## Game Feel & Polish

- [sonnet] Wire biome loot tables (frost.json, geothermal.json, fungal.json, outpost.json) to dungeon chests/crates via triggers. The loot tables and engine exist — interactable containers just don't use them. Add lootTable-based item drops when players interact with chest/crate tiles in each biome.
- [sonnet] Add biome loot table references to procedural dungeon templates (proc_frost_crypt, proc_fungal_forest, proc_quarantine, proc_quarantine_deep). Procedural floors should drop biome-appropriate loot from chests.
- [opus] Wire the patrol field on dungeon monsterSpawns into the patrol AI behavior. The field exists in dungeon JSON but the engine ignores it — patrol monsters currently wander randomly instead of following paths.

## Automation & Progression

- [opus] Build the automation grid UI (Phase 1 — server-side grid state). Update automation.js to track structure placements with {x, y} coordinates instead of just counts. Update build() to accept/validate gridX, gridY. Update getStateForClient() to include grid data, blocked cells, and stats. See docs/automation_screen.md Phase 1.
- [opus] Build the automation grid UI (Phase 2 — client CSS grid). Replace the list-based auto panel with a full-screen 12x12 top-down grid placement screen. Build palette, resource sidebar, progress bar. Opened by interacting with MERIDIAN-7. See docs/automation_screen.md Phase 2.
- [sonnet] Add dungeon triggers/loot for acquiring new sol units. The 4 non-starter sol units (nightcaster_frame in Frost Crypts, array_precision_core from MERIDIAN-7 trade, greenway_bioframe in Fungal Forests, underlumen_nexus in deep ruins) need actual in-game acquisition paths — chest drops, NPC rewards, or quest completions.

## Content & Story

- [opus] Create a Crystal Guardian boss encounter with unique AI. Currently uses generic melee_chase. Design a multi-phase fight: phase 1 melee, phase 2 adds crystal shard projectiles, phase 3 summons minions. This would be the game's first real boss and set the pattern for future encounters.
- [sonnet] Extend Act II: wire array_secret_discovered flag into MERIDIAN-7 confrontation dialogue at the Hub and into Sable/Asha/Council NPC dialogue for Act III progression. The Array complex reveals a secret — NPCs should react to it.
- [sonnet] Gate array_synthesis_lab access behind umbrasite quest completion and wire the array_clearance_badge as a key requirement for array_deep_processing. Currently these areas are freely accessible, undermining the quest progression.
- [sonnet] Add loot tables for array_sentinel and array_fabricator monsters (currently undefined). Generate placeholder sprites for these Array construct monsters.

## Quality & Testing

- [sonnet] Implement Tier 1 unit tests using Node's built-in test runner: flag-store.test.js, event-bus.test.js, automation.test.js. These are standalone logic modules with zero mocks needed — highest value per effort. See docs/TESTING.md for the full plan.
- [sonnet] Display sol unit innateBonus info (perk name and description) on the sol grid screen. Players should understand what makes each sol unit different when they view their grid.

## Meta
- [opus] Take a look at any outstanding items or ongoing projects in the docs folder. Think carefully about the big picture. We want to make this game as fun and complete as possible. What are the best short and long term investments we can make to improve the game and add to it? If we need to spin up a new big project store a roadmap in the docs folder. If a project is done, mark it as done in its documentation so we know to stop thinking about it. This should cover testing, game quality, fun, content, theme, design, graphics, etc. Consider running a few tests like the headless sim or content checker. Then, come up with 10-20 next tasks. Prefix each task with [sonnet] or [opus] — use [sonnet] for straightforward content additions, JSON wiring, simple bug fixes, and mechanical tasks; use [opus] for architecture changes, complex features, AI design, and tasks requiring judgment. Then, replace all tasks in TODOS.md (except the last one!) with those tasks.
