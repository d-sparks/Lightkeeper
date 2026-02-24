// Action Executor - Runs scripted actions that modify game state.
//
// Actions are plain objects defined in content JSON. They're executed when a
// trigger's conditions pass.
//
// Supported action types:
//   { type: "setFlag",      flag: "name", value: true, scope: "player" }
//   { type: "removeFlag",   flag: "name", scope: "player" }
//   { type: "incrementFlag", flag: "name", amount: 1, scope: "player" }
//   { type: "setDialogue",  npc: "npc_type", dialogueId: "post_crystal" }
//   { type: "removeEntity", entityType: "npc"|"monster"|"item", entityId: "npc_old_keeper_0" }
//   { type: "spawnItem",    itemType: "health_potion", x: 5, y: 3 }  // x/y optional; omit to drop at monster death pos
//   { type: "giveItem",     itemType: "health_potion" }
//   { type: "removeItem",   itemType: "iron_key" }
//   { type: "equipItem",    itemType: "sol_unit" }
//   { type: "showMessage",  text: "The door unlocks with a click." }
//   { type: "toggleTile",   x: 5, y: 3 }

const CONSTANTS = require('../../shared/constants');

class ActionExecutor {
  constructor(flagStore, eventBus, content) {
    this.flagStore = flagStore;
    this.eventBus = eventBus;
    this.content = content;
    // Callback set by index.js to send messages to specific players
    this.sendToPlayer = null;
    // Callback to broadcast to a room
    this.broadcastToRoom = null;
  }

  // Execute a list of actions.
  // context: { playerId, roomId, room, player }
  executeAll(actions, context) {
    if (!actions || !Array.isArray(actions)) return;
    for (const action of actions) {
      this.execute(action, context);
    }
  }

  execute(action, context) {
    if (!action || !action.type) return;

    switch (action.type) {
      case 'setFlag':
        this.doSetFlag(action, context);
        break;
      case 'removeFlag':
        this.doRemoveFlag(action, context);
        break;
      case 'incrementFlag':
        this.doIncrementFlag(action, context);
        break;
      case 'setDialogue':
        this.doSetDialogue(action, context);
        break;
      case 'removeEntity':
        this.doRemoveEntity(action, context);
        break;
      case 'spawnItem':
        this.doSpawnItem(action, context);
        break;
      case 'giveItem':
        this.doGiveItem(action, context);
        break;
      case 'removeItem':
        this.doRemoveItem(action, context);
        break;
      case 'equipItem':
        this.doEquipItem(action, context);
        break;
      case 'showMessage':
        this.doShowMessage(action, context);
        break;
      case 'toggleTile':
        this.doToggleTile(action, context);
        break;
      case 'setQuestObjective':
        this.doSetQuestObjective(action, context);
        break;
      case 'clearQuestObjective':
        this.doClearQuestObjective(action, context);
        break;
      default:
        console.warn(`[Actions] Unknown action type: ${action.type}`);
    }
  }

  doSetFlag(action, context) {
    const scope = action.scope || 'player';
    const value = action.value !== undefined ? action.value : true;
    this.flagStore.setFlag(context.playerId, context.roomId, action.flag, value, scope);
    this.eventBus.emit('flag_changed', {
      playerId: context.playerId,
      roomId: context.roomId,
      flag: action.flag,
      value,
      scope,
    });
  }

  doRemoveFlag(action, context) {
    const scope = action.scope || 'player';
    this.flagStore.removeFlag(context.playerId, context.roomId, action.flag, scope);
  }

  doIncrementFlag(action, context) {
    const scope = action.scope || 'player';
    const current = this.flagStore.getFlag(context.playerId, context.roomId, action.flag, scope) || 0;
    const amount = action.amount !== undefined ? action.amount : 1;
    const newValue = current + amount;
    this.flagStore.setFlag(context.playerId, context.roomId, action.flag, newValue, scope);
    this.eventBus.emit('flag_changed', {
      playerId: context.playerId,
      roomId: context.roomId,
      flag: action.flag,
      value: newValue,
      scope,
    });
  }

  doSetDialogue(action, context) {
    const room = context.room;
    if (!room) return;

    // Find NPCs of the given type and update their active dialogue
    for (const [npcId, npc] of room.npcs) {
      if (npc.type === action.npc) {
        npc.activeDialogueId = action.dialogueId;
      }
    }
  }

  doRemoveEntity(action, context) {
    const room = context.room;
    if (!room) return;

    switch (action.entityType) {
      case 'npc':
        if (action.entityId) {
          room.npcs.delete(action.entityId);
        } else if (action.npcType) {
          for (const [id, npc] of room.npcs) {
            if (npc.type === action.npcType) { room.npcs.delete(id); break; }
          }
        }
        break;
      case 'monster':
        if (action.entityId) {
          room.monsters.delete(action.entityId);
        } else if (action.monsterType) {
          for (const [id, mob] of room.monsters) {
            if (mob.type === action.monsterType) { room.monsters.delete(id); break; }
          }
        }
        break;
      case 'item':
        if (action.entityId) {
          room.items.delete(action.entityId);
        } else if (action.itemType) {
          for (const [id, item] of room.items) {
            if (item.type === action.itemType) { room.items.delete(id); break; }
          }
        }
        break;
    }
  }

