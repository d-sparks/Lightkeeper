import { h, render, Component } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// ─── API helpers ────────────────────────────────────────────
async function checkedFetch(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.dispatchEvent(new Event('editor-unauthorized'));
    throw new Error('Unauthorized');
  }
  return res;
}

const api = {
  async checkAuth() { return (await fetch('/api/editor/auth')).json(); },
  async login(password) {
    const res = await fetch('/api/editor/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    return { ok: res.ok, ...(await res.json()) };
  },
  async listDungeons() { return (await checkedFetch('/api/editor/dungeons')).json(); },
  async getDungeon(id) { return (await checkedFetch(`/api/editor/dungeons/${id}`)).json(); },
  async saveDungeon(id, data) {
    const exists = await checkedFetch(`/api/editor/dungeons/${id}`);
    if (exists.status === 200) {
      return (await checkedFetch(`/api/editor/dungeons/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json();
    }
    return (await checkedFetch('/api/editor/dungeons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json();
  },
  async deleteDungeon(id) { return (await checkedFetch(`/api/editor/dungeons/${id}`, { method: 'DELETE' })).json(); },
  async getTilesets() { return (await checkedFetch('/api/editor/tilesets')).json(); },
  async getMonsters() { return (await checkedFetch('/api/editor/monsters')).json(); },
  async getNPCs() { return (await checkedFetch('/api/editor/npcs')).json(); },
  async saveNPCs(data) { return (await checkedFetch('/api/editor/npcs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json(); },
  async getItems() { return (await checkedFetch('/api/editor/items')).json(); },
  async saveItems(data) { return (await checkedFetch('/api/editor/items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json(); },
  async reload() { return (await checkedFetch('/api/editor/reload', { method: 'POST' })).json(); },
  async publish(message) {
    const res = await checkedFetch('/api/editor/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    return { ok: res.ok, ...(await res.json()) };
  },
  async listBranches() { return (await checkedFetch('/api/editor/branches')).json(); },
  async loadBranch(branch) {
    const res = await checkedFetch('/api/editor/branches/load', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch }) });
    return { ok: res.ok, ...(await res.json()) };
  },
  async refreshBranch() {
    const res = await checkedFetch('/api/editor/branches/refresh', { method: 'POST' });
    return { ok: res.ok, ...(await res.json()) };
  },
  async getSettings() { return (await checkedFetch('/api/editor/settings')).json(); },
  async saveSettings(data) { return (await checkedFetch('/api/editor/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json(); },
  async listQuests() { return (await checkedFetch('/api/editor/quests')).json(); },
  async getQuest(id) { return (await checkedFetch(`/api/editor/quests/${id}`)).json(); },
  async saveQuest(id, data) {
    const exists = await checkedFetch(`/api/editor/quests/${id}`);
    if (exists.status === 200) {
      return (await checkedFetch(`/api/editor/quests/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json();
    }
    return (await checkedFetch('/api/editor/quests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json();
  },
  async deleteQuest(id) { return (await checkedFetch(`/api/editor/quests/${id}`, { method: 'DELETE' })).json(); },
  async getTriggers(dungeonId) { return (await checkedFetch(`/api/editor/dungeons/${dungeonId}/triggers`)).json(); },
  async saveTriggers(dungeonId, triggers) { return (await checkedFetch(`/api/editor/dungeons/${dungeonId}/triggers`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(triggers) })).json(); },
  async getScriptingReference() { return (await checkedFetch('/api/editor/scripting/events')).json(); },
  async listTemplates() { return (await checkedFetch('/api/editor/templates')).json(); },
  async getTemplate(id) { return (await checkedFetch(`/api/editor/templates/${id}`)).json(); },
  async saveTemplate(id, data) { return (await checkedFetch(`/api/editor/templates/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json(); },
  async generateFromTemplate(templateId, opts) {
    const res = await checkedFetch(`/api/editor/templates/${templateId}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Generation failed'); }
    return res.json();
  },
  async createTemplate(data) { return (await checkedFetch('/api/editor/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json(); },
  async deleteTemplate(id) { return (await checkedFetch(`/api/editor/templates/${id}`, { method: 'DELETE' })).json(); },
};

// ─── Tile colors (match game rendering) ─────────────────────
const TILE_COLORS = {
  0: '#111122',   // void
  1: '#2a2a3d',   // stone_floor
  2: '#33334d',   // cracked_floor
  3: '#5a5a7a',   // stone_wall
  4: '#8b6914',   // door_closed
  5: '#6b8914',   // door_open
  6: '#ab47bc',   // stairs_down
  7: '#1a3a6a',   // water
  8: '#7b37ac',   // stairs_up
};

const SPAWN_COLORS = {
  player_start: '#4fc3f7',
  monster: '#e53935',
  npc: '#64b5f6',
  exit: '#ab47bc',
  item: '#fdd835',
};

// ─── Toast ──────────────────────────────────────────────────
let toastTimeout;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (type ? ` ${type}` : '');
  el.style.display = 'block';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.style.display = 'none', 2000);
}

// ─── Login Screen ───────────────────────────────────────────
function LoginScreen({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await api.login(password);
    setLoading(false);
    if (result.ok) { onSuccess(); }
    else { setError(result.error || 'Login failed'); }
  };

  return html`
    <div class="login-page">
      <div class="login-card">
        <h1>Lightkeeper Editor</h1>
        <form onSubmit=${submit}>
          <div class="field">
            <label>Password</label>
            <input type="password" value=${password} onInput=${e => setPassword(e.target.value)}
              placeholder="Enter editor password" autofocus />
          </div>
          ${error && html`<p class="login-error">${error}</p>`}
          <button class="primary login-btn" type="submit" disabled=${loading}>
            ${loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  `;
}

// ─── App ────────────────────────────────────────────────────
function App() {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'login' | 'ready'
  const [gitConfigured, setGitConfigured] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'edit' | 'quests' | 'quest_edit' | 'template_edit'
  const [dungeonId, setDungeonId] = useState(null);
  const [questId, setQuestId] = useState(null);
  const [templateId, setTemplateId] = useState(null);

  useEffect(() => {
    api.checkAuth().then(info => {
      setGitConfigured(info.gitConfigured);
      if (!info.needsAuth || info.authenticated) setAuthState('ready');
      else setAuthState('login');
    });

    const onUnauth = () => setAuthState('login');
    window.addEventListener('editor-unauthorized', onUnauth);
    return () => window.removeEventListener('editor-unauthorized', onUnauth);
  }, []);

  const openEditor = (id) => { setDungeonId(id); setView('edit'); };
  const backToList = () => { setView('list'); setDungeonId(null); setTemplateId(null); };
  const openQuestEditor = (id) => { setQuestId(id); setView('quest_edit'); };
  const backToQuests = () => { setView('quests'); setQuestId(null); };
  const openTemplate = (id) => { setTemplateId(id); setView('template_edit'); };

  if (authState === 'loading') return html`<div style="padding:60px;text-align:center;color:var(--text-dim)">Loading...</div>`;
  if (authState === 'login') return html`<${LoginScreen} onSuccess=${() => setAuthState('ready')} />`;

  return html`
    <div id="toast" class="toast" style="display:none"></div>
    ${view === 'list'
      ? html`<${DungeonList} onOpen=${openEditor} onOpenTemplate=${openTemplate} gitConfigured=${gitConfigured} onShowQuests=${() => setView('quests')} />`
      : view === 'edit'
      ? html`<${Editor} dungeonId=${dungeonId} onBack=${backToList} />`
      : view === 'quests'
      ? html`<${QuestList} onOpen=${openQuestEditor} onBack=${backToList} />`
      : view === 'quest_edit'
      ? html`<${QuestEditor} questId=${questId} onBack=${backToQuests} />`
      : view === 'template_edit'
      ? html`<${TemplateEditor} templateId=${templateId} onBack=${backToList} onOpen=${openEditor} />`
      : null
    }
  `;
}

// ─── Dungeon List ───────────────────────────────────────────
function DungeonList({ onOpen, onOpenTemplate, gitConfigured, onShowQuests }) {
  const [dungeons, setDungeons] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showBranch, setShowBranch] = useState(false);
  const [activeBranch, setActiveBranch] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [spawnRoom, setSpawnRoom] = useState('');

  const loadDungeons = () => {
    api.listDungeons().then(setDungeons);
    api.listTemplates().then(setTemplates).catch(() => {});
  };
  useEffect(() => {
    loadDungeons();
    api.getSettings().then(s => setSpawnRoom(s.spawnRoom || ''));
  }, []);

  const changeSpawnRoom = async (newRoom) => {
    setSpawnRoom(newRoom);
    try {
      await api.saveSettings({ spawnRoom: newRoom });
      showToast('Spawn room updated', 'success');
    } catch { showToast('Failed to save setting', 'error'); }
  };

  const doPublish = async (message) => {
    setPublishing(true);
    setShowPublish(false);
    try {
      const result = await api.publish(message);
      if (result.ok === false) {
        showToast(result.error || 'Publish failed', 'error');
      } else {
        showToast('Published! PR created.', 'success');
        if (result.prUrl) window.open(result.prUrl, '_blank');
      }
    } catch (e) { showToast(e.message || 'Publish failed', 'error'); }
    setPublishing(false);
  };

  const onBranchLoaded = (branch) => {
    setActiveBranch(branch);
    setShowBranch(false);
    loadDungeons();
  };

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await api.refreshBranch();
      if (result.ok === false) {
        showToast(result.error || 'Refresh failed', 'error');
      } else {
        showToast(`Refreshed from ${result.branch}`, 'success');
        loadDungeons();
      }
    } catch (e) { showToast(e.message || 'Refresh failed', 'error'); }
    setRefreshing(false);
  };

  const createDungeon = async (id, name, width, height) => {
    const data = Array(width * height).fill(3);
    // Carve a small starting room in the center
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height)
          data[ty * width + tx] = 1;
      }

    const dungeon = {
      id, name, depth: 1, tileset: 'crypt', tileSize: 32,
      width, height, data,
      spawns: [{ x: cx, y: cy, type: 'player_start' }],
      monsterSpawns: [], npcSpawns: [], exits: [], itemSpawns: []
    };
    try {
      await api.saveDungeon(id, dungeon);
      showToast('Dungeon created', 'success');
      setShowNew(false);
      api.listDungeons().then(setDungeons);
    } catch { showToast('Failed to create', 'error'); }
  };

  return html`
    <div class="dungeon-list-page">
      <div class="dungeon-list-header">
        <h1>Level Editor</h1>
        <div style="display:flex;gap:8px;align-items:center">
          ${gitConfigured && html`
            ${activeBranch && html`
              <button class="topbar-btn" onClick=${doRefresh} disabled=${refreshing}
                title="Refresh content from ${activeBranch}">
                ${refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            `}
            <button class="topbar-btn" onClick=${() => setShowBranch(true)}>Branches</button>
            <button class="topbar-btn" onClick=${() => setShowPublish(true)} disabled=${publishing}>
              ${publishing ? 'Publishing...' : 'Publish'}
            </button>
          `}
          <button class="topbar-btn" onClick=${onShowQuests}>Quests</button>
          <button class="topbar-btn primary" onClick=${() => setShowNew(true)}>+ New</button>
        </div>
      </div>
      ${activeBranch && html`
        <div class="branch-banner">
          Content loaded from branch: <strong>${activeBranch}</strong>
        </div>
      `}
      ${dungeons.length > 0 && html`
        <div class="spawn-room-bar">
          <label>Spawn Room</label>
          <select value=${spawnRoom} onChange=${e => changeSpawnRoom(e.target.value)}>
            ${dungeons.map(d => html`<option key=${d.id} value=${d.id}>${d.name} (${d.id})</option>`)}
          </select>
        </div>
      `}
      <div class="dungeon-cards">
        ${dungeons.map(d => html`
          <div class="dungeon-card" key=${d.id} onClick=${() => onOpen(d.id)}>
            <div class="dungeon-card-info">
              <h3>${d.name}${d.id === spawnRoom ? html` <span class="spawn-badge">Spawn</span>` : ''}</h3>
              <p>${d.id} · ${d.width}x${d.height} · depth ${d.depth}</p>
            </div>
            <div class="dungeon-card-arrow">›</div>
          </div>
        `)}
        ${dungeons.length === 0 && html`<p style="color: var(--text-dim); text-align: center; padding: 40px 0;">No dungeons yet. Create one!</p>`}
      </div>
      <div style="padding:0 20px;display:flex;align-items:center;justify-content:space-between">
        <h3 style="color:var(--text-dim);margin-bottom:8px">Procedural Templates</h3>
        <button class="topbar-btn" style="font-size:12px;height:28px;padding:0 10px" onClick=${() => setShowNewTemplate(true)}>+ New Template</button>
      </div>
      <div class="dungeon-cards">
        ${templates.map(t => html`
          <div class="dungeon-card" key=${t.id} onClick=${() => onOpenTemplate(t.id)}>
            <div class="dungeon-card-info">
              <h3>${t.name} <span class="template-badge">Procedural</span></h3>
              <p>${t.id} · depth ${t.depth ? t.depth.min + '-' + t.depth.max : '?'}</p>
            </div>
            <div class="dungeon-card-arrow">›</div>
          </div>
        `)}
        ${templates.length === 0 && html`<p style="color: var(--text-dim); text-align: center; padding: 20px 0;">No procedural templates yet.</p>`}
      </div>
      ${showNew && html`<${NewDungeonModal} onCreate=${createDungeon} onClose=${() => setShowNew(false)} />`}
      ${showNewTemplate && html`<${NewTemplateModal} onCreate=${(id, data) => {
        api.createTemplate(data).then(() => {
          showToast('Template created', 'success');
          setShowNewTemplate(false);
          api.listTemplates().then(setTemplates).catch(() => {});
          onOpenTemplate(id);
        }).catch(() => showToast('Failed to create template', 'error'));
      }} onClose=${() => setShowNewTemplate(false)} />`}
      ${showPublish && html`<${PublishModal} onPublish=${doPublish} onClose=${() => setShowPublish(false)} />`}
      ${showBranch && html`<${BranchModal} onLoad=${onBranchLoaded} onClose=${() => setShowBranch(false)} />`}
    </div>
  `;
}

// ─── New Dungeon Modal ──────────────────────────────────────
function NewDungeonModal({ onCreate, onClose }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [width, setWidth] = useState(25);
  const [height, setHeight] = useState(16);

  const submit = () => {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId || !name) return;
    onCreate(safeId, name, Number(width), Number(height));
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <h2>New Dungeon</h2>
        <div class="field">
          <label>ID (e.g. crypt_03)</label>
          <input value=${id} onInput=${e => setId(e.target.value)} placeholder="dungeon_id" />
        </div>
        <div class="field">
          <label>Name</label>
          <input value=${name} onInput=${e => setName(e.target.value)} placeholder="The Dark Passage" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Width</label>
            <input type="number" value=${width} onInput=${e => setWidth(e.target.value)} min="5" max="100" />
          </div>
          <div class="field">
            <label>Height</label>
            <input type="number" value=${height} onInput=${e => setHeight(e.target.value)} min="5" max="100" />
          </div>
        </div>
        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${submit}>Create</button>
        </div>
      </div>
    </div>
  `;
}

// ─── New Template Modal ────────────────────────────────────
function NewTemplateModal({ onCreate, onClose }) {
  const [id, setId] = useState('proc_');
  const [namePattern, setNamePattern] = useState('');
  const [depthMin, setDepthMin] = useState(1);
  const [depthMax, setDepthMax] = useState(3);

  const submit = () => {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId || !namePattern) return;
    const data = {
      id: safeId,
      type: 'procedural',
      namePattern,
      tileset: 'crypt',
      tileSize: 32,
      depth: { min: Number(depthMin), max: Number(depthMax) },
      grid: { width: 40, height: 30, wallTile: 3, floorTile: 1, altFloorTile: 2, altFloorChance: 0.05 },
      rooms: { count: { min: 5, max: 8 }, width: { min: 5, max: 10 }, height: { min: 5, max: 8 }, padding: 2, maxPlacementAttempts: 200 },
      corridors: { width: { min: 2, max: 3 }, doorChance: 0.3, doorTile: 4, extraConnectionChance: 0.2 },
      requiredRooms: [
        { tag: 'entrance', isEntrance: true, width: { min: 5, max: 7 }, height: { min: 5, max: 7 } },
        { tag: 'exit_room', isExit: true, width: { min: 4, max: 6 }, height: { min: 4, max: 6 } }
      ],
      exits: {
        entrance: { tile: 8, position: 'entrance_room', leadsTo: '$source' },
        descent: { tile: 6, position: 'exit_room', leadsTo: '$next', hideDescentOnLast: true }
      },
      monsters: { budget: { base: 4, perDepth: 2 }, pool: [], maxPerRoom: 3, avoidEntranceRoom: true },
      items: { pool: [], countRange: { min: 1, max: 3 } },
      triggers: [],
      spawns: { count: 4, position: 'entrance_room' }
    };
    onCreate(safeId, data);
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <h2>New Procedural Template</h2>
        <div class="field">
          <label>ID (e.g. proc_cave_01)</label>
          <input value=${id} onInput=${e => setId(e.target.value)} placeholder="proc_template_id" />
        </div>
        <div class="field">
          <label>Name Pattern (use {depth} for level number)</label>
          <input value=${namePattern} onInput=${e => setNamePattern(e.target.value)} placeholder="Cave System - Level {depth}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Min Depth</label>
            <input type="number" value=${depthMin} onInput=${e => setDepthMin(e.target.value)} min="1" max="20" />
          </div>
          <div class="field">
            <label>Max Depth</label>
            <input type="number" value=${depthMax} onInput=${e => setDepthMax(e.target.value)} min="1" max="20" />
          </div>
        </div>
        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${submit}>Create</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Publish Modal ──────────────────────────────────────────
function PublishModal({ onPublish, onClose }) {
  const [message, setMessage] = useState('Content update from editor');

  const submit = () => {
    if (!message.trim()) return;
    onPublish(message.trim());
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <h2>Publish to GitHub</h2>
        <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">
          This will commit all content changes and open a pull request.
        </p>
        <div class="field">
          <label>Commit message</label>
          <input value=${message} onInput=${e => setMessage(e.target.value)} placeholder="Describe your changes" />
        </div>
        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${submit}>Publish</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Branch Modal ────────────────────────────────────────────
function BranchModal({ onLoad, onClose }) {
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingBranch, setLoadingBranch] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.listBranches().then(data => {
      setBranches(data.branches || []);
      setActiveBranch(data.activeBranch || null);
      setLoading(false);
    }).catch(() => {
      showToast('Failed to fetch branches', 'error');
      setLoading(false);
    });
  }, []);

  const doLoad = async (branch) => {
    setLoadingBranch(branch);
    try {
      const result = await api.loadBranch(branch);
      if (result.ok === false) {
        showToast(result.error || 'Failed to load branch', 'error');
      } else {
        showToast(`Loaded content from ${branch}`, 'success');
        onLoad(branch);
      }
    } catch (e) { showToast(e.message || 'Failed to load branch', 'error'); }
    setLoadingBranch(null);
  };

  const filtered = filter
    ? branches.filter(b => b.toLowerCase().includes(filter.toLowerCase()))
    : branches;

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal branch-modal">
        <h2>Load Content from Branch</h2>
        ${activeBranch && html`
          <div class="branch-active-badge">
            Active: <strong>${activeBranch}</strong>
          </div>
        `}
        <div class="field" style="margin-bottom:12px">
          <input value=${filter} onInput=${e => setFilter(e.target.value)}
            placeholder="Filter branches..." />
        </div>
        ${loading && html`<p style="color:var(--text-dim);text-align:center;padding:20px 0">Fetching branches...</p>`}
        ${!loading && filtered.length === 0 && html`<p style="color:var(--text-dim);text-align:center;padding:20px 0">No branches found</p>`}
        ${!loading && html`
          <div class="branch-list">
            ${filtered.map(b => html`
              <div class="branch-item ${b === activeBranch ? 'active' : ''}" key=${b}>
                <span class="branch-name">${b}</span>
                <button class="branch-load-btn"
                  onClick=${() => doLoad(b)}
                  disabled=${loadingBranch !== null}>
                  ${loadingBranch === b ? 'Loading...' : b === activeBranch ? 'Reload' : 'Load'}
                </button>
              </div>
            `)}
          </div>
        `}
        <div class="modal-actions">
          <button onClick=${onClose}>Close</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Editor ─────────────────────────────────────────────────
function Editor({ dungeonId, onBack }) {
  const [dungeon, setDungeon] = useState(null);
  const [tilesets, setTilesets] = useState([]);
  const [monsters, setMonsters] = useState({});
  const [npcs, setNPCs] = useState({});
  const [items, setItems] = useState({});
  const [tool, setTool] = useState('paint');          // paint | erase | spawn | select
  const [selectedTile, setSelectedTile] = useState(1); // tile ID to paint
  const [spawnMode, setSpawnMode] = useState('player_start'); // player_start | monster | npc | exit | item
  const [spawnEntityType, setSpawnEntityType] = useState(''); // specific entity type for spawn
  const [dirty, setDirty] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [showNPCEditor, setShowNPCEditor] = useState(null);  // null or npcType string
  const [showItemEditor, setShowItemEditor] = useState(null); // null or itemType string
  const [showTriggerEditor, setShowTriggerEditor] = useState(false);
  const [selectedSpawn, setSelectedSpawn] = useState(null); // { kind, index } for move tool
  const [showIso, setShowIso] = useState(false);

  // Undo/redo
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const strokeActiveRef = useRef(false);
  const strokeSnapshotTakenRef = useRef(false);
  const MAX_UNDO = 50;

  useEffect(() => {
    Promise.all([
      api.getDungeon(dungeonId),
      api.getTilesets(),
      api.getMonsters(),
      api.getNPCs(),
      api.getItems()
    ]).then(([d, t, m, n, it]) => {
      setDungeon(d);
      setTilesets(t);
      setMonsters(m);
      setNPCs(n);
      setItems(it);
    });
  }, [dungeonId]);

  const updateDungeon = useCallback((updater) => {
    setDungeon(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (next === prev) return prev; // No change, skip undo snapshot
      // Push snapshot to undo stack (once per stroke, or every time if not in a stroke)
      if (!strokeActiveRef.current || !strokeSnapshotTakenRef.current) {
        undoStackRef.current.push(JSON.stringify(prev));
        if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
        redoStackRef.current.length = 0;
        if (strokeActiveRef.current) strokeSnapshotTakenRef.current = true;
      }
      return next;
    });
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    setDungeon(prev => {
      redoStackRef.current.push(JSON.stringify(prev));
      return JSON.parse(undoStackRef.current.pop());
    });
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    setDungeon(prev => {
      undoStackRef.current.push(JSON.stringify(prev));
      return JSON.parse(redoStackRef.current.pop());
    });
    setDirty(true);
  }, []);

  const beginStroke = useCallback(() => {
    strokeActiveRef.current = true;
    strokeSnapshotTakenRef.current = false;
  }, []);

  const endStroke = useCallback(() => {
    strokeActiveRef.current = false;
    strokeSnapshotTakenRef.current = false;
  }, []);

  const save = async () => {
    if (!dungeon) return;
    try {
      await api.saveDungeon(dungeon.id, dungeon);
      setDirty(false);
      showToast('Saved!', 'success');
    } catch { showToast('Save failed', 'error'); }
  };

  const saveAndReload = async () => {
    if (!dungeon) return;
    try {
      await api.saveDungeon(dungeon.id, dungeon);
      setDirty(false);
      const result = await api.reload();
      showToast(`Reloaded ${result.reloaded.length} room(s)`, 'success');
    } catch { showToast('Reload failed', 'error'); }
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  // Clear spawn selection when switching away from move tool
  useEffect(() => {
    if (tool !== 'move') setSelectedSpawn(null);
  }, [tool]);

  if (!dungeon) return html`<div style="padding:40px;text-align:center;color:var(--text-dim)">Loading...</div>`;

  const tileset = tilesets.find(t => t.id === dungeon.tileset);
  const tiles = tileset ? tileset.tiles : {};

  const panelContent = html`
    <${ToolSelector} tool=${tool} setTool=${setTool} />
    ${tool === 'paint' && html`<${TilePalette} tiles=${tiles} selected=${selectedTile} onSelect=${setSelectedTile} />`}
    ${tool === 'move' && html`<${MovePanel} dungeon=${dungeon} updateDungeon=${updateDungeon}
      selectedSpawn=${selectedSpawn} setSelectedSpawn=${setSelectedSpawn}
      onEditNPC=${(type) => setShowNPCEditor(type || true)}
      onEditItem=${(type) => setShowItemEditor(type || true)} />`}
    ${tool === 'spawn' && html`<${SpawnPanel}
      dungeon=${dungeon} updateDungeon=${updateDungeon}
      spawnMode=${spawnMode} setSpawnMode=${setSpawnMode}
      spawnEntityType=${spawnEntityType} setSpawnEntityType=${setSpawnEntityType}
      monsters=${monsters} npcs=${npcs} items=${items}
    />`}
    <${SpawnList} dungeon=${dungeon} updateDungeon=${updateDungeon}
      onEditNPC=${(type) => setShowNPCEditor(type || true)}
      onEditItem=${(type) => setShowItemEditor(type || true)}
      selectedSpawn=${selectedSpawn}
      onSelectSpawn=${(sel) => { setTool('move'); setSelectedSpawn(sel); }} />
    <${EntitySection}
      onEditNPCs=${() => setShowNPCEditor(true)}
      onEditItems=${() => setShowItemEditor(true)}
      onEditTriggers=${() => setShowTriggerEditor(true)}
    />
    <div class="panel-section">
      <${RawJsonToggle} data=${dungeon} onApply=${(parsed) => {
        if (typeof parsed !== 'object' || Array.isArray(parsed)) { showToast('Dungeon must be an object', 'error'); return; }
        setDungeon(parsed);
        setDirty(true);
      }} />
    </div>
  `;

  return html`
    <div class="topbar">
      <button class="topbar-btn" onClick=${onBack}>← Back</button>
      <h1>${dungeon.name}</h1>
      <div class="topbar-spacer" />
      <button class="topbar-btn" onClick=${undo} disabled=${undoStackRef.current.length === 0} title="Undo (Ctrl+Z)">Undo</button>
      <button class="topbar-btn" onClick=${redo} disabled=${redoStackRef.current.length === 0} title="Redo (Ctrl+Y)">Redo</button>
      <button class="topbar-btn" onClick=${() => setShowIso(v => !v)}>${showIso ? 'Iso \u2713' : 'Iso'}</button>
      <button class="topbar-btn" onClick=${() => setShowProps(true)}>Props</button>
      <button class="topbar-btn primary" onClick=${save}>${dirty ? 'Save*' : 'Save'}</button>
      <button class="topbar-btn danger" onClick=${saveAndReload}>Reload</button>
    </div>
    <div class="editor-main">
      <${TileCanvas}
        dungeon=${dungeon} tiles=${tiles} tool=${tool}
        selectedTile=${selectedTile} spawnMode=${spawnMode}
        spawnEntityType=${spawnEntityType}
        updateDungeon=${updateDungeon}
        onStrokeStart=${beginStroke} onStrokeEnd=${endStroke}
        selectedSpawn=${selectedSpawn} onSelectSpawn=${setSelectedSpawn}
        monsters=${monsters} npcs=${npcs} items=${items}
        onEditNPC=${(type) => setShowNPCEditor(type || true)}
        onEditItem=${(type) => setShowItemEditor(type || true)}
      />
      ${showIso && html`<${IsoPreview} dungeon=${dungeon} tiles=${tiles} />`}
      <div class="side-panel">${panelContent}</div>
    </div>
    <div class="bottom-sheet" id="bottom-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-content">${panelContent}</div>
    </div>
    ${showProps && html`<${PropertiesModal} dungeon=${dungeon} tilesets=${tilesets}
      updateDungeon=${updateDungeon} onClose=${() => setShowProps(false)} />`}
    ${showNPCEditor && html`<${NPCEditorModal} npcs=${npcs} setNPCs=${setNPCs}
      initialSelectedId=${typeof showNPCEditor === 'string' ? showNPCEditor : undefined}
      onClose=${() => setShowNPCEditor(null)} />`}
    ${showItemEditor && html`<${ItemEditorModal} items=${items} setItems=${setItems}
      initialSelectedId=${typeof showItemEditor === 'string' ? showItemEditor : undefined}
      onClose=${() => setShowItemEditor(null)} />`}
    ${showTriggerEditor && html`<${TriggerEditorModal} dungeonId=${dungeonId}
      onClose=${() => setShowTriggerEditor(false)} />`}
  `;
}

// ─── Tool Selector ──────────────────────────────────────────
function ToolSelector({ tool, setTool }) {
  return html`
    <div class="panel-section">
      <h3>Tool</h3>
      <div class="tool-bar">
        <button class="tool-btn ${tool === 'paint' ? 'selected' : ''}" onClick=${() => setTool('paint')}>Paint</button>
        <button class="tool-btn ${tool === 'erase' ? 'selected' : ''}" onClick=${() => setTool('erase')}>Erase</button>
        <button class="tool-btn ${tool === 'spawn' ? 'selected' : ''}" onClick=${() => setTool('spawn')}>Spawn</button>
        <button class="tool-btn ${tool === 'move' ? 'selected' : ''}" onClick=${() => setTool('move')}>Move</button>
      </div>
    </div>
  `;
}

// ─── Tile Palette ───────────────────────────────────────────
function TilePalette({ tiles, selected, onSelect }) {
  const entries = Object.entries(tiles);
  return html`
    <div class="panel-section">
      <h3>Tiles</h3>
      <div class="tile-grid">
        ${entries.map(([id, tile]) => html`
          <button key=${id}
            class="tile-btn ${Number(id) === selected ? 'selected' : ''}"
            onClick=${() => onSelect(Number(id))}>
            <div class="tile-swatch" style="background:${TILE_COLORS[id] || '#333'}"></div>
            ${tile.name.replace(/_/g, ' ')}
          </button>
        `)}
      </div>
    </div>
  `;
}

// ─── Spawn Panel ────────────────────────────────────────────
function SpawnPanel({ dungeon, updateDungeon, spawnMode, setSpawnMode, spawnEntityType, setSpawnEntityType, monsters, npcs, items }) {
  // Auto-select first entity type when mode changes
  const getDefaultType = (mode) => {
    if (mode === 'monster') return Object.keys(monsters)[0] || 'skeleton';
    if (mode === 'npc') return Object.keys(npcs)[0] || 'old_keeper';
    if (mode === 'item') return Object.keys(items)[0] || 'health_potion';
    return '';
  };

  const changeMode = (mode) => {
    setSpawnMode(mode);
    setSpawnEntityType(getDefaultType(mode));
  };

  // Entity type dropdown for monster/npc/item
  let entityOptions = null;
  if (spawnMode === 'monster') {
    entityOptions = Object.entries(monsters).map(([id, m]) => ({ id, name: m.name }));
  } else if (spawnMode === 'npc') {
    entityOptions = Object.entries(npcs).map(([id, n]) => ({ id, name: n.name }));
  } else if (spawnMode === 'item') {
    entityOptions = Object.entries(items).map(([id, it]) => ({ id, name: it.name }));
  }

  return html`
    <div class="panel-section">
      <h3>Place Spawns</h3>
      <div class="tool-bar" style="flex-wrap:wrap">
        <button class="tool-btn ${spawnMode === 'player_start' ? 'selected' : ''}"
          onClick=${() => changeMode('player_start')}
          style="border-color:${SPAWN_COLORS.player_start}">Player</button>
        <button class="tool-btn ${spawnMode === 'monster' ? 'selected' : ''}"
          onClick=${() => changeMode('monster')}
          style="border-color:${SPAWN_COLORS.monster}">Monster</button>
        <button class="tool-btn ${spawnMode === 'npc' ? 'selected' : ''}"
          onClick=${() => changeMode('npc')}
          style="border-color:${SPAWN_COLORS.npc}">NPC</button>
        <button class="tool-btn ${spawnMode === 'item' ? 'selected' : ''}"
          onClick=${() => changeMode('item')}
          style="border-color:${SPAWN_COLORS.item}">Item</button>
        <button class="tool-btn ${spawnMode === 'exit' ? 'selected' : ''}"
          onClick=${() => changeMode('exit')}
          style="border-color:${SPAWN_COLORS.exit}">Exit</button>
      </div>
      ${entityOptions && entityOptions.length > 0 && html`
        <div class="field" style="margin-top:8px;margin-bottom:0">
          <label>Type</label>
          <select value=${spawnEntityType} onChange=${e => setSpawnEntityType(e.target.value)}>
            ${entityOptions.map(o => html`<option key=${o.id} value=${o.id}>${o.name} (${o.id})</option>`)}
          </select>
        </div>
      `}
      <p style="font-size:11px;color:var(--text-dim);margin-top:8px">Tap a floor tile to place.</p>
    </div>
  `;
}

// ─── Spawn List ─────────────────────────────────────────────
function SpawnList({ dungeon, updateDungeon, onEditNPC, onEditItem, selectedSpawn, onSelectSpawn }) {
  const allSpawns = [
    ...dungeon.spawns.map((s, i) => ({ ...s, _kind: 'spawn', _i: i, _label: `Player (${s.x},${s.y})` })),
    ...dungeon.monsterSpawns.map((s, i) => ({ ...s, _kind: 'monster', _i: i, _label: `${s.type} (${s.x},${s.y}) x${s.count}` })),
    ...dungeon.npcSpawns.map((s, i) => ({ ...s, _kind: 'npc', _i: i, _label: `${s.type} (${s.x},${s.y})` })),
    ...(dungeon.itemSpawns || []).map((s, i) => ({ ...s, _kind: 'item', _i: i, _label: `${s.type} (${s.x},${s.y})` })),
    ...dungeon.exits.map((s, i) => ({ ...s, _kind: 'exit', _i: i, _label: `Exit${s.id ? ` [${s.id}]` : ''}→${s.leadsTo} (${s.x},${s.y})` })),
  ];

  const remove = (kind, idx) => {
    updateDungeon(prev => {
      const d = { ...prev };
      if (kind === 'spawn') d.spawns = d.spawns.filter((_, i) => i !== idx);
      else if (kind === 'monster') d.monsterSpawns = d.monsterSpawns.filter((_, i) => i !== idx);
      else if (kind === 'npc') d.npcSpawns = d.npcSpawns.filter((_, i) => i !== idx);
      else if (kind === 'item') d.itemSpawns = (d.itemSpawns || []).filter((_, i) => i !== idx);
      else if (kind === 'exit') d.exits = d.exits.filter((_, i) => i !== idx);
      return d;
    });
  };

  if (allSpawns.length === 0) return null;

  const colorFor = (kind) => {
    if (kind === 'spawn') return SPAWN_COLORS.player_start;
    if (kind === 'monster') return SPAWN_COLORS.monster;
    if (kind === 'npc') return SPAWN_COLORS.npc;
    if (kind === 'item') return SPAWN_COLORS.item;
    return SPAWN_COLORS.exit;
  };

  const isSelected = (s) => selectedSpawn && selectedSpawn.kind === s._kind && selectedSpawn.index === s._i;

  return html`
    <div class="panel-section">
      <h3>Spawns (${allSpawns.length})</h3>
      <div class="spawn-list">
        ${allSpawns.map(s => {
          const selected = isSelected(s);
          const onClick = () => {
            if (onSelectSpawn) onSelectSpawn({ kind: s._kind, index: s._i });
          };
          return html`
            <div class="spawn-item ${selected ? 'spawn-item-selected' : ''}" key="${s._kind}-${s._i}"
              onClick=${onClick} style="cursor:pointer">
              <div class="spawn-dot" style="background:${colorFor(s._kind)}"></div>
              <span class="spawn-label-link">${s._label}</span>
              <button class="spawn-remove" onClick=${(e) => { e.stopPropagation(); remove(s._kind, s._i); }}>×</button>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ─── Properties Modal ───────────────────────────────────────
function PropertiesModal({ dungeon, tilesets, updateDungeon, onClose }) {
  const [name, setName] = useState(dungeon.name);
  const [depth, setDepth] = useState(dungeon.depth);
  const [tileset, setTileset] = useState(dungeon.tileset);
  const [width, setWidth] = useState(dungeon.width);
  const [height, setHeight] = useState(dungeon.height);

  const apply = () => {
    const newW = Math.max(5, Math.min(100, Number(width)));
    const newH = Math.max(5, Math.min(100, Number(height)));

    updateDungeon(prev => {
      const d = { ...prev, name, depth: Number(depth), tileset };
      // Resize grid if dimensions changed
      if (newW !== prev.width || newH !== prev.height) {
        const newData = Array(newW * newH).fill(3);
        for (let y = 0; y < Math.min(prev.height, newH); y++) {
          for (let x = 0; x < Math.min(prev.width, newW); x++) {
            newData[y * newW + x] = prev.data[y * prev.width + x];
          }
        }
        d.width = newW;
        d.height = newH;
        d.data = newData;
        // Remove out-of-bounds spawns
        d.spawns = d.spawns.filter(s => s.x < newW && s.y < newH);
        d.monsterSpawns = d.monsterSpawns.filter(s => s.x < newW && s.y < newH);
        d.npcSpawns = d.npcSpawns.filter(s => s.x < newW && s.y < newH);
        if (d.itemSpawns) d.itemSpawns = d.itemSpawns.filter(s => s.x < newW && s.y < newH);
        d.exits = d.exits.filter(s => s.x < newW && s.y < newH);
      }
      return d;
    });
    onClose();
  };

  return html`
    <div class="modal-overlay" onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <h2>Dungeon Properties</h2>
        <div class="field">
          <label>Name</label>
          <input value=${name} onInput=${e => setName(e.target.value)} />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Depth</label>
            <input type="number" value=${depth} onInput=${e => setDepth(e.target.value)} min="1" />
          </div>
          <div class="field">
            <label>Tileset</label>
            <select value=${tileset} onChange=${e => setTileset(e.target.value)}>
              ${tilesets.map(t => html`<option key=${t.id} value=${t.id}>${t.id}</option>`)}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Width</label>
            <input type="number" value=${width} onInput=${e => setWidth(e.target.value)} min="5" max="100" />
          </div>
          <div class="field">
            <label>Height</label>
            <input type="number" value=${height} onInput=${e => setHeight(e.target.value)} min="5" max="100" />
          </div>
        </div>
        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${apply}>Apply</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Spawn lookup helper ─────────────────────────────────────
function findSpawnAt(dungeon, x, y) {
  const ei = dungeon.exits.findIndex(s => s.x === x && s.y === y);
  if (ei !== -1) return { kind: 'exit', index: ei };
  const ni = dungeon.npcSpawns.findIndex(s => s.x === x && s.y === y);
  if (ni !== -1) return { kind: 'npc', index: ni };
  const mi = dungeon.monsterSpawns.findIndex(s => s.x === x && s.y === y);
  if (mi !== -1) return { kind: 'monster', index: mi };
  const ii = (dungeon.itemSpawns || []).findIndex(s => s.x === x && s.y === y);
  if (ii !== -1) return { kind: 'item', index: ii };
  const pi = dungeon.spawns.findIndex(s => s.x === x && s.y === y);
  if (pi !== -1) return { kind: 'spawn', index: pi };
  return null;
}

function getSpawnData(dungeon, sel) {
  if (!sel) return null;
  if (sel.kind === 'spawn') return dungeon.spawns[sel.index];
  if (sel.kind === 'monster') return dungeon.monsterSpawns[sel.index];
  if (sel.kind === 'npc') return dungeon.npcSpawns[sel.index];
  if (sel.kind === 'item') return (dungeon.itemSpawns || [])[sel.index];
  if (sel.kind === 'exit') return dungeon.exits[sel.index];
  return null;
}

// ─── Move Panel (properties for selected spawn) ─────────────
function MovePanel({ dungeon, updateDungeon, selectedSpawn, setSelectedSpawn, onEditNPC, onEditItem }) {
  if (!selectedSpawn) {
    return html`
      <div class="panel-section">
        <h3>Move</h3>
        <p style="font-size:11px;color:var(--text-dim)">Click a spawn to select it, then click another tile to move it.</p>
      </div>
    `;
  }

  const spawn = getSpawnData(dungeon, selectedSpawn);
  if (!spawn) { setSelectedSpawn(null); return null; }

  const kind = selectedSpawn.kind;
  const label = kind === 'spawn' ? 'Player Start'
    : kind === 'exit' ? `Exit${spawn.id ? ` [${spawn.id}]` : ''}`
    : kind === 'monster' ? `Monster: ${spawn.type}`
    : kind === 'npc' ? `NPC: ${spawn.type}`
    : kind === 'item' ? `Item: ${spawn.type}`
    : 'Unknown';

  const updateProp = (field, value) => {
    updateDungeon(prev => {
      const d = { ...prev };
      if (kind === 'spawn') { d.spawns = [...d.spawns]; d.spawns[selectedSpawn.index] = { ...d.spawns[selectedSpawn.index], [field]: value }; }
      else if (kind === 'monster') { d.monsterSpawns = [...d.monsterSpawns]; d.monsterSpawns[selectedSpawn.index] = { ...d.monsterSpawns[selectedSpawn.index], [field]: value }; }
      else if (kind === 'npc') { d.npcSpawns = [...d.npcSpawns]; d.npcSpawns[selectedSpawn.index] = { ...d.npcSpawns[selectedSpawn.index], [field]: value }; }
      else if (kind === 'item') { d.itemSpawns = [...(d.itemSpawns || [])]; d.itemSpawns[selectedSpawn.index] = { ...d.itemSpawns[selectedSpawn.index], [field]: value }; }
      else if (kind === 'exit') { d.exits = [...d.exits]; d.exits[selectedSpawn.index] = { ...d.exits[selectedSpawn.index], [field]: value }; }
      return d;
    });
  };

  return html`
    <div class="panel-section">
      <h3>Move</h3>
      <div class="move-selected-info">
        <span class="spawn-dot" style="background:${SPAWN_COLORS[kind === 'spawn' ? 'player_start' : kind]}"></span>
        <strong>${label}</strong> at (${spawn.x}, ${spawn.y})
      </div>
      <p style="font-size:11px;color:var(--text-dim);margin:6px 0 8px">Click a tile to move, or edit properties below.</p>

      ${kind === 'exit' && html`
        <div class="field">
          <label>Exit ID <span style="color:var(--text-dim);font-weight:normal">(optional — lets other exits link here)</span></label>
          <input value=${spawn.id || ''} onInput=${e => updateProp('id', e.target.value || undefined)} placeholder="e.g. north_door" />
        </div>
        <div class="field">
          <label>Leads To (dungeon ID)</label>
          <input value=${spawn.leadsTo || ''} onInput=${e => updateProp('leadsTo', e.target.value)} placeholder="e.g. crypt_02" />
        </div>
        <div class="field">
          <label>Target Exit ID <span style="color:var(--text-dim);font-weight:normal">(spawn at this exit in target room)</span></label>
          <input value=${spawn.targetId || ''} onInput=${e => updateProp('targetId', e.target.value || undefined)} placeholder="e.g. south_door" />
        </div>
        <div class="field">
          <label>Stair Type</label>
          <select value=${spawn.type || 'stairs_down'} onChange=${e => updateProp('type', e.target.value)}>
            <option value="stairs_down">stairs_down</option>
            <option value="stairs_up">stairs_up</option>
          </select>
        </div>
        <div class="field-row" style="opacity:${spawn.targetId ? 0.4 : 1}">
          <div class="field">
            <label>Spawn X ${spawn.targetId ? '(overridden)' : ''}</label>
            <input type="number" value=${spawn.spawnX || 0} onInput=${e => updateProp('spawnX', Number(e.target.value))} min="0" />
          </div>
          <div class="field">
            <label>Spawn Y ${spawn.targetId ? '(overridden)' : ''}</label>
            <input type="number" value=${spawn.spawnY || 0} onInput=${e => updateProp('spawnY', Number(e.target.value))} min="0" />
          </div>
        </div>
      `}

      ${kind === 'monster' && html`
        <div class="field-row">
          <div class="field">
            <label>Count</label>
            <input type="number" value=${spawn.count || 1} onInput=${e => updateProp('count', Math.max(1, Number(e.target.value)))} min="1" />
          </div>
          <div class="field">
            <label>Patrol</label>
            <select value=${spawn.patrol || 'wander'} onChange=${e => updateProp('patrol', e.target.value)}>
              <option value="wander">wander</option>
              <option value="stationary">stationary</option>
              <option value="patrol">patrol</option>
            </select>
          </div>
        </div>
      `}

      <div style="display:flex;gap:6px;margin-top:4px">
        ${kind === 'npc' && onEditNPC && html`
          <button class="tool-btn" style="flex:1;border-color:${SPAWN_COLORS.npc}"
            onClick=${() => onEditNPC(spawn.type)}>Edit NPC</button>
        `}
        ${kind === 'item' && onEditItem && html`
          <button class="tool-btn" style="flex:1;border-color:${SPAWN_COLORS.item}"
            onClick=${() => onEditItem(spawn.type)}>Edit Item</button>
        `}
        <button class="tool-btn" style="flex:1;border-color:var(--text-dim)"
          onClick=${() => setSelectedSpawn(null)}>Deselect</button>
      </div>
    </div>
  `;
}

// ─── Tile Canvas (the core painting surface) ────────────────
function TileCanvas({ dungeon, tiles, tool, selectedTile, spawnMode, spawnEntityType, updateDungeon, onStrokeStart, onStrokeEnd, selectedSpawn, onSelectSpawn, monsters, npcs, items, onEditNPC, onEditItem }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stateRef = useRef({
    offsetX: 0, offsetY: 0, scale: 1,
    isPanning: false, isPainting: false,
    lastPanX: 0, lastPanY: 0,
    pinchDist: 0,
  });

  const CELL = 24;

  // --- Draw ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dungeon) return;
    const ctx = canvas.getContext('2d');
    const st = stateRef.current;
    const w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(st.offsetX, st.offsetY);
    ctx.scale(st.scale, st.scale);

    const cellSize = CELL;

    // Draw tiles
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const tileId = dungeon.data[y * dungeon.width + x];
        ctx.fillStyle = TILE_COLORS[tileId] || '#333';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    // Draw spawns
    const drawMarker = (x, y, color, label) => {
      const cx = x * cellSize + cellSize / 2;
      const cy = y * cellSize + cellSize / 2;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (label) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(7, cellSize * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy);
      }
    };

    for (const s of dungeon.spawns) drawMarker(s.x, s.y, SPAWN_COLORS.player_start, 'P');
    for (const s of dungeon.monsterSpawns) drawMarker(s.x, s.y, SPAWN_COLORS.monster, 'M');
    for (const s of dungeon.npcSpawns) drawMarker(s.x, s.y, SPAWN_COLORS.npc, 'N');
    if (dungeon.itemSpawns) {
      for (const s of dungeon.itemSpawns) drawMarker(s.x, s.y, SPAWN_COLORS.item, 'I');
    }
    for (const s of dungeon.exits) drawMarker(s.x, s.y, SPAWN_COLORS.exit, s.id ? s.id[0].toUpperCase() : 'E');

    // Draw selection highlight for move tool
    if (selectedSpawn) {
      const s = getSpawnData(dungeon, selectedSpawn);
      if (s) {
        const cx = s.x * cellSize + cellSize / 2;
        const cy = s.y * cellSize + cellSize / 2;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    ctx.restore();
  }, [dungeon, selectedSpawn]);

  // --- Resize canvas ---
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ro = new ResizeObserver(() => {
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw, dungeon]);

  // Center on initial load
  useEffect(() => {
    if (!dungeon || !wrapRef.current) return;
    const wrap = wrapRef.current;
    const totalW = dungeon.width * CELL;
    const totalH = dungeon.height * CELL;
    const st = stateRef.current;
    st.scale = Math.min(wrap.clientWidth / totalW, wrap.clientHeight / totalH, 2) * 0.9;
    st.offsetX = (wrap.clientWidth - totalW * st.scale) / 2;
    st.offsetY = (wrap.clientHeight - totalH * st.scale) / 2;
    draw();
  }, [dungeon?.id]);

  // --- Convert screen pos to grid cell ---
  const screenToCell = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const st = stateRef.current;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = (sx - st.offsetX) / st.scale;
    const wy = (sy - st.offsetY) / st.scale;
    const gx = Math.floor(wx / CELL);
    const gy = Math.floor(wy / CELL);
    if (gx < 0 || gy < 0 || gx >= dungeon.width || gy >= dungeon.height) return null;
    return { x: gx, y: gy };
  };

  // --- Apply tool at cell ---
  const applyTool = useCallback((cell) => {
    if (!cell) return;
    if (tool === 'paint') {
      updateDungeon(prev => {
        const idx = cell.y * prev.width + cell.x;
        if (prev.data[idx] === selectedTile) return prev;
        const data = [...prev.data];
        data[idx] = selectedTile;
        return { ...prev, data };
      });
    } else if (tool === 'erase') {
      updateDungeon(prev => {
        const idx = cell.y * prev.width + cell.x;
        if (prev.data[idx] === 0) return prev;
        const data = [...prev.data];
        data[idx] = 0;
        return { ...prev, data };
      });
    } else if (tool === 'spawn') {
      updateDungeon(prev => {
        const d = { ...prev };
        if (spawnMode === 'player_start') {
          d.spawns = [...d.spawns, { x: cell.x, y: cell.y, type: 'player_start' }];
        } else if (spawnMode === 'monster') {
          const type = spawnEntityType || Object.keys(monsters)[0] || 'skeleton';
          d.monsterSpawns = [...d.monsterSpawns, { type, x: cell.x, y: cell.y, count: 1, patrol: 'wander' }];
        } else if (spawnMode === 'npc') {
          const type = spawnEntityType || Object.keys(npcs)[0] || 'old_keeper';
          d.npcSpawns = [...d.npcSpawns, { type, x: cell.x, y: cell.y }];
        } else if (spawnMode === 'item') {
          const type = spawnEntityType || Object.keys(items)[0] || 'health_potion';
          if (!d.itemSpawns) d.itemSpawns = [];
          d.itemSpawns = [...d.itemSpawns, { type, x: cell.x, y: cell.y }];
        } else if (spawnMode === 'exit') {
          d.exits = [...d.exits, { x: cell.x, y: cell.y, leadsTo: '', type: 'stairs_down', spawnX: 3, spawnY: 3 }];
        }
        return d;
      });
    } else if (tool === 'move') {
      const hit = findSpawnAt(dungeon, cell.x, cell.y);
      if (selectedSpawn) {
        if (hit && hit.kind === selectedSpawn.kind && hit.index === selectedSpawn.index) {
          onSelectSpawn(null); // Deselect on same spawn
        } else {
          // Move the selected spawn to this cell
          updateDungeon(prev => {
            const d = { ...prev };
            const k = selectedSpawn.kind;
            if (k === 'spawn') { d.spawns = [...d.spawns]; d.spawns[selectedSpawn.index] = { ...d.spawns[selectedSpawn.index], x: cell.x, y: cell.y }; }
            else if (k === 'monster') { d.monsterSpawns = [...d.monsterSpawns]; d.monsterSpawns[selectedSpawn.index] = { ...d.monsterSpawns[selectedSpawn.index], x: cell.x, y: cell.y }; }
            else if (k === 'npc') { d.npcSpawns = [...d.npcSpawns]; d.npcSpawns[selectedSpawn.index] = { ...d.npcSpawns[selectedSpawn.index], x: cell.x, y: cell.y }; }
            else if (k === 'item') { d.itemSpawns = [...(d.itemSpawns || [])]; d.itemSpawns[selectedSpawn.index] = { ...d.itemSpawns[selectedSpawn.index], x: cell.x, y: cell.y }; }
            else if (k === 'exit') { d.exits = [...d.exits]; d.exits[selectedSpawn.index] = { ...d.exits[selectedSpawn.index], x: cell.x, y: cell.y }; }
            return d;
          });
          onSelectSpawn(null);
        }
      } else if (hit) {
        onSelectSpawn(hit);
      }
    }
  }, [tool, selectedTile, spawnMode, spawnEntityType, updateDungeon, monsters, npcs, items, selectedSpawn, onSelectSpawn, dungeon]);

  // --- Mouse events ---
  const onPointerDown = (e) => {
    const st = stateRef.current;
    // Right-click or two-finger = pan
    if (e.button === 1 || e.button === 2 || e.ctrlKey || e.metaKey) {
      st.isPanning = true;
      st.lastPanX = e.clientX;
      st.lastPanY = e.clientY;
      e.preventDefault();
      return;
    }
    if (tool === 'spawn' || tool === 'move') {
      // Single tap for spawns and move
      const cell = screenToCell(e.clientX, e.clientY);
      applyTool(cell);
    } else {
      onStrokeStart();
      st.isPainting = true;
      const cell = screenToCell(e.clientX, e.clientY);
      applyTool(cell);
    }
  };

  const onPointerMove = (e) => {
    const st = stateRef.current;
    if (st.isPanning) {
      st.offsetX += e.clientX - st.lastPanX;
      st.offsetY += e.clientY - st.lastPanY;
      st.lastPanX = e.clientX;
      st.lastPanY = e.clientY;
      draw();
      return;
    }
    if (st.isPainting && tool !== 'spawn' && tool !== 'move') {
      const cell = screenToCell(e.clientX, e.clientY);
      applyTool(cell);
    }
  };

  const onPointerUp = () => {
    const st = stateRef.current;
    if (st.isPainting) onStrokeEnd();
    st.isPanning = false;
    st.isPainting = false;
  };

  // --- Touch events (pinch zoom + two-finger pan) ---
  const onTouchStart = (e) => {
    const st = stateRef.current;
    if (e.touches.length === 2) {
      e.preventDefault();
      st.isPanning = true;
      st.isPainting = false;
      const t0 = e.touches[0], t1 = e.touches[1];
      st.pinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      st.lastPanX = (t0.clientX + t1.clientX) / 2;
      st.lastPanY = (t0.clientY + t1.clientY) / 2;
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (tool === 'spawn' || tool === 'move') {
        const cell = screenToCell(t.clientX, t.clientY);
        applyTool(cell);
      } else {
        onStrokeStart();
        st.isPainting = true;
        const cell = screenToCell(t.clientX, t.clientY);
        applyTool(cell);
      }
    }
  };

  const onTouchMove = (e) => {
    const st = stateRef.current;
    if (e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;

      // Zoom
      if (st.pinchDist > 0) {
        const zoomFactor = dist / st.pinchDist;
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = midX - rect.left;
        const cy = midY - rect.top;
        const newScale = Math.max(0.3, Math.min(5, st.scale * zoomFactor));
        st.offsetX = cx - (cx - st.offsetX) * (newScale / st.scale);
        st.offsetY = cy - (cy - st.offsetY) * (newScale / st.scale);
        st.scale = newScale;
      }
      st.pinchDist = dist;

      // Pan
      st.offsetX += midX - st.lastPanX;
      st.offsetY += midY - st.lastPanY;
      st.lastPanX = midX;
      st.lastPanY = midY;
      draw();
      return;
    }
    if (e.touches.length === 1 && st.isPainting && tool !== 'spawn' && tool !== 'move') {
      const t = e.touches[0];
      const cell = screenToCell(t.clientX, t.clientY);
      applyTool(cell);
    }
  };

  const onTouchEnd = (e) => {
    if (e.touches.length < 2) {
      stateRef.current.isPanning = false;
      stateRef.current.pinchDist = 0;
    }
    if (e.touches.length === 0) {
      if (stateRef.current.isPainting) onStrokeEnd();
      stateRef.current.isPainting = false;
    }
  };

  // --- Wheel zoom ---
  const onWheel = (e) => {
    e.preventDefault();
    const st = stateRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.3, Math.min(5, st.scale * zoomFactor));
    st.offsetX = cx - (cx - st.offsetX) * (newScale / st.scale);
    st.offsetY = cy - (cy - st.offsetY) * (newScale / st.scale);
    st.scale = newScale;
    draw();
  };

  // --- Double-click to open NPC/item editor ---
  const onDblClick = (e) => {
    const cell = screenToCell(e.clientX, e.clientY);
    if (!cell) return;
    const hit = findSpawnAt(dungeon, cell.x, cell.y);
    if (!hit) return;
    if (hit.kind === 'npc') {
      const spawn = dungeon.npcSpawns[hit.index];
      if (spawn && onEditNPC) onEditNPC(spawn.type);
    } else if (hit.kind === 'item') {
      const spawn = (dungeon.itemSpawns || [])[hit.index];
      if (spawn && onEditItem) onEditItem(spawn.type);
    }
  };

  return html`
    <div class="canvas-wrap" ref=${wrapRef}
      onContextMenu=${e => e.preventDefault()}>
      <canvas ref=${canvasRef}
        onPointerDown=${onPointerDown}
        onPointerMove=${onPointerMove}
        onPointerUp=${onPointerUp}
        onPointerLeave=${onPointerUp}
        onDblClick=${onDblClick}
        onTouchStart=${onTouchStart}
        onTouchMove=${onTouchMove}
        onTouchEnd=${onTouchEnd}
        onWheel=${onWheel}
        style="touch-action:none"
      />
    </div>
  `;
}

// ─── Isometric Preview ──────────────────────────────────────
function IsoPreview({ dungeon, tiles }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  // Iso constants (match game renderer exactly)
  const DW = 96, DH = 48, WALL_RISE = 30;
  const HW = DW / 2, HH = DH / 2;

  const tileToIsoKey = {
    'stone_floor':   'floor',
    'cracked_floor': 'floor2',
    'door_open':     'door_open',
    'stairs_down':   'stairs_down',
    'stairs_up':     'stairs_up',
    'stone_wall':    'wall',
    'void':          'wall',
    'door_closed':   'door_closed',
    'locked_door':   'locked_door',
    'water':         'water',
  };

  const wallKeys = new Set(['wall', 'door_closed', 'locked_door']);

  const tileToIso = (tx, ty) => ({
    x: (tx - ty) * HW,
    y: (tx + ty) * HH,
  });

  // --- Procedural tile drawing functions ---
  const drawDiamond = (ctx, cx, cy) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - HH);
    ctx.lineTo(cx + HW, cy);
    ctx.lineTo(cx, cy + HH);
    ctx.lineTo(cx - HW, cy);
    ctx.closePath();
  };

  const drawFloor = (ctx, cx, cy) => {
    drawDiamond(ctx, cx, cy);
    ctx.fillStyle = '#2a2a3d';
    ctx.fill();
    drawDiamond(ctx, cx, cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  };

  const drawFloor2 = (ctx, cx, cy) => {
    drawDiamond(ctx, cx, cy);
    ctx.fillStyle = '#2a2a3d';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 3);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.moveTo(cx + 8, cy - 6);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.stroke();
  };

  const drawWater = (ctx, cx, cy) => {
    drawDiamond(ctx, cx, cy);
    ctx.fillStyle = '#1a3a6a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const wy = cy + i * 6;
      ctx.moveTo(cx - 20 + i * 4, wy);
      ctx.quadraticCurveTo(cx - 5, wy - 3, cx + 10 + i * 2, wy);
    }
    ctx.stroke();
  };

  const drawStairsDown = (ctx, cx, cy) => {
    drawDiamond(ctx, cx, cy);
    ctx.fillStyle = '#4a2a6a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = -2; i <= 2; i++) {
      const y = cy + i * 5;
      const xSpan = HW * (1 - Math.abs(i) * 0.25);
      ctx.beginPath();
      ctx.moveTo(cx - xSpan * 0.6, y);
      ctx.lineTo(cx + xSpan * 0.6, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx + 8, cy - 4);
    ctx.stroke();
  };

  const drawStairsUp = (ctx, cx, cy) => {
    drawDiamond(ctx, cx, cy);
    ctx.fillStyle = '#2a6a4a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = -2; i <= 2; i++) {
      const y = cy + i * 5;
      const xSpan = HW * (1 - Math.abs(i) * 0.25);
      ctx.beginPath();
      ctx.moveTo(cx - xSpan * 0.6, y);
      ctx.lineTo(cx + xSpan * 0.6, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 4);
    ctx.lineTo(cx, cy - 4);
    ctx.lineTo(cx + 8, cy + 4);
    ctx.stroke();
  };

  const drawDoorOpen = (ctx, cx, cy) => {
    drawDiamond(ctx, cx, cy);
    ctx.fillStyle = '#4a3a2a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,140,80,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx, cy - 8);
    ctx.lineTo(cx + 16, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx + 16, cy);
    ctx.stroke();
  };

  const drawWallBlock = (ctx, cx, cy, topColor, leftColor, rightColor) => {
    // Top diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - HH);
    ctx.lineTo(cx + HW, cy);
    ctx.lineTo(cx, cy + HH);
    ctx.lineTo(cx - HW, cy);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    // Left face
    ctx.beginPath();
    ctx.moveTo(cx - HW, cy);
    ctx.lineTo(cx, cy + HH);
    ctx.lineTo(cx, cy + HH + WALL_RISE);
    ctx.lineTo(cx - HW, cy + WALL_RISE);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();
    // Right face
    ctx.beginPath();
    ctx.moveTo(cx, cy + HH);
    ctx.lineTo(cx + HW, cy);
    ctx.lineTo(cx + HW, cy + WALL_RISE);
    ctx.lineTo(cx, cy + HH + WALL_RISE);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();
    // Edge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - HH);
    ctx.lineTo(cx + HW, cy);
    ctx.lineTo(cx + HW, cy + WALL_RISE);
    ctx.moveTo(cx - HW, cy);
    ctx.lineTo(cx - HW, cy + WALL_RISE);
    ctx.lineTo(cx, cy + HH + WALL_RISE);
    ctx.lineTo(cx + HW, cy + WALL_RISE);
    ctx.stroke();
  };

  const drawWall = (ctx, cx, cy) => {
    drawWallBlock(ctx, cx, cy, '#5a5a7a', '#4a4a6a', '#3a3a5a');
  };

  const drawDoorClosed = (ctx, cx, cy) => {
    drawWallBlock(ctx, cx, cy, '#8b7a50', '#7a6a40', '#6a5a30');
    // Arch detail
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy + HH + WALL_RISE * 0.3, WALL_RISE * 0.35, Math.PI, 0);
    ctx.stroke();
  };

  const drawLockedDoor = (ctx, cx, cy) => {
    drawWallBlock(ctx, cx, cy, '#6a5a3a', '#5a4a2a', '#4a3a1a');
    // Arch
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy + HH + WALL_RISE * 0.3, WALL_RISE * 0.35, Math.PI, 0);
    ctx.stroke();
    // Lock rectangle
    ctx.fillStyle = 'rgba(200,160,60,0.6)';
    ctx.fillRect(cx - 4, cy + HH + WALL_RISE * 0.4, 8, 8);
  };

  const tileDraw = {
    floor: drawFloor,
    floor2: drawFloor2,
    water: drawWater,
    stairs_down: drawStairsDown,
    stairs_up: drawStairsUp,
    door_open: drawDoorOpen,
    wall: drawWall,
    door_closed: drawDoorClosed,
    locked_door: drawLockedDoor,
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dungeon) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const W = dungeon.width, H = dungeon.height;

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const p = tileToIso(tx, ty);
        const left = p.x - HW;
        const top = p.y - HH;
        const right = p.x + HW;
        const bottom = p.y + HH + WALL_RISE;
        if (left < minX) minX = left;
        if (top < minY) minY = top;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
      }
    }

    const mapW = maxX - minX;
    const mapH = maxY - minY;
    const fitScale = Math.min(cw / mapW, ch / mapH) * 0.9;
    const offX = (cw - mapW * fitScale) / 2 - minX * fitScale;
    const offY = (ch - mapH * fitScale) / 2 - minY * fitScale;

    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(fitScale, fitScale);

    // Diagonal-order iteration (back to front)
    for (let sum = 0; sum < W + H - 1; sum++) {
      for (let tx = Math.max(0, sum - H + 1); tx <= Math.min(sum, W - 1); tx++) {
        const ty = sum - tx;
        const tileId = dungeon.data[ty * W + tx];
        const tileDef = tiles[tileId];
        const tileName = tileDef ? tileDef.name : 'void';
        const isoKey = tileToIsoKey[tileName] || 'wall';

        const p = tileToIso(tx, ty);
        const fn = tileDraw[isoKey] || drawWall;
        fn(ctx, p.x, p.y);
      }
    }

    // Draw spawn markers
    const drawIsoMarker = (tx, ty, color) => {
      const p = tileToIso(tx, ty);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, DW * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    for (const s of dungeon.spawns) drawIsoMarker(s.x, s.y, SPAWN_COLORS.player_start);
    for (const s of dungeon.monsterSpawns) drawIsoMarker(s.x, s.y, SPAWN_COLORS.monster);
    for (const s of dungeon.npcSpawns) drawIsoMarker(s.x, s.y, SPAWN_COLORS.npc);
    if (dungeon.itemSpawns) {
      for (const s of dungeon.itemSpawns) drawIsoMarker(s.x, s.y, SPAWN_COLORS.item);
    }
    for (const s of dungeon.exits) drawIsoMarker(s.x, s.y, SPAWN_COLORS.exit);

    ctx.restore();
  }, [dungeon, tiles]);

  // Resize canvas
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw, dungeon]);

  return html`
    <div class="iso-preview-wrap" ref=${wrapRef}>
      <div class="iso-preview-label">Isometric Preview</div>
      <canvas ref=${canvasRef} />
    </div>
  `;
}

