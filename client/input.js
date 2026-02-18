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

    // Callback for interact key
    this.onInteract = null;

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
  }

  start() {
    this.active = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.setupTouch();
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

    const action = this.keyMap[e.key];
    if (action) {
      e.preventDefault();
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
