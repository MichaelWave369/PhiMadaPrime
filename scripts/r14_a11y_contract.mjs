// PhiMada R14: exact-source, manually invoked bounded accessibility audit.
// An axe scan is automated evidence, never a WCAG certification or approval.
import {
  BROWSER_REPO, BROWSER_REPO_ID, BROWSER_SITE, validateGithubSource
} from "./r12_browser_contract.mjs";

export const A11Y_CONFIRM = "RUN_PHI_MADA_A11Y_AUDIT";
export const A11Y_SCHEMA = "phimada.accessibility-observation.v0.14";
export const A11Y_VIEWS = Object.freeze(["office", "inspector", "mission_board"]);
export const A11Y_TAGS = Object.freeze([
  "wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"
]);
const HEX40 = /^[a-f0-9]{40}$/;
const MAX_VIOLATIONS = 80;

function requireValue(ok, reason) {
  if (!ok) throw new Error(reason);
}
export function validateA11yLaunch(sha, confirmation) {
  requireValue(typeof sha === "string" && HEX40.test(sha),
    "A11Y_EXACT_SHA_REQUIRED");
  requireValue(confirmation === A11Y_CONFIRM, "A11Y_EXPLICIT_CONFIRMATION_REQUIRED");
  return sha;
}
export { BROWSER_REPO, BROWSER_REPO_ID, BROWSER_SITE, validateGithubSource };

