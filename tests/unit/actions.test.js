const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const FlagStore = require('../../server/scripting/flag-store');
const EventBus = require('../../server/scripting/event-bus');
const ActionExecutor = require('../../server/scripting/actions');
const CONSTANTS = require('../../shared/constants');

// Minimal content mock
function makeContent() {
  const items = {
    health_potion: { name: 'Health Potion', type: 'consumable', rarity: 'common' },
    iron_key: { name: 'Iron Key', type: 'key', rarity: 'common' },
    sol_blade: { name: 'Sol Blade', type: 'weapon', slot: 'arms', rarity: 'rare', stats: { damage: 10 } },
    medical_supplies: { name: 'Medical Supplies', type: 'consumable', rarity: 'common' },
    silicon: { name: 'Silicon', type: 'resource', rarity: 'common' },
  };
  const npcs = {
    old_keeper: { name: 'Old Keeper', dialogue: 'Hello.', dialogues: null, dialogueRules: null },
  };
  const tilesets = {
    default: {
      tiles: {
        '0': { solid: false },
        '1': { solid: true },
        '5': { solid: true, togglesTo: 0 },
        '6': { solid: false, togglesTo: 5 },
      },
    },
  };
  const lootTables = {
    test_table: {
      rolls: [
        { item: 'health_potion', weight: 1 },
      ],
    },
  };
  return {
    getItem: (type) => items[type] || null,
    getNPC: (type) => npcs[type] || null,
    getTileset: (name) => tilesets[name] || null,
    getLootTable: (name) => lootTables[name] || null,
  };
}

function makeRoom() {
  return {
    npcs: new Map(),
    monsters: new Map(),
    items: new Map(),
    nextItemId: 1,
    dungeon: {
      width: 5,
      height: 5,
      tileset: 'default',
      data: new Array(25).fill(0),
    },
  };
}

function makePlayer() {
  return {
    inventory: [],
    equipment: {},
    medipacCharges: 0,
    abilities: [],
    cooldowns: {},
    solGrid: null,
    energy: 50,
    maxEnergy: 100,
    x: 64,
    y: 64,
  };
}

function makeContext(room, player) {
  return {
    playerId: 'p1',
    roomId: 'r1',
    room: room || makeRoom(),
    player: player || makePlayer(),
  };
}

