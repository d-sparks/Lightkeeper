// Shared constants for server and client
// In the browser, this is loaded via <script> tag and attaches to window.
// On the server, it's require()'d as a module.

const CONSTANTS = {
  // Tick rate
  TICK_RATE: 15,              // Server ticks per second
  TICK_INTERVAL: 1000 / 15,   // ~66ms per tick

  // Tile / rendering
  TILE_SIZE: 32,              // Display size of each tile in pixels
  SPRITE_SIZE: 16,            // Native sprite size (scaled up 2x to TILE_SIZE)

  // Player
  PLAYER_SPEED: 4,            // Tiles per second
  PLAYER_RADIUS: 12,          // Collision radius in pixels (within a 32px tile)
  PLAYER_MAX_HEALTH: 100,

  // Viewport
  VIEWPORT_TILES_X: 21,       // Odd number so player is centered
  VIEWPORT_TILES_Y: 15,

  // Colors (Phase 1 placeholder rendering)
  COLORS: {
    floor:   '#2a2a3d',
    wall:    '#5a5a7a',
    player:  ['#4fc3f7', '#ef5350', '#66bb6a', '#ffa726'],  // Per-player colors
    npc:     '#64b5f6',
    monster: '#e53935',
    item:    '#fdd835',
    exit:    '#ab47bc',
    spawn:   '#26a69a',
    background: '#1a1a2e',
  },

  // Rarity colors (for future use)
  RARITY_COLORS: {
    common:    '#ffffff',
    uncommon:  '#4caf50',
    rare:      '#2196f3',
    epic:      '#9c27b0',
    legendary: '#ff9800',
  },

  // NPC interaction
  NPC_INTERACT_RANGE: 2.5,   // Tiles distance to interact with NPC

  // Network message types
  MSG: {
    // Client -> Server
    JOIN:          'join',
    INPUT:         'input',
    INTERACT:      'interact',

    // Server -> Client
    WELCOME:       'welcome',
    STATE:         'state',
    MAP:           'map',
    PLAYER_JOIN:   'player_join',
    PLAYER_LEAVE:  'player_leave',
    EVENT:         'event',
    DIALOGUE:      'dialogue',
    DIALOGUE_END:  'dialogue_end',
  },
};

// Universal module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}
