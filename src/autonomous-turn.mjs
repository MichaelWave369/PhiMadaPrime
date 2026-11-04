// Autonomous Turn R1. Public GETs only. Task submission never grants authority.
import { signalsFresh } from "./signals.mjs";

export const TURN_REPO = "MichaelWave369/Agentora";
export const TURN_REPO_ID = 1167870912;
const OWNER_ID = 247459237;
const BASE = "https://api.github.com/repos/"+TURN_REPO;
const REQUIRED = ["backend (3.12)", "backend (3.13)", "web"];
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const DOC = "docs/DEVELOPMENT_LOOP_R2_CODE_AND_HANDOFF.md";
const NAV = "web/src/components/Nav.tsx";

function need(value, code) { if (!value) throw Error("TURN_"+code); }
export function turnEligible(repo) {
  return repo?.id === TURN_REPO_ID && repo?.full_name === TURN_REPO && !repo.exampleOnly;
}

export function canonical(value) {
  const sorted = item => Array.isArray(item) ? item.map(sorted) :
    item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map(k=>[k,sorted(item[k])])) : item;
  // Match Python ensure_ascii=True, including UTF-16 surrogate pairs.
  return JSON.stringify(sorted(value)).replace(/[\u007f-\uffff]/g,
    c=>"\\u"+c.charCodeAt(0).toString(16).padStart(4,"0"));
}

async function hash(text, crypto=globalThis.crypto) {
  need(crypto?.subtle, "CRYPTO_UNAVAILABLE");
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))))
    .map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function turnTaskDigest(task, crypto) {
  return hash("agentora.autonomous-task.v1\n"+canonical(task),crypto);
}

async function get(path, fetcher) {
  need(typeof path === "string" && path.startsWith("/") && !path.startsWith("//"),"API_PATH");
  const response=await fetcher(BASE+path,{method:"GET",credentials:"omit",
    headers:{Accept:"application/vnd.github+json"}});
  need(response?.ok,"GITHUB_READ_UNAVAILABLE");
  const raw=await response.text();
  need(raw.length<=2_000_000,"GITHUB_RESPONSE_SIZE");
  try {return JSON.parse(raw);} catch {throw Error("TURN_GITHUB_RESPONSE_INVALID");}
}

async function repoIdentity(fetcher) {
  // A single known repository: no user-supplied URL or credential forwarding.
  const response=await fetcher(BASE,{method:"GET",credentials:"omit",headers:{Accept:"application/vnd.github+json"}});
  need(response?.ok,"GITHUB_READ_UNAVAILABLE");
  const repo=await response.json();
  need(repo?.id===TURN_REPO_ID&&repo.full_name===TURN_REPO&&repo.private===false&&
    repo.archived===false&&repo.default_branch==="main"&&repo.owner?.id===OWNER_ID,"REPOSITORY_IDENTITY");
}

export async function prepareTurnTask(repo,signal,kind,{fetcher=fetch,crypto=globalThis.crypto,
  now=Date.now(),requestSha256=null}={}) {
  need(turnEligible(repo)&&["docs","code"].includes(kind),"FIXED_REPOSITORY_REQUIRED");
  need(signal?.repositoryId===TURN_REPO_ID&&signal.repository===TURN_REPO&&
    signal.from==="LIVE_PUBLIC_GITHUB_API_READ_ONLY"&&signalsFresh(signal,now)&&
    signal.defaultBranch==="main"&&SHA.test(signal.headSha||""),"FRESH_EXACT_SOURCE_REQUIRED");
  need(requestSha256===null||SHA256.test(requestSha256),"REQUEST_LINEAGE");
  await repoIdentity(fetcher);
  const first=await get("/git/ref/heads/main",fetcher);
  need(first?.object?.sha===signal.headSha,"SOURCE_DRIFT");
  const path=kind==="docs"?DOC:NAV;
  const data=await get("/contents/"+path+"?ref="+signal.headSha,fetcher);
  need(data?.type==="file"&&data.encoding==="base64"&&Number.isInteger(data.size)&&data.size<100000,"SOURCE_FILE");
  let content;
  try { content=new TextDecoder("utf-8",{fatal:true}).decode(
    Uint8Array.from(atob(data.content.replace(/\s/g,"")),c=>c.charCodeAt(0)));
  } catch {throw Error("TURN_SOURCE_ENCODING");}
  need(new TextEncoder().encode(content).length===data.size,"SOURCE_SIZE");
  const old=kind==="docs"?"The author cannot count as the independent reviewer.":
    "import { Link } from 'react-router-dom'";
  const replacement=kind==="docs"?old+" Review approval is bound to the current PR commit SHA; after any source push, obtain a fresh approval before applying `phi-code-automerge`.":
    "import { NavLink as Link } from 'react-router-dom'";
  need(content.split(old).length===2&&!content.includes(replacement),"EXAMPLE_ALREADY_APPLIED_OR_SOURCE_CHANGED");
  const second=await get("/git/ref/heads/main",fetcher);
  need(second?.object?.sha===signal.headSha,"SOURCE_DRIFT");
  const task={schema:"agentora.autonomous-task.v1",
    task_id:`r1-${kind}-${new Date(now).toISOString().replace(/[^0-9]/g,"")}`,
    repository:TURN_REPO,repository_id:TURN_REPO_ID,target_branch:"main",source_sha:signal.headSha,
    created_utc:new Date(now).toISOString(),expires_utc:new Date(now+4*60*60*1000).toISOString(),
    acceptance:[kind==="docs"?"Owner confirms the review instructions are clear":"Confirm the active link in the deployed interface"],
    allowed_paths:[path],max_files:1,max_changed_lines:12,max_patch_bytes:4000,
    tests:[kind==="docs"?"docs-contract":"web-build"],max_repairs:0,
    merge_policy:kind==="docs"?"docs":"reviewed-code",
    edits:[{path,before_sha256:await hash(content,crypto),old,new:replacement}],repairs:[],
    human_scope:kind==="docs"?"Clarify stale review invalidation":
      "Use React Router NavLink to expose aria-current on the active navigation link",
    phimada_request_sha256:requestSha256};
  const json=canonical(task),digest=await turnTaskDigest(task,crypto);
  const url="https://github.com/"+TURN_REPO+"/issues/new?"+new URLSearchParams({
    title:"Autonomous R1 task: "+task.task_id,body:json}).toString();
  need(url.length<20000,"TASK_LINK_SIZE");
  return {task,json,digest,submissionUrl:url};
}

