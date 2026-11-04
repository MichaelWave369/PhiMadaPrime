// R29: bounded read-only public GitHub history. Never a job runner or restoration API.
import { OWNER } from "./fleet.mjs";
import { publicRepoPath } from "./signals.mjs";

const SHA40 = /^[0-9a-f]{40}$/;
const SAFE_REF = /^(?!\/)(?!.*\.\.)(?!.*\/\/)[a-zA-Z0-9_./-]{1,120}$/;
const FILE_PATH = /^[A-Za-z0-9_./@+ -]{1,300}$/;
const MAX_BRANCHES = 20;
const MAX_COMMITS = 25;
const MAX_CHANGED_FILES = 40;
const MAX_PATCH = 120_000;

export function validChronicleRef(value) {
  return typeof value === "string" && SAFE_REF.test(value) &&
    !value.startsWith(".") && !value.endsWith("/") && !value.endsWith(".lock") &&
    value.split("/").every(part => part && part !== "." && part !== ".." && !part.endsWith("."));
}
function validSha(value) {
  return typeof value === "string" && SHA40.test(value);
}
function validPath(value) {
  return typeof value === "string" && FILE_PATH.test(value) &&
    !value.startsWith("/") && !value.endsWith("/") &&
    value.split("/").every(part => part && part !== "." && part !== "..");
}
function limitedText(value, size, fallback = "") {
  return typeof value === "string" ? value.slice(0, size) : fallback;
}
async function publicJson(fetcher, path) {
  const response = await fetcher("https://api.github.com" + path, {
    credentials: "omit", headers: { Accept: "application/vnd.github+json" }
  });
  if (!response?.ok) throw Error("CHRONICLE_PUBLIC_GITHUB_READ_FAILED");
  return response.json();
}
function validCatalogRepo(repo) {
  const path = publicRepoPath(repo);
  if (repo.full_name !== OWNER + "/" + repo.name) {
    throw Error("CHRONICLE_REPO_IDENTITY_REQUIRED");
  }
  return path;
}

export async function readChronicleBranches(repo, fetcher = fetch, now = () => Date.now()) {
  const path = validCatalogRepo(repo);
  const meta = await publicJson(fetcher, path);
  if (meta?.private !== false || meta?.id !== repo.id ||
      meta?.full_name !== repo.full_name || !validChronicleRef(meta.default_branch)) {
    throw Error("CHRONICLE_REPOSITORY_MISMATCH");
  }
  const raw = await publicJson(fetcher, path + "/branches?per_page=" + MAX_BRANCHES);
  if (!Array.isArray(raw) || raw.length > MAX_BRANCHES) throw Error("CHRONICLE_BRANCH_LIST_INVALID");
  const unique = new Map();
  for (const candidate of raw) {
    if (!validChronicleRef(candidate?.name) || !validSha(candidate?.commit?.sha)) continue;
    if (!unique.has(candidate.name)) unique.set(candidate.name, {
      name: candidate.name, sha: candidate.commit.sha
    });
  }
  // The default branch may be outside a paginated first page. The name
  // comes from a verified public repository response, not user input.
  if (!unique.has(meta.default_branch)) unique.set(meta.default_branch, {
    name: meta.default_branch, sha: null
  });
  return {
    repository: repo.full_name, repositoryId: repo.id,
    defaultBranch: meta.default_branch, branches: [...unique.values()],
    partial: raw.length === MAX_BRANCHES,
    observedAt: new Date(now()).toISOString(), readOnly: true
  };
}

function normalCommit(raw, repo) {
  if (!validSha(raw?.sha) || !Array.isArray(raw.parents)) return null;
  const parents = raw.parents.map(p => p?.sha).filter(validSha);
  const date = raw.commit?.committer?.date || raw.commit?.author?.date;
  return {
    sha: raw.sha, parentSha: parents[0] || null, parentCount: parents.length,
    title: limitedText(raw.commit?.message?.split("\n")[0], 180, "Untitled commit"),
    author: limitedText(raw.commit?.author?.name, 90, "Unknown author"),
    date: typeof date === "string" && Number.isFinite(Date.parse(date)) ?
      new Date(date).toISOString() : null,
    url: "https://github.com/" + OWNER + "/" + repo.name + "/commit/" + raw.sha
  };
}

