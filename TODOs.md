# TODOs

Prioritized task list — last refreshed 2026-03-12.

Based on headless sim analysis: mainline is **flaky** — passes ~66% of runs (28/57 rooms 49.1%, 105 kills, 0 deaths, 24 min on success) but softlocks ~33% of the time in proc_quarantine on `titanium_cylinders` chest interaction at depth 2. All-quests: 10/14 complete (relay_recovery STUCK on junction_a_activated, nightside_expedition + broken_signal TIMEOUT). Explore: 12.3% coverage (flag-gated at outpost_workshop). Zero deaths across all modes despite a fully-implemented death penalty.

**Storyboard coverage**: Act I ~55% (Outpost + Nightside done; Lighthouse Mara, Dural Voss, Spire of Vigil missing), Act II ~25% (Dayside partial; Greenway, Bulwark, Spire of Winds missing), Act III ~20% (ending dungeons exist; Spire of Radiance missing). Lighthouse Mara is referenced 15+ times in NPC dialogue but doesn't exist as a dungeon. Three Spire climax dungeons are entirely unbuilt. ~40% of the storyboard remains unrealized.

**Big picture**: The engine, progression, and endgame systems are mature. The critical path to a complete game is: (1) fix the mainline so it works every time, (2) connect the 21 orphaned rooms and 4 broken quests to the narrative, (3) build the 5-6 major story dungeons that form the campaign spine, (4) add tension through difficulty tuning and environmental storytelling.

---

## 1. [sonnet] Fix proc_quarantine titanium_cylinders softlock

The mainline quest fails ~33% of runs because the bot (and likely real players) can't reliably interact with the titanium_cylinders chest at proc_quarantine depth 2. The `door_interacted` trigger at the treasure room center tile (`{treasure.cx}, {treasure.cy}`) sometimes doesn't fire — either the bot can't path to the exact tile, or the template variable substitution produces coordinates the bot can't reach. This is the single highest-priority bug: **the main quest randomly breaks**. Fix the trigger to be more forgiving (larger interaction radius, or spawn the item on room entry at depth 2 instead of requiring tile interaction).

## 2. [sonnet] Difficulty tuning — 0 deaths across all modes

The bot never dies: mainline dealt 8,748 damage, took only 933 (10.7% ratio). Monster damage ranges from 2 (scrap_drone) to 20 (threshold_keeper) while the player deals 15+ per hit base. The game has no tension — the death penalty system (25% energy drain + item drop + respawn teleport + death screen) never triggers. Changes: (a) increase Nightside and frost monster damage by 30-40% across monsters.json, (b) reduce early healing item drops in outpost and common loot tables, (c) add 2-3 more monsters to chokepoint rooms (perimeter_breach, nightside_caverns), (d) increase boss special attack damage multipliers from 1.2-1.8x to 1.5-2.2x. Target: 2-4 deaths on a mainline playthrough.

## 3. [sonnet] Fix relay_recovery quest — STUCK on junction_a_activated

The all-quests sim gets stuck in relay_station waiting for the `junction_a_activated` flag. The flag requires interacting with the Junction Box A door tile at (3,3) — a crypt tileset `door_closed` tile. The bot either can't path to this tile (surrounded by walls) or the `door_interacted` event doesn't fire for this tile type. Verify: is tile (3,3) physically reachable? Does the crypt tileset door_closed tile correctly emit door_interacted? Fix the layout or trigger.

## 4. [sonnet] Fix broken_signal quest — TIMEOUT

The broken_signal quest times out because the bot may never acquire `daley_coordinates` from Comms Officer Daley. The grant trigger requires both `comms_restored` AND `arrived_meridian` flags — if the bot hasn't completed the comms restoration sub-chain before visiting Meridian, it can't get the coordinates on return. Verify the prerequisite chain fires correctly. Small content fix with direct impact on quest completion rate.

## 5. [sonnet] Fix nightside_expedition quest — TIMEOUT (no return path)

