import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DESKS_PER_FLOOR, KNOWN_EXAMPLES, fetchPublicFleet, displayName
} from "./fleet.mjs";
import { towerFloors, floorForId } from "./tower.mjs";
import { fetchRepoSignals, signalsFresh } from "./signals.mjs";
import { ChiefOfStaff, SignalInspector, WingRibbon } from "./office-parts.jsx";
import { MissionBoard } from "./mission-board.jsx";
import { fetchPublicSnapshot } from "./public-feed.mjs";
import { fetchPublicCoverage, coverageFailureReason } from "./coverage.mjs";
import { TriageCoverage, TriageForDesk } from "./triage-parts.jsx";
import { CoverageStrip, CoverageSidebar, CoverageInspector } from "./coverage-parts.jsx";
import { missionQueue } from "./missions.mjs";
import { MAX_ARTIFACT_BYTES, parseOfficeArtifact, safeTime } from "./audit.mjs";
import "./office.css";
import "./living.css";
import "./mission-board.css";
import "./coverage.css";
import "./triage.css";

const TABS = ["Directory", "Signals", "Coverage", "Missions"];
const COLORS = ["cyan", "gold", "violet", "mint", "peach", "blue"];

function Star({ index }) {
  return <span className={"desk-avatar " + COLORS[index % COLORS.length]} aria-hidden="true">
    <span className="avatar-head"><span className="avatar-eyes" /></span>
    <span className="avatar-shirt" />
  </span>;
}

function deriveState(repo, report, cohort) {
  if (!repo) return { label: "AVAILABLE", kind: "empty" };
  if (repo.exampleOnly) return { label: "EXAMPLE", kind: "example" };
  if (repo.archived) return { label: "ARCHIVED", kind: "archived" };
  if (report?.completion === "UNVERIFIED") return { label: "PILOT AUDIT", kind: "review" };
  if (cohort?.state === "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED")
    return { label: "METADATA OBSERVED", kind: "observed" };
  if (cohort?.state === "RECENT_LIMITED_OBSERVATION")
    return { label: "LIMITED OBSERVATION", kind: "limited" };
  if (cohort?.state === "STALE_AFTER_PUSH" || cohort?.state === "STALE_BY_AGE")
    return { label: "STALE OBSERVATION", kind: "stale" };
  if (report?.completion === "NOT_AUDITED") return { label: "NOT AUDITED", kind: "unknown" };
  return { label: "UNVERIFIED", kind: "unknown" };
}

function Desk({ repo, position, evidence, signal, cohort, onSelect }) {
  const state = deriveState(repo, evidence, cohort);
  const fresh = signalsFresh(signal);
  const ciGreen = fresh && signal?.ci?.state === "OBSERVED_GREEN_AT_HEAD";
  const ciFailed = fresh && signal?.ci?.state === "FAILED_AT_HEAD_OBSERVED";
  if (!repo) return (
    <div className="desk-slot desk-vacant" aria-label="Unused station, reserved for future repository">
      <div className="desk-label">VACANT {String(position).padStart(2, "0")}</div>
      <div className="desk-monitor vacant-monitor"><span>＋</span></div>
      <div className="desk-table vacant-table" />
    </div>
  );
  return (
    <button type="button" className={"desk-slot desk-filled desk-" + state.kind +
      (ciGreen ? " desk-ci-observed" : "") + (ciFailed ? " desk-ci-failed" : "")}
      onClick={() => onSelect(repo.id)} aria-label={"Inspect " + displayName(repo.name)}>
      <span className="desk-label"><i className="status-light" />{displayName(repo.name)}</span>
      <span className="desk-scene">
        {ciGreen && <span className="observed-speech">CI observed green ✓</span>}
        {ciFailed && <span className="observed-speech observed-fail">CI failure observed</span>}
        <span className="desk-monitor"><span className="screen-lines">
          <i /><i /><i /><i /></span><span className="screen-small">Φ</span></span>
        <span className="desk-table"><span className="desk-drawer" /><span className="desk-lamp" /></span>
        <Star index={position} />
      </span>
      <span className="desk-status">{ciGreen ? "OBSERVED CI GREEN" :
        ciFailed ? "OBSERVED CI ISSUE" : state.label}</span>
    </button>
  );
}