export function summarizeAxeView(name, scan) {
  requireValue(A11Y_VIEWS.includes(name), "A11Y_VIEW_NOT_ALLOWED");
  requireValue(scan && typeof scan === "object" && !Array.isArray(scan) &&
    Array.isArray(scan.violations) && Array.isArray(scan.incomplete) &&
    Array.isArray(scan.passes), "A11Y_AXE_SCAN_INVALID");
  const findings = scan.violations.slice(0, MAX_VIOLATIONS).map(v => {
    requireValue(typeof v.id === "string" && v.id.length <= 100 &&
      ["critical", "serious", "moderate", "minor", null].includes(v.impact) &&
      Array.isArray(v.nodes), "A11Y_AXE_VIOLATION_INVALID");
    // Store only static CSS class tokens as diagnostic hints. Never write
    // element HTML, form values, accessible names, or arbitrary selector text.
    const selectorHints = [...new Set(v.nodes.slice(0, 12).flatMap(node =>
      (Array.isArray(node.target) ? node.target : []).flatMap(target =>
        typeof target === "string" ?
          (target.match(/\\.[a-zA-Z][a-zA-Z0-9_-]{0,47}/g) || []) : [])))].slice(0, 12);
    return {
      id: v.id, impact: v.impact,
      affected_nodes: v.nodes.length,
      selector_class_hints: selectorHints,
      help: typeof v.help === "string" ? v.help.slice(0, 160) : ""
    };
  });
  return {
    view: name, status: scan.violations.length === 0 ?
      "NO_AUTOMATED_VIOLATIONS_OBSERVED" : "AUTOMATED_VIOLATIONS_FOUND",
    violations: findings,
    violation_rules: scan.violations.length,
    incomplete_rules: scan.incomplete.length,
    incomplete_rule_ids: scan.incomplete.slice(0, 30)
      .map(rule => typeof rule?.id === "string" ? rule.id.slice(0, 100) : "unknown"),
    passed_rules: scan.passes.length,
    findings_truncated: scan.violations.length > MAX_VIOLATIONS
  };
}
export function a11yReceipt({
  expectedSha, beforeSha, afterSha, deployedSha, views = {},
  keyboard = {}, errors = [], observedUtc, runId = null
}) {
  requireValue(typeof expectedSha === "string" && HEX40.test(expectedSha),
    "A11Y_EXACT_SHA_REQUIRED");
  requireValue(typeof observedUtc === "string" &&
    Number.isFinite(Date.parse(observedUtc)), "A11Y_OBSERVATION_TIME_INVALID");
  requireValue(runId === null || typeof runId === "string" &&
    /^[0-9]{1,20}$/.test(runId), "A11Y_RUN_ID_INVALID");
  requireValue(errors && Array.isArray(errors) && errors.length <= 20 &&
    errors.every(e => typeof e === "string" && e.length <= 260),
    "A11Y_ERRORS_INVALID");
  requireValue(views && typeof views === "object" && !Array.isArray(views) &&
    Object.keys(views).every(k => A11Y_VIEWS.includes(k)) &&
    Object.values(views).every(v => v &&
      typeof v === "object" && typeof v.view === "string" &&
      Number.isSafeInteger(v.violation_rules) && v.violation_rules >= 0 &&
      Number.isSafeInteger(v.incomplete_rules) && v.incomplete_rules >= 0 &&
      Number.isSafeInteger(v.passed_rules) && v.passed_rules >= 0 &&
      Array.isArray(v.violations) && typeof v.findings_truncated === "boolean"),
    "A11Y_VIEWS_INVALID");
  const expectedKeyboard = ["desk_keyboard_open", "inspector_escape_close",
    "mission_board_keyboard_open", "evidence_details_keyboard_toggle"];
  requireValue(keyboard && typeof keyboard === "object" &&
    !Array.isArray(keyboard) && Object.keys(keyboard).every(k =>
      expectedKeyboard.includes(k)) &&
    Object.values(keyboard).every(x => ["PASS", "FAIL", "NOT_RUN"].includes(x)),
    "A11Y_KEYBOARD_INVALID");
  const results = Object.fromEntries(expectedKeyboard.map(k =>
    [k, keyboard[k] || "NOT_RUN"]));
  const completeViews = A11Y_VIEWS.every(k => views[k]?.view === k);
  const sourceMatch = beforeSha === expectedSha && afterSha === expectedSha;
  const deployedMatch = deployedSha === expectedSha;
  const scansClear = completeViews && A11Y_VIEWS.every(k =>
    views[k].violation_rules === 0 && views[k].incomplete_rules === 0);
  const keyboardClear = Object.values(results).every(x => x === "PASS");
  const passed = sourceMatch && deployedMatch && scansClear &&
    keyboardClear && errors.length === 0;
  const state = !sourceMatch ? "HELD_SOURCE_SHA_CHANGED_OR_UNKNOWN" :
    !deployedMatch ? "HELD_DEPLOYED_SHA_MARKER_MISMATCH" :
    !completeViews ? "HELD_INCOMPLETE_ACCESSIBILITY_SCANS" :
    !scansClear ? "AUTOMATED_ACCESSIBILITY_FINDINGS_REQUIRE_REVIEW" :
    !keyboardClear ? "KEYBOARD_CHECKS_REQUIRE_REVIEW" :
    errors.length ? "ACCESSIBILITY_RUNTIME_ERRORS" :
    "AUTOMATED_ACCESSIBILITY_CHECKS_CLEAR_AT_OBSERVED_SHA";
  return {
    schema: A11Y_SCHEMA, state,
    repository: BROWSER_REPO, repository_id: BROWSER_REPO_ID,
    target_url: BROWSER_SITE, requested_source_sha: expectedSha,
    github_head_before_sha: beforeSha || null,
    github_head_after_sha: afterSha || null,
    observed_deployed_build_marker: deployedSha || null,
    observed_utc: observedUtc, workflow_run_id: runId,
    axe_tags: [...A11Y_TAGS],
    views: Object.fromEntries(A11Y_VIEWS.map(k => [k, views[k] || null])),
    keyboard: results, errors,
    automated_accessibility_checks_clear: passed,
    full_wcag_conformance_verified: false,
    assistive_technology_reviewed: false,
    keyboard_navigation_fully_verified: false,
    accessibility_contract_accepted: false,
    deployment_cryptographically_attested: false,
    product_verified: false, verified_complete: false,
    merge_authorized: false, dispatch_authorized: false,
    operator_review_required: true
  };
}
