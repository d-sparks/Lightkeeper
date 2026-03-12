#!/usr/bin/env python3
"""Audit setFlag/hasFlag usage across all JSON content files."""
import json, os
from pathlib import Path

set_flags = {}   # flag -> [locations]
check_flags = {} # flag -> [locations]

def walk_condition(cond, filepath):
    """Recursively walk a condition object to find hasFlag uses."""
    if not isinstance(cond, dict):
        return
    # { "hasFlag": "flag_name" } or { "hasFlag": "flag_name", "value": N }
    if 'hasFlag' in cond:
        flag = cond['hasFlag']
        if isinstance(flag, str):
            check_flags.setdefault(flag, []).append(filepath)
    # { "flagGreaterThan": { "flag": "flag_name", "value": N } }
    if 'flagGreaterThan' in cond:
        inner = cond['flagGreaterThan']
        if isinstance(inner, dict) and 'flag' in inner:
            check_flags.setdefault(inner['flag'], []).append(filepath)
    # { "flagLessThan": { "flag": "flag_name", "value": N } }
    if 'flagLessThan' in cond:
        inner = cond['flagLessThan']
        if isinstance(inner, dict) and 'flag' in inner:
            check_flags.setdefault(inner['flag'], []).append(filepath)
    # { "not": { ... } }
    if 'not' in cond:
        walk_condition(cond['not'], filepath)
    # { "and": [...] }
    if 'and' in cond:
        for c in (cond['and'] if isinstance(cond['and'], list) else [cond['and']]):
            walk_condition(c, filepath)
    # { "or": [...] }
    if 'or' in cond:
        for c in (cond['or'] if isinstance(cond['or'], list) else [cond['or']]):
            walk_condition(c, filepath)
    # Old-style { "type": "hasFlag", "flag": "flag_name" }
    if cond.get('type') == 'hasFlag' and 'flag' in cond:
        check_flags.setdefault(cond['flag'], []).append(filepath)

def walk_conditions(conds, filepath):
    if not conds:
        return
    if isinstance(conds, dict):
        conds = [conds]
    for c in conds:
        walk_condition(c, filepath)

def walk_action(action, filepath):
    if not isinstance(action, dict):
        return
    # { "type": "setFlag" | "incrementFlag" | "removeFlag", "flag": "flag_name" }
    if action.get('type') in ('setFlag', 'incrementFlag', 'removeFlag') and 'flag' in action:
        set_flags.setdefault(action['flag'], []).append(filepath)
    # nested actions
    for key in ['actions', 'then', 'else']:
        if key in action:
            sub = action[key]
            walk_actions(sub if isinstance(sub, list) else [sub], filepath)

def walk_actions(actions, filepath):
    if not actions:
        return
    if isinstance(actions, dict):
        actions = [actions]
    for a in actions:
        walk_action(a, filepath)

def walk_triggers(triggers, filepath):
    if not isinstance(triggers, list):
        return
    for t in triggers:
        if not isinstance(t, dict):
            continue
        walk_conditions(t.get('conditions', []), filepath)
        walk_actions(t.get('actions', []), filepath)

def scan_npc_dialogue(npc_id, dialogue_list, filepath):
    if not isinstance(dialogue_list, list):
        return
    loc = f"{filepath}:npc:{npc_id}"
    for line in dialogue_list:
        if not isinstance(line, dict):
            continue
        conds = line.get('conditions', [])
        walk_conditions(conds if isinstance(conds, list) else [conds], loc)
        walk_triggers(line.get('triggers', []), loc)

