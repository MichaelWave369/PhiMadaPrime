import React, { useMemo, useState } from "react";
import { parseDependencyRules, previewFleetSchedule } from "./scheduler.mjs";

const LABELS = {
  STALE_OR_MISSING_PLAN: "Plan is stale or missing; import a recent Agentora plan",
  MISSING_OR_CONFLICTING_SOURCE_SHA: "Source revision missing or inconsistent across proposed checks",
  REPOSITORY_RESERVED_IN_PREVIEW: "Repository already reserved in this local simulation",
  DEPENDENCY_RECEIPT_NOT_VERIFIED: "Prerequisite has no independently verified completion receipt"
};

// All values are browser-session planning inputs; never persisted or dispatched.
export function SchedulerPreview({ queue, plan, catalog }) {
  const [expanded, setExpanded] = useState(false);
  const [parallelism, setParallelism] = useState(4);
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const [dependencies, setDependencies] = useState([]);
  const [error, setError] = useState("");
  const result = useMemo(() => previewFleetSchedule(queue, plan, {
    parallelism, dependencies
  }), [queue, plan, parallelism, dependencies]);
  function applyRules() {
    try {
      const checked = parseDependencyRules(draft, catalog);
      setDependencies(checked);
      setApplied(draft);
      setError("");
    } catch (cause) {
      // Fail closed: invalid local rules must not be silently discarded.
      setError(cause.message || "RULES_INVALID");
    }
  }
  return <section className="scheduler-preview" aria-label="Fleet concurrency and dependency planning preview">
    <div className="scheduler-header">
      <div>
        <small>RUNG 9 / CAUSAL FLEET PLANNING</small>
        <h3>PARALLEL DESK PLANNER</h3>
        <p>Simulate one independent revision-scoped work unit per repo. No workers are assigned.</p>
      </div>
      <button type="button" onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}>{expanded ? "Hide planner" : "Show planner"}</button>
    </div>
    {expanded && <>
      <div className="scheduler-settings">
        <label>Preview desk capacity (1–12)
          <select value={parallelism} onChange={e => setParallelism(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n =>
              <option value={n} key={n}>{n} parallel repos</option>)}
          </select>
        </label>
        <label className="scheduler-rules">Explicit dependency lines (optional)
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
            placeholder={"BTM needs OverStrings\nPhiOS needs ThinkTank"}
            aria-describedby="scheduler-rule-help" />
        </label>
        <button type="button" onClick={applyRules}>Validate local dependencies</button>
      </div>
      <p id="scheduler-rule-help" className="scheduler-caution">
        Only exact names from the live public catalog are accepted. A dependency is held until
        independent completion evidence exists in Agentora; this preview cannot invent that evidence.
      </p>
      {error && <p className="scheduler-error" role="alert">
        Invalid rules ({error}). Correct and validate the draft; no slots are shown.</p>}
      {!error && <>
        {draft !== applied && <p className="scheduler-caution">Dependency draft not applied yet.
          Showing the last validated rules.</p>}
        <div className="scheduler-stats">
          <span><strong>{result.slots.length}</strong> simulated desk slots</span>
          <span><strong>{result.backlog.length}</strong> remaining repo groups</span>
          <span><strong>{result.held.length}</strong> held for evidence</span>
          <span><strong>0</strong> real workers</span>
        </div>
        {!result.planFresh && <p className="scheduler-error" role="status">
          No recent Agentora plan. Scheduling preview is held until fresh source evidence exists.</p>}
        <div className="scheduler-columns">
          <div>
            <h4>First proposed wave</h4>
            {!result.slots.length && <p>No revision-safe candidates available.</p>}
            <ol className="scheduler-slots">{result.slots.map(job => <li key={job.repoId}>
              <strong>Desk {job.slot}: {job.repoName}</strong>
              <span>{job.jobCount} proposed checks · HEAD {job.headSha.slice(0, 12)}</span>
              <small>PREVIEW ONLY · merge gate closed</small>
            </li>)}</ol>
          </div>
          <div>
            <h4>Held / waiting</h4>
            {!result.held.length && !result.backlog.length && <p>No held jobs.</p>}
            <ul className="scheduler-held">
              {result.held.map(job => <li key={job.repoId}>
                <strong>{job.repoName}</strong>
                <span>{LABELS[job.reason] || "Not schedulable"}</span>
                {job.dependencies.length > 0 &&
                  <small>Needs: {job.dependencies.join(", ")}</small>}
              </li>)}
              {result.backlog.map(job => <li key={job.repoId}>
                <strong>{job.repoName}</strong><span>Awaiting preview capacity</span>
              </li>)}
            </ul>
          </div>
        </div>
      </>}
    </>}
    <p className="scheduler-caution">Immutable Git SHAs, exact-head CI, approvals, branch
      protections and verified dependency receipts must be rechecked by governed workers.
      Local pins, checklists and this schedule never authorize execution or merge.</p>
  </section>;
}
