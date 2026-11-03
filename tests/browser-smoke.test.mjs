import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BROWSER_SCHEMA, BROWSER_SITE, BROWSER_REPO_ID, BROWSER_CONFIRM,
  BROWSER_CHECKS, requireManualBrowserPilot, validateGithubSource,
  browserSmokeReceipt
} from "../scripts/r12_browser_contract.mjs";

const SHA = "a".repeat(40);
const MOVED = "b".repeat(40);
const ALL_PASS = Object.fromEntries(BROWSER_CHECKS.map(k => [k, "PASS"]));
const NOW = "2026-11-03T20:00:00.000Z";
function repo(patch = {}) {
  return {
    id: BROWSER_REPO_ID, full_name: "MichaelWave369/PhiMadaPrime",
    owner: { login: "MichaelWave369" }, private: false,
    archived: false, default_branch: "main", ...patch
  };
}
function head(sha = SHA) { return { name: "main", commit: { sha } }; }
function receipt(changes = {}) {
  return browserSmokeReceipt({
    expectedSha: SHA, beforeSha: SHA, afterSha: SHA, builtSha: SHA,
    checks: ALL_PASS, errors: [], runId: "123456", observedUtc: NOW,
    ...changes
  });
}
test("manual opt-in demands exact SHA and phrase", () => {
  assert.equal(requireManualBrowserPilot(SHA, BROWSER_CONFIRM), SHA);
  for (const sha of ["main", SHA.slice(0, -1), SHA.toUpperCase(), true]) {
    assert.throws(() => requireManualBrowserPilot(sha, BROWSER_CONFIRM),
      /EXACT_SOURCE_SHA_REQUIRED/);
  }
  for (const confirm of ["", "YES", "RUN_PHI_MADA_TESTS", true]) {
    assert.throws(() => requireManualBrowserPilot(SHA, confirm),
      /EXPLICIT_OPERATOR_CONFIRMATION_REQUIRED/);
  }
});

test("valid public repo and two consistent HEAD reads return immutable SHA", () => {
  assert.equal(validateGithubSource(repo(), [head(), head()], SHA), SHA);
});

test("renamed, private, archived or wrong repo cannot pass", () => {
  for (const variant of [
    { id: 23 }, { full_name: "Other/PhiMadaPrime" },
    { owner: { login: "Other" } }, { private: true },
    { archived: true }, { default_branch: "old-main" }
  ]) {
    assert.throws(() => validateGithubSource(repo(variant),
      [head(), head()], SHA), /IDENTITY_CHANGED/);
  }
});

test("head changed between GitHub reads holds source acceptance", () => {
  assert.throws(() => validateGithubSource(repo(), [head(), head(MOVED)], SHA),
    /HEAD_CHANGED_DURING_OBSERVATION/);
});

test("moved source cannot be accepted even with consistent new HEAD", () => {
  assert.throws(() => validateGithubSource(repo(), [head(MOVED), head(MOVED)], SHA),
    /HEAD_DIFFERS_FROM_REQUESTED_SHA/);
});

test("malformed API head cannot be treated as source evidence", () => {
  for (const item of [
    [head(), { name: "main", commit: { sha: "HEAD" } }],
    [{ name: "release", commit: { sha: SHA } }, head()],
    [head()],
    null
  ]) {
    assert.throws(() => validateGithubSource(repo(), item, SHA),
      /HEAD_RESPONSE_INVALID/);
  }
});

test("only all browser interactions and source/deploy match can pass", () => {
  const r = receipt();
  assert.equal(r.schema, BROWSER_SCHEMA);
  assert.equal(r.state, "AUTOMATED_BROWSER_SMOKE_PASSED_AT_OBSERVED_SHA");
  assert.equal(r.automated_browser_smoke_passed, true);
  assert.equal(r.target_url, BROWSER_SITE);
  assert.equal(r.github_head_before_sha, SHA);
  assert.equal(r.github_head_after_sha, SHA);
  for (const field of ["marker_is_signed_deployment_attestation",
    "keyboard_accessibility_audited", "full_accessibility_reviewed",
    "complete_user_journeys_verified", "deployed_revision_cryptographically_verified",
    "product_verified", "verified_complete", "merge_authorized",
    "job_dispatch_authorized"]) {
    assert.equal(r[field], false);
  }
  assert.equal(r.operator_review_required, true);
});

test("unstamped or older deployed site cannot pass", () => {
  for (const builtSha of ("", "UNSTAMPED", null, MOVED)) {
    const r = receipt({ builtSha });
    assert.equal(r.state, "HELD_DEPLOYED_REVISION_MARKER_MISMATCH");
    assert.equal(r.automated_browser_smoke_passed, false);
  }
});

test("moving GitHub HEAD before or after smoke invalidates result", () => {
  for (const change of [{ beforeSha: MOVED }, { afterSha: MOVED },
    { beforeSha: null }, { afterSha: null }]) {
    const r = receipt(change);
    assert.equal(r.state, "HELD_PUBLIC_HEAD_NOT_STABLE");
    assert.equal(r.automated_browser_smoke_passed, false);
  }
});

test("missing, failed and incomplete browser checks do not pass", () => {
  for (const change of [
    { checks: { ...ALL_PASS, inspect_desk: "FAIL" } },
    { checks: { page_boot: "PASS" } },
    { checks: {} }
  ]) {
    const r = receipt(change);
    assert.equal(r.state, "FAILED_OR_INCOMPLETE_BROWSER_INTERACTIONS");
    assert.equal(r.automated_browser_smoke_passed, false);
  }
});

test("browser JS runtime errors fail otherwise green smoke", () => {
  const r = receipt({ errors: ["Uncaught TypeError: cannot render"] });
  assert.equal(r.state, "FAILED_BROWSER_RUNTIME_ERRORS");
  assert.equal(r.automated_browser_smoke_passed, false);
});

test("untrusted check names, error shapes and run ids are rejected", () => {
  assert.throws(() => receipt({ checks: { pretend_merged: "PASS" } }),
    /CHECK_RECORD_INVALID/);
  assert.throws(() => receipt({ checks: { page_boot: true } }),
    /CHECK_RECORD_INVALID/);
  assert.throws(() => receipt({ errors: ["x".repeat(301)] }),
    /BROWSER_ERRORS_INVALID/);
  assert.throws(() => receipt({ runId: "bad-id" }), /RUN_ID_INVALID/);
});

test("workflow is manual-only, read-only and fixed to the live site", () => {
  const workflow = readFileSync(".github/workflows/r12-browser-smoke.yml", "utf8");
  const runner = readFileSync("scripts/r12_browser_smoke.mjs", "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n  push:|\n  pull_request:|\n  schedule:/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /RUN_PHI_MADA_BROWSER_SMOKE/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(runner, /const API_BASE = "https:\/\/api.github.com\/repos\/" \+ BROWSER_REPO/);
  assert.match(runner, /page\.goto\(BROWSER_SITE/);
  assert.match(runner, /browserSmokeReceipt/);
  assert.doesNotMatch(runner, /spawn\(|exec\(|git push|merge_pull_request/);
});

test("deployed footer exposes build marker but never signs a deployment", () => {
  const config = readFileSync("vite.config.js", "utf8");
  const app = readFileSync("src/main.jsx", "utf8");
  assert.match(config, /GITHUB_SHA/);
  assert.match(config, /__PHIMADA_BUILD_SHA__/);
  assert.match(app, /data-testid="phimada-deployed-revision"/);
  assert.match(app, /data-build-sha=\{PUBLIC_BUILD_SHA \|\| "UNSTAMPED"\}/);
});
