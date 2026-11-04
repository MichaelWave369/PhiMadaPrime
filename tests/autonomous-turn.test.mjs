import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto,createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { canonical,prepareTurnTask,turnTaskDigest,readTurnResult,listTurnPrs,
  TURN_REPO,TURN_REPO_ID } from "../src/autonomous-turn.mjs";

const NOW=Date.parse("2026-11-04T09:00:00Z"),SOURCE="a".repeat(40),HEAD="b".repeat(40);
const CONTROL=SOURCE,MERGE="d".repeat(40),OWNER=247459237;
const DOC="docs/DEVELOPMENT_LOOP_R2_CODE_AND_HANDOFF.md";
const TEXT="# Review\nThe author cannot count as the independent reviewer.\n";
const REPO={id:TURN_REPO_ID,name:"Agentora",full_name:TURN_REPO};
const META={...REPO,private:false,archived:false,default_branch:"main",owner:{id:OWNER}};
const signal={repositoryId:TURN_REPO_ID,repository:TURN_REPO,from:"LIVE_PUBLIC_GITHUB_API_READ_ONLY",
  headSha:SOURCE,defaultBranch:"main",observedAt:new Date(NOW).toISOString()};
const response=value=>({ok:true,text:async()=>JSON.stringify(value),json:async()=>structuredClone(value)});
function prepFetcher(calls=[],mutate=x=>x) {
  return async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith("/Agentora"))return response(mutate(structuredClone(META)));
    if(url.includes("/git/ref/"))return response({object:{sha:SOURCE}});
    if(url.includes("/contents/")) {
      const content=url.includes("Nav.tsx")?"import { Link } from 'react-router-dom'\n":TEXT;
      return response({type:"file",encoding:"base64",size:Buffer.byteLength(content),content:Buffer.from(content).toString("base64")});
    }
    throw Error("unexpected fixture path "+url);
  };
}
async function fixture({merged=true}={}) {
  const prepared=await prepareTurnTask(REPO,signal,"docs",{fetcher:prepFetcher(),crypto:webcrypto,now:NOW});
  const t=prepared.task,digest=prepared.digest;
  const pr={number:99,merged,merged_at:merged?new Date(NOW).toISOString():null,
    merge_commit_sha:merged?MERGE:null,state:merged?"closed":"open",
    base:{ref:"main",repo:META},head:{ref:`autonomous/r1/${t.task_id}-11`,repo:META,sha:HEAD}};
  const receipt={schema:"agentora.autonomous-turn-receipt.v1",task_id:t.task_id,task_sha256:digest,
    repository:TURN_REPO,repository_id:TURN_REPO_ID,source_sha:SOURCE,pr_number:99,tested_pr_sha:HEAD,
    authorization:{run_id:11,task_sha256:digest,control_sha:CONTROL,environment_id:123,owner_id:OWNER},
    project_verified_complete:false,repair_attempts:0,outstanding_acceptance:t.acceptance,
    merge_commit_sha:merged?MERGE:null,state:merged?"MERGED":"AUTOMATED_CHECKS_PASSED",
    merge_decision:merged?"EXACT_TASK_DOCS_SQUASH_MERGED":"HELD_INDEPENDENT_CODE_REVIEW_REQUIRED",
    next_action:"Review outstanding acceptance",run_url:`https://github.com/${TURN_REPO}/actions/runs/11`};
  const records={
    root:META,pr,receipt,task:t,
    run:{id:11,head_sha:CONTROL,repository:META,head_branch:"main",event:"issues",run_attempt:1,
      path:".github/workflows/autonomous-turn-r1.yml",actor:{id:OWNER},triggering_actor:{id:OWNER}},
    reviews:[{state:"approved",comment:"APPROVE "+digest,user:{id:OWNER,type:"User"},
      environments:[{name:"autonomous-turn-owner",id:123}]}],
    jobs:{total_count:1,jobs:[{name:"merge-gate",status:"completed",conclusion:"success"}]},
    commit:{sha:MERGE,parents:[{sha:SOURCE}]},ciRun:{head_sha:HEAD,repository:META,event:"pull_request",path:".github/workflows/ci.yml"},
    ci:["backend (3.12)","backend (3.13)","web"].map((name,i)=>({name,id:i+1,
      head_sha:HEAD,status:"completed",conclusion:"success",app:{id:15368,slug:"github-actions"},
      details_url:`https://github.com/${TURN_REPO}/actions/runs/22/job/${i+1}`})),
    check:{name:"Autonomous Turn R1 receipt",head_sha:HEAD,status:"completed",conclusion:merged?"success":"neutral",
      app:{id:15368,slug:"github-actions"},external_id:digest,
      details_url:`https://github.com/${TURN_REPO}/actions/runs/11`}
  };
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith("/Agentora"))return response(records.root);
    if(url.endsWith("/pulls/99"))return response(records.pr);
    if(url.includes("/check-runs?")) {
      const check={...records.check,output:{text:JSON.stringify({task:records.task,receipt:records.receipt})}};
      return response({total_count:records.ci.length+1,check_runs:[...records.ci,check]});
    }
    if(url.endsWith("/actions/runs/11"))return response(records.run);
    if(url.endsWith("/approvals"))return response(records.reviews);
    if(url.includes("/jobs?"))return response(records.jobs);
    if(url.endsWith("/actions/runs/22"))return response(records.ciRun);
    if(url.endsWith("/commits/"+MERGE))return response(records.commit);
    throw Error("unexpected fixture path "+url);
  };
  return {records,fetcher,calls,prepared};
}

