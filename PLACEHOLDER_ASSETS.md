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

### Player Sprites (16x16 each, 4 color variants)
- `content/sprites/player_blue.png`
- `content/sprites/player_red.png`
- `content/sprites/player_green.png`
- `content/sprites/player_orange.png`

### NPC Sprites (16x16)
- `content/sprites/npc_default.png`

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
