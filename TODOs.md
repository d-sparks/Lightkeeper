# TODOs

Prioritized task list — last refreshed 2026-03-12.

Based on headless sim analysis (mainline: completes all 22 quest steps, 28/57 rooms 49.1% coverage, 121 kills, 0 deaths; all-quests: stuck in infinite proc_quarantine loop, never reaches side quests; explore: 7/57 rooms 12.3%, flag-gated at outpost_workshop). The three Spire dungeons, Lighthouse Mara, Greenway zones, and Dural Voss boss encounter remain unbuilt — roughly 40% of the storyboard's content. 32 rooms are never visited in mainline. Organized: fix what's broken, connect what's disconnected, build what's missing.

---

## 1. [opus] Fix all-quests sim proc_quarantine infinite loop

The all-quests sim enters proc_quarantine and loops endlessly through depths 1-2, returning to outpost_entrance each cycle but never progressing to side quests. The mainline sim now completes proc_quarantine correctly, so the regression is specific to how all-quests mode manages the quest queue after completing mainline quarantine steps. Likely the bot re-enters quarantine trying to satisfy a side quest objective that doesn't exist there. Fix: ensure the bot marks quarantine-related goals as satisfied and moves on to the next quest in the queue. Verify all 14 quests are attempted after the fix.

## 2. [sonnet] Fix explore-mode flag gating — 12.3% coverage

The explore bot hits outpost_workshop's locked door requiring `engineer_briefing_complete` and can't proceed past 7 rooms. This flag is deep in the main quest chain. Options: (a) grant story-progression flags automatically in explore mode, (b) teach the explore bot to interact with NPCs to earn flags, or (c) add an explore-mode bypass that opens flag-gated doors. The sim should be able to reach 80%+ of rooms in explore mode to be a useful content validator.

## 3. [opus] Difficulty tuning — 0 deaths across all modes

The bot never dies: mainline dealt 9795 damage, took only 1117 (11.4% ratio), used only 35 healing. The game should feel dangerous crossing the perimeter and entering the Nightside. Changes: (a) increase nightside/frost monster damage by 25-35%, (b) reduce early healing item drops by 40%, (c) add 2-3 more monsters to perimeter_breach and nightside_caverns chokepoints, (d) increase boss special attack damage multipliers. Target: 2-4 deaths on a mainline playthrough.

## 4. [sonnet] Connect crypt dungeons to narrative

crypt_01 and crypt_02 are accessible from outpost_basement but no quest or NPC mentions them. Add: (a) an Old Keeper dialogue branch hinting something stirs below the outpost, (b) a side quest sending the player down, (c) a lore item in crypt_02 referencing the Underlumen substrate — connecting Act I optional content to the Act II reveal. The crypts are atmospheric but invisible to players who don't stumble into them.

## 5. [sonnet] Connect orphaned Nightside dungeons to quests/NPCs

signal_cave, old_watchtower, dead_road, and relay_station all have content (lore items, monsters, environmental storytelling) but zero quest or NPC breadcrumbs directing players there. These rooms are never visited in the mainline sim (32 rooms unvisited). Add NPC dialogue hints: Wren Alcott mentions the old watchtower survey records, the Old Keeper references the dead road trade route, and a Sable encounter hints at signal_cave. Wire at least 2 of these into side quests.

## 6. [sonnet] Distribute crafting materials across biome loot tables

Crafting materials (metal_casing, metal_linker, power_conduit, stabilizer_rod, focusing_lens, plasma_coil) only drop from common.json loot tables. Add biome-appropriate crafting drops to frost.json (stabilizer_rod, metal_casing), fungal.json (focusing_lens), geothermal.json (plasma_coil, power_conduit), nightside.json (metal_linker), and array.json (all types at low rates). Players should find materials throughout the game, not just from generic drops.

## 7. [opus] Add environmental storytelling to the Nightside path

The nightside_caverns → nightside_depths → nightside_passage → underlumen_threshold path has combat but minimal narrative atmosphere. This is the player's journey into the unknown — it needs dread, not just monsters. Add: (a) 3-4 lore items referencing the Unbounded and the Spire of Vigil, (b) room-entered trigger messages as the player descends ("Your sol unit flickers — something deep is pulling at its frequency"), (c) a Sable encounter in nightside_depths with dialogue about what lies deeper, (d) environmental flavor text building tension. This path should feel like crossing a threshold into something ancient.

## 8. [opus] Wire full Array dungeon chain into quest narrative

