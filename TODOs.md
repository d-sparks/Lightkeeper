# TODOs

Prioritized task list — last refreshed 2026-03-12 (evening).

Based on headless sim analysis: mainline **PASSES** (28/57 rooms 49.1%, 112 kills, 0 deaths, 26 min). All-quests mode: **10/14 quests complete, 4 fail** — main_quest TIMEOUT (underlumen_threshold backtrack still stalls), nightside_expedition/broken_signal/phase3_investigation TIMEOUT. relay_recovery, lost_tool, the_deserter now pass. Explore mode **BROKEN** (7/57 rooms 12.3%) — blocked by `engineer_briefing_complete` flag on outpost_workshop door. Zero deaths across all modes. Only 5-9/52 items collected and 20-29/60 NPCs talked to.

**Storyboard coverage**: Act I ~55% (Outpost + Nightside done; Lighthouse Mara, Dural Voss, Spire of Vigil missing), Act II ~25% (Dayside partial; Greenway, Bulwark, Spire of Winds missing), Act III ~20% (ending dungeons exist; Spire of Radiance missing). The storyboard targets 31-38 hours; the sim completes in 26 minutes. The narrative spine — three Spire dungeons and Lighthouse Mara — is unbuilt.

**Big picture**: The engine is mature. 57 dungeons, 60 NPCs, 181 items, 43 monster types, 14 quests, 9 loot table sets, full endgame loop — all built. The game works as a sandbox but half the quests are broken and most content is invisible to players. Priority: (1) fix broken quests so all 14 complete in sim, (2) add tension — zero deaths means zero stakes, (3) connect orphaned content so players actually find it, (4) build the campaign spine (Spires + Lighthouse Mara), (5) polish.

---

## [sonnet] Fix 4 remaining broken quests in all-quests sim

Down from 7 to 4 failing quests. relay_recovery, lost_tool, and the_deserter now pass. Remaining bugs:
- **main_quest + nightside_expedition**: Both TIMEOUT — the bot stalls navigating back from underlumen_threshold despite the transit portal. May need sim pathfinding fix or additional route.
- **broken_signal**: TIMEOUT. The Daley coordinates fix (93c427f) was applied but the quest still times out in all-quests mode. May be a dependency ordering issue.
- **phase3_investigation**: TIMEOUT. This quest involves Directive 11-Kappa — check if prerequisites are met during all-quests flow.

Getting all 14 quests passing in the sim is the single most impactful reliability improvement.

## [sonnet] Fix explore mode — blocked at 12.3% coverage

Explore mode reaches only 7/57 rooms (12.3%) because it gets stuck at the outpost_workshop door requiring `engineer_briefing_complete`. The bot has `met_engineer` and `quest_cylinders_active` but not the briefing flag. Fix: (a) grant all story-progression flags in explore mode startup (engineer_briefing_complete, fenn_opened_gate, perimeter_breach_cleared, arrived_meridian, etc.), (b) add room-visit deduplication so the bot doesn't re-enter proc_quarantine rooms it's already cleared, (c) increase explore timeout to cover the full 57-room graph. Without working explore mode, we can't validate content reachability.

## [sonnet] Difficulty tuning — zero deaths across all modes

The bot dealt 9,525 damage and took only 1,185 (12% ratio) with zero deaths across mainline. Even in all-quests mode with 153 kills, zero deaths. The death penalty system (25% energy drain + item drop + respawn + death screen) exists but never triggers. Changes needed:
- Increase Nightside/frost monster damage by 30-40% in monsters.json (shade_stalker 10→14, rime_stalker 12→16, frostfang_hunter 8→11)
- Reduce healing item frequency in outpost and common loot tables
- Add 1-2 monsters to chokepoint rooms (perimeter_breach, nightside_caverns)
- Increase boss special attack damage multipliers from 1.2-1.8x to 1.5-2.2x
- Target: 2-4 deaths on a mainline playthrough so players actually experience the death penalty

## [sonnet] Connect orphaned rooms — 25/57 rooms never visited

