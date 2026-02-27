Fix conflicts
- ralph/add-a-melee-weapon-which-is-an-alternative-to-the 
- ralph/big-feature-run-the-procedural-creation-algorithm 
- ralph/big-feature-should-have-a-ui-to-create-procedural 
- ralph/i-dont-want-the-sol-unit-to-replace-your-weapon-bu
- ralph/implement-side-quests-and-a-first-side-quest      
- ralph/make-some-new-sprites-the-iso-perspective-is-perfe

Dev
- On the checkpoint screen, I'd like to add a way to jump to any quest. Can we add a quest dropdown and go to quest which (1) sets any necessary flags to enable that quest and (2) puts the selected player into the room to proceed with the first quest item of that quest?
- I want to be able to visualize the quest chain in the checkpoints endpoint. It is supposed to be a dag, what's a good way to visualize the progression? This can be at the very bottom of the checkpoint page.
- We need to have a way to edit flags and view flags in the dev settings. This could be on the checkpoint screen as well. Do we already have that? If not please add it, if so, please make the UI on the checkpoints page.


Game
- Rendering depth/overlay issue was fixed for NPCs in the last couple of days. But this should also apply to NPCs, enemies, items.
- Seeing error "Uncaught Error: Texture Error: frame does not fit inside the base Texture dimensions: X: 160 + 16 = 176 > 160 or Y: 0 + 16 = 16 > 16 at set frame (pixi.min.js:381:17434) at new B (pixi.min.js:381:13882) at Renderer._buildTileTextures (renderer.js:188:31) at Renderer.setMap (renderer.js:703:10) at main.js:860:14 at ws.onmessage (net.js:31:20)"


New worlds
- How can we implement lighting that looks good and conveys the light/dark theme of the game? Let's add a section outside of outpost balor that is very dark, and can only be navigated properly / safely once you get the sol unit.
- Let's start the automation world/zone on the dayside. Currently no way to get there besides dev checkpoints, but, over there we should meet Meridian-7 and be able to place our first solar panel, and recharge our sol unit. Create a comprehensive plan and implement the automation system with menus, playable on mobile desktop or with controller, with an eye towards extensibility and engaging automation loops a la stardew/factario, with our dayside AI theme in mind.
