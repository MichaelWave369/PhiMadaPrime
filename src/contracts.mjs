// R7: local-only completion contracts. Operator notes are NOT independent evidence.
// No merge, dispatch, sign-off, final acceptance, or product-completion authority.
import { OWNER } from "./fleet.mjs";

export const CONTRACT_SCHEMA = "phimada.local-completion-contract.v0.7";
export const MAX_CONTRACT_FILE_BYTES = 3_000_000;
const HEX40 = /^[a-f0-9]{40}$/;
const VALID_NAME = /^[A-Za-z0-9_.-]{1,100}$/;

export const CONTRACT_TYPES = Object.freeze({
  web_app: {
    label: "Web app / React",
    checks: ["production_build", "automated_tests", "browser_interaction",
      "accessibility", "deployed_revision"]
  },
  webxr: {
    label: "VR / WebXR",
    checks: ["production_build", "automated_tests", "browser_interaction",
      "headset_input", "comfort_acceptance"]
  },
  static_site: {
    label: "Static site",
    checks: ["asset_validation", "navigation", "accessibility", "deployed_revision"]
  },
  python_package: {
    label: "Python package",
    checks: ["package_build", "automated_tests", "clean_install_import", "versioned_artifact"]
  },
  node_service: {
    label: "Node service / API",
    checks: ["production_build", "automated_tests", "api_smoke", "recovery_rollback"]
  },
  android: {
    label: "Android application",
    checks: ["installable_apk", "automated_tests", "device_smoke", "recovery_rollback"]
  },
  desktop: {
    label: "Desktop application",
    checks: ["native_build", "automated_tests", "clean_install_launch", "recovery_rollback"]
  },
  os_image: {
    label: "OS image",
    checks: ["reproducible_image", "vm_boot", "recovery_rollback", "hardware_acceptance"]
  },
  research: {
    label: "Research",
    checks: ["methodology", "reproducible_results", "negative_controls", "limitations_review"]
  },
  manual_review: {
    label: "Unclassified / human scoping",
    checks: ["scope_and_surface_classification"]
  }
});

export const CHECK_LABELS = Object.freeze({
  production_build: "Production build succeeds at the stated revision",
  automated_tests: "Required automated checks are recorded",
  browser_interaction: "Browser smoke verifies key user journeys",
  accessibility: "Keyboard and accessibility checks reviewed",
  deployed_revision: "Production site matches documented source revision",
  headset_input: "Supported headset controls tested in hardware",
  comfort_acceptance: "VR comfort and calibration tested on device",
  asset_validation: "Generated HTML and assets validate",
  navigation: "Navigation, links and page paths smoke-tested",
  package_build: "Reproducible distributable package produced",
  clean_install_import: "Clean installation and import/CLI work",
  versioned_artifact: "Versioned distributable artifact tested",
  api_smoke: "Service starts and responds to documented API smoke",
  recovery_rollback: "Failure/recovery/rollback path tested",
  installable_apk: "APK is installable on supported Android target",
  device_smoke: "Emulator or device interaction smoke completed",
  native_build: "Native release build produced",
  clean_install_launch: "Clean install, launch and shutdown tested",
  reproducible_image: "Reproducible bootable OS image built",
  vm_boot: "Virtual-machine boot and use case verified",
  hardware_acceptance: "Supported physical hardware acceptance recorded",
  methodology: "Method and preregistration/reproduction scope documented",
  reproducible_results: "Results reproduced from published inputs",
  negative_controls: "Failure cases and negative controls included",
  limitations_review: "Limitations and falsifiability independently reviewed",
  scope_and_surface_classification: "Human confirms project purpose and target platforms"
});

