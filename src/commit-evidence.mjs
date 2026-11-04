// R30: GitHub evidence observed at one exact Chronicle commit.
// Nothing here executes CI, attributes an AI agent, approves code, or verifies a product.
import { OWNER } from "./fleet.mjs";
import { publicRepoPath } from "./signals.mjs";

const SHA = /^[0-9a-f]{40}$/;
const MAX_PRS = 10;
const MAX_CHECKS = 30;
const MAX_STATUSES = 30;
const CHECK_CONCLUSIONS = new Set([
  "success", "failure", "neutral", "cancelled", "skipped", "timed_out",
  "action_required", "stale", "startup_failure"
]);
const CHECK_STATES = new Set([
  "queued", "in_progress", "completed", "waiting", "requested", "pending"
]);
const LEGACY_STATES = new Set(["success", "pending", "failure", "error"]);
const safeNumber = n => Number.isSafeInteger(n) && n >= 0;
const trim = (v,n,otherwise="") => typeof v === "string" ? v.slice(0,n) : otherwise;

function validRepository(repo) {
  const path = publicRepoPath(repo);
  if (repo.full_name !== OWNER + "/" + repo.name) {
    throw Error("EVIDENCE_PUBLIC_REPO_REQUIRED");
  }
  return path;
}
function verifiedSelection(repo,history,commit) {
  if (!history || history.repository !== repo.full_name ||
      history.repositoryId !== repo.id ||
      !Array.isArray(history.commits) ||
      !SHA.test(commit?.sha || "") ||
      !history.commits.some(row => row.sha === commit.sha &&
        row.parentSha === commit.parentSha)) {
    throw Error("EVIDENCE_CHRONICLE_SELECTION_MISMATCH");
  }
}
async function githubJson(fetcher,path) {
  const res = await fetcher("https://api.github.com" + path, {
    credentials: "omit",
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!res?.ok) throw Error("EVIDENCE_API_UNAVAILABLE");
  return res.json();
}
function checkRepoMetadata(meta,repo) {
  if (meta?.id !== repo.id || meta?.full_name !== repo.full_name ||
      meta?.private !== false) throw Error("EVIDENCE_REPOSITORY_IDENTITY_MISMATCH");
}
function checkCommitIdentity(raw,commit) {
  if (raw?.sha !== commit.sha || !Array.isArray(raw.parents) ||
      (raw.parents[0]?.sha || null) !== (commit.parentSha || null)) {
    throw Error("EVIDENCE_COMMIT_PARENT_MISMATCH");
  }
}
function checkedPr(raw,repo,sha) {
  if (!safeNumber(raw?.number) || raw.number < 1 ||
      raw?.base?.repo?.id !== repo.id ||
      raw.base.repo.full_name !== repo.full_name) return null;
  const head = raw.head?.sha;
  const merge = raw.merge_commit_sha;
  if (!SHA.test(head || "") || (merge !== null && merge !== undefined && !SHA.test(merge))) {
    return null;
  }
  const relation = merge === sha ? "MERGE_COMMIT_SHA" :
    head === sha ? "PR_HEAD_SHA" : "GITHUB_ASSOCIATED";
  return {
    number: raw.number, title: trim(raw.title,160,"Untitled PR"),
    state: raw.state === "open" ? "open" : raw.state === "closed" ? "closed" : "unknown",
    merged: typeof raw.merged_at === "string" && Number.isFinite(Date.parse(raw.merged_at)),
    draft: raw.draft === true, relation,
    headSha: head, mergeSha: SHA.test(merge || "") ? merge : null,
    url: "https://github.com/" + repo.full_name + "/pull/" + raw.number
  };
}
export function normalizeAssociatedPRs(raw,repo,sha) {
  if (!Array.isArray(raw) || raw.length > MAX_PRS) throw Error("EVIDENCE_PR_SHAPE");
  const seen = new Set(), prs = [];
  let excluded = 0;
  for (const item of raw) {
    const pr = checkedPr(item,repo,sha);
    if (!pr || seen.has(pr.number)) {excluded++;continue;}
    prs.push(pr);seen.add(pr.number);
  }
  return {
    state:"OBSERVED", prs, excluded, partial:raw.length === MAX_PRS,
    claim:"GitHub-reported associated PRs, not proof of agent authorship or approval."
  };
}
function safeCheckLink(url,repo) {
  if (typeof url !== "string") return null;
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)\/job\/(\d+)$/.exec(url);
  if (!match || match[1] !== OWNER || match[2] !== repo.name) return null;
  return url;
}
export function normalizeCheckRuns(raw,repo,sha) {
  if (!raw || !safeNumber(raw.total_count) || !Array.isArray(raw.check_runs) ||
      raw.check_runs.length > MAX_CHECKS || raw.total_count < raw.check_runs.length) {
    throw Error("EVIDENCE_CHECK_RUN_SHAPE");
  }
  const seen = new Set(), runs = [];
  let excluded = 0;
  for (const item of raw.check_runs) {
    if (!safeNumber(item?.id) || item.id < 1 || item.head_sha !== sha ||
        seen.has(item.id)) {excluded++;continue;}
    seen.add(item.id);
    const state = CHECK_STATES.has(item.status) ? item.status : "unknown";
    const conclusion = item.status === "completed" && CHECK_CONCLUSIONS.has(item.conclusion) ?
      item.conclusion : null;
    runs.push({
      id:item.id, name:trim(item.name,110,"Unnamed check"),
      status:state, conclusion,
      provider:trim(item.app?.slug,70,"Unspecified"),
      url:safeCheckLink(item.html_url,repo)
    });
  }
  const partial = raw.total_count > raw.check_runs.length ||
    raw.check_runs.length === MAX_CHECKS || excluded > 0;
  const counts = {
    success:runs.filter(r=>r.status==="completed"&&r.conclusion==="success").length,
    nonSuccess:runs.filter(r=>r.status==="completed"&&r.conclusion!=="success").length,
    unfinished:runs.filter(r=>r.status!=="completed").length
  };
  return {
    state:"OBSERVED", totalReported:raw.total_count,
    partial, excluded, runs, counts,
    summary:!raw.total_count ? "NO_CHECK_RUNS_REPORTED" :
      partial ? "INCOMPLETE_CHECK_RUN_OBSERVATION" :
      counts.unfinished ? "OBSERVED_CHECKS_UNFINISHED" :
      counts.nonSuccess ? "OBSERVED_CHECKS_NOT_ALL_SUCCESS" :
      "ALL_RETURNED_CHECKS_SUCCESS",
    // Explicitly not a required-check set or a functional product certification.
    requiredChecksVerified:false,productVerified:false
  };
}
export function normalizeLegacyStatus(raw,sha) {
  if (!raw || (raw.sha != null && raw.sha !== sha) ||
      !safeNumber(raw.total_count) ||
      !Array.isArray(raw.statuses) || raw.statuses.length > MAX_STATUSES ||
      raw.total_count < raw.statuses.length) throw Error("EVIDENCE_LEGACY_SHAPE");
  const partial = raw.total_count > raw.statuses.length ||
    raw.statuses.length === MAX_STATUSES;
  const contexts = [];
  let excluded=0;
  for (const s of raw.statuses) {
    if (!LEGACY_STATES.has(s?.state) || typeof s.context !== "string") {
      excluded++;continue;
    }
    contexts.push({context:trim(s.context,120),state:s.state});
  }
  return {
    state:"OBSERVED",
    // GitHub can return overall "pending" with no legacy statuses. That's no observation.
    summary:raw.total_count === 0 ? "NO_LEGACY_STATUS_CONTEXTS" :
      (partial || excluded ? "INCOMPLETE_LEGACY_CONTEXTS" :
      "LEGACY_CONTEXTS_OBSERVED"),
    contexts, totalReported:raw.total_count, partial:partial||excluded>0,
    excluded, reportedState:raw.total_count ? trim(raw.state,30,"unknown") : null
  };
}

