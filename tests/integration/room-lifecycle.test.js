'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const GameLoop = require('../../server/game-loop');
const CONSTANTS = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Minimal content mock — only what room-lifecycle code touches
// ---------------------------------------------------------------------------
function makeContent(opts = {}) {
  const spawnRoom = opts.spawnRoom || 'room_a';
  const dungeons = opts.dungeons || {};
  return {
    getItem:         (type) => (opts.items || {})[type] || null,
    getMonster:      ()     => null,
    getAbility:      ()     => null,
    getSolComponent: ()     => null,
    getSolUnit:      ()     => null,
    getLootTable:    ()     => null,
    getSettings:     ()     => ({ xpSystem: { baseXpToLevel: 100, xpScalingFactor: 1.5, maxLevel: 20, hpPerLevel: 10 } }),
    getDungeon:      (id)   => dungeons[id] || null,
    getTemplate:     ()     => null,
    getTileset:      ()     => null,
    getNPC:          ()     => null,
    isSolid:         ()     => false,
    isSpawnable:     ()     => true,
    getRampInfo:     ()     => null,
    getTileDef:      ()     => null,
    getSpawnRoom:    ()     => spawnRoom,
    getAllQuests:     ()     => ({}),
    items:           {},
    solComponents:   {},
  };
}

// Minimal dungeon with a spawn point and optional exits
function makeDungeon(id, opts = {}) {
  return {
    id,
    name: id,
    width:  10,
    height: 10,
    data:   new Array(100).fill(0),
    spawns: opts.spawns || [{ x: 2, y: 2 }],
    exits:  opts.exits  || [],
  };
}

// ---------------------------------------------------------------------------

