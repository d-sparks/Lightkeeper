# Endgame Loop Design

After choosing one of the three ending paths (Shutdown, Merge, Control), Lightkeeper transitions from a story-driven dungeon crawler into a repeatable systems-driven loop. The player's choice determines which faction infrastructure persists, which new threats emerge, and which progression axes open up.

This document defines four interlocking endgame pillars: **Expeditions** (escalating procedural dungeons), **Legendary Chase** (modifier hunting), **Automation Scaling** (infrastructure growth), and **Cooperative Challenges** (multiplayer objectives).

## Design Principles

- **Ending path matters.** Each path unlocks a distinct endgame flavor, not just cosmetic differences. Players who replay a different path should encounter genuinely different content.
- **Data-driven.** All endgame content is JSON — dungeon templates, loot tables, monster scaling, milestones. No hardcoded endgame logic in the engine beyond the scaling/tier system.
- **Interlocking loops.** Expeditions drop modifiers. Modifiers improve expedition performance. Automation funds expedition preparation. Cooperative challenges gate the highest tiers.
- **Horizontal over vertical.** Avoid infinite stat inflation. Instead, expand build diversity — more modifier slots, new adjacency patterns, specialized sol unit frames. A Tier 5 player is more *versatile* than a Tier 1 player, not 10x stronger.

## 1. Expeditions — Escalating Procedural Dungeons

### Concept

Post-ending, the Nightside destabilizes. New procedural dungeon entrances appear, organized into numbered **Tiers** of escalating difficulty. Each tier applies scaling multipliers to monster stats and introduces new environmental hazards.

### Tier Structure

| Tier | Monster HP | Monster DMG | New Mechanics | Unlock |
|------|-----------|-------------|---------------|--------|
| 1 | 1.0x | 1.0x | Baseline post-story | Complete any ending |
| 2 | 1.4x | 1.3x | Timed darkness waves | Clear Tier 1 expedition |
| 3 | 1.8x | 1.6x | Corruption zones (energy drain tiles) | Clear Tier 2 + automation level 3 |
| 4 | 2.4x | 2.0x | Elite monster affixes | Clear Tier 3 + 2 players |
| 5 | 3.0x | 2.5x | Boss gauntlet (3 bosses per run) | Clear Tier 4 + automation level 5 |

### Expedition Flow

