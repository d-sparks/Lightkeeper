#!/usr/bin/env node
// Static Content Analyzer — validates JSON cross-references, builds dependency
// graphs, and proves reachability without running the game engine.
//
// Usage: node tools/content-validator.js [--json]

const path = require('path');
const ContentLoader = require('../server/content-loader');

// Suppress content-loader console spam during validation
const origLog = console.log;
console.log = () => {};
const content = new ContentLoader(path.join(__dirname, '..', 'content'));
content.loadAll();
console.log = origLog;

const errors = [];
const warnings = [];

// ─── Helpers ──────────────────────────────────────────────────────────

function err(tag, file, msg) {
  errors.push({ tag, file, msg });
}

function warn(tag, file, msg) {
  warnings.push({ tag, file, msg });
}

function dungeonFile(id) {
  return `dungeons/${id}.json`;
}

// ─── 2.1 Cross-Reference Validation ──────────────────────────────────

function validateCrossReferences() {
  const dungeons = content.getAllDungeons();
  const items = content.getAllItems();
  const quests = content.getAllQuests();

  for (const [id, dungeon] of Object.entries(dungeons)) {
    const file = dungeonFile(id);

    // monsterSpawns[].type → monsters.json
    if (dungeon.monsterSpawns) {
      for (let i = 0; i < dungeon.monsterSpawns.length; i++) {
        const spawn = dungeon.monsterSpawns[i];
        if (!content.getMonster(spawn.type)) {
          err('REF', file, `monsterSpawns[${i}].type "${spawn.type}" not found in monsters.json`);
        }
      }
    }

    // npcSpawns[].type → npcs.json
    if (dungeon.npcSpawns) {
      for (let i = 0; i < dungeon.npcSpawns.length; i++) {
        const spawn = dungeon.npcSpawns[i];
        if (!content.getNPC(spawn.type)) {
          err('REF', file, `npcSpawns[${i}].type "${spawn.type}" not found in npcs.json`);
        }
      }
    }

    // itemSpawns[].type → items.json
    if (dungeon.itemSpawns) {
      for (let i = 0; i < dungeon.itemSpawns.length; i++) {
        const spawn = dungeon.itemSpawns[i];
        if (!content.getItem(spawn.type)) {
          err('REF', file, `itemSpawns[${i}].type "${spawn.type}" not found in items.json`);
        }
      }
    }

    // tileset → tilesets/*.json
    if (dungeon.tileset && !content.getTileset(dungeon.tileset)) {
      err('REF', file, `tileset "${dungeon.tileset}" not found in tilesets/`);
    }

    // exits[].leadsTo → dungeons/*.json (or template)
    if (dungeon.exits) {
      for (let i = 0; i < dungeon.exits.length; i++) {
        const exit = dungeon.exits[i];
        if (!content.getDungeon(exit.leadsTo) && !content.getTemplate(exit.leadsTo)) {
          err('REF', file, `exits[${i}].leadsTo "${exit.leadsTo}" — dungeon/template does not exist`);
        }
      }
    }

    // Trigger action item references
    if (dungeon.triggers) {
      for (const trigger of dungeon.triggers) {
        if (!trigger.actions) continue;
        for (const action of trigger.actions) {
          if ((action.type === 'giveItem' || action.type === 'spawnItem') && action.itemType) {
            if (!content.getItem(action.itemType)) {
              err('REF', file, `trigger "${trigger.id}" action ${action.type} itemType "${action.itemType}" not found in items.json`);
            }
          }
          if (action.type === 'equipItem' && action.itemType) {
            if (!content.getItem(action.itemType)) {
              err('REF', file, `trigger "${trigger.id}" action equipItem itemType "${action.itemType}" not found in items.json`);
            }
          }
          if (action.type === 'removeItem' && action.itemType) {
            if (!content.getItem(action.itemType)) {
              err('REF', file, `trigger "${trigger.id}" action removeItem itemType "${action.itemType}" not found in items.json`);
            }
          }
        }
      }
    }
  }

  // NPC dialogue conditions: hasItem references
  for (const [npcId, npc] of Object.entries(content.npcs)) {
    if (!npc.dialogueRules) continue;
    for (let i = 0; i < npc.dialogueRules.length; i++) {
      const rule = npc.dialogueRules[i];
      if (!rule.conditions) continue;
      scanConditionsForItems(rule.conditions, `npcs.json "${npcId}" dialogueRules[${i}]`);
    }
  }

  // Sol unit defaultGrid component references
  for (const [unitId, unit] of Object.entries(content.solUnits)) {
    if (!unit.initialComponents) continue;
    for (let i = 0; i < unit.initialComponents.length; i++) {
      const comp = unit.initialComponents[i];
      const compId = comp.abilityId || comp.componentId;
      if (compId && !content.getSolComponent(compId)) {
        err('REF', `sol_units.json`, `"${unitId}" initialComponents[${i}] componentId "${compId}" not found in sol_components.json`);
      }
    }
  }

  // Quest step room references
  for (const [questId, quest] of Object.entries(quests)) {
    if (!quest.steps) continue;
    for (const [stepId, step] of Object.entries(quest.steps)) {
      if (step.objective && step.objective.roomId) {
        const roomId = step.objective.roomId;
        if (!content.getDungeon(roomId) && !content.getTemplate(roomId)) {
          err('REF', `quests/${questId}.json`, `step "${stepId}" objective.roomId "${roomId}" — dungeon does not exist`);
        }
      }
    }
  }
}

