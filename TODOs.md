TODOs

- [opus] Fix headless sim mainline regression: bot loops endlessly through quarantine dungeons instead of progressing the main quest, causing TIMEOUT at 2400s with only 6/52 rooms visited
- [sonnet] Create expedition tier 4 and tier 5 loot tables in content/loot/expeditions.json — configs exist but loot tables are missing, so boss kills at high tiers drop nothing
- [sonnet] Wire expedition boss loot table selection so killing an expedition boss actually rolls the expedition_tier_N_boss table and drops path-specific legendaries
- [opus] Add client-side expedition HUD showing current floor number, expedition tier, and boss health bar during expedition runs
- [opus] Add post-ending world state changes: outpost_entrance and outpost_comms tile/NPC shifts based on chose_path flags, registrar_hollis reaction dialogue, endgame_active flag gating
- [sonnet] Add minimap quest waypoints so players have spatial guidance toward their current objective
- [sonnet] Implement structure adjacency bonuses for automation grid (silicon_refinery boosting adjacent harvesters) — data format exists but calculation not wired
- [sonnet] Expand automation grid to 16x16 at automation level 6 as designed in endgame-loop.md (currently fixed at 12x12)
- [sonnet] Add patrol path waypoints to spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, and crypt_02 that use patrol AI but lack explicit paths
- [opus] Improve player onboarding flow: first-time tutorial prompts for combat, sol grid, and NPC interaction beyond the existing WASD/interact hints
- [sonnet] Replace remaining placeholder monster sprites with proper pixel art per art-style-guide.md: nightside creatures, ice enemies, fire enemies, fungal enemies, and bosses
- [sonnet] Add 1-pixel dark outlines and top-left lighting pass across all entity sprites per art-style-guide conventions
