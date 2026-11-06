import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reobserveGmedReceipt} from "../src/verified-pipeline-second-opinion.mjs";

const SHA="a".repeat(40),OTHER="b".repeat(40);
const FIXED=new Date("2026-11-06T07:57:00.000Z");
const api="/repos/MichaelWave369/BTM";
const check=(name="CI",conclusion="success")=>({
  name,status:"completed",conclusion
});
const status=(context="lint",state="success")=>({context,state});
const counts=(passed=1,accepted=1,failed=0,pending=0,unknown=0)=>({
  total:passed+failed+pending+unknown+(accepted-passed),
  passed,accepted,failed,pending,unknown
});
function local(){
  return {
    schema:"gmed-report:v1",state:"GMED",merged:true,sha:SHA,
    counts:counts(),
    checks:[{name:"CI",kind:"check",status:"completed",
      conclusion:"success",grade:"good",url:null}],
    pullUrl:"https://github.com/MichaelWave369/BTM/pull/51",
    title:"GMED proof-of-pr",number:51,
    observedAt:"2026-11-06T07:56:00Z",
    detail:"Merged and checks observed",limits:"Checks do not prove runtime behavior",
    target:{owner:"MichaelWave369",repo:"BTM",fullName:"MichaelWave369/BTM",
      number:51,url:"https://github.com/MichaelWave369/BTM/pull/51"}
  };
}
function mock(options={}){
  const calls=[];
  const fetcher=async(url,request)=>{
    calls.push({url,request});
    const u=new URL(url),path=u.pathname,pg=Number(u.searchParams.get("page")||1);
    if(options.denied)return response(null,403);
    if(path===api)return response({full_name:options.repoName||"MichaelWave369/BTM",
      private:options.private===true},200);
    if(path===api+"/pulls/51")return response({
      number:51,merged:options.merged!==false,
      merge_commit_sha:options.sha===undefined?SHA:options.sha,
      base:{repo:{full_name:options.prRepo||"MichaelWave369/BTM"}}
    },200);
    if(path.endsWith("/check-runs")){
      const pages=options.checkPages||[[check()]];
      const items=pages[pg-1]||[];
      const total=options.checkTotal===undefined?pages.flat().length:options.checkTotal;
      const next=options.endless||pg<pages.length;
      return response({total_count:total,check_runs:items},200,
        next?'<https://api.github.com/next>; rel="next"':"");
    }
    if(path.endsWith("/status")){
      const pages=options.statusPages||[[]];
      const rows=pages[pg-1]||[];
      const next=options.statusEndless||pg<pages.length;
      return response({statuses:rows},200,
        next?'<https://api.github.com/next>; rel="next"':"");
    }
    throw Error("Unexpected GitHub endpoint "+url);
  };
  return {fetcher,calls};
}
function response(value,status=200,link=""){
  return {ok:status===200,status,json:async()=>value,
    headers:{get:name=>name.toLowerCase()==="link"?link:""}};
}
const verify=(doc,network)=>reobserveGmedReceipt(JSON.stringify(doc),{
  fetcher:network.fetcher,clock:()=>FIXED
});

test("R43 exact PR merge SHA, same rows and state return only same-provider agreement",async()=>{
  const m=mock();
  const r=await verify(local(),m);
  assert.equal(r.state,"SECOND_OBSERVATION_GMED_AGREEMENT");
  assert.equal(r.matching_github_evidence,true);
  assert.equal(r.github_observed_state,"GMED");
  assert.equal(r.github_observed_merge_sha,SHA);
  assert.equal(r.checks.same_signal_multiset,true);
  assert.equal(r.reobserved_at,FIXED.toISOString());
  for(const key of [
    "original_gmed_producer_authenticated","github_authenticated_cryptographically",
    "external_auditor_confirmed","test_commands_replayed","required_checks_verified",
    "human_approval_recorded","merge_authorized"
  ])assert.equal(r[key],false,key);
  assert.deepEqual(r.permissions,[]);
  assert.equal(r.same_provider_as_original,true);
  assert.ok(m.calls.every(x=>x.url.startsWith("https://api.github.com/")));
  assert.ok(m.calls.every(x=>x.request.method==="GET"&&x.request.credentials==="omit"));
});

