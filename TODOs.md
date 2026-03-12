# TODOs

Prioritized task list — last refreshed 2026-03-12.

Organized by impact: what connects the most disconnected pieces, unblocks the most players, and moves closest to a finished game.

---

## Testing & Stability

- [ ] **Fix headless sim bot combat in proc_quarantine.** The bot gets stuck at proc_quarantine depth 1 — it pathfinds toward monsters but never engages combat, oscillating in place indefinitely. This blocks `--all-quests` runs and leaves side quest coverage untested. Root cause: bot has a path but can't advance node 0 because monsters physically block the tile; combat mode never activates because the bot's "move_to_position" goal doesn't yield to fighting. ~15% of mainline runs also fail here.

- [ ] **Fix nightside caverns rendering.** The room renders as entirely inside a wall — players and enemies are invisible, and there's no apparent way to navigate or exit. Possibly a tileset/height mismatch or the map data is filled with solid tiles where it should be floor.

- [ ] **Fix flare item.** Placing a flare gives an "undefined" item in inventory that can't be used. The return-to-flare consumable should be a usable item named "Return to Flare" that teleports the player back to the flare position.

---

## Game Quality & Player Experience

- [ ] **Quest log UX overhaul.** For quests with many steps, only show 3 rows: (1) a collapsed "..." row for older completed steps (expandable on click), (2) the most recent completed step with strikethrough, (3) the current active step. Currently all steps are shown, making the log unusable for the 23-step main quest.

- [ ] **Side quest guidance.** Every quest item pickup should show a clear next-step hint. Audit all quest items and ensure `item_picked_up` triggers include a `showMessage` with who to talk to or where to go. Several items (e.g. scorched notebook) leave the player with no direction.

- [ ] **Level-up stat screen.** When the player levels up, show a stat summary screen displaying the improvements: HP increase, damage bonus, energy changes, etc. Currently there's no feedback beyond the level-up notification.

- [ ] **Multiplayer chat reliability.** Messages disappear or don't show for all players. Audit the chat message flow to ensure all messages appear and persist for the duration they should.

---

## Content — Connecting the Story Campaign

The storyboard defines a 30-40 hour three-act campaign. The engine and endgame systems are deep, but the narrative dungeons that get players there are largely unbuilt. **No Spire dungeons, no Lighthouse Mara, no Greenway zones exist yet.** These are the critical missing links.

- [ ] **Build Lighthouse Mara dungeon.** Core Act 1 beat (storyboard: "Lighthouse Mara, 2-3 hours"). Multi-floor dungeon through frozen caverns to a failing Lighthouse. The damage should look structural, not raider-caused — breadcrumb for the Spire/Deep Array reveal. Use frost_crypt tileset and nightside monsters. Include environmental storytelling about unusual geological readings (survey marker reference). This is the first "real expedition" that teaches players the exploration loop.

- [ ] **Build Spire of Vigil — outer layer (raider stronghold).** Act 1 climax. Luddite fortifications, traps, raider captain mini-bosses. Introduce Dural Voss as a named boss with a retreat mechanic (he flees at low HP rather than dying, shouting "We didn't touch your Lighthouses"). Use quarantine/nightside tileset. 2-3 floors of combat-focused content. This gives Act 1 its dramatic climax and its primary antagonist a face.

- [ ] **Build Spire of Vigil — inner layer (ancient core).** Underlumen architecture, puzzle rooms testing spatial awareness (place light sources to hold zones). The player's sol unit resonates with the core and permanently unlocks **Light Sentry**. This is the first Spire ability unlock — wire it into the sol grid system. Include sensor logs showing Array energy signatures (the key reveal that something else activated this Spire).

- [ ] **Build Greenway corridor dungeons.** Act 2 setting. Agricultural zones, cultivated landscapes, farming settlements under Bulwark martial law. 2-3 dungeons connecting Meridian to the Monument of Winds. New tileset needed (or adapt meridian). Include civilian NPCs caught between military occupation and daily life, reconnaissance missions, and supply line disruption side content. This makes the Act 2 political crisis feel real instead of purely dialogue-driven.

- [ ] **Build Spire of Winds (Monument of Winds).** Act 2 climax. Outer layer: Bulwark military fortress with Compact soldiers and mechanized defenses. Inner layer: vertical architecture with shafts, bridges, and wind current puzzles. Unlocks **Hover** ability. Include the Act 2 revelation: when the core activates, Array support systems begin scanning autonomously — the Deep Array reveals itself. This is the narrative turning point of the entire game.

---

## Progression & Economy

- [ ] **Distribute crafting materials across biome loot tables.** Currently crafting materials (metal_casing, metal_linker, power_conduit, stabilizer_rod, focusing_lens, plasma_coil) only drop from common.json monsters. Add biome-appropriate crafting drops to frost.json, fungal.json, geothermal.json, nightside.json, and array.json so players find materials throughout the game, not just in early zones.

- [ ] **Wire Spire ability unlocks into progression.** Light Sentry should unlock from Spire of Vigil completion, Hover from Spire of Winds, Photonic Pulse from Spire of Radiance. Currently abilities are acquired through MERIDIAN-7 trades — keep those as alternates but make Spire completions the primary unlock path per the storyboard.

- [ ] **Weapon upgrade confirmation dialog.** The disassemble button fires immediately with no confirmation. Add a choice menu to prevent accidental weapon destruction. Small fix, big quality-of-life improvement.

---

## Art & Audio

- [ ] **Replace top-priority placeholder sprites.** All 62 sprites are procedurally generated placeholders. Priority replacements: player character (most-seen entity), Warden Holt, Sable, MERIDIAN-7 terminal, sol unit item, health potion. Even 6-8 hand-drawn sprites would dramatically improve first impressions. Follow docs/art-style-guide.md palette and conventions.

- [ ] **Compose real music for key moments.** The procedural synthesis tracks work as ambient background but lack emotional weight. Priority: outpost theme (player's home base), boss encounter theme, Spire interior theme, and the Meridian city theme. Even simple compositions would add enormous atmosphere.

---

## Long-Term

- [ ] **Build Spire of Radiance + Deep Array climax.** Act 3 climax. The Dayside Spire encased in Array infrastructure. Array-organic hybrid enemies, energy management puzzles, Photonic Pulse unlock. Final confrontation with the Deep Array network — the three-path choice (Sever/Restore/Subsume) with mechanically distinct endings. This completes the campaign.

- [ ] **Multiplayer quarantine wing bug.** Two players can't be in the quarantine wing simultaneously — one gets locked. Investigate whether it's a proc generation conflict (same seed?) or a room state issue with shared proc dungeon instances.

- [ ] **Deep Expedition (Tier 6) cooperative content.** 3-4 players, 7 floors, no checkpoints. Abyssal sovereign boss requiring coordination mechanics. This is the apex endgame challenge referenced in the endgame loop design.
