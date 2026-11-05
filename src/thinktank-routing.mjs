// R36 · Deterministic proposal routing, never a model decision or agent dispatch.
import {handoffText} from "./missions.mjs";
import {signalsFresh} from "./signals.mjs";
import {OPERATORS,ORI_COUNCIL,BOT_BLUEPRINTS} from "./thinktank-model.mjs";

export const ROUTING_RULES=Object.freeze([
  {id:"security",match:/\b(?:security|secrets?|auth(?:entication|orization)?|permissions?|polic(?:y|ies)|vulnerabilit(?:y|ies)|trust|guards?|safety|threats?|credentials?)\b/i,
    operator:"gaia",council:"guardian-ori",bot:"Verifier Bot",
    reason:"Safety and security checks should be examined before any implementation or release."},
  {id:"release",match:/\b(?:deploy(?:ment|ments|ed|ing)?|releases?|publish(?:ing|ed)?|pages|production|prod|staging|rollout)\b/i,
    operator:"gaia",council:"guardian-ori",bot:"Deploy Bot",
    reason:"Release planning needs environment awareness and a separate evidence and authorization gate."},
  {id:"test",match:/\b(?:tests?|testing|ci|build(?:s|ing|ers)?|lint|verify|verification|coverage|workflows?|regressions?|typechecks?|fail(?:ure|ures|ed|ing)?)\b/i,
    operator:"brainc",council:"guardian-ori",bot:"Verifier Bot",
    reason:"Verification work starts with evidence collection, then a human checks exact-HEAD results."},
  {id:"documentation",match:/\b(?:readme|docs?|document(?:ation|ing)?|changelogs?|guides?|manuals?)\b/i,
    operator:"pocketbrain",council:"pocket-ori",bot:"Doc Bot",
    reason:"Documentation proposals can be drafted for human review without modifying a repository."},
  {id:"interface",match:/\b(?:interface|ui|ux|frontend|react|visuals?|accessibility|a11y|css|layouts?)\b/i,
    operator:"vessie",council:"scout-ori",bot:"Creative Bot",
    reason:"Interface changes call for usability review, implementation planning and accessibility checks."},
  {id:"integration",match:/\b(?:integrations?|integrate|dependencies|dependency|bridge|api|connectors?|sync|network|migration)\b/i,
    operator:"gaia",council:"forge-ori",bot:"Builder Bot",
    reason:"Cross-system proposals need dependency mapping and an implementation review."},
  {id:"architecture",match:/\b(?:architecture|architectural|design|refactor|models?|performance|optim(?:ize|ise|ization|isation)|cache|features?)\b/i,
    operator:"brainc",council:"forge-ori",bot:"Builder Bot",
    reason:"Architecture and feature work should start with a scoped implementation plan."}
]);