Even in all-quests mode, 25/57 rooms are never entered. Key orphans:
- **crypt_01/02**: Accessible from outpost_basement but no quest sends players there. Add Old Keeper side quest to retrieve a lore item from crypt_02 referencing the Underlumen.
- **signal_cave, fen_cache, old_watchtower**: Nightside dungeons with content but no NPC breadcrumbs. Wire Pathfinder Ren dialogue to mention fen_cache, Wren Alcott to send players to old_watchtower with a proper quest flag reward.
- **outer_expanse**: The largest dungeon (200x120) with streaming fog of war — but nothing sends players there. Add Sable dialogue mentioning deep Nightside exploration.
- **homestead_interior, salvage_yard, old_survey_point**: Side content with no quest hooks. Add dialogue references from relevant NPCs.
- **void_flats, underlumen_approach**: Late-game rooms. Verify they're reachable from the quest path.
- **elevation_demo, light_sentry_demo, pulse_cannon_demo**: Demo rooms — remove from room count or mark as dev-only.

The rooms are built. They need signposts: NPC dialogue mentions, quest steps, or at minimum discoverable exits from rooms players already visit.

## [sonnet] Improve item discovery — only 5-9/52 items found

Only 5/52 items collected in mainline (9/52 in all-quests). 181 items are defined but most are in loot tables or side rooms players never visit. Fix:
- Place 2-3 quest-relevant items along the main quest path in visible locations (health_potion near first combat, battery_chip before nightside descent)
- Add pickup-hint trigger messages for important items ("This looks like it could be useful to the Engineer")
- Add `hasItem` dialogueRules so NPCs react when you're carrying relevant items
- Ensure main-path rooms (perimeter_outer_ring, dead_road, nightside_caverns) have at least one visible ground item
- Add Warden Holt dialogue mentioning the mess hall and infirmary to drive traffic to those rooms

## [sonnet] Wire lighthouse_siege_arena to NPCs + lower unlock

The lighthouse siege cooperative challenge is fully implemented (10-wave defense, siege_legendary rewards, communal energy pool) but gated behind `expedition_tier_4_cleared` — deep endgame. No NPC ever mentions it. Fix:
- Add Warden Holt dialogue about siege training grounds after `perimeter_breach_cleared`
- Lower the unlock condition to `perimeter_breach_cleared`
- Add Old Keeper hint about defending the light
- This makes a complete endgame system accessible much earlier and gives multiplayer groups something to do mid-campaign

## [sonnet] Environmental storytelling on the Nightside descent