function scanConditionsForItems(conditions, context) {
  if (!conditions) return;
  if (Array.isArray(conditions)) {
    for (const cond of conditions) {
      scanConditionsForItems(cond, context);
    }
    return;
  }
  if (conditions.hasItem) {
    if (!content.getItem(conditions.hasItem)) {
      err('REF', context, `condition hasItem "${conditions.hasItem}" not found in items.json`);
    }
  }
  if (conditions.not) scanConditionsForItems(conditions.not, context);
  if (conditions.and) scanConditionsForItems(conditions.and, context);
  if (conditions.or) scanConditionsForItems(conditions.or, context);
}

// ─── 2.2 Exit Graph Validation ───────────────────────────────────────

function validateExitGraph() {
  const dungeons = content.getAllDungeons();
  const spawnRoom = content.getSpawnRoom() || 'outpost_entrance';

  // Build adjacency list
  const graph = new Map(); // dungeonId -> Set<dungeonId>
  for (const [id] of Object.entries(dungeons)) {
    graph.set(id, new Set());
  }

  for (const [id, dungeon] of Object.entries(dungeons)) {
    if (!dungeon.exits) continue;
    for (const exit of dungeon.exits) {
      // Only add edges to dungeons that exist (templates are special)
      if (content.getDungeon(exit.leadsTo)) {
        graph.get(id).add(exit.leadsTo);
      }
    }
  }

  // BFS from spawn
  const visited = new Set();
  const queue = [spawnRoom];
  visited.add(spawnRoom);
  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = graph.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // Check reachability
  for (const id of Object.keys(dungeons)) {
    if (!visited.has(id)) {
      err('EXIT', dungeonFile(id), `dungeon "${id}" is not reachable from spawn room "${spawnRoom}"`);
    }
  }

  // Bidirectional consistency
  for (const [id, dungeon] of Object.entries(dungeons)) {
    if (!dungeon.exits) continue;
    for (const exit of dungeon.exits) {
      const target = content.getDungeon(exit.leadsTo);
      if (!target) continue; // Already flagged in cross-ref validation

      // Check if target has a return exit to this dungeon
      const hasReturn = target.exits && target.exits.some(e => e.leadsTo === id);
      if (!hasReturn) {
        // Known one-way exits (like train_station → dayside_solar_fields)
        warn('EXIT', dungeonFile(id), `exit to "${exit.leadsTo}" has no return exit (may be intentional one-way)`);
      }
    }
  }

  // Exit tile validity
  for (const [id, dungeon] of Object.entries(dungeons)) {
    if (!dungeon.exits) continue;
    for (let i = 0; i < dungeon.exits.length; i++) {
      const exit = dungeon.exits[i];
      if (exit.x < 0 || exit.x >= dungeon.width || exit.y < 0 || exit.y >= dungeon.height) {
        err('EXIT', dungeonFile(id), `exits[${i}] position (${exit.x}, ${exit.y}) is outside dungeon bounds (${dungeon.width}x${dungeon.height})`);
      }
    }
  }
}

