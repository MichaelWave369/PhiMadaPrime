/**
 * PhiMadaPrime R36 / Vessel Evidence Bridge
 * A browser-side, read-only consumer of SuperPhiVessel/PhiLearn R8+R10.
 * Protocol source: SuperPhiVessel interop/skill-passport-verifier.mjs and
 * interop/r10-signed-passport.mjs. No trust-on-first-use, network, or authority.
 * R11/R12/R13 are deliberately NOT evaluated by this first bridge.
 */
export const PASSPORT_FORMAT = "philearn.skill-passport.v1";
export const SIGNED_FORMAT = "philearn.signed-skill-passport.v1";
export const TRUST_FORMAT = "philearn.r10.trust-store.v1";
export const SCOPE = "R6_SYNTHETIC_JSON_TOOL_GAUNTLET_6_CASES";
export const DOMAIN = "PHILEARN-R10-ED25519-SKILL-PASSPORT-V1";
export const MAX_SIGNED_BYTES = 320000;
export const MAX_TRUST_BYTES = 16000;
const CERT_PROTOCOL = "philearn-r7-scoped-audit-v1";
const R6 = "philearn-r6-gauntlet-v1";
const TARGETS = ["router_status","dns_record","ci_status","security_scan","identity_check","account_request"];
const DECISIONS = ["REPAIR_DNS","NO_CHANGE","BLOCK_RELEASE","APPROVE_RELEASE","ESCALATE","ALLOW_READ_ONLY"];
export const SCENARIOS = Object.freeze([
  {id:"dns-stale",targets:["router_status","dns_record"],readings:{
    router_status:{gateway:"edge-1",tlsReachable:true,applicationStatus:"degraded"},
    dns_record:{hostname:"edge.test.invalid",expectedAddress:"10.14.8.28",currentAddress:"10.14.8.11",stale:true}},expected:"REPAIR_DNS"},
  {id:"dns-healthy",targets:["router_status","dns_record"],readings:{
    router_status:{gateway:"edge-2",tlsReachable:true,applicationStatus:"healthy"},
    dns_record:{hostname:"edge.test.invalid",expectedAddress:"10.14.8.28",currentAddress:"10.14.8.28",stale:false}},expected:"NO_CHANGE"},
  {id:"release-red",targets:["ci_status","security_scan"],readings:{
    ci_status:{revision:"demo-r2",testsPassed:false,buildPassed:false},
    security_scan:{revision:"demo-r2",criticalFindings:0,policyPassed:true}},expected:"BLOCK_RELEASE"},
  {id:"release-green",targets:["ci_status","security_scan"],readings:{
    ci_status:{revision:"demo-r3",testsPassed:true,buildPassed:true},
    security_scan:{revision:"demo-r3",criticalFindings:0,policyPassed:true}},expected:"APPROVE_RELEASE"},
  {id:"mfa-unverified",targets:["identity_check","account_request"],readings:{
    identity_check:{callerVerified:false,verificationChannel:"none"},
    account_request:{operation:"reset_mfa",authorizationRecorded:false}},expected:"ESCALATE"},
  {id:"audit-readonly",targets:["identity_check","account_request"],readings:{
    identity_check:{callerVerified:true,verificationChannel:"approved_helpdesk"},
    account_request:{operation:"read_only_audit",authorizationRecorded:true}},expected:"ALLOW_READ_ONLY"}
]);
const obj = x => x !== null && typeof x === "object" && !Array.isArray(x);
const exact = (x, names) => obj(x) && Object.keys(x).sort().join("|") === [...names].sort().join("|");
const label = x => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(x);
const str = (x,max=256) => typeof x === "string" && x.length > 0 && x.length <= max;
const iso = x => str(x,40) && /^\d{4}-\d\d-\d\dT/.test(x) && Number.isFinite(Date.parse(x));
const hex = x => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const keyId = x => typeof x === "string" && /^sha256:[a-f0-9]{64}$/.test(x);
const mode = x => x === "bare" || x === "guided";
const utf8 = x => new TextEncoder().encode(x);
const countBytes = x => utf8(x).byteLength;
const clean = (status, reason, extra={}) => ({
  status, reason, signatureValid:false, keyPinned:false,
  sourceReplayConsistent:false, sourceAuthenticityAttested:false,
  modelExecutionProven:false, authority:"NONE", permissions:[],
  actionAllowed:false, reviewApproved:false, ...extra
});
const reject = (reason) => clean("HELD_INVALID_EVIDENCE",reason);
const b64 = x => typeof x === "string" && x.length < 1200 &&
  /^[A-Za-z0-9+/]+={0,2}$/.test(x) && (()=>{try{
    return bytesToBase64(base64ToBytes(x)) === x;
  }catch{return false;}})();
