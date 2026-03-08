# Lightkeeper — Next Tasks

Prioritized task list. Updated 2026-03-08.

---

## Quest Graph & Main Quest Extension (connect the dots — highest priority)

- [ ] **1. [opus] Extend main quest into Act II** — Add steps 14-17 to main_quest.json: step 14 directs player to dayside_solar_fields (via Yun or Hollis breadcrumb), step 15 has player explore Array complex and discover Project Autotroph, step 16 briefs Asha on the Array secret, step 17 prepares for Nightside expedition. Currently the main quest ends at "meet Yun" with no guidance toward Act II content — players must stumble into dayside/Array independently.

- [ ] **2. [sonnet] Add NPC breadcrumbs to dayside** — After `met_crafter_yun`, Yun or Registrar Hollis should mention dayside_solar_fields in dialogue ("The solar fields to the east need maintenance" or similar). Currently no NPC directs the player there, making dayside content effectively hidden.

- [ ] **3. [opus] Wire autotroph_path flags into Act III branching** — `autotroph_path_defiant` and `autotroph_path_cooperative` are set in meridian_array_hub.json but never checked anywhere (confirmed by content validator). These should gate different Asha/Sable dialogue branches and influence which Act III ending paths are available or easier.

- [ ] **4. [sonnet] Wire boss-kill flags into NPC reactions** — `frost_warden_defeated`, `elder_sporecap_defeated`, and `magma_core_cleared` are set but never checked (content validator warnings). Add NPC dialogue variants in Meridian (Yun, Asha, or faction reps) acknowledging these accomplishments. Pure JSON content.

- [ ] **5. [opus] Build Act III ending path skeletons** — Create three ending dungeon files (array_control_center, underlumen_nexus_chamber, array_command_core) with boss placeholder spawns, resolution triggers that set ending flags, and post-choice NPC dialogue variants for Asha, Sable, and MERIDIAN-7. Currently Act III is stubbed — nightside_expedition accepts path choices but nothing happens after.

## Content Depth (extend the game)

- [ ] **6. [opus] Create Nightside boss encounter** — Add a multi-phase boss in nightside_depths (shade_stalker_alpha variant or new gloom_wraith boss). Follow Crystal Guardian pattern: boss_* AI type, health bar, phase transitions, intro presentation. The game currently has only one boss fight.

- [ ] **7. [sonnet] Wire generators into obtainable loot/rewards** — basic_generator as relay_recovery quest completion reward. improved_generator in array loot tables or as MERIDIAN-7 trade reward. These items exist in items.json but can't be obtained — critical gap in energy progression.

- [ ] **8. [sonnet] Create underlumen loot tables** — threshold_watcher, abyssal_tendril, and threshold_keeper have no loot tables. Create content/loot/underlumen.json with thematic drops (umbracite, rare sol components, Underlumen-themed modifiers).

- [ ] **9. [sonnet] Late-game monster XP scaling** — magma_brute (240 HP, 55 XP), frost_warden (280 HP, 60 XP), elder_sporecap (320 HP, 65 XP) give disproportionately low XP for their durability. Scale to ~80-100 XP range. Pure JSON fix in monsters.json.

- [ ] **10. [sonnet] Add council faction NPCs to meridian_civic** — Steward, Compact, and Root faction representatives referenced in Asha's dialogue but not spawned. Add as NPCs with conditional dialogue reacting to `array_secret_discovered` and `chose_path_*` flags. Brings political tension to life.

## Game Feel (make it satisfying)

- [ ] **11. [opus] Death penalty implementation** — When the player dies: drain energy, drop non-quest items per dropBehavior rules, respawn at room entrance. The single biggest game-feel gap — transforms risk-free wandering into tense dungeon runs. See architecture-plan.md death flow spec.

- [ ] **12. [opus] Combat juice pass** — Screen shake on player hit, monster death fade-out animation, ambush monster fade-in reveal, projectile tinting by monster type (fire=orange, ice=blue, acid=green). Small VFX that compound into satisfying combat.

- [ ] **13. [sonnet] Wire Crystal Guardian boss music** — `boss_crystal` track exists in music.json but isn't triggered during the encounter. Add a trigger in the Crystal Guardian room that starts boss music on encounter start and stops it on defeat.

## Testing & Quality

- [ ] **14. [sonnet] Fix physics test failures** — 6 tests fail because `makeContent()` in physics.test.js doesn't mock `getRampInfo()` (added to physics.js after tests were written). Add `getRampInfo(d, tx, ty) { return null; }` to the mock. Zero-risk fix.

- [ ] **15. [sonnet] Assign biome tilesets to remaining dungeons** — Dungeons using generic "crypt" tileset should use their zone's tileset (outpost_* → outpost, station_* → station, meridian_* → dark_city). Auto-activates per-biome music. Pure JSON content fix.

- [ ] **16. [sonnet] Improve headless sim NPC interaction** — Bot gets stuck at `talk_to_engineer` (step 3 of main quest) — only visits 3/44 rooms. Needs NPC approach + interact logic so the sim can validate more of the quest chain.

## Standing Tasks

- [ ] Run ralph to check for quality issues.
