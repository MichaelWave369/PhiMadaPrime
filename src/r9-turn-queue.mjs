import { TURN_REPO, TURN_REPO_ID } from "./autonomous-turn.mjs";

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const POSITIVE = n => Number.isSafeInteger(n) && n > 0;
const STATES = new Set([
  "REQUESTED", "SUBMISSION_UNCERTAIN", "DISPATCHED", "OWNER_REVIEW",
  "AUTHORIZED", "RUNNING", "PUBLISHED", "CI_PENDING", "CI_PASSED", "MERGED",
  "HELD", "ARCHIVED",
]);
const JOBS = new Set(["plan", "owner-authorization", "attempt-0 / worker",
  "attempt-0 / publish", "attempt-0 / observe", "merge-gate"]);
const FIELDS = [
  "mission_id", "repository", "github_id", "source_sha", "task_sha256", "updated_ms",
  "source_event_id", "source_scan_id", "source_payload_digest", "expires_utc",
  "state", "run_id", "pr_number", "tested_sha", "merge_sha", "reason",
  "active_job", "ci_status", "ci_runs",
];

export const SNAPSHOT_LIMIT = 80_000;

export function parseTurnQueue(text) {
  if (text.length > SNAPSHOT_LIMIT) throw Error("Queue snapshot is too large.");
  const value = JSON.parse(text);
  const refuse = () => { throw Error("Queue snapshot has an invalid shape."); };
  if (Object.keys(value || {}).length !== 4 || value.schema !== "agentora.fleet.r9-r1-turns.v1" ||
      typeof value.generated_utc !== "string" || !Number.isFinite(Date.parse(value.generated_utc)) ||
      typeof value.truncated !== "boolean" || !Array.isArray(value.turns) || value.turns.length > 30) refuse();
  const seen = new Set();
  for (const row of value.turns) {
    if (!row || Object.keys(row).length !== FIELDS.length ||
        !FIELDS.every(key => Object.hasOwn(row, key)) ||
        row.repository !== TURN_REPO || row.github_id !== TURN_REPO_ID ||
        !POSITIVE(row.source_event_id) || !POSITIVE(row.source_scan_id) ||
        row.mission_id !== `r10-e${row.source_event_id}-gh${TURN_REPO_ID}` ||
        seen.has(row.mission_id) || !SHA.test(row.source_sha || "") ||
        !DIGEST.test(row.task_sha256 || "") || !DIGEST.test(row.source_payload_digest || "") ||
        !POSITIVE(row.updated_ms) || typeof row.expires_utc !== "string" ||
        !Number.isFinite(Date.parse(row.expires_utc)) || !STATES.has(row.state) ||
        !(row.run_id === null || POSITIVE(row.run_id)) ||
        !(row.pr_number === null || (POSITIVE(row.pr_number) && row.run_id)) ||
        !(row.tested_sha === null || (SHA.test(row.tested_sha) && row.pr_number)) ||
        !(row.merge_sha === null || (SHA.test(row.merge_sha) && row.state === "MERGED")) ||
        !(row.reason === null || (typeof row.reason === "string" && /^[A-Z0-9_]{1,100}$/.test(row.reason))) ||
        !(row.active_job === null || JOBS.has(row.active_job)) ||
        !["NOT_OBSERVED", "PENDING", "FAILED", "PASSED"].includes(row.ci_status) ||
        !Array.isArray(row.ci_runs) || row.ci_runs.length > 20 ||
        !row.ci_runs.every(POSITIVE)) refuse();
    if (row.state === "MERGED" && !(row.merge_sha && row.tested_sha && row.ci_status === "PASSED")) refuse();
    seen.add(row.mission_id);
  }
  return value;
}

export function nextTurnAction(row) {
  if (row.state === "OWNER_REVIEW") return "Inspect the frozen GitHub task and approve its exact digest.";
  if (row.state === "HELD" || row.state === "SUBMISSION_UNCERTAIN") {
    const actions = {
      AGENTORA_R1_DISPATCH_TOKEN_REQUIRED: "Configure the Agentora-only dispatch token and retry preflight.",
      OWNER_REVIEW_WINDOW_EXPIRED: "Inspect the original run and prepare a fresh current-source task.",
      RECONCILE_BEFORE_ANY_NEW_REQUEST: "Find the original Actions run and reconcile its frozen plan.",
      R1_SUBMISSION_NEEDS_ORIGINAL_RUN_REVIEW: "Match the original Actions run to this task digest before proceeding.",
      R1_FINISHED_WITHOUT_ALL_REQUIRED_CI: "Inspect the exact-head CI and the original observer receipt.",
      R1_CI_PASSED_MERGE_UNCONFIRMED: "Inspect the merge gate and GitHub PR before closing this mission.",
      SOURCE_DRIFT: "Inspect the latest Agentora main and prepare a new task.",
    };
    return actions[row.reason] || "Inspect the linked GitHub run and resolve the hold in Agentora.";
  }
  if (row.state === "MERGED") return "Review the outstanding acceptance on the returned GitHub receipt.";
  if (row.state === "REQUESTED") return "Waiting for the R9 dispatcher.";
  if (row.state === "ARCHIVED") return "Archived after reconciliation.";
  return "Agentora will reconcile the next GitHub result.";
}

export function parseReadinessProfiles(text) {
  if (text.length > SNAPSHOT_LIMIT) throw Error("Readiness profiles are too large.");
  const value = JSON.parse(text);
  if (value?.schema_version !== "phios.fleet_readiness.v1" || value.owner !== "MichaelWave369" ||
      !Array.isArray(value.profiles) || value.profiles.length > 50) throw Error("Invalid readiness profiles.");
  return value.profiles.map(row => {
    if (!/^MichaelWave369\/[A-Za-z0-9_.-]{1,100}$/.test(row?.repository || "") ||
        !POSITIVE(row.repository_id) || !SHA.test(row.source_sha || "") ||
        !["application","library","service","research","documentation"].includes(row.kind) ||
        !["staging_only","out_of_scope"].includes(row.integration?.status) ||
        !["held","not_requested"].includes(row.distribution) ||
        !Array.isArray(row.human_acceptance) || row.human_acceptance.length > 12 ||
        !row.human_acceptance.every(v => typeof v === "string" && v.length <= 240)) {
      throw Error("Invalid readiness profile.");
    }
    return { repository: row.repository, source: row.source_sha, kind: row.kind,
      integration: row.integration.status, distribution: row.distribution, acceptance: row.human_acceptance };
  });
}
