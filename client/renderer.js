// Renderer - draws the game world using PixiJS
// Retained-mode: create display objects once, update properties each frame.

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // Isometric mode
    this.isoMode = true;

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
    this.tileSprites = [];        // flat array of PIXI.Sprite for visible area
    this.tileRows = 0;
    this.tileCols = 0;

    // Tileset texture references
    this.tileTextures = {};       // tileId -> PIXI.Texture (region of sprite sheet)
    this.tilesetLoaded = false;

    // Iso tile textures
    this.isoTileTextures = {};    // 'floor'|'wall'|'door'|'water' -> PIXI.Texture
    this.isoTileLoaded = false;
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

    // Damage number containers
    this.dmgContainer = null;

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

  _buildIsoTileTextures() {
    const dw = CONSTANTS.ISO_DIAMOND_W;
    const dh = CONSTANTS.ISO_DIAMOND_H;
    const wallRise = CONSTANTS.ISO_WALL_RISE;
    const hw = dw / 2;
    const hh = dh / 2;

    // --- Floor tile ---
    this.isoTileTextures['floor'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = '#2a2a3d';
      ctx.fill();
      // Subtle edge highlight
      this._drawDiamond(ctx, hw, hh, hw - 1, hh - 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // --- Floor2 (cracked) ---
    this.isoTileTextures['floor2'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = '#2a2a3d';
      ctx.fill();
      // Crack lines
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw - 10, hh - 3);
      ctx.lineTo(hw + 5, hh + 5);
      ctx.moveTo(hw + 8, hh - 6);
      ctx.lineTo(hw - 4, hh + 4);
      ctx.stroke();
      // Edge highlight
      this._drawDiamond(ctx, hw, hh, hw - 1, hh - 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.stroke();
    });

    // --- Water ---
    this.isoTileTextures['water'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = '#1a3a6a';
      ctx.fill();
      // Wave lines
      ctx.strokeStyle = 'rgba(100,180,255,0.3)';
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

    // --- Stairs down (purple) ---
    this.isoTileTextures['stairs_down'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = '#4a2a6a';
      ctx.fill();
      // Step lines
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        const y = hh + i * 5;
        const xSpan = hw * (1 - Math.abs(i) * 0.25);
        ctx.beginPath();
        ctx.moveTo(hw - xSpan * 0.6, y);
        ctx.lineTo(hw + xSpan * 0.6, y);
        ctx.stroke();
      }
      // Down chevron
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hw - 8, hh - 4);
      ctx.lineTo(hw, hh + 4);
      ctx.lineTo(hw + 8, hh - 4);
      ctx.stroke();
    });

    // --- Stairs up (teal) ---
    this.isoTileTextures['stairs_up'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      ctx.fillStyle = '#2a6a4a';
      ctx.fill();
      // Step lines
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        const y = hh + i * 5;
        const xSpan = hw * (1 - Math.abs(i) * 0.25);
        ctx.beginPath();
        ctx.moveTo(hw - xSpan * 0.6, y);
        ctx.lineTo(hw + xSpan * 0.6, y);
        ctx.stroke();
      }
      // Up chevron
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
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
      ctx.fillStyle = '#4a3a2a';
      ctx.fill();
      // Frame edges
      ctx.strokeStyle = 'rgba(180,140,80,0.4)';
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

    // --- Wall (3D block: 96 x (48 + wallRise)) ---
    const wallH = dh + wallRise;
    this.isoTileTextures['wall'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      // Top diamond face
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = '#5a5a7a';
      ctx.fill();

      // Left face
      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = '#4a4a6a';
      ctx.fill();

      // Right face
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.closePath();
      ctx.fillStyle = '#3a3a5a';
      ctx.fill();

      // Edge lines
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
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

    // --- Door closed (3D block, wood colors) ---
    this.isoTileTextures['door_closed'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      // Top face
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = '#8b7a50';
      ctx.fill();

      // Left face
      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = '#7a6a40';
      ctx.fill();

      // Right face
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.closePath();
      ctx.fillStyle = '#6a5a30';
      ctx.fill();

      // Arch detail on front face
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hw, dh + wallRise * 0.3, wallRise * 0.35, Math.PI, 0);
      ctx.stroke();

      // Edge lines
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.stroke();
    });

    // --- Locked door (darker door + lock indicator) ---
    this.isoTileTextures['locked_door'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      // Top face
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = '#6a5a3a';
      ctx.fill();

      // Left face
      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = '#5a4a2a';
      ctx.fill();

      // Right face
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.closePath();
      ctx.fillStyle = '#4a3a1a';
      ctx.fill();

      // Arch detail
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hw, dh + wallRise * 0.3, wallRise * 0.35, Math.PI, 0);
      ctx.stroke();

      // Lock rectangle
      ctx.fillStyle = 'rgba(200,160,60,0.6)';
      ctx.fillRect(hw - 4, dh + wallRise * 0.4, 8, 8);
      ctx.strokeStyle = 'rgba(255,220,100,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hw - 4, dh + wallRise * 0.4, 8, 8);

      // Edge lines
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.stroke();
    });

    // Map tile names to iso keys (each type gets its own)
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
    };

    this.isoTileLoaded = true;
  }

  // --- Public API (same as before) ---

  resizeToFit(availW, availH) {
    if (this.isoMode) {
      // In iso mode, use available screen space directly
      this.viewW = Math.max(640, Math.min(Math.floor(availW), 1920));
      this.viewH = Math.max(480, Math.min(Math.floor(availH), 1080));

      if (this.app) {
        this.app.renderer.resize(this.viewW, this.viewH);
      }

      this.canvas.style.width = `${this.viewW}px`;
      this.canvas.style.height = `${this.viewH}px`;

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
    this.buildTileColors();
    this.tilesetLoaded = false;
    this.tileTextures = {};
    this._buildTileTextures();
    if (this.isoMode && !this.isoTileLoaded) {
      this._buildIsoTileTextures();
    }
    this._rebuildTilePool();
  }

  buildTileColors() {
    if (!this.tileset) return;
    const colorMap = {
      'stone_floor':   0x2a2a3d,
      'cracked_floor': 0x332a3d,
      'stone_wall':    0x5a5a7a,
      'door_closed':   0x7a6a4a,
      'door_open':     0x4a3a2a,
      'stairs_down':   0x6a3a8a,
      'stairs_up':     0x3a8a6a,
      'water':         0x2a4a6a,
      'void':          0x0d0d1a,
    };
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

    // Remove old tile sprites
    this.tileContainer.removeChildren();
    this.tileSprites = [];

    if (this.isoMode) {
      // In iso mode, allocate enough sprites for entire map (maps are small, ~960 tiles max)
      const count = this.map ? this.map.width * this.map.height : 600;
      for (let i = 0; i < count; i++) {
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.visible = false;
        this.tileContainer.addChild(sprite);
        this.tileSprites.push(sprite);
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
    this.renderPlayers();
    this.renderDoorPrompts();
    this.renderDamageNumbers();
    this.renderMinimap();
    this.renderSpeechBubble();

    // Y-sort the entity container
    this.entityContainer.sortChildren();

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
      const padY = CONSTANTS.ISO_DIAMOND_H + CONSTANTS.ISO_WALL_RISE;

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
    const wallRise = CONSTANTS.ISO_WALL_RISE;

    // Wall-type iso keys
    const wallKeys = new Set(['wall', 'door_closed', 'locked_door']);

    // Viewport culling bounds in iso screen space (with padding)
    const cullL = this.camX - dw;
    const cullR = this.camX + this.viewW + dw;
    const cullT = this.camY - dh - wallRise;
    const cullB = this.camY + this.viewH + dh + wallRise;

    let idx = 0;
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

        if (idx >= this.tileSprites.length) break;
        const sprite = this.tileSprites[idx++];

        const tileId = String(this.map.data[ty * w + tx]);
        const tileDef = this.tileset ? this.tileset.tiles[tileId] : null;
        const tileName = tileDef ? tileDef.name : 'void';
        const isoKey = this.tileToIsoKey[tileName] || 'wall';
        const isWall = wallKeys.has(isoKey);

        sprite.visible = true;
        sprite.tint = 0xffffff;

        if (this.isoTileLoaded && this.isoTileTextures[isoKey]) {
          sprite.texture = this.isoTileTextures[isoKey];
        } else {
          sprite.texture = PIXI.Texture.WHITE;
          sprite.tint = this.tileColors[tileId] !== undefined ? this.tileColors[tileId] : 0xff00ff;
        }

        if (isWall) {
          // Wall-type: anchor at bottom-center, size = dw x (dh + wallRise)
          sprite.anchor.set(0.5, 1.0);
          sprite.width = dw;
          sprite.height = dh + wallRise;
          sprite.x = iso.x;
          sprite.y = iso.y + dh / 2;
        } else {
          // Floor-type: anchor at center, size = dw x dh
          sprite.anchor.set(0.5, 0.5);
          sprite.width = dw;
          sprite.height = dh;
          sprite.x = iso.x;
          sprite.y = iso.y;
        }
      }
    }

    // Hide remaining sprites
    while (idx < this.tileSprites.length) {
      this.tileSprites[idx++].visible = false;
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
      return true;
    }
    // Texture is loading — use fallback (white square tinted)
    sprite.texture = PIXI.Texture.WHITE;
    sprite.width = fallbackSize || 20;
    sprite.height = fallbackSize || 20;
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
          promptText.y = 12;
          promptText.alpha = 0.5 + 0.3 * pulse;
          promptText.visible = true;

          extraText.text = item.name;
          const rarityHex = CONSTANTS.RARITY_COLORS[item.rarity] || '#ffffff';
          extraText.style.fill = rarityHex;
          extraText.y = 24;
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

      // Name tag
      nameTag.text = npc.name;
      nameTag.style.fill = '#64b5f6';
      nameTag.y = -r - 6;
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
          promptText.y = r + 4;
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
      }

      // Name tag
      nameTag.text = mob.name;
      nameTag.style.fill = '#e57373';
      nameTag.y = -r - 6;
      nameTag.visible = true;

      // Health bar
      const hp = mob.health / mob.maxHealth;
      const barColor = hp > 0.5 ? 0xe53935 : 0xff6f00;
      this._drawHealthBar(healthBg, healthFill, 0, -r - 4, 26, 3, hp, barColor);

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

      // Name tag
      nameTag.text = player.name;
      nameTag.style.fill = isMe ? '#ffffff' : 'rgba(255,255,255,0.7)';
      nameTag.y = -r - 6;
      nameTag.visible = true;

      // Health bar
      if (player.health < player.maxHealth || isMe) {
        const healthPct = player.health / player.maxHealth;
        const barColor = healthPct > 0.5 ? 0x4caf50 : healthPct > 0.25 ? 0xffa726 : 0xe53935;
        this._drawHealthBar(healthBg, healthFill, 0, -r - 4, 30, 4, healthPct, barColor);
      } else {
        healthBg.clear();
        healthFill.clear();
      }

      // Weapon indicator
      if (!entry.weaponGfx) {
        entry.weaponGfx = new PIXI.Graphics();
        container.addChild(entry.weaponGfx);
      }
      entry.weaponGfx.clear();
      if (player.weapon) {
        const wLen = r + 10;
        const wBaseX = Math.cos(player.facing) * (r - 2);
        const wBaseY = Math.sin(player.facing) * (r - 2);
        const wTipX = Math.cos(player.facing) * wLen;
        const wTipY = Math.sin(player.facing) * wLen;
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

      // "You" indicator
      if (!entry.youIndicator) {
        entry.youIndicator = new PIXI.Graphics();
        container.addChild(entry.youIndicator);
      }
      entry.youIndicator.clear();
      if (isMe) {
        entry.youIndicator.lineStyle(1, 0xffffff, 0.4);
        entry.youIndicator.drawCircle(0, 0, r + 6);
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

  renderMinimap() {
    this.minimapGfx.clear();
    if (!this.map) return;

    const ts = CONSTANTS.TILE_SIZE;
    const W = this.map.width;
    const H = this.map.height;

    if (this.isoMode) {
      // Iso minimap: project tile coords through iso transform
      const projW = W - 1 + H - 1;          // horizontal range of (tx - ty)
      const projH = (W - 1 + H - 1) / 2;    // vertical range of (tx + ty)/2
      const pad = 4;
      const fit = Math.min(150 / (projW || 1), 150 / (projH || 1));
      const mmW = projW * fit;
      const mmH = projH * fit;
      const mmX = this.viewW - mmW - 10 - pad;
      const mmY = 10 + pad;

      // project tile coords to minimap pixel coords
      const isoX = (tx, ty) => mmX + (tx - ty + (H - 1)) * fit;
      const isoY = (tx, ty) => mmY + (tx + ty) * 0.5 * fit;
      // project world-pixel coords
      const isoPx = (wx, wy) => {
        const ftx = wx / ts, fty = wy / ts;
        return { x: mmX + (ftx - fty + (H - 1)) * fit, y: mmY + (ftx + fty) * 0.5 * fit };
      };

      // Background
      this.minimapGfx.beginFill(0x000000, 0.6);
      this.minimapGfx.drawRect(mmX - pad, mmY - pad, mmW + pad * 2, mmH + pad * 2);
      this.minimapGfx.endFill();

      // Tiles
      const s = Math.max(fit * 0.9, 1);
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          const tileId = this.map.data[ty * W + tx];
          const tileDef = this.tileset ? this.tileset.tiles[String(tileId)] : null;
          const solid = tileDef ? tileDef.solid : true;
          this.minimapGfx.beginFill(solid ? 0x3a3a5a : 0x1a1a2e);
          this.minimapGfx.drawRect(isoX(tx, ty) - s / 2, isoY(tx, ty) - s / 2, s, s);
          this.minimapGfx.endFill();
        }
      }

      // Items
      if (this.state && this.state.items) {
        this.minimapGfx.beginFill(0xfdd835);
        for (const item of this.state.items) {
          const p = isoPx(item.x, item.y);
          this.minimapGfx.drawRect(p.x - 1, p.y - 1, 2, 2);
        }
        this.minimapGfx.endFill();
      }

      // Players
      if (this.state) {
        for (const player of this.state.players) {
          const p = isoPx(player.x, player.y);
          const isMe = player.id === this.myId;
          const playerColors = [0x4fc3f7, 0xef5350, 0x66bb6a, 0xffa726];
          this.minimapGfx.beginFill(isMe ? 0xffffff : (playerColors[player.colorIndex] || 0xffffff));
          this.minimapGfx.drawRect(p.x - 1, p.y - 1, 3, 3);
          this.minimapGfx.endFill();
        }
      }

      // Monsters
      if (this.state && this.state.monsters) {
        this.minimapGfx.beginFill(0xe53935);
        for (const mob of this.state.monsters) {
          const p = isoPx(mob.x, mob.y);
          this.minimapGfx.drawRect(p.x - 1, p.y - 1, 2, 2);
        }
        this.minimapGfx.endFill();
      }

      // Viewport circle at player position
      this.minimapGfx.lineStyle(1, 0xffffff, 0.3);
      const me = this.state ? this.state.players.find(p => p.id === this.myId) : null;
      if (me) {
        const p = isoPx(me.x, me.y);
        this.minimapGfx.drawCircle(p.x, p.y, 4);
      }
    } else {
      // Standard top-down minimap
      const scale = 3;
      const mmW = W * scale;
      const mmH = H * scale;
      const mmX = this.viewW - mmW - 10;
      const mmY = 10;

      // Background
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
          const dotX = mmX + (item.x / ts) * scale;
          const dotY = mmY + (item.y / ts) * scale;
          this.minimapGfx.drawRect(dotX - 1, dotY - 1, 2, 2);
        }
        this.minimapGfx.endFill();
      }

      // Players
      if (this.state) {
        for (const player of this.state.players) {
          const dotX = mmX + (player.x / ts) * scale;
          const dotY = mmY + (player.y / ts) * scale;
          const isMe = player.id === this.myId;
          const playerColors = [0x4fc3f7, 0xef5350, 0x66bb6a, 0xffa726];
          this.minimapGfx.beginFill(isMe ? 0xffffff : (playerColors[player.colorIndex] || 0xffffff));
          this.minimapGfx.drawRect(dotX - 1, dotY - 1, 3, 3);
          this.minimapGfx.endFill();
        }
      }

      // Monsters
      if (this.state && this.state.monsters) {
        this.minimapGfx.beginFill(0xe53935);
        for (const mob of this.state.monsters) {
          const dotX = mmX + (mob.x / ts) * scale;
          const dotY = mmY + (mob.y / ts) * scale;
          this.minimapGfx.drawRect(dotX - 1, dotY - 1, 2, 2);
        }
        this.minimapGfx.endFill();
      }

      // Viewport rect
      this.minimapGfx.lineStyle(1, 0xffffff, 0.3);
      this.minimapGfx.drawRect(
        mmX + (this.camX / ts) * scale,
        mmY + (this.camY / ts) * scale,
        this.viewportTX * scale,
        this.viewportTY * scale
      );
    }
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
}
