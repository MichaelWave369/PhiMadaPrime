import importlib.util
import pathlib
import sys
import unittest
import urllib.error
from datetime import datetime, timezone

SCRIPTS=pathlib.Path(__file__).resolve().parents[1]/"scripts"
sys.path.insert(0,str(SCRIPTS))
import r20_review_council_browser as r20
import test_r20_council_review as earlier

spec=importlib.util.spec_from_file_location("r24_prepare_live_r20",
                                             SCRIPTS/"r24_prepare_live_r20.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
RUN=earlier.RUN
SHA=earlier.SHA
OLD=earlier.OLD
NOW=earlier.NOW
PREFIX="/repos/"+r20.REPO

def mocked(raw=None,source=SHA,second=None):
    raw=raw or earlier.archive()
    data=earlier.api_data(raw,head=source,second=second)
    branch=PREFIX+"/branches/main"
    first={"name":"main","commit":{"sha":source}}
    next_sha=second if second is not None else source
    other={"name":"main","commit":{"sha":next_sha}}
    data[branch]=[first.copy(),other.copy(),first.copy(),other.copy()]
    return raw,earlier.getter(data)

class R24HandoffTests(unittest.TestCase):
    def test_01_valid_source_and_artifact_produce_actual_r20_review(self):
        raw,get=mocked()
        zip_bytes,report=mod.prepare(RUN,"read-only-token",SHA,
            downloader=lambda ident,token:(
                raw if ident==13579 and token=="read-only-token"
                else (_ for _ in ()).throw(AssertionError("WRONG_ID"))),
            get_json=get,now=NOW)
        self.assertEqual(zip_bytes,raw)
        self.assertEqual(report["schema"],r20.REVIEW_SCHEMA)
        self.assertTrue(report["source_is_current"])
        self.assertEqual(report["workflow_run_id"],RUN)
        self.assertFalse(report["merge_authorized"])

    def test_02_historical_original_evidence_is_valid_but_not_current(self):
        raw,get=mocked(source=OLD)
        _,report=mod.prepare(RUN,"token",OLD,
            downloader=lambda *_:raw,get_json=get,now=NOW)
        self.assertEqual(report["state"],
                         "R19_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA")
        self.assertFalse(report["source_is_current"])
        self.assertEqual(report["workflow_source_sha"],SHA)

    def test_03_preflight_main_change_refuses_artifact_download(self):
        raw,get=mocked(second=OLD)
        seen=[]
        with self.assertRaisesRegex(r20.Held,"R24_SOURCE_MOVED_OR_MISMATCH"):
            mod.prepare(RUN,"token",SHA,downloader=lambda *_:seen.append(1),
                        get_json=get,now=NOW)
        self.assertEqual(seen,[])

    def test_04_corrupted_original_zip_refuses_hash_mismatch(self):
        raw,get=mocked()
        with self.assertRaisesRegex(r20.Held,"R24_ORIGINAL_ARCHIVE_HASH_REFUSED"):
            mod.prepare(RUN,"token",SHA,
                downloader=lambda *_:raw+b"X",get_json=get,now=NOW)

    def test_05_bad_source_sha_and_run_id_refuse_before_fetch(self):
        for bad in [-1,0,10**19,True]:
            with self.assertRaisesRegex(r20.Held,"R24_RUN_ID_INVALID"):
                mod.prepare(bad,"token",SHA,get_json=lambda *_:None)
        for bad in ["main","f"*39,None,"F"*40]:
            with self.assertRaisesRegex(r20.Held,"R24_SOURCE_SHA_INVALID"):
                mod.prepare(RUN,"token",bad,get_json=lambda *_:None)

    def test_06_artifact_metadata_expired_or_duplicate_refused(self):
        import copy
        for modify in (
            lambda items:items[0].update(expired=True),
            lambda items:items[0].update(digest="sha256:fake"),
            lambda items:items[0].update(size_in_bytes=3_000_000),
            lambda items:items.append(copy.deepcopy(items[0]))
        ):
            listing={"total_count":1,"artifacts":[{
                "id":3,"name":"phimada-r19-council-"+str(RUN),
                "size_in_bytes":99,"digest":"sha256:"+"a"*64,
                "expired":False}]}
            modify(listing["artifacts"])
            listing["total_count"]=len(listing["artifacts"])
            with self.assertRaises(r20.Held):
                mod.select_artifact(RUN,lambda *_:listing)

    def test_07_no_signed_redirect_to_private_or_offsite_hosts(self):
        for location in (
            "http://productionresults.blob.core.windows.net/object",
            "https://evil.example.com/path",
            "https://localhost/file",
            "https://127.0.0.1/x",
            "https://blob.core.windows.net.attacker.com/x",
            "https://user:password@foo.blob.core.windows.net/x",
            "https://foo.blob.core.windows.net:444/x",
            "file:///tmp/archive.zip","javascript:alert(1)"
        ):
            with self.assertRaises(r20.Held):
                mod.allow_artifact_redirect(location)
        self.assertEqual(
            mod.allow_artifact_redirect(
                "https://productionresultssa0.blob.core.windows.net/path?sig=test"),
            "https://productionresultssa0.blob.core.windows.net/path?sig=test")

    def test_08_api_token_never_sent_to_redirected_blob(self):
        uri="https://productionresultssa0.blob.core.windows.net/object?sig=1"
        original=earlier.archive()
        requests=[]
        class Response:
            status=200
            def __enter__(self): return self
            def __exit__(self,*_):pass
            def read(self,size):
                self_max=size
                assert size==mod.MAX_BYTES+1
                return original
        class Opener:
            def open(self,request,timeout=None):
                requests.append((request,timeout))
                if len(requests)==1:
                    raise urllib.error.HTTPError(request.full_url,302,
                        "Found",{"Location":uri},None)
                return Response()
        result=mod.download_archive(13579,"my-secret",
                                    opener_factory=lambda *_:Opener())
        self.assertEqual(result,original)
        self.assertEqual(len(requests),2)
        self.assertEqual(requests[0][0].get_header("Authorization"),
                         "Bearer my-secret")
        self.assertIsNone(requests[1][0].get_header("Authorization"))
        self.assertEqual(requests[1][0].full_url,uri)

    def test_09_redirect_without_302_or_valid_host_fails_closed(self):
        class Wrong:
            def open(self,request,timeout=None):
                raise urllib.error.HTTPError(request.full_url,302,"Found",
                                               {"Location":"https://evil.com/x"},None)
        with self.assertRaisesRegex(r20.Held,"R24_REDIRECT_HOST_REFUSED"):
            mod.download_archive(13579,"secret",opener_factory=lambda *_:Wrong())
        class NoRedirect:
            def open(self,request,timeout=None):
                raise urllib.error.HTTPError(request.full_url,404,"Missing",{},None)
        with self.assertRaisesRegex(r20.Held,"R24_ARTIFACT_REDIRECT_REFUSED"):
            mod.download_archive(13579,"secret",
                                 opener_factory=lambda *_:NoRedirect())

    def test_10_request_is_read_only_and_output_is_exclusive(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as path:
            target=pathlib.Path(path)/"original.zip"
            mod.write_exclusive(target,b"DATA")
            self.assertEqual(target.read_bytes(),b"DATA")
            with self.assertRaises(FileExistsError):
                mod.write_exclusive(target,b"OVERWRITE")

    def test_11_original_r20_validator_remains_authority_boundary(self):
        raw,_=mocked()
        packet=earlier.receipt()
        packet["merge_authorized"]=True
        with self.assertRaisesRegex(r20.Held,"R19_RECEIPT_TRUST_REFUSED"):
            r20.validated_receipt(packet,RUN)
        packet=earlier.receipt()
        packet["automated_council_browser_checks_passed"]=False
        with self.assertRaisesRegex(r20.Held,"R19_RECEIPT_TRUST_REFUSED"):
            r20.validated_receipt(packet,RUN)

    def test_12_no_artifact_retrieval_when_repo_id_is_wrong(self):
        raw,base_get=mocked()
        calls=[]
        def fake_get(path):
            calls.append(path)
            data=base_get(path)
            if path==PREFIX:data["id"]=0
            return data
        with self.assertRaisesRegex(r20.Held,"R24_REPO_IDENTITY_REFUSED"):
            mod.prepare(RUN,"token",SHA,get_json=fake_get,now=NOW)
        self.assertEqual(calls,[PREFIX,PREFIX+"/branches/main",
                                PREFIX+"/branches/main"])

if __name__=="__main__":
    unittest.main()
