// Rung 3 operator-side planning only. No GitHub writes or job execution.
import { OWNER } from "./fleet.mjs";
import { wingForRepo } from "./tower.mjs";

const KNOWN_STATES = new Set(["REVIEW_ONLY_NOT_DISPATCHABLE"]);
const HASH = /^[0-9a-f]{40}$/;

function normalPriority(value) {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= 0 && value <= 1000 ? Math.round(value) : null;
}
function canonicalName(fullName) {
  if (typeof fullName !== "string" || !fullName.startsWith(OWNER + "/")) return "";
  const name = fullName.slice(OWNER.length + 1);
  return /^[A-Za-z0-9_.-]{1,100}$/.test(name) && name !== "." && name !== ".." ?
    name : "";
}
function safeSummary(value) {
  return typeof value === "string" ? value.slice(0, 180).trim() : "";
}
function safeCheck(value) {
  return typeof value === "string" && /^[a-z0-9_]{1,60}$/.test(value) ?
    value : "manual_review";
}

export function missionQueue(plan, rows) {
  if (!plan || plan.type !== "plan" || !Array.isArray(plan.priorityQueue)) return [];
  const catalog = new Map(rows.filter(r => r && !r.exampleOnly)
    .map(r => [r.name.toLowerCase(), r]));
  const seen = new Map();
  const result = [];
  for (const item of plan.priorityQueue.slice(0, 10000)) {
    if (!item || !KNOWN_STATES.has(item.state)) continue;
    const name = canonicalName(item.repository);
    const repo = catalog.get(name.toLowerCase());
    if (!name || !repo || repo.full_name.toLowerCase() !== item.repository.toLowerCase()) continue;
    const check = safeCheck(item.check_id);
    const sha = HASH.test(item.head_sha || "") ? item.head_sha : null;
    const summary = safeSummary(item.summary);
    if (!summary) continue;
    const key = [repo.id, sha || "NO_HEAD", check].join(":");
    const nextOccurrence = seen.get(key) || 0;
    seen.set(key, nextOccurrence + 1);
    result.push({
      id: key + ":" + nextOccurrence,
      repository: repo.full_name, repoName: repo.name, repoId: repo.id,
      wing: wingForRepo(repo), check, summary,
      priority: normalPriority(item.priority), headSha: sha,
      verifiedComplete: false, dispatchable: false,
      provenance: "AGENTORA_REVIEW_ONLY_PLAN"
    });
  }
  return result.sort((a, b) =>
    (b.priority ?? -1) - (a.priority ?? -1) ||
    a.repository.localeCompare(b.repository, "en", { sensitivity: "base" }) ||
    a.check.localeCompare(b.check) || a.id.localeCompare(b.id));
}

export function filterMissions(queue, { query = "", wing = "all", review = "all", reviewed = {},
  pinned = {} } = {}) {
  const needle = String(query).trim().toLowerCase();
  return queue.filter(m => {
    if (wing !== "all" && m.wing !== wing) return false;
    const isReviewed = reviewed[m.id] === true;
    if (review === "pending" && isReviewed) return false;
    if (review === "reviewed" && !isReviewed) return false;
    if (review === "pinned" && pinned[m.id] !== true) return false;
    return !needle || [m.repoName, m.summary, m.check, m.wing]
      .some(x => String(x).toLowerCase().includes(needle));
  }).sort((a, b) =>
    Number(pinned[b.id] === true) - Number(pinned[a.id] === true) ||
    (b.priority ?? -1) - (a.priority ?? -1) ||
    a.repoName.localeCompare(b.repoName, "en", { sensitivity: "base" }) ||
    a.id.localeCompare(b.id));
}

export function missionStats(queue, reviewed = {}, pinned = {}) {
  return {
    proposed: queue.length,
    localReviewed: queue.filter(x => reviewed[x.id] === true).length,
    pinned: queue.filter(x => pinned[x.id] === true).length,
    verifiedComplete: 0, dispatched: 0
  };
}

// Clipboard text is a suggestion for manual review, never a dispatch instruction.
export function handoffText(mission, plan) {
  if (!mission || mission.dispatchable || mission.verifiedComplete ||
      mission.provenance !== "AGENTORA_REVIEW_ONLY_PLAN" ||
      !canonicalName(mission.repository)) {
    throw new Error("UNSAFE_HANDOFF");
  }
  const lines = [
    "ΦMADA PRIME — PROPOSED REVIEW HANDOFF",
    "NOT DISPATCHED · NOT APPROVED · NOT VERIFIED COMPLETE",
    "Repository: " + mission.repository,
    "Check: " + mission.check,
    "Proposed work: " + mission.summary,
    "Priority (planning heuristic): " + (mission.priority ?? "unscored"),
    "Observed source commit: " + (mission.headSha || "UNVERIFIED, MUST RESOLVE"),
    "Plan generated: " + (typeof plan?.generated_utc === "string" ?
      plan.generated_utc : "UNKNOWN"),
    "Plan freshness: " + (typeof plan?.freshness === "string" ?
      plan.freshness : "UNKNOWN"),
    "",
    "Before execution: review repo purpose, scope, exact current HEAD, required CI,",
    "build/runtime acceptance, dependencies and write permissions. Obtain explicit",
    "authorization in the governed Agentora workflow. This text is not a command."
  ];
  return lines.join("\n");
}
