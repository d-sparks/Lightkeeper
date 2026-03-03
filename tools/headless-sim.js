#!/usr/bin/env node
// Headless Game Simulator — runs the real engine with a bot player, executing
// quests end-to-end without WebSockets or a browser.
//
// Usage:
//   node tools/headless-sim.js --mainline          # Main quest only
//   node tools/headless-sim.js --all-quests        # Main + all side quests
//   node tools/headless-sim.js --quest=lost_tool   # Specific quest
//   node tools/headless-sim.js --explore           # Visit every room
//   node tools/headless-sim.js --all-quests --json # JSON output for CI

const path = require('path');
const CONSTANTS = require('../shared/constants');
const ContentLoader = require('../server/content-loader');
const GameLoop = require('../server/game-loop');

// ─── Suppress content-loader console spam ────────────────────────────
const origLog = console.log;
const origWarn = console.warn;
const origErr = console.error;
let suppressLogs = true;
console.log = (...args) => { if (!suppressLogs) origLog(...args); };
console.warn = (...args) => { if (!suppressLogs) origWarn(...args); };
console.error = (...args) => { if (!suppressLogs) origErr(...args); };

// ─── Load Content ────────────────────────────────────────────────────
const content = new ContentLoader(path.join(__dirname, '..', 'content'));
content.loadAll();
suppressLogs = false;
console.log = origLog;
console.warn = origWarn;
console.error = origErr;

// ─── Constants ───────────────────────────────────────────────────────
const TICK_RATE = CONSTANTS.TICK_RATE;  // 15
const DT = 1 / TICK_RATE;               // ~0.0667s
const TILE_SIZE = CONSTANTS.TILE_SIZE;   // 32
const STUCK_THRESHOLD = 300;             // ticks with no progress = soft lock
const MAX_GAME_SECONDS = 1800;           // 30 minutes max per quest
const PLAYER_ID = 'bot_1';
const PLAYER_NAME = 'TestBot';

// ─── Message Log ─────────────────────────────────────────────────────
const messageLog = [];

