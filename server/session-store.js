const fs = require('fs');
const path = require('path');

const SAVES_DIR = path.join(__dirname, '..', 'saves');

class SessionStore {
  constructor() {
    if (!fs.existsSync(SAVES_DIR)) {
      fs.mkdirSync(SAVES_DIR, { recursive: true });
    }
  }

  // Generate a safe filename from player name
  _filename(name) {
    const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30).toLowerCase();
    return `${safe}.json`;
  }

  _filepath(name) {
    return path.join(SAVES_DIR, this._filename(name));
  }

  // List all saved sessions (name, room, level, last saved)
  list() {
    if (!fs.existsSync(SAVES_DIR)) return [];
    const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
    const sessions = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SAVES_DIR, file), 'utf8'));
        sessions.push({
          name: data.name,
          room: data.room,
          level: data.level || 1,
          lastSaved: data.lastSaved || null,
        });
      } catch {
        // Skip corrupt files
      }
    }
    sessions.sort((a, b) => {
      // Most recently saved first
      if (a.lastSaved && b.lastSaved) return b.lastSaved.localeCompare(a.lastSaved);
      if (a.lastSaved) return -1;
      if (b.lastSaved) return 1;
      return a.name.localeCompare(b.name);
    });
    return sessions;
  }

  // Check if a session exists for this name
  exists(name) {
    return fs.existsSync(this._filepath(name));
  }

  // Load a saved session by player name
  load(name) {
    const filepath = this._filepath(name);
    if (!fs.existsSync(filepath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch {
      return null;
    }
  }

  // Save player state
  save(playerData) {
    const filepath = this._filepath(playerData.name);
    const data = {
      name: playerData.name,
      room: playerData.room,
      x: playerData.x,
      y: playerData.y,
      health: playerData.health,
      maxHealth: playerData.maxHealth,
      inventory: JSON.parse(JSON.stringify(playerData.inventory || [])),
      equipment: JSON.parse(JSON.stringify(playerData.equipment || {})),
      solGrid: playerData.solGrid ? JSON.parse(JSON.stringify(playerData.solGrid)) : null,
      energy: Math.round(playerData.energy || 0),
      maxEnergy: playerData.maxEnergy || 0,
      solGridEnergyRegen: playerData.solGridEnergyRegen || 0,
      flags: playerData.flags ? JSON.parse(JSON.stringify(playerData.flags)) : {},
      questState: playerData.questState || null,
      xp: playerData.xp || 0,
      level: playerData.level || 1,
      xpToNextLevel: playerData.xpToNextLevel || 100,
      medipacCharges: playerData.medipacCharges || 0,
      revealedChunks: playerData.revealedChunks || {},
      lastSaved: new Date().toISOString(),
    };
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`[SessionStore] Saved session for "${playerData.name}"`);
  }

  // Delete a session
  delete(name) {
    const filepath = this._filepath(name);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}

module.exports = SessionStore;
