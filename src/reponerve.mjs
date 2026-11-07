// PhiRepoNerve R1: local-file import of Agentora's *public-only* observed fleet.
// No network request to localhost, job dispatch, release certification or API token.
import { OWNER } from "./fleet.mjs";

export const REPONERVE_SCHEMA = "phireponerve.agentora.public-observations.v1";
export const REPONERVE_MAX_BYTES = 1024 * 1024;
const MAX_AGE = 36 * 60 * 60 * 1000;
const EVENT_TYPES = new Set([
  "first_observed", "visible_again", "renamed", "archival_changed",
  "default_branch_changed", "push_activity_observed"
]);
const ROOT_KEYS = [
  "schema", "owner", "scope", "source", "source_scan_id", "observed_at",
  "public_repo_count", "repositories", "recent_events", "source_only",
  "dispatch_authorized", "merge_authorized", "verified_complete"
];
const REPO_KEYS = ["github_id", "full_name", "archived", "source_only", "verified_complete"];
const EVENT_KEYS = ["id", "github_id", "full_name", "event_type", "observed_at"];

function exactKeys(obj, keys) {
  return obj && typeof obj === "object" && !Array.isArray(obj) &&
    Object.keys(obj).length === keys.length &&
    Object.keys(obj).every(key => keys.includes(key));
}
function positiveInt(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function freshDate(value, now) {
  if (typeof value !== "string" || !/[zZ]|[+-]\d\d:\d\d$/.test(value)) return false;
  const n = Date.parse(value);
  return Number.isFinite(n) && n <= now + 300000 && now - n <= MAX_AGE;
}
function reject() {
  throw new Error("REPONERVE_PUBLIC_IMPORT_REJECTED");
}

export function parseRepoNervePublic(raw, catalog, now = Date.now()) {
  if (typeof raw !== "string" ||
      new TextEncoder().encode(raw).length > REPONERVE_MAX_BYTES) reject();
  let data;
  try { data = JSON.parse(raw); } catch { reject(); }
  if (!exactKeys(data, ROOT_KEYS) ||
      data.schema !== REPONERVE_SCHEMA || data.owner !== OWNER ||
      data.scope !== "public_only" || data.source !== "PHIREPONERVE_LOCAL_R1" ||
      !positiveInt(data.source_scan_id) || !freshDate(data.observed_at, now) ||
      data.source_only !== true || data.verified_complete !== false ||
      data.dispatch_authorized !== false || data.merge_authorized !== false ||
      !Array.isArray(data.repositories) || data.repositories.length > 10000 ||
      !Number.isSafeInteger(data.public_repo_count) ||
      data.public_repo_count !== data.repositories.length ||
      !Array.isArray(data.recent_events) || data.recent_events.length > 200 ||
      !Array.isArray(catalog)) reject();

  const live = new Map(catalog.filter(x => x && !x.exampleOnly && positiveInt(x.id))
    .map(x => [x.id, x]));
  if (!live.size) reject();
  const observed = new Map();
  for (const item of data.repositories) {
    if (!exactKeys(item, REPO_KEYS) || !positiveInt(item.github_id) ||
        typeof item.full_name !== "string" ||
        typeof item.archived !== "boolean" || item.source_only !== true ||
        item.verified_complete !== false || observed.has(item.github_id)) reject();
    const expected = live.get(item.github_id);
    if (!expected || expected.full_name !== item.full_name) reject();
    observed.set(item.github_id, {
      id: item.github_id, full_name: expected.full_name, name: expected.name,
      archived: item.archived
    });
  }
  const events = [];
  const ids = new Set();
  for (const event of data.recent_events) {
    if (!exactKeys(event, EVENT_KEYS) || !positiveInt(event.id) ||
        !positiveInt(event.github_id) || ids.has(event.id) ||
        !EVENT_TYPES.has(event.event_type) || !freshDate(event.observed_at, now)) reject();
    const repo = observed.get(event.github_id);
    if (!repo || event.full_name !== repo.full_name) reject();
    ids.add(event.id);
    events.push({
      id: event.id, repo: repo.name, kind: event.event_type,
      observedAt: event.observed_at
    });
  }
  return {
    source: data.source, scanId: data.source_scan_id, observedAt: data.observed_at,
    publicRepoCount: observed.size, eventCount: events.length,
    repositories: [...observed.values()], events,
    status: "OBSERVATIONS_ONLY_NOT_RELEASE_VERIFICATION",
    dispatchAuthorized: false, mergeAuthorized: false,
  };
}
