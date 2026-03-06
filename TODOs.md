TODOs

## Bugs & Broken Content
- Fix all 6 content validation errors listed in docs/NEXT_TODOS.md: add missing "sol_cone" component to sol_components.json, add triggers that set the 4 unchecked flags (warlord_defeated, damage_booster_equipped, has_traded_meridian, umbral_seed_dark_exposed), and spawn or give the missing supply_manifest item for the lost_supplies quest.
- ~~Wire lootTable references onto all monster definitions in monsters.json.~~ DONE — all 25 combat monsters have lootTable refs, 22 biome-specific loot tables exist.

## Loot & Rewards
- Create biome-specific loot tables in content/loot/: frost.json, geothermal.json, fungal.json, outpost.json. Each should drop biome-appropriate items and faction-flavored sol modifiers. The loot engine already handles weighted rolls and drop chances.
- Add sol modifier drops to loot tables. Currently modifiers are only obtainable through scripted events. Players should find them as dungeon loot — common mods frequently, rare/epic mods rarely. This is the endgame chase.

## Monster Deployment
- Deploy the newer monster types (shadow_ambusher, tunnel_creeper, feral_hound, rime_stalker, frostfang_hunter, vent_spewer, sporecap_shambler, mycelium_lurker, fungal_sprayer) into actual dungeon monsterSpawns. They're defined in monsters.json with cool AI but aren't placed in any dungeon floors. Place them in thematically appropriate locations.
- Generate placeholder sprites for all monster types that currently lack them. Run tools/generate-sprites.js to create sprites and update PLACEHOLDER_ASSETS.md.

## Audio & Game Feel
- Add placeholder sound effects for core game actions and wire them into client/audio.js. Target actions: weapon_attack, ability_fire, monster_hit, monster_death, item_pickup, door_open, floor_transition, player_hurt. Even simple synthesized tones will dramatically improve the feel. The audio system already exists in client/audio.js.
- Add a combat juice polish pass: ensure ambush monsters have a fade-in reveal effect on client, tint monster projectiles by monster type (not all blue), and add variety to monster death animations.

## Automation & Progression
- Build the automation grid UI (Phase 1 — server-side grid state). Update automation.js to track structure placements with {x, y} coordinates instead of just counts. Update build() to accept and validate gridX, gridY. Update getStateForClient() to include grid data. See docs/automation_screen.md Phase 1 for full spec.
- Build the automation grid UI (Phase 2 — client CSS grid). Replace the list-based auto panel with a full-screen 12x12 top-down grid placement screen. Build palette at bottom, resource/stats sidebar, progress bar. Opened by interacting with MERIDIAN-7. See docs/automation_screen.md Phase 2 for full spec.
- Design and define the 5-6 sol unit variants in sol_units.json. Each needs distinct grid dimensions, innate perks, and a location where it's found. See progression-system.md open question #1. This is key to making progression feel meaningful.

## Content & World
- Add environmental hazards to biome dungeons: cold damage in nightside/frost zones, heat damage in geothermal zones, poison spore damage in fungal zones. Use the existing darkness damage mechanic as a pattern — hazards should tick damage on players in affected tiles unless they have appropriate protection.
- Extend Act II content: add 1-2 new dungeon floors inside the Array complex that the player can explore after the umbrasite retrieval quest. These should hint at the Array's true nature (manufacturing bio-catalyst substitutes) per the storyboard. Include environmental lore items and a new NPC or terminal interaction.
- Add a new side quest in the Meridian City area. Meridian has 12 dungeon rooms and 6+ NPCs but only a few quests active there. A city-based quest (investigation, fetch, or social) would make the city feel more alive.

## Quality & Testing
- Fix the client sol grid UI to display healOnHit, energyCostReduction, and boostedEnergyRegen modifier effects in tooltips. These values are sent from the server but not shown to the player, making modifier placement feel opaque.
- Add a world map or zone overview screen. The player currently has no way to see the bigger picture of connected dungeons. Even a simple text-based list of visited locations with navigation would help orientation.

## Meta
- Take a look at any outstanding items or ongoing projects in the docs folder. Think carefully about the big picture. We want to make this game as fun and complete as possible. What are the best short and long term investments we can make to improve the game and add to it? If we need to spin up a new big project store a roadmap in the docs folder. If a project is done, mark it as done in its documentation so we know to stop thinking about it. This should cover testing, game quality, fun, content, theme, design, graphics, etc. Then, come up with 10-20 next tasks. Then, replace all tasks in TODOS.md (except the last one!) with those tasks.
