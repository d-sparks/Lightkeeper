import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// ─── API helpers ────────────────────────────────────────────
async function checkedFetch(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.dispatchEvent(new Event('checkpoint-unauthorized'));
    throw new Error('Unauthorized');
  }
  return res;
}

const api = {
  async checkAuth() { return (await fetch('/api/checkpoint/auth')).json(); },
  async login(password) {
    const res = await fetch('/api/checkpoint/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return { ok: res.ok, ...(await res.json()) };
  },
  async sessions() { return (await checkedFetch('/api/checkpoint/sessions')).json(); },
  async saves() { return (await checkedFetch('/api/checkpoint/saves')).json(); },
  async save(playerId) {
    return (await checkedFetch('/api/checkpoint/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    })).json();
  },
  async load(file, playerId) {
    return (await checkedFetch('/api/checkpoint/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, playerId }),
    })).json();
  },
  async deleteSave(file) {
    return (await checkedFetch(`/api/checkpoint/saves/${encodeURIComponent(file)}`, {
      method: 'DELETE',
    })).json();
  },
  async commit(message) {
    return (await checkedFetch('/api/checkpoint/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })).json();
  },
  async quests() { return (await checkedFetch('/api/checkpoint/quests')).json(); },
  async questJump(playerId, questId, stepId) {
    return (await checkedFetch('/api/checkpoint/quest-jump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, questId, stepId }),
    })).json();
  },
  async getFlags(playerId) {
    return (await checkedFetch(`/api/checkpoint/flags/${encodeURIComponent(playerId)}`)).json();
  },
  async setFlag(playerId, flag, value, scope) {
    return (await checkedFetch('/api/checkpoint/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, flag, value, scope }),
    })).json();
  },
  async removeFlag(playerId, flag, scope) {
    return (await checkedFetch('/api/checkpoint/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, flag, scope, remove: true }),
    })).json();
  },
};

// ─── Toast ──────────────────────────────────────────────────
let toastTimeout;
function showToast(msg, type = 'ok') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.remove(), 3000);
}

// ─── Login Screen ───────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await api.login(password);
    if (result.ok) {
      onLogin();
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return html`
    <div class="login-wrap">
      <form class="login-box" onSubmit=${submit}>
        <h2>Checkpoint Login</h2>
        ${error && html`<div class="login-error">${error}</div>`}
        <input type="password" placeholder="Password" value=${password}
          onInput=${e => setPassword(e.target.value)} autofocus />
        <button type="submit">Login</button>
      </form>
    </div>
  `;
}

