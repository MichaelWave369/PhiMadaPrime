"""R13: independent browser receipt checks against synthetic GitHub provenance."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import r13_review_browser_evidence as mod

SHA = "a" * 40
MOVED = "b" * 40
RUN = 41710656371
NOW = datetime(2026, 11, 3, 21, 0, tzinfo=timezone.utc)


def receipt(patch=None):
    value = {
        "schema": mod.RECEIPT_SCHEMA,
        "state": "AUTOMATED_BROWSER_SMOKE_PASSED_AT_OBSERVED_SHA",
        "repository": mod.REPO,
        "repository_id": mod.REPO_ID,
        "target_url": mod.SITE,
        "source_sha": SHA,
        "github_head_before_sha": SHA,
        "github_head_after_sha": SHA,
        "observed_deployment_build_marker": SHA,
        "deployed_marker_matches_requested_sha": True,
        "workflow_run_id": str(RUN),
        "observed_utc": "2026-11-03T20:14:52+00:00",
        "checks": {k: "PASS" for k in mod.CHECKS},
        "browser_runtime_errors": [],
        "automated_browser_smoke_passed": True,
        "marker_is_signed_deployment_attestation": False,
        "keyboard_accessibility_audited": False,
        "full_accessibility_reviewed": False,
        "complete_user_journeys_verified": False,
        "deployed_revision_cryptographically_verified": False,
        "product_verified": False, "verified_complete": False,
        "merge_authorized": False, "job_dispatch_authorized": False,
        "operator_review_required": True,
    }
    if patch:
        value.update(patch)
    return value


def pack(value=None, extra=None, path="browser-smoke.json"):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(path, json.dumps(receipt() if value is None else value))
        for name, content in (extra or []):
            z.writestr(name, content)
    return data.getvalue()


class GitHub:
    def __init__(self, raw, *, head=SHA, **overrides):
        self.calls = []
        self.run = {
            "id": RUN, "path": mod.WORKFLOW,
            "event": "workflow_dispatch", "status": "completed",
            "conclusion": "success", "run_attempt": 1,
            "head_sha": SHA, "created_at": "2026-11-03T20:14:01Z",
            "updated_at": "2026-11-03T20:15:34Z",
            "repository": {"id": mod.REPO_ID, "full_name": mod.REPO},
            "head_repository": {"full_name": mod.REPO},
        }
        self.run.update(overrides)
        self.artifacts = {"total_count": 1, "artifacts": [{
            "id": 13266454585, "name": "phimada-r12-browser-" + str(RUN),
            "expired": False, "size_in_bytes": len(raw),
            "digest": "sha256:" + hashlib.sha256(raw).hexdigest(),
            "workflow_run": {"id": RUN}
        }]}
        self.repo = {"id": mod.REPO_ID, "full_name": mod.REPO,
                     "owner": {"login": "MichaelWave369"},
                     "private": False, "archived": False, "default_branch": "main"}
        self.head = head

    def __call__(self, path, token):
        self.calls.append((path, token))
        root = "/repos/" + mod.REPO
        if path.endswith("/artifacts?per_page=100"):
            return self.artifacts
        if "/actions/runs/" in path:
            return self.run
        if path == root:
            return self.repo
        if path == root + "/branches/main":
            return {"name": "main", "commit": {"sha": self.head}}
        raise AssertionError("unexpected API URL: " + path)


class R13ReviewTests(unittest.TestCase):
    def assertHeld(self, raw, gh, expected=None):
        with self.assertRaises(mod.Held) as caught:
            mod.review(RUN, raw, get=gh, now=NOW)
        if expected:
            self.assertIn(expected, str(caught.exception))

    def test_success_checks_all_eight_but_no_completion(self):
        raw = pack()
        gh = GitHub(raw)
        result = mod.review(RUN, raw, get=gh, token="secret", now=NOW)
        self.assertEqual(result["state"], "BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA")
        self.assertEqual(result["browser_source_sha"], SHA)
        self.assertEqual(result["browser_check_count"], 8)
        self.assertEqual(set(result["reported_browser_checks"]), set(mod.CHECKS))
        self.assertEqual(result["artifact_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertTrue(result["artifact_zip_contents_validated"])
        self.assertEqual(len(gh.calls), 5)
        self.assertNotIn("secret", json.dumps(result))
        for key in ("independently_replayed", "accessibility_verified",
                    "deployment_cryptographically_attested", "product_verified",
                    "verified_complete", "merge_authorized", "dispatch_authorized"):
            self.assertFalse(result[key])

    def test_historical_sha_does_not_become_current_browser_credit(self):
        raw = pack()
        result = mod.review(RUN, raw, get=GitHub(raw, head=MOVED), now=NOW)
        self.assertEqual(result["state"], "BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA")
        self.assertFalse(result["current_head_matches_browser_source"])

    def test_wrong_run_event_status_attempt_or_source_is_held(self):
        raw = pack()
        for change in ({"event": "push"}, {"conclusion": "failure"},
                       {"status": "queued"}, {"run_attempt": 2},
                       {"path": "other.yml"}, {"head_sha": MOVED},
                       {"repository": {"id": 1, "full_name": mod.REPO}},
                       {"head_repository": {"full_name": "Other/Repo"}}):
            with self.subTest(change=change):
                self.assertHeld(raw, GitHub(raw, **change))

    def test_expired_future_or_fake_run_dates_held(self):
        raw = pack()
        for date in ("2026-10-20T00:00:00Z", "3000-01-01T00:00:00Z", "invalid"):
            self.assertHeld(raw, GitHub(raw, created_at=date))

    def test_wrong_or_missing_github_digest_held(self):
        raw = pack()
        for digest in (None, "sha1:" + "a"*40, "sha256:" + "f"*64):
            gh = GitHub(raw)
            gh.artifacts["artifacts"][0]["digest"] = digest
            self.assertHeld(raw, gh)

    def test_tampered_zip_fails_github_sha256_first(self):
        raw = pack()
        forged = pack(receipt({"merge_authorized": True}))
        self.assertHeld(forged, GitHub(raw), "ARTIFACT_SHA256_MISMATCH")

    def test_same_digest_but_forged_authority_is_rejected(self):
        for key in ("merge_authorized", "product_verified",
                    "full_accessibility_reviewed", "verified_complete",
                    "marker_is_signed_deployment_attestation"):
            raw = pack(receipt({key: True}))
            self.assertHeld(raw, GitHub(raw), "RECEIPT_AUTHORITY_INVALID")

    def test_missing_failed_or_bogus_check_rejected(self):
        for checks in ({k: "PASS" for k in mod.CHECKS[:-1]},
                       {**{k: "PASS" for k in mod.CHECKS},
                        "inspect_desk": "FAIL"},
                       {**{k: "PASS" for k in mod.CHECKS},
                        "fake_approved": "PASS"}):
            raw = pack(receipt({"checks": checks}))
            self.assertHeld(raw, GitHub(raw), "BROWSER_CHECKS_INCOMPLETE")

    def test_wrong_marker_sha_or_run_id_rejected(self):
        for field, val in (("source_sha", MOVED),
                           ("observed_deployment_build_marker", MOVED),
                           ("workflow_run_id", "1234"),
                           ("github_head_after_sha", MOVED)):
            raw = pack(receipt({field: val}))
            self.assertHeld(raw, GitHub(raw))

    def test_unexpected_zip_traversal_extra_or_duplicate_members_fail(self):
        for path in ("../secret", "other.json", "r12-artifacts/malicious.json"):
            raw = pack(extra=[(path, "{}")])
            self.assertHeld(raw, GitHub(raw), "ZIP_UNEXPECTED_MEMBER")
        raw = pack(extra=[("browser-smoke.json", "{}")])
        self.assertHeld(raw, GitHub(raw), "ZIP_MEMBER_INVALID")

    def test_nested_expected_receipt_member_accepted(self):
        raw = pack(path="r12-artifacts/browser-smoke.json")
        r = mod.review(RUN, raw, get=GitHub(raw), now=NOW)
        self.assertTrue(r["artifact_zip_contents_validated"])

    def test_head_changed_between_reads_fails_closed(self):
        raw = pack()
        gh = GitHub(raw)
        n = 0
        def moving(path, token):
            nonlocal n
            if path.endswith("/branches/main"):
                n += 1
                return {"name": "main", "commit": {"sha": SHA if n == 1 else MOVED}}
            return gh(path, token)
        self.assertHeld(raw, moving, "CURRENT_HEAD_CHANGED_DURING_READ")

    def test_wrong_live_repository_identity_refused(self):
        raw = pack()
        gh = GitHub(raw)
        gh.repo["private"] = True
        self.assertHeld(raw, gh, "CURRENT_REPO_IDENTITY_INVALID")

    def test_invalid_run_id_cannot_fetch_external_data(self):
        raw = pack()
        gh = GitHub(raw)
        for value in (True, -1, 0, "41710656371", 10**20):
            with self.assertRaisesRegex(mod.Held, "RUN_ID_INVALID"):
                mod.review(value, raw, get=gh, now=NOW)
        self.assertEqual(gh.calls, [])

    def test_write_new_without_clobber_and_private_permissions(self):
        raw = pack()
        report = mod.review(RUN, raw, get=GitHub(raw), now=NOW)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "evidence" / "r13.json"
            mod.write_exclusive(path, report)
            self.assertEqual(json.loads(path.read_text())["state"], report["state"])
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(mod.Held):
                mod.write_exclusive(path, report)
