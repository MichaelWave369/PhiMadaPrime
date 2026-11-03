// All uploaded reports are untrusted local, read-only data. Never send them to a server.
import { OWNER } from "./fleet.mjs";
export const MAX_ARTIFACT_BYTES = 8_000_000;
export const AUDIT_SCHEMA = "agentora.fleet.audit.v0.1";
export const PLAN_SCHEMA = "agentora.fleet.plan.v0.2";

function validIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function dateState(time) {
  if (!validIso(time)) return "INVALID_DATE";
  const age = Date.now() - Date.parse(time);
  if (age < -5 * 60_000) return "FUTURE";
  return age > 24 * 60 * 60_000 ? "STALE" : "RECENT";
}
function safeText(value, max = 200) {
  return typeof value === "string" ? value.slice(0, max) : "";
}
function catalogIndex(repos) {
  return new Map(repos.filter(row => !row.exampleOnly)
    .map(row => [row.full_name.toLowerCase(), row]));
}
function publicRepo(catalog, fullName) {
  if (typeof fullName !== "string") return null;
  return catalog.get(fullName.toLowerCase()) || null;
}

export function parseOfficeArtifact(source, catalogRows) {
  if (typeof source !== "string" || source.length > MAX_ARTIFACT_BYTES) {
    throw new Error("ARTIFACT_TOO_LARGE_OR_INVALID");
  }
  let data;
  try { data = JSON.parse(source); }
  catch { throw new Error("ARTIFACT_NOT_JSON"); }
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      data.owner !== OWNER || !validIso(data.generated_utc) ||
      data.merge_authorized !== false || data.job_dispatch_authorized !== false) {
    throw new Error("ARTIFACT_IDENTITY_OR_AUTHORITY_INVALID");
  }
  const catalog = catalogIndex(catalogRows);
  if (!catalog.size) throw new Error("LIVE_CATALOG_REQUIRED");
  const byRepo = {};
  if (data.schema === AUDIT_SCHEMA) {
    if (data.private_included !== false ||
        !Array.isArray(data.repositories) ||
        data.repositories.length > 1000 ||
        data.repository_count !== data.repositories.length) {
      throw new Error("PRIVATE_OR_INCOMPLETE_AUDIT_REJECTED");
    }
    for (const row of data.repositories) {
      if (!row || row.visibility !== "public") throw new Error("PRIVATE_ROW_REJECTED");
      const known = publicRepo(catalog, row.repository);
      // Older public catalog snapshots may omit newly added repos. Never guess.
      if (!known || known.id !== row.repository_id) continue;
      if (!["NOT_AUDITED", "UNVERIFIED"].includes(row.completion)) {
        throw new Error("UNTRUSTED_COMPLETION_CLAIM");
      }
      byRepo[known.name] = {
        type: "audit",
        completion: row.completion,
        head_sha: safeText(row.head_sha, 40),
        ci: safeText(row.ci, 90) || "NOT_VERIFIED",
        pages: safeText(row.pages, 90) || "NOT_VERIFIED",
        release: safeText(row.release, 90) || "NOT_VERIFIED",
        relationships: (Array.isArray(row.relationships) ? row.relationships : [])
          .filter(name => typeof name === "string" && publicRepo(
            catalog, OWNER + "/" + name)).slice(0, 30),
        tasks: (Array.isArray(row.roadmap) ? row.roadmap : [])
          .map(line => safeText(line, 180)).filter(Boolean).slice(0, 15)
      };
    }
    return { type: "audit", generated_utc: data.generated_utc,
      freshness: dateState(data.generated_utc), byRepo,
      note: "Snapshot observations only. No application is certified working." };
  }
  if (data.schema === PLAN_SCHEMA) {
    if (data.public_output !== true ||
        !Array.isArray(data.profiles) || data.profiles.length > 1000 ||
        !Array.isArray(data.tasks) || data.tasks.length > 10000) {
      throw new Error("PRIVATE_OR_INVALID_PLAN_REJECTED");
    }
    for (const profile of data.profiles) {
      if (!profile || typeof profile !== "object") continue;
      const known = publicRepo(catalog, profile.repository);
      if (!known) throw new Error("UNKNOWN_PLAN_REPOSITORY_REJECTED");
      if (profile.completion !== "UNVERIFIED" ||
          profile.operator_review_required !== true) {
        throw new Error("UNTRUSTED_PLAN_CLAIM");
      }
      byRepo[known.name] = {
        type: "plan",
        completion: "UNVERIFIED",
        head_sha: safeText(profile.head_sha, 40),
        surfaces: (Array.isArray(profile.surface_candidates) ?
          profile.surface_candidates : []).map(x => safeText(x, 40)).slice(0, 12),
        tasks: [],
        ci: safeText(profile.observations?.ci, 90) || "NOT_VERIFIED",
        pages: safeText(profile.observations?.pages, 90) || "NOT_VERIFIED",
        release: safeText(profile.observations?.release, 90) || "NOT_VERIFIED",
        relationships: []
      };
    }
    for (const task of data.tasks) {
      if (!task || task.state !== "REVIEW_ONLY_NOT_DISPATCHABLE") {
        throw new Error("DISPATCH_CLAIM_REJECTED");
      }
      const known = publicRepo(catalog, task.repository);
      if (!known || !byRepo[known.name]) throw new Error("UNKNOWN_TASK_REJECTED");
      byRepo[known.name].tasks.push(safeText(task.summary, 180));
    }
    for (const value of Object.values(byRepo)) value.tasks = value.tasks.slice(0, 30);
    return { type: "plan", generated_utc: data.generated_utc,
      freshness: dateState(data.generated_utc), byRepo,
      note: "Review proposals only. No worker dispatch or merge authority." };
  }
  throw new Error("UNSUPPORTED_ARTIFACT_SCHEMA");
}

export function safeTime(value) {
  if (!validIso(value)) return "Unknown";
  return new Date(value).toLocaleString(undefined,
    { year: "numeric", month: "short", day: "numeric", hour: "numeric",
      minute: "2-digit" });
}
