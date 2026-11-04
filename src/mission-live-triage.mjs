// R25: translate previously verified, opt-in live GitHub signals into bounded
// mission-board triage hints. This never authorizes a job, merge, or completion.
import { signalsFresh } from "./signals.mjs";

export const TRIAGE_SIGNAL_SOURCE = "LIVE_PUBLIC_GITHUB_API_READ_ONLY";
const SHA40 = /^[a-f0-9]{40}$/;
const STATES = Object.freeze({
  FAILED_AT_HEAD_OBSERVED:"Recent workflow failure observed on current HEAD",
  PENDING_AT_HEAD:"A workflow is running or queued on current HEAD",
  OBSERVED_GREEN_AT_HEAD:"Observed recent workflows passed at exact HEAD; completeness unverified",
  NO_EXACT_HEAD_RUN:"No recent workflow run matched current HEAD",
  HEAD_UNVERIFIED:"Exact branch HEAD not confirmed",
  RUNS_UNAVAILABLE:"Workflow runs unavailable",
  NON_SUCCESS_AT_HEAD:"A workflow has a non-success conclusion on current HEAD"
});

export function missionLiveTriage(mission, signal, now=Date.now()) {
  const base={
    state:"NOT_INSPECTED",live:false,
    message:"Not inspected in this browser session. Click Check live GitHub.",
    observedAt:null,planSha:SHA40.test(mission?.headSha||"")?mission.headSha:null,
    currentSha:null,headStatus:"NOT_COMPARED",ciState:"UNVERIFIED",
    ciMessage:"No exact-current-HEAD run checked",openPrs:[],prListPartial:false,
    functionallyVerified:false,dispatchAuthorized:false,mergeAuthorized:false
  };
  if(!signal)return base;
  if(!mission||signal.repository!==mission.repository||
    signal.repositoryId!==mission.repoId||
    signal.from!==TRIAGE_SIGNAL_SOURCE||
    signal.functionallyVerified!==false||
    signal.mergeAuthorized!==false||
    typeof signal.observedAt!=="string"||
    !SHA40.test(signal.headSha||"")||
    !Array.isArray(signal.openPrs)||
    signal.openPrs.length>10||
    typeof signal.ci?.state!=="string"||
    !Object.hasOwn(STATES,signal.ci.state)) {
    return {...base,state:"UNTRUSTED_SIGNAL",
      message:"Live signal identity or shape mismatch. Nothing inferred."};
  }
  if(!signalsFresh(signal,now)) {
    return {...base,state:"STALE_SIGNAL",observedAt:signal.observedAt,
      message:"The last observation has expired. Refresh before using any signal."};
  }
  const headStatus=!base.planSha?"PLAN_SHA_UNVERIFIED":
    base.planSha===signal.headSha?"PLAN_SHA_MATCHES_CURRENT_HEAD":
    "PLAN_SHA_MOVED";
  const safePrs=signal.openPrs.slice(0,3).filter(pr=>
    Number.isSafeInteger(pr?.number)&&pr.number>0&&
    pr.state==="open"&&
    pr.url==="https://github.com/"+mission.repository+"/pull/"+pr.number)
    .map(pr=>({number:pr.number,title:typeof pr.title==="string"?
      pr.title.slice(0,150):"Untitled",url:pr.url,draft:pr.draft===true}));
  return {
    ...base,state:"OBSERVED",live:true,message:
      "Current observation only; repo, functionality and merge readiness are not certified.",
    observedAt:signal.observedAt,currentSha:signal.headSha,
    headStatus,ciState:signal.ci.state,ciMessage:STATES[signal.ci.state],
    openPrs:safePrs,prListPartial:signal.prListPartial===true,
    openPrCountObserved:signal.openPrs.length
  };
}
