// R9: deterministic, local-only fleet reservation PREVIEW.
// Not a distributed lease manager, dispatch engine, or merge authorization source.
import { OWNER } from "./fleet.mjs";

const HEX40 = /^[a-f0-9]{40}$/;
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const MAX_RULES = 60;

function safeRepo(row) {
  return Boolean(row && !row.exampleOnly && Number.isSafeInteger(row.id) &&
    row.id > 0 && typeof row.name === "string" && NAME.test(row.name) &&
    row.name !== "." && row.name !== ".." &&
    row.full_name === OWNER + "/" + row.name);
}

// Explicit, locally entered links. The syntax is "BTM needs OverStrings".
// Neither project naming nor the audit's loose "relationships" imply a build dependency.
export function parseDependencyRules(input, catalog) {
  if (typeof input !== "string" || input.length > 8000 || !Array.isArray(catalog)) {
    throw new Error("RULES_INVALID_INPUT");
  }
  const known = new Map(catalog.filter(safeRepo).map(r => [r.name.toLowerCase(), r.name]));
  const lines = input.split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith("#"));
  if (lines.length > MAX_RULES) throw new Error("RULES_TOO_MANY");
  const rules = [], seen = new Set();
  for (const line of lines) {
    const match = /^([A-Za-z0-9_.-]{1,100})\s+needs\s+([A-Za-z0-9_.-]{1,100})$/i.exec(line);
    if (!match) throw new Error("RULES_FORMAT_REQUIRED");
    const repository = known.get(match[1].toLowerCase());
    const requires = known.get(match[2].toLowerCase());
    if (!repository || !requires) throw new Error("RULES_PUBLIC_CATALOG_REQUIRED");
    if (repository === requires) throw new Error("RULES_SELF_DEPENDENCY");
    const key = repository + ":" + requires;
    if (!seen.has(key)) { seen.add(key); rules.push({ repository, requires }); }
  }
  // Graph validation is independent of mission inclusion. Do not hide cycles
  // merely because a dependency is outside the six-repository pilot.
  const graph = new Map();
  for (const rule of rules) graph.set(rule.repository,
    [...(graph.get(rule.repository) || []), rule.requires]);
  const active = new Set(), visited = new Set();
  function visit(name) {
    if (active.has(name)) throw new Error("RULES_DEPENDENCY_CYCLE");
    if (visited.has(name)) return;
    active.add(name);
    for (const next of graph.get(name) || []) visit(next);
    active.delete(name); visited.add(name);
  }
  for (const name of graph.keys()) visit(name);
  return rules.sort((a, b) => a.repository.localeCompare(b.repository) ||
    a.requires.localeCompare(b.requires));
}

function freshPlan(plan, now) {
  if (plan?.type !== "plan" || plan.freshness !== "RECENT" ||
      typeof plan.generated_utc !== "string") return false;
  const at = Date.parse(plan.generated_utc);
  return Number.isFinite(at) && at <= now + 300000 && now - at <= 24 * 3600000;
}

function ordered(a, b) {
  return b.priority - a.priority || a.repoName.localeCompare(b.repoName, "en", {
    sensitivity: "base" });
}

