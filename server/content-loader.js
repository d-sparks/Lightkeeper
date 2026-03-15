const fs = require('fs');
const path = require('path');

class ContentLoader {
  constructor(contentDir) {
    this.contentDir = contentDir;
    this.dungeons = {};
    this.tilesets = {};
    this.monsters = {};
    this.npcs = {};
    this.items = {};
    this.abilities = {};
    this.solUnits = {};
    this.solComponents = {};
    this.quests = {};
    this.templates = {};
    this.structures = {};
    this.lootTables = {};
    this.expeditions = {};
    this.affixes = {};
    this.crafting = {};
    this.shops = {};
    this.challenges = {};
    this.spireReplays = null;
    this.worldmap = null;
    this.settings = {};
  }

  loadAll() {
    this.loadSettings();
    this.loadDungeons();
    this.loadTilesets();
    this.loadMonsters();
    this.loadNPCs();
    this.loadItems();
    this.loadAbilities();
    this.loadSolUnits();
    this.loadSolComponents();
    this.loadQuests();
    this.loadTemplates();
    this.loadStructures();
    this.loadLootTables();
    this.loadExpeditions();
    this.loadAffixes();
    this.loadCrafting();
    this.loadShops();
    this.loadChallenges();
    this.loadSpireReplays();
    this.loadWorldmap();
    console.log(`[Content] Loaded ${Object.keys(this.dungeons).length} dungeon(s), ` +
                `${Object.keys(this.tilesets).length} tileset(s), ` +
                `${Object.keys(this.monsters).length} monster type(s), ` +
                `${Object.keys(this.npcs).length} NPC type(s), ` +
                `${Object.keys(this.items).length} item type(s), ` +
                `${Object.keys(this.abilities).length} ability(s), ` +
                `${Object.keys(this.quests).length} quest(s), ` +
                `${Object.keys(this.templates).length} template(s), ` +
                `${Object.keys(this.structures).length} structure(s), ` +
                `${Object.keys(this.lootTables).length} loot table(s), ` +
                `${Object.keys(this.expeditions).length} expedition(s), ` +
                `${Object.keys(this.affixes).length} affix(es), ` +
                `${Object.keys(this.crafting).length} crafting recipe(s), ` +
                `${Object.keys(this.shops).length} shop(s), ` +
                `${Object.keys(this.challenges).length} challenge(s)`);
  }

  loadJSON(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  }

  loadSettings() {
    const filePath = path.join(this.contentDir, 'settings.json');
    if (!fs.existsSync(filePath)) {
      this.settings = {};
      return;
    }
    this.settings = this.loadJSON(filePath);
    console.log(`[Content]   Settings: spawnRoom=${this.settings.spawnRoom || '(not set)'}`);
  }

  getSettings() {
    return this.settings;
  }

  getSpawnRoom() {
    return this.settings.spawnRoom || null;
  }

  getWaypoints() {
    return this.settings.waypoints || [];
  }

