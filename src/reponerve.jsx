import React, { useState } from "react";
import { parseRepoNervePublic, REPONERVE_MAX_BYTES } from "./reponerve.mjs";
import { parseStewardAdvisory, MAX_STEWARD_BYTES } from "./steward-advisory.mjs";
import "./reponerve.css";

const EVENT_LABELS = {
  first_observed: "First observed", visible_again: "Visible again",
  renamed: "Renamed", archival_changed: "Archive state changed",
  default_branch_changed: "Default branch changed",
  push_activity_observed: "Push activity observed"
};

export function RepoNervePanel({ catalog, catalogState }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [stewardSnapshot, setStewardSnapshot] = useState(null);
  const [stewardError, setStewardError] = useState("");
  const isLive = catalogState === "live";
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSnapshot(null);
    setStewardSnapshot(null);
    try {
      if (file.size > REPONERVE_MAX_BYTES) throw new Error("FILE_TOO_LARGE");
      setSnapshot(parseRepoNervePublic(await file.text(), catalog));
      setError("");
    } catch {
      setSnapshot(null);
      setError("Import held. Only a fresh, public-only Agentora RepoNerve export matching the live catalog is accepted.");
    }
  }
  async function importStewardFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStewardSnapshot(null);
    try {
      if (file.size > MAX_STEWARD_BYTES) throw new Error("FILE_TOO_LARGE");
      const parsed = parseStewardAdvisory(await file.text(), catalog);
      if (snapshot && snapshot.scanId !== parsed.scanId) {
        throw new Error("SOURCE_SCAN_MISMATCH");
      }
      setStewardSnapshot(parsed);
      setStewardError("");
    } catch {
      setStewardError("Steward import held. Use a fresh Agentora R2 public-only export matching the current GitHub catalog and observation scan.");
    }
  }
  return <section className="reponerve-panel" aria-labelledby="reponerve-title">
    <div className="reponerve-head">
      <div>
        <p className="reponerve-kicker">Φ REPOSITORY NERVE / OBSERVATION BAY</p>
        <h2 id="reponerve-title">RepoNerve · Fleet Signals</h2>
        <p>Import a reviewed, redacted JSON snapshot exported by Agentora from your local RepoNerve.
          This public GitHub Pages tower never accesses localhost, a private database, or GitHub credentials.</p>
      </div>
      <span className="reponerve-status">READ ONLY</span>
    </div>
    <label className="reponerve-import">
      Select public-only RepoNerve export (.json)
      <input type="file" accept=".json,application/json" disabled={!isLive}
        onChange={importFile}/>
    </label>
    {!isLive && <p role="status">A live public GitHub catalog is required before importing RepoNerve observations.</p>}
    {error && <p className="reponerve-error" role="alert">{error}</p>}
    {!snapshot ? <div className="reponerve-empty">
      No verified-shape snapshot imported. No agents have been assigned, jobs dispatched, or releases certified.
    </div> : <>
      <div className="reponerve-stats">
        <div><strong>{snapshot.publicRepoCount}</strong><small>Public repos observed</small></div>
        <div><strong>{snapshot.eventCount}</strong><small>Recent event records</small></div>
        <div><strong>#{snapshot.scanId}</strong><small>Local scan identifier</small></div>
      </div>
      <p className="reponerve-notice">Observed: {new Date(snapshot.observedAt).toLocaleString()}.
        Inventory reflects the scanner's access, not a guarantee of complete account coverage.
        Source-only. Nothing here proves build health, release readiness, or authority to dispatch agents.</p>
      <h3>Recent repository changes</h3>
      {!snapshot.events.length ? <p>No recent public events in the bounded window.</p> :
        <ul className="reponerve-events">{snapshot.events.slice(0, 40).map(item =>
          <li key={item.id}><strong>{item.repo}</strong> · {EVENT_LABELS[item.kind]} ·
            <time dateTime={item.observedAt}> {new Date(item.observedAt).toLocaleString()}</time></li>)}</ul>}
      {snapshot.events.length > 40 && <p>Showing 40 of {snapshot.events.length} recent public events.</p>}
      <h3>Observed public repositories</h3>
      <p>{snapshot.repositories.length} identities matched the current public GitHub catalog.
        No private names or hidden records are included.</p>
    </>}
    <div className="reponerve-stewards">
      <h3>Logical steward registry · R2</h3>
      <p>Every repo can have a persistent steward record without running a model continuously.
        These are advisory rotation counts, not active worker assignments.</p>
      <label className="reponerve-import">
        Select Agentora public steward snapshot (.json)
        <input type="file" accept=".json,application/json"
          disabled={!isLive} onChange={importStewardFile}/>
      </label>
      {stewardError && <p className="reponerve-error" role="alert">{stewardError}</p>}
      {!stewardSnapshot ? <p className="reponerve-empty">
        No steward snapshot imported. No workers have been launched, and no mission has been dispatched.
      </p> : <>
        <div className="reponerve-stats">
          <div><strong>{stewardSnapshot.stewardCount}</strong><small>Logical stewards</small></div>
          <div><strong>{stewardSnapshot.available}</strong><small>Eligible for planning</small></div>
          <div><strong>{stewardSnapshot.paused}</strong><small>Paused (archived)</small></div>
        </div>
        <p className="reponerve-notice">Observed {new Date(stewardSnapshot.observedAt).toLocaleString()}.
          This is a local planning record, not a live AI workforce, CI check or deployment status.</p>
        <div className="reponerve-steward-list">
          {stewardSnapshot.stewards.slice(0, 60).map(item =>
            <div key={item.githubId} className="reponerve-steward-row">
              <strong>{item.repoName}</strong>
              <span>{item.state === "PAUSED_ARCHIVED" ? "Archived · paused" : "Eligible for planning"}</span>
              <small>{item.stewardKey} · {item.plannedCount} planned turns</small>
            </div>)}
        </div>
        {stewardSnapshot.stewards.length > 60 &&
          <p>Showing 60 of {stewardSnapshot.stewards.length} logical stewards.</p>}
      </>}
    </div>
  </section>;
}