function validRepo(repo) {
  if (!repo || repo.exampleOnly ||
      !Number.isSafeInteger(repo.id) || repo.id <= 0 ||
      typeof repo.name !== "string" || !VALID_NAME.test(repo.name) ||
      repo.name === "." || repo.name === ".." ||
      repo.full_name?.toLowerCase() !==
        (OWNER + "/" + repo.name).toLowerCase()) {
    throw new Error("PUBLIC_REPO_REQUIRED");
  }
  return repo;
}
function validSha(value) {
  return value === null || (typeof value === "string" && HEX40.test(value));
}
function checksFor(types) {
  return [...new Set(types.flatMap(t => CONTRACT_TYPES[t].checks))];
}
export function selectSurfaces(types) {
  if (!Array.isArray(types) || types.length < 1 || types.length > 10 ||
      types.some(t => typeof t !== "string" || !(t in CONTRACT_TYPES)) ||
      new Set(types).size !== types.length) {
    throw new Error("CONTRACT_TYPES_INVALID");
  }
  return types;
}
export function newContract(repo, types, sourceSha = null, clock = () => new Date()) {
  validRepo(repo);
  selectSurfaces(types);
  if (!validSha(sourceSha)) throw new Error("CONTRACT_SHA_INVALID");
  const at = clock().toISOString();
  return {
    repository: repo.full_name,
    repository_id: repo.id,
    source_sha: sourceSha,
    surface_types: [...types],
    checks: checksFor(types).map(id => ({
      id, locally_reviewed: false, note: ""
    })),
    created_utc: at, updated_utc: at,
    operator_only: true, independently_verified: false, certified_complete: false,
    merge_authorized: false, job_dispatch_authorized: false
  };
}
export function updateContract(contract, checkId, patch, clock = () => new Date()) {
  if (!contract?.checks?.some(item => item.id === checkId)) {
    throw new Error("CONTRACT_CHECK_UNKNOWN");
  }
  if (!patch || typeof patch !== "object" ||
      Object.keys(patch).some(key => !["locally_reviewed", "note"].includes(key))) {
    throw new Error("CONTRACT_PATCH_INVALID");
  }
  const newCheck = original => {
    if (original.id !== checkId) return original;
    const note = patch.note === undefined ? original.note : patch.note;
    const locallyReviewed = patch.locally_reviewed === undefined ?
      original.locally_reviewed : patch.locally_reviewed;
    if (typeof note !== "string" || note.length > 500 ||
        typeof locallyReviewed !== "boolean") {
      throw new Error("CONTRACT_CHECK_VALUE_INVALID");
    }
    return { id: original.id, locally_reviewed: locallyReviewed, note };
  };
  return { ...contract, checks: contract.checks.map(newCheck),
    updated_utc: clock().toISOString() };
}
export function rebaseContract(contract, newSha, clock = () => new Date()) {
  if (!validSha(newSha)) throw new Error("CONTRACT_SHA_INVALID");
  return { ...contract, source_sha: newSha, updated_utc: clock().toISOString(),
    // Re-basing invalidates any prior local review flags.
    checks: contract.checks.map(item => ({ ...item, locally_reviewed: false })) };
}

export function observedSourceSha(signal, cohort, planProfile) {
  if (signal?.headSha && /^[a-f0-9]{40}$/.test(signal.headSha) &&
      typeof signal.observedAt === "string" &&
      Number.isFinite(Date.parse(signal.observedAt)) &&
      Date.now() - Date.parse(signal.observedAt) <= 15 * 60_000 &&
      Date.parse(signal.observedAt) <= Date.now() + 300_000) {
    return signal.headSha;
  }
  if (cohort?.state === "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED" &&
      typeof cohort.sourceSha === "string" && HEX40.test(cohort.sourceSha)) {
    return cohort.sourceSha;
  }
  if (planProfile?.completion === "UNVERIFIED" &&
      typeof planProfile.head_sha === "string" && HEX40.test(planProfile.head_sha)) {
    // Plan input is source metadata, not proof that the branch remains there.
    return planProfile.head_sha;
  }
  return null;
}

export function contractProgress(contract, currentSha) {
  const checks = contract?.checks || [];
  const reviewed = checks.filter(x => x.locally_reviewed === true).length;
  const changed = currentSha && contract?.source_sha &&
    currentSha !== contract.source_sha;
  const noHead = !contract?.source_sha || !currentSha;
  return {
    checks: checks.length, locallyReviewed: reviewed,
    sourceState: changed ? "SOURCE_CHANGED" :
      noHead ? "HEAD_NOT_CONFIRMED" : "OBSERVED_SHA_MATCH",
    evidenceVerified: 0, certifiedComplete: false, dispatchable: false
  };
}