  loadDungeons() {
    const dir = path.join(this.contentDir, 'dungeons');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = this.loadJSON(path.join(dir, file));
      this.dungeons[data.id] = data;
      console.log(`[Content]   Dungeon: ${data.id} (${data.name}) ${data.width}x${data.height}`);
    }
  }

  loadTilesets() {
    const dir = path.join(this.contentDir, 'tilesets');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = this.loadJSON(path.join(dir, file));
      this.tilesets[data.id] = data;
      console.log(`[Content]   Tileset: ${data.id} (${Object.keys(data.tiles).length} tiles)`);
    }
  }

  loadMonsters() {
    const filePath = path.join(this.contentDir, 'entities', 'monsters.json');
    if (!fs.existsSync(filePath)) {
      this.monsters = {};
      return;
    }
    this.monsters = this.loadJSON(filePath);
    console.log(`[Content]   Monsters: ${Object.keys(this.monsters).length} types`);
  }

  loadNPCs() {
    const filePath = path.join(this.contentDir, 'entities', 'npcs.json');
    if (!fs.existsSync(filePath)) {
      this.npcs = {};
      return;
    }
    this.npcs = this.loadJSON(filePath);
    console.log(`[Content]   NPCs: ${Object.keys(this.npcs).length} types`);
  }

  loadItems() {
    const filePath = path.join(this.contentDir, 'entities', 'items.json');
    if (!fs.existsSync(filePath)) {
      this.items = {};
      return;
    }
    this.items = this.loadJSON(filePath);
    console.log(`[Content]   Items: ${Object.keys(this.items).length} types`);
  }

  getMonster(id) {
    return this.monsters[id] || null;
  }

  getNPC(id) {
    return this.npcs[id] || null;
  }

  getDungeon(id) {
    return this.dungeons[id] || null;
  }

  getItem(id) {
    return this.items[id] || null;
  }

  // Look up item by ID first, then by name (case-insensitive)
  findItem(query) {
    if (this.items[query]) return { id: query, def: this.items[query] };
    const lower = query.toLowerCase();
    for (const [id, item] of Object.entries(this.items)) {
      if (item.name && item.name.toLowerCase() === lower) return { id, def: item };
    }
    return null;
  }

  loadAbilities() {
    const filePath = path.join(this.contentDir, 'entities', 'abilities.json');
    if (!fs.existsSync(filePath)) {
      this.abilities = {};
      return;
    }
    this.abilities = this.loadJSON(filePath);
    console.log(`[Content]   Abilities: ${Object.keys(this.abilities).length} types`);
  }

  getAbility(id) {
    return this.abilities[id] || null;
  }

  loadSolUnits() {
    const filePath = path.join(this.contentDir, 'entities', 'sol_units.json');
    if (!fs.existsSync(filePath)) {
      this.solUnits = {};
      return;
    }
    this.solUnits = this.loadJSON(filePath);
    console.log(`[Content]   Sol Units: ${Object.keys(this.solUnits).length} types`);
  }

  getSolUnit(id) {
    return this.solUnits[id] || null;
  }

  loadSolComponents() {
    const filePath = path.join(this.contentDir, 'entities', 'sol_components.json');
    if (!fs.existsSync(filePath)) {
      this.solComponents = {};
      return;
    }
    this.solComponents = this.loadJSON(filePath);
    console.log(`[Content]   Sol Components: ${Object.keys(this.solComponents).length} types`);
  }

  getSolComponent(id) {
    return this.solComponents[id] || null;
  }

  loadQuests() {
    const dir = path.join(this.contentDir, 'quests');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = this.loadJSON(path.join(dir, file));
      this.quests[data.id] = data;
      console.log(`[Content]   Quest: ${data.id} (${data.name}, ${Object.keys(data.steps || {}).length} steps)`);
    }
  }

  getQuest(id) {
    return this.quests[id] || null;
  }

  getAllQuests() {
    return this.quests;
  }

  getAllItems() {
    return this.items;
  }

  getAllDungeons() {
    return this.dungeons;
  }

  loadTemplates() {
    const dir = path.join(this.contentDir, 'dungeons', 'templates');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = this.loadJSON(path.join(dir, file));
      this.templates[data.id] = data;
      console.log(`[Content]   Template: ${data.id}`);
    }
  }

  getTemplate(id) {
    return this.templates[id] || null;
  }

  loadStructures() {
    const filePath = path.join(this.contentDir, 'entities', 'structures.json');
    if (!fs.existsSync(filePath)) {
      this.structures = {};
      return;
    }
    this.structures = this.loadJSON(filePath);
    console.log(`[Content]   Structures: ${Object.keys(this.structures).length} types`);
  }

  getStructure(id) {
    return this.structures[id] || null;
  }

  getStructures() {
    return this.structures;
  }

  loadExpeditions() {
    const dir = path.join(this.contentDir, 'expeditions');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = this.loadJSON(path.join(dir, file));
      if (!data.id || data.tier == null) continue; // Skip non-expedition files (e.g. affixes.json)
      this.expeditions[data.id] = data;
      console.log(`[Content]   Expedition: ${data.id} (tier ${data.tier})`);
    }
  }

  getExpedition(id) {
    return this.expeditions[id] || null;
  }

  getExpeditionByTier(tier) {
    for (const exp of Object.values(this.expeditions)) {
      if (exp.tier === tier) return exp;
    }
    return null;
  }

  getAllExpeditions() {
    return this.expeditions;
  }

  loadAffixes() {
    const filePath = path.join(this.contentDir, 'expeditions', 'affixes.json');
    if (!fs.existsSync(filePath)) {
      this.affixes = {};
      return;
    }
    this.affixes = this.loadJSON(filePath);
    console.log(`[Content]   Affixes: ${Object.keys(this.affixes).length} types`);
  }

  getAffix(id) {
    return this.affixes[id] || null;
  }

  loadCrafting() {
    const filePath = path.join(this.contentDir, 'entities', 'crafting.json');
    if (!fs.existsSync(filePath)) {
      this.crafting = {};
      return;
    }
    this.crafting = this.loadJSON(filePath);
    console.log(`[Content]   Crafting: ${Object.keys(this.crafting).length} recipes`);
  }

  getCraftingRecipe(id) {
    return this.crafting[id] || null;
  }

  getAllCraftingRecipes() {
    return this.crafting;
  }

  loadShops() {
    const filePath = path.join(this.contentDir, 'entities', 'shops.json');
    if (!fs.existsSync(filePath)) {
      this.shops = {};
      return;
    }
    this.shops = this.loadJSON(filePath);
    console.log(`[Content]   Shops: ${Object.keys(this.shops).length} shops`);
  }

  getShop(id) {
    return this.shops[id] || null;
  }

  loadChallenges() {
    const dir = path.join(this.contentDir, 'challenges');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = this.loadJSON(path.join(dir, file));
      if (!data.id) continue;
      this.challenges[data.id] = data;
      console.log(`[Content]   Challenge: ${data.id} (${data.displayName})`);
    }
  }

  getChallenge(id) {
    return this.challenges[id] || null;
  }

  getAllChallenges() {
    return this.challenges;
  }

  loadSpireReplays() {
    const filePath = path.join(this.contentDir, 'spire_replays.json');
    if (!fs.existsSync(filePath)) {
      this.spireReplays = null;
      return;
    }
    this.spireReplays = this.loadJSON(filePath);
    // Build a lookup: dungeonId -> spire config for fast inner-floor checks
    this._spireInnerFloors = {};
    if (this.spireReplays && this.spireReplays.spires) {
      for (const [spireKey, spire] of Object.entries(this.spireReplays.spires)) {
        for (const floorId of spire.innerFloors) {
          this._spireInnerFloors[floorId] = { spireKey, ...spire };
        }
      }
    }
    const spireCount = this.spireReplays && this.spireReplays.spires
      ? Object.keys(this.spireReplays.spires).length : 0;
    console.log(`[Content]   Spire replays: ${spireCount} spires configured`);
  }

  getSpireReplays() {
    return this.spireReplays;
  }

  getSpireReplayForFloor(dungeonId) {
    return this._spireInnerFloors ? this._spireInnerFloors[dungeonId] || null : null;
  }

  getSpireReplayTier(tierId) {
    return this.spireReplays && this.spireReplays.tiers
      ? this.spireReplays.tiers[tierId] || null : null;
  }

  loadLootTables() {
    const dir = path.join(this.contentDir, 'loot');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = this.loadJSON(path.join(dir, file));
      Object.assign(this.lootTables, data);
    }
    console.log(`[Content]   Loot Tables: ${Object.keys(this.lootTables).length} tables`);
  }

  getLootTable(id) {
    return this.lootTables[id] || null;
  }

  loadWorldmap() {
    const filePath = path.join(this.contentDir, 'worldmap.json');
    if (!fs.existsSync(filePath)) {
      this.worldmap = null;
      return;
    }
    this.worldmap = this.loadJSON(filePath);

    // Auto-generate connections from actual dungeon exits
    this.worldmap.connections = this._buildWorldmapConnections();

    console.log(`[Content]   Worldmap: ${(this.worldmap.locations || []).length} locations, ${this.worldmap.connections.length} connections`);
  }

  // Build worldmap connections by scanning all dungeon exits for cross-location links
  _buildWorldmapConnections() {
    if (!this.worldmap || !this.worldmap.locations) return [];

    // Build room → location ID map
    const roomToLocation = {};
    for (const loc of this.worldmap.locations) {
      if (loc.rooms) {
        for (const roomId of loc.rooms) {
          roomToLocation[roomId] = loc.id;
        }
      }
    }

    // Find all cross-location connections from dungeon exits
    const connectionSet = new Set();
    for (const [dungeonId, dungeon] of Object.entries(this.dungeons)) {
      if (!dungeon.exits) continue;
      const srcLocation = roomToLocation[dungeonId];
      if (!srcLocation) continue;

      for (const exit of dungeon.exits) {
        const dstLocation = roomToLocation[exit.leadsTo];
        if (!dstLocation || dstLocation === srcLocation) continue;

        // Store as sorted pair to deduplicate bidirectional links
        const pair = [srcLocation, dstLocation].sort();
        connectionSet.add(pair.join('|'));
      }
    }

    return Array.from(connectionSet).map(key => key.split('|'));
  }

  getWorldmap() {
    return this.worldmap;
  }

  // Find which worldmap location a room belongs to
  getWorldmapLocation(roomId) {
    if (!this.worldmap) return null;
    for (const loc of this.worldmap.locations) {
      if (loc.rooms && loc.rooms.includes(roomId)) return loc.id;
    }
    return null;
  }

  getTileset(id) {
    return this.tilesets[id] || null;
  }

  // Get the tile definition at (tileX, tileY) in a dungeon
  getTileDef(dungeon, tileX, tileY) {
    if (tileX < 0 || tileY < 0 || tileX >= dungeon.width || tileY >= dungeon.height) {
      return null;
    }
    const tileId = dungeon.data[tileY * dungeon.width + tileX];
    const tileset = this.tilesets[dungeon.tileset];
    if (!tileset) return null;
    return tileset.tiles[String(tileId)] || null;
  }

  // Get elevation of a tile (0 = ground level, 1+ = raised)
  getTileElevation(dungeon, tileX, tileY) {
    const tileDef = this.getTileDef(dungeon, tileX, tileY);
    if (!tileDef) return 0;
    return tileDef.elevation || 0;
  }

  // Get ramp info for a tile, or null if not a ramp
  getRampInfo(dungeon, tileX, tileY) {
    const tileDef = this.getTileDef(dungeon, tileX, tileY);
    if (!tileDef || !tileDef.ramp) return null;
    return {
      dir: tileDef.rampDir,
      from: tileDef.rampFrom || 0,
      to: tileDef.rampTo || 1,
    };
  }

  // Check if a tile at (tileX, tileY) is solid for an entity at a given elevation
  isSolid(dungeon, tileX, tileY, entityElevation) {
    if (tileX < 0 || tileY < 0 || tileX >= dungeon.width || tileY >= dungeon.height) {
      return true; // Out of bounds = solid
    }
    const tileId = dungeon.data[tileY * dungeon.width + tileX];
    const tileset = this.tilesets[dungeon.tileset];
    if (!tileset) return true;
    const tileDef = tileset.tiles[String(tileId)];
    if (!tileDef) return true;
    if (!tileDef.solid) return false;

    // Elevation-aware: a wall at elevation 0 doesn't block an entity at elevation 1
    // (they're walking on top of it). But a wall at elevation 1 blocks entities at elevation 1.
    if (entityElevation !== undefined && entityElevation !== null) {
      const tileElev = tileDef.elevation || 0;
      // Entity above wall level can walk over it
      if (entityElevation > tileElev) return false;
      // Full walls block at all levels
      if (tileDef.fullWall) return true;
    }

    return true;
  }

  // Check if a tile is suitable for monster spawning (not solid, not interactable, not an exit)
  isSpawnable(dungeon, tileX, tileY) {
    if (tileX < 0 || tileY < 0 || tileX >= dungeon.width || tileY >= dungeon.height) {
      return false;
    }
    const tileId = dungeon.data[tileY * dungeon.width + tileX];
    const tileset = this.tilesets[dungeon.tileset];
    if (!tileset) return false;
    const tileDef = tileset.tiles[String(tileId)];
    if (!tileDef) return false;
    return !tileDef.solid && !tileDef.interactable && !tileDef.exit;
  }
}

module.exports = ContentLoader;
