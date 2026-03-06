# Next TODOs

## Monster AI Follow-ups

- Add placeholder sprites for new monsters (shadow_ambusher, tunnel_creeper, feral_hound) — currently reusing existing sprites
- Add dungeon monsterSpawns entries using the new AI types (ambush, patrol, pack) in actual dungeon floors
- Consider adding a "reveal" visual effect on client when ambush monsters appear (e.g. fade-in animation)
- Monster projectiles (from ranged_kite) use a generic blue color on client — consider tinting them red or adding a distinct sprite
- The existing dungeon `patrol` field on monsterSpawns (e.g. "guard", "wander") is still unused by the engine — could be wired into the patrol AI to control behavior style
- Pack AI could be extended with a "pack leader" variant that buffs nearby pack members

## Sol Grid Modifier Follow-ups

- Nightside "dark" mods currently give flat damage bonuses — when a lighting/visibility system is added, implement conditional bonuses (e.g. extra damage in unlit tiles)
- Add loot table entries so faction mods actually drop from the correct biomes/factions
- Client UI does not yet display healOnHit or energyCostReduction modifier effects — add tooltip support
- Consider adding more rarity tiers (legendary) for each faction once balance is tested

## Content Validation Errors (pre-existing)

- `sol_components.json` missing "sol_cone" — referenced by sol_unit_mk1 and sol_unit_mk1_plus in sol_units.json
- Flag "umbral_seed_dark_exposed" checked in homestead_interior but never set anywhere
- Flag "warlord_defeated" checked in outpost_entrance but never set anywhere
- Flag "damage_booster_equipped" checked in outpost_workshop but never set anywhere
- Flag "has_traded_meridian" checked in NPC meridian_7 dialogue but never set anywhere
- Quest lost_supplies step "find_manifest" requires item "supply_manifest" but it's not spawned or given anywhere

## Act II Quest Follow-ups

- Add placeholder sprites for Nightside Caverns and Depths tilesets (currently using frost_crypt)
- Consider adding a dedicated "nightside" tileset with umbracite-vein wall tiles and darker aesthetics
- The Crystal Guardian in nightside_depths serves as the floor boss — consider adding a unique boss monster (e.g. "Umbral Warden") with custom AI for this area
- Add loot drops for nightside_depths monsters (currently using existing nightside loot tables)
- MERIDIAN-7's umbrasite quest is repeatable conceptually (dialogue hints at wanting more) — implement repeatable quest mechanic or additional tiers of umbrasite exchange
- The quest currently gates on `traded_umbracite_meridian` — make sure the initial MERIDIAN-7 trade at train station properly flows into the Array Hub quest
- Add map/minimap markers or quest waypoints for the Nightside Caverns entrance
- Consider environmental hazards in nightside_depths (cold damage, darkness debuff) once those systems exist

## Art & Sprites

- Update `tools/generate-sprites.js` to use hex values from `docs/art-style-guide.md` master palette (current colors are ad-hoc)
- Add placeholder sprites for newer monsters missing from `PLACEHOLDER_ASSETS.md` (dusk_crawler, crystal_guardian, garden_mite, nest_mother, shade_stalker, shade_stalker_alpha, ravine_lurker, gloom_wraith, rime_stalker, frostfang_hunter, vent_spewer, magma_brute)
- Replace all placeholder sprites with final art following the style guide
- Create tileset strips for each zone theme (currently only stone_crypt has a tileset; iso ground templates exist for all zones but no full tilesets)
- Add animation frames (idle, attack, hit) once the engine supports sprite animation
