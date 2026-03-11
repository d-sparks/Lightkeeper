TODOs

- [opus] Fix headless sim mainline regression: bot gets stuck in proc_quarantine after only 4/52 rooms visited, 0 combat — pathfinding fails when A* path is blocked by monster collision circles, needs pathfind-around-monsters logic or monster-avoidance fallback
- [opus] Resolve content validator errors: 5 flag warnings (automation_established, expedition_active, expedition_tier_N_cleared) — either suppress engine-set flags in validator or add stub trigger comments so validator recognizes them
- [opus] Wire MERIDIAN-7 endgame crafting dialogue: craft action type exists in actions.js and crafting.json has recipes, but no NPC dialogue trigger gates the crafting menu behind the endgame_active flag
- [sonnet] Add client-side expedition HUD showing current floor number, total floors, expedition tier, and boss health bar during expedition runs
- [opus] Add mid-run loot banking checkpoints to expeditions: safe rooms between floors where players can bank collected loot so death only forfeits current floor items, not the entire run
- [sonnet] Add explicit patrolPath waypoints to all patrol-AI spawns that lack them: nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02, and outer_expanse rooms
- [sonnet] Place feral_hound_alpha and frostfang_alpha as rare spawns in nightside_caverns and frost proc templates — monsters defined with pack_leader AI but never placed in any dungeon
- [sonnet] Add ending-path-specific automation structure variants: bio_harvester (shutdown), symbiotic_node (merge), array_drone_bay (control) as described in endgame-loop.md Phase 4
- [opus] Implement cooperative player-count gating for Tier 4-5 expeditions: require 2+ players to start, shared expedition state tracking across party members
- [sonnet] Improve tileset sprites for crypt, outpost, and quarantine zones — refine textures per zone color identity in art-style-guide.md
- [sonnet] Wire new tileset strips for dark_city, quarantine, and outpost proc templates — PNG files exist but are not referenced by any tileset JSON
- [sonnet] Add mismatched-path intel flavor text: bringing shutdown intel to Control ending (or other cross-path combinations) should trigger acknowledgment dialogue
- [opus] Add worldmap connectivity for Array Extraction Outpost — currently reachable from dayside_solar_fields but missing from any overworld navigation or map marker system
- [opus] Build raid event system for automation defense: periodic nightside creature waves attack dayside structures when auto_turret is unlocked, structure HP/repair, turret defense value reduces damage
- [sonnet] Add map markers and NPC breadcrumbs for Nightside Caverns entrance so new players can find the nightside content path
- [sonnet] Audit and wire remaining orphaned flags: run content validator grep for setFlag calls without matching hasFlag consumers and vice versa
