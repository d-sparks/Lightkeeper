// Per-player automation state: structures, resources, production timers
// Data-driven: reads structure definitions from content/entities/structures.json

const CONSTANTS = require('../shared/constants');

class Automation {
  constructor(content) {
    this.content = content;
    this.playerStates = new Map(); // playerId -> AutoState
    this._gridConfig = null;         // computed 12x12 grid config (blocked cells, etc.)
    this._gridConfigExpanded = null; // computed 16x16 grid config (unlocked at level 6)
  }

  // Get or create automation state for a player
  getState(playerId) {
    if (!this.playerStates.has(playerId)) {
      this.playerStates.set(playerId, {
        resources: { salvage: 0 },
        structures: {},           // structureId -> { count, placements: [{x,y}] }
        productionTimers: {},     // structureId -> seconds accumulated
        replicationTimers: {},    // structureId -> seconds accumulated (for self-replicating structures)
        claimedMilestones: [],    // indices of milestones already claimed
        gridExpanded: false,      // true once player reaches automation level 6 (20 structures)
        structureHp: {},          // "structureId:x:y" -> current HP (0 = destroyed)
        raidTimer: 0,             // seconds since last raid check
        repairTimer: 0,           // seconds since last repair tick
        lastRaidResult: null,     // last raid outcome for client display
        stats: {
          totalSalvageProduced: 0,
          totalSalvageSpent: 0,
          totalEnergyGenerated: 0,
        },
      });
    }
    return this.playerStates.get(playerId);
  }

