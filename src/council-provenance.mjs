/**
 * PhiMadaPrime R37: council provenance comparison.
 * R36 signed synthetic evidence and Agentora R1 GitHub readback are TWO
 * independent sources. There is no cross-source attestation or agent/model
 * identity binding in either protocol. Always fail closed.
 */
import {OPERATORS,ORI_COUNCIL} from "./thinktank-model.mjs";
import {readTurnResult,TURN_REPO} from "./autonomous-turn.mjs";

const SHA=/^[a-f0-9]{40}$/;
const PR=/^[1-9]\d{0,8}$/;
const runURL=/^https:\/\/github\.com\/MichaelWave369\/Agentora\/actions\/runs\/[1-9]\d*$/;
const prURL=/^https:\/\/github\.com\/MichaelWave369\/Agentora\/pull\/[1-9]\d*$/;
const REQUIRED=new Set(["backend (3.12)","backend (3.13)","web"]);
const need=(value,code)=>{if(!value)throw Error("R37_"+code);};

export const COUNCIL_SEATS=Object.freeze([...OPERATORS,...ORI_COUNCIL].map(role=>Object.freeze({
  id:role.id,name:role.name,role:role.role,team:OPERATORS.some(p=>p.id===role.id)
    ?"PRIMARY_OPERATORS":"ORI_COUNCIL"
})));

export function selectCouncilSeat(id) {
  const seat=COUNCIL_SEATS.find(s=>s.id===id);
  need(seat,"UNKNOWN_SEAT");
  return seat;
}

export function r36EvidenceSummary(verifiedR36) {
  const signed=verifiedR36?.status==="R10_SIGNATURE_VALID_INSPECTION_ONLY" &&
    verifiedR36.signatureValid===true && verifiedR36.keyPinned===true &&
    verifiedR36.sourceReplayConsistent===true &&
    verifiedR36.authority==="NONE" && verifiedR36.actionAllowed===false &&
    Array.isArray(verifiedR36.permissions) && verifiedR36.permissions.length===0;
  return {
    category:signed?"R10_PINNED_SYNTHETIC_PASSPORT":"NO_VERIFIED_R10_SIGNATURE",
    issuerId:signed?String(verifiedR36.issuerId||"").slice(0,100):null,
    modelLabel:signed?String(verifiedR36.model||"").slice(0,128):null,
    modelExecutionProven:false,
    councilSeatAuthenticated:false,
    sourceToAgentoraBound:false,
    operatorApproved:false,
    authority:"NONE",
    actionAllowed:false
  };
}

/** The only default source is the existing R1 reader, which does live GitHub GET corroboration.
 * Tests may inject a fake reader, but that does NOT represent real attestation.
 * A task SOURCE sha never counts as the worker's output.
 */
export async function verifyAgentoraCouncilEvidence(prNumber,expectedOutputSha,
  {reader=readTurnResult}={}) {
  need(typeof prNumber==="string"&&PR.test(prNumber),"PR_NUMBER");
  need(typeof expectedOutputSha==="string"&&SHA.test(expectedOutputSha),"OUTPUT_SHA");
  const number=Number(prNumber);
  const result=await reader(number);
  need(result?.observation==="LIVE_GITHUB_RECORDS_CORRELATED" &&
    result.repository===TURN_REPO && result.prNumber===number &&
    result.projectVerifiedComplete===false &&
    SHA.test(result.sourceSha||"") && SHA.test(result.testedSha||"") &&
    (result.mergeSha===null||SHA.test(result.mergeSha||"")) &&
    (result.state==="MERGED"||result.state==="AUTOMATED_CHECKS_PASSED") &&
    result.prUrl===("https://github.com/"+TURN_REPO+"/pull/"+number) &&
    prURL.test(result.prUrl) && runURL.test(result.runUrl||"") &&
    Array.isArray(result.checks) && result.checks.length===REQUIRED.size &&
    new Set(result.checks.map(c=>c.name)).size===REQUIRED.size &&
    result.checks.every(c=>REQUIRED.has(c.name)&&c.conclusion==="success") &&
    Array.isArray(result.outstandingAcceptance) &&
    result.outstandingAcceptance.length<=10 &&
    Number.isSafeInteger(result.repairAttempts)&&result.repairAttempts>=0 &&
    result.repairAttempts<=2 &&
    typeof result.taskId==="string"&&result.taskId.length>0 &&
    result.taskId.length<=160,"TRUSTED_RETURN_SHAPE");
  need((result.state==="MERGED")===Boolean(result.mergeSha),"MERGE_STATE");
  const relation=result.state==="MERGED"&&expectedOutputSha===result.mergeSha
    ?"VERIFIED_MERGE_COMMIT":expectedOutputSha===result.testedSha
      ?"VERIFIED_TESTED_PR_HEAD":null;
  need(relation!==null,"OUTPUT_NOT_CORRELATED");
  need(expectedOutputSha!==result.sourceSha,"INPUT_IS_NOT_OUTPUT");
  return Object.freeze({
    status:"GITHUB_AGENTORA_R1_OUTPUT_CORRELATED",
    relation,repo:TURN_REPO,prNumber:number,prUrl:result.prUrl,
    runUrl:result.runUrl,taskId:result.taskId,
    sourceSha:result.sourceSha,testedSha:result.testedSha,mergeSha:result.mergeSha,
    observedOutputSha:expectedOutputSha,
    checks:result.checks.map(c=>({name:c.name,conclusion:c.conclusion})),
    humanAcceptanceOutstanding:result.outstandingAcceptance.length,
    ownerWorkflowCorroborated:true,
    agentModelIdentityVerified:false,
    inferenceProven:false,productVerifiedComplete:false,
    councilSeatAuthenticated:false,sourceToR10PassportBound:false,
    authority:"NONE",permissions:[],actionAllowed:false
  });
}

