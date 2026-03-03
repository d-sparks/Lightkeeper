// Input handler — keyboard, touch, mouse, gamepad
// Abilities: 6 slots, each fires with an aim angle.
//   Keyboard/mouse: aim angle comes from mouse cursor position.
//   Mobile: tap = auto-aim (null), press-drag-release = manual aim.
//   Gamepad: aim angle comes from right stick.
// Interact + Inventory are separate actions (not ability slots).

class InputHandler {
  constructor(net) {
    this.net = net;
    this.keys = { up: false, down: false, left: false, right: false };
    this.lastSent = '';
    this.active = false;

    // Callbacks — set by main.js
    this.onAbility = null;       // (slot, aimAngle) => void
    this.onInteract = null;      // () => void
    this.onInventory = null;     // () => void
    this.onQuestPanel = null;    // () => void
    this.onMapToggle = null;     // () => void — Tab toggle full map
    this.onMenuOpen = null;      // () => void — Y button toggle menu
    this.onMenuCycle = null;     // (direction) => void — LT/RT when menu open
    this.onMenuNavigate = null;  // (direction) => void — D-pad/stick when menu open
    this.onMenuConfirm = null;   // () => void — A when menu open
    this.onMenuClose = null;     // () => void — B when menu open
    this.onChoiceNavigate = null; // (direction) => void — D-pad/stick when choice menu open
    this.onChoiceConfirm = null;  // () => void — A when choice menu open

    // Click-to-move
    this.renderer = null;
    this.moveTarget = null;
    this.clickMoving = false;
    this.dialogueActive = false;
    this.choiceActive = false;
    this.menuOpen = false;

    // Diablo-style ability selection
    this.selectedAbility = 2;  // right-click defaults to slot 2
    this.shiftHeld = false;
    this.combatTarget = null;  // { monsterId } for click-to-attack

    // Mouse aim
    this.mouseWorldX = 0;
    this.mouseWorldY = 0;
    this.mouseActive = false;  // true once mouse has been moved on canvas

    // Mobile ability drag-to-aim
    this.abilityDrag = null;  // { slot, startX, startY, touchId, moved }

    // Aim indicator (read by renderer to draw aim line)
    this.aimIndicator = { active: false, angle: 0 };

    // Movement joystick
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joyDX = 0;
    this.joyDY = 0;
    this.joystickZone = null;
    this.joystickThumb = null;

    // Gamepad
    this.gamepadIndex = null;
    this.gamepadPrevButtons = [];
    this.gamepadKeys = { up: false, down: false, left: false, right: false };
    this.gamepadDX = 0;  // analog stick values for omnidirectional movement
    this.gamepadDY = 0;
    this.menuNavTimer = 0;  // throttle stick navigation in menus

    // Click-to-move analog direction
    this.moveDX = 0;
    this.moveDY = 0;

    // Key mappings
    this.keyMap = {
      'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
      'w': 'up', 'W': 'up', 's': 'down', 'S': 'down',
      'a': 'left', 'A': 'left', 'd': 'right', 'D': 'right',
    };

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  start() {
    this.active = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.setupTouch();
    this.setupMouse();
    this.startGamepadPolling();
    this.selectAbility(this.selectedAbility);
  }

  stop() {
    this.active = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // ===================== Keyboard =====================

  onKeyDown(e) {
    if (!this.active) return;

    // Shift tracking
    if (e.key === 'Shift') {
      this.shiftHeld = true;
      return;
    }

    // Ability keys 1-6: select (no shift) or instant-cast (with shift)
    const digitMatch = e.code.match(/^Digit([1-6])$/);
    if (digitMatch) {
      e.preventDefault();
      const slot = parseInt(digitMatch[1]);
      if (this.shiftHeld) {
        // Shift+number: instant-cast with autoaim
        if (this.onAbility) this.onAbility(slot, null);
      } else {
        // Number only: select for right-click
        this.selectAbility(slot);
      }
      return;
    }

    // R → slot 5, G → slot 6 (select or shift-cast)
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (this.shiftHeld) {
        if (this.onAbility) this.onAbility(5, null);
      } else {
        this.selectAbility(5);
      }
      return;
    }
    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      if (this.shiftHeld) {
        if (this.onAbility) this.onAbility(6, null);
      } else {
        this.selectAbility(6);
      }
      return;
    }

    // Space → ability 1 at cursor
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      const aimAngle = this.getMouseAimAngle();
      if (this.onAbility) this.onAbility(1, aimAngle);
      return;
    }

