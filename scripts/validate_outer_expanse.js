const d = require('../content/dungeons/outer_expanse.json');
const idx = (x, y) => y * d.width + x;
const SOLID = new Set([3, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19]);
let errs = 0;

// Check exit tiles are stairs
for (const e of d.exits) {
  const t = d.data[idx(e.x, e.y)];
  if (t !== 6 && t !== 8) { console.log('BAD EXIT TILE at', e.x, e.y, 'tile=', t); errs++; }
}

// Check monster, item, NPC, player spawns are on walkable tiles
for (const m of d.monsterSpawns) {
  if (SOLID.has(d.data[idx(m.x, m.y)])) { console.log('MONSTER ON SOLID:', m.type, '@', m.x, m.y); errs++; }
}
for (const it of d.itemSpawns) {
  if (SOLID.has(d.data[idx(it.x, it.y)])) { console.log('ITEM ON SOLID:', it.type, '@', it.x, it.y); errs++; }
}
for (const s of d.spawns) {
  if (SOLID.has(d.data[idx(s.x, s.y)])) { console.log('PLAYER SPAWN ON SOLID @', s.x, s.y); errs++; }
}
for (const n of d.npcSpawns) {
  if (SOLID.has(d.data[idx(n.x, n.y)])) { console.log('NPC ON SOLID:', n.type, '@', n.x, n.y); errs++; }
}

if (errs === 0) console.log('All positions valid!');
else console.log(errs, 'errors.');