test("R1 task digest is domain-separated and matches Python ASCII canonical form",async()=>{
  assert.equal(canonical({z:"Φ🙂",a:1}),'{"a":1,"z":"\\u03a6\\ud83d\\ude42"}');
  const t={hello:"Φ🙂"};
  assert.equal(await turnTaskDigest(t,webcrypto),createHash("sha256").update(
    "agentora.autonomous-task.v1\n"+canonical(t)).digest("hex"));
});
test("R1 prepares useful exact-source task as untrusted issue intake with GETs only",async()=>{
  const calls=[];
  const p=await prepareTurnTask(REPO,signal,"docs",{fetcher:prepFetcher(calls),crypto:webcrypto,now:NOW});
  assert.equal(p.task.repository_id,TURN_REPO_ID);
  assert.equal(p.task.source_sha,SOURCE);
  assert.deepEqual(p.task.allowed_paths,[DOC]);
  assert.equal(p.task.merge_policy,"docs");
  assert.equal(p.task.max_repairs,0);
  assert.equal(p.task.edits[0].before_sha256,createHash("sha256").update(TEXT).digest("hex"));
  const url=new URL(p.submissionUrl);
  assert.equal(url.origin,"https://github.com");
  assert.equal(url.pathname,"/MichaelWave369/Agentora/issues/new");
  assert.equal(url.searchParams.get("body"),p.json);
  assert.equal(p.task.operator_approved,undefined);
  assert.equal(calls.filter(c=>c.url.includes("/git/ref/")).length,2);
  for(const {options} of calls) {
    assert.equal(options.method,"GET");assert.equal(options.credentials,"omit");
    assert.equal(options.headers.Authorization,undefined);
  }
});
test("R1 code task retains reviewed-code policy and single Nav file",async()=>{
  const p=await prepareTurnTask(REPO,signal,"code",{fetcher:prepFetcher(),crypto:webcrypto,now:NOW});
  assert.equal(p.task.merge_policy,"reviewed-code");
  assert.deepEqual(p.task.allowed_paths,["web/src/components/Nav.tsx"]);
  assert.match(p.task.edits[0].new,/NavLink/);
});
test("R1 refuses stale source, wrong numeric identity, unsafe lineage and source drift",async()=>{
  for(const [repo,sig,opts,code] of [
    [{...REPO,id:1},signal,{},"FIXED_REPOSITORY_REQUIRED"],
    [REPO,{...signal,observedAt:new Date(NOW-3600000).toISOString()},{},"FRESH_EXACT_SOURCE_REQUIRED"],
    [REPO,signal,{requestSha256:"fake"},"REQUEST_LINEAGE"],
    [REPO,signal,{fetcher:prepFetcher([],r=>({...r,id:1}))},"REPOSITORY_IDENTITY"],
    [REPO,{...signal,headSha:HEAD},{},"SOURCE_DRIFT"]
  ]) await assert.rejects(prepareTurnTask(repo,sig,"docs",{fetcher:prepFetcher(),crypto:webcrypto,now:NOW,...opts}),new RegExp(code));
});
test("R1 live record correlation distinguishes a merge from project completion",async()=>{
  const f=await fixture();
  const r=await readTurnResult(99,{fetcher:f.fetcher,crypto:webcrypto});
  assert.equal(r.state,"MERGED");assert.equal(r.mergeSha,MERGE);
  assert.equal(r.testedSha,HEAD);assert.equal(r.projectVerifiedComplete,false);
  assert.equal(r.outstandingAcceptance.length,1);
  assert.equal(r.observation,"LIVE_GITHUB_RECORDS_CORRELATED");
  assert.ok(f.calls.some(c=>c.url.endsWith("/approvals")));
  assert.ok(f.calls.some(c=>c.url.endsWith("/commits/"+MERGE)));
  assert.equal(f.calls.filter(c=>c.url.endsWith("/pulls/99")).length,2);
  assert.ok(f.calls.every(c=>c.options.method==="GET"&&!c.options.headers.Authorization));
});
test("R1 open reviewed PR with green CI has checks-passed state only",async()=>{
  const f=await fixture({merged:false});
  const r=await readTurnResult(99,{fetcher:f.fetcher,crypto:webcrypto});
  assert.equal(r.state,"AUTOMATED_CHECKS_PASSED");assert.equal(r.mergeSha,null);
});
test("R1 rejects forged check, approval, run, digest, SHA, job and merge evidence",async()=>{
  const mutations=[
    r=>{r.check.app.id=123;},r=>{r.check.head_sha=SOURCE;},r=>{r.check.external_id="0".repeat(64);},
    r=>{r.reviews[0].user.id=1;},r=>{r.reviews[0].comment="APPROVE anything";},
    r=>{r.reviews[0].state="rejected";},r=>{r.reviews[0].environments[0].id=1;},
    r=>{r.run.run_attempt=2;},r=>{r.run.head_branch="feature";},r=>{r.run.actor.id=1;},
    r=>{r.run.path=".github/workflows/fake.yml";},r=>{r.task.human_scope="changed after approval";},
    r=>{r.jobs.jobs[0].conclusion="failure";},r=>{r.ci[0].head_sha=SOURCE;},
    r=>{r.ci[0].conclusion="failure";},r=>{r.ciRun.path=".github/workflows/fake.yml";},
    r=>{r.pr.merged=false;},r=>{r.commit.parents[0].sha="e".repeat(40);},
    r=>{r.receipt.project_verified_complete=true;}
  ];
  for(const mutate of mutations) {
    const f=await fixture();mutate(f.records);
    await assert.rejects(readTurnResult(99,{fetcher:f.fetcher,crypto:webcrypto}),/TURN_/);
  }
});
test("R1 recent task discovery is bounded and never follows external PR URLs",async()=>{
  const f=await fixture(),calls=[];
  const fetcher=async(url,options)=>{
    calls.push(url);
    if(url.endsWith("/Agentora"))return response(META);
    return response([{...f.records.pr,title:"Real candidate",html_url:"https://evil.invalid"},
      {...f.records.pr,number:100,head:{...f.records.pr.head,repo:{id:1}}}]);
  };
  const rows=await listTurnPrs({fetcher});
  assert.equal(rows.length,1);assert.equal(rows[0].url,`https://github.com/${TURN_REPO}/pull/99`);
  assert.equal(calls.length,2);
});
test("R1 UI is mounted inside existing lane and describes actual owner action",()=>{
  const lane=readFileSync("src/completion-lane.jsx","utf8"),ui=readFileSync("src/autonomous-turn.jsx","utf8");
  assert.match(lane,/<AutonomousTurn/);assert.match(lane,/<AgentoraR03Return/);
  for(const text of ["Submit this task request in GitHub","APPROVE {task.digest}","Project verified complete",
    "Final tested PR SHA","Repair attempts","Verify returned result against GitHub"])
    assert.ok(ui.includes(text),text);
  assert.doesNotMatch(ui,/localStorage\.setItem|Authorization:|dangerouslySetInnerHTML/);
});
