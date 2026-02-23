# Progression System Design

A design document for Lightkeeper's progression systems. Three interconnected systems govern player power: Economy, Sol Unit, and Tech Mods.

---

## Overview: Three Systems

| System | What it governs | Player thinks about it... |
|--------|----------------|--------------------------|
| **Economy** | Resources, energy, automation | Between runs — strategic |
| **Sol Unit** | Active abilities, combat identity | Major milestones + resource spending |
| **Tech Mods** | Passive bonuses, build identity, loot | Constant — every run, every drop |

These layers are intentionally clean:

- **What you can do** → which sol unit you have + its upgrades (Sol Unit)
- **How well you do it** → tech mods slotted into your battery budget (Tech Mods)
- **How long you can do it** → batteries + solar panels (Economy)

---

## System 1: Economy

### Core Resources

**Umbrasite** — Crystalline mineral found only on the Nightside. The raw material for everything. Mined during dark-side dungeon runs.

**Batteries** — Crafted from umbrasite at your outpost fabricator. Determine your sol unit's maximum energy capacity (tank size). Come in quality levels: 3 L1 batteries = 1 L2 battery, etc. Higher-level batteries are more space-efficient.

**Silicon** — Byproduct of battery crafting. The Array's trade currency. Used at MERIDIAN-7 for sol unit upgrades.

**Solar Energy** — Produced by solar panels on the Dayside. Determines how much of your battery capacity gets filled when you return to the light side. Actual charge = min(battery capacity, solar panel output).

### The Energy Model

You need BOTH batteries and solar panels:

- **Batteries** = how big your energy tank is
- **Solar panels** = how full the tank gets when you recharge
- **Actual charge** = the lesser of the two

Early game: few batteries, one solar panel. Every charge is precious. Late game: abundant batteries, full solar network. Energy is no longer the constraint — what you spend it on is.

### Automation Progression

**Early Game (Act 1)**

1. Start with zero infrastructure. Craft batteries from umbrasite by hand. Every battery is precious.
2. Build first solar panel (tutorial with MERIDIAN-7). Suit now auto-charges to a small baseline when you return to outpost.
3. First Array trades: silicon for basic sol unit upgrades.

**Mid Game (Act 2) — Drones**

4. Unlock Nightside drones. Deploy batteries INTO drones — drones venture into the Nightside and collect silicon at a slow passive rate.
5. Key mechanic: you can **recall drones at any time** and reclaim their batteries for your sol unit. Deploying drones is never permanent, just an opportunity cost. "Do I go on a run with 6 batteries, or deploy 3 to drones and run lean?"
6. More solar panels raise your charge ceiling. Build panels from Dayside materials acquired through Array trades.

**Late Game (Act 3) — Exponential Growth**

7. Upgrade drones to find umbrasite autonomously (not just silicon).
8. Umbrasite → more batteries → more drones → more umbrasite. The exponential tipping point.
9. Batteries shift from scarce survival resource to abundant currency. Silicon flows freely.
10. Self-replicating solar panels: panels slowly build more panels (with diminishing returns toward a cap).
11. Trade surplus to MERIDIAN-7 for top-tier upgrades and equipment.

**Endgame — Lighthouse Deployment**

12. With sufficient Array infrastructure and resources, you unlock the ability to **deploy new Lighthouses** on the Nightside.
13. Early game, restoring a single sabotaged Lighthouse was an entire act — a dungeon, a boss, a story beat. Now you're manufacturing and placing them yourself.
14. Each deployed Lighthouse creates a permanent light pocket in the Nightside: safe zone, charge point, fast-travel anchor, and forward operating base for deeper runs.
15. Lighthouse placement is a strategic decision — where you put them shapes which Nightside regions become accessible, which routes open up, and where your drones can safely operate.
16. Deploying Lighthouses at scale requires massive resource investment (batteries, silicon, rare deep-Nightside materials), giving the entire automation chain a grand endgame sink.

The power fantasy arc:

```
Act 1:  "I barely restored one Lighthouse and almost died"
Act 2:  "I can handle a Lighthouse run efficiently now"
Act 3:  "I'm deploying Lighthouses like solar panels"
```

You've gone from maintenance worker to infrastructure architect. You ARE the expansion now.

### Narrative Arc of Automation

| Phase | Player feeling | Narrative reality |
|-------|---------------|------------------|
| Early | "Every battery counts" | Scrappy self-reliance |
| Mid | "My drones are working for me" | Growing Array dependence |
| Late | "The resources flow on their own" | You've built the Array's dark-side supply chain |
| Endgame | "I'm deploying Lighthouses" | You are the Array's frontier expansion program |

By Act 3, the player realizes they've voluntarily built exactly the extraction economy the storyboard describes. The Factorio satisfaction and the narrative horror are the same thing. And now you're planting Lighthouses — the very infrastructure the Unbounded walked into the dark to escape. The thing that suppresses the Underlumen. And you're mass-producing it because it feels *powerful*.

