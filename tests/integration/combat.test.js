'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const GameLoop = require('../../server/game-loop');
const CONSTANTS = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Minimal content mock — only data that combat code touches
// ---------------------------------------------------------------------------
function makeContent() {
  const items = {
    blaster: {
      name: 'Blaster', type: 'weapon', slot: 'arms', rarity: 'common',
      stats: { attackDamage: 5 },
      ability: { id: 'blaster_shot' },
    },
    accessory_dmg: {
      name: 'Power Cell', type: 'accessory', slot: 'accessory', rarity: 'common',
      stats: { attackDamage: 3 },
    },
    bandage: { name: 'Bandage', type: 'consumable', rarity: 'common' },
  };
  const monsters = {
    drone: { name: 'Drone', health: 30, xp: 10, lootTable: 'drone_loot' },
    boss:  { name: 'Boss',  health: 500, xp: 100, lootTable: null },
    no_xp: { name: 'Dummy', health: 10 },
  };
  const lootTables = {
    drone_loot: {
      dropChance: 1.0,
      rolls: [{ item: 'bandage', weight: 1 }],
    },
  };
  const settings = {
    xpSystem: { baseXpToLevel: 100, xpScalingFactor: 1.5, maxLevel: 20, hpPerLevel: 10 },
  };
  return {
    getItem:         (type) => items[type]        || null,
    getMonster:      (type) => monsters[type]     || null,
    getAbility:      ()     => null,
    getSolComponent: ()     => null,
    getSolUnit:      ()     => null,
    getLootTable:    (name) => lootTables[name]   || null,
    getSettings:     ()     => settings,
    getDungeon:      ()     => null,
    getTileset:      ()     => null,
    isSolid:         ()     => false,
    getRampInfo:     ()     => null,
    getTileDef:      ()     => null,
    items:           {},
    solComponents:   {},
  };
}

function makeRoom(id = 'r1', dungeonId = 'dungeon1') {
  return {
    id,
    dungeonId,
    players:    new Map(),
    monsters:   new Map(),
    items:      new Map(),
    events:     [],
    nextItemId: 1,
    dungeon: { width: 10, height: 10, data: new Array(100).fill(0) },
  };
}

function makePlayer(id = 'p1') {
  return {
    id,
    name: 'TestPlayer',
    x: 160, y: 160,
    health:    CONSTANTS.PLAYER_MAX_HEALTH,
    maxHealth: CONSTANTS.PLAYER_MAX_HEALTH,
    xp: 0, level: 1, xpToNextLevel: 100,
    inventory: [],
    equipment: { arms: null, sol_unit: null, medipac: null, accessory: null },
    abilities:       [null, null, null, null, null, null],
    cooldowns:       [0, 0, 0, 0, 0, 0],
    abilityOverrides: {},
    solGrid: null,
    energy: 0, maxEnergy: 0,
    singleUseEnergy: 0, singleUseMaxEnergy: 0,
    solGridEnergyRegen: 0,
    medipacCharges: 0,
  };
}

