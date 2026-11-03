// Load public, publication-gated Agentora observations from the same-origin Pages site.
// No tokens, private repositories, cross-origin calls, execution or merge permissions.
import { parseOfficeArtifact, MAX_ARTIFACT_BYTES } from "./audit.mjs";
import { OWNER } from "./fleet.mjs";

const SCHEMA = "phimada.public-fleet.v0.1";
const HEX64 = /^[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const MAX_MANIFEST = 32_000;
const MAX_AUTO_AGE_MS = 30 * 60 * 60 * 1000;

async function getText(fetcher, path, maxSize) {
  const response = await fetcher(path, {
    cache: "no-store", headers: { Accept: "application/json" },
    credentials: "omit", redirect: "error"
  });
  if (!response?.ok) throw new Error("PUBLIC_FEED_UNAVAILABLE");
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxSize) {
    throw new Error("PUBLIC_FEED_TOO_LARGE");
  }
  const value = await response.text();
  if (typeof value !== "string" || value.length > maxSize) {
    throw new Error("PUBLIC_FEED_TOO_LARGE");
  }
  return value;
}

function manifestFile(value, expected) {
  if (!value || typeof value !== "object" ||
      value.path !== expected || !HEX64.test(value.sha256) ||
      !Number.isInteger(value.size) || value.size < 1 || value.size > MAX_ARTIFACT_BYTES) {
    throw new Error("PUBLIC_FEED_MANIFEST_INVALID");
  }
}

export function validatePublicManifest(manifest, now = Date.now()) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      manifest.schema !== SCHEMA || manifest.owner !== OWNER ||
      manifest.scope !== "pilot" || manifest.public_only !== true ||
      manifest.status !== "OBSERVATIONS_ONLY_NOT_PRODUCT_VERIFICATION" ||
      manifest.merge_authorized !== false || manifest.job_dispatch_authorized !== false ||
      manifest.verified_complete_count !== 0 || !HEX40.test(manifest.agentora_commit_sha || "") ||
      !Number.isInteger(manifest.inventory_count) || manifest.inventory_count < 1 ||
      !Number.isInteger(manifest.deep_audited_count) || manifest.deep_audited_count < 1 ||
      !Number.isInteger(manifest.review_only_tasks) || manifest.review_only_tasks < 0) {
    throw new Error("PUBLIC_FEED_MANIFEST_INVALID");
  }
  const created = Date.parse(manifest.generated_utc);
  if (!Number.isFinite(created) || created > now + 300_000 ||
      now - created > MAX_AUTO_AGE_MS) {
    throw new Error("PUBLIC_FEED_STALE");
  }
  manifestFile(manifest.files?.audit, "fleet-audit.json");
  manifestFile(manifest.files?.plan, "fleet-plan.json");
  return manifest;
}

export async function sha256Hex(text, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle?.digest) throw new Error("PUBLIC_FEED_INTEGRITY_UNAVAILABLE");
  const data = new TextEncoder().encode(text);
  const hash = await cryptoApi.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function fetchPublicSnapshot(rows, fetcher = fetch, options = {}) {
  if (!Array.isArray(rows) || !rows.some(row => row && !row.exampleOnly)) {
    throw new Error("PUBLIC_CATALOG_REQUIRED");
  }
  const base = "./fleet/";
  const now = options.now ?? Date.now();
  const manifest = validatePublicManifest(JSON.parse(
    await getText(fetcher, base + "manifest.json", MAX_MANIFEST)), now);
  const [auditRaw, planRaw] = await Promise.all([
    getText(fetcher, base + "fleet-audit.json", MAX_ARTIFACT_BYTES),
    getText(fetcher, base + "fleet-plan.json", MAX_ARTIFACT_BYTES)
  ]);
  const api = options.cryptoApi ?? globalThis.crypto;
  const [auditDigest, planDigest] = await Promise.all([
    sha256Hex(auditRaw, api), sha256Hex(planRaw, api)
  ]);
  if (auditDigest !== manifest.files.audit.sha256 ||
      planDigest !== manifest.files.plan.sha256 ||
      new TextEncoder().encode(auditRaw).length !== manifest.files.audit.size ||
      new TextEncoder().encode(planRaw).length !== manifest.files.plan.size) {
    throw new Error("PUBLIC_FEED_INTEGRITY_MISMATCH");
  }
  const auditData = JSON.parse(auditRaw), planData = JSON.parse(planRaw);
  if (auditData.generated_utc !== planData.source_audit_utc ||
      manifest.generated_utc !== planData.generated_utc ||
      auditData.repository_count !== manifest.inventory_count ||
      planData.inventory_count !== manifest.inventory_count ||
      auditData.deep_audited_count !== manifest.deep_audited_count ||
      planData.deep_audited_count !== manifest.deep_audited_count ||
      planData.tasks?.length !== manifest.review_only_tasks ||
      planData.verified_complete_count !== 0) {
    throw new Error("PUBLIC_FEED_PROVENANCE_MISMATCH");
  }
  const audit = parseOfficeArtifact(auditRaw, rows);
  const plan = parseOfficeArtifact(planRaw, rows);
  if (audit.type !== "audit" || plan.type !== "plan") {
    throw new Error("PUBLIC_FEED_UNEXPECTED_SCHEMA");
  }
  return {
    manifest, audit: { ...audit, source: "PUBLIC_PAGES_PILOT" },
    plan: { ...plan, source: "PUBLIC_PAGES_PILOT" }
  };
}