describe('Room lifecycle integration', () => {
  let gl;

  // -------------------------------------------------------------------------
  describe('createRoom → addPlayer', () => {
    beforeEach(() => {
      const dungeon = makeDungeon('room_a');
      gl = new GameLoop(makeContent({ spawnRoom: 'room_a', dungeons: { room_a: dungeon } }));
    });

    it('createRoom registers the room', () => {
      gl.createRoom('room_a', 'room_a');
      assert.ok(gl.rooms.has('room_a'));
    });

    it('createRoom returns a room object with correct structure', () => {
      const room = gl.createRoom('room_a', 'room_a');
      assert.ok(room, 'expected room to be returned');
      assert.equal(room.id, 'room_a');
      assert.equal(room.dungeonId, 'room_a');
      assert.ok(room.players instanceof Map);
      assert.ok(room.monsters instanceof Map);
      assert.ok(room.items instanceof Map);
      assert.ok(Array.isArray(room.events));
    });

    it('createRoom returns null for unknown dungeonId', () => {
      const result = gl.createRoom('ghost', 'nonexistent');
      assert.equal(result, null);
    });

    it('addPlayer places player in the room', () => {
      gl.createRoom('room_a', 'room_a');
      const player = gl.addPlayer('room_a', 'p1', 'Alice');
      assert.ok(player, 'expected player object');
      assert.equal(player.id, 'p1');
      assert.equal(player.name, 'Alice');
      const room = gl.rooms.get('room_a');
      assert.ok(room.players.has('p1'));
    });

    it('addPlayer positions player at dungeon spawn point', () => {
      gl.createRoom('room_a', 'room_a');
      const player = gl.addPlayer('room_a', 'p1', 'Alice');
      // Spawn is at tile (2,2); pixel = (2.5 * TILE_SIZE, 2.5 * TILE_SIZE)
      const expected = (2 + 0.5) * CONSTANTS.TILE_SIZE;
      assert.equal(player.x, expected);
      assert.equal(player.y, expected);
    });

    it('addPlayer returns null for unknown roomId', () => {
      const result = gl.addPlayer('no_such_room', 'p1', 'Alice');
      assert.equal(result, null);
    });

    it('addPlayer initialises player with full health', () => {
      gl.createRoom('room_a', 'room_a');
      const player = gl.addPlayer('room_a', 'p1', 'Alice');
      assert.equal(player.health, CONSTANTS.PLAYER_MAX_HEALTH);
      assert.equal(player.maxHealth, CONSTANTS.PLAYER_MAX_HEALTH);
    });

    it('multiple players can join the same room', () => {
      gl.createRoom('room_a', 'room_a');
      gl.addPlayer('room_a', 'p1', 'Alice');
      gl.addPlayer('room_a', 'p2', 'Bob');
      const room = gl.rooms.get('room_a');
      assert.equal(room.players.size, 2);
    });
  });

  // -------------------------------------------------------------------------
  describe('room transition (addPlayerAt / emitRoomEntered)', () => {
    beforeEach(() => {
      const dungA = makeDungeon('room_a', {
        exits: [{ x: 9, y: 5, leadsTo: 'room_b', spawnX: 1, spawnY: 5 }],
      });
      const dungB = makeDungeon('room_b', {
        spawns: [{ x: 1, y: 5 }],
      });
      gl = new GameLoop(makeContent({
        spawnRoom: 'room_a',
        dungeons: { room_a: dungA, room_b: dungB },
      }));
    });

    it('addPlayerAt moves player to destination room at correct pixel position', () => {
      gl.createRoom('room_a', 'room_a');
      gl.createRoom('room_b', 'room_b');
      gl.addPlayer('room_a', 'p1', 'Alice');
      const playerA = gl.rooms.get('room_a').players.get('p1');

      const playerB = gl.addPlayerAt('room_b', playerA, 1, 5);
      assert.ok(playerB, 'expected player reference back');
      assert.equal(gl.rooms.get('room_b').players.has('p1'), true);
      assert.equal(playerB.x, (1 + 0.5) * CONSTANTS.TILE_SIZE);
      assert.equal(playerB.y, (5 + 0.5) * CONSTANTS.TILE_SIZE);
    });

    it('addPlayerAt sets transitionCooldown to prevent immediate re-exit', () => {
      gl.createRoom('room_a', 'room_a');
      gl.createRoom('room_b', 'room_b');
      const p = gl.addPlayer('room_a', 'p1', 'Alice');
      gl.addPlayerAt('room_b', p, 1, 5);
      assert.ok(p.transitionCooldown > 0, 'transitionCooldown must be positive');
    });

    it('addPlayerAt returns null for unknown destination room', () => {
      gl.createRoom('room_a', 'room_a');
      const p = gl.addPlayer('room_a', 'p1', 'Alice');
      const result = gl.addPlayerAt('nonexistent_room', p, 1, 1);
      assert.equal(result, null);
    });

    it('checkExits queues a transition when player stands on an exit tile', () => {
      gl.createRoom('room_a', 'room_a');
      gl.addPlayer('room_a', 'p1', 'Alice');
      const room = gl.rooms.get('room_a');
      const player = room.players.get('p1');

      // Position player on the exit tile (9, 5)
      player.x = (9 + 0.5) * CONSTANTS.TILE_SIZE;
      player.y = (5 + 0.5) * CONSTANTS.TILE_SIZE;
      player.transitionCooldown = 0;

      gl.checkExits(room);

      const transitions = gl.consumeTransitions();
      assert.equal(transitions.length, 1);
      assert.equal(transitions[0].playerId, 'p1');
      assert.equal(transitions[0].fromRoom, 'room_a');
      assert.equal(transitions[0].toDungeon, 'room_b');
    });

    it('consumeTransitions clears the pending list', () => {
      gl.createRoom('room_a', 'room_a');
      gl.addPlayer('room_a', 'p1', 'Alice');
      const room = gl.rooms.get('room_a');
      const player = room.players.get('p1');

      player.x = (9 + 0.5) * CONSTANTS.TILE_SIZE;
      player.y = (5 + 0.5) * CONSTANTS.TILE_SIZE;
      player.transitionCooldown = 0;

      gl.checkExits(room);
      gl.consumeTransitions(); // first consume
      const second = gl.consumeTransitions();
      assert.equal(second.length, 0);
    });

    it('checkExits does not queue transition when transitionCooldown > 0', () => {
      gl.createRoom('room_a', 'room_a');
      gl.addPlayer('room_a', 'p1', 'Alice');
      const room = gl.rooms.get('room_a');
      const player = room.players.get('p1');

      player.x = (9 + 0.5) * CONSTANTS.TILE_SIZE;
      player.y = (5 + 0.5) * CONSTANTS.TILE_SIZE;
      player.transitionCooldown = 1.0; // still cooling down

      gl.checkExits(room);

      const transitions = gl.consumeTransitions();
      assert.equal(transitions.length, 0);
    });
  });

  // -------------------------------------------------------------------------
  describe('removePlayer / room cleanup', () => {
    beforeEach(() => {
      const dungA = makeDungeon('room_a');
      const dungB = makeDungeon('room_b');
      gl = new GameLoop(makeContent({
        spawnRoom: 'room_a',
        dungeons: { room_a: dungA, room_b: dungB },
      }));
    });

    it('removePlayer removes player from room', () => {
      gl.createRoom('room_a', 'room_a');
      gl.addPlayer('room_a', 'p1', 'Alice');

      gl.removePlayer('room_a', 'p1');
      const room = gl.rooms.get('room_a');
      // Spawn room is not deleted even when empty
      assert.ok(room, 'spawn room should survive');
      assert.equal(room.players.has('p1'), false);
    });

    it('removePlayer deletes non-spawn room when it becomes empty', () => {
      gl.createRoom('room_b', 'room_b');
      gl.addPlayer('room_b', 'p1', 'Alice');

      gl.removePlayer('room_b', 'p1');
      assert.equal(gl.rooms.has('room_b'), false, 'empty non-spawn room should be deleted');
    });

    it('non-spawn room with remaining players is not deleted', () => {
      gl.createRoom('room_b', 'room_b');
      gl.addPlayer('room_b', 'p1', 'Alice');
      gl.addPlayer('room_b', 'p2', 'Bob');

      gl.removePlayer('room_b', 'p1');
      assert.ok(gl.rooms.has('room_b'), 'room with remaining players should survive');
      assert.equal(gl.rooms.get('room_b').players.size, 1);
    });

    it('removePlayer returns the removed player object', () => {
      gl.createRoom('room_a', 'room_a');
      gl.addPlayer('room_a', 'p1', 'Alice');
      const removed = gl.removePlayer('room_a', 'p1');
      assert.ok(removed, 'should return the player object');
      assert.equal(removed.id, 'p1');
    });

    it('removePlayer returns null for unknown room', () => {
      const result = gl.removePlayer('no_such_room', 'p1');
      assert.equal(result, null);
    });
  });

  // -------------------------------------------------------------------------
  describe('full lifecycle: createRoom → join → transition → cleanup', () => {
    it('complete flow works end-to-end', () => {
      const dungA = makeDungeon('room_a', {
        exits: [{ x: 9, y: 5, leadsTo: 'room_b', spawnX: 1, spawnY: 5 }],
      });
      const dungB = makeDungeon('room_b', { spawns: [{ x: 1, y: 5 }] });

      gl = new GameLoop(makeContent({
        spawnRoom: 'room_a',
        dungeons: { room_a: dungA, room_b: dungB },
      }));

      // 1. Create spawn room, add player
      gl.createRoom('room_a', 'room_a');
      gl.addPlayer('room_a', 'p1', 'Alice');
      assert.ok(gl.rooms.get('room_a').players.has('p1'));

      // 2. Move player to exit tile; check exits → transition queued
      const roomA = gl.rooms.get('room_a');
      const player = roomA.players.get('p1');
      player.x = (9 + 0.5) * CONSTANTS.TILE_SIZE;
      player.y = (5 + 0.5) * CONSTANTS.TILE_SIZE;
      player.transitionCooldown = 0;
      gl.checkExits(roomA);
      const [transition] = gl.consumeTransitions();
      assert.equal(transition.toDungeon, 'room_b');

      // 3. Server handles transition: remove from old room, add to new room
      gl.removePlayer(transition.fromRoom, 'p1');
      gl.createRoom('room_b', 'room_b');
      gl.addPlayerAt('room_b', player, transition.spawnX, transition.spawnY);
      gl.emitRoomEntered('p1', 'room_b');

      // 4. Verify player is in new room, old room still exists (it's the spawn room)
      assert.ok(gl.rooms.get('room_b').players.has('p1'), 'player should be in room_b');
      assert.ok(gl.rooms.has('room_a'), 'spawn room should survive after player left');

      // 5. Player leaves the destination room → it should be cleaned up
      gl.removePlayer('room_b', 'p1');
      assert.equal(gl.rooms.has('room_b'), false, 'empty non-spawn room_b should be deleted');
    });
  });
});