test("R43 can see matching non-green observations without upgrading status",async()=>{
  const a=local();
  a.merged=false;a.state="NOT_MERGED";a.sha=null;
  a.checks=[];a.counts=counts(0,0);
  const m=mock({merged:false,sha:null});
  const r=await verify(a,m);
  assert.equal(r.state,"SECOND_OBSERVATION_NON_GREEN_AGREEMENT");
  assert.equal(r.matching_github_evidence,true);
  assert.equal(r.github_observed_state,"NOT_MERGED");
  assert.equal(m.calls.filter(x=>x.url.includes("/commits/")).length,0);
});

test("R43 changed merge SHA is a mismatch even if fresh checks are green",async()=>{
  const r=await verify(local(),mock({sha:OTHER}));
  assert.equal(r.state,"SECOND_OBSERVATION_MISMATCH");
  assert.equal(r.checks.same_merge_sha,false);
  assert.equal(r.matching_github_evidence,false);
});

test("R43 replacing the actual check row defeats forged identical counts",async()=>{
  const r=await verify(local(),mock({checkPages:[[check("different job")]]}));
  assert.equal(r.state,"SECOND_OBSERVATION_MISMATCH");
  assert.equal(r.checks.same_state,true);
  assert.equal(r.checks.same_signal_multiset,false);
});

test("R43 new observed check failure defeats imported success claim",async()=>{
  const r=await verify(local(),mock({checkPages:[[check("CI","failure")]]}));
  assert.equal(r.github_observed_state,"FAILED");
  assert.equal(r.state,"SECOND_OBSERVATION_MISMATCH");
  assert.equal(r.checks.same_state,false);
});

test("R43 pending checks do not appear green",async()=>{
  const pending={name:"CI",status:"in_progress",conclusion:null};
  const r=await verify(local(),mock({checkPages:[[pending]]}));
  assert.equal(r.github_observed_state,"PENDING");
  assert.equal(r.matching_github_evidence,false);
});

test("R43 neutral-only checks become independently UNVERIFIED",async()=>{
  const r=await verify(local(),mock({checkPages:[[check("CI","neutral")]]}));
  assert.equal(r.github_observed_state,"UNVERIFIED");
  assert.equal(r.matching_github_evidence,false);
});

test("R43 complete paginated check signals agree despite array order",async()=>{
  const a=local();
  a.checks=[
    {name:"test-two",kind:"check",status:"completed",conclusion:"success",grade:"good",url:null},
    {name:"CI",kind:"check",status:"completed",conclusion:"success",grade:"good",url:null}
  ];
  a.counts=counts(2,2);
  const m=mock({checkPages:[[check("CI")],[check("test-two")]]});
  const r=await verify(a,m);
  assert.equal(r.state,"SECOND_OBSERVATION_GMED_AGREEMENT");
  assert.equal(r.github_observed_signal_count,2);
  assert.ok(m.calls.some(x=>x.url.includes("page=2")));
});

test("R43 fresh legacy status is included and must agree with imported rows",async()=>{
  const a=local();
  a.checks.push({name:"lint",kind:"status",status:"success",
    conclusion:null,grade:"good",url:null});
  a.counts=counts(2,2);
  const r=await verify(a,mock({statusPages:[[status()]]}));
  assert.equal(r.state,"SECOND_OBSERVATION_GMED_AGREEMENT");
});

test("R43 missing check pages never count as completeness",async()=>{
  const r=await verify(local(),mock({checkTotal:42}));
  assert.equal(r.state,"REOBSERVATION_UNAVAILABLE");
  assert.match(r.error,/truncated|incomplete/);
  assert.equal(r.matching_github_evidence,false);
});