export async function readChronicleHistory(repo, branchName,
  fetcher = fetch, now = () => Date.now()) {
  const path = validCatalogRepo(repo);
  if (!validChronicleRef(branchName)) throw Error("CHRONICLE_BRANCH_REF_INVALID");
  const branch = await publicJson(fetcher, path + "/branches/" + encodeURIComponent(branchName));
  if (branch?.name !== branchName || !validSha(branch?.commit?.sha)) {
    throw Error("CHRONICLE_BRANCH_HEAD_INVALID");
  }
  const headSha = branch.commit.sha;
  // Use immutable SHA, not mutable branch name, to freeze this observation.
  const raw = await publicJson(fetcher, path + "/commits?sha=" + headSha +
    "&per_page=" + MAX_COMMITS);
  if (!Array.isArray(raw) || raw.length > MAX_COMMITS) {
    throw Error("CHRONICLE_COMMITS_INVALID");
  }
  const commits = raw.map(item => normalCommit(item, repo)).filter(Boolean);
  if (!commits.length || commits[0].sha !== headSha || commits.length !== raw.length) {
    throw Error("CHRONICLE_HEAD_LIST_MISMATCH");
  }
  return {
    repository: repo.full_name, repositoryId: repo.id, branch: branchName,
    headSha, commits, partial: raw.length === MAX_COMMITS,
    observedAt: new Date(now()).toISOString(), readOnly: true
  };
}

export async function readChronicleChange(repo, sha, expectedParentSha,
  fetcher = fetch, now = () => Date.now()) {
  const path = validCatalogRepo(repo);
  if (!validSha(sha) || !validSha(expectedParentSha)) throw Error("CHRONICLE_COMMIT_ID_INVALID");
  const raw = await publicJson(fetcher, path + "/commits/" + sha +
    "?per_page=" + MAX_CHANGED_FILES);
  if (raw?.sha !== sha || !Array.isArray(raw.parents) ||
      raw.parents[0]?.sha !== expectedParentSha || !Array.isArray(raw.files) ||
      raw.files.length > MAX_CHANGED_FILES) {
    throw Error("CHRONICLE_COMMIT_DETAIL_MISMATCH");
  }
  const files = raw.files.filter(f => validPath(f?.filename)).map(file => ({
    path: file.filename,
    oldPath: validPath(file.previous_filename) ? file.previous_filename : null,
    status: ["added", "removed", "modified", "renamed"].includes(file.status) ?
      file.status : "other",
    additions: Number.isSafeInteger(file.additions) && file.additions >= 0 ?
      file.additions : null,
    deletions: Number.isSafeInteger(file.deletions) && file.deletions >= 0 ?
      file.deletions : null,
    patch: typeof file.patch === "string" && file.patch.length <= MAX_PATCH &&
      file.patch.startsWith("@@ ") ? file.patch : null
  }));
  return {
    repository: repo.full_name, sha, parentSha: expectedParentSha,
    files, skipped: raw.files.length - files.length,
    partial: raw.files.length === MAX_CHANGED_FILES,
    observedAt: new Date(now()).toISOString(), readOnly: true,
    executed: false, approved: false, mergeAuthorized: false,
    compareUrl: "https://github.com/" + OWNER + "/" + repo.name +
      "/compare/" + expectedParentSha + "..." + sha
  };
}

