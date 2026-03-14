const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

class ActivityLog {
  constructor() {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    // Map playerId -> playerName for resolving ephemeral IDs
    this.playerNames = new Map();
  }

  _safeName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30).toLowerCase();
  }

  _filepath(playerName) {
    return path.join(LOGS_DIR, `${this._safeName(playerName)}.jsonl`);
  }

  // Register a playerId -> playerName mapping
  registerPlayer(playerId, playerName) {
    this.playerNames.set(playerId, playerName);
  }

  // Remove mapping on disconnect
  unregisterPlayer(playerId) {
    this.playerNames.delete(playerId);
  }

  // Resolve playerName from playerId, with optional fallback
  resolvePlayerName(playerId) {
    return this.playerNames.get(playerId) || null;
  }

  // Append one JSONL line for a player (by name)
  log(playerName, event, data) {
    if (!playerName) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), ev: event, ...data });
    fs.appendFile(this._filepath(playerName), line + '\n', (err) => {
      if (err) console.error(`[ActivityLog] Write error for "${playerName}":`, err.message);
    });
  }

  // Append one JSONL line resolving playerId to playerName
  logById(playerId, event, data) {
    const name = this.resolvePlayerName(playerId);
    if (name) this.log(name, event, data);
  }
}

module.exports = ActivityLog;
