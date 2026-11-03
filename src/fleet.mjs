// PhiMada Prime: public-only fleet catalog and deterministic twelve-desk floors.
export const OWNER = "MichaelWave369";
export const DESKS_PER_FLOOR = 12;
export const MAX_API_PAGES = 15;
export const FLAGSHIPS = [
  "Agentora", "PhiOS", "BTM", "FieldConstellation", "PhiServe",
  "SuperPhiVessel", "PaperGhost", "Blackout", "RacetoOblivion",
  "Domistika", "SparkTheSubstrate", "PhiOperator"
];
export const KNOWN_EXAMPLES = FLAGSHIPS.map((name, index) => ({
  id: -index - 1, name, full_name: OWNER + "/" + name,
  html_url: "https://github.com/" + OWNER + "/" + name,
  description: "Catalog example; live verification not available.",
  archived: false, language: null, pushed_at: null, homepage: "",
  exampleOnly: true
}));
const VALID_NAME = /^[a-z0-9_.-]{1,100}$/i;

export function normalizeRepo(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = raw.name;
  if (typeof name !== "string" || !VALID_NAME.test(name) ||
      name === "." || name === ".." ||
      raw.owner?.login?.toLowerCase() !== OWNER.toLowerCase() ||
      raw.private !== false || !Number.isSafeInteger(raw.id) || raw.id <= 0) return null;
  const canonical = OWNER + "/" + name;
  if (typeof raw.full_name !== "string" ||
      raw.full_name.toLowerCase() !== canonical.toLowerCase()) return null;
  return {
    id: raw.id, name, full_name: canonical,
    html_url: "https://github.com/" + canonical,
    description: typeof raw.description === "string" ? raw.description.slice(0, 400) : "",
    archived: raw.archived === true,
    language: typeof raw.language === "string" ? raw.language.slice(0, 40) : null,
    pushed_at: typeof raw.pushed_at === "string" ? raw.pushed_at : null,
    homepage: safeExternalSite(raw.homepage),
    exampleOnly: false
  };
}

export function safeExternalSite(value) {
  if (typeof value !== "string" || value.length > 500) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export function orderFleet(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row && typeof row.name === "string" && !map.has(row.id)) map.set(row.id, row);
  }
  const ranking = new Map(FLAGSHIPS.map((name, index) => [name.toLowerCase(), index]));
  return [...map.values()].sort((a, b) => {
    const aRank = ranking.get(a.name.toLowerCase()) ?? 10000;
    const bRank = ranking.get(b.name.toLowerCase()) ?? 10000;
    return aRank - bRank || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

export async function fetchPublicFleet(fetcher = fetch, maxPages = MAX_API_PAGES) {
  const rows = [];
  const ids = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const endpoint = "https://api.github.com/users/" + OWNER +
      "/repos?type=owner&sort=full_name&per_page=100&page=" + page;
    const response = await fetcher(endpoint, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response?.ok) throw new Error("GITHUB_CATALOG_UNAVAILABLE");
    const data = await response.json();
    if (!Array.isArray(data) || data.length > 100) throw new Error("GITHUB_PAGE_INVALID");
    for (const item of data) {
      const repo = normalizeRepo(item);
      if (!repo) continue;
      if (ids.has(repo.id)) continue;
      ids.add(repo.id);
      rows.push(repo);
    }
    if (data.length < 100) return orderFleet(rows);
  }
  throw new Error("GITHUB_CATALOG_INCOMPLETE");
}

export function floorsForCount(count) {
  return Math.max(1, Math.ceil(count / DESKS_PER_FLOOR));
}

export function floorStations(rows, floor) {
  if (!Number.isInteger(floor) || floor < 1 ||
      floor > floorsForCount(rows.length)) return [];
  const offset = (floor - 1) * DESKS_PER_FLOOR;
  return Array.from({ length: DESKS_PER_FLOOR },
    (_, index) => rows[offset + index] || null);
}

export function floorOfRepo(rows, repoId) {
  const index = rows.findIndex(row => row.id === repoId);
  return index < 0 ? null : Math.floor(index / DESKS_PER_FLOOR) + 1;
}

export function displayName(name) {
  return ({
    BTM: "Break the Matrix", RacetoOblivion: "Race to Oblivion",
    SparkTheSubstrate: "Spark: The Substrate",
    FieldConstellation: "Field Constellation"
  })[name] || name;
}