After reaching underlumen_threshold, the bot must navigate back through 6 rooms (underlumen_threshold → nightside_passage → nightside_depths → nightside_caverns → deep_perimeter_east → ... → meridian_civic) to deliver the compound to Asha. There's no fast-travel shortcut. This quest gates the three-path ending choice — it's the bridge to Act III. Fix: add a fast-travel trigger in underlumen_threshold (e.g., a transit portal warping to train_station or meridian_station) once `reached_underlumen_threshold` is set. This also improves the real player experience.

## 6. [sonnet] Connect crypt dungeons to narrative

crypt_01 and crypt_02 are accessible from outpost_basement but no quest or NPC mentions them. The Old Keeper already has `explored_crypt_02` and `asked_about_moss` dialogue branches but no quest sends the player there. Add: (a) an Old Keeper dialogue hint about something stirring below, (b) a side quest ("The Bone Chamber") sending the player to crypt_02 for a lore item, (c) the lore item references the Underlumen substrate — connecting Act I optional content to the Act II reveal. Two atmospheric rooms sitting unused.

## 7. [sonnet] Connect orphaned Nightside dungeons to quests/NPCs

signal_cave, old_watchtower, dead_road, relay_station, fen_cache, and outer_expanse have content but limited or zero quest breadcrumbs directing players there. These represent 6 of the 21 rooms never visited in all-quests mode. The NPC dialogue hooks partially exist (Wren mentions the watchtower, Old Keeper references the dead road, Kade gives intel for relay_recovery) but the player has no strong reason to follow up. Wire at least 3 into side quests with clear NPC direction and item/flag rewards. The content is built — it just needs signposts.

## 8. [sonnet] Wire lighthouse_siege_arena to NPC trigger + lower unlock

The lighthouse siege cooperative challenge is fully implemented (10-wave defense, siege_legendary rewards, communal energy pool) but gated behind `expedition_tier_4_cleared` — deep endgame. It has a physical entrance from outpost_perimeter but no NPC mentions it. Add: (a) a Warden Holt dialogue branch mentioning the siege training grounds after the player clears perimeter_breach, (b) a lower-tier unlock condition (e.g., `perimeter_breach_cleared` instead of tier 4), (c) an Old Keeper hint about defending the light. A complete endgame system sitting invisible.

## 9. [sonnet] Distribute crafting materials across biome loot tables

Crafting materials (metal_casing, metal_linker, power_conduit, stabilizer_rod, focusing_lens, plasma_coil) only drop from common.json loot tables. Add biome-appropriate crafting drops: frost.json (stabilizer_rod, metal_casing), fungal.json (focusing_lens), geothermal.json (plasma_coil, power_conduit), nightside.json (metal_linker), array.json (all types at low rates). Players should find materials throughout the game, not just from generic mobs.

## 10. [sonnet] Add environmental storytelling to Nightside path

The nightside_caverns → nightside_depths → nightside_passage → underlumen_threshold path has combat but minimal narrative atmosphere. This is the player's journey into the unknown — it should feel like crossing a threshold. Add: (a) 3-4 lore items in items.json referencing the Unbounded and the Spire of Vigil, (b) room-entered trigger messages as the player descends ("Your sol unit flickers — something deep is pulling at its frequency"), (c) environmental flavor text building dread toward the Underlumen reveal. Four rooms of combat need narrative gravity.

## 11. [sonnet] Wire full Array dungeon chain into quest narrative

The dayside has 5 dungeons (solar_fields → extraction_outpost → synthesis_lab → deep_processing → control_center/command_throne) but array_control_center and array_command_throne are only reachable after the ending path choice. The Array complex should feel like a progressively deeper investigation in the main quest, not two disconnected visits. Add quest steps or NPC breadcrumbs (MERIDIAN-7, Asha Denn) that guide players through the full chain before the ending choice.

## 12. [sonnet] Fix explore-mode flag gating — 12.3% coverage

