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
  const energyText = document.getElementById('energy-text');
  const hudName = document.getElementById('hud-name');
  const dialogueOverlay = document.getElementById('dialogue-overlay');
  const dialogueSpeaker = document.getElementById('dialogue-speaker');
  const dialogueText = document.getElementById('dialogue-text');
  const characterMenu = document.getElementById('character-menu');
  const inventoryList = document.getElementById('inventory-list');
  const equipmentSlots = document.getElementById('equipment-slots');
  const interactBtn = document.getElementById('interact-btn');
  const desktopInteractLabel = document.getElementById('desktop-interact-label');
  const questBtn = document.getElementById('quest-btn');
  const questLabel = document.getElementById('quest-label');
  const questToast = document.getElementById('quest-toast');
  const questPanelContent = document.getElementById('quest-panel-content');
  const solGridContainer = document.getElementById('sol-grid-container');
  const solGridInfo = document.getElementById('sol-grid-info');
  const choiceOverlay = document.getElementById('choice-overlay');
  const choicePrompt = document.getElementById('choice-prompt');
  const choiceOptions = document.getElementById('choice-options');

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

  // --- Choice menu state ---
  let choiceActive = false;

  function showChoiceMenu(choiceId, prompt, options) {
    closeDialogue();
    closeMenu();
    choiceActive = true;
    input.dialogueActive = true;
    choicePrompt.textContent = prompt;
    choiceOptions.innerHTML = '';
    for (const opt of options) {
      const div = document.createElement('div');
      div.className = 'choice-option';
      const label = document.createElement('div');
      label.className = 'choice-label';
      label.textContent = opt.label;
      div.appendChild(label);
      if (opt.description) {
        const desc = document.createElement('div');
        desc.className = 'choice-desc';
        desc.textContent = opt.description;
        div.appendChild(desc);
      }
      div.addEventListener('click', () => {
        net.send({ type: CONSTANTS.MSG.CHOICE_SELECT, choiceId, value: opt.value });
        closeChoiceMenu();
      });
      choiceOptions.appendChild(div);
    }
    choiceOverlay.style.display = 'block';
  }

  function closeChoiceMenu() {
    choiceActive = false;
    input.dialogueActive = false;
    choiceOverlay.style.display = 'none';
  }

  // --- Inventory & equipment state ---
  let inventoryItems = [];
  let equipmentState = { arms: null, sol_unit: null, medipac: null, accessory: null };
  let abilityState = [null, null, null, null, null, null];
  let cooldownState = [0, 0, 0, 0, 0, 0];
  let slot1InteractMode = null; // null or interact label string when slot 1 is overridden
  const SLOT_DISPLAY_NAMES = { arms: 'Arms', sol_unit: 'Sol Unit', medipac: 'Medipac', accessory: 'Accessory' };

  // Sol grid state
  let solGridState = null;
  let solGridSelectedComponent = null; // inventory index of selected component for placement

  // Quest state
  let questState = [];
  let questToastTimeout = null;

  // --- Unified character menu state ---
  let menuOpen = false;
  let menuTab = 'equipment';
  const MENU_TABS = ['equipment', 'inventory', 'solgrid', 'quests'];
  let cursorIndex = 0;

  function openMenu(tab) {
    menuOpen = true;
    input.menuOpen = true;
    renderer.fullMap = false;
    characterMenu.style.display = 'block';
    switchTab(tab || 'equipment');
  }

  function closeMenu() {
    menuOpen = false;
    input.menuOpen = false;
    characterMenu.style.display = 'none';
    solGridSelectedComponent = null;
  }

  function toggleMenu(tab) {
    if (menuOpen && menuTab === tab) {
      closeMenu();
    } else if (menuOpen) {
      switchTab(tab);
    } else {
      openMenu(tab);
    }
  }

  function switchTab(tab) {
    // Skip disabled solgrid tab
    if (tab === 'solgrid' && !solGridState) return;

    menuTab = tab;
    // Update tab UI
    document.querySelectorAll('#character-menu .inv-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    // Show/hide content divs
    for (const t of MENU_TABS) {
      const el = document.getElementById('inv-tab-' + t);
      if (el) el.style.display = t === tab ? '' : 'none';
    }
    // Update sol grid tab disabled state
    const solTab = document.querySelector('#character-menu .inv-tab[data-tab="solgrid"]');
    if (solTab) solTab.classList.toggle('disabled', !solGridState);

    // Render the active tab content
    if (tab === 'equipment') renderEquipmentSlots();
    if (tab === 'inventory') renderInventoryGrid();
    if (tab === 'solgrid') renderSolGrid();
    if (tab === 'quests') renderQuestPanel();

    resetCursor();
  }

  function cycleTab(direction) {
    let idx = MENU_TABS.indexOf(menuTab);
    for (let i = 0; i < MENU_TABS.length; i++) {
      idx = (idx + direction + MENU_TABS.length) % MENU_TABS.length;
      const candidate = MENU_TABS[idx];
      // Skip disabled solgrid tab
      if (candidate === 'solgrid' && !solGridState) continue;
      switchTab(candidate);
      return;
    }
  }

  // --- Cursor navigation ---
  function resetCursor() {
    cursorIndex = 0;
    updateCursorHighlight();
  }

  function getCursorItems() {
    if (menuTab === 'equipment') return characterMenu.querySelectorAll('.equip-slot-box');
    if (menuTab === 'inventory') return characterMenu.querySelectorAll('.inv-grid-cell');
    if (menuTab === 'solgrid') return characterMenu.querySelectorAll('.sol-cell');
    if (menuTab === 'quests') return characterMenu.querySelectorAll('.quest-step');
    return [];
  }

  function getColumnsForTab() {
    if (menuTab === 'equipment') return 1;
    if (menuTab === 'inventory') return 5;
    if (menuTab === 'solgrid') return solGridState ? solGridState.size || 5 : 5;
    if (menuTab === 'quests') return 1;
    return 1;
  }

  function moveCursor(direction) {
    const items = getCursorItems();
    if (items.length === 0) return;
    const cols = getColumnsForTab();
    let idx = cursorIndex;

    if (direction === 'up') idx -= cols;
    else if (direction === 'down') idx += cols;
    else if (direction === 'left') idx -= 1;
    else if (direction === 'right') idx += 1;

    // Clamp
    if (idx < 0) idx = 0;
    if (idx >= items.length) idx = items.length - 1;

    cursorIndex = idx;
    updateCursorHighlight();
  }

  function updateCursorHighlight() {
    // Remove all highlights
    characterMenu.querySelectorAll('.cursor-selected').forEach(el => el.classList.remove('cursor-selected'));
    const items = getCursorItems();
    if (items.length === 0) return;
    if (cursorIndex >= items.length) cursorIndex = items.length - 1;
    if (cursorIndex < 0) cursorIndex = 0;
    const el = items[cursorIndex];
    if (el) {
      el.classList.add('cursor-selected');
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function confirmCursor() {
    const items = getCursorItems();
    if (items.length === 0) return;
    if (cursorIndex >= 0 && cursorIndex < items.length) {
      items[cursorIndex].click();
    }
  }

  // --- Quest panel ---
  function renderQuestPanel() {
    questPanelContent.innerHTML = '';
    if (questState.length === 0) {
      questPanelContent.innerHTML = '<div style="font-size:12px;color:#555;text-align:center;padding:12px 0;">No active quests</div>';
      return;
    }

    for (const quest of questState) {
      // Quest header row with title and track button
      const headerDiv = document.createElement('div');
      headerDiv.className = 'quest-header';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'quest-title';
      titleDiv.textContent = quest.name;
      headerDiv.appendChild(titleDiv);

      // Track button — allows toggling which quest to follow
      const hasActiveSteps = quest.steps.some(s => s.status === 'active');
      if (hasActiveSteps) {
        const trackBtn = document.createElement('div');
        trackBtn.className = 'quest-track-btn' + (quest.tracked ? ' tracked' : '');
        trackBtn.textContent = quest.tracked ? 'TRACKING' : 'TRACK';
        trackBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          net.send({ type: CONSTANTS.MSG.TRACK_QUEST, questId: quest.id });
        });
        headerDiv.appendChild(trackBtn);
      }

      questPanelContent.appendChild(headerDiv);

      const descDiv = document.createElement('div');
      descDiv.className = 'quest-desc';
      descDiv.textContent = quest.description;
      questPanelContent.appendChild(descDiv);

      for (const step of quest.steps) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'quest-step ' + step.status;
        stepDiv.textContent = step.label;

        if (step.description && step.status !== 'locked') {
          const descSpan = document.createElement('div');
          descSpan.className = 'step-desc';
          descSpan.textContent = step.description;
          stepDiv.appendChild(descSpan);
        }

        questPanelContent.appendChild(stepDiv);
      }
    }
    updateCursorHighlight();
  }

  function showQuestToast(text) {
    questToast.textContent = text;
    questToast.style.display = 'block';
    if (questToastTimeout) clearTimeout(questToastTimeout);
    questToastTimeout = setTimeout(() => {
      questToast.style.display = 'none';
    }, 3000);
  }

  // --- Tab click handlers ---
  document.querySelectorAll('#character-menu .inv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  function updateActionBar() {
    for (let i = 0; i < 6; i++) {
      const slotNum = i + 1;
      // Skip slot 1 if currently showing interact override
      if (slotNum === 1 && slot1InteractMode) continue;
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

        // Check if this is a sol unit (show OPEN tag on sol_unit slot)
        if (slot === 'sol_unit' && solGridState) {
          html += '<span class="sol-open-tag">OPEN</span>';
        }

        div.innerHTML = html;
        div.addEventListener('click', () => {
          // If sol_unit slot has sol unit with grid, switch to sol grid tab
          if (slot === 'sol_unit' && solGridState) {
            switchTab('solgrid');
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
    updateCursorHighlight();
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
    updateCursorHighlight();
  }

  function renderSolGrid() {
    if (!solGridState) return;
    solGridContainer.innerHTML = '';
    const size = solGridState.size || 5;

    // --- Top section: placement grid ---
    const grid = document.createElement('div');
    grid.className = 'sol-grid';
    grid.style.gridTemplateColumns = `repeat(${size}, 80px)`;

    for (let i = 0; i < size * size; i++) {
      const cell = document.createElement('div');
      cell.className = 'sol-cell';
      const comp = solGridState.cells[i];
      const gx = i % size;
      const gy = Math.floor(i / size);

      if (comp) {
        if (comp.abilityId) {
          cell.classList.add('has-ability');
          if (!comp.isExtension) {
            const label = comp.abilityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            let html = '<div class="sol-cell-name">' + label + '</div>';
            // Show modifier bonuses if present
            if (comp.modifiers && comp.modifiers.length > 0) {
              for (const mod of comp.modifiers) {
                if (mod.bonus.damageMultiplier) {
                  html += '<div class="sol-mod-tag">+' + Math.round(mod.bonus.damageMultiplier * 100) + '% dmg</div>';
                }
                if (mod.bonus.cooldownReduction) {
                  html += '<div class="sol-mod-tag">-' + Math.round(mod.bonus.cooldownReduction * 100) + '% cd</div>';
                }
              }
            }
            cell.innerHTML = html;
          }
        } else if (comp.modifierId) {
          cell.classList.add('has-modifier');
          if (!comp.isExtension) {
            cell.textContent = comp.modifierId.replace(/_/g, ' ');
          }
        }
        if (comp.isExtension) {
          cell.style.opacity = '0.6';
        }

        // Merge borders for multi-cell shapes
        if (comp.placementId) {
          const checkNeighbor = (dx, dy) => {
            const nx = gx + dx, ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) return false;
            const nc = solGridState.cells[ny * size + nx];
            return nc && nc.placementId === comp.placementId;
          };
          if (checkNeighbor(0, -1)) cell.classList.add('shape-top');
          if (checkNeighbor(0, 1)) cell.classList.add('shape-bottom');
          if (checkNeighbor(-1, 0)) cell.classList.add('shape-left');
          if (checkNeighbor(1, 0)) cell.classList.add('shape-right');
        }

        // Click placed component → remove it
        cell.addEventListener('click', () => {
          net.send({
            type: CONSTANTS.MSG.SOL_GRID_REMOVE,
            gridX: gx,
            gridY: gy,
          });
          solGridSelectedComponent = null;
        });
      } else {
        // Empty cell — click to place selected component
        cell.addEventListener('click', () => {
          if (solGridSelectedComponent !== null) {
            net.send({
              type: CONSTANTS.MSG.SOL_GRID_PLACE,
              inventoryIndex: solGridSelectedComponent,
              gridX: gx,
              gridY: gy,
            });
            solGridSelectedComponent = null;
          }
        });
        if (solGridSelectedComponent !== null) {
          cell.style.cursor = 'crosshair';
        }
      }

      grid.appendChild(cell);
    }

    solGridContainer.appendChild(grid);

    // Highlight adjacency connections
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (let cy = 0; cy < size; cy++) {
      for (let cx = 0; cx < size; cx++) {
        const ci = cy * size + cx;
        const comp = solGridState.cells[ci];
        if (!comp || !comp.abilityId) continue;
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

    // --- Bottom section: component inventory ---
    const solComponents = inventoryItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.category === 'sol_component');

    if (solComponents.length > 0) {
      const divider = document.createElement('div');
      divider.style.cssText = 'color:#666;font-size:10px;text-align:center;margin:8px 0 4px;text-transform:uppercase;letter-spacing:1px;';
      divider.textContent = 'Components';
      solGridContainer.appendChild(divider);

      const compGrid = document.createElement('div');
      compGrid.style.cssText = 'display:flex;gap:4px;justify-content:center;flex-wrap:wrap;';

      for (const { item, idx } of solComponents) {
        const compCell = document.createElement('div');
        compCell.className = 'sol-cell has-modifier';
        compCell.style.width = '80px';
        compCell.style.height = '80px';
        compCell.textContent = item.name.replace(' Chip', '');
        if (solGridSelectedComponent === idx) {
          compCell.classList.add('selected');
        }
        compCell.addEventListener('click', () => {
          solGridSelectedComponent = (solGridSelectedComponent === idx) ? null : idx;
          renderSolGrid();
        });
        compGrid.appendChild(compCell);
      }
      solGridContainer.appendChild(compGrid);
    }

    // Info text
    if (solGridSelectedComponent !== null) {
      solGridInfo.textContent = 'Click an empty grid cell to place';
    } else {
      solGridInfo.textContent = 'Click a component below to select, or click placed to remove';
    }
    updateCursorHighlight();
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

    // Slot 1 interact override: if there's an interactable nearby and no monsters nearby,
    // override slot 1 to show the interact action instead of the normal ability
    const prevMode = slot1InteractMode;
    slot1InteractMode = null;

    if (label) {
      // Check if any alive monsters are within aggro range
      let monstersNearby = false;
      if (renderer.state.monsters) {
        const aggroRange = CONSTANTS.MONSTER_AGGRO_RANGE * ts;
        for (const mob of renderer.state.monsters) {
          if (mob.health <= 0) continue;
          const dx = mob.x - me.x, dy = mob.y - me.y;
          if (Math.sqrt(dx * dx + dy * dy) < aggroRange) {
            monstersNearby = true;
            break;
          }
        }
      }
      if (!monstersNearby) {
        slot1InteractMode = label;
      }
    }

    // Update slot 1 display if interact mode changed
    if (slot1InteractMode !== prevMode) {
      updateSlot1Display();
    }
  }

  function updateSlot1Display() {
    const desktopSlot = document.querySelector('.action-slot[data-slot="1"]');
    const mobileSlot = document.querySelector('.ability-btn[data-slot="1"]');

    if (slot1InteractMode) {
      if (desktopSlot) {
        desktopSlot.classList.remove('empty');
        const labelEl = desktopSlot.querySelector('.slot-label');
        if (labelEl) labelEl.textContent = slot1InteractMode;
      }
      if (mobileSlot) {
        mobileSlot.classList.remove('empty');
        mobileSlot.textContent = slot1InteractMode;
      }
    } else {
      // Restore normal ability display for slot 1
      const abilityId = abilityState[0];
      if (abilityId) {
        const aLabel = abilityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (desktopSlot) {
          desktopSlot.classList.remove('empty');
          const labelEl = desktopSlot.querySelector('.slot-label');
          if (labelEl) labelEl.textContent = aLabel;
        }
        if (mobileSlot) {
          mobileSlot.classList.remove('empty');
          mobileSlot.textContent = '1';
        }
      } else {
        if (desktopSlot) {
          desktopSlot.classList.add('empty');
          const labelEl = desktopSlot.querySelector('.slot-label');
          if (labelEl) labelEl.innerHTML = '&mdash;';
        }
        if (mobileSlot) {
          mobileSlot.classList.add('empty');
          mobileSlot.textContent = '1';
        }
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
    // Slot 1 interact override: behave like interact key
    if (slot === 1 && slot1InteractMode) {
      if (dialogueActive) { advanceDialogue(); return; }
      if (menuOpen) return;
      net.send({ type: CONSTANTS.MSG.INTERACT });
      return;
    }

    if (dialogueActive || menuOpen) return;

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
    if (menuOpen) { closeMenu(); return; }
    net.send({ type: CONSTANTS.MSG.INTERACT });
  };

  // --- Menu dispatches ---
  input.onInventory = function () {
    toggleMenu('equipment');
  };

  input.onMapToggle = function () {
    renderer.toggleFullMap();
  };

  input.onQuestPanel = function () {
    toggleMenu('quests');
  };

  input.onMenuOpen = function () {
    if (menuOpen) closeMenu();
    else openMenu('equipment');
  };

  input.onMenuCycle = function (dir) {
    if (menuOpen) cycleTab(dir);
  };

  input.onMenuNavigate = function (dir) {
    if (menuOpen) moveCursor(dir);
  };

  input.onMenuConfirm = function () {
    if (menuOpen) confirmCursor();
  };

  input.onMenuClose = function () {
    closeMenu();
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
          energyBar.style.display = 'block';
          const ePct = (me.energy / me.maxEnergy) * 100;
          energyFill.style.width = `${ePct}%`;
          energyText.textContent = `SOL ${Math.round(me.energy)}/${me.maxEnergy}`;
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
    renderer.fullMap = false;
    input.clearMoveTarget();
    // Close any open dialogue or choice menu
    closeDialogue();
    closeChoiceMenu();
  });

  net.on(CONSTANTS.MSG.DIALOGUE, (msg) => {
    if (msg.dialogue && msg.dialogue.length > 0) {
      showDialogue(msg.dialogue, msg.npcId);
    }
  });

  net.on(CONSTANTS.MSG.CHOICE_MENU, (msg) => {
    if (msg.options && msg.options.length > 0) {
      showChoiceMenu(msg.choiceId, msg.prompt, msg.options);
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
    // Update sol tab disabled state
    const solTab = document.querySelector('#character-menu .inv-tab[data-tab="solgrid"]');
    if (solTab) solTab.classList.toggle('disabled', !solGridState);
    // If sol grid tab became unavailable while viewing it, switch away
    if (menuOpen && menuTab === 'solgrid' && !solGridState) {
      switchTab('equipment');
    }
    if (menuOpen && menuTab === 'solgrid' && solGridState) {
      renderSolGrid();
    }
    // Re-render equipment slots to show/hide OPEN tag
    if (menuOpen && menuTab === 'equipment') renderEquipmentSlots();
  });

  net.on(CONSTANTS.MSG.ABILITY_STATE, (msg) => {
    abilityState = msg.abilities || [null, null, null, null, null, null];
    cooldownState = msg.cooldowns || [0, 0, 0, 0, 0, 0];
    updateActionBar();
  });

  net.on(CONSTANTS.MSG.QUEST_OBJECTIVE, (msg) => {
    renderer.questObjective = msg.objective || null;
    // Update HUD quest label with quest name + step label
    if (msg.objective && msg.objective.label) {
      const prefix = msg.objective.questName ? msg.objective.questName + ': ' : '';
      questLabel.textContent = '\u25B8 ' + prefix + msg.objective.label;
      questLabel.style.display = '';
    } else {
      questLabel.style.display = 'none';
    }
  });

  net.on(CONSTANTS.MSG.QUEST_STATE, (msg) => {
    questState = msg.quests || [];
    if (menuOpen && menuTab === 'quests') renderQuestPanel();
  });

  net.on(CONSTANTS.MSG.QUEST_STEP_COMPLETE, (msg) => {
    showQuestToast('\u2714 ' + msg.label);
  });

  net.on(CONSTANTS.MSG.QUEST_STARTED, (msg) => {
    showQuestToast('New Quest: ' + msg.name);
  });

  net.on(CONSTANTS.MSG.INVENTORY, (msg) => {
    inventoryItems = msg.items || [];
    if (msg.equipment) {
      equipmentState = msg.equipment;
    }
    if (menuOpen && (menuTab === 'equipment' || menuTab === 'inventory')) {
      if (menuTab === 'equipment') renderEquipmentSlots();
      if (menuTab === 'inventory') renderInventoryGrid();
    }
    // Re-render sol grid when inventory changes so the component list stays in sync
    if (menuOpen && menuTab === 'solgrid' && solGridState) {
      solGridSelectedComponent = null;
      renderSolGrid();
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