// ---------------------------------------------------------------------------
describe('Combat integration', () => {
  let gl;

  beforeEach(() => {
    gl = new GameLoop(makeContent());
  });

  // -------------------------------------------------------------------------
  describe('getPlayerAttackDamage', () => {
    it('returns base damage with no equipment', () => {
      const player = makePlayer();
      assert.equal(gl.getPlayerAttackDamage(player), CONSTANTS.PLAYER_ATTACK_DAMAGE);
    });

    it('adds attackDamage bonus from arms slot', () => {
      const player = makePlayer();
      player.equipment.arms = { type: 'blaster', stats: { attackDamage: 5 } };
      assert.equal(gl.getPlayerAttackDamage(player), CONSTANTS.PLAYER_ATTACK_DAMAGE + 5);
    });

    it('stacks bonuses from multiple equipment slots', () => {
      const player = makePlayer();
      player.equipment.arms      = { type: 'blaster',       stats: { attackDamage: 5 } };
      player.equipment.accessory = { type: 'accessory_dmg', stats: { attackDamage: 3 } };
      assert.equal(gl.getPlayerAttackDamage(player), CONSTANTS.PLAYER_ATTACK_DAMAGE + 8);
    });

    it('ignores slots with no stats', () => {
      const player = makePlayer();
      player.equipment.arms = { type: 'blaster', stats: {} };
      assert.equal(gl.getPlayerAttackDamage(player), CONSTANTS.PLAYER_ATTACK_DAMAGE);
    });
  });

  // -------------------------------------------------------------------------
  describe('grantXp', () => {
    it('adds XP without levelling up', () => {
      const player = makePlayer();
      const room = makeRoom();
      gl.grantXp(player, 50, room);
      assert.equal(player.xp, 50);
      assert.equal(player.level, 1);
    });

    it('levels up when threshold is reached', () => {
      const player = makePlayer();
      player.xpToNextLevel = 100;
      const room = makeRoom();
      gl.grantXp(player, 100, room);
      assert.equal(player.level, 2);
      assert.equal(player.xp, 0);
    });

    it('increases maxHealth on level-up', () => {
      const player = makePlayer();
      player.xpToNextLevel = 100;
      const room = makeRoom();
      gl.grantXp(player, 100, room);
      assert.equal(player.maxHealth, CONSTANTS.PLAYER_MAX_HEALTH + 10);
    });

    it('does not level beyond maxLevel (20)', () => {
      const player = makePlayer();
      player.level = 20;
      player.xpToNextLevel = 100;
      const room = makeRoom();
      gl.grantXp(player, 999999, room);
      assert.equal(player.level, 20);
    });

    it('handles multiple level-ups in a single call', () => {
      const player = makePlayer();
      player.xpToNextLevel = 50;
      const room = makeRoom();
      gl.grantXp(player, 300, room);
      assert.ok(player.level >= 3, `expected level >= 3, got ${player.level}`);
    });

    it('health stays clamped to maxHealth after level-up heal', () => {
      const player = makePlayer();
      player.xpToNextLevel = 100;
      // Set health to max so heal from level-up should not exceed new maxHealth
      player.health = player.maxHealth;
      const room = makeRoom();
      gl.grantXp(player, 100, room);
      assert.equal(player.health, player.maxHealth);
    });
  });

  // -------------------------------------------------------------------------
  describe('_rollLoot', () => {
    it('spawns ground item when dropChance is 1.0', () => {
      const room = makeRoom();
      const mob = { id: 'mob1', type: 'drone', x: 200, y: 200 };
      gl._rollLoot(room, mob);
      assert.equal(room.items.size, 1);
      const [item] = room.items.values();
      assert.equal(item.type, 'bandage');
      assert.equal(item.x, 200);
      assert.equal(item.y, 200);
    });

    it('item id is unique and non-empty', () => {
      const room = makeRoom();
      const mob = { id: 'mob1', type: 'drone', x: 100, y: 100 };
      gl._rollLoot(room, mob);
      const [item] = room.items.values();
      assert.ok(item.id && item.id.length > 0);
    });

    it('does nothing for monster with no loot table', () => {
      const room = makeRoom();
      const mob = { id: 'mob1', type: 'boss', x: 100, y: 100 };
      gl._rollLoot(room, mob);
      assert.equal(room.items.size, 0);
    });

    it('does nothing for unknown monster type', () => {
      const room = makeRoom();
      const mob = { id: 'mob1', type: 'unknown_type', x: 100, y: 100 };
      gl._rollLoot(room, mob);
      assert.equal(room.items.size, 0);
    });
  });

  // -------------------------------------------------------------------------
  describe('_handleMonsterDeath', () => {
    beforeEach(() => {
      gl.rooms.set('r1', makeRoom());
    });

    it('removes monster from room', () => {
      const room = gl.rooms.get('r1');
      const player = makePlayer();
      room.players.set('p1', player);
      const mob = { id: 'mob1', type: 'drone', x: 200, y: 200, spawnKey: null };
      room.monsters.set('mob1', mob);

      gl._handleMonsterDeath(mob, room, 'p1');
      assert.equal(room.monsters.has('mob1'), false);
    });

    it('emits a death event with correct fields', () => {
      const room = gl.rooms.get('r1');
      const player = makePlayer();
      room.players.set('p1', player);
      const mob = { id: 'mob1', type: 'drone', x: 200, y: 200, spawnKey: null };
      room.monsters.set('mob1', mob);

      gl._handleMonsterDeath(mob, room, 'p1');
      const evt = room.events.find(e => e.type === 'death');
      assert.ok(evt, 'expected death event');
      assert.equal(evt.targetId, 'mob1');
      assert.equal(evt.x, 200);
      assert.equal(evt.y, 200);
    });

    it('grants XP to the killing player', () => {
      const room = gl.rooms.get('r1');
      const player = makePlayer();
      room.players.set('p1', player);
      const mob = { id: 'mob1', type: 'drone', x: 200, y: 200, spawnKey: null };
      room.monsters.set('mob1', mob);

      gl._handleMonsterDeath(mob, room, 'p1');
      assert.equal(player.xp, 10); // drone.xp = 10
    });

    it('records spawnKey in killedMonsters', () => {
      const room = gl.rooms.get('r1');
      const player = makePlayer();
      room.players.set('p1', player);
      const mob = { id: 'mob1', type: 'drone', x: 200, y: 200, spawnKey: '0:0' };
      room.monsters.set('mob1', mob);

      gl._handleMonsterDeath(mob, room, 'p1');
      assert.ok(gl.killedMonsters.has('dungeon1'));
      assert.ok(gl.killedMonsters.get('dungeon1').has('0:0'));
    });

    it('does not crash when monster has no spawnKey', () => {
      const room = gl.rooms.get('r1');
      const player = makePlayer();
      room.players.set('p1', player);
      const mob = { id: 'mob1', type: 'drone', x: 200, y: 200 }; // spawnKey absent
      room.monsters.set('mob1', mob);
      assert.doesNotThrow(() => gl._handleMonsterDeath(mob, room, 'p1'));
    });

    it('skips XP when monster has none', () => {
      const room = gl.rooms.get('r1');
      const player = makePlayer();
      room.players.set('p1', player);
      const mob = { id: 'mob1', type: 'no_xp', x: 200, y: 200, spawnKey: null };
      room.monsters.set('mob1', mob);

      gl._handleMonsterDeath(mob, room, 'p1');
      assert.equal(player.xp, 0);
    });
  });
});
