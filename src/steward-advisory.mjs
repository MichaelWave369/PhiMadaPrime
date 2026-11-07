// Agentora R2 steward advisory import. Static Pages view; no dispatch or login.
import { OWNER } from "./fleet.mjs";

export const STEWARD_ADVISORY_SCHEMA = "agentora.fleet.steward-advisory.v1";
export const MAX_STEWARD_BYTES = 1024 * 1024;
const ROOT_KEYS = ["schema", "owner", "scope", "source", "source_scan_id",
  "observed_at", "stewards", "dispatch_authorized",
  "merge_authorized", "verified_complete"];
const ROW_KEYS = ["github_id", "steward_key", "full_name", "state",
  "planned_count", "last_rotation"];
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

function exact(obj, names) {
  return obj && typeof obj === "object" && !Array.isArray(obj) &&
    Object.keys(obj).length === names.length &&
    Object.keys(obj).every(name => names.includes(name));
}
function positive(n) { return Number.isSafeInteger(n) && n > 0; }
function ageOk(raw, now) {
  if (typeof raw !== "string" || !/(?:Z|[+-]\d\d:\d\d)$/i.test(raw)) return false;
  const time = Date.parse(raw);
  return Number.isFinite(time) && time <= now + 300000 && now - time <= MAX_AGE_MS;
}
function reject() { throw new Error("STEWARD_IMPORT_HELD"); }

export function parseStewardAdvisory(raw, catalog, now = Date.now()) {
  if (typeof raw !== "string" ||
      new TextEncoder().encode(raw).length > MAX_STEWARD_BYTES ||
      !Array.isArray(catalog)) reject();
  let data;
  try { data = JSON.parse(raw); } catch { reject(); }
  if (!exact(data, ROOT_KEYS) || data.schema !== STEWARD_ADVISORY_SCHEMA ||
      data.owner !== OWNER || data.scope !== "public_only" ||
      data.source !== "AGENTORA_LOCAL_STEWARD_LEDGER" ||
      !positive(data.source_scan_id) || !ageOk(data.observed_at, now) ||
      data.dispatch_authorized !== false || data.merge_authorized !== false ||
      data.verified_complete !== false || !Array.isArray(data.stewards) ||
      data.stewards.length > 10000) reject();

  const catalogById = new Map(catalog.filter(item =>
    item && !item.exampleOnly && positive(item.id) && typeof item.full_name === "string"
  ).map(item => [item.id, item]));
  if (!catalogById.size) reject();
  const seen = new Set();
  const stewards = [];
  for (const item of data.stewards) {
    if (!exact(item, ROW_KEYS) || !positive(item.github_id) ||
        seen.has(item.github_id) ||
        item.steward_key !== "steward-gh-" + item.github_id ||
        (item.state !== "AVAILABLE" && item.state !== "PAUSED_ARCHIVED") ||
        !Number.isSafeInteger(item.planned_count) || item.planned_count < 0 ||
        !Number.isSafeInteger(item.last_rotation) || item.last_rotation < 0 ||
        (item.planned_count === 0 && item.last_rotation !== 0) ||
        (item.planned_count > 0 && item.last_rotation === 0)) reject();
    const repo = catalogById.get(item.github_id);
    if (!repo || repo.full_name !== item.full_name ||
        (item.state === "PAUSED_ARCHIVED") !== (repo.archived === true)) reject();
    seen.add(item.github_id);
    stewards.push({ githubId: item.github_id, stewardKey: item.steward_key,
      repoName: repo.name, state: item.state, plannedCount: item.planned_count,
      lastRotation: item.last_rotation });
  }
  return {
    scanId: data.source_scan_id, observedAt: data.observed_at,
    stewardCount: stewards.length,
    available: stewards.filter(x => x.state === "AVAILABLE").length,
    paused: stewards.filter(x => x.state === "PAUSED_ARCHIVED").length,
    stewards,
    status: "LOGICAL_STEWARDS_ONLY_NOT_RUNNING_AGENTS",
    dispatchAuthorized: false,
    mergeAuthorized: false,
  };
}
