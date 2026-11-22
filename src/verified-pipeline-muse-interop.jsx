import React,{useState} from "react";
import {musePublicKeyToR45Pins} from "./verified-pipeline-muse-interop.mjs";

/**
 * Explicit opt-in public-key conversion; no signer, network, secret collection,
 * keychain access, storage, or implied trust in a pasted fingerprint.
 */
export function MuseR45PinHelper({onPinsCreated}){
  const [publicKey,setPublicKey]=useState("");
  const [museFingerprint,setMuseFingerprint]=useState("");
  const [issuerId,setIssuerId]=useState("");
  const [repository,setRepository]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [r45KeyId,setR45KeyId]=useState("");
  async function makePins(event){
    event.preventDefault();
    setError("");setMessage("");setR45KeyId("");setBusy(true);
    try{
      const result=await musePublicKeyToR45Pins({
        publicKey,museFingerprint,issuerId,repository
      });
      onPinsCreated(result.pinStoreJson);
      setR45KeyId(result.r45KeyId);
      setMessage("Public-key pin prepared for local R45 verification. Issuer ownership remains unverified.");
    }catch(e){
      setError(e instanceof Error?e.message:"Cannot adapt Muse public key");
    }finally{setBusy(false);}
  }
  function changed(setter){
    return value=>{setter(value);setError("");setMessage("");setR45KeyId("");};
  }
  return <details className="vpsig-muse" aria-label="Experimental Muse public-key adapter">
    <summary>Muse public-key adapter (experimental, read-only)</summary>
    <p>Convert an independently obtained <strong>public</strong> Muse Ed25519 key
      to R45's pin format. Use only the 32-byte public key and its raw-key SHA-256
      fingerprint from the intended hub. Never enter a mnemonic, seed, passphrase or private key.</p>
    <form onSubmit={makePins} className="vpsig-muse-form">
      <label>Muse public key (ed25519:base64url)
        <input type="text" value={publicKey} autoComplete="off" spellCheck={false}
          onChange={e=>changed(setPublicKey)(e.target.value)} required maxLength={128}
          placeholder="ed25519:... (public key only)"/>
      </label>
      <label>Muse raw-key fingerprint (sha256:...)
        <input type="text" value={museFingerprint} autoComplete="off" spellCheck={false}
          onChange={e=>changed(setMuseFingerprint)(e.target.value)} required maxLength={71}
          placeholder="sha256:..."/>
      </label>
      <label>R45 issuer label (must match the signed envelope)
        <input type="text" value={issuerId} autoComplete="off" spellCheck={false}
          onChange={e=>changed(setIssuerId)(e.target.value)} required maxLength={80}
          placeholder="musehub:your-handle"/>
      </label>
      <label>GMED report repository (must match signed claim)
        <input type="text" value={repository} autoComplete="off" spellCheck={false}
          onChange={e=>changed(setRepository)(e.target.value)} required maxLength={117}
          placeholder="MichaelWave369/ExampleRepo"/>
      </label>
      <button type="submit" disabled={busy}>
        {busy?"Computing public fingerprints…":"Use public key as local R45 pin"}
      </button>
    </form>
    {error&&<p className="vpsig-error" role="alert">{error}</p>}
    {message&&<p className="vpsig-note" role="status">{message}</p>}
    {r45KeyId&&<p>Derived R45 SPKI key ID: <code>{r45KeyId}</code></p>}
    <p><strong>Muse raw-key fingerprint ≠ R45 SPKI key ID.</strong> Matching both
      proves representation consistency, not control of a Muse account.
      Any operator confirmation must be performed through a separately trusted channel.
      No external signing or delegation occurs here.</p>
  </details>;
}