// Produce one preview slot at most per repository. Multiple checks on the same
// immutable source are a single unit, never concurrent write jobs.
export function previewFleetSchedule(queue, plan, {
  parallelism = 4, dependencies = [], occupiedRepositories = [], now = Date.now()
} = {}) {
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 12 ||
      !Array.isArray(queue) || !Array.isArray(dependencies) ||
      !Array.isArray(occupiedRepositories) || !Number.isFinite(now)) {
    throw new Error("SCHEDULE_INPUT_INVALID");
  }
  const groups = new Map();
  for (const job of queue.slice(0, 10000)) {
    if (!job || job.provenance !== "AGENTORA_REVIEW_ONLY_PLAN" ||
        job.dispatchable !== false || job.verifiedComplete !== false ||
        !Number.isSafeInteger(job.repoId) || job.repoId <= 0 ||
        typeof job.repoName !== "string" || !NAME.test(job.repoName) ||
        job.repository !== OWNER + "/" + job.repoName) continue;
    const key = job.repoId;
    if (!groups.has(key)) groups.set(key, {
      repository: job.repository, repoName: job.repoName, repoId: job.repoId,
      priority: -1, checks: new Set(), heads: new Set(), count: 0
    });
    const group = groups.get(key);
    if (group.repository !== job.repository) continue;
    group.priority = Math.max(group.priority,
      Number.isFinite(job.priority) ? job.priority : -1);
    group.checks.add(String(job.check));
    group.heads.add(HEX40.test(job.headSha || "") ? job.headSha : "MISSING");
    group.count++;
  }
  const occupied = new Set(occupiedRepositories);
  const eligible = [], held = [];
  const dependencyMap = new Map();
  for (const rule of dependencies) {
    if (!rule || typeof rule.repository !== "string" ||
        typeof rule.requires !== "string" || !NAME.test(rule.repository) ||
        !NAME.test(rule.requires) || rule.repository === rule.requires) {
      throw new Error("SCHEDULE_RULES_INVALID");
    }
    dependencyMap.set(rule.repository,
      [...(dependencyMap.get(rule.repository) || []), rule.requires]);
  }
  for (const item of groups.values()) {
    const headSha = item.heads.size === 1 && !item.heads.has("MISSING") ?
      [...item.heads][0] : null;
    const row = {
      repository: item.repository, repoName: item.repoName, repoId: item.repoId,
      priority: item.priority < 0 ? null : item.priority,
      checks: [...item.checks].sort(), jobCount: item.count, headSha,
      dependencies: [...new Set(dependencyMap.get(item.repoName) || [])].sort(),
      dispatchable: false, mergeAuthorized: false, verifiedComplete: false
    };
    let reason = null;
    if (!freshPlan(plan, now)) reason = "STALE_OR_MISSING_PLAN";
    else if (!headSha) reason = "MISSING_OR_CONFLICTING_SOURCE_SHA";
    else if (occupied.has(item.repository)) reason = "REPOSITORY_RESERVED_IN_PREVIEW";
    else if (row.dependencies.length) reason = "DEPENDENCY_RECEIPT_NOT_VERIFIED";
    if (reason) held.push({ ...row, reason });
    else eligible.push(row);
  }
  eligible.sort((a, b) => ordered({ ...a, priority: a.priority ?? -1 },
    { ...b, priority: b.priority ?? -1 }));
  held.sort((a, b) => ordered({ ...a, priority: a.priority ?? -1 },
    { ...b, priority: b.priority ?? -1 }));
  const slots = eligible.slice(0, parallelism).map((x, index) =>
    ({ ...x, slot: index + 1, state: "PREVIEW_ONLY" }));
  const backlog = eligible.slice(parallelism).map(x => ({ ...x, state: "NOT_RESERVED" }));
  return {
    slots, backlog, held, totalRepositories: groups.size,
    totalProposals: [...groups.values()].reduce((n, x) => n + x.count, 0),
    planFresh: freshPlan(plan, now), actualWorkers: 0, dispatched: 0,
    verifiedComplete: 0, mergeAuthorized: false,
    executionAuthority: "NONE_BROWSER_PREVIEW_ONLY"
  };
}

// A local proposal cannot supply trusted CI, review, branch protection or
// execution receipts. This gate is closed EVEN IF its checklist looks reviewed.
export function mergeGatePreview(job, currentSha) {
  if (!job || !HEX40.test(job.headSha || "") || job.headSha !== currentSha) {
    return { authorized: false, reason: "SOURCE_SHA_MISMATCH_OR_UNKNOWN" };
  }
  return { authorized: false, reason: "INDEPENDENT_AGENTORA_AND_GITHUB_GATES_REQUIRED" };
}
