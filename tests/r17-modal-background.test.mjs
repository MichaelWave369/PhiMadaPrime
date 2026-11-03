import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  A11Y_VIEWS, A11Y_TAGS, a11yReceipt
} from "../scripts/r14_a11y_contract.mjs";

const app = readFileSync("src/main.jsx", "utf8");
const scanner = readFileSync("scripts/r14_live_a11y_audit.mjs", "utf8");

test("real header and office workspace are inert only when an inspector is selected", () => {
  assert.match(app, /<header className="topbar" inert=\{Boolean\(selected\)\}>/);
  assert.match(app, /<div className="workspace" inert=\{Boolean\(selected\)\}>/);
  assert.match(app, /<aside ref=\{dialogRef\} tabIndex=\{-1\} className="inspector" role="dialog" aria-modal="true"/);
  const workspaceEnd = app.indexOf("{selected && <DetailPanel");
  const workspaceStart = app.indexOf('<div className="workspace" inert={Boolean(selected)}>');
  assert(workspaceEnd > workspaceStart);
  // The inspector is rendered outside the inert workspace, as a sibling.
  assert.match(app.slice(workspaceStart, workspaceEnd),
    /<\/main>\s*<\/div>\s*$/);
});

test("inspector opener is captured before background inertness takes effect", () => {
  assert.match(app, /const inspectorOpenerRef = useRef\(null\)/);
  assert.match(app, /function selectDesk\(id\) \{\s*\/\/[^\n]*\n\s*inspectorOpenerRef\.current = document\.activeElement;\s*setSelectedId\(id\);/);
  assert.equal((app.match(/onSelect=\{selectDesk\}/g) || []).length, 2);
  assert.match(app, /originalOpener=\{inspectorOpenerRef\.current\}/);
  assert.match(app, /const opener = originalOpener/);
  assert.doesNotMatch(app, /const opener = document\.activeElement/);
});

test("modal has a keyboard focus trap and restores the original desk focus", () => {
  assert.match(app, /document\.addEventListener\("keydown", onKey\)/);
  assert.match(app, /document\.addEventListener\("focusin", onFocus\)/);
  assert.match(app, /wrappedTabTarget\(/);
  assert.match(app, /restoreFocusToOpener\(opener\)/);
});

test("live R14 inspects the actual inert state before scanning the modal", () => {
  assert.match(scanner, /const header = document\.querySelector\("header\.topbar"\)/);
  assert.match(scanner, /const workspace = document\.querySelector\("\.workspace"\)/);
  assert.match(scanner, /Boolean\(header\?\.inert && workspace\?\.inert && dialog &&/);
  assert.match(scanner, /!dialog\.closest\("\[inert\]"\)/);
  assert.match(scanner, /MODAL_BACKGROUND_NOT_INERT/);
  assert.match(scanner, /await axeView\("inspector"\)/);
  assert.doesNotMatch(scanner, /disableRules|\.exclude\(/);
});

test("incomplete axe rules remain review blockers even if definite violations vanish", () => {
  const sha = "a".repeat(40);
  const views = Object.fromEntries(A11Y_VIEWS.map(view => [view, {
    view, status:"NO_AUTOMATED_VIOLATIONS_OBSERVED",
    violation_rules:0,
    incomplete_rules:3,
    incomplete_rule_ids:["aria-prohibited-attr","color-contrast","label-content-name-mismatch"],
    passed_rules:22,violations:[],findings_truncated:false
  }]));
  const keyboard = Object.fromEntries([
    "desk_keyboard_open","inspector_tab_contained","inspector_escape_close",
    "inspector_focus_return","mission_board_keyboard_open",
    "evidence_details_keyboard_toggle"
  ].map(name => [name,"PASS"]));
  const receipt = a11yReceipt({
    expectedSha:sha,beforeSha:sha,afterSha:sha,deployedSha:sha,
    views,keyboard,errors:[],observedUtc:"2026-11-03T22:00:00Z",runId:"41725853210"
  });
  assert.equal(receipt.state,"AUTOMATED_ACCESSIBILITY_FINDINGS_REQUIRE_REVIEW");
  assert.equal(receipt.automated_accessibility_checks_clear,false);
  assert.equal(receipt.accessibility_contract_accepted,false);
  assert.equal(receipt.full_wcag_conformance_verified,false);
  assert.equal(receipt.product_verified,false);
  assert.equal(receipt.merge_authorized,false);
});

test("the exact same A and AA axe tags remain enabled after modal repair", () => {
  assert.deepEqual([...A11Y_TAGS],[
    "wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"
  ]);
});
