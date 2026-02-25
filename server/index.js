const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const CONSTANTS = require('../shared/constants');
const ContentLoader = require('./content-loader');
const GameLoop = require('./game-loop');
const { handleEditorAPI } = require('./editor-api');
const { handleCheckpointAPI } = require('./checkpoint-api');
const { isAuthenticated, handleLogin, sendUnauthorized } = require('./editor-auth');
const contentGit = require('./content-git');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const CONTENT_DIR = path.join(__dirname, '..', 'content');
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const SHARED_DIR = path.join(__dirname, '..', 'shared');
const EDITOR_DIR = path.join(__dirname, '..', 'editor');
const CHECKPOINT_DIR = path.join(__dirname, '..', 'checkpoint');

// --- Load game content ---
const content = new ContentLoader(CONTENT_DIR);
content.loadAll();

// --- Game loop ---
const gameLoop = new GameLoop(content);
gameLoop.start();

// Default room + dungeon (read from content/settings.json)
function getDefaultRoom() {
  return content.getSpawnRoom() || 'outpost_entrance';
}
const DEFAULT_ROOM = getDefaultRoom();
gameLoop.createRoom(DEFAULT_ROOM, DEFAULT_ROOM);

// --- HTTP server (serves client files) ---
const MIME_TYPES = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const httpServer = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // --- Editor login (no auth required) ---
  if (urlPath === '/api/editor/login' && req.method === 'POST') {
    handleLogin(req, res);
    return;
  }

  // --- Editor auth check endpoint ---
  if (urlPath === '/api/editor/auth' && req.method === 'GET') {
    const authed = isAuthenticated(req);
    const needsAuth = !!process.env.EDITOR_PASSWORD;
    const gitConfigured = contentGit.isConfigured();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: authed, needsAuth, gitConfigured }));
    return;
  }

  // --- All other editor API routes require auth ---
  if (urlPath.startsWith('/api/editor/')) {
    if (!isAuthenticated(req)) { sendUnauthorized(res); return; }

    // Publish to git
    if (urlPath === '/api/editor/publish' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          let message;
          try { message = JSON.parse(body).message; } catch {}
          const result = await contentGit.publishChanges(message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          const status = e.message.includes('No content changes') ? 400 : 500;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // List remote branches
    if (urlPath === '/api/editor/branches' && req.method === 'GET') {
      try {
        const branches = contentGit.listBranches();
        const activeBranch = contentGit.getActiveBranch();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ branches, activeBranch }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // Load content from a specific branch
    if (urlPath === '/api/editor/branches/load' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { branch } = JSON.parse(body);
          if (!branch) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing branch name' }));
            return;
          }
          const result = contentGit.loadBranchContent(branch);
          content.loadAll();

          // Reload active rooms and notify players
          const reloaded = [];
          for (const [roomId] of gameLoop.rooms) {
            const updated = gameLoop.reloadRoom(roomId);
            if (!updated) continue;
            reloaded.push(roomId);
            const tileset = content.getTileset(updated.dungeon.tileset);
            const msg = JSON.stringify({
              type: CONSTANTS.MSG.FLOOR_CHANGE,
              map: updated.dungeon,
              tileset,
            });
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && client.playerRoom === roomId) {
                client.send(msg);
              }
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ...result, reloaded }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Refresh content from the currently loaded branch
    if (urlPath === '/api/editor/branches/refresh' && req.method === 'POST') {
      try {
        const result = contentGit.refreshBranchContent();
        content.loadAll();

        // Reload active rooms and notify players
        const reloaded = [];
        for (const [roomId] of gameLoop.rooms) {
          const updated = gameLoop.reloadRoom(roomId);
          if (!updated) continue;
          reloaded.push(roomId);
          const tileset = content.getTileset(updated.dungeon.tileset);
          const msg = JSON.stringify({
            type: CONSTANTS.MSG.FLOOR_CHANGE,
            map: updated.dungeon,
            tileset,
          });
          wss.clients.forEach((client) => {
            if (client.readyState === 1 && client.playerRoom === roomId) {
              client.send(msg);
            }
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...result, reloaded }));
      } catch (e) {
        const status = e.message.includes('No branch') ? 400 : 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    const handled = handleEditorAPI(req, res);
    if (handled !== false) return;
  }

  // --- Checkpoint login (no auth required) ---
  if (urlPath === '/api/checkpoint/login' && req.method === 'POST') {
    handleLogin(req, res);
    return;
  }

  // --- Checkpoint auth check endpoint ---
  if (urlPath === '/api/checkpoint/auth' && req.method === 'GET') {
    const authed = isAuthenticated(req);
    const needsAuth = !!process.env.EDITOR_PASSWORD;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: authed, needsAuth }));
    return;
  }

  // --- All other checkpoint API routes require auth ---
  if (urlPath.startsWith('/api/checkpoint/')) {
    if (!isAuthenticated(req)) { sendUnauthorized(res); return; }
    const handled = handleCheckpointAPI(req, res, gameLoop, wss, content);
    if (handled !== false) return;
  }

  // --- Debug API: inspect player flags and quest state ---
  if (urlPath.startsWith('/api/debug/player/') && req.method === 'GET') {
    const playerName = decodeURIComponent(urlPath.slice('/api/debug/player/'.length));
    let found = null;
    for (const [roomId, room] of gameLoop.rooms) {
      for (const [pid, player] of room.players) {
        if (player.name === playerName || pid === playerName) {
          found = {
            playerId: pid,
            name: player.name,
            roomId,
            flags: gameLoop.flagStore.getPlayerFlags(pid),
            questState: gameLoop.questTracker.getQuestStateForClient(pid),
            inventory: player.inventory,
            equipment: player.equipment,
          };
          break;
        }
      }
      if (found) break;
    }
    res.writeHead(found ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(found || { error: `Player "${playerName}" not found in any room` }));
    return;
  }

  // --- Debug API: list all connected players ---
  if (urlPath === '/api/debug/players' && req.method === 'GET') {
    const players = [];
    for (const [roomId, room] of gameLoop.rooms) {
      for (const [pid, player] of room.players) {
        players.push({ playerId: pid, name: player.name, roomId });
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(players));
    return;
  }

  // Editor reload endpoint (auth-protected)
  if (urlPath === '/api/editor/reload' && req.method === 'POST') {
    if (!isAuthenticated(req)) { sendUnauthorized(res); return; }
    content.loadAll();

    // Reload all active rooms and notify connected players
    const reloaded = [];
    for (const [roomId, room] of gameLoop.rooms) {
      const updated = gameLoop.reloadRoom(roomId);
      if (!updated) continue;
      reloaded.push(roomId);

      const tileset = content.getTileset(updated.dungeon.tileset);
      const msg = JSON.stringify({
        type: CONSTANTS.MSG.FLOOR_CHANGE,
        map: updated.dungeon,
        tileset,
      });
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.playerRoom === roomId) {
          client.send(msg);
        }
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ reloaded }));
    return;
  }

  // Editor static files (HTML/CSS/JS served without auth — the app handles login UI)
  if (urlPath === '/editor' || urlPath === '/editor/') {
    return serveFile(res, path.join(EDITOR_DIR, 'index.html'));
  }
  if (urlPath.startsWith('/editor/')) {
    return serveFile(res, path.join(EDITOR_DIR, urlPath.slice(8)));
  }

  // Checkpoint static files
  if (urlPath === '/checkpoint' || urlPath === '/checkpoint/') {
    return serveFile(res, path.join(CHECKPOINT_DIR, 'index.html'));
  }
  if (urlPath.startsWith('/checkpoint/')) {
    return serveFile(res, path.join(CHECKPOINT_DIR, urlPath.slice(12)));
  }

  if (urlPath === '/') {
    return serveFile(res, path.join(CLIENT_DIR, 'index.html'));
  }
  if (urlPath.startsWith('/shared/')) {
    return serveFile(res, path.join(SHARED_DIR, urlPath.slice(8)));
  }
  if (urlPath.startsWith('/content/')) {
    return serveFile(res, path.join(CONTENT_DIR, urlPath.slice(9)));
  }
  serveFile(res, path.join(CLIENT_DIR, urlPath));
});

