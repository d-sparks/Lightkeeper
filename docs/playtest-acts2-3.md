# Acts 2-3 Playtest Checklist

Target: 2-3 testers, 5-10 hours each through Acts 2-3 and all 3 ending paths.

## Prerequisites

- Complete Act 1 through Lighthouse Mara core restoration and Spire of Vigil clear
- Have transit pass, arrive at Meridian City
- Recommended: level 8-10 with sol grid basics equipped

## Act 2 — The Contested Ring

### Meridian Hub (1-2 hours)

- [ ] Arrive at Meridian Station, talk to Station Master Calloway
- [ ] Navigate Meridian Civic Center — talk to Registrar Hollis, claim salvage yard
- [ ] Visit Salvage Yard — meet Neighbor Sera
- [ ] Visit Workshop District — meet Crafter Yun
- [ ] Explore Meridian Market, Archives, Residential (optional areas)
- [ ] Report to Councillor Asha Denn after Spire of Vigil findings
- [ ] **Pacing check**: Does Meridian feel like a hub or a chore? Too many fetch-quest steps?
- [ ] **Narrative check**: Is the political tension (Compact vs Council) communicated clearly?

### Greenway Operations (2-3 hours)

- [ ] Pass through Greenway Checkpoint (Bulwark occupation)
- [ ] Explore Greenway Farmstead — navigate to Settlement and Supply Depot
- [ ] Meet Elder Moss and Merchant Orin at Greenway Settlement
- [ ] Complete supply sabotage quest (deliver confiscated_supplies)
- [ ] Explore Greenway Biolab floors 1-4 (optional dungeon)
- [ ] **Balance check**: Bulwark conscripts/riflemen difficulty appropriate for Act 2 entry?
- [ ] **Soft-lock check**: Can you reach Spire of Winds approach ONLY after supply_sabotage_complete?
- [ ] **Pacing check**: Is the Greenway zone too long before reaching the Spire?

### Spire of Winds (3-4 hours)

- [ ] Enter Spire of Winds approach from Supply Depot
- [ ] Fight through Guardpost → Laboratory → Fortress
- [ ] **BOSS: General Thorne** — Phase 3 balance check (28-dmg projectiles + conscript summons)
  - Does the summon interval (10s) feel overwhelming?
  - Is the fight tedious or exciting?
- [ ] Clear Excavation → Shaft → Gallery → Bridge → Depths
- [ ] Enter Underlumen section — puzzle floors
- [ ] Complete Antechamber → Core activation
- [ ] Unlock Hover ability
- [ ] **Balance check**: Monster density across 11 Spire floors — any empty stretches or overwhelming rooms?
- [ ] **Puzzle check**: Are Underlumen puzzles intuitive? Any soft-locks in puzzle rooms?
- [ ] **Pacing check**: 11 floors — does it feel like a slog or well-paced?

## Act 3 — The Reckoning

### Dayside Entry (1-2 hours)

- [ ] Cross into Dayside Solar Fields from train station
- [ ] **Environmental hazard check**: Heat damage (6 dmg/1.5s) — punishing or manageable?
- [ ] Fight vent_spewers and magma_brutes in Solar Fields
- [ ] Complete Raid Defense side dungeon (hybrid drones + stalkers)
- [ ] **Balance check**: Act 3 enemy stat bump noticeable? (Act 2 tops at 16 dmg, Act 3 starts at 15-21 dmg)
- [ ] **Gear check**: Do players feel adequately equipped entering Dayside? Any weapon plateau?

### Array Complex (2-3 hours)

