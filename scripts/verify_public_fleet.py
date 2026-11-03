"""Validate Agentora public-only reports before bundling them into PhiMada Pages.

This is a build-time *publication gate*, not a verifier of product functionality.
Never accept private-mode output, executable/merge claims, or partial catalog coverage.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

OWNER = "MichaelWave369"
AUDIT_SCHEMA = "agentora.fleet.audit.v0.1"
PLAN_SCHEMA = "agentora.fleet.plan.v0.2"
SNAPSHOT_SCHEMA = "phimada.public-fleet.v0.1"
SHA = re.compile(r"^[0-9a-f]{40}$")
NAME = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")
MAX_BYTES = 8_000_000


class SnapshotHeld(Exception):
    pass


def utc(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError):
        raise SnapshotHeld("INVALID_TIMESTAMP") from None
    if parsed.tzinfo is None:
        raise SnapshotHeld("NAIVE_TIMESTAMP")
    return parsed.astimezone(timezone.utc)


def read_json(path):
    if not path.is_file() or path.stat().st_size > MAX_BYTES:
        raise SnapshotHeld("INPUT_MISSING_OR_TOO_LARGE")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError):
        raise SnapshotHeld("INPUT_INVALID_JSON") from None
    if not isinstance(data, dict):
        raise SnapshotHeld("INPUT_INVALID_OBJECT")
    return data


def canonical(full_name):
    if not isinstance(full_name, str) or not full_name.startswith(OWNER + "/"):
        raise SnapshotHeld("FOREIGN_REPOSITORY")
    name = full_name[len(OWNER) + 1:]
    if not NAME.fullmatch(name) or name in (".", ".."):
        raise SnapshotHeld("INVALID_REPOSITORY_NAME")
    return full_name


def validate(audit, plan, now=None):
    now = now or datetime.now(timezone.utc)
    if any(x.get("owner") != OWNER for x in (audit, plan)):
        raise SnapshotHeld("INCORRECT_OWNER")
    if audit.get("schema") != AUDIT_SCHEMA or plan.get("schema") != PLAN_SCHEMA:
        raise SnapshotHeld("SCHEMA_MISMATCH")
    if audit.get("private_included") is not False or plan.get("public_output") is not True:
        raise SnapshotHeld("PRIVATE_INPUT_REJECTED")
    if audit.get("scope") != "pilot":
        raise SnapshotHeld("UNBOUNDED_SCOPE_REJECTED")
    if any(x.get("merge_authorized") is not False or
           x.get("job_dispatch_authorized") is not False for x in (audit, plan)):
        raise SnapshotHeld("EXECUTION_AUTHORITY_REJECTED")
    if plan.get("verified_complete_count") != 0 or plan.get("operator_review_required") is not True:
        raise SnapshotHeld("COMPLETION_OR_REVIEW_CLAIM_INVALID")
    at, pt = utc(audit.get("generated_utc")), utc(plan.get("generated_utc"))
    source = utc(plan.get("source_audit_utc"))
    if source != at or not timedelta(0) <= pt - at <= timedelta(minutes=30):
        raise SnapshotHeld("AUDIT_PLAN_PROVENANCE_MISMATCH")
    if not timedelta(minutes=-5) <= now - pt <= timedelta(hours=4):
        raise SnapshotHeld("REPORT_NOT_FRESH_AT_PUBLICATION")
    rows = audit.get("repositories")
    profiles = plan.get("profiles")
    tasks = plan.get("tasks")
    if (not isinstance(rows, list) or not isinstance(profiles, list) or
        not isinstance(tasks, list) or len(rows) > 1500 or
        len(profiles) > len(rows) or len(tasks) > 10000):
        raise SnapshotHeld("INPUT_COLLECTIONS_INVALID")
    if (audit.get("repository_count") != len(rows) or
        plan.get("inventory_count") != len(rows) or
        plan.get("deep_audited_count") != len(profiles) or
        audit.get("deep_audited_count") != len(profiles) or
        plan.get("not_audited_count") != len(rows)-len(profiles)):
        raise SnapshotHeld("INVENTORY_COVERAGE_INCOMPLETE")
    ids, names, deep = set(), set(), set()
    for row in rows:
        if not isinstance(row, dict) or row.get("visibility") != "public":
            raise SnapshotHeld("PRIVATE_REPOSITORY_ROW")
        name = canonical(row.get("repository"))
        ident = row.get("repository_id")
        if not isinstance(ident, int) or isinstance(ident, bool) or ident < 1:
            raise SnapshotHeld("INVALID_REPOSITORY_ID")
        if ident in ids or name.lower() in names:
            raise SnapshotHeld("DUPLICATE_REPOSITORY")
        ids.add(ident)
        names.add(name.lower())
        state = row.get("completion")
        if state not in ("NOT_AUDITED", "UNVERIFIED"):
            raise SnapshotHeld("UNTRUSTED_COMPLETE_STATE")
        if state == "UNVERIFIED":
            deep.add(name.lower())
        if row.get("head_sha") is not None and not SHA.fullmatch(row["head_sha"]):
            raise SnapshotHeld("INVALID_HEAD_SHA")
    if len(deep) != len(profiles):
        raise SnapshotHeld("DEEP_AUDIT_MISMATCH")
    profile_names = set()
    for profile in profiles:
        if not isinstance(profile, dict):
            raise SnapshotHeld("INVALID_PROFILE")
        name = canonical(profile.get("repository")).lower()
        if name not in deep or name in profile_names:
            raise SnapshotHeld("PROFILE_NOT_AUDITED_OR_DUPLICATE")
        profile_names.add(name)
        if profile.get("completion") != "UNVERIFIED" or profile.get("operator_review_required") is not True:
            raise SnapshotHeld("UNVERIFIED_PROFILE_REQUIRED")
    for task in tasks:
        if not isinstance(task, dict) or task.get("state") != "REVIEW_ONLY_NOT_DISPATCHABLE":
            raise SnapshotHeld("EXECUTABLE_TASK_REJECTED")
        name = canonical(task.get("repository")).lower()
        if name not in profile_names:
            raise SnapshotHeld("TASK_WITHOUT_AUDITED_PROFILE")
    if not profile_names:
        raise SnapshotHeld("EMPTY_PILOT_NOT_USEFUL")
    return {
        "schema": SNAPSHOT_SCHEMA,
        "owner": OWNER,
        "scope": "pilot",
        "public_only": True,
        "status": "OBSERVATIONS_ONLY_NOT_PRODUCT_VERIFICATION",
        "generated_utc": pt.isoformat(),
        "inventory_count": len(rows),
        "deep_audited_count": len(profiles),
        "review_only_tasks": len(tasks),
        "verified_complete_count": 0,
        "merge_authorized": False,
        "job_dispatch_authorized": False,
        "source": "Agentora Fleet R0.1 + R0.2",
    }


def publish(source_dir, output_dir, source_commit, now=None):
    if not SHA.fullmatch(source_commit or ""):
        raise SnapshotHeld("SOURCE_REVISION_NOT_PINNED")
    audit_path = source_dir / "fleet-audit.json"
    plan_path = source_dir / "fleet-plan.json"
    manifest = validate(read_json(audit_path), read_json(plan_path), now=now)
    output_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    for name, path in (("audit", audit_path), ("plan", plan_path)):
        raw = path.read_bytes()
        files[name] = {"path": "fleet-" + name + ".json",
                       "sha256": hashlib.sha256(raw).hexdigest(),
                       "size": len(raw)}
        (output_dir / files[name]["path"]).write_bytes(raw)
    manifest["agentora_commit_sha"] = source_commit
    manifest["files"] = files
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--agentora-sha", required=True)
    args = parser.parse_args()
    try:
        report = publish(args.source, args.out, args.agentora_sha)
    except (SnapshotHeld, OSError) as exc:
        print("PUBLIC_FLEET_HELD " + str(exc), file=sys.stderr)
        return 1
    print("PUBLIC_FLEET_PUBLISHED scope=pilot repos=" +
          str(report["inventory_count"]) + " audited=" +
          str(report["deep_audited_count"]) + " proposed_jobs=" +
          str(report["review_only_tasks"]) + " verified_complete=0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
