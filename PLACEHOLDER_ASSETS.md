# Placeholder Assets — MUST BE REPLACED

All image assets under `content/sprites/` and `content/tilesets/*.png` are
**programmatically generated placeholders**. They were created by
`tools/generate-sprites.js` using the `pngjs` library and are NOT final art.

## Status: NEEDS REPLACEMENT

These files must be replaced with properly licensed or original artwork before
any public release:

### Tileset
- `content/tilesets/crypt.png` — 160x16 sprite sheet (10 tiles at 16x16)

### Monster Sprites (16x16 each)
- `content/sprites/skeleton.png`
- `content/sprites/skeleton_archer.png`
- `content/sprites/luddite_brawler.png`
- `content/sprites/luddite_scrapper.png`
- `content/sprites/luddite_warlord.png`
- `content/sprites/training_target.png`
- `content/sprites/dusk_crawler.png`
- `content/sprites/crystal_guardian.png`
- `content/sprites/garden_mite.png`
- `content/sprites/nest_mother.png`
- `content/sprites/shade_stalker.png`
- `content/sprites/shade_stalker_alpha.png`
- `content/sprites/ravine_lurker.png`
- `content/sprites/gloom_wraith.png`
- `content/sprites/scrap_drone.png`
- `content/sprites/shadow_ambusher.png`
- `content/sprites/tunnel_creeper.png`
- `content/sprites/feral_hound.png`
- `content/sprites/rime_stalker.png`
- `content/sprites/frostfang_hunter.png`
- `content/sprites/vent_spewer.png`
- `content/sprites/magma_brute.png`
- `content/sprites/frost_warden.png`
- `content/sprites/sporecap_shambler.png`
- `content/sprites/mycelium_lurker.png`
- `content/sprites/fungal_sprayer.png`
- `content/sprites/elder_sporecap.png`
- `content/sprites/array_sentinel.png`
- `content/sprites/array_fabricator.png`
- `content/sprites/array_overseer.png`
- `content/sprites/threshold_watcher.png`
- `content/sprites/abyssal_tendril.png`
- `content/sprites/threshold_keeper.png`
- `content/sprites/biolab_tendril.png`
- `content/sprites/biolab_spitter.png`
- `content/sprites/biolab_construct.png`
- `content/sprites/biolab_guardian.png`
- `content/sprites/biolab_alpha.png`
- `content/sprites/hybrid_drone.png`
- `content/sprites/hybrid_stalker.png`
- `content/sprites/radiance_construct.png`
- `content/sprites/nexus_guardian.png`
- `content/sprites/solar_core_warden.png`
- `content/sprites/general_thorne.png`
- `content/sprites/underlumen_warden.png`
- `content/sprites/underlumen_channeler.png`
- `content/sprites/underlumen_sentinel.png`
- `content/sprites/underlumen_shade.png`

### Player Sprites (16x16 each, 4 color variants)
- `content/sprites/player_blue.png`
- `content/sprites/player_red.png`
- `content/sprites/player_green.png`
- `content/sprites/player_orange.png`

### NPC Sprites (16x16)
- `content/sprites/npc_default.png`
- `content/sprites/sable_nightside_guide.png`
- `content/sprites/sable_threshold.png`
- `content/sprites/unbounded_elder.png`
- `content/sprites/wren_alcott.png`
- `content/sprites/councillor_asha.png`
- `content/sprites/councillor_asha_denn.png`
- `content/sprites/outpost_warden.png`
- `content/sprites/meridian_7.png`
- `content/sprites/sol_engineer_1.png`
- `content/sprites/corporal_venn.png`
- `content/sprites/bulwark_patrol_meridian.png`
- `content/sprites/greenway_npc.png`

### Item Sprites (16x16 each)
- `content/sprites/health_potion.png`
- `content/sprites/bandage.png`
- `content/sprites/rusty_sword.png`
- `content/sprites/torch.png`
- `content/sprites/iron_key.png`
- `content/sprites/titanium_cylinders.png`
- `content/sprites/sol_unit.png`

## Regenerating Placeholders

If you need to regenerate (e.g., after adding new entity types):

```bash
node tools/generate-sprites.js
```

## Replacement Art Requirements

- All sprites are 16x16 pixels, rendered at 2x (32x32 on screen)
- Tileset is a horizontal strip: tile N is at pixel offset `N * 16` from the left
- Use transparent backgrounds (PNG with alpha)
- Style: dark dungeon crawler, pixel art
- `imageSmoothingEnabled = false` is set — sprites render with hard pixel edges
