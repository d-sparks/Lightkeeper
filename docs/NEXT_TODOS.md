# Next TODOs

Outstanding follow-up items organized by area. These feed into the next batch of TODOs.md tasks.

## Content Validation Errors (must fix)

All 6 errors resolved:
- [x] `sol_cone` component: renamed key from `sol_cone_emitter` to `sol_cone` in sol_components.json
- [x] `umbral_seed_dark_exposed`: fixed flag name mismatch — deep_perimeter_east.json and underlumen_approach.json were using `seed_exposed_to_dark` instead
- [x] `warlord_defeated`: already set in proc_quarantine.json template — fixed validator to scan template triggers
- [x] `damage_booster_equipped`: already set in server/index.js engine code — added engine-set flags allowlist to validator
- [x] `has_traded_meridian`: already set in server/index.js engine code — added to engine-set flags allowlist
- [x] `supply_manifest`: already spawned in proc_quarantine.json requiredRooms — fixed validator scanObtainableItems to check nested requiredRooms[].itemSpawns

## Monster Deployment

- [x] Add dungeon monsterSpawns entries using the new AI types (ambush, patrol, pack) in actual dungeon floors — deployed across nightside, frost, geothermal, and fungal dungeons plus procedural templates
- Add placeholder sprites for new monsters (shadow_ambusher, tunnel_creeper, feral_hound) — currently reusing existing sprites
- Add placeholder sprites for newer monsters missing from PLACEHOLDER_ASSETS.md (dusk_crawler, crystal_guardian, garden_mite, nest_mother, shade_stalker, shade_stalker_alpha, ravine_lurker, gloom_wraith, rime_stalker, frostfang_hunter, vent_spewer, magma_brute)
- [x] Add a proc_geothermal procedural template (vent_spewer, magma_brute pool) — proc_geothermal.json added

## Monster Loot Wiring

All done:
- [x] All 25 combat monsters have lootTable references (training_target intentionally excluded)
- [x] 22 monster-specific loot tables exist across common.json (10) and nightside.json (12)
- [x] Biome loot tables with faction sol modifier drops: frost.json, geothermal.json, fungal.json, outpost.json (3 tiers each: common/uncommon/rare)
- [x] Monster-specific loot tables now include sol modifier chip drops — faction-aligned, weighted by monster difficulty and mod rarity
- [x] Wire biome loot tables to dungeon chests/crates via triggers (rollLootTable action on interactable tiles)
- [x] Add biome loot table references to procedural dungeon templates (proc_frost_crypt, proc_fungal_forest, proc_quarantine, proc_quarantine_deep)
- [x] Add a proc_geothermal template with chest tiles wired to geothermal loot tables — done in proc_geothermal.json
- [ ] Add placeholder chest/crate sprites to frost_crypt, fungal_forest tilesets (tile IDs 10/11) and crypt tileset (tile IDs 30/31 for unlocked crates)

## Combat & AI Polish

- Consider adding a "reveal" visual effect on client when ambush monsters appear (fade-in animation)
- Monster projectiles (from ranged_kite) use generic blue color — tint by monster type or add distinct sprite
- [x] The existing dungeon `patrol` field on monsterSpawns is wired into the engine — patrol monsters follow waypoint paths (explicit `patrolPath` array or auto-generated back-and-forth)
- Add explicit `patrolPath` waypoints to remaining dungeon spawns that use `"patrol": "patrol"` (nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, crypt_02) — currently they auto-generate default paths
- Pack AI could be extended with a "pack leader" variant that buffs nearby pack members

## Balance Pass Follow-ups (combat & energy)

- Headless sim bot can't navigate past early rooms (gets stuck at NPC interactions, only visits ~6/42 rooms) — needs bot pathfinding/AI improvements before sim-based balance testing is useful
- Verify new basic_generator and improved_generator items are obtainable via loot tables or quest rewards — currently defined in items.json but not yet wired into any dungeon chests or loot drops
- Playtest energy pacing at mid-game (improved_generator @ 4/s) to confirm Sol Beam spam isn't still trivial with energy cost reduction modifiers stacked
- Crystal Guardian phase 3 was tuned down (18 dmg, 1.0s projectile interval, 10s summon interval) — verify this still feels challenging in manual play
- Consider adding a "basic_battery" sol component (uncommon, +30-50 capacity) as a mid-tier bridge between base sol unit capacity and the legendary Advanced Rechargeable Battery (+150)
- Medipac heal cooldown (45s) may be too long given that Sol Shield (12s, 25 energy, 35 HP) exists — compare healing economy in manual play

## Sol Grid Follow-ups

- [x] Client UI displays healOnHit, energyCostReduction, and boostedEnergyRegen in sol grid
- [x] Define the 5-6 sol unit variants (grid dimensions, innate perks, where found) — 6 variants in sol_units.json with innateBonus engine support
- [x] Client UI should display sol unit innateBonus info (name, perk description) on the sol grid screen
- Design and implement extended-adjacency modifiers (radius 2, entire row/column) for rare/legendary tier
- [x] Define modifier stat ranges per rarity tier (common -> legendary number values) — resolved in progression-system.md
- Add dungeon triggers/loot for acquiring new sol units (nightcaster_frame, array_precision_core, greenway_bioframe, underlumen_nexus)