describe('ActionExecutor', () => {
  let flagStore, eventBus, content, executor;

  beforeEach(() => {
    flagStore = new FlagStore();
    eventBus = new EventBus();
    content = makeContent();
    executor = new ActionExecutor(flagStore, eventBus, content);
  });

  describe('executeAll', () => {
    it('does nothing for null/undefined actions', () => {
      executor.executeAll(null, makeContext());
      executor.executeAll(undefined, makeContext());
    });

    it('executes multiple actions', () => {
      const ctx = makeContext();
      executor.executeAll([
        { type: 'setFlag', flag: 'a', value: 1 },
        { type: 'setFlag', flag: 'b', value: 2 },
      ], ctx);
      assert.equal(flagStore.getPlayerFlag('p1', 'a'), 1);
      assert.equal(flagStore.getPlayerFlag('p1', 'b'), 2);
    });
  });

  describe('execute', () => {
    it('does nothing for null action', () => {
      executor.execute(null, makeContext());
    });

    it('does nothing for action without type', () => {
      executor.execute({}, makeContext());
    });
  });

  describe('setFlag', () => {
    it('sets a player flag with default scope', () => {
      executor.execute({ type: 'setFlag', flag: 'quest_started', value: true }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'quest_started'), true);
    });

    it('defaults value to true when omitted', () => {
      executor.execute({ type: 'setFlag', flag: 'visited' }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'visited'), true);
    });

    it('sets a room flag when scope is room', () => {
      executor.execute({ type: 'setFlag', flag: 'doorOpen', value: true, scope: 'room' }, makeContext());
      assert.equal(flagStore.getRoomFlag('r1', 'doorOpen'), true);
      assert.equal(flagStore.getPlayerFlag('p1', 'doorOpen'), undefined);
    });

    it('emits flag_changed event', () => {
      let emitted = null;
      eventBus.on('flag_changed', (payload) => { emitted = payload; });
      executor.execute({ type: 'setFlag', flag: 'x', value: 42 }, makeContext());
      assert.deepEqual(emitted, {
        playerId: 'p1', roomId: 'r1', flag: 'x', value: 42, scope: 'player',
      });
    });
  });

  describe('removeFlag', () => {
    it('removes a player flag', () => {
      flagStore.setPlayerFlag('p1', 'temp', true);
      executor.execute({ type: 'removeFlag', flag: 'temp' }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'temp'), undefined);
    });

    it('removes a room flag', () => {
      flagStore.setRoomFlag('r1', 'temp', true);
      executor.execute({ type: 'removeFlag', flag: 'temp', scope: 'room' }, makeContext());
      assert.equal(flagStore.getRoomFlag('r1', 'temp'), undefined);
    });
  });

  describe('incrementFlag', () => {
    it('increments from 0 by default', () => {
      executor.execute({ type: 'incrementFlag', flag: 'kills' }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'kills'), 1);
    });

    it('increments existing value', () => {
      flagStore.setPlayerFlag('p1', 'kills', 5);
      executor.execute({ type: 'incrementFlag', flag: 'kills', amount: 3 }, makeContext());
      assert.equal(flagStore.getPlayerFlag('p1', 'kills'), 8);
    });

    it('emits flag_changed event with new value', () => {
      let emitted = null;
      eventBus.on('flag_changed', (payload) => { emitted = payload; });
      flagStore.setPlayerFlag('p1', 'score', 10);
      executor.execute({ type: 'incrementFlag', flag: 'score', amount: 5 }, makeContext());
      assert.equal(emitted.value, 15);
    });
  });

  describe('setDialogue', () => {
    it('updates active dialogue on matching NPC', () => {
      const room = makeRoom();
      room.npcs.set('npc_0', { type: 'old_keeper', activeDialogueId: null });
      const ctx = makeContext(room);
      executor.execute({ type: 'setDialogue', npc: 'old_keeper', dialogueId: 'post_quest' }, ctx);
      assert.equal(room.npcs.get('npc_0').activeDialogueId, 'post_quest');
    });

    it('does nothing when no matching NPC', () => {
      const room = makeRoom();
      room.npcs.set('npc_0', { type: 'guard', activeDialogueId: null });
      executor.execute({ type: 'setDialogue', npc: 'old_keeper', dialogueId: 'x' }, makeContext(room));
      assert.equal(room.npcs.get('npc_0').activeDialogueId, null);
    });

    it('does nothing when no room', () => {
      const ctx = { playerId: 'p1', roomId: 'r1', room: null, player: makePlayer() };
      executor.execute({ type: 'setDialogue', npc: 'old_keeper', dialogueId: 'x' }, ctx);
    });
  });

  describe('removeEntity', () => {
    it('removes NPC by entityId', () => {
      const room = makeRoom();
      room.npcs.set('npc_0', { type: 'guard' });
      executor.execute({ type: 'removeEntity', entityType: 'npc', entityId: 'npc_0' }, makeContext(room));
      assert.equal(room.npcs.size, 0);
    });

    it('removes NPC by npcType', () => {
      const room = makeRoom();
      room.npcs.set('npc_0', { type: 'guard' });
      room.npcs.set('npc_1', { type: 'merchant' });
      executor.execute({ type: 'removeEntity', entityType: 'npc', npcType: 'guard' }, makeContext(room));
      assert.equal(room.npcs.size, 1);
      assert.equal(room.npcs.has('npc_1'), true);
    });

    it('removes monster by entityId', () => {
      const room = makeRoom();
      room.monsters.set('mob_0', { type: 'rat' });
      executor.execute({ type: 'removeEntity', entityType: 'monster', entityId: 'mob_0' }, makeContext(room));
      assert.equal(room.monsters.size, 0);
    });

    it('removes monster by monsterType', () => {
      const room = makeRoom();
      room.monsters.set('mob_0', { type: 'rat' });
      executor.execute({ type: 'removeEntity', entityType: 'monster', monsterType: 'rat' }, makeContext(room));
      assert.equal(room.monsters.size, 0);
    });

    it('removes item by entityId', () => {
      const room = makeRoom();
      room.items.set('item_0', { type: 'health_potion' });
      executor.execute({ type: 'removeEntity', entityType: 'item', entityId: 'item_0' }, makeContext(room));
      assert.equal(room.items.size, 0);
    });

    it('removes item by itemType', () => {
      const room = makeRoom();
      room.items.set('item_0', { type: 'health_potion' });
      executor.execute({ type: 'removeEntity', entityType: 'item', itemType: 'health_potion' }, makeContext(room));
      assert.equal(room.items.size, 0);
    });
  });

  describe('spawnItem', () => {
    it('spawns item at explicit tile coords', () => {
      const room = makeRoom();
      executor.execute({ type: 'spawnItem', itemType: 'health_potion', x: 2, y: 3 }, makeContext(room));
      assert.equal(room.items.size, 1);
      const item = room.items.get('item_1');
      assert.equal(item.type, 'health_potion');
      assert.equal(item.x, (2 + 0.5) * CONSTANTS.TILE_SIZE);
      assert.equal(item.y, (3 + 0.5) * CONSTANTS.TILE_SIZE);
    });

    it('spawns item at monster death position from eventPayload', () => {
      const room = makeRoom();
      const ctx = { ...makeContext(room), eventPayload: { monsterX: 100, monsterY: 200 } };
      executor.execute({ type: 'spawnItem', itemType: 'health_potion' }, ctx);
      const item = room.items.get('item_1');
      assert.equal(item.x, 100);
      assert.equal(item.y, 200);
    });

    it('falls back to player position', () => {
      const room = makeRoom();
      const player = makePlayer();
      player.x = 150;
      player.y = 250;
      executor.execute({ type: 'spawnItem', itemType: 'health_potion' }, makeContext(room, player));
      const item = room.items.get('item_1');
      assert.equal(item.x, 150);
      assert.equal(item.y, 250);
    });

    it('does nothing for unknown item type', () => {
      const room = makeRoom();
      executor.execute({ type: 'spawnItem', itemType: 'nonexistent' }, makeContext(room));
      assert.equal(room.items.size, 0);
    });

    it('increments nextItemId', () => {
      const room = makeRoom();
      executor.execute({ type: 'spawnItem', itemType: 'health_potion', x: 0, y: 0 }, makeContext(room));
      executor.execute({ type: 'spawnItem', itemType: 'iron_key', x: 1, y: 1 }, makeContext(room));
      assert.equal(room.items.size, 2);
      assert.equal(room.nextItemId, 3);
    });
  });

  describe('giveItem', () => {
    it('adds item to player inventory', () => {
      const player = makePlayer();
      executor.execute({ type: 'giveItem', itemType: 'iron_key' }, makeContext(undefined, player));
      assert.equal(player.inventory.length, 1);
      assert.equal(player.inventory[0].type, 'iron_key');
      assert.equal(player.inventory[0].name, 'Iron Key');
    });

    it('gives multiple items with count', () => {
      const player = makePlayer();
      executor.execute({ type: 'giveItem', itemType: 'health_potion', count: 3 }, makeContext(undefined, player));
      assert.equal(player.inventory.length, 3);
    });

    it('adds medical_supplies to medipacCharges instead of inventory', () => {
      const player = makePlayer();
      executor.execute({ type: 'giveItem', itemType: 'medical_supplies', count: 2 }, makeContext(undefined, player));
      assert.equal(player.medipacCharges, 2);
      assert.equal(player.inventory.length, 0);
    });

    it('sends inventory message via sendToPlayer', () => {
      const player = makePlayer();
      let sent = null;
      executor.sendToPlayer = (pid, msg) => { sent = { pid, msg }; };
      executor.execute({ type: 'giveItem', itemType: 'iron_key' }, makeContext(undefined, player));
      assert.equal(sent.pid, 'p1');
      assert.equal(sent.msg.type, CONSTANTS.MSG.INVENTORY);
    });

    it('does nothing for unknown item type', () => {
      const player = makePlayer();
      executor.execute({ type: 'giveItem', itemType: 'nonexistent' }, makeContext(undefined, player));
      assert.equal(player.inventory.length, 0);
    });
  });

  describe('removeItem', () => {
    it('removes item from inventory', () => {
      const player = makePlayer();
      player.inventory.push({ type: 'iron_key', name: 'Iron Key' });
      executor.execute({ type: 'removeItem', itemType: 'iron_key' }, makeContext(undefined, player));
      assert.equal(player.inventory.length, 0);
    });

    it('removes only first matching item', () => {
      const player = makePlayer();
      player.inventory.push({ type: 'health_potion' }, { type: 'health_potion' });
      executor.execute({ type: 'removeItem', itemType: 'health_potion' }, makeContext(undefined, player));
      assert.equal(player.inventory.length, 1);
    });

    it('decrements medipacCharges for medical_supplies', () => {
      const player = makePlayer();
      player.medipacCharges = 3;
      executor.execute({ type: 'removeItem', itemType: 'medical_supplies' }, makeContext(undefined, player));
      assert.equal(player.medipacCharges, 2);
    });

    it('does not go below 0 for medical_supplies', () => {
      const player = makePlayer();
      player.medipacCharges = 0;
      executor.execute({ type: 'removeItem', itemType: 'medical_supplies' }, makeContext(undefined, player));
      assert.equal(player.medipacCharges, 0);
    });
  });

  describe('equipItem', () => {
    it('equips item from inventory', () => {
      const player = makePlayer();
      player.inventory.push({ type: 'sol_blade', name: 'Sol Blade', rarity: 'rare', category: 'weapon' });
      executor.execute({ type: 'equipItem', itemType: 'sol_blade' }, makeContext(undefined, player));
      assert.equal(player.inventory.length, 0);
      assert.equal(player.equipment.arms.type, 'sol_blade');
    });

    it('swaps existing equipment back to inventory', () => {
      const player = makePlayer();
      player.equipment.arms = { type: 'old_sword', name: 'Old Sword', rarity: 'common' };
      player.inventory.push({ type: 'sol_blade', name: 'Sol Blade', rarity: 'rare', category: 'weapon' });
      executor.execute({ type: 'equipItem', itemType: 'sol_blade' }, makeContext(undefined, player));
      assert.equal(player.equipment.arms.type, 'sol_blade');
      assert.equal(player.inventory.length, 1);
      assert.equal(player.inventory[0].type, 'old_sword');
    });

    it('does nothing if item not in inventory', () => {
      const player = makePlayer();
      executor.execute({ type: 'equipItem', itemType: 'sol_blade' }, makeContext(undefined, player));
      assert.equal(player.equipment.arms, undefined);
    });
  });

  describe('showMessage', () => {
    it('sends dialogue message to player', () => {
      let sent = null;
      executor.sendToPlayer = (pid, msg) => { sent = msg; };
      executor.execute({ type: 'showMessage', text: 'Hello world' }, makeContext());
      assert.equal(sent.type, CONSTANTS.MSG.DIALOGUE);
      assert.equal(sent.dialogue[0].text, 'Hello world');
    });

    it('supports lines array', () => {
      let sent = null;
      executor.sendToPlayer = (pid, msg) => { sent = msg; };
      executor.execute({ type: 'showMessage', lines: ['Line 1', 'Line 2'] }, makeContext());
      assert.equal(sent.dialogue.length, 2);
      assert.equal(sent.dialogue[0].text, 'Line 1');
      assert.equal(sent.dialogue[1].text, 'Line 2');
    });

    it('does nothing without sendToPlayer', () => {
      executor.execute({ type: 'showMessage', text: 'test' }, makeContext());
    });
  });

  describe('setEnergy', () => {
    it('sets energy by absolute value', () => {
      const player = makePlayer();
      executor.execute({ type: 'setEnergy', value: 75 }, makeContext(undefined, player));
      assert.equal(player.energy, 75);
    });

    it('clamps to maxEnergy', () => {
      const player = makePlayer();
      executor.execute({ type: 'setEnergy', value: 200 }, makeContext(undefined, player));
      assert.equal(player.energy, 100);
    });

    it('sets energy by percent', () => {
      const player = makePlayer();
      executor.execute({ type: 'setEnergy', percent: 50 }, makeContext(undefined, player));
      assert.equal(player.energy, 50);
    });

    it('does nothing when maxEnergy is 0', () => {
      const player = makePlayer();
      player.maxEnergy = 0;
      player.energy = 0;
      executor.execute({ type: 'setEnergy', value: 50 }, makeContext(undefined, player));
      assert.equal(player.energy, 0);
    });
  });

  describe('grantXp', () => {
    it('calls _onGrantXp callback', () => {
      let called = null;
      executor._onGrantXp = (player, amount, room) => { called = { player, amount }; };
      const player = makePlayer();
      executor.execute({ type: 'grantXp', amount: 50 }, makeContext(undefined, player));
      assert.equal(called.amount, 50);
    });

    it('does nothing with 0 amount', () => {
      let called = false;
      executor._onGrantXp = () => { called = true; };
      executor.execute({ type: 'grantXp', amount: 0 }, makeContext());
      assert.equal(called, false);
    });
  });

  describe('toggleTile', () => {
    it('toggles tile to its togglesTo value', () => {
      const room = makeRoom();
      room.dungeon.data[3 * 5 + 2] = 5; // tile 5 at (2,3)
      let broadcast = null;
      executor.broadcastToRoom = (rid, msg) => { broadcast = msg; };
      executor.execute({ type: 'toggleTile', x: 2, y: 3 }, makeContext(room));
      assert.equal(room.dungeon.data[3 * 5 + 2], 0);
      assert.equal(broadcast.type, CONSTANTS.MSG.DOOR_TOGGLE);
      assert.equal(broadcast.tileId, 0);
    });

    it('does nothing when tile has no togglesTo', () => {
      const room = makeRoom();
      room.dungeon.data[0] = 0; // tile 0 has no togglesTo
      executor.execute({ type: 'toggleTile', x: 0, y: 0 }, makeContext(room));
      assert.equal(room.dungeon.data[0], 0);
    });
  });

  describe('setTile', () => {
    it('sets tile directly and broadcasts', () => {
      const room = makeRoom();
      let broadcast = null;
      executor.broadcastToRoom = (rid, msg) => { broadcast = msg; };
      executor.execute({ type: 'setTile', x: 1, y: 2, tileId: 5 }, makeContext(room));
      assert.equal(room.dungeon.data[2 * 5 + 1], 5);
      assert.equal(broadcast.tileId, 5);
    });
  });

  describe('showChoice', () => {
    it('sends choice menu to player', () => {
      let sent = null;
      executor.sendToPlayer = (pid, msg) => { sent = msg; };
      const options = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }];
      executor.execute({ type: 'showChoice', choiceId: 'test', prompt: 'Pick one', options }, makeContext());
      assert.equal(sent.type, CONSTANTS.MSG.CHOICE_MENU);
      assert.equal(sent.choiceId, 'test');
      assert.equal(sent.options.length, 2);
    });
  });

  describe('setQuestObjective', () => {
    it('sets quest objective on player', () => {
      const player = makePlayer();
      executor.execute({ type: 'setQuestObjective', label: 'Find the key', roomId: 'r2', tileX: 3, tileY: 4 }, makeContext(undefined, player));
      assert.deepEqual(player.questObjective, { label: 'Find the key', roomId: 'r2', tileX: 3, tileY: 4 });
    });
  });

  describe('clearQuestObjective', () => {
    it('clears quest objective on player', () => {
      const player = makePlayer();
      player.questObjective = { label: 'test' };
      let sent = null;
      executor.sendToPlayer = (pid, msg) => { sent = msg; };
      executor.execute({ type: 'clearQuestObjective' }, makeContext(undefined, player));
      assert.equal(player.questObjective, null);
      assert.equal(sent.type, CONSTANTS.MSG.QUEST_OBJECTIVE);
    });
  });

  describe('spawnNpc', () => {
    it('spawns NPC at tile coords', () => {
      const room = makeRoom();
      executor.execute({ type: 'spawnNpc', npcType: 'old_keeper', x: 2, y: 3 }, makeContext(room));
      assert.equal(room.npcs.size, 1);
      const npc = [...room.npcs.values()][0];
      assert.equal(npc.type, 'old_keeper');
      assert.equal(npc.name, 'Old Keeper');
      assert.equal(npc.x, (2 + 0.5) * CONSTANTS.TILE_SIZE);
    });

    it('does not spawn duplicate NPC of same type', () => {
      const room = makeRoom();
      room.npcs.set('existing', { type: 'old_keeper' });
      executor.execute({ type: 'spawnNpc', npcType: 'old_keeper', x: 2, y: 3 }, makeContext(room));
      assert.equal(room.npcs.size, 1);
    });

    it('does nothing for unknown NPC type', () => {
      const room = makeRoom();
      executor.execute({ type: 'spawnNpc', npcType: 'nonexistent', x: 0, y: 0 }, makeContext(room));
      assert.equal(room.npcs.size, 0);
    });
  });

  describe('rollLootTable', () => {
    it('spawns item from loot table', () => {
      const room = makeRoom();
      executor.execute({ type: 'rollLootTable', lootTable: 'test_table', x: 1, y: 1 }, makeContext(room));
      assert.equal(room.items.size, 1);
      const item = [...room.items.values()][0];
      assert.equal(item.type, 'health_potion');
    });

    it('does nothing for unknown loot table', () => {
      const room = makeRoom();
      executor.execute({ type: 'rollLootTable', lootTable: 'nonexistent' }, makeContext(room));
      assert.equal(room.items.size, 0);
    });
  });

  describe('giveStructure', () => {
    it('calls automation.grantStructure', () => {
      let granted = null;
      executor.automation = {
        grantStructure: (pid, sid) => { granted = { pid, sid }; return true; },
        getStateForClient: () => ({}),
      };
      executor.sendToPlayer = () => {};
      executor.execute({ type: 'giveStructure', structureId: 'solar_panel' }, makeContext());
      assert.equal(granted.structureId, undefined);
      assert.equal(granted.sid, 'solar_panel');
    });

    it('does nothing without automation', () => {
      executor.execute({ type: 'giveStructure', structureId: 'solar_panel' }, makeContext());
    });
  });

  describe('openAutomation', () => {
    it('sends AUTO_STATE with openScreen', () => {
      let sent = null;
      executor.automation = { getStateForClient: () => ({ structures: [] }) };
      executor.sendToPlayer = (pid, msg) => { sent = msg; };
      executor.execute({ type: 'openAutomation' }, makeContext());
      assert.equal(sent.type, CONSTANTS.MSG.AUTO_STATE);
      assert.equal(sent.openScreen, true);
    });
  });

  describe('unknown action type', () => {
    it('does not throw', () => {
      executor.execute({ type: 'totally_unknown' }, makeContext());
    });
  });
});
