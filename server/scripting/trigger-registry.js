// Trigger Registry - Loads trigger-condition-action rules from content JSON
// and subscribes them to the event bus.
//
// Triggers can be defined in:
//   1. Dungeon JSON files: dungeon.triggers[]
//   2. NPC definitions: npc.dialogueRules[] (handled separately in game-loop)
//   3. Tileset tiles: tile.conditions[] (handled separately in game-loop)
//
// Dungeon trigger format:
// {
//   "id": "unique_trigger_name",
//   "event": "item_picked_up",
//   "filter": { "itemType": "crystal_shard" },    // optional: match event payload fields
//   "conditions": [ { "hasFlag": "some_flag" } ],  // optional: extra conditions to check
//   "actions": [ { "type": "setFlag", "flag": "found_crystal" } ],
//   "once": true                                    // optional: only fire once per player
// }

class TriggerRegistry {
  constructor(eventBus, conditionEvaluator, actionExecutor, flagStore) {
    this.eventBus = eventBus;
    this.conditions = conditionEvaluator;
    this.actions = actionExecutor;
    this.flagStore = flagStore;
    // roomId -> [trigger, ...]
    this.roomTriggers = new Map();
  }

  // Load triggers from a dungeon definition when a room is created
  loadRoomTriggers(roomId, dungeon) {
    const triggers = dungeon.triggers || [];
    this.roomTriggers.set(roomId, triggers);
  }

  // Clean up when a room is destroyed
  unloadRoom(roomId) {
    this.roomTriggers.delete(roomId);
  }

  // Process an event against all triggers for the given room.
  // Called by game-loop when it emits an event.
  // context: { playerId, roomId, room, player }
  // eventPayload: the data from the event (itemType, npcType, etc.)
  processEvent(eventType, eventPayload, context) {
    const triggers = this.roomTriggers.get(context.roomId);
    if (!triggers) return;

    for (const trigger of triggers) {
      if (trigger.event !== eventType) continue;

      // Check "once" — skip if this trigger already fired for this player
      if (trigger.once) {
        const firedFlag = `__trigger_${trigger.id}_fired`;
        if (this.flagStore.getPlayerFlag(context.playerId, firedFlag)) {
          continue;
        }
      }

      // Check filter — every key in the filter must match the event payload
      if (trigger.filter) {
        let matches = true;
        for (const key in trigger.filter) {
          if (eventPayload[key] !== trigger.filter[key]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      // Check conditions
      if (trigger.conditions && trigger.conditions.length > 0) {
        if (!this.conditions.evaluate(trigger.conditions, context)) {
          continue;
        }
      }

      // Mark as fired if "once"
      if (trigger.once && trigger.id) {
        this.flagStore.setPlayerFlag(context.playerId, `__trigger_${trigger.id}_fired`, true);
      }

      // Execute actions
      this.actions.executeAll(trigger.actions, context);
    }
  }
}

module.exports = TriggerRegistry;
