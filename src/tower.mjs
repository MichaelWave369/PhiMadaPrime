// Editorial office architecture. No classification below certifies an integration.
import { DESKS_PER_FLOOR, FLAGSHIPS } from "./fleet.mjs";

export const WINGS = Object.freeze([
  { id: "core", title: "ΦOS Systems", label: "Core Systems", emoji: "Φ", motto: "The infrastructure that holds the field together." },
  { id: "vr", title: "XR Workshop", label: "Virtual Reality", emoji: "◈", motto: "Headsets, hands and worlds you can step into." },
  { id: "games", title: "Arcade Foundry", label: "Games & Play", emoji: "★", motto: "New worlds get built here." },
  { id: "research", title: "Research Observatory", label: "Research Lab", emoji: "✧", motto: "Methods, experiments and hard questions." },
  { id: "creative", title: "Creative Studio", label: "Arts & Media", emoji: "♫", motto: "Audio, video, stories and pixels." },
  { id: "infrastructure", title: "Network Operations", label: "Infrastructure", emoji: "⌘", motto: "Services, networks, hosting and coordination." },
  { id: "tools", title: "Workshop & Utilities", label: "Tools", emoji: "⚒", motto: "Useful tools for real people." },
  { id: "community", title: "Infinite Commons", label: "People & Community", emoji: "✿", motto: "Doors open, lights on, everyone welcome." },
  { id: "other", title: "Discovery Annex", label: "Other Projects", emoji: "◎", motto: "Projects that haven't found their wing yet." }
]);

// These are editorial hints for display, not observed technical dependencies.
const PINNED = Object.freeze({
  "phios": "core", "phios-mobile": "core", "phios-xr": "vr",
  "phios-mk1": "core", "phiflow": "core", "phikernel": "core",
  "genewrist": "vr", "overstrings": "vr", "domistikaxr": "vr",
  "domistika": "vr", "sparkthesubstrate": "vr", "phixrcommons": "vr",
  "btm": "games", "blackout": "games", "racetooblivion": "games",
  "echoesofthenine": "games", "phicade": "games",
  "shedofshadows": "games", "tweedleverse": "games", "piecebypiece": "games",
  "n-bg": "research", "cycleweave": "research", "compaware": "research",
  "fieldconstellation": "research", "phimathatelier": "research",
  "phifieldlab": "research", "opt i-eyes": "research",
  "paperghost": "tools", "phioperator": "tools", "phioffice369": "tools",
  "fieldstoryforge": "creative", "auralith369": "creative",
  "framefieldstudio": "creative", "phiaudio": "creative",
  "agentora": "infrastructure", "phiserve": "infrastructure",
  "superphivessel": "infrastructure", "fieldcloudworker": "infrastructure",
  "fieldsafe": "community", "infinite-porch": "community",
  "fieldatlas": "community"
});

const HINTS = [
  ["vr", /\b(webxr|vr|xr|quest|hand tracking|virtual reality|immersive)\b/i],
  ["games", /\b(game|arcade|roguelike|fps|rpg|puzzle|platformer|playable)\b/i],
  ["research", /\b(research|experiment|benchmark|mathematics|hypothesis|proof|geometry|physics)\b/i],
  ["creative", /\b(music|audio|video|visual|art|drawing|animation|film|storytelling|production)\b/i],
  ["infrastructure", /\b(network|backend|server|worker|orchestrat|deploy|runtime|inference|infrastructure)\b/i],
  ["core", /\b(operating system|app platform|kernel|phios)\b/i],
  ["community", /\b(community|commons|education|library|public resource|learning)\b/i],
  ["tools", /\b(utility|tool|editor|generator|workspace|office|desktop)\b/i]
];

export function wingForRepo(repo) {
  if (!repo || typeof repo.name !== "string") return "other";
  const pinned = PINNED[repo.name.toLowerCase()];
  if (pinned) return pinned;
  const description = String(repo.description || "").slice(0, 400);
  return HINTS.find(([, pattern]) => pattern.test(description))?.[0] || "other";
}

export function towerFloors(rows, search = "") {
  const repos = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const pad = (slice) => Array.from({ length: DESKS_PER_FLOOR },
    (_, i) => slice[i] || null);
  const floors = [];
  const makeFloor = (wing, entries, section) => {
    for (let start = 0; start < entries.length; start += DESKS_PER_FLOOR) {
      const onFloor = entries.slice(start, start + DESKS_PER_FLOOR);
      floors.push({
        number: floors.length + 1, wing, title: wing === "bridge" ? "Command Bridge" :
          wing === "search" ? "Search Results" :
          WINGS.find(w => w.id === wing)?.title || "Discovery Annex",
        section: section + Math.floor(start / DESKS_PER_FLOOR) + 1,
        count: onFloor.length, stations: pad(onFloor)
      });
    }
  };
  if (search.trim()) {
    makeFloor("search", repos, 0);
  } else {
    const flagships = new Set(FLAGSHIPS.map(x => x.toLowerCase()));
    const bridge = repos.filter(row => flagships.has(row.name.toLowerCase()))
      .slice(0, DESKS_PER_FLOOR);
    if (bridge.length) makeFloor("bridge", bridge, 0);
    const onBridge = new Set(bridge.map(x => x.id));
    const remaining = repos.filter(x => !onBridge.has(x.id));
    for (const wing of WINGS) {
      const group = remaining.filter(x => wingForRepo(x) === wing.id);
      group.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
      makeFloor(wing.id, group, 0);
    }
  }
  if (!floors.length) floors.push({
    number: 1, wing: search.trim() ? "search" : "bridge",
    title: search.trim() ? "Search Results" : "Command Bridge",
    section: 1, count: 0, stations: pad([])
  });
  return floors;
}

export function floorForId(floors, repoId) {
  const floor = floors.find(f => f.stations.some(r => r?.id === repoId));
  return floor?.number || null;
}

export function floorDirectory(floors) {
  return floors.map(f => ({
    number: f.number, title: f.title, count: f.count, wing: f.wing,
    section: f.section
  }));
}
