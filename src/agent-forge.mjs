// R28 Agent Forge. Public GitHub observations only; not a review approval or job dispatcher.
import { OWNER } from "./fleet.mjs";
import { publicRepoPath } from "./signals.mjs";

const SHA = /^[0-9a-f]{40}$/;
const FILE_PATH = /^[A-Za-z0-9_./@+ -]{1,300}$/;
const MAX_PATCH = 120_000;
const PR_PAGE = 10;
const FILE_PAGE = 50;

function verifiedPath(path) {
  return typeof path === "string" && FILE_PATH.test(path) &&
    !path.startsWith("/") && !path.endsWith("/") &&
    path.split("/").every(part => part && part !== "." && part !== "..");
}

function verifiedSha(value) {
  return typeof value === "string" && SHA.test(value);
}

async function readJson(fetcher, route) {
  const response = await fetcher("https://api.github.com" + route, {
    credentials: "omit",
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!response?.ok) throw new Error("GITHUB_PUBLIC_READ_UNAVAILABLE");
  return response.json();
}

function verifiedPr(raw, repo) {
  if (!raw || !Number.isSafeInteger(raw.number) || raw.number < 1 ||
      raw.state !== "open" || raw.base?.repo?.id !== repo.id ||
      raw.base?.repo?.full_name?.toLowerCase() !== repo.full_name.toLowerCase() ||
      !verifiedSha(raw.base?.sha) || !verifiedSha(raw.head?.sha)) return null;
  return {
    number: raw.number,
    title: typeof raw.title === "string" ? raw.title.slice(0, 160) : "Untitled",
    draft: raw.draft === true,
    baseSha: raw.base.sha,
    headSha: raw.head.sha,
    baseBranch: typeof raw.base.ref === "string" ? raw.base.ref.slice(0, 120) : "?",
    url: "https://github.com/" + OWNER + "/" + repo.name + "/pull/" + raw.number
  };
}

export async function readForgePulls(repo, fetcher = fetch) {
  const base = publicRepoPath(repo);
  const result = await readJson(fetcher, base + "/pulls?state=open&per_page=" + PR_PAGE);
  if (!Array.isArray(result) || result.length > PR_PAGE) {
    throw new Error("INVALID_PR_LIST");
  }
  // Never display a cross-repository or non-publicly identified pull request.
  return {
    pulls: result.map(raw => verifiedPr(raw, repo)).filter(Boolean),
    partial: result.length === PR_PAGE,
    observedAt: new Date().toISOString()
  };
}

export async function readForgeFiles(repo, number, fetcher = fetch) {
  const base = publicRepoPath(repo);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("INVALID_PR_NUMBER");
  const pr = verifiedPr(await readJson(fetcher, base + "/pulls/" + number), repo);
  if (!pr || pr.number !== number) throw new Error("PR_REPOSITORY_IDENTITY_MISMATCH");
  const rawFiles = await readJson(fetcher, base + "/pulls/" + number +
    "/files?per_page=" + FILE_PAGE);
  if (!Array.isArray(rawFiles) || rawFiles.length > FILE_PAGE) {
    throw new Error("INVALID_PR_FILE_LIST");
  }
  const files = rawFiles.filter(file => verifiedPath(file?.filename)).map(file => ({
    path: file.filename,
    oldPath: verifiedPath(file.previous_filename) ? file.previous_filename : null,
    status: ["added", "removed", "modified", "renamed"].includes(file.status) ?
      file.status : "other",
    additions: Number.isSafeInteger(file.additions) && file.additions >= 0 ?
      file.additions : null,
    deletions: Number.isSafeInteger(file.deletions) && file.deletions >= 0 ?
      file.deletions : null,
    // GitHub omits patches for binary and large changes. Never synthesize them.
    patch: typeof file.patch === "string" && file.patch.length <= MAX_PATCH &&
      file.patch.startsWith("@@ ") ? file.patch : null
  }));
  return {
    pr, files, partial: rawFiles.length === FILE_PAGE,
    skipped: rawFiles.length - files.length, observedAt: new Date().toISOString(),
    reviewedLocally: false, mergeAuthorized: false, dispatchAuthorized: false
  };
}

export function buildForgePatch(file) {
  if (!file || !verifiedPath(file.path) || !file.patch) return null;
  const oldPath = file.oldPath || file.path;
  if (!verifiedPath(oldPath)) return null;
  const oldMarker = file.status === "added" ? "/dev/null" : "a/" + oldPath;
  const newMarker = file.status === "removed" ? "/dev/null" : "b/" + file.path;
  return "diff --git a/" + oldPath + " b/" + file.path + "\n" +
    "--- " + oldMarker + "\n+++ " + newMarker + "\n" + file.patch + "\n";
}

export function forgeHandoff(review, path) {
  if (!review?.pr || !verifiedSha(review.pr.headSha) ||
      !review.files?.some(file => file.path === path)) {
    throw new Error("REVIEW_SELECTION_REQUIRED");
  }
  return [
    "PhiMadaPrime / Agent Forge / LOCAL REVIEW HANDOFF",
    "Pull request: " + review.pr.url,
    "Observed head SHA: " + review.pr.headSha,
    "Observed base SHA: " + review.pr.baseSha,
    "Selected changed file: " + path,
    "Observation: " + review.observedAt,
    "Read-only observation; local review is not GitHub approval.",
    "Recheck current HEAD, complete CI, security and independent acceptance before any release.",
    "No job dispatched, no PR approved, and no merge authorized."
  ].join("\n");
}