  doSpawnItem(action, context) {
    const room = context.room;
    if (!room) return;
    const itemDef = this.content.getItem(action.itemType);
    if (!itemDef) return;

    // Determine spawn position: explicit tile coords > monster death position > player position
    let x, y;
    if (action.x !== undefined && action.y !== undefined) {
      x = (action.x + 0.5) * CONSTANTS.TILE_SIZE;
      y = (action.y + 0.5) * CONSTANTS.TILE_SIZE;
    } else if (context.eventPayload && context.eventPayload.monsterX !== undefined) {
      x = context.eventPayload.monsterX;
      y = context.eventPayload.monsterY;
    } else if (context.player) {
      x = context.player.x;
      y = context.player.y;
    } else {
      x = CONSTANTS.TILE_SIZE;
      y = CONSTANTS.TILE_SIZE;
    }

    const itemId = `item_${room.nextItemId++}`;
    room.items.set(itemId, {
      id: itemId,
      type: action.itemType,
      name: itemDef.name,
      rarity: itemDef.rarity || 'common',
      x,
      y,
    });
  }

  doGiveItem(action, context) {
    const player = context.player;
    if (!player) return;
    const itemDef = this.content.getItem(action.itemType);
    if (!itemDef) return;

    player.inventory.push({
      type: action.itemType,
      name: itemDef.name,
      rarity: itemDef.rarity || 'common',
      category: itemDef.type || 'misc',
    });

    // Notify client of inventory change
    if (this.sendToPlayer) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
      });
    }
  }

  doRemoveItem(action, context) {
    const player = context.player;
    if (!player) return;

    const idx = player.inventory.findIndex(item => item.type === action.itemType);
    if (idx !== -1) {
      player.inventory.splice(idx, 1);
    }

    // Notify client of inventory change
    if (this.sendToPlayer) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
      });
    }
  }

  doEquipItem(action, context) {
    const player = context.player;
    if (!player) return;

    // Find the item in inventory
    const idx = player.inventory.findIndex(item => item.type === action.itemType);
    if (idx === -1) return;

    const item = player.inventory[idx];
    const itemDef = this.content.getItem(action.itemType);
    if (!itemDef) return;

    const slot = CONSTANTS.SLOT_ALIASES[itemDef.slot] || itemDef.slot;
    if (!CONSTANTS.EQUIPMENT_SLOTS.includes(slot)) return;

    // If something is already equipped in that slot, move it back to inventory
    const currentEquipped = player.equipment[slot];
    player.inventory.splice(idx, 1);
    if (currentEquipped) {
      player.inventory.push(currentEquipped);
    }

    // Equip the new item
    player.equipment[slot] = {
      type: item.type,
      name: item.name,
      rarity: item.rarity,
      category: item.category || itemDef.type || 'misc',
      slot: slot,
      stats: itemDef.stats || {},
    };

    // Rebuild abilities if the gameLoop reference is available via callback
    if (this._onEquipChanged) {
      this._onEquipChanged(player, itemDef);
    }

    // Notify client of inventory + ability change
    if (this.sendToPlayer) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
      });
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.ABILITY_STATE,
        abilities: player.abilities,
        cooldowns: player.cooldowns,
      });
    }
  }

  doShowMessage(action, context) {
    if (this.sendToPlayer) {
      let dialogue;
      if (action.lines && Array.isArray(action.lines)) {
        dialogue = action.lines.map(line => ({ speaker: '', text: line }));
      } else {
        dialogue = [{ speaker: '', text: action.text }];
      }
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue,
      });
    }
  }

  doSetQuestObjective(action, context) {
    const player = context.player;
    if (!player) return;
    player.questObjective = {
      label: action.label || '',
      roomId: action.roomId,
      tileX: action.tileX,
      tileY: action.tileY,
    };
    if (this._onQuestObjectiveChanged) {
      this._onQuestObjectiveChanged(context.playerId, context.roomId);
    }
  }

  doClearQuestObjective(action, context) {
    const player = context.player;
    if (!player) return;
    player.questObjective = null;
    if (this.sendToPlayer) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.QUEST_OBJECTIVE,
        objective: null,
      });
    }
  }

  doToggleTile(action, context) {
    const room = context.room;
    if (!room) return;

    const tileset = this.content.getTileset(room.dungeon.tileset);
    if (!tileset) return;

    const idx = action.y * room.dungeon.width + action.x;
    const currentTileId = room.dungeon.data[idx];
    const tileDef = tileset.tiles[String(currentTileId)];
    if (!tileDef || tileDef.togglesTo == null) return;

    room.dungeon.data[idx] = tileDef.togglesTo;

    // Broadcast the tile change to all players in the room
    if (this.broadcastToRoom) {
      this.broadcastToRoom(context.roomId, {
        type: CONSTANTS.MSG.DOOR_TOGGLE,
        x: action.x,
        y: action.y,
        tileId: tileDef.togglesTo,
      });
    }
  }
}

module.exports = ActionExecutor;
