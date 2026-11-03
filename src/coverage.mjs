// Read-only coverage ledger from the same GitHub Pages origin.
// Metadata observation is never an executable CI pass or functional verification.
import { OWNER } from "./fleet.mjs";
import { sha256Hex } from "./public-feed.mjs";

const SCHEMA = "phimada.public-coverage.v0.1";
const SOURCE_SHA = "502115508421eb1c98a6c05a79d04a9e432b8b27";
const MAX_BYTES = 2_000_000;
const MAX_AGE = 30 * 3600_000;
const RECENT_AGE = 14 * 86400_000;
const STALE_STATES = new Set(["STALE_AFTER_PUSH", "STALE_BY_AGE"]);
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

function dateMs(value) {
  const t = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : null;
}

function validateManifest(manifest) {
  const file = manifest?.files?.coverage;
  if (manifest?.schema !== "phimada.public-fleet.v0.1" ||
      manifest?.owner !== OWNER || manifest?.scope !== "pilot" ||
      manifest?.public_only !== true || manifest?.merge_authorized !== false ||
      manifest?.job_dispatch_authorized !== false ||
      manifest?.agentora_commit_sha !== SOURCE_SHA ||
      !file || file.path !== "coverage.json" ||
      !SHA64.test(file.sha256) ||
      !Number.isInteger(file.size) || file.size < 1 || file.size > MAX_BYTES) {
    throw new Error("COVERAGE_MANIFEST_UNAVAILABLE");
  }
  return file;
}

function recordState(rec, now) {
  const observed = dateMs(rec.observed_at);
  if (observed === null || observed > now + 300_000) return "NEVER_OBSERVED";
  if (rec.observed_pushed_at !== rec.pushed_at) return "STALE_AFTER_PUSH";
  if (now - observed > RECENT_AGE) return "STALE_BY_AGE";
  if (rec.observation_limitations.length) return "RECENT_LIMITED_OBSERVATION";
  return "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED";
}

