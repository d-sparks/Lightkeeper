const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const CONSTANTS = require('../shared/constants');
const ContentLoader = require('./content-loader');
const GameLoop = require('./game-loop');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const CONTENT_DIR = path.join(__dirname, '..', 'content');
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const SHARED_DIR = path.join(__dirname, '..', 'shared');

// --- Load game content ---
const content = new ContentLoader(CONTENT_DIR);
content.loadAll();

// --- Game loop ---
const gameLoop = new GameLoop(content);
gameLoop.start();

// Default room + dungeon for Phase 1
const DEFAULT_ROOM = 'lobby';
const DEFAULT_DUNGEON = 'crypt_01';
gameLoop.createRoom(DEFAULT_ROOM, DEFAULT_DUNGEON);

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

  // Route: / → client/index.html
  if (urlPath === '/') {
    return serveFile(res, path.join(CLIENT_DIR, 'index.html'));
  }

  // Route: /shared/* → shared files
  if (urlPath.startsWith('/shared/')) {
    return serveFile(res, path.join(SHARED_DIR, urlPath.slice(8)));
  }

  // Route: /content/* → content files (maps, tilesets, etc.)
  if (urlPath.startsWith('/content/')) {
    return serveFile(res, path.join(CONTENT_DIR, urlPath.slice(9)));
  }

  // Route: everything else → client directory
  serveFile(res, path.join(CLIENT_DIR, urlPath));
});

// --- WebSocket server ---
const wss = new WebSocketServer({ server: httpServer });
let nextPlayerId = 1;

wss.on('connection', (ws) => {
  const playerId = `p${nextPlayerId++}`;
  let playerRoom = null;
  let playerName = null;

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
        playerName = msg.name || `Player ${nextPlayerId}`;
        playerRoom = DEFAULT_ROOM;

        const player = gameLoop.addPlayer(playerRoom, playerId, playerName);
        if (!player) {
          ws.send(JSON.stringify({ type: 'error', message: 'Could not join room' }));
          return;
        }

        // Send welcome message with player ID and map data
        const room = gameLoop.getRoom(playerRoom);
        ws.send(JSON.stringify({
          type: CONSTANTS.MSG.WELCOME,
          playerId,
          map: room.dungeon,
          tileset: content.getTileset(room.dungeon.tileset),
        }));

        // Broadcast join event to others in the room
        broadcast(playerRoom, {
          type: CONSTANTS.MSG.PLAYER_JOIN,
          playerId,
          name: playerName,
        }, playerId);
        break;
      }

      case CONSTANTS.MSG.INPUT: {
        if (playerRoom) {
          gameLoop.setPlayerInput(playerRoom, playerId, msg.keys);
        }
        break;
      }

      case CONSTANTS.MSG.INTERACT: {
        if (!playerRoom) break;
        const result = gameLoop.tryInteract(playerRoom, playerId);
        if (result) {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.DIALOGUE,
            npcId: result.npcId,
            dialogue: result.dialogue,
          }));
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected: ${playerId}`);
    if (playerRoom) {
      gameLoop.removePlayer(playerRoom, playerId);
      broadcast(playerRoom, {
        type: CONSTANTS.MSG.PLAYER_LEAVE,
        playerId,
      });
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error for ${playerId}:`, err.message);
  });
});

// Broadcast a message to all clients in a room, optionally excluding one
function broadcast(roomId, message, excludeId) {
  const json = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {  // WebSocket.OPEN
      client.send(json);
    }
  });
}

// State broadcast loop - sends game state to all connected clients
setInterval(() => {
  for (const [roomId, room] of gameLoop.rooms) {
    const state = gameLoop.getRoomState(roomId);
    if (!state) continue;
    const json = JSON.stringify(state);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(json);
      }
    });
  }
}, CONSTANTS.TICK_INTERVAL);

// --- Start ---
httpServer.listen(PORT, () => {
  console.log(`\n🏰 Dungeon Crawler server running at http://localhost:${PORT}\n`);
});
