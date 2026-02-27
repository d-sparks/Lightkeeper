Game
- Implement side quests, and a first side quest
- Add a concept of "tracked quests" that show you where to go. The main quest already does this, but we should be able to toggle to side quests. Also, for whichever quest is active, display the name of the next step somewhere on the screen. Finally, for the yellow arrow indicator, once the interaction target is on screen, can we have a yellow arrow pointing down at them from just above the item/NPC?
- Medipac should use medical supplies and have a much longer cooldown. Remove all the bandages and potions from the ground in the game, but add a resupply point near the quartermaster.
- Minimap looks fuzzy, can that be fixed to look sharper?
- When close to an NPC/interactable, and no monsters nearby, skill 1 should be interact
- Rendering depth/overlay issue
- Standing near an enemy should not automatically damage them.
- Did we add a charge level to the sol unit? If so we need to display the UI for that. If not add a charge level. Its abilities should all cost sol and the unit should not passively regenerate.
- I don't want the sol unit to replace your weapon but to compliment it. So, we can extend the equipemtn screen to have primary weapon, sol unit, medipac, accessory.
- The first sol unit attack should be a cone attack with knockback and AOE and 8 second cooldown.

Content
- Make some new sprites. The iso perspective is perfect on the sprites in sprites_isometric, can we just have some more flavors, taller walls, different colors, etc? Maybe a floor/wall/door combo for indoor outpost, indoor outpost quarantine, and outdoor/dark city?
- Add a melee weapon which is an alternative to the blaster. Compared to the blaster it should have higher damage, slight knockback. Instead of getting these from the engineer, the first quest step after Warden Holt should be to go to the quartermaster and pick melee or ranged, then you get the blaster. After that, unlock the room to the sol engineer. We can keep the door to the charger locked until after you get the sol unit.
- Add main quest 2: learn to use the sol unit. add a training room where you learn to use your sol unit. When you first get it, the sol unit shouldn't have a ton of energy, maybe 5%. The steps in the training room should require using the sol unit ability 2-3 times which drives your energy down to 2%, critically low. Then the next step is to go to the charging station and charge the unit. You learn that the generator that charges your sol unit is the most valuable piece of equipment at Outpost Balor, especially given the lighthouse outage. The only scalable ways to get power on the planet (which needs a name!) are solar and uranium mined off-planet. Solar energy all comes from the dayside, so your only options for power on the nightside are batteries and generators, both of which are expensive.

Editor
- Big feature: Should have a UI to create procedural dungeons.
- Big feature: Run the procedural creation algorithm to create a sample room, which can then be further edited in the editor to create curated content. 
