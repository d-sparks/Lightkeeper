# CONTENT_002: The Dark Perimeter & Route to the Train Station

## Overview

The player leaves Outpost Balor and crosses the dark perimeter — a dangerous no-man's-land between the outpost's fading light and the train station. This is the player's first real exposure to the Nightside environment: hostile creatures, failing infrastructure, and the oppressive dark. The journey should feel tense, rewarding to explore, and establish the environmental stakes of the world.

## Current State

The outpost perimeter exists as a single room. The train station exists but is minimally developed. There's no meaningful content between them. The player currently just walks from one to the other.

## New Areas

### Balor Perimeter Gate (`perimeter_gate`)
- Transition zone between the outpost's interior and the outside
- Heavy blast door that Warden Holt authorizes you to open (flag-gated: must have Sol Unit + talked to Kade)
- NPC: **Gate Sergeant Fenn** — last friendly face before the dark. Warns you about conditions outside, gives a **Flare** (single-use consumable) and tells you to "save it for when you really need it"
- One-way feeling: the gate closes behind you with a heavy clang (message trigger on `room_entered`)

### The Outer Ring (`perimeter_outer_ring`)
- The first truly dark area. Broken floodlights, crumbling concrete barriers, scattered debris
- Open layout with multiple paths — a direct route (dangerous, more monsters) and a side route (longer, but leads to a hidden cache)
- Monsters: Dusk Crawlers (packs of 3-4) and a new enemy, **Shade Stalkers** (ambush predators)
- Environmental detail: abandoned guard posts with lore notes about the perimeter's gradual retreat over the years ("Floodlight 7 failed again. We've pulled the line back 200 meters.")
- If player talked to Surveyor Kade (CONTENT_001), a flag reveals the side path on the minimap/via message

### Collapsed Relay Station (`relay_station`)
- Optional side area off the outer ring (the side path leads here)
- A small Lighthouse relay that failed years ago — now partially collapsed and overrun
- Contains: **Umbracite Shard** (valuable trade material), lore about the relay network, and a **Relay Log** key item
- Mini-puzzle: power needs to be rerouted to open a locked maintenance hatch (interact with two junction boxes in sequence — door_interacted triggers with flag dependencies)
- Guarded by a mini-boss: **Nest Mother** (a larger, tougher version of the Dusk Crawler that spawns adds)
- The Relay Log contains coordinates and notes from the last operator — mentions "something moving under the ground" (Underlumen foreshadowing)

### The Breach (`perimeter_breach`)
- A torn section of the old perimeter wall — the point where Nightside creatures have been getting through
- Atmospheric: wind sound, flickering emergency lights, claw marks on the walls
- This is where Pvt. Tannis was attacked (connecting to CONTENT_001 quest)
- Larger monster encounter: 2 Shade Stalkers + 4 Dusk Crawlers
- Finding Tannis's dropped **Dog Tags** here is optional — returning them to Tannis in the infirmary gets extra dialogue and a small reward

### The Dead Road (`dead_road`)
- Long corridor/road area between the breach and the train station
- Formerly a maintained supply road, now cracked and overgrown with dark-adapted vegetation
- Scattered wrecked supply vehicles (lootable — ration packs, bandages, occasional component)
- NPC encounter: **Sable** (first meeting)
  - Sable is crouched behind a wrecked vehicle, hiding from a Shade Stalker pack
  - Player can choose to help (fight the stalkers) or sneak past
  - If helped, Sable travels with you to the train station and provides crucial dialogue
  - If not helped, Sable appears later at the train station with injuries and is less trusting
  - This is a meaningful choice that affects later interactions

### The Old Watchtower (`old_watchtower`)
- Optional area, accessed via a ladder on the Dead Road
- A derelict observation post with a still-functional telescope/scope
- Using the scope triggers a `showMessage` describing what you see: the distant glow of Meridian City on the horizon, and far to the north, a Lighthouse beam flickering erratically
- Contains: **Night Vision Lens** (modifier component) and a **Watchtower Journal** with entries from a long-dead observer documenting the gradual encroachment of the dark over decades
- Emotional beat: the last entry is just "The light went out."