The explore bot hits outpost_workshop's locked door requiring `engineer_briefing_complete` and stalls at 7/57 rooms. This flag is deep in the main quest chain (step 8 of 22). Grant story-progression flags automatically in explore mode so it can validate all rooms. Target: 80%+ room coverage.

## 13. [opus] Build Lighthouse Mara dungeon

The single most-referenced missing content: 15+ NPC dialogue lines mention Lighthouse Mara, but no dungeon exists. Core Act I beat from the storyboard. Create a multi-floor dungeon (3-4 floors) through frozen caverns to a failing Lighthouse. Use frost_crypt tileset and nightside monsters. The damage should look structural, not raider-caused — breadcrumb for the Deep Array reveal. Include a survey marker referencing unusual geological readings and a Sable sighting. Wire into main quest between "cross perimeter" and "arrive Meridian." This transforms Act I from a tutorial+fetch-quest into a real expedition.

## 14. [opus] Build Dural Voss boss encounter

The luddite_warlord monster type exists and Dural Voss appears in NPC dialogue, but there's no actual boss fight. Create: (a) a dedicated `dural_voss` monster entry with high HP (~500), retreat mechanic (flees at 20% HP), and lunge/stun attacks, (b) an encounter room in a raider camp or nightside_caverns, (c) pre-fight dialogue ("We didn't touch your Lighthouses — whatever's killing them is deeper than you think"), (d) a retreat flag marking him as fled rather than killed. This gives Act I's antagonist a face and plants the seed that raiders aren't the real threat.

## 15. [opus] Build Spire of Vigil — Act I climax

The Act I climax dungeon. 2-3 floors: raider fortifications (outer) transitioning to pre-human Underlumen architecture (inner). Use nightside tileset. Include traps, fortified positions, coordinated pack_leader squads, and mini-boss raider captains. Inner core: light-placement puzzle rooms teaching the Light Sentry mechanic. Core chamber: ability resonance event permanently unlocking Light Sentry. Wire into main quest as the Act I finale. Together with Lighthouse Mara (#13) and Dural Voss (#14), this completes Act I's storyboard.

## 16. [sonnet] Level-up stat screen and weapon upgrade confirmation

Two high-impact UX improvements: (a) When the player levels up, show a brief stat summary popup (HP increase, damage scaling, energy changes) — every level should feel meaningful. (b) Add a confirmation dialog before disassembling weapons ("Disassemble [weapon]? Components will be lost.") to prevent accidental destruction. Both are small engine changes (new message type + client overlay) with outsized impact on player satisfaction.

## 17. [sonnet] Replace top-priority placeholder sprites

Priority replacements for maximum visual impact: player character (on screen 100% of the time), Warden Holt (first NPC), Sable (key narrative NPC), MERIDIAN-7 terminal (unique entity), health_potion (most-used item), sol_unit item. Even 6-8 intentionally-designed sprites following docs/art-style-guide.md would dramatically improve first impressions.

## 18. [opus] Build Greenway corridor dungeons + Spire of Winds

Act II setting and climax. Create: (a) 2-3 Greenway corridor dungeons connecting Meridian to the Monument of Winds — agricultural zones under Bulwark martial law, (b) a Compact General boss with new Bulwark soldier enemy types, (c) the Spire of Winds dungeon with vertical navigation puzzles and Hover ability unlock. Requires a greenway tileset (or adapt meridian tileset with agricultural elements). This makes the Act II political crisis tangible — players see the occupation rather than just hearing about it.

## 19. [opus] Build Spire of Radiance + Deep Array climax

Act III climax. The Dayside Spire encased in Array infrastructure. Create: (a) Array-organic hybrid enemies, (b) energy management puzzle rooms, (c) Photonic Pulse ability unlock in the core chamber, (d) final confrontation with the Deep Array network, (e) the three-path choice point (Sever/Restore/Subsume) with mechanically distinct endings. The ending path dungeons (array_control_center, merge_nexus, array_command_throne) already exist but need this dungeon as their gateway.
