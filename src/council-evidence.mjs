// ΦMada R18: local-only, read-only Council E1 receipt inspector.
// This checks packet self-consistency, NOT source authentication, scientific
// truth, model execution or permission to route/merge/dispatch.
export const COUNCIL_E1_SCHEMA = "nbg-pocketmesh.council-evidence-exchange-e1.v0.1";
export const COUNCIL_E1_BYTES = 65536;
const E0_SCHEMA = "nbg-pocketmesh.council-keyhole-e0.v0.1";
const INTERPRETATION = "Synthetic contract output; no scientific corroboration";
const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const CASE = /^[a-zA-Z0-9._:-]{1,64}$/;
const TOP_KEYS = [
  "schema", "policyEpoch", "caseId", "e0Schema", "e0ReceiptSha256", "origin",
  "privacy", "authority", "state", "sourceProvenance", "independentEvidence",
  "executionAuthorized", "mergeAuthorized", "sharingAuthorized", "externalCalls",
  "receipts", "exchangeSha256"
];
const SEAT_KEYS = [
  "schema", "caseId", "participant", "repository", "sourceSha", "sourceIdentity",
  "role", "claimTier", "action", "parentE0Sha256", "origin", "privacy", "authority",
  "modelExecuted", "operatorApproved", "evidenceAuthenticated",
  "transportPerformed", "interpretation", "receiptSha256"
];
export const COUNCIL_SEATS = Object.freeze([
  Object.freeze({ participant:"ThinkTank", repository:"MichaelWave369/think-tank",
    role:"HYPOTHESIS_CHALLENGER", claimTier:"HYPOTHESIS_ONLY",
    actions:Object.freeze(["CHALLENGE_AGGREGATE_EQUIVALENCE","REVIEW_E0_RESULT"]) }),
  Object.freeze({ participant:"PocketBrain", repository:"MichaelWave369/PocketBrain",
    role:"LOCAL_OBSERVER", claimTier:"DISPLAY_ONLY",
    actions:Object.freeze(["DISPLAY_K0_K1_CONTRAST","DISPLAY_E0_RESULT"]) }),
  Object.freeze({ participant:"Vessie", repository:"MichaelWave369/SuperPhiVessel",
    role:"GOVERNANCE_REVIEWER", claimTier:"REVIEW_ONLY",
    actions:Object.freeze(["HOLD_FOR_OPERATOR_REVIEW"]) })
]);

function requireValid(ok, code) {
  if (!ok) throw new Error(code);
}
function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function exactKeys(value, required, code) {
  requireValid(plain(value) && JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...required].sort()), code);
}
function fixed(record, spec, code) {
  for (const [name, value] of Object.entries(spec)) {
    requireValid(record[name] === value, code);
  }
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k =>
      JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}
async function sameDigest(record, key, cryptoApi) {
  const claimed = record[key];
  requireValid(typeof claimed === "string" && SHA256.test(claimed),
    "COUNCIL_E1_DIGEST_MALFORMED");
  const unsigned = Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
  requireValid(cryptoApi && cryptoApi.subtle && typeof cryptoApi.subtle.digest === "function",
    "COUNCIL_E1_CRYPTO_UNAVAILABLE");
  const digest = await cryptoApi.subtle.digest("SHA-256",
    new TextEncoder().encode(canonical(unsigned)));
  const calculated = Array.from(new Uint8Array(digest),
    n => n.toString(16).padStart(2, "0")).join("");
  requireValid(claimed === calculated, "COUNCIL_E1_DIGEST_MISMATCH");
}

/**
 * Accept only one bounded public-synthetic JSON string, chosen by a person.
 * Output contains only categorical/allowlisted metadata, not the imported
 * raw object. No network, storage, model calls, or authority inheritance.
 */