const OWNER="MichaelWave369/";
const SHA=/^[0-9a-f]{40}$/;
function safeLine(x,n=280){
  return typeof x==="string"?x.replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,n):"UNKNOWN";
}
function trusted(mission,plan,repo){
  if(!mission||!plan||plan.type!=="plan"||
      mission.provenance!=="AGENTORA_REVIEW_ONLY_PLAN"||
      mission.dispatchable!==false||mission.verifiedComplete!==false||
      typeof mission.id!=="string"||!mission.id||
      !Number.isSafeInteger(mission.repoId)||mission.repoId<=0||
      typeof mission.repository!=="string"||!mission.repository.startsWith(OWNER)||
      !repo||repo.exampleOnly===true||repo.id!==mission.repoId||
      repo.full_name?.toLowerCase()!==mission.repository.toLowerCase()){
    throw Error("R36_UNTRUSTED_PROPOSAL");
  }
}
export function routeProposal(mission,plan,repo,signal=null,now=Date.now()){
  trusted(mission,plan,repo);
  const subject=[typeof mission.check==="string"?mission.check.replaceAll("_"," "):"",mission.summary]
    .filter(x=>typeof x==="string").join(" ").slice(0,500);
  const rule=ROUTING_RULES.find(x=>x.match.test(subject));
  const operator=OPERATORS.find(x=>x.id===(rule?.operator||"brainc"));
  const council=ORI_COUNCIL.find(x=>x.id===(rule?.council||"scout-ori"));
  const bot=BOT_BLUEPRINTS.find(x=>x.name===(rule?.bot||"Scout Bot"));
  const matchedSignal=signal&&signal.repositoryId===repo.id&&
    signal.repository?.toLowerCase()===repo.full_name?.toLowerCase();
  const fresh=Boolean(matchedSignal&&signalsFresh(signal,now));
  const planHead=SHA.test(mission.headSha||"")?mission.headSha:null;
  const currentHead=fresh&&SHA.test(signal.headSha||"")?signal.headSha:null;
  const headStatus=!planHead?"PLAN_HEAD_UNKNOWN":
    !matchedSignal?"NOT_INSPECTED":
    !fresh?"OBSERVATION_STALE":
    !currentHead?"CURRENT_HEAD_UNKNOWN":
    planHead===currentHead?"HEAD_MATCH_OBSERVED":"HEAD_MOVED";
  const planStatus=plan.freshness==="RECENT"?"RECENT":"NOT_RECENT";
  const evidenceGate=planStatus==="RECENT"&&headStatus==="HEAD_MATCH_OBSERVED"?
    "READY_FOR_HUMAN_REVIEW":"RECHECK_REQUIRED";
  const notes=[];
  if(planStatus!=="RECENT")notes.push("Plan freshness is not RECENT; refresh the Agentora plan.");
  if(headStatus==="PLAN_HEAD_UNKNOWN")notes.push("Plan contains no valid source SHA.");
  else if(headStatus==="NOT_INSPECTED")notes.push("Inspect this repository's current public HEAD.");
  else if(headStatus==="OBSERVATION_STALE")notes.push("The last public GitHub observation is stale.");
  else if(headStatus==="CURRENT_HEAD_UNKNOWN")notes.push("Current repository HEAD could not be verified.");
  else if(headStatus==="HEAD_MOVED")notes.push("Source HEAD moved; re-plan against the current commit.");
  else notes.push("Plan HEAD matches the recently observed public repository HEAD. This does not certify required CI or the product.");
  return Object.freeze({
    provenance:"R36_DETERMINISTIC_REVIEW_ROUTING",
    missionId:mission.id,repository:mission.repository,check:mission.check,
    category:rule?.id||"manual_triage",
    explanation:rule?.reason||"No rule matched. Route to scouting for manual classification.",
    operator:operator.name,council:council.name,bot:bot.name,
    planStatus,headStatus,evidenceGate,
    planHead,observedHead:currentHead,observedAt:fresh?signal.observedAt:null,
    ciState:fresh&&headStatus==="HEAD_MATCH_OBSERVED"?signal.ci?.state||"UNKNOWN":"NOT_VERIFIED",
    notes:Object.freeze(notes),dispatched:false,approved:false,running:false
  });
}
export function routingHandoff(mission,plan,repo,signal=null,now=Date.now()){
  const preview=routeProposal(mission,plan,repo,signal,now);
  // Existing validated Agentora review text remains the canonical source section.
  const canonical=handoffText(mission,plan);
  return [
    "ΦMADA PRIME / R36 COUNCIL → PHIBOT ROUTING DOSSIER",
    "DETERMINISTIC SUGGESTION ONLY · NOT DISPATCHED · NOT APPROVED",
    "NO AUTOMATIC CODE, DEPLOYMENT, MERGE OR PERMISSION ACTION",
    "Repository: "+safeLine(preview.repository),
    "Mission ID: "+safeLine(preview.missionId),
    "Rule category: "+preview.category,
    "Suggested core operator: "+preview.operator+" (role only; not running)",
    "Suggested Ori council: "+preview.council+" (role only; not running)",
    "Suggested PhiBot: "+preview.bot+" (blueprint only; not installed)",
    "Why: "+preview.explanation,
    "Plan freshness: "+preview.planStatus,
    "Head comparison: "+preview.headStatus,
    "Review evidence gate: "+preview.evidenceGate,
    "Plan HEAD: "+(preview.planHead||"UNAVAILABLE"),
    "Observed HEAD: "+(preview.observedHead||"UNAVAILABLE"),
    "Observed at: "+(preview.observedAt||"NOT VERIFIED"),
    "CI status at observed HEAD: "+safeLine(preview.ciState,100),
    ...preview.notes.map(note=>"Review note: "+note),
    "",
    "NEXT: Human must verify scope, permissions, required checks and exact HEAD",
    "inside the authorized executor. This dossier is not an execution request.",
    "",
    canonical
  ].join("\n");
}
