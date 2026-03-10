'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const GameLoop = require('../../server/game-loop');
const CONSTANTS = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Content mock
// ---------------------------------------------------------------------------
function makeContent() {
  const items = {
    blaster: {
      name: 'Blaster', type: 'weapon', slot: 'arms', rarity: 'common',
      stats: { attackDamage: 5 },
      ability: { id: 'blaster_shot' },
    },
    heavy_blaster: {
      name: 'Heavy Blaster', type: 'weapon', slot: 'arms', rarity: 'rare',
      stats: { attackDamage: 12 },
      ability: { id: 'blaster_shot' },
    },
    medipac_item: {
      name: 'Medipac', type: 'medipac', slot: 'medipac', rarity: 'common',
      stats: {},
      ability: { id: 'heal_pulse' },
    },
    sol_unit_basic: {
      name: 'Sol Unit Basic', type: 'sol_unit', slot: 'sol_unit', rarity: 'common',
      stats: {},
      hasSolGrid: true,
      solUnitId: 'basic_unit',
    },
    // item with no slot — cannot be equipped
    misc_item: { name: 'Misc Item', type: 'misc', rarity: 'common' },
  };
  const abilities = {
    blaster_shot: { id: 'blaster_shot', name: 'Blaster Shot', defaultSlot: 1, cooldown: 0.5, damageMultiplier: 1.0 },
    heal_pulse:   { id: 'heal_pulse',   name: 'Heal Pulse',   defaultSlot: 6, cooldown: 2.0 },
  };
  const solUnits = {
    basic_unit: {
      name: 'Basic Unit', gridSize: 3, maxCharge: 100,
      initialEnergy: 0, initialComponents: [],
    },
  };
  return {
    getItem:         (type) => items[type]     || null,
    getMonster:      ()     => null,
    getAbility:      (id)   => abilities[id]   || null,
    getSolComponent: ()     => null,
    getSolUnit:      (id)   => solUnits[id]    || null,
    getLootTable:    ()     => null,
    getSettings:     ()     => ({ xpSystem: { baseXpToLevel: 100, xpScalingFactor: 1.5, maxLevel: 20, hpPerLevel: 10 } }),
    getDungeon:      ()     => null,
    getTileset:      ()     => null,
    isSolid:         ()     => false,
    getRampInfo:     ()     => null,
    getTileDef:      ()     => null,
    items:         {},
    solComponents: {},
  };
}

function makeRoom() {
  return {
    id: 'r1', dungeonId: 'dungeon1',
    players:    new Map(),
    monsters:   new Map(),
    items:      new Map(),
    events:     [],
    nextItemId: 1,
  };
}

function makePlayer(id = 'p1') {
  return {
    id, name: 'TestPlayer',
    x: 160, y: 160,
    health: CONSTANTS.PLAYER_MAX_HEALTH,
    maxHealth: CONSTANTS.PLAYER_MAX_HEALTH,
    xp: 0, level: 1, xpToNextLevel: 100,
    inventory: [],
    equipment: { arms: null, sol_unit: null, medipac: null, accessory: null },
    abilities:        [null, null, null, null, null, null],
    cooldowns:        [0, 0, 0, 0, 0, 0],
    abilityOverrides: {},
    solGrid: null,
    energy: 0, maxEnergy: 0,
    singleUseEnergy: 0, singleUseMaxEnergy: 0,
    solGridEnergyRegen: 0,
    medipacCharges: 0,
  };
}

