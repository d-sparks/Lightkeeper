# TODOs

Prioritized task list — last refreshed 2026-03-12.

Based on headless sim analysis: mainline **PASSES ~67%** of runs (28/57 rooms 49.1%, 115 kills, 0 deaths, 25 min) but **FAILS ~33%** due to proc_quarantine body-blocking. Explore mode **BROKEN** (5/57 rooms 8.8%). Zero deaths across all modes despite a fully-implemented death penalty. Only 4-5/52 items collected and 20/60 NPCs talked to — most content is invisible to the player.

**Storyboard coverage**: Act I ~55% (Outpost + Nightside done; Lighthouse Mara, Dural Voss, Spire of Vigil missing), Act II ~25% (Dayside partial; Greenway, Bulwark, Spire of Winds missing), Act III ~20% (ending dungeons exist; Spire of Radiance missing). The storyboard targets 31-38 hours of mainline campaign; the sim completes in 25 minutes. Even accounting for bot speed, we have ~10% of the target content depth. The narrative spine — the three Spire dungeons and Lighthouse Mara — is entirely unbuilt.

**Big picture**: The engine, progression, and endgame systems are mature. The game works as a dungeon-crawling sandbox but lacks the narrative campaign that turns it into a complete game. Priority order: (1) fix reliability — 33% failure rate is unacceptable, (2) add tension — zero deaths means zero stakes, (3) make existing content discoverable — 92% of items and 67% of NPCs are invisible, (4) build the story dungeons that form the campaign spine, (5) polish visuals and UX.

---

## [sonnet] Fix proc_quarantine body-blocking (~33% mainline failure)

The mainline sim fails ~33% of runs because proc_quarantine depth 2-3 generates monsters that physically block corridors. When the bot gets stuck, it cycles between quarantine floors endlessly until timeout. The procedural templates spawn too many monsters in rooms with narrow passages. Fix: (a) reduce monster count in small rooms — skip rooms under 40 walkable tiles when placing monsters, (b) guarantee a monster-free buffer zone around the entrance tile, (c) cap `maxPerRoom` proportional to room area (e.g. 1 monster per 20 walkable tiles). This is the single highest-priority fix — the game literally soft-locks a third of the time.

## [sonnet] Difficulty tuning — zero deaths across all modes

The bot dealt 9,789 damage and took only 992 (10% ratio) with zero deaths across the entire mainline. The death penalty system (25% energy drain + item drop + respawn + death screen) never triggers. The game has no tension. Changes needed: (a) increase Nightside and frost monster damage by 30-40% in monsters.json, (b) reduce healing item spawns in outpost and common loot tables, (c) add 1-2 more monsters to chokepoint rooms (perimeter_breach, nightside_caverns), (d) increase boss special attack damage multipliers from 1.2-1.8x to 1.5-2.2x. Target: 2-4 deaths on a mainline playthrough.

## [sonnet] Fix explore mode in headless sim

Explore mode reaches only 5/57 rooms (8.8%) before timing out. It gets trapped in the outpost quarantine loop and never progresses to the wider world. The bot needs flag grants for story-gated doors (fenn_opened_gate, etc.) and smarter room-selection logic. Without a working explore mode, we can't validate that orphaned rooms are actually reachable. Fix: (a) grant all story-progression flags in explore mode at startup, (b) add room-visit deduplication so the bot doesn't re-enter proc_quarantine, (c) increase the explore timeout to cover the full room graph. This unblocks content validation for the rest of the task list.

## [sonnet] Connect orphaned dungeons to quests and NPCs

29 of 57 rooms are never visited even when the mainline passes. Key orphaned content: crypt_01/02 (accessible from outpost_basement but no quest sends players there), signal_cave, old_watchtower, fen_cache, outer_expanse (Nightside dungeons with content but no NPC breadcrumbs). Fix: (a) add an Old Keeper side quest sending the player to crypt_02 for a lore item referencing the Underlumen, (b) wire Wren Alcott's watchtower hint into a proper side quest with a flag reward, (c) add Pathfinder Ren breadcrumbs for fen_cache and signal_cave, (d) add Sable dialogue mentioning outer_expanse for deep Nightside exploration. The rooms are built — they need signposts.

## [sonnet] Improve item discovery and NPC engagement

Only 4-5/52 items collected (8-10%) and 20/60 NPCs talked to (33%) on a successful mainline run. Most loot and dialogue is invisible or skippable. Fix: (a) place 2-3 quest-relevant items along the main quest path (not just in side rooms), (b) add pickup-hint messages for important items ("This looks like it could be useful to the Engineer"), (c) ensure main-quest NPCs have updated dialogue for each quest phase so returning to them feels rewarding, (d) add `hasItem` dialogue rules for lore items pointing players to the relevant NPC, (e) add a Warden Holt dialogue line mentioning the mess hall and infirmary so those rooms get visited. The content exists but the player flows past it.

## [sonnet] Wire lighthouse_siege_arena to NPC + lower unlock

The lighthouse siege cooperative challenge is fully implemented (10-wave defense, siege_legendary rewards, communal energy pool) but gated behind `expedition_tier_4_cleared` — deep endgame. No NPC ever mentions it. Add: (a) Warden Holt dialogue about siege training grounds after `perimeter_breach_cleared`, (b) lower the unlock condition to `perimeter_breach_cleared`, (c) Old Keeper hint about defending the light. A complete endgame system sitting invisible to players.

## [sonnet] Environmental storytelling on the Nightside descent

