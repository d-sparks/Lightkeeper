const fs = require('fs');
const path = require('path');
const DungeonGenerator = require('./dungeon-generator');

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

  // --- Procedural Templates ---
  if (url === '/api/editor/templates' && method === 'GET') {
    const templates = listJSONFiles(path.join(CONTENT_DIR, 'dungeons', 'templates'));
    const summaries = templates.map(t => ({
      id: t.id, name: t.namePattern || t.id, type: 'procedural', depth: t.depth
    }));
    return json(res, 200, summaries);
  }

  const templateMatch = url.match(/^\/api\/editor\/templates\/([a-zA-Z0-9_-]+)$/);
  if (templateMatch) {
    const id = templateMatch[1];
    const filePath = path.join(CONTENT_DIR, 'dungeons', 'templates', `${id}.json`);

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
  }

  // POST /api/editor/templates/:id/generate - run procedural generation, save as hand-authored dungeon
  const templateGenMatch = url.match(/^\/api\/editor\/templates\/([a-zA-Z0-9_-]+)\/generate$/);
  if (templateGenMatch && method === 'POST') {
    const templateId = templateGenMatch[1];
    const templatePath = path.join(CONTENT_DIR, 'dungeons', 'templates', `${templateId}.json`);
    if (!fs.existsSync(templatePath)) return json(res, 404, { error: 'Template not found' });

    return parseBody(req).then(body => {
      if (!body.id) return json(res, 400, { error: 'Missing dungeon id' });
      const safeId = body.id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (safeId !== body.id) return json(res, 400, { error: 'Invalid id characters' });

      const dungeonPath = path.join(CONTENT_DIR, 'dungeons', `${safeId}.json`);
      if (fs.existsSync(dungeonPath)) return json(res, 409, { error: 'Dungeon already exists' });

      const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
      const depth = Number(body.depth) || (template.depth ? template.depth.min : 1);
      const seed = body.seed || `editor_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const generator = new DungeonGenerator(null);
      const context = {
        fromDungeon: 'editor',
        exitX: 0,
        exitY: 0,
        depth,
        serverEpoch: seed,
      };

      const result = generator.generate(template, context);
      if (!result) return json(res, 500, { error: 'Generation failed after 3 attempts' });

      const dungeon = result.dungeon;
      dungeon.id = safeId;
      dungeon.name = body.name || dungeon.name;
      // Clean up procedural exit references — replace template self-references with placeholder
      if (dungeon.exits) {
        for (const exit of dungeon.exits) {
          if (exit.leadsTo === template.id) {
            exit.leadsTo = '';
          }
          if (exit.leadsTo === 'editor') {
            exit.leadsTo = '';
          }
        }
      }
      // Remove depth field from exits (procedural-only concept)
      if (dungeon.exits) {
        for (const exit of dungeon.exits) {
          delete exit.depth;
        }
      }

      fs.writeFileSync(dungeonPath, JSON.stringify(dungeon, null, 2));
      return json(res, 201, dungeon);
    }).catch(e => json(res, 400, { error: e.message || 'Invalid request' }));
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

  if (url === '/api/editor/npcs' && method === 'PUT') {
    return parseBody(req).then(data => {
      const filePath = path.join(CONTENT_DIR, 'entities', 'npcs.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return json(res, 200, data);
    }).catch(() => json(res, 400, { error: 'Invalid JSON' }));
  }

  // --- Items ---
  if (url === '/api/editor/items' && method === 'GET') {
    const filePath = path.join(CONTENT_DIR, 'entities', 'items.json');
    if (!fs.existsSync(filePath)) return json(res, 200, {});
    return json(res, 200, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }

  if (url === '/api/editor/items' && method === 'PUT') {
    return parseBody(req).then(data => {
      const filePath = path.join(CONTENT_DIR, 'entities', 'items.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return json(res, 200, data);
    }).catch(() => json(res, 400, { error: 'Invalid JSON' }));
  }

  // --- Tilesets (PUT) ---
  const tilesetMatch = url.match(/^\/api\/editor\/tilesets\/([a-zA-Z0-9_-]+)$/);
  if (tilesetMatch && method === 'PUT') {
    const id = tilesetMatch[1];
    return parseBody(req).then(data => {
      data.id = id;
      const filePath = path.join(CONTENT_DIR, 'tilesets', `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return json(res, 200, data);
    }).catch(() => json(res, 400, { error: 'Invalid JSON' }));
  }

  // --- Scripting: Dungeon triggers ---
  // GET /api/editor/dungeons/:id/triggers - get triggers for a dungeon
  const triggerGetMatch = url.match(/^\/api\/editor\/dungeons\/([a-zA-Z0-9_-]+)\/triggers$/);
  if (triggerGetMatch && method === 'GET') {
    const id = triggerGetMatch[1];
    const filePath = path.join(CONTENT_DIR, 'dungeons', `${id}.json`);
    if (!fs.existsSync(filePath)) return json(res, 404, { error: 'Dungeon not found' });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return json(res, 200, data.triggers || []);
  }

  // PUT /api/editor/dungeons/:id/triggers - replace triggers for a dungeon
  if (triggerGetMatch && method === 'PUT') {
    const id = triggerGetMatch[1];
    const filePath = path.join(CONTENT_DIR, 'dungeons', `${id}.json`);
    if (!fs.existsSync(filePath)) return json(res, 404, { error: 'Dungeon not found' });
    return parseBody(req).then(triggers => {
      if (!Array.isArray(triggers)) return json(res, 400, { error: 'Triggers must be an array' });
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      data.triggers = triggers;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return json(res, 200, data.triggers);
    }).catch(() => json(res, 400, { error: 'Invalid JSON' }));
  }

  // --- Settings ---
  if (url === '/api/editor/settings' && method === 'GET') {
    const filePath = path.join(CONTENT_DIR, 'settings.json');
    if (!fs.existsSync(filePath)) return json(res, 200, {});
    return json(res, 200, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }

  if (url === '/api/editor/settings' && method === 'PUT') {
    return parseBody(req).then(data => {
      const filePath = path.join(CONTENT_DIR, 'settings.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return json(res, 200, data);
    }).catch(() => json(res, 400, { error: 'Invalid JSON' }));
  }

  // --- Scripting: Reference data ---
  // GET /api/editor/scripting/events - list available event types
  if (url === '/api/editor/scripting/events' && method === 'GET') {
    return json(res, 200, {
      events: [
        { id: 'item_picked_up', description: 'Player picks up a ground item', payloadFields: ['itemType', 'itemName'] },
        { id: 'monster_killed', description: 'Player kills a monster', payloadFields: ['monsterType', 'monsterId'] },
        { id: 'npc_interacted', description: 'Player talks to an NPC', payloadFields: ['npcType', 'npcId'] },
        { id: 'door_interacted', description: 'Player opens/closes a door', payloadFields: ['tileX', 'tileY'] },
        { id: 'room_entered', description: 'Player enters a room', payloadFields: ['dungeonId'] },
        { id: 'player_death', description: 'Player dies', payloadFields: [] },
        { id: 'flag_changed', description: 'A flag value changed', payloadFields: ['flag', 'value', 'scope'] },
      ],
      conditionTypes: [
        { id: 'hasFlag', description: 'Check if a flag is set (truthy) or equals a value', fields: ['hasFlag', 'value?', 'scope?'] },
        { id: 'hasItem', description: 'Check if player has an item type in inventory', fields: ['hasItem'] },
        { id: 'flagGreaterThan', description: 'Check if a numeric flag is greater than a value', fields: ['flag', 'value', 'scope?'] },
        { id: 'flagLessThan', description: 'Check if a numeric flag is less than a value', fields: ['flag', 'value', 'scope?'] },
        { id: 'and', description: 'All sub-conditions must be true', fields: ['conditions[]'] },
        { id: 'or', description: 'At least one sub-condition must be true', fields: ['conditions[]'] },
        { id: 'not', description: 'Negate a sub-condition', fields: ['condition'] },
      ],
      actionTypes: [
        { id: 'setFlag', description: 'Set a flag value', fields: ['flag', 'value?', 'scope?'] },
        { id: 'removeFlag', description: 'Remove a flag', fields: ['flag', 'scope?'] },
        { id: 'incrementFlag', description: 'Add to a numeric flag', fields: ['flag', 'amount?', 'scope?'] },
        { id: 'setDialogue', description: 'Change an NPC\'s active dialogue set', fields: ['npc', 'dialogueId'] },
        { id: 'removeEntity', description: 'Remove an entity from the room', fields: ['entityType', 'entityId?', 'npcType?', 'monsterType?', 'itemType?'] },
        { id: 'spawnItem', description: 'Spawn a ground item', fields: ['itemType', 'x', 'y'] },
        { id: 'giveItem', description: 'Add an item to player inventory', fields: ['itemType'] },
        { id: 'removeItem', description: 'Remove an item from player inventory', fields: ['itemType'] },
        { id: 'showMessage', description: 'Show a message to the player', fields: ['text'] },
        { id: 'toggleTile', description: 'Toggle a tile (e.g. open a door)', fields: ['x', 'y'] },
        { id: 'equipItem', description: 'Equip an item from player inventory', fields: ['itemType'] },
        { id: 'setQuestObjective', description: 'Show a quest objective marker on the map', fields: ['label', 'roomId?', 'tileX?', 'tileY?'] },
        { id: 'clearQuestObjective', description: 'Remove the quest objective marker', fields: [] },
      ],
    });
  }

  // --- Quests ---
  if (url === '/api/editor/quests' && method === 'GET') {
    const quests = listJSONFiles(path.join(CONTENT_DIR, 'quests'));
    const summaries = quests.map(q => ({
      id: q.id, name: q.name, stepCount: Object.keys(q.steps || {}).length
    }));
    return json(res, 200, summaries);
  }

  const questMatch = url.match(/^\/api\/editor\/quests\/([a-zA-Z0-9_-]+)$/);
  if (questMatch) {
    const id = questMatch[1];
    const filePath = path.join(CONTENT_DIR, 'quests', `${id}.json`);

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

  if (url === '/api/editor/quests' && method === 'POST') {
    return parseBody(req).then(data => {
      if (!data.id) return json(res, 400, { error: 'Missing id' });
      const safeId = data.id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (safeId !== data.id) return json(res, 400, { error: 'Invalid id characters' });
      const dir = path.join(CONTENT_DIR, 'quests');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${safeId}.json`);
      if (fs.existsSync(filePath)) return json(res, 409, { error: 'Already exists' });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return json(res, 201, data);
    }).catch(() => json(res, 400, { error: 'Invalid JSON' }));
  }

  return false; // Not handled
}

module.exports = { handleEditorAPI };