// ---------------------------------------------------------------------------
describe('Equipment integration', () => {
  let gl, room;

  beforeEach(() => {
    gl = new GameLoop(makeContent());
    room = makeRoom();
    gl.rooms.set('r1', room);
  });

  function addPlayer(player) {
    room.players.set(player.id, player);
    return player;
  }

  // -------------------------------------------------------------------------
  describe('tryEquip', () => {
    it('moves item from inventory to correct equipment slot', () => {
      const player = addPlayer(makePlayer());
      player.inventory.push({ type: 'blaster', name: 'Blaster', rarity: 'common' });

      const result = gl.tryEquip('r1', 'p1', 0);

      assert.ok(result, 'expected non-null result');
      assert.equal(player.inventory.length, 0);
      assert.ok(player.equipment.arms);
      assert.equal(player.equipment.arms.type, 'blaster');
    });

    it('rebuilds ability list after equipping arms weapon', () => {
      const player = addPlayer(makePlayer());
      player.inventory.push({ type: 'blaster', name: 'Blaster', rarity: 'common' });

      gl.tryEquip('r1', 'p1', 0);

      // blaster_shot.defaultSlot = 1 → abilities index 0
      assert.equal(player.abilities[0], 'blaster_shot');
    });

    it('swaps existing equipped item back to inventory', () => {
      const player = addPlayer(makePlayer());
      // Pre-equip something
      player.equipment.arms = { type: 'blaster', name: 'Blaster', rarity: 'common', slot: 'arms', stats: {} };
      // Equip replacement
      player.inventory.push({ type: 'heavy_blaster', name: 'Heavy Blaster', rarity: 'rare' });

      gl.tryEquip('r1', 'p1', 0);

      assert.equal(player.equipment.arms.type, 'heavy_blaster');
      assert.equal(player.inventory.length, 1);
      assert.equal(player.inventory[0].type, 'blaster');
    });

    it('equips medipac and sets heal ability in slot 6', () => {
      const player = addPlayer(makePlayer());
      player.inventory.push({ type: 'medipac_item', name: 'Medipac', rarity: 'common' });

      gl.tryEquip('r1', 'p1', 0);

      // heal_pulse.defaultSlot = 6 → abilities index 5
      assert.equal(player.abilities[5], 'heal_pulse');
      assert.ok(player.equipment.medipac);
    });

    it('equipping sol unit initialises the sol grid', () => {
      const player = addPlayer(makePlayer());
      player.inventory.push({ type: 'sol_unit_basic', name: 'Sol Unit Basic', rarity: 'common' });

      gl.tryEquip('r1', 'p1', 0);

      assert.ok(player.solGrid, 'expected solGrid to be initialised');
      assert.equal(player.solGrid.size, 3);
    });

    it('returns null for out-of-range inventory index', () => {
      const player = addPlayer(makePlayer());
      assert.equal(gl.tryEquip('r1', 'p1', 99), null);
    });

    it('returns null for item with no slot definition', () => {
      const player = addPlayer(makePlayer());
      player.inventory.push({ type: 'misc_item', name: 'Misc', rarity: 'common' });
      assert.equal(gl.tryEquip('r1', 'p1', 0), null);
    });

    it('returns null for unknown room', () => {
      assert.equal(gl.tryEquip('nonexistent', 'p1', 0), null);
    });

    it('returns null for unknown player', () => {
      assert.equal(gl.tryEquip('r1', 'nobody', 0), null);
    });

    it('clears sol grid when swapping out an equipped sol unit', () => {
      const player = addPlayer(makePlayer());
      // Equip a sol unit first
      player.inventory.push({ type: 'sol_unit_basic', name: 'Sol Unit Basic', rarity: 'common' });
      gl.tryEquip('r1', 'p1', 0);
      assert.ok(player.solGrid, 'sol grid should exist after equipping sol unit');

      // Now equip another sol unit — old grid must be cleared during the swap
      player.inventory.push({ type: 'sol_unit_basic', name: 'Sol Unit Basic', rarity: 'common' });
      gl.tryEquip('r1', 'p1', 0);

      // Grid should be re-initialised (not the old one)
      assert.ok(player.solGrid, 'sol grid should still exist after re-equipping');
    });
  });

  // -------------------------------------------------------------------------
  describe('tryUnequip', () => {
    it('moves equipped item back to inventory', () => {
      const player = addPlayer(makePlayer());
      player.equipment.arms = { type: 'blaster', name: 'Blaster', rarity: 'common', slot: 'arms', stats: {} };

      const result = gl.tryUnequip('r1', 'p1', 'arms');

      assert.ok(result, 'expected non-null result');
      assert.equal(player.equipment.arms, null);
      assert.equal(player.inventory.length, 1);
      assert.equal(player.inventory[0].type, 'blaster');
    });

    it('clears ability after unequipping arms weapon', () => {
      const player = addPlayer(makePlayer());
      player.equipment.arms = { type: 'blaster', name: 'Blaster', rarity: 'common', slot: 'arms', stats: {} };
      player.abilities[0] = 'blaster_shot';

      gl.tryUnequip('r1', 'p1', 'arms');

      assert.equal(player.abilities[0], null);
    });

    it('clears sol grid when unequipping sol unit', () => {
      const player = addPlayer(makePlayer());
      player.equipment.sol_unit = {
        type: 'sol_unit_basic', name: 'Sol Unit Basic', rarity: 'common', slot: 'sol_unit', stats: {},
      };
      player.solGrid = { size: 3, cells: new Array(9).fill(null), innateBonus: null };

      gl.tryUnequip('r1', 'p1', 'sol_unit');

      assert.equal(player.solGrid, null);
    });

    it('returns null when slot is empty', () => {
      const player = addPlayer(makePlayer());
      assert.equal(gl.tryUnequip('r1', 'p1', 'arms'), null);
    });

    it('returns null for invalid slot name', () => {
      const player = addPlayer(makePlayer());
      assert.equal(gl.tryUnequip('r1', 'p1', 'not_a_slot'), null);
    });

    it('accepts slot alias "weapon" → "arms"', () => {
      const player = addPlayer(makePlayer());
      player.equipment.arms = { type: 'blaster', name: 'Blaster', rarity: 'common', slot: 'arms', stats: {} };
      // SLOT_ALIASES maps 'weapon' → 'arms'
      const result = gl.tryUnequip('r1', 'p1', 'weapon');
      assert.ok(result, 'expected non-null result via alias');
      assert.equal(player.equipment.arms, null);
    });
  });

  // -------------------------------------------------------------------------
  describe('_rebuildAbilities', () => {
    it('resets all ability slots to null', () => {
      const player = makePlayer();
      player.abilities = ['old', 'stuff', null, null, null, null];
      gl._rebuildAbilities(player);
      assert.deepEqual(player.abilities, [null, null, null, null, null, null]);
    });

    it('places blaster_shot in slot index 0 from arms', () => {
      const player = makePlayer();
      player.equipment.arms = { type: 'blaster', name: 'Blaster', rarity: 'common', stats: {} };
      gl._rebuildAbilities(player);
      assert.equal(player.abilities[0], 'blaster_shot');
    });

    it('places heal_pulse in slot index 5 from medipac', () => {
      const player = makePlayer();
      player.equipment.medipac = { type: 'medipac_item', name: 'Medipac', rarity: 'common', stats: {} };
      gl._rebuildAbilities(player);
      assert.equal(player.abilities[5], 'heal_pulse');
    });

    it('resets energy to 0 when player has no sol grid', () => {
      const player = makePlayer();
      player.energy = 50;
      player.maxEnergy = 100;
      gl._rebuildAbilities(player);
      assert.equal(player.energy, 0);
      assert.equal(player.maxEnergy, 0);
    });

    it('can set abilities from both arms and medipac simultaneously', () => {
      const player = makePlayer();
      player.equipment.arms    = { type: 'blaster',      name: 'Blaster', rarity: 'common',  stats: {} };
      player.equipment.medipac = { type: 'medipac_item', name: 'Medipac', rarity: 'common',  stats: {} };
      gl._rebuildAbilities(player);
      assert.equal(player.abilities[0], 'blaster_shot');
      assert.equal(player.abilities[5], 'heal_pulse');
    });
  });
});