// ─── Raw JSON Toggle (shared) ──────────────────────────────

function RawJsonToggle({ data, onApply }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const toggle = () => {
    if (!open) setText(JSON.stringify(data, null, 2));
    setOpen(v => !v);
  };

  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      onApply(parsed);
      showToast('JSON applied', 'success');
      setOpen(false);
    } catch { showToast('Invalid JSON', 'error'); }
  };

  return html`
    <div class="raw-json-toggle">
      <button class="raw-json-toggle-btn" onClick=${toggle}>${open ? 'Hide' : 'Show'} Raw JSON</button>
      ${open && html`
        <textarea class="raw-json-textarea" rows="12" value=${text}
          onInput=${e => setText(e.target.value)} />
        <button class="tool-btn" style="margin-top:4px;border-color:var(--accent);align-self:flex-end" onClick=${apply}>Apply JSON</button>
      `}
    </div>
  `;
}

// ─── Trigger Editor Components ─────────────────────────────

function RawJsonActionFields({ action, onChange }) {
  const [text, setText] = useState(() => {
    const { type, ...rest } = action;
    return JSON.stringify(rest, null, 2);
  });
  const apply = (val) => {
    setText(val);
    try {
      const parsed = JSON.parse(val);
      onChange({ ...parsed, type: action.type });
    } catch { /* invalid JSON, ignore until valid */ }
  };
  return html`
    <textarea class="trigger-conditions-textarea" rows="4" value=${text}
      onInput=${e => apply(e.target.value)} />
  `;
}

