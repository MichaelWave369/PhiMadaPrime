import test from "node:test";
import assert from "node:assert/strict";
import {AGENTS,SCENARIOS,MODES,policyDecision,runWorld} from "../src/trust-world.mjs";

test("Phi World has exactly ten fictional agents, bounded presets and no external tools",()=>{
  assert.equal(AGENTS.length,10);
  assert.equal(new Set(AGENTS.map(a=>a.id)).size,10);
  assert.equal(Object.keys(SCENARIOS).length,4);
  assert.equal(Object.keys(MODES).length,2);
  const r=runWorld();
  assert.equal(r.realModelsUsed,0);
  assert.equal(r.realToolCalls,0);
  assert.equal(r.realAuthorityGrants,0);
});
test("same seed, day count and policy produce byte-for-byte reproducible evidence",()=>{
  assert.deepEqual(runWorld({scenario:"collision",mode:"permissive",seed:369,days:12}),
    runWorld({scenario:"collision",mode:"permissive",seed:369,days:12}));
});
test("invalid mode, day count, seed and scenario fail closed",()=>{
  for(const opts of [{scenario:"../outside"},{mode:"operator"},{days:0},
    {days:16},{days:2.5},{seed:-1},{seed:"369"},{seed:1000000}])
    assert.throws(()=>runWorld(opts),/WORLD_.*_INVALID/);
});
test("enforcement denies all hostile proposals without simulated side effects",()=>{
  for(const scenario of Object.keys(SCENARIOS)){
    const r=runWorld({scenario,mode:"enforced",days:15,seed:369});
    assert.equal(r.metrics.incidents,0);
    assert.equal(r.metrics.secretsExposed,false);
    assert.equal(r.metrics.policySpoofed,false);
    assert.equal(r.metrics.auditCompromised,false);
    assert(r.events.filter(e=>e.decision==="DENIED").every(e=>e.effect==="No state change"));
    assert(r.events.every((e,i)=>e.seq===i+1));
    assert(r.agents.every(a=>a.credits>=0&&a.energy>=0));
  }
});
test("permissive comparison illustrates attacks, retains evidence even after audit tamper",()=>{
  const safe=runWorld({scenario:"collision",days:12,seed:369,mode:"enforced"});
  const unsafe=runWorld({scenario:"collision",days:12,seed:369,mode:"permissive"});
  assert(safe.metrics.denied>0);
  assert(unsafe.metrics.incidents>0);
  assert(unsafe.metrics.secretsExposed);
  assert(unsafe.metrics.policySpoofed);
  assert(unsafe.metrics.auditCompromised);
  assert(unsafe.events.some(e=>e.action==="erase_audit"&&e.decision==="ALLOWED"));
  assert(unsafe.events[0].seq===1&&unsafe.events.at(-1).seq===unsafe.events.length);
  assert(unsafe.agents.every(a=>a.credits>=0&&a.energy>=0));
});
test("cooperative scenario has no hostile activity in either policy mode",()=>{
  for(const mode of Object.keys(MODES)){
    const r=runWorld({scenario:"commons",mode,days:10,seed:4});
    assert.equal(r.metrics.survivors,10);
    assert.equal(r.metrics.incidents,0);
    assert.equal(r.metrics.attemptedUnsafe,0);
  }
});
test("independent policy refuses escalation and malformed identity",()=>{
  const state={agents:[{id:"a01",name:"Aster",alive:true,capabilities:["work"],
    credits:10,energy:10}]};
  assert.deepEqual(policyDecision(state,{actorId:"a01",type:"escalate"}, "enforced"),
    {allowed:false,reason:"INDEPENDENT_POLICY_FORBIDS_ACTION"});
  assert.equal(policyDecision(state,{actorId:"unknown",type:"work"}).allowed,false);
  assert.equal(policyDecision(state,{actorId:"a01",type:"sabotage"}).allowed,false);
  assert.equal(policyDecision(state,{actorId:"a01",type:"rest"}).allowed,false);
  assert.equal(policyDecision(state,{actorId:"a01",type:"console.log(1)"}).allowed,false);
});
