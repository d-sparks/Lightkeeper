# ⚔ LIGHTKEEPER

**A multiplayer dungeon crawler set on a tidally locked planet, where death costs you everything you carried.**

Lightkeeper is a top-down, browser-based dungeon crawler for 1–4 players. You play as a Lightkeeper — a frontier engineer who ventures into the permanent dark side of a tidally locked world to restore failing relay stations, harvest rare minerals, and push back the encroaching night. The catch: when you die, your gear pays the price. Items are lost, durability is permanently damaged, and the best equipment in the game is always one bad run away from being gone forever.

---

## Setting

Civilization survives in the terminator zone — the narrow habitable band between a planet's scorching day side and its frozen night side. A network of relay stations called **Lighthouses** extends the livable frontier by pushing light and heat from the bright side into the dark. When a Lighthouse goes offline, the darkness creeps back, and someone has to go fix it.

That someone is you.

You're not a chosen one. You're a working person doing something dangerous and necessary: walking into freezing, zero-visibility territory to restore infrastructure, recover lost technology, and drag civilization's edge forward one relay at a time.

## The Sol Unit

Your primary tool is a portable solar core — the **sol unit**. It's your light source, your weapon, and your lifeline, powered by energy harvested from light-side solar arrays. Managing its charge is the game's central tension.

Light does everything. It burns back hostile fauna, illuminates threats, maintains your body temperature, and keeps you visible to your teammates. When it dims, you're exposed. Enemies adapted to total darkness don't take kindly to the light — some flee from it, some are drawn to it, and some can only be harmed by specific wavelengths or angles of illumination.

## Core Loop

The game runs on two interlocking resource cycles, one on each side of the planet.

**Dark-side expeditions** are the dungeon crawls. You descend into freezing, lightless zones to fight creatures, solve light-and-mirror puzzles, harvest rare minerals, and restore dead Lighthouse infrastructure. These runs are dangerous and gear-dependent. Every room could be the one that breaks your best equipment.

**Light-side operations** happen between runs. You deploy autonomous solar harvesters and mirror arrays that gather energy — the fuel for your sol unit and equipment on the next expedition. Dark-side minerals build and upgrade these machines. Light-side energy powers your dark-side gear.

Each side feeds the other. Progress on one front enables deeper pushes on the other.

```
  DARK SIDE                              LIGHT SIDE
  ─────────                              ──────────
  Explore dungeons                       Deploy solar harvesters
  Fight creatures                        Build mirror arrays
  Harvest minerals ──────────────────►   Upgrade machines
  Restore relays                         Gather energy
                   ◄──────────────────   Power your gear
```

## Death Has Teeth

This is the core of the game's identity. There is no easy resupply in the dark. When you die:

- **Common gear is lost outright.** Your iron pickaxe, your bandages, your rations — gone. Dropped in the dark or destroyed.
- **Rare gear takes permanent durability damage.** Your hard-won Flamebrand doesn't vanish immediately, but it loses 20 durability on death. After a few bad runs, it shatters — and it's gone for real.
- **Some items can be recovered** from your corpse, if you or a teammate can fight back to where you fell. High risk, high reward.
- **Your stash is safe.** Anything stored in town survives. But anything you *carried into the dark* was a bet — and you just lost.

This creates meaningful stakes around every decision. Do you bring your best weapon into a dangerous floor, or play it safe with expendable gear? Do you push deeper for better minerals, or turn back and preserve what you have? Do you split the party's best equipment across players, or concentrate it on one?

Every expedition is a risk calculation. Every item in your backpack is something you chose to gamble.

## Multiplayer

Lightkeeper supports 1–4 players exploring together in real time. Cooperation makes runs safer — you can cover more ground, revive downed teammates, and share light in critical moments. But you also split the loot.

The social dynamics of the death system are part of the design. When your friend is down and their rare gear is about to be lost, do you risk your own equipment to retrieve theirs? When a treasure room appears deep in a dangerous zone, does the group push forward together or does someone volunteer to scout ahead with throwaway gear?

## Puzzles and Combat

**Light-and-mirror puzzles** feature prominently. Redirect beams to power dormant systems, open sealed paths, or reveal hidden areas. The sol unit isn't just a weapon — it's a tool for interacting with the environment.

**Combat** revolves around light management. Enemies are adapted to darkness and respond to illumination in different ways:
- Some flee from light — use your sol unit to herd them.
- Some are drawn to it — manage when and where you shine.
- Some can only be harmed by specific wavelengths — requiring the right equipment or environmental positioning.

The darkness itself is an enemy. Without light, you can't see threats, you lose body heat, and the environment becomes actively hostile.

## Technical Design

Lightkeeper is built for the browser with a few core principles:

**Data-driven content.** Every dungeon floor, monster, item, loot table, and tileset is defined in JSON data files. The game engine is a generic interpreter — it reads data, it doesn't contain content. This means new content can be created without touching code, and a visual level editor can be built on top of the same data format.

**Authoritative server.** A Node.js server runs the game simulation at a fixed tick rate. Clients send inputs, the server resolves physics, combat, and loot, and broadcasts state. No cheating, no desync.

**Canvas rendering.** The client draws everything on an HTML5 `<canvas>` — tile maps, entities, effects, HUD — with pixel art scaled up for a crisp retro look. Works on desktop and mobile.

**Extensible architecture.** The project is structured so that each major system (combat, inventory, AI, physics, rendering) is a separate module. New enemy behaviors, item effects, and dungeon mechanics can be added without rewriting existing code.

```
project/
├── server/           # Node.js game server
├── client/           # Browser client (HTML5 Canvas)
├── shared/           # Constants shared by both
├── content/          # Game content (pure JSON data)
│   ├── dungeons/     # Dungeon floor layouts
│   ├── tilesets/     # Tile definitions + properties
│   ├── entities/     # Monster definitions
│   ├── items/        # Weapons, armor, consumables
│   └── loot/         # Loot tables (weighted drops)
└── editor/           # (Future) Visual level editor
```

## Status

Lightkeeper is in active development. Here's what's built and what's ahead:

- [x] Server game loop with WebSocket networking
- [x] Data-driven tile map loading and rendering
- [x] Player movement with collision detection (wall sliding)
- [x] Camera system with minimap
- [x] Multiplayer — multiple players in the same dungeon
- [x] Mobile support with virtual joystick
- [ ] Monster spawning, AI behaviors, and pathfinding
- [ ] Combat system (sol unit attacks, damage, death)
- [ ] Items, inventory, equipment slots
- [ ] Loot drops from enemies and treasure rooms
- [ ] **Death penalty system** (item loss, durability damage)
- [ ] Town hub with stash, repair, and shop NPCs
- [ ] Multiple dungeon floors with progression
- [ ] Light-and-mirror puzzle mechanics
- [ ] Sol unit energy management
- [ ] Pixel art and animation
- [ ] Visual dungeon editor
- [ ] Light-side resource management (solar harvesters, mirror arrays)

## Running Locally

```bash
npm install
npm start
# → http://localhost:3000
```

Open multiple browser tabs to test multiplayer.

## Tone

Isolation, frontier survival, and the slow work of pushing civilization's edge forward one relay at a time.

Not a chosen-one story — a working person doing something dangerous and necessary.

---

*Lightkeeper is a browser game built with Node.js, WebSockets, and HTML5 Canvas.*
