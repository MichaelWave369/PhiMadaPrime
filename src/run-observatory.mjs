// R32 · Run Observatory. Public GitHub Actions facts on an exact Chronicle commit.
// No job starts, check reruns, authenticated agent claims, or merge authority.
import { OWNER } from "./fleet.mjs";
import { publicRepoPath } from "./signals.mjs";

const SHA=/^[a-f0-9]{40}$/;
const WORKFLOW=/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/;
const STATUS=new Set(["queued","waiting","in_progress","completed","pending","requested"]);
const CONCLUSION=new Set(["success","failure","neutral","cancelled","skipped","timed_out","action_required","stale","startup_failure"]);
const MAX_RUNS=12;
const MAX_JOBS=50;
const MAX_STEPS=75;
const safeInt=x=>Number.isSafeInteger(x) && x>=0;
const positive=x=>safeInt(x) && x>0;
const short=(x,n,alt="")=>typeof x==="string"?x.slice(0,n):alt;
const date=x=>typeof x==="string" && Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
function fail(code){throw Error("R32_"+code);}
function assert(ok,code){if(!ok)fail(code);}
function identity(repo,history,commit,bundle){
  const path=publicRepoPath(repo);
  assert(repo.full_name===OWNER+"/"+repo.name,"CATALOG_IDENTITY");
  assert(history?.repository===repo.full_name &&
    history.repositoryId===repo.id && SHA.test(history.headSha||"") &&
    history.commits?.some(c=>c.sha===commit?.sha && c.parentSha===commit.parentSha) &&
    SHA.test(commit?.sha||"") &&
    (commit.parentSha===null || SHA.test(commit.parentSha||"")),
    "CHRONICLE_SELECTION");
  assert(bundle?.schema==="phimada.commit-evidence.v0.30" &&
    bundle.repository===repo.full_name && bundle.repositoryId===repo.id &&
    bundle.sha===commit.sha && bundle.parentSha===commit.parentSha &&
    bundle.historyHeadSha===history.headSha &&
    bundle.executedByPage===false && bundle.mergeAuthorized===false,
    "R30_BINDING");
  return path;
}
async function api(fetcher,path){
  const response=await fetcher("https://api.github.com"+path,{
    credentials:"omit",method:"GET",headers:{Accept:"application/vnd.github+json"}
  });
  assert(response?.ok,"PUBLIC_API_UNAVAILABLE");
  return response.json();
}
function runRow(raw,repo,sha){
  if(!positive(raw?.id) || raw.head_sha!==sha ||
    raw.repository?.id!==repo.id || raw.repository.full_name!==repo.full_name ||
    !WORKFLOW.test(raw.path||"") || !positive(raw.run_attempt) ||
    !STATUS.has(raw.status)) return null;
  const conclusion=raw.status==="completed" && CONCLUSION.has(raw.conclusion)?
    raw.conclusion:null;
  return {
    id:raw.id, name:short(raw.name,130,"Unnamed workflow"),
    path:raw.path, sha, attempt:raw.run_attempt,
    event:short(raw.event,50,"unknown"),status:raw.status,conclusion,
    createdAt:date(raw.created_at),updatedAt:date(raw.updated_at),
    url:"https://github.com/"+repo.full_name+"/actions/runs/"+raw.id
  };
}
export function normalizeRunList(raw,repo,sha,now=Date.now()){
  assert(raw && safeInt(raw.total_count) && Array.isArray(raw.workflow_runs) &&
    raw.workflow_runs.length<=MAX_RUNS && raw.total_count>=raw.workflow_runs.length,
    "RUN_PAGE_INVALID");
  const seen=new Set(),runs=[];
  let excluded=0;
  for(const row of raw.workflow_runs){
    const run=runRow(row,repo,sha);
    if(!run || seen.has(run.id)){excluded++;continue;}
    runs.push(run);seen.add(run.id);
  }
  return {
    schema:"phimada.run-observatory-list.v0.32",
    repository:repo.full_name,repositoryId:repo.id,sha,
    observedAt:new Date(now).toISOString(),runs,totalReported:raw.total_count,
    excluded,partial:raw.total_count>raw.workflow_runs.length ||
      raw.workflow_runs.length===MAX_RUNS || excluded>0,
    readOnly:true,requiredChecksVerified:false,agentExecutionAuthenticated:false
  };
}
export async function readRunList(repo,history,commit,bundle,
  fetcher=fetch,now=()=>Date.now()){
  const path=identity(repo,history,commit,bundle);
  const meta=await api(fetcher,path);
  assert(meta?.id===repo.id && meta.full_name===repo.full_name &&
    meta.private===false,"LIVE_REPO_IDENTITY");
  const original=await api(fetcher,path+"/commits/"+commit.sha+"?per_page=1");
  assert(original?.sha===commit.sha && Array.isArray(original.parents) &&
    (original.parents[0]?.sha||null)===(commit.parentSha||null),"COMMIT_PARENT_CHANGED");
  const data=await api(fetcher,path+"/actions/runs?head_sha="+commit.sha+
    "&per_page="+MAX_RUNS);
  return normalizeRunList(data,repo,commit.sha,now());
}
function jobRow(raw,run,repo){
  if(!positive(raw?.id) || raw.run_id!==run.id ||
    raw.run_attempt!==run.attempt || raw.head_sha!==run.sha ||
    !STATUS.has(raw.status))return null;
  const steps=[];
  let droppedSteps=0;
  const source=Array.isArray(raw.steps)?raw.steps:null;
  const numbers=new Set();
  if(source)for(const step of source){
    if(!positive(step?.number)||numbers.has(step.number)||!STATUS.has(step.status)){
      droppedSteps++;continue;
    }
    numbers.add(step.number);
    steps.push({
      number:step.number,name:short(step.name,140,"Unnamed step"),
      status:step.status,
      conclusion:step.status==="completed"&&CONCLUSION.has(step.conclusion)?
        step.conclusion:null,
      startedAt:date(step.started_at),completedAt:date(step.completed_at)
    });
  }
  return {
    id:raw.id,name:short(raw.name,130,"Unnamed job"),
    status:raw.status,
    conclusion:raw.status==="completed"&&CONCLUSION.has(raw.conclusion)?
      raw.conclusion:null,
    startedAt:date(raw.started_at),completedAt:date(raw.completed_at),
    steps:steps.slice(0,MAX_STEPS),
    stepsPartial:source===null || source.length>MAX_STEPS || droppedSteps>0,
    // Never trust an API-provided URL; reconstruct only exact own-repo path.
    url:"https://github.com/"+repo.full_name+
      "/actions/runs/"+run.id+"/job/"+raw.id
  };
}
export function normalizeJobList(raw,repo,run,now=Date.now()){
  assert(raw && safeInt(raw.total_count) && Array.isArray(raw.jobs) &&
    raw.jobs.length<=MAX_JOBS && raw.total_count>=raw.jobs.length,"JOBS_PAGE_INVALID");
  const ids=new Set(),jobs=[];let excluded=0;
  for(const item of raw.jobs){
    const job=jobRow(item,run,repo);
    if(!job || ids.has(job.id)){excluded++;continue;}
    jobs.push(job);ids.add(job.id);
  }
  const partial=raw.total_count>raw.jobs.length ||
    raw.jobs.length===MAX_JOBS || excluded>0 ||
    jobs.some(job=>job.stepsPartial);
  const success=jobs.filter(j=>j.status==="completed"&&j.conclusion==="success").length;
  const other=jobs.filter(j=>j.status==="completed"&&j.conclusion!=="success").length;
  const pending=jobs.filter(j=>j.status!=="completed").length;
  const summary=partial?"INCOMPLETE_JOB_OR_STEP_OBSERVATION":
    !jobs.length?"NO_JOBS_RETURNED":
    pending?"JOBS_NOT_COMPLETE":
    other?"JOBS_WITHOUT_SUCCESS":
    "ALL_RETURNED_JOBS_SUCCESS";
  return {
    schema:"phimada.run-observatory-jobs.v0.32",repository:repo.full_name,
    repositoryId:repo.id,sha:run.sha,runId:run.id,attempt:run.attempt,
    observedAt:new Date(now).toISOString(),jobs,excluded,
    totalReported:raw.total_count,partial,summary,counts:{success,other,pending},
    readOnly:true,requiredChecksVerified:false,agentExecutionAuthenticated:false
  };
}
export async function readRunJobs(repo,history,commit,bundle,list,runId,
  fetcher=fetch,now=()=>Date.now()){
  const path=identity(repo,history,commit,bundle);
  assert(list?.schema==="phimada.run-observatory-list.v0.32" &&
    list.repository===repo.full_name && list.repositoryId===repo.id &&
    list.sha===commit.sha && Array.isArray(list.runs),"RUN_LIST_BINDING");
  assert(positive(runId),"RUN_ID");
  const picked=list.runs.find(r=>r.id===runId);
  assert(picked && picked.sha===commit.sha,"RUN_NOT_IN_OBSERVED_PAGE");
  const live=await api(fetcher,path+"/actions/runs/"+runId);
  assert(live?.id===runId && live.head_sha===commit.sha &&
    live.repository?.id===repo.id && live.repository.full_name===repo.full_name &&
    live.path===picked.path && live.run_attempt===picked.attempt &&
    live.status===picked.status && live.conclusion===picked.conclusion,
    "RUN_CHANGED_DURING_REVIEW");
  const data=await api(fetcher,path+"/actions/runs/"+runId+"/jobs?per_page="+MAX_JOBS);
  return normalizeJobList(data,repo,picked,now());
}
export function runObservatoryHandoff(list,details){
  assert(list?.schema==="phimada.run-observatory-list.v0.32" &&
    details?.schema==="phimada.run-observatory-jobs.v0.32" &&
    details.sha===list.sha && details.repository===list.repository &&
    list.runs?.some(r=>r.id===details.runId && r.attempt===details.attempt),
    "HANDOFF_BINDING");
  const run=list.runs.find(r=>r.id===details.runId);
  return [
    "PhiMadaPrime / R32 RUN OBSERVATORY / READ-ONLY",
    "Repository: "+list.repository,
    "Commit SHA: "+list.sha,
    "Run: "+run.url,
    "Workflow: "+run.name+" ("+run.path+")",
    "Event: "+run.event+" | attempt: "+run.attempt,
    "Run observed: "+list.observedAt,
    "Jobs observed: "+details.observedAt,
    "Jobs: "+details.jobs.length+"/"+details.totalReported,
    "Coverage partial: "+(list.partial||details.partial),
    "Summary: "+details.summary,
    ...details.jobs.map(j=>j.name+" | "+j.status+" | "+(j.conclusion||"NO_CONCLUSION")),
    "GitHub job and step metadata only. No logs downloaded or execution replayed.",
    "No required-check certification, agent identity proof, product acceptance or merge authorization.",
    "Recheck current SHA, policies and independent verification before action."
  ].join("\n");
}
