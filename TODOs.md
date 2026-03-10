TODOs

- Implement death penalty: drain 25% energy, drop non-quest items per dropBehavior, respawn at room entrance. Server-side change in game-loop.js death handler. Without stakes, dungeon runs have no tension
- Wire automation Phase 3 screen access: add openAutomation scripting action, MERIDIAN-7 interaction trigger, and client handler for AUTO_STATE with openScreen flag. The full automation grid UI (Phases 1-2) is built but players can never open it
- Fix headless sim junction_cleared blockage: bot reaches station_junction but can't interact with the junction box at tile (7,7). Either teach doInteractNearest to navigate before interacting, or add kill_monsters + move_to_position goals for interactable steps. Blocks CI mainline testing
- Fix content validator error: signal_coordinates item is referenced in outer_expanse itemSpawns but missing from items.json. Add the item definition or fix the reference
- Assign correct tilesets to dungeons: outpost_* dungeons should use "outpost" tileset, station_* should use "station", meridian_* should use "meridian" instead of generic "crypt". This activates per-biome music already wired in the engine
- Add post-choice NPC dialogue for Act III endings: Asha, Sable, and MERIDIAN-7 need dialogue variants reacting to chose_path_shutdown/merge/control flags. Currently the world doesn't respond to the player's climactic choice
- Add Unbounded elder NPC in deep Nightside: referenced by Sable but doesn't exist. Provides Underlumen lore and gates the merge ending path
- Add loot tables for Act III monsters: threshold_watcher, abyssal_tendril, and threshold_keeper have zero loot. Create nightside/underlumen-themed loot tables with thematic drops
- Add minimap quest waypoints: colored dots on the minimap for active quest objectives. Players currently have no spatial guidance for where to go next
- Improve blaster hitboxes: shots that visually should hit are missing. Make collision detection more generous for projectile-vs-monster checks
- Clear movement input on room entry: click-to-move from the previous room carries over causing unnatural movement into the new room. Reset input state on floor transition
- Wire outer_expanse east exit: stairs at (198,60) have no destination. Connect to a future Act III area or create a bidirectional loop
- Add monster patrol paths to existing dungeons: many spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, and crypt_02 lack patrolPath waypoints, making patrol AI underutilized
- Place single-use battery chips as energy checkpoints throughout longer dungeons so players can sustain abilities during extended runs
- Wire rechargeable_battery_chip into obtainable loot tables so players can earn permanent battery upgrades outside the automation milestone system
- Add fog-of-war edge gradient: smooth visual transition at the border of revealed/unrevealed chunks instead of a hard cut
- Update Guard Pell dialogue to reference "field cells" or "battery" instead of "charge" to match the current battery system terminology
- Add visual feedback when a single-use battery is consumed: flash or sound cue so the player notices the permanent energy loss
