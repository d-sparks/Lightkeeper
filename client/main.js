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
  const equipmentSlots = document.getElementById('equipment-slots');
  const interactBtn = document.getElementById('interact-btn');
  const desktopInteractLabel = document.getElementById('desktop-interact-label');

  // --- Instances ---
  const net = new NetClient();
  const renderer = new Renderer(canvas);
  const input = new InputHandler(net);
  input.renderer = renderer;  // For click-to-move coordinate conversion

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
  let dialogueMode = null;   // 'bubble' or 'system'

  function showDialogue(lines, npcId) {
    closeDialogue();

    // If we have an npcId and can find the NPC, use speech bubble
    let usesBubble = false;
    if (npcId && renderer.state && renderer.state.npcs) {
      const npc = renderer.state.npcs.find(n => n.id === npcId);
      if (npc) {
        usesBubble = true;
      }
    }

    dialogueLines = lines;
    dialogueIndex = 0;
    dialogueActive = true;
    input.dialogueActive = true;

    if (usesBubble) {
      dialogueMode = 'bubble';
      renderer.showSpeechBubble(npcId, lines);
    } else {
      dialogueMode = 'system';
      updateDialogueDisplay();
      dialogueOverlay.style.display = 'block';
    }
  }

  function advanceDialogue() {
    if (dialogueMode === 'bubble') {
      const still = renderer.advanceSpeechBubble();
      if (!still) {
        closeDialogue();
      }
      return;
    }
    // System overlay mode
    dialogueIndex++;
    if (dialogueIndex >= dialogueLines.length) {
      closeDialogue();
      return;
    }
    updateDialogueDisplay();
  }

  function closeDialogue() {
    if (dialogueMode === 'bubble') {
      renderer.closeSpeechBubble();
    }
    dialogueActive = false;
    input.dialogueActive = false;
    dialogueLines = [];
    dialogueIndex = 0;
    dialogueMode = null;
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

  // --- Inventory & equipment state ---
  let inventoryOpen = false;
  let inventoryItems = [];
  let equipmentState = { weapon: null, armor: null, accessory: null };

  function toggleInventory() {
    inventoryOpen = !inventoryOpen;
    input.inventoryOpen = inventoryOpen;
    inventoryPanel.style.display = inventoryOpen ? 'block' : 'none';
    if (inventoryOpen) {
      renderEquipmentSlots();
      renderInventoryList();
    }
  }

  function renderEquipmentSlots() {
    // Clear existing slot elements (keep the label)
    const label = equipmentSlots.querySelector('.equip-label');
    equipmentSlots.innerHTML = '';
    equipmentSlots.appendChild(label);

    for (const slot of CONSTANTS.EQUIPMENT_SLOTS) {
      const div = document.createElement('div');
      div.className = 'equip-slot';
      const equipped = equipmentState[slot];
      if (equipped) {
        const rarityColor = CONSTANTS.RARITY_COLORS[equipped.rarity] || CONSTANTS.RARITY_COLORS.common;
        div.innerHTML = '<span class="slot-name">' + slot + '</span>' +
          '<span class="inv-dot" style="background:' + rarityColor + '"></span>' +
          '<span class="slot-item" style="color:' + rarityColor + '">' + equipped.name + '</span>';
        div.addEventListener('click', () => {
          net.send({ type: CONSTANTS.MSG.UNEQUIP, slot: slot });
        });
      } else {
        div.innerHTML = '<span class="slot-name">' + slot + '</span>' +
          '<span class="slot-empty">- empty -</span>';
      }
      equipmentSlots.appendChild(div);
    }
  }

  function renderInventoryList() {
    if (inventoryItems.length === 0) {
      inventoryList.innerHTML = '<div class="inv-empty">Empty</div>';
      return;
    }
    inventoryList.innerHTML = '';
    for (let i = 0; i < inventoryItems.length; i++) {
      const item = inventoryItems[i];
      const div = document.createElement('div');
      div.className = 'inv-item';
      const rarityColor = CONSTANTS.RARITY_COLORS[item.rarity] || CONSTANTS.RARITY_COLORS.common;
      let html = '<span class="inv-dot" style="background:' + rarityColor + '"></span>' +
        '<span style="color:' + rarityColor + '">' + item.name + '</span>';

      // Check if item is equippable (weapon type has a slot)
      if (item.category === 'weapon' || item.slot) {
        html += '<span class="inv-slot-tag">equip</span>';
      }

      // Check if item is consumable (usable)
      if (item.category === 'consumable') {
        html += '<span class="inv-use-tag">use</span>';
      }
      div.innerHTML = html;

      const idx = i;
      if (item.category === 'consumable') {
        // Tap to use consumable
        div.addEventListener('click', () => {
          net.send({ type: CONSTANTS.MSG.USE_ITEM, index: idx });
        });
      } else {
        // Click to equip
        div.addEventListener('click', () => {
          net.send({ type: CONSTANTS.MSG.EQUIP, index: idx });
        });
      }

      inventoryList.appendChild(div);
    }
  }

  // --- Dynamic interact button label ---
  function updateInteractLabel() {
    if (!renderer.state || !renderer.myId) return;
    const me = renderer.state.players.find(p => p.id === renderer.myId);
    if (!me) return;

    const ts = CONSTANTS.TILE_SIZE;
    let label = null; // null means nothing nearby to interact with

    // Priority 1: items
    if (renderer.state.items) {
      const itemRange = CONSTANTS.ITEM_PICKUP_RANGE * ts;
      for (const item of renderer.state.items) {
        const dx = item.x - me.x, dy = item.y - me.y;
        if (Math.sqrt(dx * dx + dy * dy) < itemRange) { label = 'Pick up'; break; }
      }
    }

    // Priority 2: doors (only if no item found)
    if (!label && renderer.map && renderer.tileset) {
      const doorRange = CONSTANTS.DOOR_INTERACT_RANGE * ts;
      const playerTX = Math.floor(me.x / ts), playerTY = Math.floor(me.y / ts);
      for (let dy = -2; dy <= 2 && !label; dy++) {
        for (let dx = -2; dx <= 2 && !label; dx++) {
          const tx = playerTX + dx, ty = playerTY + dy;
          if (tx < 0 || ty < 0 || tx >= renderer.map.width || ty >= renderer.map.height) continue;
          const tileId = renderer.map.data[ty * renderer.map.width + tx];
          const tileDef = renderer.tileset.tiles[String(tileId)];
          if (!tileDef || tileDef.interactable !== 'door') continue;
          const tileCX = (tx + 0.5) * ts, tileCY = (ty + 0.5) * ts;
          const ddx = tileCX - me.x, ddy = tileCY - me.y;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < doorRange) {
            label = tileDef.solid ? 'Open' : 'Close';
          }
        }
      }
    }

    // Priority 3: NPCs
    if (!label && renderer.state.npcs) {
      const npcRange = CONSTANTS.NPC_INTERACT_RANGE * ts;
      for (const npc of renderer.state.npcs) {
        const dx = npc.x - me.x, dy = npc.y - me.y;
        if (Math.sqrt(dx * dx + dy * dy) < npcRange) { label = 'Talk'; break; }
      }
    }

    // Update desktop action bar label
    if (desktopInteractLabel) desktopInteractLabel.textContent = label || 'Interact';
    // Show/hide contextual mobile interact button
    if (interactBtn) {
      if (label) {
        interactBtn.textContent = label;
        interactBtn.style.display = '';
      } else {
        interactBtn.style.display = 'none';
      }
    }
  }

  // --- Ability dispatch ---
  input.onAbility = function (slot, aimAngle) {
    if (dialogueActive || inventoryOpen) return;
    if (slot === 1) {
      // Primary attack — send with aim angle
      if (aimAngle === null) {
        // No aim: use mouse aim as fallback (keyboard/desktop)
        const me = renderer.state && renderer.state.players
          ? renderer.state.players.find(p => p.id === renderer.myId)
          : null;
        if (me) {
          aimAngle = input.getAimAngle(me.x, me.y);
        }
      }
      if (aimAngle === null) return;
      net.send({ type: CONSTANTS.MSG.ATTACK, aimAngle });
      return;
    }
    // Slots 2-6: future abilities
  };

  // --- Interact dispatch ---
  input.onInteract = function () {
    if (dialogueActive) { advanceDialogue(); return; }
    if (inventoryOpen) { toggleInventory(); return; }
    net.send({ type: CONSTANTS.MSG.INTERACT });
  };

  // --- Inventory dispatch ---
  input.onInventory = function () {
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
    document.body.classList.add('in-game');
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
      // Clear click-to-move on player death
      for (const ev of msg.events) {
        if (ev.type === 'death' && ev.targetId === renderer.myId) {
          input.clearMoveTarget();
        }
      }
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

    // Update click-to-move direction based on current position
    if (renderer.myId) {
      const me = msg.players.find(p => p.id === renderer.myId);
      if (me) {
        input.updateClickToMove(me.x, me.y);
      }
    }

    // Update interact button label based on proximity
    updateInteractLabel();
  });

  net.on(CONSTANTS.MSG.FLOOR_CHANGE, (msg) => {
    console.log('[Game] Floor change!', msg.map.name);
    renderer.setMap(msg.map, msg.tileset);
    input.clearMoveTarget();
    // Close any open dialogue
    closeDialogue();
  });

  net.on(CONSTANTS.MSG.DIALOGUE, (msg) => {
    if (msg.dialogue && msg.dialogue.length > 0) {
      showDialogue(msg.dialogue, msg.npcId);
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
    if (msg.equipment) {
      equipmentState = msg.equipment;
    }
    if (inventoryOpen) {
      renderEquipmentSlots();
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

  // --- Try to lock to landscape on mobile ---
  if ('ontouchstart' in window && screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => { /* not supported or not fullscreen */ });
  }

  // --- Start ---
  net.connect();
  requestAnimationFrame(gameLoop);

  // Focus management
  canvas.setAttribute('tabindex', '0');
  gameContainer.addEventListener('click', () => canvas.focus());
})();