---

## System 2: Sol Unit

### Sol Unit Variants

Throughout the game, the player finds **5-6 distinct sol units**. Each is a different weapon class with its own ability set and upgrade path. Finding a new sol unit is a major milestone — like finding a new weapon type in an ARPG.

All sol units share the same four ability archetypes, but express them differently:

| Ability Slot | Role | Example expressions |
|-------------|------|-------------------|
| **Primary** | High single-target damage | Focused beam, charged bolt, precision lance |
| **AOE** | Area damage/control | Cone blast, radial pulse, sweeping arc |
| **Mobility** | Evasion + traversal | Hover, dash, phase shift |
| **Defensive** | Brief protection / cast prep | Force shield, energy barrier, absorption field |

Each sol unit has a different feel: one might have a long-range sniper-style primary but weak AOE; another might have devastating AOE but a short-range primary. The mobility and defensive abilities similarly vary — hover vs dash vs teleport each play differently.

> **Open question:** Define the 5-6 specific sol unit variants, their thematic identities, and stat profiles.

### Upgrading at MERIDIAN-7

Trade silicon or umbrasite to MERIDIAN-7 to:

- Unlock new abilities on your current sol unit
- Upgrade ability stats (damage, range, duration, cooldown, energy cost)
- Unlock sol unit-specific upgrade paths (branching choices within each unit)

The Array manufactures what no human workshop can match. MERIDIAN-7 is your primary source of active combat power.

---

## System 3: Tech Mods

### The Core Idea

Your battery slots hold either **batteries** (pure energy capacity) or **tech mods** (passive bonuses that cost battery capacity). Every mod you equip makes you more powerful but reduces your operational range. Every battery you keep gives you more range but fewer bonuses.

This single system replaces both traditional gear AND skill trees. Your mod loadout IS your build.

### Battery Slots

Players start with a small number of battery slots and gain more by leveling up (XP from kills, quests, exploration, restoring Lighthouses).

- **Starting slots:** ~3
- **Max slots (high level):** ~10-12

Each level-up grants a new slot. This is always exciting — every new slot means either more range OR another mod OR a combination.

### The Tradeoff

With 8 slots, you might run:

- **8 batteries** — Maximum range. Go deep into the Nightside with no bonuses.
- **5 batteries + 3 mods** — Balanced. Good range with meaningful bonuses.
- **2 batteries + 6 mods** — Heavily augmented glass cannon. Stay near charge points.

The loadout changes based on what you're doing:
- Deep exploration run? More batteries.
- Farming a known area near a charge point? Load up on damage mods.
- Tough boss you've scouted? Specific mods to counter its mechanics.

You respec your build **every run** by swapping mods and batteries. No respec cost, no commitment — just opportunity cost.

### Finding Mods

Tech mods are **loot drops** — found on the ground in dungeons, rewarded from quests, purchased from faction vendors. Finding a good mod is the "found a new sword" moment. You pick it up, look at your loadout, and immediately decide whether to slot it in.

Mods have **rarity tiers** (common → uncommon → rare → epic → legendary). Higher rarity = stronger effects and/or more slot-efficient:

- A common mod might give +10% damage for 1 slot
- A rare mod might give +10% damage AND +5% crit for 1 slot
- Finding a 1-slot mod that replaces your current 2-slot mod is a major upgrade — you didn't get "stronger," you got more *efficient*, which frees a slot

### Mod Slot Cost

Most mods cost **1 battery slot**. Powerful mods cost **2 slots**. This creates a natural rarity/power curve — a 2-slot mod needs to be roughly worth two 1-slot mods to justify equipping it.

### Faction-Flavored Mods

Mods drop with faction flavor based on where you find them. Your mod loadout naturally expresses faction identity without needing a separate skill tree.

#### Dark Mods (Nightside drops)

Thematically: what the Unbounded learned by surviving without light.

- **Thermal Cloak** — Take 30% less cold damage (1 slot)
- **Umbral Siphon** — Kills restore a small amount of energy (1 slot)
- **Dark-Adapted Optics** — See further without sol unit light (1 slot)
- **Predator's Edge** — 50% more damage to unaware enemies (2 slots)
- **Cold Runner** — Move 25% faster in unlit areas (1 slot)
- **Dark Resonance** — Sense umbrasite deposits and hidden passages through walls (1 slot)
- **Scavenger Module** — Enemies have a chance to drop batteries on death (2 slots)

#### Bio Mods (Ring rewards, Cultivar Corps quests, Greenway loot)

Thematically: the Meridian Council's mastery of living systems.