// Collect all flag names from an array of triggers (actions + conditions)
function collectFlagNames(triggers) {
  const flags = new Set();
  const scanConditions = (cond) => {
    if (!cond) return;
    if (Array.isArray(cond)) { cond.forEach(scanConditions); return; }
    if (cond.hasFlag) flags.add(cond.hasFlag);
    if (cond.flag) flags.add(cond.flag);
    if (cond.flagGreaterThan && cond.flagGreaterThan.flag) flags.add(cond.flagGreaterThan.flag);
    if (cond.not) scanConditions(cond.not);
    if (cond.condition) scanConditions(cond.condition);
    if (cond.all) cond.all.forEach(scanConditions);
    if (cond.any) cond.any.forEach(scanConditions);
  };
  for (const t of triggers) {
    scanConditions(t.conditions);
    for (const a of (t.actions || [])) {
      if (a.flag) flags.add(a.flag);
    }
    // Also check filter for flag references
    if (t.filter && t.filter.flag) flags.add(t.filter.flag);
  }
  return [...flags].sort();
}

function ActionFields({ action, onChange, knownFlags }) {
  const set = (field, value) => onChange({ ...action, [field]: value });

  switch (action.type) {
    case 'showMessage': {
      const isMulti = Array.isArray(action.lines);
      if (isMulti) {
        return html`
          <div>
            <button class="tool-btn" style="margin-bottom:4px;font-size:11px"
              onClick=${() => { const { lines, ...rest } = action; onChange({ ...rest, text: lines.join('\n') }); }}>
              Switch to single text</button>
            ${action.lines.map((line, i) => html`
              <div style="display:flex;gap:4px;margin-bottom:4px" key=${i}>
                <input style="flex:1" value=${line} onInput=${e => {
                  const copy = [...action.lines];
                  copy[i] = e.target.value;
                  onChange({ ...action, lines: copy });
                }} />
                <button class="spawn-remove" onClick=${() => {
                  const copy = action.lines.filter((_, j) => j !== i);
                  onChange({ ...action, lines: copy });
                }}>×</button>
              </div>
            `)}
            <button class="tool-btn" style="font-size:11px;border-color:var(--accent)"
              onClick=${() => onChange({ ...action, lines: [...action.lines, ''] })}>+ Line</button>
          </div>
        `;
      }
      return html`
        <div>
          <button class="tool-btn" style="margin-bottom:4px;font-size:11px"
            onClick=${() => { const { text, ...rest } = action; onChange({ ...rest, lines: [text || ''] }); }}>
            Switch to multi-line</button>
          <textarea class="trigger-conditions-textarea" rows="2" value=${action.text || ''}
            onInput=${e => set('text', e.target.value)} />
        </div>
      `;
    }
    case 'setFlag':
      return html`
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <div class="field" style="flex:2"><label>Flag</label>
            <input list="known-flags" value=${action.flag || ''} onInput=${e => set('flag', e.target.value)} placeholder="type or select flag" /></div>
          <div class="field" style="flex:1"><label>Value</label>
            <input value=${action.value != null ? action.value : ''} onInput=${e => set('value', e.target.value)} /></div>
          <div class="field" style="flex:1"><label>Scope</label>
            <select value=${action.scope || 'player'} onChange=${e => set('scope', e.target.value)}>
              <option value="player">player</option><option value="room">room</option><option value="global">global</option>
            </select></div>
        </div>
      `;
    case 'removeFlag':
      return html`
        <div style="display:flex;gap:6px">
          <div class="field" style="flex:2"><label>Flag</label>
            <input list="known-flags" value=${action.flag || ''} onInput=${e => set('flag', e.target.value)} placeholder="type or select flag" /></div>
          <div class="field" style="flex:1"><label>Scope</label>
            <select value=${action.scope || 'player'} onChange=${e => set('scope', e.target.value)}>
              <option value="player">player</option><option value="room">room</option><option value="global">global</option>
            </select></div>
        </div>
      `;
    case 'incrementFlag':
      return html`
        <div style="display:flex;gap:6px">
          <div class="field" style="flex:2"><label>Flag</label>
            <input list="known-flags" value=${action.flag || ''} onInput=${e => set('flag', e.target.value)} placeholder="type or select flag" /></div>
          <div class="field" style="flex:1"><label>Amount</label>
            <input type="number" value=${action.amount != null ? action.amount : 1} onInput=${e => set('amount', Number(e.target.value))} /></div>
        </div>
      `;
    case 'giveItem':
    case 'removeItem':
    case 'equipItem':
      return html`
        <div class="field"><label>Item Type</label>
          <input value=${action.itemType || ''} onInput=${e => set('itemType', e.target.value)} /></div>
      `;
    case 'spawnItem':
      return html`
        <div style="display:flex;gap:6px">
          <div class="field" style="flex:2"><label>Item Type</label>
            <input value=${action.itemType || ''} onInput=${e => set('itemType', e.target.value)} /></div>
          <div class="field" style="flex:1"><label>X</label>
            <input type="number" value=${action.x || 0} onInput=${e => set('x', Number(e.target.value))} /></div>
          <div class="field" style="flex:1"><label>Y</label>
            <input type="number" value=${action.y || 0} onInput=${e => set('y', Number(e.target.value))} /></div>
        </div>
      `;
    case 'toggleTile':
      return html`
        <div style="display:flex;gap:6px">
          <div class="field" style="flex:1"><label>X</label>
            <input type="number" value=${action.x || 0} onInput=${e => set('x', Number(e.target.value))} /></div>
          <div class="field" style="flex:1"><label>Y</label>
            <input type="number" value=${action.y || 0} onInput=${e => set('y', Number(e.target.value))} /></div>
        </div>
      `;
    case 'removeEntity': {
      const etype = action.entityType || 'npc';
      return html`
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <div class="field" style="flex:1"><label>Entity Type</label>
            <select value=${etype} onChange=${e => {
              const newType = e.target.value;
              const base = { type: 'removeEntity', entityType: newType };
              if (newType === 'npc') base.npcType = action.npcType || '';
              else if (newType === 'monster') base.monsterType = action.monsterType || '';
              else if (newType === 'item') base.itemType = action.itemType || '';
              onChange(base);
            }}>
              <option value="npc">npc</option><option value="monster">monster</option><option value="item">item</option>
            </select></div>
          <div class="field" style="flex:2"><label>${etype === 'npc' ? 'NPC Type' : etype === 'monster' ? 'Monster Type' : 'Item Type'}</label>
            <input value=${action[etype + 'Type'] || action.entityId || ''}
              onInput=${e => set(etype === 'npc' ? 'npcType' : etype === 'monster' ? 'monsterType' : 'itemType', e.target.value)} /></div>
        </div>
      `;
    }
    case 'setDialogue':
      return html`
        <div style="display:flex;gap:6px">
          <div class="field" style="flex:1"><label>NPC Type</label>
            <input value=${action.npc || ''} onInput=${e => set('npc', e.target.value)} /></div>
          <div class="field" style="flex:1"><label>Dialogue ID</label>
            <input value=${action.dialogueId || ''} onInput=${e => set('dialogueId', e.target.value)} /></div>
        </div>
      `;
    case 'setQuestObjective':
      return html`
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <div class="field" style="flex:2"><label>Label</label>
            <input value=${action.label || ''} onInput=${e => set('label', e.target.value)} /></div>
          <div class="field" style="flex:2"><label>Room ID</label>
            <input value=${action.roomId || ''} onInput=${e => set('roomId', e.target.value)} /></div>
          <div class="field" style="flex:1"><label>Tile X</label>
            <input type="number" value=${action.tileX || 0} onInput=${e => set('tileX', Number(e.target.value))} /></div>
          <div class="field" style="flex:1"><label>Tile Y</label>
            <input type="number" value=${action.tileY || 0} onInput=${e => set('tileY', Number(e.target.value))} /></div>
        </div>
      `;
    case 'clearQuestObjective':
      return html`<div style="font-size:11px;color:var(--text-dim);padding:4px 0">No parameters</div>`;
    default:
      return html`<${RawJsonActionFields} action=${action} onChange=${onChange} />`;
  }
}