## Act II Quest Follow-ups

- Add placeholder sprites for Nightside Caverns and Depths tilesets (currently using frost_crypt)
- [x] Dedicated "nightside" tileset with umbracite-vein wall tiles — nightside.json added
- [x] Crystal Guardian boss has unique multi-phase AI (boss_crystal): phase 1 melee, phase 2 crystal shard projectiles, phase 3 summons crystal shard minions
- [x] Crystal Guardian boss: client-side visual effects for phase transitions (boss_phase event), summon bursts (boss_summon event) — screen shake, floating phase text, CSS flash
- [x] Crystal Guardian boss: boss health bar UI (client receives boss=true, bossPhase in monster data) — HUD bar at top-center + enhanced in-world bar
- Crystal Guardian boss: consider adding boss intro animation/cutscene when entering boss room
- Crystal Guardian boss: add dedicated boss music track (currently uses dungeon music)
- [x] MERIDIAN-7's umbrasite quest now has an escalating tier (Resonant Umbracite Core) post-secret-discovery
- Make sure initial MERIDIAN-7 trade at train station flows into Array Hub quest
- Add map/minimap markers or quest waypoints for Nightside Caverns entrance
- [x] Environmental hazards in biome dungeons (cold, heat, poison damage implemented)

## Array Complex Follow-ups

- [x] Add placeholder sprites for array_sentinel and array_fabricator monsters
- [x] Add loot tables for array_sentinel and array_fabricator
- [x] Add generate-sprites.js entries for new Array construct monsters
- [x] Gate array_synthesis_lab access behind umbrasite quest completion — exit conditions added
- [x] Add array_clearance_badge as key requirement for array_deep_processing door — exit requires hasItem check
- [x] Wire array_secret_discovered flag into MERIDIAN-7 dialogue at the Hub (confrontation dialogue)
- [x] Wire array_secret_discovered flag into Sable, Asha, and Council NPC dialogue for Act 3 progression hooks
- [x] Add MERIDIAN-7 post-confrontation Act III dialogue (reveals Project Autotroph's flaw, internal conflict)
- [x] Add Asha act3_alliance dialogue (joint expedition to deep Nightside, tri-faction cooperation)
- [x] Add Sable Act III dialogues with high/low trust variants (Unbounded elder maps, Nightside guidance)
- [x] Add Array Overseer mini-boss in array_deep_processing (with boss kill trigger, lore drop, confrontation dialogue)
- Replace placeholder sprite for array_overseer (currently copied from array_sentinel)
- Wire autotroph_path_defiant / autotroph_path_cooperative flags into Act III quest branching
- Add Phase 3 investigation quest after Autotroph confrontation (player explores deep Array sub-tiers)
- Add replacement Overseer encounter that adapts to player tactics (referenced in post-confrontation dialogue)

## Act III Follow-ups

- [x] Add `resonant_umbracite_core` item definition to items.json — added (spawn location TBD in deep Nightside dungeon)
- [x] Add `array_harmonic_stabilizer_chip` sol component to sol_components.json (energy waste reduction) — added as epic dual-stat modifier
- [x] Create `nightside_passage` dungeon for Sable's Act III guide sequence — nightside_passage.json added (28x22, Sable guide NPC, symbiotic compound chest, exit to underlumen_threshold)
- [x] Add Nightside expedition quest JSON (joint Ring/Unbounded/Array exploration) — nightside_expedition.json with 5 steps leading to three-path choice
- [x] Add symbiotic compound items for Asha's Act III research line — symbiotic_compound and expedition_field_notes added to items.json
- [x] Wire `act3_asha_alliance` flag-set trigger in meridian_civic.json when player sees alliance dialogue — trigger sets act3_asha_alliance_activated, plus asha_receives_compound trigger for post-expedition
- Consider further umbrasite escalation tiers (repeatable with diminishing returns)
- Add Unbounded elder NPC for deep Nightside encounters (referenced by Sable)
- Add Council faction NPCs (Steward representative, Compact representative, Root representative) for political branching
- Create `underlumen_threshold` dungeon (nightside_passage exit leads here — currently a dead-end reference)
- Add three ending path dungeons/sequences (shutdown, merge, control) referenced by nightside_expedition quest
- Add Asha `act3_compound_received` dialogue with three-path choice trigger (showChoice for chose_path_shutdown/merge/control)
- Add sable_nightside_guide sprite placeholder

## Art & Sprites

- Update `tools/generate-sprites.js` to use hex values from `docs/art-style-guide.md` master palette
- Create tileset strips for each zone theme (currently only stone_crypt has a full tileset)
- Add animation frames (idle, attack, hit) once the engine supports sprite animation

## Audio

- Add placeholder sound effects for core actions: weapon attack, ability fire, monster hit, monster death, item pickup, door open, level transition
- Wire audio events into client/audio.js
- Add per-biome ambient sound/music definitions
