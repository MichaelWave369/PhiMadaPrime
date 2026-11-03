import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
import zipfile

SCRIPT=Path(__file__).resolve().parents[1]/"scripts"/"r20_review_council_browser.py"
SPEC=importlib.util.spec_from_file_location("r20_review_council_browser",SCRIPT)
mod=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)
REPO=mod.REPO
RUN=41777777777
SHA="a"*40
OLD="b"*40
TIME="2026-11-03T23:30:00Z"
NOW=datetime(2026,11,3,23,48,tzinfo=timezone.utc)

def receipt():
    return {
        "schema":mod.SOURCE_SCHEMA,
        "state":"COUNCIL_BROWSER_INTERACTIONS_PASSED_AT_OBSERVED_SHA",
        "repository":REPO,"repository_id":mod.REPO_ID,"target_url":mod.SITE,
        "source_sha":SHA,"github_head_before_sha":SHA,
        "github_head_after_sha":SHA,
        "observed_deployment_build_marker":SHA,
        "source_fixture_schema":"nbg-pocketmesh.council-evidence-exchange-e1.v0.1",
        "fixture_sha256":"c"*64,"fixture_origin":"PUBLIC_SYNTHETIC",
        "fixture_source_authenticated":False,
        "council_consumer_execution_observed":False,
        "council_model_executed":False,
        "council_review_state":"HELD_UNTRUSTED_REVIEW_ONLY",
        "checks":{key:"PASS" for key in mod.CHECKS},
        "browser_runtime_errors":[],"observed_utc":TIME,
        "workflow_run_id":str(RUN),
        "automated_council_browser_checks_passed":True,
        "deployed_revision_cryptographically_attested":False,
        "source_independent":False,"scientific_evidence":False,
        "accessibility_conformance_verified":False,
        "product_verified":False,"verified_complete":False,
        "dispatch_authorized":False,"merge_authorized":False,
        "operator_review_required":True
    }

def archive(data=None,member="council-browser.json"):
    output=io.BytesIO()
    with zipfile.ZipFile(output,"w",compression=zipfile.ZIP_DEFLATED) as handle:
        handle.writestr(member,json.dumps(data if data is not None else receipt()))
    return output.getvalue()

def api_data(raw,head=SHA,second=None,run_event="workflow_dispatch",
             conclusion="success",digest=None,size=None):
    digest=digest or hashlib.sha256(raw).hexdigest()
    api="/repos/"+REPO
    runroute=api+"/actions/runs/"+str(RUN)
    return {
        runroute:{
            "id":RUN,"event":run_event,"path":mod.WORKFLOW,"status":"completed",
            "conclusion":conclusion,"run_attempt":1,"head_sha":SHA,
            "repository":{"id":mod.REPO_ID,"full_name":REPO},
            "head_repository":{"full_name":REPO},
            "created_at":"2026-11-03T23:15:00Z",
            "updated_at":"2026-11-03T23:40:00Z"
        },
        runroute+"/artifacts?per_page=100":{
            "total_count":1,"artifacts":[{
                "id":13579,"name":"phimada-r19-council-"+str(RUN),
                "expired":False,"size_in_bytes":len(raw) if size is None else size,
                "digest":"sha256:"+digest,"workflow_run":{"id":RUN}
            }]
        },
        api:{
            "id":mod.REPO_ID,"full_name":REPO,"owner":{"login":"MichaelWave369"},
            "private":False,"archived":False,"default_branch":"main"
        },
        api+"/branches/main":[
            {"name":"main","commit":{"sha":head}},
            {"name":"main","commit":{"sha":head if second is None else second}}
        ]
    }

def getter(data):
    def read(path):
        value=data[path]
        if isinstance(value,list):
            return value.pop(0)
        return value
    return read

