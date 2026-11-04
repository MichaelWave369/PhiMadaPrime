import React, { useState } from "react";
import { reviewAgentoraR03, recheckR03Context,
  R03_MAX_REQUEST_BYTES,R03_MAX_RECEIPT_BYTES } from "./agentora-r03-return.mjs";

// Local-only files; the browser never sends receipt contents to GitHub/Agentora.
// Correlation of an unsigned R0.3 intake receipt is NOT test execution evidence.
export function AgentoraR03Return({repo,contract,signal}) {
  const [requestFile,setRequestFile]=useState(null);
  const [receiptFile,setReceiptFile]=useState(null);
  const [result,setResult]=useState(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [inputGeneration,setInputGeneration]=useState(0);
  const context=result?recheckR03Context(result,repo,contract,signal):null;

  async function correlate(){
    setResult(null);setError("");setBusy(true);
    try {
      if(!requestFile||!receiptFile||
        requestFile.size<1||requestFile.size>R03_MAX_REQUEST_BYTES||
        receiptFile.size<1||receiptFile.size>R03_MAX_RECEIPT_BYTES)
        throw Error("R27_FILE_SIZE_OR_SELECTION_REFUSED");
      const [requestBytes,receiptBytes]=await Promise.all([
        requestFile.arrayBuffer(),receiptFile.arrayBuffer()
      ]);
      const review=await reviewAgentoraR03(
        new Uint8Array(requestBytes),new Uint8Array(receiptBytes),
        repo,contract,signal
      );
      setResult(review);
    }catch(reason){
      // Only fixed local validator codes are reported. Never display untrusted
      // data or exception text from the uploaded files themselves.
      const code=typeof reason?.message==="string"&&
        /^R27_[A-Z0-9_]{1,70}$/.test(reason.message)?
        reason.message:"R27_LOCAL_REVIEW_FAILED";
      setError(code);
    }finally{setBusy(false);}
  }
  function clear(){
    setResult(null);setError("");setRequestFile(null);setReceiptFile(null);
    setInputGeneration(previous=>previous+1);
  }
  return <details className="one-repo-intake-return"
    aria-label="Agentora R0.3 intake receipt return">
    <summary>Agentora R0.3 receipt return · local acknowledgement only</summary>
    <p>Agentora's current Fleet R0.3 CLI only checks and records the request.
      It does <strong>not</strong> independently recheck HEAD, run project tests,
      approve work or certify completion. Import both original files below.
      Neither file leaves your browser.</p>
    <p>Agentora command:
      <code>python scripts/fleet_r03_acceptance_intake.py --input phimada-verification-request-REPO.json --output-dir local-fleet-intake</code>
      <a href="https://github.com/MichaelWave369/Agentora/blob/main/docs/FLEET_R03_VERIFICATION_INTAKE.md"
        target="_blank" rel="noopener noreferrer">Operator instructions</a>
    </p>
    <div className="one-repo-intake-fields">
      <label>1. Exact original PhiMada R8 request JSON
        <input key={"request-"+inputGeneration} type="file" accept=".json,application/json"
          onChange={e=>{
            setRequestFile(e.target.files?.[0]||null);
            setResult(null);setError("");
          }}/>
      </label>
      <label>2. Agentora R0.3 verification-intake.json
        <input key={"receipt-"+inputGeneration} type="file" accept=".json,application/json"
          onChange={e=>{
            setReceiptFile(e.target.files?.[0]||null);
            setResult(null);setError("");
          }}/>
      </label>
    </div>
    <div className="one-repo-lane-actions">
      <button type="button" disabled={busy||!requestFile||!receiptFile}
        onClick={correlate}>
        {busy?"Checking local receipt…":"Correlate original request + R0.3 receipt"}
      </button>
      <button type="button" disabled={!requestFile&&!receiptFile&&!result&&!error}
        onClick={clear}>Clear local review</button>
    </div>
    {error&&<p className="one-repo-intake-refusal" role="alert">
      Local intake refused: <code>{error}</code>. Verify both original files.
      No completion or execution evidence was accepted.</p>}
    {result&&<div className="one-repo-intake-result" role="status"
      aria-live="polite">
      <strong>LOCAL REQUEST LINEAGE MATCHED · UNSIGNED, NOT AUTHENTICATED</strong>
      <dl className="one-repo-lane-facts">
        <div><dt>Request SHA-256</dt><dd>{result.requestSha256.slice(0,16)}…</dd></div>
        <div><dt>Claimed source SHA</dt><dd>{result.sourceSha.slice(0,12)}</dd></div>
        <div><dt>Source today</dt><dd>{context.sourceState.replaceAll("_"," ")}</dd></div>
        <div><dt>Local contract</dt><dd>{context.contractState.replaceAll("_"," ")}</dd></div>
        <div><dt>Requested checks</dt><dd>{result.requiredChecks}</dd></div>
        <div><dt>Independent checks run</dt><dd>0</dd></div>
      </dl>
      <p>Receipt state: <strong>HELD FOR OPERATOR REVIEW</strong>.
        The local JSON files agree on identity, checklist and digest.
        A matching hash is <strong>not</strong> proof Agentora produced the file.
        No job, test, source authentication, merge or release was verified.
        The current HEAD and contract can change after this import.</p>
    </div>}
  </details>;
}