  // Add resources (called when player picks up salvage or production ticks)
  addResource(playerId, resourceType, amount) {
    const state = this.getState(playerId);
    if (!state.resources[resourceType]) state.resources[resourceType] = 0;
    state.resources[resourceType] += amount;
    if (resourceType === 'salvage') {
      state.stats.totalSalvageProduced += amount;
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
      if (resource === 'salvage') {
        state.stats.totalSalvageSpent += amount;
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
  isCellBlocked(playerId, gridX, gridY) {
    const config = this.getGridConfig(playerId);
    if (!config) return true;
    if (gridX < 0 || gridY < 0 || gridX >= config.gridWidth || gridY >= config.gridHeight) return true;
    return config.blockedSet && config.blockedSet.has(gridY * config.gridWidth + gridX);
  }

  // Get the current automation level for a player
  getAutomationLevel(playerId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const state = this.getState(playerId);
    const levels = structures._automationLevels || [];

    let totalStructures = 0;
    for (const structData of Object.values(state.structures)) {
      totalStructures += typeof structData === 'object' ? structData.count : structData;
    }

    let level = 0;
    for (let i = 0; i < levels.length; i++) {
      if (totalStructures >= levels[i].threshold) level = i + 1;
    }
    return level;
  }

  // Get the path-based cost multiplier from player flags.
  // Shutdown path: +50% cost (infrastructure degraded, Array offline).
  // Control path: -25% cost (full Array access, optimized logistics).
  // Merge path / no path: no modifier.
  _getPathCostMultiplier(playerFlags) {
    if (!playerFlags) return 1.0;
    if (playerFlags['chose_path_shutdown']) return 1.5;
    if (playerFlags['chose_path_control']) return 0.75;
    return 1.0;
  }

  // Build a structure at a grid position (returns true if successful)
  // gridX and gridY are required — every placement needs a position on the grid.
  // playerFlags: optional object of { flagName: value } for requiresFlag checks.
  build(playerId, structureId, gridX, gridY, playerFlags) {
    if (gridX === undefined || gridY === undefined) return false;

    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const def = structures[structureId];
    if (!def) return false;

    // Check unlock level requirement
    if (def.unlockLevel && this.getAutomationLevel(playerId) < def.unlockLevel) return false;

    // Check ending-path flag requirement (only enforced when playerFlags is provided)
    if (def.requiresFlag && playerFlags) {
      if (!playerFlags[def.requiresFlag]) return false;
    }

    const state = this.getState(playerId);
    if (!state.structures[structureId]) {
      state.structures[structureId] = { count: 0, placements: [] };
    }
    const structData = state.structures[structureId];

    if (def.maxCount && structData.count >= def.maxCount) return false;

    // Validate grid position
    if (this.isCellBlocked(playerId, gridX, gridY)) return false;
    if (this.isCellOccupied(playerId, gridX, gridY)) return false;

    // Apply path-based cost modifier (shutdown +50%, control -25%)
    const costMultiplier = this._getPathCostMultiplier(playerFlags);
    const scaledCost = {};
    for (const [resource, amount] of Object.entries(def.cost)) {
      scaledCost[resource] = Math.ceil(amount * costMultiplier);
    }
    if (!this.spendResources(playerId, scaledCost)) return false;

    structData.count += 1;
    structData.placements.push({ x: gridX, y: gridY });
    if (!state.productionTimers[structureId]) {
      state.productionTimers[structureId] = 0;
    }
    return true;
  }

  // Returns the adjacency multiplier for a single structure placement at (x, y).
  // Scans all other placed structures for adjacencyBonus entries targeting structureId.
  // Each adjacent booster adds (booster.multiplier - 1) to the base multiplier of 1.0,
  // so two adjacent refineries each with multiplier 2.0 give a total of 3.0.
  _getAdjacencyMultiplier(playerId, x, y, structureId, structures) {
    const state = this.getState(playerId);
    let multiplier = 1.0;

    for (const [boosterId, boosterDef] of Object.entries(structures)) {
      if (boosterId.startsWith('_')) continue;
      if (!boosterDef.adjacencyBonus) continue;
      if (!boosterDef.adjacencyBonus.targets.includes(structureId)) continue;

      const boosterData = state.structures[boosterId];
      if (!boosterData || !boosterData.placements) continue;

      for (const bp of boosterData.placements) {
        const dx = Math.abs(bp.x - x);
        const dy = Math.abs(bp.y - y);
        if (dx + dy === 1) {
          // Orthogonally adjacent — apply additive bonus
          multiplier += (boosterDef.adjacencyBonus.multiplier - 1);
        }
      }
    }

    return multiplier;
  }

  // Returns total effective resource amount produced in one tick interval for a structure,
  // summing per-placement amounts with adjacency bonuses applied.
  _getTotalEffectiveAmount(playerId, structureId, structData, def, structures) {
    const placements = typeof structData === 'object' ? (structData.placements || []) : [];
    const count = typeof structData === 'object' ? structData.count : structData;

    // If no placement data recorded, fall back to flat count-based amount
    if (placements.length === 0) return def.effect.amount * count;

    let total = 0;
    for (const p of placements) {
      total += def.effect.amount * this._getAdjacencyMultiplier(playerId, p.x, p.y, structureId, structures);
    }
    return total;
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
          const amount = this._getTotalEffectiveAmount(playerId, structureId, structData, def, structures);
          this.addResource(playerId, def.effect.produces, amount);
          produced.push({ resource: def.effect.produces, amount });
        }
      }

      // dual_production: process each sub-effect independently
      if (def.effect.type === 'dual_production' && Array.isArray(def.effect.produces)) {
        for (let si = 0; si < def.effect.produces.length; si++) {
          const sub = def.effect.produces[si];
          if (sub.type !== 'resource_production') continue; // energy_regen handled in getEnergyRegenRate
          const timerKey = `${structureId}_sub${si}`;
          if (!state.productionTimers[timerKey]) state.productionTimers[timerKey] = 0;
          state.productionTimers[timerKey] += dt;
          while (state.productionTimers[timerKey] >= sub.intervalSeconds) {
            state.productionTimers[timerKey] -= sub.intervalSeconds;
            const amount = sub.amount * count; // no adjacency for dual_production sub-effects
            this.addResource(playerId, sub.produces, amount);
            produced.push({ resource: sub.produces, amount });
          }
        }
      }

      // Self-replication: grant a free additional structure on a timer
      if (def.selfReplication) {
        if (!state.replicationTimers[structureId]) state.replicationTimers[structureId] = 0;
        state.replicationTimers[structureId] += dt;
        const repInterval = def.selfReplication.intervalSeconds;
        while (state.replicationTimers[structureId] >= repInterval) {
          state.replicationTimers[structureId] -= repInterval;
          // Only replicate if below maxCount
          const currentCount = typeof structData === 'object' ? structData.count : structData;
          if (!def.maxCount || currentCount < def.maxCount) {
            const granted = this.grantStructure(playerId, structureId);
            if (granted) produced.push({ resource: 'replication', structureId });
          }
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
      if (!def || !def.effect) continue;

      if (def.effect.type === 'energy_regen') {
        // Check room requirement
        if (def.effect.requiresRoom && def.effect.requiresRoom !== currentRoomId) continue;
        regenPerSecond += (def.effect.amount * count) / def.effect.intervalSeconds;
      }

      // dual_production: check for energy_regen sub-effects
      if (def.effect.type === 'dual_production' && Array.isArray(def.effect.produces)) {
        for (const sub of def.effect.produces) {
          if (sub.type !== 'energy_regen') continue;
          if (sub.requiresRoom && sub.requiresRoom !== currentRoomId) continue;
          regenPerSecond += (sub.amount * count) / sub.intervalSeconds;
        }
      }
    }

    return regenPerSecond;
  }

  // Get total expedition cost reduction multiplier (0.0 to 1.0)
  getExpeditionCostReduction(playerId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const state = this.getState(playerId);
    let reduction = 0;

    for (const [structureId, structData] of Object.entries(state.structures)) {
      const count = typeof structData === 'object' ? structData.count : structData;
      if (count <= 0) continue;
      const def = structures[structureId];
      if (!def || !def.effect || def.effect.type !== 'expedition_cost_reduction') continue;
      reduction += def.effect.reduction * count;
    }

    return Math.min(reduction, 1); // cap at 100% reduction
  }

  // Get total defense rating from auto-turrets
  getDefenseRating(playerId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const state = this.getState(playerId);
    let rating = 0;

    for (const [structureId, structData] of Object.entries(state.structures)) {
      const count = typeof structData === 'object' ? structData.count : structData;
      if (count <= 0) continue;
      const def = structures[structureId];
      if (!def || !def.effect || def.effect.type !== 'defense_value') continue;
      rating += def.effect.amount * count;
    }

    return rating;
  }

  // Get total auto-repair rate from array_drone_bay structures (repairs per hour)
  getRepairRate(playerId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const state = this.getState(playerId);
    let repairsPerHour = 0;

    for (const [structureId, structData] of Object.entries(state.structures)) {
      const count = typeof structData === 'object' ? structData.count : structData;
      if (count <= 0) continue;
      const def = structures[structureId];
      if (!def || !def.effect || def.effect.type !== 'structure_repair') continue;
      repairsPerHour += def.effect.repairRate * count * (3600 / def.effect.intervalSeconds);
    }

    return repairsPerHour;
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
    const config = this.getGridConfig(playerId);
    if (!config) return null;
    for (let y = 0; y < config.gridHeight; y++) {
      for (let x = 0; x < config.gridWidth; x++) {
        if (!this.isCellBlocked(playerId, x, y) && !this.isCellOccupied(playerId, x, y)) {
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
    const expandedCfg = structures._gridConfigExpanded;
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
        newRewards.push({ type: 'item', itemId: m.itemId, count: m.count || 1, milestoneName: m.name, milestoneThreshold: m.threshold, milestoneIcon: m.icon || '★' });

        // At the Grid Expansion threshold (20 structures / automation level 6), expand grid to 16x16
        if (expandedCfg && m.threshold === 20) {
          state.gridExpanded = true;
          newRewards.push({ type: 'grid_expansion', newWidth: expandedCfg.gridWidth, newHeight: expandedCfg.gridHeight, milestoneName: 'Grid Expansion', milestoneThreshold: m.threshold, milestoneIcon: '⊞' });
        }
      }
    }
    return newRewards;
  }

  // Execute a trade with MERIDIAN-7
  trade(playerId, tradeId) {
    const trades = {
      damage_booster: { cost: { salvage: 5 }, gives: [{ type: 'item', itemId: 'damage_booster_chip', count: 1 }] },
      medical_supplies: { cost: { salvage: 10 }, gives: [{ type: 'item', itemId: 'medical_supplies', count: 5 }] },
    };

    const tradeDef = trades[tradeId];
    if (!tradeDef) return null;

    if (!this.spendResources(playerId, tradeDef.cost)) return null;

    return tradeDef.gives;
  }

  // Compute and cache grid configuration from dungeon data.
  // Pass playerId to get the player-specific config (expanded grid if unlocked).
  getGridConfig(playerId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};

    // Determine which config spec to use for this player
    const useExpanded = playerId && this.playerStates.has(playerId) && this.playerStates.get(playerId).gridExpanded;
    const cfgKey = useExpanded ? '_gridConfigExpanded' : '_gridConfig';
    const cacheKey = useExpanded ? '_gridConfigExpanded' : '_gridConfig';

    if (this[cacheKey]) return this[cacheKey];

    const gridCfg = structures[cfgKey];
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
        // tileId 1 (floor) and 2 (sand/feature) = buildable
        // Exit tile (8) should be blocked too
        if (tileId === 8) {
          blockedSet.add(gy * gridWidth + gx);
        }
      }
    }

    this[cacheKey] = {
      gridWidth,
      gridHeight,
      dungeonOffsetX,
      dungeonOffsetY,
      dungeonId: gridCfg.dungeonId,
      blockedSet,
      preBuilt,
    };

    return this[cacheKey];
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

  // Get state formatted for client.
  // playerFlags: optional { flagName: value } map; used to mark path-gated structures as locked.
  getStateForClient(playerId, playerFlags) {
    const state = this.getState(playerId);
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const config = this.getGridConfig(playerId);

    const structureList = [];
    const allPlacements = [];
    let totalStructures = 0;

    // Compute automation level first (needed for unlock gating)
    for (const [id, structData] of Object.entries(state.structures)) {
      const count = typeof structData === 'object' ? structData.count : structData;
      totalStructures += count;
    }
    const levels = structures._automationLevels || [];
    let automationLevel = 0;
    for (let i = 0; i < levels.length; i++) {
      if (totalStructures >= levels[i].threshold) automationLevel = i + 1;
    }

    // Path cost multiplier for displaying accurate build costs to the client
    const costMultiplier = this._getPathCostMultiplier(playerFlags);

    for (const [id, def] of Object.entries(structures)) {
      if (id.startsWith('_')) continue; // skip meta keys
      const structData = state.structures[id] || { count: 0, placements: [] };
      const count = typeof structData === 'object' ? structData.count : structData;

      // A structure is locked if: unlock level not met, OR requires a path flag the player lacks.
      const levelLocked = def.unlockLevel ? automationLevel < def.unlockLevel : false;
      const flagLocked = def.requiresFlag && playerFlags ? !playerFlags[def.requiresFlag] : false;

      // Scale displayed cost by path modifier so the UI shows the actual price
      const scaledCost = {};
      for (const [resource, amount] of Object.entries(def.cost)) {
        scaledCost[resource] = Math.ceil(amount * costMultiplier);
      }

      structureList.push({
        id,
        name: def.name,
        description: def.description,
        cost: scaledCost,
        maxCount: def.maxCount || 0,
        count,
        gridIcon: def.gridIcon || '?',
        gridColor: def.gridColor || '#888',
        unlockLevel: def.unlockLevel || 0,
        requiresFlag: def.requiresFlag || null,
        locked: levelLocked || flagLocked,
      });

      // Collect placements
      if (typeof structData === 'object' && structData.placements) {
        for (const p of structData.placements) {
          allPlacements.push({ structureId: id, x: p.x, y: p.y });
        }
      }
    }

    // Compute automation level name and progress
    let automationLevelName = 'None';
    let nextThreshold = levels.length > 0 ? levels[0].threshold : 1;
    let automationProgress = 0;

    for (let i = 0; i < levels.length; i++) {
      if (totalStructures >= levels[i].threshold) {
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

    // Compute production rates (including adjacency bonuses for resource_production)
    let salvagePerMinute = 0;
    let siliconPerMinute = 0;
    let energyRegenPerSecond = 0;
    let defenseRating = 0;
    for (const [id, def] of Object.entries(structures)) {
      if (id.startsWith('_')) continue;
      const structData = state.structures[id] || { count: 0, placements: [] };
      const count = typeof structData === 'object' ? structData.count : structData;
      if (count <= 0 || !def.effect) continue;

      if (def.effect.type === 'resource_production') {
        const effectiveAmount = this._getTotalEffectiveAmount(playerId, id, structData, def, structures);
        const perMinute = (effectiveAmount * 60) / def.effect.intervalSeconds;
        if (def.effect.produces === 'silicon') {
          siliconPerMinute += perMinute;
        } else {
          salvagePerMinute += perMinute;
        }
      }
      if (def.effect.type === 'energy_regen') {
        energyRegenPerSecond += (def.effect.amount * count) / def.effect.intervalSeconds;
      }
      if (def.effect.type === 'defense_value') {
        defenseRating += def.effect.amount * count;
      }
      if (def.effect.type === 'structure_repair') {
        // repairRate is summed separately via getRepairRate() and included in stats below
      }
      if (def.effect.type === 'dual_production' && Array.isArray(def.effect.produces)) {
        for (const sub of def.effect.produces) {
          if (sub.type === 'resource_production') {
            const perMinute = (sub.amount * count * 60) / sub.intervalSeconds;
            if (sub.produces === 'silicon') siliconPerMinute += perMinute;
            else salvagePerMinute += perMinute;
          }
          if (sub.type === 'energy_regen') {
            energyRegenPerSecond += (sub.amount * count) / sub.intervalSeconds;
          }
        }
      }
    }

    const trades = [
      { id: 'damage_booster', name: 'Damage Booster Chip', cost: { salvage: 5 } },
      { id: 'medical_supplies', name: 'Medical Supplies x5', cost: { salvage: 10 } },
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
        totalSalvageProduced: state.stats.totalSalvageProduced,
        totalSalvageSpent: state.stats.totalSalvageSpent,
        totalEnergyGenerated: state.stats.totalEnergyGenerated,
        salvagePerMinute,
        siliconPerMinute,
        energyRegenPerSecond,
        defenseRating,
        automationLevel,
        automationLevelName,
        automationProgress,
        nextThreshold,
        totalStructures,
        repairRate: this.getRepairRate(playerId),
        pathCostMultiplier: costMultiplier,
      },
    };

    // Include structure HP for placed structures
    const raidCfg = this._getRaidConfig();
    if (raidCfg) {
      const structureHpList = [];
      for (const [structureId, structData] of Object.entries(state.structures)) {
        if (!structData || !structData.placements) continue;
        for (const p of structData.placements) {
          const key = this._hpKey(structureId, p.x, p.y);
          const hp = state.structureHp[key] !== undefined ? state.structureHp[key] : raidCfg.structureMaxHp;
          structureHpList.push({ structureId, x: p.x, y: p.y, hp, maxHp: raidCfg.structureMaxHp });
        }
      }
      result.structureHp = structureHpList;
      result.lastRaidResult = state.lastRaidResult || null;
      result.raidEnabled = automationLevel >= raidCfg.minAutomationLevel;
    }

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
    const config = this.getGridConfig(playerId);
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
      // All other player structures become tile 2 (feature/sand) as a visible marker
      if (p.structureId !== 'solar_panel') {
        overlayed.data[idx] = 2;
      }
    }

    return overlayed;
  }

  // Get visual-only structure entity data for state broadcast
  getHarvesterEntities(playerId) {
    const config = this.getGridConfig(playerId);
    if (!config) return [];

    const state = this.getState(playerId);
    const ts = CONSTANTS.TILE_SIZE;
    const entities = [];

    // Structure types that show as decorative entities on the dayside map
    const visualStructures = [
      { id: 'salvage_harvester', type: 'scrap_drone', name: 'Salvage Harvester' },
      { id: 'silicon_refinery', type: 'scrap_drone', name: 'Silicon Refinery' },
      { id: 'auto_turret', type: 'scrap_drone', name: 'Auto-Turret' },
      { id: 'fabricator', type: 'scrap_drone', name: 'Fabricator' },
      { id: 'expedition_beacon', type: 'scrap_drone', name: 'Expedition Beacon' },
      { id: 'bio_harvester', type: 'scrap_drone', name: 'Bio-Harvester' },
      { id: 'symbiotic_node', type: 'scrap_drone', name: 'Symbiotic Node' },
      { id: 'array_drone_bay', type: 'scrap_drone', name: 'Array Drone Bay' },
    ];

    for (const vs of visualStructures) {
      const structData = state.structures[vs.id];
      if (!structData || !structData.placements || structData.placements.length === 0) continue;

      for (let i = 0; i < structData.placements.length; i++) {
        const p = structData.placements[i];
        const dungeonX = p.x + config.dungeonOffsetX;
        const dungeonY = p.y + config.dungeonOffsetY;
        entities.push({
          id: `${vs.id}_${playerId}_${i}`,
          type: vs.type,
          name: vs.name,
          x: (dungeonX + 0.5) * ts,
          y: (dungeonY + 0.5) * ts,
          decorative: true,
        });
      }
    }
    return entities;
  }

  // ─── Raid Event System ───────────────────────────────────────────────

  // Get the HP key for a structure placement
  _hpKey(structureId, x, y) {
    return `${structureId}:${x}:${y}`;
  }

  // Get or initialise structure HP for a placement
  getStructureHp(playerId, structureId, x, y) {
    const state = this.getState(playerId);
    const key = this._hpKey(structureId, x, y);
    const raidCfg = this._getRaidConfig();
    if (state.structureHp[key] === undefined) {
      state.structureHp[key] = raidCfg ? raidCfg.structureMaxHp : 100;
    }
    return state.structureHp[key];
  }

  _getRaidConfig() {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    return structures._raidConfig || null;
  }

  // Tick raid timer for a player. Returns a raid result object if a raid happened, null otherwise.
  updateRaidTimer(playerId, dt) {
    const raidCfg = this._getRaidConfig();
    if (!raidCfg) return null;

    const automationLevel = this.getAutomationLevel(playerId);
    if (automationLevel < raidCfg.minAutomationLevel) return null;

    const state = this.getState(playerId);
    state.raidTimer += dt;

    if (state.raidTimer < raidCfg.intervalSeconds) return null;
    state.raidTimer = 0;

    // Roll raid chance
    if (Math.random() > raidCfg.chance) {
      return { occurred: false, reason: 'chance_miss' };
    }

    return this._executeRaid(playerId, automationLevel, raidCfg);
  }

  // Execute a raid: compute damage to structures, apply turret defense
  _executeRaid(playerId, automationLevel, raidCfg) {
    const state = this.getState(playerId);
    const structures = this.content.getStructures ? this.content.getStructures() : {};

    // Determine raid strength
    const monsterCount = raidCfg.baseMonsters + (automationLevel - raidCfg.minAutomationLevel) * raidCfg.scalingPerLevel;
    const totalRaidDamage = monsterCount * raidCfg.baseDamagePerMonster;

    // Defense rating from turrets reduces damage
    const defenseRating = this.getDefenseRating(playerId);
    // Each point of defense negates 1 damage, minimum 0 total damage
    const effectiveDamage = Math.max(0, totalRaidDamage - defenseRating);

    // Pick which monster types participated (for flavor)
    const raidMonsters = [];
    for (let i = 0; i < monsterCount; i++) {
      raidMonsters.push(raidCfg.monsterPool[Math.floor(Math.random() * raidCfg.monsterPool.length)]);
    }

    // Collect all non-turret structure placements as potential targets
    const targets = [];
    for (const [structureId, structData] of Object.entries(state.structures)) {
      if (!structData || !structData.placements) continue;
      const def = structures[structureId];
      if (!def) continue;
      // Turrets defend but aren't targeted (they're hardened)
      if (def.effect && def.effect.type === 'defense_value') continue;
      for (const p of structData.placements) {
        const key = this._hpKey(structureId, p.x, p.y);
        if (state.structureHp[key] === undefined) {
          state.structureHp[key] = raidCfg.structureMaxHp;
        }
        // Skip already-destroyed structures
        if (state.structureHp[key] <= 0) continue;
        targets.push({ structureId, x: p.x, y: p.y, key });
      }
    }

    const damaged = [];
    const destroyed = [];

    if (effectiveDamage > 0 && targets.length > 0) {
      // Distribute damage across random targets
      let remainingDamage = effectiveDamage;
      while (remainingDamage > 0 && targets.length > 0) {
        const idx = Math.floor(Math.random() * targets.length);
        const target = targets[idx];
        const dmg = Math.min(remainingDamage, raidCfg.baseDamagePerMonster);
        state.structureHp[target.key] -= dmg;
        remainingDamage -= dmg;

        if (state.structureHp[target.key] <= 0) {
          state.structureHp[target.key] = 0;
          destroyed.push({ structureId: target.structureId, x: target.x, y: target.y });
          // Remove from target pool so it's not hit again
          targets.splice(idx, 1);
          // Remove from actual structure placements and decrement count
          this._removeStructurePlacement(playerId, target.structureId, target.x, target.y);
        } else {
          damaged.push({ structureId: target.structureId, x: target.x, y: target.y, hp: state.structureHp[target.key] });
        }
      }
    }

    const result = {
      occurred: true,
      monsterCount,
      monsters: raidMonsters,
      totalRaidDamage,
      defenseRating,
      effectiveDamage,
      damaged,
      destroyed,
      structuresRemaining: this._countTotalStructures(playerId),
    };

    state.lastRaidResult = result;
    return result;
  }

  // Remove a structure placement (when destroyed by raid)
  _removeStructurePlacement(playerId, structureId, x, y) {
    const state = this.getState(playerId);
    const structData = state.structures[structureId];
    if (!structData || !structData.placements) return;
    const idx = structData.placements.findIndex(p => p.x === x && p.y === y);
    if (idx !== -1) {
      structData.placements.splice(idx, 1);
      structData.count = Math.max(0, structData.count - 1);
    }
  }

  _countTotalStructures(playerId) {
    const state = this.getState(playerId);
    let total = 0;
    for (const structData of Object.values(state.structures)) {
      total += typeof structData === 'object' ? structData.count : structData;
    }
    return total;
  }

  // Tick repair timer — drone bays gradually restore damaged structures
  updateRepairTimer(playerId, dt) {
    const raidCfg = this._getRaidConfig();
    if (!raidCfg) return [];

    const repairRate = this.getRepairRate(playerId);
    if (repairRate <= 0) return [];

    const state = this.getState(playerId);
    state.repairTimer += dt;

    // Repair ticks based on drone bay interval (convert repairsPerHour to a per-tick check)
    // repairRate is already in repairs/hour, convert to repair HP per second
    const repairHpPerSecond = (repairRate * raidCfg.repairAmountPerTick) / 3600;
    const repairAmount = repairHpPerSecond * dt;
    if (repairAmount <= 0) return [];

    // Find damaged (but not destroyed) structures and heal them
    const repaired = [];
    for (const [key, hp] of Object.entries(state.structureHp)) {
      if (hp <= 0 || hp >= raidCfg.structureMaxHp) continue;
      state.structureHp[key] = Math.min(raidCfg.structureMaxHp, hp + repairAmount);
      if (state.structureHp[key] >= raidCfg.structureMaxHp) {
        repaired.push(key);
      }
    }
    return repaired;
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
      resources: data.resources || { salvage: 0 },
      structures: data.structures || {},
      productionTimers: data.productionTimers || {},
      replicationTimers: data.replicationTimers || {},
      claimedMilestones: data.claimedMilestones || [],
      gridExpanded: data.gridExpanded || false,
      structureHp: data.structureHp || {},
      raidTimer: data.raidTimer || 0,
      repairTimer: data.repairTimer || 0,
      lastRaidResult: data.lastRaidResult || null,
      stats: data.stats || {
        totalSalvageProduced: 0,
        totalSalvageSpent: 0,
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
