# TODOs

Prioritized task list — last refreshed 2026-03-12, audited 2026-03-12.

Based on headless sim analysis: mainline PASS (28/57 rooms 49.1%, 113 kills, 0 deaths, 24 min); all-quests 10/14 complete (relay_recovery STUCK on junction_a_activated, nightside_expedition + broken_signal TIMEOUT, 36/57 rooms 63.2%, 0 deaths); explore FAIL (7/57 rooms 12.3%, flag-gated at outpost_workshop). The proc_quarantine infinite loop from the prior refresh is fixed — all-quests now completes the main quest. Three Spire dungeons, Lighthouse Mara, Greenway zones, and Dural Voss boss remain unbuilt (~40% of storyboard). 21 rooms never visited even in all-quests mode. Organized: fix what's broken, connect what's disconnected, build what's missing, polish what exists.

---

## 1. [sonnet] Fix relay_recovery quest — STUCK on junction_a_activated

The all-quests sim gets stuck in relay_station waiting for the `junction_a_activated` flag. The flag requires the bot to interact with a specific door tile at (3,3), but the bot never reaches or interacts with it. This is either a sim bot pathfinding issue (can't navigate to the interactable tile) or a trigger wiring issue (the door_interacted event doesn't fire correctly). Fix: verify the trigger fires on manual test, then fix the bot's interact-with-tile logic in the sim. This quest is one of only 4 that fail in all-quests mode.

## 2. [sonnet] Fix broken_signal quest — TIMEOUT

The broken_signal quest times out because the bot either never acquires the `daley_coordinates` item from Comms Officer Daley, or doesn't carry it when entering signal_cave (the room_entered trigger requires `hasItem: daley_coordinates` to set `signal_source_found`). Verify the item grant trigger in outpost_comms fires correctly, then ensure the sim bot retains the item through room transitions. Small content or sim fix with direct impact on quest completion rate.

## 3. [sonnet] Fix nightside_expedition quest — TIMEOUT (return navigation)

The nightside_expedition quest times out because after reaching underlumen_threshold, the bot can't navigate back through the 6-room Nightside chain to meridian_civic to deliver the compound to Asha. This quest gates the three-path ending choice — it's the bridge to Act III. Fix: add a fast-travel trigger in underlumen_threshold (transit point warping to train_station or meridian_station), so the return trip doesn't require backtracking through the entire Nightside. This also improves the real player experience — nobody wants a 10-minute walk back through cleared rooms.

## 4. [sonnet] Fix explore-mode flag gating — 12.3% coverage

The explore bot hits outpost_workshop's locked door requiring `engineer_briefing_complete` and stalls at 7/57 rooms. This flag is deep in the main quest chain (step 8 of 22). Options: (a) teach the explore bot to follow the quest chain minimally to earn flags, (b) grant story-progression flags automatically in explore mode, or (c) add an explore-mode bypass that ignores flag-gated doors. Option (b) is simplest and makes explore mode a useful content validator. Target: 80%+ room coverage.

## 5. [sonnet] Difficulty tuning — 0 deaths across all modes

The bot never dies: mainline dealt 8,916 damage, took only 931 (10.4% ratio), used only 65 healing. The game feels like a cakewalk. Changes: (a) increase Nightside/frost monster damage by 25-35%, (b) reduce early healing item drops by 40%, (c) add 2-3 more monsters to perimeter_breach and nightside_caverns chokepoints, (d) increase boss special attack damage multipliers. Target: 2-4 deaths on a mainline playthrough. The death penalty system is fully implemented — it just never triggers.

## 6. [sonnet] Connect crypt dungeons to narrative

crypt_01 and crypt_02 are accessible from outpost_basement but no quest or NPC mentions them. The Old Keeper already has `explored_crypt_02` and `asked_about_moss` dialogue branches but no quest sends the player there. Add: (a) an Old Keeper dialogue hint about something stirring below, (b) a side quest ("The Bone Chamber") sending the player to crypt_02 for a lore item, (c) the lore item references the Underlumen substrate — connecting Act I optional content to the Act II reveal. Two atmospheric rooms sitting unused.

## 7. [sonnet] Connect orphaned Nightside dungeons to quests/NPCs

signal_cave, old_watchtower, dead_road, relay_station, fen_cache, and outer_expanse all have content but limited or zero quest breadcrumbs directing players there. These represent 6 of the 21 rooms never visited in all-quests mode. The NPC dialogue hooks already exist (Wren mentions the watchtower, Old Keeper references the dead road, Kade gives intel for relay_recovery) but the player has no reason to follow up. Wire at least 3 into side quests with clear NPC direction. The content is built — it just needs signposts.

## 8. [sonnet] Distribute crafting materials across biome loot tables

Crafting materials (metal_casing, metal_linker, power_conduit, stabilizer_rod, focusing_lens, plasma_coil) only drop from common.json loot tables. Add biome-appropriate crafting drops: frost.json (stabilizer_rod, metal_casing), fungal.json (focusing_lens), geothermal.json (plasma_coil, power_conduit), nightside.json (metal_linker), array.json (all types at low rates). Players should find materials throughout the game, not just from generic mobs.

## 9. [opus] Add environmental storytelling to Nightside path