// ─── 2.3 Flag Dependency Analysis ────────────────────────────────────

function validateFlags() {
  const flagsSet = new Map();    // flagName -> [{ source, file }]
  const flagsChecked = new Map(); // flagName -> [{ source, file }]

  const dungeons = content.getAllDungeons();
  const quests = content.getAllQuests();

  // Scan dungeon triggers for flags set and checked
  for (const [id, dungeon] of Object.entries(dungeons)) {
    if (!dungeon.triggers) continue;
    const file = dungeonFile(id);

    for (const trigger of dungeon.triggers) {
      // Flags set by actions
      if (trigger.actions) {
        for (const action of trigger.actions) {
          if (action.type === 'setFlag' && action.flag) {
            addToMap(flagsSet, action.flag, { source: `trigger "${trigger.id}"`, file });
          }
          if (action.type === 'incrementFlag' && action.flag) {
            addToMap(flagsSet, action.flag, { source: `trigger "${trigger.id}"`, file });
          }
        }
      }

      // Flags checked by conditions
      if (trigger.conditions) {
        scanConditionsForFlags(trigger.conditions, flagsChecked,
          { source: `trigger "${trigger.id}" conditions`, file });
      }
    }
  }

  // Scan NPC dialogue rules for flag checks
  for (const [npcId, npc] of Object.entries(content.npcs)) {
    if (!npc.dialogueRules) continue;
    for (const rule of npc.dialogueRules) {
      if (rule.conditions) {
        scanConditionsForFlags(rule.conditions, flagsChecked,
          { source: `NPC "${npcId}" dialogueRule`, file: 'npcs.json' });
      }
    }
  }

  // Scan quest step conditions
  for (const [questId, quest] of Object.entries(quests)) {
    if (!quest.steps) continue;
    for (const [stepId, step] of Object.entries(quest.steps)) {
      if (step.completionConditions) {
        scanConditionsForFlags(step.completionConditions, flagsChecked,
          { source: `quest "${questId}" step "${stepId}"`, file: `quests/${questId}.json` });
      }
    }
    if (quest.startConditions) {
      scanConditionsForFlags(quest.startConditions, flagsChecked,
        { source: `quest "${questId}" startConditions`, file: `quests/${questId}.json` });
    }
  }

  // Scan tileset conditions
  for (const [tsId, tileset] of Object.entries(content.tilesets)) {
    if (!tileset.tiles) continue;
    for (const [tileId, tileDef] of Object.entries(tileset.tiles)) {
      if (tileDef.conditions) {
        scanConditionsForFlags(tileDef.conditions, flagsChecked,
          { source: `tileset "${tsId}" tile ${tileId}`, file: `tilesets/${tsId}.json` });
      }
    }
  }

  // Check: every flag checked must be settable somewhere
  for (const [flag, checkers] of flagsChecked) {
    // Skip internal trigger tracking flags
    if (flag.startsWith('__trigger_')) continue;
    if (!flagsSet.has(flag)) {
      const firstChecker = checkers[0];
      err('FLAG', firstChecker.file, `Flag "${flag}" checked in ${firstChecker.source} but never set by any trigger`);
    }
  }

  // Check: every flag set should be checked somewhere (warning)
  for (const [flag, setters] of flagsSet) {
    if (flag.startsWith('__trigger_')) continue;
    if (!flagsChecked.has(flag)) {
      const firstSetter = setters[0];
      warn('FLAG', firstSetter.file, `Flag "${flag}" is set in ${firstSetter.source} but never checked anywhere`);
    }
  }

  return { flagsSet, flagsChecked };
}

