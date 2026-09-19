# Lightkeeper — 3D Prototype

A web-first third-person prototype for **Lightkeeper**, a frontier survival game set on the permanent night side of a tidally locked planet.

This branch intentionally replaces the earlier JavaScript/Canvas draft. That implementation remains recoverable in the repository history at commit `0b070a61c9841716cae83fb517fc9a21a5b78740`.

## Current playable loop

1. Prepare at the terminator encampment: repair and recharge, inspect upgrades, or route solar power through the construction gantry.
2. Cross into permanent night while the portable sol unit drains.
3. Use sol pulses against two creatures with different reactions to light.
4. Illuminate and pulse two relay mirrors to unseal the deeper vault.
5. Recover a glowing nightglass mineral sample, return to dusk, and secure it in the Keeper House stash.

The articulated Keeper follows the agreed silhouette: layered frontier workwear, no hood, a pronounced respirator with separate circular goggles, heavy boots, a compact pulse projector, and a visually dominant backpack-mounted sol core. Procedural idle, walk, recoil, coat, and pack motion keep the browser-friendly model alive in motion.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrow keys | Move |
| Mouse | Look |
| `F` | Toggle sol light |
| `E` | Use nearby camp station |
| Left click / `Space` / `Q` | Fire sol pulse |
| `Esc` | Release mouse cursor |

On phones and tablets, use the left virtual stick to move, swipe the right side to look, tap **USE** at camp consoles, tap **SOL** to toggle the light, and tap **PULSE** to attack or operate illuminated relay mirrors. Landscape orientation is recommended. Center an enemy or mirror inside the targeting cone; the cyan/amber lock indicator confirms where the next pulse will land.

## Run locally

Install Godot 4.7.2 or another compatible Godot 4 release, open `project.godot`, and press **F6/F5**.

For a local browser export:

```bash
mkdir -p build/web
godot --headless --path . --export-release Web build/web/index.html
python3 -m http.server 8000 --directory build/web
```

Then open `http://localhost:8000`.

## Automated build

GitHub Actions validates the project and publishes a downloadable `lightkeeper-web` artifact on every pull request and push to `main` or `codex/**` branches. The export is single-threaded for straightforward browser hosting.

## Prototype roadmap

- Add death, carried-item loss, and rare-gear durability damage.
- Add the first dusk-side solar harvester and expedition loadout screen.
- Test one metroidvania return path with the hover module.
- Replace selected procedural props with authored production assets after the loop is proven.