function ActionListEditor({ actions, scriptRef, onChange, knownFlags }) {
  const actionTypes = (scriptRef && scriptRef.actionTypes) || [];
  const update = (idx, newAction) => {
    const copy = [...actions];
    copy[idx] = newAction;
    onChange(copy);
  };
  const remove = (idx) => onChange(actions.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const copy = [...actions];
    const target = idx + dir;
    if (target < 0 || target >= copy.length) return;
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onChange(copy);
  };
  const add = () => onChange([...actions, { type: 'showMessage', text: '' }]);

  return html`
    <div>
      <span class="trigger-section-label">Actions</span>
      <datalist id="known-flags">
        ${(knownFlags || []).map(f => html`<option key=${f} value=${f} />`)}
      </datalist>
      <div class="trigger-action-list">
        ${actions.map((action, idx) => html`
          <div class="trigger-action-card" key=${idx}>
            <div class="trigger-action-header">
              <select value=${action.type} onChange=${e => {
                const newType = e.target.value;
                update(idx, { type: newType });
              }}>
                ${actionTypes.map(at => html`<option key=${at.id} value=${at.id}>${at.id}</option>`)}
                ${!actionTypes.find(at => at.id === action.type) && html`<option value=${action.type}>${action.type}</option>`}
              </select>
              <button class="trigger-action-move" onClick=${() => move(idx, -1)} title="Move up">↑</button>
              <button class="trigger-action-move" onClick=${() => move(idx, 1)} title="Move down">↓</button>
              <button class="spawn-remove" onClick=${() => remove(idx)}>×</button>
            </div>
            <${ActionFields} action=${action} onChange=${(a) => update(idx, a)} knownFlags=${knownFlags} />
          </div>
        `)}
      </div>
      <button class="tool-btn" style="margin-top:6px;border-color:var(--accent)" onClick=${add}>+ Add Action</button>
    </div>
  `;
}

