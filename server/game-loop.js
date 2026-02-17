const CONSTANTS = require('../shared/constants');
const Physics = require('./physics');

class GameLoop {
  constructor(content) {
    this.content = content;
    this.physics = new Physics(content);
    this.rooms = new Map();  // roomId -> Room
    this.interval = null;
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

    const room = {
      id: roomId,
      dungeon,
      players: new Map(),  // playerId -> Player
      tick: 0,
      nextSpawnIndex: 0,
    };
    this.rooms.set(roomId, room);
    console.log(`[GameLoop] Room "${roomId}" created with dungeon "${dungeon.name}"`);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
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
      // Position in pixel coordinates (center of the player)
      x: (spawn.x + 0.5) * CONSTANTS.TILE_SIZE,
      y: (spawn.y + 0.5) * CONSTANTS.TILE_SIZE,
      facing: 0,
      health: CONSTANTS.PLAYER_MAX_HEALTH,
      maxHealth: CONSTANTS.PLAYER_MAX_HEALTH,
      colorIndex: room.players.size % CONSTANTS.COLORS.player.length,
      input: { up: false, down: false, left: false, right: false },
    };

    room.players.set(playerId, player);
    console.log(`[GameLoop] Player "${player.name}" (${playerId}) joined room "${roomId}" at (${spawn.x}, ${spawn.y})`);
    return player;
  }

  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players.delete(playerId);
    console.log(`[GameLoop] Player ${playerId} left room "${roomId}"`);

    // Clean up empty rooms
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
      console.log(`[GameLoop] Room "${roomId}" removed (empty)`);
    }
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

      // Update each player's movement
      for (const [pid, player] of room.players) {
        this.physics.movePlayer(player, room.dungeon, dt);
      }
    }
  }

  // Build the state snapshot to send to clients
  getRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const players = [];
    for (const [pid, p] of room.players) {
      players.push({
        id: p.id,
        name: p.name,
        x: Math.round(p.x * 10) / 10,  // Round to 1 decimal
        y: Math.round(p.y * 10) / 10,
        facing: Math.round(p.facing * 100) / 100,
        health: p.health,
        maxHealth: p.maxHealth,
        colorIndex: p.colorIndex,
      });
    }

    return {
      type: CONSTANTS.MSG.STATE,
      tick: room.tick,
      players,
    };
  }
}

module.exports = GameLoop;
