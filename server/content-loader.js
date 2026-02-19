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
  }

  loadAll() {
    this.loadDungeons();
    this.loadTilesets();
    this.loadMonsters();
    this.loadNPCs();
    this.loadItems();
    console.log(`[Content] Loaded ${Object.keys(this.dungeons).length} dungeon(s), ` +
                `${Object.keys(this.tilesets).length} tileset(s), ` +
                `${Object.keys(this.monsters).length} monster type(s), ` +
                `${Object.keys(this.npcs).length} NPC type(s), ` +
                `${Object.keys(this.items).length} item type(s)`);
  }

  loadJSON(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
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