test("R43 count changing during pagination refuses agreement",async()=>{
  const m=mock({checkPages:[[check()],[check("Other")]],checkTotal:2});
  const calls=m.calls;
  const old=m.fetcher;
  const f=async(url,request)=>{
    const ans=await old(url,request);
    if(url.includes("/check-runs")&&url.includes("page=2")){
      const raw=await ans.json();
      return response({...raw,total_count:3},200);
    }
    return ans;
  };
  const r=await reobserveGmedReceipt(JSON.stringify(local()),
    {fetcher:f,clock:()=>FIXED});
  assert.equal(r.state,"REOBSERVATION_UNAVAILABLE");
  assert.match(r.error,/changed during pagination/);
  assert.ok(calls.length>=4);
});

test("R43 pagination limit refuses endless pages",async()=>{
  const r=await verify(local(),mock({endless:true}));
  assert.equal(r.state,"REOBSERVATION_UNAVAILABLE");
  assert.match(r.error,/pagination/);
});

test("R43 API 403 or offline response refuses without forging agreement",async()=>{
  const r=await verify(local(),mock({denied:true}));
  assert.equal(r.state,"REOBSERVATION_UNAVAILABLE");
  assert.equal(r.matching_github_evidence,false);
  assert.equal(r.merge_authorized,false);
});

test("R43 repository marked private refuses public comparison",async()=>{
  const r=await verify(local(),mock({private:true}));
  assert.equal(r.state,"REOBSERVATION_UNAVAILABLE");
  assert.match(r.error,/repository identity mismatch/i);
});

test("R43 unrelated or malformed PR identity refuses comparison",async()=>{
  const r=await verify(local(),mock({prRepo:"AnotherOwner/BTM"}));
  assert.equal(r.state,"REOBSERVATION_UNAVAILABLE");
  assert.match(r.error,/PR identity mismatch/i);
});

test("R43 imported unsupported owner yields a held result with zero requests",async()=>{
  const a=local();
  a.target.owner="Elsewhere";a.target.fullName="Elsewhere/BTM";
  a.target.url="https://github.com/Elsewhere/BTM/pull/51";
  a.pullUrl=a.target.url;
  const m=mock();
  const r=await verify(a,m);
  assert.equal(r.state,"TARGET_OUTSIDE_PUBLIC_FLEET");
  assert.equal(m.calls.length,0);
});

test("R43 malformed or forged GMED file never triggers a GitHub request",async()=>{
  const a=local();a.merge_authorized=true;
  const m=mock();
  await assert.rejects(verify(a,m),/schema/);
  assert.equal(m.calls.length,0);
});

test("R43 synthetic R40 fixtures are rejected before GitHub reads",async()=>{
  const m=mock();
  await assert.rejects(
    reobserveGmedReceipt(JSON.stringify({kind:"PHI_SYNTHETIC_CI_FIXTURE_V1"}),
      {fetcher:m.fetcher,clock:()=>FIXED}),/schema/
  );
  assert.equal(m.calls.length,0);
});

test("R43 old unsigned import can match current data but is labeled stale",async()=>{
  const a=local();a.observedAt="2026-10-01T00:00:00Z";
  const r=await verify(a,mock());
  assert.equal(r.imported_stale,true);
  assert.equal(r.matching_github_evidence,true);
  assert.equal(r.original_gmed_producer_authenticated,false);
});

test("R43 changing local file/clear invalidates old asynchronous UI result",()=>{
  const s=readFileSync(new URL("../src/verified-pipeline-local-receipts.jsx",import.meta.url),"utf8");
  assert.match(s,/Recheck public GitHub now/);
  assert.match(s,/reobserveGmedReceipt\(gmed\.raw\)/);
  assert.match(s,/recheckSequence\.current/);
  assert.match(s,/selected!==gmedSequence\.current/);
  assert.match(s,/Importing a file alone never contacts GitHub/);
  assert.doesNotMatch(s,/\blocalStorage\b|\bsessionStorage\b|dangerouslySetInnerHTML/);
});

test("R43 remains within Pipeline Factory alongside R40/R41/R42",()=>{
  const s=readFileSync(new URL("../src/verified-pipeline.jsx",import.meta.url),"utf8");
  for(const room of ["LocalReceiptBridge","PublicCiEvidenceBridge","SyntheticGateLab"]){
    assert.match(s,new RegExp(room));
  }
});
