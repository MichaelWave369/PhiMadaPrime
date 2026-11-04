// R31: bind Agentora's existing trusted GitHub R1 return verifier to a selected
// Chronicle commit. Do not add an unsigned "agent identity" or completion claim.
import { readTurnResult, TURN_REPO, TURN_REPO_ID, turnEligible } from "./autonomous-turn.mjs";

const SHA=/^[a-f0-9]{40}$/;
const RUN_LINK=/^https:\/\/github\.com\/MichaelWave369\/Agentora\/actions\/runs\/[1-9]\d*$/;
const PR_LINK=/^https:\/\/github\.com\/MichaelWave369\/Agentora\/pull\/[1-9]\d*$/;
const STATES=new Set(["MERGED","AUTOMATED_CHECKS_PASSED"]);
const REQUIRED=new Set(["backend (3.12)","backend (3.13)","web"]);

function need(value, code) {
  if (!value) throw Error("R31_"+code);
}
export function turnProvenanceEligible(repo) {
  return turnEligible(repo) && repo.name==="Agentora" &&\n    repo.full_name===TURN_REPO && repo.id===TURN_REPO_ID;
}
function validateSelection(repo,history,commit,bundle) {
  need(turnProvenanceEligible(repo),"AGENTORA_ONLY");
  need(SHA.test(commit?.sha||"") &&
    (commit.parentSha===null || SHA.test(commit.parentSha||"")) &&
    history?.repository===repo.full_name &&
    history.repositoryId===repo.id && SHA.test(history.headSha||"") &&
    Array.isArray(history.commits) &&
    history.commits.some(item=>item.sha===commit.sha &&
      item.parentSha===commit.parentSha),"CHRONICLE_SELECTION_MISMATCH");
  need(bundle?.schema==="phimada.commit-evidence.v0.30" &&
    bundle.repository===repo.full_name && bundle.repositoryId===repo.id &&
    bundle.sha===commit.sha && bundle.parentSha===commit.parentSha &&
    bundle.historyHeadSha===history.headSha &&
    bundle.executedByPage===false && bundle.mergeAuthorized===false,
    "R30_SELECTION_MISMATCH");
}
export function correlateAgentoraR1Return(repo,history,commit,bundle,prNumber,result) {
  validateSelection(repo,history,commit,bundle);
  need(Number.isSafeInteger(prNumber)&&prNumber>0,"PR_NUMBER");
  need(result && result.observation==="LIVE_GITHUB_RECORDS_CORRELATED" &&
    result.repository===TURN_REPO && result.prNumber===prNumber &&
    SHA.test(result.sourceSha||"") && SHA.test(result.testedSha||"") &&
    (result.mergeSha===null || SHA.test(result.mergeSha||"")) &&
    STATES.has(result.state) &&
    result.projectVerifiedComplete===false &&
    PR_LINK.test(result.prUrl||"") &&
    result.prUrl===`https://github.com/${TURN_REPO}/pull/${prNumber}` &&
    RUN_LINK.test(result.runUrl||"") &&
    Number.isSafeInteger(result.repairAttempts) &&
    result.repairAttempts>=0 && result.repairAttempts<=2 &&
    Array.isArray(result.outstandingAcceptance) &&
    result.outstandingAcceptance.length<=10 &&
    Array.isArray(result.checks) && result.checks.length>=3 &&
    REQUIRED.size===new Set(result.checks.map(c=>c.name)).size &&
    result.checks.every(c=>REQUIRED.has(c.name) && c.conclusion==="success"),
    "TRUSTED_R1_RESULT_SHAPE");
  need((result.state==="MERGED")===Boolean(result.mergeSha),
    "MERGE_STATE_CONFLICT");
  const relation=commit.sha===result.mergeSha && result.state==="MERGED" ?
    "VERIFIED_MERGE_COMMIT" :
    commit.sha===result.testedSha ? "VERIFIED_TESTED_PR_HEAD" : null;
  // A task's input/source SHA is NOT the code that its worker produced.
  need(relation!==null,"SELECTED_COMMIT_NOT_AGENTORA_R1_OUTPUT");
  const prs=bundle.prs?.state==="OBSERVED" && Array.isArray(bundle.prs.prs) ?
    bundle.prs.prs : null;
  const found=prs?.find(pr=>pr.number===prNumber);
  return {
    schema:"phimada.agentora-r1-chronicle-correlation.v0.31",
    state:"LIVE_GITHUB_R1_RETURN_CORRELATED",
    relation,repository:TURN_REPO,repositoryId:TURN_REPO_ID,
    selectedSha:commit.sha,observedBranchHead:history.headSha,
    taskId:result.taskId,sourceSha:result.sourceSha,testedSha:result.testedSha,
    mergeSha:result.mergeSha,prNumber,prUrl:result.prUrl,
    runUrl:result.runUrl,repairAttempts:result.repairAttempts,
    checks:result.checks.map(c=>({name:c.name,conclusion:c.conclusion})),
    associatedPrInBoundedR30Page:prs?Boolean(found):null,
    ciRequirementNamesCorroborated:true,
    ownerApprovalCorroborated:true,controllerRunCorroborated:true,
    mergeReadbackCorroborated:result.state==="MERGED",
    outstandingAcceptance:result.outstandingAcceptance.map(x=>
      typeof x==="string"?x.slice(0,500):""),
    nextAction:typeof result.nextAction==="string"?result.nextAction.slice(0,500):"",
    agentIdentityAuthenticated:false,
    aiModelExecutionProven:false,
    browserExecutedWork:false,productVerifiedComplete:false,
    mergeAuthorized:false,dispatchAuthorized:false
  };
}
export async function verifyAgentoraR1ForCommit(repo,history,commit,bundle,prNumber,
  {reader=readTurnResult}={}) {
  // Validate before a single GitHub call; the underlying verified reader
  // performs the actual trusted run/review/check/merge REST corroboration.
  validateSelection(repo,history,commit,bundle);
  need(Number.isSafeInteger(prNumber) && prNumber>0,"PR_NUMBER");
  const result=await reader(prNumber);
  return correlateAgentoraR1Return(repo,history,commit,bundle,prNumber,result);
}
export function r31Handoff(result) {
  need(result?.schema==="phimada.agentora-r1-chronicle-correlation.v0.31" &&
    result.state==="LIVE_GITHUB_R1_RETURN_CORRELATED" &&
    SHA.test(result.selectedSha||""),"HANDOFF_UNAVAILABLE");
  return [
    "PhiMadaPrime / R31 AGENTORA EXECUTION PROVENANCE / READ-ONLY",
    "Repository: "+result.repository,
    "Chronicle commit: "+result.selectedSha,
    "Evidence relationship: "+result.relation,
    "Agentora task ID: "+result.taskId,
    "Starting source SHA: "+result.sourceSha,
    "Tested PR head: "+result.testedSha,
    "GitHub merge SHA: "+(result.mergeSha||"NOT_MERGED"),
    "PR: "+result.prUrl,
    "Trusted R1 workflow: "+result.runUrl,
    "Exact-SHA automated check names: "+result.checks.map(c=>c.name+" "+c.conclusion).join("; "),
    "Owner environment approval and GitHub workflow correlated: YES",
    "AI model/individual agent identity cryptographically authenticated: NO",
    "AI model execution proven: NO",
    "Product acceptance verified: NO",
    "Outstanding acceptance: "+result.outstandingAcceptance.length+" item(s)",
    "No browser execution, dispatch permission, PR approval or merge authorization.",
    "Revalidate GitHub records and review remaining acceptance independently."
  ].join("\n");
}
