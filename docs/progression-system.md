# Progression System Design

---

## The Sol Unit Grid

The sol unit is the player's core piece of equipment. Each sol unit has fixed attributes:

- **Grid dimensions** — a number of columns and rows (e.g. 2×3, 3×4). Different sol units found throughout the game have different grid sizes and shapes.
- **Innate perks/stats** — base stats that vary per sol unit model (e.g. one might have higher base energy efficiency, another might have a bonus to AOE damage).

The grid is where all build customization happens. Players slot **components** into the grid and can swap them freely between runs. The grid IS your build.

### Component Types

| Type | What it does | How you get it | Rarity |
|------|-------------|---------------|--------|
| **Abilities** | Active skills: attacks, moves, buffs, defensive actions | Trade silicon to MERIDIAN-7 | Common — progression-gated, not hard to farm |
| **Power Generators** | Passive energy regeneration (energy gained per tick/second) | Extremely precious — major milestones, rare finds | Very rare |
| **Modifiers** | Passive bonuses that boost adjacent components in the grid | Loot drops in dungeons | Ranges from common to legendary — the endgame chase |

### Adjacency System

**Modifiers boost the components they're placed next to in the grid.** This is the core optimization loop.

A modifier that gives "+30% damage" placed next to a beam attack makes that beam stronger. Place it next to a cone attack instead and the cone gets the bonus. Place it between two abilities and it boosts both.

This means:

- **Grid placement matters.** The same set of components in different arrangements produces different builds.
- **Modifiers that touch multiple abilities are exponentially valuable.** A well-placed modifier in the center of a grid can boost 2-4 abilities at once.
- **Grid size directly affects build complexity.** A 2×3 grid has limited adjacency options. A 4×4 grid enables elaborate synergies.
- **Players will theorycraft grid layouts endlessly.** "If I put my damage mod here and my cooldown mod there, both my beam and my shield get boosted."

Example: a 3×3 grid layout

```
┌──────────┬──────────┬──────────┐
│  Beam    │ +Damage  │  Cone    │
│ (attack) │  (mod)   │ (attack) │
├──────────┼──────────┼──────────┤
│ +Range   │ PowerGen │ +Area    │
│  (mod)   │ (regen)  │  (mod)   │
├──────────┼──────────┼──────────┤
│  Hover   │ +Speed   │  Shield  │
│ (move)   │  (mod)   │ (buff)   │
└──────────┴──────────┴──────────┘
```

In this layout:
- +Damage mod is adjacent to Beam AND Cone — both get the bonus
- +Range mod is adjacent to Beam AND Hover — beam gets longer range, hover gets longer distance
- PowerGen is in the center, adjacent to four modifiers (but power generators benefit from adjacency too? — see open questions)
- +Speed mod boosts both Hover and Shield (faster hover, faster shield activation)

### Abilities (Detail)

Abilities are the active skills: what buttons you press. They include:

- **Attacks** — beam (single target), cone (AOE), etc.
- **Moves** — hover (evasion + traversal over chasms/heights), dash, etc.
- **Buffs/Defensive** — force shield (brief invulnerability), energy barrier, etc.

Abilities are **not rare**. You unlock them by progressing through the game and trading silicon to MERIDIAN-7. The Array manufactures them to spec. Every player will eventually have access to all abilities — the differentiator is which ones you slot and where.

### Modifiers (Detail)

Modifiers are the rare loot chase. They're passive bonuses that only function when slotted into the grid, and they boost adjacent components.

Modifier examples:
- **+Damage** — Adjacent attacks deal more damage
- **+Range** — Adjacent attacks/moves have increased range
- **+Duration** — Adjacent buffs/shields last longer
- **+Efficiency** — Adjacent abilities cost less energy
- **+Cooldown** — Adjacent abilities recharge faster
- **+Area** — Adjacent AOE abilities have larger area of effect
- **+Speed** — Adjacent moves are faster, adjacent buffs activate faster

Modifiers have rarity tiers (common → uncommon → rare → epic → legendary). Higher rarity = stronger effect values. The endgame chase is finding legendary modifiers that enable specific build synergies.

