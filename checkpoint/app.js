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

// ─── Main View ──────────────────────────────────────────────
function MainView() {
  const [sessions, setSessions] = useState([]);
  const [saves, setSaves] = useState([]);
  const [loadTargets, setLoadTargets] = useState({});

  const refreshSessions = useCallback(async () => {
    try { setSessions(await api.sessions()); } catch {}
  }, []);

  const refreshSaves = useCallback(async () => {
    try { setSaves(await api.saves()); } catch {}
  }, []);

  // Poll sessions every 3s
  useEffect(() => {
    refreshSessions();
    refreshSaves();
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
