import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  A11Y_CONFIRM, A11Y_SCHEMA, A11Y_VIEWS, A11Y_TAGS,
  validateA11yLaunch, summarizeAxeView, a11yReceipt
} from "../scripts/r14_a11y_contract.mjs";

const SHA = "a".repeat(40), OTHER = "b".repeat(40);
const NOW = "2026-11-03T20:40:00.000Z";
const KEYBOARD = {
  desk_keyboard_open: "PASS", inspector_tab_contained: "PASS",
  inspector_escape_close: "PASS", inspector_focus_return: "PASS",
  mission_board_keyboard_open: "PASS",
  evidence_details_keyboard_toggle: "PASS"
};
function scan(violations=[], incomplete=[]) {
  return { violations, incomplete, passes: [{id:"document-title"}] };
}
function view(name) { return summarizeAxeView(name,scan()); }
function goodViews() {
  return Object.fromEntries(A11Y_VIEWS.map(name=>[name,view(name)]));
}
function receipt(patch={}) {
  return a11yReceipt({
    expectedSha: SHA, beforeSha: SHA, afterSha: SHA, deployedSha: SHA,
    views:goodViews(), keyboard:KEYBOARD, errors:[],
    observedUtc:NOW, runId:"417333", ...patch
  });
}

test("launch demands exact lowercase Git SHA and explicit typed permission",()=>{
  assert.equal(validateA11yLaunch(SHA,A11Y_CONFIRM),SHA);
  for (const sha of ["main",OTHER.slice(0,39),"C".repeat(40),null]) {
    assert.throws(()=>validateA11yLaunch(sha,A11Y_CONFIRM),/EXACT_SHA_REQUIRED/);
  }
  for (const phrase of ["", "yes", "RUN_PHI_MADA_BROWSER_SMOKE",true]) {
    assert.throws(()=>validateA11yLaunch(SHA,phrase),/EXPLICIT_CONFIRMATION_REQUIRED/);
  }
});

test("coverage is three views using WCAG 2.x A and AA tags",()=>{
  assert.deepEqual([...A11Y_VIEWS],["office","inspector","mission_board"]);
  assert.deepEqual([...A11Y_TAGS],[
    "wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"
  ]);
});

test("bounded axe findings contain no HTML, selectors or user data",()=>{
  const result=summarizeAxeView("office",scan([{
    id:"color-contrast",impact:"serious",help:"Element contrast is insufficient",
    nodes:[{html:"<secret/>",target:["#private"]},{html:"secret"}]
  }]));
  assert.equal(result.status,"AUTOMATED_VIOLATIONS_FOUND");
  assert.equal(result.violations[0].affected_nodes,2);
  assert(!JSON.stringify(result).includes("private"));
  assert(!JSON.stringify(result).includes("<secret"));
});

test("no automated violations is an observation, not a full conformance claim",()=>{
  const output=receipt();
  assert.equal(output.schema,A11Y_SCHEMA);
  assert.equal(output.state,"AUTOMATED_ACCESSIBILITY_CHECKS_CLEAR_AT_OBSERVED_SHA");
  assert.equal(output.automated_accessibility_checks_clear,true);
  for (const field of [
    "full_wcag_conformance_verified","assistive_technology_reviewed",
    "keyboard_navigation_fully_verified","accessibility_contract_accepted",
    "deployment_cryptographically_attested","product_verified",
    "verified_complete","merge_authorized","dispatch_authorized"
  ]) assert.equal(output[field],false);
});

test("contrast or aria findings are reportable, not suppressed",()=>{
  for (const name of A11Y_VIEWS) {
    const views=goodViews();
    views[name]=summarizeAxeView(name,scan([{
      id:"aria-valid-attr",impact:"moderate",help:"Invalid aria attribute",nodes:[{}]
    }]));
    const result=receipt({views});
    assert.equal(result.state,"AUTOMATED_ACCESSIBILITY_FINDINGS_REQUIRE_REVIEW");
    assert.equal(result.automated_accessibility_checks_clear,false);
    assert.equal(result.views[name].violation_rules,1);
  }
});

