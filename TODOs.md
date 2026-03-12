TODOs

- Fix headless sim mainline regression: bot visits only 5-9 rooms then gets stuck — umbrasite_retrieval side quest injected as prereq has no accessible refined_umbrasite source; needs skip-unresolvable-prereq logic or bot-side quest dependency resolution
- Add client-side expedition HUD: floor counter, tier indicator, and boss health bar overlay during expedition runs so players know their progress
- Build cooperative challenge system (Phase 6): Lighthouse Siege wave defense mode for 2-4 players with communal energy pool, wave spawning, and siege_legendary reward table — see endgame-loop.md
- Define cooperative-only legendary items: lighthouse_lens, deep_resonance, prismatic_core need entries in items.json and sol_components.json with stats from endgame-loop.md, plus a siege_legendary loot table
- Add banked items inventory tab: show a "Cached" tab in the inventory UI during expeditions so players can see what they've banked at checkpoints
- Add explicit patrol path waypoints to spawns in nightside_caverns, nightside_depths, deep_perimeter_east, perimeter_ravine, and crypt_02 — monsters with patrol AI but no patrolPath stand still
- Place feral_hound_alpha and frostfang_alpha as rare spawns in nightside_caverns and frost procedural templates for mid-game variety
- Add client-side raid alert UI: toast or overlay showing raid results (structures damaged, turrets active, monsters repelled) and structure HP bars on the automation grid
- Build dark_city dungeon template: tileset JSON and sprite strip exist but no dungeon uses dark_city yet — design a Meridian undercity or Array suburb floor using the tileset
- Add Nightside-path discovery hints in earlier rooms (outpost_perimeter or outpost_comms) for players who haven't reached the Dead Road yet
- Create engine-flags documentation registry (docs/engine-flags.md) listing all flags set directly by engine code so content authors know which flags are managed outside the trigger system
- Add sprite animation frames (idle 2-frame bob, attack lunge, hit flash) to generate-sprites.js and wire renderer to cycle frames — biggest single visual quality improvement available
- Implement player manual raid defense: let players teleport to dayside_solar_fields during a raid event to fight monsters in real-time instead of abstract damage calculation
- Tune battery math: document capacity per tier, energy costs per ability, and casts per full charge — resolve the open design question in progression-system.md so balance can be tested
- Add checkpoint room visual polish: expedition_checkpoint dungeon currently uses plain crypt tileset — design a unique safe-room look with cache terminal, dim lighting, supply crates
- Add party disconnect cleanup during expeditions: remove disconnected players from expedition_party flag so remaining members aren't blocked by ghost party state