Modifiers are **faction-flavored** based on where they drop:

- **Dark mods** (Nightside) — might have conditional bonuses: "+40% damage to unaware enemies", "bonus effect in unlit areas"
- **Bio mods** (Ring/Greenway) — might have sustain effects: "adjacent abilities heal on hit", "adjacent buffs also regenerate health"
- **Light mods** (Array/Dayside) — might have efficiency effects: "adjacent abilities cost 25% less energy", "adjacent attacks have +crit chance"

### Power Generators (Detail)

Power generators provide **passive energy regeneration** — energy gained over time without spending batteries. They are extremely precious because they directly reduce your dependence on batteries and charging.

A sol unit with a good power generator can sustain ability use in the field longer. Combined with high battery capacity, this means longer runs and more aggressive ability use.

Power generators slot into the grid like any other component, meaning they take up a slot that could otherwise be an ability or modifier. This is a real tradeoff: a power generator makes you more self-sufficient but costs you a grid slot.

**Decision: Yes, modifiers boost adjacent power generators.** An +Efficiency mod next to a power generator increases its regen rate. This creates another layer of grid optimization — generators aren't just "park anywhere" components, they benefit from strategic placement near modifiers.

---

## Energy System

### Batteries

**Batteries = maximum energy capacity.** They determine the ceiling of how much energy your sol unit can hold. Batteries are separate from the grid — they're a resource you accumulate.

Batteries come in quality levels with a **3:1 compression ratio**:
- 3 L1 batteries = 1 L2 battery
- 3 L2 batteries = 1 L3 battery
- Higher-tier batteries hold more energy per unit

You want high battery capacity so your power generators and charging have room to fill.

### Charging

**Solar panels** and **chargers** fill your batteries up to their capacity:

- **Your solar panel** (built early game) — a free recharge point you can return to. Tops you up at no cost.
- **Border chargers** — other spots on the Dayside border where you can charge, but these cost silicon.
- **General rule:** you can always charge in exchange for silicon, anywhere there's a charger.

Actual energy = min(battery capacity, amount charged). You need both batteries (big tank) and charging access (ways to fill it).

### Energy Flow

```
Power generators (passive regen) ──→ ┐
Solar panel (free, your base)    ──→ ├──→ Current energy (capped by battery capacity)
Border chargers (costs silicon)  ──→ ┘
                                           │
                                           ▼
                                     Ability use (drains energy)
```

---

## Early Game Progression

### First Umbrasite

Your first piece of umbrasite, crafted at the outpost, produces:
1. **Your first battery** — you now have energy capacity
2. **Enough silicon to build a solar panel** on the Dayside border

Building the solar panel is a tutorial moment with MERIDIAN-7. The reward: **your second ability** (your first was given at game start). The solar panel also becomes a **free recharge point** — a spot you can return to and top up without spending silicon.

This teaches three things at once: umbrasite is valuable, silicon buys things from the Array, and the Dayside border is your infrastructure hub.

### Second Umbrasite

Your second piece of umbrasite produces:
1. **Your second battery** — more energy capacity
2. **Enough silicon to build a harvester**

The harvester is an automated Nightside drone that collects silicon passively — but it **requires a battery to operate**. Deploying a battery to the harvester means your max energy drops by one battery's worth.

This is the **first meaningful tension**: keep the battery for more MP (go deeper, cast more) or deploy it to start the automation loop (passive silicon income → more MERIDIAN-7 trades → more abilities).

Players who prioritize the harvester get ahead on abilities and infrastructure. Players who keep the battery can push deeper into dungeons sooner. Both are valid.

### The Loop Establishes

```
Mine umbrasite in Nightside dungeons
  └── Craft at outpost → Batteries + Silicon
        ├── Batteries → energy capacity (keep) OR harvester fuel (deploy)
        ├── Silicon → MERIDIAN-7 trades → new abilities
        └── Silicon → border chargers → recharge
```

The player is now making interesting decisions every time they return from a run.

---

## Progression Summary

