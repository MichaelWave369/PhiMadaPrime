import test from "node:test";
import assert from "node:assert/strict";
import {ROUTING_RULES,routeProposal,routingHandoff} from "../src/thinktank-routing.mjs";

const now=Date.parse("2026-11-05T07:00:00Z");
const sha="a".repeat(40), newSha="b".repeat(40);
const repo={id:369,name:"PhiMadaPrime",full_name:"MichaelWave369/PhiMadaPrime",
  html_url:"https://github.com/MichaelWave369/PhiMadaPrime",exampleOnly:false};
const plan={type:"plan",freshness:"RECENT",generated_utc:"2026-11-05T06:59:00Z"};
function m(overrides={}){
  return {id:"369:"+sha+":test:0",repoId:369,repository:repo.full_name,repoName:repo.name,
    check:"unit_tests",summary:"Run unit tests for operator UI",priority:85,headSha:sha,
    provenance:"AGENTORA_REVIEW_ONLY_PLAN",dispatchable:false,verifiedComplete:false,...overrides};
}
function signal(overrides={}){
  return {repositoryId:369,repository:repo.full_name,headSha:sha,
    observedAt:new Date(now-1200).toISOString(),ci:{state:"OBSERVED_GREEN_AT_HEAD"},...overrides};
}
test("R36 all routing roles come from known blueprint teams",()=>{
  assert.ok(ROUTING_RULES.length>=6);
  const names=["BrainC","Vessie","Gaia","PocketBrain"];
  const result=routeProposal(m(),plan,repo,signal(),now);
  assert.ok(names.includes(result.operator));
  assert.equal(result.council,"Guardian Ori");
  assert.equal(result.bot,"Verifier Bot");
  assert.equal(result.category,"test");
  assert.equal(result.dispatched,false);
  assert.equal(result.approved,false);
  assert.equal(result.running,false);
});
test("R36 deterministic match prioritizes safety then release then test",()=>{
  const security=routeProposal(m({check:"release_security",summary:"Deploy auth permission fixes"}),plan,repo,signal(),now);
  assert.equal(security.category,"security");
  assert.equal(security.bot,"Verifier Bot");
  const release=routeProposal(m({check:"pages_release",summary:"Deploy to GitHub Pages"}),plan,repo,signal(),now);
  assert.equal(release.category,"release");
  assert.equal(release.bot,"Deploy Bot");
  const docs=routeProposal(m({check:"readme_update",summary:"Refresh documentation"}),plan,repo,signal(),now);
  assert.equal(docs.category,"documentation");
  assert.equal(docs.bot,"Doc Bot");
  const unknown=routeProposal(m({check:"misc",summary:"General review request"}),plan,repo,signal(),now);
  assert.equal(unknown.category,"manual_triage");
  assert.equal(unknown.bot,"Scout Bot");
});
test("R36 token boundaries do not mistake incidental letters for CI or auth",()=>{
  const x=routeProposal(m({check:"misc",summary:"Draft a social post for community"}),plan,repo,signal(),now);
  assert.equal(x.category,"manual_triage");
  const y=routeProposal(m({check:"readme_update",summary:"Author a documentation guide"}),plan,repo,signal(),now);
  assert.equal(y.category,"documentation");
  const z=routeProposal(m({check:"ci_pipeline",summary:"Review pipeline status"}),plan,repo,signal(),now);
  assert.equal(z.category,"test");
});
test("R36 fresh, matching HEAD permits only a human review stage, never execution",()=>{
  const x=routeProposal(m(),plan,repo,signal(),now);
  assert.equal(x.headStatus,"HEAD_MATCH_OBSERVED");
  assert.equal(x.evidenceGate,"READY_FOR_HUMAN_REVIEW");
  assert.equal(x.ciState,"OBSERVED_GREEN_AT_HEAD");
  assert.equal(x.approved,false);
});
test("R36 stale, unknown, moved and missing source HEAD all fail closed",()=>{
  assert.equal(routeProposal(m(),plan,repo,null,now).headStatus,"NOT_INSPECTED");
  assert.equal(routeProposal(m(),plan,repo,signal({headSha:newSha}),now).headStatus,"HEAD_MOVED");
  assert.equal(routeProposal(m(),plan,repo,signal({observedAt:new Date(now-3600000).toISOString()}),now).headStatus,"OBSERVATION_STALE");
  assert.equal(routeProposal(m(),plan,repo,signal({repositoryId:42}),now).headStatus,"NOT_INSPECTED");
  assert.equal(routeProposal(m(),plan,repo,signal({headSha:null}),now).headStatus,"CURRENT_HEAD_UNKNOWN");
  assert.equal(routeProposal(m({headSha:null}),plan,repo,signal(),now).headStatus,"PLAN_HEAD_UNKNOWN");
  for(const choice of [
    routeProposal(m(),plan,repo,null,now),
    routeProposal(m(),plan,repo,signal({headSha:newSha}),now),
    routeProposal(m(),{...plan,freshness:"STALE"},repo,signal(),now)
  ])assert.equal(choice.evidenceGate,"RECHECK_REQUIRED");
});
test("R36 rejects fabricated mission provenance, actual dispatch flags and catalog mismatches",()=>{
  assert.throws(()=>routeProposal(m({provenance:"LIVE_EXECUTION"}),plan,repo,signal(),now),/UNTRUSTED/);
  assert.throws(()=>routeProposal(m({dispatchable:true}),plan,repo,signal(),now),/UNTRUSTED/);
  assert.throws(()=>routeProposal(m({verifiedComplete:true}),plan,repo,signal(),now),/UNTRUSTED/);
  assert.throws(()=>routeProposal(m(),{...plan,type:"audit"},repo,signal(),now),/UNTRUSTED/);
  assert.throws(()=>routeProposal(m(),plan,{...repo,exampleOnly:true},signal(),now),/UNTRUSTED/);
  assert.throws(()=>routeProposal(m(),plan,{...repo,full_name:"MichaelWave369/Other"},signal(),now),/UNTRUSTED/);
  assert.throws(()=>routeProposal(m(),plan,{...repo,id:999},signal(),now),/UNTRUSTED/);
});
test("R36 handoff explicitly includes the canonical human-reviewed Agentora message",()=>{
  const t=routingHandoff(m(),plan,repo,signal(),now);
  assert.match(t,/DETERMINISTIC SUGGESTION ONLY/);
  assert.match(t,/NOT DISPATCHED/);
  assert.match(t,/HEAD_MATCH_OBSERVED/);
  assert.match(t,/AGENTORA|PROPOSED REVIEW HANDOFF/i);
  assert.match(t,/MANUAL REVIEW REQUIRED BEFORE ANY EXECUTION/);
  assert.match(t,/No automatic|NO AUTOMATIC/);
  assert.match(t,/Verifier Bot/);
});
