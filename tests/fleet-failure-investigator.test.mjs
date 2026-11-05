import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibleFailureRepo,fleetFailureCohort,normalizeFailurePage,
  scanFleetFailures,inspectFleetFailure,failureInvestigationHandoff
} from "../src/fleet-failure-investigator.mjs";

const OWNER="MichaelWave369";
const repo={id:1443845098,name:"PhiMadaPrime",
  full_name:OWNER+"/PhiMadaPrime",exampleOnly:false};
const other={id:1167870912,name:"Agentora",
  full_name:OWNER+"/Agentora",exampleOnly:false};
const sha="a".repeat(40),head="b".repeat(40);
const base="https://api.github.com/repos/"+repo.full_name;
const base2="https://api.github.com/repos/"+other.full_name;
const run={
  id:12345,head_sha:sha,name:"PhiMada Prime CI",
  repository:{id:repo.id,full_name:repo.full_name},
  head_branch:"feature/r31",path:".github/workflows/ci.yml",
  run_attempt:1,status:"completed",conclusion:"failure",
  event:"pull_request",created_at:"2026-11-04T15:00:00Z",
  updated_at:"2026-11-04T15:01:00Z"
};
const job={id:6789,run_id:12345,run_attempt:1,head_sha:sha,
  name:"verify",status:"completed",conclusion:"failure",
  started_at:"2026-11-04T15:01:00Z",completed_at:"2026-11-04T15:02:00Z",
  steps:[
    {number:1,name:"Build",status:"completed",conclusion:"success"},
    {number:2,name:"Run tests",status:"completed",conclusion:"failure"}
  ]
};
const records={
  [base]:{id:repo.id,full_name:repo.full_name,private:false,default_branch:"main"},
  [base+"/git/ref/heads/main"]:{object:{sha:head}},
  [base+"/actions/runs?status=failure&per_page=8"]:{total_count:1,workflow_runs:[run]},
  [base+"/actions/runs/12345"]:run,
  [base+"/actions/runs/12345/jobs?per_page=50"]:{total_count:1,jobs:[job]},
  [base2]:{id:other.id,full_name:other.full_name,private:false,default_branch:"main"},
  [base2+"/git/ref/heads/main"]:{object:{sha:head}},
  [base2+"/actions/runs?status=failure&per_page=8"]:{total_count:0,workflow_runs:[]}
};
function mocked(data=records){
  const calls=[];
  const fn=async(url,opts)=>{
    calls.push({url,opts});
    assert.equal(opts.method,"GET");
    assert.equal(opts.credentials,"omit");
    assert.deepEqual(opts.headers,{Accept:"application/vnd.github+json"});
    return {ok:Object.hasOwn(data,url),json:async()=>structuredClone(data[url])};
  };
  fn.calls=calls;return fn;
}
async function scan(fetcher=mocked()){
  return scanFleetFailures([repo,other],[repo.id,other.id],{
    fetcher,now:()=>Date.parse("2026-11-04T15:03:00Z")
  });
}
test("strict public catalog cohorts: at most four distinct selected IDs",()=>{
  assert.equal(eligibleFailureRepo(repo),true);
  for(const value of [{...repo,exampleOnly:true},{...repo,id:0},
    {...repo,name:"Other"},{...repo,full_name:"random/PhiMadaPrime"}])
    assert.equal(eligibleFailureRepo(value),false);
  assert.equal(fleetFailureCohort([repo,other],[String(repo.id),other.id]).length,2);
  assert.throws(()=>fleetFailureCohort([repo],[]),/R33_COHORT_SIZE/);
  assert.throws(()=>fleetFailureCohort([repo],[repo.id,repo.id]),/R33_COHORT_ID/);
  assert.throws(()=>fleetFailureCohort([repo],[777]),/R33_COHORT_CATALOG_IDENTITY/);
  assert.throws(()=>fleetFailureCohort([repo],Array(5).fill(repo.id)),/R33_COHORT_SIZE/);
});
test("two-repo scan reports only observed GitHub failures and no full-fleet claim",async()=>{
  const fetcher=mocked(),result=await scan(fetcher);
  assert.equal(result.selectedRepos,2);
  assert.equal(result.observedRepos,2);
  assert.equal(result.failuresShown,1);
  assert.equal(result.allFleetScanned,false);
  assert.equal(result.rootCauseEstablished,false);
  assert.equal(result.readOnly,true);
  assert.equal(result.reports[0].runs[0].defaultHeadRelation,"NOT_DEFAULT_HEAD");
  assert.equal(result.reports[0].runs[0].conclusion,"failure");
  assert.equal(result.reports[1].runs.length,0);
  assert.equal(fetcher.calls.length,6);
  assert.ok(fetcher.calls.every(c=>c.url.startsWith(base)||c.url.startsWith(base2)));
});
test("foreign runs, wrong outcomes, unsafe paths and duplicate IDs are excluded",()=>{
  const bad=[
    run,{...run,id:2,conclusion:"success"},
    {...run,id:3,head_sha:"invalid"},
    {...run,id:4,path:"../../break.yml"},
    {...run,id:5,repository:{id:4,full_name:"stranger/repo"}},
    run
  ];
  const result=normalizeFailurePage({total_count:bad.length,workflow_runs:bad},
    repo,head,Date.parse("2026-11-04T15:05:00Z"));
  assert.equal(result.runs.length,1);
  assert.equal(result.excluded,5);
  assert.equal(result.partial,true);
  assert.equal(result.runs[0].url,"https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/12345");
  assert.throws(()=>normalizeFailurePage({total_count:0,workflow_runs:bad},repo,head),
    /R33_FAILURES_PAGE_INVALID/);
});
test("partial first page and exact default-head failures are distinguished",()=>{
  const rows=Array.from({length:8},(_,i)=>({...run,id:i+1,head_sha:head}));
  const page=normalizeFailurePage({total_count:8,workflow_runs:rows},repo,head);
  assert.equal(page.partial,true);
  assert.equal(page.runs[0].defaultHeadRelation,"MATCHES_DEFAULT_HEAD");
  assert.equal(page.failureFilter,"GITHUB_CONCLUSION_FAILURE_ONLY");
});
test("scanning an unavailable repository isolates the error without inventing success",async()=>{
  const data={...records};
  delete data[base2];
  const result=await scan(mocked(data));
  assert.equal(result.observedRepos,1);
  assert.equal(result.unavailableRepos,1);
  assert.equal(result.partial,true);
  assert.equal(result.reports[1].state,"UNAVAILABLE");
  assert.equal(result.failuresShown,1);
});
test("live repository owner and visibility mismatch are refused",async()=>{
  const data={...records,[base]:{...records[base],private:true}};
  const value=await scanFleetFailures([repo],[repo.id],{fetcher:mocked(data)});
  assert.equal(value.reports[0].state,"UNAVAILABLE");
  assert.match(value.reports[0].reason,/R33_LIVE_PUBLIC_REPOSITORY_IDENTITY/);
  const alias={...records,[base]:{...records[base],full_name:"other/Repo"}};
  const result=await scanFleetFailures([repo],[repo.id],{fetcher:mocked(alias)});
  assert.equal(result.observedRepos,0);
});
test("investigation rechecks immutable run + exact attempt and exposes actual failing steps",async()=>{
  const fetcher=mocked();
  const s=await scan(fetcher);
  const result=await inspectFleetFailure(s,repo.id,run.id,{fetcher});
  assert.equal(result.schema,"phimada.fleet-failure-investigation.v0.33");
  assert.equal(result.run.sha,sha);
  assert.equal(result.failingJobs,1);
  assert.equal(result.failureSteps.length,1);
  assert.equal(result.failureSteps[0].stepName,"Run tests");
  assert.equal(result.jobs.jobs[0].url,
    "https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/12345/job/6789");
  assert.equal(result.rootCauseEstablished,false);
  assert.equal(result.mergeAuthorized,false);
  assert.equal(fetcher.calls.length,10);
});
test("invalid or unobserved run ID triggers no network calls",async()=>{
  const s=await scan(),f=mocked();
  await assert.rejects(inspectFleetFailure(s,repo.id,999,{fetcher:f}),
    /R33_RUN_NOT_OBSERVED/);
  assert.equal(f.calls.length,0);
  await assert.rejects(inspectFleetFailure(s,1,run.id,{fetcher:f}),
    /R33_REPOSITORY_NOT_OBSERVED/);
  assert.equal(f.calls.length,0);
});
test("changed default HEAD or retry attempt holds before accepting job evidence",async()=>{
  const s=await scan();
  let data={...records,[base+"/git/ref/heads/main"]:{object:{sha:"f".repeat(40)}}};
  await assert.rejects(inspectFleetFailure(s,repo.id,run.id,{fetcher:mocked(data)}),
    /R33_DEFAULT_HEAD_MOVED_RESCAN/);
  data={...records,[base+"/actions/runs/12345"]:{...run,run_attempt:2}};
  await assert.rejects(inspectFleetFailure(s,repo.id,run.id,{fetcher:mocked(data)}),
    /R33_RUN_CHANGED_RESCAN/);
  data={...records,[base+"/actions/runs/12345"]:{...run,conclusion:"success"}};
  await assert.rejects(inspectFleetFailure(s,repo.id,run.id,{fetcher:mocked(data)}),
    /R33_RUN_CHANGED_RESCAN/);
});
test("partial or foreign job metadata never receives a complete status",async()=>{
  const s=await scan();
  const data={...records,[base+"/actions/runs/12345/jobs?per_page=50"]:{
    total_count:2,jobs:[job,{...job,id:3456,run_id:99}]
  }};
  const result=await inspectFleetFailure(s,repo.id,run.id,{fetcher:mocked(data)});
  assert.equal(result.partial,true);
  assert.equal(result.jobs.excluded,1);
  assert.equal(result.failureSteps.length,1);
});
test("run absence, no logs, and historical failure do not assert incident root cause",async()=>{
  const empty={...records,[base+"/actions/runs?status=failure&per_page=8"]:
    {total_count:0,workflow_runs:[]}};
  const result=await scanFleetFailures([repo],[repo.id],{fetcher:mocked(empty)});
  assert.equal(result.failuresShown,0);
  assert.equal(result.requiredChecksVerified,false);
  const s=await scan();
  const inspected=await inspectFleetFailure(s,repo.id,run.id,{fetcher:mocked()});
  const handoff=failureInvestigationHandoff(s,inspected);
  assert.match(handoff,/Failure reason\/root cause: NOT DETERMINED/);
  assert.match(handoff,new RegExp(sha));
  assert.match(handoff,/No logs downloaded/);
  assert.throws(()=>failureInvestigationHandoff(s,{...inspected,
    run:{...inspected.run,id:999}}),/R33_HANDOFF_BINDING/);
});
