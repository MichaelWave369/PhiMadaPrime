import React from "react";
import { safeTime } from "./audit.mjs";

export function CoverageStrip({ coverage, stations, status, error, onRetry }) {
  if (!coverage) return <div className="coverage-strip coverage-unavailable">
    <span>FLEET COVERAGE</span>
    <strong>{status === "loading" ? "Loading published coverage…" :
      status === "unavailable" ? "Coverage unavailable, pilot still available" :
      "Awaiting published rolling scan"}</strong>
    <small>{error ? "Reason: " + error : "Repository metadata is visible; deep coverage remains unknown."}</small>
    {status === "unavailable" && <button type="button" className="coverage-retry"
      onClick={onRetry}>Retry coverage</button>}
  </div>;
  const assigned = stations.filter(Boolean);
  const observed = assigned.filter(row => coverage.byRepo[row.name] &&
    coverage.byRepo[row.name].state !== "NEVER_OBSERVED").length;
  const recent = assigned.filter(row =>
    coverage.byRepo[row.name]?.state === "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED").length;
  return <div className="coverage-strip" aria-label="Current floor metadata scan coverage">
    <span>FLEET COVERAGE</span>
    <div className="coverage-meter" role="progressbar" aria-valuenow={observed}
      aria-valuemin={0} aria-valuemax={assigned.length}
      aria-label="Repositories on floor with previous metadata observations">
      <i style={{ width: (assigned.length ? observed / assigned.length * 100 : 0) + "%" }} />
    </div>
    <strong>{observed}/{assigned.length} previously observed</strong>
    <small>{recent} recent metadata checks · none product certified</small>
  </div>;
}

export function CoverageSidebar({ coverage, status, error, onRetry, floors, onVisitFloor }) {
  if (!coverage) return <div className="coverage-summary">
    <h3>Fleet Audit Coverage</h3>
    <p>{status === "loading" ? "Reading published rolling coverage…" :
      status === "unavailable" ?
      "Published cohort data could not be validated or loaded. No scan status will be guessed." :
      "Waiting for the published cohort ledger."}</p>
    {error && <p className="coverage-error" role="status">{error}</p>}
    <button type="button" className="coverage-retry" onClick={onRetry}
      disabled={status === "loading"}>Retry published coverage</button>
    <small>The six-repository Agentora pilot remains separate. An unavailable ledger is not a failed project or a product status.</small>
  </div>;
  const stats = coverage.stats;
  return <div className="coverage-summary">
    <h3>Fleet Audit Coverage</h3>
    <p>Published {safeTime(coverage.generatedUtc)}</p>
    <div className="coverage-stats">
      <div><strong>{stats.observed}</strong><span>Ever inspected</span></div>
      <div><strong>{stats.recentClean}</strong><span>Recent observations</span></div>
      <div><strong>{stats.stale + stats.recentLimited}</strong><span>Stale or limited</span></div>
      <div><strong>{stats.never}</strong><span>Not yet scanned</span></div>
    </div>
    <div className="coverage-meter wide" role="progressbar" aria-label="Public fleet metadata observation coverage"
      aria-valuemin={0} aria-valuemax={stats.inventory} aria-valuenow={stats.observed}>
      <i style={{ width: (stats.inventory ? stats.observed / stats.inventory * 100 : 0) + "%" }} />
    </div>
    <p><strong>{stats.observed}/{stats.inventory}</strong> public repos have historical metadata observations.</p>
    <p>The most recent successful publication inspected {stats.cohortScanned} repositories. This is rolling metadata coverage, not proof that software is complete.</p>
    <h3>Floor observation directory</h3>
    <div className="coverage-floor-list">
      {floors.map(f => {
        const assigned = f.stations.filter(Boolean);
        const inspected = assigned.filter(r =>
          coverage.byRepo[r.name] &&
          coverage.byRepo[r.name].state !== "NEVER_OBSERVED").length;
        return <button key={f.number} type="button"
          onClick={() => onVisitFloor(f.number)}>
          <span>Deck {String(f.number).padStart(2, "0")}</span>
          <strong>{inspected}/{assigned.length}</strong>
        </button>;
      })}
    </div>
    <button type="button" className="coverage-retry" onClick={onRetry}>
      Refresh published coverage
    </button>
    <small>Counts can decrease if repos change, become private, disappear from public inventory, or their observation history expires. No automatic PR actions occur.</small>
  </div>;
}

export function CoverageInspector({ record }) {
  if (!record) return <section className="coverage-inspector">
    <h3>ROLLING FLEET SCANNER</h3>
    <p>No published cohort observation for this public repo yet. This means unknown, not failed.</p>
  </section>;
  const isRecent = record.state === "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED";
  return <section className="coverage-inspector">
    <h3>ROLLING FLEET SCANNER</h3>
    <strong className={isRecent ? "coverage-recent" : "coverage-neutral"}>
      {record.state.replaceAll("_", " ")}
    </strong>
    <dl className="details-list">
      <div><dt>Last observed</dt><dd>{safeTime(record.observedAt)}</dd></div>
      <div><dt>Observed HEAD</dt><dd>{record.sourceSha?.slice(0, 12) || "Unverified"}</dd></div>
      <div><dt>CI metadata</dt><dd>{record.ci}</dd></div>
      <div><dt>Pages metadata</dt><dd>{record.pages}</dd></div>
      <div><dt>Release metadata</dt><dd>{record.release}</dd></div>
    </dl>
    {record.limitations?.length > 0 &&
      <p>Observation limits: {record.limitations.join(", ")}</p>}
    <p>Recorded API metadata is not build, install, headset, deployment runtime or complete-product verification. R0.2 job proposals come from a separate pilot.</p>
  </section>;
}
