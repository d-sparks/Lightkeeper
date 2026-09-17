# Lightkeeper — 3D Prototype

A web-first third-person prototype for **Lightkeeper**, a frontier survival game set on the permanent night side of a tidally locked planet.

This branch intentionally replaces the earlier JavaScript/Canvas draft. That implementation remains recoverable in the repository history at commit `0b070a61c9841716cae83fb517fc9a21a5b78740`.

## Current playable loop

1. Leave the warm dusk platform.
2. Cross into permanent night while the portable sol unit drains.
3. Recover a glowing nightglass mineral sample from the dead relay chamber.
4. Return the sample safely to the dusk platform.

The placeholder Keeper already follows the agreed silhouette: rugged utility gear, no hood, a pronounced mask with two separate goggles, heavy boots, and a visually dominant backpack-mounted sol core.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrow keys | Move |
| Mouse | Look |
| `F` | Toggle sol light |
| `Esc` | Release mouse cursor |

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

- Add one light-reactive enemy.
- Add a pulse tool with explicit sol cost.
- Add the first mirror-and-beam door puzzle.
- Add death, carried-item loss, and rare-gear durability damage.
- Add the first dusk-side solar harvester and expedition loadout screen.
- Test one metroidvania return path with the hover module.

