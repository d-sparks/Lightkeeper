const http = require('http');
const crypto = require('crypto');
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
const ChunkManager = require('./chunk-manager');
const SessionStore = require('./session-store');

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

// --- Chunk manager for map streaming ---
const chunkManager = new ChunkManager();

// --- Session persistence ---
const sessionStore = new SessionStore();

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

gameLoop.questTracker.onQuestStarted = function (playerId, questId, quest) {
  const client = findClientByPlayerId(playerId);
  if (!client) return;

  // Send quest started toast
  client.send(JSON.stringify({
    type: CONSTANTS.MSG.QUEST_STARTED,
    questId,
    name: quest.name,
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

gameLoop.actions._onGrantXp = function (player, amount, room) {
  gameLoop.grantXp(player, amount, room);
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
      case CONSTANTS.MSG.SESSION_LIST: {
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.SESSION_LIST_RESPONSE,
          sessions: sessionStore.list(),
        }));
        break;
      }

      case CONSTANTS.MSG.SESSION_DELETE: {
        const delName = msg.name;
        const delSession = delName ? sessionStore.load(delName) : null;
        if (!delSession) {
          ws.send(JSON.stringify({ type: CONSTANTS.MSG.SESSION_DELETE_RESPONSE, success: false, name: delName, error: 'not_found' }));
          break;
        }
        // Require the correct session token to delete
        const storedToken = delSession.sessionToken;
        if (storedToken && msg.token !== storedToken) {
          ws.send(JSON.stringify({ type: CONSTANTS.MSG.SESSION_DELETE_RESPONSE, success: false, name: delName, error: 'unauthorized' }));
          break;
        }
        // Reject if the character is currently online
        const isOnline = [...wss.clients].some(c => c !== ws && c.playerName === delName);
        if (isOnline) {
          ws.send(JSON.stringify({ type: CONSTANTS.MSG.SESSION_DELETE_RESPONSE, success: false, name: delName, error: 'online' }));
          break;
        }
        sessionStore.delete(delName);
        ws.send(JSON.stringify({ type: CONSTANTS.MSG.SESSION_DELETE_RESPONSE, success: true, name: delName }));
        break;
      }

      case CONSTANTS.MSG.JOIN: {
        const savedSession = msg.name ? sessionStore.load(msg.name) : null;
        ws.playerName = msg.name || `Player ${nextPlayerId}`;

        // --- Session auth: prevent character hijacking ---
        if (savedSession) {
          // Reject if session has a token and client didn't provide the right one
          if (savedSession.sessionToken && savedSession.sessionToken !== msg.sessionToken) {
            ws.send(JSON.stringify({ type: 'error', message: 'Session token mismatch — this character belongs to another player.' }));
            return;
          }
          // Prevent concurrent logins to the same character
          for (const client of wss.clients) {
            if (client !== ws && client.readyState === 1 && client.playerName === ws.playerName && client.playerRoom) {
              ws.send(JSON.stringify({ type: 'error', message: 'This character is already logged in from another session.' }));
              return;
            }
          }
        }

        // Generate session token for new characters (or backfill old saves without one)
        const sessionToken = (savedSession && savedSession.sessionToken) || crypto.randomBytes(24).toString('hex');
        ws.sessionToken = sessionToken;

        // Determine spawn room: saved session room or default
        const targetRoom = (savedSession && savedSession.room) || getDefaultRoom();
        gameLoop.getOrCreateRoom(targetRoom);
        ws.playerRoom = targetRoom;

        const player = gameLoop.addPlayer(ws.playerRoom, playerId, ws.playerName);
        if (!player) {
          ws.send(JSON.stringify({ type: 'error', message: 'Could not join room' }));
          return;
        }

        // Restore saved session state onto the player
        if (savedSession) {
          player.x = savedSession.x || player.x;
          player.y = savedSession.y || player.y;
          player.health = savedSession.health || player.health;
          player.maxHealth = savedSession.maxHealth || player.maxHealth;
          player.inventory = JSON.parse(JSON.stringify(savedSession.inventory || []));
          player.equipment = JSON.parse(JSON.stringify(savedSession.equipment || { arms: null, sol_unit: null, medipac: null, accessory: null }));
          player.solGrid = savedSession.solGrid ? JSON.parse(JSON.stringify(savedSession.solGrid)) : null;
          player.energy = savedSession.energy || 0;
          player.maxEnergy = savedSession.maxEnergy || 0;
          player.solGridEnergyRegen = savedSession.solGridEnergyRegen || 0;
          player.xp = savedSession.xp || 0;
          player.level = savedSession.level || 1;
          player.xpToNextLevel = savedSession.xpToNextLevel || gameLoop._xpForLevel(player.level);
          player.medipacCharges = savedSession.medipacCharges || 0;
          player.credits = savedSession.credits || 0;

          // Restore flags
          if (savedSession.flags) {
            gameLoop.flagStore.playerFlags.set(playerId, JSON.parse(JSON.stringify(savedSession.flags)));
          }

          // Restore quest state
          if (savedSession.questState) {
            const restoreRoom = gameLoop.getRoom(ws.playerRoom);
            const restoreCtx = { playerId, roomId: ws.playerRoom, room: restoreRoom, player };
            gameLoop.questTracker.restorePlayerState(playerId, savedSession.questState, restoreCtx);
          }

          // Rebuild abilities from restored equipment/solGrid
          gameLoop._rebuildAbilities(player);

          // Restore revealed chunks
          if (savedSession.revealedChunks) {
            for (const [roomId, chunkKeys] of Object.entries(savedSession.revealedChunks)) {
              chunkManager.markSent(playerId, roomId, chunkKeys);
            }
          }

          // Restore automation state (structures, resources, production timers)
          if (savedSession.automationState) {
            gameLoop.automation.restoreState(playerId, savedSession.automationState);
          }

          console.log(`[Session] Restored saved session for "${ws.playerName}"`);
        }

        const room = gameLoop.getRoom(ws.playerRoom);
        const overlayedDungeon = gameLoop.automation.getOverlayedMapData(playerId, room.dungeon);
        // Send map metadata without tile data; chunks will fill it in
        const { data: _stripData, ...mapMeta } = overlayedDungeon;
        // Compute initial visible chunks around spawn
        const welcomePlayer = room.players.get(playerId);
        const visibleKeys = chunkManager.getVisibleChunks(welcomePlayer.x, welcomePlayer.y, overlayedDungeon);

        // Also include previously revealed chunks for this room
        const previouslyRevealed = savedSession && savedSession.revealedChunks && savedSession.revealedChunks[ws.playerRoom];
        const allChunkKeys = new Set(visibleKeys);
        if (previouslyRevealed) {
          for (const key of previouslyRevealed) allChunkKeys.add(key);
        }

        const initialChunks = [];
        for (const key of allChunkKeys) {
          const { cx, cy } = chunkManager.parseKey(key);
          initialChunks.push(chunkManager.extractChunk(overlayedDungeon, cx, cy));
        }
        chunkManager.markSent(playerId, ws.playerRoom, [...allChunkKeys]);
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.WELCOME,
          playerId,
          sessionToken,
          map: mapMeta,
          tileset: content.getTileset(room.dungeon.tileset),
          itemCatalog: content.getAllItems(),
          chunked: true,
          chunkSize: CONSTANTS.CHUNK_SIZE,
          chunks: initialChunks,
        }));

        // Send inventory and equipment
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.INVENTORY,
          items: player.inventory,
          equipment: player.equipment,
          medipacCharges: player.medipacCharges,
          credits: player.credits || 0,
        }));

        // Send ability state
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.ABILITY_STATE,
          abilities: player.abilities,
          cooldowns: player.cooldowns,
        }));

        // Send quest state
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.QUEST_STATE,
          quests: gameLoop.questTracker.getQuestStateForClient(playerId),
        }));

        // Send automation state
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.AUTO_STATE,
          auto: gameLoop.automation.getStateForClient(playerId),
        }));

        // Send worldmap data
        const worldmap = content.getWorldmap();
        if (worldmap) {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.WORLDMAP,
            worldmap,
            currentLocation: content.getWorldmapLocation(targetRoom),
          }));
        }

        // Send sol grid state if restored
        if (player.solGrid) {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.SOL_GRID,
            grid: player.solGrid,
          }));
        }

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
          const input = msg.keys || {};
          if (msg.dx !== undefined) input.dx = msg.dx;
          if (msg.dy !== undefined) input.dy = msg.dy;
          gameLoop.setPlayerInput(ws.playerRoom, playerId, input);
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
          const pickupRoom = gameLoop.getRoom(ws.playerRoom);
          const pickupPlayer = pickupRoom && pickupRoom.players.get(playerId);
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.INVENTORY,
            items: result.inventory,
            equipment: result.equipment,
            medipacCharges: pickupPlayer ? pickupPlayer.medipacCharges : 0,
            credits: pickupPlayer ? pickupPlayer.credits || 0 : 0,
          }));
          // If salvage was picked up, also send updated automation state
          if (result.item && result.item.type === 'salvage') {
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.AUTO_STATE,
              auto: gameLoop.automation.getStateForClient(playerId),
            }));
          }
        }
        break;
      }

      case CONSTANTS.MSG.CHOICE_SELECT: {
        if (!ws.playerRoom) break;
        if (msg.choiceId && msg.value) {
          gameLoop.handleChoiceSelect(ws.playerRoom, playerId, msg.choiceId, msg.value);
        }
        break;
      }

      case CONSTANTS.MSG.EQUIP: {
        if (!ws.playerRoom) break;
        const equipResult = gameLoop.tryEquip(ws.playerRoom, playerId, msg.index);
        if (equipResult) {
          const equipRoom = gameLoop.getRoom(ws.playerRoom);
          const equipPlayer = equipRoom && equipRoom.players.get(playerId);
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.INVENTORY,
            items: equipResult.inventory,
            equipment: equipResult.equipment,
            medipacCharges: equipPlayer ? equipPlayer.medipacCharges : 0,
            credits: equipPlayer ? equipPlayer.credits || 0 : 0,
          }));
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.ABILITY_STATE,
            abilities: equipResult.abilities,
            cooldowns: equipResult.cooldowns,
          }));
          // Send sol grid state if applicable
          if (equipPlayer && equipPlayer.solGrid) {
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.SOL_GRID,
              grid: gameLoop.getSolGridForClient(equipPlayer),
            }));
          }
        }
        break;
      }

      case CONSTANTS.MSG.UNEQUIP: {
        if (!ws.playerRoom) break;
        const unequipResult = gameLoop.tryUnequip(ws.playerRoom, playerId, msg.slot);
        if (unequipResult) {
          const unequipRoom2 = gameLoop.getRoom(ws.playerRoom);
          const unequipPlayer2 = unequipRoom2 && unequipRoom2.players.get(playerId);
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.INVENTORY,
            items: unequipResult.inventory,
            equipment: unequipResult.equipment,
            medipacCharges: unequipPlayer2 ? unequipPlayer2.medipacCharges : 0,
            credits: unequipPlayer2 ? unequipPlayer2.credits || 0 : 0,
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
          const useRoom = gameLoop.getRoom(ws.playerRoom);
          const usePlayer = useRoom && useRoom.players.get(playerId);
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.INVENTORY,
            items: useResult.inventory,
            equipment: useResult.equipment,
            medipacCharges: usePlayer ? usePlayer.medipacCharges : 0,
            credits: usePlayer ? usePlayer.credits || 0 : 0,
          }));
        }
        break;
      }

      case CONSTANTS.MSG.TRACK_QUEST: {
        if (!ws.playerRoom || !msg.questId) break;
        const tracked = gameLoop.questTracker.setTrackedQuest(playerId, msg.questId);
        if (tracked) {
          const room = gameLoop.getRoom(ws.playerRoom);
          const p = room && room.players.get(playerId);
          if (p) {
            const objective = gameLoop.questTracker.getActiveObjective(playerId);
            p.questObjective = objective;
            gameLoop._sendQuestObjective(playerId, ws.playerRoom);
          }
          // Send updated quest state with new tracked flag
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.QUEST_STATE,
            quests: gameLoop.questTracker.getQuestStateForClient(playerId),
          }));
        }
        break;
      }

      case CONSTANTS.MSG.ATTACK: {
        if (!ws.playerRoom) break;
        const aimAngle = (msg.aimAngle !== undefined) ? msg.aimAngle : null;
        const attackSlot = msg.slot || 1;
        const abilityResult = gameLoop.tryUseAbility(ws.playerRoom, playerId, attackSlot, aimAngle, msg);
        // After a heal, send updated medipac charges to client
        if (abilityResult === 'heal') {
          const healRoom = gameLoop.getRoom(ws.playerRoom);
          const healPlayer = healRoom && healRoom.players.get(playerId);
          if (healPlayer) {
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.INVENTORY,
              items: healPlayer.inventory,
              equipment: healPlayer.equipment,
              medipacCharges: healPlayer.medipacCharges,
              credits: healPlayer.credits || 0,
            }));
          }
        }
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
        const placeResult = gameLoop.trySolGridPlace(
          ws.playerRoom, playerId, msg.inventoryIndex, msg.gridX, msg.gridY
        );
        if (placeResult && !placeResult.ok && placeResult.reason) {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.SOL_GRID,
            error: placeResult.reason,
          }));
          break;
        }
        if (placeResult && placeResult.ok) {
          // Set flag when damage booster chip is placed (for quest tracking)
          if (placeResult.itemType === 'damage_booster_chip') {
            gameLoop.flagStore.setFlag(playerId, ws.playerRoom, 'damage_booster_equipped', true);
            gameLoop.eventBus.emit('flag_changed', {
              playerId,
              roomId: ws.playerRoom,
              flag: 'damage_booster_equipped',
              value: true,
              scope: 'player',
            });
          }
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
              medipacCharges: p2.medipacCharges,
              credits: p2.credits || 0,
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
              medipacCharges: p3.medipacCharges,
              credits: p3.credits || 0,
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

      case CONSTANTS.MSG.AUTO_BUILD: {
        if (!ws.playerRoom) break;
        const built = gameLoop.automation.build(playerId, msg.structureId, msg.gridX, msg.gridY);
        if (built) {
          // Set automation_established flag once player has built 2+ structures
          if (!gameLoop.flagStore.getPlayerFlag(playerId, 'automation_established')) {
            const autoState = gameLoop.automation.getStateForClient(playerId);
            if (autoState.stats && autoState.stats.totalStructures >= 2) {
              gameLoop.flagStore.setPlayerFlag(playerId, 'automation_established', true);
            }
          }
          // Check for milestone rewards
          const milestoneRewards = gameLoop.automation.checkMilestones(playerId);
          if (milestoneRewards.length > 0) {
            const room = gameLoop.getRoom(ws.playerRoom);
            const player = room && room.players.get(playerId);
            if (player) {
              for (const give of milestoneRewards) {
                if (give.type === 'item') {
                  if (give.itemId === 'medical_supplies') {
                    player.medipacCharges = (player.medipacCharges || 0) + (give.count || 1);
                  } else {
                    const itemDef = content.getItem(give.itemId);
                    if (itemDef) {
                      for (let i = 0; i < (give.count || 1); i++) {
                        player.inventory.push({
                          name: itemDef.name,
                          type: give.itemId,
                          category: itemDef.type,
                          rarity: itemDef.rarity || 'common',
                          slot: itemDef.slot || null,
                          stackable: itemDef.stackable || false,
                        });
                      }
                    }
                  }
                }
              }
              ws.send(JSON.stringify({
                type: CONSTANTS.MSG.INVENTORY,
                items: player.inventory,
                equipment: player.equipment,
                medipacCharges: player.medipacCharges,
          credits: player.credits || 0,
              }));
              // Notify client of each milestone reached
              for (const reward of milestoneRewards) {
                ws.send(JSON.stringify({
                  type: CONSTANTS.MSG.AUTOMATION_MILESTONE,
                  milestoneName: reward.milestoneName,
                  milestoneThreshold: reward.milestoneThreshold,
                  milestoneIcon: reward.milestoneIcon,
                  rewardName: reward.milestoneName,
                }));
              }
            }
          }
        }
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.AUTO_STATE,
          auto: gameLoop.automation.getStateForClient(playerId),
          buildResult: built ? 'success' : 'fail',
          buildX: msg.gridX,
          buildY: msg.gridY,
        }));

        // Sync dungeon tiles: if the player is in the automation dungeon,
        // re-send the affected chunk so the new structure appears as a real tile
        if (built) {
          const gridConfig = gameLoop.automation.getGridConfig();
          if (gridConfig && ws.playerRoom === gridConfig.dungeonId) {
            const room = gameLoop.getRoom(ws.playerRoom);
            if (room) {
              const overlayed = gameLoop.automation.getOverlayedMapData(playerId, room.dungeon);
              const dungeonX = msg.gridX + gridConfig.dungeonOffsetX;
              const dungeonY = msg.gridY + gridConfig.dungeonOffsetY;
              const cx = Math.floor(dungeonX / CONSTANTS.CHUNK_SIZE);
              const cy = Math.floor(dungeonY / CONSTANTS.CHUNK_SIZE);
              const chunk = chunkManager.extractChunk(overlayed, cx, cy);
              ws.send(JSON.stringify({
                type: CONSTANTS.MSG.MAP_CHUNKS,
                chunks: [chunk],
              }));
            }
          }
        }
        break;
      }

      case CONSTANTS.MSG.AUTO_TRADE: {
        if (!ws.playerRoom) break;
        const tradeResult = gameLoop.automation.trade(playerId, msg.tradeId);
        if (tradeResult) {
          // Give items to player
          const room = gameLoop.getRoom(ws.playerRoom);
          const player = room && room.players.get(playerId);
          if (player) {
            for (const give of tradeResult) {
              if (give.type === 'item') {
                if (give.itemId === 'medical_supplies') {
                  player.medipacCharges = (player.medipacCharges || 0) + (give.count || 1);
                } else {
                  const itemDef = content.getItem(give.itemId);
                  if (itemDef) {
                    for (let i = 0; i < (give.count || 1); i++) {
                      player.inventory.push({
                        name: itemDef.name,
                        type: give.itemId,
                        category: itemDef.type,
                        rarity: itemDef.rarity || 'common',
                        slot: itemDef.slot || null,
                        stackable: itemDef.stackable || false,
                      });
                    }
                  }
                }
              }
            }
            gameLoop.flagStore.setFlag(playerId, ws.playerRoom, 'has_traded_meridian', true);
            ws.send(JSON.stringify({
              type: CONSTANTS.MSG.INVENTORY,
              items: player.inventory,
              equipment: player.equipment,
              medipacCharges: player.medipacCharges,
          credits: player.credits || 0,
            }));
          }
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.AUTO_STATE,
            auto: gameLoop.automation.getStateForClient(playerId),
          }));
        }
        break;
      }

      case CONSTANTS.MSG.CHAT: {
        if (!ws.playerRoom) break;
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 200) : '';
        if (!text) break;
        broadcast(ws.playerRoom, {
          type: CONSTANTS.MSG.CHAT_BROADCAST,
          playerId,
          name: ws.playerName,
          text,
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected: ${playerId}`);

    // Save session before cleanup
    if (ws.playerRoom && ws.playerName) {
      const saveData = gatherPlayerSaveData(ws);
      if (saveData) {
        sessionStore.save(saveData);
      }
    }

    chunkManager.removePlayer(playerId);
    if (ws.playerRoom) {
      gameLoop.removePlayer(ws.playerRoom, playerId);
      gameLoop.questTracker.removePlayer(playerId);
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

// --- Helper: gather save data for a connected player ---
function gatherPlayerSaveData(ws) {
  const room = gameLoop.getRoom(ws.playerRoom);
  const player = room && room.players.get(ws.playerId);
  if (!player) return null;

  const revealedChunks = {};
  const playerChunkMap = chunkManager.playerChunks.get(ws.playerId);
  if (playerChunkMap) {
    for (const [roomId, chunkSet] of playerChunkMap) {
      revealedChunks[roomId] = [...chunkSet];
    }
  }

  return {
    name: ws.playerName,
    sessionToken: ws.sessionToken,
    room: ws.playerRoom,
    x: player.x,
    y: player.y,
    health: player.health,
    maxHealth: player.maxHealth,
    inventory: player.inventory,
    equipment: player.equipment,
    solGrid: player.solGrid,
    energy: player.energy,
    maxEnergy: player.maxEnergy,
    solGridEnergyRegen: player.solGridEnergyRegen,
    flags: gameLoop.flagStore.getPlayerFlags(ws.playerId),
    questState: gameLoop.questTracker.serializePlayerState(ws.playerId),
    xp: player.xp,
    level: player.level,
    xpToNextLevel: player.xpToNextLevel,
    medipacCharges: player.medipacCharges,
    credits: player.credits || 0,
    revealedChunks,
    automationState: gameLoop.automation.serializeState(ws.playerId),
  };
}

// --- Periodic auto-save (every 5 minutes) ---
const AUTO_SAVE_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.playerRoom && client.playerName) {
      const saveData = gatherPlayerSaveData(client);
      if (saveData) {
        sessionStore.save(saveData);
        count++;
      }
    }
  });
  if (count > 0) {
    console.log(`[AutoSave] Saved ${count} player(s)`);
  }
}, AUTO_SAVE_INTERVAL);

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

    // Build generation context, including expedition overrides if present
    const genContext = {
      fromDungeon: t.fromRoom,
      exitX: t.exitX,
      exitY: t.exitY,
      depth: t.depth,
    };
    if (t.expeditionMaxFloors) {
      genContext.maxDepth = t.expeditionMaxFloors;
      genContext.bossType = t.expeditionBossType;
    }
    const targetRoom = gameLoop.getOrCreateRoom(t.toDungeon, genContext);
    if (!targetRoom) continue;

    // Use the room's actual ID (may differ from t.toDungeon for procedural instances)
    const targetRoomId = targetRoom.id;

    // Apply expedition scaling to newly created rooms
    if (t.expeditionScaling) {
      gameLoop.applyExpeditionScaling(targetRoom, t.expeditionScaling, t.expeditionBossAffixes);
    }

    // Resolve spawn position: targetId > spawnX/Y > first player_start > fallback (2,2)
    let spawnX = t.spawnX;
    let spawnY = t.spawnY;
    if (t.targetId && targetRoom.dungeon.exits) {
      const targetExit = targetRoom.dungeon.exits.find(e => e.id === t.targetId);
      if (targetExit) {
        spawnX = targetExit.x;
        spawnY = targetExit.y;
      }
    }
    if (spawnX == null || spawnY == null) {
      const sp = (targetRoom.dungeon.spawns && targetRoom.dungeon.spawns[0]) || { x: 2, y: 2 };
      spawnX = sp.x;
      spawnY = sp.y;
    }
    gameLoop.addPlayerAt(targetRoomId, player, spawnX, spawnY);
    ws.playerRoom = targetRoomId;

    const floorOverlay = gameLoop.automation.getOverlayedMapData(t.playerId, targetRoom.dungeon);
    const { data: _stripFloorData, ...floorMeta } = floorOverlay;
    // Reset chunk tracking for this player in the new room
    chunkManager.resetRoom(t.playerId, targetRoomId);
    // Compute initial chunks around spawn position
    const transPlayer = targetRoom.players.get(t.playerId);
    const floorVisibleKeys = chunkManager.getVisibleChunks(transPlayer.x, transPlayer.y, floorOverlay);
    const floorChunks = [];
    for (const key of floorVisibleKeys) {
      const { cx, cy } = chunkManager.parseKey(key);
      floorChunks.push(chunkManager.extractChunk(floorOverlay, cx, cy));
    }
    chunkManager.markSent(t.playerId, targetRoomId, [...floorVisibleKeys]);
    ws.send(JSON.stringify({
      type: CONSTANTS.MSG.FLOOR_CHANGE,
      map: floorMeta,
      tileset: content.getTileset(targetRoom.dungeon.tileset),
      chunked: true,
      chunks: floorChunks,
    }));

    // Track expedition floor progression and detect completion
    if (t.expeditionTier != null) {
      if (targetRoom.expeditionScaling) {
        // Advancing to next expedition floor — update floor counter
        const currentFloor = gameLoop.flagStore.getPlayerFlag(t.playerId, 'expedition_floor') || 1;
        const newFloor = (t.depth || 0) + 1;
        if (newFloor > currentFloor) {
          gameLoop.flagStore.setPlayerFlag(t.playerId, 'expedition_floor', newFloor);
        }
      } else {
        // Returned to a non-expedition room — expedition complete
        gameLoop.completeExpedition(t.playerId);
      }
    }

    // Emit room_entered AFTER sending FLOOR_CHANGE so that any triggered
    // dialogue (e.g. showMessage) arrives after the client has the new map
    // and won't be immediately closed by the FLOOR_CHANGE handler.
    gameLoop.emitRoomEntered(t.playerId, targetRoomId);

    // Send automation state (resource counts may affect UI on new floor)
    ws.send(JSON.stringify({
      type: CONSTANTS.MSG.AUTO_STATE,
      auto: gameLoop.automation.getStateForClient(t.playerId),
    }));

    // Update worldmap current location
    const newLocation = content.getWorldmapLocation(targetRoomId);
    if (newLocation) {
      ws.send(JSON.stringify({
        type: CONSTANTS.MSG.WORLDMAP,
        currentLocation: newLocation,
      }));
    }

    // Re-send quest objective with updated exit resolution for new room
    if (player.questObjective) {
      gameLoop._sendQuestObjective(t.playerId, targetRoomId);
    }
  }

  // Process death penalties — send updated inventory to players who died
  const deathPenalties = gameLoop.consumeDeathPenalties();
  for (const dp of deathPenalties) {
    const ws = findClientByPlayerId(dp.playerId);
    if (!ws || ws.readyState !== 1) continue;
    ws.send(JSON.stringify({
      type: CONSTANTS.MSG.INVENTORY,
      items: dp.inventory,
      equipment: dp.equipment,
      medipacCharges: dp.medipacCharges,
      credits: dp.credits || 0,
    }));

    // Send death screen notification so the player knows what they lost
    const lines = [];
    if (dp.energyLost > 0) lines.push(`Lost ${dp.energyLost} energy.`);
    if (dp.droppedItems && dp.droppedItems.length > 0) {
      if (dp.expeditionForfeit) {
        lines.push(`Expedition failed. Floor loot forfeited: ${dp.droppedItems.join(', ')}`);
      } else {
        lines.push(`Dropped: ${dp.droppedItems.join(', ')}`);
      }
    } else if (dp.expeditionForfeit) {
      lines.push('Expedition failed. Returned to station.');
    }
    ws.send(JSON.stringify({
      type: CONSTANTS.MSG.DEATH_SCREEN,
      details: lines,
    }));
  }

  // Stream new map chunks to players who have moved into new areas
  for (const [roomId, room] of gameLoop.rooms) {
    for (const [playerId, player] of room.players) {
      const client = findClientByPlayerId(playerId);
      if (!client || client.readyState !== 1) continue;
      // Check if there are new visible chunks before doing expensive overlay
      const visible = chunkManager.getVisibleChunks(player.x, player.y, room.dungeon);
      const newKeys = chunkManager.getNewChunkKeys(playerId, roomId, visible);
      if (newKeys.length === 0) continue;
      const overlayed = gameLoop.automation.getOverlayedMapData(playerId, room.dungeon);
      const chunks = newKeys.map(key => {
        const { cx, cy } = chunkManager.parseKey(key);
        return chunkManager.extractChunk(overlayed, cx, cy);
      });
      chunkManager.markSent(playerId, roomId, newKeys);
      client.send(JSON.stringify({
        type: CONSTANTS.MSG.MAP_CHUNKS,
        chunks,
      }));
    }
  }

  // Send state to each room's players
  for (const [roomId, room] of gameLoop.rooms) {
    const state = gameLoop.getRoomState(roomId);
    if (!state) continue;
    const gridConfig = gameLoop.automation.getGridConfig();
    const isDaysideRoom = gridConfig && roomId === gridConfig.dungeonId;
    // Send per-player state with their own cooldowns
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.playerRoom === roomId) {
        const player = room.players.get(client.playerId);
        if (player) {
          state.myCooldowns = player.cooldowns;
        }
        // Inject per-player harvester entities when in the automation dungeon
        if (isDaysideRoom && client.playerId) {
          const harvesters = gameLoop.automation.getHarvesterEntities(client.playerId);
          if (harvesters.length > 0) {
            state.npcs = [...state.npcs, ...harvesters];
            client.send(JSON.stringify(state));
            state.npcs = state.npcs.slice(0, state.npcs.length - harvesters.length);
          } else {
            client.send(JSON.stringify(state));
          }
        } else {
          client.send(JSON.stringify(state));
        }
      }
    });
  }
}, CONSTANTS.TICK_INTERVAL);

// --- Start ---
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏰 Lightkeeper server running at http://0.0.0.0:${PORT}\n`);
});
