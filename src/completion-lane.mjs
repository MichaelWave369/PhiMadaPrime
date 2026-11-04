// R26: one public repository at a time, without inventing a completion claim.
// Reuse R8's strict export validator instead of creating a parallel approval gate.
import { OWNER } from "./fleet.mjs";
import { prepareVerificationRequest } from "./verification-request.mjs";
import { signalsFresh } from "./signals.mjs";
import { contractProgress } from "./contracts.mjs";

const SHA40 = /^[a-f0-9]{40}$/;

const STEP = Object.freeze({
  SELECT_REPO: "SELECT_REPO",
  CATALOG_UNAVAILABLE: "CATALOG_UNAVAILABLE",
  HEAD_INSPECTION_REQUIRED: "HEAD_INSPECTION_REQUIRED",
  CONTRACT_REQUIRED: "CONTRACT_REQUIRED",
  SOURCE_MOVED_REBIND: "SOURCE_MOVED_REBIND",
  CONTRACT_REVIEW_REQUIRED: "CONTRACT_REVIEW_REQUIRED",
  REQUEST_READY_FOR_LOCAL_EXPORT: "REQUEST_READY_FOR_LOCAL_EXPORT"
});

const MESSAGE = Object.freeze({
  SELECT_REPO: "Choose one repository from the complete public fleet directory.",
  CATALOG_UNAVAILABLE: "A verified public GitHub catalog identity is required.",
  HEAD_INSPECTION_REQUIRED: "Inspect this repository's current HEAD through live GitHub before preparing a request.",
  CONTRACT_REQUIRED: "Create a project-specific completion contract at this repository's desk.",
  SOURCE_MOVED_REBIND: "HEAD has changed since the local contract was prepared. Review and rebind the contract at its desk; local review ticks will reset.",
  CONTRACT_REVIEW_REQUIRED: "The local contract or live signal is not eligible for the existing R8 verification-request exporter. Review it at the desk.",
  REQUEST_READY_FOR_LOCAL_EXPORT: "A locally scoped request can be downloaded for separate operator review. No verification job has been run or approved."
});

function eligibleRepo(repo) {
  return repo && !repo.exampleOnly &&
    Number.isSafeInteger(repo.id) && repo.id > 0 &&
    typeof repo.name === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(repo.name) &&
    repo.name !== "." && repo.name !== ".." &&
    repo.full_name === OWNER + "/" + repo.name;
}
export function completionLane(repo, signal, contract, now = Date.now()) {
  const base = {
    stage: STEP.SELECT_REPO,
    message: MESSAGE.SELECT_REPO,
    repository: null, repositoryId: null, observedHeadSha: null,
    contractSha: null, sourceMatches: false,
    requiredChecks: 0, locallyReviewed: 0, independentlyVerifiedChecks: 0,
    readyToExport: false, verificationExecuted: false,
    productComplete: false, mergeAuthorized: false, dispatchAuthorized: false
  };
  function result(stage, extra={}) {
    return {...base,stage,message:MESSAGE[stage],...extra};
  }
  if (!repo) return base;
  if (!eligibleRepo(repo)) return result(STEP.CATALOG_UNAVAILABLE);
  const identity = {repository:repo.full_name,repositoryId:repo.id};
  if (!signal || signal.from!=="LIVE_PUBLIC_GITHUB_API_READ_ONLY" ||
    signal.repository!==repo.full_name || signal.repositoryId!==repo.id ||
    signal.functionallyVerified!==false || signal.mergeAuthorized!==false ||
    !SHA40.test(signal.headSha||"") || !signalsFresh(signal,now)) {
    return result(STEP.HEAD_INSPECTION_REQUIRED,identity);
  }
  const head={...identity,observedHeadSha:signal.headSha};
  if (!contract) return result(STEP.CONTRACT_REQUIRED,head);
  const progress=contractProgress(contract,signal.headSha);
  const scoped={...head,
    contractSha:SHA40.test(contract.source_sha||"")?contract.source_sha:null,
    requiredChecks:progress.checks,locallyReviewed:progress.locallyReviewed
  };
  if (contract.repository!==repo.full_name || contract.repository_id!==repo.id ||
    !SHA40.test(contract.source_sha||"")) {
    return result(STEP.CONTRACT_REVIEW_REQUIRED,scoped);
  }
  if (contract.source_sha!==signal.headSha) {
    return result(STEP.SOURCE_MOVED_REBIND,scoped);
  }
  try {
    // Tests the real request serializer and safety contract, not a UI-only approximation.
    const request=prepareVerificationRequest(repo,contract,signal,now);
    if (typeof request!=="string" || request.length===0)
      return result(STEP.CONTRACT_REVIEW_REQUIRED,scoped);
  } catch {
    return result(STEP.CONTRACT_REVIEW_REQUIRED,scoped);
  }
  return result(STEP.REQUEST_READY_FOR_LOCAL_EXPORT,{
    ...scoped,sourceMatches:true,readyToExport:true
  });
}