1. **Select tier** at the expedition board (NPC or interactable in meridian_station, post-ending).
2. **Preparation phase**: spend silicon to purchase expedition supplies (battery chips, consumables). Higher tiers cost more.
3. **Enter procedural dungeon**: 3-5 floors generated from the existing template pool (quarantine, frost_crypt, fungal_forest, geothermal), biome randomized per run.
4. **Clear floors**: kill all monsters or reach the exit. Each floor has a chest with tier-scaled loot.
5. **Boss floor**: final floor spawns a scaled boss with randomized affixes.
6. **Extraction**: return to meridian_station with loot. Dying forfeits floor loot (keep what you've already banked at mid-run checkpoints).

### Ending Path Variants

- **Shutdown path**: Expeditions are into the awakening Underlumen network. Biomes shift toward nightside/organic themes. Unique monster type: `underlumen_spawn` (biological, heals in darkness). Unique hazard: living walls that shift between floors.
- **Merge path**: Expeditions explore the merged Array-Underlumen substrate. Mixed tech/organic biomes. Unique mechanic: symbiosis tiles that buff both player AND monsters. Unique monster type: `hybrid_construct` (tech + organic abilities).
- **Control path**: Expeditions clear malfunctioning Array sectors. Tech-heavy biomes. Unique mechanic: deploy turrets from automation inventory. Unique monster type: `rogue_array_unit` (reprogrammed versions of array_sentinel/overseer with new attack patterns).

### Data Format

Expedition config lives in `content/expeditions/`. Each tier is a JSON file:

```json
{
  "id": "expedition_tier_1",
  "tier": 1,
  "displayName": "Nightside Breach — Tier 1",
  "unlockCondition": { "or": [
    { "hasFlag": "chose_path_shutdown" },
    { "hasFlag": "chose_path_merge" },
    { "hasFlag": "chose_path_control" }
  ]},
  "floorCount": { "min": 3, "max": 4 },
  "templatePool": ["quarantine", "frost_crypt", "fungal_forest", "geothermal"],
  "monsterScaling": { "hpMult": 1.0, "damageMult": 1.0, "xpMult": 1.5 },
  "lootTable": "expedition_tier_1",
  "siliconCost": 5,
  "mechanics": [],
  "bossPool": ["crystal_guardian", "elder_sporecap", "luddite_warlord", "threshold_keeper"],
  "bossAffixes": []
}
```

### Boss Affixes

Affixes are data-driven modifiers applied to boss encounters at Tier 4+:

| Affix | Effect |
|-------|--------|
| `regenerating` | Boss heals 2% max HP per second |
| `shielded` | Takes 50% reduced damage until shield broken (hit threshold) |
| `splitter` | At 50% HP, splits into two half-HP copies |
| `empowered_minions` | Spawns buffed adds every 30 seconds |
| `darkness_aura` | Reduces player vision radius by 50% |
| `energy_siphon` | Boss attacks drain player energy |

```json
{
  "id": "regenerating",
  "displayName": "Regenerating",
  "type": "boss_affix",
  "effect": "heal_per_second",
  "value": 0.02,
  "description": "Slowly regenerates health"
}
```

### Engine Requirements

- **Tier scaling system**: Multiply monster stats at spawn time based on expedition tier config. Minimal engine addition — `game-loop.js` reads `monsterScaling` from the active expedition context and applies multipliers during `spawnMonster`.
- **Expedition state**: Track per-player expedition progress (current tier, current floor, banked loot) in the existing flag store. Keys: `expedition_tier`, `expedition_floor`, `expedition_banked_loot`.
- **Affix application**: Boss affixes are processed as buff entries on the monster entity, similar to existing pack_leader aura buffs.

## 2. Legendary Modifier Chase

### Concept

The sol grid's modifier rarity system (Common through Legendary) is the primary endgame chase. Legendary modifiers with extended adjacency patterns (radius-2, row, column) are the build-defining capstones. The endgame loop must create reliable-but-not-trivial paths to acquire and optimize them.

### Drop Sources

| Source | Drop Rate | Pool |
|--------|-----------|------|
| Expedition Tier 1 boss | 5% legendary | Faction-neutral legendaries |
| Expedition Tier 2 boss | 10% legendary | Faction-neutral legendaries |
| Expedition Tier 3 boss | 15% legendary | + Ending-path-specific legendaries |
| Expedition Tier 4-5 boss | 20% legendary | + Cooperative-only legendaries |
| Automation milestone 20 | Guaranteed | 1 random legendary |
| Cooperative challenge | Guaranteed | Cooperative-only legendary pool |

### New Legendary Modifiers (Ending-Path-Specific)

Each ending path unlocks access to two unique legendary modifiers, available only in Tier 3+ expedition loot tables for that path:

**Shutdown path:**
- `underlumen_heart` — Extended adjacency: all orthogonal neighbors (cross pattern). +0.60 damage. "Pulses with freed Underlumen energy."
- `autonomy_core` — Extended adjacency: radius-2. +0.45 efficiency. "Independence has its own power."

**Merge path:**
- `symbiosis_matrix` — Extended adjacency: full 3x3 area. +0.35 damage, +6 heal. "Two systems as one."
- `convergence_lens` — Extended adjacency: row + column (cross). -0.35 cooldown. "All paths meet here."

**Control path:**
- `array_command_node` — Extended adjacency: column. +0.65 damage, -0.25 cooldown. "Total control, total power."
- `efficiency_overseer` — Extended adjacency: row. +0.55 efficiency, +4 heal. "Optimized beyond design parameters."

### Modifier Crafting (Silicon Sink)

To prevent pure RNG frustration, introduce a **modifier reforging** system via MERIDIAN-7 (post-ending dialogue branch):

- **Reforge** (50 silicon): Reroll a modifier's rarity tier. 60% same tier, 30% one tier up, 10% one tier down. Cannot drop below Uncommon.
- **Fuse** (100 silicon + 3 same-rarity modifiers): Combine three modifiers of the same rarity into one modifier of the next rarity tier. Three Epics produce one Legendary (random from available pool).
- **Attune** (200 silicon): Lock a legendary modifier to a specific extended adjacency pattern (choose from radius-2, row, or column). Prevents reforging.

### Data Format

New loot tables in `content/loot/expeditions.json`:

```json
{
  "expedition_tier_3_shutdown": {
    "drops": [
      { "item": "sol_modifier_legendary", "weight": 15, "pool": "legendary_shutdown" },
      { "item": "sol_modifier_epic", "weight": 35 },
      { "item": "sol_modifier_rare", "weight": 50 }
    ]
  }
}
```

Modifier crafting recipes in `content/entities/crafting.json`:

```json
{
  "reforge": {
    "cost": { "silicon": 50 },
    "input": { "type": "sol_modifier", "count": 1 },
    "output": "rerolled_modifier"
  },
  "fuse": {
    "cost": { "silicon": 100 },
    "input": { "type": "sol_modifier", "count": 3, "sameRarity": true },
    "output": "next_rarity_modifier"
  }
}
```

### Engine Requirements

- **Crafting system**: New action type `craft` in the scripting system, triggered by NPC interaction. Validates input items, consumes cost, produces output. Small engine addition to `actions.js`.
- **Modifier pool resolution**: When a "sol_modifier_legendary" drop resolves, check player's ending path flag to include path-specific modifiers in the pool.

## 3. Automation Scaling Milestones

### Concept

Post-ending, the automation grid expands from a resource supplement into a progression axis. New structure types, adjacency bonuses between structures, and milestone rewards create a parallel advancement track that feeds into expedition preparation.

### Extended Automation Levels

| Level | Structures | Name | Reward |
|-------|-----------|------|--------|
| 1-5 | (existing) | (existing) | (existing rewards) |
| 6 | 20 | Grid Expansion | Grid size increases to 16x16 |
| 7 | 25 | Refinery | Unlock `silicon_refinery` structure (doubles adjacent harvester output) |
| 8 | 30 | Defense Grid | Unlock `auto_turret` structure (defends dayside from raid events) |
| 9 | 40 | Fabrication Bay | Unlock `fabricator` structure (passive modifier crafting) |
| 10 | 50 | Array Subnet | Unlock `expedition_beacon` (reduces expedition silicon cost by 50%) |
| 15 | 75 | Solar Dominance | Unlock `advanced_solar_panel` (3x output) |
| 20 | 100 | Autonomous Network | Guaranteed legendary modifier + title "Array Architect" |

### New Structure Types

```json
{
  "silicon_refinery": {
    "displayName": "Silicon Refinery",
    "category": "production",
    "cost": { "silicon": 30 },
    "unlockLevel": 7,
    "effect": "adjacent_harvester_boost",
    "boostMultiplier": 2.0,
    "description": "Doubles output of adjacent silicon harvesters"
  },
  "auto_turret": {
    "displayName": "Auto-Turret",
    "category": "defense",
    "cost": { "silicon": 25 },
    "unlockLevel": 8,
    "effect": "raid_defense",
    "defenseValue": 50,
    "description": "Defends against Nightside raid events"
  },
  "fabricator": {
    "displayName": "Fabricator",
    "category": "production",
    "cost": { "silicon": 50 },
    "unlockLevel": 9,
    "effect": "passive_crafting",
    "craftInterval": 3600,
    "craftOutput": "random_modifier_uncommon",
    "description": "Produces a random modifier every hour"
  },
  "expedition_beacon": {
    "displayName": "Expedition Beacon",
    "category": "utility",
    "cost": { "silicon": 40 },
    "unlockLevel": 10,
    "effect": "expedition_cost_reduction",
    "reduction": 0.5,
    "description": "Halves silicon cost for expeditions"
  }
}
```

### Raid Events (Automation Defense)

At automation level 8+, periodic **raid events** threaten the dayside infrastructure:

- Every 20 minutes of real time (while player is online), a raid chance triggers (30%).
- Nightside creatures breach into dayside_solar_fields and attack structures.
- Structures without turret coverage take damage and can be destroyed.
- Players can teleport to dayside to fight off raids manually.
- Raid difficulty scales with automation level.

This creates tension: expand your grid, but defend it. Deploy turrets (which don't produce resources) or risk losing harvesters.

### Ending Path Variants

- **Shutdown**: Automation is harder — Array infrastructure is disabled. Structure costs +50%. But Underlumen growth provides a unique `bio_harvester` structure that self-replicates (free placement every 30 min, max 5).
- **Merge**: Balanced — both systems cooperate. Unlock `symbiotic_node` structure that counts as both solar panel AND harvester at 75% efficiency of each.
- **Control**: Automation is easier — full Array control. Structure costs -25%. Unlock `array_drone_bay` that auto-repairs damaged structures.

### Data Format

Extended automation config in `content/entities/automation.json` (new file alongside existing automation data):

```json
{
  "milestones": {
    "6": { "reward": "grid_expansion_16x16", "displayName": "Grid Expansion" },
    "7": { "reward": "unlock_silicon_refinery", "displayName": "Refinery Online" }
  },
  "structures": {
    "silicon_refinery": { ... },
    "auto_turret": { ... }
  },
  "raids": {
    "interval": 1200,
    "chance": 0.3,
    "baseMonsters": 5,
    "scalingPerLevel": 2,
    "monsterPool": ["dusk_crawler", "shade_stalker", "tunnel_creeper"]
  }
}
```

## 4. Cooperative Challenges

### Concept

Tier 4+ expeditions require multiple players. Beyond that, dedicated cooperative challenges provide the highest-tier rewards and the primary social endgame.

### Challenge Types

#### Lighthouse Siege

- **2-4 players** defend a Lighthouse structure against 10 waves of Nightside creatures.
- Players share a communal energy pool that drains each wave.
- Between waves, players can repair the Lighthouse (spend silicon) or set up Light Sentries.
- Surviving all 10 waves awards a cooperative-only legendary modifier from the `siege_legendary` pool.
- Repeatable weekly (server reset timer tracked per-player via flags).

#### Deep Expedition (Tier 6)

- **3-4 players** required. 7 floors, no mid-run checkpoints, all loot on extraction only.
- Monsters at 4.0x HP, 3.0x damage.
- Unique deep-only monster: `abyssal_sovereign` — boss with mechanics requiring player coordination (e.g., two players must stand on pressure plates while others fight).
- Drops `prismatic_core` — a legendary generator component (12 energy/sec, highest in game).

#### Faction Rally

- **2+ players**, post-ending. Monthly event (real-time).
- All players on the server contribute to a shared faction goal (e.g., "harvest 500 silicon", "clear 20 expeditions", "defeat 100 Tier 3+ monsters").
- Progress tracked via server-wide flags.
- Completion unlocks a limited cosmetic reward and bonus loot rates for the following week.

### Cooperative-Only Legendary Pool

These modifiers only drop from cooperative challenges:

- `lighthouse_lens` — Extended adjacency: full 3x3. +0.40 damage, +0.30 efficiency. "Forged in the light of a defended Lighthouse."
- `deep_resonance` — Extended adjacency: radius-2. -0.40 cooldown, +8 heal. "Echoes from the deepest Nightside."
- `prismatic_core` — Generator, 12 energy/sec. "A convergence of all energy sources."

### Data Format

Challenge definitions in `content/challenges/`:

```json
{
  "id": "lighthouse_siege",
  "displayName": "Lighthouse Siege",
  "type": "wave_defense",
  "minPlayers": 2,
  "maxPlayers": 4,
  "waves": 10,
  "waveInterval": 45,
  "monsterPool": ["shade_stalker", "tunnel_creeper", "dusk_crawler", "abyssal_tendril"],
  "monsterScaling": { "hpMult": 2.0, "damageMult": 1.8 },
  "rewardTable": "siege_legendary",
  "cooldown": 604800,
  "unlockCondition": { "hasFlag": "expedition_tier_4_cleared" }
}
```

## Loop Integration

Here's how the four pillars feed into each other:

```
AUTOMATION produces silicon
    |
    v
Silicon funds EXPEDITION preparation (supplies, entry cost)
    |
    v
EXPEDITIONS drop MODIFIERS (+ faction-specific legendaries)
    |
    v
Modifiers improve sol grid builds, enabling higher EXPEDITION tiers
    |
    v
Higher tiers require COOPERATIVE play (Tier 4+)
    |
    v
Cooperative challenges drop exclusive LEGENDARIES
    |
    v
Legendary builds enable AUTOMATION defense (raids at higher levels)
    |
    v
(cycle continues with rising stakes)
```

### Session Pacing

A typical endgame session (30-60 min):

1. **Check automation** (2 min): Collect passive silicon, repair raid damage, place new structures.
2. **Prepare expedition** (3 min): Buy supplies, select tier, choose biome preference.
3. **Run expedition** (15-25 min): Clear 3-5 procedural floors, fight boss.
4. **Evaluate loot** (5 min): Compare modifiers, reforge/fuse at MERIDIAN-7, optimize sol grid.
5. **Cooperative challenge** (20-30 min, optional): Queue for Lighthouse Siege or Deep Expedition with other players.

### Retention Hooks

| Timeframe | Hook |
|-----------|------|
| Per session | Expedition runs with randomized biomes and boss affixes |
| Daily | Automation passive income collection + raid defense |
| Weekly | Lighthouse Siege cooldown reset, bonus loot window |
| Monthly | Faction Rally community event |
| Long-term | Legendary modifier collection across all three ending paths (3 playthroughs) |

## Post-Ending World State

Before endgame systems activate, the world must reflect the player's choice. These changes trigger immediately after the ending dungeon is completed:

### Shutdown Path (`chose_path_shutdown`)
- MERIDIAN-7 dialogue shifts to limited/degraded mode (reduced trade inventory)
- Sable becomes expedition quest-giver ("The Underlumen is waking — we need to map it")
- Nightside dungeons gain new organic tileset overlays
- Automation costs increase (+50% silicon)

### Merge Path (`chose_path_merge`)
- MERIDIAN-7 and Sable both become expedition quest-givers
- New NPC: Underlumen Voice (ambient narrator in expedition dungeons)
- Mixed tech/organic tileset overlays in all biomes
- Balanced automation costs

### Control Path (`chose_path_control`)
- MERIDIAN-7 becomes primary quest-giver with expanded trade inventory
- Sable is hostile/absent (left Meridian)
- Tech-heavy tileset overlays, Array patrols as allies in expeditions
- Automation costs decrease (-25% silicon)

### Implementation

Post-ending state changes are purely data-driven via the existing TCA scripting system:

```json
{
  "trigger": "room_entered",
  "conditions": { "hasFlag": "chose_path_shutdown" },
  "actions": [
    { "type": "setDialogue", "npcId": "meridian_7", "dialogueKey": "post_shutdown_endgame" },
    { "type": "setFlag", "flag": "endgame_active", "value": "shutdown" }
  ]
}
```

The `endgame_active` flag gates all endgame content — expeditions, extended automation, and cooperative challenges only appear after this flag is set.

## Implementation Priority

1. ~~**Post-ending world state**~~ ✓ Done — Flag-based NPC/environment shifts via TCA triggers.
2. ~~**Expedition Tier 1-3**~~ ✓ Done — Multi-floor procedural dungeons with boss spawning, stat scaling, silicon costs, death penalty, mid-run checkpoints.
3. ~~**Modifier crafting**~~ ✓ Done — Reforge/fuse/attune at MERIDIAN-7 gated on endgame_active flag.
4. ~~**Automation levels 6-10**~~ ✓ Done — 4 new structures (silicon_refinery, auto_turret, fabricator, expedition_beacon), grid expansion, adjacency bonuses, path-specific variants.
5. ~~**Expedition Tier 4-5 + boss affixes**~~ ✓ Done — 8 boss affixes, cooperative gating (2+ players), path-specific loot tables with unlockFlag filtering.
6. **Cooperative challenges** — Lighthouse Siege, Deep Expedition. Next major system to build.
7. ~~**Raid events**~~ ✓ Done — Timed raids, structure HP/repair, turret defense, drone bay auto-repair.
8. **Faction Rally** — Server-wide goals. Small engine addition (server-wide flag aggregation).
9. **Automation levels 11-20** — Extended milestone content. Pure content.
10. ~~**Path-specific legendaries**~~ ✓ Done — Ending-gated loot pools wired to expedition boss tables.

## Open Questions

- **Permadeath expeditions?** Should Tier 5 expeditions have permadeath (lose character on death) for maximum stakes? Or is the loot-loss penalty sufficient?
- **Cross-path trading?** Can players on different ending paths trade modifiers in multiplayer? This would let a Shutdown player obtain Control-only legendaries, increasing social value but reducing replayability incentive.
- **Seasonal resets?** Should expedition tier progress reset periodically to keep the climb fresh? Or is the modifier chase sufficient long-term motivation?
- **Automation PvP?** Could players on the Control path raid other players' automation grids? High-risk design but thematically resonant.