test("incomplete axe rules require further review rather than false clean",()=>{
  const views=goodViews();
  views.office=summarizeAxeView("office",scan([],[{id:"manual-review"}]));
  const result=receipt({views});
  assert.equal(result.state,"AUTOMATED_ACCESSIBILITY_FINDINGS_REQUIRE_REVIEW");
  assert.equal(result.automated_accessibility_checks_clear,false);
});

test("missing any view is held, not passing",()=>{
  for (const name of A11Y_VIEWS) {
    const views=goodViews();delete views[name];
    assert.equal(receipt({views}).state,"HELD_INCOMPLETE_ACCESSIBILITY_SCANS");
  }
});

test("changing HEAD before or after scan blocks pass",()=>{
  for (const patch of [
    {beforeSha:OTHER},{afterSha:OTHER},{beforeSha:null},{afterSha:null}
  ]) assert.equal(receipt(patch).state,"HELD_SOURCE_SHA_CHANGED_OR_UNKNOWN");
});

test("old or unstamped Pages source cannot pass",()=>{
  for(const deployedSha of ["UNSTAMPED",OTHER,null,""]) {
    const result=receipt({deployedSha});
    assert.equal(result.state,"HELD_DEPLOYED_SHA_MARKER_MISMATCH");
  }
});

test("keyboard interaction failures are not accessibility acceptance",()=>{
  for (const name of Object.keys(KEYBOARD)) {
    const keyboard={...KEYBOARD,[name]:"FAIL"};
    const r=receipt({keyboard});
    assert.equal(r.state,"KEYBOARD_CHECKS_REQUIRE_REVIEW");
    assert.equal(r.automated_accessibility_checks_clear,false);
  }
});

test("JavaScript runtime errors prevent a clean claim",()=>{
  const r=receipt({errors:["Uncaught error in component"]});
  assert.equal(r.state,"ACCESSIBILITY_RUNTIME_ERRORS");
  assert.equal(r.automated_accessibility_checks_clear,false);
});

test("forged axe payload, keyboard names and long errors rejected",()=>{
  assert.throws(()=>summarizeAxeView("unknown",scan()),/VIEW_NOT_ALLOWED/);
  assert.throws(()=>summarizeAxeView("office",{violations:[]}),/AXE_SCAN_INVALID/);
  assert.throws(()=>summarizeAxeView("office",scan([{
    id:"forged",impact:"INFINITE",nodes:[{}]
  }])),/AXE_VIOLATION_INVALID/);
  assert.throws(()=>receipt({keyboard:{approved:"PASS"}}),/KEYBOARD_INVALID/);
  assert.throws(()=>receipt({errors:["x".repeat(261)]}),/ERRORS_INVALID/);
  assert.throws(()=>receipt({runId:"not-a-run"}),/RUN_ID_INVALID/);
});

test("bounded axe result list reports original count and truncation",()=>{
  const violations=Array.from({length:88},(_,i)=>({
    id:"rule-"+i,impact:"minor",nodes:[{}],help:"Help"
  }));
  const v=summarizeAxeView("mission_board",scan(violations));
  assert.equal(v.violation_rules,88);
  assert.equal(v.violations.length,80);
  assert.equal(v.findings_truncated,true);
});

test("workflow remains manual-only and cannot merge or dispatch",()=>{
  const wf=readFileSync(".github/workflows/r14-live-accessibility.yml","utf8");
  const runner=readFileSync("scripts/r14_live_a11y_audit.mjs","utf8");
  assert.match(wf,/workflow_dispatch:/);
  assert.doesNotMatch(wf,/\n  push:|\n  pull_request:|\n  schedule:/);
  assert.match(wf,/permissions:\n  contents: read/);
  assert.match(wf,/persist-credentials: false/);
  assert.match(wf,/if: always\(\)/);
  assert.match(wf,/RUN_PHI_MADA_A11Y_AUDIT/);
  assert.match(runner,/new AxeBuilder\(\{ page \}\)/);
  assert.match(runner,/page\.goto\(BROWSER_SITE/);
  assert.doesNotMatch(runner,/git push|merge_pull_request|workflow_dispatch\(/);
});
