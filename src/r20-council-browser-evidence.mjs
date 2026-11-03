// R20: local reviewer JSON + GitHub Actions original ZIP metadata correlation.
// This browser does not parse ZIP interiors or independently replay Chromium.
import { digestEvidenceZip } from "./evidence-bay.mjs";

export const R20_SCHEMA="phimada.council-browser-artifact-review.v0.20";
export const R20_MAX_REVIEW_BYTES=65536;
export const R20_MAX_ARCHIVE_BYTES=2000000;
const REPO="MichaelWave369/PhiMadaPrime";
const REPO_ID=1443845098;
const WORKFLOW=".github/workflows/r19-council-browser.yml";
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const AGE=8*24*3600*1000;
const CHECKS=Object.freeze([
  "page_deployed_sha","mission_board_and_council_open",
  "golden_receipt_display","tampered_receipt_refused",
  "rehashed_authority_refused","self_consistent_forgery_untrusted",
  "clear_restores_empty","reload_discards_review",
  "no_write_requests_observed"
]);
const FIELDS=Object.freeze([
  "schema","state","source","repository","repository_id",
  "workflow_path","workflow_run_id","workflow_attempt",
  "workflow_source_sha","observed_head_sha","source_is_current",
  "source_head_stable","artifact_id","artifact_name","artifact_bytes",
  "artifact_sha256","artifact_member_validated","reported_check_count",
  "reported_checks","fixture_sha256","fixture_source_authenticated",
  "council_consumer_execution_observed","independent_browser_replay",
  "reported_browser_checks_passed","scientific_evidence",
  "product_verified","merge_authorized","dispatch_authorized",
  "operator_review_required","run_observed_utc","reviewed_utc"
]);

function guard(condition,reason){if(!condition)throw new Error(reason);}
function plain(value){return value!==null&&typeof value==="object"&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype;}
function dateOk(value,now) {
  if(typeof value!=="string"||value.length>60)return false;
  const time=Date.parse(value);
  return Number.isFinite(time)&&time<=now+300000&&time>=now-AGE;
}
function validCatalog(catalog) {
  return Array.isArray(catalog)&&catalog.some(item=>
    item?.full_name===REPO&&item?.id===REPO_ID&&
    item?.archived===false&&item?.exampleOnly!==true);
}
export function parseR20CouncilReview(raw,catalog,now=Date.now()) {
  guard(typeof raw==="string"&&new TextEncoder().encode(raw).length>2&&
    new TextEncoder().encode(raw).length<=R20_MAX_REVIEW_BYTES,
    "R20_REVIEW_SIZE_REFUSED");
  guard(validCatalog(catalog),"R20_PUBLIC_CATALOG_REQUIRED");
  let r;
  try {r=JSON.parse(raw);}catch{throw new Error("R20_JSON_REFUSED");}
  guard(plain(r)&&JSON.stringify(Object.keys(r).sort())===
    JSON.stringify([...FIELDS].sort()),"R20_REVIEW_FIELDS_REFUSED");
  guard(r.schema===R20_SCHEMA&&
    ["R19_BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA",
     "R19_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA",
     "R19_BROWSER_ARTIFACT_HELD_HEAD_MOVED_DURING_READ"].includes(r.state)&&
    r.source==="ORIGINAL_GITHUB_ACTIONS_ZIP_AND_REST_METADATA"&&
    r.repository===REPO&&r.repository_id===REPO_ID&&
    r.workflow_path===WORKFLOW&&r.workflow_attempt===1&&
    Number.isSafeInteger(r.workflow_run_id)&&r.workflow_run_id>0&&
    SHA40.test(r.workflow_source_sha||"")&&SHA40.test(r.observed_head_sha||"")&&
    r.source_head_stable===(r.state!=="R19_BROWSER_ARTIFACT_HELD_HEAD_MOVED_DURING_READ")&&
    r.source_is_current===(r.state==="R19_BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA")&&
    (!r.source_is_current||r.observed_head_sha===r.workflow_source_sha)&&
    Number.isSafeInteger(r.artifact_id)&&r.artifact_id>0&&
    r.artifact_name==="phimada-r19-council-"+r.workflow_run_id&&
    Number.isSafeInteger(r.artifact_bytes)&&r.artifact_bytes>0&&
    r.artifact_bytes<=R20_MAX_ARCHIVE_BYTES&&
    SHA64.test(r.artifact_sha256||"")&&SHA64.test(r.fixture_sha256||"")&&
    r.artifact_member_validated===true&&r.reported_check_count===CHECKS.length&&
    plain(r.reported_checks)&&Object.keys(r.reported_checks).length===CHECKS.length&&
    CHECKS.every(key=>r.reported_checks[key]==="PASS")&&
    r.reported_browser_checks_passed===true&&
    ["fixture_source_authenticated","council_consumer_execution_observed",
      "independent_browser_replay","scientific_evidence","product_verified",
      "merge_authorized","dispatch_authorized"].every(key=>r[key]===false)&&
    r.operator_review_required===true&&
    dateOk(r.run_observed_utc,now)&&dateOk(r.reviewed_utc,now)&&
    Date.parse(r.run_observed_utc)<=Date.parse(r.reviewed_utc)+300000,
    "R20_REVIEW_TRUST_REFUSED");
  // This is still operator-supplied unsigned reviewer data.
  return Object.freeze({
    runId:r.workflow_run_id,artifactId:r.artifact_id,
    artifactName:r.artifact_name,artifactBytes:r.artifact_bytes,
    artifactSha256:r.artifact_sha256,fixtureSha256:r.fixture_sha256,
    sourceSha:r.workflow_source_sha,
    reviewedUtc:r.reviewed_utc,observedUtc:r.run_observed_utc,
    runUrl:"https://github.com/"+REPO+"/actions/runs/"+r.workflow_run_id,
    localReviewerState:r.state,declaredSourceCurrent:r.source_is_current,
    state:"R20_LOCAL_REPORT_UNCORROBORATED",
    productVerified:false,mergeAuthorized:false
  });
}

