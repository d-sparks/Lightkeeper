// Main client entry point

(function () {
  // --- DOM elements ---
  const joinScreen = document.getElementById('join-screen');
  const nameInput = document.getElementById('name-input');
  const joinBtn = document.getElementById('join-btn');
  const gameContainer = document.getElementById('game-container');
  const canvas = document.getElementById('game-canvas');
  const healthFill = document.getElementById('health-fill');
  const hudName = document.getElementById('hud-name');
  const dialogueOverlay = document.getElementById('dialogue-overlay');
  const dialogueSpeaker = document.getElementById('dialogue-speaker');
  const dialogueText = document.getElementById('dialogue-text');
  const inventoryPanel = document.getElementById('inventory-panel');
  const inventoryList = document.getElementById('inventory-list');

  // --- Instances ---
  const net = new NetClient();
  const input = new InputHandler(net);
  const renderer = new Renderer(canvas);

  // --- Responsive canvas sizing ---
  function resizeCanvas() {
    const availW = gameContainer.clientWidth;
    const availH = gameContainer.clientHeight;
    if (availW > 0 && availH > 0) {
      renderer.resizeToFit(availW, availH);
    }
  }
  window.addEventListener('resize', resizeCanvas);

  // --- State ---
  let joined = false;

  // --- Dialogue state ---
  let dialogueActive = false;
  let dialogueLines = [];    // Array of { speaker, text }
  let dialogueIndex = 0;

  function showDialogue(lines) {
    dialogueLines = lines;
    dialogueIndex = 0;
    dialogueActive = true;
    updateDialogueDisplay();
    dialogueOverlay.style.display = 'block';
  }

  function advanceDialogue() {
    dialogueIndex++;
    if (dialogueIndex >= dialogueLines.length) {
      closeDialogue();
      return;
    }
    updateDialogueDisplay();
  }

  function closeDialogue() {
    dialogueActive = false;
    dialogueLines = [];
    dialogueIndex = 0;
    dialogueOverlay.style.display = 'none';
  }

  function updateDialogueDisplay() {
    const line = dialogueLines[dialogueIndex];
    if (!line) return;
    dialogueSpeaker.textContent = line.speaker;
    dialogueText.textContent = line.text;
  }

  // Allow tapping dialogue overlay to advance (touch-friendly)
  dialogueOverlay.addEventListener('click', () => {
    if (dialogueActive) advanceDialogue();
  });

  // --- Inventory state ---
  let inventoryOpen = false;
  let inventoryItems = [];

  function toggleInventory() {
    inventoryOpen = !inventoryOpen;
    inventoryPanel.style.display = inventoryOpen ? 'block' : 'none';
    if (inventoryOpen) {
      renderInventoryList();
    }
  }

  function renderInventoryList() {
    if (inventoryItems.length === 0) {
      inventoryList.innerHTML = '<div class="inv-empty">Empty</div>';
      return;
    }
    inventoryList.innerHTML = '';
    for (const item of inventoryItems) {
      const div = document.createElement('div');
      div.className = 'inv-item';
      const rarityColor = CONSTANTS.RARITY_COLORS[item.rarity] || CONSTANTS.RARITY_COLORS.common;
      div.innerHTML = '<span class="inv-dot" style="background:' + rarityColor + '"></span>' +
        '<span style="color:' + rarityColor + '">' + item.name + '</span>';
      inventoryList.appendChild(div);
    }
  }

  // --- Interact handler ---
  input.onInteract = function () {
    if (dialogueActive) {
      advanceDialogue();
      return;
    }
    if (inventoryOpen) {
      toggleInventory();
      return;
    }
    // Send interact request to server
    net.send({ type: CONSTANTS.MSG.INTERACT });
  };

  // --- Inventory toggle handler ---
  input.onInventoryToggle = function () {
    if (dialogueActive) return;
    toggleInventory();
  };

  // --- Join flow ---
  function doJoin() {
    const name = nameInput.value.trim() || 'Adventurer';
    net.send({ type: CONSTANTS.MSG.JOIN, name });
  }

  joinBtn.addEventListener('click', doJoin);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doJoin();
  });

  // --- Network handlers ---
  net.on(CONSTANTS.MSG.WELCOME, (msg) => {
    console.log('[Game] Welcome!', msg.playerId);

    renderer.setMyId(msg.playerId);
    renderer.setMap(msg.map, msg.tileset);

    // Switch from join screen to game
    joinScreen.style.display = 'none';
    gameContainer.style.display = 'flex';
    canvas.focus();

    // Size canvas now that container is visible
    resizeCanvas();

    input.start();
    joined = true;

    hudName.textContent = msg.playerId;
  });

  net.on(CONSTANTS.MSG.STATE, (msg) => {
    renderer.setState(msg);

    // Process combat events for damage numbers
    if (msg.events) {
      renderer.processEvents(msg.events);
    }

    // Update HUD
    if (renderer.myId) {
      const me = msg.players.find(p => p.id === renderer.myId);
      if (me) {
        const pct = (me.health / me.maxHealth) * 100;
        healthFill.style.width = `${pct}%`;
        hudName.textContent = me.name;
      }
    }
  });

  net.on(CONSTANTS.MSG.FLOOR_CHANGE, (msg) => {
    console.log('[Game] Floor change!', msg.map.name);
    renderer.setMap(msg.map, msg.tileset);
    // Close any open dialogue
    closeDialogue();
  });

  net.on(CONSTANTS.MSG.DIALOGUE, (msg) => {
    if (msg.dialogue && msg.dialogue.length > 0) {
      showDialogue(msg.dialogue);
    }
  });

  net.on(CONSTANTS.MSG.DOOR_TOGGLE, (msg) => {
    // Update local map tile data to reflect the door state change
    if (renderer.map && msg.x != null && msg.y != null) {
      const idx = msg.y * renderer.map.width + msg.x;
      renderer.map.data[idx] = msg.tileId;
    }
  });

  net.on(CONSTANTS.MSG.INVENTORY, (msg) => {
    inventoryItems = msg.items || [];
    if (inventoryOpen) {
      renderInventoryList();
    }
  });

  net.on(CONSTANTS.MSG.PLAYER_JOIN, (msg) => {
    console.log(`[Game] ${msg.name} joined`);
  });

  net.on(CONSTANTS.MSG.PLAYER_LEAVE, (msg) => {
    console.log(`[Game] ${msg.playerId} left`);
  });

  // --- Render loop ---
  function gameLoop() {
    if (joined) {
      renderer.render();
    }
    requestAnimationFrame(gameLoop);
  }

  // --- Start ---
  net.connect();
  requestAnimationFrame(gameLoop);

  // Focus management
  canvas.setAttribute('tabindex', '0');
  gameContainer.addEventListener('click', () => canvas.focus());
})();