The nightside_caverns → nightside_depths → nightside_passage → underlumen_threshold path has combat but minimal narrative texture. This 4-room descent is the player's journey into the unknown — it should build dread and mystery. Add:
- 3-4 lore items in items.json (Unbounded cave markings, a pre-human artifact, Spire resonance readings, a journal fragment from the Old Keeper's original expedition)
- Room-entered trigger messages as the player descends ("Your sol unit flickers — something deep is pulling at its frequency", "The walls here aren't natural stone. Something shaped them.")
- Environmental flavor that foreshadows the Deep Array reveal in Act II
- Place these items in visible locations so players actually find them (current item discovery rate is <10%)

## [sonnet] Wire Array dungeon chain into quest narrative

The dayside has 5 dungeons (solar_fields → extraction_outpost → synthesis_lab → deep_processing → control_center/command_throne) but the later ones are gated behind ending path flags. The Array complex should feel like a progressive investigation during the main quest, not a post-choice endgame zone. Add:
- MERIDIAN-7 breadcrumbs in meridian_array_hub guiding players through the chain
- Asha Denn dialogue framing each Array dungeon as an investigation step ("The Array's border installations have gone quiet — investigate the extraction outpost")
- Quest step objectives that take players through at least extraction_outpost and deep_processing before the choice point
- This connects 3-4 existing dungeons that are currently dead-end endgame content into the mid-game campaign flow

## [opus] Build Lighthouse Mara — Act I core beat

The single most-referenced missing content: 15+ NPC dialogue lines mention Lighthouse Mara, but no dungeon exists. Core Act I beat from the storyboard — the player's first real expedition after the tutorial.

Create a 3-floor dungeon:
- Floor 1: Frozen approach through dark perimeter, frost_crypt tileset, frostfang_hunters + rime_stalkers
- Floor 2: Lighthouse exterior — structural damage (not raider-caused), shade_stalkers, environmental cold hazard
- Floor 3: Lighthouse interior — repair objective, survey marker referencing unusual geological readings, optional Sable sighting in the distance
- Wire into main quest between "cross perimeter" and "arrive Meridian"
- Drops: Lighthouse Survey Log (lore item foreshadowing Deep Array), frozen_core, rechargeable_battery

This transforms Act I from tutorial+fetch-quests into a real expedition with atmosphere and mystery. It's the most impactful single piece of new content we can build.

## [opus] Build Dural Voss boss encounter — Act I antagonist

The luddite_warlord monster type exists (350 HP, ground_slam/stun) and Dural Voss is referenced in NPC dialogue, but there's no actual boss fight. Create:
- A dedicated `dural_voss` monster entry (~500 HP, retreat AI — flees at 20% HP, lunge/stun/ground_slam attacks)
- An encounter room: raider_camp dungeon at the edge of the Nightside, between dead_road and nightside_caverns
- Pre-fight dialogue: "We didn't touch your Lighthouses — whatever's killing them is deeper than you think"
- Retreat flag (`dural_voss_fled`) marking him as fled rather than killed — he returns in Act II
- Post-fight: Dural Voss's camp contains Array energy signatures on a broken console, planting the central twist seed

This gives Act I's antagonist a face and makes the raider threat feel personal before revealing they aren't the real enemy.

## [opus] Build Spire of Vigil — Act I climax

The storyboard's Act I finale — the most ambitious content piece but also the most transformative. A 2-3 floor dungeon:
- Floor 1 (Raider Stronghold): Luddite fortifications, traps, coordinated pack_leader squads, mini-boss raider captains. Use nightside tileset.
- Floor 2 (Ancient Core): Architecture shifts to pre-human Underlumen geometry. Puzzle rooms teaching Light Sentry placement. New tileset strip or adapted nightside.
- Floor 3 (Spire Chamber): Ability resonance event permanently unlocking Light Sentry. Sensor logs showing Array energy signatures. The "someone activated this from the outside" revelation.

Wire into main quest as Act I finale. Together with Lighthouse Mara and Dural Voss, completing this gives the game a real multi-hour Act I campaign instead of a 26-minute bot run.

## [sonnet] Level-up stat screen and weapon disassemble confirmation

Two high-impact UX improvements:
- **Level-up screen**: When the player levels up, show a brief stat summary popup (HP increase, damage scaling, energy changes) — every level-up should feel meaningful. New NET message type + client overlay.
- **Disassemble confirmation**: Add a confirmation dialog before disassembling weapons ("Disassemble [weapon]? Components will be lost.") to prevent accidental destruction. Small client-side change.

Both are minimal engine work with outsized impact on player satisfaction and game feel.

## [sonnet] Replace top-priority placeholder sprites

Priority replacements for maximum visual impact:
- Player character (on screen 100% of the time)
- Warden Holt (first NPC met, 16 dialogue branches)
- Health potion (most-used item)
- Sol unit item (key progression item)
- MERIDIAN-7 terminal (unique entity type, 23 dialogue branches)

The art style guide at docs/art-style-guide.md defines the master palette and 16x16 conventions. The existing sprite redesign pass covered monsters — these core entity sprites need the same treatment. Even 5-6 carefully designed sprites would dramatically improve first impressions.

## [opus] Build Greenway corridors + Spire of Winds — Act II

Act II setting and climax. The political crisis is told through NPC dialogue in Meridian but never shown — no Greenway zones, no Bulwark occupation, no Spire of Winds. Create:
- 2-3 Greenway corridor dungeons connecting Meridian to the Monument of Winds — agricultural zones under Bulwark martial law with civilian NPCs caught between sides
- Bulwark soldier enemy types (human military AI, checkpoint mechanics) + a Compact General boss
- Spire of Winds: vertical navigation puzzles and Hover ability unlock
- Greenway tileset (adapt meridian tileset with agricultural palette)

This makes Act II tangible — players see the occupation instead of just hearing about it.

## [opus] Build Spire of Radiance + three-path ending — Act III climax

The final campaign dungeon. The ending path dungeons (array_control_center, merge_nexus, array_command_throne) already exist as post-choice rooms, but there's no gateway dungeon where the choice happens in-narrative. Create:
- The Dayside Spire encased in Array infrastructure
- Array-organic hybrid enemies (new monster types)
- Energy management puzzle rooms using Photonic Pulse
- Photonic Pulse ability unlock in the Spire core
- The three-path choice confrontation scene, then route to the appropriate ending dungeon

Completing this + Spire of Vigil + Spire of Winds gives the game its full campaign spine from tutorial to credits.
