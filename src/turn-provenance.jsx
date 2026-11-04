import React,{useEffect,useRef,useState} from "react";
import {
  turnProvenanceEligible,verifyAgentoraR1ForCommit,r31Handoff
} from "./turn-provenance.mjs";

// The browser never uploads a receipt or submits a task here.
// All authorization evidence is read back from GitHub by the existing R1 verifier.
export function TurnProvenance({repo,history,commit,bundle}) {
  const [prNumber,setPrNumber]=useState("");
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const sequence=useRef(0);
  useEffect(()=>()=>{sequence.current++;},[]);
  if (!turnProvenanceEligible(repo)) return <div className="r31-unsupported">
    <strong>R1 verifier scope: Agentora only.</strong>
    <p>For other projects, the GitHub PR and CI observations above remain useful.
      Their worker execution is NOT authenticated. R31 does not invent a
      cross-repository agent receipt or promote self-reported identities.</p>
  </div>;
  const suggested=bundle?.prs?.state==="OBSERVED" ?
    (bundle.prs.prs||[]).filter(p=>Number.isSafeInteger(p.number)&&p.number>0) : [];

  async function inspect() {
    if(busy || !/^[1-9]\d{0,8}$/.test(prNumber))return;
    const marker=++sequence.current;
    setResult(null);setError("");setNotice("");setBusy(true);
    try {
      const value=await verifyAgentoraR1ForCommit(
        repo,history,commit,bundle,Number(prNumber)
      );
      if(marker===sequence.current)setResult(value);
    }catch(err) {
      if(marker===sequence.current) {
        const code=typeof err?.message==="string" &&
          /^(R31|TURN)_[A-Z0-9_]+$/.test(err.message) ?
          err.message : "R31_GITHUB_EVIDENCE_UNAVAILABLE";
        setError(code);
      }
    }finally{if(marker===sequence.current)setBusy(false);}
  }
  function choosePr(value) {
    sequence.current++;
    setPrNumber(value);setResult(null);setError("");setNotice("");setBusy(false);
  }
  async function copy() {
    if(!result)return;
    try {
      if(!navigator.clipboard?.writeText)throw Error("NO_CLIPBOARD");
      await navigator.clipboard.writeText(r31Handoff(result));
      setNotice("R31 evidence report copied locally. No action submitted.");
    }catch{
      setNotice("Clipboard unavailable; no R31 report was copied.");
    }
  }
  return <div className="r31-provenance" aria-label="Agentora trusted GitHub R1 execution provenance">
    <div className="r31-heading">
      <strong>R31 · Agentora GitHub-backed R1 correlation</strong>
      <span>LIVE READBACK · NO PRIVILEGED ACTIONS</span>
    </div>
    <p>Check whether this exact historical SHA is a tested Agentora R1 PR head or
      a corroborated merge commit. The existing verifier independently reads
      GitHub's owner environment approval, controller workflow/jobs, task digest,
      required exact-PR-SHA CI and post-merge record.</p>
    {suggested.length>0 && <div className="r31-suggested">
      <small>GitHub-associated PR candidates (not yet verified R1 turns):</small>
      <div className="r31-candidates">
        {suggested.map(pr=><button key={pr.number} type="button"
          onClick={()=>choosePr(String(pr.number))} disabled={busy}>
          #{pr.number}
        </button>)}
      </div>
    </div>}
    <label>Agentora Autonomous Turn R1 pull request number
      <input type="number" min="1" step="1" inputMode="numeric"
        value={prNumber} disabled={busy}
        onChange={e=>choosePr(e.target.value)} placeholder="e.g. 87"
        aria-label="Agentora R1 PR number"/>
    </label>
    <button type="button" onClick={inspect}
      disabled={busy||!/^[1-9]\d{0,8}$/.test(prNumber)}>
      {busy?"Correlating independent GitHub records…":"Verify R1 return against this Chronicle SHA"}
    </button>
    {error && <p className="r31-hold" role="alert">
      Verification HELD: <code>{error}</code>. This may mean no complete
      R1 return exists yet, the PR is unrelated to this commit, or a
      GitHub requirement could not be corroborated. No success inferred.
    </p>}
    {result && <div className="r31-result" role="status">
      <strong>LIVE GITHUB R1 RETURN CORRELATED</strong>
      <div className="r31-fact-grid">
        <div><small>Selected commit relation</small><b>{
          result.relation.replaceAll("_"," ")}</b></div>
        <div><small>Owner environment approval</small><b>Corroborated</b></div>
        <div><small>Controller workflow + merge-gate job</small><b>Corroborated</b></div>
        <div><small>Required exact-SHA CI names</small><b>3 observed passing</b></div>
        <div><small>Merge readback</small><b>{
          result.mergeReadbackCorroborated?"Corroborated":"Not merged"}</b></div>
        <div><small>Product acceptance</small><b>NOT verified</b></div>
      </div>
      <p>Task <code>{result.taskId}</code> · PR <a href={result.prUrl}
        target="_blank" rel="noopener noreferrer">#{result.prNumber}</a>
        {" · "}<a href={result.runUrl} target="_blank" rel="noopener noreferrer">
          Original controlled GitHub workflow ↗</a></p>
      <p>Starting SHA <code>{result.sourceSha}</code></p>
      <p>Tested PR head <code>{result.testedSha}</code></p>
      {result.mergeSha && <p>Merge SHA <code>{result.mergeSha}</code></p>}
      <p>Outstanding human acceptance: {result.outstandingAcceptance.length} item(s).</p>
      {result.outstandingAcceptance.length>0 && <ul>{
        result.outstandingAcceptance.map((item,i)=><li key={i}>{item}</li>)
      }</ul>}
      <p>Next action: {result.nextAction||"Independently review remaining acceptance."}</p>
      <p className="r31-limit">GitHub-owned approval/run records are correlated,
        but no cryptographic identity of an individual AI model is established.
        The R1 worker performs deterministic, preapproved edits; this is not
        evidence that a model generated the patch. Human and device acceptance
        remain outside this workflow.</p>
      <button type="button" onClick={copy}>Copy R31 read-only provenance report</button>
    </div>}
    {notice && <p role="status" className="r31-notice">{notice}</p>}
    <p className="r31-foot">A PR number or associated PR is never itself trusted
      proof. Missing, stale, conflicting or incomplete GitHub records cause
      the trusted reader to hold. No PR approval, workflow dispatch, merge
      or local file import occurs here.</p>
  </div>;
}
