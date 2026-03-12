# TODOs

Prioritized task list — last refreshed 2026-03-12.

Based on headless sim analysis: mainline **PASSES** (28/57 rooms 49.1%, 106 kills, 0 deaths, 26 min) but all-quests **STUCK** in proc_quarantine depth 3 where 10 monsters (maxPerRoom=3 across 5-8 small rooms) physically block the player. Side quests: relay_recovery STUCK on `junction_a_activated`, nightside_expedition + broken_signal TIMEOUT. Zero deaths across all modes despite a fully-implemented death penalty. Only 5/52 items collected and 20/60 NPCs talked to — most content is invisible to the player.

**Storyboard coverage**: Act I ~55% (Outpost + Nightside done; Lighthouse Mara, Dural Voss, Spire of Vigil missing), Act II ~25% (Dayside partial; Greenway, Bulwark, Spire of Winds missing), Act III ~20% (ending dungeons exist; Spire of Radiance missing). The storyboard targets 31-38 hours of mainline campaign; the sim completes in 26 minutes. Even accounting for bot speed, we have ~10% of the target content depth. The narrative spine — the four Spire dungeons — is entirely unbuilt.

**Big picture**: The engine, progression, and endgame systems are mature. The game works as a dungeon-crawling sandbox but lacks the narrative campaign that turns it into a complete game. Priority order: (1) fix content that's broken, (2) make existing content discoverable and tense, (3) build the story dungeons that form the campaign spine, (4) polish visuals and UX.

---

## 1. [sonnet] Fix proc_quarantine depth 3 monster density

The all-quests sim gets permanently stuck at proc_quarantine depth 3. The template spawns 10 monsters (base 4 + 2×depth) into rooms that are 5-10 × 5-8 tiles with maxPerRoom=3. In tight procedural layouts, monsters physically block all corridors and the player can't move. Fix: (a) reduce `monstersPerDepth` from 2 to 1 (giving depth 3 = 7 monsters instead of 10), (b) increase `maxPerRoom` awareness of room size — skip rooms under 40 walkable tiles, (c) ensure the entrance corridor always has a monster-free buffer zone. This also affects real players who'd be body-blocked in narrow proc rooms.

## 2. [sonnet] Difficulty tuning — 0 deaths across all modes

The bot dealt 9,672 damage and took only 1,144 (11.8% ratio) with 0 deaths across the entire mainline. The death penalty system (25% energy drain + item drop + respawn + death screen) never triggers. The game has no tension. Changes needed: (a) increase Nightside and frost monster damage by 30-40% in monsters.json, (b) reduce healing item spawns in outpost and common loot tables, (c) add 1-2 more monsters to chokepoint rooms (perimeter_breach, nightside_caverns), (d) increase boss special attack damage multipliers from 1.2-1.8x to 1.5-2.2x. Target: 2-4 deaths on a mainline playthrough.

## 3. [sonnet] Fix relay_recovery quest — STUCK on junction_a_activated

The sim gets stuck in relay_station waiting for `junction_a_activated`. The flag requires interacting with Junction Box A — a crypt tileset `door_closed` tile at (3,3). Either the tile is physically unreachable (surrounded by walls) or the `door_interacted` event doesn't fire for this tile type. Verify the tile is reachable and the event chain works. This is one of 3 broken side quests blocking all-quests completion.

## 4. [sonnet] Fix broken_signal quest — TIMEOUT on daley_coordinates

The broken_signal quest times out because `daley_coordinates` requires both `comms_restored` AND `arrived_meridian` flags. If the player completes the comms chain after visiting Meridian (common in natural play order), the grant trigger never fires on return. Fix: make the trigger fire retroactively when both flags exist, or remove the ordering dependency.

## 5. [sonnet] Add fast-travel from underlumen_threshold