export function parsePublicCoverage(source, manifest, rows, now = Date.now()) {
  validateManifest(manifest);
  let data;
  try { data = JSON.parse(source); }
  catch { throw new Error("COVERAGE_INVALID_JSON"); }
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      data.schema !== SCHEMA || data.owner !== OWNER ||
      data.source_commit_sha !== SOURCE_SHA ||
      data.public_only !== true || data.merge_authorized !== false ||
      data.job_dispatch_authorized !== false ||
      data.verified_complete_count !== 0 ||
      !Array.isArray(data.records) || data.records.length > 1500 ||
      data.inventory_count !== data.records.length ||
      data.inventory_count !== manifest.inventory_count ||
      !Number.isInteger(data.cohort_size) || data.cohort_size < 1 ||
      data.cohort_size > 48 || data.cohort_size > data.inventory_count) {
    throw new Error("COVERAGE_SCHEMA_OR_COUNTS_INVALID");
  }
  const at = dateMs(data.generated_utc);
  if (at === null || at > now + 300_000 || now - at > MAX_AGE) {
    throw new Error("COVERAGE_SNAPSHOT_STALE");
  }
  if (data.generated_utc !== manifest.coverage?.generated_utc ||
      manifest.coverage?.cohort_size !== data.cohort_size ||
      manifest.coverage?.observed_ever !== data.observed_ever ||
      manifest.coverage?.recent_clean_observations !== data.recent_clean_observations ||
      manifest.coverage?.never_observed !== data.never_observed) {
    throw new Error("COVERAGE_MANIFEST_PROVENANCE_INVALID");
  }
  const catalog = new Map(rows.filter(r => r && !r.exampleOnly)
    .map(r => [r.full_name.toLowerCase(), r]));
  const seen = new Set(), byRepo = {};
  let declaredEver = 0, declaredRecent = 0, declaredLimited = 0, declaredNever = 0;
  for (const row of data.records) {
    if (!row || typeof row !== "object" || typeof row.repository !== "string" ||
        !row.repository.startsWith(OWNER + "/") ||
        !NAME.test(row.repository.slice(OWNER.length + 1)) ||
        !Number.isSafeInteger(row.repository_id) || row.repository_id < 1 ||
        !Array.isArray(row.observation_limitations) ||
        row.observation_limitations.length > 20) {
      throw new Error("COVERAGE_ROW_INVALID");
    }
    const key = row.repository.toLowerCase();
    if (seen.has(key)) throw new Error("COVERAGE_DUPLICATE");
    seen.add(key);
    const declaredState = recordState(row, at);
    if (declaredState === "NEVER_OBSERVED") declaredNever++;
    else {
      declaredEver++;
      if (declaredState === "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED") declaredRecent++;
      if (declaredState === "RECENT_LIMITED_OBSERVATION") declaredLimited++;
    }
    const known = catalog.get(key);
    if (!known || known.id !== row.repository_id) continue;
    // Compare the publication's pushed_at against the latest public catalog.
    // A repository updated after publishing cannot retain a fresh observation.
    const state = recordState({ ...row, pushed_at: known.pushed_at }, now);
    if (row.head_sha !== null &&
        !(typeof row.head_sha === "string" && SHA40.test(row.head_sha))) {
      throw new Error("COVERAGE_INVALID_HEAD");
    }
    byRepo[known.name] = {
      state, observedAt: row.observed_at,
      sourceSha: row.head_sha,
      ci: typeof row.ci === "string" ? row.ci.slice(0, 100) : "NOT_VERIFIED",
      pages: typeof row.pages === "string" ? row.pages.slice(0, 100) : "NOT_VERIFIED",
      release: typeof row.release === "string" ? row.release.slice(0, 100) : "NOT_VERIFIED",
      limitations: row.observation_limitations.slice(0, 20),
      source: "PUBLIC_COHORT_OBSERVATION_NOT_FUNCTIONAL_PROOF",
      completed: false,
    };
  }
  if (declaredEver !== data.observed_ever ||
      declaredRecent !== data.recent_clean_observations ||
      declaredLimited !== data.recent_limited_observations ||
      declaredNever !== data.never_observed ||
      data.stale_or_changed !== declaredEver - declaredRecent - declaredLimited) {
    throw new Error("COVERAGE_TOTALS_INVALID");
  }
  const totalCurrent = rows.filter(r => r && !r.exampleOnly).length;
  const stats = {
    inventory: totalCurrent,
    observed: Object.values(byRepo).filter(x => x.state !== "NEVER_OBSERVED").length,
    recentClean: Object.values(byRepo).filter(x =>
      x.state === "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED").length,
    recentLimited: Object.values(byRepo).filter(x =>
      x.state === "RECENT_LIMITED_OBSERVATION").length,
    stale: Object.values(byRepo).filter(x => STALE_STATES.has(x.state)).length,
    never: totalCurrent - Object.values(byRepo).filter(x => x.state !== "NEVER_OBSERVED").length,
    cohortScanned: data.cohort_size,
    verifiedComplete: 0,
  };
  return { byRepo, stats, generatedUtc: data.generated_utc,
    scope: "PUBLIC_ROLLING_OBSERVATION", manifestSha: manifest.agentora_commit_sha };
}

export async function fetchPublicCoverage(rows, manifest, fetcher = fetch, options = {}) {
  const file = validateManifest(manifest);
  const response = await fetcher("./fleet/" + file.path, {
    credentials: "omit", cache: "no-store", redirect: "error",
    headers: { Accept: "application/json" }
  });
  if (!response?.ok) throw new Error("COVERAGE_FEED_UNAVAILABLE");
  const len = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(len) && len > MAX_BYTES) throw new Error("COVERAGE_TOO_LARGE");
  const raw = await response.text();
  const bytes = new TextEncoder().encode(raw);
  if (bytes.length > MAX_BYTES || bytes.length !== file.size) {
    throw new Error("COVERAGE_SIZE_MISMATCH");
  }
  const digest = await sha256Hex(raw, options.cryptoApi ?? globalThis.crypto);
  if (digest !== file.sha256) throw new Error("COVERAGE_HASH_MISMATCH");
  return parsePublicCoverage(raw, manifest, rows, options.now ?? Date.now());
}
