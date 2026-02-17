// Network client - WebSocket connection to the game server

class NetClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.handlers = {};  // message type -> callback
    this.statusEl = document.getElementById('connection-status');
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(url);
    this.setStatus('Connecting...');

    this.ws.onopen = () => {
      this.connected = true;
      this.setStatus('Connected');
    };

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      const handler = this.handlers[msg.type];
      if (handler) handler(msg);
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.setStatus('Disconnected — refresh to reconnect');
    };

    this.ws.onerror = () => {
      this.setStatus('Connection error');
    };
  }

  on(type, callback) {
    this.handlers[type] = callback;
  }

  send(msg) {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }
}
