# Automated Testing Plan

> **STATUS: TIERS 1-4 (PARTIAL) IMPLEMENTED.** The static content validator (`tools/content-validator.js`) and headless game simulator (`tools/headless-sim.js`) are both built and functional. Unit tests cover Tier 1 (flag-store, event-bus, automation), Tier 2 (conditions, actions, trigger-registry), and Tier 3 (physics). Integration tests cover Tier 4 combat flow, equipment system, and sol-grid adjacency. Total: **284 tests, all pass** via `node --test`. Remaining Tier 4 gap: room-lifecycle tests.

## Framework

**Node's built-in test runner** (`node --test`) — no new dependencies needed. Use `assert` from stdlib. Alternatively, add `vitest` or `mocha` if richer assertions are wanted later.

## Test Structure

```
tests/
├── unit/
│   ├── flag-store.test.js         Flag read/write/clear isolation            ✅
│   ├── event-bus.test.js          Subscribe/emit/unsubscribe                 ✅
│   ├── conditions.test.js         All condition types + logical operators     ✅
│   ├── actions.test.js            Each action type with mocked game state    ✅
│   ├── trigger-registry.test.js   Event matching, filtering, once-flags      ✅
│   ├── physics.test.js            Collision detection + resolution           ✅
│   └── automation.test.js         Resources, building, production            ✅
├── integration/
│   ├── combat.test.js             Attack damage, XP, death, loot drop       ✅ (20 tests)
│   ├── equipment.test.js          Equip/unequip, slot swap, ability rebuild  ✅ (21 tests)
│   ├── sol-grid.test.js           Adjacency modifiers, compute overrides     ✅ (20 tests)
│   └── room-lifecycle.test.js     Create → join → transition → cleanup       🔲 (planned)
└── fixtures/
    └── (inline mocks — each test file defines its own minimal content mock)
```

## Priority Tiers

### Tier 1 — Standalone logic (no mocks needed, highest value-per-effort)

| Module | Key tests |
|--------|-----------|
| `flag-store.js` | Player/room flag isolation, set/get/remove/clear, default values |
| `event-bus.js` | Multi-listener, correct payloads, listener removal, no leaks |
| `automation.js` | Resource add/spend, build limits, production tick, energy regen |

### Tier 2 — Logic with light mocks (mock flag store + player inventory)

| Module | Key tests |
|--------|-----------|
| `conditions.js` | `hasFlag` (bool + value), `flagGreaterThan/LessThan`, `hasItem`, nested `and/or/not` |
| `actions.js` | `setFlag`, `incrementFlag`, `spawnItem`, `giveItem`, `removeItem`, `equipItem`, `toggleTile`, `setEnergy`, `grantXp`, `showChoice` |
| `trigger-registry.js` | Event type match, payload filters, condition gating, `once` flag, action execution |
| `quest-tracker.js` | Step unlock via prerequisites, condition-driven completion, objective tracking, quest start conditions |

### Tier 3 — Geometry (mock tile solidity)

| Module | Key tests |
|--------|-----------|
| `physics.js` | Wall collision + push-out, wall sliding, diagonal normalization, corner cases, tight corridors, `collidesAt` bounds |

### Tier 4 — Integration (mock content loader, require real subsystems)

| Area | Key tests |
|------|-----------|
| Combat | Attack cooldown, damage calc, death → loot drop, XP award, health clamping |
| Equipment | Slot swap, inventory return, ability list rebuild, sol grid init |
| Sol grid | Component placement validation, shape fitting, adjacency modifier calc |
| Room lifecycle | Monster spawn from dungeon def, killed-state persistence, empty room cleanup |

### Tier 5 — Content validation (lint-style, runs on JSON files)

| Check | What it catches |
|-------|-----------------|
| Required fields | Missing `health` on monster, missing `type` on item |
| Reference integrity | Item references nonexistent ability, dungeon references nonexistent tileset |
| Spawn bounds | Monster/NPC/item spawn coordinates outside dungeon dimensions |
| Quest DAG | Unreachable steps, missing prerequisites, circular dependencies |
| Trigger validity | Unknown action/condition types, missing required action fields |
| Tile grid size | `data.length !== width * height` |

## What NOT to test

- **Client rendering** (`renderer.js`) — PixiJS-dependent, no headless path, low ROI.
- **Client DOM** (`main.js`, `input.js`) — DOM/canvas-dependent state machines. Test manually.
- **WebSocket transport** — test message handling logic via the game loop, not the socket layer.
- **Editor UI** (`editor/`) — browser-only, changes frequently, test manually.

## Mocking Strategy

Most server modules export functions that take game state as arguments, making them easy to test:

```js
// Example: testing conditions.js
const flagStore = new FlagStore();
flagStore.setFlag('player', 'p1', 'hasKey', true);
const result = evaluateCondition(
  { type: 'hasFlag', scope: 'player', flag: 'hasKey' },
  { playerId: 'p1', roomId: 'r1' },
  flagStore
);
assert.strictEqual(result, true);
```

For game-loop integration tests, create a minimal `content` mock that returns test fixtures, then call subsystem functions directly instead of running the full tick.

## Running

```bash
npm test              # Run all tests
npm test -- --watch   # Re-run on file changes (if using vitest)
```

Add to `package.json`:
```json
"scripts": {
  "test": "node --test tests/**/*.test.js"
}
```

## Coverage Goals

| Tier | Target | Rationale |
|------|--------|-----------|
| 1–2 (scripting) | 90%+ | Pure logic, easy to test, catches flag/quest/trigger regressions |
| 3 (physics) | 85%+ | Collision bugs are hard to debug manually |
| 4 (integration) | Key paths | Cover the flows players hit most: combat, equip, room transition |
| 5 (content) | All files | Catches broken references before they cause runtime errors |