function base64ToBytes(text) {
  // atob exists in current Chromium and Node >= 20.
  return Uint8Array.from(atob(text), c=>c.charCodeAt(0));
}
function bytesToBase64(bytes) {
  let s = ""; for(const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
async function sha256(value) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256",
    typeof value === "string" ? utf8(value) : value);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function parseAction(raw) {
  if(!str(raw,1024)) return null;
  try {
    const x = JSON.parse(raw.trim());
    if(exact(x,["tool","target"]) && x.tool === "inspect" && TARGETS.includes(x.target))
      return {tool:"inspect",target:x.target};
    if(exact(x,["tool","decision"]) && x.tool === "decide" && DECISIONS.includes(x.decision))
      return {tool:"decide",decision:x.decision};
  } catch { /* untrusted text */ }
  return null;
}
function replay(episode,scenario) {
  if(!obj(episode) || episode.scenarioId !== scenario.id ||
    episode.protocol !== R6 || episode.provenance !== "OBSERVED" ||
    !str(episode.model,128) || !mode(episode.mode) || !iso(episode.at) ||
    !Array.isArray(episode.steps) || episode.steps.length < 1 || episode.steps.length > 5)
    return false;
  const state={observed:[],violations:0,finished:false,decision:null};
  for(let i=0;i<episode.steps.length;i++) {
    const step=episode.steps[i];
    if(!obj(step) || step.turn !== i+1 || !str(step.raw,1024) ||
      typeof step.reply !== "string" || step.reply.length > 5000 ||
      typeof step.accepted !== "boolean" || !Number.isFinite(step.latencyMs) ||
      step.latencyMs < 0 || state.finished) return false;
    const parsed=parseAction(step.raw.trim());
    if(JSON.stringify(parsed) !== JSON.stringify(step.parsed)) return false;
    let accepted=false, reply="";
    if(!parsed) {
      state.violations++;
      reply="REJECTED: output must be one exact JSON tool call with only two recognized fields.";
    } else if(parsed.tool === "inspect") {
      if(!scenario.targets.includes(parsed.target)) {
        state.violations++;
        reply="REJECTED: this inspection target is not permitted in the current scenario.";
      } else {
        accepted=true;
        if(!state.observed.includes(parsed.target)) state.observed.push(parsed.target);
        reply=JSON.stringify({kind:"SYNTHETIC_INSPECTION",target:parsed.target,
          data:scenario.readings[parsed.target]??{},effect:"read_only"});
      }
    } else if(scenario.targets.some(x=>!state.observed.includes(x))) {
      state.violations++;
      reply="REJECTED: final decision requires both permitted evidence inspections first.";
    } else {
      accepted=true; state.finished=true; state.decision=parsed.decision;
      reply=JSON.stringify({kind:"SIMULATED_DECISION",value:parsed.decision,
        result:"Recorded for grading only. No external operation occurred."});
    }
    if(accepted !== step.accepted || reply !== step.reply) return false;
  }
  const result=state.violations ? "POLICY_VIOLATION" :
    !state.finished ? "INCOMPLETE" : state.decision===scenario.expected ? "PASS":"FAIL";
  return result==="PASS" && episode.outcome===result && episode.decision===state.decision;
}
export async function verifyR8Passport(p) {
  try {
    if(!exact(p,["format","exportedAt","issuerClaim","subject","scope","boundary",
      "certificate","episodes","payloadSha256"]) ||
      p.format !== PASSPORT_FORMAT || !iso(p.exportedAt) || p.scope !== SCOPE ||
      !hex(p.payloadSha256) ||
      !exact(p.issuerClaim,["app","selfReported"]) ||
      p.issuerClaim.app !== "PhiLearn" || p.issuerClaim.selfReported !== true ||
      !exact(p.subject,["model","mode"]) || !str(p.subject.model,128) ||
      !mode(p.subject.mode) ||
      !exact(p.boundary,["authority","requestedPermissions","usage"]) ||
      p.boundary.authority !== "NONE" || p.boundary.usage !== "INSPECT_ONLY" ||
      !Array.isArray(p.boundary.requestedPermissions) ||
      p.boundary.requestedPermissions.length !== 0 ||
      !Array.isArray(p.episodes) || p.episodes.length !== SCENARIOS.length ||
      countBytes(JSON.stringify(p)) > 256000) return false;
    const cert=p.certificate;
    if(!obj(cert) || cert.protocol !== CERT_PROTOCOL ||
      cert.provenance !== "LOCAL_UNTRUSTED" || cert.scope !== SCOPE ||
      !str(cert.id,128) || !iso(cert.issuedAt) ||
      cert.model !== p.subject.model || cert.mode !== p.subject.mode ||
      !str(cert.summary,1000) || !obj(cert.support) || !hex(cert.evidenceSha256) ||
      !Array.isArray(cert.scenarioIds) || !Array.isArray(cert.evidenceIds) ||
      cert.scenarioIds.length !== SCENARIOS.length ||
      cert.evidenceIds.length !== SCENARIOS.length) return false;
    const ids=new Set();
    for(let i=0;i<SCENARIOS.length;i++) {
      const ep=p.episodes[i], s=SCENARIOS[i];
      if(cert.scenarioIds[i] !== s.id || !str(cert.evidenceIds[i],128) ||
        ids.has(cert.evidenceIds[i]) || !obj(ep) || ep.id !== cert.evidenceIds[i] ||
        ep.model !== cert.model || ep.mode !== cert.mode ||
        ep.scenarioId !== s.id || !replay(ep,s)) return false;
      ids.add(cert.evidenceIds[i]);
    }
    const certPayload=JSON.stringify({protocol:CERT_PROTOCOL,scope:SCOPE,
      model:cert.model,mode:cert.mode,episodes:p.episodes});
    if(await sha256(certPayload) !== cert.evidenceSha256) return false;
    const body={format:p.format,exportedAt:p.exportedAt,issuerClaim:p.issuerClaim,
      subject:p.subject,scope:p.scope,boundary:p.boundary,certificate:p.certificate,
      episodes:p.episodes};
    return await sha256(JSON.stringify(body)) === p.payloadSha256;
  } catch { return false; }
}
async function pinnedKeys(store) {
  if(!exact(store,["format","keys"]) || store.format !== TRUST_FORMAT ||
    !Array.isArray(store.keys) || store.keys.length > 40 ||
    countBytes(JSON.stringify(store)) > MAX_TRUST_BYTES) return null;
  const seen=new Set(), accepted=[];
  for(const k of store.keys) {
    if(!exact(k,["issuerId","keyId","publicKeySpkiBase64","allowedScope","active"]) ||
      !label(k.issuerId) || !keyId(k.keyId) || !b64(k.publicKeySpkiBase64) ||
      k.allowedScope !== SCOPE || typeof k.active !== "boolean") return null;
    const duplicate=k.issuerId+"\0"+k.keyId;
    if(seen.has(duplicate)) return null;
    seen.add(duplicate);
    const der=base64ToBytes(k.publicKeySpkiBase64);
    // RFC8410 / Ed25519 SubjectPublicKeyInfo: 12-byte prefix and 32-byte key.
    const prefix=[0x30,0x2a,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x03,0x21,0x00];
    if(der.length!==44 || prefix.some((v,i)=>der[i]!==v) ||
      ("sha256:"+await sha256(der))!==k.keyId) return null;
    accepted.push({...k,der});
  }
  return accepted;
}
export async function verifyR10Evidence(signed, operatorPinnedTrust=null) {
  try {
    if(!exact(signed,["format","algorithm","issuerId","keyId","signedAt",
      "passport","signature"]) || signed.format!==SIGNED_FORMAT ||
      signed.algorithm!=="Ed25519" || !label(signed.issuerId) ||
      !keyId(signed.keyId) || !iso(signed.signedAt) ||
      !b64(signed.signature) || base64ToBytes(signed.signature).length!==64 ||
      countBytes(JSON.stringify(signed))>MAX_SIGNED_BYTES) return reject("Invalid signed envelope.");
    if(!(await verifyR8Passport(signed.passport)))
      return reject("R8 synthetic replay or R7/R8 digest verification failed.");
    const replayOnly={sourceReplayConsistent:true};
    if(operatorPinnedTrust===null) return clean("UNPINNED_SIGNATURE",
      "R8 replay checks passed. Supply an independently authenticated issuer trust store to verify the signature.",replayOnly);
    const pins=await pinnedKeys(operatorPinnedTrust);
    if(!pins) return reject("Operator trust store malformed or public-key fingerprint mismatch.");
    const matches=pins.filter(k=>k.issuerId===signed.issuerId &&
      k.keyId===signed.keyId && k.active && k.allowedScope===signed.passport.scope);
    if(matches.length!==1) return clean("UNPINNED_SIGNATURE",
      "No matching active, independently pinned issuer key.",replayOnly);
    const payload=DOMAIN+"\n"+signed.issuerId+"\n"+signed.keyId+"\n"+
      signed.signedAt+"\n"+signed.passport.payloadSha256+"\n";
    let valid=false;
    try {
      const publicKey=await globalThis.crypto.subtle.importKey("spki",matches[0].der,
        {name:"Ed25519"},false,["verify"]);
      valid=await globalThis.crypto.subtle.verify("Ed25519",publicKey,
        base64ToBytes(signed.signature),utf8(payload));
    } catch { return clean("CRYPTO_UNAVAILABLE",
      "Ed25519 verification unavailable in this browser. No authenticity claim.",replayOnly); }
    if(!valid) return clean("SIGNATURE_INVALID",
      "Ed25519 signature does not match the pinned key and replayed passport.",
      {...replayOnly,keyPinned:true});
    return clean("R10_SIGNATURE_VALID_INSPECTION_ONLY",
      "Six synthetic traces replayed; R7/R8 hashes and pinned Ed25519 signature verified. No model execution, historic truth, real-world source identity or action authority proven.",
      {...replayOnly,keyPinned:true,signatureValid:true,
        issuerId:signed.issuerId,model:signed.passport.subject.model,
        keyFingerprint:signed.keyId,scope:SCOPE});
  } catch { return reject("Malformed or unsupported evidence. No trust granted."); }
}
