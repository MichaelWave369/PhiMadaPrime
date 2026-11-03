import test from "node:test";
import assert from "node:assert/strict";
import {
  publicRepoPath, classifyHeadRuns, fetchRepoSignals, signalsFresh
} from "../src/signals.mjs";

const SHA = "a".repeat(40);
const repo = {
  id: 12345, name: "PhiOS", full_name: "MichaelWave369/PhiOS",
  exampleOnly: false
};
function responses({ head = SHA, conclusion = "success", status = "completed",
  prs = [], privateRepo = false, repositoryId = repo.id } = {}) {
  const calls = [];
  const fake = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/repos/MichaelWave369/PhiOS")) {
      return { ok: true, json: async () => ({
        private: privateRepo, id: repositoryId, full_name: repo.full_name,
        default_branch: "main"
      }) };
    }
    if (url.endsWith("/branches/main")) {
      return { ok: true, json: async () => ({ commit: { sha: head } }) };
    }
    if (url.includes("/actions/runs?")) {
      return { ok: true, json: async () => ({ workflow_runs: [
        { head_sha: head, status, conclusion }] }) };
    }
    if (url.includes("/pulls?")) {
      return { ok: true, json: async () => prs };
    }
    throw new Error("unexpected path: " + url);
  };
  return { fake, calls };
}

test("public repo is required; no private, example or crafted endpoint", () => {
  assert.equal(publicRepoPath(repo), "/repos/MichaelWave369/PhiOS");
  for (const change of [
    { name: "../secrets" }, { id: -1 }, { exampleOnly: true },
    { full_name: "somebody-else/PhiOS" }
  ]) {
    assert.throws(() => publicRepoPath({ ...repo, ...change }),
      /PUBLIC_REPOSITORY_IDENTITY_REQUIRED/);
  }
});

test("exact-head CI statuses are conservative", () => {
  assert.equal(classifyHeadRuns([], SHA).state, "NO_EXACT_HEAD_RUN");
  assert.equal(classifyHeadRuns([{head_sha: "b".repeat(40),
    status: "completed", conclusion: "success"}], SHA).state, "NO_EXACT_HEAD_RUN");
  assert.equal(classifyHeadRuns([{head_sha: SHA,
    status: "in_progress", conclusion: null}], SHA).state, "PENDING_AT_HEAD");
  assert.equal(classifyHeadRuns([{head_sha: SHA,
    status: "completed", conclusion: "failure"}], SHA).state, "FAILED_AT_HEAD_OBSERVED");
  assert.equal(classifyHeadRuns([{head_sha: SHA,
    status: "completed", conclusion: "success"}], SHA).state, "OBSERVED_GREEN_AT_HEAD");
  assert.equal(classifyHeadRuns([{head_sha: SHA,
    status: "completed", conclusion: "success"}], "bad").state, "HEAD_UNVERIFIED");
  assert.equal(classifyHeadRuns([{head_sha: SHA,
    status: "completed", conclusion: "neutral"}], SHA).state, "NON_SUCCESS_AT_HEAD");
});

test("on-demand public GitHub reads never dispatch a job or authorize merge", async () => {
  const { fake, calls } = responses({ prs: [{
    number: 76, title: "Feature", draft: false, state: "open",
    html_url: "javascript:alert(1)"
  }] });
  const signal = await fetchRepoSignals(repo, fake, () => 1760000000000);
  assert.equal(signal.ci.state, "OBSERVED_GREEN_AT_HEAD");
  assert.equal(signal.functionallyVerified, false);
  assert.equal(signal.mergeAuthorized, false);
  assert.equal(signal.celebrateObservedCi, true);
  assert.equal(signal.openPrs[0].url, "https://github.com/MichaelWave369/PhiOS/pull/76");
  assert(calls.every(c => c.url.startsWith("https://api.github.com/repos/MichaelWave369/PhiOS")));
  assert(calls.every(c => c.options.headers.Accept === "application/vnd.github+json"));
  assert(calls.every(c => !("Authorization" in c.options.headers)));
});

test("a bad identity never becomes a valid signal", async () => {
  for (const variants of [{ privateRepo: true }, { repositoryId: 899 }]) {
    const { fake, calls } = responses(variants);
    await assert.rejects(fetchRepoSignals(repo, fake), /GITHUB_REPOSITORY_MISMATCH/);
    assert.equal(calls.length, 1);
  }
});

test("failure cannot trigger a cosmetic CI celebration", async () => {
  const { fake } = responses({ conclusion: "failure" });
  const signal = await fetchRepoSignals(repo, fake);
  assert.equal(signal.ci.state, "FAILED_AT_HEAD_OBSERVED");
  assert.equal(signal.celebrateObservedCi, false);
});

test("signal freshness expires; stale success may not animate", () => {
  const now = 1760000000000;
  assert(signalsFresh({ observedAt: new Date(now).toISOString() }, now));
  assert(!signalsFresh({ observedAt: new Date(now - 20 * 60 * 1000).toISOString() }, now));
  assert(!signalsFresh(null, now));
});

test("public API outage does not invent an observed successful job", async () => {
  const fake = async () => ({ ok: false, status: 403 });
  await assert.rejects(fetchRepoSignals(repo, fake), /GITHUB_SIGNAL_UNAVAILABLE/);
});
