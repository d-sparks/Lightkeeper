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
    this.onAction = null;          // (slotNumber, modified) => void
    this.onModifierChanged = null; // (active) => void
    this.modifierActive = false;

    // Click-to-move state
    this.renderer = null;        // Set by main.js
    this.moveTarget = null;      // { x, y, interactType?, interactRange? }
    this.clickMoving = false;    // True when click-to-move is driving input
    this.dialogueActive = false; // Set by main.js to block click-to-move
    this.inventoryOpen = false;  // Set by main.js to block click-to-move

    // Aim state
    this.mouseWorldX = 0;
    this.mouseWorldY = 0;
    this.aimDX = 0;
    this.aimDY = 0;
    this.aimJoystickActive = false;
    this.aimJoystickTouchId = null;

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
    this.aimJoystickZone = null;
    this.aimJoystickThumb = null;
  }

  start() {
    this.active = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this._onBlur = () => {
      if (this.modifierActive) {
        this.modifierActive = false;
        if (this.onModifierChanged) this.onModifierChanged(false);
      }
    };
    window.addEventListener('blur', this._onBlur);
    this.setupTouch();
    this.setupMouse();
  }

  stop() {
    this.active = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this._onBlur) window.removeEventListener('blur', this._onBlur);
  }

  // --- Keyboard ---

  onKeyDown(e) {
    // Track modifier (Shift)
    if (e.key === 'Shift') {
      if (!this.modifierActive) {
        this.modifierActive = true;
        // Immobilize: clear all movement keys and send stop
        this.keys = { up: false, down: false, left: false, right: false };
        this.clearMoveTarget();
        this.sendInput();
        if (this.onModifierChanged) this.onModifierChanged(true);
      }
      return;
    }

    // Number keys 1-4 → action slots (use e.code to handle Shift+number correctly)
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
      e.preventDefault();
      const slotNum = parseInt(e.code.charAt(5));
      if (this.onAction) this.onAction(slotNum, this.modifierActive);
      return;
    }

    // Legacy: Space → slot 1
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (this.onAction) this.onAction(1, false);
      return;
    }

    // Legacy: E/Enter → slot 4 (interact)
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      e.preventDefault();
      if (this.onAction) this.onAction(4, false);
      return;
    }

    // Legacy: I → modifier+slot 4 (inventory)
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      if (this.onAction) this.onAction(4, true);
      return;
    }

    // Block movement while modifier (Shift) is active
    if (this.modifierActive) return;

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
    // Track modifier release
    if (e.key === 'Shift') {
      if (this.modifierActive) {
        this.modifierActive = false;
        if (this.onModifierChanged) this.onModifierChanged(false);
      }
      return;
    }

    const action = this.keyMap[e.key];
    if (action) {
      e.preventDefault();
      if (this.keys[action]) {
        this.keys[action] = false;
        this.sendInput();
      }
    }
  }

  // --- Aim angle ---

  getAimAngle(playerX, playerY) {
    // Mobile aim joystick takes priority
    if (this.aimJoystickActive) {
      const len = Math.sqrt(this.aimDX * this.aimDX + this.aimDY * this.aimDY);
      if (len > 0.01) {
        return Math.atan2(this.aimDY, this.aimDX);
      }
      return null;
    }

    // Desktop: use mouse position
    const dx = this.mouseWorldX - playerX;
    const dy = this.mouseWorldY - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return null; // Too close, no valid aim
    return Math.atan2(dy, dx);
  }

  // --- Virtual joystick (touch) ---

  setupTouch() {
    this.joystickZone = document.getElementById('joystick-zone');
    this.joystickThumb = document.getElementById('joystick-thumb');

    if (!this.joystickZone) return;

    this.joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.joystickActive = true;
      this.joystickTouchId = t.identifier;
      this.handleJoystickMove(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (this.joystickActive && t.identifier === this.joystickTouchId) {
          e.preventDefault();
          this.handleJoystickMove(t.clientX, t.clientY);
        }
        if (this.aimJoystickActive && t.identifier === this.aimJoystickTouchId) {
          e.preventDefault();
          this.handleAimJoystickMove(t.clientX, t.clientY);
        }
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystickTouchId) {
          this.resetJoystick();
        }
        if (t.identifier === this.aimJoystickTouchId) {
          this.resetAimJoystick();
        }
      }
    });

    window.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystickTouchId) {
          this.resetJoystick();
        }
        if (t.identifier === this.aimJoystickTouchId) {
          this.resetAimJoystick();
        }
      }
    });

    // Aim joystick
    this.aimJoystickZone = document.getElementById('aim-joystick-zone');
    this.aimJoystickThumb = document.getElementById('aim-joystick-thumb');
    if (this.aimJoystickZone) {
      this.aimJoystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this.aimJoystickActive = true;
        this.aimJoystickTouchId = t.identifier;
        this.modifierActive = true;
        if (this.onModifierChanged) this.onModifierChanged(true);
        this.handleAimJoystickMove(t.clientX, t.clientY);
      }, { passive: false });
    }

    // Mobile action buttons (slot-based)
    const actionBtns = document.querySelectorAll('.action-btn[data-slot]');
    for (const btn of actionBtns) {
      if (btn.classList.contains('empty')) continue;
      const slot = parseInt(btn.getAttribute('data-slot'));
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onAction) this.onAction(slot, this.modifierActive);
      }, { passive: false });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onAction) this.onAction(slot, this.modifierActive);
      });
    }

    // Desktop action bar click support
    const desktopSlots = document.querySelectorAll('.action-slot[data-slot]');
    for (const slot of desktopSlots) {
      if (slot.classList.contains('empty')) continue;
      const slotNum = parseInt(slot.getAttribute('data-slot'));
      slot.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onAction) this.onAction(slotNum, this.modifierActive);
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

  // --- Aim joystick ---

  getAimJoystickCenter() {
    const rect = this.aimJoystickZone.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  handleAimJoystickMove(clientX, clientY) {
    const center = this.getAimJoystickCenter();
    const maxDist = 35;
    let dx = clientX - center.x;
    let dy = clientY - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    // Visual feedback
    if (this.aimJoystickThumb) {
      this.aimJoystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.aimJoystickThumb.style.background = 'rgba(179,157,219,0.55)';
    }

    // Dead zone
    const deadZone = 8;
    if (dist < deadZone) {
      this.aimDX = 0;
      this.aimDY = 0;
    } else {
      this.aimDX = dx / maxDist;
      this.aimDY = dy / maxDist;
    }
  }

  resetAimJoystick() {
    this.aimJoystickActive = false;
    this.aimJoystickTouchId = null;
    this.aimDX = 0;
    this.aimDY = 0;
    this.modifierActive = false;

    if (this.aimJoystickThumb) {
      this.aimJoystickThumb.style.transform = 'translate(-50%, -50%)';
      this.aimJoystickThumb.style.background = 'rgba(179,157,219,0.35)';
    }

    if (this.onModifierChanged) this.onModifierChanged(false);
  }

  // --- Click-to-move (mouse) ---

  setupMouse() {
    if (!this.renderer || !this.renderer.canvas) return;
    const canvas = this.renderer.canvas;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      if (!this.active) return;

      // Shift+click fires blaster toward click position
      if (this.modifierActive) {
        e.preventDefault();
        const world = this.renderer.screenToWorld(e.clientX, e.clientY);
        this.mouseWorldX = world.x;
        this.mouseWorldY = world.y;
        if (this.onAction) this.onAction(1, true);
        return;
      }

      if (this.dialogueActive) {
        e.preventDefault();
        if (this.onAction) this.onAction(4, false);
        return;
      }
      if (this.inventoryOpen) return;

      e.preventDefault();
      const world = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.handleClickAt(world.x, world.y);
    });

    // Continuous mouse tracking for aim direction
    canvas.addEventListener('mousemove', (e) => {
      if (!this.renderer) return;
      const world = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.mouseWorldX = world.x;
      this.mouseWorldY = world.y;
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
      if (this.onAction) this.onAction(4, false);
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
