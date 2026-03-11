const CONSTANTS = require('../shared/constants');
const Physics = require('./physics');
const DungeonGenerator = require('./dungeon-generator');
const Automation = require('./automation');
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
    this.pendingDeathPenalties = [];

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

    // Automation subsystem (dayside structures, resources, production)
    this.automation = new Automation(content);

    // Scripting subsystem
    this.flagStore = new FlagStore();
    this.eventBus = new EventBus();
    this.conditions = new ConditionEvaluator(this.flagStore);
    this.actions = new ActionExecutor(this.flagStore, this.eventBus, content);
    this.actions.automation = this.automation;
    this.actions.gameLoop = this;
    this.triggers = new TriggerRegistry(this.eventBus, this.conditions, this.actions, this.flagStore);
    this.questTracker = new QuestTracker(content, this.conditions, this.actions);

    // Track expedition boss kills — when the killed monster matches the
    // expedition's boss type, mark the expedition as boss-cleared and spawn
    // a return portal leading back to the expedition origin room.
    this.eventBus.on(EventBus.Events.MONSTER_KILLED, (payload) => {
      const { playerId, monsterType, roomId, monsterX, monsterY } = payload;
      if (!playerId) return;
      const bossType = this.flagStore.getPlayerFlag(playerId, 'expedition_boss_type');
      if (bossType && monsterType === bossType) {
        this.flagStore.setPlayerFlag(playerId, 'expedition_boss_killed', true);
        console.log(`[GameLoop] Player ${playerId} killed expedition boss "${monsterType}"`);

        // Spawn a return portal exit at the boss's death position
        const origin = this.flagStore.getPlayerFlag(playerId, 'expedition_origin');
        const room = this.rooms.get(roomId);
        if (room && origin) {
          const ts = CONSTANTS.TILE_SIZE;
          const portalTX = Math.floor(monsterX / ts);
          const portalTY = Math.floor(monsterY / ts);

          // Write a stairs-up tile (8) into the map data
          const idx = portalTY * room.dungeon.width + portalTX;
          room.dungeon.data[idx] = 8;

          // Add exit entry so checkExits() picks it up
          room.dungeon.exits.push({
            x: portalTX,
            y: portalTY,
            leadsTo: origin,
            type: 'return_portal',
          });

          // Broadcast the tile change so clients see the portal
          if (this.actions.broadcastToRoom) {
            this.actions.broadcastToRoom(roomId, {
              type: CONSTANTS.MSG.DOOR_TOGGLE,
              x: portalTX,
              y: portalTY,
              tileId: 8,
            });
          }

          console.log(`[GameLoop] Spawned return portal at (${portalTX},${portalTY}) in ${roomId} → ${origin}`);
        }
      }
    });

    // Subscribe to flag_changed events on the eventBus directly, since
    // flag_changed is emitted via eventBus.emit() in actions.js but does
    // NOT go through _emitGameEvent(). Both the trigger registry and the
    // quest tracker need to see these events.
    this.eventBus.on('flag_changed', (payload) => {
      const ctx = this._scriptContext(payload.playerId, payload.roomId);
      this.triggers.processEvent('flag_changed', payload, ctx);
      this.questTracker.processEvent('flag_changed', ctx);
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
          category: itemDef.type,
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
      sentries: [],          // Light sentries placed by players
      beamObjects: [],       // Mirrors and photosensors for sentry beam puzzles
      events: [],            // combat events for current tick
      tick: 0,
      nextSpawnIndex: 0,
      nextMonsterId: 0,
      nextItemId,
      nextProjectileId: 0,
      nextSentryId: 0,
      expeditionScaling: null, // Set when room is part of an expedition { hpMult, damageMult, xpMult }
    };

    // Initialize beam objects (mirrors, photosensors) for sentry beam puzzles
    if (dungeon.beamObjects) {
      for (const def of dungeon.beamObjects) {
        room.beamObjects.push({
          id: def.id,
          type: def.type,
          x: (def.x + 0.5) * CONSTANTS.TILE_SIZE,
          y: (def.y + 0.5) * CONSTANTS.TILE_SIZE,
          angle: def.angle || 0,
          sensorId: def.sensorId || null,
          active: false,
        });
      }
    }

    // Spawn monsters
    this.spawnMonsters(room);

    // Load scripting triggers for this room
    this.triggers.loadRoomTriggers(roomId, dungeon);

    this.rooms.set(roomId, room);
    console.log(`[GameLoop] Room "${roomId}" created with dungeon "${dungeon.name}" (${npcs.size} NPCs, ${room.monsters.size} monsters, ${items.size} items)`);
    return room;
  }

  // Find a nearby spawnable tile using a spiral search from the given tile position
  findSpawnableTile(dungeon, tileX, tileY) {
    if (this.content.isSpawnable(dungeon, tileX, tileY)) {
      return { x: tileX, y: tileY };
    }
    // Search expanding rings up to 5 tiles away
    for (let r = 1; r <= 5; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // Only ring perimeter
          if (this.content.isSpawnable(dungeon, tileX + dx, tileY + dy)) {
            return { x: tileX + dx, y: tileY + dy };
          }
        }
      }
    }
    return null; // No valid tile found
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
        const targetTileX = Math.floor(spawn.x + 0.5 + offsetX);
        const targetTileY = spawn.y;
        const validTile = this.findSpawnableTile(room.dungeon, targetTileX, targetTileY);
        if (!validTile) {
          console.warn(`[GameLoop] No valid spawn tile for ${spawn.type} near (${targetTileX}, ${targetTileY}), skipping`);
          continue;
        }
        const spawnX = (validTile.x + 0.5) * CONSTANTS.TILE_SIZE;
        const spawnY = (validTile.y + 0.5) * CONSTANTS.TILE_SIZE;
        // Determine spawn tile elevation
        const spawnTileDef = this.content.getTileDef(room.dungeon, validTile.x, validTile.y);
        const spawnElevation = spawnTileDef ? (spawnTileDef.elevation || 0) : 0;
        // Apply expedition scaling multipliers if present
        const scaling = room.expeditionScaling;
        const scaledHealth = scaling ? Math.round(def.health * scaling.hpMult) : def.health;
        const scaledDamage = scaling ? Math.round(def.damage * scaling.damageMult) : def.damage;
        const mob = {
          id,
          spawnKey,
          type: spawn.type,
          name: def.name,
          x: spawnX,
          y: spawnY,
          spawnX,
          spawnY,
          elevation: spawnElevation,
          health: scaledHealth,
          maxHealth: scaledHealth,
          speed: def.speed,
          damage: scaledDamage,
          attackRange: (def.attackRange || 1) * CONSTANTS.TILE_SIZE,
          attackCooldown: 1 / (def.attackSpeed || 1),
          attackTimer: 0,
          ai: def.ai,
          facing: 0,
          idleMode: spawn.patrol || 'stationary',
          xpMult: scaling ? scaling.xpMult : 1,
        };
        // Ambush: start hidden until player is close
        if (def.ai === 'ambush') {
          mob.hidden = true;
          mob.ambushRevealed = false;
        }
        // Wander/patrol idle: set up wandering state
        const idleWanders = mob.idleMode === 'wander' || mob.idleMode === 'patrol' || def.ai === 'patrol';
        if (idleWanders) {
          mob.patrolTimer = 0;
          mob.patrolState = 'walking'; // 'walking' or 'waiting'
          mob.patrolWaitTime = 1.5 + Math.random();
          // Waypoint patrol: use explicit path or generate default back-and-forth
          if (mob.idleMode === 'patrol' || def.ai === 'patrol') {
            const waypoints = spawn.patrolPath && spawn.patrolPath.length >= 2
              ? spawn.patrolPath.map(p => ({
                  x: (p.x + 0.5) * CONSTANTS.TILE_SIZE,
                  y: (p.y + 0.5) * CONSTANTS.TILE_SIZE,
                }))
              : this._generateDefaultPatrolPath(mob, room.dungeon);
            mob.patrolWaypoints = waypoints;
            mob.patrolWaypointIndex = 0;
          } else {
            mob.patrolAngle = Math.random() * Math.PI * 2;
          }
        }
        // Pack leader: store aura definition
        if (def.ai === 'pack_leader' && def.aura) {
          mob.aura = def.aura;
        }
        // Ranged kite: store projectile type from definition
        if (def.ai === 'ranged_kite' && def.projectile) {
          mob.projectile = def.projectile;
        }
        // Boss: initialize phase tracking
        if (def.ai === 'boss_crystal' && def.phases) {
          mob.bossPhase = 0;
          mob.bossPhases = def.phases;
          mob.bossProjectileTimer = 0;
          mob.bossSummonTimer = 0;
          mob.bossSummonCount = 0;
        }
        // Special attacks: initialize cooldown timers from definition
        if (def.specialAttacks && def.specialAttacks.length > 0) {
          mob.specialAttacks = def.specialAttacks.map(sa => ({
            ...sa,
            timer: sa.cooldown * (0.3 + Math.random() * 0.7), // Stagger initial cooldowns
          }));
        }
        if (def.boss) {
          if (def.bossTitle) mob.bossTitle = def.bossTitle;
          if (def.bossMusic) mob.bossMusic = def.bossMusic;
        }
        room.monsters.set(id, mob);
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
          category: itemDef.type,
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
      // Forward expedition overrides for floor/boss generation
      if (context.maxDepth) genContext.maxDepth = context.maxDepth;
      if (context.bossType) genContext.bossType = context.bossType;
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

  // Start an expedition for a player: generate the first floor and transition them
  // Returns { roomId, room } on success, or null on failure
  startExpedition(playerId, tier, originRoom) {
    const expedition = this.content.getExpeditionByTier(tier);
    if (!expedition) {
      console.error(`[GameLoop] No expedition config for tier ${tier}`);
      return null;
    }

    // Validate unlock condition
    if (expedition.unlockCondition) {
      const ctx = { playerId };
      if (!this.conditions.evaluate(expedition.unlockCondition, ctx)) {
        console.log(`[GameLoop] Player ${playerId} does not meet expedition tier ${tier} unlock conditions`);
        return null;
      }
    }

    // Deduct silicon cost
    const siliconCost = expedition.siliconCost || 0;
    if (siliconCost > 0) {
      const available = this.automation.getResource(playerId, 'silicon');
      if (available < siliconCost) {
        console.log(`[GameLoop] Player ${playerId} cannot afford expedition tier ${tier} (need ${siliconCost} silicon, has ${available})`);
        return { insufficientSilicon: true, required: siliconCost, available };
      }
      this.automation.spendResources(playerId, { silicon: siliconCost });
      console.log(`[GameLoop] Deducted ${siliconCost} silicon from player ${playerId} for tier ${tier} expedition`);
    }

    // Pick a random template from the pool
    const pool = expedition.templatePool || [];
    if (pool.length === 0) {
      console.error(`[GameLoop] Expedition tier ${tier} has no template pool`);
      return null;
    }
    const templateId = pool[Math.floor(Math.random() * pool.length)];
    const template = this.content.getTemplate(templateId);
    if (!template) {
      console.error(`[GameLoop] Template "${templateId}" not found for expedition tier ${tier}`);
      return null;
    }

    // Determine floor count from expedition config
    const fc = expedition.floorCount || { min: 3, max: 3 };
    const maxFloors = fc.min + Math.floor(Math.random() * (fc.max - fc.min + 1));

    // Pick a boss from the expedition's bossPool for the final floor
    const bossPool = expedition.bossPool || [];
    const bossType = bossPool.length > 0
      ? bossPool[Math.floor(Math.random() * bossPool.length)]
      : null;

    // Generate the first floor (entrance exit leads back to origin room)
    // depth is 0-indexed, so maxDepth = maxFloors - 1 gives exactly maxFloors floors
    const origin = originRoom || 'meridian_station';
    const genContext = {
      fromDungeon: origin,
      exitX: 0,
      exitY: 0,
      depth: 0,
      maxDepth: maxFloors - 1,
      bossType,
      serverEpoch: this.serverEpoch,
    };
    const result = this.generator.generate(template, genContext);
    if (!result) {
      console.error(`[GameLoop] Failed to generate expedition floor for tier ${tier}`);
      return null;
    }

    this.generatedDungeons.set(result.instanceId, result.dungeon);
    const room = this.createRoom(result.instanceId, result.instanceId, result.dungeon);
    if (!room) return null;

    // Apply expedition scaling to the room and re-spawn monsters with scaled stats
    this.applyExpeditionScaling(room, expedition.monsterScaling);

    // Set expedition tracking flags on the player
    this.flagStore.setPlayerFlag(playerId, 'expedition_active', true);
    this.flagStore.setPlayerFlag(playerId, 'expedition_tier', tier);
    this.flagStore.setPlayerFlag(playerId, 'expedition_floor', 1);
    this.flagStore.setPlayerFlag(playerId, 'expedition_max_floors', maxFloors);
    this.flagStore.setPlayerFlag(playerId, 'expedition_template', templateId);
    this.flagStore.setPlayerFlag(playerId, 'expedition_boss_type', bossType);
    this.flagStore.setPlayerFlag(playerId, 'expedition_scaling', expedition.monsterScaling);
    this.flagStore.setPlayerFlag(playerId, 'expedition_origin', origin);

    console.log(`[GameLoop] Started tier ${tier} expedition for player ${playerId} (room: ${room.id}, template: ${templateId}, floors: ${maxFloors}, boss: ${bossType})`);
    return { roomId: room.id, room };
  }

  // Complete an expedition: set tier cleared flag (if boss killed) and clean up
  completeExpedition(playerId) {
    const tier = this.flagStore.getPlayerFlag(playerId, 'expedition_tier');
    if (!tier) return;

    const bossKilled = this.flagStore.getPlayerFlag(playerId, 'expedition_boss_killed');

    // Only set tier cleared if the boss was defeated
    if (bossKilled) {
      this.flagStore.setPlayerFlag(playerId, `expedition_tier_${tier}_cleared`, true);
      console.log(`[GameLoop] Player ${playerId} completed expedition tier ${tier}`);
    } else {
      console.log(`[GameLoop] Player ${playerId} retreated from expedition tier ${tier} (boss not killed)`);
    }

    // Clear all expedition state flags
    const expFlags = [
      'expedition_active', 'expedition_tier', 'expedition_floor',
      'expedition_max_floors', 'expedition_template', 'expedition_boss_type',
      'expedition_scaling', 'expedition_origin', 'expedition_boss_killed',
    ];
    for (const flag of expFlags) {
      this.flagStore.removePlayerFlag(playerId, flag);
    }
  }

  // Apply expedition scaling to a room (re-spawns monsters with scaled stats)
  applyExpeditionScaling(room, scaling) {
    if (room.expeditionScaling) return; // Already scaled
    room.expeditionScaling = scaling;
    room.monsters.clear();
    room.nextMonsterId = 0;
    this.killedMonsters.delete(room.id);
    this.spawnMonsters(room);
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
      equipment: { arms: null, sol_unit: null, medipac: null, accessory: null },
      abilities: [null, null, null, null, null, null],
      cooldowns: [0, 0, 0, 0, 0, 0],
      elevation: 0,
      hovering: false,
      hoverTime: 0,
      solGrid: null,
      energy: 0,
      maxEnergy: 0,
      singleUseEnergy: 0,
      singleUseMaxEnergy: 0,
      solGridEnergyRegen: 0,
      questObjective: null,
      xp: 0,
      level: 1,
      xpToNextLevel: this._xpForLevel(1),
      medipacCharges: 0,
      credits: 0,
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

  // Add player to a room at a specific position (for floor transitions).
  // Does NOT emit room_entered — caller must call emitRoomEntered() after
  // sending FLOOR_CHANGE so the client has the new map before dialogue arrives.
  addPlayerAt(roomId, player, spawnX, spawnY) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    player.x = (spawnX + 0.5) * CONSTANTS.TILE_SIZE;
    player.y = (spawnY + 0.5) * CONSTANTS.TILE_SIZE;
    player.transitionCooldown = 1.5;
    player.attackTimer = 0;
    player.hovering = false;
    player.hoverTime = 0;
    player.elevation = 0;
    // Clear movement input so click-to-move from the previous room doesn't carry over
    player.input = {};

    room.players.set(player.id, player);

    console.log(`[GameLoop] Player "${player.name}" (${player.id}) transitioned to room "${roomId}" at (${spawnX}, ${spawnY})`);
    return player;
  }

  // Emit room_entered event for a player already in the room.
  // Called after FLOOR_CHANGE is sent to the client so triggered dialogue
  // isn't immediately closed by the floor-change handler.
  emitRoomEntered(playerId, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const ctx = this._scriptContext(playerId, roomId);
    this._emitGameEvent(EventBus.Events.ROOM_ENTERED, {
      playerId, roomId, dungeonId: room.dungeonId,
    }, ctx);

    // Check for boss monsters and emit boss_intro event (once per player per boss type)
    for (const mob of room.monsters.values()) {
      if (!mob.bossPhases) continue;
      const introFlag = `boss_intro_seen_${mob.type}`;
      if (this.flagStore.getPlayerFlag(playerId, introFlag)) continue;
      this.flagStore.setPlayerFlag(playerId, introFlag, true);
      room.events.push({
        type: 'boss_intro',
        playerId,
        bossId: mob.id,
        bossName: mob.name,
        bossTitle: mob.bossTitle || null,
        bossMusic: mob.bossMusic || null,
        bossType: mob.type,
        x: mob.x,
        y: mob.y,
      });
    }
  }

  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.get(playerId);
    // Remove any sentries owned by this player
    if (room.sentries) {
      room.sentries = room.sentries.filter(s => s.ownerId !== playerId);
    }
    // Remove any extraction points owned by this player
    if (room.extractionPoints) {
      room.extractionPoints = room.extractionPoints.filter(ep => ep.ownerId !== playerId);
    }
    room.players.delete(playerId);
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

  // Find a ground item by type across all active rooms.
  // Returns { roomId, tileX, tileY } or null.
  _findItemInRooms(itemType) {
    for (const [roomId, room] of this.rooms) {
      for (const [, item] of room.items) {
        if (item.type === itemType) {
          return {
            roomId,
            tileX: Math.floor(item.x / CONSTANTS.TILE_SIZE),
            tileY: Math.floor(item.y / CONSTANTS.TILE_SIZE),
          };
        }
      }
    }
    return null;
  }

  // Send quest objective to a player, resolving exit coordinates if needed
  // Resolve a raw quest objective to screen-ready coordinates for the client.
  // Returns { label, questName, uiHint, tileX, tileY, sameRoom, targetLocationId } or null.
  _resolveObjective(obj, currentRoomId, room) {
    if (!obj) return null;

    // UI-hint-only objectives (no world-space arrow needed)
    if (obj.uiHint && !obj.roomId) {
      return { label: obj.label, questName: obj.questName || null, uiHint: obj.uiHint };
    }

    let targetRoomId = obj.roomId;
    let tileX = obj.tileX;
    let tileY = obj.tileY;

    // Resolve targetNpc: find the NPC's position (live room or dungeon definition)
    if (obj.targetNpc) {
      let found = false;
      const targetRoom = this.rooms.get(targetRoomId);
      if (targetRoom) {
        for (const npc of targetRoom.npcs.values()) {
          if (npc.type === obj.targetNpc) {
            tileX = Math.floor(npc.x / CONSTANTS.TILE_SIZE);
            tileY = Math.floor(npc.y / CONSTANTS.TILE_SIZE);
            found = true;
            break;
          }
        }
      }
      if (!found) {
        // Fall back to dungeon definition npcSpawns
        const dungeon = this.content.getDungeon(targetRoomId);
        if (dungeon && dungeon.npcSpawns) {
          const spawn = dungeon.npcSpawns.find(s => s.type === obj.targetNpc);
          if (spawn) {
            tileX = spawn.x;
            tileY = spawn.y;
          }
        }
      }
    }

    // Resolve targetExit: find the exit tile that leads to a given room
    if (obj.targetExit) {
      const dungeon = this._getDungeonData(targetRoomId);
      if (dungeon && dungeon.exits) {
        const exit = dungeon.exits.find(e => e.leadsTo === obj.targetExit);
        if (exit) {
          tileX = exit.x;
          tileY = exit.y;
        }
      }
    }

    // Resolve objectiveItem: find the item's actual location in active rooms
    if (obj.objectiveItem) {
      const itemLoc = this._findItemInRooms(obj.objectiveItem);
      if (itemLoc) {
        targetRoomId = itemLoc.roomId;
        tileX = itemLoc.tileX;
        tileY = itemLoc.tileY;
      }
    }

    let sameRoom = (currentRoomId === targetRoomId);

    // For procedural template objectives (e.g. roomId="proc_quarantine", depth=3),
    // check if the player is in a generated instance of that template
    if (!sameRoom && obj.depth != null && room.dungeon.depth != null
        && currentRoomId.startsWith('proc:' + obj.roomId + ':')) {
      if (room.dungeon.depth === obj.depth) {
        sameRoom = true;
        if (obj.targetTile != null) {
          // Scan tile data for specific tile (e.g. a chest)
          const d = room.dungeon;
          for (let i = 0; i < d.data.length; i++) {
            if (d.data[i] === obj.targetTile) {
              tileX = i % d.width;
              tileY = Math.floor(i / d.width);
              break;
            }
          }
        } else {
          // Find a monster to point at (prefer specific type if given)
          for (const mob of room.monsters.values()) {
            if (obj.targetMonster && mob.type !== obj.targetMonster) continue;
            tileX = Math.floor(mob.x / CONSTANTS.TILE_SIZE);
            tileY = Math.floor(mob.y / CONSTANTS.TILE_SIZE);
            break;
          }
        }
      }
      // Otherwise player is on a different depth — BFS will find the descent exit
    }

    if (!sameRoom && targetRoomId) {
      // Find exit toward target room
      const exit = this._resolveExitToward(currentRoomId, targetRoomId);
      if (exit) {
        tileX = exit.tileX;
        tileY = exit.tileY;
      }
    }

    // Resolve worldmap location for the target room (for worldmap markers)
    const targetLocationId = targetRoomId
      ? this.content.getWorldmapLocation(targetRoomId)
      : null;

    return {
      label: obj.label,
      questName: obj.questName || null,
      uiHint: obj.uiHint || null,
      tileX,
      tileY,
      sameRoom,
      targetLocationId,
    };
  }

  _sendQuestObjective(playerId, currentRoomId) {
    const room = this.rooms.get(currentRoomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;

    if (!player.questObjective) {
      if (this.actions.sendToPlayer) {
        this.actions.sendToPlayer(playerId, {
          type: CONSTANTS.MSG.QUEST_OBJECTIVE,
          objective: null,
        });
      }
      return;
    }

    const objective = this._resolveObjective(player.questObjective, currentRoomId, room);

    // Resolve secondary objectives (other active quests)
    const secondaryRaw = this.questTracker.getAllActiveObjectives(playerId);
    let secondaryObjectives = null;
    if (secondaryRaw.length > 0) {
      secondaryObjectives = [];
      for (const secObj of secondaryRaw) {
        const resolved = this._resolveObjective(secObj, currentRoomId, room);
        if (resolved && resolved.tileX != null) {
          secondaryObjectives.push(resolved);
        }
      }
      if (secondaryObjectives.length === 0) secondaryObjectives = null;
    }

    if (this.actions.sendToPlayer) {
      const msg = { type: CONSTANTS.MSG.QUEST_OBJECTIVE, objective };
      if (secondaryObjectives) msg.secondaryObjectives = secondaryObjectives;
      this.actions.sendToPlayer(playerId, msg);
    }
  }

  // Get modifier components adjacent to a grid position
  // Standard modifiers use 4-directional Manhattan distance 1.
  // Extended-adjacency modifiers (legendary tier) use their adjacencyPattern:
  //   "radius2"  — Manhattan distance <= 2
  //   "row"      — any cell in the same row
  //   "column"   — any cell in the same column
  //   "cross"    — full row AND full column (orthogonal cross, unlimited range)
  //   "area3x3"  — all 8 cells within Chebyshev distance 1 (full 3x3 neighborhood)
  // Deduplicates by placementId so multi-cell shapes only count once
  _getAdjacentModifiers(solGrid, x, y) {
    const size = solGrid.size;
    const modifiers = [];
    const seenPlacements = new Set();

    // Helper: check a cell at (nx, ny) and add its modifier if valid and unseen
    const _tryCell = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) return;
      if (nx === x && ny === y) return; // skip self
      const cell = solGrid.cells[ny * size + nx];
      if (!cell || !cell.modifierId) return;
      if (cell.placementId && seenPlacements.has(cell.placementId)) return;
      if (cell.placementId) seenPlacements.add(cell.placementId);
      const compDef = this.content.getSolComponent(cell.modifierId);
      if (!compDef || compDef.type !== 'modifier' || !compDef.bonus) return;
      const pattern = compDef.adjacencyPattern;
      // Determine if this modifier can reach (x, y) from (nx, ny)
      const dist = Math.abs(nx - x) + Math.abs(ny - y);
      if (!pattern) {
        // Standard modifier: Manhattan distance 1 only
        if (dist <= 1) modifiers.push(compDef);
      } else if (pattern === 'radius2') {
        if (dist <= 2) modifiers.push(compDef);
      } else if (pattern === 'row') {
        if (ny === y) modifiers.push(compDef);
      } else if (pattern === 'column') {
        if (nx === x) modifiers.push(compDef);
      } else if (pattern === 'cross') {
        // Full row AND full column (orthogonal cross, unlimited range)
        if (ny === y || nx === x) modifiers.push(compDef);
      } else if (pattern === 'area3x3') {
        // All 8 neighbors within Chebyshev distance 1
        if (Math.max(Math.abs(nx - x), Math.abs(ny - y)) <= 1) modifiers.push(compDef);
      }
    };

    // Scan standard adjacency (distance 1) — covers all non-extended modifiers
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      _tryCell(x + dx, y + dy);
    }

    // Scan extended range for radius2 modifiers (distance 2, not already covered)
    for (const [dx, dy] of [[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      _tryCell(x + dx, y + dy);
    }

    // Scan entire row and column for row/column modifiers (skip already-checked cells)
    for (let i = 0; i < size; i++) {
      if (Math.abs(i - x) > 2) _tryCell(i, y);  // row cells not yet checked
      if (Math.abs(i - y) > 2) _tryCell(x, i);  // column cells not yet checked
    }

    return modifiers;
  }

  // Compute modified ability stats based on adjacent modifiers
  _computeModifiedAbility(solGrid, x, y, baseAbilityDef) {
    const mods = this._getAdjacentModifiers(solGrid, x, y);
    const innate = solGrid.innateBonus;
    if (mods.length === 0 && !innate) return null; // no modifications

    const modified = {};
    let dmgMult = 0;
    let cdReduce = 0;
    let energyCostReduce = 0;
    let healOnHit = 0;
    for (const mod of mods) {
      if (mod.bonus.damageMultiplier) dmgMult += mod.bonus.damageMultiplier;
      if (mod.bonus.cooldownReduction) cdReduce += mod.bonus.cooldownReduction;
      if (mod.bonus.energyCostReduction) energyCostReduce += mod.bonus.energyCostReduction;
      if (mod.bonus.healOnHit) healOnHit += mod.bonus.healOnHit;
    }
    // Apply sol unit innate bonus to all abilities
    if (innate) {
      if (innate.damageMultiplier) dmgMult += innate.damageMultiplier;
      if (innate.cooldownReduction) cdReduce += innate.cooldownReduction;
      if (innate.energyCostReduction) energyCostReduce += innate.energyCostReduction;
      if (innate.healOnHit) healOnHit += innate.healOnHit;
    }
    // Apply stacking caps
    cdReduce = Math.min(cdReduce, 0.75);
    energyCostReduce = Math.min(energyCostReduce, 0.75);
    healOnHit = Math.min(healOnHit, 15);

    if (dmgMult > 0) {
      modified.damageMultiplier = (baseAbilityDef.damageMultiplier || 1.0) + dmgMult;
    }
    if (cdReduce > 0) {
      modified.cooldown = Math.max(0.1, (baseAbilityDef.cooldown || 0.5) * (1 - cdReduce));
    }
    if (energyCostReduce > 0 && baseAbilityDef.energyCost) {
      modified.energyCost = Math.max(1, Math.round(baseAbilityDef.energyCost * (1 - energyCostReduce)));
    }
    if (healOnHit > 0) {
      modified.healOnHit = healOnHit;
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
      if (!cell.isExtension) {
        // For ability cells, compute and attach modifier info
        if (cell.abilityId) {
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
        // For modifier cells, include bonus info and adjacency pattern for UI display
        if (cell.modifierId) {
          const compDef = this.content.getSolComponent(cell.modifierId);
          if (compDef && compDef.bonus) {
            clientCell.bonus = compDef.bonus;
          }
          if (compDef && compDef.adjacencyPattern) {
            clientCell.adjacencyPattern = compDef.adjacencyPattern;
          }
        }
        // For generator cells, include regen info with adjacency boost
        if (cell.generatorId) {
          const compDef = this.content.getSolComponent(cell.generatorId);
          if (compDef) {
            clientCell.componentName = compDef.name;
            clientCell.energyRegen = compDef.energyRegen;
            const x = i % size;
            const y = Math.floor(i / size);
            const mods = this._getAdjacentModifiers(grid, x, y);
            let regenBoost = 0;
            for (const mod of mods) {
              if (mod.bonus.energyCostReduction) regenBoost += mod.bonus.energyCostReduction;
            }
            if (regenBoost > 0) {
              clientCell.boostedEnergyRegen = compDef.energyRegen * (1 + regenBoost);
              clientCell.modifiers = mods.filter(m => m.bonus.energyCostReduction).map(m => ({
                name: m.name,
                bonus: m.bonus,
              }));
            }
          }
        }
        // For battery cells, include capacity info
        if (cell.batteryId) {
          const compDef = this.content.getSolComponent(cell.batteryId);
          if (compDef) {
            clientCell.componentName = compDef.name;
            clientCell.energyCapacity = compDef.singleUse && cell.remainingCapacity !== undefined
              ? cell.remainingCapacity : compDef.energyCapacity;
            if (compDef.singleUse) {
              clientCell.singleUse = true;
              clientCell.maxCapacity = compDef.energyCapacity;
            }
          }
        }
      }
      clientCells.push(clientCell);
    }
    const result = { size: grid.size, cells: clientCells, nextPlacementId: grid.nextPlacementId };
    if (grid.innateBonus) result.innateBonus = grid.innateBonus;
    if (grid.unitName) result.unitName = grid.unitName;
    if (grid.unitDescription) result.unitDescription = grid.unitDescription;
    return result;
  }

  // Rebuild the abilities array from equipped items
  _rebuildAbilities(player) {
    player.abilities = [null, null, null, null, null, null];
    player.abilityOverrides = {}; // slotIdx -> { damageMultiplier, cooldown } overrides from adjacency

    // Reset energy if no sol grid
    if (!player.solGrid) {
      player.energy = 0;
      player.maxEnergy = 0;
      player.singleUseEnergy = 0;
      player.singleUseMaxEnergy = 0;
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

    // Sol unit slot: provides sol unit ability
    const solUnit = player.equipment.sol_unit;
    if (solUnit) {
      const itemDef = this.content.getItem(solUnit.type);
      if (itemDef && itemDef.ability) {
        const abilityDef = this.content.getAbility(itemDef.ability.id);
        if (abilityDef) {
          const slotIdx = (abilityDef.defaultSlot || 1) - 1;
          player.abilities[slotIdx] = itemDef.ability.id;
        }
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

    // Sol grid: scan for abilities, generators, and batteries
    player.solGridEnergyRegen = 0;
    let extraMaxEnergy = 0;
    let singleUseMaxEnergy = 0;
    if (player.solGrid) {
      // Reset maxEnergy to sol unit base charge so battery capacity doesn't accumulate across calls
      player.maxEnergy = player.solGrid.maxCharge !== undefined ? player.solGrid.maxCharge : 100;
      for (let y = 0; y < player.solGrid.size; y++) {
        for (let x = 0; x < player.solGrid.size; x++) {
          const cell = player.solGrid.cells[y * player.solGrid.size + x];
          if (!cell || cell.isExtension) continue;

          // Abilities
          if (cell.abilityId) {
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

          // Generators — passive energy regen per second, boosted by adjacent modifiers + innate bonus
          if (cell.generatorId) {
            const compDef = this.content.getSolComponent(cell.generatorId);
            if (compDef && compDef.energyRegen) {
              let regen = compDef.energyRegen;
              const mods = this._getAdjacentModifiers(player.solGrid, x, y);
              for (const mod of mods) {
                if (mod.bonus.energyCostReduction) {
                  regen *= (1 + mod.bonus.energyCostReduction);
                }
              }
              // Apply sol unit innate energyCostReduction to generators
              const innate = player.solGrid.innateBonus;
              if (innate && innate.energyCostReduction) {
                regen *= (1 + innate.energyCostReduction);
              }
              player.solGridEnergyRegen += regen;
            }
          }

          // Batteries — extra energy capacity
          if (cell.batteryId) {
            const compDef = this.content.getSolComponent(cell.batteryId);
            if (compDef && compDef.energyCapacity) {
              // Single-use batteries may have degraded remaining capacity
              const capacity = compDef.singleUse && cell.remainingCapacity !== undefined
                ? cell.remainingCapacity : compDef.energyCapacity;
              extraMaxEnergy += capacity;
              if (compDef.singleUse) {
                singleUseMaxEnergy += capacity;
              }
            }
          }
        }
      }
      player.maxEnergy += extraMaxEnergy;
      player.singleUseMaxEnergy = singleUseMaxEnergy;
      // Clamp single-use energy to its max
      if (player.singleUseEnergy > player.singleUseMaxEnergy) {
        player.singleUseEnergy = player.singleUseMaxEnergy;
      }
      // Clamp current energy to new max in case capacity was reduced (e.g. battery removed)
      if (player.energy > player.maxEnergy) player.energy = player.maxEnergy;
    }
  }

  // Consume energy from a player, drawing from rechargeable pool first, then single-use.
  // When single-use energy is consumed, permanently degrades the smallest single-use battery.
  // Returns true if energy was successfully consumed, false if insufficient.
  _consumeEnergy(player, cost, room) {
    if (player.energy < cost) return false;

    const rechargeableCurrent = player.energy - player.singleUseEnergy;
    player.energy -= cost;

    if (rechargeableCurrent >= cost) {
      // Entirely from rechargeable pool
      return true;
    }

    // Some or all from single-use pool
    const fromSingleUse = cost - Math.max(0, rechargeableCurrent);
    player.singleUseEnergy -= fromSingleUse;

    // Permanently degrade single-use batteries (smallest first)
    this._degradeSingleUseBatteries(player, fromSingleUse, room);
    return true;
  }

  // Permanently reduce capacity of single-use batteries in the sol grid, smallest first.
  _degradeSingleUseBatteries(player, amount, room) {
    if (!player.solGrid || amount <= 0) return;

    // Collect single-use battery cells with their remaining capacity
    const batteries = [];
    const grid = player.solGrid;
    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      if (!cell || cell.isExtension || !cell.batteryId) continue;
      const compDef = this.content.getSolComponent(cell.batteryId);
      if (!compDef || !compDef.singleUse) continue;
      if (cell.remainingCapacity === undefined) {
        cell.remainingCapacity = compDef.energyCapacity;
      }
      if (cell.remainingCapacity > 0) {
        batteries.push({ cell, index: i, capacity: cell.remainingCapacity });
      }
    }

    // Sort smallest first
    batteries.sort((a, b) => a.capacity - b.capacity);

    let remaining = amount;
    for (const bat of batteries) {
      if (remaining <= 0) break;
      const drain = Math.min(remaining, bat.cell.remainingCapacity);
      bat.cell.remainingCapacity -= drain;
      remaining -= drain;

      // If battery is fully drained, remove it from the grid
      if (bat.cell.remainingCapacity <= 0) {
        const pid = bat.cell.placementId;
        for (let j = 0; j < grid.cells.length; j++) {
          if (grid.cells[j] && grid.cells[j].placementId === pid) {
            grid.cells[j] = null;
          }
        }
        // Notify client so it can show visual feedback
        if (room) {
          room.events.push({
            type: 'battery_depleted',
            targetId: player.id,
            x: player.x,
            y: player.y,
          });
        }
      }
    }

    // Rebuild to update maxEnergy/singleUseMaxEnergy
    this._rebuildAbilities(player);
  }

  // Initialize a sol grid for a player when they equip a sol unit
  _initSolGrid(player, solUnitDef) {
    const size = solUnitDef.gridSize || 5;
    const cells = new Array(size * size).fill(null);
    let nextPlacementId = 1;

    if (solUnitDef.initialComponents) {
      for (const comp of solUnitDef.initialComponents) {
        // Look up component definition for shape
        let compDef = null;
        if (comp.abilityId) compDef = this._findSolComponentByAbility(comp.abilityId);
        else if (comp.modifierId) compDef = this.content.getSolComponent(comp.modifierId);
        else if (comp.batteryId) compDef = this.content.getSolComponent(comp.batteryId);
        else if (comp.generatorId) compDef = this.content.getSolComponent(comp.generatorId);
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
            if (comp.batteryId) cell.batteryId = comp.batteryId;
            if (comp.generatorId) cell.generatorId = comp.generatorId;
            if (sx !== 0 || sy !== 0) cell.isExtension = true;
            cells[idx] = cell;
          }
        }
      }
    }

    player.solGrid = { size, cells, nextPlacementId, innateBonus: solUnitDef.innateBonus || null, unitName: solUnitDef.name || null, unitDescription: solUnitDef.description || null, maxCharge: solUnitDef.maxCharge !== undefined ? solUnitDef.maxCharge : 100 };
    // Set charge capacity from sol unit definition
    player.maxEnergy = solUnitDef.maxCharge !== undefined ? solUnitDef.maxCharge : 100;
    player.energy = solUnitDef.initialEnergy !== undefined
      ? solUnitDef.initialEnergy
      : player.maxEnergy;
    player.singleUseEnergy = 0;
    player.singleUseMaxEnergy = 0;
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
        if (cx < 0 || cy < 0 || cx >= size || cy >= size) {
          return { ok: false, reason: 'Component does not fit — too close to the grid edge.' };
        }
        if (player.solGrid.cells[cy * size + cx] !== null) {
          return { ok: false, reason: 'Cell is already occupied by another component.' };
        }
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
        if (compDef.type === 'generator') cell.generatorId = itemDef.solComponentId;
        if (compDef.type === 'battery') {
          cell.batteryId = itemDef.solComponentId;
          if (compDef.singleUse) {
            cell.remainingCapacity = compDef.energyCapacity;
          }
        }
        cell.componentRarity = item.rarity || compDef.rarity || 'common';
        if (sx !== 0 || sy !== 0) cell.isExtension = true;
        player.solGrid.cells[cy * size + cx] = cell;
      }
    }

    // Remove from inventory
    player.inventory.splice(inventoryIndex, 1);

    // If placing a single-use battery, fill its energy pool
    if (compDef.type === 'battery' && compDef.singleUse && compDef.energyCapacity) {
      player.singleUseEnergy += compDef.energyCapacity;
      player.energy += compDef.energyCapacity;
    }

    this._rebuildAbilities(player);
    return { ok: true, itemType: item.type };
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
    } else if (clickedCell.generatorId) {
      solComponentId = clickedCell.generatorId;
    } else if (clickedCell.batteryId) {
      solComponentId = clickedCell.batteryId;
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

    // If removing a single-use battery, subtract its remaining energy from single-use pool
    if (clickedCell.batteryId) {
      const compDef = this.content.getSolComponent(clickedCell.batteryId);
      if (compDef && compDef.singleUse) {
        const remaining = clickedCell.remainingCapacity !== undefined
          ? clickedCell.remainingCapacity : compDef.energyCapacity;
        player.singleUseEnergy = Math.max(0, player.singleUseEnergy - remaining);
        player.energy = Math.max(0, player.energy - remaining);
      }
    }

    // Clear all cells with this placementId
    for (let i = 0; i < size * size; i++) {
      const c = player.solGrid.cells[i];
      if (c && c.placementId === pid) {
        player.solGrid.cells[i] = null;
      }
    }

    // Add item back to inventory
    const itemDef = this.content.getItem(itemType);
    const returnedItem = {
      type: itemType,
      name: itemDef.name,
      rarity: itemDef.rarity || 'common',
      category: itemDef.type || 'misc',
    };
    if (itemDef.solComponentId) {
      const solComp = this.content.getSolComponent(itemDef.solComponentId);
      if (solComp && solComp.adjacencyPattern) {
        returnedItem.adjacencyPattern = solComp.adjacencyPattern;
      }
    }
    player.inventory.push(returnedItem);

    this._rebuildAbilities(player);
    return true;
  }

  // Use an ability from a given slot
  tryUseAbility(roomId, playerId, slot, aimAngle, extraData) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const player = room.players.get(playerId);
    if (!player) return false;

    // Cannot use abilities while stunned or knocked back
    if (player.stunTime > 0 || player.knockbackTime > 0) return false;
    // While channeling, only allow the channeled ability slot (to cancel it)
    if (player.channeling && (slot - 1) !== player.channeling.slotIdx) return false;

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

    let success = false;
    switch (abilityDef.type) {
      case 'projectile':
        success = this._fireProjectile(room, player, abilityDef, aimAngle, slotIdx); break;
      case 'cone':
        success = this._fireCone(room, player, abilityDef, aimAngle, slotIdx); break;
      case 'melee_strike':
        success = this._useMeleeStrike(room, player, abilityDef, slotIdx); break;
      case 'heal':
        success = this._useHeal(room, player, abilityDef, slotIdx); break;
      case 'teleport':
        success = this._useTeleport(room, player, abilityDef, aimAngle, slotIdx, extraData); break;
      case 'hover':
        success = this._useHover(room, player, abilityDef, slotIdx); break;
      case 'sentry':
        success = this._placeSentry(room, player, abilityDef, slotIdx); break;
      case 'pulse_cannon':
        success = this._usePulseCannon(room, player, abilityDef, aimAngle, slotIdx); break;
      default:
        return false;
    }
    if (success) {
      const ctx = this._scriptContext(playerId, roomId);
      this._emitGameEvent(EventBus.Events.ABILITY_USED, {
        playerId, roomId, abilityId, slot,
      }, ctx);
    }
    return success;
  }

  _fireProjectile(room, player, abilityDef, aimAngle, slotIdx) {
    // Check energy cost
    if (abilityDef.energyCost) {
      if (!this._consumeEnergy(player, abilityDef.energyCost, room)) return false;
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
        if (mob.hidden) continue;
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
      healOnHit: abilityDef.healOnHit || 0,
    });

    player.cooldowns[slotIdx] = abilityDef.cooldown || CONSTANTS.PLAYER_ATTACK_COOLDOWN;
    return true;
  }

  _fireCone(room, player, abilityDef, aimAngle, slotIdx) {
    // Check energy cost
    if (abilityDef.energyCost) {
      if (!this._consumeEnergy(player, abilityDef.energyCost, room)) return false;
    }

    // Use aim angle if provided, otherwise fall back to player facing direction
    const dirAngle = (aimAngle !== null && typeof aimAngle === 'number' && isFinite(aimAngle))
      ? aimAngle
      : (player.facing || 0);

    const coneRange = (abilityDef.coneRange || 3) * CONSTANTS.TILE_SIZE;
    const halfAngle = ((abilityDef.coneAngle || 60) / 2) * (Math.PI / 180);
    const damage = this.getPlayerAttackDamage(player) * (abilityDef.damageMultiplier || 1.0);
    const knockbackDist = abilityDef.knockback || 0;

    // Hit all monsters within cone
    for (const [mid, mob] of room.monsters) {
      if (mob.hidden) continue;
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

      // Heal on hit
      if (abilityDef.healOnHit > 0) {
        player.health = Math.min(player.maxHealth, player.health + abilityDef.healOnHit);
      }

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
          monsterType: mob.type,
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

        // Grant XP for kill (with expedition scaling)
        const monsterDef = this.content.getMonster(mob.type);
        if (monsterDef && monsterDef.xp) {
          this.grantXp(player, Math.round(monsterDef.xp * (mob.xpMult || 1)), room);
        }

        this._rollLoot(room, mob);

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
      ownerId: player.id,
      x: player.x,
      y: player.y,
      angle: dirAngle,
      coneAngle: abilityDef.coneAngle || 60,
      range: coneRange,
    });

    player.cooldowns[slotIdx] = abilityDef.cooldown || CONSTANTS.PLAYER_ATTACK_COOLDOWN;
    return true;
  }

  _useMeleeStrike(room, player, abilityDef, slotIdx) {
    const range = (abilityDef.range || CONSTANTS.PLAYER_ATTACK_RANGE) * CONSTANTS.TILE_SIZE;

    // Find nearest monster in range
    let nearestMob = null;
    let nearestDist = Infinity;
    for (const [mid, mob] of room.monsters) {
      if (mob.hidden) continue;
      const dx = mob.x - player.x;
      const dy = mob.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < range && dist < nearestDist) {
        nearestMob = mob;
        nearestDist = dist;
      }
    }

    if (!nearestMob) return false;

    // Deal damage
    const damage = this.getPlayerAttackDamage(player) * (abilityDef.damageMultiplier || 1.0);
    nearestMob.health -= damage;
    nearestMob.aggroTarget = player.id;

    // Melee slash visual
    const slashAngle = Math.atan2(nearestMob.y - player.y, nearestMob.x - player.x);
    room.events.push({
      type: 'melee_effect',
      x: player.x, y: player.y,
      angle: slashAngle,
      range: range,
      ownerId: player.id,
    });

    room.events.push({
      type: 'damage', targetId: nearestMob.id,
      amount: damage, x: nearestMob.x, y: nearestMob.y,
    });

    // Heal on hit
    if (abilityDef.healOnHit > 0) {
      player.health = Math.min(player.maxHealth, player.health + abilityDef.healOnHit);
    }

    // Apply knockback
    const knockback = abilityDef.knockback || 0;
    if (knockback > 0 && nearestDist > 0) {
      const dx = nearestMob.x - player.x;
      const dy = nearestMob.y - player.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const kbX = (dx / len) * knockback;
      const kbY = (dy / len) * knockback;

      const newX = nearestMob.x + kbX;
      const newY = nearestMob.y + kbY;
      if (!this.physics.collidesAt(newX, newY, room.dungeon, CONSTANTS.MONSTER_COLLISION_RADIUS)) {
        nearestMob.x = newX;
        nearestMob.y = newY;
      } else {
        // Try each axis independently
        if (!this.physics.collidesAt(newX, nearestMob.y, room.dungeon, CONSTANTS.MONSTER_COLLISION_RADIUS)) {
          nearestMob.x = newX;
        }
        if (!this.physics.collidesAt(nearestMob.x, newY, room.dungeon, CONSTANTS.MONSTER_COLLISION_RADIUS)) {
          nearestMob.y = newY;
        }
      }
    }

    // Check if monster died
    if (nearestMob.health <= 0) {
      room.events.push({
        type: 'death', targetId: nearestMob.id,
        monsterType: nearestMob.type,
        x: nearestMob.x, y: nearestMob.y,
      });
      room.monsters.delete(nearestMob.id);

      if (nearestMob.spawnKey) {
        if (!this.killedMonsters.has(room.dungeonId)) {
          this.killedMonsters.set(room.dungeonId, new Set());
        }
        this.killedMonsters.get(room.dungeonId).add(nearestMob.spawnKey);
      }

      // Grant XP for kill (with expedition scaling)
      const monsterDef = this.content.getMonster(nearestMob.type);
      if (monsterDef && monsterDef.xp) {
        this.grantXp(player, Math.round(monsterDef.xp * (nearestMob.xpMult || 1)), room);
      }

      this._rollLoot(room, nearestMob);

      const ctx = this._scriptContext(player.id, room.id);
      this._emitGameEvent(EventBus.Events.MONSTER_KILLED, {
        playerId: player.id, roomId: room.id,
        monsterType: nearestMob.type, monsterId: nearestMob.id,
        monsterX: nearestMob.x, monsterY: nearestMob.y,
      }, ctx);
    }

    player.cooldowns[slotIdx] = abilityDef.cooldown || CONSTANTS.PLAYER_ATTACK_COOLDOWN;
    return true;
  }

  _useHeal(room, player, abilityDef, slotIdx) {
    if (player.health >= player.maxHealth) return false;

    // Check if ability requires a consumable item (medical_supplies use medipac charges)
    if (abilityDef.consumesItem) {
      if (abilityDef.consumesItem === 'medical_supplies') {
        if (!player.medipacCharges || player.medipacCharges <= 0) return false;
        player.medipacCharges--;
      } else {
        const idx = player.inventory.findIndex(i => i.type === abilityDef.consumesItem);
        if (idx === -1) return false;
        player.inventory.splice(idx, 1);
      }
    }

    // Check energy cost
    if (abilityDef.energyCost) {
      if (!this._consumeEnergy(player, abilityDef.energyCost, room)) return false;
    }

    const healAmount = Math.min(abilityDef.heal || 0, player.maxHealth - player.health);
    if (healAmount <= 0) return false;

    player.health += healAmount;
    player.cooldowns[slotIdx] = abilityDef.cooldown || 8.0;

    room.events.push({
      type: 'heal', targetId: player.id,
      amount: healAmount, x: player.x, y: player.y,
    });

    return 'heal';
  }

  _useTeleport(room, player, abilityDef, aimAngle, slotIdx, extraData) {
    // Check energy cost
    if (abilityDef.energyCost) {
      if (player.energy < abilityDef.energyCost) return false;
    }

    const ts = CONSTANTS.TILE_SIZE;
    let targetX, targetY;

    if (extraData && extraData.targetX !== undefined && extraData.targetY !== undefined) {
      // Mouse click: teleport to click position, capped at max range
      const maxRange = (abilityDef.maxRange || 20) * ts;
      const dx = extraData.targetX - player.x;
      const dy = extraData.targetY - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxRange) {
        targetX = player.x + (dx / dist) * maxRange;
        targetY = player.y + (dy / dist) * maxRange;
      } else {
        targetX = extraData.targetX;
        targetY = extraData.targetY;
      }
    } else if (aimAngle !== null && typeof aimAngle === 'number' && isFinite(aimAngle)) {
      // Stick/shift: teleport in direction by fixed distance (~3/4 screen)
      const fixedDist = (abilityDef.stickDistance || 12) * ts;
      targetX = player.x + Math.cos(aimAngle) * fixedDist;
      targetY = player.y + Math.sin(aimAngle) * fixedDist;
    } else {
      return false; // No direction provided
    }

    // Clamp to map bounds
    const dungeon = room.dungeon;
    targetX = Math.max(ts * 0.5, Math.min(targetX, (dungeon.width - 0.5) * ts));
    targetY = Math.max(ts * 0.5, Math.min(targetY, (dungeon.height - 0.5) * ts));

    // If target is inside a solid tile, walk back along the line to find a valid spot
    const tileX = Math.floor(targetX / ts);
    const tileY = Math.floor(targetY / ts);
    if (this.content.isSolid(dungeon, tileX, tileY)) {
      const dx = targetX - player.x;
      const dy = targetY - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return false;
      // Step backward along the line in half-tile increments
      const stepSize = ts * 0.5;
      const steps = Math.floor(dist / stepSize);
      let found = false;
      for (let i = steps - 1; i >= 0; i--) {
        const ratio = (i * stepSize) / dist;
        const cx = player.x + dx * ratio;
        const cy = player.y + dy * ratio;
        const ctx = Math.floor(cx / ts);
        const cty = Math.floor(cy / ts);
        if (!this.content.isSolid(dungeon, ctx, cty)) {
          targetX = cx;
          targetY = cy;
          found = true;
          break;
        }
      }
      if (!found) return false; // No valid position along the line
    }

    // Deduct energy
    this._consumeEnergy(player, abilityDef.energyCost, room);

    const fromX = player.x;
    const fromY = player.y;

    // Teleport
    player.x = targetX;
    player.y = targetY;

    // Resolve any remaining wall overlaps at the destination
    this.physics.resolveCollisions(player, dungeon);

    // Set cooldown
    player.cooldowns[slotIdx] = abilityDef.cooldown || 3.0;

    // Send teleport effect event for client rendering
    room.events.push({
      type: 'teleport',
      targetId: player.id,
      fromX, fromY,
      toX: player.x, toY: player.y,
    });

    return true;
  }

  _useHover(room, player, abilityDef, slotIdx) {
    // Toggle hover on/off
    if (player.hovering) {
      // Deactivate hover early
      player.hovering = false;
      player.hoverTime = 0;
      room.events.push({
        type: 'hover_end', targetId: player.id,
        x: player.x, y: player.y,
      });
      player.cooldowns[slotIdx] = abilityDef.cooldown || 1.0;
      return true;
    }

    // Activate hover
    if (abilityDef.energyCost) {
      if (!this._consumeEnergy(player, abilityDef.energyCost, room)) return false;
    }

    player.hovering = true;
    player.hoverTime = abilityDef.duration || 3.0;

    room.events.push({
      type: 'hover_start', targetId: player.id,
      x: player.x, y: player.y,
    });

    player.cooldowns[slotIdx] = 0; // No cooldown on activation (can toggle off)
    return true;
  }

  _placeSentry(room, player, abilityDef, slotIdx) {
    // Check energy cost
    if (abilityDef.energyCost) {
      if (!this._consumeEnergy(player, abilityDef.energyCost, room)) return false;
    }

    // Remove any existing sentry owned by this player
    const oldIdx = room.sentries.findIndex(s => s.ownerId === player.id);
    if (oldIdx !== -1) {
      const old = room.sentries[oldIdx];
      room.events.push({
        type: 'sentry_despawn', sentryId: old.id,
        x: old.x, y: old.y,
      });
      room.sentries.splice(oldIdx, 1);
    }

    const sentryId = `sentry_${room.nextSentryId++}`;
    const damage = this.getPlayerAttackDamage(player) * (abilityDef.damageMultiplier || 0.6);
    const sentry = {
      id: sentryId,
      ownerId: player.id,
      x: player.x,
      y: player.y,
      damage: damage,
      beamRange: (abilityDef.beamRange || 6) * CONSTANTS.TILE_SIZE,
      beamTickRate: abilityDef.beamTickRate || 0.3,
      beamTimer: 0,
      slowFactor: abilityDef.slowFactor || 0.5,
      targetId: null,
      healOnHit: abilityDef.healOnHit || 0,
    };
    room.sentries.push(sentry);

    room.events.push({
      type: 'sentry_spawn', sentryId, ownerId: player.id,
      x: sentry.x, y: sentry.y,
    });

    player.cooldowns[slotIdx] = abilityDef.cooldown || 2.0;
    return true;
  }

  _usePulseCannon(room, player, abilityDef, aimAngle, slotIdx) {
    // If already channeling, cancel it
    if (player.channeling) {
      player.channeling = null;
      return false;
    }

    // Check energy cost
    if (abilityDef.energyCost) {
      if (!this._consumeEnergy(player, abilityDef.energyCost, room)) return false;
    }

    // Find target position: use aim angle to pick a point at maxRange
    const maxRange = (abilityDef.maxRange || 10) * CONSTANTS.TILE_SIZE;
    let targetX, targetY;

    if (aimAngle !== null && typeof aimAngle === 'number' && isFinite(aimAngle)) {
      targetX = player.x + Math.cos(aimAngle) * maxRange;
      targetY = player.y + Math.sin(aimAngle) * maxRange;

      // Snap to nearest monster if one is close to the aim line
      let nearestMob = null;
      let nearestDist = Infinity;
      for (const [mid, mob] of room.monsters) {
        if (mob.hidden) continue;
        const dx = mob.x - player.x;
        const dy = mob.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRange) continue;
        // Check angle difference
        const angleToMob = Math.atan2(dy, dx);
        let angleDiff = angleToMob - aimAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        if (Math.abs(angleDiff) < 0.3 && dist < nearestDist) {
          nearestMob = mob;
          nearestDist = dist;
        }
      }
      if (nearestMob) {
        targetX = nearestMob.x;
        targetY = nearestMob.y;
      }
    } else {
      // Auto-aim: find nearest monster
      let nearestMob = null;
      let nearestDist = Infinity;
      for (const [mid, mob] of room.monsters) {
        if (mob.hidden) continue;
        const dx = mob.x - player.x;
        const dy = mob.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxRange && dist < nearestDist) {
          nearestMob = mob;
          nearestDist = dist;
        }
      }
      if (nearestMob) {
        targetX = nearestMob.x;
        targetY = nearestMob.y;
      } else {
        // No target, aim in facing direction
        const dir = player.facing || 0;
        targetX = player.x + Math.cos(dir) * maxRange;
        targetY = player.y + Math.sin(dir) * maxRange;
      }
    }

    // Clamp target to first wall hit so targeting line doesn't extend through walls
    const dtx = targetX - player.x;
    const dty = targetY - player.y;
    const distToTarget = Math.sqrt(dtx * dtx + dty * dty);
    if (distToTarget > 0) {
      const dirX = dtx / distToTarget;
      const dirY = dty / distToTarget;
      const wallDist = this._rayDistToWall(room.dungeon, player.x, player.y, dirX, dirY, distToTarget);
      if (wallDist < distToTarget) {
        targetX = player.x + dirX * wallDist;
        targetY = player.y + dirY * wallDist;
      }
    }

    const castTime = abilityDef.castTime || 2.0;
    player.channeling = {
      type: 'pulse_cannon',
      targetX, targetY,
      timeRemaining: castTime,
      totalTime: castTime,
      slotIdx,
      abilityDef,
    };

    room.events.push({
      type: 'pulse_cannon_channel',
      playerId: player.id,
      targetX, targetY,
      castTime,
    });

    // Don't set cooldown yet — that happens after firing
    return true;
  }

  _firePulseCannonProjectile(room, player) {
    const ch = player.channeling;
    if (!ch) return;

    const dx = ch.targetX - player.x;
    const dy = ch.targetY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const dirX = dx / dist;
    const dirY = dy / dist;
    const speed = ch.abilityDef.projectileSpeed || 150;
    const radius = ch.abilityDef.projectileRadius || 10;
    const damage = this.getPlayerAttackDamage(player) * (ch.abilityDef.damageMultiplier || 4.0);
    const aoeRadius = (ch.abilityDef.aoeRadius || 2.5) * CONSTANTS.TILE_SIZE;

    const projectileId = `proj_${room.nextProjectileId++}`;
    room.projectiles.push({
      id: projectileId,
      ownerId: player.id,
      x: player.x,
      y: player.y,
      vx: dirX * speed,
      vy: dirY * speed,
      targetX: ch.targetX,
      targetY: ch.targetY,
      damage,
      radius,
      lifetime: 5.0,
      aoeRadius,
      projectileType: 'pulse_cannon',
      healOnHit: ch.abilityDef.healOnHit || 0,
    });

    player.cooldowns[ch.slotIdx] = ch.abilityDef.cooldown || 8.0;
    player.channeling = null;
  }

  _detonatePulseCannon(room, proj) {
    const ts = CONSTANTS.TILE_SIZE;
    const aoeRadius = proj.aoeRadius || (2.5 * ts);
    const detonationX = proj.x;
    const detonationY = proj.y;

    // AOE damage to monsters
    for (const [mid, mob] of room.monsters) {
      if (mob.hidden) continue;
      const dx = mob.x - detonationX;
      const dy = mob.y - detonationY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > aoeRadius + CONSTANTS.MONSTER_COLLISION_RADIUS) continue;

      // Damage falloff: full at center, 50% at edge
      const falloff = 1.0 - 0.5 * Math.min(dist / aoeRadius, 1.0);
      const dmg = proj.damage * falloff;
      mob.health -= dmg;
      mob.aggroTarget = proj.ownerId;

      room.events.push({
        type: 'damage', targetId: mid,
        amount: dmg, x: mob.x, y: mob.y,
      });

      if (mob.health <= 0) {
        room.events.push({
          type: 'death', targetId: mid,
          monsterType: mob.type, x: mob.x, y: mob.y,
        });
        room.monsters.delete(mid);

        if (mob.spawnKey) {
          if (!this.killedMonsters.has(room.dungeonId)) {
            this.killedMonsters.set(room.dungeonId, new Set());
          }
          this.killedMonsters.get(room.dungeonId).add(mob.spawnKey);
        }

        const killer = room.players.get(proj.ownerId);
        if (killer) {
          const monsterDef = this.content.getMonster(mob.type);
          if (monsterDef && monsterDef.xp) {
            this.grantXp(killer, Math.round(monsterDef.xp * (mob.xpMult || 1)), room);
          }
        }

        this._rollLoot(room, mob);

        const ctx = this._scriptContext(proj.ownerId, room.id);
        this._emitGameEvent(EventBus.Events.MONSTER_KILLED, {
          playerId: proj.ownerId, roomId: room.id,
          monsterType: mob.type, monsterId: mid,
          monsterX: mob.x, monsterY: mob.y,
        }, ctx);
      }

      // Heal on hit
      if (proj.healOnHit > 0) {
        const attacker = room.players.get(proj.ownerId);
        if (attacker) {
          attacker.health = Math.min(attacker.maxHealth, attacker.health + proj.healOnHit);
        }
      }
    }

    // Destroy destructible walls within AOE
    const tileset = this.content.getTileset(room.dungeon.tileset);
    if (tileset) {
      const cx = Math.floor(detonationX / ts);
      const cy = Math.floor(detonationY / ts);
      const tileRadius = Math.ceil(aoeRadius / ts);

      for (let dy = -tileRadius; dy <= tileRadius; dy++) {
        for (let dx = -tileRadius; dx <= tileRadius; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx < 0 || ty < 0 || tx >= room.dungeon.width || ty >= room.dungeon.height) continue;

          const tileCenterX = (tx + 0.5) * ts;
          const tileCenterY = (ty + 0.5) * ts;
          const dist = Math.sqrt((tileCenterX - detonationX) ** 2 + (tileCenterY - detonationY) ** 2);
          if (dist > aoeRadius) continue;

          const idx = ty * room.dungeon.width + tx;
          const tileId = room.dungeon.data[idx];
          const tileDef = tileset.tiles[String(tileId)];
          if (tileDef && tileDef.destructible && tileDef.destroysTo != null) {
            room.dungeon.data[idx] = tileDef.destroysTo;
            // Broadcast tile change
            if (this.actions.broadcastToRoom) {
              this.actions.broadcastToRoom(room.id, {
                type: CONSTANTS.MSG.DOOR_TOGGLE,
                x: tx, y: ty,
                tileId: tileDef.destroysTo,
              });
            }
          }
        }
      }
    }

    // Push explosion event for client rendering
    room.events.push({
      type: 'pulse_cannon_explosion',
      x: detonationX, y: detonationY,
      radius: aoeRadius,
      ownerId: proj.ownerId,
    });
  }

  // Check line-of-sight between two points — returns true if no solid wall blocks the path.
  // Uses a tile-stepping ray march through the dungeon grid.
  _hasLineOfSight(dungeon, x1, y1, x2, y2) {
    const ts = CONSTANTS.TILE_SIZE;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return true;

    // Step along the ray in half-tile increments to check for solid tiles
    const stepSize = ts * 0.5;
    const steps = Math.ceil(dist / stepSize);
    const sx = dx / steps;
    const sy = dy / steps;

    for (let i = 1; i < steps; i++) {
      const px = x1 + sx * i;
      const py = y1 + sy * i;
      const tx = Math.floor(px / ts);
      const ty = Math.floor(py / ts);
      if (this.content.isSolid(dungeon, tx, ty, 0)) {
        return false;
      }
    }
    return true;
  }

  // Cast a ray and return the distance to the first solid wall hit (or maxDist if none).
  _rayDistToWall(dungeon, x1, y1, dirX, dirY, maxDist) {
    const ts = CONSTANTS.TILE_SIZE;
    const stepSize = ts * 0.5;
    const steps = Math.ceil(maxDist / stepSize);

    for (let i = 1; i <= steps; i++) {
      const d = stepSize * i;
      const px = x1 + dirX * d;
      const py = y1 + dirY * d;
      const tx = Math.floor(px / ts);
      const ty = Math.floor(py / ts);
      if (this.content.isSolid(dungeon, tx, ty, 0)) {
        return d - stepSize; // back up one step so beam stops just before the wall
      }
    }
    return maxDist;
  }

  // Find the nearest target (monster or beam object) from a position within range, with LOS check
  _findNearestBeamTarget(room, fromX, fromY, range, excludeIds) {
    let nearest = null;
    let nearestDist = Infinity;

    // Check monsters
    for (const [mid, mob] of room.monsters) {
      if (mob.hidden || excludeIds.has(mob.id)) continue;
      const dx = mob.x - fromX;
      const dy = mob.y - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < range && dist < nearestDist) {
        if (this._hasLineOfSight(room.dungeon, fromX, fromY, mob.x, mob.y)) {
          nearest = { entity: mob, dist, kind: 'monster' };
          nearestDist = dist;
        }
      }
    }

    // Check beam objects (mirrors, photosensors)
    for (const bo of room.beamObjects) {
      if (excludeIds.has(bo.id)) continue;
      const dx = bo.x - fromX;
      const dy = bo.y - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < range && dist < nearestDist) {
        if (this._hasLineOfSight(room.dungeon, fromX, fromY, bo.x, bo.y)) {
          nearest = { entity: bo, dist, kind: bo.type };
          nearestDist = dist;
        }
      }
    }

    return nearest;
  }

  // Find nearest target along a reflected ray direction (ray cast), with LOS check
  _findTargetAlongRay(room, fromX, fromY, dirX, dirY, range, excludeIds) {
    const hitRadius = CONSTANTS.TILE_SIZE * 0.4;
    let nearest = null;
    let nearestT = Infinity;

    const checkEntity = (entity, kind) => {
      if (excludeIds.has(entity.id)) return;
      if (kind === 'monster' && entity.hidden) return;
      const ex = entity.x - fromX;
      const ey = entity.y - fromY;
      // Project onto ray direction
      const t = ex * dirX + ey * dirY;
      if (t <= 0) return; // Behind the ray
      if (t > range) return; // Beyond range
      // Perpendicular distance from entity center to ray line
      const px = ex - t * dirX;
      const py = ey - t * dirY;
      const perpDist = Math.sqrt(px * px + py * py);
      if (perpDist < hitRadius && t < nearestT) {
        // Check line-of-sight (no walls between ray origin and target)
        if (this._hasLineOfSight(room.dungeon, fromX, fromY, entity.x, entity.y)) {
          nearest = { entity, dist: t, kind };
          nearestT = t;
        }
      }
    };

    for (const [mid, mob] of room.monsters) {
      checkEntity(mob, 'monster');
    }
    for (const bo of room.beamObjects) {
      checkEntity(bo, bo.type);
    }

    return nearest;
  }

  // Compute reflected beam direction off a mirror surface.
  // angle uses screen-friendly convention: 45° = / (forward slash), 135° = \ (backslash).
  // In screen coords (Y-down), surface direction is (cos(θ), -sin(θ)).
  _reflectBeam(inDx, inDy, mirrorAngleDeg) {
    const mRad = mirrorAngleDeg * Math.PI / 180;
    // Surface direction in screen coords: (cos(θ), -sin(θ))
    // Normal (perpendicular, rotated 90° CW): (sin(θ), cos(θ))
    const nx = Math.sin(mRad);
    const ny = Math.cos(mRad);
    // Normalize incoming direction
    const len = Math.sqrt(inDx * inDx + inDy * inDy);
    if (len === 0) return { dx: 0, dy: 0 };
    const dx = inDx / len;
    const dy = inDy / len;
    // Reflect: r = d - 2(d·n)n
    const dot = dx * nx + dy * ny;
    return {
      dx: dx - 2 * dot * nx,
      dy: dy - 2 * dot * ny,
    };
  }

  // Apply sentry beam effects to a monster target
  _applySentryBeamToMonster(sentry, mob, room, dt) {
    mob.sentrySlowFactor = sentry.slowFactor;
    mob.sentrySlowTime = 0.2;

    sentry.beamTimer -= dt;
    if (sentry.beamTimer <= 0) {
      sentry.beamTimer += sentry.beamTickRate;

      mob.health -= sentry.damage;
      mob.aggroTarget = sentry.ownerId;

      room.events.push({
        type: 'damage', targetId: mob.id,
        amount: Math.round(sentry.damage),
        x: mob.x, y: mob.y,
      });

      if (sentry.healOnHit > 0) {
        const owner = room.players.get(sentry.ownerId);
        if (owner && owner.health < owner.maxHealth) {
          owner.health = Math.min(owner.maxHealth, owner.health + sentry.healOnHit);
          room.events.push({
            type: 'heal', targetId: sentry.ownerId,
            amount: sentry.healOnHit,
            x: owner.x, y: owner.y,
          });
        }
      }

      if (mob.health <= 0) {
        this._handleMonsterDeath(mob, room, sentry.ownerId);
      }
    }
  }

  updateSentries(room, dt) {
    if (room.sentries.length === 0 && room.beamObjects.length === 0) return;

    // Track which photosensors are hit this tick (sensorId -> sentry ownerId)
    const activeSensors = new Map();

    for (let i = room.sentries.length - 1; i >= 0; i--) {
      const sentry = room.sentries[i];

      // Remove sentry if owner left the room
      if (!room.players.has(sentry.ownerId)) {
        room.events.push({
          type: 'sentry_despawn', sentryId: sentry.id,
          x: sentry.x, y: sentry.y,
        });
        room.sentries.splice(i, 1);
        continue;
      }

      // Build beam chain: find targets, handle reflections
      const beamChain = [];
      const excludeIds = new Set();
      let currentX = sentry.x;
      let currentY = sentry.y;
      let remainingRange = sentry.beamRange;
      let hitMonster = null;
      const MAX_BOUNCES = 5;

      // First target: nearest entity (monster or beam object) from sentry position
      const firstTarget = this._findNearestBeamTarget(room, currentX, currentY, remainingRange, excludeIds);

      if (firstTarget) {
        beamChain.push({
          fromX: currentX, fromY: currentY,
          toX: firstTarget.entity.x, toY: firstTarget.entity.y,
          targetType: firstTarget.kind,
        });
        remainingRange -= firstTarget.dist;
        excludeIds.add(firstTarget.entity.id);

        if (firstTarget.kind === 'monster') {
          hitMonster = firstTarget.entity;
        } else if (firstTarget.kind === 'photosensor') {
          activeSensors.set(firstTarget.entity.sensorId, sentry.ownerId);
        } else if (firstTarget.kind === 'mirror') {
          // Trace reflected beams
          let prevX = currentX;
          let prevY = currentY;
          let mirrorEntity = firstTarget.entity;

          for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
            // Each mirror bounce resets the beam range to full
            remainingRange = sentry.beamRange;

            const inDx = mirrorEntity.x - prevX;
            const inDy = mirrorEntity.y - prevY;
            const reflected = this._reflectBeam(inDx, inDy, mirrorEntity.angle);

            const nextTarget = this._findTargetAlongRay(
              room, mirrorEntity.x, mirrorEntity.y,
              reflected.dx, reflected.dy,
              remainingRange, excludeIds
            );

            if (!nextTarget) {
              // Beam extends in reflected direction but stops at first wall
              const wallDist = this._rayDistToWall(room.dungeon, mirrorEntity.x, mirrorEntity.y, reflected.dx, reflected.dy, sentry.beamRange);
              if (wallDist > 0) {
                beamChain.push({
                  fromX: mirrorEntity.x, fromY: mirrorEntity.y,
                  toX: mirrorEntity.x + reflected.dx * wallDist,
                  toY: mirrorEntity.y + reflected.dy * wallDist,
                  targetType: 'none',
                });
              }
              break;
            }

            beamChain.push({
              fromX: mirrorEntity.x, fromY: mirrorEntity.y,
              toX: nextTarget.entity.x, toY: nextTarget.entity.y,
              targetType: nextTarget.kind,
            });
            excludeIds.add(nextTarget.entity.id);

            if (nextTarget.kind === 'monster') {
              hitMonster = nextTarget.entity;
              break;
            } else if (nextTarget.kind === 'photosensor') {
              activeSensors.set(nextTarget.entity.sensorId, sentry.ownerId);
              break;
            } else if (nextTarget.kind === 'mirror') {
              prevX = mirrorEntity.x;
              prevY = mirrorEntity.y;
              mirrorEntity = nextTarget.entity;
            }
          }
        }
      }

      sentry.beamChain = beamChain;
      sentry.targetId = hitMonster ? hitMonster.id : (beamChain.length > 0 ? 'beam' : null);

      // Apply damage/slow to hit monster
      if (hitMonster) {
        this._applySentryBeamToMonster(sentry, hitMonster, room, dt);
      }
    }

    // Update photosensor activation states and emit events
    for (const bo of room.beamObjects) {
      if (bo.type !== 'photosensor') continue;
      const wasActive = bo.active;
      const isActive = activeSensors.has(bo.sensorId);
      bo.active = isActive;

      if (isActive && !wasActive) {
        const ownerId = activeSensors.get(bo.sensorId) || null;
        bo.lastOwnerId = ownerId;
        const player = ownerId ? room.players.get(ownerId) : null;
        const context = {
          playerId: ownerId,
          roomId: room.id,
          room,
          player,
          sensorId: bo.sensorId,
        };
        this._emitGameEvent('photosensor_activated', {
          sensorId: bo.sensorId,
          playerId: ownerId,
          roomId: room.id,
        }, context);
        room.events.push({
          type: 'photosensor_activated',
          sensorId: bo.sensorId,
          x: bo.x, y: bo.y,
        });
      } else if (!isActive && wasActive) {
        const ownerId = bo.lastOwnerId || null;
        const player = ownerId ? room.players.get(ownerId) : null;
        const context = {
          playerId: ownerId,
          roomId: room.id,
          room,
          player,
          sensorId: bo.sensorId,
        };
        this._emitGameEvent('photosensor_deactivated', {
          sensorId: bo.sensorId,
          playerId: ownerId,
          roomId: room.id,
        }, context);
        room.events.push({
          type: 'photosensor_deactivated',
          sensorId: bo.sensorId,
          x: bo.x, y: bo.y,
        });
      }
    }
  }

  update(dt) {
    for (const [roomId, room] of this.rooms) {
      room.tick++;

      // Update each player's movement and cooldowns
      for (const [pid, player] of room.players) {
        // Tick down stun time
        if (player.stunTime > 0) {
          player.stunTime -= dt;
          if (player.stunTime <= 0) {
            player.stunTime = 0;
            // Grant immunity window after stun expires to prevent stun-lock
            player.stunImmunityTime = Math.max(player.stunImmunityTime || 0, 1.5);
          }
        }
        // Apply player knockback (from ground slam etc.)
        if (player.knockbackTime > 0) {
          const kbX = player.x + (player.knockbackVx || 0) * dt;
          const kbY = player.y + (player.knockbackVy || 0) * dt;
          const pr = CONSTANTS.PLAYER_RADIUS;
          if (!this.physics.collidesAt(kbX, player.y, room.dungeon, pr, player.elevation)) player.x = kbX;
          if (!this.physics.collidesAt(player.x, kbY, room.dungeon, pr, player.elevation)) player.y = kbY;
          player.knockbackTime -= dt;
          if (player.knockbackTime <= 0) {
            player.knockbackVx = 0;
            player.knockbackVy = 0;
            player.knockbackTime = 0;
            // Grant immunity window after knockback expires
            player.stunImmunityTime = Math.max(player.stunImmunityTime || 0, 0.75);
          }
        }
        // Tick down stun/knockback immunity window
        if ((player.stunImmunityTime || 0) > 0) {
          player.stunImmunityTime -= dt;
          if (player.stunImmunityTime <= 0) player.stunImmunityTime = 0;
        }
        // Tick channeling (pulse cannon etc.)
        if (player.channeling) {
          // Cancel if stunned or knocked back
          if (player.stunTime > 0 || player.knockbackTime > 0) {
            player.channeling = null;
          } else {
            // Cancel if player is trying to move
            const inp = player.input;
            if (inp && (inp.up || inp.down || inp.left || inp.right ||
                (inp.dx != null && inp.dy != null && (inp.dx !== 0 || inp.dy !== 0)))) {
              player.channeling = null;
            } else {
              player.channeling.timeRemaining -= dt;
              if (player.channeling.timeRemaining <= 0) {
                this._firePulseCannonProjectile(room, player);
              }
            }
          }
        }
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
        // Tick down hover duration
        if (player.hovering) {
          player.hoverTime -= dt;
          if (player.hoverTime <= 0) {
            player.hovering = false;
            player.hoverTime = 0;
            room.events.push({
              type: 'hover_end', targetId: player.id,
              x: player.x, y: player.y,
            });
          }
        }

        // Energy regeneration: solar panels (dayside) + sol grid generators
        // Only regenerates the rechargeable portion (not single-use)
        if (player.maxEnergy > 0) {
          const autoRegenRate = this.automation.getEnergyRegenRate(pid, room.dungeon.id);
          let regenRate = autoRegenRate;
          if (player.solGridEnergyRegen > 0) regenRate += player.solGridEnergyRegen;
          if (regenRate > 0) {
            const rechargeableMax = player.maxEnergy - player.singleUseMaxEnergy;
            const regenCap = rechargeableMax + player.singleUseEnergy;
            player.energy = Math.min(regenCap, player.energy + regenRate * dt);
          }
          if (autoRegenRate > 0) {
            this.automation.trackEnergyGenerated(pid, autoRegenRate * dt);
          }
        }

        // Tick automation production (silicon harvesters etc.)
        this.automation.updateProduction(pid, dt);
      }

      // Update monsters (AI + attacks)
      this.updateMonsters(room, dt);

      // Update light sentries (beam targeting, damage, slow)
      this.updateSentries(room, dt);

      // Update projectiles (movement, collision, lifetime)
      this.updateProjectiles(room, dt);

      // Apply darkness damage to players without sol unit in dark rooms
      this.updateDarkness(room, dt);

      // Apply environmental hazard damage (cold, heat, poison)
      this.updateEnvironmentalHazards(room, dt);

      // Check for floor transitions
      this.checkExits(room);
    }
  }

  updateDarkness(room, dt) {
    const ambientLight = room.dungeon.ambientLight;
    if (ambientLight === undefined || ambientLight >= 1.0) return;

    for (const [pid, player] of room.players) {
      // Players with sol unit equipped are safe (maxEnergy > 0)
      if (player.maxEnergy > 0) continue;

      if (!player.darknessDamageTimer) player.darknessDamageTimer = 0;
      player.darknessDamageTimer += dt;

      // Deal damage every 2 seconds
      if (player.darknessDamageTimer >= 2.0) {
        player.darknessDamageTimer -= 2.0;
        const damage = 5;
        player.health -= damage;
        room.events.push({
          type: 'darkness_damage', targetId: pid,
          amount: damage, x: player.x, y: player.y,
        });

        this._checkPlayerDeath(player, room);
      }
    }
  }

  updateEnvironmentalHazards(room, dt) {
    const hazard = room.dungeon.environmentalHazard;
    if (!hazard) return;

    const damage = hazard.damage || 3;
    const interval = hazard.interval || 2.0;
    const hazardType = hazard.type || 'environmental';

    for (const [pid, player] of room.players) {
      // Check if player has resistance to this hazard type
      if (this._playerResistsHazard(player, hazardType)) continue;

      if (!player.hazardDamageTimer) player.hazardDamageTimer = 0;
      player.hazardDamageTimer += dt;

      if (player.hazardDamageTimer >= interval) {
        player.hazardDamageTimer -= interval;
        player.health -= damage;
        room.events.push({
          type: 'hazard_damage', hazardType, targetId: pid,
          amount: damage, x: player.x, y: player.y,
        });

        this._checkPlayerDeath(player, room);
      }
    }
  }

  _playerResistsHazard(player, hazardType) {
    // Players with a sol unit that has matching hazardResist are immune
    if (player.solGrid && player.solGrid.innateBonus) {
      const resists = player.solGrid.innateBonus.hazardResist;
      if (resists && resists.includes(hazardType)) return true;
    }
    // Check inventory for items with hazardResist
    if (player.inventory) {
      for (const slot of player.inventory) {
        if (!slot) continue;
        const itemDef = this.content.getItem(slot.itemId);
        if (itemDef && itemDef.hazardResist && itemDef.hazardResist.includes(hazardType)) return true;
      }
    }
    // Check equipment for items with hazardResist
    if (player.equipment) {
      for (const slot of Object.values(player.equipment)) {
        if (!slot) continue;
        const itemDef = this.content.getItem(slot.itemId);
        if (itemDef && itemDef.hazardResist && itemDef.hazardResist.includes(hazardType)) return true;
      }
    }
    return false;
  }

  updateMonsters(room, dt) {
    for (const [mid, mob] of room.monsters) {
      mob.attackTimer = Math.max(0, mob.attackTimer - dt);

      // Tick down sentry slow effect and apply speed modifier
      if (mob.sentrySlowTime > 0) {
        mob.sentrySlowTime -= dt;
        if (mob.sentrySlowTime <= 0) {
          mob.sentrySlowFactor = 1.0;
          mob.sentrySlowTime = 0;
        }
      }
      const origSpeed = mob.speed;
      if (mob.sentrySlowFactor && mob.sentrySlowFactor < 1.0) {
        mob.speed = mob.speed * mob.sentrySlowFactor;
      }

      // Pack leader aura: buff nearby pack monsters' speed and damage
      const origDamage = mob.damage;
      mob._auraBuff = false;
      if (mob.ai === 'pack' || mob.ai === 'pack_leader') {
        for (const [lid, leader] of room.monsters) {
          if (lid === mid || leader.ai !== 'pack_leader' || leader.health <= 0) continue;
          if (!leader.aura) continue;
          const adx = leader.x - mob.x;
          const ady = leader.y - mob.y;
          const auraRange = (leader.aura.range || 5) * CONSTANTS.TILE_SIZE;
          if (adx * adx + ady * ady <= auraRange * auraRange) {
            mob.speed *= (leader.aura.speedMult || 1.0);
            mob.damage = Math.round(mob.damage * (leader.aura.damageMult || 1.0));
            mob._auraBuff = true;
            break; // Only one aura applies at a time
          }
        }
      }

      // Tick down special attack cooldowns
      if (mob.specialAttacks) {
        for (const sa of mob.specialAttacks) {
          if (sa.timer > 0) sa.timer = Math.max(0, sa.timer - dt);
        }
      }

      // Execute lunge movement if active
      if (mob.lungeTime > 0) {
        mob.lungeTime -= dt;
        const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;
        const lx = mob.x + mob.lungeVx * dt;
        const ly = mob.y + mob.lungeVy * dt;
        if (!this.physics.collidesAt(lx, mob.y, room.dungeon, mr, mob.elevation)) mob.x = lx;
        if (!this.physics.collidesAt(mob.x, ly, room.dungeon, mr, mob.elevation)) mob.y = ly;
        if (mob.lungeTime <= 0) {
          mob.lungeVx = 0;
          mob.lungeVy = 0;
          mob.lungeTime = 0;
        }
        // Check if lunge hits a player
        if (mob.lungeTarget) {
          const target = room.players.get(mob.lungeTarget);
          if (target) {
            const ldx = target.x - mob.x;
            const ldy = target.y - mob.y;
            const ldist = Math.sqrt(ldx * ldx + ldy * ldy);
            if (ldist < mob.attackRange * 0.8) {
              const lungeDmg = Math.round(mob.damage * (mob.lungeDamageMult || 1.5));
              target.health -= lungeDmg;
              mob.lungeTarget = null;
              mob.lungeTime = 0;
              mob.lungeVx = 0;
              mob.lungeVy = 0;
              room.events.push({
                type: 'damage', targetId: target.id,
                amount: lungeDmg, x: target.x, y: target.y,
              });
              room.events.push({
                type: 'lunge_hit', targetId: mob.id,
                x: mob.x, y: mob.y,
              });
              this._checkPlayerDeath(target, room);
            }
          }
        }
        continue; // Skip normal AI while lunging
      }

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

      // Fall back to nearest player within aggro range (same elevation only)
      if (!nearest) {
        for (const [pid, player] of room.players) {
          // Monsters only aggro players at the same elevation level
          if (Math.floor(player.elevation || 0) !== Math.floor(mob.elevation || 0)) continue;
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

      // Ambush: stay hidden until player is very close
      if (mob.ai === 'ambush' && mob.hidden) {
        const revealRange = 3 * CONSTANTS.TILE_SIZE;
        if (nearestDist <= revealRange || mob.aggroTarget) {
          mob.hidden = false;
          mob.ambushRevealed = true;
          room.events.push({
            type: 'ambush_reveal',
            targetId: mid,
            x: mob.x, y: mob.y,
          });
        } else {
          continue; // Stay dormant
        }
      }

      if (!mob.aggroTarget && nearestDist > aggroRange) {
        // Idle behavior based on spawn patrol mode
        const idleWanders = mob.idleMode === 'wander' || mob.idleMode === 'patrol' || mob.ai === 'patrol';
        if (mob.patrolWaypoints) {
          this._updateWaypointPatrol(mob, room.dungeon, dt);
        } else if (idleWanders) {
          this._updatePatrol(mob, room.dungeon, dt);
        } else if (mob.idleMode === 'guard') {
          // Guard: face nearest player but don't move
          if (nearest) {
            mob.facing = Math.atan2(nearest.y - mob.y, nearest.x - mob.x);
          }
        }
        continue;
      }

      if (mob.ai === 'melee_chase' || mob.ai === 'ambush' || mob.ai === 'patrol' || mob.ai === 'pack' || mob.ai === 'pack_leader') {
        // Pack: when aggroing, alert nearby pack monsters (pack_leader also triggers pack alert)
        if ((mob.ai === 'pack' || mob.ai === 'pack_leader') && nearest && !mob._packAlerted) {
          mob._packAlerted = true;
          const packRange = 8 * CONSTANTS.TILE_SIZE;
          for (const [otherId, other] of room.monsters) {
            if (otherId === mid || (other.ai !== 'pack' && other.ai !== 'pack_leader')) continue;
            const pdx = other.x - mob.x;
            const pdy = other.y - mob.y;
            if (Math.sqrt(pdx * pdx + pdy * pdy) <= packRange) {
              other.aggroTarget = nearest.id;
              other._packAlerted = true;
            }
          }
        }

        // Check for special attacks before normal behavior
        let usedSpecial = false;
        if (mob.specialAttacks) {
          usedSpecial = this._trySpecialAttack(mob, nearest, nearestDist, room, dt);
        }

        if (!usedSpecial) {
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
              if (!this.physics.collidesAt(nx, mob.y, room.dungeon, mr, mob.elevation)) mob.x = nx;
              if (!this.physics.collidesAt(mob.x, ny, room.dungeon, mr, mob.elevation)) mob.y = ny;
              mob.facing = Math.atan2(dy, dx);
            }
          } else if (mob.attackTimer <= 0) {
            // Ambush bonus: 1.5x damage on first strike
            let damage = mob.damage;
            if (mob.ai === 'ambush' && mob.ambushRevealed) {
              damage = Math.round(damage * 1.5);
              mob.ambushRevealed = false;
            }
            nearest.health -= damage;
            mob.attackTimer = mob.attackCooldown;
            room.events.push({
              type: 'damage', targetId: nearest.id,
              amount: damage, x: nearest.x, y: nearest.y,
            });

            this._checkPlayerDeath(nearest, room);
          }
        }
      } else if (mob.ai === 'ranged_kite') {
        const preferredRange = mob.attackRange * 0.6;
        const dx = nearest.x - mob.x;
        const dy = nearest.y - mob.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        mob.facing = Math.atan2(dy, dx);

        if (nearestDist < preferredRange) {
          // Too close — kite away
          if (len > 0) {
            const speed = mob.speed * CONSTANTS.TILE_SIZE * dt;
            const nx = mob.x - (dx / len) * speed;
            const ny = mob.y - (dy / len) * speed;
            const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;
            if (!this.physics.collidesAt(nx, mob.y, room.dungeon, mr, mob.elevation)) mob.x = nx;
            if (!this.physics.collidesAt(mob.x, ny, room.dungeon, mr, mob.elevation)) mob.y = ny;
          }
        } else if (nearestDist > mob.attackRange) {
          // Too far — close distance
          if (len > 0) {
            const speed = mob.speed * CONSTANTS.TILE_SIZE * dt;
            const nx = mob.x + (dx / len) * speed;
            const ny = mob.y + (dy / len) * speed;
            const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;
            if (!this.physics.collidesAt(nx, mob.y, room.dungeon, mr, mob.elevation)) mob.x = nx;
            if (!this.physics.collidesAt(mob.x, ny, room.dungeon, mr, mob.elevation)) mob.y = ny;
          }
        }

        // Shoot when in range and off cooldown
        if (nearestDist <= mob.attackRange && mob.attackTimer <= 0) {
          mob.attackTimer = mob.attackCooldown;
          if (len > 0) {
            const projId = `proj_${room.nextProjectileId++}`;
            room.projectiles.push({
              id: projId,
              ownerId: mob.id,
              isMonsterProjectile: true,
              projectileType: mob.projectile || null,
              x: mob.x,
              y: mob.y,
              vx: (dx / len) * CONSTANTS.PROJECTILE_SPEED * 0.7,
              vy: (dy / len) * CONSTANTS.PROJECTILE_SPEED * 0.7,
              damage: mob.damage,
              lifetime: CONSTANTS.PROJECTILE_LIFETIME,
            });
          }
        }
      } else if (mob.ai === 'boss_crystal') {
        this._updateBossCrystal(mob, nearest, nearestDist, room, dt);
      }

      // Restore original speed and damage after movement calculations
      mob.speed = origSpeed;
      mob.damage = origDamage;
    }
  }

  _updatePatrol(mob, dungeon, dt) {
    if (mob.patrolState === 'waiting') {
      mob.patrolTimer -= dt;
      if (mob.patrolTimer <= 0) {
        mob.patrolState = 'walking';
        mob.patrolTimer = 0;
        mob.patrolAngle += Math.PI * (0.5 + Math.random());
      }
      return;
    }

    // Walk in current direction
    const speed = mob.speed * CONSTANTS.TILE_SIZE * dt * 0.4;
    const nx = mob.x + Math.cos(mob.patrolAngle) * speed;
    const ny = mob.y + Math.sin(mob.patrolAngle) * speed;
    const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;

    let moved = false;
    if (!this.physics.collidesAt(nx, mob.y, dungeon, mr)) { mob.x = nx; moved = true; }
    if (!this.physics.collidesAt(mob.x, ny, dungeon, mr)) { mob.y = ny; moved = true; }
    mob.facing = mob.patrolAngle;

    // If hit a wall or wandered too far from spawn, stop and turn
    const dxSpawn = mob.x - mob.spawnX;
    const dySpawn = mob.y - mob.spawnY;
    const distFromSpawn = Math.sqrt(dxSpawn * dxSpawn + dySpawn * dySpawn);
    const maxPatrolDist = 4 * CONSTANTS.TILE_SIZE;

    if (!moved || distFromSpawn > maxPatrolDist) {
      // Turn back toward spawn
      mob.patrolAngle = Math.atan2(mob.spawnY - mob.y, mob.spawnX - mob.x) + (Math.random() - 0.5) * 0.5;
      mob.patrolState = 'waiting';
      mob.patrolTimer = 1.0 + Math.random() * 2.0;
    }

    mob.patrolTimer += dt;
    if (mob.patrolTimer > 3.0) {
      mob.patrolState = 'waiting';
      mob.patrolTimer = 1.0 + Math.random() * 1.5;
    }
  }

  _updateWaypointPatrol(mob, dungeon, dt) {
    const waypoints = mob.patrolWaypoints;
    if (!waypoints || waypoints.length < 2) return;

    if (mob.patrolState === 'waiting') {
      mob.patrolTimer -= dt;
      if (mob.patrolTimer <= 0) {
        mob.patrolState = 'walking';
        mob.patrolTimer = 0;
      }
      return;
    }

    const target = waypoints[mob.patrolWaypointIndex];
    const dx = target.x - mob.x;
    const dy = target.y - mob.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const arrivalThreshold = CONSTANTS.TILE_SIZE * 0.3;

    if (dist < arrivalThreshold) {
      // Arrived at waypoint — advance to next
      mob.patrolWaypointIndex = (mob.patrolWaypointIndex + 1) % waypoints.length;
      mob.patrolState = 'waiting';
      mob.patrolTimer = 1.0 + Math.random() * 1.0;
      return;
    }

    // Move toward current waypoint
    const speed = mob.speed * CONSTANTS.TILE_SIZE * dt * 0.4;
    const nx = mob.x + (dx / dist) * speed;
    const ny = mob.y + (dy / dist) * speed;
    const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;

    if (!this.physics.collidesAt(nx, mob.y, dungeon, mr)) mob.x = nx;
    if (!this.physics.collidesAt(mob.x, ny, dungeon, mr)) mob.y = ny;
    mob.facing = Math.atan2(dy, dx);
  }

  _generateDefaultPatrolPath(mob, dungeon) {
    // Generate a back-and-forth path ±3 tiles from spawn along whichever axis is clear
    const spawnTileX = Math.floor(mob.spawnX / CONSTANTS.TILE_SIZE);
    const spawnTileY = Math.floor(mob.spawnY / CONSTANTS.TILE_SIZE);
    const reach = 3;

    // Try horizontal patrol first
    let leftX = spawnTileX, rightX = spawnTileX;
    for (let d = 1; d <= reach; d++) {
      if (this.content.isSpawnable(dungeon, spawnTileX - d, spawnTileY)) leftX = spawnTileX - d;
      else break;
    }
    for (let d = 1; d <= reach; d++) {
      if (this.content.isSpawnable(dungeon, spawnTileX + d, spawnTileY)) rightX = spawnTileX + d;
      else break;
    }

    if (rightX - leftX >= 2) {
      return [
        { x: (leftX + 0.5) * CONSTANTS.TILE_SIZE, y: mob.spawnY },
        { x: (rightX + 0.5) * CONSTANTS.TILE_SIZE, y: mob.spawnY },
      ];
    }

    // Try vertical patrol
    let topY = spawnTileY, bottomY = spawnTileY;
    for (let d = 1; d <= reach; d++) {
      if (this.content.isSpawnable(dungeon, spawnTileX, spawnTileY - d)) topY = spawnTileY - d;
      else break;
    }
    for (let d = 1; d <= reach; d++) {
      if (this.content.isSpawnable(dungeon, spawnTileX, spawnTileY + d)) bottomY = spawnTileY + d;
      else break;
    }

    if (bottomY - topY >= 2) {
      return [
        { x: mob.spawnX, y: (topY + 0.5) * CONSTANTS.TILE_SIZE },
        { x: mob.spawnX, y: (bottomY + 0.5) * CONSTANTS.TILE_SIZE },
      ];
    }

    // Fallback: patrol in a small area around spawn
    return [
      { x: mob.spawnX - CONSTANTS.TILE_SIZE, y: mob.spawnY },
      { x: mob.spawnX + CONSTANTS.TILE_SIZE, y: mob.spawnY },
    ];
  }

  _updateBossCrystal(mob, nearest, nearestDist, room, dt) {
    const phases = mob.bossPhases;
    if (!phases || !phases.length) return;

    // Determine current phase based on HP percentage
    const hpPct = mob.health / mob.maxHealth;
    let newPhase = 0;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (hpPct <= phases[i].threshold) {
        newPhase = i;
        break;
      }
    }

    // Phase transition
    if (newPhase !== mob.bossPhase) {
      mob.bossPhase = newPhase;
      mob.bossSummonCount = 0;
      room.events.push({
        type: 'boss_phase',
        targetId: mob.id,
        phase: newPhase + 1,
        x: mob.x, y: mob.y,
      });
    }

    const phase = phases[mob.bossPhase];
    const effectiveSpeed = (phase.speed || mob.speed) * CONSTANTS.TILE_SIZE * dt;
    const dx = nearest.x - mob.x;
    const dy = nearest.y - mob.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    mob.facing = Math.atan2(dy, dx);
    const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;
    const effectiveDamage = phase.damage || mob.damage;

    // Try special attacks before normal behavior
    if (mob.specialAttacks) {
      if (this._trySpecialAttack(mob, nearest, nearestDist, room, dt)) {
        // Still run projectile and summon logic even when using a special attack
        this._updateBossProjectiles(mob, phase, effectiveDamage, dx, dy, len, room, dt);
        this._updateBossSummons(mob, phase, room, dt);
        return;
      }
    }

    // Movement: chase in melee/summon modes, kite in ranged mode
    if (phase.mode === 'ranged' && nearestDist < mob.attackRange * 0.5) {
      // Kite away when too close
      if (len > 0) {
        const nx = mob.x - (dx / len) * effectiveSpeed;
        const ny = mob.y - (dy / len) * effectiveSpeed;
        if (!this.physics.collidesAt(nx, mob.y, room.dungeon, mr, mob.elevation)) mob.x = nx;
        if (!this.physics.collidesAt(mob.x, ny, room.dungeon, mr, mob.elevation)) mob.y = ny;
      }
    } else if (nearestDist > mob.attackRange) {
      // Chase
      if (len > 0) {
        const nx = mob.x + (dx / len) * effectiveSpeed;
        const ny = mob.y + (dy / len) * effectiveSpeed;
        if (!this.physics.collidesAt(nx, mob.y, room.dungeon, mr, mob.elevation)) mob.x = nx;
        if (!this.physics.collidesAt(mob.x, ny, room.dungeon, mr, mob.elevation)) mob.y = ny;
      }
    }

    // Melee attack (all phases can melee when in range)
    if (nearestDist <= mob.attackRange && mob.attackTimer <= 0) {
      nearest.health -= effectiveDamage;
      mob.attackTimer = mob.attackCooldown;
      room.events.push({
        type: 'damage', targetId: nearest.id,
        amount: effectiveDamage, x: nearest.x, y: nearest.y,
      });
      this._checkPlayerDeath(nearest, room);
    }

    // Projectile attack (phase 2+)
    this._updateBossProjectiles(mob, phase, effectiveDamage, dx, dy, len, room, dt);

    // Summon minions (phase 3)
    this._updateBossSummons(mob, phase, room, dt);
  }

  _updateBossProjectiles(mob, phase, effectiveDamage, dx, dy, len, room, dt) {
    if (!phase.projectile || len <= 0) return;
    mob.bossProjectileTimer -= dt;
    if (mob.bossProjectileTimer <= 0) {
      mob.bossProjectileTimer = phase.projectileInterval || 1.5;
      // Fire a spread of crystal shards
      const spreadCount = phase.mode === 'summon' ? 3 : 2;
      const spreadAngle = Math.PI / 8;
      const baseAngle = Math.atan2(dy, dx);
      for (let s = 0; s < spreadCount; s++) {
        const angle = baseAngle + (s - (spreadCount - 1) / 2) * spreadAngle;
        const projId = `proj_${room.nextProjectileId++}`;
        room.projectiles.push({
          id: projId,
          ownerId: mob.id,
          isMonsterProjectile: true,
          projectileType: phase.projectile,
          x: mob.x,
          y: mob.y,
          vx: Math.cos(angle) * CONSTANTS.PROJECTILE_SPEED * 0.6,
          vy: Math.sin(angle) * CONSTANTS.PROJECTILE_SPEED * 0.6,
          damage: Math.round(effectiveDamage * 0.6),
          lifetime: CONSTANTS.PROJECTILE_LIFETIME,
        });
      }
    }
  }

  _updateBossSummons(mob, phase, room, dt) {
    if (!phase.summonType || !phase.summonCount) return;
    const mr = CONSTANTS.MONSTER_COLLISION_RADIUS;
    mob.bossSummonTimer -= dt;
    if (mob.bossSummonTimer <= 0 && mob.bossSummonCount < phase.summonCount) {
      mob.bossSummonTimer = phase.summonInterval || 8.0;
      const minionDef = this.content.getMonster(phase.summonType);
      if (minionDef) {
        const summonCount = Math.min(2, phase.summonCount - mob.bossSummonCount);
        for (let s = 0; s < summonCount; s++) {
          const angle = (Math.PI * 2 * s) / summonCount + Math.random() * 0.5;
          const dist = 2 * CONSTANTS.TILE_SIZE;
          const sx = mob.x + Math.cos(angle) * dist;
          const sy = mob.y + Math.sin(angle) * dist;
          if (this.physics.collidesAt(sx, sy, room.dungeon, mr)) continue;
          const minionId = `mob_${room.nextMonsterId++}`;
          const minionMob = {
            id: minionId,
            type: phase.summonType,
            name: minionDef.name,
            x: sx, y: sy,
            spawnX: sx, spawnY: sy,
            health: minionDef.health,
            maxHealth: minionDef.health,
            speed: minionDef.speed,
            damage: minionDef.damage,
            attackRange: (minionDef.attackRange || 1) * CONSTANTS.TILE_SIZE,
            attackCooldown: 1 / (minionDef.attackSpeed || 1),
            attackTimer: 0,
            ai: minionDef.ai,
            facing: angle,
            idleMode: 'stationary',
            isSummon: true,
          };
          if (minionDef.specialAttacks && minionDef.specialAttacks.length > 0) {
            minionMob.specialAttacks = minionDef.specialAttacks.map(sa => ({
              ...sa,
              timer: sa.cooldown * (0.3 + Math.random() * 0.7),
            }));
          }
          room.monsters.set(minionId, minionMob);
          mob.bossSummonCount++;
        }
        room.events.push({
          type: 'boss_summon',
          targetId: mob.id,
          x: mob.x, y: mob.y,
        });
      }
    }
  }

  /**
   * Try to use a special attack. Returns true if one was used (preempts normal behavior).
   * Special attack types: lunge, stun, ground_slam
   */
  _trySpecialAttack(mob, target, dist, room, dt) {
    const TILE = CONSTANTS.TILE_SIZE;
    for (const sa of mob.specialAttacks) {
      if (sa.timer > 0) continue;

      const saRange = (sa.range || 4) * TILE;

      if (sa.type === 'lunge') {
        // Lunge: dash toward player when outside melee but within lunge range
        if (dist > mob.attackRange && dist <= saRange) {
          const dx = target.x - mob.x;
          const dy = target.y - mob.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const lungeSpeed = (sa.speed || 8) * TILE;
            mob.lungeVx = (dx / len) * lungeSpeed;
            mob.lungeVy = (dy / len) * lungeSpeed;
            mob.lungeTime = sa.duration || 0.25;
            mob.lungeTarget = target.id;
            mob.lungeDamageMult = sa.damage || 1.5;
            mob.facing = Math.atan2(dy, dx);
            sa.timer = sa.cooldown;
            room.events.push({
              type: 'lunge_start', targetId: mob.id,
              x: mob.x, y: mob.y,
              tx: target.x, ty: target.y,
            });
            return true;
          }
        }
      } else if (sa.type === 'stun') {
        // Stun: when in melee range, stun the player briefly
        if (dist <= mob.attackRange && mob.attackTimer <= 0) {
          const stunDmg = Math.round(mob.damage * (sa.damage || 0.5));
          target.health -= stunDmg;
          // Respect immunity window — still deal damage but skip stun effect
          if (!(target.stunImmunityTime > 0)) {
            target.stunTime = sa.duration || 1.0;
          }
          mob.attackTimer = mob.attackCooldown;
          sa.timer = sa.cooldown;
          room.events.push({
            type: 'damage', targetId: target.id,
            amount: stunDmg, x: target.x, y: target.y,
          });
          if (!(target.stunImmunityTime > 0)) {
            room.events.push({
              type: 'stun', targetId: target.id,
              duration: sa.duration || 1.0,
              x: target.x, y: target.y,
            });
          }
          this._checkPlayerDeath(target, room);
          return true;
        }
      } else if (sa.type === 'ground_slam') {
        // Ground slam: AOE knockback + damage when in range
        if (dist <= saRange && mob.attackTimer <= 0) {
          const slamDmg = Math.round(mob.damage * (sa.damage || 1.2));
          const knockback = sa.knockback || 128;
          sa.timer = sa.cooldown;
          mob.attackTimer = mob.attackCooldown;
          // Hit all players in range
          for (const [pid, player] of room.players) {
            const pdx = player.x - mob.x;
            const pdy = player.y - mob.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pdist <= saRange && pdist > 0) {
              player.health -= slamDmg;
              // Apply knockback only if not immune
              if (!(player.stunImmunityTime > 0)) {
                player.knockbackVx = (pdx / pdist) * knockback;
                player.knockbackVy = (pdy / pdist) * knockback;
                player.knockbackTime = 0.3;
              }
              room.events.push({
                type: 'damage', targetId: player.id,
                amount: slamDmg, x: player.x, y: player.y,
              });
              this._checkPlayerDeath(player, room);
            }
          }
          room.events.push({
            type: 'ground_slam', targetId: mob.id,
            range: saRange, x: mob.x, y: mob.y,
          });
          return true;
        }
      }
    }
    return false;
  }

  _checkPlayerDeath(player, room) {
    if (player.health <= 0) {
      const deathX = player.x;
      const deathY = player.y;

      // Death penalty: drain 25% of current energy
      const energyLost = Math.floor(player.energy * 0.25);
      if (energyLost > 0) {
        this._consumeEnergy(player, energyLost, room);
      }

      // Death penalty: drop non-quest inventory items based on dropBehavior
      // dropBehavior per item definition: "keep" = retained, "destroy" = removed,
      // "drop" (default) = spawned on ground. Quest items (key, sol_component) always kept.
      // Exception: if player is on an expedition, all non-quest loot is forfeited (destroyed).
      const onExpedition = !!this.flagStore.getPlayerFlag(player.id, 'expedition_active');
      const droppedItems = [];
      const keptItems = [];
      for (const item of player.inventory) {
        if (item.category === 'key' || item.category === 'sol_component') {
          keptItems.push(item);
          continue;
        }
        const itemDef = this.content.getItem(item.type);
        const behavior = (itemDef && itemDef.dropBehavior) || 'drop';
        if (behavior === 'keep') {
          keptItems.push(item);
        } else if (behavior === 'destroy' || onExpedition) {
          // Expedition death: forfeit all non-quest floor loot (destroyed, not dropped)
          droppedItems.push(item);
        } else {
          // Default "drop": spawn on ground at death position
          droppedItems.push(item);
          const itemId = `item_${room.nextItemId++}`;
          room.items.set(itemId, {
            id: itemId,
            type: item.type,
            name: item.name,
            rarity: item.rarity || 'common',
            category: item.category || 'misc',
            x: deathX,
            y: deathY,
          });
        }
      }
      player.inventory = keptItems;

      // Reset player state
      player.health = player.maxHealth;
      player.hovering = false;
      player.hoverTime = 0;
      player.elevation = 0;

      // If player was on an expedition, clear expedition state (failed/abandoned)
      // and return them to the expedition origin (meridian_station) instead of the global spawn
      let expeditionOrigin = null;
      if (this.flagStore.getPlayerFlag(player.id, 'expedition_active')) {
        const expTier = this.flagStore.getPlayerFlag(player.id, 'expedition_tier');
        expeditionOrigin = this.flagStore.getPlayerFlag(player.id, 'expedition_origin') || 'meridian_station';
        const expFlags = [
          'expedition_active', 'expedition_tier', 'expedition_floor',
          'expedition_max_floors', 'expedition_template', 'expedition_boss_type',
          'expedition_scaling', 'expedition_origin', 'expedition_boss_killed',
        ];
        for (const flag of expFlags) {
          this.flagStore.removePlayerFlag(player.id, flag);
        }
        console.log(`[GameLoop] Player ${player.id} died during expedition tier ${expTier} — expedition failed, returning to ${expeditionOrigin}`);
      }

      // Determine respawn destination: expedition origin if applicable, otherwise global spawn room
      const spawnRoomId = expeditionOrigin || this.content.getSpawnRoom() || 'outpost_entrance';
      const needsTransition = room.id !== spawnRoomId;

      if (needsTransition) {
        // Queue a room transition to the spawn room
        this.pendingTransitions.push({
          playerId: player.id,
          fromRoom: room.id,
          toDungeon: spawnRoomId,
          deathRespawn: true,
        });
      } else {
        // Already in spawn room — just move to spawn point
        const spawn = room.dungeon.spawns[0] || { x: 2, y: 2 };
        player.x = (spawn.x + 0.5) * CONSTANTS.TILE_SIZE;
        player.y = (spawn.y + 0.5) * CONSTANTS.TILE_SIZE;
      }

      room.events.push({
        type: 'death', targetId: player.id,
        x: deathX, y: deathY,
        respawnRoom: needsTransition ? spawnRoomId : null,
      });

      // Queue inventory update for the client
      const droppedNames = droppedItems.map(i => i.name);
      this.pendingDeathPenalties.push({
        playerId: player.id,
        inventory: player.inventory,
        equipment: player.equipment,
        medipacCharges: player.medipacCharges || 0,
        credits: player.credits || 0,
        energyLost,
        droppedItems: droppedNames,
        expeditionForfeit: onExpedition,
      });

      const deathCtx = this._scriptContext(player.id, room.id);
      this._emitGameEvent(EventBus.Events.PLAYER_DEATH, {
        playerId: player.id, roomId: room.id,
      }, deathCtx);
    }
  }

  consumeDeathPenalties() {
    const penalties = this.pendingDeathPenalties;
    this.pendingDeathPenalties = [];
    return penalties;
  }

  // Spawn a projectile from player attack
  tryAttack(roomId, playerId, aimAngle = null) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const player = room.players.get(playerId);
    if (!player) return false;

    // Check if player has a projectile weapon equipped
    const weapon = player.equipment && player.equipment.arms;
    if (!weapon || !weapon.stats || !weapon.stats.projectile) return false;

    // Cannot attack while stunned or knocked back
    if (player.stunTime > 0 || player.knockbackTime > 0) return false;

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
        if (mob.hidden) continue;
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
      projectileType: weapon.stats.projectileType || null,
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

      // Update position (save old position for swept collision)
      const prevX = proj.x;
      const prevY = proj.y;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Update lifetime
      proj.lifetime -= dt;
      if (proj.lifetime <= 0) {
        toRemove.push(i);
        continue;
      }

      // Check wall collision (swept: sample along path to prevent tunneling through walls)
      const radius = proj.radius || CONSTANTS.PROJECTILE_RADIUS;
      let hitWall = false;
      const dxW = proj.x - prevX;
      const dyW = proj.y - prevY;
      const dist = Math.sqrt(dxW * dxW + dyW * dyW);
      const stepSize = CONSTANTS.TILE_SIZE * 0.5;
      if (dist > stepSize) {
        const steps = Math.ceil(dist / stepSize);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          if (this.physics.collidesAt(prevX + dxW * t, prevY + dyW * t, room.dungeon, radius)) {
            hitWall = true;
            break;
          }
        }
      } else {
        hitWall = this.physics.collidesAt(proj.x, proj.y, room.dungeon, radius);
      }
      if (hitWall) {
        if (proj.projectileType === 'pulse_cannon') {
          this._detonatePulseCannon(room, proj);
        }
        toRemove.push(i);
        continue;
      }

      // Pulse cannon: detonate on reaching target or hitting any monster
      if (proj.projectileType === 'pulse_cannon') {
        let detonate = false;
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);
        if (distToTarget < CONSTANTS.TILE_SIZE * 0.5) detonate = true;

        // Check monster collision
        if (!detonate) {
          for (const [mid, mob] of room.monsters) {
            if (mob.hidden) continue;
            const mdx = mob.x - proj.x;
            const mdy = mob.y - proj.y;
            const dist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (dist < CONSTANTS.MONSTER_COLLISION_RADIUS + radius + CONSTANTS.PROJECTILE_HIT_BONUS) {
              detonate = true;
              break;
            }
          }
        }

        if (detonate) {
          this._detonatePulseCannon(room, proj);
          toRemove.push(i);
        }
        continue;
      }

      // Check monster collision (only for player-fired projectiles)
      // Uses swept line test (segment from prevPos to curPos vs monster circle)
      // to prevent fast projectiles from tunnelling through monsters.
      // PROJECTILE_HIT_BONUS adds forgiveness so shots overlapping the sprite visually connect.
      let hitMonster = false;
      if (!proj.isMonsterProjectile) for (const [mid, mob] of room.monsters) {
        if (mob.hidden) continue;
        const hitRadius = CONSTANTS.MONSTER_COLLISION_RADIUS + radius + CONSTANTS.PROJECTILE_HIT_BONUS;

        // Find closest point on segment [prev->cur] to monster center
        const segDx = proj.x - prevX;
        const segDy = proj.y - prevY;
        const segLen2 = segDx * segDx + segDy * segDy;
        let t = 0;
        if (segLen2 > 0) {
          t = ((mob.x - prevX) * segDx + (mob.y - prevY) * segDy) / segLen2;
          t = Math.max(0, Math.min(1, t));
        }
        const closestX = prevX + t * segDx;
        const closestY = prevY + t * segDy;
        const dx = mob.x - closestX;
        const dy = mob.y - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

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
              monsterType: mob.type,
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

            // Grant XP for kill (with expedition scaling)
            const killer = room.players.get(proj.ownerId);
            if (killer) {
              const monsterDef = this.content.getMonster(mob.type);
              if (monsterDef && monsterDef.xp) {
                this.grantXp(killer, Math.round(monsterDef.xp * (mob.xpMult || 1)), room);
              }
            }

            this._rollLoot(room, mob);

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

          // Heal on hit
          if (proj.healOnHit > 0) {
            const attacker = room.players.get(proj.ownerId);
            if (attacker) {
              attacker.health = Math.min(attacker.maxHealth, attacker.health + proj.healOnHit);
            }
          }

          hitMonster = true;
          toRemove.push(i);
          break;
        }
      }

      if (hitMonster) continue;

      // Check player collision (for monster-fired projectiles)
      // Also uses swept line test to prevent tunnelling.
      if (proj.isMonsterProjectile) {
        let hitPlayer = false;
        for (const [pid, player] of room.players) {
          const hitRadius = CONSTANTS.PLAYER_RADIUS + radius + CONSTANTS.PROJECTILE_HIT_BONUS;
          const segDx = proj.x - prevX;
          const segDy = proj.y - prevY;
          const segLen2 = segDx * segDx + segDy * segDy;
          let t = 0;
          if (segLen2 > 0) {
            t = ((player.x - prevX) * segDx + (player.y - prevY) * segDy) / segLen2;
            t = Math.max(0, Math.min(1, t));
          }
          const closestX = prevX + t * segDx;
          const closestY = prevY + t * segDy;
          const dx = player.x - closestX;
          const dy = player.y - closestY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < hitRadius) {
            player.health -= proj.damage;
            room.events.push({
              type: 'damage', targetId: pid,
              amount: proj.damage, x: player.x, y: player.y,
            });
            this._checkPlayerDeath(player, room);
            hitPlayer = true;
            toRemove.push(i);
            break;
          }
        }
        if (hitPlayer) continue;
      }
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
        const cooldownFlag = `_exit_blocked_${exit.x}_${exit.y}`;
        if (playerTX === exit.x && playerTY === exit.y) {
          // Check conditions on exit (e.g. quest completion, key items)
          if (exit.conditions) {
            const ctx = this._scriptContext(pid, room.id);
            if (!this.conditions.evaluate(exit.conditions, ctx)) {
              // Show fail message and block transition (once per approach)
              if (!player[cooldownFlag]) {
                player[cooldownFlag] = true;
                const failMsg = exit.failMessage || 'You can\'t go there yet.';
                this.actions.sendToPlayer(pid, {
                  type: CONSTANTS.MSG.DIALOGUE,
                  dialogue: [{ speaker: '', text: failMsg }],
                });
              }
              continue;
            }
          }
          const transition = {
            playerId: pid,
            fromRoom: room.id,
            toDungeon: exit.leadsTo,
            spawnX: exit.spawnX != null ? exit.spawnX : null,
            spawnY: exit.spawnY != null ? exit.spawnY : null,
            targetId: exit.targetId || null,
            exitX: exit.x,
            exitY: exit.y,
            depth: exit.depth,
          };
          // Attach expedition context so the transition handler can apply scaling
          // and detect completion
          if (this.flagStore.getPlayerFlag(pid, 'expedition_active')) {
            transition.expeditionTier = this.flagStore.getPlayerFlag(pid, 'expedition_tier');
            transition.expeditionMaxFloors = this.flagStore.getPlayerFlag(pid, 'expedition_max_floors');
            transition.expeditionBossType = this.flagStore.getPlayerFlag(pid, 'expedition_boss_type');
            transition.expeditionScaling = this.flagStore.getPlayerFlag(pid, 'expedition_scaling');
          }
          this.pendingTransitions.push(transition);
          break;
        } else if (player[cooldownFlag]) {
          // Player stepped off — reset so message shows again on next approach
          delete player[cooldownFlag];
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
      // Salvage goes to automation resources instead of inventory
      if (closestItem.type === 'salvage') {
        this.automation.addResource(playerId, 'salvage', 1);
        // Migrate any legacy salvage sitting in inventory to automation resources
        const legacySalvage = player.inventory.filter(i => i.type === 'salvage').length;
        if (legacySalvage > 0) {
          player.inventory = player.inventory.filter(i => i.type !== 'salvage');
          this.automation.addResource(playerId, 'salvage', legacySalvage);
        }
      } else if (closestItem.type === 'medical_supplies') {
        // Medical supplies go to medipac charges, not inventory
        player.medipacCharges = (player.medipacCharges || 0) + 1;
      } else {
        const invItem = {
          type: closestItem.type,
          name: closestItem.name,
          rarity: closestItem.rarity,
          category: closestItemDef ? closestItemDef.type : 'misc',
        };
        if (closestItemDef && closestItemDef.solComponentId) {
          const solComp = this.content.getSolComponent(closestItemDef.solComponentId);
          if (solComp && solComp.adjacencyPattern) {
            invItem.adjacencyPattern = solComp.adjacencyPattern;
          }
        }
        player.inventory.push(invItem);
      }
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

      // 3. Check for nearby NPCs (dialogue) — before committing to door,
      // since an NPC closer than the door should win the interaction
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

      // If an NPC is closer than the door, prefer talking to the NPC
      if (closestNPC && closestDoor && closestDoor.tileDef.togglesTo != null && closestNPCDist < closestDoorDist) {
        const ctx = this._scriptContext(playerId, roomId);
        const dialogue = this._resolveDialogue(closestNPC, ctx);
        this._emitGameEvent(EventBus.Events.NPC_INTERACTED, {
          playerId, roomId, npcType: closestNPC.type, npcId: closestNPC.id,
        }, ctx);
        return { interactType: 'dialogue', npcId: closestNPC.id, dialogue };
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
          tileName: closestDoor.tileDef.name,
        }, ctx);

        return {
          interactType: 'door',
          x: closestDoor.tx,
          y: closestDoor.ty,
          tileId: newTileId,
        };
      }

      // No door found — check NPC without door comparison
      if (closestNPC) {
        const ctx = this._scriptContext(playerId, roomId);
        const dialogue = this._resolveDialogue(closestNPC, ctx);
        this._emitGameEvent(EventBus.Events.NPC_INTERACTED, {
          playerId, roomId, npcType: closestNPC.type, npcId: closestNPC.id,
        }, ctx);
        return { interactType: 'dialogue', npcId: closestNPC.id, dialogue };
      }
    } else {
      // No tileset — still check NPCs
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
        this._emitGameEvent(EventBus.Events.NPC_INTERACTED, {
          playerId, roomId, npcType: closestNPC.type, npcId: closestNPC.id,
        }, ctx);
        return { interactType: 'dialogue', npcId: closestNPC.id, dialogue };
      }
    }

    return null;
  }

  // Handle a player's choice menu selection
  handleChoiceSelect(roomId, playerId, choiceId, value) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;

    // Intercept crafting choices — handled directly by the action executor
    if (choiceId === 'meridian_craft') {
      const ctx = this._scriptContext(playerId, roomId);
      this.actions.executeCraftRecipe(value, ctx);
      return;
    }

    // Intercept meridian menu choices — open automation or shop
    if (choiceId === 'meridian_menu') {
      const ctx = this._scriptContext(playerId, roomId);
      if (value === 'open_automation') {
        this.actions.execute({ type: 'openAutomation' }, ctx);
      } else if (value === 'open_shop') {
        this.actions.execute({ type: 'shop', shopId: 'meridian_7_shop' }, ctx);
      }
      return;
    }

    // Intercept shop choices — handled directly by the action executor
    if (choiceId.startsWith('shop_')) {
      const shopId = choiceId.replace('shop_', '');
      const ctx = this._scriptContext(playerId, roomId);
      this.actions.executeShopTransaction(shopId, value, ctx);
      return;
    }

    const ctx = this._scriptContext(playerId, roomId);
    this._emitGameEvent(EventBus.Events.CHOICE_MADE, {
      playerId, roomId, choiceId, value,
    }, ctx);
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

    // Energy effect (e.g. rechargeable batteries) — only restores rechargeable pool
    if (itemDef.effect.energy && player.energy !== undefined) {
      const rechargeableMax = (player.maxEnergy || 100) - (player.singleUseMaxEnergy || 0);
      const rechargeableCurrent = player.energy - (player.singleUseEnergy || 0);
      if (rechargeableCurrent < rechargeableMax) {
        const restoreAmount = Math.min(itemDef.effect.energy, rechargeableMax - rechargeableCurrent);
        player.energy += restoreAmount;
        used = true;

        room.events.push({
          type: 'heal', targetId: player.id,
          amount: restoreAmount, x: player.x, y: player.y,
        });
      }
    }

    // Create extraction point (flare)
    if (itemDef.effect.createExtraction) {
      // Remove any previous extraction point owned by this player
      this._removeExtractionPoint(playerId);

      // Create extraction point at player's current position
      const epId = `ep_${playerId}_${Date.now()}`;
      const ep = {
        id: epId,
        ownerId: playerId,
        roomId: roomId,
        x: player.x,
        y: player.y,
      };
      if (!room.extractionPoints) room.extractionPoints = [];
      room.extractionPoints.push(ep);

      // Store reference on the player for cross-room lookup
      player.extractionPoint = ep;

      // Replace the flare with an extraction protocol item
      player.inventory.splice(inventoryIndex, 1, { type: 'extraction_protocol' });

      room.events.push({
        type: 'extraction_placed', x: player.x, y: player.y, ownerId: playerId,
      });

      return { inventory: player.inventory, equipment: player.equipment };
    }

    // Teleport to extraction point
    if (itemDef.effect.teleportToExtraction) {
      if (!player.extractionPoint) return null;

      const ep = player.extractionPoint;
      const targetRoomId = ep.roomId;

      // Remove the extraction point
      this._removeExtractionPoint(playerId);
      player.extractionPoint = null;

      // Remove the consumed item
      player.inventory.splice(inventoryIndex, 1);

      if (targetRoomId === roomId) {
        // Same room — just teleport
        player.x = ep.x;
        player.y = ep.y;
        room.events.push({
          type: 'teleport', targetId: playerId, x: ep.x, y: ep.y,
        });
      } else {
        // Different room — queue a floor transition
        this.pendingTransitions.push({
          playerId: playerId,
          fromRoom: roomId,
          toDungeon: targetRoomId,
          spawnX: (ep.x / CONSTANTS.TILE_SIZE) - 0.5,
          spawnY: (ep.y / CONSTANTS.TILE_SIZE) - 0.5,
          targetId: null,
          exitX: null,
          exitY: null,
          depth: null,
        });
      }

      return { inventory: player.inventory, equipment: player.equipment };
    }

    if (!used) return null;

    // Remove the consumed item
    player.inventory.splice(inventoryIndex, 1);
    return { inventory: player.inventory, equipment: player.equipment };
  }

  // Remove extraction point for a player from whatever room it's in
  _removeExtractionPoint(playerId) {
    for (const [, room] of this.rooms) {
      if (!room.extractionPoints) continue;
      const idx = room.extractionPoints.findIndex(ep => ep.ownerId === playerId);
      if (idx !== -1) {
        room.extractionPoints.splice(idx, 1);
        return;
      }
    }
  }

  // Get total attack damage for a player (base + equipment bonuses)
  _handleMonsterDeath(mob, room, killerId) {
    const mid = mob.id;
    room.events.push({
      type: 'death', targetId: mid,
      monsterType: mob.type,
      x: mob.x, y: mob.y,
    });
    room.monsters.delete(mid);

    // Record the kill
    if (mob.spawnKey) {
      if (!this.killedMonsters.has(room.dungeonId)) {
        this.killedMonsters.set(room.dungeonId, new Set());
      }
      this.killedMonsters.get(room.dungeonId).add(mob.spawnKey);
    }

    // Grant XP for kill (with expedition scaling)
    const killer = room.players.get(killerId);
    if (killer) {
      const monsterDef = this.content.getMonster(mob.type);
      if (monsterDef && monsterDef.xp) {
        this.grantXp(killer, Math.round(monsterDef.xp * (mob.xpMult || 1)), room);
      }
    }

    this._rollLoot(room, mob);

    // Emit monster_killed scripting event
    const ctx = this._scriptContext(killerId, room.id);
    this._emitGameEvent(EventBus.Events.MONSTER_KILLED, {
      playerId: killerId,
      roomId: room.id,
      monsterType: mob.type,
      monsterId: mid,
      monsterX: mob.x, monsterY: mob.y,
    }, ctx);
  }

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

  // Calculate XP required to advance from a given level.
  // Uses settings from content/settings.json xpSystem.
  _xpForLevel(level) {
    const settings = this.content.getSettings();
    const xpSys = (settings && settings.xpSystem) || {};
    const base = xpSys.baseXpToLevel || 100;
    const scale = xpSys.xpScalingFactor || 1.5;
    return Math.floor(base * Math.pow(scale, level - 1));
  }

  // Roll loot from a monster's loot table and spawn ground items at its death position
  _rollLoot(room, mob) {
    const monsterDef = this.content.getMonster(mob.type);
    if (!monsterDef || !monsterDef.lootTable) return;
    const table = this.content.getLootTable(monsterDef.lootTable);
    if (!table || !table.rolls || table.rolls.length === 0) return;

    if (Math.random() >= (table.dropChance || 0)) return;

    // Weighted random selection
    const totalWeight = table.rolls.reduce((sum, r) => sum + (r.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = null;
    for (const entry of table.rolls) {
      roll -= (entry.weight || 1);
      if (roll <= 0) { chosen = entry; break; }
    }
    if (!chosen) return;

    const itemDef = this.content.getItem(chosen.item);
    if (!itemDef) return;

    const itemId = `item_${room.nextItemId++}`;
    room.items.set(itemId, {
      id: itemId,
      type: chosen.item,
      name: itemDef.name,
      rarity: itemDef.rarity || 'common',
      category: itemDef.type,
      x: mob.x,
      y: mob.y,
    });
  }

  // Grant XP to a player, handling level-ups and HP increases.
  // Returns the number of levels gained.
  grantXp(player, amount, room) {
    if (amount <= 0) return 0;
    const settings = this.content.getSettings();
    const xpSys = (settings && settings.xpSystem) || {};
    const maxLevel = xpSys.maxLevel || 20;
    const hpPerLevel = xpSys.hpPerLevel || 10;

    player.xp += amount;
    let levelsGained = 0;

    while (player.xp >= player.xpToNextLevel && player.level < maxLevel) {
      player.xp -= player.xpToNextLevel;
      player.level++;
      levelsGained++;
      player.xpToNextLevel = this._xpForLevel(player.level);

      // Increase max HP and heal the gained amount
      player.maxHealth += hpPerLevel;
      player.health = Math.min(player.health + hpPerLevel, player.maxHealth);

      if (room) {
        room.events.push({
          type: 'level_up',
          targetId: player.id,
          newLevel: player.level,
          x: player.x,
          y: player.y,
        });
      }
    }

    // Clamp XP at max level
    if (player.level >= maxLevel) {
      player.xp = 0;
      player.xpToNextLevel = 0;
    }

    return levelsGained;
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
        singleUseEnergy: Math.round(p.singleUseEnergy || 0), singleUseMaxEnergy: p.singleUseMaxEnergy || 0,
        xp: p.xp, level: p.level, xpToNextLevel: p.xpToNextLevel,
        colorIndex: p.colorIndex,
        elevation: Math.round((p.elevation || 0) * 100) / 100,
        hovering: p.hovering || false,
        stunned: (p.stunTime || 0) > 0,
      };
      // Include weapon name if equipped (for rendering)
      if (p.equipment && p.equipment.arms) {
        pData.weapon = p.equipment.arms.name;
      }
      // Include channeling state
      if (p.channeling) {
        pData.channeling = {
          type: p.channeling.type,
          targetX: Math.round(p.channeling.targetX * 10) / 10,
          targetY: Math.round(p.channeling.targetY * 10) / 10,
          timeRemaining: Math.round(p.channeling.timeRemaining * 100) / 100,
          totalTime: p.channeling.totalTime,
        };
      }
      players.push(pData);
    }

    const npcs = [];
    for (const [nid, n] of room.npcs) {
      npcs.push({ id: n.id, type: n.type, name: n.name, x: n.x, y: n.y });
    }

    const monsters = [];
    for (const [mid, m] of room.monsters) {
      if (m.hidden) continue; // Ambush monsters are invisible to clients
      const mData = {
        id: m.id, type: m.type, name: m.name,
        x: Math.round(m.x * 10) / 10,
        y: Math.round(m.y * 10) / 10,
        facing: Math.round(m.facing * 100) / 100,
        health: m.health, maxHealth: m.maxHealth,
        elevation: m.elevation || 0,
      };
      if (m.bossPhases) {
        mData.boss = true;
        mData.bossPhase = m.bossPhase + 1;
      }
      if (m.sentrySlowTime > 0) {
        mData.slowed = true;
      }
      if (m._auraBuff) {
        mData.auraBuff = true;
      }
      if (m.aura) {
        mData.packLeader = true;
      }
      monsters.push(mData);
    }

    const items = [];
    for (const [iid, item] of room.items) {
      items.push({
        id: item.id, type: item.type, name: item.name,
        rarity: item.rarity, category: item.category,
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
      if (proj.projectileType) {
        pData.projectileType = proj.projectileType;
      }
      projectiles.push(pData);
    }

    const sentries = [];
    for (const sentry of room.sentries) {
      const sData = {
        id: sentry.id,
        ownerId: sentry.ownerId,
        x: Math.round(sentry.x * 10) / 10,
        y: Math.round(sentry.y * 10) / 10,
        targetId: sentry.targetId,
      };
      if (sentry.beamChain && sentry.beamChain.length > 0) {
        sData.beamChain = sentry.beamChain.map(seg => ({
          fromX: Math.round(seg.fromX * 10) / 10,
          fromY: Math.round(seg.fromY * 10) / 10,
          toX: Math.round(seg.toX * 10) / 10,
          toY: Math.round(seg.toY * 10) / 10,
          targetType: seg.targetType,
        }));
      }
      sentries.push(sData);
    }

    const beamObjects = [];
    for (const bo of room.beamObjects) {
      beamObjects.push({
        id: bo.id,
        type: bo.type,
        x: Math.round(bo.x * 10) / 10,
        y: Math.round(bo.y * 10) / 10,
        angle: bo.angle,
        active: bo.active,
      });
    }

    const extractionPoints = [];
    if (room.extractionPoints) {
      for (const ep of room.extractionPoints) {
        extractionPoints.push({
          id: ep.id,
          ownerId: ep.ownerId,
          x: Math.round(ep.x * 10) / 10,
          y: Math.round(ep.y * 10) / 10,
        });
      }
    }

    // Party quest progress summaries (name, color, active step labels)
    const partyQuests = [];
    for (const [pid, p] of room.players) {
      const obj = this.questTracker.getActiveObjective(pid);
      if (obj) {
        partyQuests.push({
          playerId: pid,
          name: p.name,
          colorIndex: p.colorIndex,
          questName: obj.questName,
          stepLabel: obj.label,
        });
      }
    }

    const events = room.events || [];
    room.events = [];

    return {
      type: CONSTANTS.MSG.STATE,
      tick: room.tick,
      players, npcs, monsters, items, projectiles, sentries, beamObjects, extractionPoints, events, partyQuests,
    };
  }
}

module.exports = GameLoop;
