// R43 · Operator-triggered public GitHub GMED second opinion.
// A second, bounded observation from the SAME public provider, not a signed
// attestation, independent organization, test execution, or permission grant.
import {inspectGmedLocalReceipt} from "./verified-pipeline-local-receipts.mjs";

const API="https://api.github.com";
const MAX_PAGES=5;
const MAX_SIGNALS=500;
const SHA=/^[a-f0-9]{40}$/i;
const GOOD=new Set(["success","neutral","skipped"]);
const BAD=new Set(["failure","timed_out","cancelled","action_required","startup_failure","stale"]);
const WAIT=new Set(["queued","in_progress","pending","requested","waiting"]);

const blank=(state,extra={})=>({
  kind:"PHI_GMED_SECOND_OPINION_V1",
  mode:"ON_DEMAND_PUBLIC_GITHUB_REOBSERVATION",
  state,
  reobserved_at:null,
  same_provider_as_original:true,
  independent_implementation:true,
  matching_github_evidence:false,
  original_gmed_producer_authenticated:false,
  github_authenticated_cryptographically:false,
  external_auditor_confirmed:false,
  test_commands_replayed:false,
  required_checks_verified:false,
  human_approval_recorded:false,
  merge_authorized:false,
  permissions:[],
  warning:"Two consistent public GitHub observations use the same provider. Neither proves the original report's producer, every required test, deployment behavior, or permission to merge.",
  ...extra
});
const signature=item=>JSON.stringify([
  item.kind,item.name,item.status,item.conclusion,item.grade,item.url
]);
function compareRows(left,right){
  return JSON.stringify(left.map(signature).sort())===
    JSON.stringify(right.map(signature).sort());
}
function normalizeCheck(c){
  if(!c||typeof c.name!=="string"||typeof c.status!=="string")
    throw Error("Malformed check-run row");
  const status=c.status;
  const conclusion=c.conclusion==null?null:String(c.conclusion);
  const grade=status==="completed"?
    GOOD.has(conclusion)?"good":BAD.has(conclusion)?"bad":"unknown":
    WAIT.has(status)?"pending":"unknown";
  return {name:String(c.name||"Unnamed check"),kind:"check",status,
    conclusion,grade,
    url:typeof c.html_url==="string"&&/^https:\/\/github\.com\//.test(c.html_url)?
      c.html_url:null};
}
function normalizeStatus(c){
  if(!c||typeof c.context!=="string"||typeof c.state!=="string")
    throw Error("Malformed legacy status row");
  const status=c.state;
  return {name:String(c.context||"Legacy status"),kind:"status",status,
    conclusion:null,grade:status==="success"?"good":
    status==="failure"||status==="error"?"bad":
    status==="pending"?"pending":"unknown",
    url:typeof c.target_url==="string"&&/^https:\/\//.test(c.target_url)?
      c.target_url:null};
}
function freshGrade(merged,commit,signals){
  if(!merged)return "NOT_MERGED";
  if(!SHA.test(commit||""))return "UNVERIFIED";
  let passed=0,failed=0,pending=0,unknown=0;
  for(const row of signals){
    if(row.grade==="bad")failed++;
    else if(row.grade==="pending")pending++;
    else if(row.grade==="unknown")unknown++;
    else if(row.grade==="good"&&(row.kind==="status"||row.conclusion==="success"))passed++;
  }
  return failed?"FAILED":pending?"PENDING":unknown?"UNVERIFIED":
    !passed?"UNVERIFIED":"GMED";
}
function hasNext(link){
  return /<[^>]+>;\s*rel="next"/.test(link||"");
}
async function githubRead(path,fetcher){
  // All network destinations are constructed from validated GitHub identity.
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetcher(API+path,{
      method:"GET",credentials:"omit",redirect:"error",
      headers:{Accept:"application/vnd.github+json",
        "X-GitHub-Api-Version":"2022-11-28"},
      signal:controller.signal
    });
    if(!response?.ok)throw Error("GitHub response unavailable (HTTP "+
      (response?.status||"unknown")+")");
    const value=await response.json();
    return {value,link:response.headers?.get?.("link")||""};
  }finally{clearTimeout(timeout);}
}
async function readChecks(base,commit,fetcher){
  const result=[];let expected=null;
  for(let page=1;page<=MAX_PAGES;page++){
    const item=await githubRead(base+"/commits/"+commit+
      "/check-runs?filter=latest&per_page=100&page="+page,fetcher);
    if(!Array.isArray(item.value?.check_runs)||
       !Number.isSafeInteger(item.value.total_count)||
       item.value.total_count<0||item.value.total_count>MAX_SIGNALS)
      throw Error("GitHub check-run list malformed or exceeds cap");
    if(expected!==null&&expected!==item.value.total_count)
      throw Error("GitHub check-run list changed during pagination");
    expected=item.value.total_count;
    result.push(...item.value.check_runs.map(normalizeCheck));
    if(result.length>MAX_SIGNALS)throw Error("GitHub check-run count exceeded cap");
    if(!hasNext(item.link)){
      if(result.length!==expected)
        throw Error("GitHub check-run list truncated or incomplete");
      return result;
    }
  }
  throw Error("GitHub check-run pagination exceeded five pages");
}
async function readStatuses(base,commit,fetcher){
  const result=[];
  for(let page=1;page<=MAX_PAGES;page++){
    const item=await githubRead(base+"/commits/"+commit+
      "/status?per_page=100&page="+page,fetcher);
    if(!Array.isArray(item.value?.statuses)||
       item.value.statuses.length>100)throw Error("Malformed GitHub statuses");
    result.push(...item.value.statuses.map(normalizeStatus));
    if(result.length>MAX_SIGNALS)throw Error("GitHub status list exceeds cap");
    if(!hasNext(item.link))return result;
  }
  throw Error("GitHub status pagination exceeded five pages");
}
export async function reobserveGmedReceipt(raw,{
  fetcher=fetch,clock=()=>new Date()
}={}){
  // R42 validates local report schema, row grades and identity before
  // permitting even an explicit, controlled public request.
  const time=clock();
  if(!(time instanceof Date)||!Number.isFinite(time.getTime()))
    throw Error("Clock unavailable for second opinion");
  const inspection=inspectGmedLocalReceipt(raw,time.getTime());
  const original=JSON.parse(raw);
  const {target}=original;
  if(target.owner.toLowerCase()!=="michaelwave369")
    return blank("TARGET_OUTSIDE_PUBLIC_FLEET",{
      repository:target.fullName,pr_number:target.number
    });
  const base="/repos/"+encodeURIComponent(target.owner)+"/"+encodeURIComponent(target.repo);
  const details={repository:target.fullName,pr_number:target.number,
    imported_state:inspection.reported_state,imported_sha:inspection.reported_sha,
    imported_at:inspection.observed_at,imported_stale:!inspection.fresh_at_review};
  try{
    // Check real repository identity and public scope first.
    const repo=await githubRead(base,fetcher);
    if(repo.value?.private!==false||
       repo.value?.full_name?.toLowerCase()!==target.fullName.toLowerCase())
      throw Error("Public repository identity mismatch");
    const pull=await githubRead(base+"/pulls/"+target.number,fetcher);
    const pr=pull.value;
    if(pr?.number!==target.number||typeof pr?.merged!=="boolean"||
       pr?.base?.repo?.full_name?.toLowerCase()!==target.fullName.toLowerCase())
      throw Error("Public PR identity mismatch");
    const mergeSha=typeof pr.merge_commit_sha==="string"&&SHA.test(pr.merge_commit_sha)?
      pr.merge_commit_sha.toLowerCase():null;
    let rows=[];
    if(pr.merged===true&&mergeSha){
      const [checks,statuses]=await Promise.all([
        readChecks(base,mergeSha,fetcher),
        readStatuses(base,mergeSha,fetcher)
      ]);
      rows=[...checks,...statuses];
    }
    const freshState=freshGrade(pr.merged,mergeSha,rows);
    const sameState=inspection.reported_state===freshState;
    const sameMerged=original.merged===pr.merged;
    const sameSha=(inspection.reported_sha||null)===mergeSha;
    const sameRows=compareRows(original.checks,rows);
    const matched=sameState&&sameMerged&&sameSha&&sameRows;
    const reobservedAt=clock();
    if(!(reobservedAt instanceof Date)||!Number.isFinite(reobservedAt.getTime()))
      throw Error("Clock unavailable after second observation");
    return blank(matched?(freshState==="GMED"?
      "SECOND_OBSERVATION_GMED_AGREEMENT":"SECOND_OBSERVATION_NON_GREEN_AGREEMENT"):
      "SECOND_OBSERVATION_MISMATCH",{
      ...details,reobserved_at:reobservedAt.toISOString(),
      github_observed_state:freshState,github_observed_merge_sha:mergeSha,
      github_observed_signal_count:rows.length,
      observed_base_branch:typeof pr.base?.ref==="string"?pr.base.ref:null,
      observed_signals:rows,
      checks:{same_state:sameState,same_merged:sameMerged,
        same_merge_sha:sameSha,same_signal_multiset:sameRows},
      matching_github_evidence:matched
    });
  }catch(error){
    return blank("REOBSERVATION_UNAVAILABLE",{
      ...details,
      error:error instanceof Error?error.message.slice(0,200):
        "Public GitHub observation failed"
    });
  }
}