- [ ] Enter Array Extraction Outpost (requires kappa_coordinates_received flag)
- [ ] Enter Array Synthesis Lab (requires meridian_umbrasite_quest_complete flag)
- [ ] **Soft-lock check**: Are both flag gates achievable before entering Dayside?
- [ ] Reach Array Deep Processing
- [ ] **BOSS: Array Overseer** (650 HP, phases at 100%/50%/25%)
  - Phase 1: ranged at 22 dmg — manageable?
  - Phase 2: 25 dmg, faster projectiles — difficulty spike OK?
  - Phase 3: 27 dmg + summons array_sentinels — overwhelming?
  - Overall: fight pacing — too long/tanky? (650 HP is lower than Thorne's but ranged-only)
- [ ] **Evidence collection**: Can player find all 3 intel items for ending choice?
  - Network Topology Data (shutdown path)
  - Symbiosis Research (restore path)
  - Command Override Protocols (subsume path)

### Ending Path Choice

- [ ] Return to Meridian Civic — Asha presents three-path choice
- [ ] Verify all 3 paths are clearly explained before commitment
- [ ] **Narrative check**: Does the choice feel meaningful and informed by gameplay?

### Ending A — SHUTDOWN / Sever (array_control_center)

- [ ] Enter via chose_path_shutdown flag from Deep Processing
- [ ] Complete array_control_center dungeon
- [ ] Ending trigger fires: ending_shutdown_complete
- [ ] **Narrative check**: Multi-page ending text — satisfying payoff?
- [ ] **Pacing check**: Path length comparable to other endings?

### Ending B — CONTROL / Subsume (array_command_throne)

- [ ] Enter via chose_path_control flag from Deep Processing
- [ ] Complete array_command_throne dungeon
- [ ] Ending trigger fires: ending_control_complete
- [ ] **Narrative check**: Moral ambiguity comes through?
- [ ] **Pacing check**: Path length comparable to other endings?

### Ending C — MERGE (merge_nexus)

- [ ] Enter merge_nexus
- [ ] Talk to all 3 NPCs: asha_merge, sable_merge, meridian_7_merge
- [ ] Interact with communion tile at (12,11)
- [ ] Defeat Elder Sporecap boss
- [ ] Ending trigger fires: ending_merge_complete
- [ ] **Note**: Currently NPC conversations are NOT required before communion — verify this feels right or if it should be gated

### Spire of Radiance (3-4 hours)

- [ ] Enter from Deep Processing (requires array_overseer_defeated)
- [ ] Fight through: Approach → Perimeter → Processing → Nexus → Cooling → Conduit → Forge → Observatory → Sanctum → Threshold → Crucible → Core
- [ ] **BOSS: Solar Core Warden** (900 HP, 3 phases) in Spire Radiance Core
  - Phase 3 was retuned (28 dmg, 0.9s projectiles, slam 1.6x) — still the hardest boss
  - Is it fun-hard or frustrating-hard?
- [ ] **Forge hazard**: 6 dmg/1.8s heat + combat — too punishing without heat resist?
- [ ] Unlock Photonic Pulse ability
- [ ] Set spire_radiance_cleared flag
- [ ] **Pacing check**: 12 floors — longest Spire. Does it drag?
- [ ] **Balance check**: Radiance constructs (230 HP, 19 dmg) as regulars — appropriate for endgame?

## Cross-Cutting Concerns

### Balance

- [ ] **Weapon progression**: Is there a meaningful upgrade between Sol Unit (12 dmg) and epic sol units (14-18)? Players may feel stagnant through Act 2.
- [ ] **Ranged weapon cap**: Best ranged = Bulwark Combat Rifle (+8 dmg). Ranged builds fall behind by Act 3.
- [ ] **Bulwark Shock Baton**: Only Act 2 melee upgrade at 2.5% effective drop rate — did any tester find it?
- [ ] **HP scaling**: With sol grid HP mods + spire bonuses + medipacs — do players survive Act 3 bosses?
- [ ] **Healing economy**: Are field_medkits and bandages dropping frequently enough in Act 3?

### Narrative

- [ ] **NPC dialogue staleness**: 70/74 NPCs have only 1 dialogue set. Do key NPCs (Asha, Warden Holt, MERIDIAN-7) feel responsive to story progression?
- [ ] **Deep Array reveal**: When MERIDIAN-7 is compromised at end of Act 2 — does this land dramatically?
- [ ] **Faction clarity**: Can testers articulate what Compact, Council, Unbounded, and Deep Array want?
- [ ] **Lore accessibility**: Are storyboard themes (Light as Control, Cost of Infrastructure) visible in gameplay?

### Soft-Lock Risks

- [ ] **proc_quarantine nesting bug**: Main quest steps "find_warlord_key" and "open_supply_crate" reference procedural dungeon that has a known recursive nesting bug. This is an Act 1 blocker — testers must have this resolved or skip past it via flag grants.
- [ ] **spire_winds_cleared flag not checked**: Player can potentially skip Spire of Winds and still access Act 3. Verify if this is intentional.
- [ ] **One-way exits**: merge_nexus→array_deep_processing and underlumen_threshold→train_station are intentional one-ways. Testers should be aware.
- [ ] **Spire Radiance replay tier logic**: The `spire_radiance_replay_tier` flag condition may prevent hard/legendary reward triggers from firing on subsequent clears. Verify replay rewards work after first clear.

### Technical

- [ ] **Multiplayer**: Test with 2+ players in Act 2-3 dungeons simultaneously
- [ ] **Floor transitions**: All exits load correctly with proper spawn positions
- [ ] **Quest tracker**: Quest log updates at each main_quest step through Acts 2-3
- [ ] **Performance**: Any lag in larger dungeons (Solar Fields 30x30, Spire floors)?

## Tester Instructions

1. Start from a save/checkpoint after completing Act 1 (Spire of Vigil cleared)
2. Play naturally — don't rush, explore side content
3. Log playtime per zone (Meridian hub, Greenway, each Spire, Array, ending path)
4. Note any moment you felt lost, bored, frustrated, or confused
5. Play through at least one ending path completely; ideally test all three across testers
6. Report bugs, soft-locks, and crashes immediately
7. After completing, rate each zone 1-5 for: pacing, difficulty, narrative clarity, fun

## Known Issues for Testers

1. **proc_quarantine bug** — Act 1 procedural dungeon has recursive nesting. If encountered, use dev console to set flags: `talked_to_engineer`, `supply_crate_key`, `titanium_cylinders`, `received_sol_unit` to skip past it.
2. **General Thorne phase 3** — May be overtuned. Log if you wipe repeatedly.
3. **Spire Radiance Forge** — Heat + combat is brutal. Log if it feels unfair.
4. **NPC dialogue is mostly static** — Expected limitation; note if it breaks immersion at key story beats.
5. **dayside_raid_defense** — Recently populated with enemies. May need balance tuning.
6. **nightside_frost_crypt pedestal puzzle** — Had a scope mismatch bug preventing puzzle completion (fixed 2026-03-27). Verify both pedestals activate and central chamber opens correctly.
7. **Disconnected lore flags** — 10+ flags (found_refined_umbrasite, found_geometric_tablet, etc.) are set but never checked. No gameplay impact but lore pickups currently have no payoff.
