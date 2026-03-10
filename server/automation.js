// Per-player automation state: structures, resources, production timers
// Data-driven: reads structure definitions from content/entities/structures.json

const CONSTANTS = require('../shared/constants');

class Automation {
  constructor(content) {
    this.content = content;
    this.playerStates = new Map(); // playerId -> AutoState
    this._gridConfig = null;      // computed grid config (blocked cells, etc.)
  }

  // Get or create automation state for a player
  getState(playerId) {
    if (!this.playerStates.has(playerId)) {
      this.playerStates.set(playerId, {
        resources: { silicon: 0 },
        structures: {},       // structureId -> { count, placements: [{x,y}] }
        productionTimers: {}, // structureId -> seconds accumulated
        claimedMilestones: [],// indices of milestones already claimed
        stats: {
          totalSiliconProduced: 0,
          totalSiliconSpent: 0,
          totalEnergyGenerated: 0,
        },
      });
    }
    return this.playerStates.get(playerId);
  }

  // Add resources (called when player picks up silicon or production ticks)
  addResource(playerId, resourceType, amount) {
    const state = this.getState(playerId);
    if (!state.resources[resourceType]) state.resources[resourceType] = 0;
    state.resources[resourceType] += amount;
    if (resourceType === 'silicon') {
      state.stats.totalSiliconProduced += amount;
    }
  }

  // Get resource count
  getResource(playerId, resourceType) {
    const state = this.getState(playerId);
    return state.resources[resourceType] || 0;
  }

  // Spend resources (returns true if successful)
  spendResources(playerId, costs) {
    const state = this.getState(playerId);
    // Check all costs first
    for (const [resource, amount] of Object.entries(costs)) {
      if ((state.resources[resource] || 0) < amount) return false;
    }
    // Deduct
    for (const [resource, amount] of Object.entries(costs)) {
      state.resources[resource] -= amount;
      if (resource === 'silicon') {
        state.stats.totalSiliconSpent += amount;
      }
    }
    return true;
  }

  // Check if a grid cell is occupied by any structure for a player
  isCellOccupied(playerId, gridX, gridY) {
    const state = this.getState(playerId);
    for (const structData of Object.values(state.structures)) {
      if (structData.placements) {
        for (const p of structData.placements) {
          if (p.x === gridX && p.y === gridY) return true;
        }
      }
    }
    return false;
  }

  // Check if a cell is blocked (wall, building, etc.)
  isCellBlocked(gridX, gridY) {
    const config = this.getGridConfig();
    if (!config) return true;
    if (gridX < 0 || gridY < 0 || gridX >= config.gridWidth || gridY >= config.gridHeight) return true;
    return config.blockedSet && config.blockedSet.has(gridY * config.gridWidth + gridX);
  }

  // Build a structure at a grid position (returns true if successful)
  // gridX and gridY are required — every placement needs a position on the grid.
  build(playerId, structureId, gridX, gridY) {
    if (gridX === undefined || gridY === undefined) return false;

    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const def = structures[structureId];
    if (!def) return false;

    const state = this.getState(playerId);
    if (!state.structures[structureId]) {
      state.structures[structureId] = { count: 0, placements: [] };
    }
    const structData = state.structures[structureId];

    if (def.maxCount && structData.count >= def.maxCount) return false;

    // Validate grid position
    if (this.isCellBlocked(gridX, gridY)) return false;
    if (this.isCellOccupied(playerId, gridX, gridY)) return false;

    if (!this.spendResources(playerId, def.cost)) return false;

    structData.count += 1;
    structData.placements.push({ x: gridX, y: gridY });
    if (!state.productionTimers[structureId]) {
      state.productionTimers[structureId] = 0;
    }
    return true;
  }

  // Tick production for a player (called each game tick)
  updateProduction(playerId, dt) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const state = this.getState(playerId);
    const produced = [];

    for (const [structureId, structData] of Object.entries(state.structures)) {
      const count = typeof structData === 'object' ? structData.count : structData;
      if (count <= 0) continue;
      const def = structures[structureId];
      if (!def || !def.effect) continue;

      if (def.effect.type === 'resource_production') {
        if (!state.productionTimers[structureId]) state.productionTimers[structureId] = 0;
        state.productionTimers[structureId] += dt;

        const interval = def.effect.intervalSeconds;
        while (state.productionTimers[structureId] >= interval) {
          state.productionTimers[structureId] -= interval;
          const amount = def.effect.amount * count;
          this.addResource(playerId, def.effect.produces, amount);
          produced.push({ resource: def.effect.produces, amount });
        }
      }
    }

