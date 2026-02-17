const CONSTANTS = require('../shared/constants');
const Physics = require('./physics');

class GameLoop {
  constructor(content) {
    this.content = content;
    this.physics = new Physics(content);
    this.rooms = new Map();  // roomId -> Room
    this.interval = null;
    this.pendingTransitions = [];
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
    const dungeon = this.content.getDungeon(dungeonId);
    if (!dungeon) {
      console.error(`[GameLoop] Dungeon not found: ${dungeonId}`);
      return null;
    }

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
      events: [],            // combat events for current tick
      tick: 0,
      nextSpawnIndex: 0,
      nextMonsterId: 0,
    };

    // Spawn monsters
    this.spawnMonsters(room);

    this.rooms.set(roomId, room);
    console.log(`[GameLoop] Room "${roomId}" created with dungeon "${dungeon.name}" (${npcs.size} NPCs, ${room.monsters.size} monsters)`);
    return room;
  }

  spawnMonsters(room) {
    if (!room.dungeon.monsterSpawns) return;
    for (const spawn of room.dungeon.monsterSpawns) {
      const def = this.content.getMonster(spawn.type);
      if (!def) continue;
      const count = spawn.count || 1;
      for (let i = 0; i < count; i++) {
        const id = `mob_${room.nextMonsterId++}`;
        const offsetX = count > 1 ? (i - (count - 1) / 2) * 1.5 : 0;
        room.monsters.set(id, {
          id,
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
    };

    room.players.set(playerId, player);
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
    if (room.players.size === 0 && roomId !== 'crypt_01') {
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

      // Check for floor transitions
      this.checkExits(room);
    }
  }

  updateMonsters(room, dt) {
    for (const [mid, mob] of room.monsters) {
      mob.attackTimer = Math.max(0, mob.attackTimer - dt);

      // Find nearest player
      let nearest = null;
      let nearestDist = Infinity;
      for (const [pid, player] of room.players) {
        const dx = player.x - mob.x;
        const dy = player.y - mob.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearest = player;
          nearestDist = dist;
        }
      }

      if (!nearest) continue;

      const aggroRange = CONSTANTS.MONSTER_AGGRO_RANGE * CONSTANTS.TILE_SIZE;
      if (nearestDist > aggroRange) continue;

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
        nearestMob.health -= CONSTANTS.PLAYER_ATTACK_DAMAGE;
        player.attackTimer = CONSTANTS.PLAYER_ATTACK_COOLDOWN;
        room.events.push({
          type: 'damage', targetId: nearestMob.id,
          amount: CONSTANTS.PLAYER_ATTACK_DAMAGE, x: nearestMob.x, y: nearestMob.y,
        });

        if (nearestMob.health <= 0) {
          room.events.push({
            type: 'death', targetId: nearestMob.id,
            x: nearestMob.x, y: nearestMob.y,
          });
          room.monsters.delete(nearestMob.id);
        }
      }
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

  tryInteract(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;

    const range = CONSTANTS.NPC_INTERACT_RANGE * CONSTANTS.TILE_SIZE;
    let closest = null;
    let closestDist = Infinity;

    for (const [npcId, npc] of room.npcs) {
      const dx = npc.x - player.x;
      const dy = npc.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < range && dist < closestDist) {
        closest = npc;
        closestDist = dist;
      }
    }

    if (!closest) return null;
    return { npcId: closest.id, dialogue: closest.dialogue };
  }

  getRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const players = [];
    for (const [pid, p] of room.players) {
      players.push({
        id: p.id, name: p.name,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        facing: Math.round(p.facing * 100) / 100,
        health: p.health, maxHealth: p.maxHealth,
        colorIndex: p.colorIndex,
      });
    }

    const npcs = [];
    for (const [nid, n] of room.npcs) {
      npcs.push({ id: n.id, name: n.name, x: n.x, y: n.y });
    }

    const monsters = [];
    for (const [mid, m] of room.monsters) {
      monsters.push({
        id: m.id, name: m.name,
        x: Math.round(m.x * 10) / 10,
        y: Math.round(m.y * 10) / 10,
        facing: Math.round(m.facing * 100) / 100,
        health: m.health, maxHealth: m.maxHealth,
      });
    }

    const events = room.events || [];
    room.events = [];

    return {
      type: CONSTANTS.MSG.STATE,
      tick: room.tick,
      players, npcs, monsters, events,
    };
  }
}

module.exports = GameLoop;
