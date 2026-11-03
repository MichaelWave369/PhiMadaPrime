import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DIALOG_FOCUSABLE_SELECTOR, dialogFocusableElements,
  wrappedTabTarget, restoreFocusToOpener
} from "../src/dialog-focus.mjs";
import { a11yReceipt, A11Y_VIEWS } from "../scripts/r14_a11y_contract.mjs";

function fakeNode(options = {}) {
  const settings = { connected:true, visible:true,
    visibility:"visible", inert:false, hidden:false, ...options };
  return {
    isConnected:settings.connected,
    getClientRects:()=>settings.visible ? [{}] : [],
    getAttribute:(name)=>name==="aria-hidden" && settings.hidden ? "true" : null,
    closest:(selector)=>selector==="[inert]" && settings.inert ? {} : null,
    ownerDocument:{defaultView:{getComputedStyle:()=>({
      visibility:settings.visibility
    })}}
  };
}

test("focus selector includes buttons, links, fields and disclosure summaries", () => {
  for(const term of ["a[href]","button:not([disabled])",
    "input:not([disabled])","textarea:not([disabled])","summary"]) {
    assert(DIALOG_FOCUSABLE_SELECTOR.includes(term));
  }
  assert(!DIALOG_FOCUSABLE_SELECTOR.includes("body"));
});

test("focusable selection omits disconnected, invisible, hidden and inert controls", () => {
  const valid = fakeNode();
  const invalid = [
    fakeNode({connected:false}), fakeNode({visible:false}),
    fakeNode({visibility:"hidden"}), fakeNode({inert:true}),
    fakeNode({hidden:true}), fakeNode({visibility:"collapse"})
  ];
  const root={querySelectorAll:()=>[valid,...invalid]};
  assert.deepEqual(dialogFocusableElements(root),[valid]);
  assert.deepEqual(dialogFocusableElements(null),[]);
});

test("forward Tab from last wraps to first but internal order is untouched", () => {
  const a={},b={},c={};
  assert.equal(wrappedTabTarget([a,b,c],c,false),a);
  assert.equal(wrappedTabTarget([a,b,c],b,false),null);
  assert.equal(wrappedTabTarget([a,b,c],a,false),null);
});

test("reverse Tab from first wraps to last but internal order is untouched", () => {
  const a={},b={},c={};
  assert.equal(wrappedTabTarget([a,b,c],a,true),c);
  assert.equal(wrappedTabTarget([a,b,c],b,true),null);
  assert.equal(wrappedTabTarget([a,b,c],c,true),null);
});

test("focus starting outside the dialog is redirected in either direction", () => {
  const first={},last={};
  assert.equal(wrappedTabTarget([first,last],{},false),first);
  assert.equal(wrappedTabTarget([first,last],{},true),last);
  assert.equal(wrappedTabTarget([],{},false),null);
});

test("single focusable control loops in both directions",()=>{
  const item={};
  assert.equal(wrappedTabTarget([item],item,false),item);
  assert.equal(wrappedTabTarget([item],item,true),item);
});

test("focus restoration is allowed only to a still-connected opener",()=>{
  let count=0;
  const opener={isConnected:true,focus:()=>{count++;}};
  assert.equal(restoreFocusToOpener(opener),true);
  assert.equal(count,1);
  assert.equal(restoreFocusToOpener({isConnected:false,focus:()=>count++}),false);
  assert.equal(restoreFocusToOpener(null),false);
  assert.equal(restoreFocusToOpener({isConnected:true}),false);
  assert.equal(count,1);
});