class R20Tests(unittest.TestCase):
    def setUp(self):
        self.raw=archive()
        self.data=api_data(self.raw)

    def check(self,raw=None,data=None):
        return mod.review(RUN, self.raw if raw is None else raw,
                          getter(copy.deepcopy(self.data if data is None else data)),
                          now=NOW)

    def test_real_format_source_success_becomes_bounded_current_review(self):
        review=self.check()
        self.assertEqual(review["schema"],mod.REVIEW_SCHEMA)
        self.assertEqual(review["state"],"R19_BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA")
        self.assertTrue(review["artifact_member_validated"])
        self.assertEqual(review["reported_check_count"],9)
        for key in ("fixture_source_authenticated","council_consumer_execution_observed",
                    "independent_browser_replay","scientific_evidence",
                    "product_verified","merge_authorized","dispatch_authorized"):
            self.assertIs(review[key],False)

    def test_source_advanced_becomes_historical_not_current(self):
        data=api_data(self.raw,head=OLD)
        review=self.check(data=data)
        self.assertEqual(review["state"],"R19_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA")
        self.assertFalse(review["source_is_current"])

    def test_head_changes_between_reads_is_held(self):
        data=api_data(self.raw,head=SHA,second=OLD)
        report=self.check(data=data)
        self.assertEqual(report["state"],"R19_BROWSER_ARTIFACT_HELD_HEAD_MOVED_DURING_READ")
        self.assertFalse(report["source_is_current"])

    def test_rehashed_fake_execution_flag_is_refused(self):
        p=receipt();p["fixture_source_authenticated"]=True
        with self.assertRaisesRegex(mod.Held,"R19_RECEIPT_TRUST_REFUSED"):
            mod.validated_receipt(p,RUN)

    def test_missing_or_failed_browser_check_is_refused(self):
        for change in ("FAIL","NOT_RUN",None):
            p=receipt()
            if change is None:del p["checks"]["reload_discards_review"]
            else:p["checks"]["reload_discards_review"]=change
            with self.assertRaisesRegex(mod.Held,"R19_CHECKS_INCOMPLETE"):
                mod.validated_receipt(p,RUN)

    def test_fake_producer_or_source_identity_is_refused(self):
        for field,value,reason in [
            ("source_sha",OLD,"R19_RECEIPT_SOURCE_REFUSED"),
            ("source_fixture_schema","fake","R19_RECEIPT_TRUST_REFUSED"),
            ("merge_authorized",True,"R19_RECEIPT_TRUST_REFUSED"),
            ("operator_review_required",False,"R19_RECEIPT_TRUST_REFUSED"),
            ("workflow_run_id",str(RUN+1),"R19_RECEIPT_IDENTITY_REFUSED")
        ]:
            p=receipt();p[field]=value
            with self.assertRaisesRegex(mod.Held,reason):
                mod.validated_receipt(p,RUN)

    def test_unsigned_report_extra_fields_cannot_be_laundered(self):
        p=receipt();p["token"]="SECRET"
        with self.assertRaisesRegex(mod.Held,"R19_RECEIPT_SCHEMA_REFUSED"):
            mod.validated_receipt(p,RUN)

    def test_duplicate_or_extra_archive_members_are_refused(self):
        extra=io.BytesIO()
        with zipfile.ZipFile(extra,"w") as z:
            z.writestr("council-browser.json",json.dumps(receipt()))
            z.writestr("notes.txt","SECRET")
        with self.assertRaisesRegex(mod.Held,"ZIP_MEMBER_COUNT_REFUSED"):
            mod.zip_receipt(extra.getvalue())
        with self.assertRaisesRegex(mod.Held,"ZIP_MEMBER_PATH_REFUSED"):
            mod.zip_receipt(archive(member="../danger.json"))

    def test_wrong_workflow_event_or_conclusion_is_refused(self):
        for changes in [
            {"run_event":"push"},{"conclusion":"failure"}
        ]:
            data=api_data(self.raw,**changes)
            with self.assertRaisesRegex(mod.Held,"R20_GITHUB_RUN_REFUSED"):
                self.check(data=data)

    def test_digest_or_size_forgery_is_refused(self):
        for args in [{"digest":"f"*64},{"size":len(self.raw)+1}]:
            data=api_data(self.raw,**args)
            with self.assertRaisesRegex(mod.Held,"R20_ARTIFACT_DIGEST_REFUSED"):
                self.check(data=data)

    def test_wrong_repository_id_is_refused(self):
        data=api_data(self.raw)
        data["/repos/"+REPO]["id"]=-1
        with self.assertRaisesRegex(mod.Held,"R20_REPO_IDENTITY_REFUSED"):
            self.check(data=data)

    def test_stale_report_does_not_gain_current_credit(self):
        old=NOW.replace(day=1)
        with self.assertRaisesRegex(mod.Held,"R20_RECEIPT_EXPIRED_OR_FUTURE"):
            mod.review(RUN,self.raw,getter(copy.deepcopy(self.data)),now=old)

    def test_rejected_user_controlled_github_paths(self):
        for p in ["/repos/evil", "/repos/"+REPO+"/issues/1",
                  "/repos/"+REPO+"/actions/runs/not-a-number"]:
            with self.assertRaisesRegex(mod.Held,"GITHUB_PATH_REFUSED"):
                mod.github_get(p)

    def test_duplicate_json_keys_are_refused(self):
        with self.assertRaisesRegex(mod.Held,"JSON_DUPLICATE_KEY"):
            mod.json_strict('{"a":1,"a":2}')

if __name__=="__main__":
    unittest.main()