function FilterEditor({ filter, eventType, scriptRef, onChange }) {
  const events = (scriptRef && scriptRef.events) || [];
  const ev = events.find(e => e.id === eventType);
  const fields = ev ? ev.payloadFields : [];
  if (!fields.length) return html`<div style="font-size:11px;color:var(--text-dim)">No filter fields for this event</div>`;

  return html`
    <div class="trigger-filter-row">
      ${fields.map(f => html`
        <div class="field" style="flex:1;min-width:120px" key=${f}>
          <label>${f}</label>
          <input value=${(filter && filter[f]) || ''}
            onInput=${e => {
              const copy = { ...(filter || {}) };
              if (e.target.value) copy[f] = e.target.value;
              else delete copy[f];
              onChange(Object.keys(copy).length ? copy : null);
            }} />
        </div>
      `)}
    </div>
  `;
}

function TriggerEditorModal({ dungeonId, onClose }) {
  const [triggers, setTriggers] = useState(null);
  const [scriptRef, setScriptRef] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [conditionsText, setConditionsText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.getTriggers(dungeonId), api.getScriptingReference()])
      .then(([t, sr]) => {
        const trigs = Array.isArray(t) ? t : [];
        setTriggers(trigs);
        setScriptRef(sr);
        if (trigs.length > 0) {
          setConditionsText(trigs[0].conditions ? JSON.stringify(trigs[0].conditions, null, 2) : '');
        }
      })
      .catch(() => showToast('Failed to load triggers', 'error'));
  }, [dungeonId]);

  if (!triggers || !scriptRef) return html`
    <div class="modal-overlay"><div class="modal trigger-editor-modal">
      <p style="text-align:center;color:var(--text-dim);padding:20px">Loading...</p>
    </div></div>`;

  const current = triggers[selectedIdx] || null;

  const selectTrigger = (idx) => {
    setSelectedIdx(idx);
    const t = triggers[idx];
    setConditionsText(t && t.conditions ? JSON.stringify(t.conditions, null, 2) : '');
  };

  const updateTrigger = (updater) => {
    setTriggers(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[selectedIdx]) updater(copy[selectedIdx]);
      return copy;
    });
  };

  const addTrigger = () => {
    const id = 'new_trigger_' + Date.now();
    const newTrig = { id, event: 'room_entered', actions: [] };
    setTriggers(prev => [...prev, newTrig]);
    setSelectedIdx(triggers.length);
    setConditionsText('');
  };

  const removeTrigger = (idx) => {
    setTriggers(prev => prev.filter((_, i) => i !== idx));
    if (selectedIdx >= triggers.length - 1) {
      const newIdx = Math.max(0, triggers.length - 2);
      setSelectedIdx(newIdx);
      const t = triggers[newIdx === idx ? (newIdx > 0 ? newIdx - 1 : 0) : newIdx];
      setConditionsText(t && t.conditions ? JSON.stringify(t.conditions, null, 2) : '');
    }
  };

  const save = async () => {
    // Validate conditions JSON before saving
    if (conditionsText.trim()) {
      try { JSON.parse(conditionsText); }
      catch { showToast('Invalid conditions JSON', 'error'); return; }
    }
    // Apply conditions text to current trigger
    const toSave = JSON.parse(JSON.stringify(triggers));
    if (toSave[selectedIdx]) {
      if (conditionsText.trim()) {
        toSave[selectedIdx].conditions = JSON.parse(conditionsText);
      } else {
        delete toSave[selectedIdx].conditions;
      }
    }
    setSaving(true);
    try {
      const result = await api.saveTriggers(dungeonId, toSave);
      setTriggers(Array.isArray(result) ? result : toSave);
      showToast('Triggers saved!', 'success');
      onClose();
    } catch { showToast('Save failed', 'error'); }
    setSaving(false);
  };

  return html`
    <div class="modal-overlay" onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="modal trigger-editor-modal">
        <h2>Edit Triggers</h2>

        <div class="entity-tabs">
          ${triggers.map((t, idx) => html`
            <button key=${idx} class="entity-tab ${idx === selectedIdx ? 'selected' : ''}"
              onClick=${() => selectTrigger(idx)}>
              ${t.id}
              <span class="entity-tab-remove" onClick=${(e) => { e.stopPropagation(); removeTrigger(idx); }}>×</span>
            </button>
          `)}
        </div>

        <div class="entity-add-row">
          <button class="primary" onClick=${addTrigger} style="width:100%">+ Add Trigger</button>
        </div>

        ${current && html`
          <div class="field">
            <label>ID</label>
            <input value=${current.id} onInput=${e => updateTrigger(t => { t.id = e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''); })} />
          </div>

          <div style="display:flex;gap:8px">
            <div class="field" style="flex:2">
              <label>Event</label>
              <select value=${current.event} onChange=${e => updateTrigger(t => { t.event = e.target.value; })}>
                ${scriptRef.events.map(ev => html`<option key=${ev.id} value=${ev.id}>${ev.id}</option>`)}
              </select>
            </div>
            <div class="field" style="flex:0 0 auto;display:flex;align-items:end;gap:4px;padding-bottom:2px">
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
                <input type="checkbox" checked=${!!current.once}
                  onChange=${e => updateTrigger(t => { if (e.target.checked) t.once = true; else delete t.once; })} />
                Once
              </label>
            </div>
          </div>

          <div>
            <span class="trigger-section-label">Filter</span>
            <${FilterEditor} filter=${current.filter || null} eventType=${current.event}
              scriptRef=${scriptRef} onChange=${(f) => updateTrigger(t => { if (f) t.filter = f; else delete t.filter; })} />
          </div>

          <div>
            <span class="trigger-section-label">Conditions (JSON)</span>
            <div class="condition-insert-row">
              <datalist id="condition-flags">
                ${collectFlagNames(triggers).map(f => html`<option key=${f} value=${f} />`)}
              </datalist>
              <input id="condition-flag-input" list="condition-flags" style="flex:1;font-size:11px"
                placeholder="type or select flag name" />
              <button class="tool-btn" style="font-size:11px;padding:2px 8px" onClick=${() => {
                const inp = document.getElementById('condition-flag-input');
                const flag = inp ? inp.value.trim() : '';
                if (!flag) return;
                const snippet = JSON.stringify({ hasFlag: flag });
                const existing = conditionsText.trim();
                if (!existing) {
                  setConditionsText('[\n  ' + snippet + '\n]');
                } else {
                  try {
                    const parsed = JSON.parse(existing);
                    const arr = Array.isArray(parsed) ? parsed : [parsed];
                    arr.push({ hasFlag: flag });
                    setConditionsText(JSON.stringify(arr, null, 2));
                  } catch {
                    setConditionsText(existing + '\n' + snippet);
                  }
                }
                inp.value = '';
              }}>+ hasFlag</button>
              <button class="tool-btn" style="font-size:11px;padding:2px 8px" onClick=${() => {
                const inp = document.getElementById('condition-flag-input');
                const flag = inp ? inp.value.trim() : '';
                if (!flag) return;
                const snippet = { not: { hasFlag: flag } };
                const existing = conditionsText.trim();
                if (!existing) {
                  setConditionsText('[\n  ' + JSON.stringify(snippet) + '\n]');
                } else {
                  try {
                    const parsed = JSON.parse(existing);
                    const arr = Array.isArray(parsed) ? parsed : [parsed];
                    arr.push(snippet);
                    setConditionsText(JSON.stringify(arr, null, 2));
                  } catch {
                    setConditionsText(existing + '\n' + JSON.stringify(snippet));
                  }
                }
                inp.value = '';
              }}>+ not hasFlag</button>
            </div>
            <textarea class="trigger-conditions-textarea" rows="4"
              value=${conditionsText}
              onInput=${e => setConditionsText(e.target.value)} />
          </div>

          <${ActionListEditor} actions=${current.actions || []} scriptRef=${scriptRef}
            knownFlags=${collectFlagNames(triggers)}
            onChange=${(a) => updateTrigger(t => { t.actions = a; })} />
        `}

        <${RawJsonToggle} data=${triggers} onApply=${(parsed) => {
          if (!Array.isArray(parsed)) { showToast('Triggers must be an array', 'error'); return; }
          setTriggers(parsed);
          if (parsed[selectedIdx]) {
            setConditionsText(parsed[selectedIdx].conditions ? JSON.stringify(parsed[selectedIdx].conditions, null, 2) : '');
          }
        }} />

        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Entity Section (sidebar) ──────────────────────────────
function EntitySection({ onEditNPCs, onEditItems, onEditTriggers }) {
  return html`
    <div class="panel-section">
      <h3>Entities</h3>
      <div class="tool-bar">
        <button class="tool-btn" onClick=${onEditNPCs}
          style="border-color:${SPAWN_COLORS.npc}">Edit NPCs</button>
        <button class="tool-btn" onClick=${onEditItems}
          style="border-color:${SPAWN_COLORS.item}">Edit Items</button>
        <button class="tool-btn" onClick=${onEditTriggers}
          style="border-color:var(--warning)">Edit Triggers</button>
      </div>
    </div>
  `;
}

// ─── NPC Editor Modal ──────────────────────────────────────
function NPCEditorModal({ npcs, setNPCs, onClose, initialSelectedId }) {
  const [localNPCs, setLocalNPCs] = useState(JSON.parse(JSON.stringify(npcs)));
  const [selectedId, setSelectedId] = useState(initialSelectedId && npcs[initialSelectedId] ? initialSelectedId : Object.keys(npcs)[0] || '');
  const [newId, setNewId] = useState('');
  const [saving, setSaving] = useState(false);

  const npcIds = Object.keys(localNPCs);
  const current = selectedId ? localNPCs[selectedId] : null;

  const updateCurrent = (updater) => {
    setLocalNPCs(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[selectedId]) {
        updater(copy[selectedId]);
      }
      return copy;
    });
  };

  const addNPC = () => {
    const id = newId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id || localNPCs[id]) return;
    setLocalNPCs(prev => ({
      ...prev,
      [id]: { name: id, dialogue: [{ speaker: id, text: 'Hello, traveler.' }] }
    }));
    setSelectedId(id);
    setNewId('');
  };

  const removeNPC = (id) => {
    setLocalNPCs(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (selectedId === id) setSelectedId(Object.keys(localNPCs).find(k => k !== id) || '');
  };

  const updateDialogueLine = (idx, field, value) => {
    updateCurrent(npc => { npc.dialogue[idx][field] = value; });
  };

  const addDialogueLine = () => {
    updateCurrent(npc => {
      npc.dialogue.push({ speaker: current.name, text: '' });
    });
  };

  const removeDialogueLine = (idx) => {
    updateCurrent(npc => { npc.dialogue.splice(idx, 1); });
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.saveNPCs(localNPCs);
      setNPCs(result);
      showToast('NPCs saved!', 'success');
      onClose();
    } catch { showToast('Save failed', 'error'); }
    setSaving(false);
  };

  return html`
    <div class="modal-overlay" onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="modal entity-editor-modal">
        <h2>Edit NPCs</h2>

        <div class="entity-tabs">
          ${npcIds.map(id => html`
            <button key=${id} class="entity-tab ${id === selectedId ? 'selected' : ''}"
              onClick=${() => setSelectedId(id)}>
              ${localNPCs[id].name}
              <span class="entity-tab-remove" onClick=${(e) => { e.stopPropagation(); removeNPC(id); }}>×</span>
            </button>
          `)}
        </div>

        <div class="entity-add-row">
          <input value=${newId} onInput=${e => setNewId(e.target.value)} placeholder="new_npc_id" style="flex:1" />
          <button class="primary" onClick=${addNPC} style="width:60px">Add</button>
        </div>

        ${current && html`
          <div class="field">
            <label>Name</label>
            <input value=${current.name} onInput=${e => updateCurrent(npc => { npc.name = e.target.value; })} />
          </div>

          <div class="dialogue-list">
            <label style="font-size:12px;color:var(--text-dim);margin-bottom:4px;display:block">Dialogue Lines</label>
            ${(current.dialogue || []).map((line, idx) => html`
              <div class="dialogue-line" key=${idx}>
                <input class="dialogue-speaker" value=${line.speaker}
                  onInput=${e => updateDialogueLine(idx, 'speaker', e.target.value)}
                  placeholder="Speaker" />
                <textarea class="dialogue-text" value=${line.text}
                  onInput=${e => updateDialogueLine(idx, 'text', e.target.value)}
                  placeholder="Dialogue text..." rows="2" />
                <button class="spawn-remove" onClick=${() => removeDialogueLine(idx)}>×</button>
              </div>
            `)}
            <button class="tool-btn" onClick=${addDialogueLine} style="margin-top:4px;border-color:var(--accent)">+ Add Line</button>
          </div>
        `}

        <${RawJsonToggle} data=${localNPCs} onApply=${(parsed) => {
          if (typeof parsed !== 'object' || Array.isArray(parsed)) { showToast('NPCs must be an object', 'error'); return; }
          setLocalNPCs(parsed);
          if (!parsed[selectedId]) setSelectedId(Object.keys(parsed)[0] || '');
        }} />

        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Item Editor Modal ─────────────────────────────────────
