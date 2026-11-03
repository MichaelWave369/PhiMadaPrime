import React, { useState } from "react";
import {
  parseEvidenceReview, corroborateEvidence,
  EVIDENCE_MAX_REVIEW_BYTES, EVIDENCE_MAX_ZIP_BYTES
} from "./evidence-bay.mjs";

// All files remain in this browser tab. This is a review console,
// not an approval workflow or a substitute for Agentora R0.7.
export function EvidenceBay({ catalog }) {
  const [review, setReview] = useState(null);
  const [archive, setArchive] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function importReview(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setReview(null);
    setArchive(null);
    setResult(null);
    setError("");
    if (!file) return;
    try {
      if (file.size <= 0 || file.size > EVIDENCE_MAX_REVIEW_BYTES) {
        throw new Error("EVIDENCE_REVIEW_FILE_TOO_LARGE");
      }
      const parsed = parseEvidenceReview(await file.text(), catalog);
      setReview(parsed);
    } catch (cause) {
      setError("Review not accepted: " + (cause?.message || "INVALID_REVIEW"));
    }
  }
  function importArchive(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setArchive(null);
    setResult(null);
    setError("");
    if (!file) return;
    if (!file.size || file.size > EVIDENCE_MAX_ZIP_BYTES ||
        !file.name.toLowerCase().endsWith(".zip")) {
      setError("Only the original R0.6 GitHub artifact ZIP, up to 2 MB, is accepted.");
      return;
    }
    setArchive(file);
  }
  async function inspect() {
    if (!review || !archive || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const verifiedMetadata = await corroborateEvidence(review, archive, catalog);
      setResult(verifiedMetadata);
    } catch (cause) {
      setError("Corroboration held: " + (cause?.message || "GITHUB_UNAVAILABLE"));
    } finally {
      setBusy(false);
    }
  }
  return <details className="evidence-bay" aria-label="Agentora pilot evidence bay">
    <summary>
      <span><strong>AGENTORA / PILOT EVIDENCE BAY</strong>
        <small>R0.6 test + build → R0.7 independent review → ΦMada metadata check</small></span>
      <span className="evidence-bay-status">{result ?
        (result.currentShaMatched ? "API-CORRELATED" : "SOURCE MOVED") :
        review ? "LOCAL REPORT ONLY" : "NO PILOT EVIDENCE"}</span>
    </summary>
    <div className="evidence-bay-content">
      <p><strong>Actual pilot results, not a simulated job.</strong> First run
        the manual <a href="https://github.com/MichaelWave369/Agentora/actions/workflows/fleet-r06-phimada-pilot.yml"
          target="_blank" rel="noopener noreferrer">Agentora R0.6 workflow ↗</a>.
        Then validate its downloaded GitHub artifact using the Agentora R0.7
        evidence-review CLI. This desk never launches that workflow.</p>
      <div className="evidence-bay-upload">
        <label>1. Agentora R0.7 review JSON
          <input type="file" accept=".json,application/json"
            disabled={busy} onChange={importReview} />
        </label>
        <label>2. Original R0.6 GitHub Actions ZIP
          <input type="file" accept=".zip,application/zip"
            disabled={!review || busy} onChange={importArchive} />
        </label>
      </div>
      {review && <div className="evidence-bay-fields">
        <span>Run <strong>#{review.runId}</strong></span>
        <span>Target <strong>PhiMada Prime</strong></span>
        <span>Source <code>{review.sourceSha.slice(0, 12)}</code></span>
        <span>R0.7 reviewed <strong>{new Date(review.reviewedUtc).toLocaleString()}</strong></span>
      </div>}
      <div className="evidence-bay-actions">
        <button type="button" disabled={!review || !archive || busy}
          onClick={inspect}>
          {busy ? "Checking public GitHub evidence…" :
            "Corroborate ZIP digest + GitHub run"}
        </button>
        {review && <a href={review.runUrl} target="_blank"
          rel="noopener noreferrer">Inspect original Actions run ↗</a>}
      </div>
      {error && <p className="evidence-bay-error" role="alert">{error}</p>}
      {result && <div className="evidence-bay-result" role="status">
        <strong>{result.currentShaMatched ?
          "Archive hash and GitHub metadata matched" :
          result.status === "HEAD_CHANGED_DURING_OBSERVATION" ?
            "GitHub HEAD changed during inspection" :
            "Historical evidence, source has moved"}</strong>
        <span>R0.6 ZIP SHA-256 matches the public artifact digest. GitHub confirms
          the expected completed manual run and artifact ID.</span>
        <span>Recorded pilot SHA: <code>{result.sourceSha}</code></span>
        <span>Observed main HEAD: <code>{result.currentHeadSha}</code></span>
        <span>Tests and build: <strong>exit 0 claimed by imported R0.7 review</strong>.
          The browser did not independently replay them or parse the ZIP's JSON.</span>
        <span>Product complete: <strong>NO</strong> · Merge authorized:
          <strong> NO</strong> · Browser acceptance: <strong>NOT RUN</strong></span>
      </div>}
      <p className="evidence-bay-warning">
        An imported review is operator-supplied, not authenticated by this browser.
        Hashing its original ZIP and checking GitHub corroborates artifact integrity
        and live metadata, not the truth of every claim inside the review.
        The separate Agentora R0.7 CLI performs ZIP content checks. All checks
        are historical and may be stale after a new commit. This office cannot
        dispatch, certify completion, or merge any repository.
      </p>
    </div>
  </details>;
}
