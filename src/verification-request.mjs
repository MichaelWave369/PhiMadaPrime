// PhiMada R8 -> Agentora Fleet R0.3: verification REQUEST, not a result.
// Strictly local file export. No notes, secrets, authorization, or network writes.
import { OWNER } from "./fleet.mjs";
import { CONTRACT_TYPES } from "./contracts.mjs";

export const VERIFY_REQUEST_SCHEMA = "phimada.verification-request.v0.8";
export const MAX_VERIFY_REQUEST_BYTES = 65536;
const HEX40 = /^[a-f0-9]{40}$/;
const MAX_OBSERVATION_AGE_MS = 15 * 60 * 1000;

function expectedChecks(types) {
  const result = [], seen = new Set();
  for (const type of types) {
    const config = CONTRACT_TYPES[type];
    if (!config || seen.has(type)) return null;
    seen.add(type);
    for (const id of config.checks) if (!result.includes(id)) result.push(id);
  }
  return result;
}

export function prepareVerificationRequest(repo, contract, signal, now = Date.now()) {
  if (!repo || repo.exampleOnly ||
      !Number.isSafeInteger(repo.id) || repo.id <= 0 ||
      repo.full_name !== OWNER + "/" + repo.name ||
      !/^[A-Za-z0-9_.-]{1,100}$/.test(repo.name)) {
    throw new Error("REQUEST_PUBLIC_REPOSITORY_REQUIRED");
  }
  if (!contract || contract.repository !== repo.full_name ||
      contract.repository_id !== repo.id ||
      !Array.isArray(contract.surface_types) || !contract.surface_types.length ||
      contract.surface_types.length > 10 ||
      !Array.isArray(contract.checks) || !HEX40.test(contract.source_sha || "") ||
      contract.operator_only !== true ||
      contract.independently_verified !== false ||
      contract.certified_complete !== false ||
      contract.merge_authorized !== false ||
      contract.job_dispatch_authorized !== false) {
    throw new Error("REQUEST_CONTRACT_INVALID");
  }
  const required = expectedChecks(contract.surface_types);
  if (!required || required.length !== contract.checks.length ||
      required.some((id, index) => {
        const item = contract.checks[index];
        return item?.id !== id || typeof item.locally_reviewed !== "boolean";
      })) {
    throw new Error("REQUEST_CHECKS_INVALID");
  }
  if (!signal || signal.from !== "LIVE_PUBLIC_GITHUB_API_READ_ONLY" ||
      signal.repository !== repo.full_name || signal.repositoryId !== repo.id ||
      signal.headSha !== contract.source_sha ||
      !HEX40.test(signal.headSha || "") ||
      signal.functionallyVerified !== false || signal.mergeAuthorized !== false ||
      typeof signal.defaultBranch !== "string" ||
      !/^[A-Za-z0-9_.\/-]{1,128}$/.test(signal.defaultBranch)) {
    throw new Error("REQUEST_FRESH_HEAD_REQUIRED");
  }
  const observed = Date.parse(signal.observedAt);
  if (!Number.isFinite(observed) || observed > now + 5 * 60_000 ||
      observed < now - MAX_OBSERVATION_AGE_MS) {
    throw new Error("REQUEST_FRESH_HEAD_REQUIRED");
  }
  const request = {
    schema: VERIFY_REQUEST_SCHEMA,
    owner: OWNER,
    repository: repo.full_name,
    repository_id: repo.id,
    default_branch: signal.defaultBranch,
    source_sha: signal.headSha,
    source_observed_utc: signal.observedAt,
    prepared_utc: new Date(now).toISOString(),
    surface_types: [...contract.surface_types],
    required_checks: contract.checks.map(({ id, locally_reviewed }) =>
      ({ id, locally_reviewed })),
    operator_notes_included: false,
    operator_review_required: true,
    independent_verification: "NOT_RUN",
    execution_state: "NOT_DISPATCHED",
    approved_for_execution: false,
    merge_authorized: false,
    job_dispatch_authorized: false
  };
  const raw = JSON.stringify(request, null, 2) + "\n";
  if (new TextEncoder().encode(raw).length > MAX_VERIFY_REQUEST_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  return raw;
}

export function verificationHandoffMessage(error) {
  const code = error?.message;
  switch (code) {
    case "REQUEST_FRESH_HEAD_REQUIRED":
      return "Inspect live GitHub CI/PR signals on this desk, then rebind the contract if HEAD changed. Only a matching HEAD observed within 15 minutes can be handed off.";
    case "REQUEST_CONTRACT_INVALID":
    case "REQUEST_CHECKS_INVALID":
      return "The contract is invalid or changed. Recreate the local contract before preparing an intake request.";
    case "REQUEST_PUBLIC_REPOSITORY_REQUIRED":
      return "Only live public catalog repositories can create an Agentora verification request.";
    default:
      return "The verification request was not prepared. No request was sent or job dispatched.";
  }
}