function ItemEditorModal({ items, setItems, onClose, initialSelectedId }) {
  const [localItems, setLocalItems] = useState(JSON.parse(JSON.stringify(items)));
  const [selectedId, setSelectedId] = useState(initialSelectedId && items[initialSelectedId] ? initialSelectedId : Object.keys(items)[0] || '');
  const [newId, setNewId] = useState('');
  const [saving, setSaving] = useState(false);

  const itemIds = Object.keys(localItems);
  const current = selectedId ? localItems[selectedId] : null;

  const updateCurrent = (updater) => {
    setLocalItems(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[selectedId]) {
        updater(copy[selectedId]);
      }
      return copy;
    });
  };

  const addItem = () => {
    const id = newId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id || localItems[id]) return;
    setLocalItems(prev => ({
      ...prev,
      [id]: { name: id, description: '', type: 'misc', rarity: 'common' }
    }));
    setSelectedId(id);
    setNewId('');
  };

  const removeItem = (id) => {
    setLocalItems(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (selectedId === id) setSelectedId(Object.keys(localItems).find(k => k !== id) || '');
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.saveItems(localItems);
      setItems(result);
      showToast('Items saved!', 'success');
      onClose();
    } catch { showToast('Save failed', 'error'); }
    setSaving(false);
  };

  return html`
    <div class="modal-overlay" onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="modal entity-editor-modal">
        <h2>Edit Items</h2>

        <div class="entity-tabs">
          ${itemIds.map(id => html`
            <button key=${id} class="entity-tab ${id === selectedId ? 'selected' : ''}"
              onClick=${() => setSelectedId(id)}>
              ${localItems[id].name}
              <span class="entity-tab-remove" onClick=${(e) => { e.stopPropagation(); removeItem(id); }}>×</span>
            </button>
          `)}
        </div>

        <div class="entity-add-row">
          <input value=${newId} onInput=${e => setNewId(e.target.value)} placeholder="new_item_id" style="flex:1" />
          <button class="primary" onClick=${addItem} style="width:60px">Add</button>
        </div>

        ${current && html`
          <div class="field">
            <label>Name</label>
            <input value=${current.name} onInput=${e => updateCurrent(it => { it.name = e.target.value; })} />
          </div>
          <div class="field">
            <label>Description</label>
            <input value=${current.description || ''} onInput=${e => updateCurrent(it => { it.description = e.target.value; })} />
          </div>
          <div class="field-row">
            <div class="field">
              <label>Type</label>
              <select value=${current.type || 'misc'} onChange=${e => updateCurrent(it => { it.type = e.target.value; })}>
                <option value="consumable">consumable</option>
                <option value="weapon">weapon</option>
                <option value="armor">armor</option>
                <option value="accessory">accessory</option>
                <option value="key">key</option>
                <option value="misc">misc</option>
              </select>
            </div>
            <div class="field">
              <label>Rarity</label>
              <select value=${current.rarity || 'common'} onChange=${e => updateCurrent(it => { it.rarity = e.target.value; })}>
                <option value="common">common</option>
                <option value="uncommon">uncommon</option>
                <option value="rare">rare</option>
                <option value="epic">epic</option>
                <option value="legendary">legendary</option>
              </select>
            </div>
          </div>
          ${(current.type === 'weapon' || current.type === 'armor' || current.type === 'accessory') && html`
            <div class="field-row">
              <div class="field">
                <label>Equipment Slot</label>
                <select value=${current.slot || ''} onChange=${e => updateCurrent(it => { it.slot = e.target.value || undefined; })}>
                  <option value="">None</option>
                  <option value="weapon">weapon</option>
                  <option value="armor">armor</option>
                  <option value="accessory">accessory</option>
                </select>
              </div>
              <div class="field">
                <label>Attack Bonus</label>
                <input type="number" value=${(current.stats && current.stats.attackDamage) || 0}
                  onInput=${e => updateCurrent(it => {
                    const v = Number(e.target.value);
                    if (v > 0) { if (!it.stats) it.stats = {}; it.stats.attackDamage = v; }
                    else { if (it.stats) delete it.stats.attackDamage; if (it.stats && Object.keys(it.stats).length === 0) delete it.stats; }
                  })} min="0" />
              </div>
            </div>
          `}
          ${current.type === 'consumable' && html`
            <div class="field">
              <label>Heal Amount</label>
              <input type="number" value=${(current.effect && current.effect.heal) || 0}
                onInput=${e => updateCurrent(it => {
                  const v = Number(e.target.value);
                  if (v > 0) { if (!it.effect) it.effect = {}; it.effect.heal = v; }
                  else { if (it.effect) delete it.effect.heal; if (it.effect && Object.keys(it.effect).length === 0) delete it.effect; }
                })} min="0" />
            </div>
          `}
        `}

        <${RawJsonToggle} data=${localItems} onApply=${(parsed) => {
          if (typeof parsed !== 'object' || Array.isArray(parsed)) { showToast('Items must be an object', 'error'); return; }
          setLocalItems(parsed);
          if (!parsed[selectedId]) setSelectedId(Object.keys(parsed)[0] || '');
        }} />

        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Quest List ─────────────────────────────────────────────
function QuestList({ onOpen, onBack }) {
  const [quests, setQuests] = useState([]);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { api.listQuests().then(setQuests); }, []);

  const createQuest = async (id, name) => {
    const quest = {
      id, name, description: '',
      steps: {
        start: {
          label: 'First step',
          description: '',
          prerequisiteSteps: [],
          objective: { roomId: '', tileX: 0, tileY: 0 },
          completionConditions: []
        }
      },
      startStep: 'start'
    };
    try {
      await api.saveQuest(id, quest);
      showToast('Quest created', 'success');
      setShowNew(false);
      api.listQuests().then(setQuests);
    } catch { showToast('Failed to create quest', 'error'); }
  };

  const deleteQuest = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete quest ' + id + '?')) return;
    try {
      await api.deleteQuest(id);
      showToast('Quest deleted', 'success');
      api.listQuests().then(setQuests);
    } catch { showToast('Failed to delete', 'error'); }
  };

  return html`
    <div class="dungeon-list-page">
      <div class="dungeon-list-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="topbar-btn" onClick=${onBack}>Back</button>
          <h1>Quests</h1>
        </div>
        <button class="topbar-btn primary" onClick=${() => setShowNew(true)}>+ New Quest</button>
      </div>
      <div class="dungeon-cards">
        ${quests.map(q => html`
          <div class="dungeon-card" key=${q.id} onClick=${() => onOpen(q.id)}>
            <div class="dungeon-card-info">
              <h3>${q.name}</h3>
              <p>${q.id} · ${q.stepCount} steps</p>
            </div>
            <button class="topbar-btn" style="margin-left:auto;margin-right:8px;font-size:11px;color:#e57373"
              onClick=${(e) => deleteQuest(q.id, e)}>Delete</button>
            <div class="dungeon-card-arrow">›</div>
          </div>
        `)}
        ${quests.length === 0 && html`<p style="color:var(--text-dim);text-align:center;padding:40px 0;">No quests yet.</p>`}
      </div>
      ${showNew && html`<${NewQuestModal} onCreate=${createQuest} onClose=${() => setShowNew(false)} />`}
    </div>
  `;
}

function NewQuestModal({ onCreate, onClose }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');

  const submit = () => {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId || !name) return;
    onCreate(safeId, name);
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <h2>New Quest</h2>
        <div class="field"><label>ID</label><input value=${id} onInput=${e => setId(e.target.value)} placeholder="my_quest" /></div>
        <div class="field"><label>Name</label><input value=${name} onInput=${e => setName(e.target.value)} placeholder="Quest Name" /></div>
        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${submit}>Create</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Quest Editor ───────────────────────────────────────────
function QuestEditor({ questId, onBack }) {
  const [quest, setQuest] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingStep, setEditingStep] = useState(null);

  useEffect(() => {
    api.getQuest(questId).then(setQuest);
  }, [questId]);

  const updateQuest = (fn) => {
    setQuest(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      fn(copy);
      return copy;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveQuest(quest.id, quest);
      showToast('Quest saved', 'success');
      setDirty(false);
    } catch { showToast('Failed to save', 'error'); }
    setSaving(false);
  };

  const addStep = () => {
    const stepNum = Object.keys(quest.steps).length + 1;
    const stepId = 'step_' + stepNum;
    updateQuest(q => {
      q.steps[stepId] = {
        label: 'New Step',
        description: '',
        prerequisiteSteps: [],
        objective: { roomId: '', tileX: 0, tileY: 0 },
        completionConditions: []
      };
    });
  };

  const deleteStep = (stepId) => {
    updateQuest(q => {
      delete q.steps[stepId];
      // Remove from prerequisites of other steps
      for (const s of Object.values(q.steps)) {
        s.prerequisiteSteps = (s.prerequisiteSteps || []).filter(p => p !== stepId);
      }
      if (q.startStep === stepId) q.startStep = Object.keys(q.steps)[0] || '';
    });
  };

  if (!quest) return html`<div style="padding:60px;text-align:center;color:var(--text-dim)">Loading...</div>`;

  // Topological sort for display order
  const stepIds = Object.keys(quest.steps);
  const sorted = [];
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    const step = quest.steps[id];
    if (step) {
      for (const prereq of (step.prerequisiteSteps || [])) visit(prereq);
    }
    sorted.push(id);
  };
  for (const id of stepIds) visit(id);

  return html`
    <div class="dungeon-list-page">
      <div class="dungeon-list-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="topbar-btn" onClick=${onBack}>Back</button>
          <h1>${quest.name}</h1>
          ${dirty && html`<span style="color:#ffa726;font-size:12px">Unsaved</span>`}
        </div>
        <div style="display:flex;gap:8px">
          <button class="topbar-btn" onClick=${addStep}>+ Step</button>
          <button class="topbar-btn primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      <div style="padding:16px 20px">
        <div class="field">
          <label>Quest Name</label>
          <input value=${quest.name} onInput=${e => updateQuest(q => q.name = e.target.value)} />
        </div>
        <div class="field">
          <label>Description</label>
          <input value=${quest.description} onInput=${e => updateQuest(q => q.description = e.target.value)} />
        </div>
        <div class="field">
          <label>Start Step</label>
          <select value=${quest.startStep} onChange=${e => updateQuest(q => q.startStep = e.target.value)}>
            ${stepIds.map(s => html`<option key=${s} value=${s}>${s}</option>`)}
          </select>
        </div>
      </div>

      <!-- DAG visualization -->
      <div style="padding:0 20px 16px">
        <h3 style="margin-bottom:8px;color:var(--text-dim)">Steps</h3>
        <${QuestDAG} quest=${quest} sorted=${sorted} onEdit=${setEditingStep} onDelete=${deleteStep} />
      </div>

      <div style="padding:0 20px 16px">
        <${RawJsonToggle} data=${quest} onApply=${(parsed) => {
          if (typeof parsed !== 'object' || Array.isArray(parsed)) { showToast('Quest must be an object', 'error'); return; }
          setQuest(parsed);
          setDirty(true);
        }} />
      </div>

      ${editingStep && html`<${StepEditorModal}
        quest=${quest}
        stepId=${editingStep}
        onSave=${(oldId, newId, stepData) => {
          updateQuest(q => {
            if (oldId !== newId) {
              delete q.steps[oldId];
              // Update references
              for (const s of Object.values(q.steps)) {
                s.prerequisiteSteps = (s.prerequisiteSteps || []).map(p => p === oldId ? newId : p);
              }
              if (q.startStep === oldId) q.startStep = newId;
            }
            q.steps[newId] = stepData;
          });
          setEditingStep(null);
        }}
        onClose=${() => setEditingStep(null)}
      />`}
    </div>
  `;
}

function QuestDAG({ quest, sorted, onEdit, onDelete }) {
  // Render steps as a vertical list with prerequisite arrows
  return html`
    <div style="display:flex;flex-direction:column;gap:6px">
      ${sorted.map(stepId => {
        const step = quest.steps[stepId];
        if (!step) return null;
        const isStart = quest.startStep === stepId;
        return html`
          <div key=${stepId} style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;cursor:pointer"
            onClick=${() => onEdit(stepId)}>
            <div style="flex:1">
              <div style="font-size:13px;color:var(--text)">
                ${isStart ? '▸ ' : ''}${step.label}
                <span style="color:var(--text-dim);font-size:11px;margin-left:6px">(${stepId})</span>
              </div>
              ${step.prerequisiteSteps && step.prerequisiteSteps.length > 0 && html`
                <div style="font-size:10px;color:var(--text-dim);margin-top:2px">
                  After: ${step.prerequisiteSteps.join(', ')}
                </div>
              `}
              ${step.objective && step.objective.roomId && html`
                <div style="font-size:10px;color:var(--accent);margin-top:2px">
                  → ${step.objective.roomId} (${step.objective.tileX}, ${step.objective.tileY})
                </div>
              `}
            </div>
            <button class="topbar-btn" style="font-size:10px;color:#e57373" onClick=${(e) => { e.stopPropagation(); onDelete(stepId); }}>×</button>
          </div>
        `;
      })}
    </div>
  `;
}

function StepEditorModal({ quest, stepId, onSave, onClose }) {
  const original = quest.steps[stepId];
  const [step, setStep] = useState(JSON.parse(JSON.stringify(original)));
  const [localStepId, setLocalStepId] = useState(stepId);
  const [conditionsText, setConditionsText] = useState(JSON.stringify(original.completionConditions || [], null, 2));
  const allStepIds = Object.keys(quest.steps).filter(s => s !== stepId);

  const update = (fn) => {
    setStep(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      fn(copy);
      return copy;
    });
  };

  const save = () => {
    try {
      step.completionConditions = JSON.parse(conditionsText);
    } catch {
      showToast('Invalid conditions JSON', 'error');
      return;
    }
    const cleanId = localStepId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) { showToast('Step ID cannot be empty', 'error'); return; }
    if (cleanId !== stepId && quest.steps[cleanId]) { showToast('Step ID already exists', 'error'); return; }
    onSave(stepId, cleanId, step);
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" style="min-width:400px;max-width:500px">
        <h2>Step: ${stepId}</h2>
        <div class="field">
          <label>Step ID</label>
          <input value=${localStepId} onInput=${e => setLocalStepId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} />
        </div>
        <div class="field">
          <label>Label</label>
          <input value=${step.label} onInput=${e => update(s => s.label = e.target.value)} />
        </div>
        <div class="field">
          <label>Description</label>
          <input value=${step.description} onInput=${e => update(s => s.description = e.target.value)} />
        </div>
        <div class="field">
          <label>Prerequisites</label>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${allStepIds.map(sid => {
              const checked = (step.prerequisiteSteps || []).includes(sid);
              return html`
                <label key=${sid} style="font-size:11px;display:flex;align-items:center;gap:3px;cursor:pointer">
                  <input type="checkbox" checked=${checked} onChange=${() => {
                    update(s => {
                      if (!s.prerequisiteSteps) s.prerequisiteSteps = [];
                      if (checked) s.prerequisiteSteps = s.prerequisiteSteps.filter(p => p !== sid);
                      else s.prerequisiteSteps.push(sid);
                    });
                  }} />
                  ${sid}
                </label>
              `;
            })}
          </div>
        </div>
        <div class="field">
          <label>Objective Room ID</label>
          <input value=${step.objective ? step.objective.roomId : ''} onInput=${e => update(s => {
            if (!s.objective) s.objective = { roomId: '', tileX: 0, tileY: 0 };
            s.objective.roomId = e.target.value;
          })} />
        </div>
        <div style="display:flex;gap:8px">
          <div class="field" style="flex:1">
            <label>Tile X</label>
            <input type="number" value=${step.objective ? step.objective.tileX : 0} onInput=${e => update(s => {
              if (!s.objective) s.objective = { roomId: '', tileX: 0, tileY: 0 };
              s.objective.tileX = Number(e.target.value);
            })} />
          </div>
          <div class="field" style="flex:1">
            <label>Tile Y</label>
            <input type="number" value=${step.objective ? step.objective.tileY : 0} onInput=${e => update(s => {
              if (!s.objective) s.objective = { roomId: '', tileX: 0, tileY: 0 };
              s.objective.tileY = Number(e.target.value);
            })} />
          </div>
        </div>
        <div class="field">
          <label>Completion Conditions (JSON)</label>
          <textarea rows="5" style="width:100%;font-family:monospace;font-size:11px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px;resize:vertical"
            value=${conditionsText}
            onInput=${e => setConditionsText(e.target.value)}></textarea>
        </div>
        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${save}>Apply</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Template Section (collapsible) ─────────────────────────
function TemplateSection({ title, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return html`
    <div class="tmpl-section">
      <div class="tmpl-section-header" onClick=${() => setOpen(v => !v)}>
        <span class="tmpl-section-arrow">${open ? '\u25BC' : '\u25B6'}</span>
        <h3>${title}</h3>
      </div>
      ${open && html`<div class="tmpl-section-body">${children}</div>`}
    </div>
  `;
}

// ─── Range Input (min/max pair) ──────────────────────────────
function RangeInput({ label, value, onChange, min, max, step }) {
  const v = value || { min: 0, max: 0 };
  return html`
    <div class="field">
      <label>${label}</label>
      <div class="field-row" style="margin-bottom:0">
        <input type="number" value=${v.min} style="flex:1"
          onInput=${e => onChange({ ...v, min: Number(e.target.value) })}
          min=${min} max=${max} step=${step} placeholder="min" />
        <span style="color:var(--text-dim);align-self:center;font-size:12px">to</span>
        <input type="number" value=${v.max} style="flex:1"
          onInput=${e => onChange({ ...v, max: Number(e.target.value) })}
          min=${min} max=${max} step=${step} placeholder="max" />
      </div>
    </div>
  `;
}

// ─── Template Editor ─────────────────────────────────────────
function TemplateEditor({ templateId, onBack, onOpen }) {
  const [template, setTemplate] = useState(null);
  const [tilesets, setTilesets] = useState([]);
  const [monsters, setMonsters] = useState({});
  const [items, setItems] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getTemplate(templateId),
      api.getTilesets(),
      api.getMonsters(),
      api.getItems()
    ]).then(([t, ts, m, it]) => {
      setTemplate(t);
      setTilesets(ts);
      setMonsters(m);
      setItems(it);
    });
  }, [templateId]);

  const update = useCallback((updater) => {
    setTemplate(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setDirty(true);
  }, []);

  const updateNested = useCallback((path, value) => {
    update(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] === undefined) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  }, [update]);

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.saveTemplate(templateId, template);
      setTemplate(result);
      setDirty(false);
      showToast('Template saved', 'success');
    } catch { showToast('Save failed', 'error'); }
    setSaving(false);
  };

  const onGenerated = (dungeonId) => {
    setShowGenerate(false);
    showToast('Dungeon generated — opening editor', 'success');
    onOpen(dungeonId);
  };

  const doDelete = async () => {
    try {
      await api.deleteTemplate(templateId);
      showToast('Template deleted', 'success');
      onBack();
    } catch { showToast('Delete failed', 'error'); }
  };

  if (!template) return html`<div style="padding:60px;text-align:center;color:var(--text-dim)">Loading...</div>`;

  const t = template;
  const grid = t.grid || {};
  const rooms = t.rooms || {};
  const corridors = t.corridors || {};
  const exits = t.exits || {};
  const mons = t.monsters || {};
  const itms = t.items || {};
  const spawns = t.spawns || {};

  return html`
    <div class="dungeon-list-page">
      <div class="dungeon-list-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="topbar-btn" onClick=${onBack}>\u2190 Back</button>
          <h1>${t.namePattern || t.id}</h1>
          <span class="template-badge">Procedural</span>
          ${dirty && html`<span style="color:#ffa726;font-size:12px">Unsaved</span>`}
        </div>
        <div style="display:flex;gap:8px">
          <button class="topbar-btn" onClick=${() => setShowGenerate(true)}>Generate Sample</button>
          <button class="topbar-btn" onClick=${apply}>Apply</button>
          <button class="topbar-btn danger" onClick=${() => setShowDelete(true)}>Delete</button>
          <button class="topbar-btn primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
      <div class="tmpl-editor-body">

        <!-- Basic Settings -->
        <${TemplateSection} title="Basic Settings">
          <div class="field">
            <label>ID</label>
            <input value=${t.id} disabled style="opacity:0.5" />
          </div>
          <div class="field">
            <label>Name Pattern (use {depth} for level number)</label>
            <input value=${t.namePattern || ''} onInput=${e => update({ namePattern: e.target.value })} placeholder="Cave System - Level {depth}" />
          </div>
          <div class="field-row">
            <div class="field">
              <label>Tileset</label>
              <select value=${t.tileset || 'crypt'} onChange=${e => update({ tileset: e.target.value })}>
                ${tilesets.map(ts => html`<option key=${ts.id} value=${ts.id}>${ts.id}</option>`)}
              </select>
            </div>
            <div class="field">
              <label>Tile Size</label>
              <input type="number" value=${t.tileSize || 32} onInput=${e => update({ tileSize: Number(e.target.value) })} min="8" max="64" />
            </div>
          </div>
          <${RangeInput} label="Depth Range" value=${t.depth} onChange=${v => update({ depth: v })} min=${1} max=${20} />
        <//>

        <!-- Grid -->
        <${TemplateSection} title="Grid">
          <div class="field-row">
            <div class="field">
              <label>Width</label>
              <input type="number" value=${grid.width || 40} onInput=${e => updateNested('grid.width', Number(e.target.value))} min="10" max="100" />
            </div>
            <div class="field">
              <label>Height</label>
              <input type="number" value=${grid.height || 30} onInput=${e => updateNested('grid.height', Number(e.target.value))} min="10" max="100" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Wall Tile</label>
              <input type="number" value=${grid.wallTile != null ? grid.wallTile : 3} onInput=${e => updateNested('grid.wallTile', Number(e.target.value))} min="0" />
            </div>
            <div class="field">
              <label>Floor Tile</label>
              <input type="number" value=${grid.floorTile != null ? grid.floorTile : 1} onInput=${e => updateNested('grid.floorTile', Number(e.target.value))} min="0" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Alt Floor Tile</label>
              <input type="number" value=${grid.altFloorTile != null ? grid.altFloorTile : 2} onInput=${e => updateNested('grid.altFloorTile', Number(e.target.value))} min="0" />
            </div>
            <div class="field">
              <label>Alt Floor Chance</label>
              <input type="number" value=${grid.altFloorChance != null ? grid.altFloorChance : 0.05} onInput=${e => updateNested('grid.altFloorChance', Number(e.target.value))} min="0" max="1" step="0.01" />
            </div>
          </div>
        <//>

        <!-- Rooms -->
        <${TemplateSection} title="Rooms">
          <${RangeInput} label="Room Count" value=${rooms.count} onChange=${v => updateNested('rooms.count', v)} min=${1} max=${20} />
          <${RangeInput} label="Room Width" value=${rooms.width} onChange=${v => updateNested('rooms.width', v)} min=${3} max=${20} />
          <${RangeInput} label="Room Height" value=${rooms.height} onChange=${v => updateNested('rooms.height', v)} min=${3} max=${20} />
          <div class="field-row">
            <div class="field">
              <label>Padding</label>
              <input type="number" value=${rooms.padding != null ? rooms.padding : 2} onInput=${e => updateNested('rooms.padding', Number(e.target.value))} min="0" max="10" />
            </div>
            <div class="field">
              <label>Max Attempts</label>
              <input type="number" value=${rooms.maxPlacementAttempts || 200} onInput=${e => updateNested('rooms.maxPlacementAttempts', Number(e.target.value))} min="50" max="1000" />
            </div>
          </div>
        <//>

        <!-- Corridors -->
        <${TemplateSection} title="Corridors">
          <${RangeInput} label="Corridor Width" value=${corridors.width} onChange=${v => updateNested('corridors.width', v)} min=${1} max=${5} />
          <div class="field-row">
            <div class="field">
              <label>Door Chance</label>
              <input type="number" value=${corridors.doorChance != null ? corridors.doorChance : 0.3} onInput=${e => updateNested('corridors.doorChance', Number(e.target.value))} min="0" max="1" step="0.05" />
            </div>
            <div class="field">
              <label>Door Tile</label>
              <input type="number" value=${corridors.doorTile != null ? corridors.doorTile : 4} onInput=${e => updateNested('corridors.doorTile', Number(e.target.value))} min="0" />
            </div>
          </div>
          <div class="field">
            <label>Extra Connection Chance</label>
            <input type="number" value=${corridors.extraConnectionChance != null ? corridors.extraConnectionChance : 0.2} onInput=${e => updateNested('corridors.extraConnectionChance', Number(e.target.value))} min="0" max="1" step="0.05" />
          </div>
        <//>

        <!-- Required Rooms -->
        <${TemplateSection} title="Required Rooms (${(t.requiredRooms || []).length})">
          <${RequiredRoomsList} rooms=${t.requiredRooms || []} onChange=${v => update({ requiredRooms: v })} />
        <//>

        <!-- Exits -->
        <${TemplateSection} title="Exits">
          <div class="tmpl-card">
            <div class="tmpl-card-title">Entrance (stairs up)</div>
            <div class="field-row">
              <div class="field">
                <label>Tile ID</label>
                <input type="number" value=${(exits.entrance || {}).tile || 8} onInput=${e => updateNested('exits.entrance.tile', Number(e.target.value))} min="0" />
              </div>
              <div class="field">
                <label>Position</label>
                <input value=${(exits.entrance || {}).position || 'entrance_room'} onInput=${e => updateNested('exits.entrance.position', e.target.value)} />
              </div>
            </div>
            <div class="field">
              <label>Leads To</label>
              <input value=${(exits.entrance || {}).leadsTo || '$source'} onInput=${e => updateNested('exits.entrance.leadsTo', e.target.value)} />
            </div>
          </div>
          <div class="tmpl-card" style="margin-top:8px">
            <div class="tmpl-card-title">Descent (stairs down)</div>
            <div class="field-row">
              <div class="field">
                <label>Tile ID</label>
                <input type="number" value=${(exits.descent || {}).tile || 6} onInput=${e => updateNested('exits.descent.tile', Number(e.target.value))} min="0" />
              </div>
              <div class="field">
                <label>Position</label>
                <input value=${(exits.descent || {}).position || 'exit_room'} onInput=${e => updateNested('exits.descent.position', e.target.value)} />
              </div>
            </div>
            <div class="field">
              <label>Leads To</label>
              <input value=${(exits.descent || {}).leadsTo || '$next'} onInput=${e => updateNested('exits.descent.leadsTo', e.target.value)} />
            </div>
            <div class="field" style="margin-bottom:0">
              <label style="display:flex;align-items:center;gap:6px">
                <input type="checkbox" checked=${(exits.descent || {}).hideDescentOnLast || false}
                  onChange=${e => updateNested('exits.descent.hideDescentOnLast', e.target.checked)} />
                Hide descent on last depth
              </label>
            </div>
          </div>
        <//>

        <!-- Monsters -->
        <${TemplateSection} title="Monsters">
          <div class="field-row">
            <div class="field">
              <label>Base Budget</label>
              <input type="number" value=${(mons.budget || {}).base || 4} onInput=${e => updateNested('monsters.budget.base', Number(e.target.value))} min="0" />
            </div>
            <div class="field">
              <label>Per Depth</label>
              <input type="number" value=${(mons.budget || {}).perDepth || 2} onInput=${e => updateNested('monsters.budget.perDepth', Number(e.target.value))} min="0" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Max Per Room</label>
              <input type="number" value=${mons.maxPerRoom || 3} onInput=${e => updateNested('monsters.maxPerRoom', Number(e.target.value))} min="1" />
            </div>
            <div class="field">
              <label style="display:flex;align-items:center;gap:6px;padding-top:18px">
                <input type="checkbox" checked=${mons.avoidEntranceRoom !== false}
                  onChange=${e => updateNested('monsters.avoidEntranceRoom', e.target.checked)} />
                Avoid entrance room
              </label>
            </div>
          </div>
          <${MonsterPoolList} pool=${mons.pool || []} monsters=${monsters}
            onChange=${v => updateNested('monsters.pool', v)} />
        <//>

        <!-- Items -->
        <${TemplateSection} title="Items">
          <${RangeInput} label="Item Count" value=${itms.countRange} onChange=${v => updateNested('items.countRange', v)} min=${0} max=${10} />
          <${ItemPoolList} pool=${itms.pool || []} items=${items}
            onChange=${v => updateNested('items.pool', v)} />
        <//>

        <!-- Triggers -->
        <${TemplateSection} title="Triggers (${(t.triggers || []).length})" defaultOpen=${false}>
          <${TemplateTriggerList} triggers=${t.triggers || []} onChange=${v => update({ triggers: v })} />
        <//>

        <!-- Player Spawns -->
        <${TemplateSection} title="Player Spawns">
          <div class="field-row">
            <div class="field">
              <label>Count</label>
              <input type="number" value=${spawns.count || 4} onInput=${e => updateNested('spawns.count', Number(e.target.value))} min="1" max="10" />
            </div>
            <div class="field">
              <label>Position</label>
              <input value=${spawns.position || 'entrance_room'} onInput=${e => updateNested('spawns.position', e.target.value)} placeholder="entrance_room" />
            </div>
          </div>
        <//>

        <!-- Raw JSON -->
        <${TemplateSection} title="Raw JSON" defaultOpen=${false}>
          <${RawJsonToggle} data=${template} onApply=${(parsed) => {
            if (typeof parsed !== 'object' || Array.isArray(parsed)) { showToast('Template must be an object', 'error'); return; }
            setTemplate(parsed);
            setDirty(true);
          }} />
        <//>

      </div>
      ${showGenerate && html`<${GenerateModal} templateId=${templateId} template=${template}
        onGenerated=${onGenerated} onClose=${() => setShowGenerate(false)} />`}
    </div>
  `;
}

// ─── Generate from Template Modal ───────────────────────────
function GenerateModal({ templateId, template, onGenerated, onClose }) {
  const depthMin = (template.depth && template.depth.min) || 1;
  const depthMax = (template.depth && template.depth.max) || 10;
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [depth, setDepth] = useState(depthMin);
  const [seed, setSeed] = useState('');
  const [generating, setGenerating] = useState(false);

  const submit = async () => {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) { showToast('ID is required', 'error'); return; }
    setGenerating(true);
    try {
      await api.generateFromTemplate(templateId, {
        id: safeId,
        name: name || undefined,
        depth: Number(depth),
        seed: seed || undefined,
      });
      onGenerated(safeId);
    } catch (e) {
      showToast(e.message || 'Generation failed', 'error');
    }
    setGenerating(false);
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <h2>Generate from Template</h2>
        <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">
          Run the procedural algorithm to create a hand-editable dungeon from this template.
        </p>
        <div class="field">
          <label>Dungeon ID</label>
          <input value=${id} onInput=${e => setId(e.target.value)} placeholder="e.g. quarantine_sample_01" />
        </div>
        <div class="field">
          <label>Name (optional — defaults to template pattern)</label>
          <input value=${name} onInput=${e => setName(e.target.value)} placeholder="e.g. Quarantine Wing" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Depth (${depthMin}–${depthMax})</label>
            <input type="number" value=${depth} onInput=${e => setDepth(e.target.value)}
              min=${depthMin} max=${depthMax} />
          </div>
          <div class="field">
            <label>Seed (optional — random if empty)</label>
            <input value=${seed} onInput=${e => setSeed(e.target.value)} placeholder="any text" />
          </div>
        </div>
        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${submit} disabled=${generating}>
            ${generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>

    ${showDelete && html`
      <div class="modal-overlay" onClick=${e => e.target === e.currentTarget && setShowDelete(false)}>
        <div class="modal">
          <h2>Delete Template</h2>
          <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">
            Are you sure you want to delete <strong>${t.namePattern || t.id}</strong>? This cannot be undone.
          </p>
          <div class="modal-actions">
            <button onClick=${() => setShowDelete(false)}>Cancel</button>
            <button class="primary" style="background:var(--danger);border-color:var(--danger)" onClick=${doDelete}>Delete</button>
          </div>
        </div>
      </div>
    `}
  `;
}

