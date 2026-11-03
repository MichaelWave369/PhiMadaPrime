// R6: deterministic advisory prompts from public metadata observations.
// No prompt is an Agentora job, an approval, or a product-completion finding.
const UNKNOWN = "NOT_VERIFIED";
const WORKFLOW_NOT_FOUND = new Set([
  "NO_RECENT_RUN_AT_HEAD", "NOT_VERIFIED", "NO_WORKFLOW_RUNS_FOUND"
]);
const PAGES_UNKNOWN = new Set([
  "NOT_CONFIGURED_OR_NOT_ACCESSIBLE", "NOT_VERIFIED", "HTTP_404"
]);
const RELEASE_UNKNOWN = new Set([
  "NO_PUBLISHED_RELEASE_FOUND", "NOT_VERIFIED"
]);
const BAD_STATES = new Set([
  "NEVER_OBSERVED", "STALE_AFTER_PUSH", "STALE_BY_AGE",
  "RECENT_LIMITED_OBSERVATION"
]);

export function triageForRecord(repo, record) {
  if (!repo || repo.exampleOnly || !record) return [{
    code: "WAIT_FOR_OBSERVATION", level: "pending", weight: 20,
    title: "Await scheduled public metadata scan",
    why: "No valid rolling observation has been loaded for this repository.",
    action: "Revisit after the next successful cohort publication."
  }];
  const prompts = [];
  const add = (code, level, weight, title, why, action) =>
    prompts.push({ code, level, weight, title, why, action });
  const state = record.state;
  if (state === "NEVER_OBSERVED") {
    add("WAIT_FOR_OBSERVATION", "pending", 20,
      "Await scheduled public metadata scan",
      "The current public cohort ledger has not inspected this repository.",
      "The rolling scanner chooses older/unobserved projects first.");
  } else if (state === "STALE_AFTER_PUSH") {
    add("RECHECK_CHANGED_REPO", "stale", 91,
      "Reinspect changes since the last observation",
      "The repository was pushed after the recorded metadata inspection.",
      "Confirm HEAD and run required project-specific acceptance checks.");
  } else if (state === "STALE_BY_AGE") {
    add("RECHECK_AGED_REPO", "stale", 75,
      "Refresh expired metadata evidence",
      "The recorded observation is older than the freshness window.",
      "Run a fresh observation before relying on any CI or release metadata.");
  } else if (state === "RECENT_LIMITED_OBSERVATION") {
    add("REVIEW_SCAN_LIMITS", "limited", 97,
      "Resolve incomplete metadata observation",
      "The scanner reported API or read limitations.",
      "Inspect scanner limitations and rerun the affected evidence check.");
  } else if (state === "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED") {
    const ci = typeof record.ci === "string" ? record.ci : UNKNOWN;
    const pages = typeof record.pages === "string" ? record.pages : UNKNOWN;
    const release = typeof record.release === "string" ? record.release : UNKNOWN;
    if (WORKFLOW_NOT_FOUND.has(ci)) {
      add("CHECK_CI_EXPECTATION", "review", 88,
        "Determine whether automated CI should be required",
        "No recent successful exact-head workflow is established by this scan.",
        "Review the project's build/test acceptance contract and CI configuration.");
    } else if (/FAIL|ERROR|RED|HELD|CANCEL|TIMEOUT/.test(ci) &&
               !/NOT_BUILD_PROOF/.test(ci)) {
      add("REVIEW_CI_ISSUE", "review", 99,
        "Investigate the observed CI issue",
        "The API observation may describe an unsuccessful workflow.",
        "Open the exact run and diagnose the failing step; do not merge on this hint.");
    }
    if (PAGES_UNKNOWN.has(pages)) {
      add("REVIEW_DEPLOYMENT_NEED", "optional", 60,
        "Decide whether this repository requires a public website",
        "GitHub Pages was not proven accessible in the observation.",
        "If this is a web project, verify the intended deployment and browser smoke. Libraries and research projects may not need Pages.");
    } else if (pages === "HTML_REACHABLE_NOT_RUNTIME_VERIFIED") {
      add("VERIFY_WEB_RUNTIME", "review", 80,
        "Smoke-test the live site in a real browser",
        "A reachable HTML response does not prove the React app, UI or game works.",
        "Verify interactive use, asset loading and expected user journeys.");
    }
    if (RELEASE_UNKNOWN.has(release)) {
      add("REVIEW_RELEASE_EXPECTATION", "optional", 54,
        "Decide whether a GitHub release is needed",
        "No functional distributable is established by release metadata.",
        "If users install the product, build/install/run a versioned artifact. Web-only and research projects may not require a release.");
    } else if (release === "PUBLISHED_METADATA_NOT_FUNCTIONALITY_VERIFIED") {
      add("VERIFY_RELEASE_RUNTIME", "review", 73,
        "Verify published artifact actually works",
        "The existence of a release entry is not installation or runtime acceptance.",
        "Test a clean install, launch, smoke and rollback appropriate to the product.");
    }
  } else {
    add("CLASSIFICATION_REQUIRED", "review", 100,
      "Review unknown evidence state", "The current record has an unsupported state.",
      "Confirm the public scanner contract before interpreting this record.");
  }
  return prompts.sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code));
}

export function triageOverview(coverage, rows) {
  if (!coverage || !Array.isArray(rows)) return [];
  const all = [];
  for (const repo of rows) {
    if (!repo || repo.exampleOnly) continue;
    const record = coverage.byRepo[repo.name];
    for (const prompt of triageForRecord(repo, record)) {
      all.push({
        ...prompt, repository: repo.full_name,
        repoName: repo.name, repoId: repo.id,
        observationState: record?.state || "NEVER_OBSERVED",
        observedAt: record?.observedAt || null,
        advisoryOnly: true, dispatchable: false, verifiedComplete: false,
        source: "PUBLIC_COHORT_METADATA_HINT_NOT_AGENTORA_PLAN"
      });
    }
  }
  return all.sort((a, b) =>
    b.weight - a.weight || a.repoName.localeCompare(b.repoName, "en",
      { sensitivity: "base" }) || a.code.localeCompare(b.code));
}

export function triageSummary(items) {
  return {
    prompts: items.length,
    affectedRepositories: new Set(items.map(x => x.repoId)).size,
    awaitingScan: items.filter(x => x.code === "WAIT_FOR_OBSERVATION").length,
    staleOrLimited: items.filter(x => x.level === "stale" || x.level === "limited").length,
    verifiedComplete: 0, dispatched: 0,
  };
}
