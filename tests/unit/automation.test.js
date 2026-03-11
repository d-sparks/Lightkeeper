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
    cost: { salvage: 3 },
    maxCount: 4,
    effect: { type: 'energy_regen', amount: 1, intervalSeconds: 10 },
  },
  salvage_harvester: {
    name: 'Salvage Harvester',
    cost: { salvage: 5 },
    maxCount: 2,
    effect: { type: 'resource_production', produces: 'salvage', amount: 1, intervalSeconds: 30 },
  },
  silicon_refinery: {
    name: 'Silicon Refinery',
    cost: { salvage: 8 },
    maxCount: 3,
    unlockLevel: 7,
    effect: { type: 'resource_production', produces: 'silicon', amount: 1, intervalSeconds: 45 },
  },
  auto_turret: {
    name: 'Auto-Turret',
    cost: { silicon: 5 },
    maxCount: 4,
    unlockLevel: 8,
    effect: { type: 'defense_value', amount: 50 },
  },
  expedition_beacon: {
    name: 'Expedition Beacon',
    cost: { silicon: 15 },
    maxCount: 1,
    unlockLevel: 10,
    effect: { type: 'expedition_cost_reduction', reduction: 0.5 },
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
    it('starts with zero salvage', () => {
      const auto = new Automation(makeContent());
      assert.equal(auto.getResource('p1', 'salvage'), 0);
    });

    it('addResource increases resource count', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'salvage', 10);
      assert.equal(auto.getResource('p1', 'salvage'), 10);
    });

    it('addResource accumulates', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'salvage', 5);
      auto.addResource('p1', 'salvage', 3);
      assert.equal(auto.getResource('p1', 'salvage'), 8);
    });

    it('tracks totalSalvageProduced stat', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'salvage', 7);
      const state = auto.getState('p1');
      assert.equal(state.stats.totalSalvageProduced, 7);
    });

    it('supports silicon resource', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'silicon', 10);
      assert.equal(auto.getResource('p1', 'silicon'), 10);
    });

    it('isolates resources between players', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'salvage', 10);
      auto.addResource('p2', 'salvage', 20);
      assert.equal(auto.getResource('p1', 'salvage'), 10);
      assert.equal(auto.getResource('p2', 'salvage'), 20);
    });
  });

  describe('spendResources', () => {
    it('deducts resources and returns true on success', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'salvage', 10);
      const result = auto.spendResources('p1', { salvage: 4 });
      assert.equal(result, true);
      assert.equal(auto.getResource('p1', 'salvage'), 6);
    });

    it('returns false and does not deduct if insufficient', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'salvage', 2);
      const result = auto.spendResources('p1', { salvage: 5 });
      assert.equal(result, false);
      assert.equal(auto.getResource('p1', 'salvage'), 2);
    });

    it('tracks totalSalvageSpent stat', () => {
      const auto = new Automation(makeContent());
      auto.addResource('p1', 'salvage', 10);
      auto.spendResources('p1', { salvage: 3 });
      const state = auto.getState('p1');
      assert.equal(state.stats.totalSalvageSpent, 3);
    });
  });

  describe('build', () => {
    it('builds a structure at grid coords and deducts cost', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 10);
      const result = auto.build('p1', 'solar_panel', 0, 0);
      assert.equal(result, true);
      assert.equal(auto.getResource('p1', 'salvage'), 7);
      const state = auto.getState('p1');
      assert.equal(state.structures.solar_panel.count, 1);
      assert.deepEqual(state.structures.solar_panel.placements, [{ x: 0, y: 0 }]);
    });

    it('requires grid coordinates', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 10);
      assert.equal(auto.build('p1', 'solar_panel'), false);
      assert.equal(auto.getResource('p1', 'salvage'), 10); // no cost deducted
    });

    it('respects maxCount limit', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 100);
      assert.equal(auto.build('p1', 'solar_panel', 0, 0), true);
      assert.equal(auto.build('p1', 'solar_panel', 1, 0), true);
      assert.equal(auto.build('p1', 'solar_panel', 2, 0), true);
      assert.equal(auto.build('p1', 'solar_panel', 3, 0), true);
      assert.equal(auto.build('p1', 'solar_panel', 4, 0), false);
    });

    it('fails if insufficient resources', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 1);
      assert.equal(auto.build('p1', 'solar_panel', 0, 0), false);
    });

    it('fails for unknown structure', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 100);
      assert.equal(auto.build('p1', 'nonexistent', 0, 0), false);
    });

    it('rejects occupied cells', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 20);
      assert.equal(auto.build('p1', 'solar_panel', 2, 3), true);
      assert.equal(auto.build('p1', 'solar_panel', 2, 3), false);
    });

    it('rejects blocked cells', () => {
      const auto = new Automation(makeContent(testStructures));
      auto._gridConfig = { gridWidth: 5, gridHeight: 5, blockedSet: new Set([7]) }; // cell (2,1) blocked
      auto.addResource('p1', 'salvage', 10);
      assert.equal(auto.build('p1', 'solar_panel', 2, 1), false);
    });

    it('rejects out-of-bounds cells', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 10);
      assert.equal(auto.build('p1', 'solar_panel', -1, 0), false);
      assert.equal(auto.build('p1', 'solar_panel', 5, 0), false);
    });

    it('records placement coordinates', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 10);
      auto.build('p1', 'solar_panel', 2, 3);
      const state = auto.getState('p1');
      assert.deepEqual(state.structures.solar_panel.placements, [{ x: 2, y: 3 }]);
    });

    it('rejects locked structures (unlockLevel not met)', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 100);
      // silicon_refinery requires unlockLevel 7, player has 0 structures = level 0
      assert.equal(auto.build('p1', 'silicon_refinery', 0, 0), false);
    });
  });

  describe('production tick', () => {
    it('produces resources after enough time', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 5);
      auto.build('p1', 'salvage_harvester', 0, 0);
      // salvage_harvester: 1 salvage every 30s
      auto.updateProduction('p1', 30);
      // Started with 5, spent 5 on build, then produced 1
      assert.equal(auto.getResource('p1', 'salvage'), 1);
    });

    it('does not produce before interval elapses', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 5);
      auto.build('p1', 'salvage_harvester', 0, 0);
      auto.updateProduction('p1', 10); // only 10s, need 30s
      assert.equal(auto.getResource('p1', 'salvage'), 0);
    });

    it('accumulates partial time across ticks', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 5);
      auto.build('p1', 'salvage_harvester', 0, 0);
      auto.updateProduction('p1', 15);
      auto.updateProduction('p1', 15);
      assert.equal(auto.getResource('p1', 'salvage'), 1);
    });

    it('scales production by structure count', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 10);
      auto.build('p1', 'salvage_harvester', 0, 0);
      auto.build('p1', 'salvage_harvester', 1, 0);
      // 2 harvesters: produce 2 salvage per 30s interval
      auto.updateProduction('p1', 30);
      assert.equal(auto.getResource('p1', 'salvage'), 2);
    });

    it('returns produced resources list', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 5);
      auto.build('p1', 'salvage_harvester', 0, 0);
      const produced = auto.updateProduction('p1', 30);
      assert.equal(produced.length, 1);
      assert.equal(produced[0].resource, 'salvage');
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
      auto.addResource('p1', 'salvage', 10);
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
      assert.equal(auto.getResource('p1', 'salvage'), 0); // no cost deducted
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
      auto.addResource('p1', 'salvage', 10);
      const gives = auto.trade('p1', 'damage_booster');
      assert.notEqual(gives, null);
      assert.equal(auto.getResource('p1', 'salvage'), 5);
    });

    it('returns null for insufficient resources', () => {
      const auto = new Automation(makeContent(testStructures));
      auto.addResource('p1', 'salvage', 2);
      assert.equal(auto.trade('p1', 'damage_booster'), null);
      assert.equal(auto.getResource('p1', 'salvage'), 2);
    });

    it('returns null for unknown trade', () => {
      const auto = new Automation(makeContent(testStructures));
      auto.addResource('p1', 'salvage', 100);
      assert.equal(auto.trade('p1', 'nonexistent'), null);
    });
  });

  describe('cell occupancy', () => {
    it('detects occupied cells', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 10);
      auto.build('p1', 'solar_panel', 1, 2);
      assert.equal(auto.isCellOccupied('p1', 1, 2), true);
      assert.equal(auto.isCellOccupied('p1', 0, 0), false);
    });

    it('isolates occupancy between players', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 10);
      auto.build('p1', 'solar_panel', 1, 1);
      assert.equal(auto.isCellOccupied('p2', 1, 1), false);
    });
  });

  describe('getPlacements', () => {
    it('returns all placements across structures', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 20);
      auto.build('p1', 'solar_panel', 0, 0);
      auto.build('p1', 'salvage_harvester', 1, 1);
      const placements = auto.getPlacements('p1');
      assert.equal(placements.length, 2);
      const types = placements.map(p => p.structureId).sort();
      assert.deepEqual(types, ['salvage_harvester', 'solar_panel']);
    });
  });

  describe('getStateForClient', () => {
    it('includes grid data with blocked cells and placements', () => {
      const auto = makeAutoWithGrid();
      auto.addResource('p1', 'salvage', 10);
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
      auto.addResource('p1', 'salvage', 100);
      auto.build('p1', 'solar_panel', 0, 0);
      const clientState = auto.getStateForClient('p1');
      assert.equal(clientState.stats.automationLevel, 1);
      assert.equal(clientState.stats.automationLevelName, 'Outpost');
      assert.equal(clientState.stats.totalStructures, 1);
    });

    it('marks locked structures with unlockLevel', () => {
      const structs = {
        ...testStructures,
        _automationLevels: [
          { name: 'Outpost', threshold: 1 },
        ],
      };
      const auto = new Automation(makeContent(structs));
      auto._gridConfig = { gridWidth: 5, gridHeight: 5, blockedSet: new Set() };
      const clientState = auto.getStateForClient('p1');
      const refinery = clientState.structures.find(s => s.id === 'silicon_refinery');
      assert.ok(refinery);
      assert.equal(refinery.locked, true);
      assert.equal(refinery.unlockLevel, 7);
    });

    it('includes siliconPerMinute and defenseRating in stats', () => {
      const auto = makeAutoWithGrid();
      const clientState = auto.getStateForClient('p1');
      assert.equal(clientState.stats.siliconPerMinute, 0);
      assert.equal(clientState.stats.defenseRating, 0);
    });
  });

  describe('getHarvesterEntities', () => {
    it('returns empty array with no harvesters', () => {
      const auto = makeAutoWithGrid();
      auto._gridConfig.dungeonOffsetX = 9;
      auto._gridConfig.dungeonOffsetY = 3;
      const entities = auto.getHarvesterEntities('p1');
      assert.deepEqual(entities, []);
    });

    it('returns entities at correct dungeon positions', () => {
      const auto = makeAutoWithGrid();
      auto._gridConfig.dungeonOffsetX = 9;
      auto._gridConfig.dungeonOffsetY = 3;
      auto.addResource('p1', 'salvage', 100);
      auto.build('p1', 'salvage_harvester', 2, 4);
      const entities = auto.getHarvesterEntities('p1');
      assert.equal(entities.length, 1);
      assert.equal(entities[0].type, 'scrap_drone');
      assert.equal(entities[0].name, 'Salvage Harvester');
      assert.equal(entities[0].decorative, true);
      // Grid (2,4) + offset (9,3) = dungeon (11,7), centered at (11.5*32, 7.5*32)
      assert.equal(entities[0].x, (11 + 0.5) * 32);
      assert.equal(entities[0].y, (7 + 0.5) * 32);
    });

    it('returns multiple entities for multiple placements', () => {
      const auto = makeAutoWithGrid();
      auto._gridConfig.dungeonOffsetX = 9;
      auto._gridConfig.dungeonOffsetY = 3;
      auto.addResource('p1', 'salvage', 100);
      auto.build('p1', 'salvage_harvester', 0, 0);
      auto.build('p1', 'salvage_harvester', 1, 1);
      const entities = auto.getHarvesterEntities('p1');
      assert.equal(entities.length, 2);
      assert.notEqual(entities[0].id, entities[1].id);
    });
  });

  describe('getAutomationLevel', () => {
    it('returns 0 with no structures', () => {
      const structs = {
        ...testStructures,
        _automationLevels: [{ name: 'Outpost', threshold: 1 }],
      };
      const auto = new Automation(makeContent(structs));
      assert.equal(auto.getAutomationLevel('p1'), 0);
    });

    it('returns correct level based on total structures', () => {
      const structs = {
        ...testStructures,
        _automationLevels: [
          { name: 'Outpost', threshold: 1 },
          { name: 'Depot', threshold: 3 },
        ],
      };
      const auto = new Automation(makeContent(structs));
      auto._gridConfig = { gridWidth: 5, gridHeight: 5, blockedSet: new Set() };
      auto.addResource('p1', 'salvage', 100);
      auto.build('p1', 'solar_panel', 0, 0);
      assert.equal(auto.getAutomationLevel('p1'), 1);
      auto.build('p1', 'solar_panel', 1, 0);
      auto.build('p1', 'solar_panel', 2, 0);
      assert.equal(auto.getAutomationLevel('p1'), 2);
    });
  });

  describe('getExpeditionCostReduction', () => {
    it('returns 0 with no beacons', () => {
      const auto = new Automation(makeContent(testStructures));
      assert.equal(auto.getExpeditionCostReduction('p1'), 0);
    });
  });

  describe('getDefenseRating', () => {
    it('returns 0 with no turrets', () => {
      const auto = new Automation(makeContent(testStructures));
      assert.equal(auto.getDefenseRating('p1'), 0);
    });
  });
});
