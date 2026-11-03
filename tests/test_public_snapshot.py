"""Contract checks for public-only snapshot publication."""
from datetime import datetime, timezone, timedelta
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "verify_public_fleet.py"
SPEC = importlib.util.spec_from_file_location("verify_public_fleet", MODULE_PATH)
snapshot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(snapshot)

NOW = datetime(2026, 11, 3, 6, 0, tzinfo=timezone.utc)
SHA = "a" * 40
OWNER = "MichaelWave369"


def reports():
    when = (NOW - timedelta(minutes=4)).isoformat()
    then = (NOW - timedelta(minutes=3)).isoformat()
    rows = [
        {"repository": OWNER + "/Agentora", "repository_id": 10, "visibility": "public",
         "completion": "UNVERIFIED", "head_sha": SHA},
        {"repository": OWNER + "/PhiOS", "repository_id": 11, "visibility": "public",
         "completion": "NOT_AUDITED"}
    ]
    audit = {
        "schema": snapshot.AUDIT_SCHEMA, "owner": OWNER,
        "generated_utc": when, "scope": "pilot", "private_included": False,
        "merge_authorized": False, "job_dispatch_authorized": False,
        "repository_count": 2, "deep_audited_count": 1,
        "repositories": rows
    }
    plan = {
        "schema": snapshot.PLAN_SCHEMA, "owner": OWNER,
        "generated_utc": then, "source_audit_utc": when,
        "public_output": True, "merge_authorized": False,
        "job_dispatch_authorized": False, "operator_review_required": True,
        "verified_complete_count": 0, "inventory_count": 2,
        "deep_audited_count": 1, "not_audited_count": 1,
        "profiles": [{"repository": OWNER + "/Agentora", "completion": "UNVERIFIED",
                      "operator_review_required": True, "head_sha": SHA}],
        "tasks": [
            {"repository": OWNER + "/Agentora", "state": "REVIEW_ONLY_NOT_DISPATCHABLE",
             "check_id": "automated_tests", "priority": 100, "summary": "Test"}
        ]
    }
    return audit, plan


class PublicationTests(unittest.TestCase):
    def test_pilot_is_observations_only_with_complete_coverage(self):
        audit, plan = reports()
        meta = snapshot.validate(audit, plan, now=NOW)
        self.assertEqual(meta["scope"], "pilot")
        self.assertEqual(meta["inventory_count"], 2)
        self.assertEqual(meta["deep_audited_count"], 1)
        self.assertEqual(meta["review_only_tasks"], 1)
        self.assertFalse(meta["merge_authorized"])
        self.assertEqual(meta["verified_complete_count"], 0)

    def test_private_repo_disallowed_even_when_outer_scope_says_public(self):
        audit, plan = reports()
        audit["repositories"][0]["visibility"] = "private"
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "PRIVATE_REPOSITORY_ROW"):
            snapshot.validate(audit, plan, now=NOW)
        audit, plan = reports()
        audit["private_included"] = True
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "PRIVATE_INPUT_REJECTED"):
            snapshot.validate(audit, plan, now=NOW)

    def test_private_plan_and_unsafe_task_disallowed(self):
        audit, plan = reports()
        plan["public_output"] = False
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "PRIVATE_INPUT_REJECTED"):
            snapshot.validate(audit, plan, now=NOW)
        audit, plan = reports()
        plan["tasks"][0]["state"] = "DISPATCHABLE"
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "EXECUTABLE_TASK_REJECTED"):
            snapshot.validate(audit, plan, now=NOW)

    def test_coverage_and_origin_must_be_consistent(self):
        audit, plan = reports()
        plan["inventory_count"] = 1
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "INVENTORY_COVERAGE_INCOMPLETE"):
            snapshot.validate(audit, plan, now=NOW)
        audit, plan = reports()
        plan["source_audit_utc"] = NOW.isoformat()
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "PROVENANCE_MISMATCH"):
            snapshot.validate(audit, plan, now=NOW)

    def test_forged_verified_complete_and_foreign_references_are_rejected(self):
        audit, plan = reports()
        plan["verified_complete_count"] = 1
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "COMPLETION_OR_REVIEW_CLAIM_INVALID"):
            snapshot.validate(audit, plan, now=NOW)
        audit, plan = reports()
        plan["tasks"][0]["repository"] = "SomeoneElse/Agentora"
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "FOREIGN_REPOSITORY"):
            snapshot.validate(audit, plan, now=NOW)

    def test_old_or_partial_data_does_not_publish(self):
        audit, plan = reports()
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "REPORT_NOT_FRESH_AT_PUBLICATION"):
            snapshot.validate(audit, plan, now=NOW + timedelta(hours=5))
        audit, plan = reports()
        audit["scope"] = "all"
        with self.assertRaisesRegex(snapshot.SnapshotHeld, "UNBOUNDED_SCOPE_REJECTED"):
            snapshot.validate(audit, plan, now=NOW)

    def test_publish_pins_source_and_writes_integrity_manifest(self):
        audit, plan = reports()
        with tempfile.TemporaryDirectory() as temp:
            src = Path(temp) / "source"
            out = Path(temp) / "dist" / "fleet"
            src.mkdir()
            (src / "fleet-audit.json").write_text(json.dumps(audit), encoding="utf-8")
            (src / "fleet-plan.json").write_text(json.dumps(plan), encoding="utf-8")
            meta = snapshot.publish(src, out, SHA, now=NOW)
            self.assertEqual(meta["agentora_commit_sha"], SHA)
            for key in ("audit", "plan"):
                info = meta["files"][key]
                raw = (out / info["path"]).read_bytes()
                self.assertEqual(info["size"], len(raw))
                self.assertEqual(info["sha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(json.loads((out / "manifest.json").read_text())["schema"],
                             snapshot.SNAPSHOT_SCHEMA)

    def test_ref_must_be_immutable_sha_not_branch_name(self):
        audit, plan = reports()
        with tempfile.TemporaryDirectory() as temp:
            src = Path(temp)
            (src / "fleet-audit.json").write_text(json.dumps(audit), encoding="utf-8")
            (src / "fleet-plan.json").write_text(json.dumps(plan), encoding="utf-8")
            with self.assertRaisesRegex(snapshot.SnapshotHeld, "SOURCE_REVISION_NOT_PINNED"):
                snapshot.publish(src, src / "out", "main", now=NOW)


if __name__ == "__main__":
    unittest.main()
