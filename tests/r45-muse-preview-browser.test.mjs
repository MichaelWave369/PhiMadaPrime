import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CHECKS,PREVIEW_URL,runMusePreview}
  from "../scripts/r45_muse_preview_browser.mjs";

const runner=readFileSync("scripts/r45_muse_preview_browser.mjs","utf8");
const workflow=readFileSync(".github/workflows/r21-council-preview.yml","utf8");

test("R45 Muse browser checks cover exact candidate, refusal and untrusted result",()=>{
  assert.deepEqual([...CHECKS],[
    "exact_candidate_preview",
    "open_r45_through_thinktank",
    "wrong_public_key_fingerprint_refused",
    "synthetic_signature_verified_without_issuer_trust",
    "tampered_signature_refused",
    "reset_and_reload_discard_local_material",
    "no_external_network_or_write_requests"
  ]);
  assert.equal(PREVIEW_URL,"http://127.0.0.1:4173/");
  assert.match(runner,/musehub:synthetic-browser/);
  assert.match(runner,/real_muse_identity_tested:false/);
  assert.match(runner,/external_identity_authenticated:false/);
  assert.match(runner,/merge_authorized:false/);
  assert.match(runner,/permissions:\[\]/);
});

test("R45 Muse browser refuses missing/malformed SHA before launching Chromium",async()=>{
  let launched=0;
  for(const sha of ["",null,"main","A".repeat(40),"f".repeat(39)]){
    await assert.rejects(runMusePreview(sha,{launchBrowser:async()=>{
      launched++;throw Error("should not launch");
    }}),/R45_EXACT_CANDIDATE_SHA_REQUIRED/);
  }
  assert.equal(launched,0);
});

test("R45 Muse browser uses disposable keys and blocks network and writes",()=>{
  assert.match(runner,/generateKeyPairSync\("ed25519"\)/);
  assert.match(runner,/context\.route\("\*\*\/\*"/);
  assert.match(runner,/route\.abort\(\)/);
  assert.match(runner,/new URL\(PREVIEW_URL\)\.origin/);
  assert.match(runner,/!?\["GET","HEAD"\]\.includes/);
  assert.doesNotMatch(runner,/localhost:1337|MUSE_KEYCHAIN|auth keygen|mnemonic|private_key|github\.io/);
});

test("R45 Muse browser is run by isolated preview workflow and saves bounded evidence",()=>{
  assert.match(workflow,/scripts\/r45_muse_preview_browser\.mjs/);
  assert.match(workflow,/r45-muse-artifacts\/browser-preview\.json/);
  assert.match(workflow,/node --check scripts\/r45_muse_preview_browser\.mjs/);
  assert.match(workflow,/node --test tests\/r45-muse-preview-browser\.test\.mjs/);
  assert.match(workflow,/permissions:\n  contents: read/);
});
