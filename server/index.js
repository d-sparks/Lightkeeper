const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const CONSTANTS = require('../shared/constants');
const ContentLoader = require('./content-loader');
const GameLoop = require('./game-loop');
const { handleEditorAPI } = require('./editor-api');
const { isAuthenticated, handleLogin, sendUnauthorized } = require('./editor-auth');
const contentGit = require('./content-git');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const CONTENT_DIR = path.join(__dirname, '..', 'content');
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const SHARED_DIR = path.join(__dirname, '..', 'shared');
const EDITOR_DIR = path.join(__dirname, '..', 'editor');

// --- Load game content ---
const content = new ContentLoader(CONTENT_DIR);
content.loadAll();

// --- Game loop ---
const gameLoop = new GameLoop(content);
gameLoop.start();

// Default room + dungeon
const DEFAULT_ROOM = 'crypt_01';
gameLoop.createRoom(DEFAULT_ROOM, 'crypt_01');

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

    const handled = handleEditorAPI(req, res);
    if (handled !== false) return;
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
        ws.playerRoom = DEFAULT_ROOM;

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

        // Send initial empty inventory
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.INVENTORY,
          items: player.inventory,
        }));

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
          }));
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

    const targetRoom = gameLoop.getOrCreateRoom(t.toDungeon);
    if (!targetRoom) continue;

    gameLoop.addPlayerAt(t.toDungeon, player, t.spawnX, t.spawnY);
    ws.playerRoom = t.toDungeon;

    ws.send(JSON.stringify({
      type: CONSTANTS.MSG.FLOOR_CHANGE,
      map: targetRoom.dungeon,
      tileset: content.getTileset(targetRoom.dungeon.tileset),
    }));
  }

  // Send state to each room's players
  for (const [roomId, room] of gameLoop.rooms) {
    const state = gameLoop.getRoomState(roomId);
    if (!state) continue;
    const json = JSON.stringify(state);
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.playerRoom === roomId) {
        client.send(json);
      }
    });
  }
}, CONSTANTS.TICK_INTERVAL);

// --- Start ---
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏰 Dungeon Crawler server running at http://0.0.0.0:${PORT}\n`);
});
