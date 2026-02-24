const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHECKPOINT_DIR = path.join(__dirname, '..', 'checkpoints');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleCheckpointAPI(req, res, gameLoop, wss, content) {
  const url = req.url.split('?')[0];
  const method = req.method;

  // --- List active in-game sessions ---
  if (url === '/api/checkpoint/sessions' && method === 'GET') {
    const sessions = [];
    wss.clients.forEach((client) => {
      if (client.readyState !== 1 || !client.playerRoom) return;
      const room = gameLoop.getRoom(client.playerRoom);
      if (!room) return;
      const player = room.players.get(client.playerId);
      if (!player) return;
      sessions.push({
        playerId: client.playerId,
        name: player.name,
        room: client.playerRoom,
        health: player.health,
        maxHealth: player.maxHealth,
        energy: Math.round(player.energy),
        maxEnergy: player.maxEnergy,
      });
    });
    return json(res, 200, sessions);
  }

  // --- List saved checkpoints ---
  if (url === '/api/checkpoint/saves' && method === 'GET') {
    if (!fs.existsSync(CHECKPOINT_DIR)) return json(res, 200, []);
    const files = fs.readdirSync(CHECKPOINT_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    const saves = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CHECKPOINT_DIR, f), 'utf8'));
        return {
          file: f,
          label: data.label || f,
          playerName: data.playerName || '',
          room: data.room || '',
          timestamp: data.timestamp || '',
        };
      } catch {
        return { file: f, label: f, playerName: '', room: '', timestamp: '' };
      }
    });
    return json(res, 200, saves);
  }

  // --- Save checkpoint ---
  if (url === '/api/checkpoint/save' && method === 'POST') {
    return parseBody(req).then(body => {
      const { playerId } = body;
      if (!playerId) return json(res, 400, { error: 'Missing playerId' });

      // Find the WebSocket client for this player
      let ws = null;
      wss.clients.forEach((client) => {
        if (client.playerId === playerId && client.readyState === 1) ws = client;
      });
      if (!ws || !ws.playerRoom) return json(res, 404, { error: 'Player not found or not in a room' });

      const room = gameLoop.getRoom(ws.playerRoom);
      if (!room) return json(res, 404, { error: 'Room not found' });
      const player = room.players.get(playerId);
      if (!player) return json(res, 404, { error: 'Player not in room' });

      const now = new Date();
      const checkpoint = {
        label: `${player.name} - ${now.toLocaleString()}`,
        playerName: player.name,
        room: ws.playerRoom,
        timestamp: now.toISOString(),
        x: player.x,
        y: player.y,
        health: player.health,
        maxHealth: player.maxHealth,
        energy: Math.round(player.energy),
        maxEnergy: player.maxEnergy,
        inventory: JSON.parse(JSON.stringify(player.inventory)),
        equipment: JSON.parse(JSON.stringify(player.equipment)),
        solGrid: player.solGrid ? JSON.parse(JSON.stringify(player.solGrid)) : null,
        flags: JSON.parse(JSON.stringify(gameLoop.flagStore.getPlayerFlags(playerId))),
        questState: gameLoop.questTracker.serializePlayerState(playerId),
      };

      // Safe filename: alphanumeric player name + timestamp
      const safeName = player.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
      const ts = now.toISOString().replace(/[:.]/g, '-');
      const filename = `${safeName}_${ts}.json`;

      if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
      fs.writeFileSync(path.join(CHECKPOINT_DIR, filename), JSON.stringify(checkpoint, null, 2));

      return json(res, 200, { ok: true, file: filename, label: checkpoint.label });
    }).catch(() => json(res, 400, { error: 'Invalid request' }));
  }

  // --- Load checkpoint onto a player ---
  if (url === '/api/checkpoint/load' && method === 'POST') {
    return parseBody(req).then(body => {
      const { file, playerId } = body;
      if (!file || !playerId) return json(res, 400, { error: 'Missing file or playerId' });

      // Sanitize filename
      const safeFile = path.basename(file);
      const filePath = path.join(CHECKPOINT_DIR, safeFile);
      if (!fs.existsSync(filePath)) return json(res, 404, { error: 'Checkpoint file not found' });

      let checkpoint;
      try {
        checkpoint = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return json(res, 400, { error: 'Invalid checkpoint file' });
      }

      // Find target player
      let ws = null;
      wss.clients.forEach((client) => {
        if (client.playerId === playerId && client.readyState === 1) ws = client;
      });
      if (!ws || !ws.playerRoom) return json(res, 404, { error: 'Target player not found or not in a room' });

      const room = gameLoop.getRoom(ws.playerRoom);
      if (!room) return json(res, 404, { error: 'Room not found' });
      const player = room.players.get(playerId);
      if (!player) return json(res, 404, { error: 'Player not in room' });

      // Mutate player state
      player.inventory = JSON.parse(JSON.stringify(checkpoint.inventory || []));
      player.equipment = JSON.parse(JSON.stringify(checkpoint.equipment || { arms: null, medipac: null, accessory: null }));
      player.solGrid = checkpoint.solGrid ? JSON.parse(JSON.stringify(checkpoint.solGrid)) : null;
      player.health = checkpoint.health || player.maxHealth;
      player.maxHealth = checkpoint.maxHealth || player.maxHealth;
      player.energy = checkpoint.energy || 0;
      player.maxEnergy = checkpoint.maxEnergy || 0;

      // Replace flags
      if (checkpoint.flags) {
        gameLoop.flagStore.playerFlags.set(playerId, JSON.parse(JSON.stringify(checkpoint.flags)));
      }

      // Restore quest state
      if (checkpoint.questState) {
        gameLoop.questTracker.restorePlayerState(playerId, checkpoint.questState);
      }

      // Rebuild abilities from restored equipment/solGrid
      gameLoop._rebuildAbilities(player);

      // Room transition if checkpoint is from a different room
      if (checkpoint.room && ws.playerRoom !== checkpoint.room) {
        const fromRoom = ws.playerRoom;
        gameLoop.removePlayer(fromRoom, playerId);

        const targetRoom = gameLoop.getOrCreateRoom(checkpoint.room);
        if (!targetRoom) return json(res, 500, { error: 'Could not create target room' });

        // Place player at checkpoint position (convert px to tile coords for addPlayerAt)
        const TILE_SIZE = 32;
        const spawnTX = Math.floor(checkpoint.x / TILE_SIZE);
        const spawnTY = Math.floor(checkpoint.y / TILE_SIZE);
        gameLoop.addPlayerAt(checkpoint.room, player, spawnTX, spawnTY);
        // Override with exact pixel position from checkpoint
        player.x = checkpoint.x;
        player.y = checkpoint.y;
        ws.playerRoom = checkpoint.room;

        ws.send(JSON.stringify({
          type: 'floor_change',
          map: targetRoom.dungeon,
          tileset: content.getTileset(targetRoom.dungeon.tileset),
        }));
      } else {
        // Same room — restore exact position
        player.x = checkpoint.x;
        player.y = checkpoint.y;
      }

      // Resync client
      ws.send(JSON.stringify({
        type: 'inventory',
        items: player.inventory,
        equipment: player.equipment,
      }));
      ws.send(JSON.stringify({
        type: 'ability_state',
        abilities: player.abilities,
        cooldowns: player.cooldowns,
      }));
      if (player.solGrid) {
        ws.send(JSON.stringify({
          type: 'sol_grid',
          grid: player.solGrid,
        }));
      }

      // Send restored quest state
      ws.send(JSON.stringify({
        type: 'quest_state',
        quests: gameLoop.questTracker.getQuestStateForClient(playerId),
      }));

      // Update quest objective from tracker
      const objective = gameLoop.questTracker.getActiveObjective(playerId);
      if (objective) {
        player.questObjective = objective;
        gameLoop._sendQuestObjective(playerId, ws.playerRoom);
      }

      return json(res, 200, { ok: true, label: checkpoint.label });
    }).catch(() => json(res, 400, { error: 'Invalid request' }));
  }

  // --- Delete a checkpoint ---
  const deleteMatch = url.match(/^\/api\/checkpoint\/saves\/(.+)$/);
  if (deleteMatch && method === 'DELETE') {
    const safeFile = path.basename(deleteMatch[1]);
    const filePath = path.join(CHECKPOINT_DIR, safeFile);
    if (!fs.existsSync(filePath)) return json(res, 404, { error: 'Not found' });
    fs.unlinkSync(filePath);
    return json(res, 200, { ok: true, deleted: safeFile });
  }

  // --- Commit checkpoints to git (branch + push + PR) ---
  if (url === '/api/checkpoint/commit' && method === 'POST') {
    return parseBody(req).then(async body => {
      const message = body.message || 'Save checkpoints';
      const APP_DIR = path.join(__dirname, '..');
      const git = (args) => execFileSync('git', args, { cwd: APP_DIR, encoding: 'utf8', timeout: 30000 }).trim();
      const baseBranch = process.env.GITHUB_BASE_BRANCH || 'main';

      try {
        git(['fetch', 'origin', baseBranch]);

        // Save current HEAD so we can restore it after
        const origRef = git(['symbolic-ref', 'HEAD']);

        // Create a new branch from origin/main without touching working tree
        const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const branch = `checkpoint/${ts}`;

        try {
          git(['branch', branch, `origin/${baseBranch}`]);
          git(['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
          git(['reset', `origin/${baseBranch}`]); // index = main, working tree untouched

          // Stage only checkpoints/
          git(['add', 'checkpoints/']);

          // Check if there are actual changes
          try {
            git(['diff', '--cached', '--quiet']);
            // No changes — clean up
            git(['branch', '-D', branch]);
            return json(res, 400, { error: 'Nothing to commit' });
          } catch {
            // diff --quiet exits non-zero when there ARE changes — good
          }

          git(['commit', '-m', message]);
          git(['push', '-u', 'origin', branch]);

          // Try to create PR via gh CLI
          let prUrl = null;
          try {
            prUrl = execFileSync('gh', [
              'pr', 'create',
              '--title', message,
              '--body', `Checkpoint save from the Lightkeeper checkpoint tool.\n\nBranch: \`${branch}\``,
              '--base', baseBranch,
              '--head', branch,
            ], { cwd: APP_DIR, encoding: 'utf8', timeout: 30000 }).trim();
          } catch {
            // gh CLI not available or failed — branch was still pushed
          }

          return json(res, 200, { ok: true, message, branch, prUrl });
        } finally {
          // Restore original HEAD and index
          git(['symbolic-ref', 'HEAD', origRef]);
          git(['reset']); // re-sync index with restored HEAD, working tree untouched
        }
      } catch (e) {
        const stderr = e.stderr ? e.stderr.toString() : e.message;
        if (stderr.includes('Nothing to commit')) {
          return json(res, 400, { error: 'Nothing to commit' });
        }
        return json(res, 500, { error: stderr });
      }
    }).catch(() => json(res, 400, { error: 'Invalid request' }));
  }

  return false;
}

module.exports = { handleCheckpointAPI };
