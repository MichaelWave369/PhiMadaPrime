import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inspectRequiredCheckPolicy} from "../src/verified-pipeline-required-policy.mjs";
const SHA="a".repeat(40),NOW=new Date("2026-11-06T09:01:00Z");
const GOOD={name:"CI",kind:"check",status:"completed",
  conclusion:"success",grade:"good",url:null};
const REQUIRED={
  type:"required_status_checks",ruleset_id:4,
  parameters:{strict_required_status_checks_policy:true,
    required_status_checks:[{context:"CI"}]}
};
function second(extra={}){
  return {
    kind:"PHI_GMED_SECOND_OPINION_V1",
    state:"SECOND_OBSERVATION_GMED_AGREEMENT",
    matching_github_evidence:true,github_observed_state:"GMED",
    imported_sha:SHA,github_observed_merge_sha:SHA,
    repository:"MichaelWave369/BTM",pr_number:51,
    observed_base_branch:"main",
    reobserved_at:"2026-11-06T09:00:00Z",
    observed_signals:[{...GOOD}],github_observed_signal_count:1,
    ...extra
  };
}
function response(body,status=200,link=""){
  return {status,ok:status>=200&&status<300,json:async()=>body,
    headers:{get:key=>key.toLowerCase()==="link"?link:""}};
}
function server(opts={}){
  const calls=[];
  const fetcher=async(url,init)=>{
    calls.push({url,init});
    if(opts.apiDenied)return response({message:"forbidden"},403);
    if(url.includes("/rules/branches/")){
      const page=Number(new URL(url).searchParams.get("page")||1);
      const pages=opts.pages||[[REQUIRED]];
      if(opts.rulesDenied)return response(null,403);
      if(opts.rulesMalformed)return response({rules:[]});
      const next=opts.endless||page<pages.length;
      return response(pages[page-1]||[],200,
        next?'<https://api.github.com/next>; rel="next"':"");
    }
    if(url.includes("/protection/required_status_checks")){
      if(opts.classicStatus)return response({message:"unavailable"},opts.classicStatus);
      return response(opts.classic||{contexts:["CI"],checks:[]});
    }
    throw Error("Unexpected policy URL "+url);
  };
  return {fetcher,calls};
}
const run=(s=second(),srv=server())=>inspectRequiredCheckPolicy(s,{
  fetcher:srv.fetcher,clock:()=>NOW
});

