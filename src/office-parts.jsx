import React from "react";
import { safeTime } from "./audit.mjs";
import { signalsFresh } from "./signals.mjs";
import { WINGS } from "./tower.mjs";

export function WingRibbon({ current, floors, onSelect }) {
  const { wing, title, section, count } = current;
  const info = WINGS.find(x => x.id === wing);
  const name = wing === "bridge" ? "THE BRIDGE" : wing === "search" ?
    "SEARCH RESULTS" : info?.label || "DISCOVERY ANNEX";
  return <section className={"wing-ribbon ribbon-" + wing}
    aria-label="Current floor department">
    <div className="wing-icon" aria-hidden="true">{info?.emoji || "Φ"}</div>
    <div className="wing-copy">
      <small>ΦMADA PRIME • DEPARTMENT DIRECTORY</small>
      <strong>{name}</strong>
      <span>{wing === "bridge" ? "Fleet coordination and flagship projects" :
        wing === "search" ? "Filtered results, all twelve-station floors" :
        info?.motto || "All repositories have a place in the tower."}</span>
    </div>
    <div className="wing-meta"><strong>{count}/12</strong><small>DESKS OCCUPIED</small>
      <span>{wing === "bridge" ? "Command level" : "Section " + section}</span></div>
    <div className="mini-map" aria-label="Twelve workstation overview">
      {current.stations.map((repo, i) =>
        <button type="button" key={i} disabled={!repo} onClick={() => repo && onSelect(repo.id)}
          title={repo?.name || "Vacant desk"}
          aria-label={repo ? "Inspect desk " + (i + 1) + ": " + repo.name : "Vacant desk " + (i + 1)}
          className={repo ? "map-occupied" : "map-vacant"} />)}
    </div>
  </section>;
}

export function ChiefOfStaff({ plan, audit, signals, onJump }) {
  const queue = plan?.priorityQueue || [];
  const first = queue[0];
  const observed = Object.values(signals).filter(x => x && signalsFresh(x));
  const green = observed.filter(x => x.ci?.state === "OBSERVED_GREEN_AT_HEAD");
  const failing = observed.filter(x => x.ci?.state === "FAILED_AT_HEAD_OBSERVED");
  return <section className="chief-report" aria-label="Chief of Staff review desk">
    <div className="chief-portrait" aria-hidden="true">
      <div className="chief-face"><span className="chief-glasses" /></div>
      <div className="chief-uniform">Φ</div>
    </div>
    <div className="chief-message">
      <small>CHIEF OF STAFF • READ-ONLY BRIEFING</small>
      {first ? <>
        <strong>Next proposal: {first.repository.split("/")[1]}</strong>
        <span>{first.summary}</span>
        <em>Priority {first.priority ?? "unscored"} • requires human review, not dispatched</em>
      </> : audit ? <>
        <strong>Audit received. No plan loaded.</strong>
        <span>Import the R0.2 completion plan to see prioritized work proposals.</span>
      </> : <>
        <strong>Welcome to the living fleet, Captain.</strong>
        <span>Public repos are visible. Load Agentora evidence to see honest work priorities.</span>
      </>}
    </div>
    <div className="chief-evidence">
      <strong>{observed.length} inspected</strong>
      <small>{green.length} with observed green CI • {failing.length} with observed failures</small>
      {first && <button type="button" onClick={() =>
        onJump(first.repository.split("/")[1])}>Visit proposed desk ↗</button>}
    </div>
  </section>;
}

export function SignalInspector({ repo, signal, loading, error, onCheck }) {
  const fresh = signalsFresh(signal);
  return <section className="signal-inspector" aria-label="Live GitHub signals for this repo">
    <h3>LIVE GITHUB SIGNALS</h3>
    <p>On-demand public API reads only. Current branch and recent workflow/PR observations, not an application acceptance test.</p>
    <button type="button" className="signal-button" disabled={loading || repo.exampleOnly}
      onClick={onCheck}>{loading ? "Checking public GitHub…" :
      signal ? "Refresh live observations" : "Check current CI and PRs"}</button>
    {error && <p className="signal-error" role="alert">{error}</p>}
    {signal && <>
      <div className="signal-observed"><span>Observed {safeTime(signal.observedAt)}</span>
        <strong>{fresh ? "RECENT" : "STALE • refresh required"}</strong></div>
      <div className={"signal-ci ci-" + signal.ci.state.toLowerCase()}>
        <strong>{signal.ci.state.replaceAll("_", " ")}</strong>
        <p>{signal.ci.message}</p>
      </div>
      <dl className="details-list">
        <div><dt>Default branch</dt><dd>{signal.defaultBranch}</dd></div>
        <div><dt>Exact head</dt><dd>{signal.headSha?.slice(0, 12) || "Not verified"}</dd></div>
        <div><dt>Open PRs</dt><dd>{signal.openPrs.length}{signal.prListPartial ? "+ (partial page)" : " observed"}</dd></div>
      </dl>
      {signal.openPrs.length > 0 && <>
        <h3>Observed open PRs (up to 10)</h3>
        <ul className="live-pr-list">{signal.openPrs.map(pr =>
          <li key={pr.number}><a href={pr.url} target="_blank"
            rel="noopener noreferrer">#{pr.number} {pr.title}</a>
            {pr.draft && <small>Draft</small>}</li>)}</ul>
      </>}
      <p className="signal-disclaimer">Source: public GitHub API. A green observed run does not mean all required checks passed, that a PR is safe to merge, or that a release works.</p>
    </>}
  </section>;
}
