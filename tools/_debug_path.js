const path = require("path");
const ContentLoader = require("../server/content-loader");
const origLog = console.log;
console.log = () => {};
const content = new ContentLoader(path.join(__dirname, "..", "content"));
content.loadAll();
console.log = origLog;

const dg = content.getDungeon("perimeter_gate");
console.log("perimeter_gate exits:", JSON.stringify(dg.exits, null, 2));

// Build exit graph
const exitGraph = new Map();
const dungeons = content.getAllDungeons();
for (const [id, d] of Object.entries(dungeons)) {
  if (!exitGraph.has(id)) exitGraph.set(id, []);
  if (!d.exits) continue;
  for (const exit of d.exits) {
    exitGraph.get(id).push({ leadsTo: exit.leadsTo, exitX: exit.x, exitY: exit.y });
  }
}

// BFS from perimeter_gate to station_approach
const visited = new Set(["perimeter_gate"]);
const queue = [{ room: "perimeter_gate", p: ["perimeter_gate"] }];
let found = false;
while (queue.length > 0) {
  const { room, p } = queue.shift();
  if (room === "station_approach") {
    console.log("Path:", p.join(" -> "));
    found = true;
    break;
  }
  const exits = exitGraph.get(room) || [];
  for (const exit of exits) {
    if (visited.has(exit.leadsTo)) continue;
    visited.add(exit.leadsTo);
    queue.push({ room: exit.leadsTo, p: [...p, exit.leadsTo] });
  }
}
if (!found) console.log("No path found to station_approach");

// Also check: what is the quest cross_perimeter step asking?
console.log("\nQuest step cross_perimeter wants roomId: station_approach");
console.log("That means bot needs to navigate through perimeter_gate to get there.");

// Check: the exit at (9,0) in perimeter_gate - is tile at that pos an exit?
console.log("\nTile at exit pos (9,0):", dg.data[0 * 20 + 9], "= stairs_down (id 6)");
console.log("But the blast door at (9,1) blocks path to (9,0)");

// The A* pathing: from spawn (9,10) to exit (9,0)
// The door at (9,1) is tile 16 (blast_door, solid)
// So A* cannot find path through (9,1) unless door is opened
console.log("\nThe bot's navigate_to_room -> move_to_position goal targets the EXIT tile at (9,0)");
console.log("A* path from any walkable tile to (9,0) must go through (9,1) which is solid tile 16");
