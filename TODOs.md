# TODOs

Prioritized task list — last refreshed 2026-03-12.

Based on headless sim analysis (mainline: 25min/110 kills/0 deaths/28 of 57 rooms; all-quests: 2 soft-locks; explore: stuck at workshop flag gate) and storyboard gap analysis. Organized by what moves the game closest to "complete": fix what's broken, connect what's disconnected, build what's missing.

---

## 1. [opus] Fix phase3_investigation return navigation

After completing steps in underlumen_threshold/array_extraction_outpost, the phase3_investigation quest asks the player to return to meridian_civic to deliver evidence. The sim bot gets stuck because there's no efficient return path from deep Nightside back to Meridian. Add a fast-travel mechanism (e.g., a transit trigger in underlumen_threshold that warps to train_station) or add navigation waypoints the bot can follow.

## 2. [sonnet] Fix explore-mode workshop door gate

The explore bot gets permanently stuck at the outpost_workshop locked door requiring `engineer_briefing_complete`. This flag only gets set deep in the main quest chain (after quarantine wing, sol unit acquisition, damage booster equip, and engineer dialogue). The explore bot needs the ability to earn story flags through NPC interaction or the door needs a bypass for exploration purposes.

## 3. [sonnet] Distribute crafting materials across biome loot tables

Crafting materials (metal_casing, metal_linker, power_conduit, stabilizer_rod, focusing_lens, plasma_coil) only drop from common.json. Add biome-appropriate crafting drops to frost.json, fungal.json, geothermal.json, nightside.json, and array.json so players find materials throughout the game. Also fix undercity luddite_brawler monsters which have no loot table at all.

## 4. [opus] Connect crypt dungeons to the narrative

crypt_01 and crypt_02 are accessible from outpost_basement but completely disconnected from any quest path or story beat. The 28/57 room coverage on mainline means half the game's content is invisible. Add a side quest (NPC hint from the Old Keeper about something stirring below the outpost) or main quest breadcrumb that sends players to the crypts. Include lore items that foreshadow the Underlumen.

## 5. [opus] Add environmental storytelling to Nightside path

The nightside_caverns → nightside_depths → nightside_passage → underlumen_threshold path has combat but minimal narrative. Add: (a) lore items referencing the Unbounded and the Spire of Vigil, (b) Sable encounter with dialogue about what lies deeper, (c) triggers that show the player's sol unit reacting to the ancient substrate, (d) environmental details that build dread and wonder. This path is the player's journey into the unknown — it needs atmosphere, not just monsters.

## 6. [opus] Build Lighthouse Mara dungeon

Core Act 1 beat (storyboard: "Lighthouse Mara, 2-3 hours"). Multi-floor dungeon through frozen caverns to a failing Lighthouse. Use frost_crypt tileset and nightside monsters. The damage should look structural, not raider-caused — breadcrumb for the Spire/Deep Array reveal. Include a survey marker referencing unusual geological readings. Wire into main quest between the "cross perimeter" and "arrive Meridian" steps. This is the first real expedition and the most impactful single content addition for Act 1.

## 7. [opus] Add Dural Voss as a named boss encounter

The luddite_warlord monster type exists but Dural Voss — the raider warlord from the storyboard — needs to be a unique encounter. Create a `dural_voss` monster entry with retreat mechanic (flees at low HP), unique dialogue ("We didn't touch your Lighthouses"), and a dedicated dungeon room deep in the Nightside. This gives Act 1's antagonist a face and plants the seed that raiders aren't the real threat.

## 8. [opus] Difficulty tuning pass

The mainline sim completes with **0 deaths** across 110 monster kills. The game should feel dangerous — especially crossing the dark perimeter and entering the Nightside. Consider: (a) increasing monster damage in nightside/frost biomes by 15-25%, (b) reducing healing item availability in early zones, (c) adding more monsters to key choke-point rooms, (d) ensuring the perimeter crossing feels like a gauntlet. Test with the sim after changes.

## 9. [opus] Wire full Array dungeon chain into quest narrative

The dayside has 5 dungeons (solar_fields → synthesis_lab → deep_processing → control_center → command_throne) but only solar_fields and deep_processing appear on the mainline quest path. The control_center and command_throne — which are the Act 3 ending dungeons — are never visited during all-quests runs. Add quest steps or triggers that pull players through the full chain, making the Array complex feel like a progressively deeper investigation rather than two disconnected visits.

## 10. [sonnet] Level-up stat screen

When the player levels up, show a stat summary popup displaying HP increase, damage bonus, energy changes, etc. Currently there's no feedback beyond the level-up notification. This is a small engine change (new message type + client overlay) with outsized impact on the feeling of progression.

## 11. [sonnet] Weapon upgrade confirmation dialog

The disassemble button fires immediately with no confirmation. Add a choice menu ("Disassemble [weapon name]? This cannot be undone.") to prevent accidental weapon destruction.

## 12. [opus] Build Spire of Vigil — outer layer (raider stronghold)

Act 1 climax. 2-3 floors of Luddite fortifications with raider captain mini-bosses. Use quarantine/nightside tileset. Include traps, fortified positions, and coordinated squads. The architecture should transition from crude raider modifications to something clearly pre-human as the player goes deeper. This gives Act 1 a proper climax dungeon.

## 13. [opus] Build Spire of Vigil — inner layer (ancient core)

Underlumen architecture. Puzzle rooms testing spatial awareness (place light sources to hold zones). The player's sol unit resonates with the core and permanently unlocks Light Sentry. Include sensor logs showing Array energy signatures — the key reveal that something else activated this Spire. Wire the ability unlock into the sol grid system (currently abilities come from MERIDIAN-7 trades; keep those as alternates).

## 14. [opus] Build Greenway corridor dungeons

Act 2 setting. Agricultural zones, cultivated landscapes, farming settlements under Bulwark martial law. 2-3 dungeons connecting Meridian to the Monument of Winds. Adapt the meridian tileset or create a new greenway tileset. Include: civilian NPCs caught between military occupation and daily life, Compact soldiers uncomfortable with their orders, supply line disruption content. This makes the Act 2 political crisis tangible instead of purely dialogue-driven.

## 15. [opus] Build Spire of Winds (Monument of Winds)

Act 2 climax. Outer layer: Bulwark military fortress with Compact soldiers and mechanized defenses. Inner layer: vertical architecture with shafts, bridges, and wind current puzzles. Unlocks Hover ability. The Act 2 revelation happens here: when the core activates, Array support systems begin scanning autonomously — the Deep Array reveals itself.

## 16. [sonnet] Replace top-priority placeholder sprites

Priority replacements: player character (most-seen entity), Warden Holt, Sable, MERIDIAN-7 terminal, sol unit item, health potion. Even 6-8 hand-drawn sprites dramatically improve first impressions. Follow docs/art-style-guide.md palette and conventions.

## 17. [opus] Build Spire of Radiance + Deep Array climax

Act 3 climax. The Dayside Spire encased in Array infrastructure. Array-organic hybrid enemies, energy management puzzles, Photonic Pulse unlock. Final confrontation with the Deep Array network — the three-path choice (Sever/Restore/Subsume) with mechanically distinct endings. This completes the campaign.

## 18. [opus] Deep Expedition (Tier 6) cooperative content

3-4 players, 7 floors, no checkpoints. Abyssal sovereign boss requiring coordination mechanics (e.g., two players on pressure plates while others fight). Drops prismatic_core — the highest-tier generator. This is the apex endgame challenge referenced in the endgame loop design.