The nightside_caverns → nightside_depths → nightside_passage → underlumen_threshold path has combat but minimal narrative atmosphere. This is the player's journey into the unknown — it should feel like crossing a threshold. Add: (a) 3-4 lore items referencing the Unbounded and the Spire of Vigil, (b) room-entered trigger messages as the player descends ("Your sol unit flickers — something deep is pulling at its frequency"), (c) a Sable encounter in nightside_depths with dialogue about what lies deeper, (d) environmental flavor text building dread. Four rooms of combat need narrative gravity.

## 10. [opus] Wire full Array dungeon chain into quest narrative

The dayside has 5 dungeons (solar_fields → synthesis_lab → deep_processing → control_center → command_throne) but array_control_center and array_command_throne are only reachable after the ending path choice. The Array complex should feel like a progressively deeper investigation in the main quest, not two disconnected visits. Add quest steps or NPC breadcrumbs (MERIDIAN-7, Asha Denn) that guide players through the full chain before the ending choice. The Act III ending paths should feel like destinations earned through exploration, not doors that appear after a flag flip.

## 11. [sonnet] Level-up stat screen and weapon upgrade confirmation

Two high-impact UX improvements: (a) When the player levels up, show a brief stat summary popup (HP increase, damage scaling, energy changes) — every level should feel meaningful. (b) Add a confirmation dialog before disassembling weapons ("Disassemble [weapon]? Components will be lost.") to prevent accidental destruction. Both are small engine changes (new message type + client overlay) with outsized impact on player satisfaction.

## 12. [opus] Build Lighthouse Mara dungeon

Core Act 1 beat from the storyboard ("Lighthouse Mara, 2-3 hours"). Multi-floor dungeon (3-4 floors) through frozen caverns to a failing Lighthouse. Use frost_crypt tileset and nightside monsters. The damage should look structural, not raider-caused — breadcrumb for the Deep Array reveal. Include a survey marker referencing unusual geological readings and a Sable sighting. Wire into main quest between "cross perimeter" and "arrive Meridian." This is the single most impactful content addition for Act I — the player's first real expedition beyond the outpost.

## 13. [opus] Build Dural Voss boss encounter

The luddite_warlord monster type exists and Dural Voss appears in NPC dialogue, but there's no actual boss fight. Create: (a) a dedicated `dural_voss` monster entry with high HP, retreat mechanic (flees at 20% HP), and lunge/stun attacks, (b) an encounter room in a raider camp or nightside_caverns, (c) pre-fight dialogue ("We didn't touch your Lighthouses — whatever's killing them is deeper than you think"), (d) a retreat flag marking him as fled rather than killed. This gives Act I's antagonist a face and plants the seed that raiders aren't the real threat.

## 14. [opus] Build Spire of Vigil — Act I climax

The Act I climax dungeon. 2-3 floors: raider fortifications (outer) transitioning to pre-human Underlumen architecture (inner). Use nightside tileset. Include traps, fortified positions, coordinated pack_leader squads, and mini-boss raider captains. Inner core: Light-placement puzzle rooms teaching the Light Sentry mechanic. Core chamber: ability resonance event permanently unlocking Light Sentry. Wire into main quest as the Act I finale. This and Lighthouse Mara together complete Act I's storyboard.

## 15. [opus] Build Greenway corridor dungeons + Spire of Winds

Act II setting and climax. Create: (a) 2-3 Greenway corridor dungeons connecting Meridian to the Monument of Winds — agricultural zones under Bulwark martial law, (b) a Compact General boss with new Bulwark soldier enemy types, (c) the Spire of Winds dungeon with vertical navigation puzzles and Hover ability unlock. Requires a greenway tileset (or adapt meridian tileset with agricultural elements). This makes the Act II political crisis tangible — players see the occupation rather than just hearing about it.

## 16. [opus] Build Spire of Radiance + Deep Array climax

Act III climax. The Dayside Spire encased in Array infrastructure. Create: (a) Array-organic hybrid enemies, (b) energy management puzzle rooms, (c) Photonic Pulse ability unlock in the core chamber, (d) final confrontation with the Deep Array network, (e) the three-path choice point (Sever/Restore/Subsume) with mechanically distinct endings. The ending paths (array_control_center, merge_nexus, array_command_throne) already exist but need this dungeon as their gateway.

## 17. [sonnet] Replace top-priority placeholder sprites

Priority replacements for maximum visual impact: player character (on screen 100% of the time), Warden Holt (first NPC), Sable (key narrative NPC), MERIDIAN-7 terminal (unique entity), health_potion (most-used item), sol_unit item. Even 6-8 hand-drawn sprites following docs/art-style-guide.md would dramatically improve first impressions. The current procedural sprites read as "programmer art" — anything intentional would be an upgrade.

## 18. [sonnet] Wire lighthouse_siege_arena to NPC trigger + quest breadcrumb

The lighthouse siege cooperative challenge is fully implemented (10-wave defense, siege_legendary rewards, communal energy pool) but gated behind `expedition_tier_4_cleared` — a flag deep in endgame progression. It has a physical entrance from outpost_perimeter but no NPC mentions it and no quest points players there. Add: (a) a Warden Holt dialogue branch mentioning the siege training grounds, (b) a lower-tier unlock condition so players can try it before endgame, (c) a quest breadcrumb from the Old Keeper about defending the light. A complete endgame system sitting invisible.
