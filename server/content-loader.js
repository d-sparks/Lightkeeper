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
    console.log(`[Content] Loaded ${Object.keys(this.dungeons).length} dungeon(s), ` +
                `${Object.keys(this.tilesets).length} tileset(s), ` +
                `${Object.keys(this.monsters).length} monster type(s), ` +
                `${Object.keys(this.npcs).length} NPC type(s), ` +
                `${Object.keys(this.items).length} item type(s), ` +
                `${Object.keys(this.abilities).length} ability(s), ` +
                `${Object.keys(this.quests).length} quest(s), ` +
                `${Object.keys(this.templates).length} template(s)`);
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

  getTileset(id) {
    return this.tilesets[id] || null;
  }

  // Check if a tile at (tileX, tileY) is solid in a given dungeon
  isSolid(dungeon, tileX, tileY) {
    if (tileX < 0 || tileY < 0 || tileX >= dungeon.width || tileY >= dungeon.height) {
      return true; // Out of bounds = solid
    }
    const tileId = dungeon.data[tileY * dungeon.width + tileX];
    const tileset = this.tilesets[dungeon.tileset];
    if (!tileset) return true;
    const tileDef = tileset.tiles[String(tileId)];
    if (!tileDef) return true;
    return tileDef.solid === true;
  }
}

module.exports = ContentLoader;