export async function listTurnPrs({fetcher=fetch}={}) {
  await repoIdentity(fetcher);
  const rows=await get("/pulls?state=all&sort=created&direction=desc&per_page=30",fetcher);
  need(Array.isArray(rows)&&rows.length<=30,"PR_LIST");
  return rows.filter(r=>r.base?.repo?.id===TURN_REPO_ID&&r.head?.repo?.id===TURN_REPO_ID&&
    r.head.ref?.startsWith("autonomous/r1/")&&Number.isInteger(r.number)&&r.number>0)
    .map(r=>({number:r.number,title:String(r.title||"").slice(0,160),state:r.state,
      merged:r.merged_at!==null,url:`https://github.com/${TURN_REPO}/pull/${r.number}`}));
}

export async function readTurnResult(number,{fetcher=fetch,crypto=globalThis.crypto}={}) {
  need(Number.isSafeInteger(number)&&number>0,"PR_NUMBER");
  await repoIdentity(fetcher);
  const pr=await get(`/pulls/${number}`,fetcher),head=pr.head?.sha;
  need(pr.number===number&&pr.base?.repo?.id===TURN_REPO_ID&&pr.head?.repo?.id===TURN_REPO_ID&&
    pr.base.ref==="main"&&SHA.test(head||""),"PR_IDENTITY");
  const all=await get(`/commits/${head}/check-runs?per_page=100`,fetcher);
  need(Number.isInteger(all.total_count)&&all.total_count<100&&Array.isArray(all.check_runs)&&
    all.check_runs.length===all.total_count,"CHECKS_INCOMPLETE");
  const receipts=all.check_runs.filter(r=>r.name==="Autonomous Turn R1 receipt"&&
    r.app?.id===15368&&r.app?.slug==="github-actions"&&r.head_sha===head&&r.status==="completed");
  need(receipts.length===1,"NO_UNIQUE_GITHUB_RETURN_YET");
  const check=receipts[0];
  let payload;
  try {need(check.output?.text?.length<=60000,"RECEIPT_SIZE");payload=JSON.parse(check.output.text);}
  catch {throw Error("TURN_RECEIPT_INVALID");}
  const {task,receipt:r}=payload;
  need(task?.schema==="agentora.autonomous-task.v1"&&r?.schema==="agentora.autonomous-turn-receipt.v1"&&
    task.repository===TURN_REPO&&task.repository_id===TURN_REPO_ID&&task.target_branch==="main"&&
    r.repository===TURN_REPO&&r.repository_id===TURN_REPO_ID&&r.pr_number===number&&
    r.source_sha===task.source_sha&&SHA.test(r.source_sha||"")&&r.tested_pr_sha===head&&
    r.task_id===task.task_id&&r.project_verified_complete===false&&
    Number.isInteger(r.repair_attempts)&&r.repair_attempts>=0&&r.repair_attempts<=2&&
    Array.isArray(r.outstanding_acceptance)&&r.outstanding_acceptance.length<=10,"RECEIPT_IDENTITY");
  const digest=await turnTaskDigest(task,crypto);
  need(r.task_sha256===digest&&check.external_id===digest&&r.authorization?.task_sha256===digest,"TASK_DIGEST");
  const runId=r.authorization.run_id;
  need(Number.isSafeInteger(runId)&&runId>0&&
    pr.head.ref===`autonomous/r1/${task.task_id}-${runId}`&&
    check.details_url===`https://github.com/${TURN_REPO}/actions/runs/${runId}`&&
    r.run_url===check.details_url,"RUN_LINKAGE");
  const [run,reviews,jobs]=await Promise.all([
    get(`/actions/runs/${runId}`,fetcher),get(`/actions/runs/${runId}/approvals`,fetcher),
    get(`/actions/runs/${runId}/jobs?per_page=100`,fetcher)
  ]);
  need(run.repository?.id===TURN_REPO_ID&&run.id===runId&&run.head_branch==="main"&&
    ["issues","workflow_dispatch"].includes(run.event)&&run.run_attempt===1&&
    run.path?.split("@")[0]===".github/workflows/autonomous-turn-r1.yml"&&
    run.head_sha===r.authorization.control_sha&&run.head_sha===r.source_sha&&
    run.actor?.id===OWNER_ID&&run.triggering_actor?.id===OWNER_ID,
    "TRUSTED_RUN_IDENTITY");
  need(Array.isArray(reviews)&&reviews.length<100,"REVIEW_HISTORY");
  const relevant=reviews.filter(v=>v.environments?.some(e=>e.name==="autonomous-turn-owner"&&
    e.id===r.authorization.environment_id));
  need(relevant.length>0&&relevant.every(v=>v.state==="approved")&&
    relevant.filter(v=>v.user?.id===OWNER_ID&&v.user.type==="User"&&
      v.comment==="APPROVE "+digest).length===1,"OWNER_REVIEW_NOT_CORROBORATED");
  need(Number.isInteger(jobs.total_count)&&jobs.total_count<100&&Array.isArray(jobs.jobs)&&
    jobs.jobs.length===jobs.total_count&&jobs.jobs.some(j=>j.name==="merge-gate"&&
      j.status==="completed"&&j.conclusion==="success"),"RETURN_JOB_NOT_COMPLETE");
  const ci=all.check_runs.filter(c=>REQUIRED.includes(c.name));
  need(!all.check_runs.some(c=>["failure","timed_out","cancelled","action_required"].includes(c.conclusion)),
    "ADDITIONAL_SECURITY_OR_CHECK_FAILURE");
  need(REQUIRED.every(name=>ci.some(c=>c.name===name))&&ci.every(c=>
    c.head_sha===head&&c.app?.slug==="github-actions"&&c.app.id===15368&&
    c.status==="completed"&&c.conclusion==="success"),"CURRENT_SHA_CI_NOT_GREEN");
  for(const rid of new Set(ci.map(c=>{
    const match=/^https:\/\/github\.com\/MichaelWave369\/Agentora\/actions\/runs\/(\d+)\/job\/\d+$/.exec(c.details_url||"");
    need(match,"CI_RUN_LINK");return Number(match[1]);
  }))) {
    const ciRun=await get(`/actions/runs/${rid}`,fetcher);
    need(ciRun.head_sha===head&&ciRun.repository?.id===TURN_REPO_ID&&
      ciRun.path?.split("@")[0]===".github/workflows/ci.yml"&&
      ["push","pull_request"].includes(ciRun.event),"CI_WORKFLOW_IDENTITY");
  }
  let state="AUTOMATED_CHECKS_PASSED";
  if(r.merge_commit_sha!==null) {
    need(SHA.test(r.merge_commit_sha)&&pr.merged===true&&pr.merge_commit_sha===r.merge_commit_sha&&
      pr.merged_at&&r.state==="MERGED","MERGE_NOT_CORROBORATED");
    const commit=await get("/commits/"+r.merge_commit_sha,fetcher);
    need(commit.sha===r.merge_commit_sha&&Array.isArray(commit.parents)&&commit.parents.length===1&&
      commit.parents[0].sha===r.source_sha,"MERGE_COMMIT_NOT_CORROBORATED");
    state="MERGED";
  } else need(pr.merged!==true&&r.state==="AUTOMATED_CHECKS_PASSED","MERGE_STATE_CHANGED");
  const latest=await get(`/pulls/${number}`,fetcher);
  need(latest.head?.sha===head&&latest.merged===pr.merged&&
    latest.merge_commit_sha===pr.merge_commit_sha,"PR_CHANGED_DURING_READ");
  return {taskId:r.task_id,repository:TURN_REPO,sourceSha:r.source_sha,prNumber:number,
    prUrl:`https://github.com/${TURN_REPO}/pull/${number}`,testedSha:head,state,
    checks:ci.map(c=>({name:c.name,conclusion:c.conclusion})),repairAttempts:r.repair_attempts,
    mergeDecision:String(r.merge_decision).slice(0,150),mergeSha:r.merge_commit_sha,
    outstandingAcceptance:r.outstanding_acceptance.map(s=>String(s).slice(0,500)),
    nextAction:String(r.next_action).slice(0,500),runUrl:check.details_url,
    projectVerifiedComplete:false,observation:"LIVE_GITHUB_RECORDS_CORRELATED"};
}
