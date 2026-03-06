TODOs

## Polish & Game Feel
- Add combat juice: floating damage numbers, hit flash on monsters, brief screen shake on player damage, death animations for monsters (fade/collapse instead of instant despawn). Combat is the core loop and needs to feel satisfying.
- Add more monster AI behaviors beyond melee_chase and ranged_kite. Implement "ambush" (hidden until player is close), "patrol" (follows a waypoint path), and "pack" (group coordination where nearby monsters converge). Wire these as new ai keywords in game-loop.js.
- Improve player onboarding: the first 2 minutes of gameplay should teach movement, interaction, and combat without walls of text. Add a brief "press WASD to move" overlay that dismisses on first input, and a "press E near NPCs to talk" prompt that dismisses after first interaction.

## Content & Variety
- Add 3-4 new monster types for the Nightside biome (frost crypts / geothermal vents themes from storyboard). Each should have distinct sprites, stats, and AI behaviors. Define in monsters.json.
- Add 5+ new sol grid modifiers at various rarity tiers (uncommon through epic). Include faction-flavored mods from the progression doc: Dark mods (bonus in unlit areas), Bio mods (heal on hit), Light mods (energy efficiency). Define in sol_components.json.
- Create 2 new procedural dungeon templates: one for "frost_crypt" biome and one for "fungal_forest" biome, each with distinct monster pools, tile aesthetics, and item drops. Add to content/dungeons/templates/.
- Add loot drops to monsters. Currently monsters don't drop items on death. Implement a loot table system: each monster type can reference a loot table (JSON in content/loot/) with weighted item rolls and drop chance. The engine picks from the table on kill.

## Systems & Features
- Build the automation grid UI per docs/automation_screen.md. Replace the current list-based auto panel with the full-screen top-down grid placement screen opened by interacting with MERIDIAN-7. Phase 1: server-side grid state with x,y placements. Phase 2: client CSS grid UI with build palette.
- Hook content-validator.js into npm test so content regressions are caught. Add "test" script to package.json that runs `node tools/content-validator.js` and fails on errors. Optionally also run the headless sim mainline quest.
- Implement item rarity visual distinction. Items and sol components have rarity tiers but the UI doesn't reflect this. Add colored borders/text (white=common, green=uncommon, blue=rare, purple=epic, gold=legendary) to inventory items and sol grid components.

## Story & World
- Begin Act II quest content: create a quest where MERIDIAN-7 asks the player to retrieve umbrasite from a new Nightside dungeon in exchange for an advanced sol component. This introduces the Array's interest in umbrasite and the deeper trade relationship. Requires 1-2 new dungeon floors + quest JSON.
- Add environmental storytelling to existing dungeons: place 3-5 readable lore items (journals, inscriptions, terminal logs) across Outpost Balor and Perimeter dungeons that hint at the world's history, the Unbounded, and the Array's nature. These are item pickups with flavor text.
- Expand Sable's presence: add dialogue branches to the existing Sable NPCs that react to player quest progress (post-train arrival, post-dayside visit). Use dialogueRules conditions to gate deeper lore reveals.

## Audio & Art
- Add placeholder sound effects for core actions: weapon attack, ability fire, monster hit, monster death, item pickup, door open, level transition. Even simple synthesized beeps/clicks will dramatically improve game feel. Wire into client/audio.js.
- Create a consistent color palette and sprite style guide document. The current placeholder sprites are generated but inconsistent. Define a target aesthetic (16x16, limited palette, specific style reference) to guide future art replacement.

## Testing & Quality
- Run the headless sim (tools/headless-sim.js --mainline) and fix any soft locks or quest progression failures it finds. Document the results. If the sim passes cleanly, note that in docs/ROADMAP.md.
- Review and answer the open questions in docs/progression-system.md: decide on modifier-boosts-generator adjacency, grid component limits, and modifier stacking rules. Update the doc with decisions and implement any engine changes needed.

## Meta
- Take a look at any outstanding items or ongoing projects in the docs folder. Think carefully about the big picture. We want to make this game as fun and complete as possible. What are the best short and long term investments we can make to improve the game and add to it? If we need to spin up a new big project store a roadmap in the docs folder. If a project is done, mark it as done in its documentation so we know to stop thinking about it. This should cover testing, game quality, fun, content, theme, design, graphics, etc. Then, come up with 10-20 next tasks. Then, replace all tasks in TODOS.md (except the last one!) with those tasks.
