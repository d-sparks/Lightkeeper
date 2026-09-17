# AGENTS.md

Instructions for agents working on the Lightkeeper Godot prototype.

## Workflow

- Never push directly to `main`; work on a branch and open a pull request.
- Keep the project runnable in both Godot 4 desktop and single-threaded Web exports.
- Do not commit `.godot/` or `build/` output.

## Product constraints

- Lightkeeper is a harsh, lived-in frontier setting, not a lighthearted romp.
- The Keeper is an engineer first: rugged, slightly quaint work gear; no hood; pronounced gas mask with separate circular goggles; dominant backpack/sol unit; avoid superhero or Destiny-style armor.
- The sol unit must remain light, weapon, and lifeline—not three unrelated resources.
- Prototype the interlocking expedition/home loop before adding breadth.
- Preserve browser compatibility by using the GL Compatibility renderer and GDScript rather than C#.

## Architecture

- `scenes/` contains Godot scenes.
- `scripts/` contains GDScript gameplay code.
- Prefer small reusable nodes and data resources as systems grow.
- Keep gameplay state separate from UI presentation so multiplayer can be introduced later.

## Validation

Run:

```bash
godot --headless --path . --editor --quit
mkdir -p build/web
godot --headless --path . --export-release Web build/web/index.html
```

The GitHub Actions workflow performs both checks and uploads the browser build.

