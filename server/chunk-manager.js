const CONSTANTS = require('../shared/constants');
const CHUNK_SIZE = CONSTANTS.CHUNK_SIZE;
const TILE_SIZE = CONSTANTS.TILE_SIZE;

class ChunkManager {
  constructor() {
    // Map<playerId, Map<roomId, Set<string>>> - tracks which chunks have been sent
    this.playerChunks = new Map();
  }

  // Get chunk grid dimensions for a dungeon
  getChunkDims(dungeon) {
    return {
      cols: Math.ceil(dungeon.width / CHUNK_SIZE),
      rows: Math.ceil(dungeon.height / CHUNK_SIZE),
    };
  }

  // Chunk coordinate key
  key(cx, cy) { return `${cx},${cy}`; }

  // Parse key back to coords
  parseKey(key) {
    const [cx, cy] = key.split(',').map(Number);
    return { cx, cy };
  }

  // Get chunk keys visible from a pixel position, with a radius in chunks
  getVisibleChunks(px, py, dungeon) {
    const tileX = px / TILE_SIZE;
    const tileY = py / TILE_SIZE;
    const centerCX = Math.floor(tileX / CHUNK_SIZE);
    const centerCY = Math.floor(tileY / CHUNK_SIZE);
    const { cols, rows } = this.getChunkDims(dungeon);
    // Reveal radius: enough to cover the viewport plus exploration buffer
    const radius = 3;
    const visible = new Set();
    for (let cy = centerCY - radius; cy <= centerCY + radius; cy++) {
      for (let cx = centerCX - radius; cx <= centerCX + radius; cx++) {
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) {
          visible.add(this.key(cx, cy));
        }
      }
    }
    return visible;
  }

  // Extract tile data for one chunk from a dungeon
  extractChunk(dungeon, cx, cy) {
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const w = Math.min(CHUNK_SIZE, dungeon.width - startX);
    const h = Math.min(CHUNK_SIZE, dungeon.height - startY);
    const data = new Array(w * h);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        data[row * w + col] = dungeon.data[(startY + row) * dungeon.width + (startX + col)];
      }
    }
    return { cx, cy, x: startX, y: startY, w, h, data };
  }

  // Get chunk keys not yet sent to a player in a room
  getNewChunkKeys(playerId, roomId, visibleKeys) {
    const sent = this._getSentSet(playerId, roomId);
    const newKeys = [];
    for (const key of visibleKeys) {
      if (!sent.has(key)) newKeys.push(key);
    }
    return newKeys;
  }

  // Mark chunks as sent
  markSent(playerId, roomId, keys) {
    const sent = this._getSentSet(playerId, roomId);
    for (const key of keys) sent.add(key);
  }

  // Reset a player's chunk state for a room (on floor change)
  resetRoom(playerId, roomId) {
    const playerMap = this.playerChunks.get(playerId);
    if (playerMap) playerMap.delete(roomId);
  }

  // Clean up on disconnect
  removePlayer(playerId) {
    this.playerChunks.delete(playerId);
  }

  // Compute and extract new chunks for a player, returning the chunk array (or null)
  getNewChunksForPlayer(playerId, roomId, player, dungeon) {
    const visible = this.getVisibleChunks(player.x, player.y, dungeon);
    const newKeys = this.getNewChunkKeys(playerId, roomId, visible);
    if (newKeys.length === 0) return null;

    const chunks = newKeys.map(key => {
      const { cx, cy } = this.parseKey(key);
      return this.extractChunk(dungeon, cx, cy);
    });
    this.markSent(playerId, roomId, newKeys);
    return chunks;
  }

  _getSentSet(playerId, roomId) {
    if (!this.playerChunks.has(playerId)) {
      this.playerChunks.set(playerId, new Map());
    }
    const playerMap = this.playerChunks.get(playerId);
    if (!playerMap.has(roomId)) {
      playerMap.set(roomId, new Set());
    }
    return playerMap.get(roomId);
  }
}

module.exports = ChunkManager;