// ─── Stats Collector ─────────────────────────────────────────────────
class Stats {
  constructor() {
    this.questResults = [];
    this.combat = {
      totalMonstersKilled: 0,
      byType: {},
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      totalHealingUsed: 0,
      deaths: 0,
      deathLocations: [],
    };
    this.exploration = {
      roomsVisited: new Set(),
      npcsInteracted: new Set(),
      itemsCollected: new Set(),
    };
    this.flags = {
      timeline: [],
      totalFlagsSet: 0,
    };
    this.softLocks = [];
    this.startTime = Date.now();
    this.totalTicks = 0;
    this.totalGameTime = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 2: Engine Harness
// ═══════════════════════════════════════════════════════════════════════

function createEngine() {
  const gameLoop = new GameLoop(content);

  // Wire up action callbacks (same as index.js, but capture instead of send)
  gameLoop.actions.sendToPlayer = function (playerId, message) {
    messageLog.push({ to: playerId, ...message });
  };
  gameLoop.actions.broadcastToRoom = function (roomId, message) {
    messageLog.push({ room: roomId, ...message });
  };
  gameLoop.actions._onQuestObjectiveChanged = function (playerId, roomId) {
    gameLoop._sendQuestObjective(playerId, roomId);
  };
  gameLoop.questTracker.onObjectiveChanged = function (playerId, roomId) {
    const room = gameLoop.getRoom(roomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;
    const objective = gameLoop.questTracker.getActiveObjective(playerId);
    player.questObjective = objective;
  };
  gameLoop.questTracker.onStepCompleted = function (playerId, questId, stepId, stepDef) {
    messageLog.push({ to: playerId, type: CONSTANTS.MSG.QUEST_STEP_COMPLETE, questId, stepId, label: stepDef.label });
  };
  gameLoop.questTracker.onQuestStarted = function (playerId, questId, quest) {
    messageLog.push({ to: playerId, type: CONSTANTS.MSG.QUEST_STARTED, questId, name: quest.name });
  };
  gameLoop.actions._getSolGridForClient = function (player) {
    return gameLoop.getSolGridForClient(player);
  };
  gameLoop.actions._onGrantXp = function (player, amount, room) {
    gameLoop.grantXp(player, amount, room);
  };
  gameLoop.actions._onEquipChanged = function (player, itemDef) {
    if (itemDef.hasSolGrid && itemDef.solUnitId) {
      const solUnitDef = content.getSolUnit(itemDef.solUnitId);
      if (solUnitDef) {
        gameLoop._initSolGrid(player, solUnitDef);
      }
    }
    gameLoop._rebuildAbilities(player);
  };

  return gameLoop;
}

// Process pending floor transitions (normally done by index.js broadcast loop)
function processTransitions(gameLoop, botState) {
  const transitions = gameLoop.consumeTransitions();
  for (const t of transitions) {
    if (t.playerId !== PLAYER_ID) continue;

    const player = gameLoop.removePlayer(t.fromRoom, t.playerId);
    if (!player) continue;

    const targetRoom = gameLoop.getOrCreateRoom(t.toDungeon, {
      fromDungeon: t.fromRoom,
      exitX: t.exitX,
      exitY: t.exitY,
      depth: t.depth,
    });
    if (!targetRoom) continue;

    const targetRoomId = targetRoom.id;

    // Resolve spawn position
    let spawnX = t.spawnX;
    let spawnY = t.spawnY;
    if (t.targetId && targetRoom.dungeon.exits) {
      const targetExit = targetRoom.dungeon.exits.find(e => e.id === t.targetId);
      if (targetExit) {
        spawnX = targetExit.x;
        spawnY = targetExit.y;
      }
    }
    if (spawnX == null || spawnY == null) {
      const sp = (targetRoom.dungeon.spawns && targetRoom.dungeon.spawns[0]) || { x: 2, y: 2 };
      spawnX = sp.x;
      spawnY = sp.y;
    }
    gameLoop.addPlayerAt(targetRoomId, player, spawnX, spawnY);
    gameLoop.emitRoomEntered(t.playerId, targetRoomId);

    botState.currentRoom = targetRoomId;
    botState.transitionCooldownTicks = Math.ceil(1.5 * TICK_RATE);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 3: Bot Navigation — A* and Exit Graph
// ═══════════════════════════════════════════════════════════════════════

// Build the global exit graph from all dungeons
function buildExitGraph() {
  const graph = new Map(); // dungeonId -> [{ leadsTo, exitX, exitY, spawnX, spawnY }]
  const dungeons = content.getAllDungeons();
  for (const [id, dungeon] of Object.entries(dungeons)) {
    if (!graph.has(id)) graph.set(id, []);
    if (!dungeon.exits) continue;
    for (const exit of dungeon.exits) {
      graph.get(id).push({
        leadsTo: exit.leadsTo,
        exitX: exit.x,
        exitY: exit.y,
        spawnX: exit.spawnX,
        spawnY: exit.spawnY,
      });
    }
  }
  return graph;
}

// BFS shortest path between two dungeons in the exit graph
function findRoomPath(exitGraph, from, to) {
  if (from === to) return [];
  const visited = new Set([from]);
  const queue = [{ room: from, path: [] }];
  while (queue.length > 0) {
    const { room, path } = queue.shift();
    const exits = exitGraph.get(room) || [];
    for (const exit of exits) {
      if (visited.has(exit.leadsTo)) continue;
      visited.add(exit.leadsTo);
      const newPath = [...path, { from: room, to: exit.leadsTo, exitX: exit.exitX, exitY: exit.exitY }];
      if (exit.leadsTo === to) return newPath;
      queue.push({ room: exit.leadsTo, path: newPath });
    }
  }
  return null; // No path found
}

// A* pathfinding on dungeon tile grid
function astarPath(dungeon, startTX, startTY, goalTX, goalTY) {
  if (startTX === goalTX && startTY === goalTY) return [];

  const w = dungeon.width;
  const h = dungeon.height;
  const key = (x, y) => y * w + x;

  // Check if goal tile is solid — if so find nearest non-solid neighbor
  let actualGoalX = goalTX;
  let actualGoalY = goalTY;
  if (isTileSolid(dungeon, goalTX, goalTY)) {
    let found = false;
    for (let r = 1; r <= 3 && !found; r++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = goalTX + dx;
          const ny = goalTY + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && !isTileSolid(dungeon, nx, ny)) {
            actualGoalX = nx;
            actualGoalY = ny;
            found = true;
          }
        }
      }
    }
  }

  const open = new Map(); // key -> { x, y, g, f, parent }
  const closed = new Set();

  const heuristic = (x, y) => Math.abs(x - actualGoalX) + Math.abs(y - actualGoalY);

  const startNode = { x: startTX, y: startTY, g: 0, f: heuristic(startTX, startTY), parent: null };
  open.set(key(startTX, startTY), startNode);

  const dirs = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];

  while (open.size > 0) {
    // Find lowest f in open set
    let best = null;
    for (const node of open.values()) {
      if (!best || node.f < best.f) best = node;
    }

    if (best.x === actualGoalX && best.y === actualGoalY) {
      // Reconstruct path
      const path = [];
      let node = best;
      while (node.parent) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    open.delete(key(best.x, best.y));
    closed.add(key(best.x, best.y));

    for (const [dx, dy] of dirs) {
      const nx = best.x + dx;
      const ny = best.y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (closed.has(key(nx, ny))) continue;
      if (isTileSolid(dungeon, nx, ny)) continue;

      // For diagonal movement, check that both cardinal neighbors are clear
      if (dx !== 0 && dy !== 0) {
        if (isTileSolid(dungeon, best.x + dx, best.y) || isTileSolid(dungeon, best.x, best.y + dy)) continue;
      }

      const cost = (dx !== 0 && dy !== 0) ? 1.414 : 1;
      const g = best.g + cost;
      const existing = open.get(key(nx, ny));

      if (!existing || g < existing.g) {
        const node = { x: nx, y: ny, g, f: g + heuristic(nx, ny), parent: best };
        open.set(key(nx, ny), node);
      }
    }
  }

  return null; // No path found
}

function isTileSolid(dungeon, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= dungeon.width || ty >= dungeon.height) return true;
  return content.isSolid(dungeon, tx, ty);
}

// Convert pixel position to tile position
function pixelToTile(px, py) {
  return { tx: Math.floor(px / TILE_SIZE), ty: Math.floor(py / TILE_SIZE) };
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 4: Bot Brain — Combat & Interaction
// ═══════════════════════════════════════════════════════════════════════

class Bot {
  constructor(gameLoop, exitGraph, stats) {
    this.gameLoop = gameLoop;
    this.exitGraph = exitGraph;
    this.stats = stats;
    this.currentRoom = null;
    this.goals = [];          // Goal stack
    this.currentPath = null;  // A* path for current movement
    this.pathIndex = 0;
    this.stuckTicks = 0;
    this.lastPos = null;
    this.lastRoom = null;
    this.lastFlags = null;
    this.lastInventoryCount = 0;
    this.transitionCooldownTicks = 0;
    this.pendingChoiceId = null;
    this.pendingChoiceValue = null;
    this.questsCompleted = new Set();
    this.deathCount = 0;
    this.ticksWithoutProgress = 0;
    this.questDeaths = 0;
    this.questMonstersKilled = 0;
  }

  getPlayer() {
    const room = this.gameLoop.getRoom(this.currentRoom);
    if (!room) return null;
    return room.players.get(PLAYER_ID);
  }

  getRoom() {
    return this.gameLoop.getRoom(this.currentRoom);
  }

  pushGoal(goal) {
    this.goals.push(goal);
  }

  currentGoal() {
    return this.goals.length > 0 ? this.goals[this.goals.length - 1] : null;
  }

  popGoal() {
    return this.goals.pop();
  }

  // Main think function — called each tick before engine update
  think(tick) {
    const player = this.getPlayer();
    if (!player) return;

    // Track room visits
    this.stats.exploration.roomsVisited.add(this.currentRoom);

    // Process pending choice selections
    if (this.pendingChoiceId) {
      this.gameLoop.handleChoiceSelect(this.currentRoom, PLAYER_ID, this.pendingChoiceId, this.pendingChoiceValue);
      this.pendingChoiceId = null;
      this.pendingChoiceValue = null;
    }

    // Handle transition cooldown
    if (this.transitionCooldownTicks > 0) {
      this.transitionCooldownTicks--;
      this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      return;
    }

    // Check for choice menus in message log
    this.checkForChoices();

    // Combat check — fight monsters blocking our path
    const room = this.getRoom();
    if (room && room.monsters.size > 0) {
      if (this.doCombat(player, room, tick)) return;
    }

    // Healing check
    this.checkHealing(player);

    // Process goal stack
    const goal = this.currentGoal();
    if (!goal) {
      this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      return;
    }

    switch (goal.type) {
      case 'navigate_to_room':
        this.doNavigateToRoom(goal, player);
        break;
      case 'move_to_position':
        this.doMoveToPosition(goal, player);
        break;
      case 'interact_with_npc':
        this.doInteractWithNpc(goal, player, room);
        break;
      case 'pick_up_item':
        this.doPickUpItem(goal, player, room);
        break;
      case 'wait_for_flag':
        this.doWaitForFlag(goal);
        break;
      case 'wait_for_item':
        this.doWaitForItem(goal, player);
        break;
      case 'equip_item':
        this.doEquipItem(goal, player);
        break;
      case 'use_item':
        this.doUseItem(goal, player);
        break;
      case 'interact_nearest':
        this.doInteractNearest(goal, player, room);
        break;
      case 'sol_grid_place':
        this.doSolGridPlace(goal, player);
        break;
      case 'kill_monsters':
        this.doKillMonsters(goal, player, room);
        break;
      case 'explore_room':
        this.doExploreRoom(goal, player, room);
        break;
      default:
        this.popGoal(); // Unknown goal, skip
    }

    // Track progress for stuck detection
    this.trackProgress(player, tick);
  }

  // ── Combat ─────────────────────────────────────────────────────────

  doCombat(player, room, tick) {
    // Only fight if monsters are nearby (within aggro range)
    let nearest = null;
    let nearestDist = Infinity;
    for (const [mid, mob] of room.monsters) {
      const dx = mob.x - player.x;
      const dy = mob.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearest = mob;
        nearestDist = dist;
      }
    }

    if (!nearest) return false;

    const aggroRange = CONSTANTS.MONSTER_AGGRO_RANGE * TILE_SIZE;
    // Only engage if monster is within aggro range or already aggro'd on us
    if (nearestDist > aggroRange) return false;

    // Try to attack (projectile weapon)
    const weapon = player.equipment && player.equipment.arms;
    const hasProjectile = weapon && weapon.stats && weapon.stats.projectile;

    if (hasProjectile) {
      // Ranged: maintain distance and shoot
      const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);

      if (nearestDist < 3 * TILE_SIZE) {
        // Too close, back away
        const input = {
          up: nearest.y > player.y,
          down: nearest.y < player.y,
          left: nearest.x < player.x ? false : true,
          right: nearest.x < player.x ? true : false,
        };
        // Kite perpendicular
        const perpAngle = angle + Math.PI / 2;
        input.dx = Math.cos(perpAngle) * 0.5 - Math.cos(angle) * 0.5;
        input.dy = Math.sin(perpAngle) * 0.5 - Math.sin(angle) * 0.5;
        this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, input);
      } else {
        this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      }

      this.gameLoop.tryAttack(this.currentRoom, PLAYER_ID, angle);
    } else {
      // Melee or no weapon: close distance and try interact-based combat
      const meleeRange = CONSTANTS.PLAYER_ATTACK_RANGE * TILE_SIZE;
      if (nearestDist > meleeRange) {
        // Move toward monster
        this.moveTowardPixel(player, nearest.x, nearest.y);
      } else {
        this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      }
      // Try projectile attack anyway (auto-aim)
      this.gameLoop.tryAttack(this.currentRoom, PLAYER_ID);
    }

