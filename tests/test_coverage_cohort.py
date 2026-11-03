"""R5 rolling cohort coverage selection and publication tests."""
import hashlib
import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "coverage_cohort.py"
SPEC = importlib.util.spec_from_file_location("coverage_cohort", SOURCE)
coverage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(coverage)
NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)
SHA = "a" * 40


def row(i, pushed=None, private=False):
    return {"name": f"Repo{i}", "id": i,
            "owner": {"login": "MichaelWave369"}, "private": private,
            "pushed_at": pushed or (NOW - timedelta(days=i)).isoformat()}


def observation(r):
    return {"repository": "MichaelWave369/" + r["name"], "head_sha": SHA,
            "ci": "OBSERVED_RUNS_GREEN_AT_HEAD_NOT_BUILD_PROOF",
            "pages": "HTML_REACHABLE_NOT_RUNTIME_VERIFIED",
            "release": "NO_PUBLISHED_RELEASE_FOUND",
            "errors": []}


def snapshot(rows, previous=None, batch=2):
    selected = coverage.select(rows, previous, NOW, batch)
    scans = {r["id"]: observation(r) for r in selected}
    return coverage.build(rows, previous, scans, NOW, batch)


class CoverageTests(unittest.TestCase):
    def test_first_batch_does_not_call_unscanned_repos_healthy(self):
        rows = [row(i) for i in range(1, 6)]
        result = snapshot(rows)
        self.assertEqual(result["inventory_count"], 5)
        self.assertEqual(result["cohort_size"], 2)
        self.assertEqual(result["observed_ever"], 2)
        self.assertEqual(result["never_observed"], 3)
        self.assertEqual(result["recent_clean_observations"], 2)
        self.assertEqual(result["verified_complete_count"], 0)
        self.assertTrue(all(x["evidence_state"] == "NEVER_OBSERVED"
                            for x in result["records"] if x["observed_at"] is None))

    def test_daily_batches_reach_full_inventory_without_exceeding_cohort(self):
        rows = [row(i) for i in range(1, 11)]
        old = None
        for i in range(5):
            at = NOW + timedelta(days=i)
            selected = coverage.select(rows, old, at, 2)
            self.assertEqual(len(selected), 2)
            scans = {r["id"]: observation(r) for r in selected}
            old = coverage.build(rows, old, scans, at, 2)
            self.assertEqual(old["observed_ever"], (i + 1) * 2)
            self.assertEqual(old["verified_complete_count"], 0)
        self.assertEqual(old["never_observed"], 0)
        self.assertEqual(old["recent_clean_observations"], 10)

    def test_public_only_intersection_removes_missing_historical_repos(self):
        rows = [row(i) for i in range(1, 6)]
        old = snapshot(rows)
        # Repository removed from public owner inventory must not appear on next run.
        current = rows[1:]
        selected = coverage.select(current, old, NOW + timedelta(hours=1), 1)
        scans = {r["id"]: observation(r) for r in selected}
        new = coverage.build(current, old, scans, NOW + timedelta(hours=1), 1)
        self.assertEqual(new["inventory_count"], 4)
        self.assertNotIn("MichaelWave369/Repo1",
                         [r["repository"] for r in new["records"]])

    def test_pushed_repo_does_not_retain_fresh_state(self):
        rows = [row(i) for i in range(1, 5)]
        old = snapshot(rows)
        changed = [dict(x) for x in rows]
        changed[0]["pushed_at"] = (NOW + timedelta(hours=1)).isoformat()
        selected = coverage.select(changed, old, NOW + timedelta(minutes=30), 1)
        scans = {r["id"]: observation(r) for r in selected}
        new = coverage.build(changed, old, scans, NOW + timedelta(minutes=30), 1)
        changed_row = next(r for r in new["records"] if r["repository_id"] == 1)
        self.assertEqual(changed_row["evidence_state"], "STALE_AFTER_PUSH")

    def test_old_data_and_limited_observations_stay_labeled(self):
        rows = [row(i) for i in range(1, 5)]
        old = snapshot(rows)
        for x in old["records"]:
            if x["observed_at"]:
                x["observed_at"] = (NOW - timedelta(days=15)).isoformat()
        selected = coverage.select(rows, old, NOW, 1)
        scans = {r["id"]: observation(r) for r in selected}
        scans[selected[0]["id"]]["errors"] = ["CI:GITHUB_HTTP_403"]
        new = coverage.build(rows, old, scans, NOW, 1)
        self.assertEqual(new["recent_limited_observations"], 1)
        self.assertEqual(new["verified_complete_count"], 0)
        self.assertGreaterEqual(new["stale_or_changed"], 1)

    def test_private_and_duplicate_current_catalog_rejected(self):
        with self.assertRaisesRegex(coverage.CoverageHeld, "NONPUBLIC"):
            snapshot([row(1, private=True)])
        with self.assertRaisesRegex(coverage.CoverageHeld, "DUPLICATE"):
            snapshot([row(1), row(1)])

    def test_wrong_source_and_authority_in_history_are_rejected(self):
        old = snapshot([row(1)])
        old["source_commit_sha"] = "b" * 40
        with self.assertRaisesRegex(coverage.CoverageHeld, "PREVIOUS_SNAPSHOT_INVALID"):
            snapshot([row(1)], old)
        old["source_commit_sha"] = coverage.SOURCE_SHA
        old["merge_authorized"] = True
        with self.assertRaisesRegex(coverage.CoverageHeld, "PREVIOUS_SNAPSHOT_INVALID"):
            snapshot([row(1)], old)

    def test_manifest_updated_only_with_pinned_public_provenance(self):
        payload = snapshot([row(1)])
        manifest = {
            "schema": coverage.MANIFEST_SCHEMA,
            "agentora_commit_sha": coverage.SOURCE_SHA,
            "public_only": True, "merge_authorized": False,
            "job_dispatch_authorized": False,
            "inventory_count": 1,
            "files": {"audit": {"path": "fleet-audit.json"}}
        }
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = root / "manifest.json"
            out = root / "coverage.json"
            path.write_text(json.dumps(manifest))
            coverage.write_coverage(payload, out, path)
            updated = json.loads(path.read_text())
            raw = out.read_bytes()
            self.assertEqual(updated["files"]["coverage"]["sha256"],
                             hashlib.sha256(raw).hexdigest())
            self.assertEqual(updated["coverage"]["observed_ever"], 1)
            updated["inventory_count"] = 2
            path.write_text(json.dumps(updated))
            with self.assertRaisesRegex(coverage.CoverageHeld, "PROVENANCE"):
                coverage.write_coverage(payload, out, path)

    def test_refusal_of_arbitrary_history_endpoint(self):
        with self.assertRaisesRegex(coverage.CoverageHeld, "NOT_ALLOWLISTED"):
            coverage.previous_snapshot("https://evil.example/private")


if __name__ == "__main__":
    unittest.main()
