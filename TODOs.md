# TODOs

Prioritized task list — last refreshed 2026-03-12.

Based on headless sim analysis (mainline: stuck at proc_quarantine depth 3 `find_warlord_key`, 6/57 rooms 10.5% coverage, 0 deaths; all-quests: 10/14 complete, 1 stuck `relay_recovery`, 2 timeout `broken_signal`/`nightside_expedition`, 0 deaths/179 kills/36 of 57 rooms 63.2%; explore: 7/57 rooms 12.3%) and storyboard gap analysis. The three Spire dungeons, Lighthouse Mara, Dural Voss, the Compact General, and Greenway zones are all unbuilt — roughly 40% of the storyboard's content. Organized: fix what's broken, connect what's disconnected, improve what's built, build what's missing.

---

## 1. [opus] Fix mainline sim proc_quarantine soft-lock

The mainline sim gets stuck at `find_warlord_key` in proc_quarantine depth 3. The bot can't fight past monsters blocking the path — `move_to_position` goal doesn't yield to combat when monsters are in the way. This blocks CI and means we can't validate the main quest end-to-end. Root cause is in the headless sim bot AI, not the game engine. Fix the bot's combat-while-navigating logic so it engages monsters in its path, then verify the mainline sim completes all 28 quest steps.

## 2. [sonnet] Fix explore-mode workshop flag gate

The explore bot gets stuck at outpost_workshop's locked door requiring `engineer_briefing_complete`. This flag is deep in the main quest chain. The explore bot needs either: (a) the ability to satisfy prerequisites through NPC interaction, or (b) the sim should grant story flags when running in explore mode. This limits explore coverage to 12.3%.

## 3. [opus] Difficulty tuning pass — 0 deaths is too easy

Across all sim modes (mainline, all-quests, explore), the bot dies **zero times** while killing 179 monsters. The damage-taken-to-dealt ratio is ~14% (3703 taken / 25917 dealt). The game should feel dangerous, especially crossing the perimeter and entering the Nightside. Changes: (a) increase nightside/frost monster damage by 20-30%, (b) reduce early healing item density, (c) add more monsters to perimeter_breach and nightside_caverns chokepoints, (d) increase boss damage across the board. Re-run sim after changes and target 2-4 deaths on a mainline playthrough.

## 4. [sonnet] Connect crypt dungeons to the narrative

crypt_01 and crypt_02 are accessible from outpost_basement but no quest or NPC mentions them. Add an Old Keeper dialogue branch hinting about something stirring below the outpost, and a side quest that sends the player down. Include a lore item in crypt_02 that references the Underlumen — connecting Act 1 optional content to the Act 2 reveal.

## 5. [sonnet] Wire lighthouse_siege_arena to player-facing trigger

The lighthouse siege cooperative system is fully built but has no entry point for players. Add an NPC (or dialogue branch on Warden Holt) in outpost_perimeter that triggers the siege when the player has reached a post-ending flag. Currently this endgame content is invisible.

## 6. [sonnet] Distribute crafting materials across biome loot tables

Crafting materials (metal_casing, metal_linker, power_conduit, stabilizer_rod, focusing_lens, plasma_coil) only drop from common.json. Add biome-appropriate crafting drops to frost.json, fungal.json, geothermal.json, nightside.json, and array.json so players find materials throughout the game. Also fix undercity luddite_brawler monsters which have no loot table.

## 7. [opus] Add environmental storytelling to the Nightside path

The nightside_caverns → nightside_depths → nightside_passage → underlumen_threshold path has combat but minimal narrative atmosphere. Add: (a) 3-4 lore items referencing the Unbounded and the Spire of Vigil, (b) environmental trigger messages as the player descends ("Your sol unit flickers — something deep is pulling at its frequency"), (c) a Sable encounter in nightside_depths with dialogue about what lies deeper, (d) room-entered flavor text that builds dread. This path is the player's journey into the unknown — it needs atmosphere, not just monsters.

## 8. [opus] Wire full Array dungeon chain into quest narrative

