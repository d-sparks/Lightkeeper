'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const GameLoop = require('../../server/game-loop');
const CONSTANTS = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Content mock — parameterised so individual tests can supply sol components
// ---------------------------------------------------------------------------
function makeContent(solComponents = {}) {
  const abilities = {
    blaster_shot: { id: 'blaster_shot', name: 'Blaster Shot', defaultSlot: 1, cooldown: 0.5, damageMultiplier: 1.0 },
    shield_burst: { id: 'shield_burst', name: 'Shield Burst', defaultSlot: 2, cooldown: 1.0, damageMultiplier: 0.5 },
    heal_pulse:   { id: 'heal_pulse',   name: 'Heal Pulse',   defaultSlot: 6, cooldown: 2.0 },
  };
  return {
    getItem:         ()     => null,
    getMonster:      ()     => null,
    getAbility:      (id)   => abilities[id]         || null,
    getSolComponent: (id)   => solComponents[id]     || null,
    getSolUnit:      ()     => null,
    getLootTable:    ()     => null,
    getSettings:     ()     => ({ xpSystem: { baseXpToLevel: 100, xpScalingFactor: 1.5, maxLevel: 20, hpPerLevel: 10 } }),
    getDungeon:      ()     => null,
    getTileset:      ()     => null,
    isSolid:         ()     => false,
    getRampInfo:     ()     => null,
    getTileDef:      ()     => null,
    items:           {},
    solComponents,
  };
}

// ---------------------------------------------------------------------------
// Grid builder helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal sol grid object.
 * cells: array of { x, y, abilityId?, modifierId?, generatorId?,
 *                   placementId?, isExtension? }
 */
function makeSolGrid(size, cells, innateBonus = null) {
  const grid = new Array(size * size).fill(null);
  for (const def of cells) {
    const idx = def.y * size + def.x;
    const cell = {};
    if (def.abilityId)    cell.abilityId    = def.abilityId;
    if (def.modifierId)   cell.modifierId   = def.modifierId;
    if (def.generatorId)  cell.generatorId  = def.generatorId;
    if (def.placementId !== undefined) cell.placementId = def.placementId;
    if (def.isExtension)  cell.isExtension  = true;
    grid[idx] = cell;
  }
  return { size, cells: grid, innateBonus, maxCharge: 100 };
}

/** Minimal player skeleton for _rebuildAbilities */
function makeSolPlayer(solGrid) {
  return {
    id: 'p1',
    equipment: { arms: null, sol_unit: null, medipac: null, accessory: null },
    abilities:        [null, null, null, null, null, null],
    cooldowns:        [0, 0, 0, 0, 0, 0],
    abilityOverrides: {},
    solGrid,
    energy: 0, maxEnergy: 0,
    singleUseEnergy: 0, singleUseMaxEnergy: 0,
    solGridEnergyRegen: 0,
  };
}

