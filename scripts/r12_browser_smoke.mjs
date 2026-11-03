// R12: manual read-only Chromium smoke of the actual public PhiMada Pages site.
// No logins, source execution from imported files, GitHub writes or merges.
import { chromium } from "playwright";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import {
  BROWSER_SITE, BROWSER_REPO, BROWSER_CONFIRM, BROWSER_CHECKS,
  requireManualBrowserPilot, validateGithubSource, browserSmokeReceipt
} from "./r12_browser_contract.mjs";

function argumentsFrom(argv) {
  const obj = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    if (!["--sha", "--confirm", "--output"].includes(key) ||
        typeof value !== "string" || value.startsWith("--") ||
        Object.hasOwn(obj, key)) {
      throw new Error("R12_CLI_ARGS_INVALID");
    }
    obj[key] = value;
  }
  if (Object.keys(obj).length !== 3) throw new Error("R12_CLI_ARGS_MISSING");
  requireManualBrowserPilot(obj["--sha"], obj["--confirm"]);
  return { sha: obj["--sha"], output: obj["--output"] };
}

const API_BASE = "https://api.github.com/repos/" + BROWSER_REPO;
async function publicGithub(path) {
  if (path !== "" && path !== "/branches/main")
    throw new Error("R12_GITHUB_API_PATH_REJECTED");
  const response = await fetch(API_BASE + path, {
    method: "GET", redirect: "error", headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "phimada-r12-browser-smoke",
      ...(process.env.GITHUB_TOKEN ? {
        "Authorization": "Bearer " + process.env.GITHUB_TOKEN
      } : {})
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("R12_GITHUB_HTTP_" + response.status);
  const raw = await response.text();
  if (raw.length > 100000) throw new Error("R12_GITHUB_RESPONSE_TOO_LARGE");
  return JSON.parse(raw);
}
async function observedSource(sha) {
  const repo = await publicGithub("");
  const heads = [await publicGithub("/branches/main"),
    await publicGithub("/branches/main")];
  return validateGithubSource(repo, heads, sha);
}
const sanitize = error => String(error?.message || error || "UNKNOWN")
  .replace(/[\r\n\t]+/g, " ").slice(0, 250);

async function smoke(sha) {
  const checks = {};
  const errors = [];
  let browser = null;
  let beforeSha = null, afterSha = null, builtSha = null;
  let runningError = null;

  try {
    beforeSha = await observedSource(sha);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce", serviceWorkers: "block",
      acceptDownloads: false
    });
    const page = await context.newPage();
    page.on("pageerror", e => {
      if (errors.length < 20) errors.push(sanitize(e));
    });
    async function check(id, action) {
      if (!BROWSER_CHECKS.includes(id)) throw new Error("R12_CHECK_UNEXPECTED");
      try {
        await action();
        checks[id] = "PASS";
      } catch (err) {
        checks[id] = "FAIL";
        throw new Error(id + ": " + sanitize(err));
      }
    }
    await check("page_boot", async () => {
      const response = await page.goto(BROWSER_SITE, {
        waitUntil: "domcontentloaded", timeout: 45000
      });
      if (!response || response.status() !== 200)
        throw new Error("SITE_HTTP_NOT_200");
      await page.locator("header.topbar").waitFor({ timeout: 20000 });
      const title = await page.title();
      if (!title.includes("Mada Prime")) throw new Error("TITLE_INVALID");
      const stamp = page.getByTestId("phimada-deployed-revision");
      await stamp.waitFor({ timeout: 10000 });
      builtSha = await stamp.getAttribute("data-build-sha");
      if (builtSha !== sha) throw new Error("DEPLOYED_BUILD_SHA_MISMATCH");
    });
    await check("public_catalog", async () => {
      const signal = page.locator(".feed-state");
      await signal.waitFor({ timeout: 20000 });
      await page.waitForFunction(() => {
        const text = document.querySelector(".feed-state")?.textContent || "";
        return /GITHUB PUBLIC|EXAMPLE MODE/.test(text);
      }, null, { timeout: 40000 });
      if (!((await signal.textContent()) || "").includes("GITHUB PUBLIC"))
        throw new Error("PUBLIC_CATALOG_UNAVAILABLE");
    });
    await check("search_repo", async () => {
      await page.locator("#fleet-search").fill("PhiMadaPrime");
      await page.locator('button.desk-filled[aria-label="Inspect PhiMadaPrime"]')
        .waitFor({ timeout: 12000 });
    });
    await check("inspect_desk", async () => {
      await page.locator('button.desk-filled[aria-label="Inspect PhiMadaPrime"]')
        .click();
      await page.getByRole("dialog",
        { name: "Repository inspector: PhiMadaPrime" }).waitFor({ timeout: 10000 });
    });
    await check("close_inspector", async () => {
      await page.keyboard.press("Escape");
      await page.locator(".inspector-backdrop").waitFor({ state: "hidden" });
    });
    await check("open_mission_board", async () => {
      await page.locator("button.mission-open-button").click();
      await page.locator(".missions-board").waitFor({ timeout: 10000 });
      const title = await page.locator(".missions-board h2").textContent();
      if (!title?.includes("THE MISSION BOARD"))
        throw new Error("MISSION_BOARD_HEADING_MISSING");
    });
    await check("evidence_bay_controls", async () => {
      const bay = page.locator("details.evidence-bay");
      await bay.locator("summary").click();
      if (!(await bay.evaluate(el => el.open)))
        throw new Error("EVIDENCE_BAY_NOT_EXPANDED");
      if (await bay.locator('input[type="file"]').count() !== 2)
        throw new Error("EVIDENCE_UPLOAD_FIELDS_MISSING");
      if (await bay.locator(".evidence-bay-coverage").count() !== 0)
        throw new Error("UNVERIFIED_COVERAGE_DISPLAYED_WITHOUT_RECEIPT");
    });
    await check("return_to_desks", async () => {
      await page.locator(".missions-board button.mission-close").click();
      await page.locator(".missions-board").waitFor({ state: "hidden" });
      await page.locator(".desk-grid").first().waitFor({ timeout: 10000 });
    });
    await context.close();
  } catch (err) {
    runningError = sanitize(err);
  } finally {
    if (browser) await browser.close().catch(() => {});
    try {
      afterSha = await observedSource(sha);
    } catch (err) {
      errors.push("POSTFLIGHT_" + sanitize(err));
    }
    if (runningError) errors.push(runningError);
  }
  return browserSmokeReceipt({
    expectedSha: sha, beforeSha, afterSha, builtSha, checks,
    errors: errors.slice(0, 20),
    runId: process.env.GITHUB_RUN_ID || null,
    observedUtc: new Date().toISOString()
  });
}

async function main() {
  let args;
  try {
    args = argumentsFrom(process.argv.slice(2));
  } catch (err) {
    process.stderr.write("R12_HELD " + sanitize(err) + "\n");
    process.exitCode = 1;
    return;
  }
  const report = await smoke(args.sha);
  await mkdir(dirname(args.output), { recursive: true, mode: 0o700 });
  const file = await open(args.output, "wx", 0o600);
  try {
    await file.writeFile(JSON.stringify(report, null, 2) + "\n");
    await file.sync();
  } finally {
    await file.close();
  }
  process.stdout.write(JSON.stringify({
    state: report.state,
    source_sha: report.source_sha,
    observed_deployment_build_marker: report.observed_deployment_build_marker,
    passed_checks: Object.values(report.checks).filter(x => x === "PASS").length,
    merge_authorized: false,
    product_verified: false
  }) + "\n");
  process.exitCode = report.automated_browser_smoke_passed ? 0 : 1;
}
main().catch(err => {
  process.stderr.write("R12_HELD " + sanitize(err) + "\n");
  process.exitCode = 1;
});