export function chronicleHandoff(history, change, path) {
  if (!history || !change || history.repository !== change.repository ||
      !history.commits?.some(c => c.sha === change.sha &&
        c.parentSha === change.parentSha) ||
      !validSha(history.headSha) ||
      !change.files?.some(file => file.path === path)) {
    throw Error("CHRONICLE_SELECTION_MISMATCH");
  }
  return [
    "PhiMadaPrime / R29 CHRONICLE / REVIEW-ONLY HANDOFF",
    "Repository: " + history.repository,
    "Observed branch: " + history.branch,
    "Branch head at observation: " + history.headSha,
    "Selected commit: " + change.sha,
    "First parent: " + change.parentSha,
    "File: " + path,
    "History observed: " + history.observedAt,
    "Commit detail observed: " + change.observedAt,
    "Compare: " + change.compareUrl,
    "Read-only snapshot; no job executed, restoration attempted, approval, or merge.",
    "Revalidate branch HEAD and independent checks before taking action."
  ].join("\n");
}

export const CHRONICLE_STAGES = Object.freeze([
  { id: "catalog", title: "Catalog", detail: "Public repository identity from the discovered fleet" },
  { id: "branches", title: "Branches", detail: "On-demand public branch inventory" },
  { id: "history", title: "Commit timeline", detail: "Immutable SHA-anchored recent commit window" },
  { id: "diff", title: "Code inspection", detail: "First-parent changed-file patches, viewed only" },
  { id: "handoff", title: "Review handoff", detail: "Local text copied for independent review" },
  { id: "release", title: "Human gate", detail: "External approval, CI validation and release; never controlled here" }
]);

export function chronicleFlow(repo, branches, history, change, handoffCopied = false) {
  const bound = Boolean(repo && !repo.exampleOnly && Number.isSafeInteger(repo.id) &&
    repo.id > 0 && repo.full_name === OWNER + "/" + repo.name);
  const hasBranches = bound && branches?.repository === repo.full_name &&
    branches?.repositoryId === repo.id;
  const hasHistory = hasBranches && history?.repository === repo.full_name &&
    history?.repositoryId === repo.id &&
    branches.branches.some(b => b.name === history.branch);
  const hasDiff = hasHistory && change?.repository === repo.full_name &&
    history.commits.some(c => c.sha === change.sha && c.parentSha === change.parentSha);
  const states = [bound, hasBranches, hasHistory, hasDiff, hasDiff && handoffCopied];
  const positions = [
    {x:0,y:0},{x:270,y:0},{x:540,y:0},
    {x:540,y:165},{x:270,y:165},{x:0,y:165}
  ];
  const nodes = CHRONICLE_STAGES.map((stage,i) => {
    const status = i === 5 ? "EXTERNAL" : states[i] ? (i === 4 ? "LOCAL ONLY" : "OBSERVED") : "NOT OBSERVED";
    const color = status === "OBSERVED" ? "#76ddb7" :
      status === "LOCAL ONLY" ? "#82c5ef" : "#c3b1c9";
    return {
      id: stage.id, position: positions[i], sourcePosition: i < 3 ? "right" : "left",
      targetPosition: i < 3 ? "left" : i === 3 ? "top" : "right",
      data: { label: (i+1) + " · " + stage.title + "\n" + status },
      draggable: false, selectable: true,
      style: {
        width: 204, whiteSpace: "pre-line", textAlign: "center",
        border: "1.5px solid " + color, color: "#f5f2ff",
        background: "#22243a", borderRadius: 10,
        fontFamily: "monospace", fontSize: 12, padding: 12
      }
    };
  });
  const edges = CHRONICLE_STAGES.slice(1).map((stage,i) => ({
    id: "r29-" + CHRONICLE_STAGES[i].id + "-" + stage.id,
    source: CHRONICLE_STAGES[i].id, target: stage.id,
    type: "smoothstep", animated: false,
    style: { stroke: "#678ba8", strokeWidth: 2 }
  }));
  return { nodes, edges, stages: CHRONICLE_STAGES.map((stage,i) => ({
    ...stage, status: i===5 ? "EXTERNAL" : states[i] ? (i===4 ? "LOCAL ONLY" : "OBSERVED") : "NOT OBSERVED"
  })) };
}
