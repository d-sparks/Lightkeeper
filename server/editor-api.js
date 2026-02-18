const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function listJSONFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function handleEditorAPI(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method;

  // --- Dungeons ---
  if (url === '/api/editor/dungeons' && method === 'GET') {
    const dungeons = listJSONFiles(path.join(CONTENT_DIR, 'dungeons'));
    const summaries = dungeons.map(d => ({
      id: d.id, name: d.name, depth: d.depth, width: d.width, height: d.height
    }));
    return json(res, 200, summaries);
  }

  const dungeonMatch = url.match(/^\/api\/editor\/dungeons\/([a-zA-Z0-9_-]+)$/);
  if (dungeonMatch) {
    const id = dungeonMatch[1];
    const filePath = path.join(CONTENT_DIR, 'dungeons', `${id}.json`);

    if (method === 'GET') {
      if (!fs.existsSync(filePath)) return json(res, 404, { error: 'Not found' });
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return json(res, 200, data);
    }

    if (method === 'PUT') {
      return parseBody(req).then(data => {
        data.id = id;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return json(res, 200, data);
      }).catch(() => json(res, 400, { error: 'Invalid JSON' }));
    }

    if (method === 'DELETE') {
      if (!fs.existsSync(filePath)) return json(res, 404, { error: 'Not found' });
      fs.unlinkSync(filePath);
      return json(res, 200, { deleted: id });
    }
  }

  if (url === '/api/editor/dungeons' && method === 'POST') {
    return parseBody(req).then(data => {
      if (!data.id) return json(res, 400, { error: 'Missing id' });
      // Sanitize id to prevent directory traversal
      const safeId = data.id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (safeId !== data.id) return json(res, 400, { error: 'Invalid id characters' });
      const filePath = path.join(CONTENT_DIR, 'dungeons', `${safeId}.json`);
      if (fs.existsSync(filePath)) return json(res, 409, { error: 'Already exists' });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return json(res, 201, data);
    }).catch(() => json(res, 400, { error: 'Invalid JSON' }));
  }

  // --- Tilesets ---
  if (url === '/api/editor/tilesets' && method === 'GET') {
    const tilesets = listJSONFiles(path.join(CONTENT_DIR, 'tilesets'));
    return json(res, 200, tilesets);
  }

  // --- Entities ---
  if (url === '/api/editor/monsters' && method === 'GET') {
    const filePath = path.join(CONTENT_DIR, 'entities', 'monsters.json');
    if (!fs.existsSync(filePath)) return json(res, 200, {});
    return json(res, 200, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }

  if (url === '/api/editor/npcs' && method === 'GET') {
    const filePath = path.join(CONTENT_DIR, 'entities', 'npcs.json');
    if (!fs.existsSync(filePath)) return json(res, 200, {});
    return json(res, 200, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }

  return false; // Not handled
}

module.exports = { handleEditorAPI };
