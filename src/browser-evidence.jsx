import React, { useState } from "react";
import {
  parseBrowserReview, corroborateBrowserReview, R13_REVIEW_BYTES
} from "./browser-evidence.mjs";

// R13 is a local-only browser artifact viewer, not a remote verification agent.
// The separate Python reviewer must validate the ZIP's JSON before import.
export function BrowserEvidence({ catalog, contract }) {
  const [review, setReview] = useState(null);
  const [archive, setArchive] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadReview(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setReview(null); setArchive(null); setResult(null); setError("");
    if (!file) return;
    try {
      if (file.size <= 0 || file.size > R13_REVIEW_BYTES)
        throw new Error("R13_REVIEW_FILE_SIZE_INVALID");
      setReview(parseBrowserReview(await file.text(), catalog));
    } catch (e) {
      setError("Review refused: " + (e?.message || "INVALID"));
    }
  }
  function loadZip(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setArchive(null); setResult(null); setError("");
    if (!file) return;
    if (!file.size || file.size > 2000000 || !file.name.toLowerCase().endsWith(".zip")) {
      setError("Select the original GitHub Actions browser artifact ZIP (2 MB maximum).");
      return;
    }
    setArchive(file);
  }
  async function check() {
    if (busy || !review || !archive) return;
    setBusy(true); setError(""); setResult(null);
    try {
      setResult(await corroborateBrowserReview(review, archive, catalog));
    } catch (e) {
      setError("Browser evidence held: " + (e?.message || "GITHUB_UNAVAILABLE"));
    } finally {
      setBusy(false);
    }
  }
  const compatible = Boolean(result?.browserSourceCurrent &&
    contract?.repository === "MichaelWave369/PhiMadaPrime" &&
    contract?.repository_id === 1443845098 &&
    contract?.source_sha === result.sha &&
    contract?.surface_types?.includes("web_app") &&
    contract?.checks?.some(c => c.id === "browser_interaction"));

  return <details className="browser-evidence">
    <summary>
      <span><strong>R13 / LIVE BROWSER EVIDENCE</strong>
        <small>Actual R12 Chromium run + ZIP digest + current SHA</small>
      </span>
      <span>{result ? result.browserSourceCurrent ?
        "API-CORRELATED" : "HISTORICAL / HEAD MOVED" :
        review ? "LOCAL REVIEW" : "NOT IMPORTED"}</span>
    </summary>
    <div className="browser-evidence-body">
      <p>Our R12 Chromium workflow is manual-only. Review the original artifact
        using the new Python R13 CLI before importing both files here.
        This browser only corroborates metadata and ZIP SHA-256.</p>
      <a target="_blank" rel="noopener noreferrer"
        href="https://github.com/MichaelWave369/PhiMadaPrime/actions/workflows/r12-browser-smoke.yml">
        Open manual R12 browser workflow ↗
      </a>
      <div className="browser-evidence-upload">
        <label>1. R13 browser review JSON
          <input type="file" accept=".json,application/json"
            disabled={busy} onChange={loadReview}/>
        </label>
        <label>2. Original R12 Actions ZIP
          <input type="file" accept=".zip,application/zip"
            disabled={!review || busy} onChange={loadZip}/>
        </label>
      </div>
      {review && <p>Source SHA: <code>{review.sha}</code>
        {" · "}Run #{review.runId}</p>}
      <div className="browser-evidence-actions">
        <button type="button" disabled={busy || !review || !archive}
          onClick={check}>{busy ? "Checking GitHub…" :
            "Corroborate browser run + ZIP"}</button>
        {review && <a href={review.runUrl} target="_blank"
          rel="noopener noreferrer">Open original GitHub run ↗</a>}
      </div>
      {error && <p className="browser-evidence-error" role="alert">{error}</p>}
      {result && <div className="browser-evidence-result" role="status">
        <strong>{result.browserSourceCurrent ?
          "Recorded Chromium smoke is at the currently observed SHA" :
          "Historical browser evidence; not current acceptance"}</strong>
        <span>GitHub run and artifact digest: matched.</span>
        <span>R12 checks: <strong>8/8 PASS reported by imported R13 review</strong>.</span>
        <span>Current HEAD: <code>{result.observedHeadSha}</code></span>
        <span>Web-app contract:
          <strong>{compatible ? " matching source, browser smoke reported" :
            " not aligned or unavailable"}</strong>
        </span>
        <span>Independently accepted contract checks: <strong>0</strong></span>
        <span>Full accessibility: NOT VERIFIED · Product complete: NO ·
          Merge authorized: NO</span>
      </div>}
      <p className="browser-evidence-warning">The operator-supplied R13 JSON
        is unsigned. Only the original R13 Python reviewer validates the ZIP's
        internal browser check data. Here we independently confirm GitHub's
        run metadata, original ZIP digest, and HEAD. A passing smoke is not
        full accessibility, deployment attestation, user-journey completion,
        or permission to merge. No data is uploaded or stored persistently.</p>
    </div>
  </details>;
}
