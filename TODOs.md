TODOs

- Fix headless sim discover_array_secret blocker so CI mainline testing can validate the full quest through Act III
- Implement expedition multi-floor progression: floor exits chain to next generated floor with the same scaling, final floor spawns a boss from bossPool, completion sets expedition_tier_N_cleared and clears expedition_active
- Add minimap quest waypoints showing colored dots for active quest objective locations to give players spatial guidance
- Place feral_hound_alpha and frostfang_alpha as rare spawns in nightside_caverns and frost-themed procedural templates
- Place skeleton_archer in crypt_01 and crypt_02 with a new loot table entry in content/loot/outpost.json
- Wire new tilesets (dark_city, quarantine, outpost) that exist as PNGs into tileset JSON definitions and assign them to appropriate dungeons
- Add periodic auto-save during play so crashes don't lose progress (currently only saves on disconnect)
- Implement modifier crafting system: craft action type in actions.js, crafting.json recipes for reforge/fuse/attune, MERIDIAN-7 dialogue branch gated on endgame_active
- Add expedition silicon cost deduction at start and death penalty (forfeit floor loot, return to meridian_station)
- Add explicit patrolPath waypoints to monsters in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, and crypt_02 that have patrol AI but no paths
- Wire unlockFlag checking in the loot resolver so path-specific legendary modifiers only drop when the player has chosen the corresponding ending path
- Add post-ending Sable expedition dialogue for Shutdown and Merge paths where she serves as expedition quest-giver
- Implement boss affixes system: data-driven affix pool in content/expeditions/affixes.json applied to expedition bosses at Tier 4+
- Throttle getOverlayedMapData calls from every tick to every N ticks to reduce per-player server load on large maps
- Add Phase 3 investigation quest after Autotroph confrontation to make the path choice mechanically meaningful beyond NPC dialogue
- Replace placeholder sprites with proper pixel art following docs/art-style-guide.md, starting with the most-seen entities (player characters, common outpost monsters, key NPCs)
- Design and implement automation levels 6-10 with new structures (silicon_refinery, auto_turret, fabricator, expedition_beacon) and milestone rewards
