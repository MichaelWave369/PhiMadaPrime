import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRunList,normalizeJobList,readRunList,readRunJobs,runObservatoryHandoff
} from "../src/run-observatory.mjs";

const repo={id:1443845098,name:"PhiMadaPrime",
  full_name:"MichaelWave369/PhiMadaPrime",exampleOnly:false};
const sha="a".repeat(40),parent="b".repeat(40),head="c".repeat(40);
const commit={sha,parentSha:parent};
const history={repository:repo.full_name,repositoryId:repo.id,headSha:head,commits:[commit]};
const bundle={schema:"phimada.commit-evidence.v0.30",
  repository:repo.full_name,repositoryId:repo.id,sha,parentSha:parent,
  historyHeadSha:head,executedByPage:false,mergeAuthorized:false};
const base="https://api.github.com/repos/"+repo.full_name;
const sampleRun={
  id:12345,head_sha:sha,repository:{id:repo.id,full_name:repo.full_name},
  name:"PhiMada CI",path:".github/workflows/ci.yml",
  event:"push",run_attempt:1,status:"completed",conclusion:"success",
  created_at:"2026-11-04T12:00:00Z",updated_at:"2026-11-04T12:04:00Z"
};
const sampleJob={
  id:777,run_id:sampleRun.id,run_attempt:1,head_sha:sha,
  name:"verify",status:"completed",conclusion:"success",
  started_at:"2026-11-04T12:01:00Z",completed_at:"2026-11-04T12:02:00Z",
  steps:[{number:1,name:"Build",status:"completed",conclusion:"success",
    started_at:"2026-11-04T12:01:00Z",completed_at:"2026-11-04T12:02:00Z"}]
};
const records={
  [base]:{id:repo.id,full_name:repo.full_name,private:false},
  [base+"/commits/"+sha+"?per_page=1"]:{sha,parents:[{sha:parent}]},
  [base+"/actions/runs?head_sha="+sha+"&per_page=12"]:{
    total_count:1,workflow_runs:[sampleRun]
  },
  [base+"/actions/runs/12345"]:sampleRun,
  [base+"/actions/runs/12345/jobs?per_page=50"]:{total_count:1,jobs:[sampleJob]}
};
function mocked(data=records){
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push({url,opts});
    assert.equal(opts.credentials,"omit");
    assert.equal(opts.method,"GET");
    assert.deepEqual(opts.headers,{Accept:"application/vnd.github+json"});
    return {ok:Object.hasOwn(data,url),json:async()=>data[url]};
  };
  fetcher.calls=calls;
  return fetcher;
}
const chosen=normalizeRunList(records[base+"/actions/runs?head_sha="+sha+"&per_page=12"],
  repo,sha,Date.parse("2026-11-04T12:05:00Z"));