// ---------------------------------------------------------------------------
describe('Sol grid integration', () => {

  // =========================================================================
  describe('_getAdjacentModifiers', () => {
    it('returns empty array when no adjacent modifiers', () => {
      const gl = new GameLoop(makeContent());
      const grid = makeSolGrid(3, [
        { x: 1, y: 1, abilityId: 'blaster_shot', placementId: 1 },
      ]);
      assert.deepEqual(gl._getAdjacentModifiers(grid, 1, 1), []);
    });

    it('finds modifier to the right', () => {
      const comps = {
        amp: { id: 'amp', type: 'modifier', name: 'Amp', bonus: { damageMultiplier: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(3, [
        { x: 0, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'amp',          placementId: 2 },
      ]);
      const mods = gl._getAdjacentModifiers(grid, 0, 1);
      assert.equal(mods.length, 1);
      assert.equal(mods[0].bonus.damageMultiplier, 0.5);
    });

    it('collects modifiers from all four orthogonal directions', () => {
      const comps = {
        amp: { id: 'amp', type: 'modifier', name: 'Amp', bonus: { damageMultiplier: 0.1 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(5, [
        { x: 2, y: 2, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 2, modifierId: 'amp', placementId: 2 }, // left
        { x: 3, y: 2, modifierId: 'amp', placementId: 3 }, // right
        { x: 2, y: 1, modifierId: 'amp', placementId: 4 }, // up
        { x: 2, y: 3, modifierId: 'amp', placementId: 5 }, // down
      ]);
      const mods = gl._getAdjacentModifiers(grid, 2, 2);
      assert.equal(mods.length, 4);
    });

    it('ignores diagonal neighbours (strictly 4-directional)', () => {
      const comps = {
        amp: { id: 'amp', type: 'modifier', name: 'Amp', bonus: { damageMultiplier: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(3, [
        { x: 1, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 0, y: 0, modifierId: 'amp', placementId: 2 }, // top-left diagonal
        { x: 2, y: 2, modifierId: 'amp', placementId: 3 }, // bottom-right diagonal
      ]);
      const mods = gl._getAdjacentModifiers(grid, 1, 1);
      assert.equal(mods.length, 0);
    });

    it('deduplicates multi-cell modifier shapes sharing a placementId', () => {
      const comps = {
        amp: { id: 'amp', type: 'modifier', name: 'Amp', bonus: { damageMultiplier: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      // 2-cell horizontal modifier with the same placementId adjacent on both sides
      const grid = makeSolGrid(5, [
        { x: 2, y: 2, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 2, modifierId: 'amp', placementId: 2 },                    // left of ability
        { x: 3, y: 2, modifierId: 'amp', placementId: 2, isExtension: true }, // right — same shape
      ]);
      const mods = gl._getAdjacentModifiers(grid, 2, 2);
      assert.equal(mods.length, 1, 'multi-cell shape should count once');
    });

    it('ignores modifier cells whose component type is not "modifier"', () => {
      // Component exists but has wrong type (e.g. 'generator')
      const comps = {
        gen: { id: 'gen', type: 'generator', name: 'Generator', energyRegen: 5 },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(3, [
        { x: 0, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'gen',          placementId: 2 },
      ]);
      const mods = gl._getAdjacentModifiers(grid, 0, 1);
      assert.equal(mods.length, 0);
    });
  });

  // =========================================================================
  describe('_computeModifiedAbility', () => {
    const BASE_ABILITY = { damageMultiplier: 1.0, cooldown: 0.5 };

    it('returns null when no adjacent modifiers and no innate bonus', () => {
      const gl = new GameLoop(makeContent());
      const grid = makeSolGrid(3, [
        { x: 1, y: 1, abilityId: 'blaster_shot', placementId: 1 },
      ]);
      assert.equal(gl._computeModifiedAbility(grid, 1, 1, BASE_ABILITY), null);
    });

    it('applies damageMultiplier from adjacent modifier', () => {
      const comps = {
        amp: { id: 'amp', type: 'modifier', name: 'Amp', bonus: { damageMultiplier: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(3, [
        { x: 0, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'amp',          placementId: 2 },
      ]);
      const result = gl._computeModifiedAbility(grid, 0, 1, BASE_ABILITY);
      assert.ok(result, 'expected modification object');
      // base 1.0 + modifier 0.5
      assert.equal(result.damageMultiplier, 1.5);
    });

    it('stacks damageMultiplier from two adjacent modifiers', () => {
      const comps = {
        amp: { id: 'amp', type: 'modifier', name: 'Amp', bonus: { damageMultiplier: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(5, [
        { x: 2, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'amp', placementId: 2 },
        { x: 3, y: 1, modifierId: 'amp', placementId: 3 },
      ]);
      const result = gl._computeModifiedAbility(grid, 2, 1, BASE_ABILITY);
      assert.ok(result);
      assert.equal(result.damageMultiplier, 2.0); // 1.0 + 0.5 + 0.5
    });

    it('applies cooldownReduction correctly', () => {
      const comps = {
        swift: { id: 'swift', type: 'modifier', name: 'Swift', bonus: { cooldownReduction: 0.2 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(3, [
        { x: 0, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'swift',        placementId: 2 },
      ]);
      const result = gl._computeModifiedAbility(grid, 0, 1, BASE_ABILITY);
      assert.ok(result);
      // cooldown = max(0.1, 0.5 * (1 - 0.2)) = max(0.1, 0.4) = 0.4
      assert.ok(Math.abs(result.cooldown - 0.4) < 0.001, `expected ~0.4, got ${result.cooldown}`);
    });

    it('caps cooldownReduction at 0.75', () => {
      const comps = {
        s1: { id: 's1', type: 'modifier', name: 'Swift1', bonus: { cooldownReduction: 0.5 } },
        s2: { id: 's2', type: 'modifier', name: 'Swift2', bonus: { cooldownReduction: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      // combined raw = 1.0, capped to 0.75
      const grid = makeSolGrid(5, [
        { x: 2, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 's1', placementId: 2 },
        { x: 3, y: 1, modifierId: 's2', placementId: 3 },
      ]);
      const result = gl._computeModifiedAbility(grid, 2, 1, { ...BASE_ABILITY, cooldown: 1.0 });
      assert.ok(result);
      // cooldown = max(0.1, 1.0 * (1 - 0.75)) = 0.25
      assert.ok(Math.abs(result.cooldown - 0.25) < 0.001, `expected ~0.25, got ${result.cooldown}`);
    });

    it('applies energyCostReduction to ability energyCost', () => {
      const comps = {
        eff: { id: 'eff', type: 'modifier', name: 'Efficient', bonus: { energyCostReduction: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(3, [
        { x: 0, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'eff',          placementId: 2 },
      ]);
      const abilityDef = { ...BASE_ABILITY, energyCost: 20 };
      const result = gl._computeModifiedAbility(grid, 0, 1, abilityDef);
      assert.ok(result);
      // energyCost = max(1, round(20 * (1 - 0.5))) = 10
      assert.equal(result.energyCost, 10);
    });

    it('caps healOnHit at 15', () => {
      const comps = {
        h1: { id: 'h1', type: 'modifier', name: 'Lifesteal1', bonus: { healOnHit: 10 } },
        h2: { id: 'h2', type: 'modifier', name: 'Lifesteal2', bonus: { healOnHit: 10 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(5, [
        { x: 2, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'h1', placementId: 2 },
        { x: 3, y: 1, modifierId: 'h2', placementId: 3 },
      ]);
      const result = gl._computeModifiedAbility(grid, 2, 1, BASE_ABILITY);
      assert.ok(result);
      assert.equal(result.healOnHit, 15); // min(10+10, 15) = 15
    });

    it('applies innate sol unit bonus even without adjacent modifiers', () => {
      const gl = new GameLoop(makeContent());
      const grid = makeSolGrid(3, [
        { x: 1, y: 1, abilityId: 'blaster_shot', placementId: 1 },
      ], { damageMultiplier: 0.3 }); // innateBonus
      const result = gl._computeModifiedAbility(grid, 1, 1, BASE_ABILITY);
      assert.ok(result, 'innate bonus alone should produce a result');
      assert.equal(result.damageMultiplier, 1.3); // 1.0 + 0.3
    });

    it('stacks adjacent modifier bonus with innate bonus', () => {
      const comps = {
        amp: { id: 'amp', type: 'modifier', name: 'Amp', bonus: { damageMultiplier: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(3, [
        { x: 0, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'amp',          placementId: 2 },
      ], { damageMultiplier: 0.25 }); // innateBonus
      const result = gl._computeModifiedAbility(grid, 0, 1, BASE_ABILITY);
      assert.ok(result);
      // 1.0 (base) + 0.5 (mod) + 0.25 (innate) = 1.75
      assert.ok(Math.abs(result.damageMultiplier - 1.75) < 0.001);
    });
  });

  // =========================================================================
  describe('_rebuildAbilities with sol grid', () => {
    it('places ability from sol grid cell in correct ability slot', () => {
      const gl = new GameLoop(makeContent());
      const grid = makeSolGrid(3, [
        { x: 0, y: 0, abilityId: 'blaster_shot', placementId: 1 },
      ]);
      const player = makeSolPlayer(grid);
      gl._rebuildAbilities(player);
      // blaster_shot.defaultSlot = 1 → index 0
      assert.equal(player.abilities[0], 'blaster_shot');
    });

    it('places two abilities from different grid cells', () => {
      const gl = new GameLoop(makeContent());
      const grid = makeSolGrid(3, [
        { x: 0, y: 0, abilityId: 'blaster_shot', placementId: 1 },
        { x: 0, y: 2, abilityId: 'shield_burst', placementId: 2 },
      ]);
      const player = makeSolPlayer(grid);
      gl._rebuildAbilities(player);
      assert.equal(player.abilities[0], 'blaster_shot'); // defaultSlot 1 → idx 0
      assert.equal(player.abilities[1], 'shield_burst'); // defaultSlot 2 → idx 1
    });

    it('stores adjacency overrides when modifier is adjacent to ability', () => {
      const comps = {
        amp: { id: 'amp', type: 'modifier', name: 'Amp', bonus: { damageMultiplier: 0.5 } },
      };
      const gl = new GameLoop(makeContent(comps));
      const grid = makeSolGrid(3, [
        { x: 0, y: 1, abilityId: 'blaster_shot', placementId: 1 },
        { x: 1, y: 1, modifierId: 'amp',          placementId: 2 },
      ]);
      const player = makeSolPlayer(grid);
      gl._rebuildAbilities(player);

      // blaster_shot → slot index 0
      assert.ok(player.abilityOverrides[0], 'expected adjacency override for slot 0');
      assert.equal(player.abilityOverrides[0].damageMultiplier, 1.5);
    });

    it('sets maxEnergy from sol grid maxCharge', () => {
      const gl = new GameLoop(makeContent());
      const grid = makeSolGrid(3, []);
      grid.maxCharge = 200;
      const player = makeSolPlayer(grid);
      gl._rebuildAbilities(player);
      assert.equal(player.maxEnergy, 200);
    });

    it('skips extension cells when scanning abilities', () => {
      const gl = new GameLoop(makeContent());
      // 1x2 ability shape: origin at (0,0), extension at (0,1)
      const grid = makeSolGrid(3, [
        { x: 0, y: 0, abilityId: 'blaster_shot', placementId: 1 },
        { x: 0, y: 1, abilityId: 'blaster_shot', placementId: 1, isExtension: true },
      ]);
      const player = makeSolPlayer(grid);
      gl._rebuildAbilities(player);
      // blaster_shot should appear exactly once (extension cell is ignored)
      const count = player.abilities.filter(a => a === 'blaster_shot').length;
      assert.equal(count, 1);
    });
  });
});
