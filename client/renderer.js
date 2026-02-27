// Renderer - draws the game world using PixiJS
// Retained-mode: create display objects once, update properties each frame.

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // Isometric mode
    this.isoMode = true;
    this.cssZoom = 1; // CSS upscale factor (set during resize)

    // Viewport tiles
    this.viewportTX = CONSTANTS.VIEWPORT_TILES_X;
    this.viewportTY = CONSTANTS.VIEWPORT_TILES_Y;

    // Viewport size in pixels
    this.viewW = this.viewportTX * CONSTANTS.TILE_SIZE;
    this.viewH = this.viewportTY * CONSTANTS.TILE_SIZE;

    // Camera position (top-left corner in iso screen space for iso mode, world pixels for flat)
    this.camX = 0;
    this.camY = 0;

    // Map + tileset data
    this.map = null;
    this.tileset = null;

    // Game state from server
    this.state = null;
    this.myId = null;

    // Floating damage numbers
    this.damageNumbers = [];

    // Tile color fallbacks
    this.tileColors = {};

    // PixiJS Application (initialized asynchronously)
    this.app = null;
    this.ready = false;

    // Layer containers
    this.worldContainer = null;   // moves with camera
    this.tileContainer = null;    // tile sprites
    this.entityContainer = null;  // entities sorted by Y
    this.overlayContainer = null; // fixed UI (minimap, damage numbers)

    // Tile sprite pool (reused across frames)
    this.tileSprites = [];        // flat array of PIXI.Sprite for visible area (floor tiles)
    this.wallSprites = [];        // wall tiles in entityContainer for depth sorting
    this.tileRows = 0;
    this.tileCols = 0;

    // Tileset texture references
    this.tileTextures = {};       // tileId -> PIXI.Texture (region of sprite sheet)
    this.tilesetLoaded = false;

    // Iso tile textures
    this.isoTileTextures = {};    // 'floor'|'wall'|'door'|'water' -> PIXI.Texture
    this.isoTileLoaded = false;
    this.isoThemeId = null;       // track which theme was built
    this.isoWallRise = CONSTANTS.ISO_WALL_RISE; // per-theme wall rise
    this.tileToIsoKey = {};       // tile name -> iso key

    // Entity sprite pools: id -> { container, sprite, nameTag, healthBar, ... }
    this.playerSprites = new Map();
    this.monsterSprites = new Map();
    this.npcSprites = new Map();
    this.itemSprites = new Map();
    this.projectileSprites = new Map();

    // Sprite texture cache: path -> PIXI.Texture
    this.textureCache = {};

    // Minimap graphics
    this.minimapGfx = null;
    this.fullMap = false;
    this.minimapBounds = null; // { x, y, w, h } in canvas coords for click detection

    // Damage number containers
    this.dmgContainer = null;

    // Cone effect visuals
    this.coneEffects = [];
    this.coneGfx = null;

    // Spawn/exit graphics
    this.spawnGfx = null;
    this.exitGfx = null;

    // Door prompt graphics
    this.doorPromptContainer = null;

    // Speech bubble state
    this.speechBubble = null;       // { npcId, lines, index, container }
    this.speechBubbleContainer = null;

    // Click target indicator
    this.clickTargetGfx = null;
    this.clickTarget = null;  // { x, y } world coords, set by input handler

    // Aim indicator (set by input handler)
    this.aimIndicator = null;  // reference to input.aimIndicator { active, angle }
    this.aimLineGfx = null;

    this._initPixi();
  }

  async _initPixi() {
    this.app = new PIXI.Application({
      view: this.canvas,
      width: this.viewW,
      height: this.viewH,
      backgroundColor: 0x1a1a2e,
      antialias: false,
      resolution: 1,
      autoDensity: false,
      autoStart: false,  // We drive rendering from our own game loop
    });

    // Crisp pixel rendering
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    PIXI.settings.ROUND_PIXELS = true;

    // World container (scrolls with camera)
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);

    // Tile layer
    this.tileContainer = new PIXI.Container();
    this.worldContainer.addChild(this.tileContainer);

    // Spawn/exit graphics layer
    this.spawnGfx = new PIXI.Graphics();
    this.worldContainer.addChild(this.spawnGfx);
    this.exitGfx = new PIXI.Graphics();
    this.worldContainer.addChild(this.exitGfx);

    // Entity layer (Y-sorted)
    this.entityContainer = new PIXI.Container();
    this.entityContainer.sortableChildren = true;
    this.worldContainer.addChild(this.entityContainer);

    // Cone effect graphics
    this.coneGfx = new PIXI.Graphics();
    this.worldContainer.addChild(this.coneGfx);

    // Click target indicator
    this.clickTargetGfx = new PIXI.Graphics();
    this.worldContainer.addChild(this.clickTargetGfx);

    // Aim indicator line
    this.aimLineGfx = new PIXI.Graphics();
    this.worldContainer.addChild(this.aimLineGfx);

    // Door prompt layer
    this.doorPromptContainer = new PIXI.Container();
    this.worldContainer.addChild(this.doorPromptContainer);

    // Fixed overlay layer (minimap, damage numbers)
    this.overlayContainer = new PIXI.Container();
    this.app.stage.addChild(this.overlayContainer);

    this.minimapGfx = new PIXI.Graphics();
    this.overlayContainer.addChild(this.minimapGfx);

    this.dmgContainer = new PIXI.Container();
    this.overlayContainer.addChild(this.dmgContainer);

    this.speechBubbleContainer = new PIXI.Container();
    this.speechBubbleContainer.visible = false;
    this.overlayContainer.addChild(this.speechBubbleContainer);

    // Quest objective arrow overlay
    this.questArrowGfx = new PIXI.Graphics();
    this.overlayContainer.addChild(this.questArrowGfx);
    this.questObjective = null; // { label, tileX, tileY, sameRoom }

    // Lighting system (darkness overlay with light holes)
    this.ambientLight = 1.0;
    this._lightRT = null;
    this._lightingSprite = null;
    this._lightContainer = null;
    this._darkOverlay = null;
    this._lightSources = [];  // reusable sprites for light sources
    this._lightGradientTex = null;

    this.ready = true;
  }

  // --- Texture loading ---

  loadTexture(spritePath) {
    if (this.textureCache[spritePath]) return this.textureCache[spritePath];
    const tex = PIXI.Texture.from('/content/' + spritePath);
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    this.textureCache[spritePath] = tex;
    return tex;
  }

  _buildTileTextures() {
    if (!this.tileset || !this.tileset.image) return;
    const baseTex = PIXI.BaseTexture.from('/content/' + this.tileset.image, {
      scaleMode: PIXI.SCALE_MODES.NEAREST,
    });
    const sz = CONSTANTS.SPRITE_SIZE;
    for (const id of Object.keys(this.tileset.tiles)) {
      const numId = parseInt(id);
      if (baseTex.width > 0 && numId * sz + sz > baseTex.width) {
        console.warn(`Tile ${id} (x=${numId * sz}) exceeds tileset image width (${baseTex.width}), skipping`);
        continue;
      }
      const rect = new PIXI.Rectangle(numId * sz, 0, sz, sz);
      this.tileTextures[id] = new PIXI.Texture(baseTex, rect);
    }
    this.tilesetLoaded = true;
  }

  // --- Isometric coordinate transforms ---

  worldToIso(wx, wy) {
    const ts = CONSTANTS.TILE_SIZE;
    const dw = CONSTANTS.ISO_DIAMOND_W;
    const dh = CONSTANTS.ISO_DIAMOND_H;
    const tx = wx / ts;
    const ty = wy / ts;
    return {
      x: (tx - ty) * dw / 2,
      y: (tx + ty) * dh / 2,
    };
  }

  isoToWorld(sx, sy) {
    const ts = CONSTANTS.TILE_SIZE;
    const dw = CONSTANTS.ISO_DIAMOND_W;
    const dh = CONSTANTS.ISO_DIAMOND_H;
    const tx = (sx / (dw / 2) + sy / (dh / 2)) / 2;
    const ty = (sy / (dh / 2) - sx / (dw / 2)) / 2;
    return {
      x: tx * ts,
      y: ty * ts,
    };
  }

  _positionEntity(container, wx, wy) {
    if (this.isoMode) {
      const iso = this.worldToIso(wx, wy);
      container.x = iso.x;
      container.y = iso.y;
      container.zIndex = iso.y;
    } else {
      container.x = wx;
      container.y = wy;
      container.zIndex = wy;
    }
  }

  _worldToScreen(wx, wy) {
    if (this.isoMode) {
      const iso = this.worldToIso(wx, wy);
      return { x: iso.x - this.camX, y: iso.y - this.camY };
    }
    return { x: wx - this.camX, y: wy - this.camY };
  }

  // --- Iso tile textures (procedurally generated) ---

  _createIsoTexture(w, h, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, w, h);
    return PIXI.Texture.from(canvas);
  }

  _drawDiamond(ctx, cx, cy, hw, hh) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  }

  // --- Iso theme palettes ---
  // Each tileset ID maps to a color palette for procedural iso tile generation.
  static ISO_THEMES = {
    crypt: {
      wallRise: 30,
      floor:      { fill: '#2a2a3d', edge: 'rgba(255,255,255,0.06)' },
      floor2:     { fill: '#2a2a3d', crack: 'rgba(0,0,0,0.3)', edge: 'rgba(255,255,255,0.06)' },
      water:      { fill: '#1a3a6a', wave: 'rgba(100,180,255,0.3)' },
      stairsDown: { fill: '#4a2a6a', step: 'rgba(255,255,255,0.15)', chevron: 'rgba(255,255,255,0.4)' },
      stairsUp:   { fill: '#2a6a4a', step: 'rgba(255,255,255,0.15)', chevron: 'rgba(255,255,255,0.4)' },
      doorOpen:   { fill: '#4a3a2a', frame: 'rgba(180,140,80,0.4)' },
      wall:       { top: '#5a5a7a', left: '#4a4a6a', right: '#3a3a5a', edge: 'rgba(255,255,255,0.08)' },
      doorClosed: { top: '#8b7a50', left: '#7a6a40', right: '#6a5a30', arch: 'rgba(255,255,255,0.15)', edge: 'rgba(255,255,255,0.1)' },
      lockedDoor: { top: '#6a5a3a', left: '#5a4a2a', right: '#4a3a1a', arch: 'rgba(255,255,255,0.12)', lock: 'rgba(200,160,60,0.6)', lockEdge: 'rgba(255,220,100,0.4)', edge: 'rgba(255,255,255,0.08)' },
      chest:      { top: '#5a6a5a', left: '#4a5a4a', right: '#3a4a3a', band: 'rgba(120,140,120,0.4)', lock: 'rgba(220,180,60,0.7)', lockEdge: 'rgba(255,220,100,0.5)', edge: 'rgba(255,255,255,0.1)' },
      chestOpen:  { fill: '#3a4a3a', edge: 'rgba(120,140,120,0.5)', inner: 'rgba(0,0,0,0.3)' },
      minimap: {
        stone_floor: 0x2a2a3d, cracked_floor: 0x332a3d, stone_wall: 0x5a5a7a,
        door_closed: 0x7a6a4a, door_open: 0x4a3a2a, stairs_down: 0x6a3a8a,
        stairs_up: 0x3a8a6a, water: 0x2a4a6a, void: 0x0d0d1a,
        chest_closed: 0x5a6a5a, chest_opened: 0x3a4a3a,
      },
    },
    outpost: {
      wallRise: 34,
      floor:      { fill: '#35332e', edge: 'rgba(255,220,180,0.06)' },
      floor2:     { fill: '#35332e', crack: 'rgba(0,0,0,0.25)', edge: 'rgba(255,220,180,0.06)' },
      water:      { fill: '#2a3028', wave: 'rgba(120,160,100,0.25)' },
      stairsDown: { fill: '#4a3a2a', step: 'rgba(255,220,180,0.15)', chevron: 'rgba(255,220,180,0.4)' },
      stairsUp:   { fill: '#2a4a3a', step: 'rgba(255,220,180,0.15)', chevron: 'rgba(255,220,180,0.4)' },
      doorOpen:   { fill: '#30353a', frame: 'rgba(140,160,180,0.4)' },
      wall:       { top: '#706860', left: '#605850', right: '#504840', edge: 'rgba(255,220,180,0.06)' },
      doorClosed: { top: '#6a7a8a', left: '#5a6a7a', right: '#4a5a6a', arch: 'rgba(180,200,220,0.15)', edge: 'rgba(255,255,255,0.1)' },
      lockedDoor: { top: '#5a6a7a', left: '#4a5a6a', right: '#3a4a5a', arch: 'rgba(180,200,220,0.12)', lock: 'rgba(200,160,60,0.6)', lockEdge: 'rgba(255,220,100,0.4)', edge: 'rgba(255,255,255,0.08)' },
      chest:      { top: '#5a6058', left: '#4a504a', right: '#3a403a', band: 'rgba(140,140,120,0.4)', lock: 'rgba(220,180,60,0.7)', lockEdge: 'rgba(255,220,100,0.5)', edge: 'rgba(255,255,255,0.1)' },
      chestOpen:  { fill: '#3a3a35', edge: 'rgba(140,140,120,0.5)', inner: 'rgba(0,0,0,0.3)' },
      minimap: {
        stone_floor: 0x35332e, cracked_floor: 0x38352e, stone_wall: 0x706860,
        door_closed: 0x6a7a8a, door_open: 0x30353a, stairs_down: 0x4a3a2a,
        stairs_up: 0x2a4a3a, water: 0x2a3028, void: 0x151412,
        chest_closed: 0x5a6058, chest_opened: 0x3a3a35,
      },
    },
    quarantine: {
      wallRise: 30,
      floor:      { fill: '#252e25', edge: 'rgba(180,255,180,0.05)' },
      floor2:     { fill: '#252e25', crack: 'rgba(80,160,60,0.3)', edge: 'rgba(180,255,180,0.05)' },
      water:      { fill: '#1a3a1a', wave: 'rgba(80,200,60,0.3)' },
      stairsDown: { fill: '#3a2a4a', step: 'rgba(180,255,180,0.12)', chevron: 'rgba(180,255,180,0.35)' },
      stairsUp:   { fill: '#2a4a2a', step: 'rgba(180,255,180,0.12)', chevron: 'rgba(180,255,180,0.35)' },
      doorOpen:   { fill: '#2a2e20', frame: 'rgba(160,180,80,0.35)' },
      wall:       { top: '#4a5a45', left: '#3a4a35', right: '#2a3a28', edge: 'rgba(180,255,180,0.06)' },
      doorClosed: { top: '#8a7a30', left: '#7a6a25', right: '#6a5a1a', arch: 'rgba(255,240,100,0.15)', edge: 'rgba(255,255,100,0.1)' },
      lockedDoor: { top: '#6a5a25', left: '#5a4a1a', right: '#4a3a10', arch: 'rgba(255,240,100,0.12)', lock: 'rgba(200,180,40,0.6)', lockEdge: 'rgba(255,240,80,0.4)', edge: 'rgba(180,255,180,0.06)' },
      chest:      { top: '#4a5a3a', left: '#3a4a2a', right: '#2a3a1a', band: 'rgba(100,140,80,0.4)', lock: 'rgba(200,180,40,0.7)', lockEdge: 'rgba(255,240,80,0.5)', edge: 'rgba(180,255,180,0.08)' },
      chestOpen:  { fill: '#2a3a22', edge: 'rgba(100,140,80,0.5)', inner: 'rgba(0,0,0,0.35)' },
      minimap: {
        stone_floor: 0x252e25, cracked_floor: 0x2a3228, stone_wall: 0x4a5a45,
        door_closed: 0x8a7a30, door_open: 0x2a2e20, stairs_down: 0x3a2a4a,
        stairs_up: 0x2a4a2a, water: 0x1a3a1a, void: 0x0d140d,
        chest_closed: 0x4a5a3a, chest_opened: 0x2a3a22,
      },
    },
    dark_city: {
      wallRise: 42,
      floor:      { fill: '#2a2828', edge: 'rgba(255,200,150,0.04)' },
      floor2:     { fill: '#2a2828', crack: 'rgba(0,0,0,0.35)', edge: 'rgba(255,200,150,0.04)' },
      water:      { fill: '#1a2028', wave: 'rgba(80,120,160,0.25)' },
      stairsDown: { fill: '#3a2830', step: 'rgba(255,200,150,0.12)', chevron: 'rgba(255,200,150,0.35)' },
      stairsUp:   { fill: '#283830', step: 'rgba(255,200,150,0.12)', chevron: 'rgba(255,200,150,0.35)' },
      doorOpen:   { fill: '#282420', frame: 'rgba(160,130,100,0.35)' },
      wall:       { top: '#5a4a45', left: '#4a3a35', right: '#3a2a28', edge: 'rgba(255,200,150,0.05)' },
      doorClosed: { top: '#6a5a48', left: '#5a4a38', right: '#4a3a28', arch: 'rgba(255,200,150,0.12)', edge: 'rgba(255,200,150,0.08)' },
      lockedDoor: { top: '#5a4a38', left: '#4a3a28', right: '#3a2a1a', arch: 'rgba(255,200,150,0.10)', lock: 'rgba(180,140,60,0.6)', lockEdge: 'rgba(220,180,80,0.4)', edge: 'rgba(255,200,150,0.05)' },
      chest:      { top: '#4a4a42', left: '#3a3a32', right: '#2a2a22', band: 'rgba(120,110,90,0.4)', lock: 'rgba(180,140,60,0.7)', lockEdge: 'rgba(220,180,80,0.5)', edge: 'rgba(255,200,150,0.08)' },
      chestOpen:  { fill: '#2a2a25', edge: 'rgba(120,110,90,0.5)', inner: 'rgba(0,0,0,0.4)' },
      minimap: {
        stone_floor: 0x2a2828, cracked_floor: 0x2e2a28, stone_wall: 0x5a4a45,
        door_closed: 0x6a5a48, door_open: 0x282420, stairs_down: 0x3a2830,
        stairs_up: 0x283830, water: 0x1a2028, void: 0x0a0a0a,
        chest_closed: 0x4a4a42, chest_opened: 0x2a2a25,
      },
    },
  };

  _getIsoTheme() {
    const id = this.tileset ? this.tileset.id : 'crypt';
    return Renderer.ISO_THEMES[id] || Renderer.ISO_THEMES.crypt;
  }

  _buildIsoTileTextures() {
    const theme = this._getIsoTheme();
    const dw = CONSTANTS.ISO_DIAMOND_W;
    const dh = CONSTANTS.ISO_DIAMOND_H;
    const wallRise = theme.wallRise || CONSTANTS.ISO_WALL_RISE;
    this.isoWallRise = wallRise;
    const hw = dw / 2;
    const hh = dh / 2;

    // Destroy old textures to avoid leaks
    for (const key of Object.keys(this.isoTileTextures)) {
      if (this.isoTileTextures[key] && this.isoTileTextures[key].destroy) {
        this.isoTileTextures[key].destroy(true);
      }
    }
    this.isoTileTextures = {};

    const p = theme; // palette shorthand

    // --- Floor tile ---
    this.isoTileTextures['floor'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = p.floor.fill;
      ctx.fill();
      this._drawDiamond(ctx, hw, hh, hw - 1, hh - 1);
      ctx.strokeStyle = p.floor.edge;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // --- Floor2 (cracked) ---
    this.isoTileTextures['floor2'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = p.floor2.fill;
      ctx.fill();
      ctx.strokeStyle = p.floor2.crack;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw - 10, hh - 3);
      ctx.lineTo(hw + 5, hh + 5);
      ctx.moveTo(hw + 8, hh - 6);
      ctx.lineTo(hw - 4, hh + 4);
      ctx.stroke();
      this._drawDiamond(ctx, hw, hh, hw - 1, hh - 1);
      ctx.strokeStyle = p.floor2.edge;
      ctx.stroke();
    });

    // --- Water ---
    this.isoTileTextures['water'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = p.water.fill;
      ctx.fill();
      ctx.strokeStyle = p.water.wave;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        const cy = hh + i * 6;
        ctx.moveTo(hw - 20 + i * 4, cy);
        ctx.quadraticCurveTo(hw - 5, cy - 3, hw + 10 + i * 2, cy);
        ctx.quadraticCurveTo(hw + 20, cy + 3, hw + 28 - Math.abs(i) * 4, cy);
      }
      ctx.stroke();
    });

    // --- Stairs down ---
    this.isoTileTextures['stairs_down'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = p.stairsDown.fill;
      ctx.fill();
      ctx.strokeStyle = p.stairsDown.step;
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        const y = hh + i * 5;
        const xSpan = hw * (1 - Math.abs(i) * 0.25);
        ctx.beginPath();
        ctx.moveTo(hw - xSpan * 0.6, y);
        ctx.lineTo(hw + xSpan * 0.6, y);
        ctx.stroke();
      }
      ctx.strokeStyle = p.stairsDown.chevron;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hw - 8, hh - 4);
      ctx.lineTo(hw, hh + 4);
      ctx.lineTo(hw + 8, hh - 4);
      ctx.stroke();
    });

    // --- Stairs up ---
    this.isoTileTextures['stairs_up'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = p.stairsUp.fill;
      ctx.fill();
      ctx.strokeStyle = p.stairsUp.step;
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        const y = hh + i * 5;
        const xSpan = hw * (1 - Math.abs(i) * 0.25);
        ctx.beginPath();
        ctx.moveTo(hw - xSpan * 0.6, y);
        ctx.lineTo(hw + xSpan * 0.6, y);
        ctx.stroke();
      }
      ctx.strokeStyle = p.stairsUp.chevron;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hw - 8, hh + 4);
      ctx.lineTo(hw, hh - 4);
      ctx.lineTo(hw + 8, hh + 4);
      ctx.stroke();
    });

    // --- Door open ---
    this.isoTileTextures['door_open'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = p.doorOpen.fill;
      ctx.fill();
      ctx.strokeStyle = p.doorOpen.frame;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hw - 16, hh);
      ctx.lineTo(hw, hh - 8);
      ctx.lineTo(hw + 16, hh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hw - 16, hh);
      ctx.lineTo(hw, hh + 8);
      ctx.lineTo(hw + 16, hh);
      ctx.stroke();
    });

    // --- Wall (3D block) ---
    const wallH = dh + wallRise;
    this.isoTileTextures['wall'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      // Top diamond face
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = p.wall.top;
      ctx.fill();

      // Left face
      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.wall.left;
      ctx.fill();

      // Right face
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.wall.right;
      ctx.fill();

      // Edge lines
      ctx.strokeStyle = p.wall.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.moveTo(0, hh);
      ctx.lineTo(0, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(dw, hh + wallRise);
      ctx.stroke();
    });

    // --- Door closed (3D block) ---
    this.isoTileTextures['door_closed'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = p.doorClosed.top;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.doorClosed.left;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.doorClosed.right;
      ctx.fill();

      ctx.strokeStyle = p.doorClosed.arch;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hw, dh + wallRise * 0.3, wallRise * 0.35, Math.PI, 0);
      ctx.stroke();

      ctx.strokeStyle = p.doorClosed.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.stroke();
    });

    // --- Locked door (darker door + lock indicator) ---
    this.isoTileTextures['locked_door'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = p.lockedDoor.top;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.lockedDoor.left;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.lockedDoor.right;
      ctx.fill();

      ctx.strokeStyle = p.lockedDoor.arch;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hw, dh + wallRise * 0.3, wallRise * 0.35, Math.PI, 0);
      ctx.stroke();

      ctx.fillStyle = p.lockedDoor.lock;
      ctx.fillRect(hw - 4, dh + wallRise * 0.4, 8, 8);
      ctx.strokeStyle = p.lockedDoor.lockEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(hw - 4, dh + wallRise * 0.4, 8, 8);

      ctx.strokeStyle = p.lockedDoor.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.stroke();
    });

    // --- Chest closed (3D crate with lock) ---
    this.isoTileTextures['chest_closed'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = p.chest.top;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.chest.left;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.chest.right;
      ctx.fill();

      ctx.fillStyle = p.chest.band;
      ctx.fillRect(hw * 0.15, hh + wallRise * 0.2, hw * 0.7, 3);

      ctx.fillStyle = p.chest.lock;
      ctx.fillRect(hw - 5, dh + wallRise * 0.35, 10, 10);
      ctx.strokeStyle = p.chest.lockEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(hw - 5, dh + wallRise * 0.35, 10, 10);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(hw, dh + wallRise * 0.35 + 5, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = p.chest.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.stroke();
    });

    // --- Chest opened (low open crate, floor-height) ---
    this.isoTileTextures['chest_opened'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = p.chestOpen.fill;
      ctx.fill();
      ctx.strokeStyle = p.chestOpen.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hw - 16, hh);
      ctx.lineTo(hw, hh - 8);
      ctx.lineTo(hw + 16, hh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hw - 16, hh);
      ctx.lineTo(hw, hh + 8);
      ctx.lineTo(hw + 16, hh);
      ctx.stroke();
      ctx.fillStyle = p.chestOpen.inner;
      this._drawDiamond(ctx, hw, hh, hw * 0.6, hh * 0.6);
      ctx.fill();
    });

    // Map tile names to iso keys
    this.tileToIsoKey = {
      'stone_floor':   'floor',
      'cracked_floor': 'floor2',
      'door_open':     'door_open',
      'stairs_down':   'stairs_down',
      'stairs_up':     'stairs_up',
      'stone_wall':    'wall',
      'void':          'wall',
      'door_closed':   'door_closed',
      'locked_door':   'locked_door',
      'water':         'water',
      'chest_closed':  'chest_closed',
      'chest_opened':  'chest_opened',
      'sealed_gate':   'door_closed',
    };

    this.isoThemeId = this.tileset ? this.tileset.id : 'crypt';
    this.isoTileLoaded = true;
  }

  // --- Public API (same as before) ---

  resizeToFit(availW, availH) {
    if (this.isoMode) {
      // Scale zoom based on screen width, capped at 2x.
      // Small screens get a gentler zoom (more tiles visible) instead of
      // the old fixed /2 which felt too zoomed in on laptops.
      const zoom = Math.min(2, Math.max(1, availW / 1200));
      this.viewW = Math.max(640, Math.floor(availW / zoom));
      this.viewH = Math.max(480, Math.floor(availH / zoom));
      this.cssZoom = availW / this.viewW;

      if (this.app) {
        // Set renderer resolution to cssZoom so the backing buffer is at native pixel density.
        // This keeps the coordinate system at viewW x viewH (zoomed) while rendering
        // at full native resolution — text is crisp, pixel art stays clean with NEAREST.
        this.app.renderer.resolution = this.cssZoom;
        this.app.renderer.resize(this.viewW, this.viewH);
      }

      this.canvas.style.width = `${Math.floor(availW)}px`;
      this.canvas.style.height = `${Math.floor(availH)}px`;

      this._rebuildTilePool();
      return;
    }

    const isMobile = ('ontouchstart' in window);
    const targetTilePx = isMobile ? 28 : 32;

    let tx = Math.floor(availW / targetTilePx) | 1;
    let ty = Math.floor(availH / targetTilePx) | 1;
    if (tx % 2 === 0) tx--;
    if (ty % 2 === 0) ty--;
    tx = Math.max(9, Math.min(tx, 25));
    ty = Math.max(7, Math.min(ty, 19));

    this.viewportTX = tx;
    this.viewportTY = ty;
    this.viewW = tx * CONSTANTS.TILE_SIZE;
    this.viewH = ty * CONSTANTS.TILE_SIZE;

    if (this.app) {
      this.app.renderer.resize(this.viewW, this.viewH);
    }

    // Scale canvas to fill available space
    const scaleX = availW / this.viewW;
    const scaleY = availH / this.viewH;
    const scale = Math.min(scaleX, scaleY);
    this.canvas.style.width = `${Math.floor(this.viewW * scale)}px`;
    this.canvas.style.height = `${Math.floor(this.viewH * scale)}px`;

    // Rebuild tile sprite pool on resize
    this._rebuildTilePool();
  }

  setMap(map, tileset) {
    this.map = map;
    this.tileset = tileset;
    this.ambientLight = map.ambientLight !== undefined ? map.ambientLight : 1.0;
    this.buildTileColors();
    this.tilesetLoaded = false;
    this.tileTextures = {};
    this._buildTileTextures();
    if (this.isoMode) {
      const newThemeId = tileset ? tileset.id : 'crypt';
      if (!this.isoTileLoaded || this.isoThemeId !== newThemeId) {
        this._buildIsoTileTextures();
      }
    }
    this._rebuildTilePool();
  }

  buildTileColors() {
    if (!this.tileset) return;
    const theme = this._getIsoTheme();
    const colorMap = theme.minimap;
    for (const [id, tile] of Object.entries(this.tileset.tiles)) {
      this.tileColors[id] = colorMap[tile.name] !== undefined ? colorMap[tile.name] : 0xff00ff;
    }
  }

  setState(state) {
    this.state = state;
  }

  setMyId(id) {
    this.myId = id;
  }

  // --- Tile pool management ---

  _rebuildTilePool() {
    if (!this.tileContainer) return;

    // Remove old floor tile sprites
    this.tileContainer.removeChildren();
    this.tileSprites = [];

    // Remove old wall tile sprites from entity container
    for (const ws of this.wallSprites) {
      this.entityContainer.removeChild(ws);
    }
    this.wallSprites = [];

    if (this.isoMode) {
      // In iso mode, allocate enough sprites for entire map (maps are small, ~960 tiles max)
      const count = this.map ? this.map.width * this.map.height : 600;
      // Floor tile sprites in tileContainer (always behind entities)
      for (let i = 0; i < count; i++) {
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.visible = false;
        this.tileContainer.addChild(sprite);
        this.tileSprites.push(sprite);
      }
      // Wall tile sprites in entityContainer (depth-sorted with entities)
      for (let i = 0; i < count; i++) {
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.visible = false;
        this.entityContainer.addChild(sprite);
        this.wallSprites.push(sprite);
      }
      return;
    }

    // Create a grid of tile sprites covering the viewport + 1 tile margin
    const ts = CONSTANTS.TILE_SIZE;
    this.tileCols = Math.ceil(this.viewW / ts) + 2;
    this.tileRows = Math.ceil(this.viewH / ts) + 2;

    for (let i = 0; i < this.tileRows * this.tileCols; i++) {
      const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
      sprite.width = ts;
      sprite.height = ts;
      sprite.visible = false;
      this.tileContainer.addChild(sprite);
      this.tileSprites.push(sprite);
    }
  }

  // --- Main render call ---

  render() {
    if (!this.ready || !this.map || !this.state) return;

    this.updateCamera();

    // Position world container (camera offset)
    this.worldContainer.x = -Math.round(this.camX);
    this.worldContainer.y = -Math.round(this.camY);

    this.renderMap();
    this.renderSpawns();
    this.renderExits();
    this.renderClickTarget();
    this.renderAimLine();
    this.renderItems();
    this.renderNPCs();
    this.renderMonsters();
    this.renderProjectiles();
    this.renderConeEffects();
    this.renderPlayers();
    this.renderDoorPrompts();
    this.renderDamageNumbers();
    this.renderMinimap();
    this.renderQuestArrow();
    this.renderSpeechBubble();

    // Y-sort the entity container
    this.entityContainer.sortChildren();

    // Render darkness overlay with light holes
    this.renderLighting();

    // Flush PixiJS scene to WebGL/canvas
    this.app.render();
  }

  updateCamera() {
    if (!this.state || !this.myId) return;
    const me = this.state.players.find(p => p.id === this.myId);
    if (!me) return;

    if (this.isoMode) {
      const iso = this.worldToIso(me.x, me.y);
      const targetX = iso.x - this.viewW / 2;
      const targetY = iso.y - this.viewH / 2;

      // Compute iso bounding box from map corners
      const ts = CONSTANTS.TILE_SIZE;
      const mw = this.map.width * ts;
      const mh = this.map.height * ts;
      const corners = [
        this.worldToIso(0, 0),
        this.worldToIso(mw, 0),
        this.worldToIso(0, mh),
        this.worldToIso(mw, mh),
      ];
      const minX = Math.min(...corners.map(c => c.x));
      const maxX = Math.max(...corners.map(c => c.x));
      const minY = Math.min(...corners.map(c => c.y));
      const maxY = Math.max(...corners.map(c => c.y));

      // Add padding for tile sprite overhang
      const padX = CONSTANTS.ISO_DIAMOND_W;
      const padY = CONSTANTS.ISO_DIAMOND_H + this.isoWallRise;

      this.camX = Math.max(minX - padX, Math.min(targetX, maxX + padX - this.viewW));
      this.camY = Math.max(minY - padY, Math.min(targetY, maxY + padY - this.viewH));
      return;
    }

    const targetX = me.x - this.viewW / 2;
    const targetY = me.y - this.viewH / 2;

    const mapW = this.map.width * CONSTANTS.TILE_SIZE;
    const mapH = this.map.height * CONSTANTS.TILE_SIZE;
    this.camX = Math.max(0, Math.min(targetX, mapW - this.viewW));
    this.camY = Math.max(0, Math.min(targetY, mapH - this.viewH));
  }

  // --- Screen-to-world coordinate conversion ---

  screenToWorld(screenX, screenY) {
    // Account for CSS scaling of the canvas
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.viewW / rect.width;
    const scaleY = this.viewH / rect.height;
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;

    if (this.isoMode) {
      // Canvas coords -> iso screen coords -> world coords
      const isoX = canvasX + this.camX;
      const isoY = canvasY + this.camY;
      return this.isoToWorld(isoX, isoY);
    }

    return {
      x: canvasX + this.camX,
      y: canvasY + this.camY,
    };
  }

  // --- Click target indicator ---

  renderClickTarget() {
    this.clickTargetGfx.clear();
    if (!this.clickTarget) return;

    const pulse = 0.3 + 0.4 * Math.sin(Date.now() / 200);
    const radius = 6 + 2 * Math.sin(Date.now() / 300);

    let cx = this.clickTarget.x;
    let cy = this.clickTarget.y;
    if (this.isoMode) {
      const iso = this.worldToIso(cx, cy);
      cx = iso.x;
      cy = iso.y;
    }

    this.clickTargetGfx.lineStyle(1.5, 0xffffff, pulse);
    this.clickTargetGfx.drawCircle(cx, cy, radius);
  }

  // --- Aim indicator line ---

  renderAimLine() {
    this.aimLineGfx.clear();
    if (!this.aimIndicator || !this.aimIndicator.active) return;
    if (!this.state || !this.myId) return;

    const me = this.state.players.find(p => p.id === this.myId);
    if (!me) return;

    const angle = this.aimIndicator.angle;
    const lineLen = CONSTANTS.TILE_SIZE * 5;
    const endX = me.x + Math.cos(angle) * lineLen;
    const endY = me.y + Math.sin(angle) * lineLen;

    let sx, sy, ex, ey;
    if (this.isoMode) {
      const isoS = this.worldToIso(me.x, me.y);
      const isoE = this.worldToIso(endX, endY);
      sx = isoS.x;
      sy = isoS.y;
      ex = isoE.x;
      ey = isoE.y;
    } else {
      sx = me.x;
      sy = me.y;
      ex = endX;
      ey = endY;
    }

    // Dashed aim line with arrowhead
    const dx = ex - sx;
    const dy = ey - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / len;
    const ny = dy / len;

    // Draw dashed line segments
    const dashLen = 8;
    const gapLen = 6;
    let dist = 0;
    this.aimLineGfx.lineStyle(2, 0xef5350, 0.6);
    while (dist < len) {
      const segStart = dist;
      const segEnd = Math.min(dist + dashLen, len);
      this.aimLineGfx.moveTo(sx + nx * segStart, sy + ny * segStart);
      this.aimLineGfx.lineTo(sx + nx * segEnd, sy + ny * segEnd);
      dist += dashLen + gapLen;
    }

    // Arrowhead at end
    const arrowSize = 8;
    const perpX = -ny * arrowSize * 0.6;
    const perpY = nx * arrowSize * 0.6;
    this.aimLineGfx.lineStyle(0);
    this.aimLineGfx.beginFill(0xef5350, 0.7);
    this.aimLineGfx.moveTo(ex, ey);
    this.aimLineGfx.lineTo(ex - nx * arrowSize + perpX, ey - ny * arrowSize + perpY);
    this.aimLineGfx.lineTo(ex - nx * arrowSize - perpX, ey - ny * arrowSize - perpY);
    this.aimLineGfx.closePath();
    this.aimLineGfx.endFill();

    // Small circle at origin
    this.aimLineGfx.lineStyle(1, 0xef5350, 0.4);
    this.aimLineGfx.drawCircle(sx, sy, 6);
  }

  // --- Tile rendering ---

  renderMap() {
    if (this.isoMode) {
      this._renderMapIso();
    } else {
      this._renderMapFlat();
    }
  }

  _renderMapFlat() {
    const ts = CONSTANTS.TILE_SIZE;
    const startTX = Math.floor(this.camX / ts);
    const startTY = Math.floor(this.camY / ts);

    let idx = 0;
    for (let row = 0; row < this.tileRows; row++) {
      for (let col = 0; col < this.tileCols; col++) {
        const sprite = this.tileSprites[idx++];
        if (!sprite) continue;

        const tx = startTX + col;
        const ty = startTY + row;

        if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) {
          sprite.visible = false;
          continue;
        }

        const tileId = String(this.map.data[ty * this.map.width + tx]);
        sprite.visible = true;
        sprite.x = tx * ts;
        sprite.y = ty * ts;
        sprite.width = ts;
        sprite.height = ts;

        if (this.tilesetLoaded && this.tileTextures[tileId]) {
          sprite.texture = this.tileTextures[tileId];
          sprite.tint = 0xffffff;
        } else {
          sprite.texture = PIXI.Texture.WHITE;
          sprite.tint = this.tileColors[tileId] !== undefined ? this.tileColors[tileId] : 0xff00ff;
        }
      }
    }

    while (idx < this.tileSprites.length) {
      this.tileSprites[idx++].visible = false;
    }
  }

  _renderMapIso() {
    const ts = CONSTANTS.TILE_SIZE;
    const dw = CONSTANTS.ISO_DIAMOND_W;
    const dh = CONSTANTS.ISO_DIAMOND_H;
    const wallRise = this.isoWallRise;

    // Wall-type iso keys
    const wallKeys = new Set(['wall', 'door_closed', 'locked_door', 'chest_closed']);

    // Viewport culling bounds in iso screen space (generous padding for large screens)
    const pad = dw * 2;
    const cullL = this.camX - pad;
    const cullR = this.camX + this.viewW + pad;
    const cullT = this.camY - pad - wallRise;
    const cullB = this.camY + this.viewH + pad + wallRise;

    let floorIdx = 0;
    let wallIdx = 0;
    const w = this.map.width;
    const h = this.map.height;

    // Iterate in diagonal order for back-to-front depth
    for (let diag = 0; diag < w + h - 1; diag++) {
      for (let tx = Math.max(0, diag - h + 1); tx <= Math.min(diag, w - 1); tx++) {
        const ty = diag - tx;

        // Get iso position for tile center
        const wcx = (tx + 0.5) * ts;
        const wcy = (ty + 0.5) * ts;
        const iso = this.worldToIso(wcx, wcy);

        // Cull outside viewport
        if (iso.x < cullL || iso.x > cullR || iso.y < cullT || iso.y > cullB) {
          continue;
        }

        const tileId = String(this.map.data[ty * w + tx]);
        const tileDef = this.tileset ? this.tileset.tiles[tileId] : null;
        const tileName = tileDef ? tileDef.name : 'void';
        const isoKey = this.tileToIsoKey[tileName] || 'wall';
        const isWall = wallKeys.has(isoKey);

        if (isWall) {
          // Wall tiles go into entityContainer for depth sorting with entities
          if (wallIdx >= this.wallSprites.length) continue;
          const sprite = this.wallSprites[wallIdx++];

          sprite.visible = true;
          sprite.tint = 0xffffff;

          if (this.isoTileLoaded && this.isoTileTextures[isoKey]) {
            sprite.texture = this.isoTileTextures[isoKey];
          } else {
            sprite.texture = PIXI.Texture.WHITE;
            sprite.tint = this.tileColors[tileId] !== undefined ? this.tileColors[tileId] : 0xff00ff;
          }

          sprite.anchor.set(0.5, 1.0);
          sprite.width = dw;
          sprite.height = dh + wallRise;
          sprite.x = iso.x;
          sprite.y = iso.y + dh / 2;
          sprite.zIndex = iso.y;
        } else {
          // Floor tiles stay in tileContainer (always behind entities)
          if (floorIdx >= this.tileSprites.length) continue;
          const sprite = this.tileSprites[floorIdx++];

          sprite.visible = true;
          sprite.tint = 0xffffff;

          if (this.isoTileLoaded && this.isoTileTextures[isoKey]) {
            sprite.texture = this.isoTileTextures[isoKey];
          } else {
            sprite.texture = PIXI.Texture.WHITE;
            sprite.tint = this.tileColors[tileId] !== undefined ? this.tileColors[tileId] : 0xff00ff;
          }

          sprite.anchor.set(0.5, 0.5);
          sprite.width = dw;
          sprite.height = dh;
          sprite.x = iso.x;
          sprite.y = iso.y;
        }
      }
    }

    // Hide remaining sprites
    while (floorIdx < this.tileSprites.length) {
      this.tileSprites[floorIdx++].visible = false;
    }
    while (wallIdx < this.wallSprites.length) {
      this.wallSprites[wallIdx++].visible = false;
    }
  }

  // --- Spawn markers ---

  renderSpawns() {
    this.spawnGfx.clear();
    if (!this.map.spawns) return;
    const ts = CONSTANTS.TILE_SIZE;

    this.spawnGfx.lineStyle(1, 0x26a69a, 0.3);
    for (const spawn of this.map.spawns) {
      const wx = (spawn.x + 0.5) * ts;
      const wy = (spawn.y + 0.5) * ts;
      if (this.isoMode) {
        const iso = this.worldToIso(wx, wy);
        this.spawnGfx.drawCircle(iso.x, iso.y, 4);
      } else {
        this.spawnGfx.drawCircle(wx, wy, ts * 0.3);
      }
    }
  }

  // --- Exit markers ---

  renderExits() {
    this.exitGfx.clear();
    if (!this.map.exits) return;
    const ts = CONSTANTS.TILE_SIZE;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);

    for (const exit of this.map.exits) {
      const wx = (exit.x + 0.5) * ts;
      const wy = (exit.y + 0.5) * ts;
      const isUp = exit.type === 'stairs_up';
      const color = isUp ? 0x26a69a : 0xab47bc;

      if (this.isoMode) {
        const iso = this.worldToIso(wx, wy);
        this.exitGfx.beginFill(color, 0.3 + 0.3 * pulse);
        this.exitGfx.drawCircle(iso.x, iso.y, 5);
        this.exitGfx.endFill();
      } else {
        this.exitGfx.beginFill(color, 0.3 + 0.3 * pulse);
        this.exitGfx.drawCircle(wx, wy, ts * 0.35);
        this.exitGfx.endFill();
      }
    }
  }

  // --- Entity helpers ---

  _getOrCreateEntityContainer(pool, id) {
    if (pool.has(id)) return pool.get(id);

    const container = new PIXI.Container();
    container.sortableChildren = false;

    // Ground shadow (only visible in iso mode)
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.25);
    shadow.drawEllipse(0, 0, 14, 7);
    shadow.endFill();
    shadow.visible = this.isoMode;
    container.addChild(shadow);

    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.anchor.set(0.5);
    container.addChild(sprite);

    const nameTag = new PIXI.Text('', {
      fontFamily: 'Courier New',
      fontSize: 11,
      fill: 0xffffff,
      align: 'center',
    });
    nameTag.anchor.set(0.5, 1);
    container.addChild(nameTag);

    // Health bar: bg + fill
    const healthBg = new PIXI.Graphics();
    container.addChild(healthBg);
    const healthFill = new PIXI.Graphics();
    container.addChild(healthFill);

    // Extra text for prompts
    const promptText = new PIXI.Text('', {
      fontFamily: 'Courier New',
      fontSize: 10,
      fill: 0xffffff,
      align: 'center',
    });
    promptText.anchor.set(0.5, 0);
    promptText.visible = false;
    container.addChild(promptText);

    // Extra text for item name
    const extraText = new PIXI.Text('', {
      fontFamily: 'Courier New',
      fontSize: 9,
      fill: 0xffffff,
      align: 'center',
    });
    extraText.anchor.set(0.5, 0);
    extraText.visible = false;
    container.addChild(extraText);

    this.entityContainer.addChild(container);

    const entry = { container, sprite, nameTag, healthBg, healthFill, promptText, extraText };
    pool.set(id, entry);
    return entry;
  }

  _cleanupPool(pool, activeIds) {
    for (const [id, entry] of pool) {
      if (!activeIds.has(id)) {
        this.entityContainer.removeChild(entry.container);
        entry.container.destroy({ children: true });
        pool.delete(id);
      }
    }
  }

  _setSpriteTexture(sprite, spritePath, fallbackSize) {
    const tex = this.loadTexture(spritePath);
    const sz = this.isoMode ? 36 : CONSTANTS.TILE_SIZE;
    if (tex.valid) {
      sprite.texture = tex;
      sprite.tint = 0xffffff;
      sprite.width = sz;
      sprite.height = sz;
      // In iso mode, shift sprite up so bottom is at ground level (feet on ground)
      sprite.y = this.isoMode ? -sz / 2 : 0;
      return true;
    }
    // Texture is loading — use fallback (white square tinted)
    sprite.texture = PIXI.Texture.WHITE;
    const fsz = fallbackSize || 20;
    sprite.width = fsz;
    sprite.height = fsz;
    sprite.y = this.isoMode ? -fsz / 2 : 0;
    return false;
  }

  _drawHealthBar(healthBg, healthFill, x, y, w, h, pct, barColor) {
    healthBg.clear();
    healthBg.beginFill(0x333333);
    healthBg.drawRect(x - w / 2, y, w, h);
    healthBg.endFill();

    healthFill.clear();
    healthFill.beginFill(barColor);
    healthFill.drawRect(x - w / 2, y, w * pct, h);
    healthFill.endFill();
  }

  // --- Items ---

  renderItems() {
    if (!this.state || !this.state.items) return;

    const activeIds = new Set();
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 600);
    const bob = Math.sin(Date.now() / 400) * 2;
    const me = this.myId ? this.state.players.find(p => p.id === this.myId) : null;

    for (const item of this.state.items) {
      activeIds.add(item.id);
      const entry = this._getOrCreateEntityContainer(this.itemSprites, item.id);
      const { container, sprite, nameTag, healthBg, healthFill, promptText, extraText } = entry;

      this._positionEntity(container, item.x, item.y);
      container.y += bob;

      // Hide health bar for items
      healthBg.clear();
      healthFill.clear();

      // Sprite
      const spritePath = 'sprites/' + item.type + '.png';
      const loaded = this._setSpriteTexture(sprite, spritePath, 20);
      if (!loaded) {
        // Fallback color tint based on rarity
        const rarityColors = {
          common: 0xffffff, uncommon: 0x4caf50, rare: 0x2196f3,
          epic: 0x9c27b0, legendary: 0xff9800,
        };
        sprite.tint = rarityColors[item.rarity] || 0xffffff;
      }
      sprite.alpha = 0.8 + 0.2 * pulse;

      // Name tag hidden for items unless nearby
      nameTag.visible = false;

      // Check proximity for pickup prompt
      if (me) {
        const dx = item.x - me.x;
        const dy = item.y - me.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const range = CONSTANTS.ITEM_PICKUP_RANGE * CONSTANTS.TILE_SIZE;
        if (dist < range) {
          promptText.text = '[E] Pick up';
          promptText.y = this.isoMode ? 4 : 12;
          promptText.alpha = 0.5 + 0.3 * pulse;
          promptText.visible = true;

          extraText.text = item.name;
          const rarityHex = CONSTANTS.RARITY_COLORS[item.rarity] || '#ffffff';
          extraText.style.fill = rarityHex;
          extraText.y = this.isoMode ? 16 : 24;
          extraText.visible = true;
        } else {
          promptText.visible = false;
          extraText.visible = false;
        }
      } else {
        promptText.visible = false;
        extraText.visible = false;
      }
    }

    this._cleanupPool(this.itemSprites, activeIds);
  }

  // --- NPCs ---

  renderNPCs() {
    if (!this.state || !this.state.npcs) return;

    const activeIds = new Set();
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 800);
    const me = this.myId ? this.state.players.find(p => p.id === this.myId) : null;
    const r = CONSTANTS.PLAYER_RADIUS;

    for (const npc of this.state.npcs) {
      activeIds.add(npc.id);
      const entry = this._getOrCreateEntityContainer(this.npcSprites, npc.id);
      const { container, sprite, nameTag, healthBg, healthFill, promptText } = entry;

      this._positionEntity(container, npc.x, npc.y);

      // Sprite
      const spritePath = 'sprites/npc_default.png';
      const loaded = this._setSpriteTexture(sprite, spritePath, r * 2);
      if (!loaded) sprite.tint = 0x64b5f6;

      // Name tag (above sprite top)
      nameTag.text = npc.name;
      nameTag.style.fill = '#64b5f6';
      nameTag.y = this.isoMode ? -42 : -r - 6;
      nameTag.visible = true;

      // No health bar for NPCs
      healthBg.clear();
      healthFill.clear();

      // Talk prompt
      if (me) {
        const dx = npc.x - me.x;
        const dy = npc.y - me.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const range = CONSTANTS.NPC_INTERACT_RANGE * CONSTANTS.TILE_SIZE;
        if (dist < range) {
          promptText.text = '[E] Talk';
          promptText.y = this.isoMode ? 4 : r + 4;
          promptText.alpha = 0.5 + 0.3 * pulse;
          promptText.visible = true;
        } else {
          promptText.visible = false;
        }
      } else {
        promptText.visible = false;
      }
    }

    this._cleanupPool(this.npcSprites, activeIds);
  }

  // --- Monsters ---

  renderMonsters() {
    if (!this.state || !this.state.monsters) return;

    const activeIds = new Set();
    const r = CONSTANTS.MONSTER_COLLISION_RADIUS || 10;

    for (const mob of this.state.monsters) {
      activeIds.add(mob.id);
      const entry = this._getOrCreateEntityContainer(this.monsterSprites, mob.id);
      const { container, sprite, nameTag, healthBg, healthFill, promptText } = entry;

      this._positionEntity(container, mob.x, mob.y);

      // Sprite
      const spritePath = mob.type ? 'sprites/' + mob.type + '.png' : null;
      if (spritePath) {
        const loaded = this._setSpriteTexture(sprite, spritePath, r * 2);
        if (!loaded) sprite.tint = 0xe53935;
      } else {
        sprite.texture = PIXI.Texture.WHITE;
        sprite.width = r * 2;
        sprite.height = r * 2;
        sprite.tint = 0xe53935;
        sprite.y = this.isoMode ? -r : 0;
      }

      // Name tag (above sprite top)
      nameTag.text = mob.name;
      nameTag.style.fill = '#e57373';
      nameTag.y = this.isoMode ? -42 : -r - 6;
      nameTag.visible = true;

      // Health bar (just below name tag)
      const hp = mob.health / mob.maxHealth;
      const barColor = hp > 0.5 ? 0xe53935 : 0xff6f00;
      this._drawHealthBar(healthBg, healthFill, 0, this.isoMode ? -40 : -r - 4, 26, 3, hp, barColor);

      promptText.visible = false;
    }

    this._cleanupPool(this.monsterSprites, activeIds);
  }

  // --- Projectiles ---

  renderProjectiles() {
    if (!this.state || !this.state.projectiles) return;

    const activeIds = new Set();
    const r = CONSTANTS.PROJECTILE_RADIUS || 4;

    for (const proj of this.state.projectiles) {
      activeIds.add(proj.id);

      // Get or create a simple sprite container for this projectile
      let entry = this.projectileSprites.get(proj.id);
      if (!entry) {
        const container = new PIXI.Container();
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5, 0.5);
        sprite.width = r * 2;
        sprite.height = r * 2;
        sprite.tint = 0x4fc3f7; // Light blue projectile color
        container.addChild(sprite);
        this.entityContainer.addChild(container);
        entry = { container, sprite };
        this.projectileSprites.set(proj.id, entry);
      }

      const { container } = entry;
      this._positionEntity(container, proj.x, proj.y);
    }

    this._cleanupPool(this.projectileSprites, activeIds);
  }

  // --- Players ---

  renderPlayers() {
    if (!this.state) return;

    const activeIds = new Set();
    const playerSpriteNames = ['player_blue', 'player_red', 'player_green', 'player_orange'];
    const r = CONSTANTS.PLAYER_RADIUS;

    for (const player of this.state.players) {
      activeIds.add(player.id);
      const entry = this._getOrCreateEntityContainer(this.playerSprites, player.id);
      const { container, sprite, nameTag, healthBg, healthFill, promptText } = entry;
      const isMe = player.id === this.myId;

      this._positionEntity(container, player.x, player.y);

      // Sprite
      const spriteName = playerSpriteNames[player.colorIndex] || 'player_blue';
      const spritePath = 'sprites/' + spriteName + '.png';
      const loaded = this._setSpriteTexture(sprite, spritePath, r * 2);
      if (!loaded) {
        const playerColors = [0x4fc3f7, 0xef5350, 0x66bb6a, 0xffa726];
        sprite.tint = playerColors[player.colorIndex] || 0xffffff;
      }

      // Name tag (above sprite top)
      nameTag.text = player.name;
      nameTag.style.fill = isMe ? '#ffffff' : 'rgba(255,255,255,0.7)';
      nameTag.y = this.isoMode ? -42 : -r - 6;
      nameTag.visible = true;

      // Health bar (just below name tag)
      if (player.health < player.maxHealth || isMe) {
        const healthPct = player.health / player.maxHealth;
        const barColor = healthPct > 0.5 ? 0x4caf50 : healthPct > 0.25 ? 0xffa726 : 0xe53935;
        this._drawHealthBar(healthBg, healthFill, 0, this.isoMode ? -40 : -r - 4, 30, 4, healthPct, barColor);
      } else {
        healthBg.clear();
        healthFill.clear();
      }

      // Weapon indicator (centered on sprite body)
      const isoOff = this.isoMode ? -18 : 0;
      if (!entry.weaponGfx) {
        entry.weaponGfx = new PIXI.Graphics();
        container.addChild(entry.weaponGfx);
      }
      entry.weaponGfx.clear();
      if (player.weapon) {
        const wLen = r + 10;
        const wBaseX = Math.cos(player.facing) * (r - 2);
        const wBaseY = Math.sin(player.facing) * (r - 2) + isoOff;
        const wTipX = Math.cos(player.facing) * wLen;
        const wTipY = Math.sin(player.facing) * wLen + isoOff;
        entry.weaponGfx.lineStyle(3, 0xb8975a);
        entry.weaponGfx.moveTo(wBaseX, wBaseY);
        entry.weaponGfx.lineTo(wTipX, wTipY);
        // Crossguard
        const midX = (wBaseX + wTipX) / 2;
        const midY = (wBaseY + wTipY) / 2;
        const perpX = -Math.sin(player.facing) * 4;
        const perpY = Math.cos(player.facing) * 4;
        entry.weaponGfx.lineStyle(2, 0x8a6a3a);
        entry.weaponGfx.moveTo(midX + perpX, midY + perpY);
        entry.weaponGfx.lineTo(midX - perpX, midY - perpY);
      }

      // "You" indicator (centered on sprite body)
      if (!entry.youIndicator) {
        entry.youIndicator = new PIXI.Graphics();
        container.addChild(entry.youIndicator);
      }
      entry.youIndicator.clear();
      if (isMe) {
        entry.youIndicator.lineStyle(1, 0xffffff, 0.4);
        entry.youIndicator.drawCircle(0, isoOff, r + 6);
      }

      promptText.visible = false;
    }

    this._cleanupPool(this.playerSprites, activeIds);
  }

  // --- Door prompts ---

  renderDoorPrompts() {
    // Destroy old text objects to avoid memory leaks
    while (this.doorPromptContainer.children.length > 0) {
      this.doorPromptContainer.children[0].destroy();
    }
    if (!this.state || !this.myId || !this.tileset || !this.map) return;

    const me = this.state.players.find(p => p.id === this.myId);
    if (!me) return;

    const ts = CONSTANTS.TILE_SIZE;
    const range = CONSTANTS.DOOR_INTERACT_RANGE * ts;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 800);
    const playerTX = Math.floor(me.x / ts);
    const playerTY = Math.floor(me.y / ts);

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = playerTX + dx;
        const ty = playerTY + dy;
        if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) continue;

        const tileId = this.map.data[ty * this.map.width + tx];
        const tileDef = this.tileset.tiles[String(tileId)];
        if (!tileDef || tileDef.interactable !== 'door') continue;

        const tileCX = (tx + 0.5) * ts;
        const tileCY = (ty + 0.5) * ts;
        const ddx = tileCX - me.x;
        const ddy = tileCY - me.y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);

        if (dist < range) {
          const label = tileDef.solid ? '[E] Open' : '[E] Close';
          const text = new PIXI.Text(label, {
            fontFamily: 'Courier New',
            fontSize: 10,
            fill: 0xffffff,
            align: 'center',
          });
          text.anchor.set(0.5, 1);
          if (this.isoMode) {
            const iso = this.worldToIso(tileCX, tileCY);
            text.x = iso.x;
            text.y = iso.y - 10;
          } else {
            text.x = tileCX;
            text.y = tileCY - ts * 0.4;
          }
          text.alpha = 0.5 + 0.3 * pulse;
          this.doorPromptContainer.addChild(text);
        }
      }
    }
  }

  // --- Cone effects ---

  renderConeEffects() {
    this.coneGfx.clear();
    const dt = 1 / 60;
    this.coneEffects = this.coneEffects.filter(cone => {
      cone.age += dt;
      if (cone.age >= cone.maxAge) return false;

      const alpha = 0.4 * (1 - cone.age / cone.maxAge);
      const halfAngle = cone.coneAngle / 2;
      const startAngle = cone.angle - halfAngle;
      const endAngle = cone.angle + halfAngle;

      this.coneGfx.beginFill(0xffaa00, alpha);
      this.coneGfx.moveTo(cone.x, cone.y);
      this.coneGfx.arc(cone.x, cone.y, cone.range, startAngle, endAngle);
      this.coneGfx.lineTo(cone.x, cone.y);
      this.coneGfx.endFill();

      return true;
    });
  }

  // --- Damage numbers ---

  processEvents(events) {
    if (!events) return;
    for (const ev of events) {
      if (ev.type === 'damage') {
        this.damageNumbers.push({
          text: `-${ev.amount}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.0,
          color: ev.targetId.startsWith('mob_') ? '#ffa726' : '#e53935',
        });
      } else if (ev.type === 'darkness_damage') {
        this.damageNumbers.push({
          text: `-${ev.amount}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.0,
          color: '#7c4dff',
        });
      } else if (ev.type === 'heal') {
        this.damageNumbers.push({
          text: `+${ev.amount}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.0,
          color: '#4caf50',
        });
      } else if (ev.type === 'pickup') {
        this.damageNumbers.push({
          text: `+${ev.itemName}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.2,
          color: '#fdd835',
        });
      } else if (ev.type === 'cone_effect') {
        this.coneEffects.push({
          x: ev.x, y: ev.y,
          angle: ev.angle,
          coneAngle: (ev.coneAngle || 60) * (Math.PI / 180),
          range: ev.range,
          age: 0, maxAge: 0.4,
        });
      }
    }
  }

  renderDamageNumbers() {
    // Destroy old PIXI text objects to avoid memory leaks
    while (this.dmgContainer.children.length > 0) {
      this.dmgContainer.children[0].destroy();
    }

    const dt = 1 / 60;
    this.damageNumbers = this.damageNumbers.filter(dn => {
      dn.age += dt;
      if (dn.age >= dn.maxAge) return false;

      const alpha = 1 - (dn.age / dn.maxAge);
      const offsetY = dn.age * 40;
      const screen = this._worldToScreen(dn.x, dn.y);
      const sx = screen.x;
      const sy = screen.y - offsetY;

      const text = new PIXI.Text(dn.text, {
        fontFamily: 'Courier New',
        fontSize: 13,
        fontWeight: 'bold',
        fill: dn.color,
        align: 'center',
      });
      text.anchor.set(0.5);
      text.x = sx;
      text.y = sy;
      text.alpha = alpha;
      this.dmgContainer.addChild(text);
      return true;
    });
  }

  // --- Minimap ---

  toggleFullMap() {
    this.fullMap = !this.fullMap;
  }

  isPointInMinimap(screenX, screenY) {
    if (!this.minimapBounds) return false;
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = (screenX - rect.left) * (this.viewW / rect.width);
    const canvasY = (screenY - rect.top) * (this.viewH / rect.height);
    const b = this.minimapBounds;
    return canvasX >= b.x && canvasX <= b.x + b.w && canvasY >= b.y && canvasY <= b.y + b.h;
  }

  renderMinimap() {
    this.minimapGfx.clear();
    if (!this.map) return;

    const ts = CONSTANTS.TILE_SIZE;
    const W = this.map.width;
    const H = this.map.height;
    const full = this.fullMap;
    // Dot sizes scale up in full map mode
    const dotSmall = full ? 4 : 2;
    const dotLarge = full ? 5 : 3;
    const questDotR = full ? 6 : 3;
    const playerColors = [0x4fc3f7, 0xef5350, 0x66bb6a, 0xffa726];

    if (this.isoMode) {
      // Iso minimap: project tile coords through iso transform
      const projW = W - 1 + H - 1;          // horizontal range of (tx - ty)
      const projH = (W - 1 + H - 1) / 2;    // vertical range of (tx + ty)/2
      const pad = full ? 10 : 4;

      let fit, mmX, mmY, mmW, mmH;
      if (full) {
        // Full map: fit to 80% of viewport, centered
        fit = Math.min((this.viewW * 0.8) / (projW || 1), (this.viewH * 0.8) / (projH || 1));
        mmW = Math.round(projW * fit);
        mmH = Math.round(projH * fit);
        mmX = Math.round((this.viewW - mmW) / 2);
        mmY = Math.round((this.viewH - mmH) / 2);
      } else {
        fit = Math.min(150 / (projW || 1), 150 / (projH || 1));
        mmW = Math.round(projW * fit);
        mmH = Math.round(projH * fit);
        mmX = this.viewW - mmW - 10 - pad;
        mmY = 10 + pad;
      }

      this.minimapBounds = { x: mmX - pad, y: mmY - pad, w: mmW + pad * 2, h: mmH + pad * 2 };

      // project tile coords to minimap pixel coords (rounded for crisp rendering)
      const isoX = (tx, ty) => Math.round(mmX + (tx - ty + (H - 1)) * fit);
      const isoY = (tx, ty) => Math.round(mmY + (tx + ty) * 0.5 * fit);
      // project world-pixel coords
      const isoPx = (wx, wy) => {
        const ftx = wx / ts, fty = wy / ts;
        return {
          x: Math.round(mmX + (ftx - fty + (H - 1)) * fit),
          y: Math.round(mmY + (ftx + fty) * 0.5 * fit)
        };
      };

      // Background (full overlay dims the whole screen)
      if (full) {
        this.minimapGfx.beginFill(0x000000, 0.7);
        this.minimapGfx.drawRect(0, 0, this.viewW, this.viewH);
        this.minimapGfx.endFill();
      }
      this.minimapGfx.beginFill(0x000000, 0.6);
      this.minimapGfx.drawRect(Math.round(mmX - pad), Math.round(mmY - pad), Math.round(mmW + pad * 2), Math.round(mmH + pad * 2));
      this.minimapGfx.endFill();

      // Tiles
      const s = Math.max(Math.round(fit * 0.9), 1);
      const sHalf = Math.floor(s / 2);
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          const tileId = this.map.data[ty * W + tx];
          const tileDef = this.tileset ? this.tileset.tiles[String(tileId)] : null;
          const solid = tileDef ? tileDef.solid : true;
          this.minimapGfx.beginFill(solid ? 0x3a3a5a : 0x1a1a2e);
          this.minimapGfx.drawRect(isoX(tx, ty) - sHalf, isoY(tx, ty) - sHalf, s, s);
          this.minimapGfx.endFill();
        }
      }

      // Items
      if (this.state && this.state.items) {
        this.minimapGfx.beginFill(0xfdd835);
        for (const item of this.state.items) {
          const p = isoPx(item.x, item.y);
          this.minimapGfx.drawRect(p.x - dotSmall / 2, p.y - dotSmall / 2, dotSmall, dotSmall);
        }
        this.minimapGfx.endFill();
      }

      // Players
      if (this.state) {
        for (const player of this.state.players) {
          const p = isoPx(player.x, player.y);
          const isMe = player.id === this.myId;
          this.minimapGfx.beginFill(isMe ? 0xffffff : (playerColors[player.colorIndex] || 0xffffff));
          this.minimapGfx.drawRect(p.x - dotLarge / 2, p.y - dotLarge / 2, dotLarge, dotLarge);
          this.minimapGfx.endFill();
        }
      }

      // Monsters
      if (this.state && this.state.monsters) {
        this.minimapGfx.beginFill(0xe53935);
        for (const mob of this.state.monsters) {
          const p = isoPx(mob.x, mob.y);
          this.minimapGfx.drawRect(p.x - dotSmall / 2, p.y - dotSmall / 2, dotSmall, dotSmall);
        }
        this.minimapGfx.endFill();
      }

      // Quest objective pulsing dot
      if (this.questObjective) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
        const qp = isoPx(
          (this.questObjective.tileX + 0.5) * ts,
          (this.questObjective.tileY + 0.5) * ts
        );
        this.minimapGfx.beginFill(0xffa726, pulse);
        this.minimapGfx.drawCircle(qp.x, qp.y, questDotR);
        this.minimapGfx.endFill();
      }

      // Viewport circle at player position
      this.minimapGfx.lineStyle(1, 0xffffff, 0.3);
      const me = this.state ? this.state.players.find(p => p.id === this.myId) : null;
      if (me) {
        const p = isoPx(me.x, me.y);
        this.minimapGfx.drawCircle(p.x, p.y, full ? 8 : 4);
      }
    } else {
      // Standard top-down minimap
      let scale, mmX, mmY, mmW, mmH;
      if (full) {
        // Full map: fit to 80% of viewport, centered
        scale = Math.min((this.viewW * 0.8) / W, (this.viewH * 0.8) / H);
        mmW = W * scale;
        mmH = H * scale;
        mmX = (this.viewW - mmW) / 2;
        mmY = (this.viewH - mmH) / 2;
      } else {
        scale = 3;
        mmW = W * scale;
        mmH = H * scale;
        mmX = this.viewW - mmW - 10;
        mmY = 10;
      }

      this.minimapBounds = { x: mmX - 2, y: mmY - 2, w: mmW + 4, h: mmH + 4 };

      // Background (full overlay dims the whole screen)
      if (full) {
        this.minimapGfx.beginFill(0x000000, 0.7);
        this.minimapGfx.drawRect(0, 0, this.viewW, this.viewH);
        this.minimapGfx.endFill();
      }
      this.minimapGfx.beginFill(0x000000, 0.6);
      this.minimapGfx.drawRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
      this.minimapGfx.endFill();

      // Tiles
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          const tileId = this.map.data[ty * W + tx];
          const tileDef = this.tileset ? this.tileset.tiles[String(tileId)] : null;
          const solid = tileDef ? tileDef.solid : true;

          this.minimapGfx.beginFill(solid ? 0x3a3a5a : 0x1a1a2e);
          this.minimapGfx.drawRect(mmX + tx * scale, mmY + ty * scale, scale, scale);
          this.minimapGfx.endFill();
        }
      }

      // Items
      if (this.state && this.state.items) {
        this.minimapGfx.beginFill(0xfdd835);
        for (const item of this.state.items) {
          const dotX = Math.round(mmX + (item.x / ts) * scale);
          const dotY = Math.round(mmY + (item.y / ts) * scale);
          this.minimapGfx.drawRect(dotX - dotSmall / 2, dotY - dotSmall / 2, dotSmall, dotSmall);
        }
        this.minimapGfx.endFill();
      }

      // Players
      if (this.state) {
        for (const player of this.state.players) {
          const dotX = Math.round(mmX + (player.x / ts) * scale);
          const dotY = Math.round(mmY + (player.y / ts) * scale);
          const isMe = player.id === this.myId;
          this.minimapGfx.beginFill(isMe ? 0xffffff : (playerColors[player.colorIndex] || 0xffffff));
          this.minimapGfx.drawRect(dotX - dotLarge / 2, dotY - dotLarge / 2, dotLarge, dotLarge);
          this.minimapGfx.endFill();
        }
      }

      // Monsters
      if (this.state && this.state.monsters) {
        this.minimapGfx.beginFill(0xe53935);
        for (const mob of this.state.monsters) {
          const dotX = Math.round(mmX + (mob.x / ts) * scale);
          const dotY = Math.round(mmY + (mob.y / ts) * scale);
          this.minimapGfx.drawRect(dotX - dotSmall / 2, dotY - dotSmall / 2, dotSmall, dotSmall);
        }
        this.minimapGfx.endFill();
      }

      // Quest objective pulsing dot
      if (this.questObjective) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
        const qx = Math.round(mmX + this.questObjective.tileX * scale);
        const qy = Math.round(mmY + this.questObjective.tileY * scale);
        this.minimapGfx.beginFill(0xffa726, pulse);
        this.minimapGfx.drawCircle(qx, qy, questDotR);
        this.minimapGfx.endFill();
      }

      // Viewport rect
      this.minimapGfx.lineStyle(1, 0xffffff, 0.3);
      this.minimapGfx.drawRect(
        Math.round(mmX + (this.camX / ts) * scale),
        Math.round(mmY + (this.camY / ts) * scale),
        this.viewportTX * scale,
        this.viewportTY * scale
      );
    }
  }

  // --- Quest arrow (off-screen indicator) ---

  renderQuestArrow() {
    this.questArrowGfx.clear();
    if (!this.questObjective || !this.state) return;

    const ts = CONSTANTS.TILE_SIZE;
    const me = this.state.players.find(p => p.id === this.myId);
    if (!me) return;

    // Target position in world pixels
    const targetWX = (this.questObjective.tileX + 0.5) * ts;
    const targetWY = (this.questObjective.tileY + 0.5) * ts;

    // Target position in screen pixels
    let screenX, screenY;
    if (this.isoMode) {
      const iso = this.worldToIso(targetWX, targetWY);
      screenX = iso.x - this.camX;
      screenY = iso.y - this.camY;
    } else {
      screenX = targetWX - this.camX;
      screenY = targetWY - this.camY;
    }

    const margin = 40;
    const onScreen = screenX >= margin && screenX <= this.viewW - margin &&
                     screenY >= margin && screenY <= this.viewH - margin;

    // Pulsing alpha
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);

    if (onScreen) {
      // Draw a small yellow arrow pointing down at the target from above
      const bobOffset = 4 * Math.sin(Date.now() / 250); // gentle bobbing
      const arrowTipY = screenY - ts * 0.8 + bobOffset;
      const arrowTipX = screenX;
      const arrowSize = 8;

      this.questArrowGfx.beginFill(0xffa726, pulse);
      // Downward-pointing triangle
      this.questArrowGfx.moveTo(arrowTipX, arrowTipY + arrowSize); // tip (bottom)
      this.questArrowGfx.lineTo(arrowTipX - arrowSize * 0.7, arrowTipY - arrowSize * 0.3);
      this.questArrowGfx.lineTo(arrowTipX + arrowSize * 0.7, arrowTipY - arrowSize * 0.3);
      this.questArrowGfx.closePath();
      this.questArrowGfx.endFill();
      return;
    }

    // Clamp to screen edge
    const cx = this.viewW / 2;
    const cy = this.viewH / 2;
    const dx = screenX - cx;
    const dy = screenY - cy;
    const angle = Math.atan2(dy, dx);

    // Find edge intersection
    const edgeMargin = 30;
    const halfW = this.viewW / 2 - edgeMargin;
    const halfH = this.viewH / 2 - edgeMargin;
    const scale = Math.min(
      Math.abs(halfW / (dx || 0.001)),
      Math.abs(halfH / (dy || 0.001))
    );
    const arrowX = cx + dx * scale;
    const arrowY = cy + dy * scale;

    // Draw triangle pointing toward objective
    this.questArrowGfx.beginFill(0xffa726, pulse);
    const size = 10;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.questArrowGfx.moveTo(arrowX + cos * size, arrowY + sin * size);
    this.questArrowGfx.lineTo(arrowX + (-sin * size * 0.6 - cos * size * 0.5), arrowY + (cos * size * 0.6 - sin * size * 0.5));
    this.questArrowGfx.lineTo(arrowX + (sin * size * 0.6 - cos * size * 0.5), arrowY + (-cos * size * 0.6 - sin * size * 0.5));
    this.questArrowGfx.closePath();
    this.questArrowGfx.endFill();
  }

  // --- Speech bubbles ---

  showSpeechBubble(npcId, lines) {
    this.closeSpeechBubble();
    this.speechBubble = { npcId, lines, index: 0 };
    this._buildSpeechBubble();
  }

  advanceSpeechBubble() {
    if (!this.speechBubble) return false;
    this.speechBubble.index++;
    if (this.speechBubble.index >= this.speechBubble.lines.length) {
      this.closeSpeechBubble();
      return false;
    }
    this._buildSpeechBubble();
    return true;
  }

  closeSpeechBubble() {
    if (!this.speechBubble) return;
    this.speechBubble = null;
    if (this.speechBubbleContainer) {
      this.speechBubbleContainer.removeChildren();
      this.speechBubbleContainer.visible = false;
    }
  }

  _buildSpeechBubble() {
    if (!this.speechBubble || !this.speechBubbleContainer) return;
    this.speechBubbleContainer.removeChildren();

    const line = this.speechBubble.lines[this.speechBubble.index];
    if (!line) return;

    const maxW = 220;
    const pad = 10;
    const isMobile = ('ontouchstart' in window);

    // Speaker name
    const speakerText = new PIXI.Text(line.speaker || '', {
      fontFamily: 'Courier New',
      fontSize: 11,
      fill: '#64b5f6',
      fontWeight: 'bold',
    });

    // Message text with word wrap
    const msgText = new PIXI.Text(line.text || '', {
      fontFamily: 'Courier New',
      fontSize: 12,
      fill: '#dddddd',
      wordWrap: true,
      wordWrapWidth: maxW - pad * 2,
      lineHeight: 16,
    });

    // Prompt hint
    const hintLabel = isMobile ? 'Tap to continue' : '[E] Continue';
    const hintText = new PIXI.Text(hintLabel, {
      fontFamily: 'Courier New',
      fontSize: 9,
      fill: '#777777',
    });

    // Layout
    const speakerH = line.speaker ? speakerText.height + 4 : 0;
    const contentH = speakerH + msgText.height + 6 + hintText.height;
    const bubbleW = Math.min(maxW, Math.max(speakerText.width, msgText.width, hintText.width) + pad * 2);
    const bubbleH = contentH + pad * 2;

    // Background
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0a0a1a, 0.92);
    bg.lineStyle(2, 0x64b5f6, 0.8);
    bg.drawRoundedRect(0, 0, bubbleW, bubbleH, 6);
    bg.endFill();

    // Tail triangle
    bg.beginFill(0x0a0a1a, 0.92);
    bg.lineStyle(0);
    const tailX = bubbleW / 2;
    bg.moveTo(tailX - 6, bubbleH);
    bg.lineTo(tailX, bubbleH + 8);
    bg.lineTo(tailX + 6, bubbleH);
    bg.closePath();
    bg.endFill();
    // Tail border lines
    bg.lineStyle(2, 0x64b5f6, 0.8);
    bg.moveTo(tailX - 6, bubbleH);
    bg.lineTo(tailX, bubbleH + 8);
    bg.lineTo(tailX + 6, bubbleH);

    this.speechBubbleContainer.addChild(bg);

    let yOff = pad;
    if (line.speaker) {
      speakerText.x = pad;
      speakerText.y = yOff;
      this.speechBubbleContainer.addChild(speakerText);
      yOff += speakerText.height + 4;
    }

    msgText.x = pad;
    msgText.y = yOff;
    this.speechBubbleContainer.addChild(msgText);
    yOff += msgText.height + 6;

    hintText.x = bubbleW - pad - hintText.width;
    hintText.y = yOff;
    this.speechBubbleContainer.addChild(hintText);

    this.speechBubbleContainer.visible = true;

    // Store dimensions for positioning
    this.speechBubble._bubbleW = bubbleW;
    this.speechBubble._bubbleH = bubbleH + 8; // include tail
  }

  renderSpeechBubble() {
    if (!this.speechBubble || !this.speechBubbleContainer || !this.speechBubbleContainer.visible) return;

    const npcId = this.speechBubble.npcId;

    // Find the NPC in current state
    let npc = null;
    if (this.state && this.state.npcs) {
      npc = this.state.npcs.find(n => n.id === npcId);
    }

    // NPC gone — close bubble
    if (!npc) {
      this.closeSpeechBubble();
      return;
    }

    const bubbleW = this.speechBubble._bubbleW || 200;
    const bubbleH = this.speechBubble._bubbleH || 60;

    // Convert NPC world position to screen coords
    const screen = this._worldToScreen(npc.x, npc.y);
    const npcScreenX = screen.x;
    const npcScreenY = screen.y;

    // Place above NPC
    let bx = npcScreenX - bubbleW / 2;
    let by = npcScreenY - CONSTANTS.PLAYER_RADIUS - 10 - bubbleH;

    // If off top, place below instead
    if (by < 4) {
      by = npcScreenY + CONSTANTS.PLAYER_RADIUS + 10;
    }

    // Clamp X to viewport
    bx = Math.max(4, Math.min(bx, this.viewW - bubbleW - 4));

    this.speechBubbleContainer.x = Math.round(bx);
    this.speechBubbleContainer.y = Math.round(by);
  }

  // --- Lighting system ---

  _initLighting() {
    this._lightRT = PIXI.RenderTexture.create({ width: this.viewW, height: this.viewH });
    this._lightingSprite = new PIXI.Sprite(this._lightRT);
    // Insert between worldContainer/coneGfx and overlayContainer
    const idx = this.app.stage.getChildIndex(this.overlayContainer);
    this.app.stage.addChildAt(this._lightingSprite, idx);
    this._lightingSprite.visible = false;

    // Internal container for compositing darkness + lights
    this._lightContainer = new PIXI.Container();
    this._darkOverlay = new PIXI.Graphics();
    this._lightContainer.addChild(this._darkOverlay);

    // Build radial gradient texture for light sources
    this._buildLightGradient();
  }

  _buildLightGradient() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1.0)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(0.75, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    this._lightGradientTex = PIXI.Texture.from(canvas);
  }

  _getLightSource(index) {
    while (this._lightSources.length <= index) {
      const sprite = new PIXI.Sprite(this._lightGradientTex);
      sprite.blendMode = PIXI.BLEND_MODES.ERASE;
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      this._lightContainer.addChild(sprite);
      this._lightSources.push(sprite);
    }
    return this._lightSources[index];
  }

  renderLighting() {
    if (this.ambientLight >= 1.0) {
      if (this._lightingSprite) this._lightingSprite.visible = false;
      return;
    }

    if (!this._lightRT) this._initLighting();

    // Resize RT if viewport changed
    if (this._lightRT.width !== this.viewW || this._lightRT.height !== this.viewH) {
      this._lightRT.resize(this.viewW, this.viewH);
    }

    this._lightingSprite.visible = true;

    // Draw darkness overlay
    const darkness = 1.0 - this.ambientLight;
    this._darkOverlay.clear();
    this._darkOverlay.beginFill(0x050510, darkness);
    this._darkOverlay.drawRect(0, 0, this.viewW, this.viewH);
    this._darkOverlay.endFill();

    // Add light sources for each player with sol unit
    let lightIdx = 0;
    const lightRadius = 6 * (this.isoMode ? CONSTANTS.ISO_DIAMOND_W * 0.55 : CONSTANTS.TILE_SIZE);

    if (this.state && this.state.players) {
      for (const player of this.state.players) {
        if (player.maxEnergy <= 0) continue;

        const screen = this._worldToScreen(player.x, player.y);
        const light = this._getLightSource(lightIdx++);
        light.visible = true;

        // Subtle pulsing based on energy level
        const pulse = 1 + 0.03 * Math.sin(Date.now() / 800);
        const energyFraction = player.energy / player.maxEnergy;
        // Light dims slightly as energy depletes (min 70% radius)
        const radiusMult = 0.7 + 0.3 * energyFraction;

        light.x = screen.x;
        light.y = screen.y;
        light.width = lightRadius * 2 * pulse * radiusMult;
        light.height = lightRadius * 2 * pulse * radiusMult;
      }
    }

    // Hide unused light sources
    for (let i = lightIdx; i < this._lightSources.length; i++) {
      this._lightSources[i].visible = false;
    }

    // Render to texture
    this.app.renderer.render(this._lightContainer, { renderTexture: this._lightRT, clear: true });
  }
}