// --- WebSocket server ---
const wss = new WebSocketServer({ server: httpServer });
let nextPlayerId = 1;

// Wire up scripting action callbacks so actions can send messages to players
gameLoop.actions.sendToPlayer = function (playerId, message) {
  const client = findClientByPlayerId(playerId);
  if (client) client.send(JSON.stringify(message));
};
gameLoop.actions.broadcastToRoom = function (roomId, message) {
  broadcast(roomId, message);
};

// Wire up quest objective callback (for manual setQuestObjective actions)
gameLoop.actions._onQuestObjectiveChanged = function (playerId, roomId) {
  gameLoop._sendQuestObjective(playerId, roomId);
};

// Wire up quest tracker callbacks
gameLoop.questTracker.onObjectiveChanged = function (playerId, roomId) {
  // Update player.questObjective from the quest tracker's active step
  const room = gameLoop.getRoom(roomId);
  if (!room) return;
  const player = room.players.get(playerId);
  if (!player) return;

  const objective = gameLoop.questTracker.getActiveObjective(playerId);
  player.questObjective = objective;
  gameLoop._sendQuestObjective(playerId, roomId);
};

gameLoop.questTracker.onStepCompleted = function (playerId, questId, stepId, stepDef) {
  const client = findClientByPlayerId(playerId);
  if (!client) return;

  // Send step completion toast
  client.send(JSON.stringify({
    type: CONSTANTS.MSG.QUEST_STEP_COMPLETE,
    questId,
    stepId,
    label: stepDef.label,
  }));

  // Send updated quest state
  client.send(JSON.stringify({
    type: CONSTANTS.MSG.QUEST_STATE,
    quests: gameLoop.questTracker.getQuestStateForClient(playerId),
  }));
};