test("inspector hooks run once per mount and do not reset on closure callback churn",()=>{
  const s=readFileSync("src/main.jsx","utf8");
  assert.match(s,/const dialogRef = useRef\(null\)/);
  assert.match(s,/const onCloseRef = useRef\(onClose\)/);
  assert.match(s,/onCloseRef\.current = onClose/);
  assert.match(s,/document\.addEventListener\("keydown", onKey\)/);
  assert.match(s,/document\.addEventListener\("focusin", onFocus\)/);
  assert.match(s,/wrappedTabTarget\(/);
  assert.match(s,/restoreFocusToOpener\(opener\)/);
  assert.match(s,/\}, \[\]\);[\s\S]*const state = deriveState/);
  assert.match(s,/<aside ref=\{dialogRef\} tabIndex=\{-1\}/);
});

test("R12 and R14 real-browser selectors match R15 accessible name",()=>{
  const smoke=readFileSync("scripts/r12_browser_smoke.mjs","utf8");
  const audit=readFileSync("scripts/r14_live_a11y_audit.mjs","utf8");
  for(const file of [smoke,audit]){
    assert.match(file,/getByRole\("button", \{ name: \/Inspect repository:\\s\*PhiMadaPrime\/ \}\)/);
    assert.doesNotMatch(file,/desk-filled\[aria-label="Inspect PhiMadaPrime"\]/);
  }
  assert.match(smoke,/INSPECTOR_DID_NOT_RESTORE_OPENER_FOCUS/);
  assert.match(audit,/FORWARD_TAB_ESCAPED_MODAL/);
  assert.match(audit,/REVERSE_TAB_ESCAPED_MODAL/);
  assert.match(audit,/OPENER_FOCUS_NOT_RESTORED/);
});

const source="a".repeat(40);
const scans=Object.fromEntries(A11Y_VIEWS.map(name=>[name,{
  view:name,violation_rules:0,incomplete_rules:0,passed_rules:1,
  violations:[],findings_truncated:false
}]));
const keyboard={
  desk_keyboard_open:"PASS", inspector_tab_contained:"PASS",
  inspector_escape_close:"PASS", inspector_focus_return:"PASS",
  mission_board_keyboard_open:"PASS", evidence_details_keyboard_toggle:"PASS"
};
const receipt=(keyOverride={})=>a11yReceipt({
  expectedSha:source,beforeSha:source,afterSha:source,deployedSha:source,
  views:scans,keyboard:{...keyboard,...keyOverride},errors:[],
  observedUtc:"2026-11-03T21:00:00Z",runId:"1"
});

test("R14 now requires all six keyboard checks",()=>{
  const r=receipt();
  assert.equal(r.state,"AUTOMATED_ACCESSIBILITY_CHECKS_CLEAR_AT_OBSERVED_SHA");
  assert.equal(Object.keys(r.keyboard).length,6);
  assert.equal(r.full_wcag_conformance_verified,false);
  assert.equal(r.accessibility_contract_accepted,false);
  assert.equal(r.merge_authorized,false);
  assert.equal(r.product_verified,false);
});

test("a focus trap or focus restoration failure blocks scoped clear result",()=>{
  for(const field of ["inspector_tab_contained","inspector_focus_return"]){
    const r=receipt({[field]:"FAIL"});
    assert.equal(r.state,"KEYBOARD_CHECKS_REQUIRE_REVIEW");
    assert.equal(r.automated_accessibility_checks_clear,false);
    assert.equal(r.accessibility_contract_accepted,false);
  }
});

test("missing focus checks never yield a clean audit",()=>{
  const r=a11yReceipt({
    expectedSha:source,beforeSha:source,afterSha:source,deployedSha:source,
    views:scans,keyboard:{
      desk_keyboard_open:"PASS",inspector_escape_close:"PASS",
      mission_board_keyboard_open:"PASS",evidence_details_keyboard_toggle:"PASS"
    },errors:[],observedUtc:"2026-11-03T21:00:00Z",runId:"1"
  });
  assert.equal(r.state,"KEYBOARD_CHECKS_REQUIRE_REVIEW");
  assert.equal(r.keyboard.inspector_tab_contained,"NOT_RUN");
  assert.equal(r.keyboard.inspector_focus_return,"NOT_RUN");
});
