TODOs

- [opus] Fix headless sim mainline regression: bot visits only 5-9 rooms then gets stuck — umbrasite_retrieval side quest injected as prereq has no accessible refined_umbrasite source; needs skip-unresolvable-prereq logic or bot-side quest dependency resolution
- [opus] Build cooperative challenge system (Phase 6): Lighthouse Siege wave defense mode for 2-4 players with communal energy pool, wave spawning, and siege_legendary reward table — see endgame-loop.md
- [sonnet] Define cooperative-only legendary items: lighthouse_lens, deep_resonance, prismatic_core need entries in items.json and sol_components.json with stats from endgame-loop.md, plus a siege_legendary loot table
- [sonnet] Add banked items inventory tab: show a "Cached" tab in the inventory UI during expeditions so players can see what they've banked at checkpoints
- [sonnet] Add client-side raid alert UI: toast or overlay showing raid results (structures damaged, turrets active, monsters repelled) and structure HP bars on the automation grid
- [sonnet] Build dark_city dungeon template: tileset JSON and sprite strip exist but no dungeon uses dark_city yet — design a Meridian undercity or Array suburb floor using the tileset
- [sonnet] Add Nightside-path discovery hints in earlier rooms (outpost_perimeter or outpost_comms) for players who haven't reached the Dead Road yet
- [sonnet] Create engine-flags documentation registry (docs/engine-flags.md) listing all flags set directly by engine code so content authors know which flags are managed outside the trigger system
- [opus] Add sprite animation frames (idle 2-frame bob, attack lunge, hit flash) to generate-sprites.js and wire renderer to cycle frames — biggest single visual quality improvement available
- [opus] Implement player manual raid defense: let players teleport to dayside_solar_fields during a raid event to fight monsters in real-time instead of abstract damage calculation
- [opus] Tune battery math: document capacity per tier, energy costs per ability, and casts per full charge — resolve the open design question in progression-system.md so balance can be tested
- [sonnet] Add checkpoint room visual polish: expedition_checkpoint dungeon currently uses plain crypt tileset — design a unique safe-room look with cache terminal, dim lighting, supply crates