// ─── Quest DAG Visualization ─────────────────────────────────
function computeDAGLayout(steps) {
  if (!steps || steps.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const stepMap = {};
  steps.forEach(s => { stepMap[s.id] = s; });

  // Compute layers via longest-path from roots
  const layers = {};
  const visited = {};
  function getLayer(id) {
    if (visited[id]) return layers[id];
    visited[id] = true;
    const step = stepMap[id];
    if (!step || !step.prerequisiteSteps || step.prerequisiteSteps.length === 0) {
      layers[id] = 0;
      return 0;
    }
    let maxPre = 0;
    for (const preId of step.prerequisiteSteps) {
      if (stepMap[preId]) maxPre = Math.max(maxPre, getLayer(preId) + 1);
    }
    layers[id] = maxPre;
    return maxPre;
  }
  steps.forEach(s => getLayer(s.id));

  // Group by layer
  const layerGroups = {};
  let maxLayer = 0;
  for (const [id, layer] of Object.entries(layers)) {
    if (!layerGroups[layer]) layerGroups[layer] = [];
    layerGroups[layer].push(id);
    maxLayer = Math.max(maxLayer, layer);
  }

  // Layout constants
  const nodeW = 160, nodeH = 52;
  const layerGap = 80, nodeGap = 24;
  const padX = 20, padY = 20;

  const nodes = [];
  const nodePos = {};
  for (let layer = 0; layer <= maxLayer; layer++) {
    const group = layerGroups[layer] || [];
    group.forEach((id, idx) => {
      const x = padX + layer * (nodeW + layerGap);
      const y = padY + idx * (nodeH + nodeGap);
      const step = stepMap[id];
      nodes.push({ id, x, y, w: nodeW, h: nodeH, label: step.label, roomId: step.roomId });
      nodePos[id] = { x, y };
    });
  }

  // Build edges
  const edges = [];
  steps.forEach(s => {
    if (s.prerequisiteSteps) {
      s.prerequisiteSteps.forEach(preId => {
        if (nodePos[preId] && nodePos[s.id]) {
          edges.push({ from: preId, to: s.id });
        }
      });
    }
  });

  // Compute SVG dimensions
  const svgW = padX * 2 + (maxLayer + 1) * nodeW + maxLayer * layerGap;
  let maxNodesInLayer = 0;
  for (let l = 0; l <= maxLayer; l++) {
    maxNodesInLayer = Math.max(maxNodesInLayer, (layerGroups[l] || []).length);
  }
  const svgH = padY * 2 + maxNodesInLayer * nodeH + (maxNodesInLayer - 1) * nodeGap;

  return { nodes, edges, nodePos, nodeW, nodeH, width: svgW, height: Math.max(svgH, nodeH + padY * 2) };
}

function QuestDAG({ quests }) {
  if (!quests || quests.length === 0) return html`<div class="empty">No quest data</div>`;

  return html`
    ${quests.map(quest => {
      const layout = computeDAGLayout(quest.steps);
      if (layout.nodes.length === 0) return null;
      const { nodes, edges, nodePos, nodeW, nodeH, width, height } = layout;

      return html`
        <div class="dag-quest" key=${quest.id}>
          <h3 class="dag-quest-title">${quest.name}</h3>
          <div class="dag-scroll">
            <svg width=${width} height=${height} class="dag-svg">
              <defs>
                <marker id="arrow-${quest.id}" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse"
                  fill="#4fc3f7">
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>
              ${edges.map(({ from, to }) => {
                const fp = nodePos[from];
                const tp = nodePos[to];
                const x1 = fp.x + nodeW;
                const y1 = fp.y + nodeH / 2;
                const x2 = tp.x;
                const y2 = tp.y + nodeH / 2;
                const midX = (x1 + x2) / 2;
                return html`
                  <path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}"
                    fill="none" stroke="#4fc3f7" stroke-width="2"
                    marker-end="url(#arrow-${quest.id})" />
                `;
              })}
              ${nodes.map(n => html`
                <g key=${n.id}>
                  <rect x=${n.x} y=${n.y} width=${n.w} height=${n.h} rx="6" ry="6"
                    fill="#2a2a3d" stroke="#4fc3f7" stroke-width="1.5" />
                  <text x=${n.x + n.w / 2} y=${n.y + 22} text-anchor="middle"
                    fill="#e0e0e0" font-size="12" font-weight="600" font-family="Segoe UI, system-ui, sans-serif">
                    ${n.label}
                  </text>
                  ${n.roomId ? html`
                    <text x=${n.x + n.w / 2} y=${n.y + 38} text-anchor="middle"
                      fill="#777" font-size="10" font-family="Segoe UI, system-ui, sans-serif">
                      ${n.roomId}
                    </text>
                  ` : null}
                </g>
              `)}
            </svg>
          </div>
        </div>
      `;
    })}
  `;
}

// ─── Flag Editor ────────────────────────────────────────────
function FlagEditor({ sessions }) {
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [playerFlags, setPlayerFlags] = useState({});
  const [roomFlags, setRoomFlags] = useState({});
  const [roomId, setRoomId] = useState(null);
  const [newFlagName, setNewFlagName] = useState('');
  const [newFlagValue, setNewFlagValue] = useState('');
  const [newFlagScope, setNewFlagScope] = useState('player');
  const [editValues, setEditValues] = useState({});

  const refreshFlags = useCallback(async () => {
    if (!selectedPlayer) return;
    try {
      const data = await api.getFlags(selectedPlayer);
      setPlayerFlags(data.playerFlags || {});
      setRoomFlags(data.roomFlags || {});
      setRoomId(data.roomId);
      setEditValues({});
    } catch {}
  }, [selectedPlayer]);

  useEffect(() => {
    if (selectedPlayer) refreshFlags();
  }, [selectedPlayer]);

  const handleSetFlag = async (flag, value, scope) => {
    // Parse value: try JSON parse for numbers/booleans, fall back to string
    let parsed = value;
    if (value === 'true') parsed = true;
    else if (value === 'false') parsed = false;
    else if (value !== '' && !isNaN(Number(value))) parsed = Number(value);

    try {
      const result = await api.setFlag(selectedPlayer, flag, parsed, scope);
      if (result.ok) {
        showToast(`Flag "${flag}" set`);
        refreshFlags();
      } else {
        showToast(result.error || 'Failed', 'err');
      }
    } catch { showToast('Failed to set flag', 'err'); }
  };

  const handleRemoveFlag = async (flag, scope) => {
    try {
      const result = await api.removeFlag(selectedPlayer, flag, scope);
      if (result.ok) {
        showToast(`Flag "${flag}" removed`);
        refreshFlags();
      } else {
        showToast(result.error || 'Failed', 'err');
      }
    } catch { showToast('Failed to remove flag', 'err'); }
  };

  const handleAddFlag = async () => {
    if (!newFlagName.trim()) { showToast('Enter a flag name', 'err'); return; }
    await handleSetFlag(newFlagName.trim(), newFlagValue || 'true', newFlagScope);
    setNewFlagName('');
    setNewFlagValue('');
  };

  const setEditValue = (key, val) => {
    setEditValues(prev => ({ ...prev, [key]: val }));
  };

  const renderFlagTable = (flags, scope) => {
    const entries = Object.entries(flags);
    if (entries.length === 0) return html`<div class="empty">No ${scope} flags</div>`;
    return html`
      <table>
        <thead><tr><th>Flag</th><th>Value</th><th></th></tr></thead>
        <tbody>
          ${entries.map(([flag, value]) => {
            const editKey = `${scope}:${flag}`;
            const editVal = editValues[editKey];
            const displayVal = JSON.stringify(value);
            return html`
              <tr key=${editKey}>
                <td class="flag-name">${flag}</td>
                <td>
                  <input class="flag-input" value=${editVal !== undefined ? editVal : displayVal}
                    onInput=${e => setEditValue(editKey, e.target.value)}
                    onKeyDown=${e => { if (e.key === 'Enter') handleSetFlag(flag, editValues[editKey] ?? displayVal, scope); }} />
                </td>
                <td class="flag-actions">
                  <button class="btn btn-save" onClick=${() => handleSetFlag(flag, editValues[editKey] ?? displayVal, scope)}>Set</button>
                  <button class="btn btn-delete" onClick=${() => handleRemoveFlag(flag, scope)}>Del</button>
                </td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    `;
  };

  return html`
    <div class="flag-editor-header">
      <select value=${selectedPlayer} onChange=${e => setSelectedPlayer(e.target.value)}>
        <option value="">-- select player --</option>
        ${sessions.map(p => html`<option value=${p.playerId}>${p.name} (${p.playerId})</option>`)}
      </select>
      ${selectedPlayer && html`<button class="btn btn-save" onClick=${refreshFlags}>Refresh</button>`}
    </div>

    ${selectedPlayer && html`
      <div class="flag-section">
        <h3 class="flag-section-title">Player Flags</h3>
        ${renderFlagTable(playerFlags, 'player')}
      </div>

      ${roomId && html`
        <div class="flag-section">
          <h3 class="flag-section-title">Room Flags <small>(${roomId})</small></h3>
          ${renderFlagTable(roomFlags, 'room')}
        </div>
      `}

      <div class="flag-add-row">
        <input class="flag-input" placeholder="flag name" value=${newFlagName}
          onInput=${e => setNewFlagName(e.target.value)}
          onKeyDown=${e => { if (e.key === 'Enter') handleAddFlag(); }} />
        <input class="flag-input" placeholder="value (default: true)" value=${newFlagValue}
          onInput=${e => setNewFlagValue(e.target.value)}
          onKeyDown=${e => { if (e.key === 'Enter') handleAddFlag(); }} />
        <select value=${newFlagScope} onChange=${e => setNewFlagScope(e.target.value)}>
          <option value="player">player</option>
          <option value="room">room</option>
        </select>
        <button class="btn btn-save" onClick=${handleAddFlag}>Add</button>
      </div>
    `}
  `;
}

// ─── Main View ──────────────────────────────────────────────
function MainView() {
  const [sessions, setSessions] = useState([]);
  const [saves, setSaves] = useState([]);
  const [loadTargets, setLoadTargets] = useState({});
  const [quests, setQuests] = useState([]);
  const [jumpQuestId, setJumpQuestId] = useState('');
  const [jumpStepId, setJumpStepId] = useState('');
  const [jumpPlayerId, setJumpPlayerId] = useState('');

  const refreshSessions = useCallback(async () => {
    try { setSessions(await api.sessions()); } catch {}
  }, []);

  const refreshSaves = useCallback(async () => {
    try { setSaves(await api.saves()); } catch {}
  }, []);

  const refreshQuests = useCallback(async () => {
    try { setQuests(await api.quests()); } catch {}
  }, []);

  // Poll sessions every 3s
  useEffect(() => {
    refreshSessions();
    refreshSaves();
    refreshQuests();
    const interval = setInterval(refreshSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (playerId) => {
    try {
      const result = await api.save(playerId);
      if (result.ok) {
        showToast(`Saved: ${result.label}`);
        refreshSaves();
      } else {
        showToast(result.error || 'Save failed', 'err');
      }
    } catch (e) {
      showToast('Save failed', 'err');
    }
  };

  const handleLoad = async (file, label) => {
    const playerId = loadTargets[file];
    if (!playerId) { showToast('Select a player first', 'err'); return; }
    try {
      const result = await api.load(file, playerId);
      if (result.ok) {
        showToast(`Loaded: ${result.label}`);
      } else {
        showToast(result.error || 'Load failed', 'err');
      }
    } catch (e) {
      showToast('Load failed', 'err');
    }
  };

  const handleDelete = async (file) => {
    if (!confirm(`Delete checkpoint ${file}?`)) return;
    try {
      const result = await api.deleteSave(file);
      if (result.ok) {
        showToast('Deleted');
        refreshSaves();
      } else {
        showToast(result.error || 'Delete failed', 'err');
      }
    } catch (e) {
      showToast('Delete failed', 'err');
    }
  };

  const handleCommit = async () => {
    const message = prompt('Commit message:', 'Save checkpoints');
    if (!message) return;
    try {
      const result = await api.commit(message);
      if (result.ok) {
        const detail = result.prUrl ? ` — PR: ${result.prUrl}` : ` — branch: ${result.branch}`;
        showToast('Committed to git' + detail);
      } else {
        showToast(result.error || 'Commit failed', 'err');
      }
    } catch (e) {
      showToast('Commit failed', 'err');
    }
  };

  const handleQuestJump = async () => {
    if (!jumpPlayerId) { showToast('Select a player first', 'err'); return; }
    if (!jumpQuestId || !jumpStepId) { showToast('Select a quest step first', 'err'); return; }
    try {
      const result = await api.questJump(jumpPlayerId, jumpQuestId, jumpStepId);
      if (result.ok) {
        showToast(`Jumped to: ${result.quest} — ${result.step}`);
      } else {
        showToast(result.error || 'Quest jump failed', 'err');
      }
    } catch (e) {
      showToast('Quest jump failed', 'err');
    }
  };

  const selectedQuest = quests.find(q => q.id === jumpQuestId);

  const setLoadTarget = (file, playerId) => {
    setLoadTargets(prev => ({ ...prev, [file]: playerId }));
  };

  const fmtTime = (ts) => {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  };

  return html`
    <h1>Checkpoints</h1>

    <div class="toolbar">
      <button onClick=${refreshSaves}>Refresh</button>
      <button class="commit-btn" onClick=${handleCommit}>Commit to Git</button>
    </div>

    <div class="panel">
      <h2>Active Sessions</h2>
      ${sessions.length === 0
        ? html`<div class="empty">No players connected</div>`
        : html`
          <table>
            <thead><tr><th>Player</th><th>Room</th><th>HP</th><th>Energy</th><th></th></tr></thead>
            <tbody>
              ${sessions.map(s => html`
                <tr key=${s.playerId}>
                  <td>${s.name} <small style="color:#777">(${s.playerId})</small></td>
                  <td>${s.room}</td>
                  <td>${s.health}/${s.maxHealth}</td>
                  <td>${s.energy}/${s.maxEnergy}</td>
                  <td><button class="btn btn-save" onClick=${() => handleSave(s.playerId)}>Save</button></td>
                </tr>
              `)}
            </tbody>
          </table>
        `
      }
    </div>

    <div class="panel">
      <h2>Quest Jump</h2>
      ${quests.length === 0
        ? html`<div class="empty">No quests loaded</div>`
        : html`
          <div class="quest-jump-row">
            <select value=${jumpQuestId} onChange=${e => { setJumpQuestId(e.target.value); setJumpStepId(''); }}>
              <option value="">-- quest --</option>
              ${quests.map(q => html`<option value=${q.id}>${q.name}</option>`)}
            </select>
            <select value=${jumpStepId} onChange=${e => setJumpStepId(e.target.value)} disabled=${!jumpQuestId}>
              <option value="">-- step --</option>
              ${selectedQuest ? selectedQuest.steps.map(s => html`
                <option value=${s.id}>${s.label}${s.roomId ? ` (${s.roomId})` : ''}</option>
              `) : null}
            </select>
            <select value=${jumpPlayerId} onChange=${e => setJumpPlayerId(e.target.value)}>
              <option value="">-- player --</option>
              ${sessions.map(p => html`<option value=${p.playerId}>${p.name} (${p.playerId})</option>`)}
            </select>
            <button class="btn btn-jump" disabled=${!jumpPlayerId || !jumpStepId}
              onClick=${handleQuestJump}>Go</button>
          </div>
        `
      }
    </div>

    <div class="panel">
      <h2>Player Flags</h2>
      <${FlagEditor} sessions=${sessions} />
    </div>

    <div class="panel">
      <h2>Saved Checkpoints</h2>
      ${saves.length === 0
        ? html`<div class="empty">No checkpoints saved</div>`
        : html`
          <table>
            <thead><tr><th>Label</th><th>Room</th><th>Saved</th><th>Load onto</th><th></th></tr></thead>
            <tbody>
              ${saves.map(s => html`
                <tr key=${s.file}>
                  <td>${s.label}</td>
                  <td>${s.room}</td>
                  <td>${fmtTime(s.timestamp)}</td>
                  <td>
                    <select value=${loadTargets[s.file] || ''}
                      onChange=${e => setLoadTarget(s.file, e.target.value)}>
                      <option value="">-- player --</option>
                      ${sessions.map(p => html`<option value=${p.playerId}>${p.name} (${p.playerId})</option>`)}
                    </select>
                    ${' '}
                    <button class="btn btn-load" disabled=${!loadTargets[s.file]}
                      onClick=${() => handleLoad(s.file, s.label)}>Load</button>
                  </td>
                  <td><button class="btn btn-delete" onClick=${() => handleDelete(s.file)}>Delete</button></td>
                </tr>
              `)}
            </tbody>
          </table>
        `
      }
    </div>

    <div class="panel">
      <h2>Quest Progression</h2>
      <${QuestDAG} quests=${quests} />
    </div>
  `;
}

// ─── App Shell ──────────────────────────────────────────────
function App() {
  const [authed, setAuthed] = useState(null); // null=loading, true, false
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    api.checkAuth().then(data => {
      setNeedsAuth(data.needsAuth);
      setAuthed(data.authenticated);
    });
    const onUnauth = () => { setAuthed(false); setNeedsAuth(true); };
    window.addEventListener('checkpoint-unauthorized', onUnauth);
    return () => window.removeEventListener('checkpoint-unauthorized', onUnauth);
  }, []);

  if (authed === null) return html`<div id="app"><p style="padding:40px;color:#777">Loading...</p></div>`;
  if (needsAuth && !authed) return html`<div id="app"><${LoginScreen} onLogin=${() => setAuthed(true)} /></div>`;
  return html`<div id="app"><${MainView} /></div>`;
}

render(html`<${App} />`, document.getElementById('app'));
