// Input handler - tracks keyboard state and virtual joystick

class InputHandler {
  constructor(net) {
    this.net = net;
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
    this.lastSent = '';  // Avoid sending duplicate input states
    this.active = false;

    // Callbacks
    this.onInteract = null;
    this.onInventoryToggle = null;
    this.onAttack = null;

    // Click-to-move state
    this.renderer = null;        // Set by main.js
    this.moveTarget = null;      // { x, y, interactType?, interactRange? }
    this.clickMoving = false;    // True when click-to-move is driving input
    this.dialogueActive = false; // Set by main.js to block click-to-move
    this.inventoryOpen = false;  // Set by main.js to block click-to-move

    // Key mappings: keyboard key -> game action
    this.keyMap = {
      'ArrowUp':    'up',
      'ArrowDown':  'down',
      'ArrowLeft':  'left',
      'ArrowRight': 'right',
      'w': 'up',    'W': 'up',
      's': 'down',  'S': 'down',
      'a': 'left',  'A': 'left',
      'd': 'right', 'D': 'right',
    };

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    // Virtual joystick state
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joyDX = 0;
    this.joyDY = 0;

    // DOM elements (set in setupTouch)
    this.joystickZone = null;
    this.joystickThumb = null;
    this.interactBtn = null;
    this.inventoryBtn = null;
    this.attackBtn = null;
  }

  start() {
    this.active = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.setupTouch();
    this.setupMouse();
  }

  stop() {
    this.active = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // --- Keyboard ---

  onKeyDown(e) {
    // Interact key (E or Enter)
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      e.preventDefault();
      if (this.onInteract) this.onInteract();
      return;
    }

    // Inventory toggle (I)
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      if (this.onInventoryToggle) this.onInventoryToggle();
      return;
    }