function DetailPanel({ repo, evidence, plan, audit, signal, cohort,
  signalLoading, signalError, onCheckSignal, onClose, onJump }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const state = deriveState(repo, evidence, cohort);
  return (
    <div className="inspector-backdrop" onMouseDown={e => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <aside className="inspector" role="dialog" aria-modal="true"
        aria-label={"Repository inspector: " + displayName(repo.name)}>
        <div className="inspector-top">
          <span className="inspector-eyebrow">ΦMADA PRIME / STATION INSPECTOR</span>
          <button type="button" ref={closeRef} className="close-inspector"
            aria-label="Close inspector" onClick={onClose}>×</button>
        </div>
        <h2>{displayName(repo.name)}</h2>
        <div className={"inspector-signal " + state.kind}>
          <span className="status-orb" /> {state.label}
        </div>
        <p>{repo.description || "No public project description provided."}</p>
        <SignalInspector repo={repo} signal={signal} loading={signalLoading}
          error={signalError} onCheck={onCheckSignal} />
        <CoverageInspector record={cohort} />
        <TriageForDesk repo={repo} record={cohort} />
        {repo.exampleOnly ? (
          <p className="caution">This is a curated example while GitHub is unavailable. No live repository information has been verified.</p>
        ) : (
          <dl className="details-list">
            <div><dt>Language</dt><dd>{repo.language || "Unspecified"}</dd></div>
            <div><dt>Last pushed</dt><dd>{safeTime(repo.pushed_at)}</dd></div>
            <div><dt>Audit</dt><dd>{evidence?.completion || "Not loaded"}</dd></div>
            <div><dt>CI evidence</dt><dd>{evidence?.ci || "Not loaded"}</dd></div>
            <div><dt>Pages evidence</dt><dd>{evidence?.pages || "Not loaded"}</dd></div>
            <div><dt>Release evidence</dt><dd>{evidence?.release || "Not loaded"}</dd></div>
          </dl>
        )}
        {evidence && <>
          <h3>Completion review</h3>
          <p className="caution">An observed CI result, published release or HTML page does not establish that software works. All completion claims remain unverified.</p>
          {evidence.surfaces?.length > 0 &&
            <div className="tag-row">{evidence.surfaces.map(s => <span key={s} className="role-tag">{s}</span>)}</div>}
          <h3>Suggested next jobs</h3>
          {evidence.tasks?.length ? <ol className="task-list">{evidence.tasks.map((t, i) =>
            <li key={i}>{t}</li>)}</ol> : <p>Import a completion plan to see review-only work proposals.</p>}
          {evidence.relationships?.length > 0 && <>
            <h3>README references</h3>
            <div className="tag-row">{evidence.relationships.map(name =>
              <button type="button" key={name} className="link-chip"
                onClick={() => onJump(name)}>{name}</button>)}</div>
            <small>References are not verified executable integrations.</small>
          </>}
        </>}
        {!evidence && <p className="caution">No Agentora audit or plan loaded for this repository. Status is unknown, not healthy or failed.</p>}
        {(plan || audit) && <small>Loaded evidence: {plan?.freshness || audit?.freshness}. Public-only local files, never uploaded.</small>}
        <div className="inspector-actions">
          <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="primary-link">
            Open GitHub repository ↗
          </a>
          {repo.homepage && <a href={repo.homepage} target="_blank"
            rel="noopener noreferrer" className="secondary-link">Project website ↗</a>}
        </div>
      </aside>
    </div>
  );
}

function Office({ stations, floor, evidence, signals, coverage, onSelect, hasPlan, wing }) {
  const count = stations.filter(Boolean).length;
  const observedPrs = stations.reduce((total, repo) => {
    const signal = signals[repo?.id];
    return total + (signalsFresh(signal) ? signal.openPrs?.length || 0 : 0);
  }, 0);
  return (
    <section className={"office office-wing-" + wing}
      aria-label={"Virtual fleet office, floor " + floor}>
      <div className="office-wall">
        <div className="light-string" aria-hidden="true">
          {Array.from({ length: 22 }, (_, n) =>
            <span key={n} style={{ animationDelay: n * 0.12 + "s" }} />)}
        </div>
        <div className="wall-brand" aria-hidden="true">Φ</div>
        <div className="priority-board">
          <div className="board-title">✦ COMMAND BULLETIN ✦</div>
          <div className="board-message">{hasPlan
            ? "Review proposals available. Select a desk for next jobs."
            : "Import Agentora audit + plan for evidence-backed job proposals."}</div>
        </div>
        <div className="wall-framed" aria-hidden="true"><span>Φ</span><small>ENTER THE FIELD</small></div>
      </div>
      <div className="office-floor">
        <div className="deck-caption"><span>DECK {String(floor).padStart(2, "0")}</span>
          <span>{count} OCCUPIED / {DESKS_PER_FLOOR} STATIONS</span></div>
        <div className="desk-grid">
          {stations.slice(0, 6).map((repo, i) => <Desk key={repo?.id ?? "empty-" + i}
            repo={repo} position={i + 1} evidence={evidence[repo?.name]}
            signal={signals[repo?.id]} cohort={coverage?.byRepo[repo?.name]}
            onSelect={onSelect} />)}
        </div>
        <div className="middle-bay">
          {observedPrs > 0 && <div className="observed-courier"
            title="Decorative response to observed open GitHub PRs, not an active worker">
            <span className="courier-label">PRs OBSERVED</span><Star index={2} />
          </div>}
          <div className="lounge-zone" aria-hidden="true">
            <span className="lounge-label">BREAK ROOM</span>
            <div className="couch-back">Φ <span className="couch-pillow" /></div>
            <div className="couch-bottom" />
            <div className="coffee-table">☕</div>
          </div>
          <div className="command-center">
            <div className="command-screens">
              <div className="command-screen"><span>STATUS</span><i /><i /><i /></div>
              <div className="command-screen main-screen">Φ</div>
              <div className="command-screen"><span>VERIFY</span><i /><i /><i /></div>
            </div>
            <div className="chief-avatar" aria-hidden="true"><i /><b /></div>
            <div className="control-counter">Φ &nbsp; FLEET CONTROL &nbsp; Φ
              <small>OPERATIONS • READ ONLY</small></div>
          </div>
          <div className="coffee-zone" aria-hidden="true">
            <span className="coffee-label">COFFEE • NO AUTO MERGES</span>
            <div className="arcade-roof">Φ ARCADE</div>
            <div className="arcade-screen">★<i>▣</i></div>
            <div className="arcade-bottom">● ●</div>
            <div className="potted-plant">♣</div>
          </div>
        </div>
        <div className="desk-grid">
          {stations.slice(6, 12).map((repo, i) => <Desk key={repo?.id ?? "empty-" + (i + 6)}
            repo={repo} position={i + 7} evidence={evidence[repo?.name]}
            signal={signals[repo?.id]} cohort={coverage?.byRepo[repo?.name]}
            onSelect={onSelect} />)}
        </div>
        <div className="office-rug" aria-hidden="true">Φ</div>
      </div>
    </section>
  );
}

function App() {
  const [rows, setRows] = useState(KNOWN_EXAMPLES);
  const [catalogState, setCatalogState] = useState("loading");
  const [floor, setFloor] = useState(1);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [selectedId, setSelectedId] = useState(null);
  const [audit, setAudit] = useState(null);
  const [plan, setPlan] = useState(null);
  const [message, setMessage] = useState("");
  const [signals, setSignals] = useState({});
  const [signalsBusy, setSignalsBusy] = useState({});
  const [signalsError, setSignalsError] = useState({});
  const [boardOpen, setBoardOpen] = useState(false);
  const [reviewedJobs, setReviewedJobs] = useState({});
  const [pinnedJobs, setPinnedJobs] = useState({});
  const [publishedMeta, setPublishedMeta] = useState(null);
  const [publishedStatus, setPublishedStatus] = useState("waiting");
  const [coverage, setCoverage] = useState(null);
  const [coverageStatus, setCoverageStatus] = useState("waiting");
  const [coverageError, setCoverageError] = useState(null);
  const uploadRef = useRef(null);
  async function refreshCatalog() {
    setCatalogState("loading");
    try {
      const discovered = await fetchPublicFleet();
      if (!discovered.length) throw new Error("EMPTY_PUBLIC_CATALOG");
      setRows(discovered);
      setSignals({});
      setPublishedMeta(null);
      setPublishedStatus("waiting");
      setCoverage(null);
      setCoverageStatus("waiting");
      setCoverageError(null);
      setCatalogState("live");
      setMessage("Public GitHub inventory loaded: " + discovered.length + " repos.");
    } catch {
      setCatalogState("fallback");
      setRows(KNOWN_EXAMPLES);
      setAudit(null); setPlan(null); setSignals({});
      setPublishedMeta(null); setPublishedStatus("unavailable");
      setCoverage(null); setCoverageStatus("unavailable");
      setCoverageError({ code: "CATALOG_UNAVAILABLE", message: "Public catalog unavailable; no cohort data will be inferred." });
      setMessage("Live public inventory unavailable. Showing twelve labeled examples only.");
    }
  }
  useEffect(() => { refreshCatalog(); }, []);
  useEffect(() => {
    if (catalogState !== "live") return;
    let cancelled = false;
    setPublishedStatus("loading");
    setCoverageStatus("loading");
    setCoverageError(null);
    fetchPublicSnapshot(rows).then(async snapshot => {
      if (cancelled) return;
      // A user-selected local report must not be silently replaced by the feed.
      setAudit(existing => existing?.source === "LOCAL_IMPORT" ? existing : snapshot.audit);
      setPlan(existing => existing?.source === "LOCAL_IMPORT" ? existing : snapshot.plan);
      setPublishedMeta(snapshot.manifest);
      setPublishedStatus("ready");
      try {
        const observed = await fetchPublicCoverage(rows, snapshot.manifest);
        if (!cancelled) {
          setCoverage(observed);
          setCoverageStatus("ready");
          setCoverageError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setCoverage(null);
          setCoverageStatus("unavailable");
          setCoverageError(coverageFailureReason(error));
        }
      }
    }).catch((error) => {
      if (cancelled) return;
      setPublishedStatus("unavailable");
      setCoverage(null);
      setCoverageStatus("unavailable");
      setCoverageError({ code: "PILOT_FEED_UNAVAILABLE",
        message: "The Agentora pilot snapshot failed validation; coverage cannot be loaded from its manifest." });
    });
    return () => { cancelled = true; };
  }, [catalogState, rows]);
  async function reloadPublishedPilot() {
    if (catalogState !== "live" || publishedStatus === "loading") return;
    setPublishedStatus("loading");
    try {
      const snapshot = await fetchPublicSnapshot(rows);
      setAudit(snapshot.audit);
      setPlan(snapshot.plan);
      setPublishedMeta(snapshot.manifest);
      setReviewedJobs({});
      setPinnedJobs({});
      setPublishedStatus("ready");
      setCoverageStatus("loading");
      setCoverageError(null);
      try {
        setCoverage(await fetchPublicCoverage(rows, snapshot.manifest));
        setCoverageStatus("ready");
        setCoverageError(null);
        setMessage("Published public pilot and rolling coverage loaded. No work executed.");
      } catch (error) {
        setCoverage(null);
        setCoverageStatus("unavailable");
        setCoverageError(coverageFailureReason(error));
        setMessage("Pilot loaded, but rolling coverage failed validation. Check the Coverage tab.");
      }
    } catch {
      setPublishedStatus("unavailable");
      setMessage("Published public pilot unavailable or stale. Existing local evidence was not changed.");
    }
  }
  async function retryPublishedCoverage() {
    if (catalogState !== "live" || coverageStatus === "loading") return;
    setCoverageStatus("loading");
    setCoverageError(null);
    try {
      // Recheck manifest as well as coverage. Handles a deployment race or old browser cache.
      const snapshot = await fetchPublicSnapshot(rows);
      const result = await fetchPublicCoverage(rows, snapshot.manifest);
      setCoverage(result);
      setCoverageStatus("ready");
      setCoverageError(null);
      setPublishedMeta(snapshot.manifest);
      setMessage("Published rolling coverage revalidated. No jobs created.");
    } catch (error) {
      setCoverage(null);
      setCoverageStatus("unavailable");
      setCoverageError(coverageFailureReason(error));
      setMessage("Rolling coverage still unavailable. Review the diagnostic in Coverage.");
    }
  }
  const filtered = useMemo(() => rows.filter(repo =>
    (repo.name + " " + repo.description).toLowerCase().includes(query.toLowerCase().trim())
  ), [rows, query]);
  const allFloors = useMemo(() => towerFloors(rows), [rows]);
  const tower = useMemo(() => towerFloors(filtered, query), [filtered, query]);
  const floors = tower.length;
  const activeFloor = Math.min(floor, floors);
  const currentFloor = tower[activeFloor - 1];
  const stations = currentFloor.stations;
  const selected = rows.find(repo => repo.id === selectedId) || null;
  const evidence = { ...(audit?.byRepo || {}), ...(plan?.byRepo || {}) };
  const auditCount = Object.values(evidence).filter(x =>
    x.completion === "UNVERIFIED").length;
  const missions = useMemo(() => missionQueue(plan, rows), [plan, rows]);
  const taskCount = missions.length;
  const markReviewed = id => setReviewedJobs(prev => ({ ...prev, [id]: !prev[id] }));
  const togglePinned = id => setPinnedJobs(prev => ({ ...prev, [id]: !prev[id] }));
  async function inspectLiveRepo(repo) {
    if (!repo || repo.exampleOnly || signalsBusy[repo.id]) return;
    setSignalsBusy(previous => ({ ...previous, [repo.id]: true }));
    setSignalsError(previous => ({ ...previous, [repo.id]: "" }));
    try {
      const signal = await fetchRepoSignals(repo);
      setSignals(previous => ({ ...previous, [repo.id]: signal }));
      setMessage("Live GitHub observations refreshed for " + repo.name +
        ". No work was executed.");
    } catch (error) {
      setSignalsError(previous => ({
        ...previous, [repo.id]: error?.message === "GITHUB_REPOSITORY_MISMATCH" ?
        "GitHub repository identity does not match this station." :
        "Public GitHub signal unavailable; no status inferred."
      }));
    } finally {
      setSignalsBusy(previous => ({ ...previous, [repo.id]: false }));
    }
  }
  function jumpToRepo(name) {
    setBoardOpen(false);
    setActiveTab("Directory");
    const repo = rows.find(r => r.name.toLowerCase() === String(name).toLowerCase());
    if (!repo) return;
    setQuery("");
    setFloor(floorForId(allFloors, repo.id) || 1);
    setSelectedId(repo.id);
  }
  async function importArtifact(e) {
    const file = e.target.files?.[0];
    if (uploadRef.current) uploadRef.current.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_ARTIFACT_BYTES) throw new Error("FILE_TOO_LARGE");
      const result = parseOfficeArtifact(await file.text(), rows);
      if (result.type === "audit") setAudit({ ...result, source: "LOCAL_IMPORT" });
      else {
        setPlan({ ...result, source: "LOCAL_IMPORT" });
        setReviewedJobs({});
        setPinnedJobs({});
      }
      setMessage("Loaded " + result.type + " locally (" + result.freshness +
        "). No files were uploaded and no actions were dispatched.");
    } catch (error) {
      setMessage("Import refused: " + (error?.message || "Invalid report"));
    }
  }
  useEffect(() => {
    function keypress(e) {
      if (selected || boardOpen || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (e.key === "ArrowRight" && activeFloor < floors) setFloor(f => Math.min(floors, f + 1));
      if (e.key === "ArrowLeft" && activeFloor > 1) setFloor(f => Math.max(1, f - 1));
    }
    window.addEventListener("keydown", keypress);
    return () => window.removeEventListener("keydown", keypress);
  }, [selected, boardOpen, activeFloor, floors]);
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">Φ</span>
          <span><strong>ΦMADA PRIME</strong><small>THE LIVING FLEET OFFICE</small></span>
        </div>
        <div className="top-metrics" aria-label="Current catalog metrics">
          <div><small>PUBLIC REPOS</small><strong>{catalogState === "live" ? rows.length : "—"}</strong></div>
          <div><small>FLOORS</small><strong>{catalogState === "live" ? allFloors.length : "—"}</strong></div>
          <div><small>{coverage ? "REPOS OBSERVED" : "PILOT AUDIT"}</small>
            <strong>{coverage ? coverage.stats.observed : auditCount}</strong></div>
          <div><small>PROPOSED JOBS</small><strong>{taskCount}</strong></div>
        </div>
        <div className={"feed-state feed-" + catalogState}>
          <span className="feed-light" />{catalogState === "live" ? "GITHUB PUBLIC" :
            catalogState === "loading" ? "CONNECTING" : "EXAMPLE MODE"}
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-head"><strong>FLEET TRANSMISSIONS</strong>
            <small>COMMAND TOWER</small></div>
          <nav className="side-tabs" aria-label="Side panel">
            {TABS.map(tab => <button type="button" key={tab} aria-pressed={activeTab === tab}
              className={activeTab === tab ? "selected" : ""} onClick={() => {
                setActiveTab(tab);
                setBoardOpen(tab === "Missions");
              }}>{tab}</button>)}
          </nav>
          {activeTab === "Directory" ? <>
            <label className="search-label" htmlFor="fleet-search">FIND A REPOSITORY</label>
            <input id="fleet-search" className="search-box" value={query}
              onChange={e => { setQuery(e.target.value); setFloor(1); }}
              placeholder="Search the fleet..." />
            <div className="sidebar-section-label">ELEVATOR DIRECTORY
              <small>{floors} {floors === 1 ? "FLOOR" : "FLOORS"}</small></div>
            <div className="floor-directory">
              {Array.from({ length: floors }, (_, i) => {
                const level = i + 1;
                const mapped = tower[i];
                const occupied = mapped.count;
                return <button type="button" key={level}
                  className={activeFloor === level ? "floor-link active" : "floor-link"}
                  aria-current={activeFloor === level ? "page" : undefined}
                  onClick={() => setFloor(level)}>
                  <span className="floor-number">{String(level).padStart(2, "0")}</span>
                  <span className="floor-link-title">Deck {String(level).padStart(2, "0")}
                    <em>{mapped.title}{mapped.section > 1 ? " " + mapped.section : ""}</em></span>
                  <small>{occupied}/12</small>
                </button>;
              })}
            </div>
          </> : activeTab === "Coverage" ? <>
            <CoverageSidebar coverage={coverage} status={coverageStatus}
              error={coverageError?.message} onRetry={retryPublishedCoverage}
              floors={allFloors} onVisitFloor={level => {
                setFloor(level);
                setActiveTab("Directory");
                setBoardOpen(false);
              }} />
          </> : activeTab === "Missions" ? <>
            <div className="signal-feed">
              <h3>Mission Control</h3>
              <p>{taskCount} proposed review jobs from Agentora.</p>
              <p>{Object.values(reviewedJobs).filter(Boolean).length} locally reviewed;
                {Object.values(pinnedJobs).filter(Boolean).length} pinned.</p>
              <small>No task is dispatched or completed by these controls.</small>
              <button type="button" className="import-button"
                onClick={() => setBoardOpen(true)}>Open Mission Board</button>
            </div>
          </> : <>
            <div className="signal-feed">
              <h3>Observation sources</h3>
              <p><span className="signal-dot blue" /> Public GitHub metadata</p>
              <p><span className="signal-dot gold" /> Agentora R0.1 audit (optional)</p>
              <p><span className="signal-dot violet" /> Agentora R0.2 plan (optional)</p>
              <p><span className="signal-dot gold" /> Published public pilot: {publishedStatus}</p>
              <p><span className="signal-dot blue" /> Rolling cohort ledger: {coverageStatus}</p>
              <small>Signals are observations, not workers. No bot activity is simulated as real execution.</small>
              {publishedMeta && <p className="feed-coverage">Published pilot coverage:
                {publishedMeta.deep_audited_count} of {publishedMeta.inventory_count} public repos.
                Generated {safeTime(publishedMeta.generated_utc)}. No completed software certified.</p>}
              {coverageError && <p className="coverage-error" role="status">
                Rolling coverage: {coverageError.code}. {coverageError.message}</p>}
              <h3>Desk checks performed</h3>
              {Object.values(signals).length === 0 ?
                <p>No live desk inspections yet. Open a repository and select "Check current CI and PRs".</p> :
                <div className="observed-feed">
                  {Object.values(signals).sort((a, b) =>
                    b.observedAt.localeCompare(a.observedAt)).map(signal => (
                    <button type="button" key={signal.repositoryId}
                      onClick={() => jumpToRepo(signal.repository.split("/")[1])}>
                      <strong>{signal.repository.split("/")[1]}</strong>
                      <span>{signal.ci.state.replaceAll("_", " ")}</span>
                      <small>{signalsFresh(signal) ? "Recent observation" : "Stale observation"}</small>
                    </button>
                  ))}
                </div>}
            </div>
          </>}
          <div className="sidebar-bottom">
            <input className="sr-only" ref={uploadRef} id="import-evidence"
              type="file" accept=".json,application/json" onChange={importArtifact}
              disabled={catalogState !== "live"} />
            <button type="button" className="import-button"
              disabled={catalogState !== "live"} onClick={() => uploadRef.current?.click()}>
              ＋ Import Fleet JSON
            </button>
            <button type="button" className="refresh-button"
              onClick={retryPublishedCoverage}
              disabled={catalogState !== "live" || coverageStatus === "loading"}>
              {coverageStatus === "loading" ? "Checking coverage…" : "↻ Refresh coverage"}
            </button>
            <button type="button" className="refresh-button" onClick={reloadPublishedPilot}
              disabled={catalogState !== "live" || publishedStatus === "loading"}>
              {publishedStatus === "loading" ? "Checking published pilot…" : "↻ Load published pilot"}
            </button>
            <button type="button" className="refresh-button" onClick={refreshCatalog}>↻ Refresh catalog</button>
            <small>Public pilot and rolling cohort observations are published by GitHub Pages.
              Local report imports are session-only. No automatic job dispatch or completed-product claims.</small>
          </div>
        </aside>
        <main className="main-area">
          <div className="elevator-bar">
            <div><small>ΦMADA PRIME / VIRTUAL OFFICE</small>
              <h1>{boardOpen ? "Fleet Mission Board" : "Deck " + String(activeFloor).padStart(2, "0")}
                {!boardOpen && <span> · {currentFloor.title}</span>}</h1>
            </div>
            <div className="mission-top-actions">
              <button type="button" className="mission-open-button"
                onClick={() => { setBoardOpen(open => !open); setActiveTab(boardOpen ? "Directory" : "Missions"); }}>
                {boardOpen ? "← Return to desks" : "✦ Mission Board (" + taskCount + ")"}
              </button>
            <div className="elevator-controls" aria-label="Floor elevator">
              <button type="button" onClick={() => setFloor(Math.max(1, activeFloor - 1))}
                disabled={activeFloor <= 1 || boardOpen} aria-label="Previous floor">↑</button>
              <span>FLOOR {activeFloor} / {floors}</span>
              <button type="button" onClick={() => setFloor(Math.min(floors, activeFloor + 1))}
                disabled={activeFloor >= floors || boardOpen} aria-label="Next floor">↓</button>
            </div>
            </div>
          </div>
          <div className="banner-status" role="status" aria-live="polite">
            <span className={catalogState === "live" ? "status-dot-live" : "status-dot-muted"} />
            {catalogState === "live" ?
              publishedStatus === "ready" && publishedMeta ?
                "Public catalog online · pilot observations: " +
                publishedMeta.deep_audited_count + "/" + publishedMeta.inventory_count +
                " audited · " + publishedMeta.review_only_tasks +
                " review proposals · no work dispatched." :
                publishedStatus === "loading" ?
                "Public catalog online. Checking the published Agentora pilot snapshot…" :
                "Public catalog online. Published pilot unavailable or stale; local import remains available." :
              catalogState === "loading" ? "Checking the public GitHub directory…" :
              "GitHub inventory unavailable. Curated examples only; no live statuses."}
            <span className="help-key">← → to change floors</span>
          </div>
          {boardOpen ?
            <MissionBoard queue={missions} plan={plan}
              reviewed={reviewedJobs} pinned={pinnedJobs}
              onReview={markReviewed} onPin={togglePinned}
              onVisit={jumpToRepo}
              onClose={() => { setBoardOpen(false); setActiveTab("Directory"); }} /> :
            <>
              <WingRibbon current={currentFloor} floors={tower}
                onSelect={setSelectedId} />
              <CoverageStrip coverage={coverage} stations={stations}
                status={coverageStatus} error={coverageError?.message}
                onRetry={retryPublishedCoverage} />
              <ChiefOfStaff plan={plan} audit={audit} signals={signals} onJump={jumpToRepo} />
              {coverage && <TriageCoverage coverage={coverage} rows={rows} onJump={jumpToRepo} />}
              <Office stations={stations} floor={activeFloor} wing={currentFloor.wing}
                evidence={evidence} signals={signals} coverage={coverage}
                hasPlan={Boolean(plan)} onSelect={setSelectedId} />
            </>}
          <footer className="main-footer">
            <span>12 STATIONS PER FLOOR · {(query ? filtered.length : rows.length)} RECORDS SHOWN</span>
            <span>ΦMADA PRIME R6 · EVIDENCE TRIAGE / NO AUTOMATED DISPATCH</span>
          </footer>
          {message && <div className="toast" role="status">{message}
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">×</button></div>}
        </main>
      </div>
      {selected && <DetailPanel repo={selected} evidence={evidence[selected.name]}
        audit={audit} plan={plan} signal={signals[selected.id]}
        cohort={coverage?.byRepo[selected.name]}
        signalLoading={Boolean(signalsBusy[selected.id])}
        signalError={signalsError[selected.id] || ""}
        onCheckSignal={() => inspectLiveRepo(selected)}
        onClose={() => setSelectedId(null)} onJump={jumpToRepo} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
