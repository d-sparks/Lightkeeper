// Input handler - tracks keyboard state

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
  }

  start() {
    this.active = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  stop() {
    this.active = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

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

  sendInput() {
    // Only send if state actually changed
    const json = JSON.stringify(this.keys);
    if (json === this.lastSent) return;
    this.lastSent = json;

    this.net.send({
      type: CONSTANTS.MSG.INPUT,
      keys: { ...this.keys },
    });
  }
}
