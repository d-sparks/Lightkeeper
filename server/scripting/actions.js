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
//   { type: "spawnItem",    itemType: "bandage", x: 5, y: 3 }  // x/y optional; omit to drop at monster death pos
//   { type: "giveItem",     itemType: "bandage" }
//   { type: "removeItem",   itemType: "iron_key" }
//   { type: "equipItem",    itemType: "sol_unit" }
//   { type: "showMessage",  text: "The door unlocks with a click." }
//   { type: "setEnergy",    value: 100 }  // or percent: 100
//   { type: "grantXp",      amount: 50 }
//   { type: "toggleTile",   x: 5, y: 3 }
//   { type: "setTile",      x: 5, y: 3, tileId: 3 }
//   { type: "showChoice",  choiceId: "weapon_choice", prompt: "Choose:", options: [{label, description, value}] }
//   { type: "giveStructure", structureId: "solar_panel" }
//   { type: "openAutomation" }
//   { type: "rollLootTable", lootTable: "frost_biome_common", x: 5, y: 3 }  // roll from loot table, spawn result; x/y optional
//   { type: "spawnNpc",    npcType: "outpost_warden", x: 4, y: 10 }  // spawns NPC at tile coords if not already present
//   { type: "craft" }  // opens crafting menu with available recipes from crafting.json
//   { type: "shop",      shopId: "meridian_7_shop" }  // opens buy/sell menu from shops.json
//   { type: "bankLoot" }  // banks all non-quest inventory items for expedition checkpoint (survives death)
//   { type: "startSiege", challengeId: "lighthouse_siege" }  // starts cooperative siege challenge
//   { type: "healPlayer" }  // restores player to full health

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
      case 'setEnergy':
        this.doSetEnergy(action, context);
        break;
      case 'grantXp':
        this.doGrantXp(action, context);
        break;
      case 'toggleTile':
        this.doToggleTile(action, context);
        break;
      case 'setTile':
        this.doSetTile(action, context);
        break;
      case 'setQuestObjective':
        this.doSetQuestObjective(action, context);
        break;
      case 'clearQuestObjective':
        this.doClearQuestObjective(action, context);
        break;
      case 'showChoice':
        this.doShowChoice(action, context);
        break;
      case 'giveStructure':
        this.doGiveStructure(action, context);
        break;
      case 'openAutomation':
        this.doOpenAutomation(action, context);
        break;
      case 'spawnNpc':
        this.doSpawnNpc(action, context);
        break;
      case 'rollLootTable':
        this.doRollLootTable(action, context);
        break;
      case 'startExpedition':
        this.doStartExpedition(action, context);
        break;
      case 'craft':
        this.doCraft(action, context);
        break;
      case 'shop':
        this.doShop(action, context);
        break;
      case 'bankLoot':
        this.doBankLoot(action, context);
        break;
      case 'startSiege':
        this.doStartSiege(action, context);
        break;
      case 'healPlayer':
        this.doHealPlayer(action, context);
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

  doSpawnNpc(action, context) {
    const room = context.room;
    if (!room) return;
    const npcDef = this.content.getNPC(action.npcType);
    if (!npcDef) return;

    // Don't spawn if an NPC of this type already exists in the room
    for (const [, npc] of room.npcs) {
      if (npc.type === action.npcType) return;
    }

    const npcId = `npc_${action.npcType}_spawned_${Date.now()}`;
    room.npcs.set(npcId, {
      id: npcId,
      type: action.npcType,
      name: npcDef.name,
      x: (action.x + 0.5) * CONSTANTS.TILE_SIZE,
      y: (action.y + 0.5) * CONSTANTS.TILE_SIZE,
      dialogue: npcDef.dialogue,
      dialogues: npcDef.dialogues || null,
      dialogueRules: npcDef.dialogueRules || null,
      activeDialogueId: null,
    });
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
      category: itemDef.type,
      x,
      y,
    });
  }

  doGiveItem(action, context) {
    const player = context.player;
    if (!player) return;
    const itemDef = this.content.getItem(action.itemType);
    if (!itemDef) return;

    const count = action.count || 1;

    // Salvage goes to automation resources instead of inventory
    if (action.itemType === 'salvage' && this.automation) {
      this.automation.addResource(context.playerId, 'salvage', count);
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.AUTO_STATE,
          auto: this.automation.getStateForClient(context.playerId),
        });
      }
      return;
    }

    // Medical supplies go to medipac charges, not inventory
    if (action.itemType === 'medical_supplies') {
      player.medipacCharges = (player.medipacCharges || 0) + count;
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.INVENTORY,
          items: player.inventory,
          equipment: player.equipment,
          medipacCharges: player.medipacCharges,
      credits: player.credits || 0,
        });
      }
      return;
    }

    for (let i = 0; i < count; i++) {
      player.inventory.push({
        type: action.itemType,
        name: itemDef.name,
        rarity: itemDef.rarity || 'common',
        category: itemDef.type || 'misc',
      });
    }

    // Notify client of inventory change
    if (this.sendToPlayer) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
        medipacCharges: player.medipacCharges,
      credits: player.credits || 0,
      });
    }
  }

  doRemoveItem(action, context) {
    const player = context.player;
    if (!player) return;

    // Medical supplies use the charge counter
    if (action.itemType === 'medical_supplies') {
      if (player.medipacCharges > 0) player.medipacCharges--;
    } else {
      const idx = player.inventory.findIndex(item => item.type === action.itemType);
      if (idx !== -1) {
        player.inventory.splice(idx, 1);
      }
    }

    // Notify client of inventory change
    if (this.sendToPlayer) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
        medipacCharges: player.medipacCharges,
      credits: player.credits || 0,
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

    // Notify client of inventory + ability + sol grid change
    if (this.sendToPlayer) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
        medipacCharges: player.medipacCharges,
      credits: player.credits || 0,
      });
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.ABILITY_STATE,
        abilities: player.abilities,
        cooldowns: player.cooldowns,
      });
      if (player.solGrid && this._getSolGridForClient) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.SOL_GRID,
          grid: this._getSolGridForClient(player),
        });
      }
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

  doSetEnergy(action, context) {
    const player = context.player;
    if (!player || player.maxEnergy <= 0) return;
    if (action.percent !== undefined) {
      player.energy = Math.min(player.maxEnergy * (action.percent / 100), player.maxEnergy);
    } else if (action.value !== undefined) {
      player.energy = Math.min(action.value, player.maxEnergy);
    }
  }

  doShowChoice(action, context) {
    if (!this.sendToPlayer) return;
    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.CHOICE_MENU,
      choiceId: action.choiceId,
      prompt: action.prompt || '',
      options: action.options || [],
    });
  }

  doGrantXp(action, context) {
    const player = context.player;
    if (!player) return;
    const amount = action.amount || 0;
    if (amount <= 0) return;
    // Delegate to gameLoop.grantXp via callback
    if (this._onGrantXp) {
      this._onGrantXp(player, amount, context.room);
    }
  }

  doGiveStructure(action, context) {
    if (!this.automation) return;
    const success = this.automation.grantStructure(context.playerId, action.structureId);
    if (success && this.sendToPlayer) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.AUTO_STATE,
        auto: this.automation.getStateForClient(context.playerId),
      });
    }
  }

  doOpenAutomation(action, context) {
    if (!this.automation || !this.sendToPlayer) return;
    // Migrate any salvage sitting in inventory to automation resources
    const player = context.player;
    if (player) {
      const legacySalvage = player.inventory.filter(i => i.type === 'salvage').length;
      if (legacySalvage > 0) {
        player.inventory = player.inventory.filter(i => i.type !== 'salvage');
        this.automation.addResource(context.playerId, 'salvage', legacySalvage);
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.INVENTORY,
          items: player.inventory,
          equipment: player.equipment,
          medipacCharges: player.medipacCharges,
          credits: player.credits || 0,
        });
      }
    }
    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.AUTO_STATE,
      auto: this.automation.getStateForClient(context.playerId),
      openScreen: true,
    });
  }

  doSetTile(action, context) {
    const room = context.room;
    if (!room) return;
    const idx = action.y * room.dungeon.width + action.x;
    room.dungeon.data[idx] = action.tileId;
    if (this.broadcastToRoom) {
      this.broadcastToRoom(context.roomId, {
        type: CONSTANTS.MSG.DOOR_TOGGLE,
        x: action.x,
        y: action.y,
        tileId: action.tileId,
      });
    }
  }

  doRollLootTable(action, context) {
    const room = context.room;
    if (!room || !action.lootTable) return;
    const table = this.content.getLootTable(action.lootTable);
    if (!table || !table.rolls || table.rolls.length === 0) return;

    // Filter rolls: exclude entries whose item requires an unlockFlag the player hasn't set.
    const playerId = context.playerId || null;
    const eligibleRolls = table.rolls.filter(entry => {
      const def = this.content.getItem(entry.item);
      if (!def || !def.unlockFlag) return true;
      if (!playerId) return false;
      return !!this.flagStore.getPlayerFlag(playerId, def.unlockFlag);
    });
    if (eligibleRolls.length === 0) return;

    // Weighted random selection from eligible rolls
    const totalWeight = eligibleRolls.reduce((sum, r) => sum + (r.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = null;
    for (const entry of eligibleRolls) {
      roll -= (entry.weight || 1);
      if (roll <= 0) { chosen = entry; break; }
    }
    if (!chosen) return;

    const itemDef = this.content.getItem(chosen.item);
    if (!itemDef) return;

    // Determine spawn position: explicit tile coords > event tileX/tileY > player position
    let x, y;
    if (action.x !== undefined && action.y !== undefined) {
      x = (action.x + 0.5) * CONSTANTS.TILE_SIZE;
      y = (action.y + 0.5) * CONSTANTS.TILE_SIZE;
    } else if (context.eventPayload && context.eventPayload.tileX !== undefined) {
      x = (context.eventPayload.tileX + 0.5) * CONSTANTS.TILE_SIZE;
      y = (context.eventPayload.tileY + 0.5) * CONSTANTS.TILE_SIZE;
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
      type: chosen.item,
      name: itemDef.name,
      rarity: itemDef.rarity || 'common',
      category: itemDef.type,
      x,
      y,
    });
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

  // Open crafting menu: { type: "craft" }
  // Shows available recipes from crafting.json filtered by player inventory.
  // Player selects a recipe via choice menu; the craft is executed in executeCraftRecipe().
  doCraft(action, context) {
    const player = context.player;
    if (!player || !this.sendToPlayer) return;

    const recipes = this.content.getAllCraftingRecipes();
    if (!recipes || Object.keys(recipes).length === 0) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker: 'MERIDIAN-7', text: 'No fabrication recipes available.' }],
      });
      return;
    }

    // Build options for recipes the player can afford
    const options = [];
    for (const [recipeId, recipe] of Object.entries(recipes)) {
      if (this._playerHasIngredients(context.playerId, player, recipe.ingredients)) {
        options.push({
          label: recipe.name,
          description: recipe.description || '',
          value: recipeId,
        });
      }
    }

    if (options.length === 0) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker: 'MERIDIAN-7', text: 'You lack the required components for any available fabrication. Return when you have gathered more materials.' }],
      });
      return;
    }

    options.push({ label: 'Cancel', description: '', value: '_cancel' });

    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.CHOICE_MENU,
      choiceId: 'meridian_craft',
      prompt: 'Select a fabrication recipe:',
      options,
    });
  }

  // Check if a player has all required ingredients in inventory
  _playerHasIngredients(playerId, player, ingredients) {
    for (const req of ingredients) {
      if (req.itemType === 'salvage') {
        // Salvage is tracked via automation resources
        if (this.automation) {
          const have = this.automation.getResource(playerId, 'salvage') || 0;
          if (have < (req.count || 1)) return false;
        } else {
          // Fallback: count salvage in inventory
          const count = player.inventory.filter(i => i.type === 'salvage').length;
          if (count < (req.count || 1)) return false;
        }
      } else {
        const needed = req.count || 1;
        const have = player.inventory.filter(i => i.type === req.itemType).length;
        if (have < needed) return false;
      }
    }
    return true;
  }

  // Execute a crafting recipe after player selects it from the craft menu.
  // Called from game-loop handleChoiceSelect when choiceId === 'meridian_craft'.
  executeCraftRecipe(recipeId, context) {
    const player = context.player;
    if (!player || !this.sendToPlayer) return false;

    if (recipeId === '_cancel') return true;

    const recipe = this.content.getCraftingRecipe(recipeId);
    if (!recipe) {
      console.warn(`[Actions] Unknown craft recipe: ${recipeId}`);
      return false;
    }

    // Re-validate ingredients (in case inventory changed)
    if (!this._playerHasIngredients(context.playerId, player, recipe.ingredients)) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker: 'MERIDIAN-7', text: 'Insufficient components. Fabrication aborted.' }],
      });
      return false;
    }

    // Remove ingredients
    for (const req of recipe.ingredients) {
      const count = req.count || 1;
      if (req.itemType === 'salvage' && this.automation) {
        this.automation.addResource(context.playerId, 'salvage', -count);
      } else {
        for (let i = 0; i < count; i++) {
          const idx = player.inventory.findIndex(item => item.type === req.itemType);
          if (idx !== -1) player.inventory.splice(idx, 1);
        }
      }
    }

    // Give result item(s)
    const resultCount = recipe.result.count || 1;
    const resultDef = this.content.getItem(recipe.result.itemType);
    if (!resultDef) {
      console.warn(`[Actions] Craft recipe ${recipeId} result item not found: ${recipe.result.itemType}`);
      return false;
    }

    for (let i = 0; i < resultCount; i++) {
      player.inventory.push({
        type: recipe.result.itemType,
        name: resultDef.name,
        rarity: resultDef.rarity || 'common',
        category: resultDef.type || 'misc',
      });
    }

    // Notify client
    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.INVENTORY,
      items: player.inventory,
      equipment: player.equipment,
      medipacCharges: player.medipacCharges,
      credits: player.credits || 0,
    });

    // Send silicon update if automation is active
    if (this.automation) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.AUTO_STATE,
        auto: this.automation.getStateForClient(context.playerId),
      });
    }

    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.DIALOGUE,
      dialogue: [{ speaker: 'MERIDIAN-7', text: `Fabrication complete: ${resultDef.name}.` }],
    });

    if (this.gameLoop && this.gameLoop.activityLog) {
      this.gameLoop.activityLog.logById(context.playerId, 'craft', {
        recipe: recipeId, result: recipe.result.itemType, room: context.roomId,
      });
    }

    return true;
  }

  // Open shop menu: { type: "shop", shopId: "meridian_7_shop" }
  // Shows buy/sell options filtered by player inventory and credits.
  // Player selects an option via choice menu; the transaction is executed in executeShopTransaction().
  doShop(action, context) {
    const player = context.player;
    if (!player || !this.sendToPlayer) return;

    // Migrate any salvage sitting in inventory to automation resources
    if (this.automation) {
      const legacySalvage = player.inventory.filter(i => i.type === 'salvage').length;
      if (legacySalvage > 0) {
        player.inventory = player.inventory.filter(i => i.type !== 'salvage');
        this.automation.addResource(context.playerId, 'salvage', legacySalvage);
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.INVENTORY,
          items: player.inventory,
          equipment: player.equipment,
          medipacCharges: player.medipacCharges,
          credits: player.credits || 0,
        });
      }
    }

    const shop = this.content.getShop(action.shopId);
    if (!shop) {
      console.warn(`[Actions] Unknown shop: ${action.shopId}`);
      return;
    }

    const options = [];
    const credits = player.credits || 0;

    // Sell options — show only if player has the item
    for (const entry of (shop.buys || [])) {
      // Salvage is tracked via automation resources, not inventory
      const count = (entry.item === 'salvage' && this.automation)
        ? this.automation.getResource(context.playerId, 'salvage') || 0
        : player.inventory.filter(i => i.type === entry.item).length;
      if (count <= 0) continue;
      if (entry.sellAll && count > 1) {
        const totalReward = count * entry.creditsReward;
        options.push({
          label: `Sell All ${count} Salvage (${totalReward} cr)`,
          description: `You have ${count}. ${entry.creditsReward} cr each.`,
          value: `sell_all_${entry.item}`,
        });
      } else if (count > 0) {
        options.push({
          label: entry.label + (count > 1 ? ` (have ${count})` : ''),
          description: `You have ${count}.`,
          value: `sell_${entry.item}`,
        });
      }
    }

    // Buy options — show all, indicate if player can afford
    for (const entry of (shop.sells || [])) {
      const affordable = credits >= entry.creditsCost;
      options.push({
        label: entry.label + (affordable ? '' : ' [insufficient credits]'),
        description: affordable ? `You have ${credits} cr.` : `Need ${entry.creditsCost} cr, have ${credits} cr.`,
        value: affordable ? `buy_${entry.item}` : '_cannot_afford',
      });
    }

    if (options.length === 0) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker: shop.speaker || 'Shop', text: 'No trades available at this time.' }],
      });
      return;
    }

    options.push({ label: 'Cancel', description: '', value: '_cancel' });

    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.CHOICE_MENU,
      choiceId: `shop_${action.shopId}`,
      prompt: `// ${(shop.name || 'EXCHANGE').toUpperCase()} // ${credits} CREDITS AVAILABLE //`,
      options,
    });
  }

  // Execute a shop transaction after player selects from the shop menu.
  // Called from game-loop handleChoiceSelect when choiceId starts with 'shop_'.
  executeShopTransaction(shopId, transactionValue, context) {
    const player = context.player;
    if (!player || !this.sendToPlayer) return;

    if (transactionValue === '_cancel' || transactionValue === '_cannot_afford') return;

    const shop = this.content.getShop(shopId);
    if (!shop) return;

    const speaker = shop.speaker || 'Shop';

    if (transactionValue.startsWith('sell_all_')) {
      // Sell all of an item type
      const itemType = transactionValue.replace('sell_all_', '');
      const buyEntry = (shop.buys || []).find(b => b.item === itemType);
      if (!buyEntry) return;

      // Salvage is tracked via automation resources
      if (itemType === 'salvage' && this.automation) {
        const count = this.automation.getResource(context.playerId, 'salvage') || 0;
        if (count <= 0) return;
        this.automation.addResource(context.playerId, 'salvage', -count);
        const totalReward = count * buyEntry.creditsReward;
        player.credits = (player.credits || 0) + totalReward;
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.AUTO_STATE,
          auto: this.automation.getStateForClient(context.playerId),
        });
      } else {
        const count = player.inventory.filter(i => i.type === itemType).length;
        if (count <= 0) return;
        player.inventory = player.inventory.filter(i => i.type !== itemType);
        const totalReward = count * buyEntry.creditsReward;
        player.credits = (player.credits || 0) + totalReward;
      }

      const count = (itemType === 'salvage' && this.automation)
        ? 0  // already handled above
        : player.inventory.filter(i => i.type === itemType).length;
      const totalReward = (player.credits || 0);  // credits already updated

      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
        medipacCharges: player.medipacCharges,
        credits: player.credits || 0,
      });
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker, text: `// EXCHANGE COMPLETE // CREDITS DEPOSITED // Balance: ${player.credits} //` }],
      });
    } else if (transactionValue.startsWith('sell_')) {
      // Sell one item
      const itemType = transactionValue.replace('sell_', '');
      const buyEntry = (shop.buys || []).find(b => b.item === itemType);
      if (!buyEntry) return;

      // Salvage is tracked via automation resources
      if (itemType === 'salvage' && this.automation) {
        const have = this.automation.getResource(context.playerId, 'salvage') || 0;
        if (have <= 0) return;
        this.automation.addResource(context.playerId, 'salvage', -1);
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.AUTO_STATE,
          auto: this.automation.getStateForClient(context.playerId),
        });
      } else {
        const idx = player.inventory.findIndex(i => i.type === itemType);
        if (idx === -1) return;
        player.inventory.splice(idx, 1);
      }
      player.credits = (player.credits || 0) + buyEntry.creditsReward;

      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
        medipacCharges: player.medipacCharges,
        credits: player.credits || 0,
      });
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker, text: `// EXCHANGE COMPLETE // ${buyEntry.creditsReward} CREDITS DEPOSITED // Balance: ${player.credits} //` }],
      });
    } else if (transactionValue.startsWith('buy_')) {
      // Buy an item
      const itemType = transactionValue.replace('buy_', '');
      const sellEntry = (shop.sells || []).find(s => s.item === itemType);
      if (!sellEntry) return;
      if ((player.credits || 0) < sellEntry.creditsCost) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.DIALOGUE,
          dialogue: [{ speaker, text: '// INSUFFICIENT CREDITS // Transaction denied. //' }],
        });
        return;
      }

      player.credits -= sellEntry.creditsCost;

      // Special handling for medical supplies
      if (itemType === 'medical_supplies') {
        player.medipacCharges = (player.medipacCharges || 0) + 1;
      } else {
        const itemDef = this.content.getItem(itemType);
        if (!itemDef) return;
        player.inventory.push({
          type: itemType,
          name: itemDef.name,
          rarity: itemDef.rarity || 'common',
          category: itemDef.type || 'misc',
        });
      }

      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.INVENTORY,
        items: player.inventory,
        equipment: player.equipment,
        medipacCharges: player.medipacCharges,
        credits: player.credits || 0,
      });

      const itemDef = this.content.getItem(itemType);
      const itemName = itemDef ? itemDef.name : itemType;
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker, text: `// FABRICATION COMPLETE // ${itemName} delivered // ${sellEntry.creditsCost} CREDITS DEDUCTED // Balance: ${player.credits} //` }],
      });
    }

    if (this.gameLoop && this.gameLoop.activityLog) {
      this.gameLoop.activityLog.logById(context.playerId, 'shop', {
        shop: shopId, transaction: transactionValue, room: context.roomId,
      });
    }
  }

  // Bank loot: { type: "bankLoot" }
  // Moves all non-quest inventory items into expedition banked storage.
  // Banked items survive expedition death and are returned on death or completion.
  doBankLoot(action, context) {
    const player = context.player;
    if (!player || !this.sendToPlayer) return;

    // Only works during an expedition
    if (!this.flagStore.getPlayerFlag(context.playerId, 'expedition_active')) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker: 'Cache Terminal', text: 'No active expedition. Banking unavailable.' }],
      });
      return;
    }

    // Separate quest items (kept in inventory) from bankable items
    const keptItems = [];
    const toBankItems = [];
    for (const item of player.inventory) {
      if (item.category === 'key' || item.category === 'sol_component') {
        keptItems.push(item);
      } else {
        toBankItems.push(item);
      }
    }

    if (toBankItems.length === 0) {
      this.sendToPlayer(context.playerId, {
        type: CONSTANTS.MSG.DIALOGUE,
        dialogue: [{ speaker: 'Cache Terminal', text: '// NO BANKABLE ITEMS // Inventory contains only quest-critical items. //' }],
      });
      return;
    }

    // Merge with any previously banked items
    const existing = this.flagStore.getPlayerFlag(context.playerId, 'expedition_banked_loot') || [];
    const allBanked = existing.concat(toBankItems);
    this.flagStore.setPlayerFlag(context.playerId, 'expedition_banked_loot', allBanked);

    // Remove banked items from inventory
    player.inventory = keptItems;

    // Notify client of inventory change
    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.INVENTORY,
      items: player.inventory,
      equipment: player.equipment,
      medipacCharges: player.medipacCharges,
      credits: player.credits || 0,
    });

    // Send banking confirmation
    const itemNames = toBankItems.map(i => i.name);
    const uniqueNames = [...new Set(itemNames)];
    const summary = uniqueNames.length <= 3
      ? uniqueNames.join(', ')
      : `${uniqueNames.slice(0, 3).join(', ')} and ${uniqueNames.length - 3} more`;
    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.LOOT_BANKED,
      bankedCount: toBankItems.length,
      totalBanked: allBanked.length,
      items: itemNames,
      bankedItems: allBanked,
    });
    this.sendToPlayer(context.playerId, {
      type: CONSTANTS.MSG.DIALOGUE,
      dialogue: [{ speaker: 'Cache Terminal', text: `// ${toBankItems.length} ITEM(S) BANKED // ${summary} // Total cached: ${allBanked.length} // Items will be returned at expedition end. //` }],
    });

    console.log(`[Actions] Player ${context.playerId} banked ${toBankItems.length} items (total: ${allBanked.length})`);
  }

  // Start a siege challenge: { type: "startSiege", challengeId: "lighthouse_siege" }
  // Validates unlock conditions, cooldown, and player count, then transitions party to arena.
  doStartSiege(action, context) {
    if (!this.gameLoop) {
      console.warn('[Actions] startSiege requires gameLoop reference');
      return;
    }
    const challengeId = action.challengeId;
    if (!challengeId) {
      console.warn('[Actions] startSiege missing challengeId');
      return;
    }
    const result = this.gameLoop.startSiege(context.playerId, challengeId);
    if (!result) {
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.DIALOGUE,
          dialogue: [{ speaker: 'System', text: 'You do not meet the requirements for this siege challenge.' }],
        });
      }
      return;
    }
    if (result.onCooldown) {
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.DIALOGUE,
          dialogue: [{ speaker: 'Siege Warden', text: `The lighthouse defenses are still recharging. Try again in ${result.hoursRemaining} hours.` }],
        });
      }
      return;
    }
    if (result.insufficientPlayers) {
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.DIALOGUE,
          dialogue: [{ speaker: 'Siege Warden', text: `This operation requires ${result.required} defenders. Only ${result.present} present in this area.` }],
        });
      }
      return;
    }
    if (result.tooManyPlayers) {
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.DIALOGUE,
          dialogue: [{ speaker: 'Siege Warden', text: `Maximum ${result.max} defenders allowed. ${result.present} are present — some must leave first.` }],
        });
      }
      return;
    }
    // Queue transitions for all party members to the siege arena
    const partyMembers = result.partyMembers || [context.playerId];
    for (const pid of partyMembers) {
      this.gameLoop.pendingTransitions.push({
        playerId: pid,
        fromRoom: context.roomId,
        toDungeon: result.roomId,
      });
    }
  }

  // Start an expedition: { type: "startExpedition", tier: 1 }
  // Generates a procedural dungeon with tier-scaled monsters and transitions the player
  doStartExpedition(action, context) {
    if (!this.gameLoop) {
      console.warn('[Actions] startExpedition requires gameLoop reference');
      return;
    }
    const tier = action.tier;
    if (!tier) {
      console.warn('[Actions] startExpedition missing tier');
      return;
    }
    const result = this.gameLoop.startExpedition(context.playerId, tier, context.roomId);
    if (!result) {
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.NPC_DIALOGUE,
          lines: [{ speaker: 'System', text: 'You do not meet the requirements for this expedition.' }],
        });
      }
      return;
    }
    if (result.insufficientPlayers) {
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.NPC_DIALOGUE,
          lines: [{ speaker: 'Expedition Board', text: `This expedition requires ${result.required} explorers. Only ${result.present} present in this area.` }],
        });
      }
      return;
    }
    if (result.insufficientSilicon) {
      if (this.sendToPlayer) {
        this.sendToPlayer(context.playerId, {
          type: CONSTANTS.MSG.NPC_DIALOGUE,
          lines: [{ speaker: 'Expedition Board', text: `Insufficient silicon. This expedition requires ${result.required} silicon. You have ${result.available}.` }],
        });
      }
      return;
    }
    // Queue transitions for all party members to the expedition room
    const partyMembers = result.partyMembers || [context.playerId];
    for (const pid of partyMembers) {
      this.gameLoop.pendingTransitions.push({
        playerId: pid,
        fromRoom: context.roomId,
        toDungeon: result.roomId,
      });
    }
  }

  doHealPlayer(action, context) {
    const player = context.player;
    if (!player) return;
    if (player.health >= player.maxHealth) return;
    player.health = player.maxHealth;
  }
}

module.exports = ActionExecutor;