test("R44 reads both public policy sources and compares a declared successful check",async()=>{
  const m=server();
  const r=await run(second(),m);
  assert.equal(r.state,"DECLARED_CONTEXTS_OBSERVED_SUCCESS");
  assert.equal(r.policy_coverage,"BOTH_ENDPOINTS_READ");
  assert.deepEqual(r.required_contexts,["CI"]);
  assert.equal(r.context_checks[0].check_run_or_status_success,true);
  assert.equal(r.observed_contexts_with_success,1);
  assert.equal(r.status_checks_only_match,true);
  assert.equal(r.all_required_checks_verified,false);
  assert.equal(r.issuer_signature_verified,false);
  assert.equal(r.merge_authorized,false);
  assert.deepEqual(r.permissions,[]);
  assert.equal(r.observed_merge_sha,SHA);
  assert.equal(m.calls.length,2);
  assert.ok(m.calls.every(x=>x.url.startsWith("https://api.github.com/")));
  assert.ok(m.calls.every(x=>x.init.method==="GET"&&x.init.credentials==="omit"));
});
test("R44 classic 403 is incomplete coverage, NOT proof nothing required",async()=>{
  const r=await run(second(),server({classicStatus:403}));
  assert.equal(r.state,"POLICY_COVERAGE_INCOMPLETE");
  assert.equal(r.protection_access,"DENIED");
  assert.equal(r.policy_coverage,"CLASSIC_PROTECTION_DENIED");
  assert.equal(r.all_required_checks_verified,false);
});
test("R44 classic 404 is incomplete coverage, not an empty policy",async()=>{
  const r=await run(second(),server({classicStatus:404}));
  assert.equal(r.state,"POLICY_COVERAGE_INCOMPLETE");
  assert.equal(r.protection_access,"NOT_EXPOSED");
});
test("R44 rules endpoint 403 prevents a policy inventory",async()=>{
  const r=await run(second(),server({rulesDenied:true}));
  assert.equal(r.state,"POLICY_OBSERVATION_UNAVAILABLE");
  assert.equal(r.merge_authorized,false);
});
test("R44 no disclosed contexts is NOT a successful required-check verdict",async()=>{
  const r=await run(second(),server({pages:[[]],classic:{contexts:[],checks:[]}}));
  assert.equal(r.state,"NO_REQUIRED_CONTEXTS_DISCLOSED");
  assert.equal(r.status_checks_only_match,false);
  assert.equal(r.all_required_checks_verified,false);
});
test("R44 required rule missing from exact merge commit fails",async()=>{
  const rules=[{...REQUIRED,parameters:{
    required_status_checks:[{context:"not-observed"}],
    strict_required_status_checks_policy:true
  }}];
  const r=await run(second(),server({pages:[rules],classic:{contexts:[],checks:[]}}));
  assert.equal(r.state,"REQUIRED_CONTEXTS_NOT_SUCCESSFUL");
  assert.deepEqual(r.missing_contexts,["not-observed"]);
});
test("R44 a failed, skipped or neutral check never satisfies required success",async()=>{
  for(const conclusion of ["failure","skipped","neutral"]){
    const r=await run(second({observed_signals:[{...GOOD,conclusion}]}));
    assert.equal(r.state,"REQUIRED_CONTEXTS_NOT_SUCCESSFUL",conclusion);
    assert.deepEqual(r.not_successful_contexts,["CI"]);
  }
});
test("R44 completed legacy statuses count when a required context matches",async()=>{
  const r=await run(second({observed_signals:[{
    name:"CI",kind:"status",status:"success",conclusion:null,grade:"good",url:null
  }]}));
  assert.equal(r.state,"DECLARED_CONTEXTS_OBSERVED_SUCCESS");
  assert.equal(r.context_checks[0].check_run_or_status_success,true);
});
test("R44 duplicate matching context names are ambiguous, not a pass",async()=>{
  const r=await run(second({observed_signals:[{...GOOD},{...GOOD}],
    github_observed_signal_count:2}));
  assert.equal(r.state,"REQUIRED_CONTEXTS_NOT_SUCCESSFUL");
  assert.equal(r.context_checks[0].result,"AMBIGUOUS_DUPLICATES");
});
test("R44 required app ID is not authenticated by an unsigned check row",async()=>{
  const rule={...REQUIRED,parameters:{
    required_status_checks:[{context:"CI",integration_id:123}],
    strict_required_status_checks_policy:true
  }};
  const r=await run(second(),server({pages:[[rule]]}));
  assert.equal(r.state,"APP_SOURCE_UNVERIFIED");
  assert.deepEqual(r.app_source_unverified_contexts,["CI"]);
  assert.equal(r.context_checks[0].app_identity_verified,false);
});
test("R44 additional workflows and reviews remain unverified merge gates",async()=>{
  const r=await run(second(),server({pages:[[
    REQUIRED,{type:"workflows",parameters:{workflows:[{path:".github/workflows/test.yml"}]}},
    {type:"pull_request",parameters:{required_approving_review_count:1}}
  ]]}));
  assert.equal(r.state,"OTHER_MERGE_GATES_NOT_EVALUATED");
  assert.deepEqual(r.unsupported_merge_rules,["pull_request","workflows"]);
  assert.equal(r.merge_authorized,false);
});
test("R44 unrecognized future rule kinds refuse overall clearance",async()=>{
  const r=await run(second(),server({pages:[[REQUIRED,{type:"new_2027_gate"}]]}));
  assert.equal(r.state,"OTHER_MERGE_GATES_NOT_EVALUATED");
  assert.deepEqual(r.unsupported_merge_rules,["UNCLASSIFIED:new_2027_gate"]);
});
test("R44 all rules pages are read before assessing context policy",async()=>{
  const m=server({pages:[[REQUIRED],[{
    type:"required_status_checks",
    parameters:{required_status_checks:[{context:"extra"}]}
  }]],classic:{contexts:[],checks:[]}});
  const r=await run(second(),m);
  assert.equal(r.state,"REQUIRED_CONTEXTS_NOT_SUCCESSFUL");
  assert.deepEqual(r.missing_contexts,["extra"]);
  assert.ok(m.calls.some(c=>c.url.includes("page=2")));
});
test("R44 endless rules pagination is unavailable rather than empty",async()=>{
  const r=await run(second(),server({endless:true}));
  assert.equal(r.state,"POLICY_OBSERVATION_UNAVAILABLE");
  assert.match(r.error,/pagination/);
});
test("R44 malformed or incomplete rules payload refuses policy clearance",async()=>{
  const r=await run(second(),server({rulesMalformed:true}));
  assert.equal(r.state,"POLICY_OBSERVATION_UNAVAILABLE");
  const x=await run(second(),server({pages:[[{type:"required_status_checks",parameters:{}}]]}));
  assert.equal(x.state,"POLICY_OBSERVATION_UNAVAILABLE");
});
test("R44 malformed classic policy doesn't become absence of checks",async()=>{
  const r=await run(second(),server({classic:{contexts:null}}));
  assert.equal(r.state,"POLICY_OBSERVATION_UNAVAILABLE");
});
test("R44 absent or stale R43 observation triggers zero network requests",async()=>{
  for(const s of [null,second({reobserved_at:"2026-11-01T09:00:00Z"}),
    second({state:"SECOND_OBSERVATION_MISMATCH"}),
    second({matching_github_evidence:false}),
    second({observed_base_branch:"../admin"}),
    second({repository:"Elsewhere/BTM"}),
    second({observed_signals:[]}),
    second({github_observed_merge_sha:"b".repeat(40)})]){
    const m=server();const r=await run(s,m);
    assert.equal(r.state,"FRESH_GMED_REOBSERVATION_REQUIRED");
    assert.equal(m.calls.length,0);
    assert.equal(r.merge_authorized,false);
  }
});
test("R44 policy API failure stays unverified",async()=>{
  const r=await run(second(),server({apiDenied:true}));
  assert.equal(r.state,"POLICY_OBSERVATION_UNAVAILABLE");
  assert.equal(r.all_required_checks_verified,false);
});
test("R44 conflicting integration requirements never silently approve",async()=>{
  const rule={...REQUIRED,parameters:{
    required_status_checks:[{context:"CI",integration_id:41}]
  }};
  const classic={contexts:["CI"],checks:[{context:"CI",app_id:72}]};
  const r=await run(second(),server({pages:[[rule]],classic}));
  assert.equal(r.state,"APP_SOURCE_UNVERIFIED");
  assert.deepEqual(r.conflicting_source_constraints,["CI"]);
});
test("R44 explicit UI trigger and cancellation guards exist",()=>{
  const s=readFileSync(new URL("../src/verified-pipeline-local-receipts.jsx",import.meta.url),"utf8");
  assert.match(s,/inspectRequiredCheckPolicy\(second\)/);
  assert.match(s,/Inspect required-check policy/);
  assert.match(s,/policySequence\.current/);
  assert.doesNotMatch(s,/dangerouslySetInnerHTML|localStorage|sessionStorage/);
});
