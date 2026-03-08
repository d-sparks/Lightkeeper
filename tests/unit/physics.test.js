const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Physics = require('../../server/physics');

// TILE_SIZE=32, PLAYER_RADIUS=12, PLAYER_SPEED=4

// Helper: create a dungeon with a solid border and open interior
// solidSet is a Set of "tx,ty" strings for additional solid tiles
function makeDungeon(width, height, solidSet) {
  return { width, height, solidSet: solidSet || new Set() };
}

function makeContent(dungeon) {
  return {
    isSolid(d, tx, ty) {
      // Border walls
      if (tx < 0 || ty < 0 || tx >= d.width || ty >= d.height) return true;
      if (tx === 0 || ty === 0 || tx === d.width - 1 || ty === d.height - 1) return true;
      return d.solidSet.has(`${tx},${ty}`);
    },
    getRampInfo(d, tx, ty) {
      return null;
    },
    getTileDef(d, tx, ty) {
      return null;
    }
  };
}

function makePlayer(x, y, input) {
  return { x, y, input: input || null, facing: 0 };
}

describe('Physics', () => {
  // --- collidesAt ---
  describe('collidesAt', () => {
    it('returns false in open space', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Center of tile (5,5) = (5*32+16, 5*32+16) = (176, 176)
      assert.equal(physics.collidesAt(176, 176, dungeon), false);
    });

    it('returns true when overlapping a solid wall', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Just inside left border wall: tile 0 is solid, radius=12
      // x=32+5=37 is 5px from left edge of tile 1, but circle extends into tile 0
      assert.equal(physics.collidesAt(37, 176, dungeon), true);
    });

    it('returns false just outside collision range of wall', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Left wall ends at x=32. Player at x=32+12+1=45 should be clear (radius 12)
      assert.equal(physics.collidesAt(45, 176, dungeon), false);
    });

    it('detects collision with custom solid tile', () => {
      const dungeon = makeDungeon(10, 10, new Set(['5,5']));
      const physics = new Physics(makeContent(dungeon));
      // Center of tile 5,5 = (160+16, 160+16) = (176, 176)
      assert.equal(physics.collidesAt(176, 176, dungeon), true);
    });

    it('respects custom radius', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // x=45 is 13px from wall at x=32. Default radius 12 doesn't collide, but radius 14 does
      assert.equal(physics.collidesAt(45, 176, dungeon, 12), false);
      assert.equal(physics.collidesAt(45, 176, dungeon, 14), true);
    });

    it('detects corner collision with solid tile', () => {
      const dungeon = makeDungeon(10, 10, new Set(['3,3']));
      const physics = new Physics(makeContent(dungeon));
      // Corner of tile 3,3 is at (128, 128). Circle at (128+9, 128+9) with r=12
      // dist = sqrt(81+81) = ~12.73 > 12, so no collision
      assert.equal(physics.collidesAt(137, 137, dungeon), false);
      // Circle at (128+8, 128+8) with r=12: dist = sqrt(64+64) = ~11.31 < 12
      assert.equal(physics.collidesAt(136, 136, dungeon), true);
    });
  });

  // --- resolveCollisions ---
  describe('resolveCollisions', () => {
    it('does nothing when player is in open space', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const player = makePlayer(176, 176);
      physics.resolveCollisions(player, dungeon);
      assert.equal(player.x, 176);
      assert.equal(player.y, 176);
    });

    it('pushes player out of wall on left side', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Wall tile 0 ends at x=32. Player at x=38 with r=12 overlaps by 6px
      const player = makePlayer(38, 176);
      physics.resolveCollisions(player, dungeon);
      // Should be pushed to x=44 (32 + 12)
      assert.ok(Math.abs(player.x - 44) < 0.01, `Expected ~44, got ${player.x}`);
      assert.ok(Math.abs(player.y - 176) < 0.01, `Y should be unchanged, got ${player.y}`);
    });

    it('pushes player out of wall on top side', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Top wall tile 0 ends at y=32. Player at y=38 overlaps
      const player = makePlayer(176, 38);
      physics.resolveCollisions(player, dungeon);
      assert.ok(Math.abs(player.y - 44) < 0.01, `Expected ~44, got ${player.y}`);
    });

    it('pushes player out of wall on right side', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Right wall tile 9 starts at x=288. Player at x=282 with r=12 overlaps
      const player = makePlayer(282, 176);
      physics.resolveCollisions(player, dungeon);
      // Should be pushed to x=276 (288 - 12)
      assert.ok(Math.abs(player.x - 276) < 0.01, `Expected ~276, got ${player.x}`);
    });

    it('pushes player out of wall on bottom side', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Bottom wall tile 9 starts at y=288
      const player = makePlayer(176, 282);
      physics.resolveCollisions(player, dungeon);
      assert.ok(Math.abs(player.y - 276) < 0.01, `Expected ~276, got ${player.y}`);
    });

    it('handles corner push-out (diagonal into corner)', () => {
      const dungeon = makeDungeon(10, 10, new Set(['3,3']));
      const physics = new Physics(makeContent(dungeon));
      // Bottom-right corner of tile 3,3 is at (128, 128)
      // Place player slightly overlapping the corner
      const player = makePlayer(134, 134);
      physics.resolveCollisions(player, dungeon);
      // Player should be pushed away from corner so dist >= 12
      const dx = player.x - 128;
      const dy = player.y - 128;
      const dist = Math.sqrt(dx * dx + dy * dy);
      assert.ok(dist >= 11.99, `Expected dist >= 12 from corner, got ${dist}`);
    });

    it('resolves being wedged in a corner (two walls)', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Top-left corner: walls at tile (0,*) and (*,0). Player wedged at (36, 36)
      const player = makePlayer(36, 36);
      physics.resolveCollisions(player, dungeon);
      // Should be pushed to at least (44, 44)
      assert.ok(player.x >= 43.99, `Expected x >= 44, got ${player.x}`);
      assert.ok(player.y >= 43.99, `Expected y >= 44, got ${player.y}`);
    });

    it('handles center-inside-tile case', () => {
      const dungeon = makeDungeon(10, 10, new Set(['5,5']));
      const physics = new Physics(makeContent(dungeon));
      // Place player center exactly at center of solid tile (176, 176)
      const player = makePlayer(176, 176);
      physics.resolveCollisions(player, dungeon);
      // Player should be pushed fully outside the tile
      assert.equal(physics.collidesAt(player.x, player.y, dungeon), false);
    });
  });

  // --- movePlayer ---
  describe('movePlayer', () => {
    it('does nothing with no input', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const player = makePlayer(176, 176, null);
      physics.movePlayer(player, dungeon, 1 / 15);
      assert.equal(player.x, 176);
      assert.equal(player.y, 176);
    });

    it('does nothing with zero input', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const player = makePlayer(176, 176, { up: false, down: false, left: false, right: false });
      physics.movePlayer(player, dungeon, 1 / 15);
      assert.equal(player.x, 176);
      assert.equal(player.y, 176);
    });

    it('moves right at correct speed', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const player = makePlayer(320, 320, { right: true });
      const dt = 1 / 15;
      physics.movePlayer(player, dungeon, dt);
      // speed = 4 * 32 * (1/15) = 8.533...
      const expected = 320 + 4 * 32 * dt;
      assert.ok(Math.abs(player.x - expected) < 0.01, `Expected ~${expected}, got ${player.x}`);
      assert.ok(Math.abs(player.y - 320) < 0.01, `Y should be unchanged`);
    });

    it('moves up (negative y)', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const player = makePlayer(320, 320, { up: true });
      const dt = 1 / 15;
      physics.movePlayer(player, dungeon, dt);
      const expected = 320 - 4 * 32 * dt;
      assert.ok(Math.abs(player.y - expected) < 0.01);
    });

    it('normalizes diagonal movement', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      const speed = 4 * 32 * dt;

      // Move right only
      const p1 = makePlayer(320, 320, { right: true });
      physics.movePlayer(p1, dungeon, dt);
      const rightDist = Math.sqrt((p1.x - 320) ** 2 + (p1.y - 320) ** 2);

      // Move diagonally (right + down)
      const p2 = makePlayer(320, 320, { right: true, down: true });
      physics.movePlayer(p2, dungeon, dt);
      const diagDist = Math.sqrt((p2.x - 320) ** 2 + (p2.y - 320) ** 2);

      // Diagonal distance should equal cardinal distance (normalized)
      assert.ok(Math.abs(rightDist - diagDist) < 0.01,
        `Cardinal dist ${rightDist} should equal diagonal dist ${diagDist}`);
    });

    it('uses analog dx/dy when provided', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      // Analog input at 45 degrees, magnitude 1
      const ang = Math.PI / 4;
      const player = makePlayer(320, 320, { dx: Math.cos(ang), dy: Math.sin(ang) });
      physics.movePlayer(player, dungeon, dt);
      const movedX = player.x - 320;
      const movedY = player.y - 320;
      assert.ok(Math.abs(movedX - movedY) < 0.01, 'X and Y movement should be equal at 45 deg');
      assert.ok(movedX > 0, 'Should move right');
      assert.ok(movedY > 0, 'Should move down');
    });

    it('clamps analog input magnitude > 1', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      const speed = 4 * 32 * dt;

      // Analog with magnitude 2
      const p1 = makePlayer(320, 320, { dx: 2, dy: 0 });
      physics.movePlayer(p1, dungeon, dt);
      // Should be clamped to magnitude 1
      assert.ok(Math.abs(p1.x - (320 + speed)) < 0.01,
        `Expected ${320 + speed}, got ${p1.x}`);
    });

    it('allows analog input magnitude < 1 (slower movement)', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      const speed = 4 * 32 * dt;

      // Half magnitude
      const player = makePlayer(320, 320, { dx: 0.5, dy: 0 });
      physics.movePlayer(player, dungeon, dt);
      assert.ok(Math.abs(player.x - (320 + speed * 0.5)) < 0.01,
        `Expected ${320 + speed * 0.5}, got ${player.x}`);
    });

    it('updates facing direction', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;

      const player = makePlayer(320, 320, { left: true });
      physics.movePlayer(player, dungeon, dt);
      // Left = dx=-1, dy=0 => atan2(0, -1) = PI
      assert.ok(Math.abs(player.facing - Math.PI) < 0.01);
    });

    it('stops at wall (wall sliding)', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      // Place player near left wall and move left — should be stopped
      const player = makePlayer(44, 176, { left: true });
      physics.movePlayer(player, dungeon, dt);
      // Should be pushed back to x=44 (32 + 12)
      assert.ok(player.x >= 43.99, `Should not go past wall, x=${player.x}`);
    });

    it('wall slides along wall when moving diagonally', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      // Player at left wall, moving left+down — should slide down
      const player = makePlayer(44, 176, { left: true, down: true });
      physics.movePlayer(player, dungeon, dt);
      // X should stay at wall boundary
      assert.ok(player.x >= 43.99, `Should not go past wall, x=${player.x}`);
      // Y should have moved down
      assert.ok(player.y > 176, `Should slide downward, y=${player.y}`);
    });
  });

  // --- tight corridors ---
  describe('tight corridors', () => {
    it('player can fit through 2-tile-wide corridor', () => {
      // Create corridor: solid everywhere except column 4 and 5 (2 tiles wide = 64px)
      const solids = new Set();
      for (let y = 2; y <= 7; y++) {
        solids.add(`3,${y}`);
        solids.add(`6,${y}`);
      }
      const dungeon = makeDungeon(10, 10, solids);
      const physics = new Physics(makeContent(dungeon));

      // Center of corridor: x = (4*32 + 6*32) / 2 = 160, should be clear
      const player = makePlayer(160, 160);
      assert.equal(physics.collidesAt(160, 160, dungeon), false);
      physics.resolveCollisions(player, dungeon);
      assert.equal(player.x, 160);
      assert.equal(player.y, 160);
    });

    it('player can navigate 1-tile-wide corridor (tight fit)', () => {
      // 1-tile corridor at column 5 (32px wide), walls at 4 and 6
      const solids = new Set();
      for (let y = 2; y <= 7; y++) {
        solids.add(`4,${y}`);
        solids.add(`6,${y}`);
      }
      const dungeon = makeDungeon(10, 10, solids);
      const physics = new Physics(makeContent(dungeon));

      // Center of corridor tile 5: x = 5*32+16 = 176
      // Wall at tile 4 ends at x=160, wall at tile 6 starts at x=192
      // Corridor width = 32px, player diameter = 24px, fits with 4px margin each side
      const player = makePlayer(176, 160);
      physics.resolveCollisions(player, dungeon);
      assert.ok(Math.abs(player.x - 176) < 0.01, 'Player should fit in center of 1-tile corridor');
    });

    it('player gets pushed to center when off-center in tight corridor', () => {
      const solids = new Set();
      for (let y = 2; y <= 7; y++) {
        solids.add(`4,${y}`);
        solids.add(`6,${y}`);
      }
      const dungeon = makeDungeon(10, 10, solids);
      const physics = new Physics(makeContent(dungeon));

      // Offset to the right, overlapping right wall
      // Tile 6 starts at x=192, player at x=185 with r=12 reaches x=197 => overlap
      const player = makePlayer(185, 160);
      physics.resolveCollisions(player, dungeon);
      assert.ok(player.x <= 180, `Should be pushed left, got x=${player.x}`);
      assert.ok(player.x >= 172, `Should stay in corridor, got x=${player.x}`);
    });
  });

  // --- wall sliding directions ---
  describe('wall sliding all directions', () => {
    it('slides vertically along right wall when moving right+up', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      // Player at right wall boundary, moving right+up
      const player = makePlayer(276, 176, { right: true, up: true });
      physics.movePlayer(player, dungeon, dt);
      assert.ok(player.x <= 276.01, `Should not pass right wall, x=${player.x}`);
      assert.ok(player.y < 176, `Should slide upward, y=${player.y}`);
    });

    it('slides horizontally along top wall when moving up+right', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      const player = makePlayer(176, 44, { up: true, right: true });
      physics.movePlayer(player, dungeon, dt);
      assert.ok(player.y >= 43.99, `Should not pass top wall, y=${player.y}`);
      assert.ok(player.x > 176, `Should slide right, x=${player.x}`);
    });

    it('slides along bottom wall when moving down+left', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      const player = makePlayer(176, 276, { down: true, left: true });
      physics.movePlayer(player, dungeon, dt);
      assert.ok(player.y <= 276.01, `Should not pass bottom wall, y=${player.y}`);
      assert.ok(player.x < 176, `Should slide left, x=${player.x}`);
    });
  });

  // --- analog input edge cases ---
  describe('analog input edge cases', () => {
    it('falls back to keyboard keys when dx=0,dy=0', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      const player = makePlayer(320, 320, { dx: 0, dy: 0, right: true });
      physics.movePlayer(player, dungeon, dt);
      const expected = 320 + 4 * 32 * dt;
      assert.ok(Math.abs(player.x - expected) < 0.01,
        `Should use keyboard fallback, expected ${expected}, got ${player.x}`);
    });

    it('prefers analog over keyboard when both provided', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      // Analog says go right, keyboard says go left
      const player = makePlayer(320, 320, { dx: 1, dy: 0, left: true });
      physics.movePlayer(player, dungeon, dt);
      assert.ok(player.x > 320, `Analog should override keyboard, x=${player.x}`);
    });
  });

  // --- L-shaped corridor navigation ---
  describe('L-shaped corridor', () => {
    it('player navigates around an L-shaped wall', () => {
      // Create an L-shaped wall: solid at (4,4) and (5,4) with open path around
      const solids = new Set(['4,4', '5,4']);
      const dungeon = makeDungeon(10, 10, solids);
      const physics = new Physics(makeContent(dungeon));

      // Player below the L wall can move freely
      const player = makePlayer(4 * 32 + 16, 5 * 32 + 16);
      assert.equal(physics.collidesAt(player.x, player.y, dungeon), false);

      // Player to the right of the L wall can move freely
      const player2 = makePlayer(6 * 32 + 16, 4 * 32 + 16);
      assert.equal(physics.collidesAt(player2.x, player2.y, dungeon), false);
    });
  });

  // --- squeeze between opposing walls ---
  describe('opposing walls', () => {
    it('player squeezed between two horizontal walls resolves cleanly', () => {
      // Solid rows at y=3 and y=5, leaving y=4 as a 1-tile corridor
      const solids = new Set();
      for (let x = 2; x <= 7; x++) {
        solids.add(`${x},3`);
        solids.add(`${x},5`);
      }
      const dungeon = makeDungeon(10, 10, solids);
      const physics = new Physics(makeContent(dungeon));

      // Player in center of corridor
      const player = makePlayer(4 * 32 + 16, 4 * 32 + 16);
      physics.resolveCollisions(player, dungeon);
      assert.equal(physics.collidesAt(player.x, player.y, dungeon), false);
    });

    it('player pushed into corridor from overlapping position resolves', () => {
      const solids = new Set();
      for (let x = 2; x <= 7; x++) {
        solids.add(`${x},3`);
        solids.add(`${x},5`);
      }
      const dungeon = makeDungeon(10, 10, solids);
      const physics = new Physics(makeContent(dungeon));

      // Player overlapping top wall of corridor
      // Tile 3 ends at y=128, tile 5 starts at y=160. Corridor center = 144.
      const player = makePlayer(4 * 32 + 16, 132); // overlaps top wall
      physics.resolveCollisions(player, dungeon);
      assert.ok(player.y >= 140, `Should be pushed into corridor, y=${player.y}`);
      assert.equal(physics.collidesAt(player.x, player.y, dungeon), false);
    });
  });

  // --- edge cases ---
  describe('edge cases', () => {
    it('multiple iterations resolve compound overlaps', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Deep inside top-left corner: overlapping two walls
      const player = makePlayer(34, 34);
      physics.resolveCollisions(player, dungeon);
      // Should be fully resolved
      assert.equal(physics.collidesAt(player.x, player.y, dungeon), false);
    });

    it('player touching wall exactly at radius boundary is not colliding', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Wall at tile 0 ends at x=32. Player at exactly x=44 (32+12) — touching, not overlapping
      // collidesAt uses strict < for comparison
      assert.equal(physics.collidesAt(44, 176, dungeon), false);
    });

    it('resolveCollisions is idempotent (running twice gives same result)', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      const player = makePlayer(38, 38);
      physics.resolveCollisions(player, dungeon);
      const x1 = player.x, y1 = player.y;
      physics.resolveCollisions(player, dungeon);
      assert.ok(Math.abs(player.x - x1) < 0.001);
      assert.ok(Math.abs(player.y - y1) < 0.001);
    });

    it('collidesAt works with out-of-bounds coordinates (treated as solid)', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Negative coordinates
      assert.equal(physics.collidesAt(-5, -5, dungeon), true);
      // Far outside
      assert.equal(physics.collidesAt(500, 500, dungeon), true);
    });

    it('player deeply inside a solid tile gets fully pushed out', () => {
      const dungeon = makeDungeon(10, 10, new Set(['5,5']));
      const physics = new Physics(makeContent(dungeon));
      // Player at edge of the solid tile (not center)
      const player = makePlayer(5 * 32 + 2, 5 * 32 + 2);
      physics.resolveCollisions(player, dungeon);
      assert.equal(physics.collidesAt(player.x, player.y, dungeon), false);
    });

    it('large dt does not skip through walls', () => {
      const dungeon = makeDungeon(10, 10);
      const physics = new Physics(makeContent(dungeon));
      // Very large dt = 1 second, speed = 4*32 = 128px
      // Player near left wall moving left with huge step
      const player = makePlayer(50, 176, { left: true });
      physics.movePlayer(player, dungeon, 1.0);
      // Should be stopped at wall boundary (32+12=44), not pass through
      assert.ok(player.x >= 44, `Should not pass through wall, x=${player.x}`);
    });

    it('zero dt produces no movement', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const player = makePlayer(320, 320, { right: true });
      physics.movePlayer(player, dungeon, 0);
      assert.equal(player.x, 320);
      assert.equal(player.y, 320);
    });

    it('all four cardinal directions move correctly', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      const speed = 4 * 32 * dt;

      const dirs = [
        { input: { right: true }, expectedDx: speed, expectedDy: 0 },
        { input: { left: true },  expectedDx: -speed, expectedDy: 0 },
        { input: { down: true },  expectedDx: 0, expectedDy: speed },
        { input: { up: true },    expectedDx: 0, expectedDy: -speed },
      ];

      for (const { input, expectedDx, expectedDy } of dirs) {
        const player = makePlayer(320, 320, input);
        physics.movePlayer(player, dungeon, dt);
        assert.ok(Math.abs(player.x - (320 + expectedDx)) < 0.01,
          `${JSON.stringify(input)}: x expected ${320 + expectedDx}, got ${player.x}`);
        assert.ok(Math.abs(player.y - (320 + expectedDy)) < 0.01,
          `${JSON.stringify(input)}: y expected ${320 + expectedDy}, got ${player.y}`);
      }
    });

    it('all four diagonal directions have consistent speed', () => {
      const dungeon = makeDungeon(20, 20);
      const physics = new Physics(makeContent(dungeon));
      const dt = 1 / 15;
      const speed = 4 * 32 * dt;

      const diags = [
        { right: true, down: true },
        { right: true, up: true },
        { left: true, down: true },
        { left: true, up: true },
      ];

      for (const input of diags) {
        const player = makePlayer(320, 320, input);
        physics.movePlayer(player, dungeon, dt);
        const dist = Math.sqrt((player.x - 320) ** 2 + (player.y - 320) ** 2);
        assert.ok(Math.abs(dist - speed) < 0.01,
          `Diagonal ${JSON.stringify(input)}: dist ${dist} should equal speed ${speed}`);
      }
    });
  });
});
