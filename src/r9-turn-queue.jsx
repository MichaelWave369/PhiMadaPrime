import React, { useEffect, useState } from "react";
import { readTurnResult, TURN_REPO } from "./autonomous-turn.mjs";
import { nextTurnAction, parseReadinessProfiles, parseTurnQueue, SNAPSHOT_LIMIT } from "./r9-turn-queue.mjs";

const GITHUB = "https://github.com/" + TURN_REPO;
const LOOPBACK = ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname);
const READINESS = "https://github.com/MichaelWave369/PhiOS/blob/main/phishell/src/ecosystem/fleet-readiness.json";
const READINESS_JSON = "https://raw.githubusercontent.com/MichaelWave369/PhiOS/main/phishell/src/ecosystem/fleet-readiness.json";

function Link({ href, children }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export function R9TurnQueue() {
  const [snapshot, setSnapshot] = useState(null);
  const [failure, setFailure] = useState("");
  const [verified, setVerified] = useState(null);
  const [checking, setChecking] = useState(false);
  const [profiles, setProfiles] = useState(null);
  const [profileStatus, setProfileStatus] = useState("");
  useEffect(() => {
    if (!LOOPBACK) return;
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("./fleet/r9-turns.json", {
          cache: "no-store", credentials: "omit", signal: controller.signal,
        });
        if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const next = parseTurnQueue(await response.text());
          if (!controller.signal.aborted) {
            setSnapshot(next);
            setFailure("");
          }
        }
      } catch {
        if (!controller.signal.aborted) setFailure("The local queue snapshot could not be refreshed.");
      } finally {
        loading = false;
      }
    }
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  async function importQueue(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    setFailure("");
    setVerified(null);
    try {
      if (file.size > SNAPSHOT_LIMIT) throw Error();
      setSnapshot(parseTurnQueue(await file.text()));
    } catch {
      setFailure("This file is not a valid Agentora queue snapshot.");
    }
  }
  async function verify(row) {
    setChecking(true);
    setFailure("");
    setVerified(null);
    try {
      const result = await readTurnResult(row.pr_number);
      if (result.sourceSha !== row.source_sha || result.testedSha !== row.tested_sha ||
          result.runUrl !== `${GITHUB}/actions/runs/${row.run_id}` ||
          (row.merge_sha && result.mergeSha !== row.merge_sha)) throw Error();
      setVerified({ mission: row.mission_id, result });
    } catch {
      setFailure("The PR receipt could not be corroborated. Inspect its GitHub checks and owner review.");
    } finally {
      setChecking(false);
    }
  }
  async function readReadiness() {
    setProfileStatus("Reading PhiOS profiles…");
    try {
      const response = await fetch(READINESS_JSON, { credentials: "omit", cache: "no-store" });
      if (!response.ok) throw Error();
      setProfiles(parseReadinessProfiles(await response.text()));
      setProfileStatus("");
    } catch {
      setProfiles(null);
      setProfileStatus("PhiOS readiness profiles are unavailable.");
    }
  }
  return <section className="one-repo-lane" aria-label="Agentora development queue">
    <h3>Agentora development queue</h3>
    <label>Open a local R9 queue snapshot <input type="file" accept="application/json,.json" onChange={importQueue} /></label>
    {failure && <p role="alert">{failure}</p>}
    {snapshot ? <>
      <p>Observed {new Date(snapshot.generated_utc).toLocaleString()} · {snapshot.turns.length} missions
        {snapshot.truncated ? " · most recent 30 shown" : ""}</p>
      {snapshot.turns.length === 0 && <p>The R9 docs lane is empty.</p>}
      <div className="mission-cards">{snapshot.turns.map(row => <article key={row.mission_id} className="mission-card">
        <h4>{row.mission_id} · {row.state.replaceAll("_", " ")}</h4>
        <p>RepoNerve event {row.source_event_id} · scan {row.source_scan_id}
          {row.active_job && <> · Active job <strong>{row.active_job}</strong></>}</p>
        <p>Source <code>{row.source_sha}</code></p>
        <p>Exact-head CI <strong>{row.ci_status.replaceAll("_", " ")}</strong>
          {row.ci_runs.map(id => <React.Fragment key={id}> · <Link href={`${GITHUB}/actions/runs/${id}`}>{id}</Link></React.Fragment>)}</p>
        {row.tested_sha && <p>PR head <code>{row.tested_sha}</code></p>}
        {row.merge_sha && <p>Recorded merge <Link href={`${GITHUB}/commit/${row.merge_sha}`}><code>{row.merge_sha}</code></Link></p>}
        <p>{nextTurnAction(row)} {row.reason && <code>{row.reason}</code>}</p>
        {row.state === "OWNER_REVIEW" && <p>Review comment <code>APPROVE {row.task_sha256}</code><br />
          Expires {new Date(row.expires_utc).toLocaleString()}.</p>}
        {row.run_id && <Link href={`${GITHUB}/actions/runs/${row.run_id}`}>Actions run {row.run_id}</Link>}
        {row.pr_number && <> · <Link href={`${GITHUB}/pull/${row.pr_number}`}>PR #{row.pr_number}</Link>
          {" "}<button type="button" disabled={checking} onClick={() => verify(row)}>Verify result on GitHub</button></>}
        {verified?.mission === row.mission_id && <p role="status">
          GitHub confirmed {verified.result.state.replaceAll("_", " ").toLowerCase()}. {verified.result.nextAction}
        </p>}
      </article>)}</div>
    </> : <p>Connect a local queue snapshot to see requests, workers and merge evidence.</p>}
    <p>The docs lane records CI and merges. Deployment and human acceptance are separate milestones.</p>
    <details>
      <summary>PhiOS integration and Trellis distribution</summary>
      <button type="button" onClick={readReadiness}>Read PhiOS readiness profiles</button>
      {profileStatus && <p role="status">{profileStatus}</p>}
      {profiles && <ul>{profiles.map(row => <li key={row.repository}>
        <strong>{row.repository}</strong> · {row.kind} · integration {row.integration.replaceAll("_", " ")}
        {" · distribution "}{row.distribution.replaceAll("_", " ")}
        <br /><code>{row.source}</code><br />{row.acceptance.join(" ")}
      </li>)}</ul>}
      <p><Link href={READINESS}>Source profiles</Link></p>
    </details>
    <p><Link href={`${GITHUB}/issues/124`}>Fleet mission #124</Link></p>
  </section>;
}
