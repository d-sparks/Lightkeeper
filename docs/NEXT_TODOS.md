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

- Add dungeon monsterSpawns entries using the new AI types (ambush, patrol, pack) in actual dungeon floors — these monsters are defined but not placed
- Add placeholder sprites for new monsters (shadow_ambusher, tunnel_creeper, feral_hound) — currently reusing existing sprites
- Add placeholder sprites for newer monsters missing from PLACEHOLDER_ASSETS.md (dusk_crawler, crystal_guardian, garden_mite, nest_mother, shade_stalker, shade_stalker_alpha, ravine_lurker, gloom_wraith, rime_stalker, frostfang_hunter, vent_spewer, magma_brute)

## Monster Loot Wiring

All done:
- [x] All 25 combat monsters have lootTable references (training_target intentionally excluded)
- [x] 22 monster-specific loot tables exist across common.json (10) and nightside.json (12)
- [x] Biome loot tables with faction sol modifier drops: frost.json, geothermal.json, fungal.json, outpost.json (3 tiers each: common/uncommon/rare)
- [x] Monster-specific loot tables now include sol modifier chip drops — faction-aligned, weighted by monster difficulty and mod rarity
- [x] Wire biome loot tables to dungeon chests/crates via triggers (rollLootTable action on interactable tiles)
- [x] Add biome loot table references to procedural dungeon templates (proc_frost_crypt, proc_fungal_forest, proc_quarantine, proc_quarantine_deep)
- [ ] Add a proc_geothermal template with chest tiles wired to geothermal loot tables (currently only static dayside dungeons have chests)
- [ ] Add placeholder chest/crate sprites to frost_crypt, fungal_forest tilesets (tile IDs 10/11) and crypt tileset (tile IDs 30/31 for unlocked crates)

## Combat & AI Polish

- Consider adding a "reveal" visual effect on client when ambush monsters appear (fade-in animation)
- Monster projectiles (from ranged_kite) use generic blue color — tint by monster type or add distinct sprite
- The existing dungeon `patrol` field on monsterSpawns is unused by the engine — wire into patrol AI
- Pack AI could be extended with a "pack leader" variant that buffs nearby pack members

## Sol Grid Follow-ups

- [x] Client UI displays healOnHit, energyCostReduction, and boostedEnergyRegen in sol grid
- [x] Define the 5-6 sol unit variants (grid dimensions, innate perks, where found) — 6 variants in sol_units.json with innateBonus engine support
- Design and implement extended-adjacency modifiers (radius 2, entire row/column) for rare/legendary tier
- Define modifier stat ranges per rarity tier (common -> legendary number values)
- Client UI should display sol unit innateBonus info (name, perk description) on the sol grid screen
- Add dungeon triggers/loot for acquiring new sol units (nightcaster_frame, array_precision_core, greenway_bioframe, underlumen_nexus)

## Act II Quest Follow-ups

- Add placeholder sprites for Nightside Caverns and Depths tilesets (currently using frost_crypt)
- Consider a dedicated "nightside" tileset with umbracite-vein wall tiles
- Crystal Guardian boss could have unique AI instead of generic melee_chase
- MERIDIAN-7's umbrasite quest could become repeatable with escalating tiers
- Make sure initial MERIDIAN-7 trade at train station flows into Array Hub quest
- Add map/minimap markers or quest waypoints for Nightside Caverns entrance
- [x] Environmental hazards in biome dungeons (cold, heat, poison damage implemented)

## Array Complex Follow-ups

- Add placeholder sprites for array_sentinel and array_fabricator monsters
- Add loot tables for array_sentinel and array_fabricator (currently undefined)
- Add generate-sprites.js entries for new Array construct monsters
- Consider gating array_synthesis_lab access behind umbrasite quest completion (currently open)
- Add array_clearance_badge as a key requirement for array_deep_processing door (currently unused key item)
- Wire array_secret_discovered flag into MERIDIAN-7 dialogue at the Hub (confrontation dialogue)
- Wire array_secret_discovered flag into Sable, Asha, or Council NPC dialogue for Act 3 progression
- Consider adding an Array overseer mini-boss in array_deep_processing

## Art & Sprites

- Update `tools/generate-sprites.js` to use hex values from `docs/art-style-guide.md` master palette
- Create tileset strips for each zone theme (currently only stone_crypt has a full tileset)
- Add animation frames (idle, attack, hit) once the engine supports sprite animation

## Audio

- Add placeholder sound effects for core actions: weapon attack, ability fire, monster hit, monster death, item pickup, door open, level transition
- Wire audio events into client/audio.js
- Add per-biome ambient sound/music definitions
