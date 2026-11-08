// Read-only local file import for Agentora R3 reservation status.
import { OWNER } from "./fleet.mjs";

export const LEASE_SCHEMA = "agentora.fleet.steward-lease-observation.v0.3";
export const LEASE_MAX_BYTES = 1024 * 1024;
const ROOT = ["schema","owner","scope","source_scan_id","observed_at",
  "status","reservations","active_reservations","actual_jobs_dispatched",
  "dispatch_authorized","merge_authorized","verified_complete"];
const ROW = ["github_id","repository","state","generation","expires_ms"];
const STATES = new Set(["RESERVED","EXPIRED","RELEASED"]);
function exact(obj, keys) {
  return obj && typeof obj === "object" && !Array.isArray(obj) &&
    Object.keys(obj).length === keys.length &&
    Object.keys(obj).every(k => keys.includes(k));
}
function positive(value) { return Number.isSafeInteger(value) && value > 0; }
function held() { throw new Error("LEASE_OBSERVATION_HELD"); }
function fresh(value, now) {
  if (typeof value !== "string" || !/(?:Z|[+-]\d\d:\d\d)$/i.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= now+300000 && now-time <= 36*3600000;
}
export function parseLeaseObservations(text, catalog, now=Date.now()) {
  if (typeof text !== "string" ||
      new TextEncoder().encode(text).length > LEASE_MAX_BYTES ||
      !Array.isArray(catalog)) held();
  let data;
  try { data = JSON.parse(text); } catch { held(); }
  if (!exact(data,ROOT) || data.schema !== LEASE_SCHEMA ||
      data.owner !== OWNER || data.scope !== "public_only" ||
      data.status !== "LOCAL_RESERVATIONS_NOT_RUNNING_AGENTS" ||
      !positive(data.source_scan_id) || !fresh(data.observed_at,now) ||
      data.dispatch_authorized !== false || data.merge_authorized !== false ||
      data.verified_complete !== false || data.actual_jobs_dispatched !== 0 ||
      !Array.isArray(data.reservations) || data.reservations.length > 10000 ||
      !Number.isSafeInteger(data.active_reservations)) held();
  const byId = new Map(catalog.filter(x => x && !x.exampleOnly &&
    positive(x.id) && x.archived !== true).map(x => [x.id,x]));
  if (!byId.size) held();
  const ids = new Set();
  const reservations = [];
  for (const item of data.reservations) {
    if (!exact(item,ROW) || !positive(item.github_id) ||
        ids.has(item.github_id) || !STATES.has(item.state) ||
        !positive(item.generation) || !positive(item.expires_ms)) held();
    const repo = byId.get(item.github_id);
    if (!repo || repo.full_name !== item.repository) held();
    ids.add(item.github_id);
    const effective = item.state === "RESERVED" && item.expires_ms <= now
      ? "EXPIRED_SINCE_EXPORT" : item.state;
    reservations.push({
      githubId: item.github_id, repoName: repo.name,
      state: effective, generation: item.generation, expiresMs: item.expires_ms,
    });
  }
  if (data.active_reservations !==
      data.reservations.filter(item => item.state === "RESERVED").length) held();
  return {
    scanId: data.source_scan_id, observedAt: data.observed_at,
    exportedActive: data.active_reservations,
    currentlyReserved: reservations.filter(x=>x.state==="RESERVED").length,
    reservations, actualJobsDispatched: 0, mergeAuthorized: false,
    status: "OBSERVED_RESERVATIONS_ONLY_NOT_EXECUTION",
  };
}