    // Use abilities off cooldown
    for (let i = 0; i < player.abilities.length; i++) {
      if (player.abilities[i] && player.cooldowns[i] <= 0) {
        const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
        this.gameLoop.tryUseAbility(this.currentRoom, PLAYER_ID, i + 1, angle);
      }
    }

    return true; // We're in combat mode
  }

  checkHealing(player) {
    if (player.health > player.maxHealth * 0.3) return;

    // Find medipac or health potion in inventory
    for (let i = 0; i < player.inventory.length; i++) {
      const item = player.inventory[i];
      const itemDef = content.getItem(item.type);
      if (itemDef && itemDef.type === 'consumable' && itemDef.effect && itemDef.effect.heal) {
        this.gameLoop.tryUseItem(this.currentRoom, PLAYER_ID, i);
        this.stats.combat.totalHealingUsed += itemDef.effect.heal;
        return;
      }
    }

    // Try using equipped medipac
    if (player.equipment && player.equipment.medipac) {
      const medDef = content.getItem(player.equipment.medipac.type);
      if (medDef && medDef.effect && medDef.effect.heal) {
        this.stats.combat.totalHealingUsed += medDef.effect.heal;
      }
    }
  }

  checkForChoices() {
    // Scan message log for choice menus
    for (let i = messageLog.length - 1; i >= 0; i--) {
      const msg = messageLog[i];
      if (msg.type === CONSTANTS.MSG.CHOICE_MENU && msg.to === PLAYER_ID) {
        // Auto-select first option
        this.pendingChoiceId = msg.choiceId;
        this.pendingChoiceValue = msg.options && msg.options[0] ? msg.options[0].value : null;
        messageLog.splice(i, 1); // Consume message
        return;
      }
    }
  }

  // ── Goal Handlers ──────────────────────────────────────────────────

  doNavigateToRoom(goal, player) {
    if (this.currentRoom === goal.room) {
      this.popGoal();
      return;
    }

    // Find path through exit graph
    const path = findRoomPath(this.exitGraph, this.currentRoom, goal.room);
    if (!path || path.length === 0) {
      // Can't find path — give up on this goal
      this.popGoal();
      return;
    }

    // Push sub-goal: move to the exit tile of the first hop
    const firstHop = path[0];
    this.popGoal();
    // Re-push navigate goal (in case we need multiple hops)
    this.pushGoal(goal);
    // Push move-to-position for the exit tile
    this.pushGoal({
      type: 'move_to_position',
      tileX: firstHop.exitX,
      tileY: firstHop.exitY,
      tolerance: 0, // Must stand exactly on exit tile
    });
  }

  doMoveToPosition(goal, player) {
    const room = this.getRoom();
    if (!room) return;

    const { tx: currentTX, ty: currentTY } = pixelToTile(player.x, player.y);
    const tolerance = goal.tolerance || 0;

    if (Math.abs(currentTX - goal.tileX) <= tolerance && Math.abs(currentTY - goal.tileY) <= tolerance) {
      this.popGoal();
      this.currentPath = null;
      this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      return;
    }

    // Compute A* path if needed
    if (!this.currentPath || this.currentPath.length === 0) {
      this.currentPath = astarPath(room.dungeon, currentTX, currentTY, goal.tileX, goal.tileY);
      this.pathIndex = 0;

      if (!this.currentPath || this.currentPath.length === 0) {
        // Can't pathfind — try direct movement
        this.moveTowardTile(player, goal.tileX, goal.tileY);
        return;
      }
    }

    // Follow path
    if (this.pathIndex >= this.currentPath.length) {
      this.currentPath = null;
      return;
    }

    const target = this.currentPath[this.pathIndex];
    const targetPX = (target.x + 0.5) * TILE_SIZE;
    const targetPY = (target.y + 0.5) * TILE_SIZE;
    const dx = targetPX - player.x;
    const dy = targetPY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < TILE_SIZE * 0.4) {
      this.pathIndex++;
      if (this.pathIndex >= this.currentPath.length) {
        this.currentPath = null;
        this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
        return;
      }
    }

    // Set input toward next path node
    const nextTarget = this.currentPath[Math.min(this.pathIndex, this.currentPath.length - 1)];
    this.moveTowardTile(player, nextTarget.x, nextTarget.y);
  }

  doInteractWithNpc(goal, player, room) {
    if (!room) { this.popGoal(); return; }

    // Check if we're in the right room
    if (goal.room && this.currentRoom !== goal.room) {
      // Navigate to the room first
      this.pushGoal({ type: 'navigate_to_room', room: goal.room });
      return;
    }

    // Find the target NPC
    let targetNpc = null;
    for (const [npcId, npc] of room.npcs) {
      if (npc.type === goal.npcType) {
        targetNpc = npc;
        break;
      }
    }

    if (!targetNpc) {
      // NPC not in this room, goal is done
      this.popGoal();
      return;
    }

    const dx = targetNpc.x - player.x;
    const dy = targetNpc.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const interactRange = CONSTANTS.NPC_INTERACT_RANGE * TILE_SIZE;

    if (dist > interactRange) {
      // Move closer
      const npcTile = pixelToTile(targetNpc.x, targetNpc.y);
      this.moveTowardTile(player, npcTile.tx, npcTile.ty);
    } else {
      // Close enough — interact
      this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
      this.stats.exploration.npcsInteracted.add(targetNpc.type);
      this.popGoal();
    }
  }

  doPickUpItem(goal, player, room) {
    if (!room) { this.popGoal(); return; }

    // Check if we're in the right room
    if (goal.room && this.currentRoom !== goal.room) {
      this.pushGoal({ type: 'navigate_to_room', room: goal.room });
      return;
    }

    // Check if player already has the item
    if (goal.itemType && player.inventory.some(i => i.type === goal.itemType)) {
      this.popGoal();
      return;
    }

    // Find the ground item
    let targetItem = null;
    let targetDist = Infinity;
    for (const [itemId, item] of room.items) {
      if (goal.itemType && item.type !== goal.itemType) continue;
      const dx = item.x - player.x;
      const dy = item.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < targetDist) {
        targetItem = item;
        targetDist = dist;
      }
    }

    if (!targetItem) {
      // Item not on ground; maybe already picked up
      this.popGoal();
      return;
    }

    const pickupRange = CONSTANTS.ITEM_PICKUP_RANGE * TILE_SIZE;
    if (targetDist > pickupRange) {
      const itemTile = pixelToTile(targetItem.x, targetItem.y);
      this.moveTowardTile(player, itemTile.tx, itemTile.ty);
    } else {
      this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
      this.stats.exploration.itemsCollected.add(goal.itemType || targetItem.type);
      this.popGoal();
    }
  }

  doWaitForFlag(goal) {
    const flags = this.gameLoop.flagStore.getPlayerFlags(PLAYER_ID);
    if (flags[goal.flag]) {
      this.popGoal();
    }
    // If we have a failsafe interact, try interacting again
    if (goal.retryInteract && goal.retryTicks && goal.retryTicks > 0) {
      goal.retryTicks--;
      if (goal.retryTicks <= 0) {
        goal.retryTicks = 15; // Retry every second
        this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
      }
    }
  }

  doWaitForItem(goal, player) {
    if (player.inventory.some(i => i.type === goal.itemType)) {
      this.popGoal();
    }
  }

  doEquipItem(goal, player) {
    const idx = player.inventory.findIndex(i => i.type === goal.itemType);
    if (idx >= 0) {
      this.gameLoop.tryEquip(this.currentRoom, PLAYER_ID, idx);
    }
    this.popGoal();
  }

  doUseItem(goal, player) {
    const idx = player.inventory.findIndex(i => i.type === goal.itemType);
    if (idx >= 0) {
      this.gameLoop.tryUseItem(this.currentRoom, PLAYER_ID, idx);
    }
    this.popGoal();
  }

  doInteractNearest(goal, player, room) {
    if (!room) { this.popGoal(); return; }
    this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
    this.popGoal();
  }

  doSolGridPlace(goal, player) {
    // Find the component in inventory
    const idx = player.inventory.findIndex(i => i.type === goal.itemType);
    if (idx < 0) { this.popGoal(); return; }

    // Place at specified grid position, or try to find a valid position
    const gridX = goal.gridX || 0;
    const gridY = goal.gridY || 0;

    const result = this.gameLoop.trySolGridPlace(this.currentRoom, PLAYER_ID, idx, gridX, gridY);
    if (!result || !result.ok) {
      // Try adjacent positions
      const positions = [[1,2],[2,1],[3,2],[2,3],[0,2],[2,0],[1,1],[3,3]];
      for (const [gx, gy] of positions) {
        const r = this.gameLoop.trySolGridPlace(this.currentRoom, PLAYER_ID, idx, gx, gy);
        if (r && r.ok) break;
      }
    }
    this.popGoal();
  }

  doKillMonsters(goal, player, room) {
    if (!room || room.monsters.size === 0) {
      this.popGoal();
      return;
    }
    // Combat will be handled by the main think() combat check
    // Just stay in this goal until monsters are dead
  }

  doExploreRoom(goal, player, room) {
    if (!room) { this.popGoal(); return; }

    // Explore: interact with all NPCs, pick up all items, open all doors
    if (!goal._explored) {
      goal._explored = { npcs: [], items: [], phase: 'npcs', idx: 0 };
      // Collect all NPCs and items in this room
      for (const [npcId, npc] of room.npcs) {
        goal._explored.npcs.push(npc);
      }
      for (const [itemId, item] of room.items) {
        goal._explored.items.push(item);
      }
    }

    const exp = goal._explored;

    if (exp.phase === 'npcs') {
      if (exp.idx >= exp.npcs.length) {
        exp.phase = 'items';
        exp.idx = 0;
        return;
      }
      const npc = exp.npcs[exp.idx];
      // Check NPC still exists
      let npcExists = false;
      for (const [, n] of room.npcs) {
        if (n.type === npc.type) { npcExists = true; break; }
      }
      if (!npcExists) {
        exp.idx++;
        return;
      }
      // Push interact goal
      exp.idx++;
      this.pushGoal({ type: 'interact_with_npc', npcType: npc.type, room: this.currentRoom });
      return;
    }

    if (exp.phase === 'items') {
      // Pick up any remaining items
      if (room.items.size > 0) {
        this.pushGoal({ type: 'pick_up_item', room: this.currentRoom });
        return;
      }
      exp.phase = 'done';
    }

    if (exp.phase === 'done') {
      this.popGoal();
    }
  }

  // ── Movement Helpers ───────────────────────────────────────────────

  moveTowardTile(player, tileX, tileY) {
    const targetPX = (tileX + 0.5) * TILE_SIZE;
    const targetPY = (tileY + 0.5) * TILE_SIZE;
    this.moveTowardPixel(player, targetPX, targetPY);
  }

  moveTowardPixel(player, targetX, targetY) {
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const input = {
      right: dx > 2,
      left: dx < -2,
      down: dy > 2,
      up: dy < -2,
    };
    this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, input);
  }

  // ── Progress Tracking ──────────────────────────────────────────────

  trackProgress(player, tick) {
    const pos = `${Math.floor(player.x)},${Math.floor(player.y)}`;
    const flags = JSON.stringify(this.gameLoop.flagStore.getPlayerFlags(PLAYER_ID));
    const invCount = player.inventory.length;

    if (pos === this.lastPos && this.currentRoom === this.lastRoom && flags === this.lastFlags && invCount === this.lastInventoryCount) {
      this.ticksWithoutProgress++;
    } else {
      this.ticksWithoutProgress = 0;
    }

    this.lastPos = pos;
    this.lastRoom = this.currentRoom;
    this.lastFlags = flags;
    this.lastInventoryCount = invCount;
  }

  isStuck() {
    return this.ticksWithoutProgress >= STUCK_THRESHOLD;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 5: Quest Walkthrough — Loading and Goal Decomposition
// ═══════════════════════════════════════════════════════════════════════

function buildQuestGoals(questId, gameLoop, exitGraph) {
  const quest = content.getQuest(questId);
  if (!quest || !quest.steps) return [];

  // Topological sort of steps
  const stepOrder = topoSort(quest.steps, quest.startStep);
  const goals = [];

  for (const stepId of stepOrder) {
    const step = quest.steps[stepId];
    if (!step) continue;

    // Navigate to the step's room if specified
    if (step.objective && step.objective.roomId) {
      const roomId = step.objective.roomId;
      // Skip procedural rooms — they require special handling
      if (content.getDungeon(roomId)) {
        goals.push({ type: 'navigate_to_room', room: roomId, stepId, questId });
      }
    }

    // Determine what action to take based on completion conditions
    const conditions = step.completionConditions || [];
    for (const cond of conditions) {
      if (cond.hasFlag) {
        // Find which NPC or trigger sets this flag in the target room
        const roomId = step.objective ? step.objective.roomId : null;
        const npcType = roomId ? findNpcThatSetsFlag(cond.hasFlag, roomId) : null;

        if (npcType) {
          goals.push({ type: 'interact_with_npc', npcType, room: roomId, stepId, questId });
        } else if (roomId) {
          // Try general interaction in the room
          goals.push({ type: 'interact_nearest', room: roomId, stepId, questId });
        }

        // Special handling for sol grid steps
        if (step.uiHint === 'sol_grid_tutorial') {
          goals.push({ type: 'sol_grid_place', itemType: 'damage_booster_chip', gridX: 3, gridY: 2, stepId, questId });
        }

        goals.push({ type: 'wait_for_flag', flag: cond.hasFlag, retryInteract: true, retryTicks: 15, stepId, questId });
      }
      if (cond.hasItem) {
        // Check if item is a ground pickup or given by trigger
        const roomId = step.objective ? step.objective.roomId : null;
        if (roomId) {
          goals.push({ type: 'pick_up_item', itemType: cond.hasItem, room: roomId, stepId, questId });
        }
        goals.push({ type: 'wait_for_item', itemType: cond.hasItem, stepId, questId });
      }
    }
  }

  return goals;
}

function findNpcThatSetsFlag(flagName, roomId) {
  const dungeon = content.getDungeon(roomId);
  if (!dungeon || !dungeon.triggers) return null;

  for (const trigger of dungeon.triggers) {
    if (trigger.event !== 'npc_interacted') continue;
    if (!trigger.actions) continue;

    const setsFlag = trigger.actions.some(a =>
      (a.type === 'setFlag' && a.flag === flagName) ||
      (a.type === 'incrementFlag' && a.flag === flagName)
    );

    if (setsFlag && trigger.filter && trigger.filter.npcType) {
      return trigger.filter.npcType;
    }
  }

  // Also check NPC dialogueRules — sometimes the flag is set via dialogue interaction
  if (dungeon.npcSpawns) {
    for (const spawn of dungeon.npcSpawns) {
      const npcDef = content.getNPC(spawn.type);
      if (!npcDef) continue;
      // Check if any trigger in room with this NPC type sets the flag
      for (const trigger of (dungeon.triggers || [])) {
        if (!trigger.actions) continue;
        const setsFlag = trigger.actions.some(a =>
          (a.type === 'setFlag' && a.flag === flagName)
        );
        if (setsFlag) {
          // If this trigger has no npcType filter, it might fire on any interaction
          return spawn.type;
        }
      }
    }
  }

  return null;
}

function topoSort(steps, startStep) {
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

  if (startStep) visit(startStep);
  for (const stepId of Object.keys(steps)) {
    visit(stepId);
  }
  return order;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 6: Side Quest Coverage — Dependency DAG and Explore Mode
// ═══════════════════════════════════════════════════════════════════════

function buildQuestDependencyOrder() {
  const quests = content.getAllQuests();
  const questList = Object.keys(quests);

  // Build dependency map: quest -> set of prerequisite quest IDs
  // A quest depends on another if its startConditions reference flags
  // that are completion flags of other quests
  const completionFlags = new Map(); // flag -> questId that completes it
  for (const [questId, quest] of Object.entries(quests)) {
    if (!quest.steps) continue;
    for (const [stepId, step] of Object.entries(quest.steps)) {
      if (step.completionConditions) {
        for (const cond of step.completionConditions) {
          if (cond.hasFlag) completionFlags.set(cond.hasFlag, questId);
        }
      }
    }
  }

  // main_quest always first
  const order = ['main_quest'];
  const remaining = questList.filter(q => q !== 'main_quest');

  // Simple topological sort by trying to resolve dependencies
  const resolved = new Set(['main_quest']);
  let changed = true;
  while (changed && remaining.length > 0) {
    changed = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const qid = remaining[i];
      const quest = quests[qid];
      // Check if all startCondition flags are produced by resolved quests
      let canResolve = true;
      if (quest.startConditions) {
        for (const cond of flattenConditions(quest.startConditions)) {
          if (cond.hasFlag) {
            const producer = completionFlags.get(cond.hasFlag);
            if (producer && !resolved.has(producer)) {
              canResolve = false;
              break;
            }
          }
        }
      }
      if (canResolve) {
        order.push(qid);
        resolved.add(qid);
        remaining.splice(i, 1);
        changed = true;
      }
    }
  }

  // Add any remaining unresolved quests at the end
  for (const qid of remaining) {
    order.push(qid);
  }

  return order;
}

function flattenConditions(conditions) {
  if (!conditions) return [];
  if (Array.isArray(conditions)) {
    const result = [];
    for (const c of conditions) result.push(...flattenConditions(c));
    return result;
  }
  const result = [conditions];
  if (conditions.and) result.push(...flattenConditions(conditions.and));
  if (conditions.or) result.push(...flattenConditions(conditions.or));
  if (conditions.not) result.push(...flattenConditions(conditions.not));
  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// Simulation Runner
// ═══════════════════════════════════════════════════════════════════════

function runSimulation(gameLoop, bot, maxGameSeconds, label) {
  const maxTicks = maxGameSeconds * TICK_RATE;
  const startTick = bot.stats.totalTicks;
  const startTime = Date.now();

  for (let tick = 0; tick < maxTicks; tick++) {
    // 1. Bot decides actions
    bot.think(startTick + tick);

    // 2. Advance engine one tick
    gameLoop.update(DT);

    // 3. Process floor transitions
    processTransitions(gameLoop, bot);

    // 4. Track combat events
    trackCombatEvents(gameLoop, bot);

    // 5. Track flag changes
    trackFlagChanges(gameLoop, bot, startTick + tick);

    // 6. Clear message log periodically (keep last 100)
    if (messageLog.length > 200) {
      messageLog.splice(0, messageLog.length - 100);
    }

    // 7. Check if all goals complete
    if (bot.goals.length === 0) {
      bot.stats.totalTicks = startTick + tick + 1;
      bot.stats.totalGameTime = bot.stats.totalTicks * DT;
      return { status: 'completed', ticks: tick + 1, gameTime: (tick + 1) * DT, realTimeMs: Date.now() - startTime };
    }

    // 8. Check for soft lock
    if (bot.isStuck()) {
      const goal = bot.currentGoal();
      const player = bot.getPlayer();
      bot.stats.totalTicks = startTick + tick + 1;
      bot.stats.totalGameTime = bot.stats.totalTicks * DT;
      bot.stats.softLocks.push({
        label,
        tick: startTick + tick,
        goal: goal ? JSON.stringify(goal) : 'none',
        room: bot.currentRoom,
        playerPos: player ? `${Math.floor(player.x)}, ${Math.floor(player.y)}` : 'unknown',
        inventoryCount: player ? player.inventory.length : 0,
      });
      return {
        status: 'stuck', ticks: tick + 1, gameTime: (tick + 1) * DT, realTimeMs: Date.now() - startTime,
        stuckGoal: goal,
      };
    }
  }

  bot.stats.totalTicks = startTick + maxTicks;
  bot.stats.totalGameTime = bot.stats.totalTicks * DT;
  return { status: 'timeout', ticks: maxTicks, gameTime: maxTicks * DT, realTimeMs: Date.now() - startTime };
}

function trackCombatEvents(gameLoop, bot) {
  for (const [roomId, room] of gameLoop.rooms) {
    for (const evt of room.events) {
      if (evt.type === 'death' && evt.targetId === PLAYER_ID) {
        bot.stats.combat.deaths++;
        bot.questDeaths++;
        bot.stats.combat.deathLocations.push({
          room: roomId,
          tick: bot.stats.totalTicks,
          cause: 'combat',
        });
      }
      if (evt.type === 'death' && evt.targetId.startsWith('mob_')) {
        bot.stats.combat.totalMonstersKilled++;
        bot.questMonstersKilled++;
        // Try to find monster type from the ID
      }
      if (evt.type === 'damage' && evt.targetId === PLAYER_ID) {
        bot.stats.combat.totalDamageTaken += evt.amount || 0;
      }
      if (evt.type === 'damage' && evt.targetId.startsWith('mob_')) {
        bot.stats.combat.totalDamageDealt += evt.amount || 0;
      }
    }
    // Clear events after processing
    room.events = [];
  }
}

function trackFlagChanges(gameLoop, bot, tick) {
  // Check for new messages indicating flag changes
  for (const msg of messageLog) {
    if (msg.type === CONSTANTS.MSG.QUEST_STEP_COMPLETE) {
      bot.stats.flags.totalFlagsSet++;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 7: Output & Reporting
// ═══════════════════════════════════════════════════════════════════════

function formatHumanOutput(stats, mode, overallResult) {
  const lines = [];
  const line = (s = '') => lines.push(s);

  line('═══════════════════════════════════════════');
  line(`  LIGHTKEEPER CONTENT TEST — ${mode.toUpperCase()}`);
  line(`  ${new Date().toISOString().replace('T', ' ').split('.')[0]}`);
  line('═══════════════════════════════════════════');
  line('');

  const hasFails = stats.questResults.some(q => q.status !== 'completed');
  const hasSoftLocks = stats.softLocks.length > 0;
  if (hasFails || hasSoftLocks) {
    line(`RESULT: FAIL (${stats.questResults.filter(q => q.status !== 'completed').length} quest(s) not completed)`);
  } else {
    line('RESULT: PASS (all quests completed)');
  }
  line('');

  const totalGameTime = stats.totalGameTime;
  const totalRealTime = (Date.now() - stats.startTime) / 1000;
  const speedup = totalGameTime > 0 ? Math.round(totalGameTime / totalRealTime) : 0;

  line(`  Game time:  ${totalGameTime.toFixed(1)}s (${formatTime(totalGameTime)})`);
  line(`  Real time:  ${totalRealTime.toFixed(2)}s (${speedup}x speedup)`);
  line(`  Ticks:      ${stats.totalTicks.toLocaleString()}`);
  line('');

  // Quest Progression
  line('── Quest Progression ──────────────────────');
  line('');
  for (const qr of stats.questResults) {
    const statusStr = qr.status === 'completed' ? 'COMPLETE' : qr.status === 'stuck' ? 'STUCK' : 'TIMEOUT';
    const deathStr = qr.deaths > 0 ? `, ${qr.deaths} death${qr.deaths > 1 ? 's' : ''}` : ', 0 deaths';
    const pad = '.'.repeat(Math.max(1, 24 - qr.questId.length));
    line(`  ${qr.questId} ${pad} ${statusStr} (${qr.gameTime.toFixed(1)}s${deathStr})`);

    if (qr.status !== 'completed' && qr.stuckGoal) {
      line(`    Blocked at: ${JSON.stringify(qr.stuckGoal)}`);
    }
  }
  line('');

  // Combat
  line('── Combat ─────────────────────────────────');
  line('');
  line(`  Monsters killed:  ${stats.combat.totalMonstersKilled}`);
  line(`  Damage dealt:     ${stats.combat.totalDamageDealt.toLocaleString()}`);
  line(`  Damage taken:     ${stats.combat.totalDamageTaken.toLocaleString()}`);
  line(`  Healing used:     ${stats.combat.totalHealingUsed.toLocaleString()}`);
  line(`  Deaths:           ${stats.combat.deaths}`);
  line('');

  // Exploration
  const dungeons = content.getAllDungeons();
  const totalRooms = Object.keys(dungeons).length;
  const totalNpcs = new Set();
  const totalItems = new Set();
  for (const [, d] of Object.entries(dungeons)) {
    if (d.npcSpawns) d.npcSpawns.forEach(s => totalNpcs.add(s.type));
    if (d.itemSpawns) d.itemSpawns.forEach(s => totalItems.add(s.type));
  }

  line('── Exploration ────────────────────────────');
  line('');
  const visitPct = totalRooms > 0 ? ((stats.exploration.roomsVisited.size / totalRooms) * 100).toFixed(1) : 0;
  line(`  Rooms visited:  ${stats.exploration.roomsVisited.size}/${totalRooms} (${visitPct}%)`);
  line(`  NPCs talked to: ${stats.exploration.npcsInteracted.size}/${totalNpcs.size}`);
  line(`  Items collected: ${stats.exploration.itemsCollected.size}/${totalItems.size}`);
  line('');

  // Soft Locks
  line('── Soft Locks ─────────────────────────────');
  line('');
  if (stats.softLocks.length === 0) {
    line('  None detected.');
  } else {
    for (const sl of stats.softLocks) {
      line(`  ${sl.label}: stuck at tick ${sl.tick} in room "${sl.room}"`);
      line(`    Goal: ${sl.goal}`);
      line(`    Position: ${sl.playerPos}, inventory: ${sl.inventoryCount} items`);
    }
  }
  line('');
  line('═══════════════════════════════════════════');

  return lines.join('\n');
}

function formatJsonOutput(stats, mode) {
  return {
    runMode: mode,
    timestamp: new Date().toISOString(),
    totalGameTime: stats.totalGameTime,
    totalTicks: stats.totalTicks,
    realTimeMs: Date.now() - stats.startTime,
    quests: stats.questResults.map(qr => ({
      questId: qr.questId,
      status: qr.status,
      totalGameTime: qr.gameTime,
      deaths: qr.deaths,
      monstersKilled: qr.monstersKilled,
      stuckGoal: qr.stuckGoal || null,
    })),
    combat: {
      totalMonstersKilled: stats.combat.totalMonstersKilled,
      totalDamageDealt: stats.combat.totalDamageDealt,
      totalDamageTaken: stats.combat.totalDamageTaken,
      totalHealingUsed: stats.combat.totalHealingUsed,
      deaths: stats.combat.deaths,
      deathLocations: stats.combat.deathLocations,
    },
    exploration: {
      roomsVisited: stats.exploration.roomsVisited.size,
      totalRooms: Object.keys(content.getAllDungeons()).length,
      coveragePercent: parseFloat(((stats.exploration.roomsVisited.size / Math.max(1, Object.keys(content.getAllDungeons()).length)) * 100).toFixed(1)),
      roomsNeverVisited: Object.keys(content.getAllDungeons()).filter(id => !stats.exploration.roomsVisited.has(id)),
      npcsInteracted: stats.exploration.npcsInteracted.size,
      itemsCollected: stats.exploration.itemsCollected.size,
    },
    softLocks: stats.softLocks,
  };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

// ═══════════════════════════════════════════════════════════════════════
// Run Modes
// ═══════════════════════════════════════════════════════════════════════

function runQuest(gameLoop, bot, questId) {
  const quest = content.getQuest(questId);
  if (!quest) {
    return { questId, status: 'error', gameTime: 0, deaths: 0, monstersKilled: 0, error: `Quest "${questId}" not found` };
  }

  const goals = buildQuestGoals(questId, gameLoop, bot.exitGraph);

  // Push goals in reverse so they execute in order (stack)
  for (let i = goals.length - 1; i >= 0; i--) {
    bot.pushGoal(goals[i]);
  }

  bot.questDeaths = 0;
  bot.questMonstersKilled = 0;
  bot.ticksWithoutProgress = 0;

  const result = runSimulation(gameLoop, bot, MAX_GAME_SECONDS, questId);

  const questResult = {
    questId,
    status: result.status,
    gameTime: result.gameTime,
    ticks: result.ticks,
    deaths: bot.questDeaths,
    monstersKilled: bot.questMonstersKilled,
    stuckGoal: result.stuckGoal || null,
  };

  bot.stats.questResults.push(questResult);
  bot.questsCompleted.add(questId);

  return questResult;
}

function runMainline(gameLoop, bot) {
  return runQuest(gameLoop, bot, 'main_quest');
}

function runAllQuests(gameLoop, bot) {
  const order = buildQuestDependencyOrder();
  const results = [];

  for (const questId of order) {
    const result = runQuest(gameLoop, bot, questId);
    results.push(result);

    // If a quest gets stuck or times out, keep going with others
    // Clear stuck goals
    bot.goals = [];
    bot.currentPath = null;
    bot.ticksWithoutProgress = 0;
  }

  return results;
}

function runExplore(gameLoop, bot) {
  // Visit every reachable dungeon
  const dungeons = content.getAllDungeons();
  const spawnRoom = content.getSpawnRoom() || 'outpost_entrance';

  // BFS order from spawn
  const visited = new Set();
  const queue = [spawnRoom];
  visited.add(spawnRoom);
  const visitOrder = [spawnRoom];

  while (queue.length > 0) {
    const current = queue.shift();
    const dungeon = content.getDungeon(current);
    if (!dungeon || !dungeon.exits) continue;
    for (const exit of dungeon.exits) {
      if (!visited.has(exit.leadsTo) && content.getDungeon(exit.leadsTo)) {
        visited.add(exit.leadsTo);
        queue.push(exit.leadsTo);
        visitOrder.push(exit.leadsTo);
      }
    }
  }

  // Push goals: navigate to each room and explore it
  for (let i = visitOrder.length - 1; i >= 0; i--) {
    bot.pushGoal({ type: 'explore_room', room: visitOrder[i] });
    bot.pushGoal({ type: 'navigate_to_room', room: visitOrder[i] });
  }

  const result = runSimulation(gameLoop, bot, MAX_GAME_SECONDS * 2, 'explore');

  bot.stats.questResults.push({
    questId: 'explore',
    status: result.status,
    gameTime: result.gameTime,
    ticks: result.ticks,
    deaths: bot.questDeaths,
    monstersKilled: bot.questMonstersKilled,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const mode = parseMode(args);

  // Create engine
  const gameLoop = createEngine();
  const exitGraph = buildExitGraph();
  const stats = new Stats();

  // Create spawn room and player
  const spawnRoom = content.getSpawnRoom() || 'outpost_entrance';
  gameLoop.getOrCreateRoom(spawnRoom);
  gameLoop.addPlayer(spawnRoom, PLAYER_ID, PLAYER_NAME);

  // Auto-equip any weapon the player starts with (if any)
  const player = gameLoop.getRoom(spawnRoom).players.get(PLAYER_ID);

  const bot = new Bot(gameLoop, exitGraph, stats);
  bot.currentRoom = spawnRoom;

  // Run based on mode
  switch (mode.type) {
    case 'mainline':
      runMainline(gameLoop, bot);
      break;

    case 'all-quests':
      runAllQuests(gameLoop, bot);
      break;

    case 'quest': {
      const questId = mode.questId;
      // If quest has prerequisites, run mainline first
      const quest = content.getQuest(questId);
      if (quest && quest.startConditions) {
        // Run mainline to set up base state
        runMainline(gameLoop, bot);
        bot.goals = [];
        bot.currentPath = null;
        bot.ticksWithoutProgress = 0;
      }
      runQuest(gameLoop, bot, questId);
      break;
    }

    case 'explore':
      runExplore(gameLoop, bot);
      break;
  }

  // Output results
  if (jsonOutput) {
    console.log(JSON.stringify(formatJsonOutput(stats, mode.type), null, 2));
  } else {
    console.log(formatHumanOutput(stats, mode.type));
  }

  // Exit with appropriate code
  const hasFails = stats.questResults.some(q => q.status !== 'completed');
  process.exit(hasFails ? 1 : 0);
}

function parseMode(args) {
  for (const arg of args) {
    if (arg === '--mainline') return { type: 'mainline' };
    if (arg === '--all-quests') return { type: 'all-quests' };
    if (arg === '--explore') return { type: 'explore' };
    if (arg.startsWith('--quest=')) return { type: 'quest', questId: arg.slice('--quest='.length) };
  }
  return { type: 'mainline' }; // Default
}

main();
