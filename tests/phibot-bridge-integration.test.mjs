import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const base=new URL("../src/",import.meta.url);
test("R35 bridge is actually wired into current Mission Board",async()=>{
  const board=await readFile(new URL("mission-board.jsx",base),"utf8");
  const crew=await readFile(new URL("phibot-crew-deck.jsx",base),"utf8");
  const bridge=await readFile(new URL("phibot-bridge.jsx",base),"utf8");
  assert.match(board,/<PhiBotCrewDeck catalog=\{catalog\} \/>/);
  assert.match(crew,/import \{PhiBotQueueBridge\} from "\.\/phibot-bridge\.jsx"/);
  assert.match(crew,/<PhiBotQueueBridge catalog=\{catalog\} \/>/);
  assert.match(bridge,/type="file"/);
  assert.match(bridge,/setSnapshot\(validateQueueExport\(raw,catalog\)\)/);
  assert.doesNotMatch(bridge,/https?:\/\/127\.0\.0\.1|localhost|Authorization:/);
});