    // E / Enter → interact
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      e.preventDefault();
      if (this.onInteract) this.onInteract();
      return;
    }

    // I → inventory/menu
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      if (this.onInventory) this.onInventory();
      return;
    }

    // Tab → toggle full map
    if (e.key === 'Tab') {
      e.preventDefault();
      if (this.onMapToggle) this.onMapToggle();
      return;
    }

    // M → quest panel
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      if (this.onQuestPanel) this.onQuestPanel();
      return;
    }

    // Escape → close menu
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.menuOpen && this.onMenuClose) this.onMenuClose();
      return;
    }

    // Movement — also clears combat target (suppress while menu is open)
    const action = this.keyMap[e.key];
    if (action) {
      e.preventDefault();
      if (this.menuOpen) return;
      this.combatTarget = null;
      this.clearMoveTarget();
      if (!this.keys[action]) {
        this.keys[action] = true;
        this.sendInput();
      }
    }
  }

  onKeyUp(e) {
    if (e.key === 'Shift') {
      this.shiftHeld = false;
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

  // ===================== Aim =====================

  getMouseAimAngle() {
    if (!this.renderer || !this.renderer.state || !this.renderer.myId) return null;
    const me = this.renderer.state.players.find(p => p.id === this.renderer.myId);
    if (!me) return null;
    const dx = this.mouseWorldX - me.x;
    const dy = this.mouseWorldY - me.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return null;
    return Math.atan2(dy, dx);
  }

  // Backward-compatible helper used by main.js
  getAimAngle(playerX, playerY) {
    if (!this.mouseActive) return null;
    const dx = this.mouseWorldX - playerX;
    const dy = this.mouseWorldY - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return null;
    return Math.atan2(dy, dx);
  }

  // ===================== Ability Selection =====================

  selectAbility(slot) {
    this.selectedAbility = slot;
    // Update action bar UI: remove .selected from all, add to selected
    const allSlots = document.querySelectorAll('.action-slot[data-slot]');
    for (const el of allSlots) {
      el.classList.remove('selected');
    }
    const selected = document.querySelector('.action-slot[data-slot="' + slot + '"]');
    if (selected) selected.classList.add('selected');
  }

  // ===================== Touch: Movement joystick =====================

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
        if (this.abilityDrag && t.identifier === this.abilityDrag.touchId) {
          e.preventDefault();
          this.handleAbilityDragMove(t.clientX, t.clientY);
        }
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystickTouchId) {
          this.resetJoystick();
        }
        if (this.abilityDrag && t.identifier === this.abilityDrag.touchId) {
          this.releaseAbility(t.clientX, t.clientY);
        }
      }
    });

    window.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystickTouchId) {
          this.resetJoystick();
        }
        if (this.abilityDrag && t.identifier === this.abilityDrag.touchId) {
          this.abilityDrag = null;
          this.aimIndicator.active = false;
        }
      }
    });

    // Ability buttons (drag-to-aim)
    this.setupAbilityButtons();

    // Contextual interact button
    const interactBtn = document.getElementById('interact-btn');
    if (interactBtn) {
      interactBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onInteract) this.onInteract();
      }, { passive: false });
    }

    // Inventory HUD button
    const inventoryBtn = document.getElementById('inventory-btn');
    if (inventoryBtn) {
      inventoryBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onInventory) this.onInventory();
      }, { passive: false });
      inventoryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onInventory) this.onInventory();
      });
    }

    // Quest log HUD button
    const questBtn = document.getElementById('quest-btn');
    if (questBtn) {
      questBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onQuestPanel) this.onQuestPanel();
      }, { passive: false });
      questBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onQuestPanel) this.onQuestPanel();
      });
    }

    // Desktop action bar — ability slots (click to select for right-click)
    const desktopSlots = document.querySelectorAll('.action-slot[data-slot]');
    for (const slot of desktopSlots) {
      const slotNum = parseInt(slot.getAttribute('data-slot'));
      slot.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectAbility(slotNum);
      });
    }

    // Desktop action bar — utility buttons
    const interactSlot = document.querySelector('.action-slot[data-action="interact"]');
    if (interactSlot) {
      interactSlot.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onInteract) this.onInteract();
      });
    }
    const inventorySlot = document.querySelector('.action-slot[data-action="inventory"]');
    if (inventorySlot) {
      inventorySlot.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onInventory) this.onInventory();
      });
    }

    // Prevent accidental zooming
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
  }

  // ===================== Touch: Ability drag-to-aim =====================

  setupAbilityButtons() {
    const abilityBtns = document.querySelectorAll('.ability-btn[data-slot]');
    for (const btn of abilityBtns) {
      const slot = parseInt(btn.getAttribute('data-slot'));

      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this.abilityDrag = {
          slot,
          startX: t.clientX,
          startY: t.clientY,
          touchId: t.identifier,
          moved: false,
        };
        btn.classList.add('active');
      }, { passive: false });
    }
  }

  handleAbilityDragMove(clientX, clientY) {
    if (!this.abilityDrag) return;
    const dx = clientX - this.abilityDrag.startX;
    const dy = clientY - this.abilityDrag.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 15) {
      this.abilityDrag.moved = true;
      this.aimIndicator.active = true;
      this.aimIndicator.angle = Math.atan2(dy, dx);
    }
  }

  releaseAbility(clientX, clientY) {
    if (!this.abilityDrag) return;
    const drag = this.abilityDrag;
    this.abilityDrag = null;
    this.aimIndicator.active = false;

    // Remove active visual state
    const btn = document.querySelector('.ability-btn[data-slot="' + drag.slot + '"]');
    if (btn) btn.classList.remove('active');

    let aimAngle = null;
    if (drag.moved) {
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      if (Math.sqrt(dx * dx + dy * dy) > 15) {
        aimAngle = Math.atan2(dy, dx);
      }
    } else if (this.joystickActive) {
      // Tap without drag: use joystick direction if actively held
      const jLen = Math.sqrt(this.joyDX * this.joyDX + this.joyDY * this.joyDY);
      if (jLen > 0.2) {
        aimAngle = Math.atan2(this.joyDY, this.joyDX);
      }
    }

    if (this.onAbility) this.onAbility(drag.slot, aimAngle);
  }

  // ===================== Joystick internals =====================

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

    if (this.joystickThumb) {
      this.joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.joystickThumb.style.background = 'rgba(255,167,38,0.55)';
    }

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

  // ===================== Gamepad =====================

  startGamepadPolling() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('[Input] Gamepad connected:', e.gamepad.id);
      this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', () => {
      console.log('[Input] Gamepad disconnected');
      this.gamepadIndex = null;
      this.gamepadPrevButtons = [];
      this.gamepadKeys = { up: false, down: false, left: false, right: false };
      this.gamepadDX = 0;
      this.gamepadDY = 0;
      this.sendInput();
    });

    const poll = () => {
      if (this.active) this.pollGamepad();
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }

  pollGamepad() {
    // Auto-detect if gamepadconnected event was missed (e.g. controller already plugged in)
    if (this.gamepadIndex === null) {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          console.log('[Input] Gamepad detected via polling:', gamepads[i].id);
          this.gamepadIndex = i;
          break;
        }
      }
      if (this.gamepadIndex === null) return;
    }
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;
    const gp = gamepads[this.gamepadIndex];
    if (!gp) return;

    // Left stick
    const deadZone = 0.2;
    const threshold = 0.3;
    const lx = Math.abs(gp.axes[0]) > deadZone ? gp.axes[0] : 0;
    const ly = Math.abs(gp.axes[1]) > deadZone ? gp.axes[1] : 0;

    // D-pad (buttons 12-15)
    const dUp    = gp.buttons[12] && gp.buttons[12].pressed;
    const dDown  = gp.buttons[13] && gp.buttons[13].pressed;
    const dLeft  = gp.buttons[14] && gp.buttons[14].pressed;
    const dRight = gp.buttons[15] && gp.buttons[15].pressed;

    // Buttons — detect rising edge
    const prev = this.gamepadPrevButtons;
    const pressed = (i) => gp.buttons[i] && gp.buttons[i].pressed &&
                           !(prev[i] && prev[i].pressed);

    // Right stick → aim direction + aim indicator (always active)
    const rx = gp.axes[2] || 0;
    const ry = gp.axes[3] || 0;
    const rLen = Math.sqrt(rx * rx + ry * ry);
    let gamepadAimAngle = null;
    if (rLen > 0.3) {
      gamepadAimAngle = Math.atan2(ry, rx);
      if (!this.menuOpen) {
        this.aimIndicator.active = true;
        this.aimIndicator.angle = gamepadAimAngle;
      }
    } else {
      // Fallback: use left stick direction for aiming when right stick is idle
      const lLen = Math.sqrt(lx * lx + ly * ly);
      if (lLen > 0.3) {
        gamepadAimAngle = Math.atan2(ly, lx);
      }
      if (!this.abilityDrag) {
        this.aimIndicator.active = false;
      }
    }

    // Y(3) always toggles menu
    if (pressed(3) && this.onMenuOpen) this.onMenuOpen();

    // Start(9) → open menu on quests tab
    if (pressed(9) && this.onQuestPanel) this.onQuestPanel();

    // Back(8) → toggle full map
    if (pressed(8) && this.onMapToggle) this.onMapToggle();

    if (this.menuOpen) {
      // === MENU OPEN MODE ===
      // A(0) = confirm, B(1) = close
      if (pressed(0) && this.onMenuConfirm) this.onMenuConfirm();
      if (pressed(1) && this.onMenuClose) this.onMenuClose();

      // LT(6) = prev tab, RT(7) = next tab
      if (pressed(6) && this.onMenuCycle) this.onMenuCycle(-1);
      if (pressed(7) && this.onMenuCycle) this.onMenuCycle(1);

      // D-pad navigation (rising edge)
      if (pressed(12) && this.onMenuNavigate) this.onMenuNavigate('up');
      if (pressed(13) && this.onMenuNavigate) this.onMenuNavigate('down');
      if (pressed(14) && this.onMenuNavigate) this.onMenuNavigate('left');
      if (pressed(15) && this.onMenuNavigate) this.onMenuNavigate('right');

      // Left stick navigation (throttled)
      this.handleStickMenuNav(lx, ly);

      // Suppress movement: zero out gamepad keys when menu is open
      this.gamepadKeys = { up: false, down: false, left: false, right: false };
      this.gamepadDX = 0;
      this.gamepadDY = 0;

    } else if (this.choiceActive) {
      // === CHOICE MENU MODE ===
      // A(0) = confirm selection
      if (pressed(0) && this.onChoiceConfirm) this.onChoiceConfirm();
      // B(1) = close/back (advance dialogue to dismiss)
      if (pressed(1) && this.onInteract) this.onInteract();

      // D-pad navigation (rising edge)
      if (pressed(12) && this.onChoiceNavigate) this.onChoiceNavigate('up');
      if (pressed(13) && this.onChoiceNavigate) this.onChoiceNavigate('down');

      // Left stick navigation (throttled)
      this.handleStickChoiceNav(ly);

      // Suppress movement while choice menu is open
      this.gamepadKeys = { up: false, down: false, left: false, right: false };
      this.gamepadDX = 0;
      this.gamepadDY = 0;

    } else if (this.dialogueActive) {
      // === DIALOGUE MODE ===
      // A(0) or LT(6) = advance dialogue
      if (pressed(0) && this.onInteract) this.onInteract();
      if (pressed(6) && this.onInteract) this.onInteract();

      // Still allow movement
      const newKeys = {
        up:    ly < -threshold || dUp,
        down:  ly > threshold  || dDown,
        left:  lx < -threshold || dLeft,
        right: lx > threshold  || dRight,
      };
      const keysChanged = newKeys.up !== this.gamepadKeys.up ||
                          newKeys.down !== this.gamepadKeys.down ||
                          newKeys.left !== this.gamepadKeys.left ||
                          newKeys.right !== this.gamepadKeys.right;
      const analogChanged = lx !== this.gamepadDX || ly !== this.gamepadDY;
      this.gamepadKeys = newKeys;
      this.gamepadDX = lx;
      this.gamepadDY = ly;
      if (keysChanged || analogChanged) this.sendInput();

    } else {
      // === GAMEPLAY MODE ===
      // A(0)=slot1, B(1)=slot2, X(2)=slot3, LB(4)=slot4, RB(5)=slot5, RT(7)=slot6
      const abilityMap = [
        [0, 1], [1, 2], [2, 3], [4, 4], [5, 5], [7, 6]
      ];
      for (const [btn, slot] of abilityMap) {
        if (pressed(btn)) {
          if (this.onAbility) this.onAbility(slot, gamepadAimAngle);
        }
      }

      // LT(6) → interact
      if (pressed(6) && this.onInteract) this.onInteract();

      // R3(10) → toggle full map
      if (pressed(10) && this.onMapToggle) this.onMapToggle();

      // Movement
      const newKeys = {
        up:    ly < -threshold || dUp,
        down:  ly > threshold  || dDown,
        left:  lx < -threshold || dLeft,
        right: lx > threshold  || dRight,
      };
      const keysChanged = newKeys.up !== this.gamepadKeys.up ||
                          newKeys.down !== this.gamepadKeys.down ||
                          newKeys.left !== this.gamepadKeys.left ||
                          newKeys.right !== this.gamepadKeys.right;
      const analogChanged = lx !== this.gamepadDX || ly !== this.gamepadDY;
      this.gamepadKeys = newKeys;
      this.gamepadDX = lx;
      this.gamepadDY = ly;
      if (keysChanged || analogChanged) this.sendInput();
    }

    // Save for edge detection
    this.gamepadPrevButtons = gp.buttons.map(b => ({ pressed: b.pressed }));
  }

  handleStickChoiceNav(ly) {
    const now = performance.now();
    if (now - this.menuNavTimer < 200) return;
    const threshold = 0.5;
    let dir = null;
    if (ly < -threshold) dir = 'up';
    else if (ly > threshold) dir = 'down';
    if (dir && this.onChoiceNavigate) {
      this.onChoiceNavigate(dir);
      this.menuNavTimer = now;
    }
  }

  handleStickMenuNav(lx, ly) {
    const now = performance.now();
    if (now - this.menuNavTimer < 200) return;
    const threshold = 0.5;
    let dir = null;
    if (ly < -threshold) dir = 'up';
    else if (ly > threshold) dir = 'down';
    else if (lx < -threshold) dir = 'left';
    else if (lx > threshold) dir = 'right';
    if (dir && this.onMenuNavigate) {
      this.onMenuNavigate(dir);
      this.menuNavTimer = now;
    }
  }

  // ===================== Click-to-move (mouse) =====================

  setupMouse() {
    if (!this.renderer || !this.renderer.canvas) return;
    const canvas = this.renderer.canvas;

    canvas.addEventListener('mousedown', (e) => {
      if (!this.active) return;

      // Right-click: cast selected ability at cursor
      if (e.button === 2) {
        e.preventDefault();
        if (this.dialogueActive || this.menuOpen) return;
        const aimAngle = this.getMouseAimAngle();
        if (this.onAbility) this.onAbility(this.selectedAbility, aimAngle);
        return;
      }

      if (e.button !== 0) return;

      if (this.dialogueActive) {
        e.preventDefault();
        if (this.onInteract) this.onInteract();
        return;
      }
      if (this.menuOpen) return;

      e.preventDefault();

      // Full map open → click anywhere to close
      if (this.renderer.fullMap) {
        if (this.onMapToggle) this.onMapToggle();
        return;
      }

      // Click on minimap → toggle full map
      if (this.renderer.isPointInMinimap(e.clientX, e.clientY)) {
        if (this.onMapToggle) this.onMapToggle();
        return;
      }

      // Shift+left-click: cast selected ability at cursor (stand still)
      if (this.shiftHeld) {
        const aimAngle = this.getMouseAimAngle();
        if (this.onAbility) this.onAbility(this.selectedAbility, aimAngle);
        return;
      }

      const world = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.handleClickAt(world.x, world.y);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.renderer) return;
      const world = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.mouseWorldX = world.x;
      this.mouseWorldY = world.y;
      this.mouseActive = true;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  handleClickAt(worldX, worldY) {
    const state = this.renderer.state;
    if (!state || !this.renderer.myId) return;

    const ts = CONSTANTS.TILE_SIZE;
    const clickRadius = ts * 1.0;

    // Check items
    if (state.items) {
      for (const item of state.items) {
        const dx = worldX - item.x, dy = worldY - item.y;
        if (Math.sqrt(dx * dx + dy * dy) < clickRadius) {
          this.combatTarget = null;
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
          this.combatTarget = null;
          this.setMoveTarget(npc.x, npc.y, 'npc', CONSTANTS.NPC_INTERACT_RANGE * ts);
          return;
        }
      }
    }

    // Check monsters — click-to-attack
    if (state.monsters) {
      for (const mob of state.monsters) {
        const dx = worldX - mob.x, dy = worldY - mob.y;
        if (Math.sqrt(dx * dx + dy * dy) < clickRadius) {
          this.combatTarget = { monsterId: mob.id };
          this.setMoveTarget(mob.x, mob.y, 'monster', CONSTANTS.PLAYER_ATTACK_RANGE * ts);
          return;
        }
      }
    }

    // Check doors
    if (this.renderer.map && this.renderer.tileset) {
      const tx = Math.floor(worldX / ts);
      const ty = Math.floor(worldY / ts);
      const map = this.renderer.map;
      if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) {
        const tileId = map.data[ty * map.width + tx];
        const tileDef = this.renderer.tileset.tiles[String(tileId)];
        if (tileDef && tileDef.interactable === 'door') {
          this.combatTarget = null;
          const doorX = (tx + 0.5) * ts;
          const doorY = (ty + 0.5) * ts;
          this.setMoveTarget(doorX, doorY, 'door', CONSTANTS.DOOR_INTERACT_RANGE * ts);
          return;
        }
      }
    }

    // Plain ground click — clears combat target
    this.combatTarget = null;
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
    this.moveDX = 0;
    this.moveDY = 0;
    if (this.renderer) this.renderer.clickTarget = null;
  }

  updateClickToMove(playerX, playerY) {
    if (!this.moveTarget) return;

    // Combat target: track monster's live position
    if (this.combatTarget) {
      const state = this.renderer && this.renderer.state;
      if (state && state.monsters) {
        const mob = state.monsters.find(m => m.id === this.combatTarget.monsterId);
        if (!mob || mob.health <= 0) {
          // Monster dead or gone — stop pursuing
          this.combatTarget = null;
          this.clearMoveTarget();
          this.keys = { up: false, down: false, left: false, right: false };
          this.sendInput();
          return;
        }
        // Update move target to monster's current position
        this.moveTarget.x = mob.x;
        this.moveTarget.y = mob.y;
        if (this.renderer) this.renderer.clickTarget = { x: mob.x, y: mob.y };

        // Check if in attack range
        const dx = mob.x - playerX;
        const dy = mob.y - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.moveTarget.interactRange) {
          // In range — stop moving, attack the monster
          this.moveDX = 0;
          this.moveDY = 0;
          this.keys = { up: false, down: false, left: false, right: false };
          this.sendInput();
          const aimAngle = Math.atan2(dy, dx);
          if (this.onAbility) this.onAbility(1, aimAngle);
          return;
        }
      } else {
        // No state — clear target
        this.combatTarget = null;
        this.clearMoveTarget();
        this.keys = { up: false, down: false, left: false, right: false };
        this.sendInput();
        return;
      }
    }

    const dx = this.moveTarget.x - playerX;
    const dy = this.moveTarget.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Interact when close enough (non-monster interactions)
    if (this.moveTarget.interactType && !this.combatTarget && dist < this.moveTarget.interactRange) {
      this.clearMoveTarget();
      this.keys = { up: false, down: false, left: false, right: false };
      this.sendInput();
      if (this.onInteract) this.onInteract();
      return;
    }

    // Arrived at ground target
    const arrivalThreshold = this.moveTarget.interactType ? this.moveTarget.interactRange : 6;
    if (!this.combatTarget && dist < arrivalThreshold) {
      this.clearMoveTarget();
      this.keys = { up: false, down: false, left: false, right: false };
      this.sendInput();
      return;
    }

    // Move toward target
    const threshold = 0.3;
    const nx = dx / dist;
    const ny = dy / dist;
    this.moveDX = nx;
    this.moveDY = ny;
    this.keys = {
      up:    ny < -threshold,
      down:  ny > threshold,
      left:  nx < -threshold,
      right: nx > threshold,
    };
    this.sendInput();
  }

  stopMovement() {
    this.keys = { up: false, down: false, left: false, right: false };
    this.clearMoveTarget();
    this.sendInput();
  }

  // ===================== Send =====================

  sendJoystickInput() {
    this.sendInput();
  }

  sendInput() {
    const threshold = 0.3;
    const joyKeys = {
      up:    this.joyDY < -threshold,
      down:  this.joyDY > threshold,
      left:  this.joyDX < -threshold,
      right: this.joyDX > threshold,
    };

    // Merge all sources: keyboard/click-to-move + touch joystick + gamepad
    const merged = {
      up:    this.keys.up    || joyKeys.up    || this.gamepadKeys.up,
      down:  this.keys.down  || joyKeys.down  || this.gamepadKeys.down,
      left:  this.keys.left  || joyKeys.left  || this.gamepadKeys.left,
      right: this.keys.right || joyKeys.right || this.gamepadKeys.right,
    };

    // Compute analog direction for omnidirectional movement
    let dx = 0, dy = 0;

    // Keyboard / click-to-move
    if (this.clickMoving && (this.moveDX !== 0 || this.moveDY !== 0)) {
      dx += this.moveDX;
      dy += this.moveDY;
    } else {
      if (this.keys.up) dy -= 1;
      if (this.keys.down) dy += 1;
      if (this.keys.left) dx -= 1;
      if (this.keys.right) dx += 1;
    }

    // Touch joystick (analog)
    dx += this.joyDX;
    dy += this.joyDY;

    // Gamepad (analog)
    dx += this.gamepadDX;
    dy += this.gamepadDY;

    // Normalize to unit vector if magnitude > 1
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }

    // Round to reduce network noise (2 decimal places ≈ sub-degree precision)
    dx = Math.round(dx * 100) / 100;
    dy = Math.round(dy * 100) / 100;

    const json = JSON.stringify({ k: merged, dx, dy });
    if (json === this.lastSent) return;
    this.lastSent = json;

    this.net.send({
      type: CONSTANTS.MSG.INPUT,
      keys: merged,
      dx,
      dy,
    });
  }
}
