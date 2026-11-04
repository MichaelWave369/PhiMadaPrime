import test from "node:test";
import assert from "node:assert/strict";
import {
  readCommitEvidence, normalizeAssociatedPRs, normalizeCheckRuns,
  normalizeLegacyStatus, evidenceHandoff
} from "../src/commit-evidence.mjs";

const repo={id:777,name:"PhiMadaPrime",
  full_name:"MichaelWave369/PhiMadaPrime",exampleOnly:false};
const sha="a".repeat(40),parent="b".repeat(40),branchHead="c".repeat(40);
const base="https://api.github.com/repos/"+repo.full_name;
const history={
  repository:repo.full_name,repositoryId:repo.id,
  branch:"main",headSha:branchHead,
  commits:[{sha,parentSha:parent,title:"R30 test commit"}]
};
const commit=history.commits[0];
const mockPR={
  number:31,title:"Evidence support",state:"closed",draft:false,
  merged_at:"2026-11-04T21:00:00Z",merge_commit_sha:branchHead,
  head:{sha},base:{repo:{id:repo.id,full_name:repo.full_name}}
};
const check={
  id:123456,name:"verify",head_sha:sha,status:"completed",
  conclusion:"success",app:{slug:"github-actions"},
  html_url:"https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/123/job/456"
};
const mockData={
  [base]:{private:false,id:repo.id,full_name:repo.full_name},
  [base+"/commits/"+sha+"?per_page=1"]:{sha,parents:[{sha:parent}]},
  [base+"/commits/"+sha+"/pulls?per_page=10"]:[mockPR],
  [base+"/commits/"+sha+"/check-runs?per_page=30"]:{
    total_count:1,check_runs:[check]
  },
  [base+"/commits/"+sha+"/status"]:{sha,state:"pending",total_count:0,statuses:[]}
};
function mocked(data=mockData){
  const calls=[];
  const fetcher=async (url,opts)=>{
    calls.push({url,opts});
    assert.equal(opts.credentials,"omit");
    assert.equal(opts.headers.Accept,"application/vnd.github+json");
    return {ok:Object.hasOwn(data,url),json:async()=>data[url]};
  };
  fetcher.calls=calls;
  return fetcher;
}
test("loads exact commit, its associated PR, checks and legacy statuses with no actions",async()=>{
  const f=mocked(),result=await readCommitEvidence(repo,history,commit,f,
    ()=>Date.parse("2026-11-04T22:00:00Z"));
  assert.equal(result.repository,repo.full_name);
  assert.equal(result.sha,sha);
  assert.equal(result.parentSha,parent);
  assert.equal(result.prs.prs.length,1);
  assert.equal(result.prs.prs[0].relation,"PR_HEAD_SHA");
  assert.equal(result.checks.summary,"ALL_RETURNED_CHECKS_SUCCESS");
  assert.equal(result.legacy.summary,"NO_LEGACY_STATUS_CONTEXTS");
  assert.equal(result.executedByPage,false);
  assert.equal(result.agentoraExecutionProven,false);
  assert.equal(result.requiredChecksVerified,false);
  assert.equal(result.mergeAuthorized,false);
  assert.equal(f.calls.length,5);
  assert.ok(f.calls.every(item=>item.url.startsWith(base)));
});
test("rejects curated examples, mismatched catalog, and wrong historical commit",async()=>{
  await assert.rejects(readCommitEvidence({...repo,exampleOnly:true},history,commit,mocked()),
    /PUBLIC_REPOSITORY_IDENTITY_REQUIRED/);
  await assert.rejects(readCommitEvidence({...repo,full_name:"someone/other"},history,commit,mocked()),
    /PUBLIC_REPOSITORY_IDENTITY_REQUIRED|EVIDENCE_PUBLIC_REPO_REQUIRED/);
  await assert.rejects(readCommitEvidence(repo,history,{sha:"d".repeat(40),parentSha:parent},mocked()),
    /EVIDENCE_CHRONICLE_SELECTION_MISMATCH/);
});
test("identity and exact parent commit mismatches fail closed",async()=>{
  await assert.rejects(readCommitEvidence(repo,history,commit,mocked({
    ...mockData,[base]:{...mockData[base],private:true}
  })),/EVIDENCE_REPOSITORY_IDENTITY_MISMATCH/);
  await assert.rejects(readCommitEvidence(repo,history,commit,mocked({
    ...mockData,[base+"/commits/"+sha+"?per_page=1"]:{sha,parents:[{sha:"d".repeat(40)}]}
  })),/EVIDENCE_COMMIT_PARENT_MISMATCH/);
});
test("associations are GitHub-reported, not inferred from title or human attribution",()=>{
  const source=[
    mockPR,
    {...mockPR,number:32,head:{sha:"f".repeat(40)},merge_commit_sha:sha},
    {...mockPR,number:33,head:{sha:"f".repeat(40)},merge_commit_sha:null},
    {...mockPR,number:34,base:{repo:{id:123,full_name:"other/repo"}}}
  ];
  const r=normalizeAssociatedPRs(source,repo,sha);
  assert.equal(r.prs.length,3);
  assert.deepEqual(r.prs.map(p=>p.relation),
    ["PR_HEAD_SHA","MERGE_COMMIT_SHA","GITHUB_ASSOCIATED"]);
  assert.equal(r.excluded,1);
  assert.ok(r.prs.every(p=>p.url.startsWith("https://github.com/"+repo.full_name+"/pull/")));
});
test("partial and invalid PR association pages never imply complete coverage",()=>{
  const ten=Array.from({length:10},(_,i)=>({...mockPR,number:i+1}));
  assert.equal(normalizeAssociatedPRs(ten,repo,sha).partial,true);
  assert.throws(()=>normalizeAssociatedPRs([...ten,mockPR],repo,sha),/EVIDENCE_PR_SHAPE/);
  assert.equal(normalizeAssociatedPRs([mockPR,mockPR],repo,sha).excluded,1);
});
test("check-run integrity blocks foreign SHA and arbitrary external links",()=>{
  const other={...check,id:456,head_sha:"d".repeat(40)};
  const r=normalizeCheckRuns({total_count:3,check_runs:[check,other,{
    ...check,id:789,html_url:"https://evil.example.com/run/1"
  }]},repo,sha);
  assert.equal(r.excluded,1);
  assert.equal(r.partial,true);
  assert.equal(r.runs.length,2);
  assert.equal(r.runs[1].url,null);
  assert.equal(r.summary,"INCOMPLETE_CHECK_RUN_OBSERVATION");
  assert.equal(r.requiredChecksVerified,false);
});
test("a check-run list containing unfinished or failed checks never looks all green",()=>{
  const pending=normalizeCheckRuns({total_count:2,check_runs:[
    check,{...check,id:9,status:"in_progress",conclusion:null}
  ]},repo,sha);
  assert.equal(pending.summary,"OBSERVED_CHECKS_UNFINISHED");
  const failed=normalizeCheckRuns({total_count:2,check_runs:[
    check,{...check,id:9,conclusion:"failure"}
  ]},repo,sha);
  assert.equal(failed.summary,"OBSERVED_CHECKS_NOT_ALL_SUCCESS");
  const tooMany=normalizeCheckRuns({total_count:31,check_runs:[
    ...Array.from({length:30},(_,i)=>({...check,id:i+1}))
  ]},repo,sha);
  assert.equal(tooMany.partial,true);
  assert.equal(tooMany.summary,"INCOMPLETE_CHECK_RUN_OBSERVATION");
});
test("legacy pending with zero contexts is not reported as a failing CI check",()=>{
  const observed=normalizeLegacyStatus({sha,state:"pending",total_count:0,statuses:[]},sha);
  assert.equal(observed.reportedState,null);
  assert.equal(observed.summary,"NO_LEGACY_STATUS_CONTEXTS");
  assert.equal(observed.contexts.length,0);
  assert.throws(()=>normalizeLegacyStatus({
    sha:"d".repeat(40),state:"success",total_count:0,statuses:[]
  },sha),/EVIDENCE_LEGACY_SHAPE/);
});
test("per-source failures are isolated but commit identity failure is not",async()=>{
  const data={...mockData};
  delete data[base+"/commits/"+sha+"/pulls?per_page=10"];
  delete data[base+"/commits/"+sha+"/status"];
  const result=await readCommitEvidence(repo,history,commit,mocked(data));
  assert.equal(result.prs.state,"UNAVAILABLE");
  assert.equal(result.checks.state,"OBSERVED");
  assert.equal(result.legacy.state,"UNAVAILABLE");
  delete data[base+"/commits/"+sha+"?per_page=1"];
  await assert.rejects(readCommitEvidence(repo,history,commit,mocked(data)),
    /EVIDENCE_API_UNAVAILABLE/);
});
test("handoff includes bounded evidence and never asserts approval, agent execution or completion",async()=>{
  const bundle=await readCommitEvidence(repo,history,commit,mocked());
  const handoff=evidenceHandoff(bundle);
  assert.match(handoff,/Selected SHA: a{40}/);
  assert.match(handoff,/Associated PR observation: OBSERVED/);
  assert.match(handoff,/NO_LEGACY_STATUS_CONTEXTS/);
  assert.match(handoff,/Independent Agentora execution evidence: NOT_VERIFIED/);
  assert.match(handoff,/No required-check certification/);
  assert.match(evidenceHandoff(bundle,{sourceSha:sha}),/MATCHED_UNSIGNED_R03_ACKNOWLEDGEMENT/);
  assert.throws(()=>evidenceHandoff({}),/EVIDENCE_HANDOFF_INVALID/);
});
