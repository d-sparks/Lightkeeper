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
        });
      }
    }

    // Create ground item instances from dungeon spawn data
    const items = new Map();
    let nextItemId = 0;
    if (dungeon.itemSpawns) {
      for (let i = 0; i < dungeon.itemSpawns.length; i++) {
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
      events: [],            // combat events for current tick
      tick: 0,
      nextSpawnIndex: 0,
      nextMonsterId: 0,
      nextItemId,
    };

    // Spawn monsters
    this.spawnMonsters(room);

    this.rooms.set(roomId, room);
    console.log(`[GameLoop] Room "${roomId}" created with dungeon "${dungeon.name}" (${npcs.size} NPCs, ${room.monsters.size} monsters, ${items.size} items)`);
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

    // Respawn monsters from updated data
    room.monsters.clear();
    room.nextMonsterId = 0;
    this.spawnMonsters(room);

    // Move players to spawn point (they may be standing in a wall now)
    const spawn = room.dungeon.spawns && room.dungeon.spawns[0] || { x: 2, y: 2 };
    for (const [pid, player] of room.players) {
      player.x = (spawn.x + 0.5) * CONSTANTS.TILE_SIZE;
      player.y = (spawn.y + 0.5) * CONSTANTS.TILE_SIZE;
      player.health = player.maxHealth;
    }

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
      player.inventory.push({
        type: closestItem.type,
        name: closestItem.name,
        rarity: closestItem.rarity,
      });
      room.events.push({
        type: 'pickup',
        targetId: player.id,
        itemName: closestItem.name,
        x: closestItem.x,
        y: closestItem.y,
      });
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
        const newTileId = closestDoor.tileDef.togglesTo;
        const idx = closestDoor.ty * room.dungeon.width + closestDoor.tx;
        room.dungeon.data[idx] = newTileId;
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
      return { interactType: 'dialogue', npcId: closestNPC.id, dialogue: closestNPC.dialogue };
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
    });

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

    const items = [];
    for (const [iid, item] of room.items) {
      items.push({
        id: item.id, type: item.type, name: item.name,
        rarity: item.rarity,
        x: item.x, y: item.y,
      });
    }

    const events = room.events || [];
    room.events = [];

    return {
      type: CONSTANTS.MSG.STATE,
      tick: room.tick,
      players, npcs, monsters, items, events,
    };
  }
}

module.exports = GameLoop;
