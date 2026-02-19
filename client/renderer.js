// Renderer - draws the game world using PixiJS
// Retained-mode: create display objects once, update properties each frame.

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // Viewport tiles
    this.viewportTX = CONSTANTS.VIEWPORT_TILES_X;
    this.viewportTY = CONSTANTS.VIEWPORT_TILES_Y;

    // Viewport size in pixels
    this.viewW = this.viewportTX * CONSTANTS.TILE_SIZE;
    this.viewH = this.viewportTY * CONSTANTS.TILE_SIZE;

    // Camera position (top-left corner in world pixels)
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

    // Entity sprite pools: id -> { container, sprite, nameTag, healthBar, ... }
    this.playerSprites = new Map();
    this.monsterSprites = new Map();
    this.npcSprites = new Map();
    this.itemSprites = new Map();

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

  // --- Public API (same as before) ---

  resizeToFit(availW, availH) {
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
    this.renderItems();
    this.renderNPCs();
    this.renderMonsters();
    this.renderPlayers();
    this.renderDoorPrompts();
    this.renderDamageNumbers();
    this.renderMinimap();

    // Y-sort the entity container
    this.entityContainer.sortChildren();

    // Flush PixiJS scene to WebGL/canvas
    this.app.render();
  }

  updateCamera() {
    if (!this.state || !this.myId) return;
    const me = this.state.players.find(p => p.id === this.myId);
    if (!me) return;

    const targetX = me.x - this.viewW / 2;
    const targetY = me.y - this.viewH / 2;

    const mapW = this.map.width * CONSTANTS.TILE_SIZE;
    const mapH = this.map.height * CONSTANTS.TILE_SIZE;
    this.camX = Math.max(0, Math.min(targetX, mapW - this.viewW));
    this.camY = Math.max(0, Math.min(targetY, mapH - this.viewH));
  }

  // --- Tile rendering ---

  renderMap() {
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
          // Fallback: white texture tinted to tile color
          sprite.texture = PIXI.Texture.WHITE;
          sprite.tint = this.tileColors[tileId] !== undefined ? this.tileColors[tileId] : 0xff00ff;
        }
      }
    }

    // Hide any remaining sprites in pool
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
      const sx = (spawn.x + 0.5) * ts;
      const sy = (spawn.y + 0.5) * ts;
      this.spawnGfx.drawCircle(sx, sy, ts * 0.3);
    }
  }

  // --- Exit markers ---

  renderExits() {
    this.exitGfx.clear();
    if (!this.map.exits) return;
    const ts = CONSTANTS.TILE_SIZE;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);

    for (const exit of this.map.exits) {
      const ex = (exit.x + 0.5) * ts;
      const ey = (exit.y + 0.5) * ts;
      const isUp = exit.type === 'stairs_up';
      const color = isUp ? 0x26a69a : 0xab47bc;

      this.exitGfx.beginFill(color, 0.3 + 0.3 * pulse);
      this.exitGfx.drawCircle(ex, ey, ts * 0.35);
      this.exitGfx.endFill();
    }
  }

  // --- Entity helpers ---

  _getOrCreateEntityContainer(pool, id) {
    if (pool.has(id)) return pool.get(id);

    const container = new PIXI.Container();
    container.sortableChildren = false;

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
    if (tex.valid) {
      sprite.texture = tex;
      sprite.tint = 0xffffff;
      const ts = CONSTANTS.TILE_SIZE;
      sprite.width = ts;
      sprite.height = ts;
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

      container.x = item.x;
      container.y = item.y + bob;
      container.zIndex = item.y;

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

      container.x = npc.x;
      container.y = npc.y;
      container.zIndex = npc.y;

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

      container.x = mob.x;
      container.y = mob.y;
      container.zIndex = mob.y;

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

      container.x = player.x;
      container.y = player.y;
      container.zIndex = player.y;

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
          text.x = tileCX;
          text.y = tileCY - ts * 0.4;
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
      const sx = dn.x - this.camX;
      const sy = dn.y - this.camY - offsetY;

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
    const scale = 3;
    const mmW = this.map.width * scale;
    const mmH = this.map.height * scale;
    const mmX = this.viewW - mmW - 10;
    const mmY = 10;

    // Background
    this.minimapGfx.beginFill(0x000000, 0.6);
    this.minimapGfx.drawRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
    this.minimapGfx.endFill();

    // Tiles
    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = 0; tx < this.map.width; tx++) {
        const tileId = this.map.data[ty * this.map.width + tx];
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
