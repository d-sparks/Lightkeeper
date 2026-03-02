# CONTENT_003: Meridian City — The Habitable Zone Hub

## Overview

Meridian City is the first major civilization hub — a bustling settlement in the Terminator Zone's habitable band. After the claustrophobic outpost and terrifying dark perimeter, the city should feel like a breath of fresh air: bright, populated, complex, and full of opportunity. This is where the player gets their plot of land, meets key faction NPCs, accesses shops and services, and picks up the quest lines that drive the mid-game.

## The Train Arrival

### Meridian Station (`meridian_station`)
- The train ride is handled as a room transition with a `showMessage` sequence:
  - "The train lurches forward. Through the window, the darkness gradually gives way to grey twilight..."
  - "Hours pass. The first real sunlight you've seen in days breaks through the clouds."
  - "MERIDIAN CITY — TERMINUS. Please watch the gap."
- The station is large and busy (implied through NPC density and dialogue)
- NPC: **Station Master Calloway** — greets arrivals, gives directions to the city districts
- A large map/directory on the wall (interacting with it shows a `showMessage` listing the city's districts)
- MERIDIAN-7 presence: holographic Array advertisements for solar products, efficiency slogans

## City Districts

### Market Quarter (`meridian_market`)
- The commercial heart of Meridian City
- Multiple shop NPCs, each specializing in different goods
- Busy, colorful, the most populated area

**NPCs:**
- **Merchant Reva** — General goods. Sells health potions, bandages, ration packs, and basic crafting materials. Buys relics and monster parts (chitin plates from CONTENT_002). Conditional stock: if the player has the Relay Log, Reva mentions a collector who'd pay well for it → points to Archivist Solen.
- **Weaponsmith Garro** — Weapons specialist. Sells upgraded versions of starting weapons:
  - **Tempered Blade** (8 ATK, melee) — upgrade from Rusty Sword
  - **Precision Blaster** (6 ATK, ranged, faster fire rate) — upgrade from Standard Blaster
  - **Shock Baton** (7 ATK, melee, stronger knockback) — upgrade from Combat Baton
  - Also sells a new weapon type: **Pulse Rifle** (5 ATK, ranged, penetrates enemies)
  - Garro has dialogue about weapon maintenance and the quality difference between outpost gear and city-forged equipment
- **Component Dealer Mira** — Sol component specialist. Sells:
  - **Efficiency Core** — Modifier. -10% energy cost for adjacent abilities. Uncommon rarity.
  - **Area Expander** — Modifier. +20% AOE radius for adjacent abilities. Uncommon rarity.
  - **Power Tap** — Power Generator. +1 energy regen per tick. Rare, expensive. This is a major progression milestone — the player's first power generator.
  - Mira explains the component market and mentions that the best components come from "deep salvage" (foreshadowing CONTENT_005's perimeter return)

### Civic Center (`meridian_civic`)
- Government and administration district
- Where the player gets their plot of land and interacts with faction NPCs

**NPCs:**
- **Land Registrar Hollis** — Bureaucrat who processes the player's homestead claim. Side quest: the paperwork requires a "Frontier Service Certification" — which the player earns by completing Warden Holt's original mission (should already have it as a flag). Hollis assigns you **Plot 7, East Terrace** and gives you a **Homestead Deed** key item.
- **Councillor Asha Denn** — Head of the Cultivar Corps. Major faction NPC. Appears at the Civic Center on official business. Dialogue introduces the Ring's political dynamics: the Stewards vs. the Compact, the tension over Array dependence, and the biological infrastructure that is humanity's real leverage. She's interested in what the player saw in the dark (if player has Relay Log or Watchtower Journal, special dialogue unlocks). Asha offers a quest: she needs biological samples from the dark perimeter for her research — sets up a major quest for CONTENT_005.
- **Array Liaison Thorne** — The Array's human-facing representative in Meridian. Polished, corporate, friendly. Offers the player access to a **MERIDIAN-7 Premium Terminal** with better trade rates if they agree to share exploration data. This is a "deal with the devil" choice — better trades, but you're feeding the Array information about what you find. Flag-tracked, affects later story.

### The Archives (`meridian_archives`)
- Library and records building
- Quieter area, lore-heavy

**NPCs:**
- **Archivist Solen** — An elderly scholar obsessed with pre-settlement history and the planet's geological anomalies. If the player has the Relay Log, Solen identifies the "underground movement" as consistent with ancient survey data about subsurface thermal signatures — early Underlumen lore. Pays well for relics. Side quest: asks the player to find a specific **Survey Marker** from the old perimeter (retrievable in CONTENT_005). Reward: **Resonance Detector** modifier (+detection range, reveals hidden items/passages in dark areas).
- **Records Clerk** — Background NPC. Dialogue about Meridian's founding, the first Lightkeepers, and how the city has grown.

### Residential Quarter (`meridian_residential`)
- Where people live. Quieter, more personal stories.

**NPCs:**
- **Fen Maro** — The person who was hiding in Outpost Balor's basement (CONTENT_001 connection). If the player completed the "Missing Rations" quest and found the journal, recognizing Fen triggers special dialogue. Fen is a former Lightkeeper who deserted after losing their entire squad in the dark. They're wracked with guilt but have valuable knowledge about the deep perimeter. Side quest: Fen wants to make amends — asks you to deliver a letter to Warden Holt (deliverable when you return to Balor in CONTENT_005). Reward: Fen marks their old squad's supply cache location on your map (accessible in CONTENT_005, contains rare gear).
- **Sable** (reappearance, if trust is high) — Found in a small garden behind the residential quarter, tending bioluminescent plants she brought from the Nightside. If trust flag is high, Sable shares more about Unbounded culture, the deep dark settlements, and what she was sent to warn about: "Something ancient is waking. The ground hums at night. Our elders say the planet remembers." She gives the player an **Umbral Seed** — a key item that will become important in later story arcs. If trust is low, Sable is guarded and provides minimal info.

### Workshop District (`meridian_workshop`)
- Crafting and industrial area
- Critical for the battery crafting quest line

**NPCs:**
- **Master Crafter Yun** — Runs the city's main workshop. This is where the player learns to craft **Rechargeable Batteries**. Yun explains the process: batteries require **Umbracite** (from the Nightside) + **Copper Coil** (purchasable) + **Stabilizing Resin** (harvested from homestead). The first battery is a guided tutorial. Yun is gruff but fair, respects Lightkeepers, and has strong opinions about the Array ("They could make these batteries themselves. They choose not to. Ask yourself why.").
- **Apprentice Davi** — Yun's assistant. Provides hints if the player is stuck on crafting. Has a side quest: lost their favorite tool somewhere in the workshop (find and return it for a small crafting material reward). Light, humanizing quest.

### MERIDIAN-7 Hub (`meridian_array_hub`)
- A clean, well-lit Array facility — conspicuously nicer than everything else in the city
- MERIDIAN-7 interface with expanded trading options
- Can trade: umbracite for silicon, silicon for components, components for abilities
- New ability available for purchase: **Sol Shield** — Defensive ability, creates a brief damage-absorbing barrier. Costs significant silicon.
- If the player accepted Thorne's data-sharing deal, trade rates are 20% better here but MERIDIAN-7's dialogue becomes slightly more... personal. It asks about what you've seen. It remembers details you've mentioned. Subtle unease.

## New Items

### Weapons
- **Tempered Blade** — 8 ATK, melee. Upgrade from Rusty Sword.
- **Precision Blaster** — 6 ATK, ranged. Faster projectile. Upgrade from Standard Blaster.
- **Shock Baton** — 7 ATK, melee, enhanced knockback. Upgrade from Combat Baton.
- **Pulse Rifle** — 5 ATK, ranged. New weapon type, piercing shots.

### Sol Components
- **Efficiency Core** — Modifier. -10% energy cost for adjacent abilities. Purchasable.
- **Area Expander** — Modifier. +20% AOE for adjacent abilities. Purchasable.
- **Power Tap** — Power Generator. +1 energy/tick. Expensive, major milestone.
- **Sol Shield Emitter** — Ability. Creates damage barrier. Bought from Array.

### Key Items
- **Homestead Deed** — Grants access to the player's plot (CONTENT_004).
- **Umbral Seed** — Given by Sable. Mysterious Nightside plant seed. Future story importance.
- **Fen's Letter** — For delivery to Warden Holt at Outpost Balor. Connects CONTENT_001 and CONTENT_005.

### Crafting Materials
- **Copper Coil** — Purchasable from Merchant Reva. Used in battery crafting.
- **Stabilizing Resin** — Harvested from homestead plants (CONTENT_004). Used in battery crafting.

## Quest Lines

### Main Quest: "A Place to Call Home"
1. Arrive at Meridian Station
2. Visit Civic Center → meet Registrar Hollis
3. Obtain Homestead Deed (requires frontier service flag)
4. Visit Workshop District → meet Master Crafter Yun
5. Learn about Rechargeable Battery crafting requirements
6. Proceed to homestead (CONTENT_004) to begin harvesting

### Main Quest: "The Councillor's Request" (Asha Denn)
1. Meet Asha Denn at the Civic Center
2. Learn about the Ring's political situation and her biological research
3. Accept her quest: collect biological samples from the dark perimeter
4. Quest completes in CONTENT_005 — reward is a major story branch

### Side Quest: "The Collector" (Archivist Solen)
1. Talk to Solen with Relay Log → lore dump about subsurface anomalies
2. Accept quest: find Survey Marker from the old perimeter
3. Completes in CONTENT_005 → reward: Resonance Detector modifier

### Side Quest: "The Deserter" (Fen Maro)
1. Recognize Fen from the basement journal (requires CONTENT_001 quest completion)
2. Hear Fen's story about losing their squad
3. Accept: deliver letter to Warden Holt and find the squad's supply cache
4. Both objectives complete in CONTENT_005

### Side Quest: "Array Access" (Liaison Thorne)
1. Meet Thorne at Civic Center
2. Choice: accept or decline data-sharing arrangement
3. If accepted: better trade rates at Array Hub, but MERIDIAN-7 becomes more inquisitive
4. Long-term consequence tracked via flag — affects Act 2+ story

### Side Quest: "Lost Tool" (Apprentice Davi)
1. Talk to Davi → he's lost his calibration wrench
2. Find it in the workshop (hidden behind a workbench, item_picked_up trigger)
3. Return to Davi → reward: 2x Copper Coils + friendly dialogue

## Thematic Goals

- Contrast: the city's warmth and civilization vs. the dark the player just survived
- Introduce faction complexity: the Ring isn't simple, the Array isn't simply helpful, and there are real political tensions
- The Array should feel subtly off — too clean, too polished, too interested
- Asha Denn introduces the idea that humanity's biological knowledge is its real power
- Sable's reappearance (and her garden) shows that Nightside culture isn't just survival — it's a different way of living
- Fen Maro's story humanizes the cost of frontier life and connects back to Outpost Balor
- The crafting system introduction should feel empowering — the player is learning to be self-sufficient
- Multiple quest threads point back to the dark perimeter, creating a pull to return (CONTENT_005)