// Wire up equip callback so actions can rebuild abilities
gameLoop.actions._getSolGridForClient = function (player) {
  return gameLoop.getSolGridForClient(player);
};

gameLoop.actions._onEquipChanged = function (player, itemDef) {
  // If equipping a sol unit, init the grid
  if (itemDef.hasSolGrid && itemDef.solUnitId) {
    const solUnitDef = content.getSolUnit(itemDef.solUnitId);
    if (solUnitDef) {
      gameLoop._initSolGrid(player, solUnitDef);
    }
  }
  gameLoop._rebuildAbilities(player);
};

wss.on('connection', (ws) => {
  const playerId = `p${nextPlayerId++}`;
  ws.playerId = playerId;
  ws.playerRoom = null;
  ws.playerName = null;

  console.log(`[WS] Client connected: ${playerId}`);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    switch (msg.type) {
      case CONSTANTS.MSG.JOIN: {
        ws.playerName = msg.name || `Player ${nextPlayerId}`;
        const spawnRoom = getDefaultRoom();
        const room0 = gameLoop.getOrCreateRoom(spawnRoom);
        ws.playerRoom = spawnRoom;

        const player = gameLoop.addPlayer(ws.playerRoom, playerId, ws.playerName);
        if (!player) {
          ws.send(JSON.stringify({ type: 'error', message: 'Could not join room' }));
          return;
        }

        const room = gameLoop.getRoom(ws.playerRoom);
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.WELCOME,
          playerId,
          map: room.dungeon,
          tileset: content.getTileset(room.dungeon.tileset),
        }));

        // Send initial empty inventory and equipment
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.INVENTORY,
          items: player.inventory,
          equipment: player.equipment,
        }));

        // Send initial ability state
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.ABILITY_STATE,
          abilities: player.abilities,
          cooldowns: player.cooldowns,
        }));

        // Send initial quest state
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.QUEST_STATE,
          quests: gameLoop.questTracker.getQuestStateForClient(playerId),
        }));

        // Set initial objective from quest tracker and send it
        const objective = gameLoop.questTracker.getActiveObjective(playerId);
        if (objective) {
          player.questObjective = objective;
          gameLoop._sendQuestObjective(playerId, ws.playerRoom);
        }

        broadcast(ws.playerRoom, {
          type: CONSTANTS.MSG.PLAYER_JOIN,
          playerId,
          name: ws.playerName,
        }, playerId);
        break;
      }

      case CONSTANTS.MSG.INPUT: {
        if (ws.playerRoom) {
          gameLoop.setPlayerInput(ws.playerRoom, playerId, msg.keys);
        }
        break;
      }

      case CONSTANTS.MSG.INTERACT: {
        if (!ws.playerRoom) break;
        const result = gameLoop.tryInteract(ws.playerRoom, playerId);
        if (!result) break;

        if (result.interactType === 'dialogue') {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.DIALOGUE,
            npcId: result.npcId,
            dialogue: result.dialogue,
          }));
        } else if (result.interactType === 'message') {
          // Condition failed message (e.g. locked door)
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.DIALOGUE,
            dialogue: [{ speaker: '', text: result.text }],
          }));
        } else if (result.interactType === 'door') {
          // Broadcast door toggle to all players in the room
          broadcast(ws.playerRoom, {
            type: CONSTANTS.MSG.DOOR_TOGGLE,
            x: result.x,
            y: result.y,
            tileId: result.tileId,
          });
        } else if (result.interactType === 'pickup') {
          // Send updated inventory to the picking player
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.INVENTORY,
            items: result.inventory,
            equipment: result.equipment,
          }));
        }
        break;
      }

      case CONSTANTS.MSG.EQUIP: {
        if (!ws.playerRoom) break;
        const equipResult = gameLoop.tryEquip(ws.playerRoom, playerId, msg.index);
        if (equipResult) {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.INVENTORY,
            items: equipResult.inventory,
            equipment: equipResult.equipment,
          }));
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.ABILITY_STATE,
            abilities: equipResult.abilities,
            cooldowns: equipResult.cooldowns,
          }));
          // Send sol grid state if applicable
          const room = gameLoop.getRoom(ws.playerRoom);
          const p = room && room.players.get(playerId);
          if (p && p.solGrid) {
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.SOL_GRID,
              grid: gameLoop.getSolGridForClient(p),
            }));
          }
        }
        break;
      }

      case CONSTANTS.MSG.UNEQUIP: {
        if (!ws.playerRoom) break;
        const unequipResult = gameLoop.tryUnequip(ws.playerRoom, playerId, msg.slot);
        if (unequipResult) {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.INVENTORY,
            items: unequipResult.inventory,
            equipment: unequipResult.equipment,
          }));
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.ABILITY_STATE,
            abilities: unequipResult.abilities,
            cooldowns: unequipResult.cooldowns,
          }));
          // Send sol grid state (null clears client-side grid)
          const unequipRoom = gameLoop.getRoom(ws.playerRoom);
          const unequipPlayer = unequipRoom && unequipRoom.players.get(playerId);
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.SOL_GRID,
            grid: gameLoop.getSolGridForClient(unequipPlayer),
          }));
        }
        break;
      }

      case CONSTANTS.MSG.USE_ITEM: {
        if (!ws.playerRoom) break;
        const useResult = gameLoop.tryUseItem(ws.playerRoom, playerId, msg.index);
        if (useResult) {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.INVENTORY,
            items: useResult.inventory,
            equipment: useResult.equipment,
          }));
        }
        break;
      }

      case CONSTANTS.MSG.ATTACK: {
        if (!ws.playerRoom) break;
        const aimAngle = (msg.aimAngle !== undefined) ? msg.aimAngle : null;
        const attackSlot = msg.slot || 1;
        gameLoop.tryUseAbility(ws.playerRoom, playerId, attackSlot, aimAngle);
        break;
      }

      case CONSTANTS.MSG.SOL_GRID_MOVE: {
        if (!ws.playerRoom) break;
        const room = gameLoop.getRoom(ws.playerRoom);
        if (!room) break;
        const p = room.players.get(playerId);
        if (!p || !p.solGrid) break;
        const { fromIdx, toIdx } = msg;
        const gridLen = p.solGrid.size * p.solGrid.size;
        if (fromIdx < 0 || fromIdx >= gridLen || toIdx < 0 || toIdx >= gridLen) break;
        // Swap the two cells
        const temp = p.solGrid.cells[fromIdx];
        p.solGrid.cells[fromIdx] = p.solGrid.cells[toIdx];
        p.solGrid.cells[toIdx] = temp;
        gameLoop._rebuildAbilities(p);
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.SOL_GRID,
          grid: gameLoop.getSolGridForClient(p),
        }));
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.ABILITY_STATE,
          abilities: p.abilities,
          cooldowns: p.cooldowns,
        }));
        break;
      }

      case CONSTANTS.MSG.SOL_GRID_PLACE: {
        if (!ws.playerRoom) break;
        const ok = gameLoop.trySolGridPlace(
          ws.playerRoom, playerId, msg.inventoryIndex, msg.gridX, msg.gridY
        );
        if (ok) {
          const room2 = gameLoop.getRoom(ws.playerRoom);
          const p2 = room2 && room2.players.get(playerId);
          if (p2) {
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.SOL_GRID,
              grid: gameLoop.getSolGridForClient(p2),
            }));
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.INVENTORY,
              items: p2.inventory,
              equipment: p2.equipment,
            }));
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.ABILITY_STATE,
              abilities: p2.abilities,
              cooldowns: p2.cooldowns,
            }));
          }
        }
        break;
      }

      case CONSTANTS.MSG.SOL_GRID_REMOVE: {
        if (!ws.playerRoom) break;
        const ok2 = gameLoop.trySolGridRemove(
          ws.playerRoom, playerId, msg.gridX, msg.gridY
        );
        if (ok2) {
          const room3 = gameLoop.getRoom(ws.playerRoom);
          const p3 = room3 && room3.players.get(playerId);
          if (p3) {
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.SOL_GRID,
              grid: gameLoop.getSolGridForClient(p3),
            }));
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.INVENTORY,
              items: p3.inventory,
              equipment: p3.equipment,
            }));
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.ABILITY_STATE,
              abilities: p3.abilities,
              cooldowns: p3.cooldowns,
            }));
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected: ${playerId}`);
    if (ws.playerRoom) {
      gameLoop.removePlayer(ws.playerRoom, playerId);
      broadcast(ws.playerRoom, {
        type: CONSTANTS.MSG.PLAYER_LEAVE,
        playerId,
      });
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error for ${playerId}:`, err.message);
  });
});

