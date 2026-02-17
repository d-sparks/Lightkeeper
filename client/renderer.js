// Renderer - draws the game world on a <canvas>

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Viewport size in pixels
    this.viewW = CONSTANTS.VIEWPORT_TILES_X * CONSTANTS.TILE_SIZE;
    this.viewH = CONSTANTS.VIEWPORT_TILES_Y * CONSTANTS.TILE_SIZE;
    this.canvas.width = this.viewW;
    this.canvas.height = this.viewH;

    // Camera position (top-left corner in world pixels)
    this.camX = 0;
    this.camY = 0;

    // Map + tileset data (set when server sends it)
    this.map = null;
    this.tileset = null;

    // Game state from server
    this.state = null;
    this.myId = null;

    // Tile color cache (Phase 1 placeholder rendering)
    this.tileColors = {};

    // Floating damage numbers
    this.damageNumbers = [];

    // Disable smoothing for crisp pixels
    this.ctx.imageSmoothingEnabled = false;
  }

  setMap(map, tileset) {
    this.map = map;
    this.tileset = tileset;
    this.buildTileColors();
  }

  buildTileColors() {
    if (!this.tileset) return;
    // Generate distinct colors for each tile type
    const colorMap = {
      'stone_floor':   '#2a2a3d',
      'cracked_floor': '#332a3d',
      'stone_wall':    '#5a5a7a',
      'door_closed':   '#7a6a4a',
      'door_open':     '#4a3a2a',
      'stairs_down':   '#6a3a8a',
      'stairs_up':     '#3a8a6a',
      'water':         '#2a4a6a',
      'void':          '#0d0d1a',
    };
    for (const [id, tile] of Object.entries(this.tileset.tiles)) {
      this.tileColors[id] = colorMap[tile.name] || '#ff00ff';  // Magenta = missing
    }
  }

  setState(state) {
    this.state = state;
  }

  setMyId(id) {
    this.myId = id;
  }

  // Main render call - called every animation frame
  render() {
    const ctx = this.ctx;
    const ts = CONSTANTS.TILE_SIZE;

    // Clear
    ctx.fillStyle = CONSTANTS.COLORS.background;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (!this.map || !this.state) return;

    // Update camera to follow local player
    this.updateCamera();

    // Draw tile map
    this.renderMap(ctx, ts);

    // Draw spawn points (subtle markers)
    this.renderSpawns(ctx, ts);

    // Draw exit points
    this.renderExits(ctx, ts);

    // Draw NPCs
    this.renderNPCs(ctx, ts);

    // Draw monsters
    this.renderMonsters(ctx, ts);

    // Draw players
    this.renderPlayers(ctx, ts);

    // Draw floating damage numbers
    this.renderDamageNumbers(ctx);

    // Draw minimap
    this.renderMinimap(ctx);
  }

  updateCamera() {
    if (!this.state || !this.myId) return;
    const me = this.state.players.find(p => p.id === this.myId);
    if (!me) return;

    // Center camera on player
    const targetX = me.x - this.viewW / 2;
    const targetY = me.y - this.viewH / 2;

    // Clamp to map bounds
    const mapW = this.map.width * CONSTANTS.TILE_SIZE;
    const mapH = this.map.height * CONSTANTS.TILE_SIZE;
    this.camX = Math.max(0, Math.min(targetX, mapW - this.viewW));
    this.camY = Math.max(0, Math.min(targetY, mapH - this.viewH));

    // Smooth camera (lerp)
    // this.camX += (targetX - this.camX) * 0.15;
    // this.camY += (targetY - this.camY) * 0.15;
  }

  renderMap(ctx, ts) {
    // Only draw tiles visible in the viewport
    const startTX = Math.floor(this.camX / ts);
    const startTY = Math.floor(this.camY / ts);
    const endTX = Math.ceil((this.camX + this.viewW) / ts);
    const endTY = Math.ceil((this.camY + this.viewH) / ts);

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) continue;

        const tileId = this.map.data[ty * this.map.width + tx];
        const color = this.tileColors[String(tileId)] || '#ff00ff';

        const screenX = tx * ts - this.camX;
        const screenY = ty * ts - this.camY;

        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, ts, ts);

        // Subtle grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.strokeRect(screenX, screenY, ts, ts);
      }
    }
  }

  renderSpawns(ctx, ts) {
    if (!this.map.spawns) return;
    for (const spawn of this.map.spawns) {
      const sx = (spawn.x + 0.5) * ts - this.camX;
      const sy = (spawn.y + 0.5) * ts - this.camY;

      ctx.strokeStyle = 'rgba(38, 166, 154, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, ts * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  renderExits(ctx, ts) {
    if (!this.map.exits) return;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);  // Pulsing effect

    for (const exit of this.map.exits) {
      const ex = (exit.x + 0.5) * ts - this.camX;
      const ey = (exit.y + 0.5) * ts - this.camY;

      const exitColor = exit.type === 'stairs_up' ? '38, 166, 154' : '171, 71, 188';
      ctx.fillStyle = `rgba(${exitColor}, ${0.3 + 0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(ex, ey, ts * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Arrow direction
      const isUp = exit.type === 'stairs_up';
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.3 * pulse})`;
      ctx.font = `${ts * 0.5}px Courier New`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isUp ? '▲' : '▼', ex, ey);
    }
  }

  renderNPCs(ctx, ts) {
    if (!this.state || !this.state.npcs) return;

    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 800);

    for (const npc of this.state.npcs) {
      const nx = npc.x - this.camX;
      const ny = npc.y - this.camY;

      // NPC body (diamond shape)
      ctx.fillStyle = CONSTANTS.COLORS.npc;
      ctx.beginPath();
      const r = CONSTANTS.PLAYER_RADIUS;
      ctx.moveTo(nx, ny - r);       // top
      ctx.lineTo(nx + r, ny);       // right
      ctx.lineTo(nx, ny + r);       // bottom
      ctx.lineTo(nx - r, ny);       // left
      ctx.closePath();
      ctx.fill();

      // Outline
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Name tag
      ctx.fillStyle = '#64b5f6';
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(npc.name, nx, ny - r - 6);

      // Interact prompt if local player is nearby
      if (this.myId && this.state) {
        const me = this.state.players.find(p => p.id === this.myId);
        if (me) {
          const dx = npc.x - me.x;
          const dy = npc.y - me.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const range = CONSTANTS.NPC_INTERACT_RANGE * CONSTANTS.TILE_SIZE;
          if (dist < range) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.3 * pulse})`;
            ctx.font = '10px Courier New';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('[E] Talk', nx, ny + r + 4);
          }
        }
      }
    }
  }

  renderPlayers(ctx, ts) {
    if (!this.state) return;

    for (const player of this.state.players) {
      const px = player.x - this.camX;
      const py = player.y - this.camY;
      const color = CONSTANTS.COLORS.player[player.colorIndex] || '#ffffff';
      const isMe = player.id === this.myId;

      // Player body (circle)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, CONSTANTS.PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Darker outline
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Facing direction indicator (small dot)
      const faceDist = CONSTANTS.PLAYER_RADIUS + 4;
      const fx = px + Math.cos(player.facing) * faceDist;
      const fy = py + Math.sin(player.facing) * faceDist;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Name tag
      ctx.fillStyle = isMe ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(player.name, px, py - CONSTANTS.PLAYER_RADIUS - 6);

      // Health bar (only show if damaged or for self)
      if (player.health < player.maxHealth || isMe) {
        const barW = 30;
        const barH = 4;
        const barX = px - barW / 2;
        const barY = py - CONSTANTS.PLAYER_RADIUS - 4;
        const healthPct = player.health / player.maxHealth;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = healthPct > 0.5 ? '#4caf50' : healthPct > 0.25 ? '#ffa726' : '#e53935';
        ctx.fillRect(barX, barY, barW * healthPct, barH);
      }

      // "You" indicator
      if (isMe) {
        ctx.strokeStyle = `rgba(255, 255, 255, 0.4)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(px, py, CONSTANTS.PLAYER_RADIUS + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  renderMonsters(ctx, ts) {
    if (!this.state || !this.state.monsters) return;

    for (const mob of this.state.monsters) {
      const mx = mob.x - this.camX;
      const my = mob.y - this.camY;
      const r = CONSTANTS.MONSTER_COLLISION_RADIUS || 10;

      // Monster body (circle, red)
      ctx.fillStyle = CONSTANTS.COLORS.monster;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Facing indicator
      const fd = r + 3;
      ctx.fillStyle = '#faa';
      ctx.beginPath();
      ctx.arc(mx + Math.cos(mob.facing) * fd, my + Math.sin(mob.facing) * fd, 2, 0, Math.PI * 2);
      ctx.fill();

      // Name tag
      ctx.fillStyle = '#e57373';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(mob.name, mx, my - r - 6);

      // Health bar
      const barW = 26;
      const barH = 3;
      const barX = mx - barW / 2;
      const barY = my - r - 4;
      const hp = mob.health / mob.maxHealth;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hp > 0.5 ? '#e53935' : '#ff6f00';
      ctx.fillRect(barX, barY, barW * hp, barH);
    }
  }

  processEvents(events) {
    if (!events) return;
    for (const ev of events) {
      if (ev.type === 'damage') {
        this.damageNumbers.push({
          text: `-${ev.amount}`,
          x: ev.x,
          y: ev.y,
          age: 0,
          maxAge: 1.0,
          color: ev.targetId.startsWith('mob_') ? '#ffa726' : '#e53935',
        });
      }
    }
  }

  renderDamageNumbers(ctx) {
    const dt = 1 / 60; // approximate frame time
    this.damageNumbers = this.damageNumbers.filter(dn => {
      dn.age += dt;
      if (dn.age >= dn.maxAge) return false;

      const alpha = 1 - (dn.age / dn.maxAge);
      const offsetY = dn.age * 40; // float upward
      const sx = dn.x - this.camX;
      const sy = dn.y - this.camY - offsetY;

      ctx.fillStyle = dn.color.replace(')', `,${alpha})`).replace('rgb', 'rgba');
      // Simpler approach: set globalAlpha
      ctx.globalAlpha = alpha;
      ctx.fillStyle = dn.color;
      ctx.font = 'bold 13px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dn.text, sx, sy);
      ctx.globalAlpha = 1;
      return true;
    });
  }

  renderMinimap(ctx) {
    if (!this.map) return;

    const scale = 3;  // pixels per tile on minimap
    const mmW = this.map.width * scale;
    const mmH = this.map.height * scale;
    const mmX = this.viewW - mmW - 10;
    const mmY = 10;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);

    // Tiles
    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = 0; tx < this.map.width; tx++) {
        const tileId = this.map.data[ty * this.map.width + tx];
        const tileDef = this.tileset ? this.tileset.tiles[String(tileId)] : null;
        const solid = tileDef ? tileDef.solid : true;

        ctx.fillStyle = solid ? '#3a3a5a' : '#1a1a2e';
        ctx.fillRect(mmX + tx * scale, mmY + ty * scale, scale, scale);
      }
    }

    // Players on minimap
    if (this.state) {
      const ts = CONSTANTS.TILE_SIZE;
      for (const player of this.state.players) {
        const dotX = mmX + (player.x / ts) * scale;
        const dotY = mmY + (player.y / ts) * scale;
        const color = player.id === this.myId ? '#fff' : CONSTANTS.COLORS.player[player.colorIndex];
        ctx.fillStyle = color;
        ctx.fillRect(dotX - 1, dotY - 1, 3, 3);
      }
    }

    // Monsters on minimap
    if (this.state && this.state.monsters) {
      for (const mob of this.state.monsters) {
        const dotX = mmX + (mob.x / ts) * scale;
        const dotY = mmY + (mob.y / ts) * scale;
        ctx.fillStyle = CONSTANTS.COLORS.monster;
        ctx.fillRect(dotX - 1, dotY - 1, 2, 2);
      }
    }

    // Viewport rectangle
    const ts2 = CONSTANTS.TILE_SIZE;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mmX + (this.camX / ts2) * scale,
      mmY + (this.camY / ts2) * scale,
      CONSTANTS.VIEWPORT_TILES_X * scale,
      CONSTANTS.VIEWPORT_TILES_Y * scale
    );
  }
}
