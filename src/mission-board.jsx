import React, { useMemo, useState } from "react";
import { filterMissions, handoffText, missionStats } from "./missions.mjs";
import { WINGS } from "./tower.mjs";
import { SchedulerPreview } from "./scheduler-preview.jsx";
import { EvidenceBay } from "./evidence-bay.jsx";
import { missionLiveTriage } from "./mission-live-triage.mjs";
import { OneRepoCompletionLane } from "./completion-lane.jsx";
import "./agent-forge.css";
const AgentForge = React.lazy(() => import("./agent-forge.jsx")
  .then(module => ({ default: module.AgentForge })));
import "./chronicle.css";
const Chronicle = React.lazy(() => import("./chronicle.jsx")
  .then(module => ({ default: module.Chronicle })));

export function MissionBoard({ queue, plan, catalog, contracts, reviewed, pinned,
  signals={}, signalsBusy={}, signalsError={}, onInspectRepo, onExportVerification,
  onReview, onPin, onVisit, onClose }) {
  const [query, setQuery] = useState("");
  const [wing, setWing] = useState("all");
  const [review, setReview] = useState("all");
  const [notice, setNotice] = useState("");
  const [chronicleOpen,setChronicleOpen] = useState(false);
  const stats = useMemo(() => missionStats(queue, reviewed, pinned),
    [queue, reviewed, pinned]);
  const visible = useMemo(() => filterMissions(queue, {
    query, wing, review, reviewed, pinned
  }), [queue, query, wing, review, reviewed, pinned]);
  const availableWings = useMemo(() => WINGS.filter(w =>
    queue.some(m => m.wing === w.id)), [queue]);
  async function copyHandoff(mission) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("UNSUPPORTED");
      await navigator.clipboard.writeText(handoffText(mission, plan));
      setNotice("Proposal copied for manual review. Nothing was sent or executed.");
    } catch {
      setNotice("Clipboard unavailable. No handoff was copied or sent.");
    }
  }
  return <section className="missions-board" aria-label="Fleet mission board">
    <header className="missions-header">
      <div>
        <small>ΦMADA PRIME / AGENTORA PLANNING</small>
        <h2>THE MISSION BOARD</h2>
        <p>Every proposal is a draft for human review, never an active worker assignment.</p>
      </div>
      <button type="button" className="mission-close" onClick={onClose}>
        ← Return to office
      </button>
    </header>
    <OneRepoCompletionLane catalog={catalog} contracts={contracts}
      signals={signals} signalsBusy={signalsBusy} signalsError={signalsError}
      onInspectRepo={onInspectRepo} onVisit={onVisit}
      onExportVerification={onExportVerification} />
    <details className="forge-launch">
      <summary style={{cursor:"pointer",padding:"13px 16px",border:"1px solid #7696ac",borderRadius:"6px",background:"#253448",color:"#d9f3ff",fontWeight:700}}>
        ✦ Agent Forge · Public PR Review (Pierre Trees + Diffs)
      </summary>
      <React.Suspense fallback={<p role="status">Opening the Agent Forge reviewer…</p>}>
        <AgentForge catalog={catalog} />
      </React.Suspense>
    </details>
    <details className="chronicle-launch"
      onToggle={event => setChronicleOpen(event.currentTarget.open)}>
      <summary style={{cursor:"pointer",padding:"13px 16px",border:"1px solid #829fb6",
        borderRadius:"6px",background:"#233549",color:"#def2ff",fontWeight:700}}>
        ✦ Agent Flow + Chronicle · Branch & Commit Time Machine
      </summary>
      {chronicleOpen && <React.Suspense fallback={<p role="status">Opening the Chronicle workstation…</p>}>
        <Chronicle catalog={catalog} />
      </React.Suspense>}
    </details>
    <EvidenceBay catalog={catalog} contracts={contracts} onVisit={onVisit} />
    <SchedulerPreview queue={queue} plan={plan} catalog={catalog} />
    <div className="mission-stat-grid" aria-label="Review-only mission counts">
      <div><strong>{stats.proposed}</strong><span>Proposed jobs</span></div>
      <div><strong>{stats.localReviewed}</strong><span>Locally reviewed</span></div>
      <div><strong>{stats.pinned}</strong><span>Pinned</span></div>
      <div><strong>0</strong><span>Dispatched by office</span></div>
    </div>
    {!plan ? <div className="mission-empty">
      <div className="mission-orbit" aria-hidden="true">Φ</div>
      <h3>Chief of Staff needs a completion plan</h3>
      <p>The office knows about public GitHub repositories, but a repository catalog is not a list of runnable jobs. In Agentora, run <strong>Fleet R0.2 Completion Plan (Review Only)</strong>, download <code>fleet-plan.json</code>, and import it with the left sidebar.</p>
      <p>Until then, no tasks will be invented and no status will be presented as verified.</p>
      <a href="https://github.com/MichaelWave369/Agentora/actions" target="_blank"
        rel="noopener noreferrer">Open Agentora Actions ↗</a>
    </div> : <>
      <div className="mission-provenance">
        <div><strong>Plan source: {plan.source === "PUBLIC_PAGES_PILOT" ?
            "Published Agentora public pilot" : "Locally imported Agentora R0.2"}</strong>
          <span>Created {plan.generated_utc} · {plan.freshness}</span>
          <span>Read-only proposed checks only. Public pilot does not cover every repo.</span></div>
        <span className={plan.freshness === "RECENT" ?
          "mission-plan-fresh" : "mission-plan-stale"}>
          {plan.freshness === "RECENT" ? "Recent snapshot" : "Stale / unverified age"}
        </span>
      </div>
      <div className="mission-filters">
        <label>Search
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Repo, test, or job..." />
        </label>
        <label>Department
          <select value={wing} onChange={e => setWing(e.target.value)}>
            <option value="all">All departments</option>
            {availableWings.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </label>
        <label>Local triage
          <select value={review} onChange={e => setReview(e.target.value)}>
            <option value="all">All proposals</option>
            <option value="pending">Not yet reviewed</option>
            <option value="reviewed">Reviewed here</option>
            <option value="pinned">Pinned missions</option>
          </select>
        </label>
      </div>
      <div className="mission-results" aria-live="polite">
        <strong>{visible.length} proposals shown</strong>
        <span>Sorted by pins, then planning priority. This is not a dispatch queue.</span>
      </div>
      {visible.length === 0 ?
        <div className="mission-empty compact">No proposals match these filters. Review the imported plan or change your filters.</div> :
        <div className="mission-cards">
          {visible.map(item => <article className={"mission-card" +
            (pinned[item.id] ? " mission-pinned" : "")} key={item.id}>
            <div className="mission-card-head">
              <span className="mission-priority">PRIORITY {item.priority ?? "UNSCORED"}</span>
              <strong>{item.repoName}</strong>
              <span className="mission-check">{item.check.replaceAll("_", " ")}</span>
            </div>
            <p>{item.summary}</p>
            <div className="mission-facts">
              <span>Wing: {item.wing}</span>
              <span>HEAD: {item.headSha?.slice(0, 12) || "UNVERIFIED"}</span>
              <span>{reviewed[item.id] ? "REVIEWED HERE ONLY" : "AWAITING REVIEW"}</span>
            </div>
            {(() => {
              const triage = missionLiveTriage(item, signals[item.repoId]);
              const loading = signalsBusy[item.repoId] === true;
              const error = signalsError[item.repoId];
              return <section className="mission-live-triage"
                aria-label={"Live GitHub triage for " + item.repoName}>
                <div className="mission-live-heading">
                  <strong>LIVE GITHUB / ON-DEMAND</strong>
                  <button type="button" disabled={loading || !onInspectRepo}
                    onClick={() => onInspectRepo(item.repoId)}>
                    {loading ? "Checking GitHub…" : triage.live ? "Refresh GitHub" : "Check live GitHub"}
                  </button>
                </div>
                <p role="status" aria-live="polite">{error ||
                  (loading ? "Reading current public GitHub metadata only…" : triage.message)}</p>
                {triage.live && <>
                  <div className="mission-live-facts">
                    <span>Current HEAD <code>{triage.currentSha.slice(0,12)}</code></span>
                    <span>Plan source: {triage.headStatus === "PLAN_SHA_MOVED" ?
                      "MOVED / REVIEW PLAN AGAIN" :
                      triage.headStatus === "PLAN_SHA_MATCHES_CURRENT_HEAD" ?
                      "MATCHES OBSERVED HEAD" : "UNVERIFIED"}</span>
                    <span>CI: {triage.ciMessage}</span>
                    <span>Open PRs observed: {triage.openPrCountObserved}{triage.prListPartial ?
                      "+ (partial first page)" : ""}</span>
                  </div>
                  {triage.openPrs.length > 0 && <div className="mission-live-prs">
                    <strong>Recent open PRs · inspect manually</strong>
                    {triage.openPrs.map(pr => <a key={pr.number}
                      href={pr.url} target="_blank" rel="noopener noreferrer">
                      #{pr.number} {pr.title}{pr.draft ? " (draft)" : ""}
                    </a>)}
                  </div>}
                  <small>Observed {triage.observedAt}. Only the selected public repository was checked.
                    Exact-HEAD CI is not a full build, release, deployment, product or merge certification.</small>
                </>}
              </section>;
            })()}
            <div className="mission-actions">
              <button type="button" onClick={() => onVisit(item.repoName)}>
                Visit desk
              </button>
              <button type="button" onClick={() => onPin(item.id)}>
                {pinned[item.id] ? "Unpin" : "Pin"}
              </button>
              <button type="button" onClick={() => onReview(item.id)}>
                {reviewed[item.id] ? "Undo local review" : "Mark locally reviewed"}
              </button>
              <button type="button" onClick={() => copyHandoff(item)}>
                Copy review handoff
              </button>
            </div>
          </article>)}
        </div>}
    </>}
    {notice && <p className="mission-notice" role="status">{notice}</p>}
    <footer className="mission-footer">
      <strong>SAFETY INTERLOCK ACTIVE</strong>
      <span>Local review and pin flags exist only in this browser session. Neither option approves code, runs a build, merges a PR or changes Agentora.</span>
    </footer>
  </section>;
}