// ─── Required Rooms List ─────────────────────────────────────
function RequiredRoomsList({ rooms, onChange }) {
  const add = () => {
    onChange([...rooms, { tag: 'room_' + (rooms.length + 1), width: { min: 4, max: 6 }, height: { min: 4, max: 6 } }]);
  };

  const remove = (idx) => {
    onChange(rooms.filter((_, i) => i !== idx));
  };

  const updateRoom = (idx, field, value) => {
    const updated = rooms.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    onChange(updated);
  };

  return html`
    <div class="tmpl-list">
      ${rooms.map((room, i) => html`
        <div class="tmpl-card" key=${i}>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div class="tmpl-card-title">${room.tag || 'unnamed'}</div>
            <button class="spawn-remove" onClick=${() => remove(i)}>\u00D7</button>
          </div>
          <div class="field">
            <label>Tag</label>
            <input value=${room.tag || ''} onInput=${e => updateRoom(i, 'tag', e.target.value)} placeholder="room_tag" />
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" checked=${room.isEntrance || false}
                onChange=${e => updateRoom(i, 'isEntrance', e.target.checked || undefined)} /> Entrance
            </label>
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" checked=${room.isExit || false}
                onChange=${e => updateRoom(i, 'isExit', e.target.checked || undefined)} /> Exit
            </label>
          </div>
          <${RangeInput} label="Width" value=${room.width} onChange=${v => updateRoom(i, 'width', v)} min=${3} max=${20} />
          <${RangeInput} label="Height" value=${room.height} onChange=${v => updateRoom(i, 'height', v)} min=${3} max=${20} />
          <div class="field-row">
            <div class="field">
              <label>Depth (only on)</label>
              <input type="number" value=${room.depth != null ? room.depth : ''} onInput=${e => {
                const val = e.target.value;
                updateRoom(i, 'depth', val === '' ? undefined : Number(val));
              }} placeholder="any" />
            </div>
            <div class="field">
              <label>Max Depth</label>
              <input type="number" value=${room.maxDepth != null ? room.maxDepth : ''} onInput=${e => {
                const val = e.target.value;
                updateRoom(i, 'maxDepth', val === '' ? undefined : Number(val));
              }} placeholder="any" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Place Near</label>
              <input value=${room.placeNear || ''} onInput=${e => updateRoom(i, 'placeNear', e.target.value || undefined)} placeholder="tag name" />
            </div>
            <div class="field">
              <label>Center Tile</label>
              <input type="number" value=${room.centerTile != null ? room.centerTile : ''} onInput=${e => {
                const val = e.target.value;
                updateRoom(i, 'centerTile', val === '' ? undefined : Number(val));
              }} placeholder="none" />
            </div>
          </div>
        </div>
      `)}
      <button class="topbar-btn" style="align-self:flex-start" onClick=${add}>+ Add Room</button>
    </div>
  `;
}

