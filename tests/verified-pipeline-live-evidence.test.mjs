import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pipelineTemplate} from "../src/verified-pipeline.mjs";
import {syntheticFixture} from "../src/verified-pipeline-simulator.mjs";
import {
  inspectedPublicHead,inspectLiveCiObservation
} from "../src/verified-pipeline-live-evidence.mjs";

const now=Date.parse("2026-11-05T21:30:00.000Z");
const sha="a".repeat(40),other="b".repeat(40);
const repo={id:369,name:"BTM",full_name:"MichaelWave369/BTM",
  html_url:"https://github.com/MichaelWave369/BTM",exampleOnly:false};
function signal(overrides={}){
  return {
    repository:repo.full_name,repositoryId:repo.id,
    observedAt:new Date(now-15_000).toISOString(),
    defaultBranch:"main",headSha:sha,
    ci:{state:"OBSERVED_GREEN_AT_HEAD",
      message:"Observed exact-head workflows passed; required checks not certified"},
    from:"LIVE_PUBLIC_GITHUB_API_READ_ONLY",functionallyVerified:false,
    mergeAuthorized:false,...overrides
  };
}
const audit=(s=signal(),pin=sha,r=repo,doc=pipelineTemplate())=>
  inspectLiveCiObservation(doc,r,s,pin,now);

