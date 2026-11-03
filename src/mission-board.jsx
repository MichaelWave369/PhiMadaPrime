import React, { useMemo, useState } from "react";
import { filterMissions, handoffText, missionStats } from "./missions.mjs";
import { WINGS } from "./tower.mjs";

export function MissionBoard({ queue, plan, reviewed, pinned,
  onReview, onPin, onVisit, onClose }) {
  const [query, setQuery] = useState("");
  const [wing, setWing] = useState("all");
  const [review, setReview] = useState("all");
  const [notice, setNotice] = useState("");
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
        <div><strong>Plan source: Agentora R0.2</strong>
          <span>Created {plan.generated_utc} · {plan.freshness}</span></div>
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