function unavailable(source,err) {
  return {
    state:"UNAVAILABLE",source,
    reason:err instanceof Error ? trim(err.message,120,"READ_FAILED") : "READ_FAILED"
  };
}
export async function readCommitEvidence(repo,history,commit,
  fetcher=fetch,now=()=>Date.now()) {
  const path=validRepository(repo);
  verifiedSelection(repo,history,commit);
  const meta=await githubJson(fetcher,path);
  checkRepoMetadata(meta,repo);
  const rawCommit=await githubJson(fetcher,path+"/commits/"+commit.sha+"?per_page=1");
  checkCommitIdentity(rawCommit,commit);
  const outcomes=await Promise.allSettled([
    githubJson(fetcher,path+"/commits/"+commit.sha+"/pulls?per_page="+MAX_PRS),
    githubJson(fetcher,path+"/commits/"+commit.sha+"/check-runs?per_page="+MAX_CHECKS),
    githubJson(fetcher,path+"/commits/"+commit.sha+"/status")
  ]);
  const transforms=[
    raw=>normalizeAssociatedPRs(raw,repo,commit.sha),
    raw=>normalizeCheckRuns(raw,repo,commit.sha),
    raw=>normalizeLegacyStatus(raw,commit.sha)
  ];
  const values=outcomes.map((out,index)=>{
    if(out.status!=="fulfilled")return unavailable(["prs","checks","legacy"][index],out.reason);
    try{return transforms[index](out.value);}
    catch(e){return unavailable(["prs","checks","legacy"][index],e);}
  });
  return {
    schema:"phimada.commit-evidence.v0.30",
    repository:repo.full_name,repositoryId:repo.id,sha:commit.sha,
    parentSha:commit.parentSha||null,historyHeadSha:history.headSha,
    observedAt:new Date(now()).toISOString(),
    prs:values[0],checks:values[1],legacy:values[2],
    executedByPage:false,agentIdentityAuthenticated:false,
    agentoraExecutionProven:false,requiredChecksVerified:false,
    productVerified:false,approved:false,mergeAuthorized:false
  };
}
export function evidenceHandoff(bundle,localReceipt=null) {
  if(bundle?.schema!=="phimada.commit-evidence.v0.30" ||
     !SHA.test(bundle.sha||""))throw Error("EVIDENCE_HANDOFF_INVALID");
  const lines=[
    "PhiMadaPrime / R30 EVIDENCE NERVOUS SYSTEM / REVIEW-ONLY HANDOFF",
    "Repository: "+bundle.repository,
    "Selected SHA: "+bundle.sha,
    "First parent: "+(bundle.parentSha||"ROOT"),
    "Observed branch head: "+bundle.historyHeadSha,
    "GitHub observation: "+bundle.observedAt,
    "Associated PR observation: "+bundle.prs.state,
    ...((bundle.prs.prs||[]).map(p=>"#"+p.number+" "+p.relation+" "+p.url)),
    "Check run observation: "+bundle.checks.state,
    "Check summary: "+(bundle.checks.summary||"UNAVAILABLE"),
    "Observed check count: "+(bundle.checks.runs?.length||0),
    "Check observation partial: "+(bundle.checks.partial===true),
    "Legacy status observation: "+(bundle.legacy.summary||"UNAVAILABLE"),
    "Agentora local intake: "+(localReceipt?"MATCHED_UNSIGNED_R03_ACKNOWLEDGEMENT":"NOT_ATTACHED"),
    "Independent Agentora execution evidence: NOT_VERIFIED",
    "No required-check certification, product verification, agent attribution, dispatch or merge authority.",
    "Recheck live HEAD, required checks and independent acceptance before release."
  ];
  return lines.join("\n");
}
