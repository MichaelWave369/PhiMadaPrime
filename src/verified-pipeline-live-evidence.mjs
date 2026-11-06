// R41: public GitHub HEAD/CI observation adapter for the R39 Pipeline Factory.
// Uses the existing manual, bounded repository inspector. This is NOT a
// receipt verifier, test runner, signature verifier, or execution grant.
import {inspectPipeline} from "./verified-pipeline.mjs";
import {publicRepoPath,signalsFresh} from "./signals.mjs";

const SHA=/^[0-9a-f]{40}$/;
const CI_STATES=new Set([
  "OBSERVED_GREEN_AT_HEAD","FAILED_AT_HEAD_OBSERVED","PENDING_AT_HEAD",
  "NON_SUCCESS_AT_HEAD","NO_EXACT_HEAD_RUN","RUNS_UNAVAILABLE",
  "HEAD_UNVERIFIED"
]);

export function inspectedPublicHead(repo,signal,now=Date.now()){
  try {
    publicRepoPath(repo); // single known owner and non-example identity
    if(!signal || signal.from!=="LIVE_PUBLIC_GITHUB_API_READ_ONLY" ||
       signal.functionallyVerified!==false || signal.mergeAuthorized!==false ||
       signal.repositoryId!==repo.id ||
       signal.repository?.toLowerCase()!==repo.full_name.toLowerCase() ||
       typeof signal.defaultBranch!=="string" ||
       signal.defaultBranch.length<1 ||signal.defaultBranch.length>200 ||
       !SHA.test(signal.headSha||"") ||
       !signal.ci ||!CI_STATES.has(signal.ci.state) ||
       !signalsFresh(signal,now)) return null;
    return {repository:repo.full_name,repository_id:repo.id,
      default_branch:signal.defaultBranch,head_sha:signal.headSha,
      observed_at:signal.observedAt,ci_state:signal.ci.state,
      ci_message:typeof signal.ci.message==="string"?
        signal.ci.message.slice(0,260):"No further explanation"};
  }catch{
    return null;
  }
}

function report(state,design,extra={}){
  return {
    report_kind:"PHI_PUBLIC_CI_OBSERVATION_V1",
    mode:"ON_DEMAND_PUBLIC_GITHUB_READ_ONLY",
    state,
    design_state:inspectPipeline(design).state,
    sampled_ci_reported_green:false,
    sampled_ci_reported_failed:false,
    authentic_source_verified:false,
    required_checks_verified:false,
    test_commands_replayed:false,
    tests_executed_in_this_app:false,
    human_review_completed:false,
    merge_authorized:false,
    permissions:[],
    source:"EXISTING_PUBLIC_GITHUB_SIGNAL_INSPECTOR",
    warning:"GitHub API responses and observed workflow conclusions are not a proof of all required checks, test commands, deployed behavior, source truth, GMED verification or human authorization.",
    ...extra
  };
}

/** A live frontend observation never becomes an actionable verification claim. */
export function inspectLiveCiObservation(design,repo,signal,pinnedHead,now=Date.now()){
  const validDesign=inspectPipeline(design).valid;
  if(!validDesign)return report("DESIGN_INVALID",design);
  if(!repo)return report("REPO_NOT_SELECTED",design);
  try{publicRepoPath(repo);}catch{return report("REPO_UNTRUSTED",design);}
  if(typeof pinnedHead!=="string"||!SHA.test(pinnedHead))
    return report("HEAD_NOT_PINNED",design);
  const parsed=inspectedPublicHead(repo,signal,now);
  if(!parsed)return report("FRESH_OBSERVATION_REQUIRED",design,{
    expected_head:pinnedHead,repository:repo.full_name
  });
  if(parsed.head_sha!==pinnedHead)return report("HEAD_MOVED_RECHECK_REQUIRED",design,{
    expected_head:pinnedHead,observed_head:parsed.head_sha,
    repository:parsed.repository,observed_at:parsed.observed_at
  });
  const extra={expected_head:pinnedHead,observed_head:parsed.head_sha,
    repository:parsed.repository,default_branch:parsed.default_branch,
    observed_at:parsed.observed_at,ci_state:parsed.ci_state,
    ci_message:parsed.ci_message};
  switch(parsed.ci_state){
    case "OBSERVED_GREEN_AT_HEAD":
      return report("SAMPLED_CI_GREEN_REPORTED",design,{
        ...extra,sampled_ci_reported_green:true
      });
    case "FAILED_AT_HEAD_OBSERVED":
      return report("CI_FAILURE_REPORTED",design,{
        ...extra,sampled_ci_reported_failed:true
      });
    case "PENDING_AT_HEAD":return report("CI_PENDING_REPORTED",design,extra);
    default:return report("CI_UNVERIFIED_OR_INCOMPLETE",design,extra);
  }
}