function scanConditionsForFlags(conditions, flagMap, info) {
  if (!conditions) return;
  if (Array.isArray(conditions)) {
    for (const cond of conditions) {
      scanConditionsForFlags(cond, flagMap, info);
    }
    return;
  }
  if (conditions.hasFlag) {
    addToMap(flagMap, conditions.hasFlag, info);
  }
  if (conditions.flagGreaterThan && conditions.flagGreaterThan.flag) {
    addToMap(flagMap, conditions.flagGreaterThan.flag, info);
  }
  if (conditions.flagLessThan && conditions.flagLessThan.flag) {
    addToMap(flagMap, conditions.flagLessThan.flag, info);
  }
  if (conditions.not) scanConditionsForFlags(conditions.not, flagMap, info);
  if (conditions.and) scanConditionsForFlags(conditions.and, flagMap, info);
  if (conditions.or) scanConditionsForFlags(conditions.or, flagMap, info);
}

function addToMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

// ─── 2.4 Item Flow Validation ────────────────────────────────────────

function scanObtainableItems(dungeonEntries, obtainableItems) {
  for (const [id, dungeon] of dungeonEntries) {
    // Ground spawns
    if (dungeon.itemSpawns) {
      for (const spawn of dungeon.itemSpawns) {
        obtainableItems.add(spawn.type);
      }
    }
    // Trigger actions (giveItem, spawnItem)
    if (dungeon.triggers) {
      for (const trigger of dungeon.triggers) {
        if (!trigger.actions) continue;
        for (const action of trigger.actions) {
          if ((action.type === 'giveItem' || action.type === 'spawnItem') && action.itemType) {
            obtainableItems.add(action.itemType);
          }
        }
      }
    }
  }
}

function validateItemFlow() {
  const quests = content.getAllQuests();
  const dungeons = content.getAllDungeons();

  // Build set of obtainable items (spawned on ground or given by triggers)
  const obtainableItems = new Set();

  // Scan static dungeons and templates
  scanObtainableItems(Object.entries(dungeons), obtainableItems);
  scanObtainableItems(Object.entries(content.templates), obtainableItems);

  // Check quest step conditions that reference items
  for (const [questId, quest] of Object.entries(quests)) {
    if (!quest.steps) continue;
    for (const [stepId, step] of Object.entries(quest.steps)) {
      if (!step.completionConditions) continue;
      const requiredItems = extractItemRequirements(step.completionConditions);
      for (const itemType of requiredItems) {
        if (!content.getItem(itemType)) {
          err('ITEM', `quests/${questId}.json`, `step "${stepId}" requires item "${itemType}" which doesn't exist in items.json`);
        } else if (!obtainableItems.has(itemType)) {
          err('ITEM', `quests/${questId}.json`, `step "${stepId}" requires item "${itemType}" but it's not spawned or given anywhere`);
        }
      }
    }
  }

  // Check NPC dialogue conditions that reference items
  for (const [npcId, npc] of Object.entries(content.npcs)) {
    if (!npc.dialogueRules) continue;
    for (const rule of npc.dialogueRules) {
      if (!rule.conditions) continue;
      const requiredItems = extractItemRequirements(rule.conditions);
      for (const itemType of requiredItems) {
        if (!content.getItem(itemType)) {
          warn('ITEM', 'npcs.json', `NPC "${npcId}" dialogue condition references item "${itemType}" which doesn't exist`);
        } else if (!obtainableItems.has(itemType)) {
          warn('ITEM', 'npcs.json', `NPC "${npcId}" dialogue condition references item "${itemType}" which is not obtainable`);
        }
      }
    }
  }
}

function extractItemRequirements(conditions) {
  const items = new Set();
  if (!conditions) return items;
  if (Array.isArray(conditions)) {
    for (const cond of conditions) {
      for (const item of extractItemRequirements(cond)) items.add(item);
    }
    return items;
  }
  if (conditions.hasItem) items.add(conditions.hasItem);
  if (conditions.not) {
    for (const item of extractItemRequirements(conditions.not)) items.add(item);
  }
  if (conditions.and) {
    for (const item of extractItemRequirements(conditions.and)) items.add(item);
  }
  if (conditions.or) {
    for (const item of extractItemRequirements(conditions.or)) items.add(item);
  }
  return items;
}

