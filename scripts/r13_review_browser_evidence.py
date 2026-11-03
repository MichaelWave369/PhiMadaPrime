"""R13: independent, read-only evidence review of one R12 browser pilot ZIP.

Usage:
  python scripts/r13_review_browser_evidence.py --run-id 41710656371 \
    --artifact-zip local-fleet/r12-browser.zip \
    --output local-fleet/reviews/r13-browser.json

A ZIP-matched GitHub Actions receipt is *historical evidence of eight
automated browser checks*, not signed attestation, independent replay,
accessibility audit, product completion or merge authorization.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener
import zipfile

REPO = "MichaelWave369/PhiMadaPrime"
REPO_ID = 1443845098
SITE = "https://michaelwave369.github.io/PhiMadaPrime/"
WORKFLOW = ".github/workflows/r12-browser-smoke.yml"
RECEIPT_SCHEMA = "phimada.live-browser-smoke.v0.12"
REVIEW_SCHEMA = "phimada.browser-evidence-review.v0.13"
CHECKS = ("page_boot", "public_catalog", "search_repo", "inspect_desk",
          "close_inspector", "open_mission_board", "evidence_bay_controls",
          "return_to_desks")
HEX40 = re.compile(r"[a-f0-9]{40}\Z")
HEX64 = re.compile(r"[a-f0-9]{64}\Z")
RUN_ID = re.compile(r"[1-9][0-9]{0,19}\Z")
MAX_ARCHIVE = 2_000_000
MAX_RECEIPT = 32_000
MAX_RESPONSE = 250_000


class Held(Exception):
    pass


def ensure(condition, code):
    if not condition:
        raise Held(code)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def github_get(path, token=None):
    """Fixed GitHub origin/allowlisted Actions and public metadata GETs."""
    prefix = "/repos/" + REPO
    valid = (path in (prefix, prefix + "/branches/main") or
             re.fullmatch(re.escape(prefix) +
               r"/actions/runs/[1-9][0-9]{0,19}(?:/artifacts\?per_page=100)?",
               path) is not None)
    ensure(valid, "GITHUB_ENDPOINT_NOT_ALLOWED")
    headers = {"Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "phimada-r13-readonly-review"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = Request("https://api.github.com" + path, headers=headers, method="GET")
    try:
        with build_opener(NoRedirect()).open(req, timeout=15) as handle:
            ensure(handle.status == 200, "GITHUB_UNEXPECTED_HTTP")
            data = handle.read(MAX_RESPONSE + 1)
    except HTTPError as exc:
        raise Held("GITHUB_HTTP_" + str(exc.code)) from None
    except (URLError, TimeoutError, OSError):
        raise Held("GITHUB_READ_FAILED") from None
    ensure(len(data) <= MAX_RESPONSE, "GITHUB_RESPONSE_TOO_LARGE")
    try:
        return json.loads(data.decode("utf8"))
    except (ValueError, UnicodeError):
        raise Held("GITHUB_RESPONSE_JSON_INVALID") from None


def parse_date(raw):
    ensure(isinstance(raw, str) and len(raw) <= 64, "TIME_INVALID")
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise Held("TIME_INVALID") from None
    ensure(value.tzinfo is not None, "TIME_MISSING_ZONE")
    return value.astimezone(timezone.utc)


def read_receipt_zip(raw):
    ensure(isinstance(raw, bytes) and 0 < len(raw) <= MAX_ARCHIVE,
           "ZIP_TOO_LARGE_OR_MISSING")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            seen = []
            for entry in archive.infolist():
                if entry.is_dir():
                    ensure(entry.filename == "r12-artifacts/", "ZIP_EXTRA_DIRECTORY")
                    continue
                ensure(entry.filename in ("browser-smoke.json",
                                          "r12-artifacts/browser-smoke.json"),
                       "ZIP_UNEXPECTED_MEMBER")
                ensure(not seen and 0 < entry.file_size <= MAX_RECEIPT and
                       entry.compress_size <= MAX_ARCHIVE and
                       entry.flag_bits & 1 == 0 and
                       ((entry.external_attr >> 16) & 0o170000) in (0, 0o100000),
                       "ZIP_MEMBER_INVALID")
                content = archive.read(entry)
                ensure(len(content) == entry.file_size and
                       len(content) <= MAX_RECEIPT, "ZIP_SIZE_MISMATCH")
                seen.append(content)
            ensure(len(seen) == 1, "ZIP_RECEIPT_MISSING_OR_DUPLICATED")
            result = json.loads(seen[0].decode("utf8"))
    except (zipfile.BadZipFile, UnicodeError, ValueError, EOFError, RuntimeError):
        raise Held("ZIP_RECEIPT_UNREADABLE") from None
    ensure(isinstance(result, dict), "ZIP_RECEIPT_NOT_OBJECT")
    return result


def verify_receipt(receipt, run_id, run):
    ensure(receipt.get("schema") == RECEIPT_SCHEMA and
           receipt.get("state") == "AUTOMATED_BROWSER_SMOKE_PASSED_AT_OBSERVED_SHA" and
           receipt.get("repository") == REPO and
           type(receipt.get("repository_id")) is int and
           receipt["repository_id"] == REPO_ID and
           receipt.get("target_url") == SITE and
           receipt.get("workflow_run_id") == str(run_id),
           "RECEIPT_IDENTITY_INVALID")
    sha = receipt.get("source_sha")
    ensure(isinstance(sha, str) and HEX40.fullmatch(sha) is not None and
           sha == run.get("head_sha") and
           receipt.get("github_head_before_sha") == sha and
           receipt.get("github_head_after_sha") == sha and
           receipt.get("observed_deployment_build_marker") == sha and
           receipt.get("deployed_marker_matches_requested_sha") is True,
           "RECEIPT_SOURCE_OR_DEPLOYMENT_MISMATCH")
    ensure(receipt.get("automated_browser_smoke_passed") is True and
           isinstance(receipt.get("browser_runtime_errors"), list) and
           receipt["browser_runtime_errors"] == [] and
           isinstance(receipt.get("checks"), dict) and
           set(receipt["checks"]) == set(CHECKS) and
           all(receipt["checks"][name] == "PASS" for name in CHECKS),
           "BROWSER_CHECKS_INCOMPLETE")
    for field in ("marker_is_signed_deployment_attestation",
                  "keyboard_accessibility_audited",
                  "full_accessibility_reviewed",
                  "complete_user_journeys_verified",
                  "deployed_revision_cryptographically_verified",
                  "product_verified", "verified_complete",
                  "merge_authorized", "job_dispatch_authorized"):
        ensure(receipt.get(field) is False, "RECEIPT_AUTHORITY_INVALID")
    ensure(receipt.get("operator_review_required") is True,
           "OPERATOR_REVIEW_MISSING")
    observed = parse_date(receipt.get("observed_utc"))
    created = parse_date(run["created_at"])
    updated = parse_date(run["updated_at"])
    ensure(created - timedelta(minutes=5) <= observed <=
           updated + timedelta(minutes=5), "RECEIPT_RUN_TIMELINE_INVALID")
    return sha, observed


def check_run(run, run_id, now):
    ensure(isinstance(run, dict) and type(run.get("id")) is int and
           run["id"] == run_id and run.get("path") == WORKFLOW and
           run.get("event") == "workflow_dispatch" and
           run.get("status") == "completed" and
           run.get("conclusion") == "success" and
           type(run.get("run_attempt")) is int and run["run_attempt"] == 1,
           "RUN_NOT_SUCCESSFUL_MANUAL_FIRST_ATTEMPT")
    repo = run.get("repository")
    head_repo = run.get("head_repository")
    ensure(isinstance(repo, dict) and type(repo.get("id")) is int and
           repo["id"] == REPO_ID and repo.get("full_name") == REPO and
           isinstance(head_repo, dict) and head_repo.get("full_name") == REPO and
           isinstance(run.get("head_sha"), str) and
           HEX40.fullmatch(run["head_sha"]) is not None,
           "RUN_REPOSITORY_INVALID")
    created = parse_date(run.get("created_at"))
    ensure(created <= now + timedelta(minutes=5) and
           now - created <= timedelta(days=7), "RUN_TOO_OLD_OR_FUTURE")


def read_current_head(get, token):
    repo = get("/repos/" + REPO, token)
    owner = repo.get("owner") if isinstance(repo, dict) else None
    ensure(isinstance(repo, dict) and type(repo.get("id")) is int and
           repo["id"] == REPO_ID and repo.get("full_name") == REPO and
           isinstance(owner, dict) and owner.get("login") == "MichaelWave369" and
           repo.get("private") is False and repo.get("archived") is False and
           repo.get("default_branch") == "main",
           "CURRENT_REPO_IDENTITY_INVALID")
    heads = [get("/repos/" + REPO + "/branches/main", token) for _ in range(2)]
    sha = []
    for head in heads:
        value = head.get("commit") if isinstance(head, dict) else None
        ensure(isinstance(head, dict) and head.get("name") == "main" and
               isinstance(value, dict) and isinstance(value.get("sha"), str) and
               HEX40.fullmatch(value["sha"]) is not None,
               "CURRENT_HEAD_INVALID")
        sha.append(value["sha"])
    ensure(sha[0] == sha[1], "CURRENT_HEAD_CHANGED_DURING_READ")
    return sha[1]


def review(run_id, zip_bytes, get=github_get, token=None, now=None):
    ensure(type(run_id) is int and 0 < run_id < 10**20, "RUN_ID_INVALID")
    ensure(callable(get), "GITHUB_CLIENT_INVALID")
    now = now or datetime.now(timezone.utc)
    ensure(isinstance(now, datetime) and now.tzinfo is not None, "NOW_INVALID")
    now = now.astimezone(timezone.utc)
    base = "/repos/" + REPO + "/actions/runs/" + str(run_id)
    run = get(base, token)
    check_run(run, run_id, now)
    artifacts = get(base + "/artifacts?per_page=100", token)
    ensure(isinstance(artifacts, dict) and
           type(artifacts.get("total_count")) is int and
           0 < artifacts["total_count"] <= 100 and
           isinstance(artifacts.get("artifacts"), list) and
           len(artifacts["artifacts"]) == artifacts["total_count"],
           "ARTIFACT_LIST_INVALID_OR_INCOMPLETE")
    name = "phimada-r12-browser-" + str(run_id)
    matching = [a for a in artifacts["artifacts"]
                if isinstance(a, dict) and a.get("name") == name]
    ensure(len(matching) == 1, "ARTIFACT_MISSING_OR_DUPLICATE")
    artifact = matching[0]
    expected_digest = artifact.get("digest")
    ensure(type(artifact.get("id")) is int and artifact["id"] > 0 and
           artifact.get("expired") is False and
           type(artifact.get("size_in_bytes")) is int and
           artifact["size_in_bytes"] == len(zip_bytes) and
           0 < len(zip_bytes) <= MAX_ARCHIVE and
           isinstance(expected_digest, str) and
           expected_digest.startswith("sha256:") and
           HEX64.fullmatch(expected_digest[7:]) is not None and
           (not isinstance(artifact.get("workflow_run"), dict) or
            artifact["workflow_run"].get("id") == run_id),
           "ARTIFACT_METADATA_INVALID")
    ensure(hashlib.sha256(zip_bytes).hexdigest() == expected_digest[7:],
           "ARTIFACT_SHA256_MISMATCH")
    receipt = read_receipt_zip(zip_bytes)
    sha, observed = verify_receipt(receipt, run_id, run)
    current = read_current_head(get, token)
    stable = current == sha
    return {
        "schema": REVIEW_SCHEMA,
        "state": ("BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA" if stable else
                  "BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA"),
        "reviewed_utc": now.isoformat(),
        "source": "GITHUB_ACTIONS_RUN_AND_ARTIFACT_SHA256",
        "repository": REPO, "repository_id": REPO_ID,
        "workflow_path": WORKFLOW,
        "workflow_run_id": run_id, "workflow_attempt": 1,
        "workflow_source_sha": run["head_sha"],
        "artifact_id": artifact["id"], "artifact_name": name,
        "artifact_bytes": len(zip_bytes),
        "artifact_sha256": expected_digest[7:],
        "artifact_digest_correlated": True,
        "browser_source_sha": sha, "current_observed_head_sha": current,
        "current_head_matches_browser_source": stable,
        "browser_observed_utc": observed.isoformat(),
        "reported_browser_checks": {name: "PASS" for name in CHECKS},
        "browser_check_count": len(CHECKS),
        "artifact_zip_contents_validated": True,
        "independently_replayed": False,
        "complete_user_journeys_verified": False,
        "accessibility_verified": False,
        "deployment_cryptographically_attested": False,
        "product_verified": False, "verified_complete": False,
        "merge_authorized": False, "dispatch_authorized": False,
        "operator_review_required": True
    }


def write_exclusive(path, report):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    ensure(not target.exists() and not target.is_symlink(), "OUTPUT_ALREADY_EXISTS")
    raw = (json.dumps(report, sort_keys=True, indent=2) + "\n").encode()
    ensure(len(raw) <= MAX_RECEIPT, "REVIEW_TOO_LARGE")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(target, flags, 0o600)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        if os.name == "posix":
            os.chmod(target, 0o600)
    except BaseException:
        target.unlink(missing_ok=True)
        raise


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run-id", required=True)
    p.add_argument("--artifact-zip", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    opts = p.parse_args(argv)
    try:
        ensure(RUN_ID.fullmatch(opts.run_id) is not None, "RUN_ID_INVALID")
        path = opts.artifact_zip
        ensure(path.is_file() and not path.is_symlink() and
               0 < path.stat().st_size <= MAX_ARCHIVE, "ZIP_INPUT_INVALID")
        raw = path.read_bytes()
        report = review(int(opts.run_id), raw, token=os.environ.get("GITHUB_TOKEN"))
        write_exclusive(opts.output, report)
        print(json.dumps({"state": report["state"],
                          "browser_source_sha": report["browser_source_sha"],
                          "browser_check_count": report["browser_check_count"],
                          "product_verified": False,
                          "merge_authorized": False}))
        return 0 if report["current_head_matches_browser_source"] else 2
    except (Held, OSError, ValueError) as exc:
        print("R13_HELD " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