// ─── Monster Pool List ───────────────────────────────────────
function MonsterPoolList({ pool, monsters, onChange }) {
  const add = () => {
    const firstType = Object.keys(monsters)[0] || 'skeleton';
    onChange([...pool, { type: firstType, weight: 1, cost: 1, minDepth: 0 }]);
  };

  const remove = (idx) => {
    onChange(pool.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx, field, value) => {
    const updated = pool.map((e, i) => i === idx ? { ...e, [field]: value } : e);
    onChange(updated);
  };

  const monsterList = Object.entries(monsters);

  return html`
    <div class="tmpl-list">
      <label style="font-size:12px;color:var(--text-dim);margin-bottom:4px;display:block">Monster Pool</label>
      ${pool.map((entry, i) => html`
        <div class="tmpl-card-inline" key=${i}>
          <select value=${entry.type} onChange=${e => updateEntry(i, 'type', e.target.value)} style="flex:2">
            ${monsterList.map(([id, m]) => html`<option key=${id} value=${id}>${m.name || id}</option>`)}
            ${!monsters[entry.type] && html`<option value=${entry.type}>${entry.type}</option>`}
          </select>
          <input type="number" value=${entry.weight} onInput=${e => updateEntry(i, 'weight', Number(e.target.value))}
            min="1" title="Weight" style="flex:1;width:50px" placeholder="wt" />
          <input type="number" value=${entry.cost} onInput=${e => updateEntry(i, 'cost', Number(e.target.value))}
            min="1" title="Cost" style="flex:1;width:50px" placeholder="cost" />
          <input type="number" value=${entry.minDepth || 0} onInput=${e => updateEntry(i, 'minDepth', Number(e.target.value))}
            min="0" title="Min Depth" style="flex:1;width:50px" placeholder="minD" />
          <button class="spawn-remove" onClick=${() => remove(i)}>\u00D7</button>
        </div>
      `)}
      ${pool.length > 0 && html`
        <div style="display:flex;gap:4px;font-size:10px;color:var(--text-dim);padding:0 4px">
          <span style="flex:2">Type</span><span style="flex:1">Weight</span><span style="flex:1">Cost</span><span style="flex:1">MinD</span><span style="width:24px"></span>
        </div>
      `}
      <button class="topbar-btn" style="align-self:flex-start" onClick=${add}>+ Add Monster</button>
    </div>
  `;
}

// ─── Item Pool List ──────────────────────────────────────────
function ItemPoolList({ pool, items, onChange }) {
  const add = () => {
    const firstType = Object.keys(items)[0] || 'health_potion';
    onChange([...pool, { type: firstType, weight: 1, max: 2 }]);
  };

  const remove = (idx) => {
    onChange(pool.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx, field, value) => {
    const updated = pool.map((e, i) => i === idx ? { ...e, [field]: value } : e);
    onChange(updated);
  };

  const itemList = Object.entries(items);

  return html`
    <div class="tmpl-list">
      <label style="font-size:12px;color:var(--text-dim);margin-bottom:4px;display:block">Item Pool</label>
      ${pool.map((entry, i) => html`
        <div class="tmpl-card-inline" key=${i}>
          <select value=${entry.type} onChange=${e => updateEntry(i, 'type', e.target.value)} style="flex:2">
            ${itemList.map(([id, it]) => html`<option key=${id} value=${id}>${it.name || id}</option>`)}
            ${!items[entry.type] && html`<option value=${entry.type}>${entry.type}</option>`}
          </select>
          <input type="number" value=${entry.weight} onInput=${e => updateEntry(i, 'weight', Number(e.target.value))}
            min="1" title="Weight" style="flex:1;width:50px" placeholder="wt" />
          <input type="number" value=${entry.max != null ? entry.max : ''} onInput=${e => {
            const val = e.target.value;
            updateEntry(i, 'max', val === '' ? undefined : Number(val));
          }} min="0" title="Max" style="flex:1;width:50px" placeholder="max" />
          <button class="spawn-remove" onClick=${() => remove(i)}>\u00D7</button>
        </div>
      `)}
      ${pool.length > 0 && html`
        <div style="display:flex;gap:4px;font-size:10px;color:var(--text-dim);padding:0 4px">
          <span style="flex:2">Type</span><span style="flex:1">Weight</span><span style="flex:1">Max</span><span style="width:24px"></span>
        </div>
      `}
      <button class="topbar-btn" style="align-self:flex-start" onClick=${add}>+ Add Item</button>
    </div>
  `;
}

// ─── Template Trigger List ───────────────────────────────────
function TemplateTriggerList({ triggers, onChange }) {
  const add = () => {
    onChange([...triggers, { id: 'trigger_{instanceId}', event: 'room_entered', actions: [{ type: 'showMessage', text: '' }], once: true }]);
  };

  const remove = (idx) => {
    onChange(triggers.filter((_, i) => i !== idx));
  };

  const updateTrigger = (idx, field, value) => {
    const updated = triggers.map((t, i) => i === idx ? { ...t, [field]: value } : t);
    onChange(updated);
  };

  return html`
    <div class="tmpl-list">
      ${triggers.map((trig, i) => html`
        <div class="tmpl-card" key=${i}>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div class="tmpl-card-title">${trig.id || 'unnamed'}</div>
            <button class="spawn-remove" onClick=${() => remove(i)}>\u00D7</button>
          </div>
          <div class="field">
            <label>Trigger ID (use {instanceId})</label>
            <input value=${trig.id || ''} onInput=${e => updateTrigger(i, 'id', e.target.value)} />
          </div>
          <div class="field-row">
            <div class="field">
              <label>Event</label>
              <select value=${trig.event || ''} onChange=${e => updateTrigger(i, 'event', e.target.value)}>
                <option value="room_entered">room_entered</option>
                <option value="item_picked_up">item_picked_up</option>
                <option value="monster_killed">monster_killed</option>
                <option value="npc_interacted">npc_interacted</option>
                <option value="door_interacted">door_interacted</option>
                <option value="player_death">player_death</option>
                <option value="flag_changed">flag_changed</option>
              </select>
            </div>
            <div class="field">
              <label>Depth (only on)</label>
              <input type="number" value=${trig.depth != null ? trig.depth : ''} onInput=${e => {
                const val = e.target.value;
                updateTrigger(i, 'depth', val === '' ? undefined : Number(val));
              }} placeholder="any" />
            </div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" checked=${trig.once || false}
                onChange=${e => updateTrigger(i, 'once', e.target.checked)} /> Once
            </label>
          </div>
          <div class="field">
            <label>Filter (JSON)</label>
            <input value=${trig.filter ? JSON.stringify(trig.filter) : ''} onInput=${e => {
              const val = e.target.value;
              if (!val) { updateTrigger(i, 'filter', undefined); return; }
              try { updateTrigger(i, 'filter', JSON.parse(val)); } catch {}
            }} placeholder='{"itemType": "key"}' style="font-family:monospace;font-size:12px" />
          </div>
          <div class="field">
            <label>Actions (JSON)</label>
            <textarea class="raw-json-textarea" rows="3" value=${JSON.stringify(trig.actions || [], null, 2)}
              onInput=${e => {
                try { updateTrigger(i, 'actions', JSON.parse(e.target.value)); } catch {}
              }} />
          </div>
        </div>
      `)}
      <button class="topbar-btn" style="align-self:flex-start" onClick=${add}>+ Add Trigger</button>
    </div>
  `;
}

// ─── Mount ──────────────────────────────────────────────────
render(html`<${App} />`, document.getElementById('app'));
