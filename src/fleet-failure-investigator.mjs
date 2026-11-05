// R33: a bounded, operator-selected cohort of public GitHub failure records.
// Observations are NOT diagnoses, active incidents, job executions or approvals.
import { OWNER } from "./fleet.mjs";
import { publicRepoPath } from "./signals.mjs";
import { validChronicleRef } from "./chronicle.mjs";
import { normalizeJobList } from "./run-observatory.mjs";

const SHA=/^[a-f0-9]{40}$/;
const WORKFLOW=/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/;
const MAX_REPOS=4,MAX_RUNS=8,MAX_JOBS=50;
const goodId=x=>Number.isSafeInteger(x)&&x>0;
const safeDate=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?
  new Date(x).toISOString():null;
const short=(x,n,alt="")=>typeof x==="string"?x.slice(0,n):alt;
function need(value,code){if(!value)throw Error("R33_"+code);}
export function eligibleFailureRepo(repo){
  return Boolean(repo&&!repo.exampleOnly&&goodId(repo.id)&&
    typeof repo.name==="string"&&/^[A-Za-z0-9_.-]+$/.test(repo.name)&&
    repo.full_name===OWNER+"/"+repo.name);
}
export function fleetFailureCohort(catalog,ids){
  need(Array.isArray(catalog)&&Array.isArray(ids)&&
    ids.length>0&&ids.length<=MAX_REPOS,"COHORT_SIZE");
  const unique=new Set(),output=[];
  for(const id of ids){
    const num=typeof id==="string"&&/^[1-9]\d*$/.test(id)?Number(id):id;
    need(goodId(num)&&!unique.has(num),"COHORT_ID");
    const found=catalog.find(r=>r.id===num);
    need(eligibleFailureRepo(found),"COHORT_CATALOG_IDENTITY");
    unique.add(num);output.push(found);
  }
  return output;
}
async function github(fetcher,path){
  const response=await fetcher("https://api.github.com"+path,{
    method:"GET",credentials:"omit",headers:{Accept:"application/vnd.github+json"}
  });
  need(response?.ok,"GITHUB_READ_UNAVAILABLE");
  return response.json();
}
function normalizeFailure(raw,repo){
  if(!goodId(raw?.id)||raw.repository?.id!==repo.id||
    raw.repository?.full_name!==repo.full_name||
    !SHA.test(raw.head_sha||"")||!WORKFLOW.test(raw.path||"")||
    !goodId(raw.run_attempt)||raw.status!=="completed"||
    raw.conclusion!=="failure")return null;
  return {
    id:raw.id,sha:raw.head_sha,attempt:raw.run_attempt,
    path:raw.path,name:short(raw.name,140,"Unnamed workflow"),
    branch:short(raw.head_branch,130,"unknown"),
    event:short(raw.event,64,"unknown"),
    status:"completed",conclusion:"failure",
    createdAt:safeDate(raw.created_at),
    updatedAt:safeDate(raw.updated_at),
    url:"https://github.com/"+repo.full_name+"/actions/runs/"+raw.id,
    commitUrl:"https://github.com/"+repo.full_name+"/commit/"+raw.head_sha
  };
}
export function normalizeFailurePage(raw,repo,defaultHeadSha,now=Date.now()){
  need(raw&&Number.isSafeInteger(raw.total_count)&&raw.total_count>=0&&
    Array.isArray(raw.workflow_runs)&&raw.workflow_runs.length<=MAX_RUNS&&
    raw.total_count>=raw.workflow_runs.length&&SHA.test(defaultHeadSha||""),
    "FAILURES_PAGE_INVALID");
  const runs=[],ids=new Set();let excluded=0;
  for(const candidate of raw.workflow_runs){
    const row=normalizeFailure(candidate,repo);
    if(!row||ids.has(row.id)){excluded++;continue;}
    ids.add(row.id);
    runs.push({...row,
      defaultHeadRelation:row.sha===defaultHeadSha?
        "MATCHES_DEFAULT_HEAD":"NOT_DEFAULT_HEAD"});
  }
  return {
    runs,excluded,totalReported:raw.total_count,
    partial:raw.total_count>raw.workflow_runs.length||
      raw.workflow_runs.length===MAX_RUNS||excluded>0,
    observedAt:new Date(now).toISOString(),
    failureFilter:"GITHUB_CONCLUSION_FAILURE_ONLY",
    defaultHeadSha
  };
}
async function scanOne(repo,fetcher,now){
  const path=publicRepoPath(repo);
  need(eligibleFailureRepo(repo),"REPO_CATALOG");
  const meta=await github(fetcher,path);
  need(meta?.id===repo.id&&meta.full_name===repo.full_name&&
    meta.private===false&&validChronicleRef(meta.default_branch),
    "LIVE_PUBLIC_REPOSITORY_IDENTITY");
  const defaultBranch=meta.default_branch;
  const head=await github(fetcher,path+"/git/ref/heads/"+encodeURIComponent(defaultBranch));
  need(SHA.test(head?.object?.sha||""),"DEFAULT_HEAD_UNAVAILABLE");
  const results=await github(fetcher,path+
    "/actions/runs?status=failure&per_page="+MAX_RUNS);
  return {
    state:"OBSERVED",repository:repo.full_name,repositoryId:repo.id,
    defaultBranch,
    ...normalizeFailurePage(results,repo,head.object.sha,now())
  };
}
function held(repo,error){
  const code=typeof error?.message==="string"&&/^R33_[A-Z0-9_]+$/.test(error.message)?
    error.message:"R33_PUBLIC_GITHUB_UNAVAILABLE";
  return {
    state:"UNAVAILABLE",repository:repo.full_name,repositoryId:repo.id,
    reason:code,runs:[]
  };
}
export async function scanFleetFailures(catalog,ids,{fetcher=fetch,now=()=>Date.now()}={}){
  const cohort=fleetFailureCohort(catalog,ids);
  const attempts=await Promise.allSettled(
    cohort.map(repo=>scanOne(repo,fetcher,now)));
  const reports=attempts.map((item,i)=>item.status==="fulfilled"?
    item.value:held(cohort[i],item.reason));
  return {
    schema:"phimada.fleet-failure-scan.v0.33",scope:"SELECTED_PUBLIC_COHORT",
    observedAt:new Date(now()).toISOString(),
    selectedRepos:reports.length,
    reports,observedRepos:reports.filter(x=>x.state==="OBSERVED").length,
    unavailableRepos:reports.filter(x=>x.state==="UNAVAILABLE").length,
    failuresShown:reports.reduce((sum,r)=>sum+r.runs.length,0),
    partial:reports.some(r=>r.state!=="OBSERVED"||r.partial),
    readOnly:true,allFleetScanned:false,rootCauseEstablished:false,
    requiredChecksVerified:false,mergeAuthorized:false
  };
}
export async function inspectFleetFailure(scan,repoId,runId,
  {fetcher=fetch,now=()=>Date.now()}={}){
  need(scan?.schema==="phimada.fleet-failure-scan.v0.33"&&
    scan.scope==="SELECTED_PUBLIC_COHORT"&&
    Array.isArray(scan.reports),"SCAN_BINDING");
  need(goodId(repoId)&&goodId(runId),"SELECTION_ID");
  const report=scan.reports.find(r=>r.repositoryId===repoId);
  need(report?.state==="OBSERVED"&&Array.isArray(report.runs),
    "REPOSITORY_NOT_OBSERVED");
  const selected=report.runs.find(r=>r.id===runId);
  need(selected&&selected.conclusion==="failure"&&
    SHA.test(selected.sha||""),"RUN_NOT_OBSERVED");
  const repo={id:repoId,name:report.repository.split("/")[1],
    full_name:report.repository,exampleOnly:false};
  need(eligibleFailureRepo(repo),"REPOSITORY_IDENTITY");
  const path=publicRepoPath(repo);
  const [meta,head,live]=await Promise.all([
    github(fetcher,path),
    github(fetcher,path+"/git/ref/heads/"+
      encodeURIComponent(report.defaultBranch)),
    github(fetcher,path+"/actions/runs/"+runId)
  ]);
  need(meta?.id===repoId&&meta.full_name===repo.full_name&&
    meta.private===false&&meta.default_branch===report.defaultBranch,
    "LIVE_PUBLIC_REPOSITORY_IDENTITY");
  need(head?.object?.sha===report.defaultHeadSha,"DEFAULT_HEAD_MOVED_RESCAN");
  need(live?.id===runId&&live.head_sha===selected.sha&&
    live.repository?.id===repoId&&
    live.repository.full_name===repo.full_name&&
    live.path===selected.path&&live.run_attempt===selected.attempt&&
    live.status==="completed"&&live.conclusion==="failure",
    "RUN_CHANGED_RESCAN");
  const rawJobs=await github(fetcher,path+
    "/actions/runs/"+runId+"/jobs?per_page="+MAX_JOBS);
  const jobs=normalizeJobList(rawJobs,repo,{
    id:runId,sha:selected.sha,attempt:selected.attempt
  },now());
  const failureSteps=jobs.jobs.flatMap(job=>
    job.steps.filter(step=>step.conclusion==="failure").map(step=>({
      jobId:job.id,jobName:job.name,stepNumber:step.number,
      stepName:step.name,jobUrl:job.url
    })));
  const failingJobs=jobs.jobs.filter(job=>job.conclusion==="failure").length;
  return {
    schema:"phimada.fleet-failure-investigation.v0.33",
    repository:repo.full_name,repositoryId:repoId,run:selected,
    scanObservedAt:scan.observedAt,detailsObservedAt:jobs.observedAt,
    defaultBranch:report.defaultBranch,defaultHeadSha:report.defaultHeadSha,
    jobs, failureSteps, failingJobs,
    partial:report.partial||jobs.partial,
    rootCauseEstablished:false,
    requiredChecksVerified:false,agentIdentityAuthenticated:false,
    historicalFailureMayBeResolved:true,readOnly:true,mergeAuthorized:false
  };
}
export function failureInvestigationHandoff(scan,investigation){
  need(scan?.schema==="phimada.fleet-failure-scan.v0.33"&&
    investigation?.schema==="phimada.fleet-failure-investigation.v0.33"&&
    scan.reports?.some(r=>r.state==="OBSERVED"&&
      r.repositoryId===investigation.repositoryId&&
      r.runs.some(x=>x.id===investigation.run.id&&
        x.sha===investigation.run.sha&&
        x.attempt===investigation.run.attempt)),
    "HANDOFF_BINDING");
  const record=investigation;
  return [
    "PhiMadaPrime / R33 FLEET FAILURE INVESTIGATOR / REVIEW ONLY",
    "Scope: OPERATOR-SELECTED PUBLIC COHORT (not full fleet)",
    "Repository: "+record.repository,
    "Workflow: "+record.run.name+" ("+record.run.path+")",
    "Failing run: "+record.run.url,
    "Failed run commit: "+record.run.sha,
    "Run attempt: "+record.run.attempt,
    "Default branch: "+record.defaultBranch,
    "Default HEAD observed: "+record.defaultHeadSha,
    "Failed run matches observed default HEAD: "+(record.run.sha===record.defaultHeadSha),
    "Scan observed: "+record.scanObservedAt,
    "Jobs observed: "+record.detailsObservedAt,
    "Jobs displayed: "+record.jobs.jobs.length+"/"+record.jobs.totalReported,
    "Partial evidence: "+record.partial,
    "Observed failing jobs: "+record.failingJobs,
    "Explicitly failed steps: "+record.failureSteps.length,
    ...record.failureSteps.map(step=>step.jobName+" / "+step.stepNumber+" "+step.stepName),
    "Failure reason/root cause: NOT DETERMINED FROM METADATA",
    "Historical failures may have been fixed; inspect current branch and CI.",
    "No logs downloaded, workflow execution, AI attribution, approval or merge authority."
  ].join("\n");
}