// Broadcast to all clients in a room, optionally excluding one
function broadcast(roomId, message, excludeId) {
  const json = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.playerRoom === roomId) {
      if (!excludeId || client.playerId !== excludeId) {
        client.send(json);
      }
    }
  });
}

function findClientByPlayerId(playerId) {
  for (const client of wss.clients) {
    if (client.playerId === playerId && client.readyState === 1) {
      return client;
    }
  }
  return null;
}

// State broadcast loop
setInterval(() => {
  // Process floor transitions
  const transitions = gameLoop.consumeTransitions();
  for (const t of transitions) {
    const ws = findClientByPlayerId(t.playerId);
    if (!ws) continue;

    const player = gameLoop.removePlayer(t.fromRoom, t.playerId);
    if (!player) continue;

    const targetRoom = gameLoop.getOrCreateRoom(t.toDungeon, {
      fromDungeon: t.fromRoom,
      exitX: t.exitX,
      exitY: t.exitY,
      depth: t.depth,
    });
    if (!targetRoom) continue;

    // Use the room's actual ID (may differ from t.toDungeon for procedural instances)
    const targetRoomId = targetRoom.id;

    // If exit didn't specify spawnX/Y, use target dungeon's spawn points
    let spawnX = t.spawnX;
    let spawnY = t.spawnY;
    if (spawnX == null || spawnY == null) {
      const sp = (targetRoom.dungeon.spawns && targetRoom.dungeon.spawns[0]) || { x: 2, y: 2 };
      spawnX = sp.x;
      spawnY = sp.y;
    }
    gameLoop.addPlayerAt(targetRoomId, player, spawnX, spawnY);
    ws.playerRoom = targetRoomId;

    ws.send(JSON.stringify({
      type: CONSTANTS.MSG.FLOOR_CHANGE,
      map: targetRoom.dungeon,
      tileset: content.getTileset(targetRoom.dungeon.tileset),
    }));

    // Re-send quest objective with updated exit resolution for new room
    if (player.questObjective) {
      gameLoop._sendQuestObjective(t.playerId, targetRoomId);
    }
  }

  // Send state to each room's players
  for (const [roomId, room] of gameLoop.rooms) {
    const state = gameLoop.getRoomState(roomId);
    if (!state) continue;
    // Send per-player state with their own cooldowns
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.playerRoom === roomId) {
        const player = room.players.get(client.playerId);
        if (player) {
          state.myCooldowns = player.cooldowns;
        }
        client.send(JSON.stringify(state));
      }
    });
  }
}, CONSTANTS.TICK_INTERVAL);

// --- Start ---
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏰 Lightkeeper server running at http://0.0.0.0:${PORT}\n`);
});
