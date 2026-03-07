const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const FlagStore = require('../../server/scripting/flag-store');

describe('FlagStore', () => {
  describe('player flags', () => {
    it('returns undefined for unset flags', () => {
      const store = new FlagStore();
      assert.equal(store.getPlayerFlag('p1', 'someFlag'), undefined);
    });

    it('sets and gets a flag', () => {
      const store = new FlagStore();
      store.setPlayerFlag('p1', 'hasKey', true);
      assert.equal(store.getPlayerFlag('p1', 'hasKey'), true);
    });

    it('stores different values per player', () => {
      const store = new FlagStore();
      store.setPlayerFlag('p1', 'score', 10);
      store.setPlayerFlag('p2', 'score', 20);
      assert.equal(store.getPlayerFlag('p1', 'score'), 10);
      assert.equal(store.getPlayerFlag('p2', 'score'), 20);
    });

    it('overwrites existing flag value', () => {
      const store = new FlagStore();
      store.setPlayerFlag('p1', 'level', 1);
      store.setPlayerFlag('p1', 'level', 5);
      assert.equal(store.getPlayerFlag('p1', 'level'), 5);
    });

    it('removes a flag', () => {
      const store = new FlagStore();
      store.setPlayerFlag('p1', 'temp', true);
      store.removePlayerFlag('p1', 'temp');
      assert.equal(store.getPlayerFlag('p1', 'temp'), undefined);
    });

    it('removePlayerFlag is safe on nonexistent player', () => {
      const store = new FlagStore();
      store.removePlayerFlag('nobody', 'flag'); // should not throw
    });

    it('getPlayerFlags returns all flags as object', () => {
      const store = new FlagStore();
      store.setPlayerFlag('p1', 'a', 1);
      store.setPlayerFlag('p1', 'b', 2);
      assert.deepEqual(store.getPlayerFlags('p1'), { a: 1, b: 2 });
    });

    it('getPlayerFlags returns empty object for unknown player', () => {
      const store = new FlagStore();
      assert.deepEqual(store.getPlayerFlags('unknown'), {});
    });

    it('clearPlayer removes all flags for a player', () => {
      const store = new FlagStore();
      store.setPlayerFlag('p1', 'a', 1);
      store.setPlayerFlag('p1', 'b', 2);
      store.clearPlayer('p1');
      assert.equal(store.getPlayerFlag('p1', 'a'), undefined);
      assert.equal(store.getPlayerFlag('p1', 'b'), undefined);
    });

    it('clearPlayer does not affect other players', () => {
      const store = new FlagStore();
      store.setPlayerFlag('p1', 'x', 1);
      store.setPlayerFlag('p2', 'x', 2);
      store.clearPlayer('p1');
      assert.equal(store.getPlayerFlag('p2', 'x'), 2);
    });
  });

  describe('room flags', () => {
    it('returns undefined for unset room flags', () => {
      const store = new FlagStore();
      assert.equal(store.getRoomFlag('r1', 'someFlag'), undefined);
    });

    it('sets and gets a room flag', () => {
      const store = new FlagStore();
      store.setRoomFlag('r1', 'doorOpen', true);
      assert.equal(store.getRoomFlag('r1', 'doorOpen'), true);
    });

    it('isolates flags between rooms', () => {
      const store = new FlagStore();
      store.setRoomFlag('r1', 'cleared', true);
      store.setRoomFlag('r2', 'cleared', false);
      assert.equal(store.getRoomFlag('r1', 'cleared'), true);
      assert.equal(store.getRoomFlag('r2', 'cleared'), false);
    });

    it('removes a room flag', () => {
      const store = new FlagStore();
      store.setRoomFlag('r1', 'temp', true);
      store.removeRoomFlag('r1', 'temp');
      assert.equal(store.getRoomFlag('r1', 'temp'), undefined);
    });

    it('getRoomFlags returns all room flags', () => {
      const store = new FlagStore();
      store.setRoomFlag('r1', 'a', 1);
      store.setRoomFlag('r1', 'b', 2);
      assert.deepEqual(store.getRoomFlags('r1'), { a: 1, b: 2 });
    });

    it('clearRoom removes all flags for a room', () => {
      const store = new FlagStore();
      store.setRoomFlag('r1', 'a', 1);
      store.clearRoom('r1');
      assert.equal(store.getRoomFlag('r1', 'a'), undefined);
    });
  });

  describe('unified getFlag/setFlag/removeFlag', () => {
    it('defaults to player scope', () => {
      const store = new FlagStore();
      store.setFlag('p1', 'r1', 'key', true);
      assert.equal(store.getFlag('p1', 'r1', 'key'), true);
      assert.equal(store.getPlayerFlag('p1', 'key'), true);
    });

    it('uses room scope when specified', () => {
      const store = new FlagStore();
      store.setFlag('p1', 'r1', 'doorOpen', true, 'room');
      assert.equal(store.getFlag('p1', 'r1', 'doorOpen', 'room'), true);
      assert.equal(store.getRoomFlag('r1', 'doorOpen'), true);
      // Should not be set on player
      assert.equal(store.getPlayerFlag('p1', 'doorOpen'), undefined);
    });

    it('removeFlag works with player scope', () => {
      const store = new FlagStore();
      store.setFlag('p1', 'r1', 'temp', true);
      store.removeFlag('p1', 'r1', 'temp');
      assert.equal(store.getFlag('p1', 'r1', 'temp'), undefined);
    });

    it('removeFlag works with room scope', () => {
      const store = new FlagStore();
      store.setFlag('p1', 'r1', 'temp', true, 'room');
      store.removeFlag('p1', 'r1', 'temp', 'room');
      assert.equal(store.getFlag('p1', 'r1', 'temp', 'room'), undefined);
    });
  });
});
