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
const STUCK_THRESHOLD = 500;             // ticks with no progress = soft lock
const MAX_GAME_SECONDS = 5400;           // 90 minutes max per quest
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

  // Keep proc rooms alive when the bot leaves (e.g. death respawn) so monster
  // damage persists across visits.  Without this, the room is destroyed when empty
  // and regenerated fresh — resetting boss HP each time, making high-HP bosses
  // unkillable by the bot (quarantine loop bug).
  const _origRemovePlayer = gameLoop.removePlayer.bind(gameLoop);
  gameLoop.removePlayer = function (roomId, playerId) {
    const roomRef = this.rooms.get(roomId);
    const hadRoom = !!roomRef;
    const player = _origRemovePlayer(roomId, playerId);
    if (player && roomId.startsWith('proc:') && hadRoom && !this.rooms.has(roomId)) {
      this.rooms.set(roomId, roomRef);
      this.triggers.loadRoomTriggers(roomId, roomRef.dungeon);
    }
    return player;
  };

  return gameLoop;
}

// Process pending floor transitions (normally done by index.js broadcast loop)
function processTransitions(gameLoop, botState) {
  const transitions = gameLoop.consumeTransitions();
  for (const t of transitions) {
    if (t.playerId !== PLAYER_ID) continue;

    // Check if this transition would move the bot in the wrong direction
    // in a proc room (e.g., going up when we need to go deeper)
    // Death respawns always go through — never block them
    if (!t.deathRespawn && t.fromRoom.startsWith('proc:')) {
      // Use the most specific depth goal: traverse_procedural (active navigation) takes
      // priority, otherwise fall back to wait_for_item's expected depth
      let targetDepth = null;
      // Search from top of stack (most active) to bottom
      for (let gi = botState.goals.length - 1; gi >= 0; gi--) {
        const g = botState.goals[gi];
        if (g.type === 'traverse_procedural' && g.targetDepth != null) {
          targetDepth = g.targetDepth;
          break;
        }
        if (g.type === 'wait_for_item' && g.expectedDepth != null) {
          targetDepth = g.expectedDepth;
          break;
        }
      }
      if (targetDepth != null) {
        const currentRoom = gameLoop.getRoom(t.fromRoom);
        if (currentRoom) {
          const currentDepth = botState._getProcDepth(currentRoom);
          const transitionDepth = t.depth || 0;
          // Block transitions that move away from target depth, or that leave target when already there
          const wrongDirection = (currentDepth < targetDepth && transitionDepth < currentDepth) ||
                                 (currentDepth > targetDepth && transitionDepth > currentDepth) ||
                                 (currentDepth === targetDepth && transitionDepth !== targetDepth);
          if (wrongDirection) {
            // Nudge player away from exit tile to prevent re-triggering
            const exitPX = (t.exitX + 0.5) * TILE_SIZE;
            const exitPY = (t.exitY + 0.5) * TILE_SIZE;
            const playerInRoom = currentRoom.players.get(PLAYER_ID);
            if (playerInRoom) {
              const dx = playerInRoom.x - exitPX;
              const dy = playerInRoom.y - exitPY;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              playerInRoom.x += (dx / len) * TILE_SIZE;
              playerInRoom.y += (dy / len) * TILE_SIZE;
            }
            // Pop any move_to_position on top — its cached A* path may route
            // through this exit tile (e.g. key spawned behind the stairs_up).
            const top = botState.currentGoal();
            if (top && top.type === 'move_to_position') {
              botState.popGoal();
            }
            // Record this exit tile as a pathfinding obstacle so A* routes around
            // it when the goal re-pushes a new move_to_position.
            const alreadyBlocked = botState._blockedExitTiles.some(
              e => e.x === t.exitX && e.y === t.exitY && e.room === t.fromRoom);
            if (!alreadyBlocked) {
              botState._blockedExitTiles.push({ x: t.exitX, y: t.exitY, room: t.fromRoom });
            }
            continue;
          }
        }
      }
    }

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
    // Nudge spawn away from exit tiles to prevent immediate re-transition
    const finalRoom = gameLoop.getRoom(targetRoomId);
    if (finalRoom && finalRoom.dungeon.exits) {
      for (const exit of finalRoom.dungeon.exits) {
        if (exit.x === spawnX && exit.y === spawnY) {
          // Find an adjacent non-solid tile that isn't another exit
          const offsets = [[0, -1], [0, 1], [-1, 0], [1, 0]];
          for (const [ox, oy] of offsets) {
            const nx = spawnX + ox;
            const ny = spawnY + oy;
            if (nx >= 0 && ny >= 0 && nx < finalRoom.dungeon.width && ny < finalRoom.dungeon.height) {
              if (!isTileSolid(finalRoom.dungeon, nx, ny)) {
                const isExit = finalRoom.dungeon.exits.some(e => e.x === nx && e.y === ny);
                if (!isExit) {
                  spawnX = nx;
                  spawnY = ny;
                  break;
                }
              }
            }
          }
          break;
        }
      }
    }

    gameLoop.addPlayerAt(targetRoomId, player, spawnX, spawnY);
    // Restore health on death respawn (mirrors what the actual game client triggers).
    // Without this, the player stays at ≤0 HP and dies again every tick.
    if (t.deathRespawn) {
      player.health = player.maxHealth;
    }
    gameLoop.emitRoomEntered(t.playerId, targetRoomId);

    botState.currentRoom = targetRoomId;
    botState.transitionCooldownTicks = Math.ceil(1.5 * TICK_RATE);
    botState._combatStuckTicks = 0;
    botState._combatSkipTicks = 0;
    botState._lastCombatKey = null;
    botState.ticksWithoutProgress = 0;

    // Clear stale move_to_position goal left over from old room's exit tile
    if (botState.currentGoal && botState.currentGoal() && botState.currentGoal().type === 'move_to_position') {
      botState.popGoal();
    }
    botState.currentPath = null;
    // Clear blocked exit tile records for the room we just left — they're
    // room-specific and no longer relevant once we've successfully transitioned.
    botState._blockedExitTiles = botState._blockedExitTiles.filter(e => e.room !== t.fromRoom);
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
        conditions: exit.conditions || null,
      });
    }
  }
  return graph;
}

// Find which static dungeon has an exit leading to a given template ID
function findEntryToTemplate(templateId) {
  const dungeons = content.getAllDungeons();
  for (const [id, dungeon] of Object.entries(dungeons)) {
    if (!dungeon.exits) continue;
    for (const exit of dungeon.exits) {
      if (exit.leadsTo === templateId) {
        return { dungeonId: id, exitX: exit.x, exitY: exit.y };
      }
    }
  }
  return null;
}

// BFS shortest path between two dungeons in the exit graph
// skipEdges: optional Set of "from:to" strings to exclude from path search
function findRoomPath(exitGraph, from, to, skipEdges) {
  if (from === to) return [];
  const visited = new Set([from]);
  const queue = [{ room: from, path: [] }];
  while (queue.length > 0) {
    const { room, path } = queue.shift();
    const exits = exitGraph.get(room) || [];
    for (const exit of exits) {
      if (visited.has(exit.leadsTo)) continue;
      // Skip edges known to be unreachable
      if (skipEdges && skipEdges.has(`${room}:${exit.leadsTo}`)) continue;
      visited.add(exit.leadsTo);
      const newPath = [...path, { from: room, to: exit.leadsTo, exitX: exit.exitX, exitY: exit.exitY, conditions: exit.conditions }];
      if (exit.leadsTo === to) return newPath;
      queue.push({ room: exit.leadsTo, path: newPath });
    }
  }
  return null; // No path found
}

