# Next TODOs

## Monster AI Follow-ups

- Add placeholder sprites for new monsters (shadow_ambusher, tunnel_creeper, feral_hound) — currently reusing existing sprites
- Add dungeon monsterSpawns entries using the new AI types (ambush, patrol, pack) in actual dungeon floors
- Consider adding a "reveal" visual effect on client when ambush monsters appear (e.g. fade-in animation)
- Monster projectiles (from ranged_kite) use a generic blue color on client — consider tinting them red or adding a distinct sprite
- The existing dungeon `patrol` field on monsterSpawns (e.g. "guard", "wander") is still unused by the engine — could be wired into the patrol AI to control behavior style
- Pack AI could be extended with a "pack leader" variant that buffs nearby pack members