- **Regeneration Matrix** — Passive health regen (1 slot)
- **Adrenal Gland** — Move 20% faster when below 30% HP (1 slot)
- **Spore Filter** — Immune to poison and fungal effects (1 slot)
- **Second Wind** — When below 25% HP, regenerate 30% HP over 5 seconds, 60s cooldown (2 slots)
- **Symbiotic Plating** — Max health +25% (2 slots)
- **Overgrowth Catalyst** — Consumable effects last twice as long (1 slot)

#### Light Mods (Array trades, Dayside operations)

Thematically: machine efficiency, energy optimization, information advantage.

- **Efficient Cells** — Abilities cost 15% less energy (1 slot)
- **Targeting Uplink** — Increased crit chance (1 slot)
- **MERIDIAN Beacon** — Reveal full minimap in current room (1 slot)
- **Overclock Module** — Attack speed +20% for 3s after using an ability (2 slots)
- **Chain Reaction Core** — Kills within 2s of each other refund 30% energy (2 slots)
- **Automation Efficiency** — Solar panels and drones produce more (1 slot)

### The Optimization Loop

Every run, the player asks:

- "I found a better version of my crit mod — 1 slot instead of 2. Now I have a free slot."
- "This deep run needs more range. Swap two mods for batteries."
- "We're doing a boss — I need the cold resistance mod and the health regen mod."
- "My teammate is running healer Bio mods, so I can go full damage Dark mods."

Build identity emerges from what you've found and what you choose to equip. A player running 4 Dark mods FEELS like a Dark-aligned character. If they find an incredible Bio mod, they can slot it in — no faction lock, just opportunity cost.

### Battery Quality Levels

Batteries come in quality levels: **3 L1 batteries = 1 L2 battery**, etc. Higher-level batteries store more energy per slot. This means:

- Early game: L1 batteries, each slot gives a small amount of energy
- Mid game: L2 batteries, each slot is worth 3x as much energy — frees up slots for mods
- Late game: L3+ batteries, each slot is enormously energy-dense — most slots can be mods

Battery quality upgrades are a **second axis of loot progression** alongside mods. Finding or crafting a higher-tier battery is exciting because it effectively gives you a free mod slot.

---

## How the Systems Interact

### The Core Loop

```
Dark-side dungeon run
  ├── Earn XP → level up → more battery slots (Tech Mods)
  ├── Find tech mods as loot (Tech Mods)
  ├── Find materials / higher-tier batteries (Tech Mods + Economy)
  ├── Mine umbrasite (Economy)
  │     └── Craft → Batteries + Silicon
  │           ├── Batteries → sol unit charge / drone deployment (Economy)
  │           └── Silicon → MERIDIAN-7 trades → sol unit upgrades (Sol Unit)
  └── Return to light side
        ├── Solar panels recharge sol unit (Economy)
        ├── Deploy/recall drones (Economy)
        ├── Upgrade sol unit at MERIDIAN-7 (Sol Unit)
        └── Optimize mod loadout for next run (Tech Mods)
```

### Cross-System Synergies

- Scavenger Module (Dark mod) generates batteries on kills — mod system feeding the economy
- Automation Efficiency (Light mod) boosts drone/panel output — mod system improving economy
- Better sol unit abilities let you clear harder dungeons for rarer mods and richer umbrasite veins
- Higher-tier batteries (Economy) free up mod slots, making your mod build stronger (Tech Mods)
- Bio sustain mods let you go deeper on fewer batteries — mods reducing economy pressure

### Power Curve

| Game Phase | Economy | Sol Unit | Tech Mods |
|-----------|---------|----------|-----------|
| **Early** | Scraping for batteries, first solar panel | Starting sol unit, basic abilities | 3-4 slots, mostly batteries, few common mods |
| **Mid** | Drones deployed, panels growing | 2nd-3rd sol unit found, branching upgrades | 6-8 slots, L2 batteries, build identity emerging |
| **Late** | Exponential growth, Lighthouse deployment | 4th-5th sol unit, deep upgrade paths | 10-12 slots, L3 batteries, mostly mods, rare/epic drops |

---

## Open Questions

1. **Sol unit variants** — Define the 5-6 specific units, their themes, and how they differ mechanically.
2. **Battery quality math** — What are the actual capacity numbers per tier? How does 3:1 compression interact with slot count at each game phase?
3. **Drone details** — How many can you deploy? What's the silicon/umbrasite collection rate? How does the recall mechanic work in UI terms?
4. **Mod drop rates and pool** — How many unique mods per faction? What's the rarity distribution? Do mods drop with random stat rolls (Diablo-style) or fixed stats?
5. **Mod stacking** — Can you equip two copies of the same mod? If so, do effects stack linearly?
6. **Multiplayer balance** — How does party composition interact with mod builds? Does seeing teammates' loadouts encourage role specialization?
7. **Mod storage** — How many mods can you keep in your stash? Is inventory management part of the game or should storage be generous?
8. **Lighthouse deployment details** — Resource costs, placement constraints, what radius of effect, can they be destroyed?
