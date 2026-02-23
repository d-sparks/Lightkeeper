const CONSTANTS = require('../shared/constants');
const Physics = require('./physics');
const FlagStore = require('./scripting/flag-store');
const EventBus = require('./scripting/event-bus');
const ConditionEvaluator = require('./scripting/conditions');
const ActionExecutor = require('./scripting/actions');
const TriggerRegistry = require('./scripting/trigger-registry');

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

    // Scripting subsystem
    this.flagStore = new FlagStore();
    this.eventBus = new EventBus();
    this.conditions = new ConditionEvaluator(this.flagStore);
    this.actions = new ActionExecutor(this.flagStore, this.eventBus, content);
    this.triggers = new TriggerRegistry(this.eventBus, this.conditions, this.actions, this.flagStore);
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

  createRoom(roomId, dungeonId) {
    const sourceDungeon = this.content.getDungeon(dungeonId);
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
  getOrCreateRoom(dungeonId) {
    let room = this.rooms.get(dungeonId);
    if (!room) {
      room = this.createRoom(dungeonId, dungeonId);
    }
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
      equipment: { weapon: null, armor: null, accessory: null },
    };

    room.players.set(playerId, player);
    this.flagStore.ensurePlayer(playerId);

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

  update(dt) {
    for (const [roomId, room] of this.rooms) {
      room.tick++;
      room.events = [];

      // Update each player's movement
      for (const [pid, player] of room.players) {
        this.physics.movePlayer(player, room.dungeon, dt);
        if (player.transitionCooldown > 0) {
          player.transitionCooldown -= dt;
        }
      }

      // Update monsters (AI + attacks)
      this.updateMonsters(room, dt);

      // Player auto-attack
      this.updatePlayerAttacks(room, dt);

      // Update projectiles (movement, collision, lifetime)
      this.updateProjectiles(room, dt);

      // Check for floor transitions
      this.checkExits(room);
    }
  }

  updateMonsters(room, dt) {
    for (const [mid, mob] of room.monsters) {
      mob.attackTimer = Math.max(0, mob.attackTimer - dt);

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

  updatePlayerAttacks(room, dt) {
    const attackRange = CONSTANTS.PLAYER_ATTACK_RANGE * CONSTANTS.TILE_SIZE;

    for (const [pid, player] of room.players) {
      player.attackTimer = Math.max(0, player.attackTimer - dt);
      if (player.attackTimer > 0) continue;

      // Find nearest monster in auto-attack range
      let nearestMob = null;
      let nearestDist = Infinity;
      for (const [mid, mob] of room.monsters) {
        const dx = mob.x - player.x;
        const dy = mob.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < attackRange && dist < nearestDist) {
          nearestMob = mob;
          nearestDist = dist;
        }
      }

      if (nearestMob) {
        const dmg = this.getPlayerAttackDamage(player);
        nearestMob.health -= dmg;
        player.attackTimer = CONSTANTS.PLAYER_ATTACK_COOLDOWN;
        room.events.push({
          type: 'damage', targetId: nearestMob.id,
          amount: dmg, x: nearestMob.x, y: nearestMob.y,
        });

        if (nearestMob.health <= 0) {
          room.events.push({
            type: 'death', targetId: nearestMob.id,
            x: nearestMob.x, y: nearestMob.y,
          });
          room.monsters.delete(nearestMob.id);

          // Record the kill so monster stays dead when room is revisited
          if (nearestMob.spawnKey) {
            if (!this.killedMonsters.has(room.dungeonId)) {
              this.killedMonsters.set(room.dungeonId, new Set());
            }
            this.killedMonsters.get(room.dungeonId).add(nearestMob.spawnKey);
          }

          // Emit monster_killed scripting event
          const ctx = this._scriptContext(pid, room.id);
          this._emitGameEvent(EventBus.Events.MONSTER_KILLED, {
            playerId: pid, roomId: room.id,
            monsterType: nearestMob.type, monsterId: nearestMob.id,
          }, ctx);
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
      const radius = CONSTANTS.PROJECTILE_RADIUS;
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
            spawnX: exit.spawnX != null ? exit.spawnX : 2,
            spawnY: exit.spawnY != null ? exit.spawnY : 2,
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

    const slot = itemDef.slot;
    if (!CONSTANTS.EQUIPMENT_SLOTS.includes(slot)) return null;

    // If something is already equipped in that slot, swap it back to inventory
    const currentEquipped = player.equipment[slot];
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

    return { inventory: player.inventory, equipment: player.equipment };
  }

  // Unequip an item from an equipment slot back to inventory
  tryUnequip(roomId, playerId, slot) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;

    if (!CONSTANTS.EQUIPMENT_SLOTS.includes(slot)) return null;
    const equipped = player.equipment[slot];
    if (!equipped) return null;

    player.equipment[slot] = null;
    player.inventory.push({
      type: equipped.type,
      name: equipped.name,
      rarity: equipped.rarity,
      category: equipped.category || 'misc',
    });

    return { inventory: player.inventory, equipment: player.equipment };
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
        colorIndex: p.colorIndex,
      };
      // Include weapon name if equipped (for rendering)
      if (p.equipment && p.equipment.weapon) {
        pData.weapon = p.equipment.weapon.name;
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
      projectiles.push({
        id: proj.id,
        x: Math.round(proj.x * 10) / 10,
        y: Math.round(proj.y * 10) / 10,
        vx: proj.vx,
        vy: proj.vy,
      });
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
