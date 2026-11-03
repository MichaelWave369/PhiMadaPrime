"""Public-only rolling evidence coverage for PhiMada's office tower.

R5 calls the PINNED Agentora R0.1 scanner to inspect a small cohort per
publication. Historical observations are carried only for currently public
repos with matching stable id/name, and are never called functional proof.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OWNER = "MichaelWave369"
SCHEMA = "phimada.public-coverage.v0.1"
MANIFEST_SCHEMA = "phimada.public-fleet.v0.1"
SOURCE_SHA = "502115508421eb1c98a6c05a79d04a9e432b8b27"
PREVIOUS_URL = "https://michaelwave369.github.io/PhiMadaPrime/fleet/coverage.json"
MAX_BYTES = 2_000_000
MAX_REPOS = 1500
RECENT_DAYS = 14
HISTORY_DAYS = 90
HEX40 = re.compile(r"^[0-9a-f]{40}$")
NAME = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


class CoverageHeld(Exception):
    pass


def parse_time(value):
    if not isinstance(value, str):
        return None
    try:
        date = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return date.astimezone(timezone.utc) if date.tzinfo else None
    except ValueError:
        return None


def canonical(row):
    if not isinstance(row, dict):
        raise CoverageHeld("INVENTORY_ROW_INVALID")
    name = row.get("name")
    ident = row.get("id")
    if (not isinstance(name, str) or not NAME.fullmatch(name) or name in (".", "..")
            or not isinstance(ident, int) or isinstance(ident, bool) or ident < 1
            or row.get("private") is not False
            or (row.get("owner") or {}).get("login", "").lower() != OWNER.lower()):
        raise CoverageHeld("NONPUBLIC_OR_INVALID_REPOSITORY")
    return OWNER + "/" + name


def validate_previous(data):
    if (not isinstance(data, dict) or data.get("schema") != SCHEMA or
        data.get("owner") != OWNER or data.get("public_only") is not True or
        data.get("source_commit_sha") != SOURCE_SHA or
        data.get("merge_authorized") is not False or
        data.get("job_dispatch_authorized") is not False or
        not isinstance(data.get("records"), list) or
        len(data["records"]) > MAX_REPOS):
        raise CoverageHeld("PREVIOUS_SNAPSHOT_INVALID")
    seen = set()
    for rec in data["records"]:
        if (not isinstance(rec, dict) or not isinstance(rec.get("repository_id"), int) or
            not isinstance(rec.get("repository"), str) or
            not rec["repository"].startswith(OWNER + "/") or
            not NAME.fullmatch(rec["repository"][len(OWNER) + 1:])):
            raise CoverageHeld("PREVIOUS_ROW_INVALID")
        key = (rec["repository_id"], rec["repository"].lower())
        if key in seen:
            raise CoverageHeld("PREVIOUS_DUPLICATE")
        seen.add(key)
    return data


def previous_snapshot(url=PREVIOUS_URL):
    if url != PREVIOUS_URL:
        raise CoverageHeld("PREVIOUS_URL_NOT_ALLOWLISTED")
    try:
        request = Request(url, method="GET", headers={
            "Accept": "application/json", "User-Agent": "phimada-r05-public-cohort"
        })
        with urlopen(request, timeout=12) as response:
            raw = response.read(MAX_BYTES + 1)
    except HTTPError as exc:
        if exc.code == 404:
            return None
        raise CoverageHeld("PREVIOUS_HTTP_" + str(exc.code)) from None
    except (URLError, TimeoutError, OSError):
        raise CoverageHeld("PREVIOUS_UNAVAILABLE") from None
    if len(raw) > MAX_BYTES:
        raise CoverageHeld("PREVIOUS_TOO_LARGE")
    try:
        return validate_previous(json.loads(raw.decode("utf-8")))
    except (ValueError, UnicodeError):
        raise CoverageHeld("PREVIOUS_INVALID_JSON") from None


def inherited(records, row, now):
    key = (row["id"], (OWNER + "/" + row["name"]).lower())
    saved = records.get(key)
    if not saved:
        return None
    observed = parse_time(saved.get("observed_at"))
    if not observed or observed > now + timedelta(minutes=5) or \
            now - observed > timedelta(days=HISTORY_DAYS):
        return None
    if saved.get("observed_pushed_at") is not None and \
            parse_time(saved["observed_pushed_at"]) is None:
        return None
    if saved.get("head_sha") is not None and \
            not HEX40.fullmatch(str(saved["head_sha"])):
        return None
    return {
        "observed_at": saved["observed_at"],
        "observed_pushed_at": saved.get("observed_pushed_at"),
        "head_sha": saved.get("head_sha"),
        "ci": str(saved.get("ci", "NOT_VERIFIED"))[:100],
        "pages": str(saved.get("pages", "NOT_VERIFIED"))[:100],
        "release": str(saved.get("release", "NOT_VERIFIED"))[:100],
        "observation_limitations": [str(x)[:120] for x in
                                     (saved.get("observation_limitations") or [])[:20]],
    }


def evidence_state(rec, now):
    observed = parse_time(rec.get("observed_at"))
    if observed is None:
        return "NEVER_OBSERVED"
    if rec.get("observed_pushed_at") != rec.get("pushed_at"):
        return "STALE_AFTER_PUSH"
    if now - observed > timedelta(days=RECENT_DAYS):
        return "STALE_BY_AGE"
    if rec.get("observation_limitations"):
        return "RECENT_LIMITED_OBSERVATION"
    return "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED"


def build(rows, previous, scans, now=None, cohort_size=24):
    now = now or datetime.now(timezone.utc)
    if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_REPOS:
        raise CoverageHeld("INVENTORY_COVERAGE_INVALID")
    if cohort_size < 1 or cohort_size > 48:
        raise CoverageHeld("COHORT_SIZE_UNSAFE")
    prior = {}
    if previous:
        validate_previous(previous)
        prior = {(rec["repository_id"], rec["repository"].lower()): rec
                 for rec in previous["records"]}
    output = {}
    for row in rows:
        full_name = canonical(row)
        key = (row["id"], full_name.lower())
        if key in output:
            raise CoverageHeld("INVENTORY_DUPLICATE")
        pushed = row.get("pushed_at")
        if pushed is not None and parse_time(pushed) is None:
            raise CoverageHeld("INVENTORY_PUSH_DATE_INVALID")
        base = {
            "repository": full_name,
            "repository_id": row["id"],
            "pushed_at": pushed,
            "observed_at": None,
            "observed_pushed_at": None,
            "head_sha": None,
            "ci": "NOT_VERIFIED",
            "pages": "NOT_VERIFIED",
            "release": "NOT_VERIFIED",
            "observation_limitations": [],
        }
        old = inherited(prior, row, now)
        if old:
            base.update(old)
        output[key] = base
    ranked = sorted(output.values(),
                    key=lambda r: (parse_time(r.get("observed_at")) or
                                   datetime.min.replace(tzinfo=timezone.utc),
                                   r["repository"].lower()))
    selected = ranked[:min(cohort_size, len(ranked))]
    selected_ids = {r["repository_id"] for r in selected}
    if set(scans) != selected_ids:
        raise CoverageHeld("COHORT_SCAN_INCOMPLETE")
    for rec in selected:
        observation = scans[rec["repository_id"]]
        if (not isinstance(observation, dict) or
            observation.get("repository") != rec["repository"]):
            raise CoverageHeld("COHORT_OBSERVATION_MISMATCH")
        sha = observation.get("head_sha")
        if sha is not None and not HEX40.fullmatch(str(sha)):
            raise CoverageHeld("COHORT_HEAD_INVALID")
        rec.update({
            "observed_at": now.isoformat(),
            "observed_pushed_at": rec["pushed_at"],
            "head_sha": sha,
            "ci": str(observation.get("ci") or "NOT_VERIFIED")[:100],
            "pages": str(observation.get("pages") or "NOT_VERIFIED")[:100],
            "release": str(observation.get("release") or "NOT_VERIFIED")[:100],
            "observation_limitations": [str(x)[:120] for x in
                (observation.get("errors") or [])[:20]],
        })
    ordered = sorted(output.values(), key=lambda r: r["repository"].lower())
    for rec in ordered:
        rec["evidence_state"] = evidence_state(rec, now)
    never = sum(x["evidence_state"] == "NEVER_OBSERVED" for x in ordered)
    current = sum(x["evidence_state"] ==
                  "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED" for x in ordered)
    limited = sum(x["evidence_state"] == "RECENT_LIMITED_OBSERVATION" for x in ordered)
    return {
        "schema": SCHEMA, "owner": OWNER,
        "source_commit_sha": SOURCE_SHA,
        "public_only": True, "merge_authorized": False,
        "job_dispatch_authorized": False, "generated_utc": now.isoformat(),
        "inventory_count": len(ordered),
        "cohort_size": len(selected), "observed_ever": len(ordered) - never,
        "recent_clean_observations": current,
        "recent_limited_observations": limited,
        "never_observed": never,
        "stale_or_changed": len(ordered) - never - current - limited,
        "verified_complete_count": 0,
        "notes": "Read-only CI/Pages/release metadata. Never proof of working software.",
        "records": ordered,
    }


def select(rows, previous, now, cohort_size):
    """Prepare an empty-scan selection by borrowing the same oldest-first rule."""
    prior = {}
    if previous:
        validate_previous(previous)
        prior = {(r["repository_id"], r["repository"].lower()): r
                 for r in previous["records"]}
    targets = []
    for row in rows:
        full_name = canonical(row)
        old = inherited(prior, row, now)
        observed = parse_time(old.get("observed_at")) if old else None
        targets.append((observed or datetime.min.replace(tzinfo=timezone.utc),
                        full_name.lower(), row))
    targets.sort(key=lambda x: (x[0], x[1]))
    return [x[2] for x in targets[:min(cohort_size, len(targets))]]


def write_coverage(payload, destination, manifest_path):
    if not manifest_path.is_file():
        raise CoverageHeld("PUBLIC_MANIFEST_REQUIRED")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise CoverageHeld("PUBLIC_MANIFEST_INVALID") from None
    if (manifest.get("schema") != MANIFEST_SCHEMA or
        manifest.get("agentora_commit_sha") != SOURCE_SHA or
        manifest.get("public_only") is not True or
        manifest.get("merge_authorized") is not False or
        manifest.get("job_dispatch_authorized") is not False or
        manifest.get("inventory_count") != payload["inventory_count"]):
        raise CoverageHeld("PUBLIC_MANIFEST_PROVENANCE_MISMATCH")
    raw = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    if len(raw) > MAX_BYTES:
        raise CoverageHeld("COVERAGE_OUTPUT_TOO_LARGE")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(raw)
    manifest["files"]["coverage"] = {
        "path": "coverage.json", "size": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest()
    }
    manifest["coverage"] = {
        "generated_utc": payload["generated_utc"],
        "observed_ever": payload["observed_ever"],
        "recent_clean_observations": payload["recent_clean_observations"],
        "never_observed": payload["never_observed"],
        "cohort_size": payload["cohort_size"]
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                             encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agentora-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--cohort-size", type=int, default=24)
    parser.add_argument("--no-history", action="store_true",
                        help="CI-only cold-start smoke; normal deployments should retain public history")
    args = parser.parse_args()
    try:
        if not 1 <= args.cohort_size <= 48:
            raise CoverageHeld("COHORT_SIZE_UNSAFE")
        module = args.agentora_root / "scripts" / "fleet_r01_audit.py"
        if not module.is_file():
            raise CoverageHeld("PINNED_AGENTORA_SCANNER_NOT_FOUND")
        spec = importlib.util.spec_from_file_location("fleet_r01_audit", module)
        scanner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(scanner)
        token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
        rows = scanner.inventory(scanner.github_get, token, include_private=False)
        now = datetime.now(timezone.utc)
        previous = None if args.no_history else previous_snapshot()
        selected = select(rows, previous, now, args.cohort_size)
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {pool.submit(scanner.scan_one, row, scanner.github_get, token,
                                   {r["name"].lower(): r["name"] for r in rows}): row
                       for row in selected}
            scans = {}
            for future in as_completed(futures):
                row = futures[future]
                scans[row["id"]] = future.result()
        report = build(rows, previous, scans, now, args.cohort_size)
        write_coverage(report, args.output, args.manifest)
    except (CoverageHeld, OSError, ValueError, KeyError) as exc:
        print("PUBLIC_COHORT_HELD " + str(exc), file=sys.stderr)
        return 1
    print("PUBLIC_COHORT_OK inventory=" + str(report["inventory_count"]) +
          " scanned_today=" + str(report["cohort_size"]) +
          " observed_ever=" + str(report["observed_ever"]) +
          " recent_clean=" + str(report["recent_clean_observations"]) +
          " never=" + str(report["never_observed"]) +
          " verified_complete=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
