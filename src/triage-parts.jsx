import React, { useMemo, useState } from "react";
import { triageForRecord, triageOverview, triageSummary } from "./triage.mjs";

export function TriageForDesk({ repo, record }) {
  const prompts = triageForRecord(repo, record);
  return <section className="triage-desk" aria-label="Suggested evidence reviews">
    <h3>WHAT SHOULD WE CHECK NEXT?</h3>
    <p>These are metadata-derived ideas, not Agentora jobs or product completion decisions.</p>
    <div className="triage-desk-list">
      {prompts.map(item => <article key={item.code}>
        <strong>{item.title}</strong>
        <small>{item.why}</small>
        <span>{item.action}</span>
      </article>)}
    </div>
  </section>;
}

export function TriageCoverage({ coverage, rows, onJump }) {
  const [filter, setFilter] = useState("attention");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const all = useMemo(() => triageOverview(coverage, rows), [coverage, rows]);
  const stats = useMemo(() => triageSummary(all), [all]);
  const visible = useMemo(() => all.filter(item => {
    if (filter === "attention" && item.level === "pending") return false;
    if (filter === "stale" && !["stale", "limited"].includes(item.level)) return false;
    if (filter === "unscanned" && item.code !== "WAIT_FOR_OBSERVATION") return false;
    return !query.trim() || (item.repoName + " " + item.title + " " + item.code)
      .toLowerCase().includes(query.trim().toLowerCase());
  }), [all, filter, query]);
  return <section className="triage-board" aria-label="Rolling fleet coverage triage">
    <div className="triage-header">
      <h3>Evidence Triage</h3>
      <small>Review hints only • Not Agentora tasks</small>
    </div>
    <p>{stats.affectedRepositories} public repositories have metadata-based review prompts.
      {stats.awaitingScan} await their first cohort scan.</p>
    <div className="triage-filters">
      <label>Focus
        <select value={filter} onChange={e => { setFilter(e.target.value); setLimit(8); }}>
          <option value="attention">Observed evidence gaps</option>
          <option value="stale">Stale or limited</option>
          <option value="unscanned">Awaiting first scan</option>
          <option value="all">All prompts</option>
        </select>
      </label>
      <label>Find repo
        <input type="search" value={query} placeholder="Repo or check…"
          onChange={e => { setQuery(e.target.value); setLimit(8); }} />
      </label>
    </div>
    <small>{visible.length} advisory prompts match this view.</small>
    <div className="triage-rows">
      {visible.slice(0, limit).map(item =>
        <button type="button" key={item.repoId + "/" + item.code}
          onClick={() => onJump(item.repoName)}
          aria-label={"Visit " + item.repoName + " to review " + item.title}>
          <strong>{item.repoName}</strong>
          <span>{item.title}</span>
          <small>{item.level.toUpperCase()} · Inspect desk</small>
        </button>)}
      {!visible.length && <p>No evidence prompts match the selected filter.</p>}
    </div>
    {visible.length > limit &&
      <button type="button" className="triage-more" onClick={() => setLimit(x => x + 12)}>
        Show more ({visible.length - limit} remaining)
      </button>}
    <p className="triage-note">None of these suggestions dispatch work, approve merges,
      or certify a product. For real implementation tasks, use the separate Agentora Mission Board.</p>
  </section>;
}
