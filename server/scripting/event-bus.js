// Event Bus - Lightweight server-side event emitter for game scripting.
//
// Events are emitted when game actions happen (item pickup, monster kill, etc.)
// and triggers subscribe to specific event types.

class EventBus {
  constructor() {
    // eventType -> [callback, ...]
    this.listeners = new Map();
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    const list = this.listeners.get(eventType);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit(eventType, payload) {
    const list = this.listeners.get(eventType);
    if (!list || list.length === 0) return;
    for (const cb of list) {
      cb(payload);
    }
  }

  clear() {
    this.listeners.clear();
  }
}

// Standard game event types
EventBus.Events = {
  ITEM_PICKED_UP:   'item_picked_up',
  MONSTER_KILLED:   'monster_killed',
  NPC_INTERACTED:   'npc_interacted',
  DOOR_INTERACTED:  'door_interacted',
  ROOM_ENTERED:     'room_entered',
  PLAYER_DEATH:     'player_death',
  FLAG_CHANGED:     'flag_changed',
  CHOICE_MADE:      'choice_made',
};

module.exports = EventBus;