// ─── 2.5 Quest Completability Proof ──────────────────────────────────

function validateQuestCompletability() {
  const quests = content.getAllQuests();
  const dungeons = content.getAllDungeons();
  const spawnRoom = content.getSpawnRoom() || 'outpost_entrance';

  // Build exit graph for reachability
  const graph = new Map();
  for (const [id] of Object.entries(dungeons)) {
    graph.set(id, new Set());
  }
  for (const [id, dungeon] of Object.entries(dungeons)) {
    if (!dungeon.exits) continue;
    for (const exit of dungeon.exits) {
      if (content.getDungeon(exit.leadsTo)) {
        graph.get(id).add(exit.leadsTo);
      }
    }
  }

  // BFS reachability from spawn
  function isReachable(target) {
    if (!graph.has(target)) return false;
    const visited = new Set();
    const queue = [spawnRoom];
    visited.add(spawnRoom);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === target) return true;
      const neighbors = graph.get(current);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    return false;
  }

  for (const [questId, quest] of Object.entries(quests)) {
    if (!quest.steps) continue;

    // Topological order of steps
    const stepOrder = topoSortSteps(quest.steps, quest.startStep);

    for (const stepId of stepOrder) {
      const step = quest.steps[stepId];
      if (!step) continue;

      // Check target room is reachable
      if (step.objective && step.objective.roomId) {
        const roomId = step.objective.roomId;
        if (content.getDungeon(roomId) && !isReachable(roomId)) {
          err('QUEST', `quests/${questId}.json`, `step "${stepId}" targets room "${roomId}" which is not reachable from spawn`);
        }
      }
    }
  }
}

function topoSortSteps(steps, startStep) {
  const order = [];
  const visited = new Set();

  function visit(stepId) {
    if (visited.has(stepId)) return;
    visited.add(stepId);
    const step = steps[stepId];
    if (!step) return;
    if (step.prerequisiteSteps) {
      for (const prereq of step.prerequisiteSteps) {
        visit(prereq);
      }
    }
    order.push(stepId);
  }

  // Start from startStep, then visit all remaining
  if (startStep) visit(startStep);
  for (const stepId of Object.keys(steps)) {
    visit(stepId);
  }
  return order;
}

// ─── Run All Validations ─────────────────────────────────────────────

validateCrossReferences();
validateExitGraph();
validateFlags();
validateItemFlow();
validateQuestCompletability();

// ─── Output ──────────────────────────────────────────────────────────

const dungeonCount = Object.keys(content.getAllDungeons()).length;
const questCount = Object.keys(content.getAllQuests()).length;
const itemCount = Object.keys(content.getAllItems()).length;
const exitCount = Object.values(content.getAllDungeons()).reduce((sum, d) => sum + (d.exits ? d.exits.length : 0), 0);

const jsonMode = process.argv.includes('--json');

if (jsonMode) {
  console.log(JSON.stringify({
    errors: errors.map(e => ({ tag: e.tag, file: e.file, message: e.msg })),
    warnings: warnings.map(w => ({ tag: w.tag, file: w.file, message: w.msg })),
    stats: { dungeons: dungeonCount, quests: questCount, items: itemCount, exits: exitCount },
  }, null, 2));
} else {
  console.log('=== Content Validation Report ===\n');

  if (errors.length > 0) {
    console.log(`ERRORS (must fix):`);
    for (const e of errors) {
      console.log(`  [${e.tag}] ${e.file}: ${e.msg}`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (review):`);
    for (const w of warnings) {
      console.log(`  [${w.tag}] ${w.file}: ${w.msg}`);
    }
    console.log('');
  }

  console.log(`STATS:`);
  console.log(`  ${dungeonCount} dungeons validated, ${questCount} quests, ${itemCount} items`);
  console.log(`  ${exitCount} exits checked`);
  console.log(`  ${errors.length} errors, ${warnings.length} warnings`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n  All content checks passed!');
  }
}

process.exit(errors.length > 0 ? 1 : 0);
