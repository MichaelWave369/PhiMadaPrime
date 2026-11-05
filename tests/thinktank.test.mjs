import test from "node:test";
import assert from "node:assert/strict";
import {OPERATORS,ORI_COUNCIL,BOT_BLUEPRINTS,observationFor,thinktankSnapshot}
  from "../src/thinktank-model.mjs";

const now=Date.parse("2026-11-04T20:00:00Z");
const repo={id:1,name:"PhiMadaPrime",full_name:"MichaelWave369/PhiMadaPrime",
  html_url:"https://github.com/MichaelWave369/PhiMadaPrime",exampleOnly:false};
function signal(overrides={}){
  return {repositoryId:1,repository:"MichaelWave369/PhiMadaPrime",
    observedAt:new Date(now-1000).toISOString(),
    headSha:"a".repeat(40),
    ci:{state:"OBSERVED_GREEN_AT_HEAD",message:"Observed CI only"},
    openPrs:[{number:2,url:"https://github.com/MichaelWave369/PhiMadaPrime/pull/2"}],
    ...overrides};
}
test("R35 maintains separate named operator and Ori council teams",()=>{
  assert.deepEqual(OPERATORS.map(x=>x.name),["Vessie","Gaia","BrainC","PocketBrain"]);
  assert.equal(ORI_COUNCIL.length,5);
  assert.equal(new Set([...OPERATORS,...ORI_COUNCIL].map(x=>x.id)).size,9);
  assert.equal(BOT_BLUEPRINTS.length,7);
  assert.ok(BOT_BLUEPRINTS.every(x=>x.role&&x.name));
});
test("R35 requires matching identity and fresh exact-repository observation",()=>{
  assert.equal(observationFor(repo,null,now).kind,"unknown");
  assert.equal(observationFor({...repo,exampleOnly:true},signal(),now).kind,"unknown");
  assert.equal(observationFor(repo,signal({repositoryId:2}),now).kind,"unknown");
  assert.equal(observationFor(repo,signal({repository:"foreign/other"}),now).kind,"unknown");
  assert.equal(observationFor(repo,signal({observedAt:new Date(now-3600000).toISOString()}),now).kind,"stale");
  assert.equal(observationFor(repo,signal(),now).kind,"observed");
  assert.equal(observationFor(repo,signal({ci:{state:"FAILED_AT_HEAD_OBSERVED"}}),now).kind,"failure");
  assert.equal(observationFor(repo,signal({ci:{state:"PENDING_AT_HEAD"}}),now).kind,"pending");
  assert.equal(observationFor(repo,signal({ci:{state:"NO_EXACT_HEAD_RUN"}}),now).kind,"unknown");
});
test("R35 never counts uninspected repos as green and never invents execution",()=>{
  const other={...repo,id:2,name:"BTM",full_name:"MichaelWave369/BTM"};
  const s=thinktankSnapshot({rows:[repo,other],signals:{1:signal()},
    missions:[{id:"m1"},{id:"m2"}],reviewed:{m1:true},pinned:{m2:true},
    catalogState:"live",now});
  assert.equal(s.totalRepos,2);
  assert.equal(s.evidenceCount,1);
  assert.equal(s.uninspected,1);
  assert.equal(s.inspected,1);
  assert.equal(s.proposalCount,2);
  assert.equal(s.reviewedCount,1);
  assert.equal(s.pinnedCount,1);
  assert.equal(s.dispatched,0);
  assert.equal(s.runningWorkersVerified,0);
  assert.equal(s.approvalsIssued,0);
});
test("R35 treats fallback examples as nonlive, even with a signal",()=>{
  const s=thinktankSnapshot({rows:[{...repo,exampleOnly:true}],
    signals:{1:signal()},catalogState:"fallback",now});
  assert.equal(s.totalRepos,null);
  assert.equal(s.evidenceCount,0);
  assert.equal(s.repos[0].observation.kind,"unknown");
});
