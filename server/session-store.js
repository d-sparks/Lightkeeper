const fs = require('fs');
const path = require('path');

const SAVES_DIR = path.join(__dirname, '..', 'saves');
const HISTORY_DIR = path.join(SAVES_DIR, 'history');
const MAX_HISTORY = 5;

class SessionStore {
  constructor() {
    if (!fs.existsSync(SAVES_DIR)) {
      fs.mkdirSync(SAVES_DIR, { recursive: true });
    }
    if (!fs.existsSync(HISTORY_DIR)) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
  }

  // Generate a safe filename from player name
  _filename(name) {
    const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30).toLowerCase();
    return `${safe}.json`;
  }

  _safeName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30).toLowerCase();
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
      sessionToken: playerData.sessionToken,
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
      credits: playerData.credits || 0,
      revealedChunks: playerData.revealedChunks || {},
      automationState: playerData.automationState ? JSON.parse(JSON.stringify(playerData.automationState)) : null,
      lastSaved: new Date().toISOString(),
    };
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    this._writeHistory(playerData.name, data);
    console.log(`[SessionStore] Saved session for "${playerData.name}"`);
  }

  _writeHistory(name, data) {
    const safe = this._safeName(name);
    const ts = data.lastSaved.replace(/[:.]/g, '-');
    const filename = `${safe}_${ts}.json`;
    fs.writeFileSync(path.join(HISTORY_DIR, filename), JSON.stringify(data, null, 2));
    this._pruneHistory(safe);
  }

  _pruneHistory(safe) {
    const files = fs.readdirSync(HISTORY_DIR)
      .filter(f => f.startsWith(safe + '_') && f.endsWith('.json'))
      .sort(); // ISO timestamps sort lexicographically
    if (files.length > MAX_HISTORY) {
      const toDelete = files.slice(0, files.length - MAX_HISTORY);
      for (const f of toDelete) {
        try { fs.unlinkSync(path.join(HISTORY_DIR, f)); } catch {}
      }
    }
  }

  // List autosave history for a player, most recent first
  listHistory(name) {
    if (!fs.existsSync(HISTORY_DIR)) return [];
    const safe = this._safeName(name);
    const files = fs.readdirSync(HISTORY_DIR)
      .filter(f => f.startsWith(safe + '_') && f.endsWith('.json'))
      .sort()
      .reverse();
    return files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8'));
        return {
          filename: f,
          timestamp: data.lastSaved,
          room: data.room || '',
          level: data.level || 1,
          health: data.health,
          maxHealth: data.maxHealth,
          xp: data.xp || 0,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  // Load a specific autosave history file for a player
  loadHistory(name, filename) {
    const safe = this._safeName(name);
    const safeFile = path.basename(filename);
    // Validate the file belongs to this player
    if (!safeFile.startsWith(safe + '_') || !safeFile.endsWith('.json')) return null;
    const filepath = path.join(HISTORY_DIR, safeFile);
    if (!fs.existsSync(filepath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch {
      return null;
    }
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