def scan_file(filepath):
    try:
        data = json.loads(Path(filepath).read_text())
    except Exception:
        return

    short = filepath.replace(str(content_root) + '/', '')

    # dungeon rooms with triggers
    if 'rooms' in data:
        rooms = data['rooms']
        items = rooms.items() if isinstance(rooms, dict) else enumerate(rooms)
        for room_id, room in items:
            if not isinstance(room, dict):
                continue
            loc = f"{short}:{room_id}"
            walk_triggers(room.get('triggers', []), loc)
            # NPC dialogue in rooms
            for npc in room.get('npcs', []):
                if isinstance(npc, dict):
                    scan_npc_dialogue(npc.get('npcType', '?'), npc.get('dialogue', []), loc)

    # top-level triggers
    walk_triggers(data.get('triggers', []), short)

    # top-level NPC entity definitions (e.g. content/entities/npcs.json)
    # Format: { npc_id: { dialogueRules: [...], dialogues: {...} } }
    # Detect by checking if values are dicts with dialogueRules or dialogues keys
    if not any(k in data for k in ['rooms', 'triggers', 'steps', 'stages', 'tiles', 'id', 'npcs']):
        for npc_id, npc_data in data.items():
            if not isinstance(npc_data, dict):
                continue
            if 'dialogueRules' in npc_data or 'dialogues' in npc_data:
                loc = f"{short}:{npc_id}"
                for rule in npc_data.get('dialogueRules', []):
                    if isinstance(rule, dict):
                        walk_conditions(rule.get('conditions', []), loc + ':dialogueRules')
                scan_npc_dialogue(npc_id, npc_data.get('dialogue', []), loc)

    # top-level NPCs list (entities/npcs.json embedded in dungeon/other format)
    if 'npcs' in data:
        npcs = data['npcs']
        if isinstance(npcs, dict):
            for npc_id, npc_data in npcs.items():
                if isinstance(npc_data, dict):
                    scan_npc_dialogue(npc_id, npc_data.get('dialogue', []), short)
        elif isinstance(npcs, list):
            for npc_data in npcs:
                if isinstance(npc_data, dict):
                    scan_npc_dialogue(npc_data.get('id', '?'), npc_data.get('dialogue', []), short)

    # quest steps (completionConditions with { "hasFlag": "..." })
    # steps can be a dict keyed by step id, or a list
    steps_raw = data.get('steps', {})
    if isinstance(steps_raw, dict):
        steps_items = steps_raw.items()
    else:
        steps_items = [(s.get('id', '?'), s) for s in steps_raw if isinstance(s, dict)]
    for step_id, step in steps_items:
        if not isinstance(step, dict):
            continue
        step_loc = f"{short}:step:{step_id}"
        walk_conditions(step.get('completionConditions', []), step_loc)
        walk_triggers(step.get('triggers', []), step_loc)

    # quest/expedition start/unlock conditions (top-level)
    for cond_key in ['startConditions', 'unlockCondition', 'unlockConditions']:
        cond_val = data.get(cond_key)
        if cond_val is not None:
            walk_conditions(cond_val if isinstance(cond_val, list) else [cond_val], f"{short}:{cond_key}")

    # quest stages (older format)
    for stage in data.get('stages', []):
        if not isinstance(stage, dict):
            continue
        stage_loc = f"{short}:stage:{stage.get('id', '?')}"
        walk_triggers(stage.get('triggers', []), stage_loc)
        conds = stage.get('conditions', [])
        walk_conditions(conds if isinstance(conds, list) else [conds], stage_loc)

    # tileset tile definitions with conditions
    # tiles can be a dict keyed by tile id, or a list
    tiles_raw = data.get('tiles', {})
    if isinstance(tiles_raw, dict):
        tiles_items = tiles_raw.items()
    else:
        tiles_items = [(t.get('id', '?'), t) for t in tiles_raw if isinstance(t, dict)]
    for tile_id, tile in tiles_items:
        if not isinstance(tile, dict):
            continue
        tile_loc = f"{short}:tile:{tile_id}"
        walk_conditions(tile.get('conditions', []), tile_loc)
        walk_actions(tile.get('onInteract', []), tile_loc)

content_root = Path('content')
for root, dirs, files in os.walk(content_root):
    for f in files:
        if f.endswith('.json'):
            scan_file(os.path.join(root, f))

set_only = sorted(set(set_flags) - set(check_flags))
check_only = sorted(set(check_flags) - set(set_flags))
both = sorted(set(set_flags) & set(check_flags))

print(f"=== FLAGS SET BUT NEVER CHECKED ({len(set_only)}) ===")
for f in set_only:
    locs = sorted(set(set_flags[f]))
    print(f"  {f}")
    for l in locs:
        print(f"    SET in: {l}")

print()
print(f"=== FLAGS CHECKED BUT NEVER SET ({len(check_only)}) ===")
for f in check_only:
    locs = sorted(set(check_flags[f]))
    print(f"  {f}")
    for l in locs:
        print(f"    CHECKED in: {l}")

print()
print(f"=== FLAGS WITH BOTH SET AND CHECK ({len(both)}) ===")
for f in both:
    set_locs = sorted(set(set_flags[f]))
    chk_locs = sorted(set(check_flags[f]))
    print(f"  {f}")
    for l in set_locs:
        print(f"    SET in: {l}")
    for l in chk_locs:
        print(f"    CHK in: {l}")