The nightside_caverns → nightside_depths → nightside_passage → underlumen_threshold path has combat but minimal narrative. This is the player's journey into the unknown — it should feel like crossing a threshold. Add: (a) 3-4 lore items in items.json referencing the Unbounded, the Spires, and the Underlumen substrate, (b) room-entered trigger messages as the player descends ("Your sol unit flickers — something deep is pulling at its frequency"), (c) environmental flavor building dread toward the Act II reveal. Four rooms of combat need narrative gravity.

## [sonnet] Wire Array dungeon chain into quest narrative

The dayside has 5 dungeons (solar_fields → extraction_outpost → synthesis_lab → deep_processing → control_center/command_throne) but the later ones are only reachable after the ending path choice. The Array complex should feel like a progressive investigation during the main quest, not two disconnected visits. Add quest steps or MERIDIAN-7/Asha Denn breadcrumbs guiding players through the full chain before the choice point. The dungeons exist — the narrative thread connecting them is missing.

## [sonnet] Add fast-travel from underlumen_threshold

After reaching underlumen_threshold, the nightside_expedition quest requires navigating back through 6 rooms to deliver a compound to Asha in meridian_civic. There's no shortcut. Add a transit portal in underlumen_threshold (activated once `reached_underlumen_threshold` is set) that warps to train_station or meridian_station. This is also the bridge to Act III — it should feel like a milestone, not a backtrack.

## [opus] Build Lighthouse Mara dungeon — Act I core beat

The single most-referenced missing content: 15+ NPC dialogue lines mention Lighthouse Mara, but no dungeon exists. Core Act I beat from the storyboard — the player's first real expedition after the tutorial. Create a 3-floor dungeon through frozen caverns to a failing Lighthouse using frost_crypt tileset and nightside monsters. The damage should look structural, not raider-caused — breadcrumb for the Deep Array reveal. Include a survey marker referencing unusual geological readings and a Sable sighting. Wire into main quest between "cross perimeter" and "arrive Meridian." This transforms Act I from tutorial+fetch-quests into a real expedition with atmosphere and mystery.

## [opus] Build Dural Voss boss encounter — Act I antagonist

The luddite_warlord monster type exists and Dural Voss is referenced in NPC dialogue, but there's no actual boss fight. Create: (a) a dedicated `dural_voss` monster entry with ~500 HP, retreat mechanic (flees at 20% HP), and lunge/stun attacks, (b) an encounter room in a raider camp at the edge of the Nightside, (c) pre-fight dialogue ("We didn't touch your Lighthouses — whatever's killing them is deeper than you think"), (d) a retreat flag marking him as fled rather than killed. This gives Act I's antagonist a face and plants the seed that raiders aren't the real threat — the game's central twist.

## [opus] Build Spire of Vigil — Act I climax

The storyboard's Act I finale. 2-3 floors: raider fortifications (outer) transitioning to pre-human Underlumen architecture (inner). Use nightside tileset for outer, adapted tileset for inner. Include traps, fortified positions, coordinated pack_leader squads, and mini-boss raider captains. Inner core: light-placement puzzle rooms teaching the Light Sentry mechanic. Core chamber: ability resonance event permanently unlocking Light Sentry. Wire into main quest as the Act I finale. Together with Lighthouse Mara and Dural Voss, this completes Act I's storyboard — transforming the game from a 25-minute bot run into a multi-hour narrative campaign.

## [sonnet] Level-up stat screen and weapon disassemble confirmation

Two high-impact UX improvements: (a) When the player levels up, show a brief stat summary popup (HP increase, damage scaling, energy changes) — every level-up should feel meaningful. (b) Add a confirmation dialog before disassembling weapons ("Disassemble [weapon]? Components will be lost.") to prevent accidental destruction. Both are small engine changes (new message type + client overlay) with outsized impact on player satisfaction.

## [sonnet] Replace top-priority placeholder sprites

Priority replacements for maximum visual impact: player character (on screen 100% of the time), Warden Holt (first NPC met), health_potion (most-used item), sol_unit item (key progression item), MERIDIAN-7 terminal (unique entity type). The art style guide exists at docs/art-style-guide.md — these sprites just need to be made with care following the master palette and 16x16 conventions. Even 5-6 intentionally-designed sprites would dramatically improve first impressions.

## [opus] Build Greenway corridors + Spire of Winds — Act II

Act II setting and climax. Create: (a) 2-3 Greenway corridor dungeons connecting Meridian to the Monument of Winds — agricultural zones under Bulwark martial law with civilian NPCs caught between sides, (b) Bulwark soldier enemy types + a Compact General boss, (c) the Spire of Winds dungeon with vertical navigation puzzles and Hover ability unlock. Requires a greenway tileset (or adapt meridian tileset). This makes the Act II political crisis tangible — players see the occupation rather than just hearing about it in dialogue.

## [opus] Build Spire of Radiance + three-path ending — Act III climax

The final campaign dungeon. The Dayside Spire encased in Array infrastructure. Create: (a) Array-organic hybrid enemies, (b) energy management puzzle rooms, (c) Photonic Pulse ability unlock, (d) confrontation with the Deep Array network, (e) the three-path choice point (Sever/Restore/Subsume) with mechanically distinct endings. The ending path dungeons (array_control_center, merge_nexus, array_command_throne) already exist — this dungeon is their gateway. Completing this + Spire of Vigil + Spire of Winds gives the game its full campaign spine.
