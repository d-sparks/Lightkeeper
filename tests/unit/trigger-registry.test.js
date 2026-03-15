const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const FlagStore = require('../../server/scripting/flag-store');
const EventBus = require('../../server/scripting/event-bus');
const ConditionEvaluator = require('../../server/scripting/conditions');
const ActionExecutor = require('../../server/scripting/actions');
const TriggerRegistry = require('../../server/scripting/trigger-registry');

function makeContent() {
  return {
    getItem: () => null,
    getNPC: () => null,
    getTileset: () => null,
    getLootTable: () => null,
  };
}

describe('TriggerRegistry', () => {
  let flagStore, eventBus, conditions, actions, registry;

  beforeEach(() => {
    flagStore = new FlagStore();
    eventBus = new EventBus();
    conditions = new ConditionEvaluator(flagStore);
    actions = new ActionExecutor(flagStore, eventBus, makeContent());
    registry = new TriggerRegistry(eventBus, conditions, actions, flagStore);
  });

  function makeContext(overrides) {
    return {
      playerId: 'p1',
      roomId: 'r1',
      room: { npcs: new Map(), monsters: new Map(), items: new Map() },
      player: { inventory: [], medipacCharges: 0 },
      ...overrides,
    };
  }

  describe('loadRoomTriggers / unloadRoom', () => {
    it('stores triggers for a room', () => {
      const dungeon = { triggers: [{ id: 't1', event: 'test' }] };
      registry.loadRoomTriggers('r1', dungeon);
      assert.equal(registry.roomTriggers.has('r1'), true);
    });

    it('handles dungeon with no triggers', () => {
      registry.loadRoomTriggers('r1', {});
      assert.deepEqual(registry.roomTriggers.get('r1'), []);
    });

    it('unloadRoom removes triggers', () => {
      registry.loadRoomTriggers('r1', { triggers: [{ id: 't1', event: 'test' }] });
      registry.unloadRoom('r1');
      assert.equal(registry.roomTriggers.has('r1'), false);
    });
  });

  describe('event type matching', () => {
    it('fires trigger when event type matches', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'on_pickup',
          event: 'item_picked_up',
          actions: [{ type: 'setFlag', flag: 'picked_up' }],
        }],
      });
      registry.processEvent('item_picked_up', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'picked_up'), true);
    });

    it('does not fire trigger when event type differs', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'on_pickup',
          event: 'item_picked_up',
          actions: [{ type: 'setFlag', flag: 'picked_up' }],
        }],
      });
      registry.processEvent('monster_killed', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'picked_up'), undefined);
    });

    it('does nothing when room has no triggers loaded', () => {
      registry.processEvent('item_picked_up', {}, makeContext());
      // Should not throw
    });
  });

  describe('payload filtering', () => {
    it('fires when filter matches payload', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'crystal',
          event: 'item_picked_up',
          filter: { itemType: 'crystal_shard' },
          actions: [{ type: 'setFlag', flag: 'found_crystal' }],
        }],
      });
      registry.processEvent('item_picked_up', { itemType: 'crystal_shard' }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'found_crystal'), true);
    });

    it('does not fire when filter does not match', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'crystal',
          event: 'item_picked_up',
          filter: { itemType: 'crystal_shard' },
          actions: [{ type: 'setFlag', flag: 'found_crystal' }],
        }],
      });
      registry.processEvent('item_picked_up', { itemType: 'bandage' }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'found_crystal'), undefined);
    });

    it('checks all filter keys', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'specific',
          event: 'monster_killed',
          filter: { monsterType: 'boss', zoneId: 'arena' },
          actions: [{ type: 'setFlag', flag: 'boss_killed' }],
        }],
      });
      // Only one filter key matches
      registry.processEvent('monster_killed', { monsterType: 'boss', zoneId: 'hallway' }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'boss_killed'), undefined);
      // Both match
      registry.processEvent('monster_killed', { monsterType: 'boss', zoneId: 'arena' }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'boss_killed'), true);
    });
  });

  describe('condition gating', () => {
    it('fires when conditions pass', () => {
      flagStore.setPlayerFlag('p1', 'hasKey', true);
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'gated',
          event: 'door_interacted',
          conditions: [{ hasFlag: 'hasKey' }],
          actions: [{ type: 'setFlag', flag: 'door_opened' }],
        }],
      });
      registry.processEvent('door_interacted', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'door_opened'), true);
    });

    it('does not fire when conditions fail', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'gated',
          event: 'door_interacted',
          conditions: [{ hasFlag: 'hasKey' }],
          actions: [{ type: 'setFlag', flag: 'door_opened' }],
        }],
      });
      registry.processEvent('door_interacted', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'door_opened'), undefined);
    });

    it('fires without conditions field', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'always',
          event: 'room_entered',
          actions: [{ type: 'setFlag', flag: 'entered' }],
        }],
      });
      registry.processEvent('room_entered', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'entered'), true);
    });

    it('fires with empty conditions array', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'empty_cond',
          event: 'room_entered',
          conditions: [],
          actions: [{ type: 'setFlag', flag: 'entered' }],
        }],
      });
      registry.processEvent('room_entered', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'entered'), true);
    });
  });

  describe('once flag', () => {
    it('fires only once per player', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'intro',
          event: 'room_entered',
          once: true,
          actions: [{ type: 'incrementFlag', flag: 'enter_count' }],
        }],
      });
      registry.processEvent('room_entered', {}, makeContext());
      registry.processEvent('room_entered', {}, makeContext());
      registry.processEvent('room_entered', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'enter_count'), 1);
    });

    it('fires independently per player', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'intro',
          event: 'room_entered',
          once: true,
          actions: [{ type: 'incrementFlag', flag: 'enter_count' }],
        }],
      });
      registry.processEvent('room_entered', {}, makeContext());
      registry.processEvent('room_entered', {}, makeContext({ playerId: 'p2' }));
      assert.equal(flagStore.getPlayerFlag('p1', 'enter_count'), 1);
      assert.equal(flagStore.getPlayerFlag('p2', 'enter_count'), 1);
    });

    it('non-once trigger fires every time', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'repeating',
          event: 'room_entered',
          actions: [{ type: 'incrementFlag', flag: 'enter_count' }],
        }],
      });
      registry.processEvent('room_entered', {}, makeContext());
      registry.processEvent('room_entered', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'enter_count'), 2);
    });
  });

  describe('multiple triggers', () => {
    it('fires multiple matching triggers in order', () => {
      registry.loadRoomTriggers('r1', {
        triggers: [
          {
            id: 't1',
            event: 'room_entered',
            actions: [{ type: 'setFlag', flag: 'first' }],
          },
          {
            id: 't2',
            event: 'room_entered',
            actions: [{ type: 'setFlag', flag: 'second' }],
          },
          {
            id: 't3',
            event: 'monster_killed',
            actions: [{ type: 'setFlag', flag: 'third' }],
          },
        ],
      });
      registry.processEvent('room_entered', {}, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'first'), true);
      assert.equal(flagStore.getPlayerFlag('p1', 'second'), true);
      assert.equal(flagStore.getPlayerFlag('p1', 'third'), undefined);
    });
  });

  describe('eventPayload passed to actions', () => {
    it('actions receive eventPayload in context', () => {
      let receivedContext = null;
      const origExecuteAll = actions.executeAll.bind(actions);
      actions.executeAll = (acts, ctx) => { receivedContext = ctx; origExecuteAll(acts, ctx); };

      registry.loadRoomTriggers('r1', {
        triggers: [{
          id: 'loot',
          event: 'monster_killed',
          actions: [{ type: 'setFlag', flag: 'killed' }],
        }],
      });
      registry.processEvent('monster_killed', { monsterX: 100, monsterY: 200 }, makeContext());
      assert.equal(receivedContext.eventPayload.monsterX, 100);
      assert.equal(receivedContext.eventPayload.monsterY, 200);
    });
  });
});
