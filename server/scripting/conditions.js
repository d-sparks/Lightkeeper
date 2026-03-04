// Condition Evaluator - Evaluates declarative conditions against game state.
//
// Conditions are plain objects defined in content JSON. They check player flags,
// inventory, room flags, and can be composed with and/or/not.
//
// Supported condition types:
//   { "hasFlag": "flag_name" }                          - flag is truthy
//   { "hasFlag": "flag_name", "value": 5 }              - flag equals value
//   { "flagGreaterThan": { "flag": "name", "value": 3 } }
//   { "flagLessThan": { "flag": "name", "value": 3 } }
//   { "hasItem": "item_type" }                          - player has item in inventory
//   { "not": <condition> }
//   { "and": [<condition>, ...] }
//   { "or": [<condition>, ...] }

class ConditionEvaluator {
  constructor(flagStore) {
    this.flagStore = flagStore;
  }

  // Evaluate a single condition or array of conditions (implicit AND).
  // context: { playerId, roomId, player }
  // player: the player object with inventory/equipment
  evaluate(condition, context) {
    if (!condition) return true;

    // Array of conditions = implicit AND
    if (Array.isArray(condition)) {
      return condition.every(c => this.evaluate(c, context));
    }

    // --- Logical operators ---
    if (condition.and) {
      return condition.and.every(c => this.evaluate(c, context));
    }
    if (condition.or) {
      return condition.or.some(c => this.evaluate(c, context));
    }
    if (condition.not) {
      return !this.evaluate(condition.not, context);
    }

    // --- Flag checks ---
    if (condition.hasFlag !== undefined) {
      const scope = condition.scope || 'player';
      const val = this.flagStore.getFlag(context.playerId, context.roomId, condition.hasFlag, scope);
      if (condition.value !== undefined) {
        return val === condition.value;
      }
      return !!val;
    }

    if (condition.flagGreaterThan) {
      const { flag, value, scope } = condition.flagGreaterThan;
      const actual = this.flagStore.getFlag(context.playerId, context.roomId, flag, scope || 'player');
      return (actual || 0) > value;
    }

    if (condition.flagLessThan) {
      const { flag, value, scope } = condition.flagLessThan;
      const actual = this.flagStore.getFlag(context.playerId, context.roomId, flag, scope || 'player');
      return (actual || 0) < value;
    }

    // --- Inventory checks ---
    if (condition.hasItem !== undefined) {
      const player = context.player;
      if (!player) return false;
      // Medical supplies are stored as medipac charges, not inventory items
      if (condition.hasItem === 'medical_supplies') {
        return (player.medipacCharges || 0) > 0;
      }
      return player.inventory.some(item => item.type === condition.hasItem);
    }

    // Unknown condition type — treat as passing (don't block on bad data)
    console.warn('[Conditions] Unknown condition type:', JSON.stringify(condition));
    return true;
  }
}

module.exports = ConditionEvaluator;