test("R3 recent matching public HEAD reports sampled CI green only",()=>{
  const result=audit();
  assert.equal(result.state,"SAMPLED_CI_GREEN_REPORTED");
  assert.equal(result.mode,"ON_DEMAND_PUBLIC_GITHUB_READ_ONLY");
  assert.equal(result.sampled_ci_reported_green,true);
  assert.equal(result.required_checks_verified,false);
  assert.equal(result.test_commands_replayed,false);
  assert.equal(result.tests_executed_in_this_app,false);
  assert.equal(result.authentic_source_verified,false);
  assert.equal(result.human_review_completed,false);
  assert.equal(result.merge_authorized,false);
  assert.deepEqual(result.permissions,[]);
  assert.equal(result.observed_head,sha);
  assert.equal(result.expected_head,sha);
});
test("R3 refuses missing pinned SHA",()=>{
  assert.equal(audit(signal(),null).state,"HEAD_NOT_PINNED");
  assert.equal(audit(signal(),"f").state,"HEAD_NOT_PINNED");
});
test("R3 refuses absent selection and example-only repos",()=>{
  assert.equal(audit(signal(),sha,null).state,"REPO_NOT_SELECTED");
  assert.equal(audit(signal(),sha,{...repo,exampleOnly:true}).state,"REPO_UNTRUSTED");
  assert.equal(audit(signal(),sha,{...repo,full_name:"MichaelWave369/Other"}).state,"REPO_UNTRUSTED");
});
test("R3 requires current repo ID and exact repository name binding",()=>{
  assert.equal(audit(signal({repositoryId:42})).state,"FRESH_OBSERVATION_REQUIRED");
  assert.equal(audit(signal({repository:"MichaelWave369/Other"})).state,"FRESH_OBSERVATION_REQUIRED");
  assert.equal(audit(signal({from:"SYNTHETIC"})).state,"FRESH_OBSERVATION_REQUIRED");
});
test("R3 rejects synthetic lab fixtures and self-reported approval",()=>{
  assert.equal(audit(syntheticFixture()).state,"FRESH_OBSERVATION_REQUIRED");
  assert.equal(audit(signal({functionallyVerified:true})).state,"FRESH_OBSERVATION_REQUIRED");
  assert.equal(audit(signal({mergeAuthorized:true})).state,"FRESH_OBSERVATION_REQUIRED");
});
test("R3 stale observations cannot count even if reported green",()=>{
  const stale=signal({observedAt:new Date(now-16*60_000).toISOString()});
  assert.equal(audit(stale).state,"FRESH_OBSERVATION_REQUIRED");
});
test("R3 future-observation timestamps beyond clock tolerance fail closed",()=>{
  const future=signal({observedAt:new Date(now+6*60_000).toISOString()});
  assert.equal(audit(future).state,"FRESH_OBSERVATION_REQUIRED");
});
test("R3 changed branch HEAD refuses green at the old pin",()=>{
  const result=audit(signal({headSha:other}));
  assert.equal(result.state,"HEAD_MOVED_RECHECK_REQUIRED");
  assert.equal(result.sampled_ci_reported_green,false);
  assert.equal(result.observed_head,other);
  assert.equal(result.expected_head,sha);
});
test("R3 failed, pending and unknown statuses never show sampled green",()=>{
  const scenarios=[
    ["FAILED_AT_HEAD_OBSERVED","CI_FAILURE_REPORTED"],
    ["PENDING_AT_HEAD","CI_PENDING_REPORTED"],
    ["NO_EXACT_HEAD_RUN","CI_UNVERIFIED_OR_INCOMPLETE"],
    ["RUNS_UNAVAILABLE","CI_UNVERIFIED_OR_INCOMPLETE"],
    ["NON_SUCCESS_AT_HEAD","CI_UNVERIFIED_OR_INCOMPLETE"],
    ["HEAD_UNVERIFIED","CI_UNVERIFIED_OR_INCOMPLETE"]
  ];
  for(const [state,expected] of scenarios){
    const report=audit(signal({ci:{state,message:"sampled"}}));
    assert.equal(report.state,expected);
    assert.equal(report.sampled_ci_reported_green,false);
    assert.equal(report.required_checks_verified,false);
  }
});
test("R3 a failed observed run is not a verification grant",()=>{
  const result=audit(signal({ci:{state:"FAILED_AT_HEAD_OBSERVED",message:"failure"}}));
  assert.equal(result.sampled_ci_reported_failed,true);
  assert.equal(result.merge_authorized,false);
});
test("R3 unknown or malformed head and status never count",()=>{
  assert.equal(audit(signal({headSha:"garbage"})).state,"FRESH_OBSERVATION_REQUIRED");
  assert.equal(audit(signal({ci:{state:"ALL_TESTS_PASS",message:"claimed"}})).state,
    "FRESH_OBSERVATION_REQUIRED");
  assert.equal(audit(signal({ci:null})).state,"FRESH_OBSERVATION_REQUIRED");
});
test("R3 invalid graph always blocks observation even if green",()=>{
  const design=pipelineTemplate();
  design.edges.push({id:"bypass",source:"request",target:"result"});
  const report=audit(signal(),sha,repo,design);
  assert.equal(report.state,"DESIGN_INVALID");
  assert.equal(report.sampled_ci_reported_green,false);
});
test("R3 signal shape never authenticates external test command or job logs",()=>{
  const observed=inspectedPublicHead(repo,signal(),now);
  assert.equal(observed.head_sha,sha);
  assert.equal(observed.ci_state,"OBSERVED_GREEN_AT_HEAD");
  assert.equal(Object.hasOwn(observed,"test_command"),false);
  assert.equal(Object.hasOwn(observed,"run_id"),false);
  assert.equal(Object.hasOwn(observed,"verified"),false);
});
test("R3 does not accept wrong owner or private-like repo identity",()=>{
  assert.equal(inspectedPublicHead({...repo,full_name:"OtherOwner/BTM"},signal(),now),null);
  assert.equal(inspectedPublicHead({...repo,name:"../Other"},signal(),now),null);
});
test("R3 UI uses existing on-demand inspector, never direct new API fetch",()=>{
  const shell=readFileSync(new URL("../src/verified-pipeline.jsx",import.meta.url),"utf8");
  const panel=readFileSync(new URL("../src/verified-pipeline-live-evidence.jsx",import.meta.url),"utf8");
  const thinktank=readFileSync(new URL("../src/thinktank.jsx",import.meta.url),"utf8");
  assert.match(shell,/PublicCiEvidenceBridge/);
  assert.match(thinktank,/onInspectRepo=\{onInspectRepo\}/);
  assert.match(panel,/onInspectRepo\(repo\.id\)/);
  assert.match(panel,/Pin observed HEAD/);
  assert.match(panel,/design_signature/);
  assert.doesNotMatch(panel,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|dangerouslySetInnerHTML/);
});
test("R3 synthetic evaluator remains independent from live observation",()=>{
  const panel=readFileSync(new URL("../src/verified-pipeline-live-evidence.jsx",import.meta.url),"utf8");
  assert.doesNotMatch(panel,/runSyntheticScenario|fixtureForScenario|syntheticFixture/);
  const simulator=readFileSync(new URL("../src/verified-pipeline-simulator.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(simulator,/inspectLiveCiObservation|fetchRepoSignals/);
});
