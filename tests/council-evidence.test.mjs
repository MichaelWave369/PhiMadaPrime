import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { inspectCouncilEvidence, COUNCIL_E1_SCHEMA,
  COUNCIL_E1_BYTES, COUNCIL_SEATS } from "../src/council-evidence.mjs";

const SOURCE = readFileSync("tests/fixtures/council-e1-producer-golden.json", "utf8");
function fixture() { return JSON.parse(SOURCE); }
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k =>
      JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}
const digest = value => createHash("sha256").update(canonical(value)).digest("hex");
function resign(packet) {
  for (const receipt of packet.receipts) {
    const {receiptSha256:ignored, ...data} = receipt;
    receipt.receiptSha256 = digest(data);
  }
  const {exchangeSha256:ignored, ...envelope} = packet;
  packet.exchangeSha256 = digest(envelope);
  return packet;
}
const review = packet => inspectCouncilEvidence(
  typeof packet === "string" ? packet : JSON.stringify(packet),
  {cryptoApi:webcrypto}
);
const refused = async (packet, code) =>
  assert.rejects(review(packet), code);

test("R18-01 real PocketMesh E1-D source fixture is accepted for review only", async () => {
  const summary = await review(SOURCE);
  assert.equal(summary.schema, "phimada.council-e1-local-review.v0.18");
  assert.equal(summary.disposition, "HELD_UNTRUSTED_REVIEW_ONLY");
  assert.equal(summary.caseId, "fleet-interop-synthetic-001");
  assert.equal(summary.keyholeContrastSuggested, true);
  assert.deepEqual(summary.rows.map(r => r.project),
    ["ThinkTank", "PocketBrain", "Vessie"]);
  assert.equal(summary.reportedConsumerCount, 3);
  assert.equal(fixture().schema, COUNCIL_E1_SCHEMA);
  assert.equal(COUNCIL_SEATS.length, 3);
});

test("R18-02 source-golden digest remains frozen and source revisions are declarations", async () => {
  const packet = fixture();
  const summary = await review(packet);
  assert.equal(summary.exchangeDigest,
    "deb0e5e706873901bc446611692e41f89eb40a9dbef80edea31394463d17fe96");
  assert.equal(summary.parentDigest,
    "5171e113c82f35030a735433e8f73df7ad81321fbe96f0abe12006382fafdca4");
  assert.deepEqual(summary.rows.map(x => x.declaredSha),
    ["b0180823ba0c7ffe0842cb0c1999497226ba1d9d",
     "30c6a2b1acbddf20a0c968aba145f7c85c1a6632",
     "8acc84e517a4acf217aba27fccf4232615fc33dd"]);
  assert.equal(summary.sourceAuthenticated, false);
  assert.equal(summary.sourceRevisionsCurrent, false);
});

test("R18-03 zero scientific, product, model and authority claims", async () => {
  const result = await review(SOURCE);
  for (const field of ["sourceAuthenticated","sourceRevisionsCurrent",
    "producerExecutionAttested","independentReproduction","scientificEvidence",
    "humanCouncilApproved","operatorReviewed","modelExecutionAuthorized",
    "jobDispatchAuthorized","mergeAuthorized","productComplete"]) {
    assert.equal(result[field], false, field);
  }
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.rows));
  assert(Object.isFrozen(result.rows[0]));
});

test("R18-04 altered receipt digest is refused", async () => {
  const packet=fixture();
  packet.receipts[0].sourceSha="f".repeat(40);
  await refused(packet, /COUNCIL_E1_DIGEST_MISMATCH/);
});

test("R18-05 altered envelope digest is refused", async () => {
  const packet=fixture();
  packet.exchangeSha256="f".repeat(64);
  await refused(packet, /COUNCIL_E1_DIGEST_MISMATCH/);
});

test("R18-06 rehashed forged grants fail closed", async () => {
  for(const [key,value] of [
    ["executionAuthorized",true],["mergeAuthorized",true],
    ["sharingAuthorized",true],["independentEvidence",true],
    ["sourceProvenance","GITHUB_VERIFIED"],["authority","HUMAN"],
    ["origin","MEASURED"],["privacy","PRIVATE"],["externalCalls",1],
    ["state","APPROVED"]
  ]) {
    const packet=fixture(); packet[key]=value;
    await refused(resign(packet), /COUNCIL_E1_TRUST_BOUNDARY_REFUSED/);
  }
});

test("R18-07 rehashed forged seat roles and approval fail closed", async () => {
  for(const [key,value] of [
    ["role","EXECUTOR"],["claimTier","REAL_PHYSICS"],
    ["sourceIdentity","GITHUB_VERIFIED"],["operatorApproved",true],
    ["evidenceAuthenticated",true],["modelExecuted",true],
    ["transportPerformed",true],["participant","GAIA"],
    ["repository","MichaelWave369/PhiMadaPrime"],["origin","MEASURED"]
  ]) {
    const packet=fixture();packet.receipts[1][key]=value;
    await refused(resign(packet), /COUNCIL_E1_SEAT_TRUST_REFUSED/);
  }
});

