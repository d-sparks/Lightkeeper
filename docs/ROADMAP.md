# Lightkeeper Roadmap

Last updated: 2026-03-06

## Project Status Overview

| Area | Status | Notes |
|------|--------|-------|
| Core Engine | Done | Physics, combat, abilities, AI, scripting, networking, rendering all functional |
| Act I Content | Done | Main quest (13 steps), 9 side quests, 39 dungeons, 46 NPCs, 14 monster types |
| Procedural Generation | Done | Template-based dungeon generation working (2 templates) |
| Scripting System | Done | Trigger-Condition-Action fully implemented, quest DAG system working |
| Testing Tools | Done | Content validator + headless simulator both functional |
| Automation System | Partial | Basic automation works (solar panels, harvesters, silicon). Grid placement UI not yet built |
| Sol Grid / Progression | Partial | Grid placement + adjacency modifiers work. Need more components, sol unit variants, balance |
| Act II Content | Partial | Dayside locations exist, MERIDIAN-7 NPC created. Deeper Array questlines needed |
| Act III Content | Stub | Underlumen approach + crypts exist. Story revelation content not built |
| Art / Audio | Placeholder | Procedurally generated placeholder sprites. No real audio content |
| Game Balance | Needs Work | Combat feels functional but lacks tuning. Energy economy untested at scale |
| Player Onboarding | Needs Work | Tutorial exists via quest steps but could be smoother |

---

## Short-Term Priorities (Next 1-2 Sprints)

Focus: **Make Act I polished and fun to play through**

1. **Combat feel and feedback** — Damage numbers, hit effects, death animations, screen shake. Combat is the core loop and needs to feel satisfying.
2. **Monster variety and AI** — 14 types exist but only 2 AI behaviors (melee_chase, ranged_kite). Add patrol, ambush, and group tactics. More monster types for each biome.
3. **Loot and rewards** — The loot chase is thin. Add more modifier varieties, rarity tiers with visual distinction, and loot drops from monsters.
4. **Content validation in CI** — Hook content-validator.js into npm test so regressions are caught automatically.
5. **Sol grid usability** — Fix component slotting issues, add better feedback, make the grid UI more intuitive.

## Medium-Term Priorities (Next 1-3 Months)

Focus: **Expand the game loop and start Act II**

6. **Automation grid UI** — Implement the full-screen grid placement screen per docs/automation_screen.md. This is a major feature that transforms the factory/automation loop.
7. **More procedural dungeon templates** — Only 2 templates exist. Add templates for each biome (frost crypts, geothermal vents, fungal forests, ruins).
8. **Act II questline** — Array deepening: advanced trades with MERIDIAN-7, uranium generator access, Array complex exploration.
9. **More sol components** — The progression system doc envisions many more abilities and modifiers than currently exist. Fill out the catalog.
10. **Death penalty and stakes** — The architecture doc promises item loss on death. This needs careful tuning to be punishing but not frustrating.
11. **Multiplayer polish** — Party indicators, shared quest progress display, co-op-specific balance.

## Long-Term Vision (3+ Months)

Focus: **Complete the story, polish, and expand**

12. **Act III content** — Underlumen revelation, three ending paths, faction choice system.
13. **Real art assets** — Replace all placeholder sprites with proper pixel art. Consistent style guide.
14. **Audio** — Music per biome, combat music, ambient sounds, ability SFX, UI sounds.
15. **Advanced AI** — Boss encounters with phases, environmental hazards, puzzle-combat rooms.
16. **Endgame loop** — Post-story sandbox with escalating procedural dungeons, legendary modifier chase, automation scaling.
17. **Mobile/touch optimization** — Touch controls exist but need polish for real mobile play.

---

## Completed Projects

These are done and don't need further investment:

- **Core engine architecture** — Server-authoritative model, WebSocket networking, PixiJS rendering
- **Scripting system** — Trigger-Condition-Action with full quest DAG support (docs/game-scripting.md)
- **Procedural generation engine** — Template-based generation with depth chaining (docs/procedural-generation.md)
- **Content validator tool** — tools/content-validator.js validates all JSON cross-references
- **Headless game simulator** — tools/headless-sim.js runs quests end-to-end without a browser
- **Visual content editor** — editor/ with REST API, git integration, dungeon/entity editing
- **Act I main quest** — 13-step quest from Outpost Balor to Meridian City, fully playable

## Active Design Docs

| Doc | Status | Next Action |
|-----|--------|-------------|
| docs/progression-system.md | Active | Open questions on sol unit variants, modifier balance, battery math need answers as content expands |
| docs/automation_screen.md | Active | Grid UI not yet built — this is the next major feature |
| docs/storyboard.md | Active | Act I implemented, Acts II-III need content creation |
| docs/testing-design.md | Done | Both tools (validator + simulator) are built and functional |
| docs/procedural-generation.md | Done | Engine implemented, just needs more templates |
| docs/TESTING.md | Done | Testing plan executed — tools exist |
