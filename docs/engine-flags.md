# Engine-Managed Flags Registry

This document lists all flags set **directly by engine code** (not through the trigger/condition/action scripting system). Content authors should treat these as read-only from the scripting layer — you can read them in conditions, but do not set or remove them via triggers, as the engine owns their lifecycle.

---

## Expedition Flags

Set on every party member when an expedition begins (`server/game-loop.js`). Cleared when the expedition ends (completion or abandonment).

| Flag | Type | Value | Description |
|------|------|-------|-------------|
| `expedition_active` | boolean | `true` | Player is currently in an expedition |
| `expedition_tier` | number | tier ID | Expedition difficulty tier |
| `expedition_floor` | number | floor number | Current floor (starts at 1, increments on descent) |
| `expedition_max_floors` | number | max floors | Total floors in this expedition |
| `expedition_template` | string | template ID | Dungeon template being used |
| `expedition_boss_type` | string | monster type | Boss monster type for this expedition |
| `expedition_boss_affixes` | array | affix IDs | Active affixes on the boss (only set if affixes exist) |
| `expedition_scaling` | number/object | scaling factor | Monster scaling applied for this expedition |
| `expedition_origin` | string | room ID | The room the expedition was launched from |
| `expedition_party` | array | player IDs | Party members sharing this expedition (only set if 2+ members) |
| `expedition_boss_killed` | boolean | `true` | The expedition boss has been killed |
| `expedition_checkpoint_depth` | number | depth | Depth at which a checkpoint was saved (removed on checkpoint exit) |
| `expedition_banked_loot` | array | item list | Items banked at a checkpoint (set via `bankLoot` action in `actions.js`) |

### Expedition Completion Flag (Permanent)

| Flag | Type | Value | Description |
|------|------|-------|-------------|
| `expedition_tier_${tier}_cleared` | boolean | `true` | Player has completed an expedition at this tier (persists after expedition ends) |

---

## Siege Flags

Set on every party member when a siege begins (`server/game-loop.js`). Cleared when the siege ends.

| Flag | Type | Value | Description |
|------|------|-------|-------------|
| `siege_active` | boolean | `true` | Player is currently in a siege |
| `siege_challenge` | string | challenge ID | Which siege challenge is active |
| `siege_room` | string | dungeon ID | The dungeon room used for this siege |
| `siege_party` | array | player IDs | Party members in the siege (only set if 2+ members) |

### Siege Cooldown Flags (Permanent, Dynamic Key)

| Flag Pattern | Type | Value | Description |
|---|---|---|---|
| `${challenge.cooldownFlag}` | number | timestamp | Unix timestamp of last siege completion; key comes from the challenge's `cooldownFlag` field in content |

---

## Interaction / Progression Flags

Set during specific game interactions (`server/index.js`).

| Flag | Type | Value | Trigger | Scope |
|------|------|-------|---------|-------|
| `damage_booster_equipped` | boolean | `true` | Player places a `damage_booster_chip` sol component on their grid | player + room |
| `has_traded_meridian` | boolean | `true` | Player completes a trade with a Meridian NPC | player + room |
| `automation_established` | boolean | `true` | Player has built 2 or more automation structures | player |
| `automation_level` | number | structure count | Updated whenever automation state is queried | player |

---

## Boss Intro Flags (Dynamic Key)

| Flag Pattern | Type | Value | Description |
|---|---|---|---|
| `boss_intro_seen_${mob.type}` | boolean | `true` | Set the first time a player enters a room containing a boss of this type. Used to gate intro cutscenes/messages. |

---

## Internal / Meta Flags

These flags are managed by the scripting engine itself and should never be read or written by content triggers.

| Flag Pattern | Type | Value | Description |
|---|---|---|---|
| `__trigger_${trigger.id}_fired` | boolean | `true` | Set by `trigger-registry.js` after a one-shot trigger fires. Prevents re-firing. |

---

## Notes for Content Authors

- **Reading engine flags in conditions**: All flags above can be used in `hasFlag` conditions inside dungeon triggers. Example: checking `expedition_active` to show expedition-only dialogue.
- **Do not set or remove**: Avoid using `setFlag`/`removeFlag` actions on any flag listed here. The engine resets expedition and siege flags on a fixed lifecycle — overwriting them mid-run will cause undefined behavior.
- **Cooldown flags**: The `cooldownFlag` key for each siege challenge is defined in the challenge content JSON. Use the scripting `hasFlag` + a comparison condition (if available) to gate re-entry.
- **Dynamic keys**: Flags with `${variable}` in the name are parameterized. The actual flag name in the store will have the variable substituted at runtime.

---

## Source Locations

| File | What it manages |
|------|----------------|
| `server/game-loop.js` | Expedition lifecycle, siege lifecycle, boss intro flags |
| `server/index.js` | Sol grid flags, Meridian trade flag, automation flags, expedition floor/checkpoint updates |
| `server/scripting/trigger-registry.js` | `__trigger_*_fired` internal flags |
| `server/scripting/actions.js` | `expedition_banked_loot` (set via `bankLoot` action) |