### Train Station Approach (`station_approach`)
- The area just before the train station — a cleared zone with emergency lighting that still works
- Feeling of relief after the dark areas
- A pair of dead Dusk Crawlers near the entrance — someone or something killed them recently
- Graffiti on the wall: Unbounded symbols (Sable can explain them if she's with you)

### Train Station — Expanded (`train_station`)
- Expand the existing train station with more content
- NPC: **Tech Yara** — station operator, keeps the automated train running. Exhausted, hasn't seen another person in weeks. Overjoyed to see the player (and Sable, if present)
- NPC: **MERIDIAN-7 Terminal** — Array trading interface. Can trade umbracite/silicon here. Has new dialogue about the route to Meridian City and the "efficiency of rail transport"
- A waiting area with benches, a vending machine (buy ration packs for silicon), and a departure board showing "NEXT TRAIN TO MERIDIAN CITY: DELAYED" that changes to "BOARDING" after quest conditions are met
- Side quest pickup: Yara asks you to check on a junction box outside (it's been making strange noises). Going to check it reveals a Dusk Crawler nest that needs clearing. Reward: Yara gives you a **Transit Pass** (required to board) and a tip about a merchant in Meridian City who buys relics
- The train itself: interacting with the platform after having the Transit Pass triggers the journey to Meridian City (CONTENT_003)

## New Monsters

### Shade Stalker
- HP: 45, Speed: 2.5, Damage: 10, Range: 1.5, AI: melee_chase
- Dark-adapted predator, the main threat in the perimeter
- Lore: evolved from nightside fauna that followed the darkness as it encroached
- Tougher than Dusk Crawlers, appears solo or in pairs
- Described in monster data with a note about their ambush behavior

### Nest Mother
- HP: 80, Speed: 1.5, Damage: 12, Range: 1.5, AI: melee_chase
- Mini-boss in the Relay Station
- Spawns 2 Dusk Crawlers when damaged below 50% HP (trigger: `monster_killed` won't work here — this would need a flag-based workaround or could just start with adds already spawned)
- Drops: **Chitin Plate** (crafting material for armor later) + Umbracite Shard access

### Shade Stalker Alpha
- HP: 60, Speed: 2.8, Damage: 14, Range: 1.5, AI: melee_chase
- Appears on the Dead Road if the player didn't help Sable (tougher encounter as consequence)
- Alternatively, appears as leader of the pack Sable is hiding from

## New Items

### Consumables
- **Flare** — Single-use. When used, spawns temporary light (could be flavored as clearing a room of weaker enemies or providing a brief safe zone). Mechanically: restores 15 HP (representing the comfort of light) or could deal AOE damage to nearby enemies. Given by Sgt. Fenn.

### Key Items
- **Relay Log** — Found in the Collapsed Relay Station. Lore item. Contains Underlumen foreshadowing. Can be shown to Comms Officer Daley back at Balor for additional dialogue.
- **Tannis's Dog Tags** — Found at the Breach. Returnable to Tannis for dialogue + a **Reinforced Battery Casing** (increases battery durability, minor equipment upgrade).
- **Watchtower Journal** — Found in the Old Watchtower. Lore item. The Old Keeper in the crypt reacts to it if shown to him.
- **Transit Pass** — Required to board the train. Obtained from Tech Yara after clearing the junction box nest.

### Sol Components
- **Night Vision Lens** — Modifier. +15% damage in dark-tagged rooms (establishes that some modifiers are situational/environmental). Found in the Old Watchtower.

### Materials
- **Chitin Plate** — Dropped by Nest Mother. Used for crafting in Meridian City (CONTENT_003/004). Establishes monster-part harvesting as a material source.

## Quest Lines

### Main Quest: "The Long Dark" (Reaching the Train Station)
1. Gate Sergeant Fenn opens the perimeter gate
2. Cross the Outer Ring (combat encounters)
3. Navigate the Breach
4. Travel the Dead Road → encounter Sable (choice moment)
5. Arrive at the Train Station
6. Complete Yara's junction box quest to earn Transit Pass
7. Board the train → transition to CONTENT_003

### Side Quest: "Relay Recovery" (Collapsed Relay Station)
1. Take the side path from the Outer Ring (requires Kade's intel flag from CONTENT_001)
2. Navigate the collapsed relay
3. Solve the junction box puzzle to access the maintenance hatch
4. Defeat the Nest Mother
5. Recover the Relay Log and Umbracite Shard
6. Optional: return Relay Log to Daley at Balor for extra lore

### Side Quest: "Tannis's Tags" (The Breach)
1. Find the Dog Tags at the Breach (item_picked_up trigger)
2. Return to Outpost Balor's infirmary
3. Give to Tannis → emotional dialogue about his squad, reward item
4. Small, personal quest that builds attachment to the outpost

### Encounter: "Sable in the Dark" (The Dead Road)
- Not a traditional quest, but a pivotal story moment
- Player choice (help vs. ignore Sable) tracked via flag
- Helping Sable: fight 3 Shade Stalkers, Sable joins you for the rest of the journey, provides dialogue about the Unbounded, the dark, and the world beyond the Lighthouses
- Ignoring Sable: easier immediate path, but Sable appears injured at the station, is less trusting, and the player misses critical lore dialogue

### Side Quest: "The Watchtower" (Old Watchtower)
1. Find and climb the watchtower
2. Use the scope → lore message about the world layout
3. Find the Night Vision Lens and Watchtower Journal
4. Optional: show journal to Old Keeper for unique dialogue about the old days

## NPC Details

### Sable (First Appearance)
- Peaceful Unbounded, sent to warn the Ring about something stirring in the deep Nightside
- Dialogue reveals: the Unbounded aren't all raiders, they have settlements with bioluminescent gardens, and something has been disturbing the deep dark lately
- If helped, Sable shares practical knowledge: which creatures to avoid, how to read the dark, what Unbounded trail markers mean
- Sable's trust level (flag: `sable_trust`) affects dialogue options in Meridian City (CONTENT_003) and beyond
- Sable does NOT board the train — says she has her own way to travel and will find you in the city. She slips into the dark and vanishes.

### Gate Sergeant Fenn
- 20-year veteran of perimeter duty
- Dialogue: pragmatic, slightly fatalistic ("Every year the dark gets a little closer. Every year we pull the line back a little more.")
- Gives the Flare and a brief tactical assessment of what's out there

### Tech Yara
- Station operator, alone for weeks
- Dialogue shifts from relief to pragmatic problem-solving (the junction box quest)
- Has opinions about MERIDIAN-7 ("It's polite enough, but I don't like how it watches the tracks")
- Knows the train schedule and Meridian City layout — provides travel tips

## Thematic Goals

- First real taste of danger and the Nightside's oppressive atmosphere
- Sable encounter is the first major story choice — establishes that player decisions matter
- Environmental storytelling through abandoned infrastructure, lore documents, and the gradual retreat of civilization
- The journey should feel earned — arriving at the train station is a relief
- Plant Underlumen seeds (Relay Log, watchtower observations, Sable's hints)
- Establish the material economy: umbracite and chitin as valuable resources from exploration
