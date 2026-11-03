import React, { useState } from "react";
import { COUNCIL_E1_BYTES, inspectCouncilEvidence } from "./council-evidence.mjs";

// Local inspection only. No network requests, memory writes, or Agentora jobs.
// The outer Evidence Bay remains the canonical review-only fleet surface.
export function CouncilEvidence() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function selectFile(event) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFile(null);
    setResult(null);
    setError("");
    if (!selected) return;
    if (selected.size < 2 || selected.size > COUNCIL_E1_BYTES) {
      setError("Receipt refused. Select a public synthetic JSON file no larger than 64 KiB.");
      return;
    }
    setFile(selected);
  }
  async function inspect() {
    if (!file || busy) return;
    setResult(null);
    setError("");
    setBusy(true);
    try {
      const raw = await file.text();
      setResult(await inspectCouncilEvidence(raw));
    } catch {
      // Never echo imported JSON, file paths, filenames or arbitrary parser text.
      setError("Council receipt held: malformed, altered, unsupported or untrusted input.");
    } finally {
      setBusy(false);
      setFile(null);
    }
  }
  function clear() {
    setFile(null);
    setResult(null);
    setError("");
  }
  return <details className="council-evidence" aria-label="NBG Research Council receipt review">
    <summary>
      <span><strong>R18 / NBG RESEARCH COUNCIL</strong>
        <small>NBGPocketMesh E1 → ThinkTank / PocketBrain / Vessie · local read-only</small>
      </span>
      <span>{result ? "SYNTHETIC / HELD" : busy ? "INSPECTING" : "NOT VERIFIED"}</span>
    </summary>
    <div className="council-evidence-body">
      <p>Manually inspect one public synthetic NBGPocketMesh E1 receipt.
        This is a fleet observability aid, <strong>not</strong> a live model council,
        human approval, GitHub authentication, or a completion signal.</p>
      <p>Source: <a href="https://github.com/MichaelWave369/NBGPocketMesh/pull/13"
        target="_blank" rel="noopener noreferrer">PocketMesh E1-D producer / interoperability PR ↗</a>.
        Download its reviewed JSON fixture manually. This panel never fetches it.</p>
      <label htmlFor="phimada-council-e1-file">Public synthetic E1 JSON (maximum 64 KiB)</label>
      <input id="phimada-council-e1-file" type="file"
        accept=".json,application/json" disabled={busy} onChange={selectFile} />
      <div className="council-evidence-actions">
        <button type="button" disabled={!file || busy} onClick={inspect}>
          {busy ? "Checking local hashes…" : "Inspect selected Council receipt"}
        </button>
        <button type="button" disabled={busy} onClick={clear}>Clear review</button>
      </div>
      <p role="status" aria-live="polite">{busy ? "Inspecting only in this browser…" :
        error || (result ? "Receipt is self-consistent, but still UNTRUSTED and HELD." :
          file ? "Receipt selected, not inspected." : "No Council receipt imported.")}</p>
      {result && <section className="council-evidence-result" aria-label="Untrusted council receipt">
        <h3>REVIEW ONLY · NO APPROVAL</h3>
        <p><strong>Case:</strong> <code>{result.caseId}</code></p>
        <p><strong>Keyhole:</strong> {result.keyholeContrastSuggested ?
          "Synthetic pooled-equivalent candidates merit subgroup review." :
          "No hidden distinction is established by this synthetic action pair."}</p>
        <p><strong>Parent E0 digest:</strong> <code>{result.parentDigest.slice(0,16)}…</code></p>
        <p><strong>E1 envelope digest:</strong> <code>{result.exchangeDigest.slice(0,16)}…</code></p>
        <ul aria-label="Declared Council participants">
          {result.rows.map(row => <li key={row.project}>
            <strong>{row.project}</strong>
            <span>{row.role.replaceAll("_"," ")} · {row.action.replaceAll("_"," ")}</span>
            <small>Declared source <code>{row.declaredSha.slice(0,12)}</code>,
              not checked against current GitHub HEAD</small>
          </li>)}
        </ul>
        <p><strong>State:</strong> HELD UNTRUSTED REVIEW ONLY ·
          Source authenticated: NO · Scientific evidence: NO ·
          Model execution: NOT OBSERVED · Product complete: NO ·
          Dispatch/merge authority: NONE.</p>
      </section>}
      <p className="council-evidence-caution">Web Crypto SHA-256 checks only the internal
        consistency of the operator-selected JSON. A complete forgery could pass.
        Neither the three consumer applications nor their current revisions are contacted,
        and no evidence is admitted to Agentora's completion contracts. Import never
        triggers fetch, localStorage, model inference, memory, export, or sharing.</p>
    </div>
  </details>;
}
