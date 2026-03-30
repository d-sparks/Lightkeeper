# TODOs

Prioritized by impact. Sim state: mainline 5/124 rooms (4%, regression), explore 13/124 (10.5%). Content validator: 7 errors, 8 warnings.

### Unblock Testing (sim is broken, everything else is flying blind)

- [opus] Fix mainline sim regression in proc_quarantine. Bot gets stuck at depth 2 looking for stairs_down exit — previously reached 46/124 rooms (37%), now only 5/124 (4%). The proc_quarantine depth-2 room has no stairs_down exit or it's unreachable by A*. This blocks ALL automated testing of the campaign beyond the first 3 minutes.
- [opus] Fix sol_unit_training quest referencing unreachable rooms. Removing ability chamber exits from outpost_basement broke 3 quest steps (test_elevation, test_light_sentry, test_pulse_cannon) and left elevation_demo/light_sentry_demo/pulse_cannon_demo as orphaned dungeons. Either gate the exits behind a story flag so they reopen later, or restructure the quest to skip those steps until abilities are unlocked. Also set the training_rooms_hint_seen flag somewhere.
- [opus] Fix explore mode A* failure in perimeter_outer_ring at tile (13,6). Bot soft-locks trying to reach an interactable tile behind a wall. explore_room should skip tiles that A* can't reach, or the map needs a walkable path to that tile. This blocks explore coverage beyond 13/124 rooms.
- [sonnet] Teach sim bot showChoice handling. The Act 3 ending path requires a player choice (sever/restore/subsume) that the bot can't provide. Until the bot can make choices, all three endings are untestable by automation. Default to "restore" path.

### Connect Disconnected Content (wiring gaps that break narrative flow)

- [opus] Wire 10+ disconnected lore/state flags to NPC dialogue and gameplay. Flags like found_refined_umbrasite, found_geometric_tablet, sable_guiding, elder_merge_path_revealed, found_raider_manifest, and found_raider_journal are set but never checked. Wire them to relevant NPC reactions: MERIDIAN-7 reacts to umbrasite findings, Unbounded Elder reacts to geometric tablet, Sable behavior changes when sable_guiding is set, merge ending gets bonus dialogue from elder_merge_path_revealed.
- [sonnet] Fix siege_cooldown_active permanent flag. The flag is set on siege completion but never cleared — siege_warden permanently shows cooldown dialogue after first clear. Either clear it via a timed mechanism or switch the NPC dialogue to check lighthouse_siege_last_clear timestamp directly.
- [sonnet] Require merge_nexus NPC conversations before communion. The ending trigger fires on tile interaction at (12,11) without requiring the player to speak to asha_merge, sable_merge, or meridian_7_merge. Gate the communion behind all three conversations to add narrative weight to the most story-driven ending.
- [sonnet] Add endgame quest definition tracking the Act 3 ending choice through completion. Currently no quest covers choosing shutdown/control/merge and executing it. Players have no quest log guidance for the final act's climax.

### Balance and Game Feel (the difference between "works" and "fun")

- [opus] Bridge Act 2 weapon progression plateau. No intermediate weapon between Sol Unit (12 dmg) and epic sol units (14-18 dmg). Add a rare-tier weapon drop from General Thorne or Spire of Winds content, and increase Bulwark Shock Baton drop weight from 1 to 3 so players actually find Act 2 melee upgrades. Also add a rare/epic ranged weapon — best ranged is Bulwark Combat Rifle (+8 dmg), causing ranged builds to fall behind by Act 3.
- [sonnet] Rebalance General Thorne phase 3. 28-damage projectiles at 0.9s interval + conscript summons is overwhelming solo. Increase summon interval from 10s to 15s and reduce phase 3 projectile damage from 28 to 22. Keep the fight hard but not mathematically impossible without perfect play.
- [sonnet] Add heat hazard warning before Spire Radiance Forge. 3.3 DPS heat damage combined with combat is extremely punishing without Array Precision Frame's heat resist. Add a warning NPC or lore note at the forge entrance, and consider placing a heat_resist consumable in the preceding room.

### Art and Visual Polish (placeholder art is the most visible gap)

- [opus] Commission Batch 1 sprite art. Brief ready at docs/art-commission-brief.md. 10 priority entities (14 PNGs): player character (4 variants), Warden Holt, MERIDIAN-7, Sol Engineer, Councillor Asha, dusk_crawler, frostfang_hunter, shade_stalker, Crystal Guardian, Dural Voss. Post the listing from docs/art-commission-posting.md, review portfolios, request 1 test sprite before full batch.
- [sonnet] Replace placeholder tileset art for Act 2-3 zones. greenway, biolab, spire_winds, dayside, and spire_radiance tilesets are all auto-generated placeholders. Commission or generate art-guide-compliant sprite strips that match the zone color identities in docs/art-style-guide.md.

### Playtest and Verify (human eyes on untested content)

- [opus] Full human playtest of Acts 2-3 and all 3 ending paths. Everything beyond Lighthouse Mara is unverified by human play. Need 2-3 sessions logging: pacing through Greenway/Spire of Winds, General Thorne boss feel, Array complex atmosphere, Spire of Radiance difficulty, and whether each ending path feels satisfying and roughly equal in length. Document soft locks, narrative gaps, and balance issues.
- [opus] Cap proc dungeon nesting depth at 1. proc_quarantine can spawn inside itself up to depth 3+ (proc:proc_quarantine:proc:proc_quarantine:...) causing extremely long room IDs and potential infinite recursion. Limit the procedural generator to refuse nesting beyond depth 1-2.
