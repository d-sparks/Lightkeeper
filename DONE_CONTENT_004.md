# CONTENT_004: The Homestead — Harvesting, Crafting & Habitable Zone Life

## Overview

The player's homestead is a small plot of land in Meridian City's east terrace — their first permanent foothold in the habitable zone. This phase focuses on the crafting loop: growing stabilizing resin plants, harvesting materials, and crafting rechargeable batteries at Yun's workshop. But the homestead also serves as a personal base, a place to experiment with the Umbral Seed, and a source of side content that enriches the player's connection to Meridian City before they return to the dark.

## The Homestead

### Homestead Plot (`homestead_plot`)
- A modest outdoor area with a small shelter, a garden bed, and a workbench
- Accessible after receiving the Homestead Deed from Registrar Hollis (CONTENT_003)
- First visit triggers a `showMessage`: "Plot 7, East Terrace. It's not much — a patch of soil, a lean-to, and a view of the twilight line. But it's yours."
- The garden has 3 planting spots (represented as interactable tiles)
- NPC: **Neighbor Sera** — Lives on the adjacent plot. Friendly, experienced gardener. Provides tutorial dialogue about growing plants in the Terminator Zone.

### Homestead Interior (`homestead_interior`)
- Small shelter attached to the plot
- Storage (implied — the player's inventory persists, but this is the narrative "home")
- A small desk with a **Personal Log** — interacting with it shows a summary of completed quests and collected lore (delivered via `showMessage` listing key flags)
- If the player has the Umbral Seed from Sable, they can plant it here in a special indoor pot (separate from garden beds). It doesn't grow immediately — it requires a "dark cycle" (returning from the perimeter in CONTENT_005 triggers growth)

## The Harvesting Loop

### Growing Stabilizing Resin
The core resource loop for battery crafting:

1. **Acquire Seeds** — **Resin Bush Seeds** are purchased from Neighbor Sera (2 silicon each) or from Merchant Reva in the market
2. **Plant Seeds** — Interact with an empty garden tile → `showChoice` to plant. Uses `setFlag` to track planting state per plot (e.g., `garden_slot_1: planted`)
3. **Wait for Growth** — Plants grow after the player completes certain activities (not real-time — growth is gated by flag milestones like completing a quest, visiting a new area, or defeating X enemies). This prevents boring waiting while ensuring the loop has pacing.
4. **Harvest** — When growth flag is set, interact with garden tile → receive **Stabilizing Resin** (1-2 per plant) + seed returns to soil (auto-replant mechanic via flag reset)

### Growth Milestones
Rather than a timer, plants mature when the player does things:
- First planting → matures after the player visits the Archives or completes any Meridian side quest
- Second cycle → matures after the player returns from any non-city area
- This keeps the player engaged in the world rather than idling

### Neighbor Sera's Expertise
- Sera provides gardening dialogue that doubles as world-building: "The soil here is good — not too hot, not too cold. That's the whole point of the Ring, isn't it?"
- Side quest: **"Pest Problem"** — Sera's crops are being eaten by **Garden Mites** (tiny, non-combat nuisance). She needs a **Sonic Repeller** to drive them off. The repeller can be purchased from Component Dealer Mira in the market (costs silicon) or crafted at Yun's workshop from spare parts. Reward: Sera gives you **Enriched Soil** — doubles resin yield from one harvest (single-use consumable applied to a garden slot).

## Battery Crafting

### The Crafting Process
At Master Crafter Yun's Workshop (`meridian_workshop`):

1. Interact with Yun with required materials in inventory:
   - 1x **Umbracite** (from Nightside exploration)
   - 2x **Copper Coil** (purchased in Meridian)
   - 2x **Stabilizing Resin** (harvested from homestead)
2. `showChoice` trigger: "Craft Rechargeable Battery?"
3. On confirmation: `removeItem` for all materials, `giveItem` for **Rechargeable Battery L1**
4. `showMessage` from Yun: "There she is. Holds a charge, releases it clean. Better than those disposable cells you've been burning through."

### Battery Tiers
- **Rechargeable Battery L1** — Base tier. Restores 30 energy when used. Can be recharged at any charging station for free (unlike disposable batteries that cost silicon).
- Future tiers (L2, L3) require rarer materials from deeper Nightside areas (CONTENT_005 and beyond)
- The rechargeable aspect is the key advantage: they never run out, just need recharging. This makes the player energy-independent for basic operations.

### First Battery Celebration
- Crafting the first battery triggers a `showMessage` sequence and sets a milestone flag
- Yun's dialogue changes: "You're self-sufficient now. That's rare. Most Lightkeepers burn through cells and come begging for more."
- This flag also triggers growth of any planted gardens (part of the growth milestone system)

## New Items

### Crafting Materials
- **Resin Bush Seeds** — Purchased from Sera or Reva. Planted in garden.
- **Stabilizing Resin** — Harvested from mature resin bushes. Core crafting ingredient.
- **Enriched Soil** — Single-use. Doubles resin yield from one harvest. Reward from Sera's quest.
- **Sonic Repeller** — Crafted or purchased. Used for Sera's pest quest.

### Equipment
- **Rechargeable Battery L1** — Restores 30 energy. Rechargeable at any charging station. Key progression item.

### Key Items
- **Resin Growing Guide** — Given by Sera on first meeting. Lore item explaining Terminator Zone agriculture. Readable via `showMessage`.

## Side Quests

### Side Quest: "Pest Problem" (Neighbor Sera)
1. Talk to Sera after planting first seeds → she mentions mites
2. Acquire Sonic Repeller (buy from Mira OR craft at Yun's with 1 copper coil + 1 silicon)
3. Give to Sera → pests cleared
4. Reward: Enriched Soil + Sera's expanded dialogue about the terrace community

### Side Quest: "Yun's Challenge" (Master Crafter Yun)
1. After crafting first battery, Yun is impressed
2. He challenges you: "You've got steady hands. Let's see if you can handle something harder."
3. Craft a **Modified Battery Casing** using: 1x Chitin Plate (from Nest Mother, CONTENT_002) + 1x Copper Coil
4. The Modified Battery Casing is a key item that Yun uses to upgrade your Sol Unit's battery slot: +20 max energy capacity
5. Reward: **Sol Unit Upgrade — Extended Capacity** (permanent +20 max energy)
6. Yun's respect increases — unlocks his dialogue about the Array: "They could teach anyone to make these. They don't. They want you dependent."

### Side Quest: "The Seed Speaks" (Umbral Seed)
1. If the player has the Umbral Seed from Sable (CONTENT_003), they can plant it in the homestead interior
2. The seed doesn't grow immediately — just sits in its pot, inert
3. Talking to Sable (if she's in Meridian, CONTENT_003) about the planted seed: "It needs darkness to grow. Real darkness, not just shade. When you go back out there, bring it with you for a night. Then replant it."
4. This sets up a quest that resolves in CONTENT_005: the player must carry the seed into the dark perimeter and return it to the homestead
5. After the dark exposure, the seed grows into a **Gloomvine** — a bioluminescent plant that produces **Umbral Extract** (rare crafting material for advanced components)
6. This quest thread connects Sable's trust, homestead development, and Nightside exploration into a single narrative line

### Side Quest: "Community Board" (Notice Board at Homestead)
- A community notice board near the homestead has postings from other terrace residents
- **Posting 1: "Lost Cat"** — Resident Vell has lost their cat. The cat is actually in the Archives (Solen's been feeding it). Find it and tell Vell. Reward: 2x Ration Packs. Light, humanizing quest.
- **Posting 2: "Terrace Watch Volunteer"** — The terrace neighborhood wants a volunteer for the nightly watch rotation. Accepting sets a flag that gives the player a one-time ambush encounter when returning to the homestead later (2 Garden Mites, trivially easy) and a reward of 3x silicon from the grateful neighbors.
- These are intentionally small and mundane — they make the city feel like a real place with real people.

## New NPCs

### Neighbor Sera
- Middle-aged gardener, warm and practical
- Has lived on the terrace for 15 years, knows everyone
- Dialogue reveals details about habitable zone life: the growing seasons (twilight has its own rhythms), what grows best, how the community shares surplus
- After the pest quest, she becomes a reliable source of gardening tips and seeds
- Her husband was a Lightkeeper who retired after an injury — she understands the player's life

### Terrace Residents (Background)
- **Vell** — Cat owner. Elderly, lonely. Talks about the old days when the terrace was farmland.
- **Jorrit** — Young mechanic. Maintains the terrace's water system. Mentions that the Array offered to automate it, and the terrace voted no.
- These NPCs have 1-2 dialogue lines each. They exist to populate the space and make it feel lived-in.

## Integration with Other Content

### Returning to Outpost Balor (CONTENT_005 Setup)
By the end of this phase, the player should have:
- At least one Rechargeable Battery (main quest objective)
- A homestead with growing plants (ongoing resource production)
- Multiple quest threads pointing back to the dark perimeter:
  - Asha Denn's biological sample request (CONTENT_003)
  - Archivist Solen's Survey Marker request (CONTENT_003)
  - Fen Maro's letter for Warden Holt (CONTENT_003)
  - The Umbral Seed needing dark exposure (this content)
  - Fen's supply cache location (CONTENT_003)
- Upgraded gear from Meridian shops
- New sol components enhancing their grid
- A reason to come back: the homestead, the people, the garden

### The Return Journey
- When the player is ready to leave, they take the train back to the train station near Balor
- Tech Yara greets them: "You came back? Most people don't come back."
- The return train ride has a different tone — the player knows what's out there now
- Sable may appear at the station with guidance for the perimeter journey

## Thematic Goals

- The homestead is about roots — the player is building something worth protecting
- The crafting loop should feel satisfying: you explored the dark, brought back materials, grew plants, and now you can sustain yourself
- Rechargeable batteries represent self-sufficiency — freedom from the Array's energy economy
- Yun's dialogue about Array dependency is pointed: why doesn't the Array share this knowledge?
- The mundane side quests (lost cat, pest control, terrace watch) ground the world in normalcy
- The Umbral Seed quest connects the domestic and the wild — the player is literally bringing darkness home to make something grow
- By the time the player leaves, they should feel a pull in two directions: the safety of Meridian and the call of the dark