test("R32 reads real public workflow runs for exact SHA only and never triggers jobs",async()=>{
  const f=mocked(),result=await readRunList(repo,history,commit,bundle,f,
    ()=>Date.parse("2026-11-04T12:05:00Z"));
  assert.equal(result.runs.length,1);
  assert.equal(result.runs[0].path,".github/workflows/ci.yml");
  assert.equal(result.runs[0].url,
    "https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/12345");
  assert.equal(result.partial,false);
  assert.equal(result.requiredChecksVerified,false);
  assert.equal(result.agentExecutionAuthenticated,false);
  assert.equal(f.calls.length,3);
  assert.ok(f.calls.every(c=>c.url.startsWith(base)));
  assert.ok(f.calls.some(c=>c.url.includes("head_sha="+sha)));
});
test("refuse unverified repository, history, R30 binding and changed commit parent",async()=>{
  for(const changed of [
    [{...repo,exampleOnly:true},history,commit,bundle],
    [{...repo,full_name:"someone/PhiMadaPrime"},history,commit,bundle],
    [repo,{...history,repositoryId:1},commit,bundle],
    [repo,history,{sha:"d".repeat(40),parentSha:parent},bundle],
    [repo,history,commit,{...bundle,mergeAuthorized:true}]
  ])await assert.rejects(readRunList(...changed,mocked()),/^(?!$)/);
  const wrong={...records,[base]:{...records[base],private:true}};
  await assert.rejects(readRunList(repo,history,commit,bundle,mocked(wrong)),
    /R32_LIVE_REPO_IDENTITY/);
  const changed={...records,[base+"/commits/"+sha+"?per_page=1"]:
    {sha,parents:[{sha:"f".repeat(40)}]}};
  await assert.rejects(readRunList(repo,history,commit,bundle,mocked(changed)),
    /R32_COMMIT_PARENT_CHANGED/);
});
test("run page rejects wrong SHA, foreign repo, invalid workflow and duplicate IDs",()=>{
  const rows=[
    sampleRun,{...sampleRun,id:2,head_sha:"e".repeat(40)},
    {...sampleRun,id:3,path:".github/workflows/../../evil.yml"},
    {...sampleRun,id:4,repository:{id:1,full_name:"someone/other"}},
    sampleRun
  ];
  const d=normalizeRunList({total_count:rows.length,workflow_runs:rows},repo,sha);
  assert.equal(d.runs.length,1);assert.equal(d.excluded,4);assert.equal(d.partial,true);
  assert.throws(()=>normalizeRunList({total_count:0,workflow_runs:rows},repo,sha),
    /R32_RUN_PAGE_INVALID/);
});
test("first 12 items is potentially incomplete even with matching total",()=>{
  const raw=Array.from({length:12},(_,i)=>({...sampleRun,id:i+1}));
  const d=normalizeRunList({total_count:12,workflow_runs:raw},repo,sha);
  assert.equal(d.runs.length,12);assert.equal(d.partial,true);
});
test("R32 job inspection revalidates exact run and records bounded step data",async()=>{
  const f=mocked();
  const detail=await readRunJobs(repo,history,commit,bundle,chosen,12345,f);
  assert.equal(detail.jobs.length,1);assert.equal(detail.jobs[0].steps.length,1);
  assert.equal(detail.summary,"ALL_RETURNED_JOBS_SUCCESS");
  assert.equal(detail.requiredChecksVerified,false);
  assert.equal(detail.jobs[0].url,
    "https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/12345/job/777");
  assert.equal(f.calls.length,2);
});
test("refuse unobserved ID, rerun attempt, path/commit changes or foreign run ID",async()=>{
  let count=0;
  const no=mocked();
  await assert.rejects(readRunJobs(repo,history,commit,bundle,chosen,22,no),
    /R32_RUN_NOT_IN_OBSERVED_PAGE/);
  assert.equal(no.calls.length,0);
  const edits=[
    {...sampleRun,run_attempt:2},
    {...sampleRun,path:".github/workflows/other.yml"},
    {...sampleRun,head_sha:"e".repeat(40)},
    {...sampleRun,repository:{id:8,full_name:"foreign/repo"}}
  ];
  for(const item of edits){
    const bad={...records,[base+"/actions/runs/12345"]:item};
    await assert.rejects(readRunJobs(repo,history,commit,bundle,chosen,12345,
      mocked(bad)),/R32_RUN_CHANGED_DURING_REVIEW/);
    count++;
  }
  assert.equal(count,4);
});
test("job list refuses foreign head and missing attempt without silently displaying",()=>{
  const data={total_count:4,jobs:[
    sampleJob,{...sampleJob,id:1,head_sha:"d".repeat(40)},
    {...sampleJob,id:2,run_attempt:2},{...sampleJob,id:3,run_id:90}
  ]};
  const d=normalizeJobList(data,repo,chosen.runs[0]);
  assert.equal(d.jobs.length,1);
  assert.equal(d.excluded,3);assert.equal(d.partial,true);
  assert.equal(d.summary,"INCOMPLETE_JOB_OR_STEP_OBSERVATION");
});
test("failed and unfinished job steps remain visible, never converted to green",()=>{
  const run=chosen.runs[0];
  const failed=normalizeJobList({total_count:1,jobs:[{
    ...sampleJob,conclusion:"failure",
    steps:[{...sampleJob.steps[0],conclusion:"failure"}]
  }]},repo,run);
  assert.equal(failed.summary,"JOBS_WITHOUT_SUCCESS");
  assert.equal(failed.jobs[0].steps[0].conclusion,"failure");
  const queued=normalizeJobList({total_count:1,jobs:[{
    ...sampleJob,status:"in_progress",conclusion:null
  }]},repo,run);
  assert.equal(queued.summary,"JOBS_NOT_COMPLETE");
});
test("missing steps, duplicates, and bounded step count mark coverage partial",()=>{
  const run=chosen.runs[0];
  const missing=normalizeJobList({total_count:1,jobs:[
    {...sampleJob,steps:undefined}
  ]},repo,run);
  assert.equal(missing.partial,true);
  const dup=normalizeJobList({total_count:1,jobs:[{
    ...sampleJob,steps:[sampleJob.steps[0],sampleJob.steps[0]]
  }]},repo,run);
  assert.equal(dup.partial,true);
  const many=normalizeJobList({total_count:1,jobs:[{
    ...sampleJob,steps:Array.from({length:78},(_,i)=>({
      ...sampleJob.steps[0],number:i+1
    }))
  }]},repo,run);
  assert.equal(many.jobs[0].steps.length,75);
  assert.equal(many.partial,true);
});
test("run and job API unavailability never fabricated as empty success",async()=>{
  const data={...records};
  delete data[base+"/actions/runs/12345/jobs?per_page=50"];
  await assert.rejects(readRunJobs(repo,history,commit,bundle,chosen,12345,
    mocked(data)),/R32_PUBLIC_API_UNAVAILABLE/);
});
test("copy handoff binds run and SHA and never claims authority",()=>{
  const detail=normalizeJobList({total_count:1,jobs:[sampleJob]},repo,chosen.runs[0]);
  const report=runObservatoryHandoff(chosen,detail);
  assert.match(report,/Commit SHA: a{40}/);
  assert.match(report,/Run: https:\/\/github.com\/MichaelWave369\/PhiMadaPrime\/actions\/runs\/12345/);
  assert.match(report,/No required-check certification, agent identity proof/);
  assert.throws(()=>runObservatoryHandoff(chosen,{...detail,sha:"f".repeat(40)}),
    /R32_HANDOFF_BINDING/);
});
