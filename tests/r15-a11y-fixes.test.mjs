import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeAxeView, a11yReceipt, A11Y_VIEWS
} from "../scripts/r14_a11y_contract.mjs";
const main = readFileSync("src/main.jsx", "utf8");
const map = readFileSync("src/living.css", "utf8");
const office = readFileSync("src/office.css", "utf8");

test("visible repo desk text is part of button accessible name", () => {
  assert.match(main, /onClick=\{\(\) => onSelect\(repo\.id\)\}>\s*<span className="sr-only">Inspect repository: <\/span>/);
  assert.doesNotMatch(main, /aria-label=\{"Inspect " \+ displayName\(repo\.name\)\}/);
  assert.match(main, /<span className="desk-label">/);
  assert.match(main, /<span className="desk-status">/);
});
test("both programmatically hidden uploader controls have explicit labels", () => {
  assert.match(main, /id="import-contracts" type="file" aria-label="Import local completion contracts JSON"/);
  assert.match(main, /id="import-evidence"\s*type="file" aria-label="Import fleet evidence JSON"/);
});
test("occupied minimap target meets 24px minimum in regular and narrow CSS", () => {
  assert.match(map, /grid-template-columns:repeat\(6,28px\)/);
  assert.match(map, /\.mini-map button\{width:28px;height:28px;/);
  assert.equal((map.match(/\.mini-map button\{width:28px;height:28px/g) || []).length,2);
  assert.match(map, /map-occupied:focus-visible\{outline:3px/);
});
test("inspector's nested secondary text is brighter on dark cards", () => {
  assert.match(office, /\.inspector small\{display:block;color:#e7deed/);
  assert.match(office, /\.details-list dt\{font:bold 11px monospace;color:#e4d9e8/);
  assert.doesNotMatch(office, /\.inspector small\{display:block;color:#9b90a3/);
});
test("axe details reveal only CSS classes, not element HTML or IDs", () => {
  const r=summarizeAxeView("inspector", {
    violations:[{
      id:"color-contrast",impact:"serious",help:"Contrast needs improvement",
      nodes:[
        {target:[".inspector .contract-check > small", "#private"],html:"<p>secret</p>"},
        {target:[".inspector .details-list dt"],html:"<p>password</p>"}
      ]
    }],
    incomplete:[{id:"color-contrast"}],
    passes:[{id:"document-title"}]
  });
  const finding=r.violations[0];
  assert.deepEqual(finding.selector_class_hints,
    [".inspector", ".contract-check", ".details-list"]);
  assert.deepEqual(r.incomplete_rule_ids,["color-contrast"]);
  assert(!JSON.stringify(r).includes("secret"));
  assert(!JSON.stringify(r).includes("password"));
  assert(!JSON.stringify(r).includes("#private"));
});
test("incomplete scans remain a review blocker despite no violations", () => {
  const viewData=Object.fromEntries(A11Y_VIEWS.map(view=>[view,
    summarizeAxeView(view,{
      violations:[],incomplete:view==="office"?[{id:"contrast-review"}]:[],
      passes:[{id:"aria-label"}]
    })]));
  const r=a11yReceipt({
    expectedSha:"a".repeat(40),beforeSha:"a".repeat(40),
    afterSha:"a".repeat(40),deployedSha:"a".repeat(40),
    views:viewData,
    keyboard:{
      desk_keyboard_open:"PASS",inspector_escape_close:"PASS",
      mission_board_keyboard_open:"PASS",evidence_details_keyboard_toggle:"PASS"
    },errors:[],runId:"1",observedUtc:"2026-11-03T21:30:00Z"
  });
  assert.equal(r.state,"AUTOMATED_ACCESSIBILITY_FINDINGS_REQUIRE_REVIEW");
  assert.equal(r.automated_accessibility_checks_clear,false);
  assert.equal(r.accessibility_contract_accepted,false);
  assert.equal(r.product_verified,false);
  assert.equal(r.merge_authorized,false);
});
