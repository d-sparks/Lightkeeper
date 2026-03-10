TODOs

- [opus] Wire automation screen access (Phase 3): openAutomation action exists in actions.js but no MERIDIAN-7 trigger fires it during normal gameplay. Add an npc_interacted trigger for meridian_7 that sends AUTO_STATE with openScreen:true so players can reach the fully-built automation grid UI
- [opus] Implement death penalty consequences: energy drain and item drop on death are coded but there is no respawn-at-entrance behavior or player-facing feedback (screen effect, message). Add respawn teleport to room entrance and a death screen overlay so the penalty loop feels complete
- [sonnet] Add post-choice NPC dialogue for all three ending paths: Asha, Sable, MERIDIAN-7, and Wren need dialogue variants reacting to chose_path_shutdown, chose_path_merge, and chose_path_control flags. Currently the game ends silently after the choice
- [sonnet] Add Wren Alcott post-quest dialogue variants: Wren currently only reacts to frost_warden defeat. Add reactions for elder_sporecap_defeated, magma_core_cleared, arrived_meridian, and Act III story beats to complete her mentor arc
- [sonnet] Wire sable_trust numeric escalation: sable_trust is set to 1 once and never incremented. Add trust-building interactions (completing Nightside guide mission, returning from deep expeditions) so flagGreaterThan checks can gate deeper relationship stages
- [opus] Add minimap quest waypoints: colored dots on the minimap showing active quest objective locations. Currently there is zero spatial guidance for where to go next
- [sonnet] Add registrar_hollis array_secret_discovered dialogue variant: the civic bureaucracy should have ambient reactions when the player discovers the Array's true nature and the Council fractures
- [sonnet] Rotate touch joystick and gamepad analog input 45 degrees for isometric movement: raw screen-space dx/dy is sent instead of world-space, making diagonal movement feel wrong on mobile and controllers
- [opus] Add automation dungeon sync (Phase 4): structures placed in the automation grid should appear as real tiles when visiting dayside_solar_fields. Merge player automation placements into MAP data at room-join time
- [sonnet] Add room-lifecycle integration tests (Tier 4 gap): createRoom to join to transition to cleanup flow. Last remaining unit test gap per testing plan
- [sonnet] Improve blaster hitboxes: projectile-vs-monster collision is too tight causing shots that visually connect to miss. Make collision checks slightly more generous
- [opus] Add pack leader AI variant: a pack monster that buffs nearby pack members with damage or speed aura, adding tactical depth to pack encounters
- [sonnet] Add placeholder sprites for sable_nightside_guide, sable_threshold, and unbounded_elder NPCs that currently have no unique sprites