After reaching underlumen_threshold, the nightside_expedition quest requires navigating back through 6 rooms to deliver a compound to Asha in meridian_civic. There's no shortcut. The quest times out in sim and would be tedious for real players. Add a transit portal in underlumen_threshold (activated once `reached_underlumen_threshold` is set) that warps to train_station or meridian_station. This is also the bridge to Act III — it should feel like a milestone, not a backtrack.

## 6. [sonnet] Connect orphaned dungeons to quests and NPCs

21 of 57 rooms are never visited even in all-quests mode. Key orphaned content: crypt_01/02 (accessible from outpost_basement but no quest sends players there), signal_cave, old_watchtower, fen_cache, outer_expanse (Nightside dungeons with content but no NPC breadcrumbs). Only 20/60 NPCs are talked to and 5/52 items collected — most content is invisible. Fix: (a) add an Old Keeper side quest sending the player to crypt_02 for a lore item referencing the Underlumen, (b) wire Wren Alcott's watchtower hint into a proper side quest with a flag reward, (c) add Pathfinder Ren breadcrumbs for fen_cache and signal_cave. The content is built — it needs signposts.

## 7. [sonnet] Wire lighthouse_siege_arena to NPC + lower unlock

The lighthouse siege cooperative challenge is fully implemented (10-wave defense, siege_legendary rewards, communal energy pool) but gated behind `expedition_tier_4_cleared` — deep endgame. No NPC ever mentions it. Add: (a) Warden Holt dialogue about siege training grounds after `perimeter_breach_cleared`, (b) lower the unlock condition to `perimeter_breach_cleared`, (c) Old Keeper hint about defending the light. A complete endgame system sitting invisible to players.

## 8. [sonnet] Environmental storytelling on the Nightside descent

The nightside_caverns → nightside_depths → nightside_passage → underlumen_threshold path has combat but minimal narrative. This is the player's journey into the unknown — it should feel like crossing a threshold into something ancient. Add: (a) 3-4 lore items in items.json referencing the Unbounded, the Spires, and the Underlumen substrate, (b) room-entered trigger messages as the player descends ("Your sol unit flickers — something deep is pulling at its frequency"), (c) environmental flavor building dread toward the Act II reveal. Four rooms of combat need narrative gravity.

## 9. [sonnet] Distribute crafting materials across biome loot tables

Crafting materials (metal_casing, metal_linker, power_conduit, stabilizer_rod, focusing_lens, plasma_coil) only drop from common.json loot tables. Players find them randomly rather than in thematic contexts. Add biome-appropriate drops: frost.json (stabilizer_rod, metal_casing), fungal.json (focusing_lens), geothermal.json (plasma_coil, power_conduit), nightside.json (metal_linker), array.json (all types at low rates). Players should discover materials throughout the world, tied to the environments they explore.

## 10. [sonnet] Wire Array dungeon chain into quest narrative

The dayside has 5 dungeons (solar_fields → extraction_outpost → synthesis_lab → deep_processing → control_center/command_throne) but the later ones are only reachable after the ending path choice. The Array complex should feel like a progressive investigation during the main quest, not two disconnected visits. Add quest steps or MERIDIAN-7/Asha Denn breadcrumbs guiding players through the full chain before the choice point. The dungeons exist — the narrative thread connecting them is missing.

## 11. [sonnet] Improve item and NPC engagement

Only 5 of 52 ground items were collected in the mainline sim and 20 of 60 NPCs were interacted with. Most loot and dialogue is invisible or skippable. Fix: (a) place 2-3 quest-relevant items along the main quest path (not just in side rooms), (b) add pickup-hint messages for important items, (c) ensure main-quest NPCs have updated dialogue for each quest phase so returning to them feels rewarding, (d) add `hasItem` dialogue rules for lore items pointing players to the relevant NPC. The content exists but the player flows past it.

## 12. [opus] Build Lighthouse Mara dungeon

