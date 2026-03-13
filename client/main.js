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
  const energySingleUseFill = document.getElementById('energy-single-use-fill');
  const energyText = document.getElementById('energy-text');
  const hudName = document.getElementById('hud-name');
  const xpFill = document.getElementById('xp-fill');
  const xpText = document.getElementById('xp-text');
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
  const milestonToast = document.getElementById('automation-milestone-toast');
  const milestoneText = document.getElementById('automation-milestone-text');
  const raidToast = document.getElementById('raid-alert-toast');
  const raidAlertText = document.getElementById('raid-alert-text');
  const raidIncomingToast = document.getElementById('raid-incoming-toast');
  const raidIncomingText = document.getElementById('raid-incoming-text');
  const raidCountdownTimer = document.getElementById('raid-countdown-timer');
  const raidDefendBtn = document.getElementById('raid-defend-btn');
  const questPanelContent = document.getElementById('quest-panel-content');
  const solGridContainer = document.getElementById('sol-grid-container');
  const solGridInfo = document.getElementById('sol-grid-info');
  const choiceOverlay = document.getElementById('choice-overlay');
  const choicePrompt = document.getElementById('choice-prompt');
  const choiceOptions = document.getElementById('choice-options');
  const automationOverlay = document.getElementById('automation-overlay');

  const soundBtn = document.getElementById('sound-btn');
  const worldmapBtn = document.getElementById('worldmap-btn');
  const onboardMove = document.getElementById('onboard-move');
  const onboardInteract = document.getElementById('onboard-interact');
  const expeditionHud = document.getElementById('expedition-hud');
  const expeditionTier = document.getElementById('expedition-tier');
  const expeditionFloor = document.getElementById('expedition-floor');
  const expeditionParty = document.getElementById('expedition-party');
  const bossBar = document.getElementById('boss-bar');
  const bossBarName = document.getElementById('boss-bar-name');
  const bossBarFill = document.getElementById('boss-bar-fill');
  const bossBarText = document.getElementById('boss-bar-text');
  const bossBarPhase = document.getElementById('boss-bar-phase');
  const partyFrames = document.getElementById('party-frames');
  const siegeHud = document.getElementById('siege-hud');
  const siegeTitle = document.getElementById('siege-title');
  const siegeWave = document.getElementById('siege-wave');
  const siegePhase = document.getElementById('siege-phase');
  const siegeLhFill = document.getElementById('siege-lh-fill');
  const siegeLhText = document.getElementById('siege-lh-text');
  const siegeEnergyFill = document.getElementById('siege-energy-fill');
  const siegeEnergyText = document.getElementById('siege-energy-text');
  const siegeMonsters = document.getElementById('siege-monsters');
  const siegeRepairBtn = document.getElementById('siege-repair-btn');
  const deathOverlay = document.getElementById('death-overlay');
  const deathDetails = document.getElementById('death-details');
  const siegeOverlay = document.getElementById('siege-overlay');
  const siegeOverlayTitle = document.getElementById('siege-overlay-title');
  const siegeOverlayDetails = document.getElementById('siege-overlay-details');
  const PARTY_COLORS = ['#4fc3f7', '#ef5350', '#66bb6a', '#ffa726'];

  // --- Instances ---
  const net = new NetClient();
  const renderer = new Renderer(canvas);
  const input = new InputHandler(net);
  const audio = new AudioManager();
  input.renderer = renderer;  // For click-to-move coordinate conversion
  renderer.aimIndicator = input.aimIndicator;  // For aim line drawing

  // Load audio definitions
  fetch('/content/audio/sounds.json').then(r => r.json()).then(d => audio.loadSounds(d)).catch(() => {});
  fetch('/content/audio/music.json').then(r => r.json()).then(d => audio.loadMusic(d)).catch(() => {});

  // Sound mute button
  if (audio.muted) soundBtn.classList.add('muted');
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const muted = audio.toggleMute();
    soundBtn.classList.toggle('muted', muted);
  });

  // World map button
  worldmapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWorldmap();
  });

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
  let currentAmbientTrack = 'dungeon'; // Track biome ambient so boss defeat restores correctly

  // --- Onboarding state ---
  let onboardMoveShown = false;
  let onboardMoveDismissed = false;
  let onboardInteractDismissed = false;

  function dismissOnboardHint(el, onDone) {
    if (!el || el.style.display === 'none') return;
    el.classList.add('fade-out');
    el.addEventListener('animationend', () => {
      el.style.display = 'none';
      if (onDone) onDone();
    }, { once: true });
  }

  // --- Dialogue state ---
  let dialogueActive = false;
  let dialogueLines = [];    // Array of { speaker, text }
  let dialogueIndex = 0;
  let dialogueMode = null;   // 'bubble' or 'system'
  let dialogueNpcId = null;  // NPC instance ID for current dialogue

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
    dialogueNpcId = npcId || null;

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
      } else {
        audio.play('dialogue_advance');
      }
      return;
    }
    // System overlay mode
    dialogueIndex++;
    if (dialogueIndex >= dialogueLines.length) {
      closeDialogue();
      return;
    }
    audio.play('dialogue_advance');
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
    dialogueNpcId = null;
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
  let choiceSelectedIndex = 0;
  let currentChoiceId = null;
  let currentChoiceOptions = [];

  function showChoiceMenu(choiceId, prompt, options) {
    closeDialogue();
    closeMenu();
    choiceActive = true;
    input.dialogueActive = true;
    input.choiceActive = true;
    currentChoiceId = choiceId;
    currentChoiceOptions = options;
    choiceSelectedIndex = 0;
    choicePrompt.textContent = prompt;
    choiceOptions.innerHTML = '';
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const div = document.createElement('div');
      div.className = 'choice-option';
      if (i === 0) div.classList.add('choice-selected');
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
        audio.play('choice_select');
        closeChoiceMenu();
      });
      choiceOptions.appendChild(div);
    }
    choiceOverlay.style.display = 'block';
  }

  function updateChoiceSelection() {
    const items = choiceOptions.querySelectorAll('.choice-option');
    items.forEach((el, i) => {
      el.classList.toggle('choice-selected', i === choiceSelectedIndex);
    });
  }

  function navigateChoice(dir) {
    if (!choiceActive || currentChoiceOptions.length === 0) return;
    if (dir === 'up') {
      choiceSelectedIndex = (choiceSelectedIndex - 1 + currentChoiceOptions.length) % currentChoiceOptions.length;
    } else if (dir === 'down') {
      choiceSelectedIndex = (choiceSelectedIndex + 1) % currentChoiceOptions.length;
    }
    updateChoiceSelection();
    audio.play('dialogue_advance');
  }

  function confirmChoice() {
    if (!choiceActive || currentChoiceOptions.length === 0) return;
    const opt = currentChoiceOptions[choiceSelectedIndex];
    if (opt) {
      net.send({ type: CONSTANTS.MSG.CHOICE_SELECT, choiceId: currentChoiceId, value: opt.value });
      audio.play('choice_select');
      closeChoiceMenu();
    }
  }

  function closeChoiceMenu() {
    choiceActive = false;
    input.dialogueActive = false;
    input.choiceActive = false;
    currentChoiceId = null;
    currentChoiceOptions = [];
    choiceOverlay.style.display = 'none';
  }

  // --- Inventory & equipment state ---
  let itemCatalog = {}; // item type -> full definition from server
  let inventoryItems = [];
  let bankedItems = []; // items cached at expedition checkpoints
  let inExpedition = false;
  let equipmentState = { arms: null, sol_unit: null, medipac: null, accessory: null };
  let abilityState = [null, null, null, null, null, null];
  let cooldownState = [0, 0, 0, 0, 0, 0];
  let medipacCharges = 0;
  let playerCredits = 0;
  let slot1InteractMode = null; // null or interact label string when slot 1 is overridden
  const SLOT_DISPLAY_NAMES = { arms: 'Arms', sol_unit: 'Sol Unit', medipac: 'Medipac', accessory: 'Accessory' };

  // Player stats (cached from state messages for stats panel)
  let playerStats = null;

  // Sol grid state
  let solGridState = null;
  let solGridSelectedComponent = null; // inventory index of selected component for placement
  let weaponUpgradeState = null; // server-sent weapon upgrade grid state
  let weaponUpgradeSelectedMaterial = null; // inventory index of selected crafting material

  // Quest state
  let questState = [];
  let partyQuestsState = [];
  const expandedQuests = new Set(); // track which quests have their completed steps expanded
  let questToastTimeout = null;
  let milestoneToastTimeout = null;
  let raidToastTimeout = null;
  let raidIncomingInterval = null;
  let raidIncomingCountdown = 0;

  // Tutorial arrow state (driven by quest uiHint)
  let tutorialPhase = null;  // null | 'open_menu' | 'click_sol_tab' | 'select_component' | 'place_component'
  let tutorialArrowEl = null;
  let tutorialLabelEl = null;

  function clearTutorialArrow() {
    if (tutorialArrowEl) { tutorialArrowEl.remove(); tutorialArrowEl = null; }
    if (tutorialLabelEl) { tutorialLabelEl.remove(); tutorialLabelEl = null; }
  }

  function showTutorialArrow(targetEl, labelText, side) {
    clearTutorialArrow();
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const arrow = document.createElement('div');
    arrow.className = 'tutorial-arrow';
    const label = document.createElement('div');
    label.className = 'tutorial-arrow-label';
    label.textContent = labelText;

    if (side === 'below') {
      // Upward-pointing arrow below the target (bigger for visibility)
      arrow.style.borderLeft = '14px solid transparent';
      arrow.style.borderRight = '14px solid transparent';
      arrow.style.borderTop = 'none';
      arrow.style.borderBottom = '20px solid #ffa726';
      arrow.style.left = (rect.left + rect.width / 2 - 14) + 'px';
      arrow.style.top = (rect.bottom + 8) + 'px';
      label.style.left = (rect.left + rect.width / 2) + 'px';
      label.style.top = (rect.bottom + 32) + 'px';
      label.style.transform = 'translateX(-50%)';
      label.style.fontSize = '13px';
    } else if (side === 'above') {
      arrow.style.left = (rect.left + rect.width / 2 - 10) + 'px';
      arrow.style.top = (rect.top - 18) + 'px';
      label.style.left = (rect.left + rect.width / 2) + 'px';
      label.style.top = (rect.top - 36) + 'px';
      label.style.transform = 'translateX(-50%)';
    } else {
      // 'left' — arrow to the left of target
      arrow.style.left = (rect.left - 26) + 'px';
      arrow.style.top = (rect.top + rect.height / 2 - 7) + 'px';
      arrow.style.borderTop = 'none';
      arrow.style.borderBottom = '10px solid transparent';
      arrow.style.borderLeft = 'none';
      arrow.style.borderRight = '14px solid #ffa726';
      label.style.left = (rect.left - 30) + 'px';
      label.style.top = (rect.top + rect.height / 2 - 20) + 'px';
      label.style.transform = 'translateX(-100%)';
    }

    document.body.appendChild(arrow);
    document.body.appendChild(label);
    tutorialArrowEl = arrow;
    tutorialLabelEl = label;
  }

  function updateTutorialArrow() {
    if (!tutorialPhase) { clearTutorialArrow(); return; }

    if (tutorialPhase === 'open_menu') {
      // Point at the INV button
      const btn = document.getElementById('inventory-btn');
      if (btn) showTutorialArrow(btn, 'Press I / tap INV', 'below');
      return;
    }

    if (tutorialPhase === 'click_sol_tab') {
      // Point at the SOL tab in the character menu
      const solTab = document.querySelector('#character-menu .inv-tab[data-tab="solgrid"]');
      if (solTab) showTutorialArrow(solTab, 'Click SOL tab', 'above');
      return;
    }

    if (tutorialPhase === 'select_component') {
      // Point at the first sol component in the inventory list (bottom of sol grid)
      const compCell = document.querySelector('#inv-tab-solgrid .sol-inv-comp');
      if (compCell) {
        showTutorialArrow(compCell, 'Select the booster', 'above');
      } else {
        clearTutorialArrow();
      }
      return;
    }

    if (tutorialPhase === 'place_component') {
      // Point at grid cell adjacent to the sol cone (cell 2,1 — above center)
      const cells = document.querySelectorAll('#inv-tab-solgrid .sol-grid .sol-cell');
      // Grid is 5x5, cell (2,1) = index 7
      if (cells.length >= 25 && cells[7]) {
        showTutorialArrow(cells[7], 'Place here', 'above');
      } else {
        clearTutorialArrow();
      }
      return;
    }
  }

  function advanceTutorialPhase() {
    if (tutorialPhase === 'open_menu') {
      tutorialPhase = 'click_sol_tab';
    } else if (tutorialPhase === 'click_sol_tab') {
      tutorialPhase = 'select_component';
    } else if (tutorialPhase === 'select_component') {
      tutorialPhase = 'place_component';
    } else if (tutorialPhase === 'place_component') {
      tutorialPhase = null;
    }
    updateTutorialArrow();
  }

  // Automation state
  let autoState = null;
  let automationScreenOpen = false;
  let automationSelectedStructure = null; // structureId selected for placement
  let prevAutoLevel = null; // tracks previous automation level for level-up sound

  // --- Worldmap state ---
  let worldmapData = null;          // Full worldmap JSON from server
  let worldmapCurrentLocation = null; // Location id player is in
  let worldmapOpen = false;
  let worldmapHoveredLocation = null; // Location id under cursor
  let worldmapSelectedIndex = 0;      // Index for gamepad navigation
  let worldmapAnimFrame = null;       // Animation frame id

  const worldmapOverlay = document.getElementById('worldmap-overlay');
  const worldmapCanvas = document.getElementById('worldmap-canvas');
  const worldmapCtx = worldmapCanvas.getContext('2d');
  const worldmapTooltip = document.getElementById('worldmap-tooltip');
  const worldmapCloseBtn = document.getElementById('worldmap-close');

  function openWorldmap() {
    if (!worldmapData || worldmapOpen) return;
    worldmapOpen = true;
    input.dialogueActive = true;
    input.worldmapOpen = true;
    closeMenu();
    closeDialogue();
    renderer.fullMap = false;
    worldmapOverlay.style.display = 'block';
    worldmapHoveredLocation = null;
    worldmapTooltip.style.display = 'none';
    // Size canvas to overlay
    worldmapCanvas.width = worldmapOverlay.clientWidth;
    worldmapCanvas.height = worldmapOverlay.clientHeight;
    // Set initial gamepad cursor to current location
    if (worldmapCurrentLocation && worldmapData.locations) {
      const idx = worldmapData.locations.findIndex(l => l.id === worldmapCurrentLocation);
      worldmapSelectedIndex = idx >= 0 ? idx : 0;
    }
    renderWorldmapLoop();
    audio.play('menu_open');
  }

  function closeWorldmap() {
    if (!worldmapOpen) return;
    worldmapOpen = false;
    input.dialogueActive = false;
    input.worldmapOpen = false;
    worldmapOverlay.style.display = 'none';
    worldmapTooltip.style.display = 'none';
    if (worldmapAnimFrame) {
      cancelAnimationFrame(worldmapAnimFrame);
      worldmapAnimFrame = null;
    }
    audio.play('menu_close');
  }

  function toggleWorldmap() {
    if (worldmapOpen) closeWorldmap();
    else openWorldmap();
  }

  worldmapCloseBtn.addEventListener('click', closeWorldmap);

  // --- Worldmap rendering ---
  function getWorldmapLayout() {
    // Compute pixel positions for all locations based on normalized coords
    const w = worldmapCanvas.width;
    const h = worldmapCanvas.height;
    const pad = 60;
    const mapW = w - pad * 2;
    const mapH = h - pad * 2 - 40; // extra top margin for header
    const topY = pad + 30;

    return {
      w, h, pad, mapW, mapH, topY,
      locX: (nx) => pad + nx * mapW,
      locY: (ny) => topY + ny * mapH,
    };
  }

  function renderWorldmapLoop() {
    if (!worldmapOpen) return;
    renderWorldmap();
    worldmapAnimFrame = requestAnimationFrame(renderWorldmapLoop);
  }

  function renderWorldmap() {
    if (!worldmapData) return;
    const ctx = worldmapCtx;
    const { w, h, pad, mapW, mapH, topY, locX, locY } = getWorldmapLayout();

    ctx.clearRect(0, 0, w, h);

    // Draw zone backgrounds (vertical bands)
    for (const zone of worldmapData.zones) {
      const x0 = pad + zone.xRange[0] * mapW;
      const x1 = pad + zone.xRange[1] * mapW;
      ctx.fillStyle = zone.bgColor;
      ctx.fillRect(x0, topY - 20, x1 - x0, mapH + 40);

      // Zone divider line
      if (zone.xRange[0] > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x0, topY - 20);
        ctx.lineTo(x0, topY + mapH + 20);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Zone label at top
      ctx.fillStyle = zone.color;
      ctx.globalAlpha = 0.3;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.name.toUpperCase(), (x0 + x1) / 2, topY - 6);
      ctx.globalAlpha = 1;
    }

    // Draw connections (lines between linked locations)
    const locMap = {};
    for (const loc of worldmapData.locations) {
      locMap[loc.id] = loc;
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (const conn of worldmapData.connections) {
      const a = locMap[conn[0]];
      const b = locMap[conn[1]];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(locX(a.x), locY(a.y));
      ctx.lineTo(locX(b.x), locY(b.y));
      ctx.stroke();
    }

    // Draw locations
    const now = Date.now();
    for (let i = 0; i < worldmapData.locations.length; i++) {
      const loc = worldmapData.locations[i];
      const px = locX(loc.x);
      const py = locY(loc.y);
      const isCurrent = loc.id === worldmapCurrentLocation;
      const isHovered = loc.id === worldmapHoveredLocation;
      const isGamepadSelected = !worldmapHoveredLocation && i === worldmapSelectedIndex;

      // Find zone color
      const zone = worldmapData.zones.find(z => z.id === loc.zone);
      const color = zone ? zone.color : '#888';

      // Location dot
      let radius = isCurrent ? 7 : 5;
      if (isHovered || isGamepadSelected) radius += 2;

      // Pulsing glow for current location
      if (isCurrent) {
        const pulse = 0.3 + 0.3 * Math.sin(now / 400);
        ctx.beginPath();
        ctx.arc(px, py, radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = pulse;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Hover/selection glow
      if (isHovered || isGamepadSelected) {
        ctx.beginPath();
        ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Dot fill
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = isCurrent ? 1 : 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Icon symbol inside dot
      const iconSymbol = getLocationIcon(loc.icon);
      if (iconSymbol && radius >= 5) {
        ctx.fillStyle = '#000';
        ctx.font = (radius < 6 ? 8 : 10) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(iconSymbol, px, py + 1);
      }

      // Dot border
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isCurrent ? '#fff' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = isCurrent ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = isCurrent ? '#fff' : '#aaa';
      ctx.font = (isCurrent ? 'bold ' : '') + '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(loc.name, px, py + radius + 4);
    }

    // "YOU ARE HERE" indicator
    if (worldmapCurrentLocation) {
      const cur = locMap[worldmapCurrentLocation];
      if (cur) {
        const px = locX(cur.x);
        const py = locY(cur.y);
        ctx.fillStyle = '#ffa726';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('YOU ARE HERE', px, py - 14);
      }
    }

    // Secondary quest objective markers (drawn first so primary draws on top)
    const secObjs = renderer.secondaryQuestObjectives;
    if (secObjs) {
      for (const sec of secObjs) {
        if (!sec.targetLocationId || sec.targetLocationId === worldmapCurrentLocation) continue;
        const secLoc = locMap[sec.targetLocationId];
        if (!secLoc) continue;
        const sx = locX(secLoc.x);
        const sy = locY(secLoc.y);
        const sPulse = 0.3 + 0.4 * Math.sin(now / 500);

        // Subtle pulsing ring
        ctx.beginPath();
        ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#90caf9';
        ctx.globalAlpha = sPulse * 0.5;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Small circle above
        ctx.beginPath();
        ctx.arc(sx, sy - 14, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#90caf9';
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Quest objective marker (primary / tracked)
    const qObj = renderer.questObjective;
    if (qObj && qObj.targetLocationId && qObj.targetLocationId !== worldmapCurrentLocation) {
      const targetLoc = locMap[qObj.targetLocationId];
      if (targetLoc) {
        const px = locX(targetLoc.x);
        const py = locY(targetLoc.y);
        const pulse = 0.4 + 0.6 * Math.sin(now / 300);

        // Pulsing outer ring
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffa726';
        ctx.globalAlpha = pulse * 0.6;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Diamond marker above the location dot
        const dy = -16;
        const s = 5;
        ctx.beginPath();
        ctx.moveTo(px, py + dy - s);
        ctx.lineTo(px + s, py + dy);
        ctx.lineTo(px, py + dy + s);
        ctx.lineTo(px - s, py + dy);
        ctx.closePath();
        ctx.fillStyle = '#ffa726';
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Label
        const label = qObj.questName || qObj.label || 'Objective';
        ctx.fillStyle = '#ffa726';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, px, py - 22);
      }
    }
  }

  function getLocationIcon(iconType) {
    switch (iconType) {
      case 'city': return '\u2302';       // house
      case 'outpost': return '\u2691';    // flag
      case 'lighthouse': return '\u2600'; // sun
      case 'dungeon': return '\u2620';    // skull
      case 'ruin': return '\u25B3';       // triangle
      case 'cave': return '\u25CF';       // circle
      case 'settlement': return '\u2616'; // house variant
      case 'station': return '\u2708';    // plane (transport)
      case 'frontier': return '\u2694';   // swords
      case 'array': return '\u2699';      // gear
      case 'path': return '\u2192';       // arrow
      case 'cache': return '\u2605';      // star
      default: return null;
    }
  }

  // --- Worldmap mouse interaction ---
  function getLocationAtPoint(screenX, screenY) {
    if (!worldmapData) return null;
    const rect = worldmapCanvas.getBoundingClientRect();
    const cx = (screenX - rect.left) * (worldmapCanvas.width / rect.width);
    const cy = (screenY - rect.top) * (worldmapCanvas.height / rect.height);
    const { locX, locY } = getWorldmapLayout();
    const hitRadius = 20;

    let closest = null;
    let closestDist = hitRadius;
    for (const loc of worldmapData.locations) {
      const px = locX(loc.x);
      const py = locY(loc.y);
      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = loc;
      }
    }
    return closest;
  }

  worldmapCanvas.addEventListener('mousemove', (e) => {
    if (!worldmapOpen) return;
    const loc = getLocationAtPoint(e.clientX, e.clientY);
    if (loc) {
      worldmapHoveredLocation = loc.id;
      showWorldmapTooltip(loc, e.clientX, e.clientY);
    } else {
      worldmapHoveredLocation = null;
      worldmapTooltip.style.display = 'none';
    }
  });

  worldmapCanvas.addEventListener('click', (e) => {
    if (!worldmapOpen) return;
    const loc = getLocationAtPoint(e.clientX, e.clientY);
    if (loc) {
      showWorldmapTooltip(loc, e.clientX, e.clientY);
    } else {
      closeWorldmap();
    }
  });

  // Touch support for worldmap
  worldmapCanvas.addEventListener('touchstart', (e) => {
    if (!worldmapOpen || e.touches.length === 0) return;
    e.preventDefault();
    const touch = e.touches[0];
    const loc = getLocationAtPoint(touch.clientX, touch.clientY);
    if (loc) {
      worldmapHoveredLocation = loc.id;
      showWorldmapTooltip(loc, touch.clientX, touch.clientY);
    } else {
      closeWorldmap();
    }
  }, { passive: false });

  function showWorldmapTooltip(loc, screenX, screenY) {
    const zone = worldmapData.zones.find(z => z.id === loc.zone);
    const zoneColor = zone ? zone.color : '#888';
    const zoneName = zone ? zone.name : '';
    const isCurrent = loc.id === worldmapCurrentLocation;

    worldmapTooltip.innerHTML =
      '<div class="wm-tip-name">' + loc.name + (isCurrent ? ' (Current)' : '') + '</div>' +
      '<div class="wm-tip-zone" style="color:' + zoneColor + '">' + zoneName + '</div>' +
      '<div class="wm-tip-desc">' + (loc.description || '') + '</div>';
    worldmapTooltip.style.display = 'block';

    // Position tooltip near cursor, clamped to viewport
    const tw = 260;
    const th = worldmapTooltip.offsetHeight || 80;
    let tx = screenX + 16;
    let ty = screenY - th / 2;
    if (tx + tw > window.innerWidth - 10) tx = screenX - tw - 16;
    if (ty < 10) ty = 10;
    if (ty + th > window.innerHeight - 10) ty = window.innerHeight - th - 10;
    worldmapTooltip.style.left = tx + 'px';
    worldmapTooltip.style.top = ty + 'px';
  }

  // Gamepad navigation for worldmap
  function worldmapNavigate(direction) {
    if (!worldmapOpen || !worldmapData || worldmapData.locations.length === 0) return;
    const locs = worldmapData.locations;
    const cur = locs[worldmapSelectedIndex];
    if (!cur) return;

    // Find nearest location in the given direction
    let bestIdx = -1;
    let bestScore = Infinity;
    const { locX, locY } = getWorldmapLayout();
    const cx = locX(cur.x);
    const cy = locY(cur.y);

    for (let i = 0; i < locs.length; i++) {
      if (i === worldmapSelectedIndex) continue;
      const loc = locs[i];
      const px = locX(loc.x);
      const py = locY(loc.y);
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check direction match
      let match = false;
      if (direction === 'right' && dx > 20) match = true;
      if (direction === 'left' && dx < -20) match = true;
      if (direction === 'down' && dy > 20) match = true;
      if (direction === 'up' && dy < -20) match = true;

      if (match) {
        // Score: distance with penalty for perpendicular offset
        const perpendicular = (direction === 'left' || direction === 'right') ? Math.abs(dy) : Math.abs(dx);
        const score = dist + perpendicular * 0.5;
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }

    if (bestIdx >= 0) {
      worldmapSelectedIndex = bestIdx;
      worldmapHoveredLocation = null;
      // Show tooltip for gamepad-selected location
      const loc = locs[worldmapSelectedIndex];
      const { locX: lx, locY: ly } = getWorldmapLayout();
      const rect = worldmapCanvas.getBoundingClientRect();
      const sx = rect.left + (lx(loc.x) / worldmapCanvas.width) * rect.width;
      const sy = rect.top + (ly(loc.y) / worldmapCanvas.height) * rect.height;
      showWorldmapTooltip(loc, sx, sy);
      audio.play('dialogue_advance');
    }
  }

  // Resize handler for worldmap canvas
  function resizeWorldmapCanvas() {
    if (!worldmapOpen) return;
    worldmapCanvas.width = worldmapOverlay.clientWidth;
    worldmapCanvas.height = worldmapOverlay.clientHeight;
  }
  window.addEventListener('resize', resizeWorldmapCanvas);

  // --- Unified character menu state ---
  let menuOpen = false;
  let menuTab = 'equipment';
  const MENU_TABS = ['equipment', 'stats', 'inventory', 'solgrid', 'weapon', 'quests', 'cached'];
  const ALL_CONTENT_TABS = ['equipment', 'stats', 'inventory', 'solgrid', 'weapon', 'quests', 'cached'];
  let cursorIndex = 0;

  function openMenu(tab) {
    menuOpen = true;
    input.menuOpen = true;
    input.stopMovement();
    renderer.fullMap = false;
    characterMenu.style.display = 'block';
    switchTab(tab || 'equipment');
    audio.play('menu_open');
  }

  function closeMenu() {
    menuOpen = false;
    input.menuOpen = false;
    characterMenu.style.display = 'none';
    solGridSelectedComponent = null;
    audio.play('menu_close');
    // Reset tutorial to open_menu phase if we close during the tutorial
    if (tutorialPhase && tutorialPhase !== 'open_menu') {
      tutorialPhase = 'open_menu';
      updateTutorialArrow();
    }
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
    // Skip disabled weapon tab
    if (tab === 'weapon' && !weaponUpgradeState) return;
    // Skip cached tab when not in an expedition
    if (tab === 'cached' && !inExpedition) return;

    if (menuOpen) audio.play('menu_navigate');
    menuTab = tab;
    // Update tab UI
    document.querySelectorAll('#character-menu .inv-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    // Show/hide content divs
    for (const t of ALL_CONTENT_TABS) {
      const el = document.getElementById('inv-tab-' + t);
      if (el) el.style.display = t === tab ? '' : 'none';
    }
    // Update sol grid tab disabled state
    const solTab = document.querySelector('#character-menu .inv-tab[data-tab="solgrid"]');
    if (solTab) solTab.classList.toggle('disabled', !solGridState);
    // Update weapon tab disabled state
    const weaponTab = document.querySelector('#character-menu .inv-tab[data-tab="weapon"]');
    if (weaponTab) weaponTab.classList.toggle('disabled', !weaponUpgradeState);

    // Render the active tab content
    if (tab === 'equipment') renderEquipmentSlots();
    if (tab === 'stats') renderStatsPanel();
    if (tab === 'inventory') renderInventoryGrid();
    if (tab === 'solgrid') renderSolGrid();
    if (tab === 'weapon') renderWeaponUpgradePanel();
    if (tab === 'auto') return; // auto tab replaced by full-screen automation overlay
    if (tab === 'quests') renderQuestPanel();
    if (tab === 'cached') renderCachedItems();

    // Advance tutorial: menu opened → show SOL tab arrow; SOL tab clicked → show component arrow
    if (tutorialPhase === 'open_menu') {
      advanceTutorialPhase(); // open_menu → click_sol_tab
    }
    if (tab === 'solgrid' && tutorialPhase === 'click_sol_tab') {
      advanceTutorialPhase(); // click_sol_tab → select_component
    }

    resetCursor();
  }

  function cycleTab(direction) {
    let idx = MENU_TABS.indexOf(menuTab);
    for (let i = 0; i < MENU_TABS.length; i++) {
      idx = (idx + direction + MENU_TABS.length) % MENU_TABS.length;
      const candidate = MENU_TABS[idx];
      // Skip disabled solgrid tab
      if (candidate === 'solgrid' && !solGridState) continue;
      // Skip disabled weapon tab
      if (candidate === 'weapon' && !weaponUpgradeState) continue;
      // Skip cached tab when not in an expedition
      if (candidate === 'cached' && !inExpedition) continue;
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
    if (menuTab === 'weapon') return characterMenu.querySelectorAll('.wu-cell, .wu-inv-cell');
    if (menuTab === 'quests') return characterMenu.querySelectorAll('.quest-track-btn, .quest-step');
    return [];
  }

  function getColumnsForTab() {
    if (menuTab === 'equipment') return 1;
    if (menuTab === 'inventory') return 5;
    if (menuTab === 'solgrid') return solGridState ? solGridState.size || 5 : 5;
    if (menuTab === 'weapon') return weaponUpgradeState ? weaponUpgradeState.size || 3 : 3;
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

  // --- Automation full-screen overlay ---
  function openAutomationScreen() {
    if (automationScreenOpen) return;
    automationScreenOpen = true;
    input.dialogueActive = true;
    closeMenu();
    closeDialogue();
    automationSelectedStructure = null;
    renderAutomationScreen();
    automationOverlay.style.display = 'block';
  }

  function closeAutomationScreen() {
    if (!automationScreenOpen) return;
    automationScreenOpen = false;
    input.dialogueActive = false;
    automationOverlay.style.display = 'none';
    automationSelectedStructure = null;
  }

  function renderAutomationScreen() {
    if (!autoState) return;
    automationOverlay.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'auto-screen';

    // Header
    const header = document.createElement('div');
    header.className = 'auto-screen-header';
    const title = document.createElement('div');
    title.className = 'auto-screen-title';
    title.textContent = 'Solar Array Command';
    const closeBtn = document.createElement('div');
    closeBtn.className = 'auto-screen-close';
    closeBtn.textContent = '[ESC] Close';
    closeBtn.addEventListener('click', closeAutomationScreen);
    header.appendChild(title);
    header.appendChild(closeBtn);
    screen.appendChild(header);

    // Progress bar
    if (autoState.stats) {
      const prog = document.createElement('div');
      prog.className = 'auto-progress';
      const progLabel = document.createElement('div');
      progLabel.className = 'auto-progress-label';
      progLabel.textContent = autoState.stats.automationLevelName || 'None';
      const progBar = document.createElement('div');
      progBar.className = 'auto-progress-bar';
      const progFill = document.createElement('div');
      progFill.className = 'auto-progress-fill';
      progFill.style.width = (autoState.stats.automationProgress * 100) + '%';
      progBar.appendChild(progFill);
      const progText = document.createElement('div');
      progText.className = 'auto-progress-text';
      if (autoState.stats.automationLevel > 0 && autoState.stats.automationProgress < 1) {
        progText.textContent = 'Level ' + autoState.stats.automationLevel +
          ' \u2014 ' + autoState.stats.totalStructures + '/' + autoState.stats.nextThreshold + ' to next level';
      } else if (autoState.stats.automationProgress >= 1) {
        progText.textContent = 'Level ' + autoState.stats.automationLevel + ' \u2014 Max level reached';
      } else {
        progText.textContent = 'Place your first structure to begin';
      }
      prog.appendChild(progLabel);
      prog.appendChild(progBar);
      prog.appendChild(progText);
      screen.appendChild(prog);
    }

    // Milestone rewards track
    if (autoState.milestones && autoState.milestones.length > 0) {
      const track = document.createElement('div');
      track.className = 'auto-rewards-track';
      const trackTitle = document.createElement('div');
      trackTitle.className = 'auto-rewards-title';
      trackTitle.textContent = 'Automation Rewards';
      track.appendChild(trackTitle);

      const trackRow = document.createElement('div');
      trackRow.className = 'auto-rewards-row';

      for (let i = 0; i < autoState.milestones.length; i++) {
        const m = autoState.milestones[i];

        // Connector line between milestones (except before first)
        if (i > 0) {
          const connector = document.createElement('div');
          connector.className = 'auto-reward-connector';
          if (m.unlocked) connector.classList.add('filled');
          trackRow.appendChild(connector);
        }

        const node = document.createElement('div');
        node.className = 'auto-reward-node';
        if (m.claimed) node.classList.add('claimed');
        else if (m.unlocked) node.classList.add('unlocked');

        const icon = document.createElement('div');
        icon.className = 'auto-reward-icon';
        icon.textContent = m.icon;

        const label = document.createElement('div');
        label.className = 'auto-reward-label';
        label.textContent = m.name;

        const thresh = document.createElement('div');
        thresh.className = 'auto-reward-thresh';
        thresh.textContent = m.threshold + ' structures';

        node.title = m.description;
        node.appendChild(icon);
        node.appendChild(label);
        node.appendChild(thresh);
        trackRow.appendChild(node);
      }

      track.appendChild(trackRow);
      screen.appendChild(track);
    }

    // Body: grid + sidebar
    const body = document.createElement('div');
    body.className = 'auto-body';

    // Grid area
    const gridArea = document.createElement('div');
    gridArea.className = 'auto-grid-area';

    if (autoState.grid) {
      const grid = document.createElement('div');
      grid.className = 'auto-grid';
      grid.style.gridTemplateColumns = 'repeat(' + autoState.grid.width + ', 38px)';

      // Build lookup sets for quick access
      const blockedSet = new Set();
      for (const b of (autoState.grid.blocked || [])) {
        blockedSet.add(b.y * autoState.grid.width + b.x);
      }
      const preBuiltMap = new Map();
      for (const pb of (autoState.grid.preBuilt || [])) {
        preBuiltMap.set(pb.y * autoState.grid.width + pb.x, pb);
      }
      const placementMap = new Map();
      for (const p of (autoState.grid.placements || [])) {
        placementMap.set(p.y * autoState.grid.width + p.x, p);
      }

      // Structure lookup for icons/colors
      const structDefs = {};
      for (const s of (autoState.structures || [])) {
        structDefs[s.id] = s;
      }

      // HP lookup by grid position
      const hpMap = new Map();
      for (const h of (autoState.structureHp || [])) {
        hpMap.set(h.x + ':' + h.y, h);
      }

      for (let cy = 0; cy < autoState.grid.height; cy++) {
        for (let cx = 0; cx < autoState.grid.width; cx++) {
          const idx = cy * autoState.grid.width + cx;
          const cell = document.createElement('div');
          cell.className = 'auto-grid-cell';
          cell.dataset.gx = cx;
          cell.dataset.gy = cy;

          const placement = placementMap.get(idx);
          const preBuilt = preBuiltMap.get(idx);
          const isBlocked = blockedSet.has(idx);

          if (placement) {
            // Player-placed structure
            cell.classList.add('placed');
            const def = structDefs[placement.structureId];
            if (def) {
              const iconSpan = document.createElement('span');
              iconSpan.textContent = def.gridIcon || '?';
              cell.appendChild(iconSpan);
              cell.style.color = def.gridColor || '#888';

              // Apply background; red tinge if damaged
              const hpInfo = hpMap.get(cx + ':' + cy);
              if (hpInfo && hpInfo.hp < hpInfo.maxHp) {
                cell.classList.add('damaged');
              } else {
                cell.style.background = 'rgba(255, 167, 38, 0.08)';
              }

              // Build tooltip content
              const tipLines = [
                '<strong style="color:' + (def.gridColor || '#ffa726') + '">' + def.name + '</strong>',
                def.description ? '<span class="auto-tip-desc">' + def.description + '</span>' : null,
              ].filter(Boolean);
              if (hpInfo && hpInfo.hp < hpInfo.maxHp) {
                tipLines.push('<span class="auto-tip-desc" style="color:#ef9a9a">HP: ' + hpInfo.hp + ' / ' + hpInfo.maxHp + '</span>');
              }

              let pinned = false;
              const tip = document.createElement('div');
              tip.className = 'auto-cell-tooltip';
              tip.innerHTML = tipLines.join('<br>');

              cell.addEventListener('mouseenter', () => {
                if (!cell.contains(tip)) cell.appendChild(tip);
              });
              cell.addEventListener('mouseleave', () => {
                if (!pinned && cell.contains(tip)) cell.removeChild(tip);
              });

              // Click / tap to pin tooltip (useful on touch)
              const togglePin = () => {
                pinned = !pinned;
                if (pinned) {
                  if (!cell.contains(tip)) cell.appendChild(tip);
                } else {
                  if (cell.contains(tip)) cell.removeChild(tip);
                }
              };
              cell.addEventListener('click', togglePin);
              cell.addEventListener('touchend', (e) => {
                e.preventDefault();
                togglePin();
              }, { passive: false });

              // HP bar at bottom of cell if structure is damaged
              if (hpInfo && hpInfo.hp < hpInfo.maxHp) {
                const hpBar = document.createElement('div');
                hpBar.className = 'auto-cell-hp-bar';
                const hpFill = document.createElement('div');
                hpFill.className = 'auto-cell-hp-fill';
                const pct = Math.max(0, (hpInfo.hp / hpInfo.maxHp) * 100);
                hpFill.style.width = pct + '%';
                if (pct < 25) hpFill.classList.add('critical');
                else if (pct < 50) hpFill.classList.add('low');
                hpBar.appendChild(hpFill);
                cell.appendChild(hpBar);
              }
            }
          } else if (preBuilt) {
            // Array infrastructure
            cell.classList.add('prebuilt');
            cell.textContent = '\u25a0';

            const prebuiltTip = document.createElement('div');
            prebuiltTip.className = 'auto-cell-tooltip';
            prebuiltTip.innerHTML = '<strong style="color:#777">' + preBuilt.label + '</strong>' +
              '<br><span class="auto-tip-desc">Output: classified.</span>';
            cell.addEventListener('mouseenter', () => {
              if (!cell.contains(prebuiltTip)) cell.appendChild(prebuiltTip);
            });
            cell.addEventListener('mouseleave', () => {
              if (cell.contains(prebuiltTip)) cell.removeChild(prebuiltTip);
            });
            cell.addEventListener('touchend', (e) => {
              e.preventDefault();
              if (cell.contains(prebuiltTip)) cell.removeChild(prebuiltTip);
              else cell.appendChild(prebuiltTip);
            }, { passive: false });
          } else if (isBlocked) {
            // Wall / non-buildable
            cell.classList.add('blocked');
          } else {
            // Buildable empty cell
            cell.classList.add('buildable');
            if (automationSelectedStructure) {
              const selDef = structDefs[automationSelectedStructure];
              const canAfford = selDef && Object.entries(selDef.cost).every(
                ([r, amt]) => (autoState.resources[r] || 0) >= amt
              );
              const isMaxed = selDef && selDef.maxCount > 0 && selDef.count >= selDef.maxCount;
              if (canAfford && !isMaxed) {
                cell.classList.add('can-build');

                // Hover tooltip: placement preview
                const costText = Object.entries(selDef.cost).map(([, amt]) => amt + '\u26cf').join(' ');
                const buildTip = document.createElement('div');
                buildTip.className = 'auto-cell-tooltip';
                buildTip.innerHTML = '<strong style="color:' + (selDef.gridColor || '#ffa726') + '">Place ' + selDef.name + '</strong>' +
                  '<br><span class="auto-tip-desc">Cost: ' + costText + '</span>';
                cell.addEventListener('mouseenter', () => {
                  if (!cell.contains(buildTip)) cell.appendChild(buildTip);
                });
                cell.addEventListener('mouseleave', () => {
                  if (cell.contains(buildTip)) cell.removeChild(buildTip);
                });

                const doBuild = () => {
                  net.send({
                    type: CONSTANTS.MSG.AUTO_BUILD,
                    structureId: automationSelectedStructure,
                    gridX: cx,
                    gridY: cy,
                  });
                };
                cell.addEventListener('click', doBuild);
                cell.addEventListener('touchend', (e) => {
                  e.preventDefault();
                  doBuild();
                }, { passive: false });
              }
            }
          }

          grid.appendChild(cell);
        }
      }

      gridArea.appendChild(grid);
    }

    // Build palette
    const palette = document.createElement('div');
    palette.className = 'auto-build-palette';
    const palTitle = document.createElement('div');
    palTitle.className = 'auto-palette-title';
    palTitle.textContent = 'Build';
    palette.appendChild(palTitle);

    const palItems = document.createElement('div');
    palItems.className = 'auto-palette-items';

    for (const s of (autoState.structures || [])) {
      const item = document.createElement('div');
      item.className = 'auto-palette-item';
      const isLocked = s.locked;
      const isMaxed = !isLocked && s.maxCount > 0 && s.count >= s.maxCount;
      const canAfford = !isLocked && Object.entries(s.cost).every(
        ([r, amt]) => (autoState.resources[r] || 0) >= amt
      );

      if (isLocked) item.classList.add('locked');
      else if (isMaxed) item.classList.add('maxed');
      else if (!canAfford) item.classList.add('cant-afford');
      if (automationSelectedStructure === s.id) item.classList.add('selected');

      const icon = document.createElement('span');
      icon.className = 'auto-palette-icon';
      icon.textContent = s.gridIcon || '?';
      icon.style.color = isLocked ? '#555' : (s.gridColor || '#888');

      const name = document.createElement('span');
      if (isLocked) {
        name.textContent = s.name + ' (Lv ' + s.unlockLevel + ')';
        name.style.color = '#555';
      } else {
        name.textContent = s.name;
      }

      const resourceSymbols = { salvage: '\u26cf', silicon: '\u25c7' };
      const costStr = Object.entries(s.cost).map(
        ([r, amt]) => amt + (resourceSymbols[r] || r)
      ).join(' ');
      const cost = document.createElement('span');
      cost.className = 'auto-palette-cost';
      cost.textContent = costStr;

      const count = document.createElement('span');
      count.className = 'auto-palette-count';
      count.textContent = isLocked ? '\ud83d\udd12' : s.count + (s.maxCount > 0 ? '/' + s.maxCount : '');

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(cost);
      item.appendChild(count);

      if (!isMaxed && !isLocked) {
        const doSelect = () => {
          automationSelectedStructure = (automationSelectedStructure === s.id) ? null : s.id;
          renderAutomationScreen();
        };
        item.addEventListener('click', doSelect);
        item.addEventListener('touchend', (e) => {
          e.preventDefault();
          doSelect();
        }, { passive: false });
      }

      palItems.appendChild(item);
    }
    palette.appendChild(palItems);

    const hint = document.createElement('div');
    hint.className = 'auto-build-hint';
    hint.textContent = automationSelectedStructure
      ? 'Click an empty grid cell to place'
      : 'Select a structure above, then click the grid to place it';
    palette.appendChild(hint);

    gridArea.appendChild(palette);
    body.appendChild(gridArea);

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'auto-sidebar';

    // Resources section
    const resSection = document.createElement('div');
    resSection.className = 'auto-sidebar-section';
    const resTitle = document.createElement('div');
    resTitle.className = 'auto-sidebar-title';
    resTitle.textContent = 'Resources';
    resSection.appendChild(resTitle);

    const salvageRow = document.createElement('div');
    salvageRow.className = 'auto-stat-row';
    salvageRow.innerHTML = '\u26cf Salvage: <span class="stat-value">' +
      (autoState.resources.salvage || 0) + '</span>';
    resSection.appendChild(salvageRow);

    if (autoState.stats) {
      if (autoState.stats.salvagePerMinute > 0) {
        const rateRow = document.createElement('div');
        rateRow.className = 'auto-stat-row';
        rateRow.innerHTML = '\u25b8 <span class="stat-value">+' +
          autoState.stats.salvagePerMinute.toFixed(1) + '</span>/min';
        resSection.appendChild(rateRow);
      }

      // Silicon resource (shown once refineries are unlocked or silicon exists)
      if ((autoState.resources.silicon || 0) > 0 || (autoState.stats.siliconPerMinute || 0) > 0) {
        const siliconRow = document.createElement('div');
        siliconRow.className = 'auto-stat-row';
        siliconRow.innerHTML = '\u25c7 Silicon: <span class="stat-value">' +
          (autoState.resources.silicon || 0) + '</span>';
        resSection.appendChild(siliconRow);

        if (autoState.stats.siliconPerMinute > 0) {
          const siRateRow = document.createElement('div');
          siRateRow.className = 'auto-stat-row';
          siRateRow.innerHTML = '\u25b8 <span class="stat-value">+' +
            autoState.stats.siliconPerMinute.toFixed(1) + '</span>/min';
          resSection.appendChild(siRateRow);
        }
      }

      if (autoState.stats.totalSalvageProduced > 0) {
        const totalRow = document.createElement('div');
        totalRow.className = 'auto-stat-row';
        totalRow.innerHTML = '\u25b8 ' + autoState.stats.totalSalvageProduced +
          ' total<span class="stat-sub">harvested</span>';
        resSection.appendChild(totalRow);
      }
      if (autoState.stats.energyRegenPerSecond > 0) {
        const energyRow = document.createElement('div');
        energyRow.className = 'auto-stat-row';
        energyRow.innerHTML = '\u26a1 Energy: <span class="stat-value">+' +
          autoState.stats.energyRegenPerSecond.toFixed(1) + '/s</span>';
        resSection.appendChild(energyRow);

        // Count solar panels
        const panelCount = (autoState.structures || []).find(s => s.id === 'solar_panel');
        if (panelCount && panelCount.count > 0) {
          const panelRow = document.createElement('div');
          panelRow.className = 'auto-stat-row';
          panelRow.innerHTML = '\u25b8 ' + panelCount.count + ' panel' +
            (panelCount.count !== 1 ? 's' : '') + ' active';
          resSection.appendChild(panelRow);
        }
      }

      // Defense rating (shown when turrets exist)
      if (autoState.stats.defenseRating > 0) {
        const defRow = document.createElement('div');
        defRow.className = 'auto-stat-row';
        defRow.innerHTML = '\ud83d\udee1 Defense: <span class="stat-value">' +
          autoState.stats.defenseRating + '</span>';
        resSection.appendChild(defRow);
      }
    }
    sidebar.appendChild(resSection);

    // Trades section
    if (autoState.trades && autoState.trades.length > 0) {
      const tradeSection = document.createElement('div');
      tradeSection.className = 'auto-sidebar-section';
      const tradeTitle = document.createElement('div');
      tradeTitle.className = 'auto-sidebar-title';
      tradeTitle.textContent = 'MERIDIAN-7 Trades';
      tradeSection.appendChild(tradeTitle);

      for (const t of autoState.trades) {
        const row = document.createElement('div');
        row.className = 'auto-trade-row';
        const canAfford = Object.entries(t.cost).every(
          ([r, amt]) => (autoState.resources[r] || 0) >= amt
        );
        if (!canAfford) row.classList.add('cant-afford');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = t.name;
        const costSpan = document.createElement('span');
        costSpan.className = 'auto-trade-cost';
        costSpan.textContent = Object.entries(t.cost).map(
          ([r, amt]) => amt + '\u26cf'
        ).join(' ');

        row.appendChild(nameSpan);
        row.appendChild(costSpan);

        if (canAfford) {
          row.addEventListener('click', () => {
            net.send({ type: CONSTANTS.MSG.AUTO_TRADE, tradeId: t.id });
          });
        }
        tradeSection.appendChild(row);
      }
      sidebar.appendChild(tradeSection);
    }

    body.appendChild(sidebar);
    screen.appendChild(body);
    automationOverlay.appendChild(screen);
  }

  // Flash a grid cell after build attempt
  function flashAutomationCell(gridX, gridY, success) {
    if (!automationScreenOpen) return;
    const cell = automationOverlay.querySelector(
      '.auto-grid-cell[data-gx="' + gridX + '"][data-gy="' + gridY + '"]'
    );
    if (!cell) return;
    cell.classList.add(success ? 'flash-success' : 'flash-fail');
    setTimeout(() => {
      cell.classList.remove('flash-success', 'flash-fail');
    }, 400);
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

      // Separate steps by status
      const completedSteps = quest.steps.filter(s => s.status === 'completed');
      const activeSteps = quest.steps.filter(s => s.status === 'active');
      const isExpanded = expandedQuests.has(quest.id);

      // Collapsed view: "..." + last completed + first active
      // Expanded view: all completed + all active (no locked)
      if (completedSteps.length > 1 && !isExpanded) {
        // "..." row to expand older completed steps
        const ellipsisDiv = document.createElement('div');
        ellipsisDiv.className = 'quest-step-ellipsis';
        ellipsisDiv.textContent = '... ' + (completedSteps.length - 1) + ' completed';
        ellipsisDiv.addEventListener('click', () => {
          expandedQuests.add(quest.id);
          renderQuestPanel();
        });
        questPanelContent.appendChild(ellipsisDiv);
      }

      const stepsToShow = isExpanded ? completedSteps : (completedSteps.length > 0 ? [completedSteps[completedSteps.length - 1]] : []);
      for (const step of stepsToShow) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'quest-step completed';
        stepDiv.textContent = step.label;
        questPanelContent.appendChild(stepDiv);
      }

      // If expanded and there are older completed steps, show a collapse button
      if (isExpanded && completedSteps.length > 1) {
        const collapseDiv = document.createElement('div');
        collapseDiv.className = 'quest-step-ellipsis';
        collapseDiv.textContent = '... collapse';
        collapseDiv.addEventListener('click', () => {
          expandedQuests.delete(quest.id);
          renderQuestPanel();
        });
        questPanelContent.appendChild(collapseDiv);
      }

      for (const step of activeSteps) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'quest-step active';
        stepDiv.textContent = step.label;

        if (step.description) {
          const descSpan = document.createElement('div');
          descSpan.className = 'step-desc';
          descSpan.textContent = step.description;
          stepDiv.appendChild(descSpan);
        }

        questPanelContent.appendChild(stepDiv);
      }
    }

    // Party quest progress section
    if (partyQuestsState.length > 0) {
      const sep = document.createElement('div');
      sep.style.cssText = 'border-top:1px solid #333;margin:8px 0 6px;';
      questPanelContent.appendChild(sep);
      const header = document.createElement('div');
      header.style.cssText = 'font-size:10px;color:#777;margin-bottom:4px;';
      header.textContent = 'PARTY PROGRESS';
      questPanelContent.appendChild(header);
      for (const pq of partyQuestsState) {
        const row = document.createElement('div');
        row.style.cssText = 'font-size:10px;margin-bottom:2px;display:flex;gap:4px;align-items:center;';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = pq.name;
        nameSpan.style.color = PARTY_COLORS[pq.colorIndex] || '#aaa';
        const stepSpan = document.createElement('span');
        stepSpan.style.color = '#999';
        stepSpan.textContent = pq.questName + ': ' + pq.stepLabel;
        row.appendChild(nameSpan);
        row.appendChild(stepSpan);
        questPanelContent.appendChild(row);
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

  function showMilestoneToast(icon, name, threshold) {
    milestoneText.textContent = icon + ' ' + name + ' — ' + threshold + ' structures';
    milestonToast.style.display = 'block';
    // Re-trigger animation by briefly removing and re-adding the element
    milestonToast.style.animation = 'none';
    void milestonToast.offsetWidth; // force reflow
    milestonToast.style.animation = '';
    if (milestoneToastTimeout) clearTimeout(milestoneToastTimeout);
    milestoneToastTimeout = setTimeout(() => {
      milestonToast.style.display = 'none';
    }, 4000);
  }

  function showRaidToast(raid) {
    if (!raid || !raid.occurred) return;

    const lines = [];

    if (raid.defended) {
      lines.push('<span style="color:#81c784">Raid defended!</span>');
      lines.push(raid.monsterCount + ' ' + (raid.monsterCount === 1 ? 'creature' : 'creatures') + ' eliminated');
      lines.push('<span style="color:#81c784">All structures safe</span>');
    } else {
      const count = raid.monsterCount || 0;
      lines.push(count + ' ' + (count === 1 ? 'creature' : 'creatures') + ' attacked');

      if (raid.defenseRating > 0) {
        const turrets = Math.round(raid.defenseRating / 50);
        lines.push(turrets + ' turret' + (turrets !== 1 ? 's' : '') + ' active \u2014 ' + raid.defenseRating + ' defense');
      }

      if (raid.destroyed && raid.destroyed.length > 0) {
        lines.push('<span style="color:#ef5350">' + raid.destroyed.length + ' structure' + (raid.destroyed.length !== 1 ? 's' : '') + ' destroyed</span>');
      }

      if (raid.damaged && raid.damaged.length > 0) {
        lines.push(raid.damaged.length + ' structure' + (raid.damaged.length !== 1 ? 's' : '') + ' damaged');
      }

      if ((!raid.damaged || raid.damaged.length === 0) && (!raid.destroyed || raid.destroyed.length === 0)) {
        lines.push('<span style="color:#81c784">All structures held</span>');
      }
    }

    raidAlertText.innerHTML = lines.join('<br>');
    raidToast.style.display = 'block';
    raidToast.style.animation = 'none';
    void raidToast.offsetWidth;
    raidToast.style.animation = '';
    if (raidToastTimeout) clearTimeout(raidToastTimeout);
    raidToastTimeout = setTimeout(() => {
      raidToast.style.display = 'none';
    }, 6000);
  }

  function showRaidIncoming(raid) {
    if (!raid || !raid.pending) return;
    // Hide any existing raid alert
    raidToast.style.display = 'none';

    const count = raid.monsterCount || 0;
    const lines = [];
    lines.push(count + ' ' + (count === 1 ? 'creature' : 'creatures') + ' approaching');
    if (raid.defenseRating > 0) {
      lines.push('Turret defense: ' + raid.defenseRating);
    }
    lines.push('Estimated damage: ' + Math.max(0, raid.totalRaidDamage - (raid.defenseRating || 0)));

    raidIncomingText.innerHTML = lines.join('<br>');
    raidIncomingCountdown = raid.countdown || 30;
    raidCountdownTimer.textContent = Math.ceil(raidIncomingCountdown);
    raidIncomingToast.style.display = 'block';
    raidIncomingToast.style.animation = 'none';
    void raidIncomingToast.offsetWidth;
    raidIncomingToast.style.animation = '';

    // Start countdown
    if (raidIncomingInterval) clearInterval(raidIncomingInterval);
    raidIncomingInterval = setInterval(() => {
      raidIncomingCountdown--;
      raidCountdownTimer.textContent = Math.max(0, Math.ceil(raidIncomingCountdown));
      if (raidIncomingCountdown <= 0) {
        clearInterval(raidIncomingInterval);
        raidIncomingInterval = null;
        raidIncomingToast.style.display = 'none';
      }
    }, 1000);
  }

  function hideRaidIncoming() {
    raidIncomingToast.style.display = 'none';
    if (raidIncomingInterval) {
      clearInterval(raidIncomingInterval);
      raidIncomingInterval = null;
    }
  }

  // Defend button sends RAID_DEFEND to server
  raidDefendBtn.addEventListener('click', () => {
    net.send({ type: CONSTANTS.MSG.RAID_DEFEND });
    hideRaidIncoming();
  });

  // Siege repair button sends SIEGE_REPAIR to server
  siegeRepairBtn.addEventListener('click', () => {
    net.send({ type: CONSTANTS.MSG.SIEGE_REPAIR });
  });

  // --- Tab click handlers ---
  document.querySelectorAll('#character-menu .inv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Close button click handler
  const closeHint = document.querySelector('#character-menu .inv-hint');
  if (closeHint) {
    closeHint.style.cursor = 'pointer';
    closeHint.addEventListener('click', () => closeMenu());
  }

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
          // Show medipac charge counter
          let badge = desktopSlot.querySelector('.charge-badge');
          if (abilityId === 'medipac_heal') {
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'charge-badge';
              desktopSlot.appendChild(badge);
            }
            badge.textContent = medipacCharges;
            badge.style.display = '';
            badge.classList.toggle('empty-charges', medipacCharges <= 0);
          } else if (badge) {
            badge.style.display = 'none';
          }
        }
        if (mobileSlot) {
          mobileSlot.classList.remove('empty');
          if (abilityId === 'medipac_heal') {
            mobileSlot.textContent = label + ' (' + medipacCharges + ')';
          } else {
            mobileSlot.textContent = label;
          }
        }
      } else {
        if (desktopSlot) {
          desktopSlot.classList.add('empty');
          const labelEl = desktopSlot.querySelector('.slot-label');
          if (labelEl) labelEl.innerHTML = '&mdash;';
          const badge = desktopSlot.querySelector('.charge-badge');
          if (badge) badge.style.display = 'none';
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
      const cd = cooldownState[i] || 0;

      // Desktop cooldown overlay
      const desktopSlot = document.querySelector(`.action-slot[data-slot="${slotNum}"]`);
      if (desktopSlot) {
        let overlay = desktopSlot.querySelector('.cooldown-overlay');
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

      // Mobile cooldown overlay
      const mobileSlot = document.querySelector(`.ability-btn[data-slot="${slotNum}"]`);
      if (mobileSlot) {
        let overlay = mobileSlot.querySelector('.cooldown-overlay');
        if (cd > 0) {
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'cooldown-overlay';
            mobileSlot.appendChild(overlay);
          }
          overlay.textContent = cd.toFixed(1);
          overlay.style.display = 'flex';
        } else if (overlay) {
          overlay.style.display = 'none';
        }
      }
    }
  }

  function formatItemStats(item) {
    const def = itemCatalog[item.type];
    const parts = [];
    if (def && def.description) parts.push(def.description);
    const stats = item.stats || (def && def.stats);
    if (stats) {
      if (stats.attackDamage) parts.push('+' + stats.attackDamage + ' ATK');
      if (stats.projectile) parts.push('Ranged');
    }
    const effect = def && def.effect;
    if (effect) {
      if (effect.heal) parts.push('Heals ' + effect.heal + ' HP');
    }
    return parts;
  }

  function renderStatsPanel() {
    const panel = document.getElementById('stats-panel');
    if (!panel || !playerStats) return;

    const s = playerStats;
    const baseHP = CONSTANTS.PLAYER_MAX_HEALTH;
    const bonusHP = s.maxHealth - baseHP;
    const baseDmg = CONSTANTS.PLAYER_ATTACK_DAMAGE;
    const bonusDmg = s.attackDamage - baseDmg;

    let html = '';

    // Level & XP section
    html += '<div class="stats-section">';
    html += '<div class="stats-section-title">LEVEL</div>';
    html += '<div class="stat-bar-row">';
    html += '<div class="stat-bar-header"><span class="stat-label">Level ' + s.level + '</span>';
    if (s.xpToNextLevel > 0) {
      html += '<span class="stat-value">' + s.xp + ' / ' + s.xpToNextLevel + ' XP</span>';
    } else {
      html += '<span class="stat-value">MAX</span>';
    }
    html += '</div>';
    if (s.xpToNextLevel > 0) {
      const xpPct = (s.xp / s.xpToNextLevel) * 100;
      html += '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + xpPct + '%;background:#ffa726"></div></div>';
    } else {
      html += '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:100%;background:#ffa726"></div></div>';
    }
    html += '</div>';
    html += '</div>';

    // Combat stats
    html += '<div class="stats-section">';
    html += '<div class="stats-section-title">COMBAT</div>';

    // HP
    html += '<div class="stat-row"><span class="stat-label">Max HP</span><span class="stat-value">' + s.maxHealth;
    if (bonusHP > 0) html += '<span class="stat-bonus">+' + bonusHP + ' from levels</span>';
    html += '</span></div>';

    // Current HP
    const hpPct = Math.round((s.health / s.maxHealth) * 100);
    html += '<div class="stat-bar-row">';
    html += '<div class="stat-bar-header"><span class="stat-label">Health</span><span class="stat-value">' + Math.round(s.health) + ' / ' + s.maxHealth + '</span></div>';
    const hpColor = hpPct > 50 ? '#4caf50' : hpPct > 25 ? '#ff9800' : '#e53935';
    html += '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + hpPct + '%;background:' + hpColor + '"></div></div>';
    html += '</div>';

    // Attack damage
    html += '<div class="stat-row"><span class="stat-label">Attack Damage</span><span class="stat-value">' + s.attackDamage;
    if (bonusDmg > 0) html += '<span class="stat-bonus">+' + bonusDmg + ' from gear</span>';
    html += '</span></div>';

    html += '</div>';

    // Energy section (only if player has energy)
    if (s.maxEnergy > 0) {
      html += '<div class="stats-section">';
      html += '<div class="stats-section-title">ENERGY</div>';
      const ePct = s.maxEnergy > 0 ? Math.round((s.energy / s.maxEnergy) * 100) : 0;
      html += '<div class="stat-bar-row">';
      html += '<div class="stat-bar-header"><span class="stat-label">Sol Energy</span><span class="stat-value">' + s.energy + ' / ' + s.maxEnergy + '</span></div>';
      html += '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + ePct + '%;background:#4fc3f7"></div></div>';
      html += '</div>';
      html += '</div>';
    }

    panel.innerHTML = html;
  }

  function renderEquipmentSlots() {
    // Clear existing slot elements (keep the label)
    const label = equipmentSlots.querySelector('.equip-label');
    equipmentSlots.innerHTML = '';
    equipmentSlots.appendChild(label);

    // Show credits if player has any
    if (playerCredits > 0) {
      const creditsDiv = document.createElement('div');
      creditsDiv.className = 'credits-display';
      creditsDiv.textContent = playerCredits + ' credits';
      equipmentSlots.appendChild(creditsDiv);
    }

    for (const slot of CONSTANTS.EQUIPMENT_SLOTS) {
      const div = document.createElement('div');
      div.className = 'equip-slot-box';
      const equipped = equipmentState[slot];
      const displayName = SLOT_DISPLAY_NAMES[slot] || slot;

      if (equipped) {
        div.classList.add('rarity-' + (equipped.rarity || 'common'));
        const rarityColor = CONSTANTS.RARITY_COLORS[equipped.rarity] || CONSTANTS.RARITY_COLORS.common;
        const statParts = formatItemStats(equipped);
        let html = '<span class="slot-label-name">' + displayName + '</span>' +
          '<span class="inv-dot" style="background:' + rarityColor + '"></span>' +
          '<span class="slot-item-info"><span class="slot-item-name" style="color:' + rarityColor + '">' + equipped.name + '</span>';

        if (statParts.length > 0) {
          html += '<span class="slot-item-stats">' + statParts.join(' · ') + '</span>';
        }
        html += '</span>';

        // Show medipac charge count
        if (slot === 'medipac') {
          html += '<span class="medipac-charges">' + medipacCharges + ' supplies</span>';
        }

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
    const detailPanel = document.createElement('div');
    detailPanel.className = 'inv-detail-panel';

    // Group identical items into stacks; use firstIndex for server messages
    // Items with different durability values don't stack together
    const stacks = [];
    const seenTypes = new Map(); // stackKey -> stacks index
    for (let i = 0; i < inventoryItems.length; i++) {
      const item = inventoryItems[i];
      const stackKey = item.durability !== undefined ? item.type + ':dur' + item.durability : item.type;
      if (seenTypes.has(stackKey)) {
        stacks[seenTypes.get(stackKey)].count++;
      } else {
        seenTypes.set(stackKey, stacks.length);
        stacks.push({ item, firstIndex: i, count: 1 });
      }
    }

    for (const { item, firstIndex, count } of stacks) {
      const cell = document.createElement('div');
      cell.className = 'inv-grid-cell rarity-' + (item.rarity || 'common');
      const rarityColor = CONSTANTS.RARITY_COLORS[item.rarity] || CONSTANTS.RARITY_COLORS.common;

      let html = '<span class="cell-dot" style="background:' + rarityColor + '"></span>' +
        '<span class="cell-name" style="color:' + rarityColor + '">' + item.name + '</span>';

      if (count > 1) {
        html += '<span class="inv-stack-count">x' + count + '</span>';
      }
      if (item.category === 'weapon' || item.category === 'equipment' || item.slot) {
        html += '<span class="inv-slot-tag">equip</span>';
      }
      if (item.category === 'consumable') {
        html += '<span class="inv-use-tag">use</span>';
      }
      if (item.durability !== undefined) {
        const durColor = item.durability <= 1 ? '#ff5252' : item.durability <= 2 ? '#ffab40' : '#aaa';
        html += '<span class="inv-dur-tag" style="color:' + durColor + '">DUR ' + item.durability + '/3</span>';
      }
      cell.innerHTML = html;

      const idx = firstIndex;
      if (item.category === 'consumable') {
        cell.addEventListener('click', () => {
          net.send({ type: CONSTANTS.MSG.USE_ITEM, index: idx });
        });
      } else {
        cell.addEventListener('click', () => {
          net.send({ type: CONSTANTS.MSG.EQUIP, index: idx });
          audio.play('equip');
        });
      }

      cell.addEventListener('mouseenter', () => showItemDetail(item, detailPanel));
      cell.addEventListener('mouseleave', () => { detailPanel.innerHTML = ''; });

      grid.appendChild(cell);
    }

    inventoryList.appendChild(grid);
    inventoryList.appendChild(detailPanel);

    updateCursorHighlight();
  }

  function renderCachedItems() {
    const cachedList = document.getElementById('cached-list');
    if (!cachedList) return;
    cachedList.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'cached-header';
    header.textContent = bankedItems.length > 0
      ? bankedItems.length + ' item(s) secured — returned at expedition end'
      : 'No items cached yet';
    cachedList.appendChild(header);
    if (bankedItems.length === 0) return;
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    const detailPanel = document.createElement('div');
    detailPanel.className = 'inv-detail-panel';
    for (const item of bankedItems) {
      const cell = document.createElement('div');
      const rarityColor = CONSTANTS.RARITY_COLORS[item.rarity] || CONSTANTS.RARITY_COLORS.common;
      cell.className = 'inv-grid-cell rarity-' + (item.rarity || 'common') + ' cached-item';
      cell.innerHTML = '<span class="cell-dot" style="background:' + rarityColor + '"></span>' +
        '<span class="cell-name" style="color:' + rarityColor + '">' + item.name + '</span>';
      cell.addEventListener('mouseenter', () => showItemDetail(item, detailPanel));
      cell.addEventListener('mouseleave', () => { detailPanel.innerHTML = ''; });
      grid.appendChild(cell);
    }
    cachedList.appendChild(grid);
    cachedList.appendChild(detailPanel);
  }

  function showItemDetail(item, panel) {
    const parts = formatItemStats(item);
    if (parts.length === 0) {
      panel.innerHTML = '';
      return;
    }
    const def = itemCatalog[item.type];
    const detailRarityColor = CONSTANTS.RARITY_COLORS[item.rarity] || CONSTANTS.RARITY_COLORS.common;
    let html = '<span class="detail-name" style="color:' + detailRarityColor + '">' + item.name + '</span>';
    if (def && def.description) {
      html += '<span class="detail-desc">' + def.description + '</span>';
    }
    const statLine = [];
    const stats = item.stats || (def && def.stats);
    if (stats) {
      if (stats.attackDamage) statLine.push('+' + stats.attackDamage + ' ATK');
      if (stats.projectile) statLine.push('Ranged');
    }
    const effect = def && def.effect;
    if (effect && effect.heal) statLine.push('Heals ' + effect.heal + ' HP');
    if (statLine.length > 0) {
      html += '<span class="detail-stats">' + statLine.join(' · ') + '</span>';
    }
    panel.innerHTML = html;
  }

  function renderSolGrid() {
    if (!solGridState) return;
    solGridContainer.innerHTML = '';
    const size = solGridState.size || 5;

    // --- Innate bonus banner ---
    if (solGridState.unitName || solGridState.innateBonus) {
      const banner = document.createElement('div');
      banner.className = 'sol-innate-banner';
      let bannerHtml = '';
      if (solGridState.unitName) {
        bannerHtml += '<div class="sol-unit-name">' + solGridState.unitName + '</div>';
      }
      if (solGridState.unitDescription) {
        bannerHtml += '<div class="sol-unit-description">' + solGridState.unitDescription + '</div>';
      }
      if (solGridState.innateBonus) {
        const bonus = solGridState.innateBonus;
        if (bonus.perkName) {
          bannerHtml += '<div class="sol-innate-label">INNATE: ' + bonus.perkName + '</div>';
        }
        bannerHtml += '<div class="sol-innate-perks">';
        if (bonus.damageMultiplier) {
          bannerHtml += '<span class="sol-innate-perk">+' + Math.round(bonus.damageMultiplier * 100) + '% damage</span>';
        }
        if (bonus.cooldownReduction) {
          bannerHtml += '<span class="sol-innate-perk">-' + Math.round(bonus.cooldownReduction * 100) + '% cooldown</span>';
        }
        if (bonus.energyCostReduction) {
          bannerHtml += '<span class="sol-innate-perk">-' + Math.round(bonus.energyCostReduction * 100) + '% energy cost</span>';
        }
        if (bonus.healOnHit) {
          bannerHtml += '<span class="sol-innate-perk">+' + bonus.healOnHit + ' heal on hit</span>';
        }
        if (bonus.hazardResist && bonus.hazardResist.length > 0) {
          for (const resist of bonus.hazardResist) {
            bannerHtml += '<span class="sol-innate-perk">' + resist + ' resist</span>';
          }
        }
        bannerHtml += '</div>';
      }
      banner.innerHTML = bannerHtml;
      solGridContainer.appendChild(banner);
    }

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
        const compRarityColor = CONSTANTS.RARITY_COLORS[comp.componentRarity] || CONSTANTS.RARITY_COLORS.common;
        if (comp.abilityId) {
          cell.classList.add('has-ability');
          if (!comp.isExtension) {
            const label = comp.abilityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            let html = '<div class="sol-cell-name" style="color:' + compRarityColor + '">' + label + '</div>';
            // Show modifier bonuses if present
            if (comp.modifiers && comp.modifiers.length > 0) {
              for (const mod of comp.modifiers) {
                if (mod.bonus.damageMultiplier) {
                  html += '<div class="sol-mod-tag">+' + Math.round(mod.bonus.damageMultiplier * 100) + '% dmg</div>';
                }
                if (mod.bonus.cooldownReduction) {
                  html += '<div class="sol-mod-tag">-' + Math.round(mod.bonus.cooldownReduction * 100) + '% cd</div>';
                }
                if (mod.bonus.healOnHit) {
                  html += '<div class="sol-mod-tag">+' + mod.bonus.healOnHit + ' heal</div>';
                }
                if (mod.bonus.energyCostReduction) {
                  html += '<div class="sol-mod-tag">-' + Math.round(mod.bonus.energyCostReduction * 100) + '% cost</div>';
                }
              }
            }
            cell.innerHTML = html;
          }
        } else if (comp.modifierId) {
          cell.classList.add('has-modifier');
          if (!comp.isExtension) {
            const modLabel = comp.modifierId.replace(/_/g, ' ');
            let html = '<div class="sol-cell-name" style="color:' + compRarityColor + '">' + modLabel + '</div>';
            if (comp.bonus) {
              if (comp.bonus.damageMultiplier) html += '<div class="sol-mod-tag">+' + Math.round(comp.bonus.damageMultiplier * 100) + '% dmg</div>';
              if (comp.bonus.cooldownReduction) html += '<div class="sol-mod-tag">-' + Math.round(comp.bonus.cooldownReduction * 100) + '% cd</div>';
              if (comp.bonus.healOnHit) html += '<div class="sol-mod-tag">+' + comp.bonus.healOnHit + ' heal</div>';
              if (comp.bonus.energyCostReduction) html += '<div class="sol-mod-tag">-' + Math.round(comp.bonus.energyCostReduction * 100) + '% cost</div>';
            }
            // Show durability indicator
            if (comp.durability !== undefined) {
              const maxDur = comp.maxDurability || 3;
              const durColor = comp.durability <= 1 ? '#ff5252' : comp.durability <= 2 ? '#ffab40' : '#aaa';
              html += '<div class="sol-mod-tag" style="color:' + durColor + '">DUR ' + comp.durability + '/' + maxDur + '</div>';
            }
            cell.innerHTML = html;
          }
        } else if (comp.generatorId) {
          cell.classList.add('has-generator');
          if (!comp.isExtension) {
            let html = '<div class="sol-cell-name" style="color:' + compRarityColor + '">' + (comp.componentName || comp.generatorId.replace(/_/g, ' ')) + '</div>';
            if (comp.boostedEnergyRegen) {
              html += '<div class="sol-mod-tag">+' + comp.boostedEnergyRegen.toFixed(1) + '/s</div>';
            } else if (comp.energyRegen) {
              html += '<div class="sol-mod-tag">+' + comp.energyRegen + '/s</div>';
            }
            cell.innerHTML = html;
          }
        } else if (comp.batteryId) {
          cell.classList.add('has-battery');
          if (!comp.isExtension) {
            let html = '<div class="sol-cell-name" style="color:' + compRarityColor + '">' + (comp.componentName || comp.batteryId.replace(/_/g, ' ')) + '</div>';
            if (comp.energyCapacity) {
              if (comp.singleUse) {
                html += '<div class="sol-mod-tag" style="color:#ffab40">+' + comp.energyCapacity + '/' + (comp.maxCapacity || comp.energyCapacity) + ' cap (1x)</div>';
              } else {
                html += '<div class="sol-mod-tag">+' + comp.energyCapacity + ' cap</div>';
              }
            }
            cell.innerHTML = html;
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

    // Highlight adjacency connections (standard: green glow on modifier cells adjacent to abilities)
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
          if (neighbor && neighbor.modifierId && !neighbor.adjacencyPattern) {
            const neighborCell = grid.children[ni];
            if (neighborCell) neighborCell.style.boxShadow = '0 0 6px rgba(76,175,80,0.4)';
          }
        }
      }
    }

    // Helper: compute which cell indices fall within an adjacency pattern centered at (ox, oy)
    function getAdjRangeCells(ox, oy, pattern) {
      const indices = [];
      for (let ny = 0; ny < size; ny++) {
        for (let nx = 0; nx < size; nx++) {
          if (nx === ox && ny === oy) continue;
          const dist = Math.abs(nx - ox) + Math.abs(ny - oy);
          let inRange = false;
          if (pattern === 'radius2') inRange = dist <= 2;
          else if (pattern === 'row') inRange = ny === oy;
          else if (pattern === 'column') inRange = nx === ox;
          else if (pattern === 'cross') inRange = ny === oy || nx === ox;
          else if (pattern === 'area3x3') inRange = Math.max(Math.abs(nx - ox), Math.abs(ny - oy)) <= 1;
          if (inRange) indices.push(ny * size + nx);
        }
      }
      return indices;
    }

    // Helper: clear all adj-range / adj-source classes from the grid
    function clearAdjHighlight() {
      for (let i = 0; i < size * size; i++) {
        const el = grid.children[i];
        if (el) { el.classList.remove('adj-range', 'adj-source'); }
      }
    }

    // Hover on placed legendary modifier cells → show their reach
    for (let i = 0; i < size * size; i++) {
      const comp = solGridState.cells[i];
      if (!comp || !comp.modifierId || !comp.adjacencyPattern) continue;
      const mx = i % size, my = Math.floor(i / size);
      // Find origin cell of this placement (for multi-cell shapes, use originX/Y)
      const originX = comp.originX !== undefined ? comp.originX : mx;
      const originY = comp.originY !== undefined ? comp.originY : my;
      const pattern = comp.adjacencyPattern;

      // Collect all cells belonging to this placement
      const placementCells = [];
      for (let j = 0; j < size * size; j++) {
        const c = solGridState.cells[j];
        if (c && c.placementId === comp.placementId) placementCells.push(j);
      }

      const addHover = (enterIdx) => {
        const el = grid.children[enterIdx];
        if (!el) return;
        el.addEventListener('mouseenter', () => {
          clearAdjHighlight();
          // Mark all cells of this placement as source
          for (const pi of placementCells) {
            const src = grid.children[pi];
            if (src) src.classList.add('adj-source');
          }
          // Mark range cells
          for (const ri of getAdjRangeCells(originX, originY, pattern)) {
            const r = grid.children[ri];
            if (r) r.classList.add('adj-range');
          }
        });
        el.addEventListener('mouseleave', clearAdjHighlight);
      };

      for (const pi of placementCells) addHover(pi);
    }

    // Hovering empty grid cells when a legendary modifier is selected from inventory
    const selItem = solGridSelectedComponent !== null ? inventoryItems[solGridSelectedComponent] : null;
    const selPattern = selItem && selItem.adjacencyPattern ? selItem.adjacencyPattern : null;
    if (selPattern) {
      for (let i = 0; i < size * size; i++) {
        const cellEl = grid.children[i];
        if (!cellEl) continue;
        const hx = i % size, hy = Math.floor(i / size);
        cellEl.addEventListener('mouseenter', () => {
          clearAdjHighlight();
          cellEl.classList.add('adj-source');
          for (const ri of getAdjRangeCells(hx, hy, selPattern)) {
            const r = grid.children[ri];
            if (r) r.classList.add('adj-range');
          }
        });
        cellEl.addEventListener('mouseleave', clearAdjHighlight);
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
        compCell.className = 'sol-cell sol-inv-comp rarity-' + (item.rarity || 'common');
        compCell.style.width = '80px';
        compCell.style.height = '80px';
        const compRarityColor = CONSTANTS.RARITY_COLORS[item.rarity] || CONSTANTS.RARITY_COLORS.common;
        compCell.innerHTML = '<div class="sol-cell-name" style="color:' + compRarityColor + '">' + item.name.replace(' Chip', '') + '</div>';
        if (solGridSelectedComponent === idx) {
          compCell.classList.add('selected');
        }
        compCell.addEventListener('click', () => {
          solGridSelectedComponent = (solGridSelectedComponent === idx) ? null : idx;
          if (solGridSelectedComponent !== null && tutorialPhase === 'select_component') {
            advanceTutorialPhase();
          }
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
    // Reposition tutorial arrow after sol grid re-render
    if (tutorialPhase === 'select_component' || tutorialPhase === 'place_component') {
      setTimeout(updateTutorialArrow, 0);
    }
  }

  // --- Weapon Upgrade Panel ---
  function renderWeaponUpgradePanel() {
    const container = document.getElementById('weapon-upgrade-container');
    if (!container) return;
    container.innerHTML = '';

    if (!weaponUpgradeState) {
      const empty = document.createElement('div');
      empty.className = 'wu-empty';
      empty.textContent = 'No weapon equipped. Equip a weapon to upgrade it.';
      container.appendChild(empty);
      return;
    }

    const wu = weaponUpgradeState;
    const rarityColors = CONSTANTS.RARITY_COLORS || {};

    // Header: weapon name
    const header = document.createElement('div');
    header.className = 'wu-header';
    const nameEl = document.createElement('div');
    nameEl.className = 'wu-weapon-name';
    nameEl.textContent = wu.weaponName;
    nameEl.style.color = rarityColors[wu.weaponRarity] || '#fff';
    header.appendChild(nameEl);
    const subtitle = document.createElement('div');
    subtitle.className = 'wu-weapon-subtitle';
    subtitle.textContent = wu.size + 'x' + wu.size + ' upgrade grid';
    header.appendChild(subtitle);
    container.appendChild(header);

    // Total bonuses banner
    const tb = wu.totalBonuses;
    const hasBonuses = tb && (tb.flatDamage || tb.damageMultiplier || tb.cooldownReduction || tb.energyCostReduction);
    if (hasBonuses) {
      const bonusDiv = document.createElement('div');
      bonusDiv.className = 'wu-bonuses';
      const title = document.createElement('div');
      title.className = 'wu-bonuses-title';
      title.textContent = 'Upgrade Bonuses';
      bonusDiv.appendChild(title);
      const perks = document.createElement('div');
      if (tb.flatDamage) {
        const tag = document.createElement('span');
        tag.className = 'wu-bonus-tag';
        tag.textContent = '+' + tb.flatDamage + ' DMG';
        perks.appendChild(tag);
      }
      if (tb.damageMultiplier) {
        const tag = document.createElement('span');
        tag.className = 'wu-bonus-tag';
        tag.textContent = '+' + Math.round(tb.damageMultiplier * 100) + '% DMG';
        perks.appendChild(tag);
      }
      if (tb.cooldownReduction) {
        const tag = document.createElement('span');
        tag.className = 'wu-bonus-tag';
        tag.textContent = '-' + Math.round(tb.cooldownReduction * 100) + '% CD';
        perks.appendChild(tag);
      }
      if (tb.energyCostReduction) {
        const tag = document.createElement('span');
        tag.className = 'wu-bonus-tag';
        tag.textContent = '-' + Math.round(tb.energyCostReduction * 100) + '% Cost';
        perks.appendChild(tag);
      }
      bonusDiv.appendChild(perks);
      container.appendChild(bonusDiv);
    }

    // Upgrade grid
    const grid = document.createElement('div');
    grid.className = 'wu-grid';
    grid.style.gridTemplateColumns = 'repeat(' + wu.size + ', 80px)';
    for (let i = 0; i < wu.slots.length; i++) {
      const cell = document.createElement('div');
      cell.className = 'wu-cell';
      const slotData = wu.slots[i];
      if (slotData) {
        cell.classList.add('has-material');
        const name = document.createElement('div');
        name.className = 'wu-cell-name';
        name.textContent = slotData.name;
        name.style.color = rarityColors[slotData.rarity] || '#aaa';
        cell.appendChild(name);
        // Show bonus
        const bonus = slotData.bonus;
        if (bonus) {
          const bonusEl = document.createElement('div');
          bonusEl.className = 'wu-cell-bonus';
          const parts = [];
          if (bonus.damage) parts.push('+' + bonus.damage + ' DMG');
          if (bonus.damageMultiplier) parts.push('+' + Math.round(bonus.damageMultiplier * 100) + '%');
          if (bonus.cooldownReduction) parts.push('-' + Math.round(bonus.cooldownReduction * 100) + '% CD');
          if (bonus.energyCostReduction) parts.push('-' + Math.round(bonus.energyCostReduction * 100) + '% Cost');
          bonusEl.textContent = parts.join(' ');
          cell.appendChild(bonusEl);
        }
        // Click to remove
        cell.addEventListener('click', () => {
          net.send({ type: CONSTANTS.MSG.WEAPON_UPGRADE_REMOVE, gridIndex: i });
        });
      } else {
        // Empty cell - click to place selected material
        cell.addEventListener('click', () => {
          if (weaponUpgradeSelectedMaterial !== null) {
            net.send({
              type: CONSTANTS.MSG.WEAPON_UPGRADE_PLACE,
              inventoryIndex: weaponUpgradeSelectedMaterial,
              gridIndex: i,
            });
            weaponUpgradeSelectedMaterial = null;
          }
        });
      }
      grid.appendChild(cell);
    }
    container.appendChild(grid);

    // Crafting materials in inventory
    const craftingMats = [];
    for (let i = 0; i < inventoryItems.length; i++) {
      if (inventoryItems[i].category === 'crafting') {
        craftingMats.push({ item: inventoryItems[i], index: i });
      }
    }

    if (craftingMats.length > 0) {
      const label = document.createElement('div');
      label.className = 'wu-materials-label';
      label.textContent = 'Crafting Materials';
      container.appendChild(label);

      const invGrid = document.createElement('div');
      invGrid.className = 'wu-inv-grid';
      for (const { item, index } of craftingMats) {
        const cell = document.createElement('div');
        cell.className = 'wu-inv-cell';
        if (weaponUpgradeSelectedMaterial === index) cell.classList.add('selected');
        const name = document.createElement('div');
        name.textContent = item.name;
        name.style.color = rarityColors[item.rarity] || '#aaa';
        name.style.fontSize = '11px';
        cell.appendChild(name);
        cell.addEventListener('click', () => {
          weaponUpgradeSelectedMaterial = (weaponUpgradeSelectedMaterial === index) ? null : index;
          renderWeaponUpgradePanel();
        });
        invGrid.appendChild(cell);
      }
      container.appendChild(invGrid);
    }

    // Info text
    const info = document.createElement('div');
    info.className = 'wu-info';
    if (weaponUpgradeSelectedMaterial !== null) {
      info.textContent = 'Click an empty grid cell to place material';
    } else {
      info.textContent = 'Click a material below to select, or click placed to remove';
    }
    container.appendChild(info);

    // Disassemble button
    const disBtn = document.createElement('button');
    disBtn.className = 'wu-disassemble-btn';
    disBtn.textContent = 'Disassemble Weapon';
    disBtn.addEventListener('click', () => {
      net.send({ type: CONSTANTS.MSG.WEAPON_DISASSEMBLE });
    });
    container.appendChild(disBtn);

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

    // Slot 1 interact override: override slot 1 to show the interact action.
    // Items and doors always override slot 1 (pickup/doors should work even in combat).
    // NPCs only override when no monsters are nearby.
    const prevMode = slot1InteractMode;
    slot1InteractMode = null;

    if (label) {
      if (label === 'Pick up' || label === 'Open' || label === 'Close') {
        // Items and doors always take priority
        slot1InteractMode = label;
      } else {
        // NPCs: only override when no monsters are nearby
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
          mobileSlot.textContent = aLabel;
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
  input.onAbility = function (slot, aimAngle, isMouseTarget) {
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

    const msg = { type: CONSTANTS.MSG.ATTACK, aimAngle, slot };
    // Include mouse world position for position-based abilities (e.g. teleport)
    if (isMouseTarget && input.mouseActive) {
      msg.targetX = Math.round(input.mouseWorldX);
      msg.targetY = Math.round(input.mouseWorldY);
    }
    net.send(msg);
    audio.play(slot === 0 ? 'weapon_swing' : 'ability_cast');
  };

  // --- Onboarding callbacks ---
  input.onFirstMove = function () {
    if (onboardMoveDismissed) return;
    onboardMoveDismissed = true;
    dismissOnboardHint(onboardMove, () => {
      if (!onboardInteractDismissed) {
        onboardInteract.style.display = '';
      }
    });
  };

  // --- Interact dispatch ---
  input.onInteract = function () {
    if (choiceActive) { confirmChoice(); return; }
    if (automationScreenOpen) { closeAutomationScreen(); return; }
    if (dialogueActive) { advanceDialogue(); return; }
    if (menuOpen) { closeMenu(); return; }
    net.send({ type: CONSTANTS.MSG.INTERACT });
  };

  // --- Menu dispatches ---
  input.onInventory = function () {
    toggleMenu('equipment');
  };

  input.onMapToggle = function () {
    if (worldmapOpen) { closeWorldmap(); return; }
    renderer.toggleFullMap();
  };

  input.onWorldmap = function () {
    toggleWorldmap();
  };

  input.onWorldmapNav = function (dir) {
    worldmapNavigate(dir);
  };

  input.onWorldmapClose = function () {
    closeWorldmap();
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
    if (worldmapOpen) { closeWorldmap(); return; }
    if (automationScreenOpen) { closeAutomationScreen(); return; }
    closeMenu();
  };

  input.onChoiceNavigate = function (dir) {
    navigateChoice(dir);
  };

  input.onChoiceConfirm = function () {
    confirmChoice();
  };

  // --- Session / Join flow ---
  const sessionListEl = document.getElementById('session-list');

  let pendingJoinName = null;

  function joinWithName(name) {
    pendingJoinName = name;
    // Send session token if we have one stored for this character
    const tokenKey = `lk_session_${name}`;
    const sessionToken = localStorage.getItem(tokenKey) || undefined;
    net.send({ type: CONSTANTS.MSG.JOIN, name, sessionToken });

    // Initialize audio on first user gesture
    audio.init();

    // Request fullscreen on mobile to hide browser chrome (URL bar)
    if ('ontouchstart' in window) {
      const el = document.documentElement;
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (rfs) rfs.call(el).catch(() => {});
    }
  }

  function doJoin() {
    const name = nameInput.value.trim() || 'Adventurer';
    joinWithName(name);
  }

  const sessionDivider = document.getElementById('session-divider');

  function renderSessionList(sessions) {
    sessionListEl.innerHTML = '';
    if (!sessions || sessions.length === 0) {
      sessionDivider.style.display = 'none';
      return;
    }
    sessionDivider.style.display = '';

    const heading = document.createElement('div');
    heading.className = 'session-heading';
    heading.textContent = 'Saved Characters';
    sessionListEl.appendChild(heading);

    for (const session of sessions) {
      const entry = document.createElement('div');
      entry.className = 'session-entry';

      const left = document.createElement('div');
      const nameSpan = document.createElement('div');
      nameSpan.className = 'session-name';
      nameSpan.textContent = session.name;
      left.appendChild(nameSpan);

      const detail = document.createElement('div');
      detail.className = 'session-detail';
      const roomLabel = (session.room || '').replace(/_/g, ' ');
      detail.textContent = `Lv ${session.level} \u00B7 ${roomLabel}`;
      left.appendChild(detail);

      entry.appendChild(left);

      entry.addEventListener('click', () => {
        joinWithName(session.name);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'session-delete-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete character';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${session.name}"? This cannot be undone.`)) return;
        const token = localStorage.getItem(`lk_session_${session.name}`) || '';
        net.send({ type: CONSTANTS.MSG.SESSION_DELETE, name: session.name, token });
      });
      entry.appendChild(delBtn);

      sessionListEl.appendChild(entry);
    }
  }

  // Request session list once connected
  net.onopen = function () {
    net.send({ type: CONSTANTS.MSG.SESSION_LIST });
  };

  net.on(CONSTANTS.MSG.SESSION_LIST_RESPONSE, (msg) => {
    renderSessionList(msg.sessions);
  });

  net.on(CONSTANTS.MSG.SESSION_DELETE_RESPONSE, (msg) => {
    if (msg.success) {
      localStorage.removeItem(`lk_session_${msg.name}`);
      net.send({ type: CONSTANTS.MSG.SESSION_LIST });
    } else {
      const reason = msg.error === 'online' ? 'That character is currently online.'
        : msg.error === 'unauthorized' ? 'You do not own that character.'
        : 'Could not delete character.';
      alert(reason);
    }
  });

  joinBtn.addEventListener('click', doJoin);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doJoin();
  });

  // --- Network handlers ---
  net.on('error', (msg) => {
    console.error('[Game] Server error:', msg.message);
    net.setStatus(msg.message || 'Connection error');
    pendingJoinName = null;
  });

  net.on(CONSTANTS.MSG.WELCOME, (msg) => {
    console.log('[Game] Welcome!', msg.playerId);

    // Store session token for reconnection auth
    if (msg.sessionToken && pendingJoinName) {
      localStorage.setItem(`lk_session_${pendingJoinName}`, msg.sessionToken);
    }

    renderer.setMyId(msg.playerId);
    // Chunk-based map streaming: create empty data array, fill from chunks
    if (msg.chunked) {
      msg.map.data = new Array(msg.map.width * msg.map.height).fill(-1);
    }
    renderer.setMap(msg.map, msg.tileset, msg.chunked);
    if (msg.chunks) renderer.applyChunks(msg.chunks);
    if (msg.itemCatalog) itemCatalog = msg.itemCatalog;

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

    // Show onboarding move hint
    if (!onboardMoveShown) {
      onboardMoveShown = true;
      onboardMove.style.display = '';
    }

    // Start background music — pick ambient track from data-driven biome_map in music.json
    audio.resume();
    const roomName = (msg.map && msg.map.name || '');
    const tileset = (msg.map && msg.map.tileset || '');
    currentAmbientTrack = audio.resolveAmbientTrack(roomName, tileset);
    audio.playMusic(currentAmbientTrack);
  });

  net.on(CONSTANTS.MSG.STATE, (msg) => {
    renderer.setState(msg);

    // Store party quest progress for quest panel
    if (msg.partyQuests) {
      partyQuestsState = msg.partyQuests.filter(pq => pq.playerId !== renderer.myId);
    }

    // Process combat events for damage numbers + audio
    if (msg.events) {
      renderer.processEvents(msg.events);
      for (const ev of msg.events) {
        if (ev.type === 'teleport' && ev.targetId === renderer.myId) {
          input.clearMoveTarget();
          audio.play('teleport');
        } else if (ev.type === 'ambush_reveal') {
          audio.play('ambush_reveal');
        } else if (ev.type === 'death' && ev.targetId === renderer.myId) {
          input.clearMoveTarget();
          // Audio + overlay handled by DEATH_SCREEN message
        } else if (ev.type === 'death') {
          audio.play('death_monster');
        } else if (ev.type === 'damage') {
          audio.play(ev.targetId === renderer.myId ? 'hit_take' : 'hit_deal');
        } else if (ev.type === 'darkness_damage') {
          audio.play('darkness_damage');
        } else if (ev.type === 'hazard_damage') {
          audio.play('darkness_damage');
        } else if (ev.type === 'heal') {
          audio.play('heal');
        } else if (ev.type === 'pickup') {
          audio.play('pickup');
        } else if (ev.type === 'level_up') {
          audio.play('level_up');
        } else if (ev.type === 'battery_depleted' && ev.targetId === renderer.myId) {
          audio.play('battery_depleted');
          const bar = document.getElementById('energy-bar');
          if (bar) {
            bar.classList.remove('battery-depleted-flash');
            void bar.offsetWidth; // reflow to restart animation
            bar.classList.add('battery-depleted-flash');
          }
        } else if (ev.type === 'boss_intro' && ev.playerId === renderer.myId) {
          audio.play('boss_intro');
          audio.playMusic(ev.bossMusic || 'boss_combat');
        } else if (ev.type === 'wave_start') {
          audio.play('ambush_reveal');
        } else if (ev.type === 'wave_clear') {
          audio.play('level_up');
        } else if (ev.type === 'lighthouse_hit') {
          audio.play('hit_take');
        } else if (ev.type === 'lighthouse_repair') {
          audio.play('item_pickup');
        } else if (ev.type === 'siege_victory') {
          siegeOverlay.className = '';
          void siegeOverlay.offsetWidth;
          siegeOverlay.classList.add('victory');
          siegeOverlayTitle.textContent = 'SIEGE VICTORY';
          siegeOverlayDetails.textContent = 'The lighthouse stands. Rewards granted.';
          audio.play('level_up');
          setTimeout(() => { siegeOverlay.className = ''; }, 6000);
        } else if (ev.type === 'siege_defeat') {
          siegeOverlay.className = '';
          void siegeOverlay.offsetWidth;
          siegeOverlay.classList.add('defeat');
          siegeOverlayTitle.textContent = 'SIEGE FAILED';
          siegeOverlayDetails.textContent = `The lighthouse fell. Waves survived: ${ev.wavesCompleted || 0}`;
          audio.play('death_player');
          setTimeout(() => { siegeOverlay.className = ''; }, 5000);
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
          const suEnergy = me.singleUseEnergy || 0;
          const suMax = me.singleUseMaxEnergy || 0;
          const rechargeableEnergy = me.energy - suEnergy;
          const rechargeablePct = (rechargeableEnergy / me.maxEnergy) * 100;
          const suPct = (suEnergy / me.maxEnergy) * 100;
          energyFill.style.width = `${rechargeablePct}%`;
          energySingleUseFill.style.left = `${rechargeablePct}%`;
          energySingleUseFill.style.width = `${suPct}%`;
          energySingleUseFill.style.display = suMax > 0 ? 'block' : 'none';
          energyText.textContent = `SOL ${Math.round(me.energy)}/${me.maxEnergy}`;
        } else {
          energyBar.style.display = 'none';
        }
        // XP bar
        if (me.xpToNextLevel > 0) {
          const xpPct = (me.xp / me.xpToNextLevel) * 100;
          xpFill.style.width = `${xpPct}%`;
          xpText.textContent = `LV ${me.level}  ${me.xp}/${me.xpToNextLevel}`;
        } else {
          xpFill.style.width = '100%';
          xpText.textContent = `LV ${me.level}  MAX`;
        }
        hudName.textContent = me.name;
        if (me.facing !== undefined) lastFacing = me.facing;
        // Cache player stats for the stats panel
        playerStats = {
          level: me.level,
          health: me.health,
          maxHealth: me.maxHealth,
          xp: me.xp,
          xpToNextLevel: me.xpToNextLevel,
          attackDamage: me.attackDamage || CONSTANTS.PLAYER_ATTACK_DAMAGE,
          energy: Math.round(me.energy || 0),
          maxEnergy: me.maxEnergy || 0,
        };
        if (menuOpen && menuTab === 'stats') renderStatsPanel();
      }

      // Update party member health frames
      const others = msg.players.filter(p => p.id !== renderer.myId);
      if (others.length === 0) {
        partyFrames.style.display = 'none';
      } else {
        partyFrames.style.display = '';
        // Rebuild if player count changed
        if (partyFrames.childElementCount !== others.length) {
          partyFrames.innerHTML = '';
          for (const p of others) {
            const frame = document.createElement('div');
            frame.className = 'party-frame';
            frame.dataset.pid = p.id;
            const nameEl = document.createElement('span');
            nameEl.className = 'party-frame-name';
            nameEl.textContent = p.name;
            nameEl.style.color = PARTY_COLORS[p.colorIndex] || '#aaa';
            const barEl = document.createElement('div');
            barEl.className = 'party-frame-bar';
            const fillEl = document.createElement('div');
            fillEl.className = 'party-frame-fill';
            const pct = Math.max(0, (p.health / p.maxHealth) * 100);
            fillEl.style.width = pct + '%';
            fillEl.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ffa726' : '#e53935';
            barEl.appendChild(fillEl);
            frame.appendChild(nameEl);
            frame.appendChild(barEl);
            partyFrames.appendChild(frame);
          }
        } else {
          // Update existing frames
          for (let i = 0; i < others.length; i++) {
            const p = others[i];
            const frame = partyFrames.children[i];
            const nameEl = frame.querySelector('.party-frame-name');
            const fillEl = frame.querySelector('.party-frame-fill');
            nameEl.textContent = p.name;
            nameEl.style.color = PARTY_COLORS[p.colorIndex] || '#aaa';
            const pct = Math.max(0, (p.health / p.maxHealth) * 100);
            fillEl.style.width = pct + '%';
            fillEl.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ffa726' : '#e53935';
          }
        }
      }
    }

    // Update boss health bar HUD and boss music
    const boss = msg.monsters && msg.monsters.find(m => m.boss);
    if (boss) {
      bossBar.style.display = '';
      bossBarName.textContent = boss.name;
      const bossHpPct = Math.max(0, boss.health / boss.maxHealth) * 100;
      bossBarFill.style.width = `${bossHpPct}%`;
      bossBarText.textContent = `${boss.health} / ${boss.maxHealth}`;
      const phaseLabels = { 1: 'Phase 1', 2: 'Phase 2 - Ranged', 3: 'Phase 3 - Enraged' };
      bossBarPhase.textContent = phaseLabels[boss.bossPhase] || '';
    } else {
      if (bossBar.style.display !== 'none' && audio.musicId && audio.musicId.startsWith('boss_')) {
        audio.playMusic(currentAmbientTrack || 'dungeon');
      }
      bossBar.style.display = 'none';
    }

    // Update expedition HUD
    if (msg.expedition) {
      expeditionHud.style.display = '';
      expeditionTier.textContent = `EXPEDITION T${msg.expedition.tier}`;
      expeditionFloor.textContent = `Floor ${msg.expedition.floor} / ${msg.expedition.maxFloors}`;
      if (msg.expedition.partySize > 1) {
        expeditionParty.textContent = `Party: ${msg.expedition.partySize} explorers`;
        expeditionParty.style.display = '';
      } else {
        expeditionParty.style.display = 'none';
      }
      if (!inExpedition) {
        inExpedition = true;
        const cachedTab = document.querySelector('#character-menu .inv-tab[data-tab="cached"]');
        if (cachedTab) cachedTab.style.display = '';
      }
    } else {
      expeditionHud.style.display = 'none';
      if (inExpedition) {
        inExpedition = false;
        bankedItems = [];
        const cachedTab = document.querySelector('#character-menu .inv-tab[data-tab="cached"]');
        if (cachedTab) cachedTab.style.display = 'none';
        if (menuOpen && menuTab === 'cached') switchTab('equipment');
      }
    }

    // Update siege HUD
    if (msg.siege && msg.siege.phase) {
      siegeHud.style.display = '';
      siegeTitle.textContent = msg.siege.displayName || 'SIEGE';
      if (msg.siege.wave > 0) {
        siegeWave.textContent = `Wave ${msg.siege.wave} / ${msg.siege.maxWaves}`;
      } else {
        siegeWave.textContent = 'Preparing...';
      }
      // Phase indicator
      if (msg.siege.phase === 'preparing' || msg.siege.phase === 'inter_wave') {
        siegePhase.textContent = `Next wave in ${msg.siege.phaseTimer}s`;
      } else if (msg.siege.phase === 'active') {
        siegePhase.textContent = 'WAVE ACTIVE';
        siegePhase.style.color = '#e53935';
      } else if (msg.siege.phase === 'victory') {
        siegePhase.textContent = 'VICTORY!';
        siegePhase.style.color = '#66bb6a';
      } else if (msg.siege.phase === 'defeat') {
        siegePhase.textContent = 'DEFEATED';
        siegePhase.style.color = '#e53935';
      }
      if (msg.siege.phase !== 'active') {
        siegePhase.style.color = '#aaa';
      }
      // Lighthouse HP bar
      const lhPct = msg.siege.lighthouseMaxHp > 0 ? (msg.siege.lighthouseHp / msg.siege.lighthouseMaxHp) * 100 : 0;
      siegeLhFill.style.width = lhPct + '%';
      siegeLhText.textContent = `${msg.siege.lighthouseHp} / ${msg.siege.lighthouseMaxHp}`;
      // Communal energy bar
      const enPct = msg.siege.communalEnergyMax > 0 ? (msg.siege.communalEnergy / msg.siege.communalEnergyMax) * 100 : 0;
      siegeEnergyFill.style.width = enPct + '%';
      siegeEnergyText.textContent = `${msg.siege.communalEnergy} / ${msg.siege.communalEnergyMax}`;
      // Monsters remaining
      if (msg.siege.phase === 'active') {
        siegeMonsters.textContent = `Enemies: ${msg.siege.monstersRemaining}`;
        siegeMonsters.style.display = '';
      } else {
        siegeMonsters.style.display = 'none';
      }
      // Show repair button during inter-wave/preparing if lighthouse is damaged
      const canRepair = (msg.siege.phase === 'inter_wave' || msg.siege.phase === 'preparing')
        && msg.siege.lighthouseHp < msg.siege.lighthouseMaxHp;
      if (canRepair) {
        siegeRepairBtn.style.display = '';
        siegeRepairBtn.textContent = `Repair Lighthouse (${msg.siege.repairCost} silicon, +${msg.siege.repairAmount} HP)`;
      } else {
        siegeRepairBtn.style.display = 'none';
      }
    } else {
      siegeHud.style.display = 'none';
      siegeRepairBtn.style.display = 'none';
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
    // Chunk-based map streaming: create empty data array, fill from chunks
    if (msg.chunked) {
      msg.map.data = new Array(msg.map.width * msg.map.height).fill(-1);
    }
    renderer.setMap(msg.map, msg.tileset, msg.chunked);
    if (msg.chunks) renderer.applyChunks(msg.chunks);
    renderer.fullMap = false;
    input.stopMovement();
    // Close any open dialogue, choice menu, worldmap, or automation screen
    closeDialogue();
    closeChoiceMenu();
    closeAutomationScreen();
    closeWorldmap();
    hideRaidIncoming();
    // Hide boss bar and siege overlay when changing floors
    bossBar.style.display = 'none';
    siegeOverlay.className = '';
    // Play floor change SFX and switch music based on room name/tileset biome
    audio.play('floor_change');
    const roomName = (msg.map.name || '').toLowerCase();
    const tilesetId = msg.map.tileset || '';
    currentAmbientTrack = audio.resolveAmbientTrack(roomName, tilesetId);
    audio.playMusic(currentAmbientTrack);
  });

  net.on(CONSTANTS.MSG.DEATH_SCREEN, (msg) => {
    // Show death overlay with penalty details
    deathDetails.innerHTML = (msg.details || []).map(l => l.replace(/</g, '&lt;')).join('<br>');
    deathOverlay.classList.remove('active');
    void deathOverlay.offsetWidth; // reflow to restart animation
    deathOverlay.classList.add('active');
    audio.play('death_player');
    input.clearMoveTarget();
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      deathOverlay.classList.remove('active');
    }, 3000);
  });

  net.on(CONSTANTS.MSG.LOOT_BANKED, (msg) => {
    // Update banked items state
    if (msg.bankedItems) {
      bankedItems = msg.bankedItems;
      if (menuOpen && menuTab === 'cached') renderCachedItems();
    }
    // Show banking confirmation via milestone toast pattern
    milestoneText.textContent = '\u{1F4E6} ' + msg.bankedCount + ' item(s) banked — ' + msg.totalBanked + ' total cached';
    milestonToast.style.display = 'block';
    milestonToast.style.animation = 'none';
    void milestonToast.offsetWidth;
    milestonToast.style.animation = '';
    if (milestoneToastTimeout) clearTimeout(milestoneToastTimeout);
    milestoneToastTimeout = setTimeout(() => {
      milestonToast.style.display = 'none';
    }, 4000);
  });

  net.on(CONSTANTS.MSG.DIALOGUE, (msg) => {
    if (msg.dialogue && msg.dialogue.length > 0) {
      showDialogue(msg.dialogue, msg.npcId);
      audio.play('dialogue_open');
      // Dismiss interact onboarding hint on first NPC dialogue
      if (!onboardInteractDismissed) {
        onboardInteractDismissed = true;
        dismissOnboardHint(onboardInteract);
      }
    }
  });

  net.on(CONSTANTS.MSG.CHOICE_MENU, (msg) => {
    if (msg.options && msg.options.length > 0) {
      showChoiceMenu(msg.choiceId, msg.prompt, msg.options);
      audio.play('choice_open');
    }
  });

  net.on(CONSTANTS.MSG.DOOR_TOGGLE, (msg) => {
    // Update local map tile data to reflect the door state change
    if (renderer.map && msg.x != null && msg.y != null) {
      const idx = msg.y * renderer.map.width + msg.x;
      renderer.map.data[idx] = msg.tileId;
    }
    // Determine if the new tile is solid (closing) or passable (opening)
    const tileDef = renderer.tileset && renderer.tileset.tiles && renderer.tileset.tiles[String(msg.tileId)];
    audio.play(tileDef && tileDef.solid ? 'door_close' : 'door_open');
  });

  // Chunk-based map streaming: receive new map chunks as player explores
  net.on(CONSTANTS.MSG.MAP_CHUNKS, (msg) => {
    if (msg.chunks) renderer.applyChunks(msg.chunks);
  });

  net.on(CONSTANTS.MSG.SOL_GRID, (msg) => {
    // Handle placement error feedback
    if (msg.error) {
      solGridSelectedComponent = null;
      if (menuOpen && menuTab === 'solgrid') {
        solGridInfo.textContent = msg.error;
        solGridInfo.style.color = '#ef5350';
        renderSolGrid();
        setTimeout(() => { solGridInfo.style.color = ''; }, 2500);
      }
      return;
    }
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
    // Complete tutorial placement phase when grid updates with a new modifier
    if (tutorialPhase === 'place_component' && solGridState) {
      const hasModifier = solGridState.cells.some(c => c && c.modifierId);
      if (hasModifier) {
        tutorialPhase = null;
        clearTutorialArrow();
      }
    }
  });

  net.on(CONSTANTS.MSG.WEAPON_UPGRADE_STATE, (msg) => {
    weaponUpgradeState = msg.state || null;
    weaponUpgradeSelectedMaterial = null;
    // Update weapon tab disabled state
    const wTab = document.querySelector('#character-menu .inv-tab[data-tab="weapon"]');
    if (wTab) wTab.classList.toggle('disabled', !weaponUpgradeState);
    // If weapon tab became unavailable while viewing it, switch away
    if (menuOpen && menuTab === 'weapon' && !weaponUpgradeState) {
      switchTab('equipment');
    }
    if (menuOpen && menuTab === 'weapon' && weaponUpgradeState) {
      renderWeaponUpgradePanel();
    }
    // Re-render equipment slots
    if (menuOpen && menuTab === 'equipment') renderEquipmentSlots();
  });

  net.on(CONSTANTS.MSG.ABILITY_STATE, (msg) => {
    abilityState = msg.abilities || [null, null, null, null, null, null];
    cooldownState = msg.cooldowns || [0, 0, 0, 0, 0, 0];
    updateActionBar();
  });

  net.on(CONSTANTS.MSG.QUEST_OBJECTIVE, (msg) => {
    renderer.questObjective = msg.objective || null;
    renderer.secondaryQuestObjectives = msg.secondaryObjectives || null;
    // Update HUD quest label with quest name + step label
    if (msg.objective && msg.objective.label) {
      const prefix = msg.objective.questName ? msg.objective.questName + ': ' : '';
      questLabel.textContent = '\u25B8 ' + prefix + msg.objective.label;
      questLabel.style.display = '';
    } else {
      questLabel.style.display = 'none';
    }
    // Start or clear sol grid tutorial
    if (msg.objective && msg.objective.uiHint === 'sol_grid_tutorial') {
      if (!tutorialPhase) {
        tutorialPhase = 'open_menu';
        updateTutorialArrow();
      }
    } else {
      if (tutorialPhase) {
        tutorialPhase = null;
        clearTutorialArrow();
      }
    }
  });

  net.on(CONSTANTS.MSG.QUEST_STATE, (msg) => {
    questState = msg.quests || [];
    if (menuOpen && menuTab === 'quests') renderQuestPanel();
  });

  net.on(CONSTANTS.MSG.QUEST_STEP_COMPLETE, (msg) => {
    showQuestToast('\u2714 ' + msg.label);
    audio.play('quest_step_complete');
  });

  net.on(CONSTANTS.MSG.QUEST_STARTED, (msg) => {
    showQuestToast('New Quest: ' + msg.name);
    audio.play('quest_started');
  });

  net.on(CONSTANTS.MSG.WORLDMAP, (msg) => {
    if (msg.worldmap) {
      worldmapData = msg.worldmap;
    }
    if (msg.currentLocation) {
      worldmapCurrentLocation = msg.currentLocation;
    }
  });

  net.on(CONSTANTS.MSG.AUTO_STATE, (msg) => {
    autoState = msg.auto || null;

    // Handle build result flash animation and placement sound
    if (msg.buildResult && msg.buildX !== undefined) {
      flashAutomationCell(msg.buildX, msg.buildY, msg.buildResult === 'success');
      if (msg.buildResult === 'success') audio.play('auto_place');
    }

    // Detect automation level-up and play fanfare
    if (autoState && autoState.stats) {
      const newLevel = autoState.stats.automationLevel || 0;
      if (prevAutoLevel !== null && newLevel > prevAutoLevel) {
        audio.play('auto_level_up');
      }
      prevAutoLevel = newLevel;
    }

    // Open full-screen automation overlay if server says so
    if (msg.openScreen) {
      openAutomationScreen();
    } else if (automationScreenOpen) {
      renderAutomationScreen();
    }

  });

  net.on(CONSTANTS.MSG.AUTOMATION_MILESTONE, (msg) => {
    showMilestoneToast(msg.milestoneIcon || '★', msg.milestoneName || 'Milestone', msg.milestoneThreshold || 0);
  });

  net.on(CONSTANTS.MSG.RAID_ALERT, (msg) => {
    hideRaidIncoming();
    showRaidToast(msg.raid);
    if (automationScreenOpen) renderAutomationScreen();
  });

  net.on(CONSTANTS.MSG.RAID_INCOMING, (msg) => {
    showRaidIncoming(msg.raid);
  });

  net.on(CONSTANTS.MSG.INVENTORY, (msg) => {
    inventoryItems = msg.items || [];
    if (msg.equipment) {
      equipmentState = msg.equipment;
    }
    if (msg.medipacCharges !== undefined) {
      medipacCharges = msg.medipacCharges;
    }
    if (msg.credits !== undefined) {
      playerCredits = msg.credits;
    }
    if (msg.bankedItems !== undefined) {
      bankedItems = msg.bankedItems;
    }
    updateActionBar();
    if (menuOpen && (menuTab === 'equipment' || menuTab === 'inventory')) {
      if (menuTab === 'equipment') renderEquipmentSlots();
      if (menuTab === 'inventory') renderInventoryGrid();
    }
    // Re-render sol grid when inventory changes so the component list stays in sync
    if (menuOpen && menuTab === 'solgrid' && solGridState) {
      solGridSelectedComponent = null;
      renderSolGrid();
    }
    if (menuOpen && menuTab === 'cached') renderCachedItems();
    // Re-render weapon upgrade panel when inventory changes so crafting materials list stays in sync
    if (menuOpen && menuTab === 'weapon' && weaponUpgradeState) {
      weaponUpgradeSelectedMaterial = null;
      renderWeaponUpgradePanel();
    }
  });

  net.on(CONSTANTS.MSG.PLAYER_JOIN, (msg) => {
    console.log(`[Game] ${msg.name} joined`);
    addChatLine(msg.name + ' joined', true);
  });

  net.on(CONSTANTS.MSG.PLAYER_LEAVE, (msg) => {
    console.log(`[Game] ${msg.playerId} left`);
    addChatLine('A player left', true);
  });

  // --- Chat system ---
  const chatLog = document.getElementById('chat-log');
  const chatInputRow = document.getElementById('chat-input-row');
  const chatInput = document.getElementById('chat-input');
  const voiceIndicator = document.getElementById('voice-indicator');
  function addChatLine(text, isSystem) {
    const el = document.createElement('div');
    el.className = 'chat-line' + (isSystem ? ' system' : '');
    el.textContent = text;
    chatLog.appendChild(el);
    // Keep max 50 lines
    while (chatLog.children.length > 50) chatLog.removeChild(chatLog.firstChild);
  }

  net.on(CONSTANTS.MSG.CHAT_BROADCAST, (msg) => {
    const el = document.createElement('div');
    el.className = 'chat-line';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    nameSpan.textContent = msg.name + ': ';
    el.appendChild(nameSpan);
    el.appendChild(document.createTextNode(msg.text));
    chatLog.appendChild(el);
    while (chatLog.children.length > 50) chatLog.removeChild(chatLog.firstChild);
  });

  function openChat() {
    input.chatActive = true;
    chatInputRow.classList.add('active');
    chatInput.value = '';
    chatInput.focus();
  }

  function closeChat() {
    input.chatActive = false;
    chatInputRow.classList.remove('active');
    chatInput.blur();
  }

  function sendChat() {
    const text = chatInput.value.trim();
    if (text) {
      net.send({ type: CONSTANTS.MSG.CHAT, text });
    }
    closeChat();
  }

  chatInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Prevent game input handler from seeing these keys
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChat();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeChat();
    }
  });

  // Prevent keyup events from game when chat was active
  chatInput.addEventListener('keyup', (e) => { e.stopPropagation(); });

  input.onChatOpen = openChat;
  input.onChatClose = closeChat;

  // --- Voice chat (hold V to speak) ---
  let voiceRecognition = null;
  let voiceActive = false;

  function startVoice() {
    if (voiceActive) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    voiceActive = true;
    voiceIndicator.classList.add('active');
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.lang = 'en-US';
    voiceRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        net.send({ type: CONSTANTS.MSG.CHAT, text: transcript });
      }
    };
    voiceRecognition.onerror = () => { stopVoice(); };
    voiceRecognition.onend = () => { stopVoice(); };
    voiceRecognition.start();
  }

  function stopVoice() {
    voiceActive = false;
    voiceIndicator.classList.remove('active');
    if (voiceRecognition) {
      try { voiceRecognition.stop(); } catch (e) {}
      voiceRecognition = null;
    }
  }

  window.addEventListener('keydown', (e) => {
    if (input.chatActive) return;
    if ((e.key === 'v' || e.key === 'V') && !e.repeat) {
      startVoice();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'v' || e.key === 'V') {
      stopVoice();
    }
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