    // Attack key (Space)
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (this.onAttack) this.onAttack();
      return;
    }

    const action = this.keyMap[e.key];
    if (action) {
      e.preventDefault();
      // Keyboard movement cancels click-to-move
      this.clearMoveTarget();
      if (!this.keys[action]) {
        this.keys[action] = true;
        this.sendInput();
      }
    }
  }

  onKeyUp(e) {
    const action = this.keyMap[e.key];
    if (action) {
      e.preventDefault();
      if (this.keys[action]) {
        this.keys[action] = false;
        this.sendInput();
      }
    }
  }

  // --- Virtual joystick (touch) ---

  setupTouch() {
    this.joystickZone = document.getElementById('joystick-zone');
    this.joystickThumb = document.getElementById('joystick-thumb');
    this.interactBtn = document.getElementById('interact-btn');
    this.inventoryBtn = document.getElementById('inventory-btn');
    this.attackBtn = document.getElementById('attack-btn');

    if (!this.joystickZone) return;

    this.joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.joystickActive = true;
      this.joystickTouchId = t.identifier;
      this.handleJoystickMove(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.joystickActive) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystickTouchId) {
          e.preventDefault();
          this.handleJoystickMove(t.clientX, t.clientY);
          break;
        }
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystickTouchId) {
          this.resetJoystick();
          break;
        }
      }
    });

    window.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystickTouchId) {
          this.resetJoystick();
          break;
        }
      }
    });

    // Interact button
    if (this.interactBtn) {
      this.interactBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onInteract) this.onInteract();
      }, { passive: false });

      this.interactBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onInteract) this.onInteract();
      });
    }

    // Inventory button (mobile)
    if (this.inventoryBtn) {
      this.inventoryBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onInventoryToggle) this.onInventoryToggle();
      }, { passive: false });

      this.inventoryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onInventoryToggle) this.onInventoryToggle();
      });
    }

    // Attack button (mobile)
    if (this.attackBtn) {
      this.attackBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onAttack) this.onAttack();
      }, { passive: false });

      this.attackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onAttack) this.onAttack();
      });
    }

    // Prevent accidental zooming / scrolling
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
  }

  getJoystickCenter() {
    const rect = this.joystickZone.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  handleJoystickMove(clientX, clientY) {
    const center = this.getJoystickCenter();
    const maxDist = 50;
    let dx = clientX - center.x;
    let dy = clientY - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    // Visual feedback
    if (this.joystickThumb) {
      this.joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.joystickThumb.style.background = 'rgba(255,167,38,0.55)';
    }

    // Dead zone
    const deadZone = 12;
    if (dist < deadZone) {
      this.joyDX = 0;
      this.joyDY = 0;
    } else {
      this.joyDX = dx / maxDist;
      this.joyDY = dy / maxDist;
    }

    this.sendJoystickInput();
  }

  resetJoystick() {
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joyDX = 0;
    this.joyDY = 0;

    if (this.joystickThumb) {
      this.joystickThumb.style.transform = 'translate(-50%, -50%)';
      this.joystickThumb.style.background = 'rgba(255,167,38,0.35)';
    }

    this.sendJoystickInput();
  }

  // --- Click-to-move (mouse) ---

  setupMouse() {
    if (!this.renderer || !this.renderer.canvas) return;
    const canvas = this.renderer.canvas;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      if (!this.active) return;
      if (this.dialogueActive) {
        e.preventDefault();
        if (this.onInteract) this.onInteract();
        return;
      }
      if (this.inventoryOpen) return;

      e.preventDefault();
      const world = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.handleClickAt(world.x, world.y);
    });

    // Prevent context menu on right-click over canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  handleClickAt(worldX, worldY) {
    const state = this.renderer.state;
    if (!state || !this.renderer.myId) return;

    const ts = CONSTANTS.TILE_SIZE;
    const clickRadius = ts * 1.0; // How close a click needs to be to an entity

    // Check items
    if (state.items) {
      for (const item of state.items) {
        const dx = worldX - item.x, dy = worldY - item.y;
        if (Math.sqrt(dx * dx + dy * dy) < clickRadius) {
          this.setMoveTarget(item.x, item.y, 'item', CONSTANTS.ITEM_PICKUP_RANGE * ts);
          return;
        }
      }
    }

    // Check NPCs
    if (state.npcs) {
      for (const npc of state.npcs) {
        const dx = worldX - npc.x, dy = worldY - npc.y;
        if (Math.sqrt(dx * dx + dy * dy) < clickRadius) {
          this.setMoveTarget(npc.x, npc.y, 'npc', CONSTANTS.NPC_INTERACT_RANGE * ts);
          return;
        }
      }
    }

    // Check monsters (move toward them; auto-attack handles the rest)
    if (state.monsters) {
      for (const mob of state.monsters) {
        const dx = worldX - mob.x, dy = worldY - mob.y;
        if (Math.sqrt(dx * dx + dy * dy) < clickRadius) {
          this.setMoveTarget(mob.x, mob.y, 'monster', CONSTANTS.PLAYER_ATTACK_RANGE * ts);
          return;
        }
      }
    }

    // Check doors (tile at click position)
    if (this.renderer.map && this.renderer.tileset) {
      const tx = Math.floor(worldX / ts);
      const ty = Math.floor(worldY / ts);
      const map = this.renderer.map;
      if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) {
        const tileId = map.data[ty * map.width + tx];
        const tileDef = this.renderer.tileset.tiles[String(tileId)];
        if (tileDef && tileDef.interactable === 'door') {
          const doorX = (tx + 0.5) * ts;
          const doorY = (ty + 0.5) * ts;
          this.setMoveTarget(doorX, doorY, 'door', CONSTANTS.DOOR_INTERACT_RANGE * ts);
          return;
        }
      }
    }

    // Plain ground click — move to position
    this.setMoveTarget(worldX, worldY, null, 0);
  }

  setMoveTarget(x, y, interactType, interactRange) {
    this.moveTarget = { x, y, interactType, interactRange: interactRange || 0 };
    this.clickMoving = true;
    if (this.renderer) this.renderer.clickTarget = { x, y };
  }

  clearMoveTarget() {
    if (!this.moveTarget) return;
    this.moveTarget = null;
    this.clickMoving = false;
    if (this.renderer) this.renderer.clickTarget = null;
  }

  // Called from main.js on each state update with the player's current position
  updateClickToMove(playerX, playerY) {
    if (!this.moveTarget) return;

    const dx = this.moveTarget.x - playerX;
    const dy = this.moveTarget.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check if we should interact
    if (this.moveTarget.interactType && dist < this.moveTarget.interactRange) {
      this.clearMoveTarget();
      // Stop movement
      this.keys = { up: false, down: false, left: false, right: false };
      this.sendInput();
      // Fire interact
      if (this.onInteract) this.onInteract();
      return;
    }

    // Check if we've arrived (ground click)
    const arrivalThreshold = this.moveTarget.interactType ? this.moveTarget.interactRange : 6;
    if (dist < arrivalThreshold) {
      this.clearMoveTarget();
      this.keys = { up: false, down: false, left: false, right: false };
      this.sendInput();
      return;
    }

    // Compute directional input toward target
    const threshold = 0.3;
    const len = dist; // already computed
    const nx = dx / len;
    const ny = dy / len;

    this.keys = {
      up:    ny < -threshold,
      down:  ny > threshold,
      left:  nx < -threshold,
      right: nx > threshold,
    };
    this.sendInput();
  }

  sendJoystickInput() {
    // Convert analog joystick to cardinal directions with threshold
    const threshold = 0.3;
    const newKeys = {
      up:    this.joyDY < -threshold,
      down:  this.joyDY > threshold,
      left:  this.joyDX < -threshold,
      right: this.joyDX > threshold,
    };

    // Merge with keyboard: either source can activate a direction
    const merged = {
      up:    this.keys.up    || newKeys.up,
      down:  this.keys.down  || newKeys.down,
      left:  this.keys.left  || newKeys.left,
      right: this.keys.right || newKeys.right,
    };

    const json = JSON.stringify(merged);
    if (json === this.lastSent) return;
    this.lastSent = json;

    this.net.send({
      type: CONSTANTS.MSG.INPUT,
      keys: merged,
    });
  }

  sendInput() {
    // Re-use joystick-aware send so both sources are merged
    this.sendJoystickInput();
  }
}