    return produced;
  }

  // Track energy generated by automation structures (called from game loop)
  trackEnergyGenerated(playerId, amount) {
    const state = this.getState(playerId);
    state.stats.totalEnergyGenerated += amount;
  }

  // Get energy regen rate for a player from solar panels (per second)
  getEnergyRegenRate(playerId, currentRoomId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const state = this.getState(playerId);
    let regenPerSecond = 0;

    for (const [structureId, structData] of Object.entries(state.structures)) {
      const count = typeof structData === 'object' ? structData.count : structData;
      if (count <= 0) continue;
      const def = structures[structureId];
      if (!def || !def.effect || def.effect.type !== 'energy_regen') continue;

      // Check room requirement
      if (def.effect.requiresRoom && def.effect.requiresRoom !== currentRoomId) continue;

      regenPerSecond += (def.effect.amount * count) / def.effect.intervalSeconds;
    }

    return regenPerSecond;
  }

  // Grant a structure for free (used by scripting actions)
  grantStructure(playerId, structureId, gridX, gridY) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const def = structures[structureId];
    if (!def) return false;

    const state = this.getState(playerId);
    if (!state.structures[structureId]) {
      state.structures[structureId] = { count: 0, placements: [] };
    }
    const structData = state.structures[structureId];
    if (def.maxCount && structData.count >= def.maxCount) return false;

    structData.count += 1;

    // Auto-assign a grid position if none provided
    if (gridX !== undefined && gridY !== undefined) {
      structData.placements.push({ x: gridX, y: gridY });
    } else {
      // Find first open cell
      const pos = this._findOpenCell(playerId);
      if (pos) structData.placements.push(pos);
    }

    if (!state.productionTimers[structureId]) {
      state.productionTimers[structureId] = 0;
    }
    return true;
  }

  // Find the first open buildable cell for auto-placement
  _findOpenCell(playerId) {
    const config = this.getGridConfig();
    if (!config) return null;
    for (let y = 0; y < config.gridHeight; y++) {
      for (let x = 0; x < config.gridWidth; x++) {
        if (!this.isCellBlocked(x, y) && !this.isCellOccupied(playerId, x, y)) {
          return { x, y };
        }
      }
    }
    return null;
  }

  // Check for newly unlocked milestone rewards (returns array of gives)
  checkMilestones(playerId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const milestones = structures._milestoneRewards || [];
    const state = this.getState(playerId);
    if (!state.claimedMilestones) state.claimedMilestones = [];

    // Count total structures
    let totalStructures = 0;
    for (const [id, structData] of Object.entries(state.structures)) {
      totalStructures += typeof structData === 'object' ? structData.count : structData;
    }

    const newRewards = [];
    for (let i = 0; i < milestones.length; i++) {
      if (state.claimedMilestones.includes(i)) continue;
      if (totalStructures >= milestones[i].threshold) {
        state.claimedMilestones.push(i);
        const m = milestones[i];
        newRewards.push({ type: 'item', itemId: m.itemId, count: m.count || 1 });
      }
    }
    return newRewards;
  }

  // Execute a trade with MERIDIAN-7
  trade(playerId, tradeId) {
    const trades = {
      damage_booster: { cost: { silicon: 5 }, gives: [{ type: 'item', itemId: 'damage_booster_chip', count: 1 }] },
      medical_supplies: { cost: { silicon: 10 }, gives: [{ type: 'item', itemId: 'medical_supplies', count: 5 }] },
    };

    const tradeDef = trades[tradeId];
    if (!tradeDef) return null;

    if (!this.spendResources(playerId, tradeDef.cost)) return null;

    return tradeDef.gives;
  }

  // Compute and cache grid configuration from dungeon data
  getGridConfig() {
    if (this._gridConfig) return this._gridConfig;

    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const gridCfg = structures._gridConfig;
    if (!gridCfg) return null;

    const dungeon = this.content.getDungeon ? this.content.getDungeon(gridCfg.dungeonId) : null;
    if (!dungeon) return null;

    const { gridWidth, gridHeight, dungeonOffsetX, dungeonOffsetY } = gridCfg;
    const blockedSet = new Set();
    const preBuilt = [];

    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const dungeonX = gx + dungeonOffsetX;
        const dungeonY = gy + dungeonOffsetY;
        if (dungeonX < 0 || dungeonY < 0 || dungeonX >= dungeon.width || dungeonY >= dungeon.height) {
          blockedSet.add(gy * gridWidth + gx);
          continue;
        }
        const tileId = dungeon.data[dungeonY * dungeon.width + dungeonX];
        if (tileId === 3 || tileId === 4) {
          // Wall or door = blocked
          blockedSet.add(gy * gridWidth + gx);
        } else if (tileId === 7) {
          // Existing array infrastructure = blocked + pre-built visual
          blockedSet.add(gy * gridWidth + gx);
          preBuilt.push({ x: gx, y: gy, label: 'Array Solar Collector' });
        }
        // tileId 1 (floor) and 2 (sand/feature) and 8 (exit) = buildable
        // Exit tile (8) should be blocked too
        if (tileId === 8) {
          blockedSet.add(gy * gridWidth + gx);
        }
      }
    }

    this._gridConfig = {
      gridWidth,
      gridHeight,
      dungeonOffsetX,
      dungeonOffsetY,
      dungeonId: gridCfg.dungeonId,
      blockedSet,
      preBuilt,
    };

    return this._gridConfig;
  }

  // Get all placements for a player (for dungeon sync)
  getPlacements(playerId) {
    const state = this.getState(playerId);
    const placements = [];
    for (const [structureId, structData] of Object.entries(state.structures)) {
      if (typeof structData === 'object' && structData.placements) {
        for (const p of structData.placements) {
          placements.push({ structureId, x: p.x, y: p.y });
        }
      }
    }
    return placements;
  }

  // Get state formatted for client
  getStateForClient(playerId) {
    const state = this.getState(playerId);
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const config = this.getGridConfig();

    const structureList = [];
    const allPlacements = [];
    let totalStructures = 0;

    for (const [id, def] of Object.entries(structures)) {
      if (id.startsWith('_')) continue; // skip meta keys
      const structData = state.structures[id] || { count: 0, placements: [] };
      const count = typeof structData === 'object' ? structData.count : structData;
      totalStructures += count;

      structureList.push({
        id,
        name: def.name,
        description: def.description,
        cost: def.cost,
        maxCount: def.maxCount || 0,
        count,
        gridIcon: def.gridIcon || '?',
        gridColor: def.gridColor || '#888',
      });

      // Collect placements
      if (typeof structData === 'object' && structData.placements) {
        for (const p of structData.placements) {
          allPlacements.push({ structureId: id, x: p.x, y: p.y });
        }
      }
    }

    // Compute automation level
    const levels = structures._automationLevels || [];
    let automationLevel = 0;
    let automationLevelName = 'None';
    let nextThreshold = levels.length > 0 ? levels[0].threshold : 1;
    let automationProgress = 0;

    for (let i = 0; i < levels.length; i++) {
      if (totalStructures >= levels[i].threshold) {
        automationLevel = i + 1;
        automationLevelName = levels[i].name;
        nextThreshold = (i + 1 < levels.length) ? levels[i + 1].threshold : levels[i].threshold;
      }
    }

    if (automationLevel > 0 && automationLevel < levels.length) {
      const currentThreshold = levels[automationLevel - 1].threshold;
      automationProgress = (totalStructures - currentThreshold) / (nextThreshold - currentThreshold);
    } else if (automationLevel >= levels.length) {
      automationProgress = 1;
    }

    // Compute production rates
    let siliconPerMinute = 0;
    let energyRegenPerSecond = 0;
    for (const [id, def] of Object.entries(structures)) {
      if (id.startsWith('_')) continue;
      const structData = state.structures[id] || { count: 0, placements: [] };
      const count = typeof structData === 'object' ? structData.count : structData;
      if (count <= 0 || !def.effect) continue;

      if (def.effect.type === 'resource_production') {
        siliconPerMinute += (def.effect.amount * count * 60) / def.effect.intervalSeconds;
      }
      if (def.effect.type === 'energy_regen') {
        energyRegenPerSecond += (def.effect.amount * count) / def.effect.intervalSeconds;
      }
    }

    const trades = [
      { id: 'damage_booster', name: 'Damage Booster Chip', cost: { silicon: 5 } },
      { id: 'medical_supplies', name: 'Medical Supplies x5', cost: { silicon: 10 } },
    ];

    // Build milestone rewards list with claimed status
    const milestones = (structures._milestoneRewards || []).map((m, i) => ({
      threshold: m.threshold,
      name: m.name,
      description: m.description,
      icon: m.icon || '?',
      claimed: (state.claimedMilestones || []).includes(i),
      unlocked: totalStructures >= m.threshold,
    }));

    const result = {
      resources: { ...state.resources },
      structures: structureList,
      trades,
      milestones,
      stats: {
        totalSiliconProduced: state.stats.totalSiliconProduced,
        totalSiliconSpent: state.stats.totalSiliconSpent,
        totalEnergyGenerated: state.stats.totalEnergyGenerated,
        siliconPerMinute,
        energyRegenPerSecond,
        automationLevel,
        automationLevelName,
        automationProgress,
        nextThreshold,
        totalStructures,
      },
    };

    // Include grid data
    if (config) {
      // Convert blockedSet to array for serialization
      const blocked = [];
      if (config.blockedSet) {
        for (const idx of config.blockedSet) {
          blocked.push({ x: idx % config.gridWidth, y: Math.floor(idx / config.gridWidth) });
        }
      }

      result.grid = {
        width: config.gridWidth,
        height: config.gridHeight,
        offsetX: config.dungeonOffsetX,
        offsetY: config.dungeonOffsetY,
        blocked,
        preBuilt: config.preBuilt || [],
        placements: allPlacements,
      };
    }

    return result;
  }

  // Create a copy of dungeon data with player's automation placements merged in
  getOverlayedMapData(playerId, dungeon) {
    const config = this.getGridConfig();
    if (!config || dungeon.id !== config.dungeonId) return dungeon;

    const placements = this.getPlacements(playerId);
    if (placements.length === 0) return dungeon;

    // Shallow copy the dungeon, deep copy the data array
    const overlayed = Object.assign({}, dungeon);
    overlayed.data = dungeon.data.slice();

    const structures = this.content.getStructures ? this.content.getStructures() : {};
    for (const p of placements) {
      const dungeonX = p.x + config.dungeonOffsetX;
      const dungeonY = p.y + config.dungeonOffsetY;
      if (dungeonX < 0 || dungeonY < 0 || dungeonX >= dungeon.width || dungeonY >= dungeon.height) continue;
      const idx = dungeonY * dungeon.width + dungeonX;

      // Solar panels become tile 7 (solar panel tile)
      if (p.structureId === 'solar_panel') {
        overlayed.data[idx] = 7;
      }
      // Silicon harvesters become tile 2 (feature/sand) as a visible marker
      if (p.structureId === 'silicon_harvester') {
        overlayed.data[idx] = 2;
      }
    }

    return overlayed;
  }

  // Get visual-only harvester entity data for state broadcast
  // Returns NPC-like entries for silicon_harvester placements
  getHarvesterEntities(playerId) {
    const config = this.getGridConfig();
    if (!config) return [];

    const state = this.getState(playerId);
    const harvesterData = state.structures.silicon_harvester;
    if (!harvesterData || !harvesterData.placements || harvesterData.placements.length === 0) return [];

    const ts = CONSTANTS.TILE_SIZE;
    const entities = [];
    for (let i = 0; i < harvesterData.placements.length; i++) {
      const p = harvesterData.placements[i];
      const dungeonX = p.x + config.dungeonOffsetX;
      const dungeonY = p.y + config.dungeonOffsetY;
      entities.push({
        id: `harvester_${playerId}_${i}`,
        type: 'scrap_drone',
        name: 'Silicon Harvester',
        x: (dungeonX + 0.5) * ts,
        y: (dungeonY + 0.5) * ts,
        decorative: true,
      });
    }
    return entities;
  }

  // Serialize automation state for persistence (returns plain JSON-safe object)
  serializeState(playerId) {
    if (!this.playerStates.has(playerId)) return null;
    return JSON.parse(JSON.stringify(this.playerStates.get(playerId)));
  }

  // Restore automation state from a saved session
  restoreState(playerId, data) {
    if (!data) return;
    this.playerStates.set(playerId, {
      resources: data.resources || { silicon: 0 },
      structures: data.structures || {},
      productionTimers: data.productionTimers || {},
      claimedMilestones: data.claimedMilestones || [],
      stats: data.stats || {
        totalSiliconProduced: 0,
        totalSiliconSpent: 0,
        totalEnergyGenerated: 0,
      },
    });
  }

  // Remove player state on disconnect
  removePlayer(playerId) {
    // Keep state so it persists across disconnects within the same server session
  }
}

module.exports = Automation;
