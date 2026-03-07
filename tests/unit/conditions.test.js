const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const FlagStore = require('../../server/scripting/flag-store');
const ConditionEvaluator = require('../../server/scripting/conditions');

function makeEvaluator(flagStore) {
  return new ConditionEvaluator(flagStore || new FlagStore());
}

function makeContext(overrides) {
  return {
    playerId: 'p1',
    roomId: 'r1',
    player: { inventory: [], medipacCharges: 0, ...overrides?.player },
    ...overrides,
  };
}

describe('ConditionEvaluator', () => {
  describe('null/empty conditions', () => {
    it('returns true for null condition', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate(null, makeContext()), true);
    });

    it('returns true for undefined condition', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate(undefined, makeContext()), true);
    });

    it('returns true for empty array', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate([], makeContext()), true);
    });
  });

  describe('hasFlag', () => {
    it('returns true when player flag is truthy', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'hasKey', true);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ hasFlag: 'hasKey' }, makeContext()), true);
    });

    it('returns false when player flag is not set', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate({ hasFlag: 'hasKey' }, makeContext()), false);
    });

    it('returns false when player flag is falsy', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'hasKey', false);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ hasFlag: 'hasKey' }, makeContext()), false);
    });

    it('checks exact value when value is specified', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'score', 5);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ hasFlag: 'score', value: 5 }, makeContext()), true);
      assert.equal(eval_.evaluate({ hasFlag: 'score', value: 3 }, makeContext()), false);
    });

    it('checks room scope when specified', () => {
      const fs = new FlagStore();
      fs.setRoomFlag('r1', 'doorOpen', true);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ hasFlag: 'doorOpen', scope: 'room' }, makeContext()), true);
      // Player scope should not find it
      assert.equal(eval_.evaluate({ hasFlag: 'doorOpen' }, makeContext()), false);
    });
  });

  describe('flagGreaterThan', () => {
    it('returns true when flag value exceeds threshold', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'kills', 5);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ flagGreaterThan: { flag: 'kills', value: 3 } }, makeContext()), true);
    });

    it('returns false when flag equals threshold', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'kills', 3);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ flagGreaterThan: { flag: 'kills', value: 3 } }, makeContext()), false);
    });

    it('treats unset flag as 0', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate({ flagGreaterThan: { flag: 'kills', value: -1 } }, makeContext()), true);
      assert.equal(eval_.evaluate({ flagGreaterThan: { flag: 'kills', value: 0 } }, makeContext()), false);
    });

    it('respects room scope', () => {
      const fs = new FlagStore();
      fs.setRoomFlag('r1', 'waveCount', 5);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ flagGreaterThan: { flag: 'waveCount', value: 3, scope: 'room' } }, makeContext()), true);
    });
  });

  describe('flagLessThan', () => {
    it('returns true when flag value is below threshold', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'health', 2);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ flagLessThan: { flag: 'health', value: 5 } }, makeContext()), true);
    });

    it('returns false when flag equals threshold', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'health', 5);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ flagLessThan: { flag: 'health', value: 5 } }, makeContext()), false);
    });

    it('treats unset flag as 0', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate({ flagLessThan: { flag: 'x', value: 1 } }, makeContext()), true);
      assert.equal(eval_.evaluate({ flagLessThan: { flag: 'x', value: 0 } }, makeContext()), false);
    });
  });

  describe('hasItem', () => {
    it('returns true when player has item in inventory', () => {
      const eval_ = makeEvaluator();
      const ctx = makeContext({ player: { inventory: [{ type: 'iron_key' }], medipacCharges: 0 } });
      assert.equal(eval_.evaluate({ hasItem: 'iron_key' }, ctx), true);
    });

    it('returns false when player lacks the item', () => {
      const eval_ = makeEvaluator();
      const ctx = makeContext({ player: { inventory: [], medipacCharges: 0 } });
      assert.equal(eval_.evaluate({ hasItem: 'iron_key' }, ctx), false);
    });

    it('returns false when no player in context', () => {
      const eval_ = makeEvaluator();
      const ctx = { playerId: 'p1', roomId: 'r1' };
      assert.equal(eval_.evaluate({ hasItem: 'iron_key' }, ctx), false);
    });

    it('checks medipacCharges for medical_supplies', () => {
      const eval_ = makeEvaluator();
      const ctx = makeContext({ player: { inventory: [], medipacCharges: 2 } });
      assert.equal(eval_.evaluate({ hasItem: 'medical_supplies' }, ctx), true);
    });

    it('returns false for medical_supplies when charges are 0', () => {
      const eval_ = makeEvaluator();
      const ctx = makeContext({ player: { inventory: [], medipacCharges: 0 } });
      assert.equal(eval_.evaluate({ hasItem: 'medical_supplies' }, ctx), false);
    });
  });

  describe('logical operators', () => {
    it('and: all must pass', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'a', true);
      fs.setPlayerFlag('p1', 'b', true);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ and: [{ hasFlag: 'a' }, { hasFlag: 'b' }] }, makeContext()), true);
    });

    it('and: fails if one fails', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'a', true);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ and: [{ hasFlag: 'a' }, { hasFlag: 'b' }] }, makeContext()), false);
    });

    it('or: passes if any passes', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'b', true);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ or: [{ hasFlag: 'a' }, { hasFlag: 'b' }] }, makeContext()), true);
    });

    it('or: fails if all fail', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate({ or: [{ hasFlag: 'a' }, { hasFlag: 'b' }] }, makeContext()), false);
    });

    it('not: inverts result', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate({ not: { hasFlag: 'a' } }, makeContext()), true);
    });

    it('not: inverts truthy to false', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'a', true);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate({ not: { hasFlag: 'a' } }, makeContext()), false);
    });

    it('nested: not inside and', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'a', true);
      const eval_ = makeEvaluator(fs);
      const cond = { and: [{ hasFlag: 'a' }, { not: { hasFlag: 'b' } }] };
      assert.equal(eval_.evaluate(cond, makeContext()), true);
    });

    it('nested: or inside not', () => {
      const eval_ = makeEvaluator();
      const cond = { not: { or: [{ hasFlag: 'a' }, { hasFlag: 'b' }] } };
      assert.equal(eval_.evaluate(cond, makeContext()), true);
    });
  });

  describe('array of conditions (implicit AND)', () => {
    it('all must pass', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'a', true);
      fs.setPlayerFlag('p1', 'b', true);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate([{ hasFlag: 'a' }, { hasFlag: 'b' }], makeContext()), true);
    });

    it('fails if one fails', () => {
      const fs = new FlagStore();
      fs.setPlayerFlag('p1', 'a', true);
      const eval_ = makeEvaluator(fs);
      assert.equal(eval_.evaluate([{ hasFlag: 'a' }, { hasFlag: 'b' }], makeContext()), false);
    });
  });

  describe('unknown condition type', () => {
    it('returns true (does not block)', () => {
      const eval_ = makeEvaluator();
      assert.equal(eval_.evaluate({ unknownThing: 'xyz' }, makeContext()), true);
    });
  });
});
