import React,{useState} from "react";
import {
  R20_MAX_REVIEW_BYTES,R20_MAX_ARCHIVE_BYTES,
  parseR20CouncilReview,corroborateR20Council
} from "./r20-council-browser-evidence.mjs";

// Optional R19 evidence review. No automatic workflow runs, cache, models,
// unsigned scientific claims, approval or fleet state mutations.
export function R20CouncilBrowserEvidence({catalog}) {
  const [review,setReview]=useState(null);
  const [zip,setZip]=useState(null);
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function importReview(event) {
    const file=event.target.files?.[0]||null;
    event.target.value="";
    setReview(null);setZip(null);setResult(null);setError("");
    if(!file)return;
    try {
      if(file.size<2||file.size>R20_MAX_REVIEW_BYTES)
        throw new Error("SIZE");
      setReview(parseR20CouncilReview(await file.text(),catalog));
    } catch {
      setError("R20 reviewer JSON refused. Use the local R20 reviewer on an original R19 Actions ZIP.");
    }
  }
  function importZip(event) {
    const file=event.target.files?.[0]||null;
    event.target.value="";
    setZip(null);setResult(null);setError("");
    if(!file)return;
    if(file.size<1||file.size>R20_MAX_ARCHIVE_BYTES||
      !file.name.toLowerCase().endsWith(".zip")) {
      setError("Original R19 GitHub Actions ZIP must be smaller than 2 MB.");
      return;
    }
    setZip(file);
  }
  async function reviewZip() {
    if(!review||!zip||busy)return;
    setBusy(true);setError("");setResult(null);
    try {
      setResult(await corroborateR20Council(review,zip,catalog));
    } catch {
      // No raw payloads, token material, JSON, or user filenames echoed.
      setError("Council browser evidence held: ZIP digest or public GitHub metadata did not corroborate.");
    } finally {setBusy(false);}
  }
  function clear(){setReview(null);setZip(null);setResult(null);setError("");}
  return <details id="phimada-r20-council-browser" className="browser-evidence r20-council-browser" aria-label="R20 Council browser evidence">
    <summary>
      <span><strong>R20 / COUNCIL LIVE BROWSER EVIDENCE</strong>
        <small>Original R19 Actions ZIP + independent local review + GitHub source check</small>
      </span>
      <span>{result?result.sourceCurrent?"API-CORRELATED":"HISTORICAL / HELD":
        review?"LOCAL REVIEW ONLY":"NOT IMPORTED"}</span>
    </summary>
    <div className="browser-evidence-body">
      <p>R19 is an <strong>operator-triggered</strong> live browser test. R20 reads its actual original Actions artifact, never creates or reruns the workflow. No browser test has been inferred from a green PR.</p>
      <a href="https://github.com/MichaelWave369/PhiMadaPrime/actions/workflows/r19-council-browser.yml"
        target="_blank" rel="noopener noreferrer">Open manual R19 Council browser workflow ↗</a>
      <p>Run <code>python scripts/r20_review_council_browser.py --run-id ID --artifact-zip original.zip --output r20-review.json</code> in a local trusted checkout. It checks the ZIP interior against the live public GitHub Actions run. Then import <strong>both</strong> files here.</p>
      <div className="browser-evidence-upload">
        <label>1. R20 local review JSON
          <input type="file" accept=".json,application/json" disabled={busy} onChange={importReview}/>
        </label>
        <label>2. Original R19 Actions ZIP
          <input type="file" accept=".zip,application/zip"
            disabled={busy||!review} onChange={importZip}/>
        </label>
      </div>
      {review&&<p>Reported R19 run <strong>#{review.runId}</strong>,
        tested source <code>{review.sourceSha.slice(0,12)}</code>.
        Review data is unsigned until archive and GitHub checks complete.</p>}
      <div className="browser-evidence-actions">
        <button type="button" disabled={busy||!review||!zip} onClick={reviewZip}>
          {busy?"Checking GitHub and archive…":"Corroborate R19 ZIP + GitHub source"}
        </button>
        <button type="button" disabled={busy} onClick={clear}>Clear R20 review</button>
        {review&&<a href={review.runUrl} target="_blank" rel="noopener noreferrer">
          Open original R19 Actions run ↗</a>}
      </div>
      <p role="status" aria-live="polite">{busy?"Review in progress…":
        error||(!result?"No corroborated R19 browser evidence.":"R19 metadata correlated; review remains non-authorizing.")}</p>
      {result&&<section className="browser-evidence-result" aria-label="Source-bounded R19 browser result">
        <strong>{result.sourceCurrent?
          "R19 Actions artifact correlated at currently observed main SHA":
          result.state==="R20_HEAD_CHANGED_DURING_REVIEW"?
          "Main moved during correlation; current acceptance HELD":
          "Historical R19 browser evidence: main has moved"}</strong>
        <span>Original ZIP and GitHub digest: matched.</span>
        <span>R19 checks: <strong>9/9 PASS reported by the imported R20 local reviewer</strong>. This browser has not replayed Chromium or parsed the ZIP interior.</span>
        <span>Tested source <code>{result.sourceSha}</code></span>
        <span>Current observed HEAD <code>{result.observedHeadSha}</code></span>
        <span>Scientific evidence: NO · Council source authenticated: NO · Full accessibility verified: NO · Product complete: NO · Merge or dispatch authorized: NO.</span>
      </section>}
      <p className="browser-evidence-warning">The local R20 review JSON is unsigned and could be fabricated. The independent Python CLI is responsible for checking the original ZIP interior. This browser checks ZIP SHA-256, GitHub run and artifact metadata, and public main HEAD twice. A valid receipt is evidence of a bounded automated R19 browser journey, not authentic science or a permission grant. Nothing is uploaded, stored persistently or dispatched.</p>
    </div>
  </details>;
}
