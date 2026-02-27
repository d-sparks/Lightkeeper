const CONSTANTS = require('../shared/constants');
const Physics = require('./physics');
const DungeonGenerator = require('./dungeon-generator');
const FlagStore = require('./scripting/flag-store');
const EventBus = require('./scripting/event-bus');
const ConditionEvaluator = require('./scripting/conditions');
const ActionExecutor = require('./scripting/actions');
const TriggerRegistry = require('./scripting/trigger-registry');
const QuestTracker = require('./scripting/quest-tracker');

class GameLoop {
  constructor(content) {
    this.content = content;
    this.physics = new Physics(content);
    this.rooms = new Map();  // roomId -> Room
    this.interval = null;
    this.pendingTransitions = [];

    // Track killed monsters per dungeon so they stay dead across room destruction/recreation
    // Map<dungeonId, Set<spawnKey>>  where spawnKey = "spawnIdx:subIdx"
    this.killedMonsters = new Map();

    // Track picked-up items per dungeon so they stay picked up across room destruction/recreation
    // Map<dungeonId, Set<spawnIndex>>
    this.pickedUpItems = new Map();

    // Procedural dungeon generation
    this.generator = new DungeonGenerator(content);
    this.generatedDungeons = new Map(); // instanceId -> dungeon JSON
    this.serverEpoch = Date.now();

    // Scripting subsystem
    this.flagStore = new FlagStore();
    this.eventBus = new EventBus();
    this.conditions = new ConditionEvaluator(this.flagStore);
    this.actions = new ActionExecutor(this.flagStore, this.eventBus, content);
    this.triggers = new TriggerRegistry(this.eventBus, this.conditions, this.actions, this.flagStore);
    this.questTracker = new QuestTracker(content, this.conditions, this.actions);

    // Subscribe quest tracker to flag_changed events on the eventBus directly,
    // since flag_changed is emitted via eventBus.emit() in actions.js but does
    // NOT go through _emitGameEvent().
    this.eventBus.on('flag_changed', (payload) => {
      this.questTracker.processEvent('flag_changed', this._scriptContext(payload.playerId, payload.roomId));
    });
  }

  // Build a scripting context object for triggers/conditions/actions
  _scriptContext(playerId, roomId) {
    const room = this.rooms.get(roomId);
    const player = room ? room.players.get(playerId) : null;
    return { playerId, roomId, room, player };
  }

  // Emit a scripting event and process all triggers for it
  _emitGameEvent(eventType, eventPayload, context) {
    this.eventBus.emit(eventType, eventPayload);
    this.triggers.processEvent(eventType, eventPayload, context);
    this.questTracker.processEvent(eventType, context);
  }

