const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const EventBus = require('../../server/scripting/event-bus');

describe('EventBus', () => {
  it('calls listener when event is emitted', () => {
    const bus = new EventBus();
    let received = null;
    bus.on('test', (payload) => { received = payload; });
    bus.emit('test', { value: 42 });
    assert.deepEqual(received, { value: 42 });
  });

  it('supports multiple listeners on same event', () => {
    const bus = new EventBus();
    const calls = [];
    bus.on('test', () => calls.push('a'));
    bus.on('test', () => calls.push('b'));
    bus.emit('test', {});
    assert.deepEqual(calls, ['a', 'b']);
  });

  it('does not call listeners for other event types', () => {
    const bus = new EventBus();
    let called = false;
    bus.on('other', () => { called = true; });
    bus.emit('test', {});
    assert.equal(called, false);
  });

  it('does nothing when emitting event with no listeners', () => {
    const bus = new EventBus();
    bus.emit('nonexistent', {}); // should not throw
  });

  it('removes a specific listener with off()', () => {
    const bus = new EventBus();
    const calls = [];
    const listenerA = () => calls.push('a');
    const listenerB = () => calls.push('b');
    bus.on('test', listenerA);
    bus.on('test', listenerB);
    bus.off('test', listenerA);
    bus.emit('test', {});
    assert.deepEqual(calls, ['b']);
  });

  it('off() is safe for nonexistent event type', () => {
    const bus = new EventBus();
    bus.off('nonexistent', () => {}); // should not throw
  });

  it('off() is safe for nonexistent listener', () => {
    const bus = new EventBus();
    bus.on('test', () => {});
    bus.off('test', () => {}); // different function reference, should not throw
  });

  it('clear() removes all listeners', () => {
    const bus = new EventBus();
    let called = false;
    bus.on('a', () => { called = true; });
    bus.on('b', () => { called = true; });
    bus.clear();
    bus.emit('a', {});
    bus.emit('b', {});
    assert.equal(called, false);
  });

  it('passes correct payload to each listener', () => {
    const bus = new EventBus();
    const payloads = [];
    bus.on('test', (p) => payloads.push(p));
    bus.on('test', (p) => payloads.push(p));
    const data = { id: 'abc' };
    bus.emit('test', data);
    assert.equal(payloads.length, 2);
    assert.equal(payloads[0], data); // same reference
    assert.equal(payloads[1], data);
  });

  it('exports standard event type constants', () => {
    assert.equal(typeof EventBus.Events, 'object');
    assert.equal(EventBus.Events.ITEM_PICKED_UP, 'item_picked_up');
    assert.equal(EventBus.Events.MONSTER_KILLED, 'monster_killed');
    assert.equal(EventBus.Events.ROOM_ENTERED, 'room_entered');
  });
});
