# CONTENT_001: Enriching Outpost Balor

## Overview

Before the player ever leaves Outpost Balor, the outpost itself should feel like a living place with history, tension, and things to discover. This phase enriches the existing hub with new NPCs, side quests, hidden areas, and lore — giving players reasons to explore thoroughly before venturing into the dark.

## Current State

Outpost Balor currently has: entrance, workshop, munitions, charging station, training range, perimeter. NPCs include Warden Holt, Guard Patel, Quartermaster Voss, Tech Maren, and several soldiers. The player retrieves titanium cylinders, gets a Sol Unit, and can head outside.

## New Areas

### Outpost Mess Hall (`outpost_mess_hall`)
- Accessible from the entrance or workshop corridor
- Social hub where off-duty personnel gather
- 3-4 NPCs with rotating dialogue based on story progression
- A notice board with bounty postings (sets up side quests for later areas)
- A locked supply closet (key found in perimeter, contains a rare modifier chip)

### Outpost Comms Room (`outpost_comms`)
- Small room off the main corridor with a damaged long-range radio
- NPC: **Comms Officer Daley** — trying to reach other outposts, getting only static and fragments
- Side quest: find replacement parts (a circuit board hidden in the crypt, a power cell in the perimeter) to partially restore comms
- Restoring comms unlocks fragmented transmissions from **Outpost Duskwall** (foreshadowing Act 1's broader Lighthouse crisis)
- Reward: Daley gives you a **Signal Booster** (modifier component, +range to adjacent abilities)

### Outpost Infirmary (`outpost_infirmary`)
- Accessible from mess hall
- NPC: **Dr. Lira Vasik** — overworked medic, cynical but caring
- Currently treating a wounded soldier (**Pvt. Tannis**) who was attacked on the perimeter
- Side quest: Tannis needs a specific fungal salve — the Old Keeper in the crypt knows where to find the ingredient (bioluminescent moss, harvestable in crypt_02 after talking to Old Keeper with the right flag)
- Reward: Dr. Vasik teaches you how to craft **Field Medkits** (better healing item, recipe unlocked)
- Tannis recovers and becomes a useful NPC later (gives intel about the dark perimeter before you go out)

### Outpost Lower Level (`outpost_basement`)
- Hidden staircase behind a movable crate in the workshop (toggled via trigger after finding a note)
- Old storage area, partially collapsed
- Contains: lore documents about Outpost Balor's founding (set up via readable notes/messages), an abandoned workbench with a **Cooldown Reducer Mk2** (better version of existing modifier), and signs that someone was living down here recently
- Environmental storytelling: sleeping bag, empty ration tins, scratched tally marks on the wall — someone was hiding here
- Flag-gated: a later NPC (in Meridian City) will reference this hideout, connecting the story threads

## New NPCs

### Mess Hall NPCs
- **Cook Brannigan** — Gruff, been at Balor for 12 years. Knows everyone's business. Has dialogue that changes based on quest progress. Side quest: he's been losing supplies — someone's been stealing rations. Investigating (checking flags across rooms) reveals it's going to the basement hideout.
- **Pvt. Osei** — New recruit, terrified of the dark. Asks the player naive questions about the Nightside that serve as lore delivery. After the player gets their Sol Unit, Osei's dialogue shifts to admiration/envy.
- **Surveyor Kade** — Civilian cartographer attached to the outpost. Has partial maps of the area between Balor and the train station. Talking to Kade before heading out sets a flag that reveals hidden paths in the perimeter/dark areas (CONTENT_002).

### Comms Officer Daley
- Dialogue tree that evolves as the comms quest progresses
- After restoration, periodically delivers "intercepted transmissions" that serve as story breadcrumbs
- Mentions hearing chatter from someone called "Sable" on an Unbounded frequency (foreshadowing)

### Dr. Lira Vasik
- Conditional dialogue based on player health when interacting (low health triggers different opening line)
- After Tannis quest, becomes a crafting unlock NPC (explains the medkit recipe, which is then available at any workbench)
- Has opinions about the Array's medical tech — distrusts it, prefers biological remedies (thematic setup for Ring vs Array tension)

## New Items

### Consumables
- **Field Medkit** — Restores 40 HP (crafted from medical supplies + bioluminescent moss). Unlocked via Dr. Vasik quest.
- **Ration Pack** — Restores 10 HP. Found in mess hall, cheap and common. Establishes food as a resource.

### Key Items
- **Circuit Board** — Found in crypt_01 (new hidden alcove). Used for comms restoration quest.
- **Backup Power Cell** — Found on the perimeter (guarded by a new monster spawn). Used for comms restoration quest.
- **Basement Note** — Found in workshop. Reads: "They won't find me down here. I just need to hold out until the next train." Triggers the basement access.
- **Bioluminescent Moss** — Harvestable in crypt_02 after Old Keeper tells you where to look. Used for medkit crafting.

### Sol Components
- **Signal Booster** — Modifier. +20% range to adjacent ability components. Reward from Daley's quest.
- **Cooldown Reducer Mk2** — Modifier. -25% cooldown to adjacent (upgrade from -15% version). Found in basement.

## New Monsters

### Perimeter Threats (minor additions)
- **Dusk Crawler** — Small, fast insectoid creature. HP: 15, Speed: 3.0, Damage: 4, Range: 1, AI: melee_chase. Appears in small packs (2-3) on the perimeter. Establishes that the dark is creeping closer. These are weak scouts — a taste of what's outside.

## Quest Lines

### Main Quest Enhancement: "Before You Go"
- After getting the Sol Unit, Warden Holt adds a new objective: "Talk to the people here. Learn what you can before heading out. The dark doesn't forgive ignorance."
- This soft-gates the player to explore the enriched outpost before leaving
- Specifically flags: talk to Surveyor Kade (map intel), talk to recovered Tannis (perimeter intel), check the notice board (bounties for CONTENT_002)

### Side Quest: "Broken Signal" (Comms Restoration)
1. Talk to Daley → learn about damaged comms
2. Find circuit board in crypt_01 (new trigger in existing dungeon)
3. Find power cell on perimeter (guarded encounter)
4. Return to Daley → comms partially restored
5. Reward: Signal Booster component + periodic story transmissions

### Side Quest: "The Wounded" (Tannis/Vasik)
1. Visit infirmary → meet Vasik and Tannis
2. Vasik says she needs bioluminescent moss for a salve
3. Talk to Old Keeper in crypt → he tells you where to find it (sets flag)
4. Collect moss in crypt_02 (spawns after flag is set)
5. Return to Vasik → Tannis recovers over time (flag-based)
6. Reward: Field Medkit recipe unlocked

### Side Quest: "Missing Rations" (Cook Brannigan)
1. Talk to Brannigan → he's been losing supplies
2. Investigate: check the mess hall storage (find scratch marks), check the workshop (find the note)
3. Access the basement → find the hideout
4. No one is there anymore, but you find a journal fragment mentioning "catching the train to Meridian"
5. Report to Brannigan → reward: 3x Ration Packs + his trust (unlocks additional dialogue later)
6. The mystery of who was hiding connects to an NPC you'll meet in Meridian City (CONTENT_003)

## Trigger & Scripting Notes

All of the above can be implemented purely with the existing TCA scripting system:
- `npc_interacted` events for quest progression
- `hasFlag` / `setFlag` for tracking quest states
- `spawnItem` for making moss/circuit board appear after conditions are met
- `showMessage` for lore delivery and story beats
- `toggleTile` for basement access
- `showChoice` for any dialogue branches
- `item_picked_up` for quest item collection triggers
- `removeEntity` / conditional NPC dialogue for world reactivity

## Thematic Goals

- Establish Outpost Balor as a place the player cares about and wants to protect
- Introduce the cast as people with lives, fears, and opinions — not just quest dispensers
- Plant seeds for later story threads (the basement fugitive, Sable's transmissions, Duskwall situation)
- Give the player meaningful progression (2 new sol components, medkit recipe) before leaving
- Create a sense of dread about what's outside through NPC dialogue and Tannis's wounds
