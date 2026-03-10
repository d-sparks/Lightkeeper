TODOs

- Fix headless sim visit_civic_center blocker: bot reaches meridian_civic but cannot interact with registrar_hollis, blocking CI mainline testing past step 12. Debug NPC pathfinding/interaction radius logic in the bot brain
- Wire the picked_up_iron_key flag to gameplay: content validator reports this flag is set in crypt_01 but never checked anywhere. Add an Old Keeper or NPC dialogue variant that reacts to it
- Spawn feral_hound_alpha and frostfang_alpha in dungeons: pack_leader AI and aura buffs are fully implemented but neither alpha monster is placed in any dungeon. Add them as rare spawns in nightside_caverns and frost-themed proc templates
- Spawn skeleton_archer in dungeons and add a loot table: defined monster with no dungeon placement and no loot table. Place in crypt_01/crypt_02 and add a common-tier loot entry
- Rebalance late-game monster XP rewards: magma_brute (240 HP), frost_warden (280 HP), and elder_sporecap (320 HP) had HP scaled 1.8-2.3x but XP was not proportionally adjusted
- Add minimap quest waypoints: no spatial guidance exists for quest objectives. Show colored dots on the minimap for active quest goal locations
- Add explicit patrolPath waypoints to remaining patrol spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, and crypt_02
- Implement Expedition Tier 1-3 system: the endgame loop spec is complete (docs/endgame-loop.md) but nothing is implemented. Start with expedition board NPC, tier config JSONs, and monster stat scaling at spawn time
- Add endgame_active flag wiring: chose_path_* flags in meridian_station room triggers should set endgame_active to gate expedition and post-ending content
- Add post-ending MERIDIAN-7 dialogue for endgame expedition access and modifier crafting introduction
- Implement modifier crafting (reforge/fuse) at MERIDIAN-7: add a craft action type to server/scripting/actions.js and create content/entities/crafting.json with recipes
- Add periodic auto-save during play: currently sessions only save on disconnect, risking progress loss on crashes
- Add a delete character button on the session select screen
- Playtest and tune energy pacing at mid-game: improved_generator at 5/s may make Sol Beam trivial, and Pulse Rifle DPS (60) is close to Sol Beam (~84) making the rare weapon feel unrewarding
- Automation Phase 5 polish: add tooltips showing structure stats, placement sound effects, and mobile/touch grid interaction support
- Add outer_expanse patrol paths: many monster spawns in the 200x120 map lack explicit patrolPath waypoints, making AI behavior static across the large map
- Create ending-path-specific legendary modifiers: add the 6 path-specific legendaries defined in endgame-loop.md to sol_components.json with proper unlock gating
- Optimize iso renderer for very large maps: skip iteration of unrevealed chunk regions entirely instead of checking each tile individually
