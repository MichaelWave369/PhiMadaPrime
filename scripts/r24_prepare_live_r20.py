"""R24: fetch one ORIGINAL public R19 GitHub Actions artifact for manual R20 import.

Uses read-only Actions token ONLY with api.github.com. Follows a single bounded
redirect to allowlisted GitHub artifact blob hosts WITHOUT Authorization.
Never invokes R19, reruns a job, merges, creates GitHub writes or grants authority.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit

import r20_review_council_browser as r20

CONFIRM = "REVIEW_EXISTING_R19_ON_LIVE_PAGES"
RUN_PATTERN = re.compile(r"[1-9][0-9]{0,18}\Z")
HEX40 = re.compile(r"[a-f0-9]{40}\Z")
MAX_BYTES = 2_000_000
HOST_SUFFIXES = (".blob.core.windows.net", ".githubusercontent.com",
                 ".actions.githubusercontent.com")


def allow_artifact_redirect(location):
    r20.ensure(isinstance(location, str) and len(location) < 8192,
               "R24_REDIRECT_MISSING")
    try:
        parsed = urlsplit(location)
        host = parsed.hostname or ""
        port = parsed.port
    except (ValueError, AttributeError):
        raise r20.Held("R24_REDIRECT_URL_INVALID") from None
    r20.ensure(parsed.scheme == "https" and
               host.endswith(HOST_SUFFIXES) and
               port in (None, 443) and
               parsed.username is None and parsed.password is None and
               not parsed.fragment,
               "R24_REDIRECT_HOST_REFUSED")
    return location


def download_archive(artifact_id, token, opener_factory=urllib.request.build_opener):
    r20.ensure(type(artifact_id) is int and 0 < artifact_id < 10 ** 19,
               "R24_ARTIFACT_ID_REFUSED")
    r20.ensure(type(token) is str and bool(token), "R24_TOKEN_REQUIRED")
    api_url = ("https://api.github.com/repos/" + r20.REPO +
               "/actions/artifacts/" + str(artifact_id) + "/zip")
    handler = opener_factory(r20.NoRedirect())
    api_request = urllib.request.Request(
        api_url, method="GET",
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "phimada-r24-manual-artifact-review"})
    try:
        handler.open(api_request, timeout=15)
    except urllib.error.HTTPError as error:
        r20.ensure(error.code == 302, "R24_ARTIFACT_REDIRECT_REFUSED")
        redirect = allow_artifact_redirect(error.headers.get("Location"))
    except (urllib.error.URLError, TimeoutError, OSError):
        raise r20.Held("R24_ARTIFACT_API_UNAVAILABLE") from None
    else:
        raise r20.Held("R24_EXPECTED_SINGLE_SIGNED_REDIRECT")
    # Critical: fresh request has NO Authorization header, no credentials.
    blob_request = urllib.request.Request(
        redirect, method="GET",headers={"User-Agent": "phimada-r24-zip"})
    try:
        with handler.open(blob_request, timeout=25) as response:
            r20.ensure(response.status == 200, "R24_BLOB_HTTP_REFUSED")
            archive = response.read(MAX_BYTES + 1)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        raise r20.Held("R24_ARTIFACT_BLOB_UNAVAILABLE") from None
    r20.ensure(0 < len(archive) <= MAX_BYTES, "R24_ZIP_SIZE_REFUSED")
    return archive


def select_artifact(run_id, get_json):
    prefix = "/repos/" + r20.REPO
    listing = get_json(prefix + "/actions/runs/" + str(run_id) +
                       "/artifacts?per_page=100")
    r20.ensure(type(listing) is dict and
               type(listing.get("total_count")) is int and
               0 < listing["total_count"] <= 100 and
               type(listing.get("artifacts")) is list and
               len(listing["artifacts"]) == listing["total_count"],
               "R24_ARTIFACT_LIST_INCOMPLETE")
    matching = [item for item in listing["artifacts"]
                if type(item) is dict and
                item.get("name") == "phimada-r19-council-" + str(run_id)]
    r20.ensure(len(matching) == 1, "R24_ORIGINAL_ARTIFACT_NOT_UNIQUE")
    item = matching[0]
    r20.ensure(type(item.get("id")) is int and item["id"] > 0 and
               type(item.get("size_in_bytes")) is int and
               0 < item["size_in_bytes"] <= MAX_BYTES and
               item.get("expired") is False and
               isinstance(item.get("digest"), str) and
               re.fullmatch(r"sha256:[a-f0-9]{64}", item["digest"]),
               "R24_ARTIFACT_METADATA_REFUSED")
    return item


def prepare(run_id, token, expected_sha, downloader=download_archive,
            get_json=None, now=None):
    r20.ensure(type(run_id) is int and 0 < run_id < 10 ** 19,
               "R24_RUN_ID_INVALID")
    r20.ensure(isinstance(expected_sha, str) and HEX40.fullmatch(expected_sha),
               "R24_SOURCE_SHA_INVALID")
    now = now or datetime.now(timezone.utc)
    get_json = get_json or (lambda path: r20.github_get(path, token))
    # Identity/source preflight is deliberately independent of old R19 source.
    base = "/repos/" + r20.REPO
    repo = get_json(base)
    a = get_json(base + "/branches/main")
    b = get_json(base + "/branches/main")
    r20.ensure(type(repo) is dict and repo.get("id") == r20.REPO_ID and
               repo.get("full_name") == r20.REPO and
               type(repo.get("owner")) is dict and
               repo["owner"].get("login") == "MichaelWave369" and
               repo.get("private") is False and repo.get("archived") is False and
               repo.get("default_branch") == "main",
               "R24_REPO_IDENTITY_REFUSED")
    r20.ensure(type(a) is dict and type(b) is dict and
               a.get("name") == b.get("name") == "main" and
               type(a.get("commit")) is dict and
               type(b.get("commit")) is dict and
               a["commit"].get("sha") == b["commit"].get("sha") == expected_sha,
               "R24_SOURCE_MOVED_OR_MISMATCH")
    artifact = select_artifact(run_id, get_json)
    archive = downloader(artifact["id"], token)
    r20.ensure(len(archive) == artifact["size_in_bytes"] and
               "sha256:" + hashlib.sha256(archive).hexdigest() ==
               artifact["digest"],"R24_ORIGINAL_ARCHIVE_HASH_REFUSED")
    # Reuse actual R20 independent reviewer, not a second hand-coded imitation.
    reviewed = r20.review(run_id,archive,get_json,now=now)
    r20.ensure(reviewed["state"] in (
        "R19_BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA",
        "R19_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA") and
        reviewed["source_head_stable"] is True,
        "R24_REVIEW_SOURCE_UNSTABLE")
    return archive, reviewed


def write_exclusive(path,content):
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd,"wb") as out:
        out.write(content)


def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--run-id",required=True)
    parser.add_argument("--source-sha",required=True)
    parser.add_argument("--confirmation",required=True)
    parser.add_argument("--output-dir",default="r24-private")
    args=parser.parse_args(argv)
    r20.ensure(RUN_PATTERN.fullmatch(args.run_id) is not None,"R24_RUN_ID_INVALID")
    r20.ensure(args.confirmation == CONFIRM,"R24_CONFIRMATION_REQUIRED")
    r20.ensure(HEX40.fullmatch(args.source_sha) is not None,
               "R24_SOURCE_SHA_INVALID")
    r20.ensure(args.output_dir=="r24-private","R24_FIXED_OUTPUT_DIRECTORY_REQUIRED")
    r20.ensure(os.environ.get("GITHUB_SHA")==args.source_sha,
               "R24_CHECKOUT_SHA_MISMATCH")
    r20.ensure(os.environ.get("GITHUB_EVENT_NAME")=="workflow_dispatch",
               "R24_MANUAL_ONLY")
    archive, report = prepare(int(args.run_id),os.environ.get("GITHUB_TOKEN"),
                              args.source_sha)
    folder=Path(args.output_dir)
    folder.mkdir(mode=0o700,exist_ok=False)
    write_exclusive(folder/"original-r19.zip",archive)
    write_exclusive(folder/"r20-review.json",
                    (json.dumps(report,sort_keys=True,indent=2)+"\n").encode("utf8"))
    print(json.dumps({"state":"R24_ORIGINAL_R19_ARCHIVE_PREPARED_FOR_READ_ONLY_UI",
                      "run_id":int(args.run_id),
                      "review_state":report["state"],
                      "original_zip_sha256":report["artifact_sha256"],
                      "source_current":report["source_is_current"],
                      "merge_authorized":False,
                      "model_executed":False}))
    return 0


if __name__=="__main__":
    try:
        sys.exit(main())
    except (r20.Held,ValueError,OverflowError,OSError) as error:
        print("R24_HELD_"+str(error)[:160],file=sys.stderr)
        sys.exit(1)
