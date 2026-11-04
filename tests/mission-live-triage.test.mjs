import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { missionLiveTriage } from "../src/mission-live-triage.mjs";

const now=Date.parse("2026-11-04T04:15:00.000Z");
const old="a".repeat(40),current="b".repeat(40);
const mission={repository:"MichaelWave369/BTM",repoId:456,
  repoName:"BTM",headSha:old};
function sample(overrides={}){
  return {repository:mission.repository,repositoryId:mission.repoId,
    from:"LIVE_PUBLIC_GITHUB_API_READ_ONLY",observedAt:new Date(now-1000).toISOString(),
    headSha:current,ci:{state:"OBSERVED_GREEN_AT_HEAD",
      message:"Observed exact-head success only"},
    openPrs:[{number:42,title:"Improve XR hand tracking",draft:false,
      url:"https://github.com/MichaelWave369/BTM/pull/42",state:"open"}],
    prListPartial:false,functionallyVerified:false,mergeAuthorized:false,
    ...overrides};
}
test("R25-01 unobserved proposal is explicitly unverified and does not fetch",()=>{
  const r=missionLiveTriage(mission,null,now);
  assert.equal(r.state,"NOT_INSPECTED");
  assert.equal(r.live,false);
  assert.equal(r.currentSha,null);
  assert.equal(r.headStatus,"NOT_COMPARED");
  assert.equal(r.ciState,"UNVERIFIED");
  assert.deepEqual(r.openPrs,[]);
});
test("R25-02 live signal only accepted when repository name and numeric ID match",()=>{
  for(const changed of [
    {repository:"MichaelWave369/PhiOS"},
    {repositoryId:111},
    {from:"EXAMPLE"},
    {functionallyVerified:true},
    {mergeAuthorized:true},
    {headSha:"main"},
    {observedAt:"bad"},
    {ci:{state:"CERTIFIED_COMPLETE"}},
    {openPrs:null}
  ]){
    const r=missionLiveTriage(mission,sample(changed),now);
    assert.equal(r.state,"UNTRUSTED_SIGNAL",JSON.stringify(changed));
    assert.equal(r.live,false);
    assert.equal(r.ciState,"UNVERIFIED");
    assert.equal(r.mergeAuthorized,false);
  }
});
test("R25-03 stale cached signal is not presented as current",()=>{
  const r=missionLiveTriage(mission,sample({
    observedAt:new Date(now-16*60*1000).toISOString()
  }),now);
  assert.equal(r.state,"STALE_SIGNAL");
  assert.equal(r.live,false);
  assert.equal(r.currentSha,null);
  assert.deepEqual(r.openPrs,[]);
});
test("R25-04 source mismatch is a plan drift warning, not a repo failure",()=>{
  const r=missionLiveTriage(mission,sample(),now);
  assert.equal(r.state,"OBSERVED");
  assert.equal(r.live,true);
  assert.equal(r.headStatus,"PLAN_SHA_MOVED");
  assert.equal(r.currentSha,current);
  assert.equal(r.planSha,old);
  assert.equal(r.ciState,"OBSERVED_GREEN_AT_HEAD");
});
test("R25-05 matching source reports observation only, never release completeness",()=>{
  const r=missionLiveTriage({...mission,headSha:current},sample(),now);
  assert.equal(r.headStatus,"PLAN_SHA_MATCHES_CURRENT_HEAD");
  assert.equal(r.functionallyVerified,false);
  assert.equal(r.dispatchAuthorized,false);
  assert.equal(r.mergeAuthorized,false);
  assert.match(r.ciMessage,/not certified|unverified/i);
});
test("R25-06 missing plan SHA remains unverified even if live HEAD exists",()=>{
  const r=missionLiveTriage({...mission,headSha:null},sample(),now);
  assert.equal(r.headStatus,"PLAN_SHA_UNVERIFIED");
  assert.equal(r.planSha,null);
  assert.equal(r.ciState,"OBSERVED_GREEN_AT_HEAD");
});
test("R25-07 failed, pending and unknown workflows retain precise labels",()=>{
  for(const state of [
    "FAILED_AT_HEAD_OBSERVED","PENDING_AT_HEAD","NO_EXACT_HEAD_RUN",
    "HEAD_UNVERIFIED","RUNS_UNAVAILABLE","NON_SUCCESS_AT_HEAD"
  ]){
    const r=missionLiveTriage(mission,sample({ci:{state}}),now);
    assert.equal(r.ciState,state);
    assert.equal(r.live,true);
    assert.notEqual(r.ciMessage,"");
    assert.equal(r.mergeAuthorized,false);
  }
});
test("R25-08 refuse attacker-supplied cross-repo PR URL, retain only safe links",()=>{
  const r=missionLiveTriage(mission,sample({openPrs:[
    {number:1,url:"https://evil.com/exfil",state:"open"},
    {number:2,url:"https://github.com/MichaelWave369/PhiOS/pull/2",state:"open"},
    {number:3,url:"https://github.com/MichaelWave369/BTM/pull/3",title:"Real PR",state:"open"},
    {number:4,url:"http://github.com/MichaelWave369/BTM/pull/4",state:"open"},
    {number:5,url:"https://github.com/MichaelWave369/BTM/pull/5",state:"closed"}
  ]}),now);
  assert.deepEqual(r.openPrs.map(p=>p.number),[3]);
  assert.equal(r.openPrCountObserved,5);
});
test("R25-09 page-limit indicator never implies complete PR coverage",()=>{
  const prs=Array.from({length:10},(_,i)=>({
    number:i+1,url:"https://github.com/MichaelWave369/BTM/pull/"+(i+1),
    state:"open",title:"PR "+(i+1)
  }));
  const r=missionLiveTriage(mission,sample({openPrs:prs,prListPartial:true}),now);
  assert.equal(r.openPrs.length,3);
  assert.equal(r.openPrCountObserved,10);
  assert.equal(r.prListPartial,true);
  assert.equal(r.mergeAuthorized,false);
});
test("R25-10 never accept overlarge or malformed PR lists",()=>{
  const r=missionLiveTriage(mission,sample({openPrs:Array(11).fill({})}),now);
  assert.equal(r.state,"UNTRUSTED_SIGNAL");
  assert.deepEqual(r.openPrs,[]);
});
test("R25-11 Mission Board wires manual lookup to pre-existing safe inspector signal path",()=>{
  const board=readFileSync("src/mission-board.jsx","utf8");
  const app=readFileSync("src/main.jsx","utf8");
  assert.match(board,/missionLiveTriage\(item, signals\[item\.repoId\]\)/);
  assert.match(board,/onClick=\{\(\) => onInspectRepo\(item\.repoId\)\}/);
  assert.match(board,/Check live GitHub/);
  assert.match(board,/PLAN_SHA_MOVED/);
  assert.match(board,/Open PRs observed/);
  assert.match(app,/signals=\{signals\} signalsBusy=\{signalsBusy\} signalsError=\{signalsError\}/);
  assert.match(app,/if \(repo\) inspectLiveRepo\(repo\)/);
  assert.match(app,/const signal = await fetchRepoSignals\(repo\)/);
});
test("R25-12 public signal fetch remains on-demand and identity guarded",()=>{
  const signals=readFileSync("src/signals.mjs","utf8");
  const board=readFileSync("src/mission-board.jsx","utf8");
  assert.match(signals,/publicRepoPath\(repo\)/);
  assert.match(signals,/meta\?\.private !== false/);
  assert.match(signals,/meta\?\.id !== repo\.id/);
  assert.match(signals,/const \[head, workflows, prs\] = await Promise\.all/);
  assert.match(board,/disabled=\{loading \|\| !onInspectRepo\}/);
  assert.doesNotMatch(board,/useEffect\(/);
});