function validateContract(contract, catalog) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    throw new Error("CONTRACT_INVALID");
  }
  const repo = catalog.get(String(contract.repository_id));
  if (!repo || repo.full_name !== contract.repository) {
    throw new Error("CONTRACT_PUBLIC_REPO_MISMATCH");
  }
  if (!validSha(contract.source_sha)) throw new Error("CONTRACT_SHA_INVALID");
  const types = selectSurfaces(contract.surface_types);
  const expected = checksFor(types);
  if (!Array.isArray(contract.checks) || contract.checks.length !== expected.length ||
      !expected.every((id, index) => contract.checks[index]?.id === id)) {
    throw new Error("CONTRACT_CHECKS_INVALID");
  }
  for (const check of contract.checks) {
    if (typeof check.locally_reviewed !== "boolean" ||
        typeof check.note !== "string" || check.note.length > 500) {
      throw new Error("CONTRACT_CHECK_VALUE_INVALID");
    }
  }
  if (contract.operator_only !== true ||
      contract.independently_verified !== false ||
      contract.certified_complete !== false ||
      contract.merge_authorized !== false ||
      contract.job_dispatch_authorized !== false) {
    throw new Error("CONTRACT_AUTHORITY_REJECTED");
  }
  for (const key of ["created_utc", "updated_utc"]) {
    if (typeof contract[key] !== "string" || !Number.isFinite(Date.parse(contract[key]))) {
      throw new Error("CONTRACT_DATE_INVALID");
    }
  }
  return contract;
}
export function serializeContracts(contracts, rows, clock = () => new Date()) {
  const catalog = new Map(rows.filter(r => !r.exampleOnly).map(r => [String(r.id), r]));
  const items = Object.values(contracts).sort((a, b) =>
    a.repository.localeCompare(b.repository));
  if (items.length > 1500) throw new Error("CONTRACTS_TOO_MANY");
  for (const contract of items) validateContract(contract, catalog);
  const bundle = {
    schema: CONTRACT_SCHEMA, owner: OWNER, generated_utc: clock().toISOString(),
    public_catalog_only: true, local_operator_notes_only: true,
    independently_verified: false, certified_complete_count: 0,
    merge_authorized: false, job_dispatch_authorized: false,
    contracts: items
  };
  const raw = JSON.stringify(bundle, null, 2) + "\n";
  if (new TextEncoder().encode(raw).length > MAX_CONTRACT_FILE_BYTES) {
    throw new Error("CONTRACT_FILE_TOO_LARGE");
  }
  return raw;
}
export function parseContracts(source, rows) {
  if (typeof source !== "string" ||
      new TextEncoder().encode(source).length > MAX_CONTRACT_FILE_BYTES) {
    throw new Error("CONTRACT_FILE_TOO_LARGE");
  }
  let bundle;
  try { bundle = JSON.parse(source); } catch { throw new Error("CONTRACT_JSON_INVALID"); }
  if (!bundle || Array.isArray(bundle) || bundle.schema !== CONTRACT_SCHEMA ||
      bundle.owner !== OWNER || bundle.public_catalog_only !== true ||
      bundle.local_operator_notes_only !== true ||
      bundle.independently_verified !== false ||
      bundle.certified_complete_count !== 0 ||
      bundle.merge_authorized !== false ||
      bundle.job_dispatch_authorized !== false ||
      !Array.isArray(bundle.contracts) || bundle.contracts.length > 1500) {
    throw new Error("CONTRACT_BUNDLE_INVALID");
  }
  const catalog = new Map(rows.filter(r => !r.exampleOnly).map(r => [String(r.id), r]));
  const byId = {};
  for (const contract of bundle.contracts) {
    validateContract(contract, catalog);
    if (Object.hasOwn(byId, contract.repository_id)) throw new Error("CONTRACT_DUPLICATE_REPO");
    byId[contract.repository_id] = contract;
  }
  return byId;
}
