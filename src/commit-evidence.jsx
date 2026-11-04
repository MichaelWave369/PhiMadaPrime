import React, { useEffect, useRef, useState } from "react";
import { readCommitEvidence, evidenceHandoff } from "./commit-evidence.mjs";
import { TurnProvenance } from "./turn-provenance.jsx";
import "./turn-provenance.css";
import {
  reviewAgentoraR03, R03_MAX_REQUEST_BYTES, R03_MAX_RECEIPT_BYTES
} from "./agentora-r03-return.mjs";

function EvidenceCard({ title, status, children }) {
  return <section className="r30-card">
    <div className="r30-card-head">
      <strong>{title}</strong><span className={status === "OBSERVED" ? "observed" :
        status === "UNAVAILABLE" ? "unavailable" : "local"}>{status}</span>
    </div>
    {children}
  </section>;
}
function CheckSummary({ evidence }) {
  if (evidence.state === "UNAVAILABLE") return <>
    <p className="r30-warning">GitHub check-run evidence unavailable. No CI conclusion inferred.</p>
    <small>{evidence.reason}</small>
  </>;
  return <>
    <p><strong>{evidence.checks?.length || evidence.runs.length}</strong> check runs observed of {
      evidence.totalReported} reported by GitHub.</p>
    <p className="r30-facts"><span>Passed: {evidence.counts.success}</span>
      <span>Other completed: {evidence.counts.nonSuccess}</span>
      <span>Not completed: {evidence.counts.unfinished}</span></p>
    {evidence.partial && <p className="r30-warning">
      Incomplete observation. Additional checks or excluded entries may exist.</p>}
    {!evidence.partial && <p className="r30-muted">Observation: {
      evidence.summary.replaceAll("_"," ")}. This is not required-check certification.</p>}
    {evidence.runs.length ? <ul className="r30-evidence-list">
      {evidence.runs.map(check=><li key={check.id}>
        <div><strong>{check.name}</strong><small>{check.provider} · {
          check.status} · {check.conclusion || "no conclusion"}</small></div>
        {check.url && <a href={check.url} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}
      </li>)}
    </ul> : <p>No check runs in this response.</p>}
  </>;
}
export function CommitEvidence({repo,history,commit}) {
  const [bundle,setBundle]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [requestFile,setRequestFile]=useState(null);
  const [receiptFile,setReceiptFile]=useState(null);
  const [local,setLocal]=useState(null);
  const [localBusy,setLocalBusy]=useState(false);
  const [localError,setLocalError]=useState("");
  const requestInput=useRef(null);
  const receiptInput=useRef(null);
  const isMounted=useRef(true);
  useEffect(()=>()=>{isMounted.current=false;},[]);
  const isCurrent=()=>isMounted.current;

  async function inspect() {
    if(busy)return;
    setBusy(true);setError("");setNotice("");setBundle(null);setLocal(null);
    try {
      const result=await readCommitEvidence(repo,history,commit);
      if(isCurrent())setBundle(result);
    }catch {
      if(isCurrent())setError(
        "Commit identity or GitHub read failed. Nothing has been certified.");
    }finally{if(isCurrent())setBusy(false);}
  }
  async function correlate() {
    if(!requestFile || !receiptFile || localBusy)return;
    setLocal(null);setLocalError("");setLocalBusy(true);setNotice("");
    try {
      if(requestFile.size > R03_MAX_REQUEST_BYTES ||
         receiptFile.size > R03_MAX_RECEIPT_BYTES) {
        throw Error("INPUT_TOO_LARGE");
      }
      const [reqBytes,receiptBytes]=await Promise.all([
        requestFile.arrayBuffer(),receiptFile.arrayBuffer()
      ]);
      const result=await reviewAgentoraR03(
        new Uint8Array(reqBytes),new Uint8Array(receiptBytes),repo,null,null);
      if(result.sourceSha !== commit.sha || result.independentChecksRun !== 0 ||
         result.productVerified !== false || result.mergeAuthorized !== false) {
        throw Error("COMMIT_OR_AUTHORITY_MISMATCH");
      }
      if(isCurrent())setLocal(result);
    }catch(error) {
      if(isCurrent())setLocalError(
        "Local R0.3 receipt not correlated with this exact commit: " +
        (error?.message || "invalid file pair"));
    }finally {if(isCurrent())setLocalBusy(false);}
  }
  function resetLocal() {
    setRequestFile(null);setReceiptFile(null);setLocal(null);setLocalError("");
    if(requestInput.current)requestInput.current.value="";
    if(receiptInput.current)receiptInput.current.value="";
  }
  async function copy() {
    try {
      if(!bundle||!navigator.clipboard?.writeText)throw Error("NO_CLIPBOARD");
      await navigator.clipboard.writeText(evidenceHandoff(bundle,local));
      setNotice("Evidence summary copied for manual review. No action submitted.");
    }catch {setNotice("Clipboard unavailable. No evidence handoff was copied.");}
  }
  const loaded=bundle?.sha === commit.sha && bundle?.repository === repo.full_name;
  return <section className="r30-bay" aria-label="R30 exact-commit evidence nervous system">
    <header className="r30-header">
      <div><small>ΦMADA PRIME / R30 / EVIDENCE NERVOUS SYSTEM</small>
        <h4>WHO, WHAT, AND WHICH CHECKS?</h4>
        <p>Correlate a selected historical commit with GitHub's associated PRs,
          exact-SHA check runs, legacy statuses and an optional local Agentora intake.</p>
      </div>
      <span>OBSERVATIONS ONLY · NO AGENT ATTRIBUTION</span>
    </header>
    <div className="r30-selection">
      <div><strong>Selected commit</strong><code>{commit.sha}</code>
        <small>First parent: {commit.parentSha||"ROOT"}</small></div>
      <button type="button" onClick={inspect} disabled={busy}>
        {busy?"Reading GitHub evidence…":"Inspect PR + CI evidence"}
      </button>
    </div>
    {error && <p className="r30-warning" role="alert">{error}</p>}
    {!loaded && !busy && !error && <p className="r30-muted">
      Nothing has been fetched for this SHA. Inspecting is opt-in and does not
      trigger CI, review, code execution or agent dispatch.</p>}
    {loaded && <>
      <p className="r30-provenance">GitHub observation {bundle.observedAt}.
        Each panel reports only what its own endpoint returned for <code>{bundle.sha.slice(0,12)}</code>.</p>
      <div className="r30-chain" aria-label="Commit evidence chain">
        <span>COMMIT OBSERVED</span><b aria-hidden="true">→</b>
        <span>{bundle.prs.state==="OBSERVED"?"PR ASSOCIATIONS READ":"PR UNKNOWN"}</span>
        <b aria-hidden="true">→</b>
        <span>{bundle.checks.state==="OBSERVED"?"CI CHECKS READ":"CI UNKNOWN"}</span>
        <b aria-hidden="true">→</b>
        <span>HUMAN VERIFICATION STILL REQUIRED</span>
      </div>
      <div className="r30-grid">
        <EvidenceCard title="GitHub-associated pull requests" status={bundle.prs.state}>
          {bundle.prs.state==="UNAVAILABLE" ?
            <p className="r30-warning">Unable to read associated PRs. No relationship assumed.</p> : <>
            <p>{bundle.prs.prs.length} associated PRs returned.</p>
            {bundle.prs.partial && <p className="r30-warning">
              First 10 only; additional PR associations may exist.</p>}
            {bundle.prs.excluded>0 && <p className="r30-warning">
              {bundle.prs.excluded} untrusted or duplicate entries excluded.</p>}
            {bundle.prs.prs.length ? <ul className="r30-evidence-list">
              {bundle.prs.prs.map(pr=><li key={pr.number}>
                <div><strong>#{pr.number} · {pr.title}</strong>
                  <small>{pr.relation.replaceAll("_"," ")} · {
                    pr.merged?"merged":pr.state} · {pr.draft?"draft":"not draft"}</small></div>
                <a href={pr.url} target="_blank" rel="noopener noreferrer">PR ↗</a>
              </li>)}
            </ul> : <p>No associated PR returned by this bounded query.</p>}
            <small>Association is reported by GitHub; it does not establish who
              authored the code or that a review was approved.</small>
          </>}
        </EvidenceCard>
        <EvidenceCard title="GitHub exact-SHA check runs" status={bundle.checks.state}>
          <CheckSummary evidence={bundle.checks} />
        </EvidenceCard>
        <EvidenceCard title="Legacy commit statuses" status={bundle.legacy.state}>
          {bundle.legacy.state==="UNAVAILABLE" ?
            <p className="r30-warning">Legacy statuses unavailable, not assumed green or red.</p> : <>
            <p>{bundle.legacy.summary==="NO_LEGACY_STATUS_CONTEXTS" ?
              "No legacy status contexts reported. GitHub may still show a pending aggregate for zero contexts." :
              bundle.legacy.totalReported+" legacy status contexts reported."}</p>
            {bundle.legacy.partial && <p className="r30-warning">Legacy context observation is incomplete.</p>}
            {bundle.legacy.contexts.length>0 && <ul className="r30-evidence-list">
              {bundle.legacy.contexts.map((item,index)=><li key={index}>
                <strong>{item.context}</strong><span>{item.state}</span>
              </li>)}
            </ul>}
          </>}
        </EvidenceCard>
        <EvidenceCard title="Agentora execution provenance" status="NOT VERIFIED">
          <p>No authenticated Agentora execution or independent test receipt is
            attached automatically to GitHub commit metadata.</p>
          <p className="r30-muted">An R0.3 intake acknowledgement can confirm
            exact source/request lineage locally, but explicitly records
            <strong> zero independent checks run</strong>.</p>
          <details className="r30-agentora">
            <summary>Correlate local Agentora R0.3 request + intake receipt</summary>
            <p>Both files stay in browser memory. The original request bytes are
              SHA-256 correlated to the receipt using the existing R27 validator.</p>
            <label>Original PhiMada verification request JSON
              <input type="file" accept=".json,application/json"
                ref={requestInput} onChange={event=>{
                  setRequestFile(event.target.files?.[0]||null);
                  setLocal(null);setLocalError("");
                }}/>
            </label>
            <label>Agentora local verification-intake.json
              <input type="file" accept=".json,application/json"
                ref={receiptInput} onChange={event=>{
                  setReceiptFile(event.target.files?.[0]||null);
                  setLocal(null);setLocalError("");
                }}/>
            </label>
            <div className="r30-file-actions">
              <button type="button" onClick={correlate}
                disabled={!requestFile||!receiptFile||localBusy}>
                {localBusy?"Correlating files…":"Check exact-SHA local receipt"}
              </button>
              <button type="button" onClick={resetLocal}>Clear local files</button>
            </div>
            {localError && <p role="alert" className="r30-warning">{localError}</p>}
            {local && <p className="r30-local" role="status">
              Local R0.3 request digest + intake receipt correlated with selected
              commit {local.sourceSha.slice(0,12)}. {local.requiredChecks} planned
              checks, <strong>0 independently executed</strong>. No producer
              authentication, approval, dispatch, or merge authority.
            </p>}
          </details>
          <TurnProvenance repo={repo} history={history} commit={commit} bundle={bundle} />
        </EvidenceCard>
      </div>
      <button type="button" className="r30-copy" onClick={copy}>
        Copy R30 evidence-only handoff
      </button>
      {notice && <p role="status" className="r30-notice">{notice}</p>}
      <p className="r30-disclaimer">
        Historical CI observations are not required-check coverage, device tests,
        production readiness, or proof that an AI agent performed work.
        The current branch may have advanced since this observation.
        Recheck HEAD, rulesets, and independent acceptance before release.
      </p>
    </>}
  </section>;
}
