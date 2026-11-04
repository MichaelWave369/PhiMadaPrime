import test from "node:test";
import assert from "node:assert/strict";
import { buildForgePatch, forgeHandoff, readForgeFiles, readForgePulls } from "../src/agent-forge.mjs";

const OWNER = "MichaelWave369";
const repo = {
  id: 123, name: "PhiMadaPrime",
  full_name: OWNER + "/PhiMadaPrime", exampleOnly: false
};
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const baseUrl = "https://api.github.com/repos/" + OWNER + "/" + repo.name;
const pull = {
  number: 22, state: "open", title: "Feature", draft: false,
  base: { sha: baseSha, ref: "main", repo: { id: 123, full_name: repo.full_name } },
  head: { sha: headSha }
};
const sample = {
  filename: "src/feature.jsx", status: "modified", additions: 1, deletions: 1,
  patch: "@@ -1 +1 @@\n-old\n+new"
};
function mock(records) {
  return async (url, opts) => {
    assert.equal(opts.credentials, "omit", "browser cannot forward credentials");
    if (!Object.hasOwn(records, url)) return { ok: false, json: async () => null };
    return { ok: true, json: async () => records[url] };
  };
}

test("real public PRs are bounded and external repo identities are excluded", async () => {
  const foreign = { ...pull, number: 23,
    base: { ...pull.base, repo: { id: 987, full_name: "elsewhere/project" } } };
  const found = await readForgePulls(repo, mock({
    [baseUrl + "/pulls?state=open&per_page=10"]: [pull, foreign]
  }));
  assert.equal(found.pulls.length, 1);
  assert.deepEqual(found.pulls[0].number, 22);
  assert.equal(found.partial, false);
  assert.equal(found.pulls[0].url, "https://github.com/MichaelWave369/PhiMadaPrime/pull/22");
});
test("fall back to no claims if public API fetch fails", async () => {
  await assert.rejects(readForgePulls(repo, mock({})), /GITHUB_PUBLIC_READ_UNAVAILABLE/);
});
test("curated example is not eligible to fetch GitHub data", async () => {
  await assert.rejects(readForgePulls({ ...repo, exampleOnly: true }, mock({})),
    /PUBLIC_REPOSITORY_IDENTITY_REQUIRED/);
});
test("selected PR must match owner, numeric id and exact SHA", async () => {
  await assert.rejects(readForgeFiles(repo, 22, mock({
    [baseUrl + "/pulls/22"]: { ...pull, head: { sha: "not-a-sha" } }
  })), /PR_REPOSITORY_IDENTITY_MISMATCH/);
  await assert.rejects(readForgeFiles(repo, -1, mock({})), /INVALID_PR_NUMBER/);
});
test("changed files are observed only, with an exact-head review handoff", async () => {
  const result = await readForgeFiles(repo, 22, mock({
    [baseUrl + "/pulls/22"]: pull,
    [baseUrl + "/pulls/22/files?per_page=50"]: [sample]
  }));
  assert.equal(result.files.length, 1);
  assert.equal(result.partial, false);
  assert.equal(result.mergeAuthorized, false);
  assert.equal(result.dispatchAuthorized, false);
  const patch = buildForgePatch(result.files[0]);
  assert.match(patch, /diff --git a\/src\/feature\.jsx b\/src\/feature\.jsx/);
  assert.match(patch, /\+new/);
  const handoff = forgeHandoff(result, "src/feature.jsx");
  assert.match(handoff, new RegExp(headSha));
  assert.match(handoff, /No job dispatched/);
  assert.throws(() => forgeHandoff(result, "not/in/this/pr"), /REVIEW_SELECTION_REQUIRED/);
});
test("unsafe file paths and oversized patches never become rendered code", async () => {
  const result = await readForgeFiles(repo, 22, mock({
    [baseUrl + "/pulls/22"]: pull,
    [baseUrl + "/pulls/22/files?per_page=50"]: [
      { ...sample, filename: "../../secrets" },
      { ...sample, filename: "x\ninjected" },
      { ...sample, filename: "valid.md", patch: "x".repeat(120001) },
      sample
    ]
  }));
  assert.equal(result.skipped, 2);
  assert.equal(result.files.length, 2);
  assert.equal(buildForgePatch(result.files.find(file => file.path === "valid.md")), null);
});
test("first 50 files explicitly report incomplete coverage", async () => {
  const result = await readForgeFiles(repo, 22, mock({
    [baseUrl + "/pulls/22"]: pull,
    [baseUrl + "/pulls/22/files?per_page=50"]:
      Array.from({ length: 50 }, (_, i) => ({ ...sample, filename: "file" + i + ".txt" }))
  }));
  assert.equal(result.files.length, 50);
  assert.equal(result.partial, true);
});
test("added and removed patches use the missing-side marker", () => {
  assert.match(buildForgePatch({ path: "new.txt", status: "added",
    patch: "@@ -0,0 +1 @@\n+new" }), /--- \/dev\/null/);
  assert.match(buildForgePatch({ path: "old.txt", status: "removed",
    patch: "@@ -1 +0,0 @@\n-old" }), /\+\+\+ \/dev\/null/);
});
