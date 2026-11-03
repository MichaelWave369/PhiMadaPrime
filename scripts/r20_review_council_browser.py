"""R20 independent, read-only review of an ORIGINAL R19 Actions ZIP.

Does not execute browser tests, authenticate a source beyond GitHub artifact
metadata, verify scientific observations, or authorize Council actions.
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
import urllib.error
import urllib.request
import zipfile

REPO = "MichaelWave369/PhiMadaPrime"
REPO_ID = 1443845098
SITE = "https://michaelwave369.github.io/PhiMadaPrime/"
WORKFLOW = ".github/workflows/r19-council-browser.yml"
SOURCE_SCHEMA = "phimada.council-live-browser.v0.19"
REVIEW_SCHEMA = "phimada.council-browser-artifact-review.v0.20"
CHECKS = (
    "page_deployed_sha", "mission_board_and_council_open",
    "golden_receipt_display", "tampered_receipt_refused",
    "rehashed_authority_refused", "self_consistent_forgery_untrusted",
    "clear_restores_empty", "reload_discards_review",
    "no_write_requests_observed"
)
SOURCE_FIELDS = set((
    "schema", "state", "repository", "repository_id", "target_url",
    "source_sha", "github_head_before_sha", "github_head_after_sha",
    "observed_deployment_build_marker", "source_fixture_schema",
    "fixture_sha256", "fixture_origin", "fixture_source_authenticated",
    "council_consumer_execution_observed", "council_model_executed",
    "council_review_state", "checks", "browser_runtime_errors",
    "observed_utc", "workflow_run_id", "automated_council_browser_checks_passed",
    "deployed_revision_cryptographically_attested", "source_independent",
    "scientific_evidence", "accessibility_conformance_verified",
    "product_verified", "verified_complete", "dispatch_authorized",
    "merge_authorized", "operator_review_required"
))
OFF_FLAGS = (
    "fixture_source_authenticated", "council_consumer_execution_observed",
    "council_model_executed", "deployed_revision_cryptographically_attested",
    "source_independent", "scientific_evidence",
    "accessibility_conformance_verified", "product_verified", "verified_complete",
    "dispatch_authorized", "merge_authorized"
)
SHA40 = re.compile(r"[a-f0-9]{40}\Z")
SHA64 = re.compile(r"[a-f0-9]{64}\Z")
RUN_ID = re.compile(r"[1-9][0-9]{0,18}\Z")
MAX_ARCHIVE = 2_000_000
MAX_RECEIPT = 65_536
MAX_RESPONSE = 250_000


class Held(Exception):
    pass


def ensure(value, code):
    if not value:
        raise Held(code)


def no_duplicate_pairs(pairs):
    result = {}
    for key, value in pairs:
        ensure(key not in result, "JSON_DUPLICATE_KEY")
        result[key] = value
    return result


def json_strict(raw):
    return json.loads(raw, object_pairs_hook=no_duplicate_pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(Held("JSON_NONFINITE")))


def utc(value):
    ensure(isinstance(value, str) and len(value) <= 60, "TIME_MISSING")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise Held("TIME_INVALID") from None
    ensure(parsed.tzinfo is not None, "TIME_WITHOUT_ZONE")
    return parsed.astimezone(timezone.utc)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def github_get(path, token=None):
    prefix = "/repos/" + REPO
    valid = (path in (prefix, prefix + "/branches/main") or
             re.fullmatch(re.escape(prefix) +
               r"/actions/runs/[1-9][0-9]{0,18}(?:/artifacts\?per_page=100)?",
               path) is not None)
    ensure(valid, "GITHUB_PATH_REFUSED")
    headers = {"Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "phimada-r20-council-review"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request("https://api.github.com" + path,
                                     headers=headers, method="GET")
    try:
        with urllib.request.build_opener(NoRedirect()).open(
                request, timeout=15) as response:
            ensure(response.status == 200, "GITHUB_HTTP_INVALID")
            data = response.read(MAX_RESPONSE + 1)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        raise Held("GITHUB_READ_FAILED") from None
    ensure(len(data) <= MAX_RESPONSE, "GITHUB_RESPONSE_TOO_LARGE")
    try:
        return json_strict(data.decode("utf8"))
    except (ValueError, UnicodeError):
        raise Held("GITHUB_JSON_INVALID") from None


def zip_receipt(archive):
    ensure(isinstance(archive, bytes) and 0 < len(archive) <= MAX_ARCHIVE,
           "ZIP_SIZE_REFUSED")
    try:
        with zipfile.ZipFile(io.BytesIO(archive)) as handle:
            files = [member for member in handle.infolist()
                     if not member.is_dir()]
            ensure(len(files) == 1, "ZIP_MEMBER_COUNT_REFUSED")
            member = files[0]
            ensure(member.filename in ("council-browser.json",
                       "r19-artifacts/council-browser.json"),
                   "ZIP_MEMBER_PATH_REFUSED")
            ensure(member.file_size <= MAX_RECEIPT and member.file_size > 0 and
                   member.compress_size <= MAX_ARCHIVE and
                   member.flag_bits & 1 == 0 and
                   ((member.external_attr >> 16) & 0o170000) in (0, 0o100000),
                   "ZIP_MEMBER_TYPE_OR_SIZE_REFUSED")
            body = handle.read(member)
            ensure(len(body) == member.file_size and len(body) <= MAX_RECEIPT,
                   "ZIP_MEMBER_READ_REFUSED")
            return json_strict(body.decode("utf8"))
    except Held:
        raise
    except (zipfile.BadZipFile, UnicodeError, ValueError, EOFError, RuntimeError, OSError):
        raise Held("ZIP_MEMBER_UNREADABLE") from None


def validated_receipt(receipt, run_id):
    ensure(type(receipt) is dict and set(receipt) == SOURCE_FIELDS,
           "R19_RECEIPT_SCHEMA_REFUSED")
    ensure(receipt["schema"] == SOURCE_SCHEMA and
           receipt["state"] == "COUNCIL_BROWSER_INTERACTIONS_PASSED_AT_OBSERVED_SHA" and
           receipt["repository"] == REPO and
           type(receipt["repository_id"]) is int and
           receipt["repository_id"] == REPO_ID and
           receipt["target_url"] == SITE and
           receipt["workflow_run_id"] == str(run_id),
           "R19_RECEIPT_IDENTITY_REFUSED")
    source = receipt["source_sha"]
    ensure(isinstance(source, str) and SHA40.fullmatch(source) and
           receipt["github_head_before_sha"] == source and
           receipt["github_head_after_sha"] == source and
           receipt["observed_deployment_build_marker"] == source,
           "R19_RECEIPT_SOURCE_REFUSED")
    ensure(receipt["source_fixture_schema"] ==
           "nbg-pocketmesh.council-evidence-exchange-e1.v0.1" and
           isinstance(receipt["fixture_sha256"], str) and
           SHA64.fullmatch(receipt["fixture_sha256"]) and
           receipt["fixture_origin"] == "PUBLIC_SYNTHETIC" and
           receipt["council_review_state"] == "HELD_UNTRUSTED_REVIEW_ONLY" and
           receipt["automated_council_browser_checks_passed"] is True and
           receipt["operator_review_required"] is True and
           all(receipt[flag] is False for flag in OFF_FLAGS),
           "R19_RECEIPT_TRUST_REFUSED")
    checks = receipt["checks"]
    ensure(type(checks) is dict and set(checks) == set(CHECKS) and
           all(checks[key] == "PASS" for key in CHECKS) and
           receipt["browser_runtime_errors"] == [],
           "R19_CHECKS_INCOMPLETE")
    return source, utc(receipt["observed_utc"])


def review(run_id, archive, github_getter=github_get, now=None):
    ensure(type(run_id) is int and 0 < run_id < 10 ** 19, "R20_RUN_ID_INVALID")
    now = now or datetime.now(timezone.utc)
    receipt = zip_receipt(archive)
    source, observed = validated_receipt(receipt, run_id)
    ensure(now - timedelta(days=8) <= observed <= now + timedelta(minutes=5),
           "R20_RECEIPT_EXPIRED_OR_FUTURE")
    path = "/repos/" + REPO
    route = path + "/actions/runs/" + str(run_id)
    run, listing, repository = (
        github_getter(route), github_getter(route + "/artifacts?per_page=100"),
        github_getter(path)
    )
    ensure(type(run) is dict and run.get("id") == run_id and
           run.get("event") == "workflow_dispatch" and
           run.get("path") == WORKFLOW and
           run.get("status") == "completed" and run.get("conclusion") == "success" and
           run.get("run_attempt") == 1 and run.get("head_sha") == source and
           type(run.get("repository")) is dict and
           run["repository"].get("id") == REPO_ID and
           run["repository"].get("full_name") == REPO and
           type(run.get("head_repository")) is dict and
           run["head_repository"].get("full_name") == REPO,
           "R20_GITHUB_RUN_REFUSED")
    created = utc(run["created_at"])
    updated = utc(run["updated_at"])
    ensure(created - timedelta(minutes=5) <= observed <=
           updated + timedelta(minutes=5), "R20_RUN_TIMELINE_REFUSED")
    digest = hashlib.sha256(archive).hexdigest()
    ensure(type(listing) is dict and
           type(listing.get("total_count")) is int and
           0 < listing["total_count"] <= 100 and
           type(listing.get("artifacts")) is list and
           len(listing["artifacts"]) == listing["total_count"],
           "R20_ARTIFACT_LIST_INCOMPLETE")
    artifacts = [item for item in listing["artifacts"]
                 if type(item) is dict and
                 item.get("name") == "phimada-r19-council-" + str(run_id)]
    ensure(len(artifacts) == 1, "R20_ARTIFACT_NOT_UNIQUE")
    artifact = artifacts[0]
    ensure(type(artifact.get("id")) is int and artifact["id"] > 0 and
           artifact.get("expired") is False and
           artifact.get("size_in_bytes") == len(archive) and
           artifact.get("digest") == "sha256:" + digest and
           (type(artifact.get("workflow_run")) is not dict or
            artifact["workflow_run"].get("id") == run_id),
           "R20_ARTIFACT_DIGEST_REFUSED")
    ensure(type(repository) is dict and repository.get("id") == REPO_ID and
           repository.get("full_name") == REPO and
           type(repository.get("owner")) is dict and
           repository["owner"].get("login") == "MichaelWave369" and
           repository.get("private") is False and
           repository.get("archived") is False and
           repository.get("default_branch") == "main",
           "R20_REPO_IDENTITY_REFUSED")
    first = github_getter(path + "/branches/main")
    second = github_getter(path + "/branches/main")
    ensure(type(first) is dict and type(second) is dict and
           first.get("name") == second.get("name") == "main" and
           type(first.get("commit")) is dict and
           type(second.get("commit")) is dict and
           isinstance(first["commit"].get("sha"), str) and
           isinstance(second["commit"].get("sha"), str) and
           SHA40.fullmatch(first["commit"]["sha"]) and
           SHA40.fullmatch(second["commit"]["sha"]),
           "R20_GITHUB_HEAD_REFUSED")
    stable = first["commit"]["sha"] == second["commit"]["sha"]
    current = stable and second["commit"]["sha"] == source
    state = ("R19_BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA" if current else
             "R19_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA" if stable else
             "R19_BROWSER_ARTIFACT_HELD_HEAD_MOVED_DURING_READ")
    return {
        "schema": REVIEW_SCHEMA, "state": state,
        "source": "ORIGINAL_GITHUB_ACTIONS_ZIP_AND_REST_METADATA",
        "repository": REPO, "repository_id": REPO_ID, "workflow_path": WORKFLOW,
        "workflow_run_id": run_id, "workflow_attempt": 1,
        "workflow_source_sha": source, "observed_head_sha": second["commit"]["sha"],
        "source_is_current": current, "source_head_stable": stable,
        "artifact_id": artifact["id"], "artifact_name": artifact["name"],
        "artifact_bytes": len(archive), "artifact_sha256": digest,
        "artifact_member_validated": True, "reported_check_count": len(CHECKS),
        "reported_checks": {key: "PASS" for key in CHECKS},
        "fixture_sha256": receipt["fixture_sha256"],
        "fixture_source_authenticated": False,
        "council_consumer_execution_observed": False,
        "independent_browser_replay": False,
        "reported_browser_checks_passed": True,
        "scientific_evidence": False, "product_verified": False,
        "merge_authorized": False, "dispatch_authorized": False,
        "operator_review_required": True,
        "run_observed_utc": observed.isoformat().replace("+00:00", "Z"),
        "reviewed_utc": now.isoformat().replace("+00:00", "Z")
    }


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--artifact-zip", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    ensure(RUN_ID.fullmatch(args.run_id) is not None, "R20_RUN_ID_INVALID")
    source = Path(args.artifact_zip)
    ensure(source.is_file() and not source.is_symlink() and
           0 < source.stat().st_size <= MAX_ARCHIVE, "R20_ZIP_FILE_REFUSED")
    report = review(int(args.run_id), source.read_bytes(),
                    lambda path: github_get(path, os.environ.get("GITHUB_TOKEN")))
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(out, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf8") as file:
        json.dump(report, file, indent=2)
        file.write("\n")
    print(json.dumps({"state":report["state"], "run_id":int(args.run_id),
                      "source_current":report["source_is_current"],
                      "independent_replay":False, "product_verified":False}))
    return 0 if report["source_is_current"] else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (Held, OSError, ValueError) as error:
        print("R20_HELD_" + str(error)[:160], file=sys.stderr)
        sys.exit(1)
