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

    // Hit flash: map of entityId -> remaining flash time (seconds)
    this.hitFlashes = new Map();

    // Screen shake state
    this.screenShake = { intensity: 0, duration: 0, elapsed: 0 };

    // Death animations: array of { x, y, type, age, maxAge, sprite container }
    this.deathAnims = [];

    // Ambush reveal fade-in: map of mobId -> remaining fade time
    this.ambushFadeIns = new Map();

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
    this.elevBand = 2000; // depth sorting band per elevation level (recomputed in setMap)
    this.tileToIsoKey = {};       // tile name -> iso key

    // Entity sprite pools: id -> { container, sprite, nameTag, healthBar, ... }
    this.playerSprites = new Map();
    this.monsterSprites = new Map();
    this.npcSprites = new Map();
    this.itemSprites = new Map();
    this.projectileSprites = new Map();
    this.sentrySprites = new Map();
    this.beamObjectSprites = new Map();
    this.extractionPointSprites = new Map();

    // Sprite texture cache: path -> PIXI.Texture
    this.textureCache = {};

    // Chunk-based fog of war
    this.chunked = false;       // true when using chunk streaming
    this.chunkCols = 0;
    this.chunkRows = 0;
    this.revealedChunks = null; // Uint8Array, 1 = revealed

    // Minimap graphics
    this.minimapGfx = null;
    this.fullMap = false;
    this.minimapBounds = null; // { x, y, w, h } in canvas coords for click detection

    // Damage number containers
    this.dmgContainer = null;

    // Cone effect visuals
    this.coneEffects = [];
    this.coneGfx = null;

    // Melee slash effect visuals
    this.meleeEffects = [];
    this.meleeGfx = null;

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

    // Boss phase transition effects (screen-space particle bursts)
    this.bossPhaseEffects = [];
    // Track last known boss phase to detect transitions
    this.lastBossPhase = null;

    // Boss intro cinematic state
    this.bossIntro = null; // { bossName, x, y, elapsed, duration, phase }

    // Siege lighthouse rendering state
    this.lighthouseSprite = null;  // PIXI.Container for lighthouse entity
    this.siegeAnnouncements = [];  // floating center-screen text announcements

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

    // Melee slash effect graphics
    this.meleeGfx = new PIXI.Graphics();
    this.worldContainer.addChild(this.meleeGfx);

    // Sentry beam graphics
    this.sentryBeamGfx = new PIXI.Graphics();
    this.worldContainer.addChild(this.sentryBeamGfx);
    this.sentryPulseTime = 0;

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

    this.roomNameText = new PIXI.Text('', {
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0xffffff,
      align: 'center',
    });
    this.roomNameText.anchor.set(0.5, 1);
    this.roomNameText.visible = false;
    this.overlayContainer.addChild(this.roomNameText);

    this.dmgContainer = new PIXI.Container();
    this.overlayContainer.addChild(this.dmgContainer);

    this.speechBubbleContainer = new PIXI.Container();
    this.speechBubbleContainer.visible = false;
    this.overlayContainer.addChild(this.speechBubbleContainer);

    // Quest objective arrow overlay
    this.questArrowGfx = new PIXI.Graphics();
    this.overlayContainer.addChild(this.questArrowGfx);
    this.questObjective = null; // { label, tileX, tileY, sameRoom }
    this.secondaryQuestObjectives = null; // array of { label, tileX, tileY, sameRoom, targetLocationId }

    // Boss intro cinematic overlays
    this.bossIntroContainer = new PIXI.Container();
    this.bossIntroContainer.visible = false;
    this.overlayContainer.addChild(this.bossIntroContainer);

    this.bossIntroBarTop = new PIXI.Graphics();
    this.bossIntroContainer.addChild(this.bossIntroBarTop);
    this.bossIntroBarBottom = new PIXI.Graphics();
    this.bossIntroContainer.addChild(this.bossIntroBarBottom);

    this.bossIntroVignette = new PIXI.Graphics();
    this.bossIntroContainer.addChild(this.bossIntroVignette);

    this.bossIntroText = new PIXI.Text('', {
      fontFamily: 'Courier New',
      fontSize: 18,
      fontWeight: 'bold',
      fill: '#ffa726',
      align: 'center',
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowDistance: 2,
    });
    this.bossIntroText.anchor.set(0.5);
    this.bossIntroContainer.addChild(this.bossIntroText);

    this.bossIntroSubtitle = new PIXI.Text('', {
      fontFamily: 'Courier New',
      fontSize: 11,
      fill: '#b0bec5',
      align: 'center',
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowDistance: 1,
    });
    this.bossIntroSubtitle.anchor.set(0.5);
    this.bossIntroContainer.addChild(this.bossIntroSubtitle);

    // Quest waypoint label on minimap
    this.questWaypointText = new PIXI.Text('', {
      fontFamily: 'monospace',
      fontSize: 10,
      fill: 0xffa726,
      align: 'center',
      strokeThickness: 2,
      stroke: 0x000000,
    });
    this.questWaypointText.anchor.set(0.5, 1);
    this.questWaypointText.visible = false;
    this.overlayContainer.addChild(this.questWaypointText);

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

  // Load a 4-frame animation strip (64x16) and return array of frame textures.
  // Entity sprites are generated as horizontal strips: idle1, idle2, attack, hit.
  loadAnimFrames(spritePath) {
    const key = spritePath + '#frames';
    if (this.textureCache[key]) return this.textureCache[key];
    const baseTex = PIXI.BaseTexture.from('/content/' + spritePath);
    baseTex.scaleMode = PIXI.SCALE_MODES.NEAREST;
    const frames = [];
    for (let i = 0; i < 4; i++) {
      frames.push(new PIXI.Texture(baseTex, new PIXI.Rectangle(i * 16, 0, 16, 16)));
    }
    this.textureCache[key] = frames;
    return frames;
  }

  // Determine animation frame index for an entity.
  // Returns 0-3: 0=idle1, 1=idle2, 2=attack, 3=hit
  _getAnimFrame(entityId, isAttacking, isHit) {
    if (isHit) return 3;
    if (isAttacking) return 2;
    // Idle bob: alternate between frame 0 and 1 at ~2Hz.
    // Stagger by entity id so not all entities bob in sync.
    const idHash = typeof entityId === 'string'
      ? (entityId.charCodeAt(0) + (entityId.charCodeAt(1) || 0))
      : (entityId % 256);
    const t = Math.floor((Date.now() + idHash * 137) / 500);
    return t % 2;
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

  _positionEntity(container, wx, wy, elevation, hovering) {
    if (this.isoMode) {
      const iso = this.worldToIso(wx, wy);
      const elev = elevation || 0;
      const elevOffset = elev * CONSTANTS.ISO_WALL_RISE;
      const hoverOffset = hovering ? 12 : 0;
      container.x = iso.x;
      container.y = iso.y - elevOffset - hoverOffset;
      // Elevation depth sorting: each elevation level has two sub-bands
      // (floor tiles, then walls+entities). Entities go in the upper sub-band
      // so they always render on top of floor tiles at their level.
      const sortElev = hovering ? Math.floor(elev) + 1 : Math.floor(elev);
      container.zIndex = iso.y + sortElev * this.elevBand * 2 + this.elevBand;
      // Store hover offset for shadow positioning — shadow sits on the
      // surface at the entity's elevation, only separated by hover gap.
      container._shadowOffset = hoverOffset;
    } else {
      container.x = wx;
      container.y = wy;
      container.zIndex = wy;
      container._shadowOffset = 0;
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
      // Zone identity: Cold Gray, Slate Blue, Bone White — ancient, still, oppressive
      wallRise: 30,
      floor:      { fill: '#252535', edge: 'rgba(180,190,220,0.07)' },  // cool slate-blue tint
      floor2:     { fill: '#252535', crack: 'rgba(0,0,0,0.35)', edge: 'rgba(180,190,220,0.07)' },
      water:      { fill: '#1a3a6a', wave: 'rgba(100,210,180,0.25)' },  // cold teal wave (phosphorescent)
      stairsDown: { fill: '#20304a', step: 'rgba(100,210,180,0.18)', chevron: 'rgba(100,210,180,0.55)' },  // cold teal (eerie glow down)
      stairsUp:   { fill: '#252535', step: 'rgba(200,190,170,0.18)', chevron: 'rgba(200,190,170,0.55)' },  // bone-white (ascending to light)
      doorOpen:   { fill: '#1e2030', frame: 'rgba(100,210,180,0.3)' },   // cold teal frame (phosphorescent)
      wall:       { top: '#5a5a7a', left: '#4a4a6a', right: '#3a3a5a', edge: 'rgba(180,190,220,0.09)' },
      doorClosed: { top: '#5a6070', left: '#4a5060', right: '#3a4050', arch: 'rgba(100,210,180,0.18)', edge: 'rgba(180,190,220,0.1)' },  // cold iron (not brown wood)
      lockedDoor: { top: '#484e5e', left: '#383e4e', right: '#283040', arch: 'rgba(100,210,180,0.15)', lock: 'rgba(100,210,180,0.65)', lockEdge: 'rgba(150,240,210,0.45)', edge: 'rgba(180,190,220,0.08)' },  // cold teal lock
      chest:      { top: '#5a6a5a', left: '#4a5a4a', right: '#3a4a3a', band: 'rgba(120,140,120,0.4)', lock: 'rgba(240,200,80,0.7)', lockEdge: 'rgba(255,220,100,0.5)', edge: 'rgba(180,190,220,0.1)' },
      chestOpen:  { fill: '#3a4a3a', edge: 'rgba(120,140,120,0.5)', inner: 'rgba(0,0,0,0.3)' },
      minimap: {
        stone_floor: 0x252535, cracked_floor: 0x2e2a40, stone_wall: 0x5a5a7a, cracked_wall: 0x6a5a5a,
        door_closed: 0x5a6070, door_open: 0x1e2030, stairs_down: 0x204a5a,   // cold teal
        stairs_up: 0x3a3a55, water: 0x2a4a6a, void: 0x0d0d1a,               // bone-white stairs up
        chest_closed: 0x5a6a5a, chest_opened: 0x3a4a3a,
        elevated_floor: 0x2e2e50, ramp_north: 0x283848, ramp_south: 0x283848,
        ramp_east: 0x283848, ramp_west: 0x283848, full_wall: 0x6a6a9a,
        elevated_wall: 0x5a5a8a,
      },
    },
    outpost: {
      // Zone identity: Stone Gray, Brown, warm Orange (torchlight) — safe, worn, lived-in
      wallRise: 34,
      floor:      { fill: '#35332e', edge: 'rgba(255,180,80,0.06)' },    // warm orange edge tint
      floor2:     { fill: '#35332e', crack: 'rgba(80,50,20,0.3)', edge: 'rgba(255,180,80,0.06)' },  // brown scuff
      water:      { fill: '#252820', wave: 'rgba(120,160,80,0.2)' },     // oily drainage
      stairsDown: { fill: '#3a3020', step: 'rgba(255,160,50,0.2)', chevron: 'rgba(255,160,50,0.55)' },  // orange torchlight
      stairsUp:   { fill: '#3a3020', step: 'rgba(255,160,50,0.2)', chevron: 'rgba(255,160,50,0.55)' },  // orange torchlight
      doorOpen:   { fill: '#28241e', frame: 'rgba(200,140,60,0.4)' },    // warm orange frame
      wall:       { top: '#706860', left: '#605850', right: '#504840', edge: 'rgba(255,180,80,0.06)' },
      doorClosed: { top: '#6a5a48', left: '#5a4a38', right: '#4a3a28', arch: 'rgba(220,160,80,0.18)', edge: 'rgba(255,180,80,0.1)' },  // warm steel (not blue-gray)
      lockedDoor: { top: '#5a4a38', left: '#4a3a28', right: '#3a2a1a', arch: 'rgba(220,160,80,0.15)', lock: 'rgba(220,160,60,0.65)', lockEdge: 'rgba(255,200,80,0.45)', edge: 'rgba(255,180,80,0.08)' },  // warm steel with orange glow lock
      chest:      { top: '#5a5040', left: '#4a4030', right: '#3a3020', band: 'rgba(160,130,80,0.4)', lock: 'rgba(220,160,60,0.7)', lockEdge: 'rgba(255,200,80,0.5)', edge: 'rgba(255,180,80,0.1)' },
      chestOpen:  { fill: '#3a3025', edge: 'rgba(160,130,80,0.5)', inner: 'rgba(0,0,0,0.3)' },
      minimap: {
        stone_floor: 0x35332e, cracked_floor: 0x38352e, stone_wall: 0x706860, cracked_wall: 0x7a6050,
        door_closed: 0x6a5a48, door_open: 0x28241e, stairs_down: 0x5a3a18,  // warm steel door, orange stairs
        stairs_up: 0x5a3a18, water: 0x252820, void: 0x151412,
        chest_closed: 0x5a5040, chest_opened: 0x3a3025,
      },
    },
    quarantine: {
      // Zone identity: Gray-Green, Rust, warning Red — toxic, abandoned, decaying
      wallRise: 30,
      floor:      { fill: '#252e25', edge: 'rgba(160,220,100,0.06)' },
      floor2:     { fill: '#252e25', crack: 'rgba(130,70,30,0.35)', edge: 'rgba(160,220,100,0.06)' },  // rust-brown crack
      water:      { fill: '#162a14', wave: 'rgba(80,200,60,0.35)' },    // darker toxic waste
      stairsDown: { fill: '#2e1a1a', step: 'rgba(200,60,50,0.2)', chevron: 'rgba(200,60,50,0.5)' },   // warning red (deeper = more danger)
      stairsUp:   { fill: '#2a3a22', step: 'rgba(160,220,100,0.15)', chevron: 'rgba(160,220,100,0.4)' },  // contamination green (escape)
      doorOpen:   { fill: '#242018', frame: 'rgba(200,80,50,0.3)' },    // warning red frame (danger — was quarantine-sealed)
      wall:       { top: '#505545', left: '#404035', right: '#302e28', edge: 'rgba(160,220,100,0.06)' },  // rust-shifted midtones
      doorClosed: { top: '#8a6a30', left: '#7a5a25', right: '#6a4a1a', arch: 'rgba(200,70,50,0.25)', edge: 'rgba(200,70,50,0.15)' },  // warning red arch stripe
      lockedDoor: { top: '#6a4a25', left: '#5a3a1a', right: '#4a2a10', arch: 'rgba(200,60,50,0.25)', lock: 'rgba(200,60,50,0.7)', lockEdge: 'rgba(230,100,80,0.5)', edge: 'rgba(160,220,100,0.06)' },  // warning red lock
      chest:      { top: '#4a5a3a', left: '#3a4a2a', right: '#2a3a1a', band: 'rgba(120,90,50,0.4)', lock: 'rgba(200,60,50,0.7)', lockEdge: 'rgba(230,100,80,0.5)', edge: 'rgba(160,220,100,0.08)' },  // rust band, red lock
      chestOpen:  { fill: '#2a3a22', edge: 'rgba(100,140,80,0.5)', inner: 'rgba(0,0,0,0.35)' },
      minimap: {
        stone_floor: 0x252e25, cracked_floor: 0x302a22, stone_wall: 0x505545, cracked_wall: 0x604040,
        door_closed: 0x8a6a30, door_open: 0x242018, stairs_down: 0x5a1a1a,  // warning red stairs down
        stairs_up: 0x2a4a22, water: 0x162a14, void: 0x0d140d,
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
        stone_floor: 0x2a2828, cracked_floor: 0x2e2a28, stone_wall: 0x5a4a45, cracked_wall: 0x6a4a3a,
        door_closed: 0x6a5a48, door_open: 0x282420, stairs_down: 0x3a2830,
        stairs_up: 0x283830, water: 0x1a2028, void: 0x0a0a0a,
        chest_closed: 0x4a4a42, chest_opened: 0x2a2a25,
      },
    },
    dayside: {
      wallRise: 28,
      floor:      { fill: '#d4b896', edge: 'rgba(255,255,255,0.08)' },
      floor2:     { fill: '#c8a882', crack: 'rgba(180,140,80,0.3)', edge: 'rgba(255,255,255,0.08)' },
      water:      { fill: '#e8c060', wave: 'rgba(255,220,100,0.4)' },
      stairsDown: { fill: '#a08060', step: 'rgba(255,255,255,0.2)', chevron: 'rgba(255,255,255,0.5)' },
      stairsUp:   { fill: '#80a060', step: 'rgba(255,255,255,0.2)', chevron: 'rgba(255,255,255,0.5)' },
      doorOpen:   { fill: '#b09870', frame: 'rgba(200,180,140,0.5)' },
      wall:       { top: '#e0c8a0', left: '#c8b088', right: '#b09870', edge: 'rgba(255,255,255,0.1)' },
      doorClosed: { top: '#c0a070', left: '#a88858', right: '#907040', arch: 'rgba(255,255,255,0.2)', edge: 'rgba(255,255,255,0.12)' },
      lockedDoor: { top: '#a08858', left: '#887040', right: '#706030', arch: 'rgba(255,255,255,0.15)', lock: 'rgba(255,200,60,0.7)', lockEdge: 'rgba(255,230,100,0.5)', edge: 'rgba(255,255,255,0.1)' },
      chest:      { top: '#b0a080', left: '#988868', right: '#807050', band: 'rgba(180,160,120,0.4)', lock: 'rgba(255,200,60,0.8)', lockEdge: 'rgba(255,230,100,0.6)', edge: 'rgba(255,255,255,0.12)' },
      chestOpen:  { fill: '#a09070', edge: 'rgba(180,160,120,0.5)', inner: 'rgba(0,0,0,0.2)' },
      minimap: {
        stone_floor: 0xd4b896, cracked_floor: 0xc8a882, stone_wall: 0xe0c8a0, cracked_wall: 0xd0a880,
        door_closed: 0xc0a070, door_open: 0xb09870, stairs_down: 0xa08060,
        stairs_up: 0x80a060, water: 0xe8c060, void: 0x8a7050,
        chest_closed: 0xb0a080, chest_opened: 0xa09070,
      },
    },
    nightside: {
      wallRise: 32,
      floor:      { fill: '#1a1528', edge: 'rgba(140,100,220,0.05)' },
      floor2:     { fill: '#1e1830', crack: 'rgba(120,60,200,0.25)', edge: 'rgba(140,100,220,0.06)' },
      water:      { fill: '#0e0a1e', wave: 'rgba(100,60,180,0.3)' },
      stairsDown: { fill: '#2a1a3e', step: 'rgba(180,140,255,0.15)', chevron: 'rgba(180,140,255,0.4)' },
      stairsUp:   { fill: '#1a2e3a', step: 'rgba(140,200,220,0.15)', chevron: 'rgba(140,200,220,0.4)' },
      doorOpen:   { fill: '#1e1528', frame: 'rgba(140,80,220,0.35)' },
      wall:       { top: '#3a2a5a', left: '#2e2050', right: '#221840', edge: 'rgba(160,100,255,0.1)' },
      doorClosed: { top: '#4a3070', left: '#3e2660', right: '#321e50', arch: 'rgba(180,120,255,0.2)', edge: 'rgba(160,100,255,0.12)' },
      lockedDoor: { top: '#3a2660', left: '#2e1e50', right: '#221640', arch: 'rgba(180,120,255,0.15)', lock: 'rgba(180,100,255,0.6)', lockEdge: 'rgba(200,140,255,0.4)', edge: 'rgba(160,100,255,0.08)' },
      chest:      { top: '#2e2848', left: '#242040', right: '#1a1830', band: 'rgba(140,100,180,0.4)', lock: 'rgba(180,100,255,0.7)', lockEdge: 'rgba(200,140,255,0.5)', edge: 'rgba(160,100,255,0.1)' },
      chestOpen:  { fill: '#1a1830', edge: 'rgba(140,100,180,0.5)', inner: 'rgba(0,0,0,0.4)' },
      minimap: {
        dark_stone_floor: 0x1a1528, umbracite_floor: 0x241a3a, umbracite_vein_wall: 0x3a2a5a,
        crystal_door_closed: 0x4a3070, crystal_door_open: 0x1e1528, deep_stairs_down: 0x2a1a3e,
        deep_stairs_up: 0x1a2e3a, dark_pool: 0x0e0a1e, void: 0x08060e,
        chest_closed: 0x2e2848, chest_opened: 0x1a1830,
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

    // --- Cracked wall (destructible) ---
    this.isoTileTextures['cracked_wall'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      // Same base as wall
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = p.wall.top;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.wall.left;
      ctx.fill();

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

      // Crack lines on left face
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hw * 0.3, hh + wallRise * 0.2);
      ctx.lineTo(hw * 0.5, hh + wallRise * 0.5);
      ctx.lineTo(hw * 0.35, hh + wallRise * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hw * 0.5, hh + wallRise * 0.5);
      ctx.lineTo(hw * 0.7, hh + wallRise * 0.4);
      ctx.stroke();

      // Crack lines on right face
      ctx.beginPath();
      ctx.moveTo(hw + hw * 0.6, hh + wallRise * 0.15);
      ctx.lineTo(hw + hw * 0.4, hh + wallRise * 0.45);
      ctx.lineTo(hw + hw * 0.55, hh + wallRise * 0.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hw + hw * 0.4, hh + wallRise * 0.45);
      ctx.lineTo(hw + hw * 0.2, hh + wallRise * 0.55);
      ctx.stroke();

      // Crack on top face
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw * 0.7, hh * 0.5);
      ctx.lineTo(hw, hh * 0.7);
      ctx.lineTo(hw * 1.3, hh * 0.5);
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

    // --- Elevated floor (tinted differently) ---
    this.isoTileTextures['elevated_floor'] = this._createIsoTexture(dw, dh, (ctx, w, h) => {
      this._drawDiamond(ctx, hw, hh, hw, hh);
      const floorFill = p.floor.fill;
      // Lighten the floor color slightly for elevated tiles
      ctx.fillStyle = floorFill;
      ctx.fill();
      // Add a subtle highlight border to indicate elevation
      this._drawDiamond(ctx, hw, hh, hw - 1, hh - 1);
      ctx.strokeStyle = 'rgba(100,180,255,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Inner diamond highlight
      this._drawDiamond(ctx, hw, hh, hw - 4, hh - 4);
      ctx.strokeStyle = 'rgba(100,180,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // --- Ramp textures (4 directions) ---
    // Each ramp is a sloped surface from elevation 0 on one edge to
    // elevation 1 (wallRise) on the opposite edge.  The diamond corners
    // are: top=NW, right=NE, bottom=SE, left=SW in world orientation.
    // In iso coords: top(hw,0), right(dw,hh), bottom(hw,dh), left(0,hh).
    // "ramp_south" means ascending as you walk south (increasing Y),
    // so the north edge (top) is low and the south edge (bottom) is high.
    const rampDirs = ['north', 'south', 'east', 'west'];
    for (const dir of rampDirs) {
      this.isoTileTextures['ramp_' + dir] = this._createIsoTexture(dw, dh + wallRise, (ctx, w, h) => {
        // Corner heights (how much each corner rises above ground).
        // Iso diamond corners: top=NW, right=NE, bottom=SE, left=SW.
        // World directions map to iso: north=top-right, south=bottom-left,
        // east=bottom-right, west=top-left.
        let hTL, hTR, hBL, hBR; // top-left(W), top(NW), bottom(SE), right(NE) of iso diamond
        // top = (hw, 0), right = (dw, hh), bottom = (hw, dh), left = (0, hh)
        // NW corner = top, NE corner = right, SE corner = bottom, SW corner = left
        if (dir === 'north') {
          // Ascending north: south side low, north side high
          // SE(bottom) and SW(left) low, NE(right) and NW(top) high
          hTL = wallRise; hTR = wallRise; hBL = 0; hBR = 0;
        } else if (dir === 'south') {
          // Ascending south: north side low, south side high
          hTL = 0; hTR = 0; hBL = wallRise; hBR = wallRise;
        } else if (dir === 'east') {
          // Ascending east: west side low, east side high
          // NW(top) and SW(left) low, NE(right) and SE(bottom) high
          hTL = 0; hTR = wallRise; hBL = 0; hBR = wallRise;
        } else { // west
          // Ascending west: east side low, west side high
          hTL = wallRise; hTR = 0; hBL = wallRise; hBR = 0;
        }

        // The four iso diamond corners, offset down by wallRise so the
        // highest point sits at y=0 in the texture.
        const topX = hw,  topY = wallRise - hTL;     // NW corner
        const rtX  = dw,  rtY  = hh + wallRise - hTR; // NE corner
        const btX  = hw,  btY  = dh + wallRise - hBR; // SE corner
        const ltX  = 0,   ltY  = hh + wallRise - hBL; // SW corner

        // --- Sloped top face ---
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(rtX, rtY);
        ctx.lineTo(btX, btY);
        ctx.lineTo(ltX, ltY);
        ctx.closePath();
        ctx.fillStyle = p.stairsUp.fill;
        ctx.fill();

        // Subtle grid lines on slope surface to convey incline
        ctx.strokeStyle = p.stairsUp.step;
        ctx.lineWidth = 1;
        const steps = 5;
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          // Interpolate across the diamond in the ramp direction
          if (dir === 'north' || dir === 'south') {
            // Lines parallel to east-west axis (top-to-bottom interpolation)
            const lx = ltX + (topX - ltX) * t;
            const ly = ltY + (topY - ltY) * t;
            const rx = btX + (rtX - btX) * t;
            const ry = btY + (rtY - btY) * t;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(rx, ry);
            ctx.stroke();
          } else {
            // Lines parallel to north-south axis (left-to-right interpolation)
            const ux = topX + (rtX - topX) * t;
            const uy = topY + (rtY - topY) * t;
            const dx = ltX + (btX - ltX) * t;
            const dy = ltY + (btY - ltY) * t;
            ctx.beginPath();
            ctx.moveTo(ux, uy);
            ctx.lineTo(dx, dy);
            ctx.stroke();
          }
        }

        // Edge outline of top face
        ctx.strokeStyle = p.wall.edge;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(rtX, rtY);
        ctx.lineTo(btX, btY);
        ctx.lineTo(ltX, ltY);
        ctx.closePath();
        ctx.stroke();

        // --- Side faces (only draw where there is height above the base) ---
        const baseLeft = hh + wallRise;   // base Y for left corner (SW)
        const baseBottom = dh + wallRise;  // base Y for bottom corner (SE)
        const baseRight = hh + wallRise;   // base Y for right corner (NE)

        // Left side face (SW to SE edge, visible when bottom-left has height)
        if (hBL > 0 || hBR > 0) {
          ctx.beginPath();
          ctx.moveTo(ltX, ltY);
          ctx.lineTo(btX, btY);
          ctx.lineTo(btX, baseBottom);
          ctx.lineTo(ltX, baseLeft);
          ctx.closePath();
          ctx.fillStyle = p.wall.left;
          ctx.fill();
          ctx.strokeStyle = p.wall.edge;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Right side face (SE to NE edge, visible when bottom-right has height)
        if (hBR > 0 || hTR > 0) {
          ctx.beginPath();
          ctx.moveTo(btX, btY);
          ctx.lineTo(rtX, rtY);
          ctx.lineTo(rtX, baseRight);
          ctx.lineTo(btX, baseBottom);
          ctx.closePath();
          ctx.fillStyle = p.wall.right;
          ctx.fill();
          ctx.strokeStyle = p.wall.edge;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    }

    // --- Full wall (taller, blocks all levels) ---
    const fullWallH = dh + wallRise * 4;
    this.isoTileTextures['full_wall'] = this._createIsoTexture(dw, fullWallH, (ctx, w, h) => {
      const rise = wallRise * 4;
      // Top diamond face
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = p.wall.top;
      ctx.fill();

      // Left face (taller)
      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + rise);
      ctx.lineTo(0, hh + rise);
      ctx.closePath();
      ctx.fillStyle = p.wall.left;
      ctx.fill();

      // Right face (taller)
      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + rise);
      ctx.lineTo(hw, dh + rise);
      ctx.closePath();
      ctx.fillStyle = p.wall.right;
      ctx.fill();

      // Edge lines
      ctx.strokeStyle = p.wall.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + rise);
      ctx.moveTo(0, hh);
      ctx.lineTo(0, hh + rise);
      ctx.lineTo(hw, dh + rise);
      ctx.lineTo(dw, hh + rise);
      ctx.stroke();
    });

    // --- Elevated wall (wall at elevation 1) ---
    this.isoTileTextures['elevated_wall'] = this._createIsoTexture(dw, wallH, (ctx, w, h) => {
      // Same as regular wall but with a blue tint
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(dw, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = p.wall.top;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(hw, dh);
      ctx.lineTo(hw, dh + wallRise);
      ctx.lineTo(0, hh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.wall.left;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(hw, dh);
      ctx.lineTo(dw, hh);
      ctx.lineTo(dw, hh + wallRise);
      ctx.lineTo(hw, dh + wallRise);
      ctx.closePath();
      ctx.fillStyle = p.wall.right;
      ctx.fill();

      // Blue highlight edge for elevated walls
      ctx.strokeStyle = 'rgba(100,180,255,0.2)';
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
      'elevated_floor': 'elevated_floor',
      'ramp_north':    'ramp_north',
      'ramp_south':    'ramp_south',
      'ramp_east':     'ramp_east',
      'ramp_west':     'ramp_west',
      'full_wall':     'full_wall',
      'elevated_wall': 'elevated_wall',
      'cracked_wall':  'cracked_wall',
      // Nightside tileset
      'dark_stone_floor':    'floor',
      'umbracite_floor':     'floor2',
      'umbracite_vein_wall': 'wall',
      'crystal_door_closed': 'door_closed',
      'crystal_door_open':   'door_open',
      'deep_stairs_down':    'stairs_down',
      'deep_stairs_up':      'stairs_up',
      'dark_pool':           'water',
      // Frost crypt tileset
      'frozen_stone':        'floor',
      'ice_patch':           'floor2',
      'frost_wall':          'wall',
      'frozen_door_closed':  'door_closed',
      'frozen_door_open':    'door_open',
      'ice_stairs_down':     'stairs_down',
      'ice_stairs_up':       'stairs_up',
      'frozen_pool':         'water',
      // Fungal forest tileset
      'mossy_ground':        'floor',
      'mycelium_floor':      'floor2',
      'fungal_wall':         'wall',
      'spore_door_closed':   'door_closed',
      'spore_door_open':     'door_open',
      'root_stairs_down':    'stairs_down',
      'root_stairs_up':      'stairs_up',
      'spore_pool':          'water',
      // Misc tiles from other tilesets
      'sealed_gate_workshop':  'door_closed',
      'sealed_gate_charger':   'door_closed',
      'sealed_gate_briefing':  'door_closed',
      'sealed_gate_training':  'door_closed',
      'hidden_passage':        'door_closed',
      'blast_door':            'door_closed',
      'transit_gate':          'door_closed',
      'homestead_gate':        'door_closed',
      'cache_entrance':        'door_closed',
      'maintenance_hatch':     'door_closed',
      'junction_box_b':        'chest_closed',
      'crate_closed':          'chest_closed',
      'crate_opened':          'chest_opened',
      'garden_plot':           'floor',
      'notice_board':          'floor',
      'seed_pot':              'floor',
      'personal_log':          'floor',
      'resonance_point':       'floor',
      'survey_marker':         'floor',
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
        // Set renderer resolution to cssZoom * devicePixelRatio so the backing buffer
        // matches the device's native physical resolution. Without DPR, text is fuzzy
        // on high-density mobile screens. Cap at DPR 2 for performance.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.app.renderer.resolution = this.cssZoom * dpr;
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

  setMap(map, tileset, chunked) {
    this.map = map;
    this.tileset = tileset;
    // Initialize chunk-based fog of war tracking
    const cs = CONSTANTS.CHUNK_SIZE || 16;
    this.chunked = !!chunked;
    this.chunkCols = Math.ceil(map.width / cs);
    this.chunkRows = Math.ceil(map.height / cs);
    this.revealedChunks = new Uint8Array(this.chunkCols * this.chunkRows);
    if (!chunked) this.revealedChunks.fill(1); // full data = all revealed
    // Compute elevation depth band from map iso-Y range so elevation layers
    // never overlap.  Each elevation gets TWO sub-bands: one for floor tiles
    // (always behind entities at that level) and one for walls + entities.
    const mapIsoRange = (map.width + map.height) * CONSTANTS.ISO_DIAMOND_H / 2 + 100;
    this.elevBand = mapIsoRange;
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

  // Apply received chunks into the map data and mark them revealed
  applyChunks(chunks) {
    if (!this.map) return;
    const cs = CONSTANTS.CHUNK_SIZE || 16;
    for (const chunk of chunks) {
      // Mark chunk as revealed
      if (this.revealedChunks) {
        this.revealedChunks[chunk.cy * this.chunkCols + chunk.cx] = 1;
      }
      // Copy tile data into map
      for (let row = 0; row < chunk.h; row++) {
        for (let col = 0; col < chunk.w; col++) {
          const mapX = chunk.x + col;
          const mapY = chunk.y + row;
          if (mapX < this.map.width && mapY < this.map.height) {
            this.map.data[mapY * this.map.width + mapX] = chunk.data[row * chunk.w + col];
          }
        }
      }
    }
  }

  // Check if a tile position is in a revealed chunk
  isTileRevealed(tx, ty) {
    if (!this.revealedChunks) return true;
    const cs = CONSTANTS.CHUNK_SIZE || 16;
    const cx = Math.floor(tx / cs);
    const cy = Math.floor(ty / cs);
    if (cx < 0 || cy < 0 || cx >= this.chunkCols || cy >= this.chunkRows) return false;
    return this.revealedChunks[cy * this.chunkCols + cx] === 1;
  }

  // Get fog-of-war edge alpha for a tile (gradient at revealed/unrevealed boundaries)
  _getFogEdgeAlpha(tx, ty) {
    if (!this.chunked || !this.revealedChunks) return 1.0;

    const cs = CONSTANTS.CHUNK_SIZE || 16;
    const cx = Math.floor(tx / cs);
    const cy = Math.floor(ty / cs);
    const fadeDepth = 3;
    let minDist = fadeDepth + 1;

    const localX = tx - cx * cs;
    const localY = ty - cy * cs;

    // Check 8 neighboring chunks for unrevealed boundaries
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ncx = cx + dx;
        const ncy = cy + dy;
        if (ncx < 0 || ncy < 0 || ncx >= this.chunkCols || ncy >= this.chunkRows) continue;
        if (this.revealedChunks[ncy * this.chunkCols + ncx] === 1) continue;

        // Neighbor is unrevealed — compute distance to that edge
        let dist;
        if (dx === 0) {
          dist = dy < 0 ? localY : (cs - 1 - localY);
        } else if (dy === 0) {
          dist = dx < 0 ? localX : (cs - 1 - localX);
        } else {
          // Diagonal: use min of both axis distances
          const distX = dx < 0 ? localX : (cs - 1 - localX);
          const distY = dy < 0 ? localY : (cs - 1 - localY);
          dist = Math.min(distX, distY);
        }
        minDist = Math.min(minDist, dist);
      }
    }

    if (minDist >= fadeDepth) return 1.0;
    // Smooth fade: 0.15 at the very edge, 1.0 at fadeDepth tiles in
    const t = minDist / fadeDepth;
    return 0.15 + 0.85 * t;
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
      // In iso mode, allocate sprites for visible tiles (capped for large maps)
      const mapTiles = this.map ? this.map.width * this.map.height : 600;
      const count = Math.min(mapTiles, 4000);
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

    // Tick combat juice timers
    const dt = 1 / 60;
    this._tickHitFlashes(dt);
    this._tickAmbushFadeIns(dt);
    this._tickScreenShake(dt);
    this._updateBossIntro(dt);

    // Position world container (camera offset + screen shake)
    const shake = this._getShakeOffset();
    this.worldContainer.x = -Math.round(this.camX) + shake.x;
    this.worldContainer.y = -Math.round(this.camY) + shake.y;

    this.renderMap();
    this.renderSpawns();
    this.renderExits();
    this.renderClickTarget();
    this.renderAimLine();
    this.renderLighthouse();
    this.renderItems();
    this.renderNPCs();
    this.renderMonsters();
    this.renderProjectiles();
    this.renderBeamObjects();
    this.renderExtractionPoints();
    this.renderSentries();
    this.renderConeEffects();
    this.renderExplosionEffects();
    this.renderLungeTrails();
    this.renderShockwaveEffects();
    this.renderChannelingIndicators();
    this.renderMeleeEffects();
    this.renderPlayers();
    this.renderDoorPrompts();
    this.renderDeathAnims();
    this.renderDamageNumbers();
    this.renderMinimap();
    this.renderQuestArrow();
    this.renderSpeechBubble();
    this.renderSiegeAnnouncements();

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

    // During boss intro, lerp camera toward boss position
    let focusX = me.x, focusY = me.y;
    if (this.bossIntro) {
      const t = this.bossIntro.elapsed / this.bossIntro.duration;
      // Pan toward boss during 10%-60%, pan back during 65%-95%
      let blend = 0;
      if (t >= 0.1 && t < 0.6) blend = Math.min(1, (t - 0.1) / 0.15);
      else if (t >= 0.6 && t < 0.65) blend = 1;
      else if (t >= 0.65 && t < 0.95) blend = 1 - (t - 0.65) / 0.3;
      focusX = me.x + (this.bossIntro.x - me.x) * blend;
      focusY = me.y + (this.bossIntro.y - me.y) * blend;
    }

    if (this.isoMode) {
      const iso = this.worldToIso(focusX, focusY);
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

    const targetX = focusX - this.viewW / 2;
    const targetY = focusY - this.viewH / 2;

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

        // Skip unrevealed tiles (fog of war)
        const rawTileIdFlat = this.map.data[ty * this.map.width + tx];
        if (rawTileIdFlat === -1) {
          sprite.visible = false;
          continue;
        }

        const tileId = String(rawTileIdFlat);
        sprite.visible = true;
        sprite.x = tx * ts;
        sprite.y = ty * ts;
        sprite.width = ts;
        sprite.height = ts;
        sprite.alpha = this._getFogEdgeAlpha(tx, ty);

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

    // Wall-type iso keys (rendered in entityContainer for depth sorting)
    const wallKeys = new Set(['wall', 'cracked_wall', 'door_closed', 'locked_door', 'chest_closed', 'full_wall', 'elevated_wall',
      'elevated_floor', 'ramp_north', 'ramp_south', 'ramp_east', 'ramp_west']);

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
    const cs = CONSTANTS.CHUNK_SIZE || 16;
    const hasChunks = this.chunked && this.revealedChunks;

    // Build set of chunks that are both revealed and potentially visible,
    // so we can skip entire unrevealed/off-screen chunk regions.
    let visibleChunkSet = null;
    if (hasChunks) {
      visibleChunkSet = new Set();
      for (let cy = 0; cy < this.chunkRows; cy++) {
        for (let cx = 0; cx < this.chunkCols; cx++) {
          if (this.revealedChunks[cy * this.chunkCols + cx] !== 1) continue;

          // Compute iso bounding box for this chunk's 4 corners
          const x0 = cx * cs, y0 = cy * cs;
          const x1 = Math.min(x0 + cs, w), y1 = Math.min(y0 + cs, h);
          const corners = [
            this.worldToIso(x0 * ts, y0 * ts),
            this.worldToIso(x1 * ts, y0 * ts),
            this.worldToIso(x0 * ts, y1 * ts),
            this.worldToIso(x1 * ts, y1 * ts),
          ];
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const c of corners) {
            if (c.x < minX) minX = c.x;
            if (c.x > maxX) maxX = c.x;
            if (c.y < minY) minY = c.y;
            if (c.y > maxY) maxY = c.y;
          }
          // Account for wall rise in vertical bounds
          minY -= wallRise * 4;

          // Skip chunk if entirely outside viewport
          if (maxX < cullL || minX > cullR || maxY < cullT || minY > cullB) continue;

          visibleChunkSet.add(cy * this.chunkCols + cx);
        }
      }
    }

    // Iterate in diagonal order for back-to-front depth
    for (let diag = 0; diag < w + h - 1; diag++) {
      for (let tx = Math.max(0, diag - h + 1); tx <= Math.min(diag, w - 1); tx++) {
        const ty = diag - tx;

        // Skip tiles in unrevealed or off-screen chunks
        if (visibleChunkSet) {
          const cx = (tx / cs) | 0;
          const cy = (ty / cs) | 0;
          if (!visibleChunkSet.has(cy * this.chunkCols + cx)) continue;
        }

        // Get iso position for tile center
        const wcx = (tx + 0.5) * ts;
        const wcy = (ty + 0.5) * ts;
        const iso = this.worldToIso(wcx, wcy);

        // Cull outside viewport (per-tile for chunk-edge precision)
        if (iso.x < cullL || iso.x > cullR || iso.y < cullT || iso.y > cullB) {
          continue;
        }

        // Skip unrevealed tiles (fog of war)
        const rawTileId = this.map.data[ty * w + tx];
        if (rawTileId === -1) continue;

        const tileId = String(rawTileId);
        const tileDef = this.tileset ? this.tileset.tiles[tileId] : null;
        const tileName = tileDef ? tileDef.name : 'void';
        const isoKey = this.tileToIsoKey[tileName] || 'wall';
        const isWall = wallKeys.has(isoKey);

        // Determine tile elevation for rendering offset
        const tileElev = tileDef ? (tileDef.elevation || 0) : 0;
        const elevOffset = tileElev * wallRise;

        if (isWall) {
          // Wall tiles go into entityContainer for depth sorting with entities
          if (wallIdx >= this.wallSprites.length) continue;
          const sprite = this.wallSprites[wallIdx++];

          sprite.visible = true;
          sprite.tint = 0xffffff;
          sprite.alpha = this._getFogEdgeAlpha(tx, ty);

          if (this.isoTileLoaded && this.isoTileTextures[isoKey]) {
            sprite.texture = this.isoTileTextures[isoKey];
          } else {
            sprite.texture = PIXI.Texture.WHITE;
            sprite.tint = this.tileColors[tileId] !== undefined ? this.tileColors[tileId] : 0xff00ff;
          }

          // Determine sprite height based on tile type
          let spriteH = dh + wallRise;
          if (isoKey === 'full_wall') {
            spriteH = dh + wallRise * 4;
          } else if (isoKey === 'elevated_floor') {
            // Flat floor tile — no wall rise, use floor-style anchor
            spriteH = dh;
          } else if (isoKey.startsWith('ramp_')) {
            spriteH = dh + wallRise;
          }

          if (isoKey === 'elevated_floor') {
            sprite.anchor.set(0.5, 0.5);
            sprite.width = dw;
            sprite.height = spriteH;
            sprite.x = iso.x;
            sprite.y = iso.y - elevOffset;
          } else {
            sprite.anchor.set(0.5, 1.0);
            sprite.width = dw;
            sprite.height = spriteH;
            sprite.x = iso.x;
            sprite.y = iso.y + dh / 2 - elevOffset;
          }
          // Elevation depth sorting with sub-bands: floor-type tiles go in the
          // lower sub-band (behind entities), wall-type tiles go in the upper
          // sub-band (depth-sorts with entities for proper occlusion).
          const isFloorTile = (isoKey === 'elevated_floor');
          sprite.zIndex = iso.y + tileElev * this.elevBand * 2
            + (isFloorTile ? 0 : this.elevBand);
        } else {
          // Floor tiles stay in tileContainer (always behind entities)
          if (floorIdx >= this.tileSprites.length) continue;
          const sprite = this.tileSprites[floorIdx++];

          sprite.visible = true;
          sprite.tint = 0xffffff;
          sprite.alpha = this._getFogEdgeAlpha(tx, ty);

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
          sprite.y = iso.y - elevOffset;
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

  _getDiamondTexture() {
    if (this._diamondTex) return this._diamondTex;
    const size = 32;
    const half = size / 2;
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff);
    g.moveTo(half, 0);
    g.lineTo(size, half);
    g.lineTo(half, size);
    g.lineTo(0, half);
    g.closePath();
    g.endFill();
    g.lineStyle(1.5, 0xffffff, 0.4);
    g.moveTo(half, 0);
    g.lineTo(size, half);
    g.lineTo(half, size);
    g.lineTo(0, half);
    g.closePath();
    this._diamondTex = this.app.renderer.generateTexture(g);
    g.destroy();
    return this._diamondTex;
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
    // Texture is loading — use diamond fallback (matches old Canvas 2D style)
    sprite.texture = this._getDiamondTexture();
    const fsz = fallbackSize || 20;
    sprite.width = fsz;
    sprite.height = fsz;
    sprite.y = this.isoMode ? -fsz / 2 : 0;
    return false;
  }

  // Set sprite texture from a 4-frame animation strip, selecting the given frame
  _setAnimSpriteTexture(sprite, spritePath, fallbackSize, frameIndex) {
    const frames = this.loadAnimFrames(spritePath);
    const tex = frames[frameIndex] || frames[0];
    const sz = this.isoMode ? 36 : CONSTANTS.TILE_SIZE;
    if (tex.valid) {
      sprite.texture = tex;
      sprite.tint = 0xffffff;
      sprite.width = sz;
      sprite.height = sz;
      sprite.y = this.isoMode ? -sz / 2 : 0;
      return true;
    }
    sprite.texture = this._getDiamondTexture();
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

      // Sprite — use frame 0 (idle) from animation strip
      const spritePath = 'sprites/' + item.type + '.png';
      const loaded = this._setAnimSpriteTexture(sprite, spritePath, 20, 0);
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

      // Sprite — use animation frame (NPCs only idle-bob, no attack/hit)
      const spritePath = npc.type ? 'sprites/' + npc.type + '.png' : 'sprites/npc_default.png';
      const animFrame = this._getAnimFrame(npc.id, false, false);
      let loaded = this._setAnimSpriteTexture(sprite, spritePath, r * 2, animFrame);
      if (!loaded && npc.type) {
        loaded = this._setAnimSpriteTexture(sprite, 'sprites/npc_default.png', r * 2, animFrame);
      }
      if (!loaded) sprite.tint = 0x64b5f6;

      // Name tag (above sprite top)
      nameTag.text = npc.name;
      nameTag.style.fill = '#64b5f6';
      nameTag.y = this.isoMode ? -42 : -r - 6;
      nameTag.visible = true;

      // No health bar for NPCs
      healthBg.clear();
      healthFill.clear();

      // Talk prompt (skip for decorative entities like harvesters)
      if (me && !npc.decorative) {
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

      this._positionEntity(container, mob.x, mob.y, mob.elevation);

      // Shadow sits on the surface at the entity's elevation
      const mobShadow = container.children[0];
      if (mobShadow) mobShadow.y = container._shadowOffset || 0;

      // Sprite — use animation frame from 4-frame strip
      const spritePath = mob.type ? 'sprites/' + mob.type + '.png' : null;
      const isHit = this.hitFlashes.has(mob.id);
      const animFrame = this._getAnimFrame(mob.id, mob.attacking, isHit);
      if (spritePath) {
        const loaded = this._setAnimSpriteTexture(sprite, spritePath, r * 2, animFrame);
        if (!loaded) sprite.tint = 0xe53935;
      } else {
        sprite.texture = PIXI.Texture.WHITE;
        sprite.width = r * 2;
        sprite.height = r * 2;
        sprite.tint = 0xe53935;
        sprite.y = this.isoMode ? -r : 0;
      }

      // Hit flash: override tint to white briefly
      if (isHit) {
        sprite.tint = 0xffffff;
      } else if (mob.slowed) {
        // Light blue tint when slowed by sentry beam
        sprite.tint = 0x4fc3f7;
      } else if (mob.packLeader) {
        // Orange tint for pack leaders (aura source)
        sprite.tint = 0xff9800;
      } else if (mob.auraBuff) {
        // Warm yellow tint for aura-buffed pack members
        sprite.tint = 0xffd54f;
      }

      // Name tag (above sprite top)
      nameTag.text = mob.name;
      nameTag.style.fill = mob.boss ? '#ff8a80' : '#e57373';
      if (mob.boss) {
        nameTag.style.fontSize = 11;
        nameTag.style.fontWeight = 'bold';
      } else {
        nameTag.style.fontSize = 9;
        nameTag.style.fontWeight = 'normal';
      }
      nameTag.y = this.isoMode ? (mob.boss ? -50 : -42) : -r - 6;
      nameTag.visible = true;

      // Health bar (just below name tag) — bosses get a wider bar
      const hp = mob.health / mob.maxHealth;
      const barColor = mob.boss
        ? (hp > 0.6 ? 0xe53935 : hp > 0.3 ? 0xff6f00 : 0xd50000)
        : (hp > 0.5 ? 0xe53935 : 0xff6f00);
      const barW = mob.boss ? 40 : 26;
      const barH = mob.boss ? 5 : 3;
      const barY = this.isoMode ? (mob.boss ? -48 : -40) : -r - 4;
      this._drawHealthBar(healthBg, healthFill, 0, barY, barW, barH, hp, barColor);

      // Ambush fade-in: override alpha if this mob is fading in
      if (this.ambushFadeIns.has(mob.id)) {
        const remaining = this.ambushFadeIns.get(mob.id);
        const fadeTotal = 0.5;
        const progress = 1 - remaining / fadeTotal; // 0=just revealed, 1=fully visible
        container.alpha = Math.max(0, progress);
        // Reveal flash: briefly show white tint in first 20% of fade-in
        if (progress < 0.2 && !this.hitFlashes.has(mob.id)) {
          sprite.tint = 0xffffff;
        }
      } else {
        container.alpha = 1;
      }

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

        if (proj.projectileType === 'pulse_cannon') {
          // Large glowing projectile for pulse cannon
          const glow = new PIXI.Graphics();
          glow.beginFill(0xff6e40, 0.2);
          glow.drawCircle(0, 0, 16);
          glow.endFill();
          glow.beginFill(0xff9100, 0.4);
          glow.drawCircle(0, 0, 10);
          glow.endFill();
          glow.beginFill(0xffffff, 0.7);
          glow.drawCircle(0, 0, 5);
          glow.endFill();
          container.addChild(glow);
        } else {
          const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
          sprite.anchor.set(0.5, 0.5);
          sprite.width = r * 2;
          sprite.height = r * 2;
          // Tint by projectile type
          const projColors = {
            // Monster projectile types
            arrow_bone: 0xbcaaa4,    // bone/tan
            shadow_bolt: 0x7c4dff,   // dark purple
            magma_glob: 0xff6e40,    // fire → orange
            spore_cloud: 0x69f0ae,   // acid → green
            crystal_shard_bolt: 0x80deea, // ice → blue
            energy_bolt: 0xffab40,   // amber/orange
            // Player weapon projectile types
            blaster_bolt: 0x40c4ff,  // bright cyan (energy)
            pulse_bolt: 0xffd740,    // amber gold (high-energy pulse)
          };
          sprite.tint = projColors[proj.projectileType] || 0x4fc3f7;
          container.addChild(sprite);
        }
        this.entityContainer.addChild(container);
        entry = { container };
        this.projectileSprites.set(proj.id, entry);
      }

      const { container } = entry;
      this._positionEntity(container, proj.x, proj.y);
    }

    this._cleanupPool(this.projectileSprites, activeIds);
  }

  // --- Light Sentries ---

  renderBeamObjects() {
    if (!this.state || !this.state.beamObjects || this.state.beamObjects.length === 0) return;

    const activeIds = new Set();

    for (const bo of this.state.beamObjects) {
      activeIds.add(bo.id);

      let entry = this.beamObjectSprites.get(bo.id);
      if (!entry) {
        const container = new PIXI.Container();

        if (bo.type === 'mirror') {
          // Mirror: a reflective surface drawn at the mirror's angle
          // angle = 45° draws as / (forward slash), 135° draws as \ (backslash)
          // In screen coords (Y-down), surface direction is (cos(θ), -sin(θ))
          const gfx = new PIXI.Graphics();
          const mRad = (bo.angle || 45) * Math.PI / 180;
          // World-space surface direction (screen coords, Y-down)
          let sdx = Math.cos(mRad);
          let sdy = -Math.sin(mRad);

          // Transform surface direction to iso screen space if in iso mode
          if (this.isoMode) {
            const dw = CONSTANTS.ISO_DIAMOND_W;
            const dh = CONSTANTS.ISO_DIAMOND_H;
            const ix = (sdx - sdy) * dw / 2;
            const iy = (sdx + sdy) * dh / 2;
            const ilen = Math.sqrt(ix * ix + iy * iy);
            sdx = ix / ilen;
            sdy = iy / ilen;
          }

          const halfLen = 14;
          const sx = sdx * halfLen;
          const sy = sdy * halfLen;
          // Normal direction (perpendicular to surface)
          const nx = -sdy * 5;
          const ny = sdx * 5;

          // Mirror backing (darker, thicker)
          gfx.lineStyle(5, 0x666666, 0.7);
          gfx.moveTo(-sx, -sy);
          gfx.lineTo(sx, sy);
          // Reflective surface (bright)
          gfx.lineStyle(3, 0xd0d0d0, 0.95);
          gfx.moveTo(-sx, -sy);
          gfx.lineTo(sx, sy);
          // Bright highlight stripe
          gfx.lineStyle(1, 0xffffff, 0.8);
          gfx.moveTo(-sx, -sy);
          gfx.lineTo(sx, sy);
          // Small hash marks on one side to indicate reflective face
          for (let i = -1; i <= 1; i++) {
            const cx = i * sx * 0.5;
            const cy = i * sy * 0.5;
            gfx.lineStyle(1, 0xaaaaaa, 0.4);
            gfx.moveTo(cx, cy);
            gfx.lineTo(cx + nx, cy + ny);
          }
          container.addChild(gfx);

          // Base glow
          const glow = new PIXI.Graphics();
          glow.beginFill(0xc0c0c0, 0.1);
          glow.drawCircle(0, 0, 16);
          glow.endFill();
          container.addChild(glow);

          entry = { container, gfx, glow, type: 'mirror' };
        } else if (bo.type === 'photosensor') {
          // Photosensor: a small diamond/crystal shape
          const gfx = new PIXI.Graphics();
          gfx.lineStyle(2, 0xffab40, 0.8);
          gfx.beginFill(0xffab40, 0.3);
          gfx.moveTo(0, -8);
          gfx.lineTo(6, 0);
          gfx.lineTo(0, 8);
          gfx.lineTo(-6, 0);
          gfx.closePath();
          gfx.endFill();
          container.addChild(gfx);

          // Active glow (hidden initially)
          const glow = new PIXI.Graphics();
          glow.beginFill(0xffab40, 0.25);
          glow.drawCircle(0, 0, 16);
          glow.endFill();
          glow.visible = false;
          container.addChild(glow);

          entry = { container, gfx, glow, type: 'photosensor' };
        }

        if (entry) {
          this.entityContainer.addChild(container);
          this.beamObjectSprites.set(bo.id, entry);
        }
      }

      if (!entry) continue;

      this._positionEntity(entry.container, bo.x, bo.y);

      // Animate photosensor active state
      if (bo.type === 'photosensor' && entry.glow) {
        entry.glow.visible = bo.active;
        if (bo.active) {
          const pulse = 0.5 + 0.5 * Math.sin((this.sentryPulseTime || 0) * 6);
          entry.glow.alpha = pulse;
          entry.gfx.tint = 0xffffff;
        }
      }
    }

    this._cleanupPool(this.beamObjectSprites, activeIds);
  }

  renderExtractionPoints() {
    if (!this.state || !this.state.extractionPoints) return;

    const activeIds = new Set();
    const time = performance.now() / 1000;

    for (const ep of this.state.extractionPoints) {
      activeIds.add(ep.id);

      let entry = this.extractionPointSprites.get(ep.id);
      if (!entry) {
        const container = new PIXI.Container();

        // Outer fire glow
        const glow = new PIXI.Graphics();
        container.addChild(glow);

        // Inner fire core
        const core = new PIXI.Graphics();
        container.addChild(core);

        this.entityContainer.addChild(container);
        entry = { container, glow, core };
        this.extractionPointSprites.set(ep.id, entry);
      }

      const { container, glow, core } = entry;
      this._positionEntity(container, ep.x, ep.y);

      // Animate fire effect
      const flicker1 = Math.sin(time * 8) * 0.15;
      const flicker2 = Math.sin(time * 13 + 1.7) * 0.1;
      const pulse = 0.6 + flicker1 + flicker2;

      // Outer glow (orange/red)
      glow.clear();
      glow.beginFill(0xff6600, 0.12 * pulse);
      glow.drawCircle(0, 0, 24);
      glow.endFill();
      glow.beginFill(0xff4400, 0.2 * pulse);
      glow.drawCircle(0, 0, 16);
      glow.endFill();

      // Inner fire core (yellow/white)
      core.clear();
      core.beginFill(0xff8800, 0.5 * pulse);
      const coreH = 10 + Math.sin(time * 10) * 2;
      core.drawEllipse(0, -coreH / 2, 5, coreH / 2);
      core.endFill();
      core.beginFill(0xffcc00, 0.7);
      core.drawEllipse(0, -3, 3, 5);
      core.endFill();
      core.beginFill(0xffffff, 0.4);
      core.drawEllipse(0, -2, 1.5, 3);
      core.endFill();
    }

    this._cleanupPool(this.extractionPointSprites, activeIds);
  }

  renderSentries() {
    if (!this.state || !this.state.sentries) return;

    this.sentryBeamGfx.clear();
    this.sentryPulseTime += 1 / 60;

    const activeIds = new Set();

    for (const sentry of this.state.sentries) {
      activeIds.add(sentry.id);

      // Get or create sentry sprite
      let entry = this.sentrySprites.get(sentry.id);
      if (!entry) {
        const container = new PIXI.Container();

        // Base glow circle
        const glow = new PIXI.Graphics();
        glow.beginFill(0x4fc3f7, 0.15);
        glow.drawCircle(0, 0, 20);
        glow.endFill();
        glow.beginFill(0x81d4fa, 0.25);
        glow.drawCircle(0, 0, 12);
        glow.endFill();
        container.addChild(glow);

        // Sentry body sprite
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5, 0.5);
        container.addChild(sprite);

        // Rotating light rays around the sentry
        const rays = new PIXI.Graphics();
        container.addChild(rays);

        this.entityContainer.addChild(container);
        entry = { container, sprite, glow, rays };
        this.sentrySprites.set(sentry.id, entry);
      }

      const { container, sprite, glow, rays } = entry;
      this._positionEntity(container, sentry.x, sentry.y);

      // Update sprite texture (handles async loading)
      const loaded = this._setSpriteTexture(sprite, 'sprites/light_sentry.png', 20);
      if (!loaded) sprite.tint = 0x4fc3f7;

      // Animate glow pulse
      const pulse = 0.7 + 0.3 * Math.sin(this.sentryPulseTime * 4);
      glow.alpha = pulse;

      // Animate rotating rays
      rays.clear();
      const rayCount = 6;
      const rayLen = 14 + 4 * Math.sin(this.sentryPulseTime * 3);
      for (let i = 0; i < rayCount; i++) {
        const angle = this.sentryPulseTime * 1.5 + (i * Math.PI * 2 / rayCount);
        const x1 = Math.cos(angle) * 8;
        const y1 = Math.sin(angle) * 8;
        const x2 = Math.cos(angle) * rayLen;
        const y2 = Math.sin(angle) * rayLen;
        rays.lineStyle(1.5, 0x81d4fa, 0.5 * pulse);
        rays.moveTo(x1, y1);
        rays.lineTo(x2, y2);
      }
      rays.lineStyle(0);

      // Draw beam chain (supports reflections off mirrors)
      if (sentry.beamChain && sentry.beamChain.length > 0) {
        const toWorld = (wx, wy) => {
          return this.isoMode ? this.worldToIso(wx, wy) : { x: wx, y: wy };
        };
        const beamPulse = 0.5 + 0.5 * Math.sin(this.sentryPulseTime * 8);

        for (let seg = 0; seg < sentry.beamChain.length; seg++) {
          const chain = sentry.beamChain[seg];
          const sp = toWorld(chain.fromX, chain.fromY);
          const tp = toWorld(chain.toX, chain.toY);

          // 3-layer beam
          this.sentryBeamGfx.lineStyle(6, 0x4fc3f7, 0.15 * beamPulse);
          this.sentryBeamGfx.moveTo(sp.x, sp.y);
          this.sentryBeamGfx.lineTo(tp.x, tp.y);

          this.sentryBeamGfx.lineStyle(3, 0x81d4fa, 0.4 * beamPulse);
          this.sentryBeamGfx.moveTo(sp.x, sp.y);
          this.sentryBeamGfx.lineTo(tp.x, tp.y);

          this.sentryBeamGfx.lineStyle(1.5, 0xe1f5fe, 0.8);
          this.sentryBeamGfx.moveTo(sp.x, sp.y);
          this.sentryBeamGfx.lineTo(tp.x, tp.y);

          // Impact glow at endpoint (different color for different target types)
          const isTerminal = seg === sentry.beamChain.length - 1;
          if (chain.targetType !== 'none') {
            this.sentryBeamGfx.lineStyle(0);
            if (chain.targetType === 'photosensor') {
              // Golden glow for photosensor hits
              this.sentryBeamGfx.beginFill(0xffab40, 0.4 * beamPulse);
              this.sentryBeamGfx.drawCircle(tp.x, tp.y, 10);
              this.sentryBeamGfx.endFill();
              this.sentryBeamGfx.beginFill(0xffffff, 0.6 * beamPulse);
              this.sentryBeamGfx.drawCircle(tp.x, tp.y, 5);
              this.sentryBeamGfx.endFill();
            } else if (chain.targetType === 'mirror') {
              // Silver flash at mirror
              this.sentryBeamGfx.beginFill(0xffffff, 0.3 * beamPulse);
              this.sentryBeamGfx.drawCircle(tp.x, tp.y, 6);
              this.sentryBeamGfx.endFill();
            } else {
              // Standard impact for monsters
              this.sentryBeamGfx.beginFill(0x4fc3f7, 0.3 * beamPulse);
              this.sentryBeamGfx.drawCircle(tp.x, tp.y, 8);
              this.sentryBeamGfx.endFill();
              this.sentryBeamGfx.beginFill(0xe1f5fe, 0.5 * beamPulse);
              this.sentryBeamGfx.drawCircle(tp.x, tp.y, 4);
              this.sentryBeamGfx.endFill();
            }
          }

          // Crawling energy particles along each segment
          const dx = tp.x - sp.x;
          const dy = tp.y - sp.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const particleCount = 3;
            for (let pi = 0; pi < particleCount; pi++) {
              const t = ((this.sentryPulseTime * 2 + pi / particleCount + seg * 0.3) % 1);
              const px = sp.x + dx * t;
              const py = sp.y + dy * t;
              this.sentryBeamGfx.beginFill(0xe1f5fe, 0.7 * (1 - t));
              this.sentryBeamGfx.drawCircle(px, py, 2);
              this.sentryBeamGfx.endFill();
            }
          }
        }
      } else if (sentry.targetId && sentry.targetId !== 'beam') {
        // Fallback: legacy single-target beam (for backward compat)
        const targetMob = this.state.monsters.find(m => m.id === sentry.targetId);
        if (targetMob) {
          const toWorld = (wx, wy) => {
            return this.isoMode ? this.worldToIso(wx, wy) : { x: wx, y: wy };
          };
          const sp = toWorld(sentry.x, sentry.y);
          const tp = toWorld(targetMob.x, targetMob.y);
          const beamPulse = 0.5 + 0.5 * Math.sin(this.sentryPulseTime * 8);

          this.sentryBeamGfx.lineStyle(6, 0x4fc3f7, 0.15 * beamPulse);
          this.sentryBeamGfx.moveTo(sp.x, sp.y);
          this.sentryBeamGfx.lineTo(tp.x, tp.y);
          this.sentryBeamGfx.lineStyle(3, 0x81d4fa, 0.4 * beamPulse);
          this.sentryBeamGfx.moveTo(sp.x, sp.y);
          this.sentryBeamGfx.lineTo(tp.x, tp.y);
          this.sentryBeamGfx.lineStyle(1.5, 0xe1f5fe, 0.8);
          this.sentryBeamGfx.moveTo(sp.x, sp.y);
          this.sentryBeamGfx.lineTo(tp.x, tp.y);

          this.sentryBeamGfx.lineStyle(0);
          this.sentryBeamGfx.beginFill(0x4fc3f7, 0.3 * beamPulse);
          this.sentryBeamGfx.drawCircle(tp.x, tp.y, 8);
          this.sentryBeamGfx.endFill();
          this.sentryBeamGfx.beginFill(0xe1f5fe, 0.5 * beamPulse);
          this.sentryBeamGfx.drawCircle(tp.x, tp.y, 4);
          this.sentryBeamGfx.endFill();
        }
      }
    }

    this._cleanupPool(this.sentrySprites, activeIds);
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

      this._positionEntity(container, player.x, player.y, player.elevation, player.hovering);

      // Update shadow position — shadow sits on the surface at the entity's
      // elevation, offset only by hover gap (not by elevation itself).
      const shadow = container.children[0]; // shadow is first child
      if (shadow) {
        shadow.y = container._shadowOffset || 0;
      }

      // Sprite — use animation frame from 4-frame strip
      const spriteName = playerSpriteNames[player.colorIndex] || 'player_blue';
      const spritePath = 'sprites/' + spriteName + '.png';
      const isHit = this.hitFlashes.has(player.id);
      const animFrame = this._getAnimFrame(player.id, player.attacking, isHit);
      const loaded = this._setAnimSpriteTexture(sprite, spritePath, r * 2, animFrame);
      if (!loaded) {
        const playerColors = [0x4fc3f7, 0xef5350, 0x66bb6a, 0xffa726];
        sprite.tint = playerColors[player.colorIndex] || 0xffffff;
      }

      // Hit flash: override tint to white briefly
      if (isHit) {
        sprite.tint = 0xffffff;
      }

      // Hover glow effect
      if (!entry.hoverGfx) {
        entry.hoverGfx = new PIXI.Graphics();
        container.addChild(entry.hoverGfx);
      }
      entry.hoverGfx.clear();
      if (player.hovering && this.isoMode) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
        const isoOff = -18;
        entry.hoverGfx.lineStyle(2, 0x4fc3f7, 0.3 + 0.3 * pulse);
        entry.hoverGfx.drawCircle(0, isoOff, r + 10);
        entry.hoverGfx.lineStyle(1, 0x4fc3f7, 0.15 + 0.15 * pulse);
        entry.hoverGfx.drawCircle(0, isoOff, r + 16);
      }

      // Stun indicator (spinning stars)
      if (!entry.stunGfx) {
        entry.stunGfx = new PIXI.Graphics();
        container.addChild(entry.stunGfx);
      }
      entry.stunGfx.clear();
      if (player.stunned) {
        const stunAngle = Date.now() / 300;
        const stunY = this.isoMode ? -30 : -r - 2;
        for (let s = 0; s < 3; s++) {
          const a = stunAngle + (s * Math.PI * 2 / 3);
          const cx = Math.cos(a) * 10;
          const cy = Math.sin(a) * 4 + stunY;
          // Draw a 4-pointed star
          const starAngle = stunAngle * 1.5 + s;
          entry.stunGfx.beginFill(0xffeb3b, 0.9);
          const outerStar = 3.5;
          const innerStar = 1.2;
          entry.stunGfx.moveTo(
            cx + Math.cos(starAngle) * outerStar,
            cy + Math.sin(starAngle) * outerStar
          );
          for (let p = 1; p < 8; p++) {
            const pr = p % 2 === 0 ? outerStar : innerStar;
            const pa = starAngle + (p * Math.PI / 4);
            entry.stunGfx.lineTo(cx + Math.cos(pa) * pr, cy + Math.sin(pa) * pr);
          }
          entry.stunGfx.closePath();
          entry.stunGfx.endFill();
        }
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
    const SEGMENTS = 20;

    this.coneEffects = this.coneEffects.filter(cone => {
      cone.age += dt;
      if (cone.age >= cone.maxAge) return false;

      const t = cone.age / cone.maxAge; // 0..1 normalized time
      const halfAngle = cone.coneAngle / 2;
      const startAngle = cone.angle - halfAngle;
      const endAngle = cone.angle + halfAngle;

      // Outer radius expands with ease-out
      const outerT = Math.min(t / 0.5, 1.0);
      const outerRange = cone.range * (1 - (1 - outerT) * (1 - outerT));

      // Inner radius follows behind, creating a sweeping wave
      const innerT = Math.max((t - 0.15) / 0.5, 0);
      const innerRange = cone.range * Math.min(1 - (1 - innerT) * (1 - innerT), 1.0) * 0.9;

      // Fade out in the second half
      const fadeAlpha = t < 0.4 ? 1.0 : Math.max(0, 1.0 - (t - 0.4) / 0.6);

      // Convert world-space point to screen coords (iso or identity)
      const toScreen = (wx, wy) => {
        return this.isoMode ? this.worldToIso(wx, wy) : { x: wx, y: wy };
      };

      // Center in screen coords
      const c = toScreen(cone.x, cone.y);

      // Sample points along the cone arc in world space, convert to screen
      const outerPoints = [];
      const innerPoints = [];
      for (let i = 0; i <= SEGMENTS; i++) {
        const a = startAngle + (endAngle - startAngle) * (i / SEGMENTS);
        const owx = cone.x + Math.cos(a) * outerRange;
        const owy = cone.y + Math.sin(a) * outerRange;
        outerPoints.push(toScreen(owx, owy));

        if (innerRange > 1) {
          const iwx = cone.x + Math.cos(a) * innerRange;
          const iwy = cone.y + Math.sin(a) * innerRange;
          innerPoints.push(toScreen(iwx, iwy));
        }
      }

      // --- Filled cone sweep (semi-transparent) ---
      if (outerRange > innerRange + 1) {
        this.coneGfx.beginFill(0xffaa00, 0.35 * fadeAlpha);
        if (innerPoints.length > 0) {
          // Donut sector: outer arc forward, inner arc reversed
          this.coneGfx.moveTo(outerPoints[0].x, outerPoints[0].y);
          for (let i = 1; i < outerPoints.length; i++) {
            this.coneGfx.lineTo(outerPoints[i].x, outerPoints[i].y);
          }
          this.coneGfx.lineTo(innerPoints[innerPoints.length - 1].x, innerPoints[innerPoints.length - 1].y);
          for (let i = innerPoints.length - 2; i >= 0; i--) {
            this.coneGfx.lineTo(innerPoints[i].x, innerPoints[i].y);
          }
          this.coneGfx.closePath();
        } else {
          // Full sector from center
          this.coneGfx.moveTo(c.x, c.y);
          for (const p of outerPoints) {
            this.coneGfx.lineTo(p.x, p.y);
          }
          this.coneGfx.lineTo(c.x, c.y);
        }
        this.coneGfx.endFill();
      }

      // --- Bright leading edge arc ---
      if (outerRange > 2) {
        this.coneGfx.lineStyle(3, 0xffdd44, 0.8 * fadeAlpha);
        this.coneGfx.moveTo(outerPoints[0].x, outerPoints[0].y);
        for (let i = 1; i < outerPoints.length; i++) {
          this.coneGfx.lineTo(outerPoints[i].x, outerPoints[i].y);
        }
        this.coneGfx.lineStyle(0);
      }

      // --- Edge lines (cone boundaries) ---
      this.coneGfx.lineStyle(2, 0xffaa00, 0.5 * fadeAlpha);
      this.coneGfx.moveTo(c.x, c.y);
      this.coneGfx.lineTo(outerPoints[0].x, outerPoints[0].y);
      this.coneGfx.moveTo(c.x, c.y);
      this.coneGfx.lineTo(outerPoints[outerPoints.length - 1].x, outerPoints[outerPoints.length - 1].y);
      this.coneGfx.lineStyle(0);

      return true;
    });
  }

  renderExplosionEffects() {
    if (!this.explosionEffects || this.explosionEffects.length === 0) return;
    const dt = 1 / 60;
    const toScreen = (wx, wy) => {
      return this.isoMode ? this.worldToIso(wx, wy) : { x: wx, y: wy };
    };

    this.explosionEffects = this.explosionEffects.filter(exp => {
      exp.age += dt;
      if (exp.age >= exp.maxAge) return false;

      const t = exp.age / exp.maxAge;
      const c = toScreen(exp.x, exp.y);

      // Expanding ring
      const outerR = exp.radius * Math.min(t / 0.3, 1.0);
      const fadeAlpha = t < 0.3 ? 1.0 : Math.max(0, 1.0 - (t - 0.3) / 0.7);

      // Outer glow
      this.coneGfx.lineStyle(0);
      this.coneGfx.beginFill(0xff6e40, 0.15 * fadeAlpha);
      this.coneGfx.drawCircle(c.x, c.y, outerR);
      this.coneGfx.endFill();

      // Inner flash
      const innerR = outerR * 0.6;
      this.coneGfx.beginFill(0xffab40, 0.3 * fadeAlpha);
      this.coneGfx.drawCircle(c.x, c.y, innerR);
      this.coneGfx.endFill();

      // White core
      const coreR = outerR * 0.25 * (1.0 - t);
      if (coreR > 1) {
        this.coneGfx.beginFill(0xffffff, 0.6 * fadeAlpha);
        this.coneGfx.drawCircle(c.x, c.y, coreR);
        this.coneGfx.endFill();
      }

      // Expanding ring outline
      this.coneGfx.lineStyle(2, 0xff9100, 0.5 * fadeAlpha);
      this.coneGfx.drawCircle(c.x, c.y, outerR);
      this.coneGfx.lineStyle(0);

      return true;
    });
  }

  renderLungeTrails() {
    if (!this.lungeTrails || this.lungeTrails.length === 0) return;
    const dt = 1 / 60;
    const toScreen = (wx, wy) => {
      return this.isoMode ? this.worldToIso(wx, wy) : { x: wx, y: wy };
    };

    this.lungeTrails = this.lungeTrails.filter(trail => {
      trail.age += dt;
      if (trail.age >= trail.maxAge) return false;

      const t = trail.age / trail.maxAge;
      const fadeAlpha = 1.0 - t;
      const s = toScreen(trail.sx, trail.sy);
      const e = toScreen(trail.tx, trail.ty);

      // Draw a tapered trail line from start to target
      // Leading edge progresses along the path
      const lead = Math.min(t / 0.3, 1.0);
      const tailProg = Math.max(0, (t - 0.1) / 0.25);
      const lx = s.x + (e.x - s.x) * lead;
      const ly = s.y + (e.y - s.y) * lead;
      const tx = s.x + (e.x - s.x) * tailProg;
      const ty = s.y + (e.y - s.y) * tailProg;

      // Bright core trail
      this.coneGfx.lineStyle(4, 0xff5722, 0.8 * fadeAlpha);
      this.coneGfx.moveTo(tx, ty);
      this.coneGfx.lineTo(lx, ly);

      // Outer glow
      this.coneGfx.lineStyle(8, 0xff8a65, 0.25 * fadeAlpha);
      this.coneGfx.moveTo(tx, ty);
      this.coneGfx.lineTo(lx, ly);

      this.coneGfx.lineStyle(0);
      return true;
    });
  }

  renderShockwaveEffects() {
    if (!this.shockwaveEffects || this.shockwaveEffects.length === 0) return;
    const dt = 1 / 60;
    const toScreen = (wx, wy) => {
      return this.isoMode ? this.worldToIso(wx, wy) : { x: wx, y: wy };
    };

    this.shockwaveEffects = this.shockwaveEffects.filter(sw => {
      sw.age += dt;
      if (sw.age >= sw.maxAge) return false;

      const t = sw.age / sw.maxAge;
      const c = toScreen(sw.x, sw.y);
      // Ease-out expansion
      const expand = 1.0 - (1.0 - t) * (1.0 - t);
      const outerR = sw.range * expand;
      const innerR = sw.range * Math.max(0, expand - 0.15);
      const fadeAlpha = t < 0.3 ? 1.0 : Math.max(0, 1.0 - (t - 0.3) / 0.7);

      // Thick expanding ring band
      const ringWidth = Math.max(2, (outerR - innerR));
      const midR = (outerR + innerR) / 2;
      this.coneGfx.lineStyle(ringWidth, 0xff7043, 0.2 * fadeAlpha);
      this.coneGfx.drawCircle(c.x, c.y, midR);

      // Bright leading-edge ring
      this.coneGfx.lineStyle(2.5, 0xff7043, 0.7 * fadeAlpha);
      this.coneGfx.drawCircle(c.x, c.y, outerR);

      // Inner edge ring (dimmer)
      this.coneGfx.lineStyle(1.5, 0xffab91, 0.3 * fadeAlpha);
      this.coneGfx.drawCircle(c.x, c.y, innerR);

      this.coneGfx.lineStyle(0);
      return true;
    });
  }

  renderChannelingIndicators() {
    if (!this.state || !this.state.players) return;
    const toScreen = (wx, wy) => {
      return this.isoMode ? this.worldToIso(wx, wy) : { x: wx, y: wy };
    };

    for (const player of this.state.players) {
      if (!player.channeling) continue;
      const ch = player.channeling;

      const pc = toScreen(player.x, player.y);
      const tc = toScreen(ch.targetX, ch.targetY);

      const progress = 1.0 - (ch.timeRemaining / ch.totalTime);
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);

      // Pulsing ring around player
      this.coneGfx.lineStyle(2, 0xff9100, 0.4 + 0.3 * pulse);
      this.coneGfx.drawCircle(pc.x, pc.y, 20 + 4 * pulse);
      this.coneGfx.lineStyle(0);

      // Targeting line (dashed effect via segments)
      const dx = tc.x - pc.x;
      const dy = tc.y - pc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const segments = 8;
        const segLen = dist / (segments * 2);
        const ndx = dx / dist;
        const ndy = dy / dist;
        this.coneGfx.lineStyle(1.5, 0xff6e40, 0.4 + 0.2 * pulse);
        for (let i = 0; i < segments; i++) {
          const s = i * 2 * segLen;
          this.coneGfx.moveTo(pc.x + ndx * s, pc.y + ndy * s);
          this.coneGfx.lineTo(pc.x + ndx * (s + segLen), pc.y + ndy * (s + segLen));
        }
        this.coneGfx.lineStyle(0);
      }

      // Target reticle
      const reticleR = 12;
      this.coneGfx.lineStyle(2, 0xff6e40, 0.5 + 0.3 * pulse);
      this.coneGfx.drawCircle(tc.x, tc.y, reticleR);
      // Cross hairs
      this.coneGfx.moveTo(tc.x - reticleR - 4, tc.y);
      this.coneGfx.lineTo(tc.x - reticleR + 4, tc.y);
      this.coneGfx.moveTo(tc.x + reticleR - 4, tc.y);
      this.coneGfx.lineTo(tc.x + reticleR + 4, tc.y);
      this.coneGfx.moveTo(tc.x, tc.y - reticleR - 4);
      this.coneGfx.lineTo(tc.x, tc.y - reticleR + 4);
      this.coneGfx.moveTo(tc.x, tc.y + reticleR - 4);
      this.coneGfx.lineTo(tc.x, tc.y + reticleR + 4);
      this.coneGfx.lineStyle(0);

      // Cast progress bar above player
      const barW = 30;
      const barH = 4;
      const barY = pc.y - 28;
      this.coneGfx.beginFill(0x333333, 0.6);
      this.coneGfx.drawRect(pc.x - barW / 2, barY, barW, barH);
      this.coneGfx.endFill();
      this.coneGfx.beginFill(0xff9100, 0.8);
      this.coneGfx.drawRect(pc.x - barW / 2, barY, barW * progress, barH);
      this.coneGfx.endFill();
    }
  }

  renderMeleeEffects() {
    this.meleeGfx.clear();
    const dt = 1 / 60;
    this.meleeEffects = this.meleeEffects.filter(slash => {
      slash.age += dt;
      if (slash.age >= slash.maxAge) return false;

      const t = slash.age / slash.maxAge; // 0..1
      const fadeAlpha = 1.0 - t;

      // Slash arc: 120-degree sweep centered on attack direction
      const halfArc = Math.PI / 3; // 60 degrees each side
      const startAngle = slash.angle - halfArc;
      const endAngle = slash.angle + halfArc;

      // Arc expands outward quickly
      const expandT = Math.min(t / 0.4, 1.0);
      const radius = slash.range * (0.4 + 0.6 * expandT);

      const c = this.isoMode ? this.worldToIso(slash.x, slash.y) : { x: slash.x, y: slash.y };
      const isoRadius = this.isoMode ? radius * 1.5 : radius;

      // Thick bright slash arc
      this.meleeGfx.lineStyle(4, 0xffffff, 0.9 * fadeAlpha);
      this.meleeGfx.moveTo(
        c.x + Math.cos(startAngle) * isoRadius,
        c.y + Math.sin(startAngle) * isoRadius
      );
      this.meleeGfx.arc(c.x, c.y, isoRadius, startAngle, endAngle);
      this.meleeGfx.lineStyle(0);

      // Thin outer glow
      this.meleeGfx.lineStyle(2, 0xb8975a, 0.5 * fadeAlpha);
      this.meleeGfx.moveTo(
        c.x + Math.cos(startAngle) * (isoRadius + 3),
        c.y + Math.sin(startAngle) * (isoRadius + 3)
      );
      this.meleeGfx.arc(c.x, c.y, isoRadius + 3, startAngle, endAngle);
      this.meleeGfx.lineStyle(0);

      return true;
    });
  }

  // --- Combat juice helpers ---

  _tickHitFlashes(dt) {
    for (const [id, remaining] of this.hitFlashes) {
      const next = remaining - dt;
      if (next <= 0) {
        this.hitFlashes.delete(id);
      } else {
        this.hitFlashes.set(id, next);
      }
    }
  }

  _tickAmbushFadeIns(dt) {
    for (const [id, remaining] of this.ambushFadeIns) {
      const next = remaining - dt;
      if (next <= 0) {
        this.ambushFadeIns.delete(id);
      } else {
        this.ambushFadeIns.set(id, next);
      }
    }
  }

  _tickScreenShake(dt) {
    if (this.screenShake.duration > 0) {
      this.screenShake.elapsed += dt;
      if (this.screenShake.elapsed >= this.screenShake.duration) {
        this.screenShake.duration = 0;
      }
    }
  }

  _getShakeOffset() {
    if (this.screenShake.duration <= 0) return { x: 0, y: 0 };
    const progress = this.screenShake.elapsed / this.screenShake.duration;
    const decay = 1 - progress;
    const intensity = this.screenShake.intensity * decay;
    return {
      x: Math.round((Math.random() * 2 - 1) * intensity),
      y: Math.round((Math.random() * 2 - 1) * intensity),
    };
  }

  _updateBossIntro(dt) {
    if (!this.bossIntro) {
      this.bossIntroContainer.visible = false;
      return;
    }

    this.bossIntro.elapsed += dt;
    const { elapsed, duration, bossName, bossTitle } = this.bossIntro;
    const t = elapsed / duration; // 0..1

    if (t >= 1) {
      this.bossIntro = null;
      this.bossIntroContainer.visible = false;
      return;
    }

    this.bossIntroContainer.visible = true;

    // Letterbox bar height: ease in during first 15%, hold, ease out during last 15%
    const barMax = 40;
    let barH;
    if (t < 0.12) barH = barMax * (t / 0.12);
    else if (t > 0.85) barH = barMax * (1 - (t - 0.85) / 0.15);
    else barH = barMax;

    // Draw letterbox bars
    this.bossIntroBarTop.clear();
    this.bossIntroBarTop.beginFill(0x000000);
    this.bossIntroBarTop.drawRect(0, 0, this.viewW, barH);
    this.bossIntroBarTop.endFill();

    this.bossIntroBarBottom.clear();
    this.bossIntroBarBottom.beginFill(0x000000);
    this.bossIntroBarBottom.drawRect(0, this.viewH - barH, this.viewW, barH);
    this.bossIntroBarBottom.endFill();

    // Vignette overlay: dark edges that pulse during intro
    this.bossIntroVignette.clear();
    let vigAlpha = 0;
    if (t < 0.15) vigAlpha = 0.35 * (t / 0.15);
    else if (t > 0.8) vigAlpha = 0.35 * (1 - (t - 0.8) / 0.2);
    else vigAlpha = 0.35;
    // Draw darkened border rectangles to simulate vignette
    this.bossIntroVignette.beginFill(0x000000, vigAlpha);
    const vEdge = Math.floor(this.viewW * 0.12);
    const hEdge = Math.floor(this.viewH * 0.15);
    this.bossIntroVignette.drawRect(0, barH, vEdge, this.viewH - barH * 2);  // left
    this.bossIntroVignette.drawRect(this.viewW - vEdge, barH, vEdge, this.viewH - barH * 2);  // right
    this.bossIntroVignette.endFill();
    // Softer inner vignette
    this.bossIntroVignette.beginFill(0x000000, vigAlpha * 0.4);
    this.bossIntroVignette.drawRect(vEdge, barH, vEdge * 0.6, this.viewH - barH * 2);
    this.bossIntroVignette.drawRect(this.viewW - vEdge - vEdge * 0.6, barH, vEdge * 0.6, this.viewH - barH * 2);
    this.bossIntroVignette.drawRect(0, barH, this.viewW, hEdge * 0.5);
    this.bossIntroVignette.drawRect(0, this.viewH - barH - hEdge * 0.5, this.viewW, hEdge * 0.5);
    this.bossIntroVignette.endFill();

    // Boss name text: fade in from 15%-30%, hold, fade out from 75%-88%
    let textAlpha = 0;
    if (t >= 0.15 && t < 0.30) textAlpha = (t - 0.15) / 0.15;
    else if (t >= 0.30 && t <= 0.75) textAlpha = 1;
    else if (t > 0.75 && t < 0.88) textAlpha = 1 - (t - 0.75) / 0.13;

    this.bossIntroText.text = bossName;
    this.bossIntroText.alpha = textAlpha;
    this.bossIntroText.x = this.viewW / 2;
    this.bossIntroText.y = this.viewH - barH - 38;

    // Boss subtitle (epithet): fade in slightly after name, fade out together
    if (bossTitle) {
      let subAlpha = 0;
      if (t >= 0.22 && t < 0.37) subAlpha = (t - 0.22) / 0.15;
      else if (t >= 0.37 && t <= 0.75) subAlpha = 1;
      else if (t > 0.75 && t < 0.88) subAlpha = 1 - (t - 0.75) / 0.13;
      this.bossIntroSubtitle.text = bossTitle;
      this.bossIntroSubtitle.alpha = subAlpha * 0.8;
      this.bossIntroSubtitle.x = this.viewW / 2;
      this.bossIntroSubtitle.y = this.viewH - barH - 20;
    } else {
      this.bossIntroSubtitle.alpha = 0;
    }
  }

  _getDeathStyle(monsterType) {
    // Categorize monsters into death animation styles
    const styleMap = {
      // Shadow/wraith types: dissolve (fade + expand)
      shadow_ambusher: 'dissolve', gloom_wraith: 'dissolve',
      shade_stalker: 'dissolve', shade_stalker_alpha: 'dissolve',
      rime_stalker: 'dissolve',
      // Heavy/brute types: crumble (shake + collapse)
      magma_brute: 'crumble', crystal_guardian: 'crumble',
      frost_warden: 'crumble', luddite_warlord: 'crumble',
      elder_sporecap: 'crumble', nest_mother: 'crumble',
      // Fungal types: pop (scale up then vanish)
      sporecap_shambler: 'pop', mycelium_lurker: 'pop',
      fungal_sprayer: 'pop', scrap_drone: 'pop',
      // Crystal/array types: shatter (flash + scatter)
      crystal_shard_minion: 'shatter',
      array_sentinel: 'shatter', array_fabricator: 'shatter',
    };
    return styleMap[monsterType] || 'collapse'; // default: original collapse
  }

  _spawnDeathAnim(x, y, mobId, monsterType) {
    // Try to capture the monster's sprite texture from pool before it's cleaned up
    const entry = this.monsterSprites.get(mobId);
    let tint = 0xe53935;
    if (entry && entry.sprite) {
      tint = entry.sprite.tint;
    }

    const r = CONSTANTS.MONSTER_COLLISION_RADIUS || 10;
    const container = new PIXI.Container();
    const sprite = new PIXI.Sprite(entry ? entry.sprite.texture : PIXI.Texture.WHITE);
    sprite.anchor.set(0.5);
    sprite.width = r * 2;
    sprite.height = r * 2;
    sprite.tint = tint;
    if (this.isoMode) sprite.y = -r;
    container.addChild(sprite);

    this._positionEntity(container, x, y);
    this.entityContainer.addChild(container);

    const style = this._getDeathStyle(monsterType);
    const maxAge = style === 'crumble' ? 0.5 : 0.3;

    this.deathAnims.push({
      container, sprite, x, y, style,
      age: 0, maxAge,
    });
  }

  // --- Siege Lighthouse Entity ---

  renderLighthouse() {
    const siege = this.state && this.state.siege;
    if (!siege || !siege.lighthouseX) {
      // Remove lighthouse if siege ended
      if (this.lighthouseSprite) {
        this.entityContainer.removeChild(this.lighthouseSprite);
        this.lighthouseSprite.destroy({ children: true });
        this.lighthouseSprite = null;
      }
      return;
    }

    // Create lighthouse container on first render
    if (!this.lighthouseSprite) {
      const container = new PIXI.Container();

      // Pulsing glow circle behind the lighthouse
      const glow = new PIXI.Graphics();
      glow.name = 'glow';
      container.addChild(glow);

      // Main lighthouse body (drawn procedurally)
      const body = new PIXI.Graphics();
      body.name = 'body';
      container.addChild(body);

      // Name tag
      const nameTag = new PIXI.Text('LIGHTHOUSE', {
        fontFamily: 'Courier New',
        fontSize: 10,
        fontWeight: 'bold',
        fill: '#4fc3f7',
        align: 'center',
      });
      nameTag.anchor.set(0.5, 1);
      container.addChild(nameTag);

      // Health bar background
      const hpBg = new PIXI.Graphics();
      hpBg.name = 'hpBg';
      container.addChild(hpBg);

      // Health bar fill
      const hpFill = new PIXI.Graphics();
      hpFill.name = 'hpFill';
      container.addChild(hpFill);

      this.entityContainer.addChild(container);
      this.lighthouseSprite = container;
    }

    const container = this.lighthouseSprite;
    const lhx = siege.lighthouseX;
    const lhy = siege.lighthouseY;

    this._positionEntity(container, lhx, lhy);

    const hpPct = siege.lighthouseMaxHp > 0 ? siege.lighthouseHp / siege.lighthouseMaxHp : 0;
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 800);
    const isHurt = hpPct < 0.4;

    // Glow circle
    const glow = container.getChildByName('glow');
    glow.clear();
    const glowColor = isHurt ? 0xe53935 : 0x4fc3f7;
    const glowRadius = (this.isoMode ? 28 : 24) * pulse;
    glow.beginFill(glowColor, 0.15 * pulse);
    glow.drawCircle(0, this.isoMode ? -10 : 0, glowRadius);
    glow.endFill();

    // Lighthouse body
    const body = container.getChildByName('body');
    body.clear();
    const sz = this.isoMode ? 18 : 16;
    const baseY = this.isoMode ? -sz : -sz / 2;
    // Tapered tower
    body.beginFill(0xb0bec5);
    body.moveTo(-sz / 2, baseY + sz);
    body.lineTo(-sz / 3, baseY);
    body.lineTo(sz / 3, baseY);
    body.lineTo(sz / 2, baseY + sz);
    body.closePath();
    body.endFill();
    // Beacon top
    const beaconColor = isHurt ? 0xe53935 : (hpPct < 0.7 ? 0xffa726 : 0x4fc3f7);
    body.beginFill(beaconColor);
    body.drawCircle(0, baseY - 2, 4 + pulse * 2);
    body.endFill();

    // Name tag position
    const nameTag = container.children[2]; // nameTag
    nameTag.y = baseY - 10;

    // Health bar
    const hpBg = container.getChildByName('hpBg');
    const hpFill = container.getChildByName('hpFill');
    const barW = 30;
    const barH = 3;
    const barY = this.isoMode ? 10 : sz / 2 + 4;
    hpBg.clear();
    hpBg.beginFill(0x333333);
    hpBg.drawRect(-barW / 2, barY, barW, barH);
    hpBg.endFill();
    hpFill.clear();
    const barColor = hpPct > 0.5 ? 0x4fc3f7 : (hpPct > 0.25 ? 0xffa726 : 0xe53935);
    hpFill.beginFill(barColor);
    hpFill.drawRect(-barW / 2, barY, barW * hpPct, barH);
    hpFill.endFill();
  }

  // --- Siege Announcements (center-screen floating text) ---

  renderSiegeAnnouncements() {
    const dt = 1 / 60;
    this.siegeAnnouncements = this.siegeAnnouncements.filter(ann => {
      ann.age += dt;
      if (ann.age >= ann.maxAge) {
        this.overlayContainer.removeChild(ann.textObj);
        ann.textObj.destroy();
        if (ann.subObj) {
          this.overlayContainer.removeChild(ann.subObj);
          ann.subObj.destroy();
        }
        return false;
      }
      const progress = ann.age / ann.maxAge;
      // Fade in for first 15%, hold, fade out last 30%
      let alpha;
      if (progress < 0.15) {
        alpha = progress / 0.15;
      } else if (progress > 0.7) {
        alpha = 1 - (progress - 0.7) / 0.3;
      } else {
        alpha = 1;
      }
      // Slight upward drift
      const drift = -ann.age * 12;
      ann.textObj.x = this.viewW / 2;
      ann.textObj.y = this.viewH * 0.3 + drift;
      ann.textObj.alpha = alpha;
      // Scale punch on entry
      const scale = progress < 0.1 ? 1 + (1 - progress / 0.1) * 0.3 : 1;
      ann.textObj.scale.set(scale);

      if (ann.subObj) {
        ann.subObj.x = this.viewW / 2;
        ann.subObj.y = this.viewH * 0.3 + drift + 22;
        ann.subObj.alpha = alpha * 0.8;
      }
      return true;
    });
  }

  showSiegeAnnouncement(text, color, subtitle, duration) {
    if (!this.ready) return;
    const maxAge = duration || 2.5;
    const textObj = new PIXI.Text(text, {
      fontFamily: 'Courier New',
      fontSize: 20,
      fontWeight: 'bold',
      fill: color || '#ffffff',
      align: 'center',
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowDistance: 2,
    });
    textObj.anchor.set(0.5);
    textObj.x = this.viewW / 2;
    textObj.y = this.viewH * 0.3;
    this.overlayContainer.addChild(textObj);

    let subObj = null;
    if (subtitle) {
      subObj = new PIXI.Text(subtitle, {
        fontFamily: 'Courier New',
        fontSize: 12,
        fill: '#aaaaaa',
        align: 'center',
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowDistance: 1,
      });
      subObj.anchor.set(0.5);
      subObj.x = this.viewW / 2;
      subObj.y = this.viewH * 0.3 + 22;
      this.overlayContainer.addChild(subObj);
    }

    this.siegeAnnouncements.push({ textObj, subObj, age: 0, maxAge });
  }

  renderDeathAnims() {
    const dt = 1 / 60;
    this.deathAnims = this.deathAnims.filter(da => {
      da.age += dt;
      if (da.age >= da.maxAge) {
        this.entityContainer.removeChild(da.container);
        da.container.destroy({ children: true });
        return false;
      }
      const progress = da.age / da.maxAge;

      switch (da.style) {
        case 'dissolve':
          // Expand outward and fade, ghostly dissolution
          da.container.alpha = 1 - progress * progress;
          da.sprite.scale.x = 1 + progress * 0.8;
          da.sprite.scale.y = 1 + progress * 0.8;
          da.sprite.tint = 0x7c4dff; // purple tint as it dissolves
          break;
        case 'crumble':
          // Shake then collapse downward
          da.container.alpha = 1 - progress;
          da.sprite.scale.y *= (1 - dt * 5);
          da.container.x += (Math.random() - 0.5) * 3 * (1 - progress);
          break;
        case 'pop':
          // Quick scale up then vanish
          if (progress < 0.3) {
            const expand = 1 + (progress / 0.3) * 0.6;
            da.sprite.scale.x = expand;
            da.sprite.scale.y = expand;
          } else {
            const shrink = 1 - ((progress - 0.3) / 0.7);
            da.sprite.scale.x = 1.6 * shrink;
            da.sprite.scale.y = 1.6 * shrink;
          }
          da.container.alpha = progress < 0.3 ? 1 : 1 - ((progress - 0.3) / 0.7);
          break;
        case 'shatter':
          // Brief white flash then rapid fade with scale burst
          if (progress < 0.15) {
            da.sprite.tint = 0xffffff;
            da.sprite.scale.x = 1 + progress * 3;
            da.sprite.scale.y = 1 + progress * 3;
          } else {
            da.sprite.tint = 0x80deea;
            const fade = 1 - ((progress - 0.15) / 0.85);
            da.container.alpha = fade * fade;
            da.sprite.scale.x = 1.5 * (1 + (progress - 0.15) * 0.5);
            da.sprite.scale.y = 1.5 * (1 - (progress - 0.15) * 0.8);
          }
          break;
        default: // 'collapse' — original behavior
          da.container.alpha = 1 - progress;
          da.sprite.scale.y *= (1 - dt * 4);
          break;
      }
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
        // Hit flash on the damaged entity
        this.hitFlashes.set(ev.targetId, 0.12);
        // Screen shake when player takes damage
        if (ev.targetId === this.myId) {
          this.screenShake = { intensity: 4, duration: 0.15, elapsed: 0 };
        }
      } else if (ev.type === 'darkness_damage') {
        this.damageNumbers.push({
          text: `-${ev.amount}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.0,
          color: '#7c4dff',
        });
        if (ev.targetId === this.myId) {
          this.screenShake = { intensity: 3, duration: 0.1, elapsed: 0 };
        }
      } else if (ev.type === 'hazard_damage') {
        const hazardColors = { cold: '#4fc3f7', heat: '#ff7043', poison: '#66bb6a' };
        this.damageNumbers.push({
          text: `-${ev.amount}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.0,
          color: hazardColors[ev.hazardType] || '#ff9800',
        });
        if (ev.targetId === this.myId) {
          this.screenShake = { intensity: 3, duration: 0.1, elapsed: 0 };
        }
      } else if (ev.type === 'heal') {
        this.damageNumbers.push({
          text: `+${ev.amount}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.0,
          color: '#4caf50',
        });
      } else if (ev.type === 'extraction_placed') {
        this.damageNumbers.push({
          text: 'EXTRACTION SET',
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.5,
          color: '#ff8800',
        });
      } else if (ev.type === 'pickup') {
        this.damageNumbers.push({
          text: `+${ev.itemName}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.2,
          color: '#fdd835',
        });
      } else if (ev.type === 'level_up') {
        this.damageNumbers.push({
          text: `LEVEL ${ev.newLevel}!`,
          x: ev.x, y: ev.y - 20,
          age: 0, maxAge: 2.0,
          color: '#ffa726',
        });
      } else if (ev.type === 'ambush_reveal' && ev.targetId) {
        this.ambushFadeIns.set(ev.targetId, 0.5); // 0.5s fade-in
      } else if (ev.type === 'death' && ev.targetId && ev.targetId.startsWith('mob_')) {
        this.ambushFadeIns.delete(ev.targetId);
        // Spawn death animation for monster
        this._spawnDeathAnim(ev.x, ev.y, ev.targetId, ev.monsterType);
      } else if (ev.type === 'cone_effect') {
        this.coneEffects.push({
          x: ev.x, y: ev.y,
          angle: ev.angle,
          coneAngle: (ev.coneAngle || 60) * (Math.PI / 180),
          range: ev.range,
          age: 0, maxAge: 0.4,
        });
        // Screen shake on heavy attack (cone abilities)
        if (ev.ownerId === this.myId) {
          this.screenShake = { intensity: 3, duration: 0.12, elapsed: 0 };
        }
      } else if (ev.type === 'melee_effect') {
        this.meleeEffects.push({
          x: ev.x, y: ev.y,
          angle: ev.angle,
          range: ev.range,
          age: 0, maxAge: 0.2,
        });
        // Screen shake on player's own melee strike
        if (ev.ownerId === this.myId) {
          this.screenShake = { intensity: 2, duration: 0.08, elapsed: 0 };
        }
      } else if (ev.type === 'boss_phase') {
        // Phase transition: screen shake + floating text + flash
        this.screenShake = { intensity: 8, duration: 0.5, elapsed: 0 };
        const phaseLabels = { 1: 'PHASE 1', 2: 'PHASE 2 - RANGED', 3: 'PHASE 3 - ENRAGED' };
        this.damageNumbers.push({
          text: phaseLabels[ev.phase] || `PHASE ${ev.phase}`,
          x: ev.x, y: ev.y - 30,
          age: 0, maxAge: 2.5,
          color: '#ffa726',
        });
        // Trigger CSS flash on HUD boss bar
        const track = document.querySelector('.boss-bar-track');
        if (track) {
          track.classList.remove('phase-flash');
          void track.offsetWidth; // reflow to restart animation
          track.classList.add('phase-flash');
        }
      } else if (ev.type === 'boss_summon') {
        // Summon event: lighter shake + text
        this.screenShake = { intensity: 5, duration: 0.3, elapsed: 0 };
        this.damageNumbers.push({
          text: 'SUMMONING!',
          x: ev.x, y: ev.y - 20,
          age: 0, maxAge: 1.5,
          color: '#ce93d8',
        });
      } else if (ev.type === 'battery_depleted' && ev.targetId === this.myId) {
        // Single-use battery fully drained — floating warning text
        this.damageNumbers.push({
          text: 'BATTERY LOST',
          x: ev.x, y: ev.y - 20,
          age: 0, maxAge: 1.5,
          color: '#ff6e26',
        });
      } else if (ev.type === 'stun' && ev.targetId === this.myId) {
        // Player got stunned — screen shake + floating text
        this.screenShake = { intensity: 6, duration: 0.3, elapsed: 0 };
        this.damageNumbers.push({
          text: 'STUNNED!',
          x: ev.x, y: ev.y - 16,
          age: 0, maxAge: 1.2,
          color: '#ffeb3b',
        });
      } else if (ev.type === 'lunge_start' && ev.targetId) {
        // Monster lunge — brief visual indicator + trail effect
        this.damageNumbers.push({
          text: 'LUNGE!',
          x: ev.x, y: ev.y - 16,
          age: 0, maxAge: 0.8,
          color: '#ff5722',
        });
        if (!this.lungeTrails) this.lungeTrails = [];
        this.lungeTrails.push({
          sx: ev.x, sy: ev.y, tx: ev.tx, ty: ev.ty,
          age: 0, maxAge: 0.35,
        });
      } else if (ev.type === 'lunge_hit' && ev.targetId) {
        this.screenShake = { intensity: 5, duration: 0.2, elapsed: 0 };
      } else if (ev.type === 'ground_slam') {
        // AOE ground slam — screen shake + shockwave ring
        this.screenShake = { intensity: 7, duration: 0.4, elapsed: 0 };
        this.damageNumbers.push({
          text: 'SLAM!',
          x: ev.x, y: ev.y - 16,
          age: 0, maxAge: 1.0,
          color: '#ff7043',
        });
        if (!this.shockwaveEffects) this.shockwaveEffects = [];
        this.shockwaveEffects.push({
          x: ev.x, y: ev.y,
          range: ev.range || 128,
          age: 0, maxAge: 0.5,
        });
      } else if (ev.type === 'photosensor_activated') {
        this.damageNumbers.push({
          text: 'SENSOR ACTIVATED',
          x: ev.x, y: ev.y - 16,
          age: 0, maxAge: 1.5,
          color: '#ffab40',
        });
      } else if (ev.type === 'photosensor_deactivated') {
        this.damageNumbers.push({
          text: 'SENSOR OFFLINE',
          x: ev.x, y: ev.y - 16,
          age: 0, maxAge: 1.2,
          color: '#888888',
        });
      } else if (ev.type === 'sentry_spawn') {
        this.damageNumbers.push({
          text: 'SENTRY DEPLOYED',
          x: ev.x, y: ev.y - 16,
          age: 0, maxAge: 1.2,
          color: '#4fc3f7',
        });
      } else if (ev.type === 'sentry_despawn') {
        // Clean up sprite immediately
        const oldEntry = this.sentrySprites.get(ev.sentryId);
        if (oldEntry) {
          this.entityContainer.removeChild(oldEntry.container);
          oldEntry.container.destroy({ children: true });
          this.sentrySprites.delete(ev.sentryId);
        }
      } else if (ev.type === 'pulse_cannon_explosion') {
        // Spawn explosion effect
        if (!this.explosionEffects) this.explosionEffects = [];
        this.explosionEffects.push({
          x: ev.x, y: ev.y,
          radius: ev.radius,
          age: 0, maxAge: 0.6,
        });
        this.screenShake = { intensity: 8, duration: 0.4, elapsed: 0 };
      } else if (ev.type === 'wave_start') {
        this.showSiegeAnnouncement(
          `WAVE ${ev.wave}`,
          '#e53935',
          `${ev.monsterCount} enemies incoming`,
          3.0
        );
        this.screenShake = { intensity: 4, duration: 0.3, elapsed: 0 };
      } else if (ev.type === 'wave_clear') {
        const msg = ev.wave >= ev.maxWaves ? 'FINAL WAVE CLEARED!' : `WAVE ${ev.wave} CLEARED`;
        const color = ev.wave >= ev.maxWaves ? '#ffa726' : '#66bb6a';
        this.showSiegeAnnouncement(msg, color, null, 2.5);
      } else if (ev.type === 'lighthouse_hit') {
        // Damage number at lighthouse position
        this.damageNumbers.push({
          text: `-${ev.amount}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.0,
          color: '#4fc3f7',
        });
        this.hitFlashes.set('lighthouse', 0.12);
        // Shake proportional to damage severity
        const lhPct = ev.lighthouseMaxHp > 0 ? ev.lighthouseHp / ev.lighthouseMaxHp : 0;
        this.screenShake = { intensity: lhPct < 0.3 ? 6 : 3, duration: 0.15, elapsed: 0 };
      } else if (ev.type === 'lighthouse_repair') {
        // Healing number at lighthouse position
        this.damageNumbers.push({
          text: `+${ev.amount}`,
          x: ev.x, y: ev.y,
          age: 0, maxAge: 1.2,
          color: '#66bb6a',
        });
      } else if (ev.type === 'boss_intro' && ev.playerId === this.myId) {
        // Start boss intro cinematic
        this.bossIntro = {
          bossName: ev.bossName || 'BOSS',
          bossTitle: ev.bossTitle || null,
          x: ev.x, y: ev.y,
          elapsed: 0,
          duration: 3.5,  // total cinematic length in seconds
        };
        this.screenShake = { intensity: 6, duration: 0.8, elapsed: 0 };
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
    this._minimapLabelIdx = 0;
    if (!this.map) {
      this._hideUnusedMinimapLabels();
      return;
    }

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

      // Tiles (skip unrevealed in fog of war)
      const s = Math.max(Math.round(fit * 0.9), 1);
      const sHalf = Math.floor(s / 2);
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          if (!this.isTileRevealed(tx, ty)) continue;
          const tileId = this.map.data[ty * W + tx];
          if (tileId === -1) continue;
          const tileDef = this.tileset ? this.tileset.tiles[String(tileId)] : null;
          const solid = tileDef ? tileDef.solid : true;
          this.minimapGfx.beginFill(solid ? 0x3a3a5a : 0x1a1a2e);
          this.minimapGfx.drawRect(isoX(tx, ty) - sHalf, isoY(tx, ty) - sHalf, s, s);
          this.minimapGfx.endFill();
        }
      }

      // Items (only in revealed areas)
      if (this.state && this.state.items) {
        for (const item of this.state.items) {
          const itx = Math.floor(item.x / ts), ity = Math.floor(item.y / ts);
          if (!this.isTileRevealed(itx, ity)) continue;
          const p = isoPx(item.x, item.y);
          const color = item.category === 'key' ? 0x00e5ff : 0xfdd835;
          const dot = item.category === 'key' ? dotLarge : dotSmall;
          this.minimapGfx.beginFill(color);
          this.minimapGfx.drawRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
          this.minimapGfx.endFill();
        }
      }

      // Players
      if (this.state) {
        for (const player of this.state.players) {
          const p = isoPx(player.x, player.y);
          const isMe = player.id === this.myId;
          const color = isMe ? 0xffffff : (playerColors[player.colorIndex] || 0xffffff);
          const sz = isMe ? dotLarge : dotLarge + 1;
          // Outline for other players to distinguish from items
          if (!isMe) {
            this.minimapGfx.beginFill(0x000000);
            this.minimapGfx.drawRect(p.x - (sz + 2) / 2, p.y - (sz + 2) / 2, sz + 2, sz + 2);
            this.minimapGfx.endFill();
          }
          this.minimapGfx.beginFill(color);
          this.minimapGfx.drawRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
          this.minimapGfx.endFill();
          // Name label in full map mode
          if (full && !isMe && player.name) {
            this._drawMinimapLabel(player.name, p.x, p.y - sz - 2, color);
          }
        }
      }

      // Monsters (only in revealed areas)
      if (this.state && this.state.monsters) {
        this.minimapGfx.beginFill(0xe53935);
        for (const mob of this.state.monsters) {
          const mtx = Math.floor(mob.x / ts), mty = Math.floor(mob.y / ts);
          if (!this.isTileRevealed(mtx, mty)) continue;
          const p = isoPx(mob.x, mob.y);
          this.minimapGfx.drawRect(p.x - dotSmall / 2, p.y - dotSmall / 2, dotSmall, dotSmall);
        }
        this.minimapGfx.endFill();
      }

      // Secondary quest objective dots (drawn first so primary draws on top)
      if (this.secondaryQuestObjectives) {
        for (const secObj of this.secondaryQuestObjectives) {
          if (secObj.tileX != null) {
            const sp = isoPx((secObj.tileX + 0.5) * ts, (secObj.tileY + 0.5) * ts);
            this._drawSecondaryWaypoint(sp.x, sp.y, questDotR, secObj, mmX - pad, mmY - pad, mmW + pad * 2, mmH + pad * 2, full);
          }
        }
      }

      // Quest objective waypoint marker (primary / tracked)
      if (this.questObjective && this.questObjective.tileX != null) {
        const qp = isoPx(
          (this.questObjective.tileX + 0.5) * ts,
          (this.questObjective.tileY + 0.5) * ts
        );
        this._drawQuestWaypoint(qp.x, qp.y, questDotR, this.questObjective, mmX - pad, mmY - pad, mmW + pad * 2, mmH + pad * 2, full);
      } else {
        this.questWaypointText.visible = false;
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

      // Tiles (skip unrevealed in fog of war)
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          if (!this.isTileRevealed(tx, ty)) continue;
          const tileId = this.map.data[ty * W + tx];
          if (tileId === -1) continue;
          const tileDef = this.tileset ? this.tileset.tiles[String(tileId)] : null;
          const solid = tileDef ? tileDef.solid : true;

          this.minimapGfx.beginFill(solid ? 0x3a3a5a : 0x1a1a2e);
          this.minimapGfx.drawRect(mmX + tx * scale, mmY + ty * scale, scale, scale);
          this.minimapGfx.endFill();
        }
      }

      // Items (only in revealed areas)
      if (this.state && this.state.items) {
        for (const item of this.state.items) {
          const fitx = Math.floor(item.x / ts), fity = Math.floor(item.y / ts);
          if (!this.isTileRevealed(fitx, fity)) continue;
          const dotX = Math.round(mmX + (item.x / ts) * scale);
          const dotY = Math.round(mmY + (item.y / ts) * scale);
          const color = item.category === 'key' ? 0x00e5ff : 0xfdd835;
          const dot = item.category === 'key' ? dotLarge : dotSmall;
          this.minimapGfx.beginFill(color);
          this.minimapGfx.drawRect(dotX - dot / 2, dotY - dot / 2, dot, dot);
          this.minimapGfx.endFill();
        }
      }

      // Players
      if (this.state) {
        for (const player of this.state.players) {
          const dotX = Math.round(mmX + (player.x / ts) * scale);
          const dotY = Math.round(mmY + (player.y / ts) * scale);
          const isMe = player.id === this.myId;
          const color = isMe ? 0xffffff : (playerColors[player.colorIndex] || 0xffffff);
          const sz = isMe ? dotLarge : dotLarge + 1;
          if (!isMe) {
            this.minimapGfx.beginFill(0x000000);
            this.minimapGfx.drawRect(dotX - (sz + 2) / 2, dotY - (sz + 2) / 2, sz + 2, sz + 2);
            this.minimapGfx.endFill();
          }
          this.minimapGfx.beginFill(color);
          this.minimapGfx.drawRect(dotX - sz / 2, dotY - sz / 2, sz, sz);
          this.minimapGfx.endFill();
          if (full && !isMe && player.name) {
            this._drawMinimapLabel(player.name, dotX, dotY - sz - 2, color);
          }
        }
      }

      // Monsters (only in revealed areas)
      if (this.state && this.state.monsters) {
        this.minimapGfx.beginFill(0xe53935);
        for (const mob of this.state.monsters) {
          const fmtx = Math.floor(mob.x / ts), fmty = Math.floor(mob.y / ts);
          if (!this.isTileRevealed(fmtx, fmty)) continue;
          const dotX = Math.round(mmX + (mob.x / ts) * scale);
          const dotY = Math.round(mmY + (mob.y / ts) * scale);
          this.minimapGfx.drawRect(dotX - dotSmall / 2, dotY - dotSmall / 2, dotSmall, dotSmall);
        }
        this.minimapGfx.endFill();
      }

      // Secondary quest objective dots (drawn first so primary draws on top)
      if (this.secondaryQuestObjectives) {
        for (const secObj of this.secondaryQuestObjectives) {
          if (secObj.tileX != null) {
            const sx = Math.round(mmX + secObj.tileX * scale);
            const sy = Math.round(mmY + secObj.tileY * scale);
            this._drawSecondaryWaypoint(sx, sy, questDotR, secObj, mmX - 2, mmY - 2, mmW + 4, mmH + 4, full);
          }
        }
      }

      // Quest objective waypoint marker (primary / tracked)
      if (this.questObjective && this.questObjective.tileX != null) {
        const qx = Math.round(mmX + this.questObjective.tileX * scale);
        const qy = Math.round(mmY + this.questObjective.tileY * scale);
        this._drawQuestWaypoint(qx, qy, questDotR, this.questObjective, mmX - 2, mmY - 2, mmW + 4, mmH + 4, full);
      } else {
        this.questWaypointText.visible = false;
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

    // Room name label (full map only)
    if (full && this.map.name) {
      this.roomNameText.text = this.map.name;
      this.roomNameText.x = Math.round(this.minimapBounds.x + this.minimapBounds.w / 2);
      this.roomNameText.y = Math.round(this.minimapBounds.y - 4);
      this.roomNameText.visible = true;
    } else {
      this.roomNameText.visible = false;
    }
    this._hideUnusedMinimapLabels();
  }

  _hideUnusedMinimapLabels() {
    if (!this._minimapLabels) return;
    for (let i = this._minimapLabelIdx || 0; i < this._minimapLabels.length; i++) {
      this._minimapLabels[i].visible = false;
    }
  }

  // --- Minimap player name label (full map mode only) ---

  _drawMinimapLabel(name, x, y, color) {
    // Use pooled PIXI text objects for efficiency
    if (!this._minimapLabels) this._minimapLabels = [];
    let label;
    if (this._minimapLabelIdx < this._minimapLabels.length) {
      label = this._minimapLabels[this._minimapLabelIdx];
    } else {
      label = new PIXI.Text('', {
        fontSize: 9,
        fill: 0xffffff,
        fontFamily: 'monospace',
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowDistance: 1,
      });
      label.anchor.set(0.5, 1);
      this.minimapGfx.parent.addChild(label);
      this._minimapLabels.push(label);
    }
    this._minimapLabelIdx++;
    label.text = name;
    label.style.fill = color;
    label.x = Math.round(x);
    label.y = Math.round(y);
    label.visible = true;
  }

  // --- Secondary quest waypoint (dimmer dot for non-tracked quests) ---

  _drawSecondaryWaypoint(qx, qy, baseR, objective, mmLeft, mmTop, mmWidth, mmHeight, full) {
    const inside = qx >= mmLeft && qx <= mmLeft + mmWidth &&
                   qy >= mmTop && qy <= mmTop + mmHeight;

    const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 500);
    const r = Math.max(baseR - 1, 2);
    const color = 0x90caf9; // light blue to distinguish from primary orange

    if (inside) {
      // Small circle dot
      this.minimapGfx.beginFill(color, 0.5 + pulse);
      this.minimapGfx.drawCircle(qx, qy, r);
      this.minimapGfx.endFill();

      // Subtle pulsing ring
      this.minimapGfx.lineStyle(1, color, pulse * 0.5);
      this.minimapGfx.drawCircle(qx, qy, r + 2);
      this.minimapGfx.lineStyle(0);
    } else if (!full) {
      // Edge indicator: clamp to minimap border and draw a small arrow
      const cx = mmLeft + mmWidth / 2;
      const cy = mmTop + mmHeight / 2;
      const dx = qx - cx;
      const dy = qy - cy;
      const halfW = mmWidth / 2 - 4;
      const halfH = mmHeight / 2 - 4;
      const scale = Math.min(
        Math.abs(halfW / (dx || 0.001)),
        Math.abs(halfH / (dy || 0.001))
      );
      const edgeX = cx + dx * scale;
      const edgeY = cy + dy * scale;

      // Draw small triangle pointing outward
      const angle = Math.atan2(dy, dx);
      const s = 3;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      this.minimapGfx.beginFill(color, 0.4 + pulse * 0.3);
      this.minimapGfx.moveTo(edgeX + cos * s, edgeY + sin * s);
      this.minimapGfx.lineTo(edgeX + (-sin * s * 0.7 - cos * s * 0.5), edgeY + (cos * s * 0.7 - sin * s * 0.5));
      this.minimapGfx.lineTo(edgeX + (sin * s * 0.7 - cos * s * 0.5), edgeY + (-cos * s * 0.7 - sin * s * 0.5));
      this.minimapGfx.closePath();
      this.minimapGfx.endFill();

      qx = edgeX;
      qy = edgeY;
    } else {
      return; // off-bounds in full map — skip
    }

    // Show label in full map mode
    if (objective.label && full && inside) {
      this._drawMinimapLabel(objective.label, qx, qy - r - 2, color);
    }
  }

  // --- Quest waypoint drawing helper (used by both iso and top-down minimap) ---

  _drawQuestWaypoint(qx, qy, baseR, objective, mmLeft, mmTop, mmWidth, mmHeight, full) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
    const sameRoom = objective.sameRoom !== false;
    const r = baseR;

    // Check if the marker is inside the minimap bounds
    const inside = qx >= mmLeft && qx <= mmLeft + mmWidth &&
                   qy >= mmTop && qy <= mmTop + mmHeight;

    if (inside) {
      if (sameRoom) {
        // Diamond marker for actual objective
        this.minimapGfx.beginFill(0xffa726, 0.9);
        this.minimapGfx.moveTo(qx, qy - r);
        this.minimapGfx.lineTo(qx + r, qy);
        this.minimapGfx.lineTo(qx, qy + r);
        this.minimapGfx.lineTo(qx - r, qy);
        this.minimapGfx.closePath();
        this.minimapGfx.endFill();

        // Pulsing outer ring
        this.minimapGfx.lineStyle(1, 0xffa726, pulse);
        this.minimapGfx.drawCircle(qx, qy, r + 3);
        this.minimapGfx.lineStyle(0);
      } else {
        // Chevron/arrow marker for exit-toward-objective
        const s = r + 1;
        this.minimapGfx.beginFill(0xffa726, pulse);
        // Right-pointing chevron
        this.minimapGfx.moveTo(qx + s, qy);
        this.minimapGfx.lineTo(qx - s * 0.3, qy - s);
        this.minimapGfx.lineTo(qx, qy);
        this.minimapGfx.lineTo(qx - s * 0.3, qy + s);
        this.minimapGfx.closePath();
        this.minimapGfx.endFill();

        // Pulsing outer ring
        this.minimapGfx.lineStyle(1, 0xffa726, pulse * 0.7);
        this.minimapGfx.drawCircle(qx, qy, r + 3);
        this.minimapGfx.lineStyle(0);
      }
    } else if (!full) {
      // Edge indicator: clamp to minimap border and draw a small arrow
      const cx = mmLeft + mmWidth / 2;
      const cy = mmTop + mmHeight / 2;
      const dx = qx - cx;
      const dy = qy - cy;
      const halfW = mmWidth / 2 - 4;
      const halfH = mmHeight / 2 - 4;
      const scale = Math.min(
        Math.abs(halfW / (dx || 0.001)),
        Math.abs(halfH / (dy || 0.001))
      );
      const edgeX = cx + dx * scale;
      const edgeY = cy + dy * scale;

      // Draw pulsing triangle pointing outward
      const angle = Math.atan2(dy, dx);
      const s = 4;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      this.minimapGfx.beginFill(0xffa726, pulse);
      this.minimapGfx.moveTo(edgeX + cos * s, edgeY + sin * s);
      this.minimapGfx.lineTo(edgeX + (-sin * s * 0.7 - cos * s * 0.5), edgeY + (cos * s * 0.7 - sin * s * 0.5));
      this.minimapGfx.lineTo(edgeX + (sin * s * 0.7 - cos * s * 0.5), edgeY + (-cos * s * 0.7 - sin * s * 0.5));
      this.minimapGfx.closePath();
      this.minimapGfx.endFill();

      qx = edgeX;
      qy = edgeY;
    }

    // Show label in full map mode or when marker is inside compact minimap
    if (objective.label && (full || inside)) {
      const label = sameRoom ? objective.label : objective.label + ' \u25CF';
      this.questWaypointText.text = label;
      this.questWaypointText.x = Math.round(qx);
      this.questWaypointText.y = Math.round(qy - r - 4);
      this.questWaypointText.visible = true;
      this.questWaypointText.style.fontSize = full ? 12 : 9;
    } else {
      this.questWaypointText.visible = false;
    }
  }

  // --- Quest arrow (off-screen indicator) ---

  renderQuestArrow() {
    this.questArrowGfx.clear();
    if (!this.questObjective || !this.state) return;
    // Skip world-space arrow when a UI tutorial hint is active
    if (this.questObjective.uiHint) return;

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