async function githubJson(fetcher,path) {
  const res=await fetcher("https://api.github.com"+path,{
    method:"GET",credentials:"omit",redirect:"error",cache:"no-store",
    headers:{Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28"}
  });
  guard(res?.ok,"R20_GITHUB_READ_REFUSED");
  const len=Number(res.headers?.get?.("content-length"));
  guard(!Number.isFinite(len)||len<=250000,"R20_GITHUB_BYTES_REFUSED");
  const data=await res.text();
  guard(typeof data==="string"&&data.length<=250000,"R20_GITHUB_BYTES_REFUSED");
  try{return JSON.parse(data);}catch{throw new Error("R20_GITHUB_JSON_REFUSED");}
}
function branchSha(branch) {
  guard(plain(branch)&&branch.name==="main"&&
    plain(branch.commit)&&SHA40.test(branch.commit.sha||""),
    "R20_GITHUB_BRANCH_REFUSED");
  return branch.commit.sha;
}
export async function corroborateR20Council(review,zip,catalog,{
  fetcher=globalThis.fetch,cryptoApi=globalThis.crypto,now=Date.now()
}={}) {
  guard(review&&validCatalog(catalog)&&
    Number.isSafeInteger(review.runId)&&review.runId>0&&
    SHA40.test(review.sourceSha||"")&&SHA64.test(review.artifactSha256||"")&&
    dateOk(review.reviewedUtc,now),
    "R20_REVIEW_NOT_READY");
  guard(zip&&Number.isSafeInteger(zip.size)&&
    zip.size>0&&zip.size<=R20_MAX_ARCHIVE_BYTES,"R20_ARCHIVE_SIZE_REFUSED");
  const digest=await digestEvidenceZip(zip,cryptoApi);
  guard(digest===review.artifactSha256&&zip.size===review.artifactBytes,
    "R20_LOCAL_ZIP_HASH_REFUSED");
  const root="/repos/"+REPO;
  const runPath=root+"/actions/runs/"+review.runId;
  const [run,listing,repository]=await Promise.all([
    githubJson(fetcher,runPath),
    githubJson(fetcher,runPath+"/artifacts?per_page=100"),
    githubJson(fetcher,root)
  ]);
  guard(plain(run)&&run.id===review.runId&&
    run.event==="workflow_dispatch"&&run.path===WORKFLOW&&
    run.status==="completed"&&run.conclusion==="success"&&
    run.run_attempt===1&&run.head_sha===review.sourceSha&&
    plain(run.repository)&&run.repository.id===REPO_ID&&
    run.repository.full_name===REPO&&plain(run.head_repository)&&
    run.head_repository.full_name===REPO&&dateOk(run.created_at,now),
    "R20_RUN_MISMATCH");
  guard(plain(listing)&&Number.isSafeInteger(listing.total_count)&&
    listing.total_count>0&&listing.total_count<=100&&
    Array.isArray(listing.artifacts)&&listing.artifacts.length===listing.total_count,
    "R20_ARTIFACT_LIST_REFUSED");
  const matches=listing.artifacts.filter(item=>
    plain(item)&&item.name===review.artifactName);
  guard(matches.length===1&&matches[0].id===review.artifactId&&
    matches[0].expired===false&&
    matches[0].size_in_bytes===zip.size&&
    matches[0].digest==="sha256:"+digest&&
    (!plain(matches[0].workflow_run)||
      matches[0].workflow_run.id===review.runId),
    "R20_ARTIFACT_MISMATCH");
  guard(plain(repository)&&repository.id===REPO_ID&&
    repository.full_name===REPO&&plain(repository.owner)&&
    repository.owner.login==="MichaelWave369"&&
    repository.private===false&&repository.archived===false&&
    repository.default_branch==="main","R20_REPOSITORY_MISMATCH");
  const first=branchSha(await githubJson(fetcher,root+"/branches/main"));
  const second=branchSha(await githubJson(fetcher,root+"/branches/main"));
  const stable=first===second;
  const current=stable&&second===review.sourceSha;
  return Object.freeze({
    runId:review.runId,sourceSha:review.sourceSha,
    observedHeadSha:second,observedUtc:new Date(now).toISOString(),
    state:!stable?"R20_HEAD_CHANGED_DURING_REVIEW":
      current?"R20_R19_ARTIFACT_CORRELATED_CURRENT_SHA":
      "R20_R19_ARTIFACT_CORRELATED_HISTORICAL_SHA",
    reportedBrowserChecks:9,
    githubRunMatched:true,githubArtifactDigestMatched:true,
    originalZipDigestMatched:true,artifactInteriorReviewedByLocalPython:true,
    browserIndependentlyReplayed:false,
    sourceAuthenticated:false,scientificEvidence:false,
    productVerified:false,mergeAuthorized:false,dispatchAuthorized:false,
    sourceCurrent:current
  });
}