export function councilProvenanceSnapshot(seatId,r36Report,r1Record=null){
  const seat=selectCouncilSeat(seatId);
  const synthetic=r36EvidenceSummary(r36Report);
  const githubValid=r1Record?.status==="GITHUB_AGENTORA_R1_OUTPUT_CORRELATED" &&
    r1Record.repo===TURN_REPO && r1Record.authority==="NONE" &&
    r1Record.actionAllowed===false && r1Record.agentModelIdentityVerified===false &&
    r1Record.sourceToR10PassportBound===false;
  return {
    schema:"phimada.council-provenance-review.v0.37",
    selectedCouncilSeat:seat,
    seatStatus:"OPERATOR_SELECTED_ROLE_NOT_AUTHENTICATED",
    r10:synthetic,
    agentora:githubValid?{
      category:"LIVE_GITHUB_R1_OUTPUT_CORRELATED",
      taskId:r1Record.taskId,
      outputSha:r1Record.observedOutputSha,
      relation:r1Record.relation,
      sourceSha:r1Record.sourceSha,
      prUrl:r1Record.prUrl,runUrl:r1Record.runUrl
    }:{category:"NOT_CORRELATED"},
    crossSourceBinding:"NONE",
    modelIdentity:"NOT_PROVEN",
    councilExecution:"NOT_PROVEN",
    realModelInference:"NOT_PROVEN",
    productComplete:false,
    humanAuthorizationGranted:false,
    permissions:[],
    authority:"NONE",
    actionAllowed:false
  };
}

export function councilProvenanceHandoff(snapshot){
  need(snapshot?.schema==="phimada.council-provenance-review.v0.37" &&
    snapshot.authority==="NONE" && snapshot.actionAllowed===false &&
    snapshot.crossSourceBinding==="NONE" &&
    snapshot.humanAuthorizationGranted===false,"UNSAFE_HANDOFF");
  const seat=selectCouncilSeat(snapshot.selectedCouncilSeat?.id);
  // Deliberately categorical and review-only; never serialize original documents.
  return [
    "PHIMADA PRIME R37 / COUNCIL PROVENANCE / REVIEW ONLY",
    "Selected seat: "+seat.name+" ("+seat.team+")",
    "Seat identity: NOT AUTHENTICATED; no live council session proven",
    "R10 synthetic passport: "+snapshot.r10.category,
    "R10 signed issuer/model labels are NOT a proven model identity",
    "Agentora R1 output: "+snapshot.agentora.category,
    "Agentora output SHA: "+(snapshot.agentora.outputSha||"NOT CORRELATED"),
    "Agentora PR: "+(snapshot.agentora.prUrl||"NOT CORRELATED"),
    "Cross-source R10 to Agentora binding: NONE",
    "AI inference proven: NO",
    "Product completion: NO; human authorization granted: NO",
    "Authority: NONE; permissions: []; actionAllowed: false",
    "Reverify original evidence and GitHub records independently before relying on any claim."
  ].join("\n");
}
