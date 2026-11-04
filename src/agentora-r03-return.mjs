// R27: correlate an ORIGINAL PhiMada R8 request with an OFFLINE Agentora
// Fleet R0.3 intake receipt. Strict local byte-binding, not source authentication,
// test execution, product verification or permission to dispatch/merge.
import { CONTRACT_TYPES } from "./contracts.mjs";
import { signalsFresh } from "./signals.mjs";
import { OWNER } from "./fleet.mjs";

export const R03_REQUEST_SCHEMA="phimada.verification-request.v0.8";
export const R03_INTAKE_SCHEMA="agentora.fleet.verification-intake.v0.3";
export const R03_MAX_REQUEST_BYTES=65536;
export const R03_MAX_RECEIPT_BYTES=98304;

const HEX40=/^[a-f0-9]{40}$/;
const HEX64=/^[a-f0-9]{64}$/;
const NAME=/^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9_./-]{1,128}$/;
const UTC=/^(?:\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?)(?:Z|[+-]\d\d:\d\d)$/;
const REQUEST_FIELDS=[
  "schema","owner","repository","repository_id","default_branch",
  "source_sha","source_observed_utc","prepared_utc","surface_types",
  "required_checks","operator_notes_included","operator_review_required",
  "independent_verification","execution_state","approved_for_execution",
  "merge_authorized","job_dispatch_authorized"
];
const RECEIPT_FIELDS=[
  "schema","state","owner","repository","repository_id","default_branch",
  "source_sha","source_observed_utc","prepared_utc","received_utc",
  "request_sha256","digest_is_authentication","surface_types","checks",
  "head_revalidated_by_agentora","independent_checks_run","verified_complete",
  "operator_approved","dispatch_authorized","merge_authorized","next_steps"
];
const CHECK_FIELDS=[
  "check_id","operator_reviewed_claim","lane","verification_state",
  "evidence_receipt"
];
const MANUAL=new Set([
  "browser_interaction","accessibility","headset_input","comfort_acceptance",
  "navigation","clean_install_import","recovery_rollback","device_smoke",
  "clean_install_launch","vm_boot","hardware_acceptance","methodology",
  "reproducible_results","negative_controls","limitations_review",
  "scope_and_surface_classification","deployed_revision","versioned_artifact"
]);
function fail(code){throw new Error("R27_"+code);}
function require(condition,code){if(!condition)fail(code);}
function plain(value){return value!==null&&typeof value==="object"&&
  !Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function exactKeys(obj,fields){
  return plain(obj)&&Object.keys(obj).length===fields.length&&
    fields.every(key=>Object.hasOwn(obj,key));
}
function checkTime(value){
  require(typeof value==="string"&&value.length<=64&&UTC.test(value),
    "TIME_UNZONED_OR_INVALID");
  const n=Date.parse(value);
  require(Number.isFinite(n),"TIME_NOT_FINITE");
  return n;
}
function parse(bytes,limit,label){
  require(bytes instanceof Uint8Array&&bytes.byteLength>0&&
    bytes.byteLength<=limit,label+"_SIZE");
  let value;
  try{value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
  catch{fail(label+"_JSON_INVALID");}
  require(plain(value),label+"_OBJECT_REQUIRED");
  return value;
}
function surfacesAndChecks(request){
  require(Array.isArray(request.surface_types)&&request.surface_types.length>0&&
    request.surface_types.length<=10&&
    request.surface_types.every(x=>typeof x==="string"&&
      Object.hasOwn(CONTRACT_TYPES,x))&&
    new Set(request.surface_types).size===request.surface_types.length,
    "SURFACE_TYPES_REFUSED");
  const required=[...new Set(request.surface_types.flatMap(type=>
    CONTRACT_TYPES[type].checks))];
  require(Array.isArray(request.required_checks)&&
    request.required_checks.length===required.length&&
    request.required_checks.every((item,i)=>exactKeys(item,
      ["id","locally_reviewed"])&&
      item.id===required[i]&&typeof item.locally_reviewed==="boolean"),
    "REQUEST_CHECKS_REFUSED");
  return required;
}
function validateRequest(request,repo,now){
  require(exactKeys(request,REQUEST_FIELDS),"REQUEST_FIELDS_REFUSED");
  require(request.schema===R03_REQUEST_SCHEMA&&request.owner===OWNER,
    "REQUEST_SCHEMA_REFUSED");
  require(repo&&!repo.exampleOnly&&Number.isSafeInteger(repo.id)&&repo.id>0&&
    typeof repo.name==="string"&&NAME.test(repo.name)&&
    repo.name!=="."&&repo.name!==".."&&
    repo.full_name===OWNER+"/"+repo.name &&
    request.repository===repo.full_name&&request.repository_id===repo.id,
    "REPOSITORY_BINDING_REFUSED");
  require(typeof request.default_branch==="string"&&
    BRANCH.test(request.default_branch)&&
    HEX40.test(request.source_sha),"SOURCE_REFUSED");
  for(const [name,wanted] of [
    ["operator_notes_included",false],["operator_review_required",true],
    ["independent_verification","NOT_RUN"],
    ["execution_state","NOT_DISPATCHED"],
    ["approved_for_execution",false],
    ["merge_authorized",false],["job_dispatch_authorized",false]
  ]){
    require(request[name]===wanted &&
      (typeof wanted!=="boolean"||typeof request[name]==="boolean"),
      "REQUEST_AUTHORITY_REFUSED");
  }
  const observed=checkTime(request.source_observed_utc);
  const prepared=checkTime(request.prepared_utc);
  require(prepared-observed<=15*60000&&
    observed-prepared<=5*60000 &&
    prepared<=now+5*60000,"REQUEST_TIME_CHAIN_REFUSED");
  const required=surfacesAndChecks(request);
  return {required,observed,prepared};
}
function validateReceipt(receipt,request,digest,required,prepared,now){
  require(exactKeys(receipt,RECEIPT_FIELDS),"RECEIPT_FIELDS_REFUSED");
  require(receipt.schema===R03_INTAKE_SCHEMA &&
    receipt.state==="HELD_FOR_OPERATOR_REVIEW"&&
    receipt.owner===OWNER&&receipt.repository===request.repository&&
    receipt.repository_id===request.repository_id&&
    receipt.default_branch===request.default_branch&&
    receipt.source_sha===request.source_sha&&
    receipt.source_observed_utc===request.source_observed_utc&&
    receipt.prepared_utc===request.prepared_utc,
    "RECEIPT_SOURCE_MISMATCH");
  require(typeof receipt.request_sha256==="string"&&
    HEX64.test(receipt.request_sha256)&&receipt.request_sha256===digest,
    "RECEIPT_REQUEST_DIGEST_MISMATCH");
  for(const [name,wanted] of [
    ["digest_is_authentication",false],
    ["head_revalidated_by_agentora",false],
    ["independent_checks_run",0],["verified_complete",false],
    ["operator_approved",false],["dispatch_authorized",false],
    ["merge_authorized",false]
  ]){
    require(receipt[name]===wanted&&
      (typeof wanted!=="boolean"||typeof receipt[name]==="boolean"),
      "RECEIPT_AUTHORITY_REFUSED");
  }
  require(Array.isArray(receipt.surface_types)&&
    receipt.surface_types.length===request.surface_types.length&&
    receipt.surface_types.every((type,i)=>type===request.surface_types[i]),
    "RECEIPT_SURFACES_MISMATCH");
  require(Array.isArray(receipt.checks)&&
    receipt.checks.length===required.length&&
    receipt.checks.every((item,i)=>{
      const check=request.required_checks[i];
      return exactKeys(item,CHECK_FIELDS)&&
        item.check_id===required[i]&&
        item.operator_reviewed_claim===check.locally_reviewed&&
        item.verification_state==="NOT_RUN"&&item.evidence_receipt===null&&
        item.lane===(MANUAL.has(item.check_id)?
          "HUMAN_OR_DEVICE_REQUIRED":"AUTOMATION_CANDIDATE_ONLY");
    }),"RECEIPT_CHECKS_REFUSED");
  require(Array.isArray(receipt.next_steps)&&receipt.next_steps.length===6&&
    receipt.next_steps.every(step=>typeof step==="string"&&
      step.length>0&&step.length<=300),"RECEIPT_NEXT_STEPS_REFUSED");
  const received=checkTime(receipt.received_utc);
  require(received>=prepared-5*60000&&
    received-prepared<=24*60*60000&&received<=now+5*60000,
    "RECEIPT_TIME_CHAIN_REFUSED");
  return received;
}
function presentContext(request,repo,contract,signal,now){
  const observed=signal&&signal.repository===repo.full_name&&
    signal.repositoryId===repo.id&&
    signal.from==="LIVE_PUBLIC_GITHUB_API_READ_ONLY"&&
    signal.functionallyVerified===false&&signal.mergeAuthorized===false&&
    HEX40.test(signal.headSha||"")&&
    signalsFresh(signal,now);
  const sourceState=!observed?"CURRENT_HEAD_NOT_RECHECKED":
    signal.headSha!==request.source_sha?"SOURCE_MOVED":
    "CURRENT_HEAD_MATCHES_LOCAL_OBSERVATION";
  const contractState=!contract?"NO_LOCAL_CONTRACT":
    contract.repository!==repo.full_name||
    contract.repository_id!==repo.id||
    contract.source_sha!==request.source_sha||
    !Array.isArray(contract.surface_types)||
    JSON.stringify(contract.surface_types)!==JSON.stringify(request.surface_types)||
    !Array.isArray(contract.checks)||
    contract.checks.length!==request.required_checks.length||
    !contract.checks.every((item,i)=>item?.id===request.required_checks[i]?.id)?
      "CONTRACT_NOT_ALIGNED":"LOCAL_CONTRACT_ALIGNED";
  return {sourceState,contractState};
}
export async function reviewAgentoraR03(requestBytes,receiptBytes,repo,contract,signal,
  {webcrypto=globalThis.crypto,now=Date.now()}={}){
  require(Number.isFinite(now),"CLOCK_REFUSED");
  const request=parse(requestBytes,R03_MAX_REQUEST_BYTES,"REQUEST");
  const receipt=parse(receiptBytes,R03_MAX_RECEIPT_BYTES,"RECEIPT");
  const {required,prepared}=validateRequest(request,repo,now);
  require(webcrypto&&webcrypto.subtle&&
    typeof webcrypto.subtle.digest==="function","DIGEST_API_UNAVAILABLE");
  const digest=Array.from(new Uint8Array(
    await webcrypto.subtle.digest("SHA-256",requestBytes)
  )).map(x=>x.toString(16).padStart(2,"0")).join("");
  validateReceipt(receipt,request,digest,required,prepared,now);
  return {
    schema:"phimada.agentora-r03-local-correlation.v0.27",
    state:"ORIGINAL_REQUEST_AND_LOCAL_R03_RECEIPT_CORRELATED",
    repository:repo.full_name,repositoryId:repo.id,
    sourceSha:request.source_sha,requestSha256:digest,
    preparedUtc:request.prepared_utc,receivedUtc:receipt.received_utc,
    requiredChecks:required.length,
    surfaceTypes:[...request.surface_types],
    checkIds:[...required],
    humanDeviceChecks:receipt.checks.filter(x=>
      x.lane==="HUMAN_OR_DEVICE_REQUIRED").length,
    ...presentContext(request,repo,contract,signal,now),
    originalRequestBytesMatched:true,
    sourceAuthenticated:false,agentoraProducerAuthenticated:false,
    githubRunAuthenticated:false,independentChecksRun:0,
    productVerified:false,completionVerified:false,
    dispatched:false,operatorApproved:false,
    mergeAuthorized:false,dispatchAuthorized:false,
    // For local presentation only; no files or arbitrary next-step text retained.
  };
}
export function recheckR03Context(result,repo,contract,signal,now=Date.now()){
  if(!result || result.repository!==repo?.full_name||
    result.repositoryId!==repo?.id||!HEX40.test(result.sourceSha||"")){
    return {sourceState:"NOT_CORRELATED",contractState:"NOT_CORRELATED"};
  }
  return presentContext({
    source_sha:result.sourceSha,
    surface_types:result.surfaceTypes||[],
    required_checks:result.checkIds||[]
  },repo,contract,signal,now);
}
