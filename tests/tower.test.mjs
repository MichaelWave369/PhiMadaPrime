import test from "node:test";
import assert from "node:assert/strict";
import { FLAGSHIPS, DESKS_PER_FLOOR } from "../src/fleet.mjs";
import { towerFloors, floorForId, floorDirectory, wingForRepo, WINGS } from "../src/tower.mjs";

function repo(name, index, description = "") {
  return { name, id: index + 1, description, exampleOnly: false };
}
test("bridge keeps curated flagship desks and every repo appears exactly once", () => {
  const names = [...FLAGSHIPS, ...Array.from({ length: 235 }, (_, i) => "Other" + i)];
  const rows = names.map((name, i) => repo(name, i));
  const floors = towerFloors(rows);
  assert.equal(floors[0].title, "Command Bridge");
  assert.equal(floors[0].wing, "bridge");
  assert.deepEqual(floors[0].stations.map(r => r?.name), FLAGSHIPS);
  assert(floors.length >= Math.ceil(rows.length / 12));
  assert(floors.every(f => f.stations.length === DESKS_PER_FLOOR));
  const actual = floors.flatMap(f => f.stations.filter(Boolean).map(r => r.id));
  assert.equal(actual.length, rows.length);
  assert.equal(new Set(actual).size, rows.length);
  const lastInputFloor = floorForId(floors, rows.at(-1).id);
  assert(Number.isInteger(lastInputFloor) && lastInputFloor >= 1);
  assert(floors[lastInputFloor - 1].stations.some(r => r?.id === rows.at(-1).id));
  assert.equal(floorForId(floors, -999), null);
});

test("editorial wings produce themed groupings without altering actual repos", () => {
  const rows = [
    repo("Agentora", 0),
    repo("AwesomeQuest", 1, "VR WebXR Quest hand tracking"),
    repo("DungeonDragon", 2, "A browser RPG game"),
    repo("HypothesisLab", 3, "Experiments and reproducible research"),
    repo("WaveSound", 4, "Music and audio production"),
    repo("SecureBridge", 5, "Backend network runtime"),
    repo("Oddity", 6, "")
  ];
  assert.equal(wingForRepo(rows[1]), "vr");
  assert.equal(wingForRepo(rows[2]), "games");
  assert.equal(wingForRepo(rows[3]), "research");
  assert.equal(wingForRepo(rows[4]), "creative");
  assert.equal(wingForRepo(rows[5]), "infrastructure");
  assert.equal(wingForRepo(rows[6]), "other");
  const floors = towerFloors(rows);
  const wingSet = new Set(floors.map(f => f.wing));
  assert(wingSet.has("bridge"));
  assert(wingSet.has("vr"));
  assert(wingSet.has("games"));
  assert(wingSet.has("research"));
  assert(wingSet.has("creative"));
  assert(wingSet.has("infrastructure"));
  assert(wingSet.has("other"));
  assert(floors.every(f => f.count <= 12));
  assert(floorDirectory(floors).every(f => typeof f.title === "string"));
  assert(WINGS.every(w => typeof w.motto === "string" && w.motto));
});

test("search mode preserves matching rows and creates only twelve-station decks", () => {
  const rows = Array.from({ length: 25 }, (_, i) => repo("Widget" + i, i));
  const result = towerFloors(rows, "Widget");
  assert.equal(result.length, 3);
  assert(result.every(f => f.wing === "search"));
  assert.equal(result.at(-1).count, 1);
  assert.equal(result.at(-1).stations.filter(x => x === null).length, 11);
  assert.deepEqual(result.flatMap(f => f.stations.filter(Boolean).map(r => r.id)),
    rows.map(r => r.id));
});

test("empty catalog and no results are visually safe, not a fake populated floor", () => {
  const rows = towerFloors([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 0);
  assert(rows[0].stations.every(x => x === null));
  const search = towerFloors([], "missing");
  assert.equal(search[0].title, "Search Results");
});

test("only editorial hints, not evidence of executable cross-repo integrations", () => {
  assert.equal(wingForRepo(repo("BTM", 0)), "games");
  assert.equal(wingForRepo(repo("SparkTheSubstrate", 1)), "vr");
  assert.equal(wingForRepo(repo("PhiOS", 2)), "core");
});