The single most-referenced missing content: 15+ NPC dialogue lines mention Lighthouse Mara, but no dungeon exists. Core Act I beat from the storyboard — the player's first real expedition. Create a 3-floor dungeon through frozen caverns to a failing Lighthouse using frost_crypt tileset and nightside monsters. The damage should look structural, not raider-caused — breadcrumb for the Deep Array reveal. Include a survey marker referencing unusual geological readings and a Sable sighting. Wire into main quest between "cross perimeter" and "arrive Meridian." This transforms Act I from tutorial+fetch-quests into a real expedition with atmosphere and mystery.

## 13. [opus] Build Dural Voss boss encounter

The luddite_warlord monster type exists and Dural Voss is referenced in NPC dialogue, but there's no actual boss fight. Create: (a) a dedicated `dural_voss` monster entry with ~500 HP, retreat mechanic (flees at 20% HP), and lunge/stun attacks, (b) an encounter room in a raider camp at the edge of the Nightside, (c) pre-fight dialogue ("We didn't touch your Lighthouses — whatever's killing them is deeper than you think"), (d) a retreat flag marking him as fled rather than killed. This gives Act I's antagonist a face and plants the seed that raiders aren't the real threat — the game's central twist.

## 14. [opus] Build Spire of Vigil — Act I climax

The storyboard's Act I finale. 2-3 floors: raider fortifications (outer) transitioning to pre-human Underlumen architecture (inner). Use nightside tileset for outer, a new or adapted tileset for inner. Include traps, fortified positions, coordinated pack_leader squads, and mini-boss raider captains. Inner core: light-placement puzzle rooms teaching the Light Sentry mechanic. Core chamber: ability resonance event permanently unlocking Light Sentry. Wire into main quest as the Act I finale. Together with Lighthouse Mara (#12) and Dural Voss (#13), this completes Act I's storyboard — transforming the game from a 26-minute bot run into a multi-hour narrative campaign.

## 15. [sonnet] Level-up stat screen and weapon disassemble confirmation

Two high-impact UX improvements: (a) When the player levels up, show a brief stat summary popup (HP increase, damage scaling, energy changes) — every level-up should feel meaningful. (b) Add a confirmation dialog before disassembling weapons ("Disassemble [weapon]? Components will be lost.") to prevent accidental destruction. Both are small engine changes (new message type + client overlay) with outsized impact on player satisfaction and preventing frustration.

## 16. [sonnet] Replace top-priority placeholder sprites

Priority replacements for maximum visual impact: player character (on screen 100% of the time), Warden Holt (first NPC met), health_potion (most-used item), sol_unit item (key progression item), MERIDIAN-7 terminal (unique entity type). Even 5-6 intentionally-designed sprites following docs/art-style-guide.md would dramatically improve first impressions. The art style guide exists — these sprites just need to be made with care.

## 17. [opus] Build Greenway corridors + Spire of Winds — Act II

Act II setting and climax. Create: (a) 2-3 Greenway corridor dungeons connecting Meridian to the Monument of Winds — agricultural zones under Bulwark martial law with civilian NPCs caught between sides, (b) Bulwark soldier enemy types + a Compact General boss, (c) the Spire of Winds dungeon with vertical navigation puzzles and Hover ability unlock. Requires a greenway tileset (or adapt meridian tileset). This makes the Act II political crisis tangible — players see the occupation rather than just hearing about it in dialogue.

## 18. [opus] Build Spire of Radiance + three-path ending — Act III climax

The final campaign dungeon. The Dayside Spire encased in Array infrastructure. Create: (a) Array-organic hybrid enemies, (b) energy management puzzle rooms, (c) Photonic Pulse ability unlock, (d) confrontation with the Deep Array network, (e) the three-path choice point (Sever/Restore/Subsume) with mechanically distinct endings. The ending path dungeons (array_control_center, merge_nexus, array_command_throne) already exist — this dungeon is their gateway. Completing this task + #14 + #17 gives the game its full 31-38 hour campaign spine.
