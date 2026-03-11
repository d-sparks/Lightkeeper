TODOs

- Fix headless sim mainline regression: bot loops endlessly through quarantine dungeons instead of progressing the main quest, causing TIMEOUT at 2400s with only 6/52 rooms visited
- Wire modifier crafting engine action: crafting.json has reforge/fuse/attune recipes defined but no craft action type in server/scripting/actions.js, so MERIDIAN-7 crafting is non-functional
- Create expedition tier 4 and tier 5 loot tables in content/loot/expeditions.json — configs exist but loot tables are missing, so boss kills at high tiers drop nothing
- Wire expedition boss loot table selection so killing an expedition boss actually rolls the expedition_tier_N_boss table and drops path-specific legendaries
- Add client-side expedition HUD showing current floor number, expedition tier, and boss health bar during expedition runs
- Implement periodic auto-save during play so server crashes don't lose progress (currently only saves on disconnect)
- Place feral_hound_alpha and frostfang_alpha as rare spawns in nightside_caverns and frost proc templates — defined with pack_leader AI but never placed in any dungeon
- Add post-ending world state changes: outpost_entrance and outpost_comms tile/NPC shifts based on chose_path flags, registrar_hollis reaction dialogue, endgame_active flag gating
- Add worldmap connection for Array Extraction Outpost from dayside_solar_fields so Phase 3 investigation quest dungeon is reachable
- Add minimap quest waypoints so players have spatial guidance toward their current objective
- Implement structure adjacency bonuses for automation grid (silicon_refinery boosting adjacent harvesters) — data format exists but calculation not wired
- Expand automation grid to 16x16 at automation level 6 as designed in endgame-loop.md (currently fixed at 12x12)
- Add patrol path waypoints to spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, and crypt_02 that use patrol AI but lack explicit paths
- Improve player onboarding flow: first-time tutorial prompts for combat, sol grid, and NPC interaction beyond the existing WASD/interact hints
- Replace remaining placeholder monster sprites with proper pixel art per art-style-guide.md: nightside creatures, ice enemies, fire enemies, fungal enemies, and bosses
- Add 1-pixel dark outlines and top-left lighting pass across all entity sprites per art-style-guide conventions
