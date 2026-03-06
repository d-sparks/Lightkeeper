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

- Most monster types lack lootTable references — add lootTable field to monster definitions
- Create biome-specific loot tables (frost, geothermal, fungal, outpost, perimeter)
- Add modifier drops to loot tables so faction-flavored mods drop from correct biomes

## Combat & AI Polish

- Consider adding a "reveal" visual effect on client when ambush monsters appear (fade-in animation)
- Monster projectiles (from ranged_kite) use generic blue color — tint by monster type or add distinct sprite
- The existing dungeon `patrol` field on monsterSpawns is unused by the engine — wire into patrol AI
- Pack AI could be extended with a "pack leader" variant that buffs nearby pack members

## Sol Grid Follow-ups

- Client UI does not display healOnHit or energyCostReduction modifier effects — add tooltip support
- Client UI should display generator adjacency boost info (boostedEnergyRegen field is sent from server)
- Design and implement extended-adjacency modifiers (radius 2, entire row/column) for rare/legendary tier
- Define modifier stat ranges per rarity tier (common -> legendary number values)
- Define the 5-6 sol unit variants (grid dimensions, innate perks, where found)

## Act II Quest Follow-ups

- Add placeholder sprites for Nightside Caverns and Depths tilesets (currently using frost_crypt)
- Consider a dedicated "nightside" tileset with umbracite-vein wall tiles
- Crystal Guardian boss could have unique AI instead of generic melee_chase
- MERIDIAN-7's umbrasite quest could become repeatable with escalating tiers
- Make sure initial MERIDIAN-7 trade at train station flows into Array Hub quest
- Add map/minimap markers or quest waypoints for Nightside Caverns entrance
- Environmental hazards in nightside_depths (cold damage, darkness debuff)

## Art & Sprites

- Update `tools/generate-sprites.js` to use hex values from `docs/art-style-guide.md` master palette
- Create tileset strips for each zone theme (currently only stone_crypt has a full tileset)
- Add animation frames (idle, attack, hit) once the engine supports sprite animation

## Audio

- Add placeholder sound effects for core actions: weapon attack, ability fire, monster hit, monster death, item pickup, door open, level transition
- Wire audio events into client/audio.js
- Add per-biome ambient sound/music definitions
