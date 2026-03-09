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
    // Stunned players cannot move
    if (player.stunTime > 0) return;
    // Players being knocked back cannot move voluntarily
    if (player.knockbackTime > 0) return;
    // Players channeling an ability cannot move
    if (player.channeling) return;

    const speed = CONSTANTS.PLAYER_SPEED * CONSTANTS.TILE_SIZE * dt;
    let dx = 0;
    let dy = 0;

    // Prefer analog dx/dy for omnidirectional movement (joystick, gamepad, click-to-move)
    if (player.input.dx != null && player.input.dy != null &&
        (player.input.dx !== 0 || player.input.dy !== 0)) {
      dx = player.input.dx;
      dy = player.input.dy;
    } else {
      // Fall back to 8-directional from boolean keys (keyboard)
      if (player.input.up)    dy -= 1;
      if (player.input.down)  dy += 1;
      if (player.input.left)  dx -= 1;
      if (player.input.right) dx += 1;
    }

    // Normalize so speed is consistent regardless of direction/magnitude
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    // Move to desired position, then resolve overlaps with solid tiles
    player.x += dx * speed;
    player.y += dy * speed;
    this.resolveCollisions(player, dungeon);

    // Check for ramp transitions (update player elevation)
    this.checkRampTransition(player, dungeon);

    // Update facing direction
    player.facing = Math.atan2(dy, dx);
  }

  // Check if player is on a ramp tile and update their elevation accordingly.
  // Elevation only changes via: ramps (smooth), walking onto a floor at a
  // different elevation (snap), or hovering (visual only, no elevation change).
  // Standing on a solid tile you're above (e.g. ground-level wall at elev 1)
  // keeps your elevation — the wall top is your floor.
  checkRampTransition(player, dungeon) {
    const ts = CONSTANTS.TILE_SIZE;
    const tx = Math.floor(player.x / ts);
    const ty = Math.floor(player.y / ts);
    const ramp = this.content.getRampInfo(dungeon, tx, ty);

    if (ramp) {
      // Calculate position within the tile (0..1)
      const localX = (player.x - tx * ts) / ts;
      const localY = (player.y - ty * ts) / ts;

      // Determine interpolation based on ramp direction
      let t;
      switch (ramp.dir) {
        case 'north': t = 1 - localY; break; // moving up (decreasing Y) = ascending
        case 'south': t = localY; break;      // moving down (increasing Y) = ascending
        case 'east':  t = localX; break;      // moving right = ascending
        case 'west':  t = 1 - localX; break;  // moving left = ascending
        default: t = 0;
      }
      player.elevation = ramp.from + (ramp.to - ramp.from) * t;
    } else {
      const tileDef = this.content.getTileDef(dungeon, tx, ty);
      const tileElev = tileDef ? (tileDef.elevation || 0) : 0;

      if (tileDef && tileDef.solid) {
        // On a solid tile we're above — round to nearest integer elevation
        // so we don't get stuck at fractional values after leaving a ramp.
        player.elevation = Math.round(player.elevation || 0);
      } else {
        // On a walkable floor tile — snap to its elevation
        player.elevation = tileElev;
      }
    }
  }

  // Push a player out of any solid tiles they overlap.
  // Iterates multiple times to handle being wedged between walls.
  resolveCollisions(player, dungeon) {
    const r = CONSTANTS.PLAYER_RADIUS;
    const ts = CONSTANTS.TILE_SIZE;
    const elev = player.hovering ? 999 : (player.elevation || 0);

    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      const minTX = Math.floor((player.x - r) / ts);
      const maxTX = Math.floor((player.x + r) / ts);
      const minTY = Math.floor((player.y - r) / ts);
      const maxTY = Math.floor((player.y + r) / ts);

      for (let ty = minTY; ty <= maxTY; ty++) {
        for (let tx = minTX; tx <= maxTX; tx++) {
          if (!this.content.isSolid(dungeon, tx, ty, elev)) continue;

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
  collidesAt(px, py, dungeon, radius, elevation) {
    const r = radius || CONSTANTS.PLAYER_RADIUS;
    const ts = CONSTANTS.TILE_SIZE;
    const elev = elevation || 0;

    // Check all tiles the bounding box could overlap
    const minTX = Math.floor((px - r) / ts);
    const maxTX = Math.floor((px + r) / ts);
    const minTY = Math.floor((py - r) / ts);
    const maxTY = Math.floor((py + r) / ts);

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (this.content.isSolid(dungeon, tx, ty, elev)) {
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
