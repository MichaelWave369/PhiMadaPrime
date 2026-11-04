import React, { useState } from "react";
import { turnEligible,prepareTurnTask,listTurnPrs,readTurnResult } from "./autonomous-turn.mjs";

export function AutonomousTurn({repo,signal}) {
  const [task,setTask]=useState(null),[rows,setRows]=useState([]);
  const [number,setNumber]=useState(""),[result,setResult]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  if(!turnEligible(repo))return null;
  async function run(action) {
    setBusy(true);setError("");setResult(null);
    try {await action();} catch(e) {
      setError(/^TURN_[A-Z0-9_]+$/.test(e?.message)?e.message:"TURN_GITHUB_READ_UNAVAILABLE");
    } finally {setBusy(false);}
  }
  function download() {
    if(!task)return;
    const url=URL.createObjectURL(new Blob([task.json+"\n"],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=task.task.task_id+".json";
    anchor.click();URL.revokeObjectURL(url);
  }
  return <details className="one-repo-intake-return" aria-label="Autonomous development turn">
    <summary>Autonomous Turn R1 · owner approval → real GitHub result</summary>
    <p>Prepare one exact-source Agentora task. GitHub receives the task as a request;
      its protected environment then asks you to approve the exact task digest.
      Once the reviewed infrastructure and publisher credential are installed,
      the worker can edit, test, open a PR and check CI. Documentation may merge
      within the approved scope. Code requires the existing independent review.</p>
    <div className="one-repo-lane-actions">
      <button type="button" disabled={busy||!signal} onClick={()=>run(async()=>{
        setTask(null);setTask(await prepareTurnTask(repo,signal,"docs"));
      })}>Prepare documentation task</button>
      <button type="button" disabled={busy||!signal} onClick={()=>run(async()=>{
        setTask(null);setTask(await prepareTurnTask(repo,signal,"code"));
      })}>Prepare small code task</button>
    </div>
    {task&&<div>
      <p>Task <code>{task.task.task_id}</code> changes only <code>{task.task.allowed_paths[0]}</code>.
        Expires {new Date(task.task.expires_utc).toLocaleString()}.</p>
      <p>Task digest: <code>{task.digest}</code></p>
      <p>{task.task.human_scope}</p>
      <a href={task.submissionUrl} target="_blank" rel="noopener noreferrer">Submit this task request in GitHub</a>
      {" · "}<button type="button" onClick={download}>Download task JSON</button>
      <p>After submission, open the linked Actions run, review its task artifact,
        then approve <code>autonomous-turn-owner</code> with the exact comment
        {" "}<code>APPROVE {task.digest}</code>. Submitting the issue does not approve it.</p>
    </div>}
    <p><a href="https://github.com/MichaelWave369/Agentora/blob/main/docs/AUTONOMOUS_TURN_R1.md"
      target="_blank" rel="noopener noreferrer">Setup, authority boundaries and recovery</a></p>
    <div className="one-repo-lane-actions">
      <button type="button" disabled={busy} onClick={()=>run(async()=>setRows(await listTurnPrs()))}>
        Refresh recent turn PRs
      </button>
    </div>
    {rows.length>0&&<ul>{rows.map(row=><li key={row.number}>
      <button type="button" disabled={busy} onClick={()=>{
        setNumber(String(row.number));run(async()=>setResult(await readTurnResult(row.number)));
      }}>Inspect #{row.number}</button>{" "}{row.title} · {row.merged?"GitHub reports merged":row.state}
    </li>)}</ul>}
    <label>Agentora turn PR number
      <input type="number" min="1" disabled={busy} value={number} onChange={e=>{setNumber(e.target.value);setResult(null);setError("");}}/>
    </label>
    <button type="button" disabled={busy||!number} onClick={()=>run(async()=>
      setResult(await readTurnResult(Number(number))))}>
      {busy?"Reading GitHub…":"Verify returned result against GitHub"}
    </button>
    {error&&<p role="alert">Result held: <code>{error}</code>. A missing return can mean
      the turn is pending, held, expired or has not run. No completion is inferred.</p>}
    {result&&<div role="status" aria-live="polite">
      <strong>{result.state.replaceAll("_"," ")}</strong>
      <dl className="one-repo-lane-facts">
        <div><dt>Task</dt><dd>{result.taskId}</dd></div>
        <div><dt>Repository</dt><dd>{result.repository}</dd></div>
        <div><dt>Starting source SHA</dt><dd><code>{result.sourceSha}</code></dd></div>
        <div><dt>PR</dt><dd><a href={result.prUrl} target="_blank" rel="noopener noreferrer">#{result.prNumber}</a></dd></div>
        <div><dt>Final tested PR SHA</dt><dd><code>{result.testedSha}</code></dd></div>
        <div><dt>Repair attempts</dt><dd>{result.repairAttempts}</dd></div>
        <div><dt>Merge decision</dt><dd>{result.mergeDecision}</dd></div>
        <div><dt>Verified merge SHA</dt><dd><code>{result.mergeSha||"Not merged"}</code></dd></div>
        <div><dt>Project verified complete</dt><dd>No · acceptance remains open</dd></div>
      </dl>
      <p>Required CI: {result.checks.map(c=>c.name+": "+c.conclusion).join(" · ")}</p>
      <p>Outstanding acceptance: {result.outstandingAcceptance.join("; ")}</p>
      <p>Next action: {result.nextAction}</p>
      <a href={result.runUrl} target="_blank" rel="noopener noreferrer">Inspect authorization and execution run</a>
      <p>Read directly from public GitHub. Owner review, current PR head, CI workflow
        and merge records were correlated. This panel does not certify full product acceptance.</p>
    </div>}
  </details>;
}