| What you progress | How you get it | Cadence |
|-------------------|---------------|---------|
| **Abilities** | Trade silicon to MERIDIAN-7 | Regular — every few runs |
| **Modifiers** | Loot drops in dungeons | Variable — the chase |
| **Power generators** | Major milestones, rare finds | Rare — a few per playthrough |
| **Batteries** | Craft from umbrasite | Regular — every run produces some |
| **Sol units** | Found 5-6 times throughout the game | Major milestones |
| **Solar panels / infrastructure** | Built with silicon on the Dayside | Between runs |
| **Harvesters / automation** | Built with silicon + deployed batteries | Between runs |

### What Makes Each Exciting

- **New ability:** "I can do a new thing." Expands your action set.
- **New modifier:** "My existing things are better — and WHERE I put this matters." Optimization puzzle.
- **New power generator:** "I'm less dependent on charging. I can stay out longer." Rare and precious.
- **New battery tier:** "My tank is bigger. I can use more mods... wait, wrong system. I can cast more." Pure capacity.
- **New sol unit:** "Entirely new grid to optimize. New innate perks. New build possibilities." Game-changer.
- **New infrastructure:** "My economy is stronger. Resources flow faster." Factorio brain.

---

## Battery Math

### Battery Tiers

Batteries follow a **3:1 compression ratio**: three lower-tier batteries can be compressed into one of the next tier, saving grid/inventory slots with a slight capacity bonus.

| Tier | Component ID | Capacity | Rechargeable | Notes |
|------|-------------|----------|--------------|-------|
| L1 | `starter_battery` | 30 | Yes | First umbrasite craft |
| L2 | `rechargeable_battery` | 100 | Yes | Standard crafted battery |
| L2 (single-use) | `single_use_battery` | 100 | No | Loot/purchase; degrades permanently when drained |
| L3 | `advanced_rechargeable_battery` | 300 | Yes | Late-game craft (3 L2 → 1 L3) |

**Total energy = sol unit base + sum of battery capacities.** Single-use batteries add to the pool but degrade permanently when drawn from — the smallest single-use battery loses capacity first.

### Ability Energy Costs

| Ability | Energy Cost | Cooldown | Role |
|---------|------------|----------|------|
| Sol Beam | 8 | 0.8s | Bread-and-butter ranged attack |
| Hover | 8 | 1.0s | Traversal / evasion |
| Sol Cone | 15 | 3.5s | AOE crowd control |
| Sol Shield | 20 | 10.0s | Emergency heal (35 HP) |
| Light Sentry | 25 | 2.0s | Sustained DPS turret |
| Sol Teleport | 35 | 3.0s | Repositioning / escape |
| Pulse Cannon | 40 | 8.0s | Heavy AOE nuke (2s cast) |

Free abilities (blaster shot, melee strike, etc.) cost zero energy — you always have a fallback.

### Generator Regen Rates

| Generator | Base Regen/sec | Notes |
|-----------|---------------|-------|
| Basic Generator | 3 | First generator find |
| Improved Generator | 4 | Mid-game milestone |
| Uranium Generator | 8 | Rare late-game find |
| Prismatic Core | 12 | Legendary co-op reward (2×2 shape) |

Adjacent `energyCostReduction` modifiers boost regen by the same percentage (e.g. +0.30 reduction → ×1.30 regen). Sol unit innate bonuses also apply.

### Casts Per Full Charge — By Game Phase

The tables below show ability uses from a single full charge **without generator regen**, representing the worst case (no generators slotted or regen between fights).

#### Early Game — Mk1 + 1 L1 battery (60 total energy)

| Ability | Cost | Casts |
|---------|------|-------|
| Sol Beam | 8 | 7 |
| Sol Cone | 15 | 4 |
| Hover | 8 | 7 |

**Typical fight:** 2 beams + 1 cone = 31 energy. A full charge sustains ~2 room fights before you need to recharge. Energy is tight — return to the solar panel often.

#### Mid Game — Mk1+ + 1 L2 battery (140 total energy)

| Ability | Cost | Casts |
|---------|------|-------|
| Sol Beam | 8 | 17 |
| Sol Cone | 15 | 9 |
| Sol Teleport | 35 | 4 |
| Sol Shield | 20 | 7 |

