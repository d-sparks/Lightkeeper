// Main client entry point

(function () {
  // --- DOM elements ---
  const joinScreen = document.getElementById('join-screen');
  const nameInput = document.getElementById('name-input');
  const joinBtn = document.getElementById('join-btn');
  const gameContainer = document.getElementById('game-container');
  const canvas = document.getElementById('game-canvas');
  const healthFill = document.getElementById('health-fill');
  const energyBar = document.getElementById('energy-bar');
  const energyFill = document.getElementById('energy-fill');
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
  renderer.aimIndicator = input.aimIndicator;  // For aim line drawing

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
  let equipmentState = { arms: null, medipac: null, accessory: null };
  let abilityState = [null, null, null, null, null, null];
  let cooldownState = [0, 0, 0, 0, 0, 0];
  const SLOT_DISPLAY_NAMES = { arms: 'Arms', medipac: 'Medipac', accessory: 'Accessory' };

  // Sol grid state
  let solGridState = null;
  let solGridOpen = false;
  let solGridSelected = -1;  // index of selected cell for swapping
  const solGridPanel = document.getElementById('sol-grid-panel');
  const solGridContainer = document.getElementById('sol-grid-container');
  const solGridInfo = document.getElementById('sol-grid-info');

  function toggleInventory() {
    // If sol grid is open, close it first
    if (solGridOpen) {
      closeSolGrid();
      return;
    }
    inventoryOpen = !inventoryOpen;
    input.inventoryOpen = inventoryOpen;
    inventoryPanel.style.display = inventoryOpen ? 'block' : 'none';
    if (inventoryOpen) {
      renderEquipmentSlots();
      renderInventoryGrid();
    }
  }

  // Tab switching
  document.querySelectorAll('.inv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById('inv-tab-equipment').style.display = tabName === 'equipment' ? '' : 'none';
      document.getElementById('inv-tab-inventory').style.display = tabName === 'inventory' ? '' : 'none';
      if (tabName === 'equipment') renderEquipmentSlots();
      if (tabName === 'inventory') renderInventoryGrid();
    });
  });

  function updateActionBar() {
    for (let i = 0; i < 6; i++) {
      const slotNum = i + 1;
      // Desktop action bar
      const desktopSlot = document.querySelector(`.action-slot[data-slot="${slotNum}"]`);
      // Mobile ability buttons
      const mobileSlot = document.querySelector(`.ability-btn[data-slot="${slotNum}"]`);
      const abilityId = abilityState[i];

      if (abilityId) {
        // Show ability name (stripped of underscores, capitalized)
        const label = abilityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (desktopSlot) {
          desktopSlot.classList.remove('empty');
          const labelEl = desktopSlot.querySelector('.slot-label');
          if (labelEl) labelEl.textContent = label;
        }
        if (mobileSlot) {
          mobileSlot.classList.remove('empty');
          mobileSlot.textContent = slotNum;
        }
      } else {
        if (desktopSlot) {
          desktopSlot.classList.add('empty');
          const labelEl = desktopSlot.querySelector('.slot-label');
          if (labelEl) labelEl.innerHTML = '&mdash;';
        }
        if (mobileSlot) {
          mobileSlot.classList.add('empty');
          mobileSlot.textContent = slotNum;
        }
      }
    }
  }

  function updateCooldownOverlays() {
    for (let i = 0; i < 6; i++) {
      const slotNum = i + 1;
      const desktopSlot = document.querySelector(`.action-slot[data-slot="${slotNum}"]`);
      if (!desktopSlot) continue;

      let overlay = desktopSlot.querySelector('.cooldown-overlay');
      const cd = cooldownState[i] || 0;

      if (cd > 0) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'cooldown-overlay';
          desktopSlot.appendChild(overlay);
        }
        overlay.textContent = cd.toFixed(1);
        overlay.style.display = 'flex';
      } else if (overlay) {
        overlay.style.display = 'none';
      }
    }
  }

  function renderEquipmentSlots() {
    // Clear existing slot elements (keep the label)
    const label = equipmentSlots.querySelector('.equip-label');
    equipmentSlots.innerHTML = '';
    equipmentSlots.appendChild(label);

    for (const slot of CONSTANTS.EQUIPMENT_SLOTS) {
      const div = document.createElement('div');
      div.className = 'equip-slot-box';
      const equipped = equipmentState[slot];
      const displayName = SLOT_DISPLAY_NAMES[slot] || slot;

      if (equipped) {
        const rarityColor = CONSTANTS.RARITY_COLORS[equipped.rarity] || CONSTANTS.RARITY_COLORS.common;
        let html = '<span class="slot-label-name">' + displayName + '</span>' +
          '<span class="inv-dot" style="background:' + rarityColor + '"></span>' +
          '<span class="slot-item-name" style="color:' + rarityColor + '">' + equipped.name + '</span>';

        // Check if this is a sol unit (show OPEN tag on arms slot)
        const itemDef = equipped._hasSolGrid;
        if (slot === 'arms' && solGridState) {
          html += '<span class="sol-open-tag">OPEN</span>';
        }

        div.innerHTML = html;
        div.addEventListener('click', () => {
          // If arms slot has sol unit with grid, open the grid
          if (slot === 'arms' && solGridState) {
            openSolGrid();
            return;
          }
          net.send({ type: CONSTANTS.MSG.UNEQUIP, slot: slot });
        });
      } else {
        div.innerHTML = '<span class="slot-label-name">' + displayName + '</span>' +
          '<span class="slot-empty-label">- empty -</span>';
      }
      equipmentSlots.appendChild(div);
    }
  }

  function renderInventoryGrid() {
    if (inventoryItems.length === 0) {
      inventoryList.innerHTML = '<div class="inv-empty">Empty</div>';
      return;
    }
    inventoryList.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'inv-grid';

    for (let i = 0; i < inventoryItems.length; i++) {
      const item = inventoryItems[i];
      const cell = document.createElement('div');
      cell.className = 'inv-grid-cell';
      const rarityColor = CONSTANTS.RARITY_COLORS[item.rarity] || CONSTANTS.RARITY_COLORS.common;

      let html = '<span class="cell-dot" style="background:' + rarityColor + '"></span>' +
        '<span class="cell-name" style="color:' + rarityColor + '">' + item.name + '</span>';

      if (item.category === 'weapon' || item.category === 'equipment' || item.slot) {
        html += '<span class="inv-slot-tag">equip</span>';
      }
      if (item.category === 'consumable') {
        html += '<span class="inv-use-tag">use</span>';
      }
      cell.innerHTML = html;

      const idx = i;
      if (item.category === 'consumable') {
        cell.addEventListener('click', () => {
          net.send({ type: CONSTANTS.MSG.USE_ITEM, index: idx });
        });
      } else {
        cell.addEventListener('click', () => {
          net.send({ type: CONSTANTS.MSG.EQUIP, index: idx });
        });
      }

      grid.appendChild(cell);
    }

    inventoryList.appendChild(grid);
  }

  // --- Sol grid panel ---
  function openSolGrid() {
    if (!solGridState) return;
    solGridOpen = true;
    solGridSelected = -1;
    inventoryPanel.style.display = 'none';
    solGridPanel.style.display = 'block';
    input.inventoryOpen = true;
    renderSolGrid();
  }

  function closeSolGrid() {
    solGridOpen = false;
    solGridSelected = -1;
    solGridPanel.style.display = 'none';
    input.inventoryOpen = false;
  }

  function renderSolGrid() {
    if (!solGridState) return;
    solGridContainer.innerHTML = '';
    const size = solGridState.size || 5;
    const grid = document.createElement('div');
    grid.className = 'sol-grid';
    grid.style.gridTemplateColumns = `repeat(${size}, 48px)`;

    for (let i = 0; i < size * size; i++) {
      const cell = document.createElement('div');
      cell.className = 'sol-cell';
      const comp = solGridState.cells[i];

      if (comp) {
        if (comp.abilityId) {
          cell.classList.add('has-ability');
          const label = comp.abilityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          cell.textContent = label;
        } else if (comp.modifierId) {
          cell.classList.add('has-modifier');
          cell.textContent = comp.modifierId.replace(/_/g, ' ');
        }
      }

      if (i === solGridSelected) {
        cell.classList.add('selected');
      }

      const idx = i;
      cell.addEventListener('click', () => {
        if (solGridSelected === -1) {
          // Select this cell
          solGridSelected = idx;
          renderSolGrid();
        } else if (solGridSelected === idx) {
          // Deselect
          solGridSelected = -1;
          renderSolGrid();
        } else {
          // Swap with selected cell
          net.send({
            type: CONSTANTS.MSG.SOL_GRID_MOVE,
            fromIdx: solGridSelected,
            toIdx: idx,
          });
          solGridSelected = -1;
        }
      });

      grid.appendChild(cell);
    }

    solGridContainer.appendChild(grid);

    // Highlight adjacency connections: add glow to modifiers adjacent to abilities
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (let cy = 0; cy < size; cy++) {
      for (let cx = 0; cx < size; cx++) {
        const ci = cy * size + cx;
        const comp = solGridState.cells[ci];
        if (!comp || !comp.abilityId) continue;
        // This is an ability cell, highlight adjacent modifiers
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const ni = ny * size + nx;
          const neighbor = solGridState.cells[ni];
          if (neighbor && neighbor.modifierId) {
            const neighborCell = grid.children[ni];
            if (neighborCell) neighborCell.style.boxShadow = '0 0 6px rgba(76,175,80,0.4)';
          }
        }
      }
    }

    solGridInfo.textContent = solGridSelected >= 0 ? 'Click another cell to swap' : 'Click a component to move it';
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

  // --- Auto-aim: find nearest monster and return angle to it ---
  function autoAimAngle(me) {
    if (!renderer.state || !renderer.state.monsters) return null;
    let nearest = null;
    let bestDist = Infinity;
    for (const mob of renderer.state.monsters) {
      if (mob.health <= 0) continue;
      const dx = mob.x - me.x;
      const dy = mob.y - me.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = mob;
      }
    }
    // Auto-aim range: 12 tiles (generous, projectile will travel further)
    const maxRange = CONSTANTS.TILE_SIZE * 12;
    if (!nearest || bestDist > maxRange) return null;
    return Math.atan2(nearest.y - me.y, nearest.x - me.x);
  }

  // --- Player facing direction (fallback when no target) ---
  let lastFacing = 0;

  // --- Ability dispatch ---
  input.onAbility = function (slot, aimAngle) {
    if (dialogueActive || inventoryOpen) return;
    const me = renderer.state && renderer.state.players
      ? renderer.state.players.find(p => p.id === renderer.myId)
      : null;
    if (!me) return;

    if (aimAngle === null) {
      // Auto-aim at nearest monster (highest priority)
      aimAngle = autoAimAngle(me);
    }
    if (aimAngle === null) {
      // Desktop: use mouse aim direction as fallback
      aimAngle = input.getAimAngle(me.x, me.y);
    }
    if (aimAngle === null) {
      // No target: fire in facing direction
      aimAngle = lastFacing;
    }

    net.send({ type: CONSTANTS.MSG.ATTACK, aimAngle, slot });
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

    // Request fullscreen on mobile to hide browser chrome (URL bar)
    if ('ontouchstart' in window) {
      const el = document.documentElement;
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (rfs) rfs.call(el).catch(() => {});
    }
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
        if (me.maxEnergy > 0) {
          energyBar.style.display = '';
          const ePct = (me.energy / me.maxEnergy) * 100;
          energyFill.style.width = `${ePct}%`;
        } else {
          energyBar.style.display = 'none';
        }
        hudName.textContent = me.name;
        if (me.facing !== undefined) lastFacing = me.facing;
      }
    }

    // Update click-to-move direction based on current position
    if (renderer.myId) {
      const me = msg.players.find(p => p.id === renderer.myId);
      if (me) {
        input.updateClickToMove(me.x, me.y);
      }
    }

    // Update cooldowns from state
    if (msg.myCooldowns) {
      cooldownState = msg.myCooldowns;
      updateCooldownOverlays();
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

  net.on(CONSTANTS.MSG.SOL_GRID, (msg) => {
    solGridState = msg.grid || null;
    if (solGridOpen && solGridState) {
      renderSolGrid();
    }
    // Re-render equipment slots to show/hide OPEN tag
    if (inventoryOpen) renderEquipmentSlots();
  });

  net.on(CONSTANTS.MSG.ABILITY_STATE, (msg) => {
    abilityState = msg.abilities || [null, null, null, null, null, null];
    cooldownState = msg.cooldowns || [0, 0, 0, 0, 0, 0];
    updateActionBar();
  });

  net.on(CONSTANTS.MSG.INVENTORY, (msg) => {
    inventoryItems = msg.items || [];
    if (msg.equipment) {
      equipmentState = msg.equipment;
    }
    if (inventoryOpen) {
      renderEquipmentSlots();
      renderInventoryGrid();
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

  // Resize canvas when fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    setTimeout(resizeCanvas, 100);
  });
  document.addEventListener('webkitfullscreenchange', () => {
    setTimeout(resizeCanvas, 100);
  });

  // --- Start ---
  net.connect();
  requestAnimationFrame(gameLoop);

  // Focus management
  canvas.setAttribute('tabindex', '0');
  gameContainer.addEventListener('click', () => canvas.focus());
})();