test("R18-08 wrong seat order, duplicate and missing rows refused", async () => {
  const reordered=fixture();reordered.receipts.reverse();
  await refused(resign(reordered), /COUNCIL_E1_SEAT_TRUST_REFUSED/);
  const duplicate=fixture();duplicate.receipts[1]=structuredClone(duplicate.receipts[0]);
  await refused(resign(duplicate), /COUNCIL_E1_SEAT_TRUST_REFUSED/);
  const missing=fixture();missing.receipts.pop();
  await refused(resign(missing), /COUNCIL_E1_SEATS_REFUSED/);
});

test("R18-09 forged coherent packet is still not source authenticated", async () => {
  const packet=fixture();
  packet.receipts.forEach(rec=>{rec.sourceSha="b".repeat(40);});
  const result=await review(resign(packet));
  assert.equal(result.sourceAuthenticated,false);
  assert.equal(result.scientificEvidence,false);
  assert.equal(result.jobDispatchAuthorized,false);
});

test("R18-10 action pair mismatch and invented action refused", async () => {
  const mismatched=fixture();mismatched.receipts[1].action="DISPLAY_E0_RESULT";
  await refused(resign(mismatched),/COUNCIL_E1_ACTION_PAIR_REFUSED/);
  const invented=fixture();invented.receipts[2].action="APPROVE_MISSION";
  await refused(resign(invented),/COUNCIL_E1_ACTION_REFUSED/);
});

test("R18-11 a declared null Keyhole pair remains review only", async () => {
  const packet=fixture();
  packet.receipts[0].action="REVIEW_E0_RESULT";
  packet.receipts[1].action="DISPLAY_E0_RESULT";
  const result=await review(resign(packet));
  assert.equal(result.keyholeContrastSuggested,false);
  assert.equal(result.disposition,"HELD_UNTRUSTED_REVIEW_ONLY");
});

test("R18-12 raw prompts, text and memory smuggling refused", async () => {
  const outer=fixture();outer.prompt="PRIVATE";
  await refused(resign(outer),/COUNCIL_E1_OUTER_SCHEMA_REFUSED/);
  const inner=fixture();inner.receipts[0].memory="PRIVATE";
  await refused(resign(inner),/COUNCIL_E1_SEAT_SCHEMA_REFUSED/);
});

test("R18-13 future version, invalid SHA and parent mismatch refused", async () => {
  const future=fixture();future.schema="future-v0.2";
  await refused(resign(future),/COUNCIL_E1_TRUST_BOUNDARY_REFUSED/);
  const short=fixture();short.receipts[0].sourceSha="bad";
  await refused(resign(short),/COUNCIL_E1_SOURCE_SHA_REFUSED/);
  const parent=fixture();parent.receipts[2].parentE0Sha256="a".repeat(64);
  await refused(resign(parent),/COUNCIL_E1_SEAT_TRUST_REFUSED/);
});

test("R18-14 corrupt JSON, oversized file and unavailable crypto refused", async () => {
  await refused("{not-json",/COUNCIL_E1_INVALID_JSON/);
  await refused("x".repeat(COUNCIL_E1_BYTES+1),/COUNCIL_E1_INPUT_SIZE_REFUSED/);
  await assert.rejects(
    inspectCouncilEvidence(SOURCE,{cryptoApi:null}),
    /COUNCIL_E1_CRYPTO_UNAVAILABLE/
  );
});

test("R18-15 existing Mission Board and Agentora Evidence Bay remain the only home", () => {
  const source=readFileSync("src/evidence-bay.jsx","utf8");
  const board=readFileSync("src/mission-board.jsx","utf8");
  assert.match(source,/import \{ CouncilEvidence \} from "\.\/council-evidence\.jsx"/);
  assert.match(source,/<CouncilEvidence \/>/);
  assert.match(board,/<EvidenceBay catalog=\{catalog\} contracts=\{contracts\} onVisit=\{onVisit\} \/>/);
  assert.doesNotMatch(source, /CouncilEvidence.*onApprove/);
});

test("R18-16 review UI contains no network, persistence or model execution path", () => {
  const source=readFileSync("src/council-evidence.jsx","utf8");
  const module=readFileSync("src/council-evidence.mjs","utf8");
  for(const data of [source,module]) {
    assert.doesNotMatch(data,/\bfetch\s*\(|\blocalStorage\.|\bindexedDB\.|\beval\s*\(|\bpostMessage\s*\(/);
  }
  assert.match(source, /Clear review/);
  assert.match(source, /id="phimada-council-e1-file"/);
  assert.match(source, /Receipt is self-consistent, but still UNTRUSTED and HELD/);
});
