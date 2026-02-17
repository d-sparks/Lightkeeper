const CONSTANTS = require('../shared/constants');

class Physics {
  constructor(content) {
    this.content = content;
  }

  // Move a player based on their input, with collision detection
  // Uses circle-vs-tile collision for smooth sliding along walls
  movePlayer(player, dungeon, dt) {
    if (!player.input) return;

    const speed = CONSTANTS.PLAYER_SPEED * CONSTANTS.TILE_SIZE * dt;
    let dx = 0;
    let dy = 0;

    if (player.input.up)    dy -= 1;
    if (player.input.down)  dy += 1;
    if (player.input.left)  dx -= 1;
    if (player.input.right) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    if (dx === 0 && dy === 0) return;

    // Try X movement first, then Y (allows wall sliding)
    const newX = player.x + dx * speed;
    const newY = player.y + dy * speed;

    // Try X
    if (!this.collidesAt(newX, player.y, dungeon)) {
      player.x = newX;
    }

    // Try Y
    if (!this.collidesAt(player.x, newY, dungeon)) {
      player.y = newY;
    }

    // Update facing direction
    if (dx !== 0 || dy !== 0) {
      player.facing = Math.atan2(dy, dx);
    }
  }

  // Check if a circle at (px, py) with PLAYER_RADIUS collides with any solid tile
  collidesAt(px, py, dungeon) {
    const r = CONSTANTS.PLAYER_RADIUS;
    const ts = CONSTANTS.TILE_SIZE;

    // Check all tiles the bounding box could overlap
    const minTX = Math.floor((px - r) / ts);
    const maxTX = Math.floor((px + r) / ts);
    const minTY = Math.floor((py - r) / ts);
    const maxTY = Math.floor((py + r) / ts);

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (this.content.isSolid(dungeon, tx, ty)) {
          // Circle vs AABB collision
          const nearestX = Math.max(tx * ts, Math.min(px, (tx + 1) * ts));
          const nearestY = Math.max(ty * ts, Math.min(py, (ty + 1) * ts));
          const distX = px - nearestX;
          const distY = py - nearestY;
          if (distX * distX + distY * distY < r * r) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

module.exports = Physics;