**Typical fight:** 3 beams + 1 cone + 1 teleport = 74 energy. A full charge sustains ~2 fights with room for a shield or escape. A basic generator (3/s) recovers 1 beam's cost every 2.7 seconds — meaningful over a dungeon run.

#### Late Game — Array Precision Core + 1 L3 battery (500 total energy, innate -20% cost)

| Ability | Base Cost | Reduced Cost | Casts |
|---------|-----------|-------------|-------|
| Sol Beam | 8 | 6 | 83 |
| Sol Cone | 15 | 12 | 41 |
| Pulse Cannon | 40 | 32 | 15 |
| Sol Teleport | 35 | 28 | 17 |
| Light Sentry | 25 | 20 | 25 |

**Typical fight:** 4 beams + 1 cone + 1 sentry = 56 energy. A full charge sustains ~8-9 fights. Add a uranium generator (8/s, boosted to 9.6/s by innate) and you recover a beam's cost every 0.6 seconds — near-indefinite light ability use with breaks between rooms.

#### Endgame — Underlumen Nexus + 1 L3 battery + efficiency mods (460 total, ~40% cost reduction)

| Ability | Base Cost | Reduced Cost | Casts |
|---------|-----------|-------------|-------|
| Sol Beam | 8 | 5 | 92 |
| Pulse Cannon | 40 | 24 | 19 |
| Sol Teleport | 35 | 21 | 21 |
| Light Sentry | 25 | 15 | 30 |

With a uranium generator boosted by efficiency mods (8 × 1.40 = 11.2/s), energy sustain becomes near-infinite for cheap abilities. The constraint shifts to cooldowns and positioning rather than energy budget. Expensive abilities (pulse cannon, teleport) still drain meaningfully.

### Design Intent

- **Early game:** Energy is scarce. Every ability use is a deliberate choice. The solar panel is your lifeline.
- **Mid game:** Battery upgrades and generators ease the pressure. You can commit to a full dungeon floor before recharging, but big abilities still cost.
- **Late game:** Raw capacity is abundant. The build puzzle shifts from "can I afford to cast?" to "which abilities do I boost, and how do I arrange my grid for maximum efficiency?"
- **Harvester tradeoff:** Deploying a battery to a harvester removes that capacity from your energy pool. Early game: giving up 30 capacity (half your pool) is painful. Late game: 30 is negligible against a 500+ pool.

## Late Game Automation

> To be designed. The early game loop (umbrasite → batteries + silicon → abilities + infrastructure) is established. Late game should escalate toward exponential growth, self-replicating systems, and ultimately **Lighthouse deployment** (see storyboard). The progression from "barely restored one Lighthouse" in Act 1 to "deploying them at scale" in the endgame is the target power fantasy arc.

---

## Resolved Design Decisions

### Adjacency: Modifiers boost generators (Decided)

**Yes.** Modifiers adjacent to power generators boost their energy regen rate. Specifically:
- `damageMultiplier` bonuses do NOT apply to generators (damage is irrelevant to regen).
- `cooldownReduction` bonuses do NOT apply to generators (no cooldown to reduce).
- `energyCostReduction` bonuses boost generator efficiency: the reduction percentage is applied as a regen multiplier (e.g. +20% energyCostReduction → +20% regen).
- `healOnHit` does NOT apply to generators.

This means efficiency-type modifiers have dual use: they reduce ability energy costs AND boost generator output when adjacent. Placement matters.

### Adjacency: Modifiers do NOT boost other modifiers (Decided)

**No modifier-modifier chaining.** Modifiers only boost abilities and generators. This prevents exponential stacking and keeps the system understandable. A modifier's bonus is fixed by its rarity/stats — its value comes from how many abilities/generators it touches, not from being boosted by other modifiers.

### Grid component limits (Decided)

