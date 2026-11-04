import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bay=readFileSync("src/evidence-bay.jsx","utf8");
const r20=readFileSync("src/r20-council-browser-evidence.jsx","utf8");
const chromium=readFileSync("scripts/r21_preview_council_browser.mjs","utf8");

test("R22-01 first upload section routes R19/R20 pairs to the correct importer",()=>{
  const prompt=bay.indexOf("WHICH EVIDENCE FILES DO YOU HAVE?");
  const legacy=bay.indexOf("1. Agentora R0.7 review JSON");
  const target=bay.indexOf("<R20CouncilBrowserEvidence catalog={catalog} />");
  assert.ok(prompt>=0&&legacy>prompt&&target>legacy);
  assert.match(bay,/r20-council-review-\*\.json/);
  assert.match(bay,/phimada-r19-council-\*\.zip/);
  assert.match(bay,/AGENTORA R0\.7 \/ R0\.6 IMPORT ONLY/);
});
test("R22-02 shortcut is an accessible button that opens stable R20 anchor",()=>{
  assert.match(bay,/aria-controls="phimada-r20-council-browser"/);
  assert.match(bay,/onClick=\{openR20CouncilImport\}/);
  assert.match(bay,/target\.open = true/);
  assert.match(bay,/target\.querySelector\("summary"\)\?\.focus/);
  assert.match(r20,/id="phimada-r20-council-browser"/);
});
test("R22-03 R20 accepts R20 JSON + R19 ZIP, never Agentora's R0.7 files",()=>{
  assert.match(r20,/1\. R20 local review JSON/);
  assert.match(r20,/2\. Original R19 Actions ZIP/);
  assert.match(r20,/Corroborate R19 ZIP \+ GitHub source/);
  assert.match(bay,/1\. Agentora R0\.7 review JSON/);
  assert.match(bay,/2\. Original R0\.6 GitHub Actions ZIP/);
  assert.match(bay,/EVIDENCE_REVIEW_UNTRUSTED_OR_UNSUPPORTED|Review not accepted:/);
});
test("R22-04 real R21 Chromium route exercises the new shortcut and file labels",()=>{
  assert.match(chromium,/R20_IMPORT_ROUTER_FAILED_TO_OPEN/);
  assert.match(chromium,/R20_IMPORT_ROUTER_WRONG_FILE_FIELDS/);
  assert.match(chromium,/Go to R20 Council JSON \+ R19 ZIP import/);
});
test("R22-05 navigation never imports files, dispatches jobs, or shares evidence",()=>{
  const fn=bay.split("function openR20CouncilImport()")[1].split("async function inspect()")[0];
  assert.match(fn,/getElementById\("phimada-r20-council-browser"\)/);
  assert.doesNotMatch(fn,/\bfetch\s*\(|setReview\s*\(|setArchive\s*\(|\bpostMessage\s*\(|\bsubmit\s*\(/);
});
