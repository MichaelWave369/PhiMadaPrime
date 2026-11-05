// R35 ThinkTank: visual orchestration of existing public evidence, never agent execution.
import { signalsFresh } from "./signals.mjs";

export const OPERATORS = Object.freeze([
  {id:"vessie",name:"Vessie",role:"Interface / Embodiment",glyph:"◈",tone:"violet",scope:"Experience, accessibility, vessel interfaces"},
  {id:"gaia",name:"Gaia",role:"Systems / Environment",glyph:"◇",tone:"mint",scope:"Dependencies, fleet context, resource awareness"},
  {id:"brainc",name:"BrainC",role:"Strategy / Reasoning",glyph:"✺",tone:"amber",scope:"Architecture, tradeoffs, proposed plans"},
  {id:"pocketbrain",name:"PocketBrain",role:"Quick Ops / Mobile",glyph:"▣",tone:"cyan",scope:"Readable alerts and portable review summaries"}
]);
export const ORI_COUNCIL = Object.freeze([
  {id:"ori-prime",name:"Ori Prime",role:"Strategy & alignment",glyph:"♛",tone:"violet",scope:"Propose priorities; coordinate council perspectives"},
  {id:"scout-ori",name:"Scout Ori",role:"Discovery & opportunities",glyph:"◎",tone:"mint",scope:"Surface candidate integrations and evidence"},
  {id:"forge-ori",name:"Forge Ori",role:"Build & integration",glyph:"⚒",tone:"amber",scope:"Sketch implementation and verification steps"},
  {id:"guardian-ori",name:"Guardian Ori",role:"Safety & stability",glyph:"⬡",tone:"cyan",scope:"Identify regression, security, and release risks"},
  {id:"pocket-ori",name:"Pocket Ori",role:"Mobile & summaries",glyph:"◉",tone:"pink",scope:"Summarize decisions for portable review"}
]);
export const BOT_BLUEPRINTS = Object.freeze([
  {name:"Builder Bot",glyph:"⚒",role:"Implement proposed changes",tone:"violet"},
  {name:"Verifier Bot",glyph:"⬡",role:"Test, inspect and collect evidence",tone:"mint"},
  {name:"Merge Bot",glyph:"⑂",role:"Prepare reviewed merge handoffs",tone:"pink"},
  {name:"Scout Bot",glyph:"◎",role:"Research repositories and dependencies",tone:"cyan"},
  {name:"Doc Bot",glyph:"▤",role:"Document reviewed changes",tone:"amber"},
  {name:"Deploy Bot",glyph:"➤",role:"Prepare deployment checklists",tone:"violet"},
  {name:"Creative Bot",glyph:"✧",role:"Draft UX and creative assets",tone:"pink"}
]);

export function observationFor(repo, signal, now = Date.now()) {
  if (!repo || repo.exampleOnly || !signal ||
      signal.repositoryId !== repo.id ||
      signal.repository?.toLowerCase() !== repo.full_name?.toLowerCase()) {
    return {kind:"unknown",label:"Not inspected",observedAt:null,ci:null,prs:[]};
  }
  if (!signalsFresh(signal,now)) {
    return {kind:"stale",label:"Stale observation",observedAt:signal.observedAt,ci:null,prs:[]};
  }
  const state=signal.ci?.state;
  const kind=state==="OBSERVED_GREEN_AT_HEAD"?"observed":
    state==="FAILED_AT_HEAD_OBSERVED"?"failure":
    state==="PENDING_AT_HEAD"?"pending":"unknown";
  const label=kind==="observed"?"CI green observed":kind==="failure"?"CI issue observed":
    kind==="pending"?"CI pending observed":"CI unverified";
  return {kind,label,observedAt:signal.observedAt,
    ci:signal.ci?.message||null,prs:Array.isArray(signal.openPrs)?signal.openPrs:[],
    sha:signal.headSha||null};
}

export function thinktankSnapshot({rows=[],signals={},missions=[],reviewed={},pinned={},
  catalogState="loading",now=Date.now()}={}) {
  const repos=rows.map(repo=>({
    id:repo.id,name:repo.name,fullName:repo.full_name,url:repo.html_url,
    exampleOnly:Boolean(repo.exampleOnly),archived:Boolean(repo.archived),
    observation:observationFor(repo,signals[repo.id],now)
  }));
  const evidenceCount=repos.filter(r=>r.observation.kind==="observed").length;
  const failures=repos.filter(r=>r.observation.kind==="failure").length;
  const pending=repos.filter(r=>r.observation.kind==="pending").length;
  const stale=repos.filter(r=>r.observation.kind==="stale").length;
  const inspected=repos.filter(r=>["observed","failure","pending"].includes(r.observation.kind)).length;
  const reviewedCount=missions.filter(m=>reviewed[m.id]===true).length;
  const pinnedCount=missions.filter(m=>pinned[m.id]===true).length;
  return {
    source:catalogState==="live"?"PUBLIC_GITHUB_CATALOG":"EXAMPLE_OR_LOADING",
    totalRepos:catalogState==="live"?repos.length:null,
    repos,evidenceCount,failures,pending,stale,inspected,
    uninspected:repos.length-inspected-stale,
    proposalCount:missions.length,reviewedCount,pinnedCount,
    dispatched:0,runningWorkersVerified:0,approvalsIssued:0
  };
}
