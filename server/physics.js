const CONSTANTS = require('../shared/constants');

class Physics {
  constructor(content) {
    this.content = content;
  }

  // Move a player based on their input, with collision detection.
  // Uses collision resolution (move then push-out) for smooth wall sliding,
  // corner rounding, and tight hallway navigation.
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

    // Move to desired position, then resolve overlaps with solid tiles
    player.x += dx * speed;
    player.y += dy * speed;
    this.resolveCollisions(player, dungeon);

    // Update facing direction
    player.facing = Math.atan2(dy, dx);
  }

  // Push a player out of any solid tiles they overlap.
  // Iterates multiple times to handle being wedged between walls.
  resolveCollisions(player, dungeon) {
    const r = CONSTANTS.PLAYER_RADIUS;
    const ts = CONSTANTS.TILE_SIZE;

    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      const minTX = Math.floor((player.x - r) / ts);
      const maxTX = Math.floor((player.x + r) / ts);
      const minTY = Math.floor((player.y - r) / ts);
      const maxTY = Math.floor((player.y + r) / ts);

      for (let ty = minTY; ty <= maxTY; ty++) {
        for (let tx = minTX; tx <= maxTX; tx++) {
          if (!this.content.isSolid(dungeon, tx, ty)) continue;

          // Nearest point on tile AABB to circle center
          const nearestX = Math.max(tx * ts, Math.min(player.x, (tx + 1) * ts));
          const nearestY = Math.max(ty * ts, Math.min(player.y, (ty + 1) * ts));
          const distX = player.x - nearestX;
          const distY = player.y - nearestY;
          const distSq = distX * distX + distY * distY;

          if (distSq >= r * r) continue; // no overlap

          if (distSq > 0) {
            // Normal case: circle overlaps tile edge/corner — push out
            const dist = Math.sqrt(distSq);
            const overlap = r - dist;
            player.x += (distX / dist) * overlap;
            player.y += (distY / dist) * overlap;
          } else {
            // Center is inside the tile AABB — push out along shortest axis
            const dLeft   = player.x - tx * ts;
            const dRight  = (tx + 1) * ts - player.x;
            const dTop    = player.y - ty * ts;
            const dBottom = (ty + 1) * ts - player.y;
            const min = Math.min(dLeft, dRight, dTop, dBottom);

            if (min === dLeft)        player.x = tx * ts - r;
            else if (min === dRight)  player.x = (tx + 1) * ts + r;
            else if (min === dTop)    player.y = ty * ts - r;
            else                      player.y = (ty + 1) * ts + r;
          }
          pushed = true;
        }
      }

      if (!pushed) break;
    }
  }

  // Check if a circle at (px, py) collides with any solid tile
  collidesAt(px, py, dungeon, radius) {
    const r = radius || CONSTANTS.PLAYER_RADIUS;
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