- **Duplicate modifiers: Allowed.** You can slot multiple copies of the same modifier. Grid space is the natural limiter.
- **No ability/modifier ratio limits.** The grid size constrains total components. Players are free to go all-offense, all-utility, or any mix.
- **Stacking caps per ability** (to prevent degenerate builds):
  - Cooldown reduction: caps at **75%** (minimum 25% of base cooldown)
  - Energy cost reduction: caps at **75%** (minimum 25% of base cost)
  - Damage multiplier: stacks additively, no hard cap (grid space limits it naturally)
  - Heal on hit: caps at **15 HP per hit** per ability

---

## Open Questions

1. ~~**Sol unit variants**~~ — **Resolved.** Six sol units defined in `content/entities/sol_units.json`:
   - **Mk1** (5×5, 100 charge, no perk) — Tutorial starter from the outpost.
   - **Mk1+** (6×6, 120 charge, no perk) — Military-grade upgrade found in Act 1 cache.
   - **Nightcaster Frame** (5×5, 80 charge, +20% damage) — Unbounded glass cannon from Frost Crypts.
   - **Array Precision Core** (6×6, 200 charge, -20% energy cost) — Array-built efficiency frame from MERIDIAN-7 trade.
   - **Greenway Bioframe** (7×7, 140 charge, +3 heal on hit) — Bio-tech sustain frame from Fungal Forests.
   - **Underlumen Nexus** (8×8, 160 charge, -15% cooldown) — Endgame frame from deep ruins.
   Engine supports `innateBonus` field on sol unit defs, applied globally to all grid abilities and generators.
2. ~~**Extended adjacency modifiers**~~ — **Resolved.** Legendary-tier modifiers can have an `adjacencyPattern` field:
   - `"radius2"` — Affects abilities/generators within Manhattan distance 2 (12 cells instead of 4).
   - `"row"` — Affects all abilities/generators in the same grid row.
   - `"column"` — Affects all abilities/generators in the same grid column.
   Standard modifiers (no `adjacencyPattern`) remain 4-directional distance 1. Extended adjacency is exclusive to legendary tier, making them true build-defining upgrades. Larger shapes (2×2, 1×3) offset their power by consuming more grid space.
   Defined in `content/entities/sol_components.json`: Abyssal Nexus (Nightside, radius2), Verdant Overgrowth (Greenway, column), Solar Array Beacon (Dayside, row), Convergence Matrix (generic, radius2).
3. ~~**Modifier stat ranges**~~ — **Resolved.** See below.

### Modifier Stat Ranges by Rarity (Decided)

Single-stat reference values per rarity tier:

| Stat | Common | Uncommon | Rare | Epic | Legendary |
|------|--------|----------|------|------|-----------|
| damageMultiplier | 0.10 | 0.20 | 0.35 | 0.50 | 0.70 |
| cooldownReduction | 0.08 | 0.15 | 0.22 | 0.30 | 0.40 |
| energyCostReduction | 0.10 | 0.20 | 0.30 | 0.40 | 0.50 |
| healOnHit | 2 | 3 | 5 | 8 | 12 |

**Dual-stat modifiers** split their power budget across two stats, each at roughly 60-75% of the single-stat reference for that rarity. Example: a rare dual-stat mod might have damageMultiplier 0.20 + cooldownReduction 0.15 instead of a single stat at full rare value.

**Faction modifiers** follow the same tiers but can skew toward their faction specialty (e.g. Nightside mods lean heavier on damage, Greenway on healOnHit, Dayside on energyCostReduction). The total power budget stays within tier bounds.

**Legendary tier** modifiers have **extended adjacency** — they affect abilities beyond the standard 4-directional reach. Their larger shapes (2×2, 1×3) and powerful stats make them build-defining upgrades. See the extended adjacency section above.

Each modifier in `sol_components.json` has a `rarity` field. The engine reads bonuses directly from the JSON — no runtime scaling is applied. All rarity-based stat differentiation is baked into the content data.
4. ~~**Battery math**~~ — **Resolved.** See "Battery Math" section below.
5. **Harvester scaling** — Silicon collection rate, how many harvesters can you deploy, do better harvesters become available later?
6. **Ability list** — Full catalog of abilities available from MERIDIAN-7, organized by unlock order.
7. **Multiplayer implications** — Do players in a party see each others' grid builds? Does this encourage specialization?
