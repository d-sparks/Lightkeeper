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
  const [view, setView] = useState('list');
  const [dungeonId, setDungeonId] = useState(null);

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
  const backToList = () => { setView('list'); setDungeonId(null); };

  if (authState === 'loading') return html`<div style="padding:60px;text-align:center;color:var(--text-dim)">Loading...</div>`;
  if (authState === 'login') return html`<${LoginScreen} onSuccess=${() => setAuthState('ready')} />`;

  return html`
    <div id="toast" class="toast" style="display:none"></div>
    ${view === 'list'
      ? html`<${DungeonList} onOpen=${openEditor} gitConfigured=${gitConfigured} />`
      : html`<${Editor} dungeonId=${dungeonId} onBack=${backToList} />`
    }
  `;
}

// ─── Dungeon List ───────────────────────────────────────────
function DungeonList({ onOpen, gitConfigured }) {
  const [dungeons, setDungeons] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showBranch, setShowBranch] = useState(false);
  const [activeBranch, setActiveBranch] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [spawnRoom, setSpawnRoom] = useState('');

  const loadDungeons = () => api.listDungeons().then(setDungeons);
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
      ${showNew && html`<${NewDungeonModal} onCreate=${createDungeon} onClose=${() => setShowNew(false)} />`}
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
  const [showNPCEditor, setShowNPCEditor] = useState(false);
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [selectedSpawn, setSelectedSpawn] = useState(null); // { kind, index } for move tool

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
      selectedSpawn=${selectedSpawn} setSelectedSpawn=${setSelectedSpawn} />`}
    ${tool === 'spawn' && html`<${SpawnPanel}
      dungeon=${dungeon} updateDungeon=${updateDungeon}
      spawnMode=${spawnMode} setSpawnMode=${setSpawnMode}
      spawnEntityType=${spawnEntityType} setSpawnEntityType=${setSpawnEntityType}
      monsters=${monsters} npcs=${npcs} items=${items}
    />`}
    <${SpawnList} dungeon=${dungeon} updateDungeon=${updateDungeon} />
    <${EntitySection}
      onEditNPCs=${() => setShowNPCEditor(true)}
      onEditItems=${() => setShowItemEditor(true)}
    />
  `;

  return html`
    <div class="topbar">
      <button class="topbar-btn" onClick=${onBack}>← Back</button>
      <h1>${dungeon.name}</h1>
      <div class="topbar-spacer" />
      <button class="topbar-btn" onClick=${undo} disabled=${undoStackRef.current.length === 0} title="Undo (Ctrl+Z)">Undo</button>
      <button class="topbar-btn" onClick=${redo} disabled=${redoStackRef.current.length === 0} title="Redo (Ctrl+Y)">Redo</button>
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
      />
      <div class="side-panel">${panelContent}</div>
    </div>
    <div class="bottom-sheet" id="bottom-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-content">${panelContent}</div>
    </div>
    ${showProps && html`<${PropertiesModal} dungeon=${dungeon} tilesets=${tilesets}
      updateDungeon=${updateDungeon} onClose=${() => setShowProps(false)} />`}
    ${showNPCEditor && html`<${NPCEditorModal} npcs=${npcs} setNPCs=${setNPCs}
      onClose=${() => setShowNPCEditor(false)} />`}
    ${showItemEditor && html`<${ItemEditorModal} items=${items} setItems=${setItems}
      onClose=${() => setShowItemEditor(false)} />`}
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
function SpawnList({ dungeon, updateDungeon }) {
  const allSpawns = [
    ...dungeon.spawns.map((s, i) => ({ ...s, _kind: 'spawn', _i: i, _label: `Player (${s.x},${s.y})` })),
    ...dungeon.monsterSpawns.map((s, i) => ({ ...s, _kind: 'monster', _i: i, _label: `${s.type} (${s.x},${s.y}) x${s.count}` })),
    ...dungeon.npcSpawns.map((s, i) => ({ ...s, _kind: 'npc', _i: i, _label: `${s.type} (${s.x},${s.y})` })),
    ...(dungeon.itemSpawns || []).map((s, i) => ({ ...s, _kind: 'item', _i: i, _label: `${s.type} (${s.x},${s.y})` })),
    ...dungeon.exits.map((s, i) => ({ ...s, _kind: 'exit', _i: i, _label: `Exit→${s.leadsTo} (${s.x},${s.y})` })),
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

  return html`
    <div class="panel-section">
      <h3>Spawns (${allSpawns.length})</h3>
      <div class="spawn-list">
        ${allSpawns.map(s => html`
          <div class="spawn-item" key="${s._kind}-${s._i}">
            <div class="spawn-dot" style="background:${colorFor(s._kind)}"></div>
            <span>${s._label}</span>
            <button class="spawn-remove" onClick=${() => remove(s._kind, s._i)}>×</button>
          </div>
        `)}
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
function MovePanel({ dungeon, updateDungeon, selectedSpawn, setSelectedSpawn }) {
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
    : kind === 'exit' ? 'Exit / Stairs'
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
          <label>Leads To (dungeon ID)</label>
          <input value=${spawn.leadsTo || ''} onInput=${e => updateProp('leadsTo', e.target.value)} placeholder="e.g. crypt_02" />
        </div>
        <div class="field">
          <label>Stair Type</label>
          <select value=${spawn.type || 'stairs_down'} onChange=${e => updateProp('type', e.target.value)}>
            <option value="stairs_down">stairs_down</option>
            <option value="stairs_up">stairs_up</option>
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Spawn X</label>
            <input type="number" value=${spawn.spawnX || 0} onInput=${e => updateProp('spawnX', Number(e.target.value))} min="0" />
          </div>
          <div class="field">
            <label>Spawn Y</label>
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

      <button class="tool-btn" style="margin-top:4px;border-color:var(--text-dim)"
        onClick=${() => setSelectedSpawn(null)}>Deselect</button>
    </div>
  `;
}

// ─── Tile Canvas (the core painting surface) ────────────────
function TileCanvas({ dungeon, tiles, tool, selectedTile, spawnMode, spawnEntityType, updateDungeon, onStrokeStart, onStrokeEnd, selectedSpawn, onSelectSpawn, monsters, npcs, items }) {
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
    for (const s of dungeon.exits) drawMarker(s.x, s.y, SPAWN_COLORS.exit, 'E');

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

  return html`
    <div class="canvas-wrap" ref=${wrapRef}
      onContextMenu=${e => e.preventDefault()}>
      <canvas ref=${canvasRef}
        onPointerDown=${onPointerDown}
        onPointerMove=${onPointerMove}
        onPointerUp=${onPointerUp}
        onPointerLeave=${onPointerUp}
        onTouchStart=${onTouchStart}
        onTouchMove=${onTouchMove}
        onTouchEnd=${onTouchEnd}
        onWheel=${onWheel}
        style="touch-action:none"
      />
    </div>
  `;
}

// ─── Entity Section (sidebar) ──────────────────────────────
function EntitySection({ onEditNPCs, onEditItems }) {
  return html`
    <div class="panel-section">
      <h3>Entities</h3>
      <div class="tool-bar">
        <button class="tool-btn" onClick=${onEditNPCs}
          style="border-color:${SPAWN_COLORS.npc}">Edit NPCs</button>
        <button class="tool-btn" onClick=${onEditItems}
          style="border-color:${SPAWN_COLORS.item}">Edit Items</button>
      </div>
    </div>
  `;
}

// ─── NPC Editor Modal ──────────────────────────────────────
function NPCEditorModal({ npcs, setNPCs, onClose }) {
  const [localNPCs, setLocalNPCs] = useState(JSON.parse(JSON.stringify(npcs)));
  const [selectedId, setSelectedId] = useState(Object.keys(npcs)[0] || '');
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

        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Item Editor Modal ─────────────────────────────────────
function ItemEditorModal({ items, setItems, onClose }) {
  const [localItems, setLocalItems] = useState(JSON.parse(JSON.stringify(items)));
  const [selectedId, setSelectedId] = useState(Object.keys(items)[0] || '');
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

        <div class="modal-actions">
          <button onClick=${onClose}>Cancel</button>
          <button class="primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Mount ──────────────────────────────────────────────────
render(html`<${App} />`, document.getElementById('app'));
