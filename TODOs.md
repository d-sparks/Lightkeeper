TODOs

## Quest line / starting story
- [sonnet] The sol unit by default has no energy and no energy capacity.
- [opus] Create two items if they don't exist, and modify them if they do. They are "single use battery" and "rechargeable battery." Both add to your max sol unit energy, but, sol unit max energy will be a sum of rechargeable energy + single use energy. To use abilities, always draw from rechargeable first. Render a distinction in the sol unit energy bar HUD element. If consuming energy draws into single-use energy, it subtracts permanently from a single use battery in your sol unit (smallest battery first). Let's say by default each type of battery gives you 100 energy.
- [sonnet] Instead of charging your sol unit, the charging station person in balor will always give you a single use battery if you don't have one. This starts the loop: you get a battery, quest until you need energy, then go back for a new battery. For longer dungeons, we can piece single use batteries throughout as sort of checkpoints.
- [opus] The flare, when used, should create an "extraction point" (burning like fire on the ground). It should leave an extraction protocol item in your inventory in its place that when used brings you back to the extraction point for that flare.
- [opus] Battery technology will be unlocked via the MERIDIAN-7 automation loop. As soon as you get to MERIDIAN-7 I want to see two things: (1) you trade umbracite for your abilities and upgrades thereto, and this is effectively the skill tree. (2) by now you're tired of single use batteries and you can see in the UI that if you progress your automation enough you'll get a rechargeable battery. So: change this so that you trade the umbracite to MERIDIAN-7 for you second skill, which, maybe can be sol shield for now. Then, have the automation UI show rewards you get along the way, and see that nice rechargeable battery there as motivation.

## Human inputs
- [sonnet] Add a "fill" tool to the editor, which fills all horizontally or vertically connected, same type tiles, with a selected tile type.
- [opus] Full wall should go all the way down. Check latest screenshot.
- [opus] Add in game chat! User presses enter and types, hits enter to display their chat. Also support user microphones by holding v and speaking, if mic access is allowed.

## Priority 1: Connect the Dots (Quest Graph & Progression)

These tasks wire together existing content that is currently disconnected. Maximum impact because the content already exists — it just needs to be reachable.

- [opus] **Extend main quest into Act II (steps 19-22).** After "Visit the Workshop District" the player has zero guidance. Add steps directing them to: (a) dayside_solar_fields via Yun/Hollis breadcrumbs, (b) Array complex discovery via MERIDIAN-7 trade quest, (c) Nightside expedition setup via Sable/Asha, (d) set `act3_asha_alliance_activated` so nightside_expedition quest becomes startable.
- [sonnet] **Wire orphaned flags into NPC dialogue.** 14 flags are set but never checked (content validator warnings). Priority targets: `frost_warden_defeated`, `elder_sporecap_defeated`, `magma_core_cleared` → NPC reactions (Wren, Sable, Asha); `autotroph_path_defiant/cooperative` → gate Act III dialogue options; `sable_trust`, `sable_guiding` → deepen Sable's relationship arc.
- [sonnet] **Make generators obtainable.** `basic_generator_chip` and `improved_generator_chip` exist as items and sol components but appear in zero loot tables, zero quest rewards, and zero shops. Add: basic_generator as a quest reward from the storyboard "Grab the Generator" event (Tech Maren after outpost attack), improved_generator in array_deep_processing loot or as MERIDIAN-7 trade reward. Without these, energy progression is broken.

## Priority 2: Game Feel (The Fun Gap)

The engine works. The content is deep. But the moment-to-moment experience is hollow.

- [sonnet] **Hitboxes** With blaster the hitboxes aren't friendly - shots that should hit are missing. Can we make this more generous?
- [sonnet] **Quest progression** After talking to Tech Yara, the quest doesn't advance to point me to the underground power conduit junction thingy - it just points back to her.
- [sonnet] **Entering rooms** When entering a room sometimes the click to move is still in effect from the last room, causing us to move unnaturally into the room. It should clear when entering a room.
- [opus] **Death penalty.** When player dies: drain 25% energy, drop non-quest items per dropBehavior, respawn at room entrance. This is the single biggest missing game mechanic — without stakes, dungeon runs have no tension. Server-side change in game-loop.js death handler.
- [sonnet] **Combat juice pass.** (a) Screen shake on player hit (client renderer), (b) monster death fade-out animation (0.3s alpha tween), (c) projectile tinting by damage type (fire=orange, ice=blue, acid=green), (d) ambush monster fade-in reveal effect. Small visual changes that make combat feel 10x better.
- [sonnet] **Fix headless sim NPC interaction.** Bot is stuck at perimeter_gate (step 10 of 18) because it can't approach and interact with Sgt. Fenn. The sim needs to walk within NPC_INTERACT_RANGE and call tryInteract(). Fixing this unblocks automated regression testing for the entire main quest and all side quests.

## Priority 3: Content Depth (Make Existing Zones Feel Alive)

- [opus] **Wire automation screen access (Phase 3).** The automation grid UI is fully built (Phases 1-2 done) but players can never open it. Add `openAutomation` scripting action, MERIDIAN-7 interaction trigger in train_station or dayside dungeon, and client handler for AUTO_STATE with openScreen flag. See docs/automation_screen.md Phase 3.
- [sonnet] **Boss music trigger.** The `boss_crystal` music track exists but isn't triggered during the Crystal Guardian encounter. Wire it via a trigger in the Crystal Guardian's dungeon — boss music on spawn, restore biome music on defeat. Quick win for atmosphere.
- [sonnet] **Assign correct tilesets to dungeons.** Several dungeons use generic "crypt" tileset when they should use zone-specific ones: outpost_* → "outpost", station_* → "station", meridian_* → "meridian". This auto-activates the per-biome music system that's already wired. Pure content change.

## Priority 4: Story Completion (Act II → III Bridge)

- [sonnet] **Spawn Council faction NPCs.** Steward, Compact, and Root representatives are referenced in Asha's `array_secret_crisis` dialogue but don't exist as NPCs in meridian_civic. Add 3 NPCs with conditional dialogue that reacts to `array_secret_discovered` and `chose_path_*` flags. These embody the political crisis that drives Act III.
- [opus] **Build one Act III ending dungeon (shutdown path).** Start with the simplest ending: `array_control_center` dungeon with Array construct enemies, a boss encounter (array_overseer), and resolution triggers that set `ending_shutdown_complete`. This proves the ending pipeline and serves as a template for the merge and control paths.

## Priority 5: Testing & Quality

- [sonnet] **Fix physics dt wall-skip bug.** The one failing unit test: player teleports through walls at large dt. Add dt clamping (cap at 4x normal tick) or substep logic in movePlayer. Prevents a real gameplay exploit where lag spikes let players clip through walls.
- [sonnet] **Integration tests (Tier 4).** Combat flow (attack → damage → death → loot), equipment system (equip/unequip → ability rebuild), sol grid adjacency modifier calculation. These catch regressions as content scales. See docs/TESTING.md Tier 4 plan.

## Backlog (next cycle)

- [sonnet] Sound effects for core actions (audio system is wired, needs content)
- [sonnet] Stun/knockback immunity window to prevent stun-locks
- [sonnet] Large-map content (200x120+) to leverage fog-of-war streaming system
- [opus] Session auth to prevent character hijacking
- [opus] Act III merge and control ending dungeons
- [opus] Extended-adjacency sol modifiers (radius 2, row/column) for legendary tier
