// ΦMada R11: read-only mapping of the fixed R0.6 PhiMada pilot to
// the existing local completion contract. This is a *coverage preview*
// of reported automated check outcomes, not independent check certification.
import { CONTRACT_TYPES, CHECK_LABELS } from "./contracts.mjs";

export const PILOT_AUTOMATED_CHECKS = Object.freeze(
  ["production_build", "automated_tests"]
);
const PILOT_REPO = "MichaelWave369/PhiMadaPrime";
const PILOT_REPO_ID = 1443845098;
const SHA40 = /^[a-f0-9]{40}$/;

const AUTOCHECKS = new Set(PILOT_AUTOMATED_CHECKS);

export function pilotCoverage(result, contract) {
  const hasContract = Boolean(contract);
  const selected = hasContract && contract?.repository === PILOT_REPO &&
    contract.repository_id === PILOT_REPO_ID &&
    Array.isArray(contract.checks) &&
    contract.checks.length > 0 &&
    contract.checks.length <= 30 &&
    contract.checks.every(c => typeof c?.id === "string" &&
      Object.hasOwn(CHECK_LABELS, c.id)) &&
    Array.isArray(contract.surface_types) &&
    contract.surface_types.includes("web_app");
  const checks = selected
    ? contract.checks.map(c => c.id)
    : CONTRACT_TYPES.web_app.checks;
  const expectedSha = contract?.source_sha;
  const sourceMatch = selected &&
    typeof expectedSha === "string" && SHA40.test(expectedSha) &&
    expectedSha === result?.sourceSha;
  const correlated = result?.archiveDigestMatched === true &&
    result?.githubRunMatched === true &&
    result?.githubArtifactMatched === true &&
    result?.currentShaMatched === true &&
    result?.status === "GITHUB_ARTIFACT_AND_SOURCE_METADATA_CORRELATED" &&
    typeof result?.sourceSha === "string" && SHA40.test(result.sourceSha) &&
    result?.currentHeadSha === result.sourceSha &&
    result?.productVerified === false &&
    result?.mergeAuthorized === false &&
    result?.completionVerified === false;
  const sourceState = !result ? "NO_PILOT_REVIEW" :
    !correlated ? "PILOT_SOURCE_OR_METADATA_NOT_CURRENT" :
    !hasContract ? "NO_LOCAL_CONTRACT" :
    !selected ? "INCOMPATIBLE_LOCAL_CONTRACT" :
    !sourceMatch ? "CONTRACT_SHA_MISMATCH" : "MATCHING_LOCAL_CONTRACT";
  const canMap = sourceState === "MATCHING_LOCAL_CONTRACT";
  const rows = checks.map(id => ({
    id, label: CHECK_LABELS[id],
    lane: AUTOCHECKS.has(id) ? "FIXED_R06_AUTOMATED" :
      "OTHER_CHECK_REQUIRES_SEPARATE_EVIDENCE",
    status: canMap && AUTOCHECKS.has(id) ?
      "PILOT_EXIT_ZERO_REPORTED_FOR_SHA" :
      AUTOCHECKS.has(id) && correlated && !hasContract ?
        "POTENTIAL_AUTOMATED_COVERAGE_NO_CONTRACT" :
        AUTOCHECKS.has(id) && correlated ?
          "SOURCE_OR_CONTRACT_NOT_ALIGNED" :
          "NOT_COVERED_BY_R06_PILOT",
    independentlyVerified: false, accepted: false
  }));
  return {
    repository: PILOT_REPO,
    sourceSha: result?.sourceSha || null,
    sourceState,
    isPreview: !selected,
    totalChecks: rows.length,
    reportedAutomatedChecks: canMap ?
      rows.filter(r => r.status === "PILOT_EXIT_ZERO_REPORTED_FOR_SHA").length : 0,
    independentlyVerifiedChecks: 0,
    completedChecks: 0,
    productVerified: false,
    mergeAuthorized: false,
    rows
  };
}
