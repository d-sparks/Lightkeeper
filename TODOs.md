Fix conflicts

Fixes March 5 2026
- Disable click on screen to move on mobile, it interferes with the joystick.
- We aren't seeing cooldown info on mobile, can those be on the buttons just like on web?
- After teleport, or when first entering a room, sometimes the previous "click to move" (x, y) is in effect. We should clear that so we don't get unintended movement.
- Going from Meridian station to Meridian civic isn't smooth, it dumps us in a random place in the room. Make sure the doorways connect in a realistic way. (Take a look to see if this is happening in other places, too, and fix those if possible.)
- Create sub folders in the isometric sprites folder, and put in each one two files: one is a copy of our main ground tile shape, and the second is a prompt that describes the theme of that sub folder in great detail. Then attach to each room/dungeon a field in its JSON simply saying which theme it should eventually have. Later we'll use an AI to generate ISO sprites for that theme, and use them as the graphics in those rooms/dungeons.

Experimental
- Run the headless sim and, if it gets stuck, either fix the headless sim or fix the game to make further progress in the headless sim.
- Run the headless sim and, if it gets stuck, either fix the headless sim or fix the game to make further progress in the headless sim.
