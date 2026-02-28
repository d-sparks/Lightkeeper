// Per-player automation state: structures, resources, production timers
// Data-driven: reads structure definitions from content/entities/structures.json

class Automation {
  constructor(content) {
    this.content = content;
    this.playerStates = new Map(); // playerId -> AutoState
  }

  // Get or create automation state for a player
  getState(playerId) {
    if (!this.playerStates.has(playerId)) {
      this.playerStates.set(playerId, {
        resources: { silicon: 0 },
        structures: {},       // structureId -> count
        productionTimers: {}, // structureId -> seconds accumulated
      });
    }
    return this.playerStates.get(playerId);
  }

  // Add resources (called when player picks up silicon or production ticks)
  addResource(playerId, resourceType, amount) {
    const state = this.getState(playerId);
    if (!state.resources[resourceType]) state.resources[resourceType] = 0;
    state.resources[resourceType] += amount;
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
    }
    return true;
  }

  // Build a structure (returns true if successful)
  build(playerId, structureId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const def = structures[structureId];
    if (!def) return false;

    const state = this.getState(playerId);
    const currentCount = state.structures[structureId] || 0;
    if (def.maxCount && currentCount >= def.maxCount) return false;

    if (!this.spendResources(playerId, def.cost)) return false;

    state.structures[structureId] = currentCount + 1;
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

    for (const [structureId, count] of Object.entries(state.structures)) {
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

  // Get energy regen rate for a player from solar panels (per second)
  getEnergyRegenRate(playerId, currentRoomId) {
    const structures = this.content.getStructures ? this.content.getStructures() : {};
    const state = this.getState(playerId);
    let regenPerSecond = 0;

    for (const [structureId, count] of Object.entries(state.structures)) {
      if (count <= 0) continue;
      const def = structures[structureId];
      if (!def || !def.effect || def.effect.type !== 'energy_regen') continue;

      // Check room requirement
      if (def.effect.requiresRoom && def.effect.requiresRoom !== currentRoomId) continue;

      regenPerSecond += (def.effect.amount * count) / def.effect.intervalSeconds;
    }

    return regenPerSecond;
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

  // Get state formatted for client
  getStateForClient(playerId) {
    const state = this.getState(playerId);
    const structures = this.content.getStructures ? this.content.getStructures() : {};

    const structureList = [];
    for (const [id, def] of Object.entries(structures)) {
      structureList.push({
        id,
        name: def.name,
        description: def.description,
        cost: def.cost,
        maxCount: def.maxCount || 0,
        count: state.structures[id] || 0,
      });
    }

    const trades = [
      { id: 'damage_booster', name: 'Damage Booster Chip', cost: { silicon: 5 } },
      { id: 'medical_supplies', name: 'Medical Supplies x5', cost: { silicon: 10 } },
    ];

    return {
      resources: { ...state.resources },
      structures: structureList,
      trades,
    };
  }

  // Remove player state on disconnect
  removePlayer(playerId) {
    // Keep state so it persists across disconnects within the same server session
    // (could be cleaned up on a long timer if needed)
  }
}

module.exports = Automation;
