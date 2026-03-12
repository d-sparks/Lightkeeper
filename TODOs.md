TODOs

- Wire Lighthouse Siege start trigger: siege engine exists but no NPC interaction launches it — add a post-endgame NPC or interactable in meridian_station that calls startSiege() so players can actually access the cooperative challenge
- Fix content validator reachability errors: dayside_raid_defense and lighthouse_siege_arena are unreachable from spawn — add conditional exits or teleport triggers so these special dungeons connect to the world graph
- Build dark_city dungeon: tileset JSON and sprite strip exist but no dungeon uses dark_city yet — design a Meridian Warrens or undercity deep floor as a second dark_city dungeon below meridian_undercity
- Wire expedition_tier_4_cleared and expedition_tier_5_cleared flags into NPC dialogue or gating — these flags are set by the engine but never checked anywhere, wasting progression milestones
- Add client-side expedition HUD: floor counter showing current floor/total, tier indicator, and boss health bar during expedition runs
- Add Nightside-path discovery hints in earlier rooms (outpost_perimeter or outpost_comms) with visited_dead_road suppression so new players learn about the Nightside before reaching the Dead Road
- Add explicit patrolPath waypoints to patrol-type monster spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, and outer_expanse — currently many patrol spawns lack waypoints and just stand still
- Build Fence Elara repeatable shop in meridian_undercity: return-visit purchase option for smuggled consumables and materials, giving the undercity a reason to revisit after clearing the Luddite gang
- Add siege visual feedback: lighthouse entity rendering in the arena, wave start/clear announcements, and victory/defeat overlay — currently only HUD bars and event data are sent
- Add siege lighthouse repair interaction: design doc specifies spending silicon to repair between waves but the mechanic is not implemented
- Handle party disconnect in cooperative expeditions: if a party member disconnects mid-expedition they remain in the party list — add cleanup on disconnect with partial-party continuation
- Fix path-specific structure locked display: bio_harvester/symbiotic_node/array_drone_bay appear unlocked in automation screens sent outside the AUTO_BUILD flow because pathFlags aren't passed to all getStateForClient call sites
- Design harvester scaling: define silicon collection rate progression, max harvester counts, and better harvester variants for late-game automation levels 11-20
- Build meridian_undercity_deep: second dark_city floor accessible via stairs_down from meridian_undercity north zone, connecting to Underlumen-adjacent tunnels — the exit exists conceptually in NEXT_TODOS but has no dungeon JSON
- Place feral_hound_alpha and frostfang_alpha as rare spawns in nightside_caverns and frost procedural templates — these pack leader monsters are defined but never placed in any dungeon
- Add undercity discovery trigger in meridian_market: the stairs_down at (14, 9) has no first-discovery message — add a door_interacted trigger so players know the passage exists before stepping in
- Investigate headless sim remaining ~15% intermittent failure: titanium_cylinders chest interaction failure and unreachable monsters at proc_quarantine depth 3 still cause sporadic test failures