export async function inspectCouncilEvidence(raw,
  {cryptoApi = globalThis.crypto} = {}) {
  requireValid(typeof raw === "string" &&
    new TextEncoder().encode(raw).length > 1 &&
    new TextEncoder().encode(raw).length <= COUNCIL_E1_BYTES,
    "COUNCIL_E1_INPUT_SIZE_REFUSED");
  let packet;
  try { packet = JSON.parse(raw); }
  catch { throw new Error("COUNCIL_E1_INVALID_JSON"); }
  exactKeys(packet, TOP_KEYS, "COUNCIL_E1_OUTER_SCHEMA_REFUSED");
  fixed(packet, {
    schema:COUNCIL_E1_SCHEMA, policyEpoch:1, e0Schema:E0_SCHEMA,
    origin:"SIMULATED", privacy:"PUBLIC_SYNTHETIC", authority:"NONE",
    state:"HELD_FOR_OPERATOR_REVIEW", sourceProvenance:"DECLARED_UNVERIFIED",
    independentEvidence:false, executionAuthorized:false, mergeAuthorized:false,
    sharingAuthorized:false, externalCalls:0
  }, "COUNCIL_E1_TRUST_BOUNDARY_REFUSED");
  requireValid(typeof packet.caseId === "string" && CASE.test(packet.caseId),
    "COUNCIL_E1_CASE_REFUSED");
  requireValid(typeof packet.e0ReceiptSha256 === "string" &&
    SHA256.test(packet.e0ReceiptSha256), "COUNCIL_E1_PARENT_REFUSED");
  requireValid(Array.isArray(packet.receipts) &&
    packet.receipts.length === COUNCIL_SEATS.length, "COUNCIL_E1_SEATS_REFUSED");

  const rows = [];
  const actions = [];
  for (let i = 0; i < COUNCIL_SEATS.length; i++) {
    const seat = COUNCIL_SEATS[i];
    const receipt = packet.receipts[i];
    exactKeys(receipt, SEAT_KEYS, "COUNCIL_E1_SEAT_SCHEMA_REFUSED");
    fixed(receipt, {
      schema:COUNCIL_E1_SCHEMA, caseId:packet.caseId,
      participant:seat.participant, repository:seat.repository, role:seat.role,
      claimTier:seat.claimTier, sourceIdentity:"DECLARED_UNVERIFIED",
      parentE0Sha256:packet.e0ReceiptSha256,
      origin:"SIMULATED", privacy:"PUBLIC_SYNTHETIC", authority:"NONE",
      modelExecuted:false, operatorApproved:false, evidenceAuthenticated:false,
      transportPerformed:false, interpretation:INTERPRETATION
    }, "COUNCIL_E1_SEAT_TRUST_REFUSED");
    requireValid(typeof receipt.sourceSha === "string" &&
      SHA40.test(receipt.sourceSha), "COUNCIL_E1_SOURCE_SHA_REFUSED");
    requireValid(typeof receipt.action === "string" &&
      seat.actions.includes(receipt.action), "COUNCIL_E1_ACTION_REFUSED");
    await sameDigest(receipt, "receiptSha256", cryptoApi);
    actions.push(receipt.action);
    rows.push(Object.freeze({
      project:seat.participant, repository:seat.repository, role:seat.role,
      claimTier:seat.claimTier, action:receipt.action, declaredSha:receipt.sourceSha
    }));
  }
  const witness = actions[0] === "CHALLENGE_AGGREGATE_EQUIVALENCE";
  requireValid(actions[1] ===
    (witness ? "DISPLAY_K0_K1_CONTRAST" : "DISPLAY_E0_RESULT"),
    "COUNCIL_E1_ACTION_PAIR_REFUSED");
  await sameDigest(packet, "exchangeSha256", cryptoApi);

  return Object.freeze({
    schema:"phimada.council-e1-local-review.v0.18",
    disposition:"HELD_UNTRUSTED_REVIEW_ONLY",
    caseId:packet.caseId,
    parentDigest:packet.e0ReceiptSha256,
    exchangeDigest:packet.exchangeSha256,
    keyholeContrastSuggested:witness,
    rows:Object.freeze(rows),
    reportedConsumerCount:3,
    sourceAuthenticated:false,
    sourceRevisionsCurrent:false,
    producerExecutionAttested:false,
    independentReproduction:false,
    scientificEvidence:false,
    humanCouncilApproved:false,
    operatorReviewed:false,
    modelExecutionAuthorized:false,
    jobDispatchAuthorized:false,
    mergeAuthorized:false,
    productComplete:false
  });
}