  start() {
    let lastTime = Date.now();
    this.interval = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      this.update(dt);
    }, CONSTANTS.TICK_INTERVAL);
    console.log(`[GameLoop] Running at ${CONSTANTS.TICK_RATE} ticks/sec`);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  createRoom(roomId, dungeonId, prebuiltDungeon) {
    const sourceDungeon = prebuiltDungeon || this.content.getDungeon(dungeonId);
    if (!sourceDungeon) {
      console.error(`[GameLoop] Dungeon not found: ${dungeonId}`);
      return null;
    }

    // Make a per-room copy of dungeon data so tile changes (doors) are independent
    const dungeon = Object.assign({}, sourceDungeon, {
      data: sourceDungeon.data.slice(),
    });

    // Create NPC instances from dungeon spawn data
    const npcs = new Map();
    if (dungeon.npcSpawns) {
      for (let i = 0; i < dungeon.npcSpawns.length; i++) {
        const spawn = dungeon.npcSpawns[i];
        const npcDef = this.content.getNPC(spawn.type);
        if (!npcDef) continue;
        const npcId = `npc_${spawn.type}_${i}`;
        npcs.set(npcId, {
          id: npcId,
          type: spawn.type,
          name: npcDef.name,
          x: (spawn.x + 0.5) * CONSTANTS.TILE_SIZE,
          y: (spawn.y + 0.5) * CONSTANTS.TILE_SIZE,
          dialogue: npcDef.dialogue,
          dialogues: npcDef.dialogues || null,
          dialogueRules: npcDef.dialogueRules || null,
          activeDialogueId: null,
        });
      }
    }

    // Create ground item instances from dungeon spawn data
    const items = new Map();
    let nextItemId = 0;
    const pickedItems = this.pickedUpItems.get(dungeonId);
    if (dungeon.itemSpawns) {
      for (let i = 0; i < dungeon.itemSpawns.length; i++) {
        if (pickedItems && pickedItems.has(i)) continue;  // Already picked up
        const spawn = dungeon.itemSpawns[i];
        const itemDef = this.content.getItem(spawn.type);
        if (!itemDef) continue;
        const itemId = `item_${nextItemId++}`;
        items.set(itemId, {
          id: itemId,
          type: spawn.type,
          name: itemDef.name,
          rarity: itemDef.rarity || 'common',
          x: (spawn.x + 0.5) * CONSTANTS.TILE_SIZE,
          y: (spawn.y + 0.5) * CONSTANTS.TILE_SIZE,
          spawnIndex: i,
        });
      }
    }

    const room = {
      id: roomId,
      dungeonId,
      dungeon,
      players: new Map(),    // playerId -> Player
      npcs,                  // npcId -> NPC
      monsters: new Map(),   // monsterId -> Monster
      items,                 // itemId -> GroundItem
      projectiles: [],       // Projectile objects
      events: [],            // combat events for current tick
      tick: 0,
      nextSpawnIndex: 0,
      nextMonsterId: 0,
      nextItemId,
      nextProjectileId: 0,
    };

    // Spawn monsters
    this.spawnMonsters(room);

    // Load scripting triggers for this room
    this.triggers.loadRoomTriggers(roomId, dungeon);

    this.rooms.set(roomId, room);
    console.log(`[GameLoop] Room "${roomId}" created with dungeon "${dungeon.name}" (${npcs.size} NPCs, ${room.monsters.size} monsters, ${items.size} items)`);
    return room;
  }

  spawnMonsters(room) {
    if (!room.dungeon.monsterSpawns) return;
    const killed = this.killedMonsters.get(room.dungeonId);
    for (let si = 0; si < room.dungeon.monsterSpawns.length; si++) {
      const spawn = room.dungeon.monsterSpawns[si];
      const def = this.content.getMonster(spawn.type);
      if (!def) continue;
      const count = spawn.count || 1;
      for (let i = 0; i < count; i++) {
        const spawnKey = `${si}:${i}`;
        if (killed && killed.has(spawnKey)) continue;  // Stay dead
        const id = `mob_${room.nextMonsterId++}`;
        const offsetX = count > 1 ? (i - (count - 1) / 2) * 1.5 : 0;
        room.monsters.set(id, {
          id,
          spawnKey,
          type: spawn.type,
          name: def.name,
          x: (spawn.x + 0.5 + offsetX) * CONSTANTS.TILE_SIZE,
          y: (spawn.y + 0.5) * CONSTANTS.TILE_SIZE,
          health: def.health,
          maxHealth: def.health,
          speed: def.speed,
          damage: def.damage,
          attackRange: (def.attackRange || 1) * CONSTANTS.TILE_SIZE,
          attackCooldown: 1 / (def.attackSpeed || 1),
          attackTimer: 0,
          ai: def.ai,
          facing: 0,
        });
      }
    }
  }

  reloadRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const sourceDungeon = this.content.getDungeon(room.dungeonId);
    if (!sourceDungeon) return null;

    // Make a fresh per-room copy
    room.dungeon = Object.assign({}, sourceDungeon, {
      data: sourceDungeon.data.slice(),
    });

    // Respawn NPCs from updated data
    room.npcs.clear();
    if (room.dungeon.npcSpawns) {
      for (let i = 0; i < room.dungeon.npcSpawns.length; i++) {
        const spawn = room.dungeon.npcSpawns[i];
        const npcDef = this.content.getNPC(spawn.type);
        if (!npcDef) continue;
        const npcId = `npc_${spawn.type}_${i}`;
        room.npcs.set(npcId, {
          id: npcId,
          type: spawn.type,
          name: npcDef.name,
          x: (spawn.x + 0.5) * CONSTANTS.TILE_SIZE,
          y: (spawn.y + 0.5) * CONSTANTS.TILE_SIZE,
          dialogue: npcDef.dialogue,
          dialogues: npcDef.dialogues || null,
          dialogueRules: npcDef.dialogueRules || null,
          activeDialogueId: null,
        });
      }
    }

    // Respawn items from updated data
    room.items.clear();
    room.nextItemId = 0;
    if (room.dungeon.itemSpawns) {
      for (let i = 0; i < room.dungeon.itemSpawns.length; i++) {
        const spawn = room.dungeon.itemSpawns[i];
        const itemDef = this.content.getItem(spawn.type);
        if (!itemDef) continue;
        const itemId = `item_${room.nextItemId++}`;
        room.items.set(itemId, {
          id: itemId,
          type: spawn.type,
          name: itemDef.name,
          rarity: itemDef.rarity || 'common',
          x: (spawn.x + 0.5) * CONSTANTS.TILE_SIZE,
          y: (spawn.y + 0.5) * CONSTANTS.TILE_SIZE,
        });
      }
    }

    // Respawn monsters from updated data (clear killed state for editor reload)
    room.monsters.clear();
    room.nextMonsterId = 0;
    this.killedMonsters.delete(room.dungeonId);
    this.pickedUpItems.delete(room.dungeonId);
    this.spawnMonsters(room);

    // Move players to spawn point (they may be standing in a wall now)
    const spawn = room.dungeon.spawns && room.dungeon.spawns[0] || { x: 2, y: 2 };
    for (const [pid, player] of room.players) {
      player.x = (spawn.x + 0.5) * CONSTANTS.TILE_SIZE;
      player.y = (spawn.y + 0.5) * CONSTANTS.TILE_SIZE;
      player.health = player.maxHealth;
    }

    // Reload scripting triggers
    this.triggers.loadRoomTriggers(roomId, room.dungeon);

    console.log(`[GameLoop] Room "${roomId}" reloaded with updated dungeon data`);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // Get or create a room for a dungeon
  // context (optional): { fromDungeon, exitX, exitY, depth } for procedural generation
  getOrCreateRoom(dungeonId, context) {
    // 1. Room already exists
    let room = this.rooms.get(dungeonId);
    if (room) return room;

    // 2. Check if it's a cached procedural instance
    if (this.generatedDungeons.has(dungeonId)) {
      room = this.createRoom(dungeonId, dungeonId, this.generatedDungeons.get(dungeonId));
      return room;
    }

    // 3. Check if dungeonId is a template ID -> generate a new instance
    const template = this.content.getTemplate(dungeonId);
    if (template && context) {
      const genContext = {
        fromDungeon: context.fromDungeon,
        exitX: context.exitX || 0,
        exitY: context.exitY || 0,
        depth: context.depth || (template.depth && template.depth.min) || 0,
        serverEpoch: this.serverEpoch,
      };
      const result = this.generator.generate(template, genContext);
      if (result) {
        this.generatedDungeons.set(result.instanceId, result.dungeon);
        room = this.createRoom(result.instanceId, result.instanceId, result.dungeon);
        return room;
      }
      console.error(`[GameLoop] Procedural generation failed for template: ${dungeonId}`);
      return null;
    }

    // 4. Normal dungeon from content
    room = this.createRoom(dungeonId, dungeonId);
    return room;
  }

  addPlayer(roomId, playerId, name) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Pick a spawn point
    const spawnPoints = room.dungeon.spawns || [];
    const spawn = spawnPoints[room.nextSpawnIndex % Math.max(1, spawnPoints.length)] || { x: 2, y: 2 };
    room.nextSpawnIndex++;

    const player = {
      id: playerId,
      name: name || `Player ${room.players.size + 1}`,
      x: (spawn.x + 0.5) * CONSTANTS.TILE_SIZE,
      y: (spawn.y + 0.5) * CONSTANTS.TILE_SIZE,
      facing: 0,
      health: CONSTANTS.PLAYER_MAX_HEALTH,
      maxHealth: CONSTANTS.PLAYER_MAX_HEALTH,
      colorIndex: room.players.size % CONSTANTS.COLORS.player.length,
      input: { up: false, down: false, left: false, right: false },
      attackTimer: 0,
      transitionCooldown: 0,
      inventory: [],
      equipment: { arms: null, medipac: null, accessory: null },
      abilities: [null, null, null, null, null, null],
      cooldowns: [0, 0, 0, 0, 0, 0],
      solGrid: null,
      energy: 0,
      maxEnergy: 0,
      questObjective: null,
    };

    room.players.set(playerId, player);
    this.flagStore.ensurePlayer(playerId);
    this.questTracker.initPlayer(playerId);
    this._rebuildAbilities(player);

    // Emit room_entered event
    const ctx = this._scriptContext(playerId, roomId);
    this._emitGameEvent(EventBus.Events.ROOM_ENTERED, {
      playerId, roomId, dungeonId: room.dungeonId,
    }, ctx);

    console.log(`[GameLoop] Player "${player.name}" (${playerId}) joined room "${roomId}" at (${spawn.x}, ${spawn.y})`);
    return player;
  }

  // Add player to a room at a specific position (for floor transitions)
  addPlayerAt(roomId, player, spawnX, spawnY) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    player.x = (spawnX + 0.5) * CONSTANTS.TILE_SIZE;
    player.y = (spawnY + 0.5) * CONSTANTS.TILE_SIZE;
    player.transitionCooldown = 1.5;
    player.attackTimer = 0;

    room.players.set(player.id, player);

    // Emit room_entered event
    const ctx = this._scriptContext(player.id, roomId);
    this._emitGameEvent(EventBus.Events.ROOM_ENTERED, {
      playerId: player.id, roomId, dungeonId: room.dungeonId,
    }, ctx);

    console.log(`[GameLoop] Player "${player.name}" (${player.id}) transitioned to room "${roomId}" at (${spawnX}, ${spawnY})`);
    return player;
  }

  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.get(playerId);
    room.players.delete(playerId);
    this.questTracker.removePlayer(playerId);
    console.log(`[GameLoop] Player ${playerId} left room "${roomId}"`);

    // Clean up empty rooms (but keep the starting room)
    const spawnRoom = this.content.getSpawnRoom() || 'crypt_01';
    if (room.players.size === 0 && roomId !== spawnRoom) {
      this.triggers.unloadRoom(roomId);
      this.flagStore.clearRoom(roomId);
      this.rooms.delete(roomId);
      console.log(`[GameLoop] Room "${roomId}" removed (empty)`);
    }
    return player;
  }

  setPlayerInput(roomId, playerId, input) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;
    player.input = input;
  }

  // Resolve a slot name through aliases (e.g. 'weapon' -> 'arms')
  _resolveSlot(rawSlot) {
    return CONSTANTS.SLOT_ALIASES[rawSlot] || rawSlot;
  }

  // BFS to find which exit in currentRoomId leads toward targetRoomId.
  // Returns { tileX, tileY } of the exit in the current room, or null.
  _getDungeonData(id) {
    return this.content.getDungeon(id) || this.generatedDungeons.get(id) || null;
  }

  _resolveExitToward(currentRoomId, targetRoomId) {
    if (currentRoomId === targetRoomId) return null;

    // BFS through dungeon exits to find path from current to target
    const visited = new Set();
    const queue = []; // { roomId, firstExitTileX, firstExitTileY }

    const currentDungeon = this._getDungeonData(currentRoomId);
    if (!currentDungeon || !currentDungeon.exits) return null;

    for (const exit of currentDungeon.exits) {
      const nextRoom = exit.leadsTo;
      if (visited.has(nextRoom)) continue;
      visited.add(nextRoom);
      if (nextRoom === targetRoomId) {
        return { tileX: exit.x, tileY: exit.y };
      }
      queue.push({ roomId: nextRoom, firstExitX: exit.x, firstExitY: exit.y });
    }
    visited.add(currentRoomId);

    while (queue.length > 0) {
      const { roomId, firstExitX, firstExitY } = queue.shift();
      const dungeon = this._getDungeonData(roomId);
      if (!dungeon || !dungeon.exits) continue;

      for (const exit of dungeon.exits) {
        const nextRoom = exit.leadsTo;
        if (visited.has(nextRoom)) continue;
        visited.add(nextRoom);
        if (nextRoom === targetRoomId) {
          return { tileX: firstExitX, tileY: firstExitY };
        }
        queue.push({ roomId: nextRoom, firstExitX, firstExitY });
      }
    }
    return null;
  }

  // Send quest objective to a player, resolving exit coordinates if needed
  _sendQuestObjective(playerId, currentRoomId) {
    const room = this.rooms.get(currentRoomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;

    if (!player.questObjective) {
      // Send null objective to clear client display
      if (this.actions.sendToPlayer) {
        this.actions.sendToPlayer(playerId, {
          type: CONSTANTS.MSG.QUEST_OBJECTIVE,
          objective: null,
        });
      }
      return;
    }

    const obj = player.questObjective;
    let tileX = obj.tileX;
    let tileY = obj.tileY;
    let sameRoom = (currentRoomId === obj.roomId);

    if (!sameRoom) {
      // Find exit toward target room
      const exit = this._resolveExitToward(currentRoomId, obj.roomId);
      if (exit) {
        tileX = exit.tileX;
        tileY = exit.tileY;
      }
    }

    if (this.actions.sendToPlayer) {
      this.actions.sendToPlayer(playerId, {
        type: CONSTANTS.MSG.QUEST_OBJECTIVE,
        objective: {
          label: obj.label,
          questName: obj.questName || null,
          tileX,
          tileY,
          sameRoom,
        },
      });
    }
  }

  // Get modifier components adjacent to a grid position (4-directional, Manhattan distance 1 by default)
  // Deduplicates by placementId so multi-cell shapes only count once
  _getAdjacentModifiers(solGrid, x, y) {
    const size = solGrid.size;
    const modifiers = [];
    const seenPlacements = new Set();
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]]; // 4-directional
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const cell = solGrid.cells[ny * size + nx];
      if (cell && cell.modifierId) {
        if (cell.placementId && seenPlacements.has(cell.placementId)) continue;
        if (cell.placementId) seenPlacements.add(cell.placementId);
        const compDef = this.content.getSolComponent(cell.modifierId);
        if (compDef && compDef.type === 'modifier' && compDef.bonus) {
          modifiers.push(compDef);
        }
      }
    }
    return modifiers;
  }

  // Compute modified ability stats based on adjacent modifiers
  _computeModifiedAbility(solGrid, x, y, baseAbilityDef) {
    const mods = this._getAdjacentModifiers(solGrid, x, y);
    if (mods.length === 0) return null; // no modifications

    const modified = {};
    let dmgMult = 0;
    let cdReduce = 0;
    for (const mod of mods) {
      if (mod.bonus.damageMultiplier) dmgMult += mod.bonus.damageMultiplier;
      if (mod.bonus.cooldownReduction) cdReduce += mod.bonus.cooldownReduction;
    }
    if (dmgMult > 0) {
      modified.damageMultiplier = (baseAbilityDef.damageMultiplier || 1.0) + dmgMult;
    }
    if (cdReduce > 0) {
      modified.cooldown = Math.max(0.1, (baseAbilityDef.cooldown || 0.5) * (1 - cdReduce));
    }
    return modified;
  }

  // Build the client-facing sol grid with modifier stats included
  getSolGridForClient(player) {
    if (!player || !player.solGrid) return null;
    const grid = player.solGrid;
    const size = grid.size;
    const clientCells = [];
    for (let i = 0; i < size * size; i++) {
      const cell = grid.cells[i];
      if (!cell) { clientCells.push(null); continue; }
      const clientCell = Object.assign({}, cell);
      // For ability cells (non-extension), compute and attach modifier info
      if (cell.abilityId && !cell.isExtension) {
        const x = i % size;
        const y = Math.floor(i / size);
        const mods = this._getAdjacentModifiers(grid, x, y);
        if (mods.length > 0) {
          clientCell.modifiers = mods.map(m => ({
            name: m.name,
            bonus: m.bonus,
          }));
        }
        // Also include base ability stats for display
        const abilityDef = this.content.getAbility(cell.abilityId);
        if (abilityDef) {
          clientCell.baseStats = {
            damageMultiplier: abilityDef.damageMultiplier || 1.0,
            cooldown: abilityDef.cooldown || 0.5,
          };
        }
      }
      clientCells.push(clientCell);
    }
    return { size: grid.size, cells: clientCells, nextPlacementId: grid.nextPlacementId };
  }

  // Rebuild the abilities array from equipped items
  _rebuildAbilities(player) {
    player.abilities = [null, null, null, null, null, null];
    player.abilityOverrides = {}; // slotIdx -> { damageMultiplier, cooldown } overrides from adjacency

    // Reset energy if no sol grid
    if (!player.solGrid) {
      player.energy = 0;
      player.maxEnergy = 0;
    }

    // Arms slot: provides attack ability
    const arms = player.equipment.arms;
    if (arms) {
      const itemDef = this.content.getItem(arms.type);
      if (itemDef && itemDef.ability) {
        const abilityDef = this.content.getAbility(itemDef.ability.id);
        if (abilityDef) {
          const slotIdx = (abilityDef.defaultSlot || 1) - 1;
          player.abilities[slotIdx] = itemDef.ability.id;
        }
      } else if (itemDef && itemDef.stats && itemDef.stats.projectile) {
        // Legacy projectile weapons without explicit ability → use blaster_shot
        player.abilities[0] = 'blaster_shot';
      }
    }

    // Medipac slot: provides heal ability
    const medipac = player.equipment.medipac;
    if (medipac) {
      const itemDef = this.content.getItem(medipac.type);
      if (itemDef && itemDef.ability) {
        const abilityDef = this.content.getAbility(itemDef.ability.id);
        if (abilityDef) {
          const slotIdx = (abilityDef.defaultSlot || 6) - 1;
          player.abilities[slotIdx] = itemDef.ability.id;
        }
      }
    }

    // Sol grid abilities (if sol unit is equipped, scan grid for ability components)
    if (player.solGrid) {
      // Initialize energy pool on first sol grid equip
      if (player.maxEnergy === 0) {
        player.maxEnergy = 100;
        player.energy = player.maxEnergy;
      }
      for (let y = 0; y < player.solGrid.size; y++) {
        for (let x = 0; x < player.solGrid.size; x++) {
          const cell = player.solGrid.cells[y * player.solGrid.size + x];
          if (cell && cell.abilityId && !cell.isExtension) {
            const abilityDef = this.content.getAbility(cell.abilityId);
            if (abilityDef) {
              const slotIdx = (abilityDef.defaultSlot || 1) - 1;
              // Place ability if slot is empty, or match existing (equipment may have set it)
              if (!player.abilities[slotIdx] || player.abilities[slotIdx] === cell.abilityId) {
                player.abilities[slotIdx] = cell.abilityId;
                // Compute adjacency bonuses
                const overrides = this._computeModifiedAbility(player.solGrid, x, y, abilityDef);
                if (overrides) {
                  player.abilityOverrides[slotIdx] = overrides;
                }
              }
            }
          }
        }
      }
    }
  }

  // Initialize a sol grid for a player when they equip a sol unit
  _initSolGrid(player, solUnitDef) {
    const size = solUnitDef.gridSize || 5;
    const cells = new Array(size * size).fill(null);
    let nextPlacementId = 1;

    if (solUnitDef.initialComponents) {
      for (const comp of solUnitDef.initialComponents) {
        const compDef = comp.abilityId
          ? this._findSolComponentByAbility(comp.abilityId)
          : null;
        const shape = (compDef && compDef.shape) || [[1]];
        const pid = nextPlacementId++;
        for (let sy = 0; sy < shape.length; sy++) {
          for (let sx = 0; sx < shape[sy].length; sx++) {
            if (!shape[sy][sx]) continue;
            const gx = comp.gridX + sx;
            const gy = comp.gridY + sy;
            if (gx >= size || gy >= size) continue;
            const idx = gy * size + gx;
            const cell = {
              placementId: pid,
              originX: comp.gridX,
              originY: comp.gridY,
            };
            if (comp.abilityId) cell.abilityId = comp.abilityId;
            if (comp.modifierId) cell.modifierId = comp.modifierId;
            if (sx !== 0 || sy !== 0) cell.isExtension = true;
            cells[idx] = cell;
          }
        }
      }
    }

    player.solGrid = { size, cells, nextPlacementId };
  }

  // Find sol component definition by abilityId
  _findSolComponentByAbility(abilityId) {
    const components = this.content.solComponents || {};
    for (const [id, comp] of Object.entries(components)) {
      if (comp.abilityId === abilityId) return comp;
    }
    return null;
  }

  // Find which item type corresponds to a sol component ID
  _findItemTypeForSolComponent(solComponentId) {
    const items = this.content.items || {};
    for (const [itemType, itemDef] of Object.entries(items)) {
      if (itemDef.solComponentId === solComponentId) return itemType;
    }
    return null;
  }

  // Place a sol_component from inventory onto the grid
  trySolGridPlace(roomId, playerId, inventoryIndex, gridX, gridY) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const player = room.players.get(playerId);
    if (!player || !player.solGrid) return false;

    const item = player.inventory[inventoryIndex];
    if (!item || item.category !== 'sol_component') return false;

    const itemDef = this.content.getItem(item.type);
    if (!itemDef || !itemDef.solComponentId) return false;

    const compDef = this.content.getSolComponent(itemDef.solComponentId);
    if (!compDef) return false;

    const shape = compDef.shape || [[1]];
    const size = player.solGrid.size;

    // Validate all shape cells fit and are empty
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (!shape[sy][sx]) continue;
        const cx = gridX + sx;
        const cy = gridY + sy;
        if (cx < 0 || cy < 0 || cx >= size || cy >= size) return false;
        if (player.solGrid.cells[cy * size + cx] !== null) return false;
      }
    }

    // Place the component
    const pid = player.solGrid.nextPlacementId++;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (!shape[sy][sx]) continue;
        const cx = gridX + sx;
        const cy = gridY + sy;
        const cell = {
          placementId: pid,
          originX: gridX,
          originY: gridY,
        };
        if (compDef.type === 'ability' && compDef.abilityId) cell.abilityId = compDef.abilityId;
        if (compDef.type === 'modifier') cell.modifierId = itemDef.solComponentId;
        if (sx !== 0 || sy !== 0) cell.isExtension = true;
        player.solGrid.cells[cy * size + cx] = cell;
      }
    }

    // Remove from inventory
    player.inventory.splice(inventoryIndex, 1);
    this._rebuildAbilities(player);
    return true;
  }

  // Remove a placed sol_component from the grid, return it to inventory
  trySolGridRemove(roomId, playerId, gridX, gridY) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const player = room.players.get(playerId);
    if (!player || !player.solGrid) return false;

    const size = player.solGrid.size;
    const clickedCell = player.solGrid.cells[gridY * size + gridX];
    if (!clickedCell) return false;

    const pid = clickedCell.placementId;
    // Find what component this is
    let solComponentId = null;
    if (clickedCell.modifierId) {
      solComponentId = clickedCell.modifierId;
    } else if (clickedCell.abilityId) {
      // Find sol component by abilityId
      const comp = this._findSolComponentByAbility(clickedCell.abilityId);
      if (comp) {
        // Find the component id key
        const components = this.content.solComponents || {};
        for (const [id, c] of Object.entries(components)) {
          if (c === comp) { solComponentId = id; break; }
        }
      }
    }
    if (!solComponentId) return false;

    // Find the item type for this component
    const itemType = this._findItemTypeForSolComponent(solComponentId);
    if (!itemType) return false;

    // Clear all cells with this placementId
    for (let i = 0; i < size * size; i++) {
      const c = player.solGrid.cells[i];
      if (c && c.placementId === pid) {
        player.solGrid.cells[i] = null;
      }
    }

    // Add item back to inventory
    const itemDef = this.content.getItem(itemType);
    player.inventory.push({
      type: itemType,
      name: itemDef.name,
      rarity: itemDef.rarity || 'common',
      category: itemDef.type || 'misc',
    });

    this._rebuildAbilities(player);
    return true;
  }

  // Use an ability from a given slot
  tryUseAbility(roomId, playerId, slot, aimAngle) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const player = room.players.get(playerId);
    if (!player) return false;

    const slotIdx = slot - 1;
    if (slotIdx < 0 || slotIdx >= 6) return false;

    const abilityId = player.abilities[slotIdx];
    if (!abilityId) return false;

    let abilityDef = this.content.getAbility(abilityId);
    if (!abilityDef) return false;

    // Apply adjacency overrides if present
    const overrides = player.abilityOverrides && player.abilityOverrides[slotIdx];
    if (overrides) {
      abilityDef = Object.assign({}, abilityDef, overrides);
    }

    // Check cooldown
    if (player.cooldowns[slotIdx] > 0) return false;

    switch (abilityDef.type) {
      case 'projectile':
        return this._fireProjectile(room, player, abilityDef, aimAngle, slotIdx);
      case 'cone':
        return this._fireCone(room, player, abilityDef, aimAngle, slotIdx);
      case 'heal':
        return this._useHeal(room, player, abilityDef, slotIdx);
      default:
        return false;
    }
  }

  _fireProjectile(room, player, abilityDef, aimAngle, slotIdx) {
    // Check energy cost
    if (abilityDef.energyCost) {
      if (player.energy < abilityDef.energyCost) return false;
      player.energy -= abilityDef.energyCost;
    }

    let dirX, dirY;
    if (aimAngle !== null && typeof aimAngle === 'number' && isFinite(aimAngle)) {
      dirX = Math.cos(aimAngle);
      dirY = Math.sin(aimAngle);
    } else {
      // Auto-aim: find nearest monster
      const targetRange = 12 * CONSTANTS.TILE_SIZE;
      let nearestMob = null;
      let nearestDist = Infinity;
      for (const [mid, mob] of room.monsters) {
        const dx = mob.x - player.x;
        const dy = mob.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < targetRange && dist < nearestDist) {
          nearestMob = mob;
          nearestDist = dist;
        }
      }
      if (nearestMob) {
        const dx = nearestMob.x - player.x;
        const dy = nearestMob.y - player.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        dirX = dx / len;
        dirY = dy / len;
      } else {
        dirX = Math.cos(player.facing || 0);
        dirY = Math.sin(player.facing || 0);
      }
    }

    const speed = abilityDef.projectileSpeed || CONSTANTS.PROJECTILE_SPEED;
    const radius = abilityDef.projectileRadius || CONSTANTS.PROJECTILE_RADIUS;
    const damage = this.getPlayerAttackDamage(player) * (abilityDef.damageMultiplier || 1.0);

    const projectileId = `proj_${room.nextProjectileId++}`;
    room.projectiles.push({
      id: projectileId,
      ownerId: player.id,
      x: player.x,
      y: player.y,
      vx: dirX * speed,
      vy: dirY * speed,
      damage: damage,
      radius: radius,
      lifetime: CONSTANTS.PROJECTILE_LIFETIME,
    });

    player.cooldowns[slotIdx] = abilityDef.cooldown || CONSTANTS.PLAYER_ATTACK_COOLDOWN;
    return true;
  }

  _fireCone(room, player, abilityDef, aimAngle, slotIdx) {
    // Check energy cost
    if (abilityDef.energyCost) {
      if (player.energy < abilityDef.energyCost) return false;
      player.energy -= abilityDef.energyCost;
    }

    // Determine aim direction
    let dirAngle;
    if (aimAngle !== null && typeof aimAngle === 'number' && isFinite(aimAngle)) {
      dirAngle = aimAngle;
    } else {
      // Auto-aim: find nearest monster
      const targetRange = 12 * CONSTANTS.TILE_SIZE;
      let nearestMob = null;
      let nearestDist = Infinity;
      for (const [mid, mob] of room.monsters) {
        const dx = mob.x - player.x;
        const dy = mob.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < targetRange && dist < nearestDist) {
          nearestMob = mob;
          nearestDist = dist;
        }
      }
      if (nearestMob) {
        dirAngle = Math.atan2(nearestMob.y - player.y, nearestMob.x - player.x);
      } else {
        dirAngle = player.facing || 0;
      }
    }

    const coneRange = (abilityDef.coneRange || 3) * CONSTANTS.TILE_SIZE;
    const halfAngle = ((abilityDef.coneAngle || 60) / 2) * (Math.PI / 180);
    const damage = this.getPlayerAttackDamage(player) * (abilityDef.damageMultiplier || 1.0);
    const knockbackDist = abilityDef.knockback || 0;

    // Hit all monsters within cone
    for (const [mid, mob] of room.monsters) {
      const dx = mob.x - player.x;
      const dy = mob.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > coneRange + CONSTANTS.MONSTER_COLLISION_RADIUS) continue;

      // Check angle
      const angleToMob = Math.atan2(dy, dx);
      let angleDiff = angleToMob - dirAngle;
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      if (Math.abs(angleDiff) > halfAngle) continue;

      // Hit this monster
      mob.health -= damage;
      mob.aggroTarget = player.id;
      room.events.push({
        type: 'damage',
        targetId: mid,
        amount: damage,
        x: mob.x,
        y: mob.y,
      });

      // Apply knockback
      if (knockbackDist > 0 && dist > 0) {
        mob.knockbackVx = (dx / dist) * knockbackDist;
        mob.knockbackVy = (dy / dist) * knockbackDist;
        mob.knockbackTime = 0.2;
      }

      // Check if monster died
      if (mob.health <= 0) {
        room.events.push({
          type: 'death',
          targetId: mid,
          x: mob.x,
          y: mob.y,
        });
        room.monsters.delete(mid);

        if (mob.spawnKey) {
          if (!this.killedMonsters.has(room.dungeonId)) {
            this.killedMonsters.set(room.dungeonId, new Set());
          }
          this.killedMonsters.get(room.dungeonId).add(mob.spawnKey);
        }

        const ctx = this._scriptContext(player.id, room.id);
        this._emitGameEvent(EventBus.Events.MONSTER_KILLED, {
          playerId: player.id,
          roomId: room.id,
          monsterType: mob.type,
          monsterId: mid,
          monsterX: mob.x, monsterY: mob.y,
        }, ctx);
      }
    }

    // Send cone effect event for client rendering
    room.events.push({
      type: 'cone_effect',
      x: player.x,
      y: player.y,
      angle: dirAngle,
      coneAngle: abilityDef.coneAngle || 60,
      range: coneRange,
    });

    player.cooldowns[slotIdx] = abilityDef.cooldown || CONSTANTS.PLAYER_ATTACK_COOLDOWN;
    return true;
  }

  _useHeal(room, player, abilityDef, slotIdx) {
    if (player.health >= player.maxHealth) return false;

    // Check if ability requires a consumable item
    if (abilityDef.consumesItem) {
      const idx = player.inventory.findIndex(i => i.type === abilityDef.consumesItem);
      if (idx === -1) return false;
      player.inventory.splice(idx, 1);
    }

    const healAmount = Math.min(abilityDef.heal || 0, player.maxHealth - player.health);
    if (healAmount <= 0) return false;

    player.health += healAmount;
    player.cooldowns[slotIdx] = abilityDef.cooldown || 8.0;

    room.events.push({
      type: 'heal', targetId: player.id,
      amount: healAmount, x: player.x, y: player.y,
    });

    return true;
  }

  update(dt) {
    for (const [roomId, room] of this.rooms) {
      room.tick++;
      room.events = [];

      // Update each player's movement and cooldowns
      for (const [pid, player] of room.players) {
        this.physics.movePlayer(player, room.dungeon, dt);
        if (player.transitionCooldown > 0) {
          player.transitionCooldown -= dt;
        }
        // Tick down attack cooldown (shared by projectile weapon attacks)
        player.attackTimer = Math.max(0, player.attackTimer - dt);
        // Tick down ability cooldowns
        for (let i = 0; i < player.cooldowns.length; i++) {
          if (player.cooldowns[i] > 0) {
            player.cooldowns[i] = Math.max(0, player.cooldowns[i] - dt);
          }
        }
        // Regenerate energy (~5 per second)
        if (player.maxEnergy > 0 && player.energy < player.maxEnergy) {
          player.energy = Math.min(player.maxEnergy, player.energy + 5 * dt);
        }
      }

      // Update monsters (AI + attacks)
      this.updateMonsters(room, dt);

      // Update projectiles (movement, collision, lifetime)
      this.updateProjectiles(room, dt);

      // Check for floor transitions
      this.checkExits(room);
    }
  }

  updateMonsters(room, dt) {
    for (const [mid, mob] of room.monsters) {
      mob.attackTimer = Math.max(0, mob.attackTimer - dt);

      // Apply knockback movement
      if (mob.knockbackTime > 0) {
        const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;
        const kbX = mob.x + mob.knockbackVx * dt;
        const kbY = mob.y + mob.knockbackVy * dt;
        if (!this.physics.collidesAt(kbX, mob.y, room.dungeon, mr)) mob.x = kbX;
        if (!this.physics.collidesAt(mob.x, kbY, room.dungeon, mr)) mob.y = kbY;
        mob.knockbackTime -= dt;
        if (mob.knockbackTime <= 0) {
          mob.knockbackVx = 0;
          mob.knockbackVy = 0;
          mob.knockbackTime = 0;
        }
        continue; // Skip AI while being knocked back
      }

      // If monster has a forced aggro target (e.g. was shot), prioritize that player
      let nearest = null;
      let nearestDist = Infinity;

      if (mob.aggroTarget) {
        const target = room.players.get(mob.aggroTarget);
        if (target) {
          const dx = target.x - mob.x;
          const dy = target.y - mob.y;
          nearest = target;
          nearestDist = Math.sqrt(dx * dx + dy * dy);
        } else {
          mob.aggroTarget = null;
        }
      }

      // Fall back to nearest player within aggro range
      if (!nearest) {
        for (const [pid, player] of room.players) {
          const dx = player.x - mob.x;
          const dy = player.y - mob.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) {
            nearest = player;
            nearestDist = dist;
          }
        }
      }

      if (!nearest) continue;

      const aggroRange = CONSTANTS.MONSTER_AGGRO_RANGE * CONSTANTS.TILE_SIZE;
      if (!mob.aggroTarget && nearestDist > aggroRange) continue;

      if (mob.ai === 'melee_chase') {
        if (nearestDist > mob.attackRange) {
          // Chase player
          const dx = nearest.x - mob.x;
          const dy = nearest.y - mob.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const speed = mob.speed * CONSTANTS.TILE_SIZE * dt;
            const nx = mob.x + (dx / len) * speed;
            const ny = mob.y + (dy / len) * speed;
            const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;
            if (!this.physics.collidesAt(nx, mob.y, room.dungeon, mr)) mob.x = nx;
            if (!this.physics.collidesAt(mob.x, ny, room.dungeon, mr)) mob.y = ny;
            mob.facing = Math.atan2(dy, dx);
          }
        } else if (mob.attackTimer <= 0) {
          // Attack player
          nearest.health -= mob.damage;
          mob.attackTimer = mob.attackCooldown;
          room.events.push({
            type: 'damage', targetId: nearest.id,
            amount: mob.damage, x: nearest.x, y: nearest.y,
          });

          // Player death -> respawn at floor spawn
          if (nearest.health <= 0) {
            nearest.health = nearest.maxHealth;
            const spawn = room.dungeon.spawns[0] || { x: 2, y: 2 };
            nearest.x = (spawn.x + 0.5) * CONSTANTS.TILE_SIZE;
            nearest.y = (spawn.y + 0.5) * CONSTANTS.TILE_SIZE;
            room.events.push({
              type: 'death', targetId: nearest.id,
              x: nearest.x, y: nearest.y,
            });

            // Emit player_death scripting event
            const deathCtx = this._scriptContext(nearest.id, room.id);
            this._emitGameEvent(EventBus.Events.PLAYER_DEATH, {
              playerId: nearest.id, roomId: room.id,
            }, deathCtx);
          }
        }
      }
    }
  }

  // Spawn a projectile from player attack
  tryAttack(roomId, playerId, aimAngle = null) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const player = room.players.get(playerId);
    if (!player) return false;

    // Check if player has a projectile weapon equipped
    const weapon = player.equipment && player.equipment.weapon;
    if (!weapon || !weapon.stats || !weapon.stats.projectile) return false;

    // Check attack cooldown
    if (player.attackTimer > 0) return false;

    let dirX, dirY;
    if (aimAngle !== null && typeof aimAngle === 'number' && isFinite(aimAngle)) {
      // Client-provided aim direction
      dirX = Math.cos(aimAngle);
      dirY = Math.sin(aimAngle);
    } else {
      // Auto-aim: find nearest monster (generous range, projectile will travel)
      const targetRange = 12 * CONSTANTS.TILE_SIZE;
      let nearestMob = null;
      let nearestDist = Infinity;
      for (const [mid, mob] of room.monsters) {
        const dx = mob.x - player.x;
        const dy = mob.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < targetRange && dist < nearestDist) {
          nearestMob = mob;
          nearestDist = dist;
        }
      }

      if (nearestMob) {
        const dx = nearestMob.x - player.x;
        const dy = nearestMob.y - player.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        dirX = dx / len;
        dirY = dy / len;
      } else {
        // Default to facing right if no specific facing is set
        dirX = Math.cos(player.facing || 0);
        dirY = Math.sin(player.facing || 0);
      }
    }

    // Spawn projectile
    const projectileId = `proj_${room.nextProjectileId++}`;
    const damage = this.getPlayerAttackDamage(player);
    room.projectiles.push({
      id: projectileId,
      ownerId: playerId,
      x: player.x,
      y: player.y,
      vx: dirX * CONSTANTS.PROJECTILE_SPEED,
      vy: dirY * CONSTANTS.PROJECTILE_SPEED,
      damage: damage,
      lifetime: CONSTANTS.PROJECTILE_LIFETIME,
    });

    // Set attack cooldown
    player.attackTimer = CONSTANTS.PLAYER_ATTACK_COOLDOWN;
    return true;
  }

  // Update all projectiles in a room
  updateProjectiles(room, dt) {
    const toRemove = [];

    for (let i = 0; i < room.projectiles.length; i++) {
      const proj = room.projectiles[i];

      // Update position
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Update lifetime
      proj.lifetime -= dt;
      if (proj.lifetime <= 0) {
        toRemove.push(i);
        continue;
      }

      // Check wall collision
      const radius = proj.radius || CONSTANTS.PROJECTILE_RADIUS;
      if (this.physics.collidesAt(proj.x, proj.y, room.dungeon, radius)) {
        toRemove.push(i);
        continue;
      }

      // Check monster collision
      let hitMonster = false;
      for (const [mid, mob] of room.monsters) {
        const dx = mob.x - proj.x;
        const dy = mob.y - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = CONSTANTS.MONSTER_COLLISION_RADIUS + radius;

        if (dist < hitRadius) {
          // Hit monster — force aggro on the attacker
          mob.health -= proj.damage;
          mob.aggroTarget = proj.ownerId;
          room.events.push({
            type: 'damage',
            targetId: mid,
            amount: proj.damage,
            x: mob.x,
            y: mob.y,
          });

          // Check if monster died
          if (mob.health <= 0) {
            room.events.push({
              type: 'death',
              targetId: mid,
              x: mob.x,
              y: mob.y,
            });
            room.monsters.delete(mid);

            // Record the kill
            if (mob.spawnKey) {
              if (!this.killedMonsters.has(room.dungeonId)) {
                this.killedMonsters.set(room.dungeonId, new Set());
              }
              this.killedMonsters.get(room.dungeonId).add(mob.spawnKey);
            }

            // Emit monster_killed scripting event
            const ctx = this._scriptContext(proj.ownerId, room.id);
            this._emitGameEvent(EventBus.Events.MONSTER_KILLED, {
              playerId: proj.ownerId,
              roomId: room.id,
              monsterType: mob.type,
              monsterId: mid,
              monsterX: mob.x, monsterY: mob.y,
            }, ctx);
          }

          hitMonster = true;
          toRemove.push(i);
          break;
        }
      }

      if (hitMonster) continue;
    }

    // Remove projectiles that hit something or expired (in reverse order to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      room.projectiles.splice(toRemove[i], 1);
    }
  }

  checkExits(room) {
    if (!room.dungeon.exits) return;

    for (const [pid, player] of room.players) {
      if (player.transitionCooldown > 0) continue;

      const playerTX = Math.floor(player.x / CONSTANTS.TILE_SIZE);
      const playerTY = Math.floor(player.y / CONSTANTS.TILE_SIZE);

      for (const exit of room.dungeon.exits) {
        if (playerTX === exit.x && playerTY === exit.y) {
          this.pendingTransitions.push({
            playerId: pid,
            fromRoom: room.id,
            toDungeon: exit.leadsTo,
            spawnX: exit.spawnX != null ? exit.spawnX : null,
            spawnY: exit.spawnY != null ? exit.spawnY : null,
            exitX: exit.x,
            exitY: exit.y,
            depth: exit.depth,
          });
          break;
        }
      }
    }
  }

  consumeTransitions() {
    const transitions = this.pendingTransitions;
    this.pendingTransitions = [];
    return transitions;
  }

  // Generalized interact: tries items, doors, then NPCs (closest wins within each category)
  tryInteract(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;

    const ts = CONSTANTS.TILE_SIZE;

    // 1. Check for nearby ground items (pickup)
    const itemRange = CONSTANTS.ITEM_PICKUP_RANGE * ts;
    let closestItem = null;
    let closestItemDist = Infinity;
    for (const [itemId, item] of room.items) {
      const dx = item.x - player.x;
      const dy = item.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < itemRange && dist < closestItemDist) {
        closestItem = item;
        closestItemDist = dist;
      }
    }
    if (closestItem) {
      // Pick up the item: remove from ground, add to inventory
      room.items.delete(closestItem.id);

      // Record pickup so item stays gone when room is revisited
      if (closestItem.spawnIndex !== undefined) {
        if (!this.pickedUpItems.has(room.dungeonId)) {
          this.pickedUpItems.set(room.dungeonId, new Set());
        }
        this.pickedUpItems.get(room.dungeonId).add(closestItem.spawnIndex);
      }
      const closestItemDef = this.content.getItem(closestItem.type);
      player.inventory.push({
        type: closestItem.type,
        name: closestItem.name,
        rarity: closestItem.rarity,
        category: closestItemDef ? closestItemDef.type : 'misc',
      });
      room.events.push({
        type: 'pickup',
        targetId: player.id,
        itemName: closestItem.name,
        x: closestItem.x,
        y: closestItem.y,
      });

      // Emit item_picked_up scripting event
      const ctx = this._scriptContext(playerId, roomId);
      this._emitGameEvent(EventBus.Events.ITEM_PICKED_UP, {
        playerId, roomId, itemType: closestItem.type, itemName: closestItem.name,
      }, ctx);

      return {
        interactType: 'pickup',
        itemId: closestItem.id,
        item: { type: closestItem.type, name: closestItem.name, rarity: closestItem.rarity },
        inventory: player.inventory,
        equipment: player.equipment,
      };
    }

    // 2. Check for nearby interactable tiles (doors)
    const doorRange = CONSTANTS.DOOR_INTERACT_RANGE * ts;
    const tileset = this.content.getTileset(room.dungeon.tileset);
    if (tileset) {
      let closestDoor = null;
      let closestDoorDist = Infinity;

      // Check tiles around the player
      const playerTX = Math.floor(player.x / ts);
      const playerTY = Math.floor(player.y / ts);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = playerTX + dx;
          const ty = playerTY + dy;
          if (tx < 0 || ty < 0 || tx >= room.dungeon.width || ty >= room.dungeon.height) continue;

          const tileId = room.dungeon.data[ty * room.dungeon.width + tx];
          const tileDef = tileset.tiles[String(tileId)];
          if (!tileDef || !tileDef.interactable) continue;

          // Distance from player to tile center
          const tileCX = (tx + 0.5) * ts;
          const tileCY = (ty + 0.5) * ts;
          const ddx = tileCX - player.x;
          const ddy = tileCY - player.y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);

          if (dist < doorRange && dist < closestDoorDist) {
            closestDoor = { tx, ty, tileId, tileDef, dist };
            closestDoorDist = dist;
          }
        }
      }

      if (closestDoor && closestDoor.tileDef.togglesTo != null) {
        const ctx = this._scriptContext(playerId, roomId);

        // Check conditions on the tile (e.g. locked doors requiring a key)
        if (closestDoor.tileDef.conditions) {
          if (!this.conditions.evaluate(closestDoor.tileDef.conditions, ctx)) {
            // Conditions not met — return fail message if defined
            const failMsg = closestDoor.tileDef.failMessage || 'You can\'t do that yet.';
            return { interactType: 'message', text: failMsg };
          }
        }

        // Execute any onInteract actions (e.g. consume key)
        if (closestDoor.tileDef.onInteract) {
          this.actions.executeAll(closestDoor.tileDef.onInteract, ctx);
        }

        const newTileId = closestDoor.tileDef.togglesTo;
        const idx = closestDoor.ty * room.dungeon.width + closestDoor.tx;
        room.dungeon.data[idx] = newTileId;

        // Emit door_interacted scripting event
        this._emitGameEvent(EventBus.Events.DOOR_INTERACTED, {
          playerId, roomId, tileX: closestDoor.tx, tileY: closestDoor.ty,
        }, ctx);

        return {
          interactType: 'door',
          x: closestDoor.tx,
          y: closestDoor.ty,
          tileId: newTileId,
        };
      }
    }

    // 3. Check for nearby NPCs (dialogue)
    const npcRange = CONSTANTS.NPC_INTERACT_RANGE * ts;
    let closestNPC = null;
    let closestNPCDist = Infinity;
    for (const [npcId, npc] of room.npcs) {
      const dx = npc.x - player.x;
      const dy = npc.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < npcRange && dist < closestNPCDist) {
        closestNPC = npc;
        closestNPCDist = dist;
      }
    }
    if (closestNPC) {
      const ctx = this._scriptContext(playerId, roomId);
      const dialogue = this._resolveDialogue(closestNPC, ctx);

      // Emit npc_interacted scripting event
      this._emitGameEvent(EventBus.Events.NPC_INTERACTED, {
        playerId, roomId, npcType: closestNPC.type, npcId: closestNPC.id,
      }, ctx);

      return { interactType: 'dialogue', npcId: closestNPC.id, dialogue };
    }

    return null;
  }

  // Get a player's current inventory
  getPlayerInventory(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const player = room.players.get(playerId);
    if (!player) return [];
    return player.inventory;
  }

  // Equip an item from inventory into an equipment slot
  tryEquip(roomId, playerId, inventoryIndex) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;

    if (inventoryIndex < 0 || inventoryIndex >= player.inventory.length) return null;
    const item = player.inventory[inventoryIndex];

    // Look up item definition to get slot info
    const itemDef = this.content.getItem(item.type);
    if (!itemDef || !itemDef.slot) return null;

    const slot = this._resolveSlot(itemDef.slot);
    if (!CONSTANTS.EQUIPMENT_SLOTS.includes(slot)) return null;

    // If something is already equipped in that slot, swap it back to inventory
    const currentEquipped = player.equipment[slot];

    // If unequipping a sol unit, clear the grid
    if (currentEquipped) {
      const oldDef = this.content.getItem(currentEquipped.type);
      if (oldDef && oldDef.hasSolGrid) {
        player.solGrid = null;
      }
    }

    player.inventory.splice(inventoryIndex, 1);
    if (currentEquipped) {
      player.inventory.push(currentEquipped);
    }

    player.equipment[slot] = {
      type: item.type,
      name: item.name,
      rarity: item.rarity,
      category: item.category || itemDef.type || 'misc',
      slot: slot,
      stats: itemDef.stats || {},
    };

    // If equipping a sol unit, init the grid
    if (itemDef.hasSolGrid && itemDef.solUnitId) {
      const solUnitDef = this.content.getSolUnit(itemDef.solUnitId);
      if (solUnitDef) {
        this._initSolGrid(player, solUnitDef);
      }
    }

    this._rebuildAbilities(player);
    return { inventory: player.inventory, equipment: player.equipment, abilities: player.abilities, cooldowns: player.cooldowns };
  }

  // Unequip an item from an equipment slot back to inventory
  tryUnequip(roomId, playerId, slot) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;

    slot = this._resolveSlot(slot);
    if (!CONSTANTS.EQUIPMENT_SLOTS.includes(slot)) return null;
    const equipped = player.equipment[slot];
    if (!equipped) return null;

    // If unequipping a sol unit, clear the grid
    const itemDef = this.content.getItem(equipped.type);
    if (itemDef && itemDef.hasSolGrid) {
      player.solGrid = null;
    }

    player.equipment[slot] = null;
    player.inventory.push({
      type: equipped.type,
      name: equipped.name,
      rarity: equipped.rarity,
      category: equipped.category || 'misc',
    });

    this._rebuildAbilities(player);
    return { inventory: player.inventory, equipment: player.equipment, abilities: player.abilities, cooldowns: player.cooldowns };
  }

  // Use a consumable item from inventory
  tryUseItem(roomId, playerId, inventoryIndex) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;

    if (inventoryIndex < 0 || inventoryIndex >= player.inventory.length) return null;
    const item = player.inventory[inventoryIndex];

    // Look up item definition
    const itemDef = this.content.getItem(item.type);
    if (!itemDef || itemDef.type !== 'consumable' || !itemDef.effect) return null;

    let used = false;

    // Heal effect
    if (itemDef.effect.heal) {
      if (player.health >= player.maxHealth) return null; // Already full
      const healAmount = Math.min(itemDef.effect.heal, player.maxHealth - player.health);
      player.health += healAmount;
      used = true;

      room.events.push({
        type: 'heal', targetId: player.id,
        amount: healAmount, x: player.x, y: player.y,
      });
    }

    if (!used) return null;

    // Remove the consumed item
    player.inventory.splice(inventoryIndex, 1);
    return { inventory: player.inventory, equipment: player.equipment };
  }

  // Get total attack damage for a player (base + equipment bonuses)
  getPlayerAttackDamage(player) {
    let damage = CONSTANTS.PLAYER_ATTACK_DAMAGE;
    for (const slot of CONSTANTS.EQUIPMENT_SLOTS) {
      const item = player.equipment[slot];
      if (item && item.stats && item.stats.attackDamage) {
        damage += item.stats.attackDamage;
      }
    }
    return damage;
  }

  // Resolve which dialogue to show for an NPC based on rules and flags.
  // Priority: 1) activeDialogueId set by a trigger action, 2) dialogueRules, 3) default dialogue
  _resolveDialogue(npc, context) {
    // If a trigger already set activeDialogueId, use that
    if (npc.activeDialogueId && npc.dialogues && npc.dialogues[npc.activeDialogueId]) {
      return npc.dialogues[npc.activeDialogueId];
    }

    // Check dialogueRules (first matching rule wins)
    if (npc.dialogueRules && npc.dialogues) {
      for (const rule of npc.dialogueRules) {
        if (this.conditions.evaluate(rule.conditions, context)) {
          const lines = npc.dialogues[rule.use];
          if (lines) return lines;
        }
      }
    }

    // Fall back to default dialogue set or the flat dialogue array
    if (npc.dialogues && npc.dialogues.default) {
      return npc.dialogues.default;
    }
    return npc.dialogue || [];
  }

  getRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const players = [];
    for (const [pid, p] of room.players) {
      const pData = {
        id: p.id, name: p.name,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        facing: Math.round(p.facing * 100) / 100,
        health: p.health, maxHealth: p.maxHealth,
        energy: Math.round(p.energy), maxEnergy: p.maxEnergy,
        colorIndex: p.colorIndex,
      };
      // Include weapon name if equipped (for rendering)
      if (p.equipment && p.equipment.arms) {
        pData.weapon = p.equipment.arms.name;
      }
      players.push(pData);
    }

    const npcs = [];
    for (const [nid, n] of room.npcs) {
      npcs.push({ id: n.id, type: n.type, name: n.name, x: n.x, y: n.y });
    }

    const monsters = [];
    for (const [mid, m] of room.monsters) {
      monsters.push({
        id: m.id, type: m.type, name: m.name,
        x: Math.round(m.x * 10) / 10,
        y: Math.round(m.y * 10) / 10,
        facing: Math.round(m.facing * 100) / 100,
        health: m.health, maxHealth: m.maxHealth,
      });
    }

    const items = [];
    for (const [iid, item] of room.items) {
      items.push({
        id: item.id, type: item.type, name: item.name,
        rarity: item.rarity,
        x: item.x, y: item.y,
      });
    }

    const projectiles = [];
    for (const proj of room.projectiles) {
      const pData = {
        id: proj.id,
        x: Math.round(proj.x * 10) / 10,
        y: Math.round(proj.y * 10) / 10,
        vx: proj.vx,
        vy: proj.vy,
      };
      if (proj.radius && proj.radius !== CONSTANTS.PROJECTILE_RADIUS) {
        pData.radius = proj.radius;
      }
      projectiles.push(pData);
    }

    const events = room.events || [];
    room.events = [];

    return {
      type: CONSTANTS.MSG.STATE,
      tick: room.tick,
      players, npcs, monsters, items, projectiles, events,
    };
  }
}

module.exports = GameLoop;
