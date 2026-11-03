// R14 manual live axe accessibility audit for the exact deployed PhiMada SHA.
// Observations are automated *findings*, never complete WCAG certification.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import {
  A11Y_CONFIRM, A11Y_TAGS, BROWSER_SITE, BROWSER_REPO,
  validateA11yLaunch, validateGithubSource,
  summarizeAxeView, a11yReceipt
} from "./r14_a11y_contract.mjs";

function sanitize(value) {
  return String(value?.message || value || "UNKNOWN")
    .replace(/[\r\n\t]+/g, " ").slice(0, 250);
}
function argsFrom(argv) {
  if (argv.length !== 6) throw new Error("R14_ARGUMENT_COUNT_INVALID");
  const params = {};
  for (let i=0; i<argv.length; i+=2) {
    if (!["--sha", "--confirm", "--output"].includes(argv[i]) ||
        Object.hasOwn(params, argv[i]) ||
        typeof argv[i+1] !== "string" || !argv[i+1] ||
        argv[i+1].startsWith("--"))
      throw new Error("R14_ARGUMENTS_INVALID");
    params[argv[i]] = argv[i+1];
  }
  validateA11yLaunch(params["--sha"], params["--confirm"]);
  return { sha: params["--sha"], output: params["--output"] };
}
const API = "https://api.github.com/repos/" + BROWSER_REPO;
async function githubGet(path) {
  if (path !== "" && path !== "/branches/main")
    throw new Error("R14_GITHUB_PATH_FORBIDDEN");
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "phimada-r14-a11y-audit"
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization =
    "Bearer " + process.env.GITHUB_TOKEN;
  const response = await fetch(API + path, {
    method: "GET", headers, redirect: "error",
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("R14_GITHUB_HTTP_" + response.status);
  const raw = await response.text();
  if (raw.length > 100000) throw new Error("R14_GITHUB_JSON_TOO_LARGE");
  return JSON.parse(raw);
}
async function observeSource(sha) {
  const repo = await githubGet("");
  const heads = [await githubGet("/branches/main"),
    await githubGet("/branches/main")];
  return validateGithubSource(repo, heads, sha);
}
async function audit(sha) {
  let browser, beforeSha = null, afterSha = null, deployedSha = null;
  const views = {}, keyboard = {}, errors = [];
  const capture = (e) => {
    if (errors.length < 20) errors.push(sanitize(e));
  };
  const check = async (name, fn) => {
    try { await fn(); keyboard[name] = "PASS"; return true; }
    catch (e) { keyboard[name] = "FAIL"; capture(name + ": " + sanitize(e)); return false; }
  };
  try {
    beforeSha = await observeSource(sha);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: {width: 1440, height: 900},
      reducedMotion: "reduce", serviceWorkers: "block",
      acceptDownloads: false
    });
    const page = await context.newPage();
    page.on("pageerror", capture);
    async function axeView(view) {
      try {
        const scan = await new AxeBuilder({ page }).withTags([...A11Y_TAGS]).analyze();
        views[view] = summarizeAxeView(view, scan);
      } catch(e) { capture("AXE_" + view + ": " + sanitize(e)); }
    }
    try {
      const response = await page.goto(BROWSER_SITE, {
        waitUntil: "domcontentloaded", timeout: 45000
      });
      if (!response || response.status() !== 200)
        throw new Error("PAGES_HTTP_NOT_200");
      await page.locator("header.topbar").waitFor({ timeout: 20000 });
      await page.locator(".feed-state").waitFor({ timeout: 20000 });
      await page.waitForFunction(() =>
        document.querySelector(".feed-state")?.textContent?.includes("GITHUB PUBLIC"),
        null, { timeout: 40000 });
      deployedSha = await page.getByTestId("phimada-deployed-revision")
        .getAttribute("data-build-sha");
      if (deployedSha !== sha)
        throw new Error("DEPLOYED_MARKER_NOT_REQUESTED_SOURCE_SHA");
      await axeView("office");
      await page.locator("#fleet-search").fill("PhiMadaPrime");
    } catch(e) {
      capture("PAGE_BOOT: " + sanitize(e));
    }
    const opened = await check("desk_keyboard_open", async () => {
      const desk = page.getByRole("button", { name: /Inspect repository:\s*PhiMadaPrime/ });
      await desk.waitFor({ timeout: 15000 });
      await desk.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog", {name:"Repository inspector: PhiMadaPrime"})
        .waitFor({timeout: 10000});
    });
    if (opened) await axeView("inspector");
    await check("inspector_tab_contained", async () => {
      if (!opened) throw new Error("INSPECTOR_NOT_OPEN");
      const lastLink = page.locator(".inspector-actions a").last();
      await lastLink.waitFor({timeout:10000});
      await lastLink.focus();
      await page.keyboard.press("Tab");
      const wrappedForward = await page.locator(".close-inspector")
        .evaluate(node => node === document.activeElement);
      if (!wrappedForward) throw new Error("FORWARD_TAB_ESCAPED_MODAL");
      await page.keyboard.press("Shift+Tab");
      const wrappedBackward = await lastLink
        .evaluate(node => node === document.activeElement);
      if (!wrappedBackward) throw new Error("REVERSE_TAB_ESCAPED_MODAL");
    });
    await check("inspector_escape_close", async () => {
      if (!opened) throw new Error("INSPECTOR_WAS_NOT_OPENED");
      await page.keyboard.press("Escape");
      await page.locator(".inspector-backdrop").waitFor({ state:"hidden", timeout: 10000 });
    });
    await check("inspector_focus_return", async () => {
      if (!opened) throw new Error("INSPECTOR_WAS_NOT_OPENED");
      const restored = await page.getByRole("button", {
        name: /Inspect repository:\s*PhiMadaPrime/
      }).evaluate(node => node === document.activeElement);
      if (!restored) throw new Error("OPENER_FOCUS_NOT_RESTORED");
    });
    const boardOpened = await check("mission_board_keyboard_open", async () => {
      const button = page.locator(".mission-open-button");
      await button.focus();
      await page.keyboard.press("Enter");
      await page.locator(".missions-board").waitFor({ timeout: 10000 });
    });
    await check("evidence_details_keyboard_toggle", async () => {
      if (!boardOpened) throw new Error("MISSION_BOARD_NOT_OPEN");
      const item = page.locator(".evidence-bay > summary");
      await item.focus();
      await page.keyboard.press("Enter");
      if (!(await page.locator(".evidence-bay").evaluate(el => el.open)))
        throw new Error("EVIDENCE_BAY_DID_NOT_EXPAND");
    });
    if (boardOpened) await axeView("mission_board");
    await context.close();
  } catch (e) {
    capture("AUDIT_ABORTED: " + sanitize(e));
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { afterSha = await observeSource(sha); }
    catch (e) { capture("POSTFLIGHT: " + sanitize(e)); }
  }
  return a11yReceipt({
    expectedSha: sha, beforeSha, afterSha, deployedSha,
    views, keyboard, errors: errors.slice(0, 20),
    observedUtc: new Date().toISOString(),
    runId: process.env.GITHUB_RUN_ID || null
  });
}
async function main() {
  const args = argsFrom(process.argv.slice(2));
  const report = await audit(args.sha);
  await mkdir(dirname(args.output), { recursive:true, mode:0o700 });
  const handle = await open(args.output, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify(report, null, 2) + "\n");
    await handle.sync(); }
  finally { await handle.close(); }
  const violationRules = Object.values(report.views)
    .filter(Boolean).reduce((total, view) => total + view.violation_rules, 0);
  process.stdout.write(JSON.stringify({
    state: report.state, source_sha: report.requested_source_sha,
    views_scanned: Object.values(report.views).filter(Boolean).length,
    violation_rules: violationRules,
    keyboard_passed: Object.values(report.keyboard).filter(x => x === "PASS").length,
    full_wcag_conformance_verified: false,
    product_verified: false, merge_authorized: false
  }) + "\n");
  process.exitCode = report.automated_accessibility_checks_clear ? 0 : 2;
}
main().catch(e => {
  process.stderr.write("R14_HELD " + sanitize(e) + "\n");
  process.exitCode = 1;
});