The dayside has 5 dungeons (solar_fields → synthesis_lab → deep_processing → control_center → command_throne) but only solar_fields and deep_processing appear on quest paths. The control_center and command_throne — the Act 3 ending dungeons — are never visited during all-quests runs. Add quest steps or NPC breadcrumbs that guide players through the full chain. The Array complex should feel like a progressively deeper investigation, not two disconnected visits.

## 9. [sonnet] Level-up stat screen

When the player levels up, there's no feedback beyond a notification. Add a brief stat summary popup showing HP increase, damage bonus, and energy changes. Small engine change (new message type + client overlay) with outsized impact on the feeling of progression.

## 10. [sonnet] Weapon upgrade confirmation dialog

The disassemble button fires immediately with no confirmation. Add a choice menu ("Disassemble [weapon name]? This cannot be undone.") to prevent accidental weapon destruction. Small UX fix that prevents frustration.

## 11. [opus] Build Lighthouse Mara dungeon

Core Act 1 beat from the storyboard ("Lighthouse Mara, 2-3 hours"). Multi-floor dungeon through frozen caverns to a failing Lighthouse. Use frost_crypt tileset and nightside monsters. The damage should look structural, not raider-caused — breadcrumb for the Spire/Deep Array reveal. Include a survey marker referencing unusual geological readings. Wire into the main quest between the "cross perimeter" and "arrive Meridian" steps. First real expedition and the most impactful single content addition for Act 1.

## 12. [opus] Add Dural Voss as a named boss encounter

The luddite_warlord monster type exists but Dural Voss — the raider warlord from the storyboard — is completely absent as both an NPC and a boss. Create a `dural_voss` monster entry with retreat mechanic (flees at low HP), unique dialogue ("We didn't touch your Lighthouses"), and a dedicated encounter room. This gives Act 1's antagonist a face and plants the seed that raiders aren't the real threat.

## 13. [opus] Build Spire of Vigil — outer layer (raider stronghold)

Act 1 climax. 2-3 floors of Luddite fortifications with raider captain mini-bosses. Use nightside tileset. Include traps, fortified positions, and coordinated squads. The architecture should transition from crude raider modifications to something clearly pre-human as the player goes deeper. Wire Light Sentry ability unlock into the Spire's inner core. This is the most impactful campaign dungeon to build.

## 14. [opus] Build Greenway corridor dungeons + Spire of Winds

Act 2 setting. Agricultural zones, farming settlements under Bulwark martial law. 2-3 dungeons connecting Meridian to the Monument of Winds. Create a Compact General boss and Bulwark soldier enemy types. The Spire of Winds unlocks Hover. This makes the Act 2 political crisis tangible. Requires a new greenway tileset or adaptation of the meridian tileset.

## 15. [opus] Build Spire of Radiance + Deep Array climax

Act 3 climax. The Dayside Spire encased in Array infrastructure. Array-organic hybrid enemies, energy management puzzles, Photonic Pulse unlock. Final confrontation with the Deep Array network — the three-path choice (Sever/Restore/Subsume) with mechanically distinct endings. This completes the campaign.

## 16. [sonnet] Replace top-priority placeholder sprites

Priority replacements: player character (most-seen entity), Warden Holt, Sable, MERIDIAN-7 terminal, sol unit item, health potion. Even 6-8 hand-drawn sprites dramatically improve first impressions. Follow docs/art-style-guide.md palette and conventions.

## 17. [opus] Deep Expedition (Tier 6) cooperative content

3-4 players, 7 floors, no checkpoints. Abyssal sovereign boss requiring coordination mechanics (e.g., two players on pressure plates while others fight). Drops prismatic_core — the highest-tier generator. This is the apex endgame challenge referenced in the endgame loop design.

## 18. [sonnet] nightside_expedition quest — fix return navigation timeout

The nightside_expedition quest times out at 2400s because after reaching the underlumen_threshold, the bot can't navigate back to meridian_civic to deliver the compound to Asha. Add a fast-travel trigger (e.g., a transit point in underlumen_threshold that warps to train_station) or ensure the sim bot can path back through the Nightside chain. Currently this quest — which gates the three-path ending choice — can't be completed.
