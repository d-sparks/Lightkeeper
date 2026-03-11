TODOs

- [opus] Fix headless sim discover_array_secret blocker so CI mainline testing can validate the full quest through Act III
- [opus] Implement expedition multi-floor progression: floor exits chain to next generated floor with the same scaling, final floor spawns a boss from bossPool, completion sets expedition_tier_N_cleared and clears expedition_active
- [sonnet] Place skeleton_archer in crypt_01 and crypt_02 with a new loot table entry in content/loot/outpost.json
- [sonnet] Add periodic auto-save during play so crashes don't lose progress (currently only saves on disconnect)
- [sonnet] Add expedition silicon cost deduction at start and death penalty (forfeit floor loot, return to meridian_station)
- [sonnet] Wire unlockFlag checking in the loot resolver so path-specific legendary modifiers only drop when the player has chosen the corresponding ending path
- [sonnet] Add post-ending Sable expedition dialogue for Shutdown and Merge paths where she serves as expedition quest-giver
- [opus] Implement boss affixes system: data-driven affix pool in content/expeditions/affixes.json applied to expedition bosses at Tier 4+
- [opus] Add Phase 3 investigation quest after Autotroph confrontation to make the path choice mechanically meaningful beyond NPC dialogue
- [opus] Replace placeholder sprites with proper pixel art following docs/art-style-guide.md, starting with the most-seen entities (player characters, common outpost monsters, key NPCs)
- [opus] Design and implement automation levels 6-10 with new structures (silicon_refinery, auto_turret, fabricator, expedition_beacon) and milestone rewards
