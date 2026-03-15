const CONSTANTS = require('../shared/constants');

// Mulberry32 seeded PRNG
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a string to a 32-bit integer for seeding
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

class DungeonGenerator {
  constructor(content) {
    this.content = content;
  }

  // Generate a dungeon from a template
  // context: { fromDungeon, exitX, exitY, depth, serverEpoch }
  // Returns: { dungeon, instanceId } or null on failure
  generate(template, context) {
    const seedStr = `${context.fromDungeon}_${context.exitX}_${context.exitY}_${context.serverEpoch}`;
    const seed = hashString(seedStr);

    for (let attempt = 0; attempt < 3; attempt++) {
      const rng = mulberry32(seed + attempt);
      const result = this._tryGenerate(template, context, rng);
      if (result) {
        const instanceId = `proc:${template.id}:${seedStr}`;
        result.id = instanceId;
        console.log(`[DungeonGen] Generated "${template.id}" depth=${context.depth} seed="${seedStr}" (attempt ${attempt + 1})`);
        return { dungeon: result, instanceId };
      }
    }

    console.error(`[DungeonGen] Failed to generate "${template.id}" after 3 attempts`);
    return null;
  }

  _tryGenerate(template, context, rng) {
    const grid = template.grid;
    const W = grid.width;
    const H = grid.height;
    const depth = context.depth || 0;

    // 1. Initialize grid filled with wall tiles
    const data = new Array(W * H).fill(grid.wallTile);

    // 2. Place rooms (depth-filtered)
    const rooms = this._placeRooms(template, rng, W, H, depth, context);
    if (!rooms) return null;

    // 3. Carve rooms into grid
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (rng() < (grid.altFloorChance || 0)) {
            data[y * W + x] = grid.altFloorTile || grid.floorTile;
          } else {
            data[y * W + x] = grid.floorTile;
          }
        }
      }
    }

    // 4. Connect rooms via MST + extra edges
    const edges = this._buildMST(rooms, rng, template.corridors);

    // 5. Carve corridors
    const corridorCfg = template.corridors;
    for (const [a, b] of edges) {
      this._carveCorridor(data, W, H, rooms[a], rooms[b], corridorCfg, grid, rng);
    }

    // 6. Place doors at corridor chokepoints
    if (corridorCfg.doorChance > 0) {
      this._placeDoors(data, W, H, rooms, corridorCfg, grid, rng);
    }

    // 7. Build dungeon JSON
    const entranceRoom = rooms.find(r => r.tag === 'entrance');
    const exitRoom = rooms.find(r => r.tag === 'exit_room');

    const name = (template.namePattern || 'Procedural {depth}').replace('{depth}', depth);

    const dungeon = {
      id: null, // set by caller
      name,
      depth,
      tileset: template.tileset,
      tileSize: template.tileSize || 32,
      width: W,
      height: H,
      data,
      spawns: this._placeSpawns(template, entranceRoom),
      exits: this._placeExits(template, context, entranceRoom, exitRoom, data, W),
      monsterSpawns: this._placeMonsters(template, rooms, rng, depth),
      itemSpawns: this._placeItems(template, rooms, rng, data, W, H, grid),
      npcSpawns: this._placeNPCs(template, rooms, rng),
      triggers: this._buildTriggers(template, context, rooms, depth),
    };

    if (template.environmentalHazard) {
      dungeon.environmentalHazard = template.environmentalHazard;
    }

    // Place required room item spawns, monster spawns, and center tiles
    for (const room of rooms) {
      if (!room.def) continue;

      if (room.def.itemSpawns) {
        for (const spawn of room.def.itemSpawns) {
          let x, y;
          if (spawn.position === 'center') {
            x = room.cx;
            y = room.cy;
          } else {
            x = room.x + 1 + Math.floor(rng() * (room.w - 2));
            y = room.y + 1 + Math.floor(rng() * (room.h - 2));
          }
          dungeon.itemSpawns.push({ type: spawn.type, x, y });
        }
      }

      if (room.def.monsterSpawns) {
        for (const spawn of room.def.monsterSpawns) {
          let x, y;
          if (spawn.position === 'center') {
            x = room.cx;
            y = room.cy;
          } else {
            x = room.x + 1 + Math.floor(rng() * (room.w - 2));
            y = room.y + 1 + Math.floor(rng() * (room.h - 2));
          }
          // Override boss room monster type with expedition bossType if provided
          let type = spawn.type;
          if (room.tag === 'boss' && context.bossType) {
            type = context.bossType;
          }
          const entry = { type, x, y, count: 1 };
          if (spawn.patrol) entry.patrol = spawn.patrol;
          if (spawn.patrolPath) {
            // Offset waypoints relative to room position
            entry.patrolPath = spawn.patrolPath.map(p => ({ x: room.x + p.x, y: room.y + p.y }));
          }
          dungeon.monsterSpawns.push(entry);
        }
      }

      if (room.def.centerTile != null) {
        data[room.cy * W + room.cx] = room.def.centerTile;
      }
    }

    return dungeon;
  }

  _placeRooms(template, rng, W, H, depth, context) {
    const roomsCfg = template.rooms;
    const allRequired = template.requiredRooms || [];
    const padding = roomsCfg.padding || 1;
    const maxAttempts = roomsCfg.maxPlacementAttempts || 200;
    const rooms = [];
    const ctxMaxDepth = context && context.maxDepth;

    // Filter required rooms by depth
    // When an expedition overrides maxDepth, remap depth filters so that
    // boss rooms appear on the expedition's final floor and exit rooms
    // appear on all non-final floors, regardless of the template's original depth.max.
    const templateMaxDepth = (template.depth && template.depth.max) || 10;
    const required = allRequired.filter(req => {
      let effectiveDepth = req.depth;
      let effectiveMaxDepth = req.maxDepth;
      if (ctxMaxDepth) {
        // Boss room: remap fixed depth from template max to expedition max
        if (req.tag === 'boss' && effectiveDepth != null && effectiveDepth === templateMaxDepth) {
          effectiveDepth = ctxMaxDepth;
        }
        // Exit room: remap maxDepth cap so it appears on all non-final floors
        if (req.tag === 'exit_room' && effectiveMaxDepth != null && effectiveMaxDepth === templateMaxDepth - 1) {
          effectiveMaxDepth = ctxMaxDepth - 1;
        }
      }
      if (effectiveDepth != null && effectiveDepth !== depth) return false;
      if (req.minDepth != null && depth < req.minDepth) return false;
      if (effectiveMaxDepth != null && depth > effectiveMaxDepth) return false;
      return true;
    });

    // Place required rooms first
    for (const req of required) {
      const w = this._randRange(rng, req.width || roomsCfg.width);
      const h = this._randRange(rng, req.height || roomsCfg.height);

      // If placeNear is specified, bias placement toward that tagged room
      let nearTarget = null;
      if (req.placeNear) {
        const ref = rooms.find(r => r.tag === req.placeNear);
        if (ref) nearTarget = { x: ref.cx, y: ref.cy };
      }

      const placed = this._tryPlace(rooms, w, h, W, H, padding, maxAttempts, rng, nearTarget);
      if (!placed) return null;
      placed.tag = req.tag;
      placed.def = req;
      rooms.push(placed);
    }

    // Fill remaining rooms
    const targetCount = this._randRange(rng, roomsCfg.count);
    for (let i = rooms.length; i < targetCount; i++) {
      const w = this._randRange(rng, roomsCfg.width);
      const h = this._randRange(rng, roomsCfg.height);
      const placed = this._tryPlace(rooms, w, h, W, H, padding, maxAttempts, rng);
      if (placed) {
        rooms.push(placed);
      }
      // Non-required rooms can fail silently
    }

    return rooms;
  }

  _tryPlace(existingRooms, w, h, W, H, padding, maxAttempts, rng, nearTarget) {
    let bestCandidate = null;
    let bestDist = Infinity;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = 1 + Math.floor(rng() * (W - w - 2));
      const y = 1 + Math.floor(rng() * (H - h - 2));

      let overlaps = false;
      for (const other of existingRooms) {
        if (x < other.x + other.w + padding &&
            x + w + padding > other.x &&
            y < other.y + other.h + padding &&
            y + h + padding > other.y) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        const candidate = {
          x, y, w, h,
          cx: Math.floor(x + w / 2),
          cy: Math.floor(y + h / 2),
          tag: null,
          def: null,
        };

        // If no nearTarget, return immediately
        if (!nearTarget) return candidate;

        // With nearTarget, collect candidates and pick closest
        const dx = candidate.cx - nearTarget.x;
        const dy = candidate.cy - nearTarget.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = candidate;
        }
      }
    }

    return bestCandidate;
  }

  _buildMST(rooms, rng, corridorCfg) {
    if (rooms.length < 2) return [];

    // Prim's MST
    const inMST = new Set([0]);
    const edges = [];
    const allEdges = [];

    // Compute all pairwise distances
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const dx = rooms[i].cx - rooms[j].cx;
        const dy = rooms[i].cy - rooms[j].cy;
        allEdges.push({ i, j, dist: dx * dx + dy * dy });
      }
    }
    allEdges.sort((a, b) => a.dist - b.dist);

    while (inMST.size < rooms.length) {
      let bestEdge = null;
      for (const e of allEdges) {
        const iIn = inMST.has(e.i);
        const jIn = inMST.has(e.j);
        if (iIn !== jIn) {
          bestEdge = e;
          break;
        }
      }
      if (!bestEdge) break;
      edges.push([bestEdge.i, bestEdge.j]);
      inMST.add(bestEdge.i);
      inMST.add(bestEdge.j);
    }

    // Add extra connections for loops
    const extraChance = (corridorCfg && corridorCfg.extraConnectionChance) || 0;
    const mstSet = new Set(edges.map(e => `${e[0]}-${e[1]}`));
    for (const e of allEdges) {
      const key = `${e.i}-${e.j}`;
      if (!mstSet.has(key) && rng() < extraChance) {
        edges.push([e.i, e.j]);
        mstSet.add(key);
      }
    }

    return edges;
  }

  _carveCorridor(data, W, H, roomA, roomB, corridorCfg, gridCfg, rng) {
    const cw = this._randRange(rng, corridorCfg.width);
    const halfW = Math.floor(cw / 2);

    const ax = roomA.cx;
    const ay = roomA.cy;
    const bx = roomB.cx;
    const by = roomB.cy;

    // L-shaped corridor: horizontal first or vertical first (50/50)
    if (rng() < 0.5) {
      // Horizontal then vertical
      this._carveHLine(data, W, H, ax, bx, ay, halfW, gridCfg);
      this._carveVLine(data, W, H, ay, by, bx, halfW, gridCfg);
    } else {
      // Vertical then horizontal
      this._carveVLine(data, W, H, ay, by, ax, halfW, gridCfg);
      this._carveHLine(data, W, H, ax, bx, by, halfW, gridCfg);
    }
  }

  _carveHLine(data, W, H, x1, x2, y, halfW, gridCfg) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      for (let dy = -halfW; dy <= halfW; dy++) {
        const ty = y + dy;
        if (ty >= 1 && ty < H - 1 && x >= 1 && x < W - 1) {
          if (data[ty * W + x] === gridCfg.wallTile) {
            data[ty * W + x] = gridCfg.floorTile;
          }
        }
      }
    }
  }

  _carveVLine(data, W, H, y1, y2, x, halfW, gridCfg) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      for (let dx = -halfW; dx <= halfW; dx++) {
        const tx = x + dx;
        if (y >= 1 && y < H - 1 && tx >= 1 && tx < W - 1) {
          if (data[y * W + tx] === gridCfg.wallTile) {
            data[y * W + tx] = gridCfg.floorTile;
          }
        }
      }
    }
  }

  _placeDoors(data, W, H, rooms, corridorCfg, gridCfg, rng) {
    const doorTile = corridorCfg.doorTile;
    if (doorTile == null) return;

    // Build a set of tiles that are inside rooms (don't place doors there)
    const roomTiles = new Set();
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          roomTiles.add(y * W + x);
        }
      }
    }

    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const idx = y * W + x;
        if (data[idx] !== gridCfg.floorTile) continue;
        if (roomTiles.has(idx)) continue;

        // Check for horizontal chokepoint (walls above and below)
        const wallAbove = data[(y - 1) * W + x] === gridCfg.wallTile;
        const wallBelow = data[(y + 1) * W + x] === gridCfg.wallTile;
        const floorLeft = data[y * W + (x - 1)] !== gridCfg.wallTile;
        const floorRight = data[y * W + (x + 1)] !== gridCfg.wallTile;

        // Check for vertical chokepoint (walls left and right)
        const wallLeft = data[y * W + (x - 1)] === gridCfg.wallTile;
        const wallRight = data[y * W + (x + 1)] === gridCfg.wallTile;
        const floorAbove = data[(y - 1) * W + x] !== gridCfg.wallTile;
        const floorBelow = data[(y + 1) * W + x] !== gridCfg.wallTile;

        const isChokepoint = (wallAbove && wallBelow && floorLeft && floorRight) ||
                             (wallLeft && wallRight && floorAbove && floorBelow);

        if (isChokepoint && rng() < corridorCfg.doorChance) {
          data[idx] = doorTile;
        }
      }
    }
  }

  _placeSpawns(template, entranceRoom) {
    if (!entranceRoom) return [{ x: 2, y: 2, type: 'player_start' }];

    const spawns = [];
    const count = (template.spawns && template.spawns.count) || 4;
    // 2x2 grid at room center
    const baseX = entranceRoom.cx - 1;
    const baseY = entranceRoom.cy - 1;
    for (let i = 0; i < count; i++) {
      spawns.push({
        x: baseX + (i % 2),
        y: baseY + Math.floor(i / 2),
        type: 'player_start',
      });
    }
    return spawns;
  }

  _placeExits(template, context, entranceRoom, exitRoom, data, W) {
    const exitsCfg = template.exits;
    if (!exitsCfg) return [];

    const exits = [];
    const depth = context.depth || 0;
    // context.maxDepth (from expedition) overrides the template's depth.max
    const maxDepth = context.maxDepth || (template.depth && template.depth.max) || 10;

    // Entrance exit (stairs back to source)
    if (exitsCfg.entrance && entranceRoom) {
      const ex = entranceRoom.cx;
      const ey = entranceRoom.y; // Top edge of room
      const tile = exitsCfg.entrance.tile || 8;
      data[ey * W + ex] = tile;
      exits.push({
        x: ex,
        y: ey,
        leadsTo: context.fromDungeon,
        type: 'stairs_up',
        spawnX: context.exitX,
        spawnY: context.exitY,
      });
    }

    // Descent exit (stairs to next depth or terminal)
    // If hideDescentOnLast is set, skip descent stairs on the final level
    const isLastLevel = depth >= maxDepth;
    const hideDescent = exitsCfg.descent && exitsCfg.descent.hideDescentOnLast && isLastLevel;
    if (exitsCfg.descent && exitRoom && !hideDescent) {
      const ex = exitRoom.cx;
      const ey = exitRoom.y + exitRoom.h - 1; // Bottom edge of room
      const tile = exitsCfg.descent.tile || 6;
      data[ey * W + ex] = tile;

      const leadsTo = isLastLevel ? context.fromDungeon : template.id;
      exits.push({
        x: ex,
        y: ey,
        leadsTo,
        type: 'stairs_down',
        depth: depth + 1,
      });
    }

    return exits;
  }

  _placeMonsters(template, rooms, rng, depth) {
    const monstersCfg = template.monsters;
    if (!monstersCfg || !monstersCfg.pool || monstersCfg.pool.length === 0) return [];

    const budget = (monstersCfg.budget.base || 0) + (monstersCfg.budget.perDepth || 0) * depth;
    const maxPerRoom = monstersCfg.maxPerRoom || 4;
    const avoidEntrance = monstersCfg.avoidEntranceRoom !== false;

    // Filter pool by minDepth
    const pool = monstersCfg.pool.filter(m => depth >= (m.minDepth || 0));
    if (pool.length === 0) return [];

    // Build weighted selection
    const totalWeight = pool.reduce((sum, m) => sum + (m.weight || 1), 0);

    // Get eligible rooms
    const eligibleRooms = rooms.filter(r => {
      if (avoidEntrance && r.tag === 'entrance') return false;
      return true;
    });
    if (eligibleRooms.length === 0) return [];

    const spawns = [];
    let remaining = budget;
    const roomCounts = new Map();
    const minSpacing = CONSTANTS.MONSTER_MIN_SPAWN_SPACING;

    while (remaining > 0) {
      // Pick a random room
      const room = eligibleRooms[Math.floor(rng() * eligibleRooms.length)];
      const roomKey = `${room.x},${room.y}`;
      const count = roomCounts.get(roomKey) || 0;
      if (count >= maxPerRoom) {
        // Try to find another room
        remaining--;
        continue;
      }

      // Weighted random monster selection
      let roll = rng() * totalWeight;
      let chosen = pool[0];
      for (const m of pool) {
        roll -= (m.weight || 1);
        if (roll <= 0) { chosen = m; break; }
      }

      const cost = chosen.cost || 1;
      if (cost > remaining) { remaining--; continue; }

      // Random position within room, retry up to 5 times for spacing
      let mx, my, placed = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        mx = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
        my = room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
        let tooClose = false;
        for (const s of spawns) {
          const dx = mx - s.x, dy = my - s.y;
          if (Math.sqrt(dx * dx + dy * dy) < minSpacing) { tooClose = true; break; }
        }
        if (!tooClose) { placed = true; break; }
      }
      if (!placed) { remaining--; continue; }

      spawns.push({ type: chosen.type, x: mx, y: my, count: 1 });
      roomCounts.set(roomKey, count + 1);
      remaining -= cost;
    }

    return spawns;
  }

  _placeItems(template, rooms, rng, data, W, H, gridCfg) {
    const itemsCfg = template.items;
    if (!itemsCfg || !itemsCfg.pool || itemsCfg.pool.length === 0) return [];

    const count = this._randRange(rng, itemsCfg.countRange || { min: 1, max: 3 });
    const totalWeight = itemsCfg.pool.reduce((sum, i) => sum + (i.weight || 1), 0);
    const spawns = [];
    const typeCounts = new Map();

    for (let i = 0; i < count; i++) {
      // Weighted selection
      let roll = rng() * totalWeight;
      let chosen = itemsCfg.pool[0];
      for (const item of itemsCfg.pool) {
        roll -= (item.weight || 1);
        if (roll <= 0) { chosen = item; break; }
      }

      // Check max per type
      const tc = typeCounts.get(chosen.type) || 0;
      if (chosen.max && tc >= chosen.max) continue;

      // Random room, random walkable tile
      const room = rooms[Math.floor(rng() * rooms.length)];
      const ix = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
      const iy = room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2));

      // Verify it's a floor tile
      const tileId = data[iy * W + ix];
      if (tileId !== gridCfg.floorTile && tileId !== (gridCfg.altFloorTile || gridCfg.floorTile)) continue;

      spawns.push({ type: chosen.type, x: ix, y: iy });
      typeCounts.set(chosen.type, tc + 1);
    }

    return spawns;
  }

  _placeNPCs(template, rooms, rng) {
    // Templates can define NPC spawns in requiredRooms
    const spawns = [];
    for (const room of rooms) {
      if (room.def && room.def.npcSpawns) {
        for (const npc of room.def.npcSpawns) {
          spawns.push({
            type: npc.type,
            x: room.cx,
            y: room.cy,
          });
        }
      }
    }
    return spawns;
  }

  _buildTriggers(template, context, rooms, depth) {
    if (!template.triggers) return [];
    const instanceId = `${template.id}_${context.depth || 0}`;

    // Build room coordinate lookup: { tag: { cx, cy, x, y, w, h } }
    const roomCoords = {};
    for (const room of rooms) {
      if (room.tag) {
        roomCoords[room.tag] = room;
      }
    }

    // Remap trigger depth filters when expedition overrides maxDepth
    const templateMaxDepth = (template.depth && template.depth.max) || 10;
    const ctxMaxDepth = context && context.maxDepth;

    const output = [];
    for (const t of template.triggers) {
      // Filter by depth (remap boss-floor triggers to expedition's final floor)
      let trigDepth = t.depth;
      if (ctxMaxDepth && trigDepth != null && trigDepth === templateMaxDepth) {
        trigDepth = ctxMaxDepth;
      }
      if (trigDepth != null && trigDepth !== depth) continue;
      if (t.minDepth != null && depth < t.minDepth) continue;
      if (t.maxDepth != null && depth > t.maxDepth) continue;

      // Filter by requiresRoom — skip if tagged room doesn't exist on this level
      if (t.requiresRoom && !roomCoords[t.requiresRoom]) continue;

      // Deep clone and do placeholder replacement
      let triggerJson = JSON.stringify(t);
      triggerJson = triggerJson.replace(/\{instanceId\}/g, instanceId);

      // Replace room coordinate placeholders: {tag.cx}, {tag.cy}, {tag.x}, {tag.y}
      for (const [tag, room] of Object.entries(roomCoords)) {
        triggerJson = triggerJson.replace(new RegExp(`\\{${tag}\\.cx\\}`, 'g'), String(room.cx));
        triggerJson = triggerJson.replace(new RegExp(`\\{${tag}\\.cy\\}`, 'g'), String(room.cy));
        triggerJson = triggerJson.replace(new RegExp(`\\{${tag}\\.x\\}`, 'g'), String(room.x));
        triggerJson = triggerJson.replace(new RegExp(`\\{${tag}\\.y\\}`, 'g'), String(room.y));
      }

      const trigger = JSON.parse(triggerJson);

      // Parse numeric values in actions that may have been stringified
      if (trigger.actions) {
        for (const action of trigger.actions) {
          if (action.x != null) action.x = Number(action.x);
          if (action.y != null) action.y = Number(action.y);
        }
      }
      if (trigger.filter) {
        for (const key of Object.keys(trigger.filter)) {
          const val = trigger.filter[key];
          if (typeof val === 'string' && /^\d+$/.test(val)) {
            trigger.filter[key] = Number(val);
          }
        }
      }

      // Clean up template-only fields
      delete trigger.depth;
      delete trigger.minDepth;
      delete trigger.maxDepth;
      delete trigger.requiresRoom;

      output.push(trigger);
    }

    return output;
  }

  _randRange(rng, range) {
    if (typeof range === 'number') return range;
    return range.min + Math.floor(rng() * (range.max - range.min + 1));
  }
}

module.exports = DungeonGenerator;