// A* pathfinding on dungeon tile grid
// blockedTiles: optional Set of tile keys (y * width + x) to treat as impassable (e.g. monster positions)
// playerFlags: optional flag map — used to treat locked interactable doors as solid
function astarPath(dungeon, startTX, startTY, goalTX, goalTY, blockedTiles, playerFlags) {
  if (startTX === goalTX && startTY === goalTY) return [];

  const w = dungeon.width;
  const h = dungeon.height;
  const key = (x, y) => y * w + x;

  // Check if goal tile is solid — if so find nearest non-solid neighbor
  let actualGoalX = goalTX;
  let actualGoalY = goalTY;
  if (isTileSolid(dungeon, goalTX, goalTY, playerFlags)) {
    let found = false;
    for (let r = 1; r <= 3 && !found; r++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = goalTX + dx;
          const ny = goalTY + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && !isTileSolid(dungeon, nx, ny, playerFlags)) {
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
      if (blockedTiles && blockedTiles.has(key(nx, ny))) continue;

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

// playerFlags is optional; when provided, locked doors (conditions not met) are
// treated as solid so A* doesn't route the bot through doors it can't open.
function isTileSolid(dungeon, tx, ty, playerFlags) {
  if (tx < 0 || ty < 0 || tx >= dungeon.width || ty >= dungeon.height) return true;
  const tileId = dungeon.data[ty * dungeon.width + tx];
  const tileset = content.getTileset(dungeon.tileset);
  if (!tileset) return true;
  const tileDef = tileset.tiles[String(tileId)];
  if (!tileDef) return true;
  // Treat interactable doors as passable for pathfinding — but only if the bot
  // can actually open them (conditions met or no conditions). Locked doors that
  // require unmet flags are solid so A* routes around them rather than routing
  // the bot into a wall and into combat range of monsters beyond it.
  if (tileDef.solid && tileDef.interactable && tileDef.togglesTo != null) {
    // Tiles that toggle to themselves are switches/consoles, not openable doors.
    // They remain solid even after interaction (e.g. power conduits).
    if (tileDef.togglesTo === tileId) return true;
    if (tileDef.conditions && playerFlags) {
      const conditionsMet = tileDef.conditions.every(cond => {
        if (cond.hasFlag) return !!playerFlags[cond.hasFlag];
        return true;
      });
      if (!conditionsMet) return true; // locked — treat as solid
    }
    return false; // unlocked — treat as passable
  }
  return tileDef.solid === true;
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
    this.failedQuestPrereqs = new Set(); // quests whose prereqs couldn't be resolved
    this.unreachableExits = new Set();   // "from:to" edges the bot can't unblock
    this.skipCombat = false;             // set true in explore mode to skip combat
    this.deathCount = 0;
    this.ticksWithoutProgress = 0;
    this.questDeaths = 0;
    this.questMonstersKilled = 0;
    this._combatStuckTicks = 0;
    this._combatSkipTicks = 0;
    this._lastCombatKey = null;
    // Exit tiles that A* should route around (wrong-direction exits in proc rooms)
    this._blockedExitTiles = []; // Array of { x, y, room }
  }

  // Build a Set of tile keys (y*width+x) for exit tiles that should be avoided
  // during A* pathfinding in the current room (wrong-direction exits).
  _getBlockedExitSet(dungeon) {
    if (!this._blockedExitTiles || this._blockedExitTiles.length === 0) return null;
    const roomBlocked = this._blockedExitTiles.filter(e => e.room === this.currentRoom);
    if (roomBlocked.length === 0) return null;
    const set = new Set();
    for (const e of roomBlocked) set.add(e.y * dungeon.width + e.x);
    return set;
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
    this._globalTick = tick;
    const player = this.getPlayer();
    if (!player) return;

    // Debug: track position delta for stuck detection debugging
    if (this._debugStuckRoom && this.currentRoom === this._debugStuckRoom && tick % 50 === 0) {
      const goal = this.currentGoal();
      const room = this.getRoom();
      const inp = player.input || {};
      console.log(`[Bot:tick${tick}] pos=(${Math.round(player.x)},${Math.round(player.y)}) input=(${inp.up?'U':''}${inp.down?'D':''}${inp.left?'L':''}${inp.right?'R':''}) goal=${goal?.type} stunned=${player.stunTime>0} kb=${player.knockbackTime>0} monsters=${room?room.monsters.size:'?'} hp=${player.health}/${player.maxHealth}`);
    }

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
    // During navigation goals, only fight monsters that are very close (unavoidable)
    const room = this.getRoom();
    const goal = this.currentGoal();
    const isNavigating = goal && (goal.type === 'navigate_to_room' || goal.type === 'move_to_position' ||
                                  goal.type === 'traverse_procedural' || goal.type === 'find_exit_in_room');
    if (room && room.monsters.size > 0) {
      // While fighting, also try tile interactions if we're close to a wait_for_item
      // target — this lets the bot open chests even when monsters are nearby
      if (goal && goal.type === 'wait_for_item' && goal._targetTileX != null) {
        const { tx: ptx, ty: pty } = pixelToTile(player.x, player.y);
        const tileDist = Math.abs(ptx - goal._targetTileX) + Math.abs(pty - goal._targetTileY);
        if (tileDist <= 1) {
          this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
        }
      }
      if (!this.skipCombat && this.doCombat(player, room, tick, isNavigating)) {
        // Track progress even during combat so stuck detection works
        this.trackProgress(player, tick);
        // Count combat ticks for the current move_to_position goal
        if (goal && goal.type === 'move_to_position') {
          goal._combatTicks = (goal._combatTicks || 0) + 1;
        }
        return;
      }
    }

    // Healing check
    this.checkHealing(player);

    // Opportunistically pick up nearby healing items
    if (room && room.items.size > 0 && player.health < player.maxHealth * 0.7) {
      for (const [, item] of room.items) {
        const itemDef = content.getItem(item.type);
        if (itemDef && itemDef.type === 'consumable' && itemDef.effect && itemDef.effect.heal) {
          const dx = item.x - player.x;
          const dy = item.y - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const pickupRange = CONSTANTS.ITEM_PICKUP_RANGE * TILE_SIZE;
          if (dist <= pickupRange) {
            this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
            break;
          }
        }
      }
    }

    // Process goal stack
    const activeGoal = this.currentGoal();
    if (!activeGoal) {
      this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      return;
    }

    switch (activeGoal.type) {
      case 'navigate_to_room':
        this.doNavigateToRoom(activeGoal, player);
        break;
      case 'move_to_position':
        this.doMoveToPosition(activeGoal, player);
        break;
      case 'interact_with_npc':
        this.doInteractWithNpc(activeGoal, player, room);
        break;
      case 'interact_with_tile':
        this.doInteractWithTile(activeGoal, player, room);
        break;
      case 'pick_up_item':
        this.doPickUpItem(activeGoal, player, room);
        break;
      case 'wait_for_flag':
        this.doWaitForFlag(activeGoal);
        break;
      case 'wait_for_item':
        this.doWaitForItem(activeGoal, player);
        break;
      case 'equip_item':
        this.doEquipItem(activeGoal, player);
        break;
      case 'use_item':
        this.doUseItem(activeGoal, player);
        break;
      case 'interact_nearest':
        this.doInteractNearest(activeGoal, player, room);
        break;
      case 'sol_grid_place':
        this.doSolGridPlace(activeGoal, player);
        break;
      case 'kill_monsters':
        this.doKillMonsters(activeGoal, player, room);
        break;
      case 'explore_room':
        this.doExploreRoom(activeGoal, player, room);
        break;
      case 'traverse_procedural':
        this.doTraverseProcedural(activeGoal, player, room);
        break;
      case 'find_exit_in_room':
        this.doFindExitInRoom(activeGoal, player, room);
        break;
      default:
        this.popGoal(); // Unknown goal, skip
    }

    // Track progress for stuck detection
    this.trackProgress(player, tick);
  }

  // ── Combat ─────────────────────────────────────────────────────────

  doCombat(player, room, tick, isNavigating) {
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

    // During navigation, only fight monsters that are very close (within 3 tiles)
    // to avoid wasting health on optional encounters
    const engageRange = isNavigating ? 3 * TILE_SIZE : CONSTANTS.MONSTER_AGGRO_RANGE * TILE_SIZE;
    if (nearestDist > engageRange) return false;

    // Combat skip cooldown: after combat timeout, ignore combat for a while
    if (this._combatSkipTicks > 0) {
      this._combatSkipTicks--;
      return false;
    }

    // Combat timeout: track whether combat is productive (dealing damage or killing)
    // by monitoring total monster HP in the room
    let totalMonsterHP = 0;
    for (const [, mob] of room.monsters) {
      totalMonsterHP += mob.health;
    }
    const combatKey = `${room.monsters.size}:${totalMonsterHP}`;
    if (combatKey !== this._lastCombatKey) {
      this._lastCombatKey = combatKey;
      this._combatStuckTicks = 0;
    } else {
      this._combatStuckTicks = (this._combatStuckTicks || 0) + 1;
    }
    // After zero combat progress, skip combat to let goals proceed
    // Use a shorter threshold during navigation (45 ticks ~3s) vs general (150 ticks ~10s)
    const combatStallLimit = isNavigating ? 45 : 150;
    if (this._combatStuckTicks > combatStallLimit) {
      this._combatStuckTicks = 0;
      this._combatSkipTicks = 300;
      return false;
    }

    // Try to attack (projectile weapon)
    const weapon = player.equipment && player.equipment.arms;
    const hasProjectile = weapon && weapon.stats && weapon.stats.projectile;

    if (hasProjectile) {
      // Ranged: maintain distance and shoot
      const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);

      // If combat is stalled (projectiles hitting walls), close distance to get LoS
      const combatStalled = (this._combatStuckTicks || 0) > 30;

      if (combatStalled || nearestDist > 6 * TILE_SIZE) {
        // Close distance using A* pathfinding to navigate around walls
        const { tx: ptx, ty: pty } = pixelToTile(player.x, player.y);
        const mobTile = pixelToTile(nearest.x, nearest.y);
        const path = astarPath(room.dungeon, ptx, pty, mobTile.tx, mobTile.ty);
        if (path && path.length > 0) {
          this.moveTowardTile(player, path[0].x, path[0].y, { avoidExits: true });
        } else {
          this.moveTowardPixel(player, nearest.x, nearest.y, { avoidExits: true });
        }
      } else if (nearestDist < 3 * TILE_SIZE) {
        // Too close, back away (avoid exits)
        this.moveTowardPixel(player, player.x - (nearest.x - player.x), player.y - (nearest.y - player.y), { avoidExits: true });
      } else {
        this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      }

      this.gameLoop.tryAttack(this.currentRoom, PLAYER_ID, angle);
    } else {
      // Melee or no weapon: close distance and try interact-based combat
      const meleeRange = CONSTANTS.PLAYER_ATTACK_RANGE * TILE_SIZE;
      if (nearestDist > meleeRange) {
        // Move toward monster (avoid exits to prevent accidental transitions)
        this.moveTowardPixel(player, nearest.x, nearest.y, { avoidExits: true });
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

    // If we're in a procedural room, first escape by finding stairs_up
    if (this.currentRoom.startsWith('proc:')) {
      this.pushGoal({ type: 'find_exit_in_room', exitType: 'stairs_up' });
      return;
    }

    // Find path through exit graph, avoiding known-unreachable exits
    const path = findRoomPath(this.exitGraph, this.currentRoom, goal.room, this.unreachableExits);
    if (!path || path.length === 0) {
      // Can't find path — give up on this goal
      console.log(`[Bot] No path from "${this.currentRoom}" to "${goal.room}" (${this.unreachableExits.size} blocked exits) — skipping`);
      this.popGoal();
      return;
    }

    // Check if first hop's exit has conditions that aren't met yet
    const firstHop = path[0];
    const hopKey = `${firstHop.from}:${firstHop.to}`;
    if (firstHop.conditions && goal._lastResolvedHop !== hopKey) {
      const flags = this.gameLoop.flagStore.getPlayerFlags(PLAYER_ID);
      const playerObj = this.getPlayer();
      const inventory = playerObj ? playerObj.inventory : [];

      for (const cond of firstHop.conditions) {
        if (cond.hasFlag && !flags[cond.hasFlag]) {
          // Flag not set — find and run the quest that sets it
          const questId = findQuestThatSetsFlag(cond.hasFlag);
          if (questId && !this.questsCompleted.has(questId) && !this.failedQuestPrereqs.has(questId)) {
            console.log(`[Bot] Exit ${firstHop.from} → ${firstHop.to} blocked by flag "${cond.hasFlag}"; running quest "${questId}" first`);
            const prereqGoals = buildQuestGoals(questId, this.gameLoop, this.exitGraph);
            // Mark so we don't re-detect on next tick
            goal._lastResolvedHop = hopKey;
            // Push current navigate goal back, then prereq goals on top
            this.popGoal();
            this.pushGoal(goal);
            for (let i = prereqGoals.length - 1; i >= 0; i--) {
              this.pushGoal(prereqGoals[i]);
            }
            return;
          }
          // Quest already failed or not found — mark exit unreachable and retry path
          if (questId && this.failedQuestPrereqs.has(questId)) {
            console.log(`[Bot] Exit ${hopKey} requires failed quest "${questId}" — marking exit unreachable`);
          } else {
            // No quest found — try finding the room/trigger that sets it
            const roomInfo = findRoomThatSetsFlag(cond.hasFlag);
            if (roomInfo) {
              console.log(`[Bot] Exit blocked by flag "${cond.hasFlag}"; navigating to ${roomInfo.roomId} to resolve`);
              goal._lastResolvedHop = hopKey;
              // Push in reverse order (stack — last pushed = first executed)
              this.pushGoal({ type: 'wait_for_flag', flag: cond.hasFlag, retryInteract: true, retryTicks: 15 });
              this.pushGoal({ type: 'explore_room' });
              if (roomInfo.npcType) {
                this.pushGoal({ type: 'interact_with_npc', npcType: roomInfo.npcType, room: roomInfo.roomId });
              }
              this.pushGoal({ type: 'navigate_to_room', room: roomInfo.roomId });
              return;
            }
          }
          // Can't resolve this flag — mark exit unreachable and re-route
          this.unreachableExits.add(hopKey);
          console.log(`[Bot] Marked exit ${hopKey} unreachable; will try alternate route`);
          goal._lastResolvedHop = null; // Reset so re-route gets fresh condition check
          return; // Re-enter doNavigateToRoom next tick with updated unreachableExits
        }
        if (cond.hasItem && !inventory.some(i => i.type === cond.hasItem)) {
          // Item not in inventory — find where it spawns
          const itemLoc = findGroundItem(cond.hasItem);
          if (itemLoc) {
            console.log(`[Bot] Exit blocked by item "${cond.hasItem}"; navigating to ${itemLoc.roomId} to pick it up`);
            goal._lastResolvedHop = hopKey;
            // Push in reverse order (stack — last pushed = first executed)
            this.pushGoal({ type: 'wait_for_item', itemType: cond.hasItem });
            this.pushGoal({ type: 'pick_up_item', itemType: cond.hasItem, room: itemLoc.roomId });
            this.pushGoal({ type: 'navigate_to_room', room: itemLoc.roomId });
            return;
          }
          // Can't find item — mark exit unreachable
          this.unreachableExits.add(hopKey);
          console.log(`[Bot] Can't find item "${cond.hasItem}" — marked exit ${hopKey} unreachable`);
          goal._lastResolvedHop = null;
          return;
        }
      }
    }

    // Fast-travel through sim passthrough rooms: teleport directly to the next
    // room's spawn point instead of walking. This slashes traversal time for long
    // linear dungeon chains (e.g. Lighthouse Mara f02–f19) from thousands of ticks
    // to ~2 ticks per floor without affecting real gameplay (sim-only flag).
    const currentRoomData = this.getRoom();
    if (currentRoomData && currentRoomData.dungeon.sim_passthrough === true) {
      const exits = this.exitGraph.get(this.currentRoom) || [];
      const fullExit = exits.find(e => e.leadsTo === firstHop.to);
      const spawnX = fullExit && fullExit.spawnX != null ? fullExit.spawnX : 2;
      const spawnY = fullExit && fullExit.spawnY != null ? fullExit.spawnY : 2;
      console.log(`[Bot] Passthrough fast-travel: ${this.currentRoom} → ${firstHop.to}`);
      this.popGoal();
      this.pushGoal(goal);
      this._fastTraverseRoom(firstHop.to, spawnX, spawnY);
      return;
    }

    // Push sub-goal: move to the exit tile of the first hop
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

  // Directly move the player to a target dungeon room, bypassing physics exit
  // detection. Used for sim_passthrough floors that have no quest-relevant content.
  _fastTraverseRoom(toDungeon, spawnX, spawnY) {
    const fromRoomId = this.currentRoom;
    const player = this.gameLoop.removePlayer(fromRoomId, PLAYER_ID);
    if (!player) return;

    const targetRoom = this.gameLoop.getOrCreateRoom(toDungeon, { fromDungeon: fromRoomId });
    if (!targetRoom) {
      // Roll back — put player back so it isn't lost
      const fromRoom = this.gameLoop.getOrCreateRoom(fromRoomId);
      if (fromRoom) this.gameLoop.addPlayerAt(fromRoomId, player, spawnX, spawnY);
      return;
    }

    const targetRoomId = targetRoom.id;
    this.gameLoop.addPlayerAt(targetRoomId, player, spawnX, spawnY);
    this.gameLoop.emitRoomEntered(PLAYER_ID, targetRoomId);

    this.currentRoom = targetRoomId;
    this.transitionCooldownTicks = 2; // Brief pause for engine state to settle
    this._combatStuckTicks = 0;
    this._combatSkipTicks = 0;
    this._lastCombatKey = null;
    this.currentPath = null;
    this._blockedExitTiles = this._blockedExitTiles.filter(e => e.room !== fromRoomId);
  }

  doMoveToPosition(goal, player) {
    const room = this.getRoom();
    if (!room) return;

    // If goal tile is out of bounds (e.g. stale goal from before a room transition), abandon it
    if (goal.tileX < 0 || goal.tileY < 0 || goal.tileX >= room.dungeon.width || goal.tileY >= room.dungeon.height) {
      this.popGoal();
      return;
    }

    // Stuck timeout: abandon if target is unreachable after too long
    const { tx: currentTX, ty: currentTY } = pixelToTile(player.x, player.y);
    if (!goal._totalTicks) goal._totalTicks = 0;
    goal._totalTicks++;
    // Allow generous time (500 ticks = ~33s game time) but not infinite
    if (goal._totalTicks > 500) {
      const rm = this.getRoom();
      const mc = rm ? rm.monsters.size : '?';
      console.log(`[Bot] move_to_position TIMEOUT in ${this.currentRoom} target=(${goal.tileX},${goal.tileY}) pos=(${currentTX},${currentTY}) px=(${Math.round(player.x)},${Math.round(player.y)}) stalls=${goal._monsterAvoidRetries||0} monsters=${mc} hasPath=${!!goal._path} pathLen=${goal._path?goal._path.length:'n/a'} pathIdx=${goal._pathIndex} combatTicks=${goal._combatTicks||0}`);
      // Enable per-tick debug logging after first timeout in a proc room
      if (this.currentRoom.startsWith('proc:') && !this._debugStuckRoom) {
        this._debugStuckRoom = this.currentRoom;
      }
      this.popGoal();
      return;
    }
    const tolerance = goal.tolerance || 0;

    if (Math.abs(currentTX - goal.tileX) <= tolerance && Math.abs(currentTY - goal.tileY) <= tolerance) {
      this.popGoal();
      this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      return;
    }

    // Compute A* path if needed — stored per-goal so sub-goals don't share stale paths
    if (!goal._path || goal._path.length === 0) {
      const blockedExits = this._getBlockedExitSet(room.dungeon);
      goal._path = astarPath(room.dungeon, currentTX, currentTY, goal.tileX, goal.tileY, blockedExits);
      goal._pathIndex = 0;

      if (!goal._path || goal._path.length === 0) {
        // Can't pathfind — try direct movement
        if (goal._totalTicks % 100 === 1) console.log(`[Bot] A* FAILED from (${currentTX},${currentTY}) to (${goal.tileX},${goal.tileY}) in ${this.currentRoom}, fallback to direct, monsters=${room.monsters.size}`);
        this.moveTowardTile(player, goal.tileX, goal.tileY);
        return;
      }
    }

    // Follow path
    if (goal._pathIndex >= goal._path.length) {
      goal._path = null;
      return;
    }

    const target = goal._path[goal._pathIndex];
    const targetPX = (target.x + 0.5) * TILE_SIZE;
    const targetPY = (target.y + 0.5) * TILE_SIZE;
    const dx = targetPX - player.x;
    const dy = targetPY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (goal._totalTicks % 100 === 0 && goal._totalTicks > 0) {
      console.log(`[Bot:path] tick=${goal._totalTicks} pos=(${currentTX},${currentTY}) px=(${Math.round(player.x)},${Math.round(player.y)}) node=${goal._pathIndex}/${goal._path.length} target=(${target.x},${target.y}) dist=${Math.round(dist)} stall=${goal._nodeStallTicks||0} monsters=${room.monsters.size}`);
    }

    if (dist < TILE_SIZE * 0.4) {
      goal._pathIndex++;
      goal._nodeStallTicks = 0;
      if (goal._pathIndex >= goal._path.length) {
        goal._path = null;
        this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
        return;
      }
    } else {
      // Track how long we've been stuck on the same path node
      if (!goal._nodeStallTicks) goal._nodeStallTicks = 0;
      goal._nodeStallTicks++;
      if (goal._nodeStallTicks > 90) {
        // Stuck on a node for too long — re-path from current position
        // Try monster-avoidant pathing: block tiles occupied by monsters
        goal._nodeStallTicks = 0;
        goal._monsterAvoidRetries = (goal._monsterAvoidRetries || 0) + 1;
        if (goal._monsterAvoidRetries <= 3 && room.monsters && room.monsters.size > 0) {
          const monsterTiles = this._getMonsterBlockedTiles(room);
          const blockedExits = this._getBlockedExitSet(room.dungeon);
          if (blockedExits) for (const k of blockedExits) monsterTiles.add(k);
          const avoidPath = astarPath(room.dungeon, currentTX, currentTY, goal.tileX, goal.tileY, monsterTiles);
          if (avoidPath && avoidPath.length > 0) {
            goal._path = avoidPath;
            goal._pathIndex = 0;
            return;
          }
        }
        // Fallback: re-path without monster avoidance
        goal._path = null;
        return;
      }
    }

    // Check if the next path tile is a closed door — if so, interact to open it
    const nextTarget = goal._path[Math.min(goal._pathIndex, goal._path.length - 1)];
    const curRoom = this.getRoom();
    if (curRoom) {
      const tileId = curRoom.dungeon.data[nextTarget.y * curRoom.dungeon.width + nextTarget.x];
      const tileset = content.getTileset(curRoom.dungeon.tileset);
      if (tileset) {
        const tileDef = tileset.tiles[String(tileId)];
        if (tileDef && tileDef.solid && tileDef.interactable && tileDef.togglesTo != null) {
          // Check if door has unmet conditions (e.g. hasFlag)
          if (tileDef.conditions && Array.isArray(tileDef.conditions)) {
            const flags = this.gameLoop.flagStore.getPlayerFlags(PLAYER_ID);
            const conditionsMet = tileDef.conditions.every(cond => {
              if (cond.hasFlag) return !!flags[cond.hasFlag];
              return true;
            });
            if (!conditionsMet && !goal._triedNpcForDoor) {
              goal._triedNpcForDoor = true;
              const neededFlags = tileDef.conditions.filter(c => c.hasFlag).map(c => c.hasFlag);
              console.log(`[Bot] Door needs flags: ${neededFlags.join(', ')}; player flags: ${JSON.stringify(flags)}`);
              // Try to find tile interactions that set the needed flags (e.g. junction puzzles).
              // Build a chain of tile interactions in reverse dependency order so the bot
              // solves prerequisite steps first (e.g. Junction A before Junction B).
              const tileGoals = [];
              const visited = new Set();
              const resolveFlag = (flag) => {
                if (visited.has(flag)) return;
                visited.add(flag);
                if (flags[flag]) return; // Already have this flag
                const doorInfo = findDoorThatSetsFlag(flag, curRoom.dungeon.id);
                if (!doorInfo) return;
                // Check if the trigger that sets this flag has its own prerequisites
                const triggerDungeon = content.getDungeon(curRoom.dungeon.id);
                if (triggerDungeon && triggerDungeon.triggers) {
                  for (const trig of triggerDungeon.triggers) {
                    if (trig.event !== 'door_interacted') continue;
                    if (!trig.filter || trig.filter.tileX !== doorInfo.tileX || trig.filter.tileY !== doorInfo.tileY) continue;
                    if (trig.conditions) {
                      for (const c of trig.conditions) {
                        if (c.hasFlag && !flags[c.hasFlag]) resolveFlag(c.hasFlag);
                      }
                    }
                    break;
                  }
                }
                tileGoals.push({ type: 'interact_with_tile', tileX: doorInfo.tileX, tileY: doorInfo.tileY, room: this.currentRoom });
              };
              for (const flag of neededFlags) resolveFlag(flag);
              if (tileGoals.length > 0) {
                console.log(`[Bot] Resolved door flags via ${tileGoals.length} tile interaction(s)`);
                // Push in reverse so the first prerequisite is on top of the goal stack
                for (let i = tileGoals.length - 1; i >= 0; i--) {
                  this.pushGoal(tileGoals[i]);
                }
                return;
              }
              // Fall back to NPC interaction
              if (curRoom.npcs && curRoom.npcs.size > 0) {
                for (const [, npc] of curRoom.npcs) {
                  this.pushGoal({ type: 'interact_with_npc', npcType: npc.type, room: this.currentRoom });
                  return;
                }
              }
            }
          }
          // Move toward the door, then interact
          const doorDist = Math.abs(currentTX - nextTarget.x) + Math.abs(currentTY - nextTarget.y);
          if (doorDist <= 2) {
            this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
            this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
            return;
          }
        }
      }
    }

    // Set input toward next path node
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
      // Use move_to_position sub-goal for proper pathfinding with door handling
      // Tolerance 0: stand ON the NPC tile so we're not near doors that would
      // steal the interaction (tryInteract checks doors before NPCs)
      const npcTile = pixelToTile(targetNpc.x, targetNpc.y);
      this.pushGoal({ type: 'move_to_position', tileX: npcTile.tx, tileY: npcTile.ty, tolerance: 0 });
      return;
    } else {
      // Close enough — interact
      this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
      const result = this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
      // If we picked up an item, toggled a door, or interacted with the wrong NPC,
      // move closer to the target NPC and retry
      if (result && (result.interactType === 'pickup' || result.interactType === 'door' ||
          (result.npcId && !result.npcId.includes(goal.npcType)))) {
        if (!goal._retryCloser) {
          goal._retryCloser = true;
          const npcTile = pixelToTile(targetNpc.x, targetNpc.y);
          this.pushGoal({ type: 'move_to_position', tileX: npcTile.tx, tileY: npcTile.ty, tolerance: 0 });
        }
        return;
      }
      this.stats.exploration.npcsInteracted.add(targetNpc.type);
      this.popGoal();
    }
  }

  doInteractWithTile(goal, player, room) {
    if (!room) { this.popGoal(); return; }

    // Check if we're in the right room
    if (goal.room && this.currentRoom !== goal.room) {
      this.pushGoal({ type: 'navigate_to_room', room: goal.room });
      return;
    }

    const targetTX = goal.tileX;
    const targetTY = goal.tileY;
    const ptx = Math.floor(player.x / TILE_SIZE);
    const pty = Math.floor(player.y / TILE_SIZE);
    const dist = Math.abs(ptx - targetTX) + Math.abs(pty - targetTY);

    if (dist > 2) {
      // Navigate to adjacent tile
      this.pushGoal({ type: 'move_to_position', tileX: targetTX, tileY: targetTY, tolerance: 1 });
      return;
    }

    // Close enough — interact. tryInteract prioritizes items over doors,
    // so retry if we picked up an item instead of interacting with the tile.
    if (!goal._retries) goal._retries = 0;
    this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, { up: false, down: false, left: false, right: false });
    const result = this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
    if (result && result.interactType === 'pickup') {
      // Picked up an item instead — retry on next tick (up to 10 retries)
      goal._retries++;
      if (goal._retries < 10) return;
    }
    console.log(`[Bot] Interacted with tile (${targetTX},${targetTY})`);
    this.popGoal();
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
      // Delegate to move_to_position which handles doors and pathfinding
      const itemTile = pixelToTile(targetItem.x, targetItem.y);
      if (!goal._moveAttempts) goal._moveAttempts = 0;
      if (goal._moveAttempts < 3) {
        goal._moveAttempts++;
        this.pushGoal({ type: 'move_to_position', tileX: itemTile.tx, tileY: itemTile.ty, tolerance: 0 });
        return;
      }
      // All move attempts exhausted — try one last direct approach then give up
      this.moveTowardTile(player, itemTile.tx, itemTile.ty);
      this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
      if (!goal._directAttempts) goal._directAttempts = 0;
      goal._directAttempts++;
      if (goal._directAttempts >= 30) {
        // Can't reach item, pop and let parent goal handle recovery
        this.popGoal();
      }
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
      return;
    }

    // Timeout: if flag isn't set after 300 ticks (~20s), it's unresolvable
    if (!goal._waitTicks) goal._waitTicks = 0;
    goal._waitTicks++;
    if (goal._waitTicks > 300) {
      console.log(`[Bot] wait_for_flag "${goal.flag}" timed out after 300 ticks — marking as unresolvable`);
      if (goal.questId) {
        this.failedQuestPrereqs.add(goal.questId);
        this._abandonQuestGoals(goal.questId);
      } else {
        this.popGoal();
      }
      return;
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

  // Remove all goals belonging to a failed quest from the goal stack
  _abandonQuestGoals(questId) {
    const before = this.goals.length;
    this.goals = this.goals.filter(g => g.questId !== questId);
    this.currentPath = null;
    // Reset _lastResolvedHop on remaining navigate goals so blocked exits get re-evaluated
    for (const g of this.goals) {
      if (g.type === 'navigate_to_room' && g._lastResolvedHop) {
        g._lastResolvedHop = null;
      }
    }
    this.ticksWithoutProgress = 0;
    console.log(`[Bot] Abandoned ${before - this.goals.length} goals for quest "${questId}"`);
  }

  doWaitForItem(goal, player) {
    if (player.inventory.some(i => i.type === goal.itemType)) {
      this.popGoal();
      return;
    }

    // Timeout for side-quest item goals: if item isn't obtained after 300 ticks (~20s),
    // the prereq chain is unresolvable — abandon the quest and skip the blocked exit
    if (goal.questId && goal.questId !== 'main_quest') {
      if (!goal._waitTicks) goal._waitTicks = 0;
      goal._waitTicks++;
      if (goal._waitTicks > 300) {
        console.log(`[Bot] wait_for_item "${goal.itemType}" timed out after 300 ticks — abandoning quest "${goal.questId}"`);
        this.failedQuestPrereqs.add(goal.questId);
        this._abandonQuestGoals(goal.questId);
        return;
      }
    }

    // Depth recovery: if we should be in a proc room at a specific depth but aren't, re-navigate
    if (goal.templateId && goal.expectedDepth) {
      const inCorrectProc = this.currentRoom.startsWith('proc:' + goal.templateId + ':');
      const currentDepth = inCorrectProc ? this._getProcDepth(this.getRoom()) : -1;
      if (!inCorrectProc || currentDepth !== goal.expectedDepth) {
        goal._depthRetryCount = (goal._depthRetryCount || 0) + 1;

        // After too many depth recovery cycles (bot keeps dying or getting ejected),
        // abandon the goal to prevent infinite quarantine loops.
        if (goal._depthRetryCount > 12) {
          console.log(`[Bot] wait_for_item "${goal.itemType}" exceeded ${goal._depthRetryCount} depth recovery attempts — giving up`);
          if (goal.questId) {
            this.failedQuestPrereqs.add(goal.questId);
            this._abandonQuestGoals(goal.questId);
          } else {
            this.popGoal();
          }
          return;
        }

        // On retry, clear once-trigger flags for this template so that item-spawning
        // triggers (e.g. warlord_killed) can fire again on a fresh room instance.
        // Without this, killing the boss then dying before pickup permanently prevents
        // the item from ever spawning again.
        this._clearOnceTriggerFlags(goal.templateId);

        // Reset state for retry — clear tile target too so stale coordinates from a
        // previous room instance don't misdirect the bot in the new room.
        goal._killingMonsters = false;
        goal._searchedTiles = false;
        goal._killRetryCount = 0;
        goal._targetTileX = null;
        goal._targetTileY = null;
        goal._movedToTile = false;
        goal._interactCooldown = 0;
        goal._resetKilled = false;
        this.pushGoal({ type: 'traverse_procedural', templateId: goal.templateId, targetDepth: goal.expectedDepth });
        return;
      }
    }

    // Actively try to pick up the item if it's on the ground in current room
    const room = this.getRoom();
    if (!room) return;

    // Check if item is on the ground already
    for (const [, item] of room.items) {
      if (item.type === goal.itemType) {
        this.pushGoal({ type: 'pick_up_item', itemType: goal.itemType });
        return;
      }
    }

    // If in a procedural room and we know the specific tile type to look for
    // (e.g. a chest/crate), search for it and interact. Only do this when
    // targetTileType is set — if we're waiting for a monster drop we must NOT
    // fixate on random corridor doors, which would prevent the bot from ever
    // reaching the monster.
    if (this.currentRoom.startsWith('proc:') && goal.targetTileType != null) {
      if (!goal._searchedTiles) {
        goal._searchedTiles = true;
        const interactableTile = this._findInteractableTile(room, goal.targetTileType);
        if (interactableTile) {
          goal._targetTileX = interactableTile.tx;
          goal._targetTileY = interactableTile.ty;
        }
      }

      if (goal._targetTileX != null) {
        // Kill monsters before attempting chest interaction — they may block the path
        // and their presence prevents reliable melee-range interaction.
        if (room.monsters.size > 0 && !goal._killingMonsters) {
          goal._killingMonsters = true;
          goal._killRetryCount = (goal._killRetryCount || 0) + 1;
          if (goal._killRetryCount <= 5) {
            this.pushGoal({ type: 'kill_monsters' });
            return;
          }
        }
        if (room.monsters.size === 0) goal._killingMonsters = false;

        const { tx: ptx, ty: pty } = pixelToTile(player.x, player.y);
        const dist = Math.abs(ptx - goal._targetTileX) + Math.abs(pty - goal._targetTileY);
        // Navigate toward the tile if far away; track whether we've already
        // attempted a move so we don't loop between move_to_position and dist check
        // (A* can route to a diagonal neighbor satisfying tolerance but dist==2)
        if (dist > 2 || (dist > 1 && !goal._movedToTile)) {
          goal._movedToTile = true;
          this.pushGoal({ type: 'move_to_position', tileX: goal._targetTileX, tileY: goal._targetTileY, tolerance: 1 });
          return;
        }

        // Close enough — try interacting periodically
        if (!goal._interactCooldown) goal._interactCooldown = 0;
        goal._interactCooldown--;
        if (goal._interactCooldown <= 0) {
          goal._interactCooldown = 15;
          const result = this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
          // If interaction failed (too far), try moving even closer
          if (!result && dist > 1) {
            goal._movedToTile = false;
          }
          // If the tile interaction returned a fail message, check whether we're
          // missing a required item (e.g. lost the supply_crate_key on death).
          // Push a recovery goal to re-acquire the item before trying again.
          if (result && result.interactType === 'message') {
            const tileset = content.getTileset(room.dungeon.tileset);
            if (tileset) {
              const tileId = room.dungeon.data[goal._targetTileY * room.dungeon.width + goal._targetTileX];
              const tileDef = tileset.tiles[String(tileId)];
              if (tileDef && tileDef.conditions) {
                for (const cond of tileDef.conditions) {
                  if (cond.hasItem && !player.inventory.some(i => i.type === cond.hasItem)) {
                    console.log(`[Bot] Chest at (${goal._targetTileX},${goal._targetTileY}) needs "${cond.hasItem}" which was lost — pushing recovery goal (depth ${(goal.expectedDepth || 0) + 1})`);
                    // Clear tile state so we don't immediately retry the chest
                    goal._targetTileX = null;
                    goal._targetTileY = null;
                    goal._searchedTiles = false;
                    goal._movedToTile = false;
                    goal._interactCooldown = 0;
                    // Navigate back to the deeper floor where the item is obtained
                    if (goal.templateId && goal.expectedDepth) {
                      this.pushGoal({ type: 'wait_for_item', itemType: cond.hasItem, templateId: goal.templateId, expectedDepth: goal.expectedDepth + 1, questId: goal.questId });
                    }
                    break;
                  }
                }
              }
            }
          }
        }
        return;
      }
    }

    // Kill monsters if item wasn't on ground and no interactable tile target —
    // monsters might drop the item
    // Reset _killingMonsters after kill_monsters pops (allow retry with cooldown)
    if (room.monsters.size > 0 && !goal._killingMonsters) {
      goal._killingMonsters = true;
      goal._killRetryCount = (goal._killRetryCount || 0) + 1;
      // Give up after 5 kill attempts (monsters are truly unreachable)
      if (goal._killRetryCount <= 5) {
        this.pushGoal({ type: 'kill_monsters' });
        return;
      }
    }
    if (room.monsters.size === 0 || (goal._killingMonsters && !this.goals.some(g => g.type === 'kill_monsters'))) {
      goal._killingMonsters = false;
    }

    // If at correct proc depth but no monsters remain and item still not obtained,
    // the quest monster may be permanently dead (tracked in killedMonsters) from a
    // previous visit where the bot got the item, died, and lost it. Clear the killed
    // state to allow a fresh respawn on re-entry.
    if (room.monsters.size === 0 && goal.templateId && goal.expectedDepth && !goal._resetKilled) {
      const inCorrectProc = this.currentRoom.startsWith('proc:' + goal.templateId + ':');
      const currentDepth = inCorrectProc ? this._getProcDepth(this.getRoom()) : -1;
      if (inCorrectProc && currentDepth === goal.expectedDepth) {
        console.log(`[Bot] Depth ${currentDepth} of "${goal.templateId}" — no monsters, no "${goal.itemType}". Resetting killedMonsters and once-triggers for fresh respawn.`);
        for (const dId of [...this.gameLoop.killedMonsters.keys()]) {
          if (dId.includes(':' + goal.templateId + ':')) {
            this.gameLoop.killedMonsters.delete(dId);
          }
        }
        // Also clear once-trigger flags so item-spawning triggers fire again
        this._clearOnceTriggerFlags(goal.templateId);
        goal._resetKilled = true;
        goal._killingMonsters = false;
        goal._killRetryCount = 0;
        goal._searchedTiles = false;
        goal._targetTileX = null;
        goal._targetTileY = null;
        goal._movedToTile = false;
        goal._interactCooldown = 0;
        // Navigate to shallower depth first to force room destruction, then back down
        // so the fresh room spawns monsters from scratch.
        if (goal.expectedDepth > 1) {
          this.pushGoal({ type: 'traverse_procedural', templateId: goal.templateId, targetDepth: goal.expectedDepth });
          this.pushGoal({ type: 'traverse_procedural', templateId: goal.templateId, targetDepth: goal.expectedDepth - 1 });
        } else {
          this.pushGoal({ type: 'traverse_procedural', templateId: goal.templateId, targetDepth: goal.expectedDepth });
          this.pushGoal({ type: 'find_exit_in_room', exitType: 'stairs_up' });
        }
        return;
      }
    }

    // Fallback: try interacting periodically (for non-proc rooms or when no target)
    if (this.currentRoom.startsWith('proc:')) {
      if (!goal._interactCooldown) goal._interactCooldown = 0;
      goal._interactCooldown--;
      if (goal._interactCooldown <= 0) {
        goal._interactCooldown = 15;
        this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
      }
    }
  }

  _findInteractableTile(room, targetTileType) {
    const tileset = content.getTileset(room.dungeon.tileset);
    if (!tileset) return null;
    let fallback = null;
    for (let y = 0; y < room.dungeon.height; y++) {
      for (let x = 0; x < room.dungeon.width; x++) {
        const tileId = room.dungeon.data[y * room.dungeon.width + x];
        const tileDef = tileset.tiles[String(tileId)];
        if (!tileDef || !tileDef.interactable) continue;
        // If a specific tile type was requested, match it exactly
        if (targetTileType != null && tileId === targetTileType) {
          return { tx: x, ty: y };
        }
        // Prefer tiles with conditions (chests, locked crates) over regular doors
        if (tileDef.conditions) {
          return { tx: x, ty: y };
        }
        if (!fallback) {
          fallback = { tx: x, ty: y };
        }
      }
    }
    return fallback;
  }

  // Scan for a locked/conditional door between player and goal that blocks A*
  _findBlockingDoor(room, fromTX, fromTY, toTX, toTY) {
    const tileset = content.getTileset(room.dungeon.tileset);
    if (!tileset) return null;
    const flags = this.gameLoop.flagStore.getPlayerFlags(PLAYER_ID);

    // Scan all tiles in the bounding box between player and goal
    const minX = Math.max(0, Math.min(fromTX, toTX) - 1);
    const maxX = Math.min(room.dungeon.width - 1, Math.max(fromTX, toTX) + 1);
    const minY = Math.max(0, Math.min(fromTY, toTY) - 1);
    const maxY = Math.min(room.dungeon.height - 1, Math.max(fromTY, toTY) + 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tileId = room.dungeon.data[y * room.dungeon.width + x];
        const tileDef = tileset.tiles[String(tileId)];
        if (!tileDef || !tileDef.solid || !tileDef.interactable || tileDef.togglesTo == null) continue;
        if (!tileDef.conditions || !Array.isArray(tileDef.conditions)) continue;
        // Check if conditions are unmet
        const conditionsMet = tileDef.conditions.every(cond => {
          if (cond.hasFlag) return !!flags[cond.hasFlag];
          if (cond.hasItem) {
            const player = this.getPlayer();
            return player && player.inventory.some(i => i.type === cond.hasItem);
          }
          return true;
        });
        if (!conditionsMet) {
          return { tx: x, ty: y, tileDef };
        }
      }
    }
    return null;
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

    // First attempt: try interacting at current position
    const result = this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
    const { tx: _dbgTX, ty: _dbgTY } = pixelToTile(player.x, player.y);
    if (goal.stepId) console.log(`[Bot:interact] step=${goal.stepId} pos=(${_dbgTX},${_dbgTY}) result=${result ? result.interactType : 'null'} room=${this.currentRoom}`);
    if (result && result.interactType) {
      this.popGoal();
      return;
    }

    // Nothing in range — find nearest interactable tile and navigate to it
    if (!goal._navigating) {
      const tileset = content.getTileset(room.dungeon.tileset);
      if (!tileset) { this.popGoal(); return; }

      const { tx: ptx, ty: pty } = pixelToTile(player.x, player.y);
      let bestTile = null;
      let bestDist = Infinity;

      for (let y = 0; y < room.dungeon.height; y++) {
        for (let x = 0; x < room.dungeon.width; x++) {
          const tileId = room.dungeon.data[y * room.dungeon.width + x];
          const tileDef = tileset.tiles[String(tileId)];
          if (!tileDef || !tileDef.interactable) continue;
          const dist = Math.abs(x - ptx) + Math.abs(y - pty);
          if (dist < bestDist) {
            bestDist = dist;
            bestTile = { x, y };
          }
        }
      }

      if (bestTile) {
        goal._navigating = true;
        // Push move_to_position with tolerance 1 (adjacent to the tile)
        this.pushGoal({ type: 'move_to_position', tileX: bestTile.x, tileY: bestTile.y, tolerance: 1 });
        return;
      }

      // No interactable tiles found
      this.popGoal();
      return;
    }

    // Already navigated but still no interaction — retry once more then give up
    const retry = this.gameLoop.tryInteract(this.currentRoom, PLAYER_ID);
    if (retry && retry.interactType) {
      this.popGoal();
      return;
    }
    // Give up after navigation + retry
    this.popGoal();
  }

  doSolGridPlace(goal, player) {
    // Find the component in inventory
    const idx = player.inventory.findIndex(i => i.type === goal.itemType);
    if (idx < 0) { this.popGoal(); return; }

    // Place at specified grid position, or try to find a valid position
    const gridX = goal.gridX || 0;
    const gridY = goal.gridY || 0;

    let placed = false;
    const result = this.gameLoop.trySolGridPlace(this.currentRoom, PLAYER_ID, idx, gridX, gridY);
    if (result && result.ok) {
      placed = true;
    } else {
      // Try adjacent positions
      const positions = [[1,2],[2,1],[3,2],[2,3],[0,2],[2,0],[1,1],[3,3],[0,0],[1,0],[2,2],[3,1],[0,1],[1,3],[3,0],[0,3]];
      for (const [gx, gy] of positions) {
        const r = this.gameLoop.trySolGridPlace(this.currentRoom, PLAYER_ID, idx, gx, gy);
        if (r && r.ok) { placed = true; break; }
      }
    }

    // Replicate flag-setting that index.js does for sol grid placements
    if (placed && goal.itemType === 'damage_booster_chip') {
      this.gameLoop.flagStore.setFlag(PLAYER_ID, this.currentRoom, 'damage_booster_equipped', true);
      this.gameLoop.eventBus.emit('flag_changed', {
        playerId: PLAYER_ID,
        roomId: this.currentRoom,
        flag: 'damage_booster_equipped',
        value: true,
        scope: 'player',
      });
    }
    this.popGoal();
  }

  doKillMonsters(goal, player, room) {
    if (!room || room.monsters.size === 0) {
      this.popGoal();
      return;
    }

    // Timeout: track total monster HP — if no damage dealt for 450 ticks, give up.
    // Generous enough for the bot to navigate ~15 A* tiles around walls.
    let totalHP = 0;
    for (const [, mob] of room.monsters) totalHP += mob.health;
    if (!goal._lastTotalHP) goal._lastTotalHP = totalHP;
    if (!goal._stuckTicks) goal._stuckTicks = 0;
    if (totalHP < goal._lastTotalHP) {
      goal._lastTotalHP = totalHP;
      goal._stuckTicks = 0;
    } else {
      goal._stuckTicks++;
      if (goal._stuckTicks > 450) {
        this.popGoal(); // Can't reach/damage remaining monsters
        return;
      }
    }

    // Find nearest reachable monster and navigate to it using move_to_position
    // for robust A* pathfinding with door handling and stuck detection.
    const { tx: ptx, ty: pty } = pixelToTile(player.x, player.y);
    const monsters = [];
    for (const [mid, mob] of room.monsters) {
      const dx = mob.x - player.x;
      const dy = mob.y - player.y;
      monsters.push({ id: mid, mob, dist: Math.sqrt(dx * dx + dy * dy) });
    }
    monsters.sort((a, b) => a.dist - b.dist);

    for (const { mob, dist } of monsters) {
      // If at melee range, stop navigating — combat handles it from here
      const meleeRange = (CONSTANTS.PLAYER_ATTACK_RANGE || 1.5) * TILE_SIZE;
      if (dist <= meleeRange) return;

      const mobTile = pixelToTile(mob.x, mob.y);
      // If monster is standing on an exit tile, target an adjacent non-exit floor
      // tile instead to avoid triggering an unintended room transition.
      let targetTX = mobTile.tx;
      let targetTY = mobTile.ty;
      if (room.dungeon.exits) {
        const onExit = room.dungeon.exits.some(e => e.x === targetTX && e.y === targetTY);
        if (onExit) {
          const offsets = [[0, -1], [0, 1], [-1, 0], [1, 0]];
          let redirected = false;
          for (const [ox, oy] of offsets) {
            const nx = targetTX + ox;
            const ny = targetTY + oy;
            if (nx >= 0 && ny >= 0 && nx < room.dungeon.width && ny < room.dungeon.height &&
                !isTileSolid(room.dungeon, nx, ny) &&
                !room.dungeon.exits.some(e => e.x === nx && e.y === ny)) {
              targetTX = nx;
              targetTY = ny;
              redirected = true;
              break;
            }
          }
          if (!redirected) continue; // No safe approach tile — skip this monster
        }
      }
      const path = astarPath(room.dungeon, ptx, pty, targetTX, targetTY);
      if (path && path.length > 0) {
        // Push a move_to_position sub-goal to walk to the monster's vicinity.
        // tolerance=1 so we get close enough for reliable line-of-sight combat.
        this.pushGoal({ type: 'move_to_position', tileX: targetTX, tileY: targetTY, tolerance: 1 });
        return;
      }
    }
    // No reachable monster or all within combat range — doCombat handles it
  }

  doExploreRoom(goal, player, room) {
    if (!room) { this.popGoal(); return; }

    // Explore: interact with all NPCs, pick up all items, open all doors.
    // In explore mode (goal.doorsOnly) skip NPCs/items to save time budget.
    if (!goal._explored) {
      const startPhase = goal.doorsOnly ? 'doors' : 'npcs';
      goal._explored = { npcs: [], items: [], doors: [], phase: startPhase, idx: 0 };
      // Collect all NPCs and items in this room (skip if doorsOnly)
      if (!goal.doorsOnly) {
        for (const [npcId, npc] of room.npcs) {
          goal._explored.npcs.push(npc);
        }
        for (const [itemId, item] of room.items) {
          goal._explored.items.push(item);
        }
      }
      // Find interactable tiles (doors, crates, etc.)
      const tileset = content.getTileset(room.dungeon.tileset);
      if (tileset) {
        for (let y = 0; y < room.dungeon.height; y++) {
          for (let x = 0; x < room.dungeon.width; x++) {
            const tileId = room.dungeon.data[y * room.dungeon.width + x];
            const tileDef = tileset.tiles[String(tileId)];
            if (tileDef && tileDef.interactable && tileDef.togglesTo != null) {
              goal._explored.doors.push({ tx: x, ty: y });
            }
          }
        }
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
      exp.phase = 'doors';
      exp.idx = 0;
    }

    if (exp.phase === 'doors') {
      if (exp.idx >= exp.doors.length) {
        exp.phase = 'done';
      } else {
        const door = exp.doors[exp.idx];
        exp.idx++;
        // Move near the door, then interact
        this.pushGoal({ type: 'interact_nearest' });
        this.pushGoal({ type: 'move_to_position', tileX: door.tx, tileY: door.ty, tolerance: 1 });
        return;
      }
    }

    if (exp.phase === 'done') {
      this.popGoal();
    }
  }

  // ── Procedural Dungeon Traversal ────────────────────────────────────

  doTraverseProcedural(goal, player, room) {
    // Timeout: give up traversal after 3000 real ticks (~200s game time)
    // Use wall-clock tick counter since this goal is only active briefly between sub-goals
    if (!goal._startTick) goal._startTick = this._globalTick || 0;
    const elapsed = (this._globalTick || 0) - goal._startTick;
    if (elapsed > 3000) {
      this.popGoal();
      return;
    }

    // Phase 1: If we're not yet in a proc room for this template, navigate to entry
    const isInProcRoom = this.currentRoom.startsWith('proc:' + goal.templateId + ':');
    if (!isInProcRoom) {
      // Check if we've already completed this (have the required items/flags)
      // If not, navigate to the entry dungeon and walk to the exit
      const entry = findEntryToTemplate(goal.templateId);
      if (!entry) {
        this.popGoal(); // Can't find entry point
        return;
      }

      if (this.currentRoom !== entry.dungeonId) {
        // Navigate to the entry dungeon first
        this.pushGoal({ type: 'navigate_to_room', room: entry.dungeonId });
        return;
      }

      // We're in the entry dungeon — walk to the exit tile
      this.pushGoal({ type: 'move_to_position', tileX: entry.exitX, tileY: entry.exitY, tolerance: 0 });
      return;
    }

    // Phase 2: We're inside a proc room — determine current depth
    const currentDepth = this._getProcDepth(room);

    if (currentDepth < goal.targetDepth) {
      // Always clear monsters before descending — rushing past enemies drains
      // HP and leads to repeated deaths in deeper floors (quarantine loop bug).
      // Limit to 3 kill attempts per depth to avoid infinite kill/retry loops
      // when some monsters are unreachable.
      goal._killAttempts = goal._killAttempts || 0;
      if (!goal._clearingMonsters && room.monsters && room.monsters.size > 0 && goal._killAttempts < 3) {
        goal._clearingMonsters = true;
        goal._killAttempts++;
        this.pushGoal({ type: 'kill_monsters' });
        return;
      }
      goal._clearingMonsters = false;
      // Reset kill attempts when we descend (new depth, new monsters)
      goal._killAttempts = 0;
      // Need to go deeper — find the descent exit (stairs_down)
      this.pushGoal({ type: 'find_exit_in_room', exitType: 'stairs_down' });
      return;
    }

    if (currentDepth > goal.targetDepth) {
      goal._killAttempts = goal._killAttempts || 0;
      if (!goal._clearingMonsters && room.monsters && room.monsters.size > 0 && goal._killAttempts < 3) {
        goal._clearingMonsters = true;
        goal._killAttempts++;
        this.pushGoal({ type: 'kill_monsters' });
        return;
      }
      goal._clearingMonsters = false;
      goal._killAttempts = 0;
      // Need to go back up — find the entrance exit (stairs_up)
      this.pushGoal({ type: 'find_exit_in_room', exitType: 'stairs_up' });
      return;
    }

    // Phase 3: We're at the target depth — explore (kill monsters, pick up items, interact)
    // Remove this goal and let subsequent goals handle specifics
    this.popGoal();
  }

  doFindExitInRoom(goal, player, room) {
    if (!room || !room.dungeon.exits) {
      this.popGoal();
      return;
    }

    // Find exit of the requested type
    let targetExit = null;
    for (const exit of room.dungeon.exits) {
      if (exit.type === goal.exitType) {
        targetExit = exit;
        break;
      }
    }

    if (!targetExit) {
      // No exit of this type found — try any exit
      this.popGoal();
      return;
    }

    const { tx: currentTX, ty: currentTY } = pixelToTile(player.x, player.y);
    if (currentTX === targetExit.x && currentTY === targetExit.y) {
      // Standing on exit — transition should happen automatically
      this.popGoal();
      return;
    }

    // Move to the exit tile
    this.popGoal();
    this.pushGoal({ type: 'move_to_position', tileX: targetExit.x, tileY: targetExit.y, tolerance: 0 });
  }

  _getProcDepth(room) {
    // Determine depth from room's dungeon data or from exits
    if (room.dungeon.depth != null) return room.dungeon.depth;
    // Fallback: look at the descent exit's depth minus 1
    if (room.dungeon.exits) {
      for (const exit of room.dungeon.exits) {
        if (exit.type === 'stairs_down' && exit.depth != null) {
          return exit.depth - 1;
        }
      }
      // If only stairs_up exists, we're at max depth
      const hasDown = room.dungeon.exits.some(e => e.type === 'stairs_down');
      if (!hasDown) {
        // At deepest level — determine from template
        const hasUp = room.dungeon.exits.some(e => e.type === 'stairs_up');
        if (hasUp) {
          // Try to find template max depth
          for (const exit of room.dungeon.exits) {
            if (exit.type === 'stairs_up' && exit.depth != null) {
              return exit.depth + 1;
            }
          }
        }
      }
    }
    return 1; // Default fallback
  }

  // Clear once-trigger flags for a procedural template so item-spawning triggers
  // (like warlord_killed) can fire again when the room is regenerated.
  _clearOnceTriggerFlags(templateId) {
    const flags = this.gameLoop.flagStore.getPlayerFlags(PLAYER_ID);
    const prefix = `__trigger_`;
    const templateSuffix = `_${templateId}_`;
    for (const key of Object.keys(flags)) {
      if (key.startsWith(prefix) && key.includes(templateSuffix)) {
        this.gameLoop.flagStore.setPlayerFlag(PLAYER_ID, key, false);
      }
    }
  }

  // Build a set of tile keys blocked by monster collision circles
  _getMonsterBlockedTiles(room) {
    const blocked = new Set();
    const w = room.dungeon.width;
    for (const [, mob] of room.monsters) {
      // Block the tile the monster center is on plus adjacent tiles within collision radius
      const mtx = Math.floor(mob.x / TILE_SIZE);
      const mty = Math.floor(mob.y / TILE_SIZE);
      // Monster collision radius is 10px, player radius is 12px — together they block
      // any tile the monster overlaps. Block a 1-tile radius around the monster center.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tx = mtx + dx;
          const ty = mty + dy;
          if (tx >= 0 && tx < w && ty >= 0 && ty < room.dungeon.height) {
            blocked.add(ty * w + tx);
          }
        }
      }
    }
    return blocked;
  }

  // ── Movement Helpers ───────────────────────────────────────────────

  moveTowardTile(player, tileX, tileY, opts) {
    const targetPX = (tileX + 0.5) * TILE_SIZE;
    const targetPY = (tileY + 0.5) * TILE_SIZE;
    this.moveTowardPixel(player, targetPX, targetPY, opts);
  }

  moveTowardPixel(player, targetX, targetY, opts) {
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const input = {
      right: dx > 2,
      left: dx < -2,
      down: dy > 2,
      up: dy < -2,
    };

    // Avoid exit tiles during combat to prevent accidental transitions
    if (opts && opts.avoidExits) {
      const room = this.getRoom();
      if (room && room.dungeon.exits && this.transitionCooldownTicks <= 0) {
        const { tx: ptx, ty: pty } = pixelToTile(player.x, player.y);
        for (const exit of room.dungeon.exits) {
          if (input.right && ptx + 1 === exit.x && pty === exit.y) input.right = false;
          if (input.left && ptx - 1 === exit.x && pty === exit.y) input.left = false;
          if (input.down && ptx === exit.x && pty + 1 === exit.y) input.down = false;
          if (input.up && ptx === exit.x && pty - 1 === exit.y) input.up = false;
          if (input.right && input.down && ptx + 1 === exit.x && pty + 1 === exit.y) input.right = false;
          if (input.right && input.up && ptx + 1 === exit.x && pty - 1 === exit.y) input.right = false;
          if (input.left && input.down && ptx - 1 === exit.x && pty + 1 === exit.y) input.left = false;
          if (input.left && input.up && ptx - 1 === exit.x && pty - 1 === exit.y) input.left = false;
        }
      }
    }

    this.gameLoop.setPlayerInput(this.currentRoom, PLAYER_ID, input);
  }

  // ── Progress Tracking ──────────────────────────────────────────────

  trackProgress(player, tick) {
    const pos = `${Math.floor(player.x)},${Math.floor(player.y)}`;
    const flags = JSON.stringify(this.gameLoop.flagStore.getPlayerFlags(PLAYER_ID));
    const invCount = player.inventory.length;

    // Also track monster HP changes as progress (combat = progress)
    const room = this.getRoom();
    let monsterHP = 0;
    if (room) {
      for (const [, mob] of room.monsters) monsterHP += mob.health;
    }

    if (pos === this.lastPos && this.currentRoom === this.lastRoom &&
        flags === this.lastFlags && invCount === this.lastInventoryCount &&
        monsterHP === this._lastTrackMonsterHP) {
      this.ticksWithoutProgress++;
    } else {
      this.ticksWithoutProgress = 0;
    }

    this.lastPos = pos;
    this.lastRoom = this.currentRoom;
    this.lastFlags = flags;
    this.lastInventoryCount = invCount;
    this._lastTrackMonsterHP = monsterHP;
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
  // Track flags that earlier steps' prereqs already plan to resolve
  const prereqVisited = new Set();

  // Resolve quest-level startConditions (e.g. found_basement_note for the_deserter)
  if (quest.startConditions) {
    for (const cond of flattenConditions(quest.startConditions)) {
      if (cond.hasFlag) {
        // Check if the flag is already set
        const flags = gameLoop.flagStore.getPlayerFlags(PLAYER_ID);
        if (flags[cond.hasFlag]) continue;

        // Find what sets this flag — could be a trigger (item pickup, room entry, etc.)
        const flagSource = findRoomThatSetsFlag(cond.hasFlag);
        if (flagSource) {
          // Check if the trigger requires picking up an item first
          if (flagSource.trigger && flagSource.trigger.event === 'item_picked_up' && flagSource.trigger.filter && flagSource.trigger.filter.itemType) {
            const itemType = flagSource.trigger.filter.itemType;
            const itemLoc = findGroundItem(itemType, flagSource.roomId);
            if (itemLoc) {
              goals.push({ type: 'navigate_to_room', room: itemLoc.roomId, questId });
              goals.push({ type: 'pick_up_item', itemType, room: itemLoc.roomId, questId });
            }
          } else {
            goals.push({ type: 'navigate_to_room', room: flagSource.roomId, questId });
            if (flagSource.npcType) {
              goals.push({ type: 'interact_with_npc', npcType: flagSource.npcType, room: flagSource.roomId, questId });
            } else {
              goals.push({ type: 'explore_room', questId });
            }
          }
          goals.push({ type: 'wait_for_flag', flag: cond.hasFlag, retryInteract: true, retryTicks: 15, questId });
        }
        prereqVisited.add(cond.hasFlag);
      }
    }
  }

  for (const stepId of stepOrder) {
    const step = quest.steps[stepId];
    if (!step) continue;

    // Navigate to the step's room if specified
    if (step.objective && step.objective.roomId) {
      const roomId = step.objective.roomId;
      const isTemplate = !!content.getTemplate(roomId);

      if (isTemplate) {
        // Procedural room: navigate to entry dungeon, then traverse depths
        const targetDepth = step.objective.depth || 1;
        goals.push({ type: 'traverse_procedural', templateId: roomId, targetDepth, stepId, questId });
      } else if (content.getDungeon(roomId)) {
        goals.push({ type: 'navigate_to_room', room: roomId, stepId, questId });
        // If the objective has specific tile coordinates, move there
        if (step.objective.tileX != null && step.objective.tileY != null) {
          goals.push({ type: 'move_to_position', tileX: step.objective.tileX, tileY: step.objective.tileY, tolerance: 0, stepId, questId });
        }
        // If the objective specifies a target exit, navigate to its tile
        if (step.objective.targetExit) {
          const dungeon = content.getDungeon(roomId);
          if (dungeon && dungeon.exits) {
            const exit = dungeon.exits.find(e => e.leadsTo === step.objective.targetExit);
            if (exit) {
              goals.push({ type: 'move_to_position', tileX: exit.x, tileY: exit.y, tolerance: 0, stepId, questId });
            }
          }
        }
      }
    }

    // Determine what action to take based on completion conditions
    const conditions = step.completionConditions || [];
    for (const cond of conditions) {
      if (cond.hasFlag) {
        // Find which NPC or trigger sets this flag in the target room
        const roomId = step.objective ? step.objective.roomId : null;
        const isTemplate = roomId && !!content.getTemplate(roomId);
        const npcType = (roomId && !isTemplate) ? findNpcThatSetsFlag(cond.hasFlag, roomId) : null;

        // Check for prerequisite flags needed before this flag can be set
        if (roomId && !isTemplate) {
          const prereqs = findPrereqGoals(cond.hasFlag, roomId, prereqVisited);
          goals.push(...prereqs.map(g => ({ ...g, stepId, questId })));
        }

        if (npcType) {
          goals.push({ type: 'interact_with_npc', npcType, room: roomId, stepId, questId });
        } else if (roomId && !isTemplate) {
          // Flag not set by an NPC in the objective room — search globally
          const globalFlagSource = findRoomThatSetsFlag(cond.hasFlag);
          if (globalFlagSource && globalFlagSource.roomId !== roomId) {
            // Navigate to the room that sets this flag
            goals.push({ type: 'navigate_to_room', room: globalFlagSource.roomId, stepId, questId });
            if (globalFlagSource.npcType) {
              goals.push({ type: 'interact_with_npc', npcType: globalFlagSource.npcType, room: globalFlagSource.roomId, stepId, questId });
            }
            goals.push({ type: 'explore_room', stepId, questId });
          } else {
            // Check if a door_interacted trigger sets this flag (has tile coordinates)
            const doorInfo = findDoorThatSetsFlag(cond.hasFlag, roomId);
            if (doorInfo) {
              goals.push({ type: 'kill_monsters', stepId, questId });
              goals.push({ type: 'interact_with_tile', tileX: doorInfo.tileX, tileY: doorInfo.tileY, room: roomId, stepId, questId });
            } else {
              // General interaction fallback
              goals.push({ type: 'interact_nearest', room: roomId, stepId, questId });
            }
          }
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
        const isTemplate = roomId && !!content.getTemplate(roomId);
        if (roomId && !isTemplate) {
          goals.push({ type: 'pick_up_item', itemType: cond.hasItem, room: roomId, stepId, questId });
        }
        // For procedural rooms, attach template/depth info so wait_for_item can recover
        const waitGoal = { type: 'wait_for_item', itemType: cond.hasItem, stepId, questId };
        if (isTemplate) {
          waitGoal.templateId = roomId;
          waitGoal.expectedDepth = step.objective.depth || 1;
          if (step.objective.targetTile != null) {
            waitGoal.targetTileType = step.objective.targetTile;
          }
        }
        goals.push(waitGoal);
      }
    }
  }

  return goals;
}

// Find a door_interacted trigger that sets a given flag, returning tile coordinates
function findDoorThatSetsFlag(flagName, roomId) {
  const dungeon = content.getDungeon(roomId);
  if (!dungeon || !dungeon.triggers) return null;

  for (const trigger of dungeon.triggers) {
    if (trigger.event !== 'door_interacted') continue;
    if (!trigger.actions) continue;

    const setsFlag = trigger.actions.some(a =>
      (a.type === 'setFlag' && a.flag === flagName) ||
      (a.type === 'incrementFlag' && a.flag === flagName)
    );

    if (setsFlag && trigger.filter) {
      if (trigger.filter.tileX != null && trigger.filter.tileY != null) {
        return { tileX: trigger.filter.tileX, tileY: trigger.filter.tileY };
      }
      // Handle tileName filters by scanning the dungeon for matching tiles
      if (trigger.filter.tileName && dungeon.data) {
        const tileset = content.getTileset(dungeon.tileset);
        if (tileset) {
          for (const [tileIdStr, tileDef] of Object.entries(tileset.tiles)) {
            if (tileDef.name === trigger.filter.tileName) {
              const tileId = parseInt(tileIdStr, 10);
              for (let y = 0; y < dungeon.height; y++) {
                for (let x = 0; x < dungeon.width; x++) {
                  if (dungeon.data[y * dungeon.width + x] === tileId) {
                    return { tileX: x, tileY: y };
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
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

  // Also check NPC dialogueRules — sometimes the flag is set via dialogue interaction.
  // Only consider npc_interacted triggers here; door_interacted triggers are handled
  // separately via findDoorThatSetsFlag and should not cause an NPC interact goal.
  if (dungeon.npcSpawns) {
    for (const spawn of dungeon.npcSpawns) {
      const npcDef = content.getNPC(spawn.type);
      if (!npcDef) continue;
      for (const trigger of (dungeon.triggers || [])) {
        if (trigger.event !== 'npc_interacted') continue;
        if (!trigger.actions) continue;
        const setsFlag = trigger.actions.some(a =>
          (a.type === 'setFlag' && a.flag === flagName)
        );
        if (setsFlag) {
          return spawn.type;
        }
      }
    }
  }

  return null;
}

// Find prerequisite goals needed to set a flag (traces trigger condition chains)
function findPrereqGoals(flagName, roomId, _visited) {
  if (!_visited) _visited = new Set();
  if (_visited.has(flagName)) return [];
  _visited.add(flagName);
  const goals = [];
  const dungeon = content.getDungeon(roomId);
  if (!dungeon || !dungeon.triggers) return goals;

  // Collect all conditions that gate this flag (including choice chains)
  const allConditions = [];

  // Find the trigger that sets this flag
  for (const trigger of dungeon.triggers) {
    if (!trigger.actions) continue;
    const setsFlag = trigger.actions.some(a =>
      (a.type === 'setFlag' && a.flag === flagName) ||
      (a.type === 'giveItem' && a.itemType === flagName)
    );
    if (!setsFlag) continue;

    // Direct conditions on the flag-setting trigger
    if (trigger.conditions) {
      allConditions.push(...extractPositiveFlags(trigger.conditions));
    }

    // If this is a choice_made trigger, trace back to the showChoice trigger
    // that creates the choice, and extract its conditions too
    if (trigger.event === 'choice_made' && trigger.filter && trigger.filter.choiceId) {
      const choiceId = trigger.filter.choiceId;
      for (const offerTrigger of dungeon.triggers) {
        if (!offerTrigger.actions) continue;
        const showsChoice = offerTrigger.actions.some(a =>
          a.type === 'showChoice' && a.choiceId === choiceId
        );
        if (showsChoice && offerTrigger.conditions) {
          allConditions.push(...extractPositiveFlags(offerTrigger.conditions));
        }
      }
    }
  }

  // Also search all dungeons if no conditions found in the specified room
  if (allConditions.length === 0) {
    const globalResult = findRoomThatSetsFlag(flagName);
    if (globalResult && globalResult.trigger) {
      const trigger = globalResult.trigger;
      if (trigger.conditions) {
        allConditions.push(...extractPositiveFlags(trigger.conditions));
      }
      if (trigger.event === 'choice_made' && trigger.filter && trigger.filter.choiceId) {
        const choiceId = trigger.filter.choiceId;
        const globalDungeon = content.getDungeon(globalResult.roomId);
        if (globalDungeon && globalDungeon.triggers) {
          for (const offerTrigger of globalDungeon.triggers) {
            if (!offerTrigger.actions) continue;
            const showsChoice = offerTrigger.actions.some(a =>
              a.type === 'showChoice' && a.choiceId === choiceId
            );
            if (showsChoice && offerTrigger.conditions) {
              allConditions.push(...extractPositiveFlags(offerTrigger.conditions));
            }
          }
        }
      }
      // Use the global room if different from the specified room
      if (globalResult.roomId !== roomId) {
        roomId = globalResult.roomId;
      }
    }
  }

  // Also extract hasItem conditions from the same triggers
  const allItemConditions = [];
  for (const trigger of (dungeon ? dungeon.triggers : [])) {
    if (!trigger.actions) continue;
    const setsFlag = trigger.actions.some(a =>
      (a.type === 'setFlag' && a.flag === flagName) ||
      (a.type === 'giveItem' && a.itemType === flagName)
    );
    if (!setsFlag) continue;
    if (trigger.conditions) allItemConditions.push(...extractPositiveItems(trigger.conditions));
    // Trace choice chains for item conditions too
    if (trigger.event === 'choice_made' && trigger.filter && trigger.filter.choiceId) {
      for (const offerTrigger of (dungeon ? dungeon.triggers : [])) {
        if (!offerTrigger.actions) continue;
        if (offerTrigger.actions.some(a => a.type === 'showChoice' && a.choiceId === trigger.filter.choiceId)) {
          if (offerTrigger.conditions) allItemConditions.push(...extractPositiveItems(offerTrigger.conditions));
        }
      }
    }
  }

  // Generate goals for prerequisite items (pick them up before going to the NPC)
  const seenItems = new Set();
  for (const reqItem of allItemConditions) {
    if (seenItems.has(reqItem)) continue;
    seenItems.add(reqItem);
    const itemLoc = findGroundItem(reqItem, roomId);
    if (itemLoc) {
      goals.push({ type: 'navigate_to_room', room: itemLoc.roomId });
      goals.push({ type: 'pick_up_item', itemType: reqItem, room: itemLoc.roomId });
      goals.push({ type: 'wait_for_item', itemType: reqItem });
    }
  }

  // Generate goals for each prerequisite flag
  const seen = new Set();
  for (const reqFlag of allConditions) {
    if (reqFlag === flagName || seen.has(reqFlag) || _visited.has(reqFlag)) continue;
    seen.add(reqFlag);
    // Find which room/trigger sets this prerequisite flag
    const prereqRoom = findRoomThatSetsFlag(reqFlag);
    if (prereqRoom) {
      const targetRoom = prereqRoom.roomId;
      // Check if this prerequisite flag's trigger also needs items
      const nestedPrereqs = findPrereqGoals(reqFlag, targetRoom, _visited);
      goals.push(...nestedPrereqs);
      goals.push({ type: 'navigate_to_room', room: targetRoom });
      if (prereqRoom.npcType) {
        goals.push({ type: 'interact_with_npc', npcType: prereqRoom.npcType, room: targetRoom });
      }
      // If the flag is set by a door_interacted trigger, navigate to that tile
      const doorInfo = findDoorThatSetsFlag(reqFlag, targetRoom);
      if (doorInfo) {
        goals.push({ type: 'kill_monsters' });
        goals.push({ type: 'interact_with_tile', tileX: doorInfo.tileX, tileY: doorInfo.tileY, room: targetRoom });
      } else {
        goals.push({ type: 'kill_monsters' });
        goals.push({ type: 'explore_room' });
      }
      goals.push({ type: 'wait_for_flag', flag: reqFlag, retryInteract: true, retryTicks: 15 });
      goals.push({ type: 'navigate_to_room', room: roomId });
    }
  }
  return goals;
}

// Extract positive (non-negated) hasFlag values from conditions
function extractPositiveFlags(conditions) {
  const flags = [];
  if (!conditions) return flags;
  if (Array.isArray(conditions)) {
    for (const c of conditions) flags.push(...extractPositiveFlags(c));
    return flags;
  }
  // Direct hasFlag at this level (not inside a not)
  if (conditions.hasFlag) flags.push(conditions.hasFlag);
  // Recurse into and/or but NOT into not
  if (conditions.and) flags.push(...extractPositiveFlags(conditions.and));
  if (conditions.or) flags.push(...extractPositiveFlags(conditions.or));
  // Deliberately skip conditions.not — those are negated
  return flags;
}

// Extract positive (non-negated) hasItem values from conditions
function extractPositiveItems(conditions) {
  const items = [];
  if (!conditions) return items;
  if (Array.isArray(conditions)) {
    for (const c of conditions) items.push(...extractPositiveItems(c));
    return items;
  }
  if (conditions.hasItem) items.push(conditions.hasItem);
  if (conditions.and) items.push(...extractPositiveItems(conditions.and));
  if (conditions.or) items.push(...extractPositiveItems(conditions.or));
  return items;
}

// Find which room contains a trigger that sets a given flag
function findRoomThatSetsFlag(flagName) {
  const dungeons = content.getAllDungeons();
  for (const [roomId, dungeon] of Object.entries(dungeons)) {
    if (!dungeon.triggers) continue;
    for (const trigger of dungeon.triggers) {
      if (!trigger.actions) continue;
      for (const action of trigger.actions) {
        if ((action.type === 'setFlag' && action.flag === flagName) ||
            (action.type === 'incrementFlag' && action.flag === flagName)) {
          const npcType = trigger.filter && trigger.filter.npcType ? trigger.filter.npcType : null;
          return { roomId, npcType, trigger };
        }
      }
    }
  }
  return null;
}

// Find which quest has a step whose completion sets a given flag (via trigger/action)
function findQuestThatSetsFlag(flagName) {
  // First check: does a quest step's completionConditions reference this flag?
  // (meaning some trigger sets it and the quest step monitors it)
  const quests = content.getAllQuests();
  for (const [questId, quest] of Object.entries(quests)) {
    if (!quest.steps) continue;
    for (const [stepId, step] of Object.entries(quest.steps)) {
      if (!step.completionConditions) continue;
      for (const cond of step.completionConditions) {
        if (cond.hasFlag === flagName) return questId;
      }
    }
  }
  return null;
}

// Find where a ground item spawns (returns { roomId, x, y } or null)
// preferRoom: check this room first (useful when item is consumed in the same room)
function findGroundItem(itemType, preferRoom) {
  if (preferRoom) {
    const dungeon = content.getDungeon(preferRoom);
    if (dungeon && dungeon.itemSpawns) {
      for (const spawn of dungeon.itemSpawns) {
        if (spawn.type === itemType) return { roomId: preferRoom, x: spawn.x, y: spawn.y };
      }
    }
  }
  const dungeons = content.getAllDungeons();
  for (const [roomId, dungeon] of Object.entries(dungeons)) {
    if (!dungeon.itemSpawns) continue;
    for (const spawn of dungeon.itemSpawns) {
      if (spawn.type === itemType) return { roomId, x: spawn.x, y: spawn.y };
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

    // 3. Track combat events BEFORE transitions — rooms may be destroyed
    //    during processTransitions (death respawn empties the room), which
    //    would lose death events that haven't been counted yet.
    trackCombatEvents(gameLoop, bot);

    // 4. Process floor transitions and drain death penalties
    processTransitions(gameLoop, bot);
    gameLoop.consumeDeathPenalties();

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

function runQuest(gameLoop, bot, questId, maxSeconds) {
  const quest = content.getQuest(questId);
  if (!quest) {
    return { questId, status: 'error', gameTime: 0, deaths: 0, monstersKilled: 0, error: `Quest "${questId}" not found` };
  }

  const goals = buildQuestGoals(questId, gameLoop, bot.exitGraph);

  // Debug: dump goal list
  console.log(`[Bot:goals] Quest "${questId}" generated ${goals.length} goals:`);
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    const extra = g.room ? ` room=${g.room}` : '';
    const pos = g.tileX != null ? ` (${g.tileX},${g.tileY})` : '';
    const flag = g.flag ? ` flag=${g.flag}` : '';
    const npc = g.npcType ? ` npc=${g.npcType}` : '';
    console.log(`  [${i}] ${g.type}${extra}${pos}${flag}${npc} step=${g.stepId||'-'}`);
  }

  // Push goals in reverse so they execute in order (stack)
  for (let i = goals.length - 1; i >= 0; i--) {
    bot.pushGoal(goals[i]);
  }

  bot.questDeaths = 0;
  bot.questMonstersKilled = 0;
  bot.ticksWithoutProgress = 0;

  const result = runSimulation(gameLoop, bot, maxSeconds || MAX_GAME_SECONDS, questId);

  const questResult = {
    questId,
    status: result.status,
    gameTime: result.gameTime,
    ticks: result.ticks,
    deaths: bot.questDeaths,
    monstersKilled: bot.questMonstersKilled,
    stuckGoal: result.stuckGoal || null,
  };

  // Override status if the quest was abandoned (failedQuestPrereqs) — the sim
  // returns 'completed' when the goal stack empties, but abandoned goals are
  // not real completions.
  if (bot.failedQuestPrereqs.has(questId) && result.status === 'completed') {
    questResult.status = 'timeout';
  }

  bot.stats.questResults.push(questResult);
  if (questResult.status === 'completed') {
    bot.questsCompleted.add(questId);
  }

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

// Flags to pre-grant in explore mode so all doors/gates are passable.
// These are the story progression flags that control physical tile gates
// (tileset conditions) and exit-level transitions across all dungeons.
const EXPLORE_FLAGS = [
  // Tileset-gated physical doors (outpost, crypt, meridian, station tilesets)
  'talked_to_warden',
  'received_weapon',
  'received_sol_unit',
  'fenn_opened_gate',
  'junction_a_activated',
  'relay_junction_complete',
  'has_transit_pass',
  'has_yard_deed',
  'fen_letter_accepted',
  'damage_booster_equipped',
  'engineer_briefing_complete',
  // Exit-level gate flags (dungeon transitions)
  'arrived_meridian',
  'chose_path_control',
  'chose_path_merge',
  'chose_path_shutdown',
  'kappa_coordinates_received',
  'meridian_umbrasite_quest_complete',
  'reached_underlumen_threshold',
];

function runExplore(gameLoop, bot) {
  // Grant all story progression flags so tile gates and exit conditions don't
  // block exploration — the goal is to reach every room, not replay the story.
  for (const flag of EXPLORE_FLAGS) {
    gameLoop.flagStore.setPlayerFlag(PLAYER_ID, flag, true);
  }
  console.log(`[Explore] Pre-granted ${EXPLORE_FLAGS.length} story flags for full dungeon access`);

  // Skip combat in explore mode — the validator only cares about reachability,
  // not survivability. Fighting 30+ monsters wastes the entire time budget.
  bot.skipCombat = true;

  // Boost player health massively so combat doesn't kill the bot in monster rooms.
  // The explore validator cares about reachability, not survivability.
  const startingSpawnRoom = content.getSpawnRoom() || 'outpost_entrance';
  const startRoom = gameLoop.getRoom(startingSpawnRoom);
  if (startRoom) {
    const player = startRoom.players.get(PLAYER_ID);
    if (player) {
      player.maxHealth = 9999;
      player.health = 9999;
    }
  }

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
      const quest = content.getQuest(questId);
      if (quest && quest.startConditions) {
        // Run mainline with a capped timeout to get the bot equipped and
        // positioned, without wasting the full quest budget on late-game stalls
        runQuest(gameLoop, bot, 'main_quest', 1200);
        // Clear mainline goals/state regardless of outcome
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
