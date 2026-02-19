// Flag Store - Per-player and per-room key-value state for game scripting.
//
// Scopes:
//   "player" - Flags tied to a specific player, persist across room transitions
//   "room"   - Flags tied to a room instance, shared by all players in that room

class FlagStore {
  constructor() {
    // playerId -> { flagName: value }
    this.playerFlags = new Map();
    // roomId -> { flagName: value }
    this.roomFlags = new Map();
  }

  // --- Player flags ---

  ensurePlayer(playerId) {
    if (!this.playerFlags.has(playerId)) {
      this.playerFlags.set(playerId, {});
    }
  }

  getPlayerFlag(playerId, flag) {
    const flags = this.playerFlags.get(playerId);
    if (!flags) return undefined;
    return flags[flag];
  }

  setPlayerFlag(playerId, flag, value) {
    this.ensurePlayer(playerId);
    this.playerFlags.get(playerId)[flag] = value;
  }

  removePlayerFlag(playerId, flag) {
    const flags = this.playerFlags.get(playerId);
    if (flags) delete flags[flag];
  }

  getPlayerFlags(playerId) {
    return this.playerFlags.get(playerId) || {};
  }

  clearPlayer(playerId) {
    this.playerFlags.delete(playerId);
  }

  // --- Room flags ---

  ensureRoom(roomId) {
    if (!this.roomFlags.has(roomId)) {
      this.roomFlags.set(roomId, {});
    }
  }

  getRoomFlag(roomId, flag) {
    const flags = this.roomFlags.get(roomId);
    if (!flags) return undefined;
    return flags[flag];
  }

  setRoomFlag(roomId, flag, value) {
    this.ensureRoom(roomId);
    this.roomFlags.get(roomId)[flag] = value;
  }

  removeRoomFlag(roomId, flag) {
    const flags = this.roomFlags.get(roomId);
    if (flags) delete flags[flag];
  }

  getRoomFlags(roomId) {
    return this.roomFlags.get(roomId) || {};
  }

  clearRoom(roomId) {
    this.roomFlags.delete(roomId);
  }

  // --- Unified getter (used by condition evaluator) ---

  getFlag(playerId, roomId, flag, scope) {
    if (scope === 'room') {
      return this.getRoomFlag(roomId, flag);
    }
    // Default to player scope
    return this.getPlayerFlag(playerId, flag);
  }

  setFlag(playerId, roomId, flag, value, scope) {
    if (scope === 'room') {
      this.setRoomFlag(roomId, flag, value);
    } else {
      this.setPlayerFlag(playerId, flag, value);
    }
  }

  removeFlag(playerId, roomId, flag, scope) {
    if (scope === 'room') {
      this.removeRoomFlag(roomId, flag);
    } else {
      this.removePlayerFlag(playerId, flag);
    }
  }
}

module.exports = FlagStore;
