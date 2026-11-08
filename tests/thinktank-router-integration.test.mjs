import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

test("Mission Router and R36/R37/R38 rooms coexist in one ThinkTank",()=>{
 const shell=read("thinktank.jsx");
 for(const label of ["Mission Router","Evidence & Trust","Council Provenance","Three-Brain Ledger"]){
   assert.match(shell,new RegExp(label));
 }
 assert.match(shell,/TriBrainSnapshotViewer/);
 assert.match(shell,/MissionRouter/);
 assert.match(shell,/VesselEvidence/);
 assert.match(shell,/CouncilProvenance/);
});
test("Mainline uses validated mission board handoff and single-router navigation",()=>{
 const app=read("main.jsx");
 assert.match(app,/onOpenMissionBoard=\{\(\)\s*=>/);
 const shell=read("thinktank.jsx");
 assert.equal((shell.match(/\{page==="router"&&<MissionRouter/g)||[]).length,1);
 assert.equal((shell.match(/\{page==="tribrain"&&<TriBrainSnapshotViewer/g)||[]).length,1);
});