The dayside has 5 dungeons (solar_fields → synthesis_lab → deep_processing → control_center → command_throne) but array_control_center and array_command_throne are never visited during any sim mode. The Array complex should feel like a progressively deeper investigation, not two disconnected visits. Add quest steps or NPC breadcrumbs (MERIDIAN-7, Asha Denn) that guide players through the full chain. The Act III ending paths (shutdown/merge/control) should require visiting these dungeons.

## 9. [sonnet] Level-up stat screen

When the player levels up, there's no feedback beyond a notification. Add a brief stat summary popup showing HP increase, damage scaling bonus, and energy changes. This is a small engine change (new message type + client overlay) with outsized impact on feeling of progression. Every level should feel meaningful.

## 10. [sonnet] Weapon upgrade confirmation dialog

The disassemble button fires immediately with no confirmation. Add a choice menu ("Disassemble [weapon name]? Components will be lost.") to prevent accidental weapon destruction. Small UX fix that prevents real frustration — especially for rare weapons.

## 11. [opus] Build Lighthouse Mara dungeon

Core Act I beat from the storyboard ("Lighthouse Mara, 2-3 hours"). Multi-floor dungeon (3-4 floors) through frozen caverns to a failing Lighthouse. Use frost_crypt tileset and nightside monsters. The damage should look structural, not raider-caused — breadcrumb for the Deep Array reveal. Include a survey marker referencing unusual geological readings and a Sable sighting. Wire into the main quest between "cross perimeter" and "arrive Meridian" steps. This is the single most impactful content addition for Act I — the player's first real expedition.

## 12. [opus] Build Dural Voss boss encounter

The luddite_warlord monster type exists and Dural Voss appears in NPC dialogue, but there's no actual boss encounter. Create: (a) a `dural_voss` monster entry with high HP, retreat mechanic (flees at 20% HP), and unique lunge/stun attacks, (b) an encounter room in nightside_caverns or a dedicated raider camp, (c) pre-fight dialogue ("We didn't touch your Lighthouses — whatever's killing them is deeper than you think"), (d) a retreat flag that marks him as fled rather than killed. This gives Act I's antagonist a face and plants the seed that raiders aren't the real threat.

## 13. [opus] Build Spire of Vigil — Act I climax

Act I climax dungeon. 2-3 floors of Luddite fortifications with raider captain mini-bosses transitioning to pre-human Underlumen architecture in the deeper levels. Use nightside tileset. Include traps, fortified positions, and coordinated pack_leader squads. The architecture should shift from crude raider modifications to something clearly ancient as the player descends. Inner core: Light-placement puzzle rooms teaching the Light Sentry mechanic. Core chamber: ability resonance event that permanently unlocks Light Sentry. Wire into main quest as the Act I finale.

## 14. [opus] Build Greenway corridor dungeons + Spire of Winds

Act II setting and climax. Agricultural zones and farming settlements under Bulwark martial law. Create: (a) 2-3 Greenway corridor dungeons connecting Meridian to the Monument of Winds, (b) a Compact General boss with Bulwark soldier enemy types (new monster entries), (c) the Spire of Winds dungeon with vertical navigation puzzles and Hover ability unlock, (d) a greenway tileset (or adapt meridian tileset with agricultural elements). This makes the Act II political crisis tangible — players see the occupation rather than just hearing about it.

## 15. [opus] Build Spire of Radiance + Deep Array climax

Act III climax. The Dayside Spire encased in Array infrastructure. Create: (a) Array-organic hybrid enemies with unique visuals, (b) energy management puzzle rooms, (c) Photonic Pulse ability unlock in the core chamber, (d) final confrontation with the Deep Array network, (e) the three-path choice point (Sever/Restore/Subsume) with mechanically distinct endings. This completes the campaign. The ending paths (array_control_center, merge_nexus, array_command_throne) already exist but need this dungeon as their gateway.

## 16. [sonnet] Replace top-priority placeholder sprites

Priority replacements for maximum visual impact: player character (most-seen entity), Warden Holt (first NPC), Sable (key narrative NPC), MERIDIAN-7 terminal (unique entity), health_potion (most-used item), sol_unit item. Even 6-8 hand-drawn sprites following docs/art-style-guide.md would dramatically improve first impressions. The player sprite especially — it's on screen 100% of the time.

## 17. [sonnet] Fix nightside_expedition quest return navigation

The nightside_expedition quest times out because after reaching underlumen_threshold, the bot can't navigate back to meridian_civic to deliver the compound to Asha. This quest gates the three-path ending choice. Fix: either (a) add a fast-travel trigger in underlumen_threshold (transit point warping to train_station), or (b) improve sim bot pathfinding for long return journeys through the Nightside chain. The quest content is good — it just can't be completed.
