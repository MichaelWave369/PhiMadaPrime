// On-demand, public GitHub observations. Never an implicit authorization to merge.
import { OWNER } from "./fleet.mjs";

const NAME = /^[a-zA-Z0-9_.-]{1,100}$/;
export const SIGNAL_STALE_MS = 15 * 60 * 1000;

export function publicRepoPath(repo) {
  if (!repo || repo.exampleOnly || !Number.isSafeInteger(repo.id) || repo.id <= 0 ||
      typeof repo.name !== "string" || !NAME.test(repo.name) ||
      repo.name === "." || repo.name === ".." ||
      repo.full_name?.toLowerCase() !== (OWNER + "/" + repo.name).toLowerCase()) {
    throw new Error("PUBLIC_REPOSITORY_IDENTITY_REQUIRED");
  }
  return "/repos/" + OWNER + "/" + encodeURIComponent(repo.name);
}

async function githubJson(fetcher, url) {
  const response = await fetcher("https://api.github.com" + url, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!response?.ok) throw new Error("GITHUB_SIGNAL_UNAVAILABLE");
  return response.json();
}

function validSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function safePr(pr, repo) {
  if (!pr || !Number.isSafeInteger(pr.number) || pr.number < 1) return null;
  return {
    number: pr.number,
    title: typeof pr.title === "string" ? pr.title.slice(0, 150) : "Untitled PR",
    draft: pr.draft === true,
    url: "https://github.com/" + OWNER + "/" + repo.name + "/pull/" + pr.number,
    state: pr.state === "open" ? "open" : "unknown"
  };
}

export function classifyHeadRuns(runs, sha) {
  if (!validSha(sha)) return {
    state: "HEAD_UNVERIFIED", message: "Cannot confirm exact branch head"
  };
  if (!Array.isArray(runs)) return {
    state: "RUNS_UNAVAILABLE", message: "Workflow data unavailable"
  };
  const matches = runs.filter(run => run?.head_sha === sha);
  if (!matches.length) return {
    state: "NO_EXACT_HEAD_RUN", message: "No recent workflow run matched this exact commit"
  };
  if (matches.some(run => run.status === "completed" &&
      ["failure", "timed_out", "cancelled", "action_required"].includes(run.conclusion))) {
    return { state: "FAILED_AT_HEAD_OBSERVED",
      message: "At least one observed workflow did not succeed on this commit" };
  }
  if (matches.some(run => run.status !== "completed")) return {
    state: "PENDING_AT_HEAD", message: "A workflow is running or queued on this commit"
  };
  if (matches.every(run => run.conclusion === "success")) return {
    state: "OBSERVED_GREEN_AT_HEAD",
    message: "Observed exact-head workflows passed; required checks and app functionality are not certified"
  };
  return { state: "NON_SUCCESS_AT_HEAD",
    message: "Some exact-head workflow conclusions are not success" };
}

export async function fetchRepoSignals(repo, fetcher = fetch, now = () => Date.now()) {
  const base = publicRepoPath(repo);
  // No credential forwarding, no browser write APIs, no bulk crawling.
  const meta = await githubJson(fetcher, base);
  if (meta?.private !== false ||
      meta?.id !== repo.id ||
      meta?.full_name?.toLowerCase() !== repo.full_name.toLowerCase()) {
    throw new Error("GITHUB_REPOSITORY_MISMATCH");
  }
  const branch = meta.default_branch;
  if (typeof branch !== "string" || branch.length > 200) {
    throw new Error("DEFAULT_BRANCH_UNAVAILABLE");
  }
  const [head, workflows, prs] = await Promise.all([
    githubJson(fetcher, base + "/branches/" + encodeURIComponent(branch)),
    githubJson(fetcher, base + "/actions/runs?branch=" +
      encodeURIComponent(branch) + "&per_page=12"),
    githubJson(fetcher, base + "/pulls?state=open&per_page=10")
  ]);
  const sha = head?.commit?.sha;
  const ci = classifyHeadRuns(workflows?.workflow_runs, sha);
  if (!Array.isArray(prs) || prs.length > 10) throw new Error("GITHUB_PR_RESPONSE_INVALID");
  const openPrs = prs.map(pr => safePr(pr, repo)).filter(Boolean);
  const observedAt = new Date(now()).toISOString();
  return {
    repository: repo.full_name, repositoryId: repo.id, observedAt,
    defaultBranch: branch, headSha: validSha(sha) ? sha : null,
    ci, openPrs, prListPartial: prs.length === 10,
    from: "LIVE_PUBLIC_GITHUB_API_READ_ONLY",
    functionallyVerified: false,
    mergeAuthorized: false,
    // This is cosmetic feedback for an observed successful CI run only.
    celebrateObservedCi: ci.state === "OBSERVED_GREEN_AT_HEAD"
  };
}

export function signalsFresh(signal, now = Date.now()) {
  const observed = Date.parse(signal?.observedAt || "");
  return Number.isFinite(observed) &&
    observed <= now + 300_000 && now - observed <= SIGNAL_STALE_MS;
}
