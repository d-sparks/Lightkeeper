const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Automation = require('../../server/automation');

// Minimal content mock with structure definitions
function makeContent(structures = {}) {
  return {
    getStructures: () => structures,
    getDungeon: () => null,
  };
}

const testStructures = {
  solar_panel: {
    name: 'Solar Panel',
    cost: { silicon: 3 },
    maxCount: 4,
    effect: { type: 'energy_regen', amount: 1, intervalSeconds: 10 },
  },
  silicon_harvester: {
    name: 'Silicon Harvester',
    cost: { silicon: 5 },
    maxCount: 2,
    effect: { type: 'resource_production', produces: 'silicon', amount: 1, intervalSeconds: 30 },
  },
};

// Helper: create an Automation instance with a 5x5 open grid
function makeAutoWithGrid(structures) {
  const auto = new Automation(makeContent(structures || testStructures));
  auto._gridConfig = { gridWidth: 5, gridHeight: 5, blockedSet: new Set() };
  return auto;
}

describe('Automation', () => {
  describe('resources', () => {
    it('starts with zero silicon', () => {
      const auto = new Automation(makeContent());
      assert.equal(auto.getResource('p1', 'silicon'), 0);
    });

    it('addResource increases resource count', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'silicon', 10);
      assert.equal(auto.getResource('p1', 'silicon'), 10);
    });

    it('addResource accumulates', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'silicon', 5);
      auto.addResource('p1', 'silicon', 3);
      assert.equal(auto.getResource('p1', 'silicon'), 8);
    });

    it('tracks totalSiliconProduced stat', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'silicon', 7);
      const state = auto.getState('p1');
      assert.equal(state.stats.totalSiliconProduced, 7);
    });

    it('isolates resources between players', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'silicon', 10);
      auto.addResource('p2', 'silicon', 20);
      assert.equal(auto.getResource('p1', 'silicon'), 10);
      assert.equal(auto.getResource('p2', 'silicon'), 20);
    });
  });

  describe('spendResources', () => {
    it('deducts resources and returns true on success', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'silicon', 10);
      const result = auto.spendResources('p1', { silicon: 4 });
      assert.equal(result, true);
      assert.equal(auto.getResource('p1', 'silicon'), 6);
    });

    it('returns false and does not deduct if insufficient', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'silicon', 2);
      const result = auto.spendResources('p1', { silicon: 5 });
      assert.equal(result, false);
      assert.equal(auto.getResource('p1', 'silicon'), 2);
    });

    it('tracks totalSiliconSpent stat', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'silicon', 10);
      auto.spendResources('p1', { silicon: 3 });
      const state = auto.getState('p1');
      assert.equal(state.stats.totalSiliconSpent, 3);
    });
  });

  describe('build', () => {
    it('builds a structure at grid coords and deducts cost', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      const result = auto.build('p1', 'solar_panel', 0, 0);
      assert.equal(result, true);
      assert.equal(auto.getResource('p1', 'silicon'), 7);
      const state = auto.getState('p1');
      assert.equal(state.structures.solar_panel.count, 1);
      assert.deepEqual(state.structures.solar_panel.placements, [{ x: 0, y: 0 }]);
    });

    it('requires grid coordinates', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      assert.equal(auto.build('p1', 'solar_panel'), false);
      assert.equal(auto.getResource('p1', 'silicon'), 10); // no cost deducted
    });

    it('respects maxCount limit', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 100);
      assert.equal(auto.build('p1', 'solar_panel', 0, 0), true);
      assert.equal(auto.build('p1', 'solar_panel', 1, 0), true);
      assert.equal(auto.build('p1', 'solar_panel', 2, 0), true);
      assert.equal(auto.build('p1', 'solar_panel', 3, 0), true);
      assert.equal(auto.build('p1', 'solar_panel', 4, 0), false);
    });

    it('fails if insufficient resources', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 1);
      assert.equal(auto.build('p1', 'solar_panel', 0, 0), false);
    });

    it('fails for unknown structure', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 100);
      assert.equal(auto.build('p1', 'nonexistent', 0, 0), false);
    });

    it('rejects occupied cells', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 20);
      assert.equal(auto.build('p1', 'solar_panel', 2, 3), true);
      assert.equal(auto.build('p1', 'solar_panel', 2, 3), false);
    });

    it('rejects blocked cells', () => {
      const auto = new Automation(makeContent(testStructures));
      auto._gridConfig = { gridWidth: 5, gridHeight: 5, blockedSet: new Set([7]) }; // cell (2,1) blocked
      auto.addResource('p1', 'silicon', 10);
      assert.equal(auto.build('p1', 'solar_panel', 2, 1), false);
    });

    it('rejects out-of-bounds cells', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      assert.equal(auto.build('p1', 'solar_panel', -1, 0), false);
      assert.equal(auto.build('p1', 'solar_panel', 5, 0), false);
    });

    it('records placement coordinates', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      auto.build('p1', 'solar_panel', 2, 3);
      const state = auto.getState('p1');
      assert.deepEqual(state.structures.solar_panel.placements, [{ x: 2, y: 3 }]);
    });
  });

  describe('production tick', () => {
    it('produces resources after enough time', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 5);
      auto.build('p1', 'silicon_harvester', 0, 0);
      // silicon_harvester: 1 silicon every 30s
      auto.updateProduction('p1', 30);
      // Started with 5, spent 5 on build, then produced 1
      assert.equal(auto.getResource('p1', 'silicon'), 1);
    });

    it('does not produce before interval elapses', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 5);
      auto.build('p1', 'silicon_harvester', 0, 0);
      auto.updateProduction('p1', 10); // only 10s, need 30s
      assert.equal(auto.getResource('p1', 'silicon'), 0);
    });

    it('accumulates partial time across ticks', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 5);
      auto.build('p1', 'silicon_harvester', 0, 0);
      auto.updateProduction('p1', 15);
      auto.updateProduction('p1', 15);
      assert.equal(auto.getResource('p1', 'silicon'), 1);
    });

    it('scales production by structure count', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      auto.build('p1', 'silicon_harvester', 0, 0);
      auto.build('p1', 'silicon_harvester', 1, 0);
      // 2 harvesters: produce 2 silicon per 30s interval
      auto.updateProduction('p1', 30);
      assert.equal(auto.getResource('p1', 'silicon'), 2);
    });

    it('returns produced resources list', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 5);
      auto.build('p1', 'silicon_harvester', 0, 0);
      const produced = auto.updateProduction('p1', 30);
      assert.equal(produced.length, 1);
      assert.equal(produced[0].resource, 'silicon');
      assert.equal(produced[0].amount, 1);
    });
  });

  describe('energy regen rate', () => {
    it('returns 0 with no structures', () => {
      const auto = new Automation(makeContent(testStructures));
      assert.equal(auto.getEnergyRegenRate('p1', 'room1'), 0);
    });

    it('calculates regen from solar panels', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      auto.build('p1', 'solar_panel', 0, 0);
      // 1 panel: amount=1, interval=10s => 0.1/s
      assert.equal(auto.getEnergyRegenRate('p1', 'room1'), 0.1);
    });
  });

  describe('trackEnergyGenerated', () => {
    it('accumulates total energy generated', () => {
      const auto = new Automation(makeContent());
      auto.trackEnergyGenerated('p1', 5.5);
      auto.trackEnergyGenerated('p1', 2.0);
      const state = auto.getState('p1');
      assert.equal(state.stats.totalEnergyGenerated, 7.5);
    });
  });

  describe('grantStructure', () => {
    it('grants structure without spending resources', () => {
      const auto = new Automation(makeContent(testStructures));
      const result = auto.grantStructure('p1', 'solar_panel');
      assert.equal(result, true);
      assert.equal(auto.getResource('p1', 'silicon'), 0); // no cost deducted
      const state = auto.getState('p1');
      assert.equal(state.structures.solar_panel.count, 1);
    });

    it('respects maxCount even for grants', () => {
      const auto = new Automation(makeContent(testStructures));
      for (let i = 0; i < 4; i++) auto.grantStructure('p1', 'solar_panel');
      assert.equal(auto.grantStructure('p1', 'solar_panel'), false);
    });
  });

  describe('trade', () => {
    it('executes trade when resources sufficient', () => {
      const auto = new Automation(makeContent(testStructures));
      auto.addResource('p1', 'silicon', 10);
      const gives = auto.trade('p1', 'damage_booster');
      assert.notEqual(gives, null);
      assert.equal(auto.getResource('p1', 'silicon'), 5);
    });

    it('returns null for insufficient resources', () => {
      const auto = new Automation(makeContent(testStructures));
      auto.addResource('p1', 'silicon', 2);
      assert.equal(auto.trade('p1', 'damage_booster'), null);
      assert.equal(auto.getResource('p1', 'silicon'), 2);
    });

    it('returns null for unknown trade', () => {
      const auto = new Automation(makeContent(testStructures));
      auto.addResource('p1', 'silicon', 100);
      assert.equal(auto.trade('p1', 'nonexistent'), null);
    });
  });

  describe('cell occupancy', () => {
    it('detects occupied cells', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      auto.build('p1', 'solar_panel', 1, 2);
      assert.equal(auto.isCellOccupied('p1', 1, 2), true);
      assert.equal(auto.isCellOccupied('p1', 0, 0), false);
    });

    it('isolates occupancy between players', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      auto.build('p1', 'solar_panel', 1, 1);
      assert.equal(auto.isCellOccupied('p2', 1, 1), false);
    });
  });

  describe('getPlacements', () => {
    it('returns all placements across structures', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 20);
      auto.build('p1', 'solar_panel', 0, 0);
      auto.build('p1', 'silicon_harvester', 1, 1);
      const placements = auto.getPlacements('p1');
      assert.equal(placements.length, 2);
      const types = placements.map(p => p.structureId).sort();
      assert.deepEqual(types, ['silicon_harvester', 'solar_panel']);
    });
  });

  describe('getStateForClient', () => {
    it('includes grid data with blocked cells and placements', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'silicon', 10);
      auto.build('p1', 'solar_panel', 1, 2);
      const clientState = auto.getStateForClient('p1');
      assert.ok(clientState.grid);
      assert.equal(clientState.grid.width, 5);
      assert.equal(clientState.grid.height, 5);
      assert.equal(clientState.grid.placements.length, 1);
      assert.deepEqual(clientState.grid.placements[0], { structureId: 'solar_panel', x: 1, y: 2 });
    });

    it('includes stats with totalEnergyGenerated', () => {
      const auto = makeAutoWithGrid();
      auto.trackEnergyGenerated('p1', 10);
      const clientState = auto.getStateForClient('p1');
      assert.equal(clientState.stats.totalEnergyGenerated, 10);
    });

    it('includes automation level info', () => {
      const structs = {
        ...testStructures,
        _automationLevels: [
          { name: 'Outpost', threshold: 1 },
          { name: 'Depot', threshold: 3 },
        ],
      };
      const auto = new Automation(makeContent(structs));
      auto._gridConfig = { gridWidth: 5, gridHeight: 5, blockedSet: new Set() };
      auto.addResource('p1', 'silicon', 100);
      auto.build('p1', 'solar_panel', 0, 0);
      const clientState = auto.getStateForClient('p1');
      assert.equal(clientState.stats.automationLevel, 1);
      assert.equal(clientState.stats.automationLevelName, 'Outpost');
      assert.equal(clientState.stats.totalStructures, 1);
    });
  });
});
