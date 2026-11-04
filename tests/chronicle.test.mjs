import test from "node:test";
import assert from "node:assert/strict";
import {
  validChronicleRef, readChronicleBranches, readChronicleHistory,
  readChronicleChange, chronicleFlow, chronicleHandoff
} from "../src/chronicle.mjs";

const repo = { id: 369, name: "PhiMadaPrime",
  full_name: "MichaelWave369/PhiMadaPrime", exampleOnly: false };
const base = "https://api.github.com/repos/MichaelWave369/PhiMadaPrime";
const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40);
const repoMeta = { id: 369, full_name: repo.full_name,
  default_branch: "main", private: false };
const branches = [{ name: "main", commit: { sha: a } },
  { name: "feature/test", commit: { sha: b } }];
const commits = [
  { sha: a, parents: [{sha:b}], commit: {
    message: "Fix the build\nMore detail", author: {name:"Tester",date:"2026-11-04T10:00:00Z"} } },
  { sha: b, parents: [{sha:c}], commit: {
    message:"Old change", author:{name:"Tester",date:"2026-11-03T10:00:00Z"} } }
];
const detail = {sha:a,parents:[{sha:b}],files:[
  {filename:"src/main.jsx",status:"modified",additions:2,deletions:1,
    patch:"@@ -1 +1,2 @@\n-before\n+after\n+extra"}
]};
function mock(records) {
  const calls = [];
  const fetcher = async (url, opts) => {
    calls.push({url,opts});
    assert.equal(opts.credentials,"omit");
    assert.equal(opts.headers.Accept,"application/vnd.github+json");
    const record = records[url];
    return {ok:record !== undefined,json:async () => record};
  };
  fetcher.calls = calls;
  return fetcher;
}
function records() {
  return {
    [base]:repoMeta,
    [base+"/branches?per_page=20"]:branches,
    [base+"/branches/main"]:{name:"main",commit:{sha:a}},
    [base+"/commits?sha="+a+"&per_page=25"]:commits,
    [base+"/commits/"+a+"?per_page=40"]:detail
  };
}
test("reject unsupported branch refs and injection-shaped names", () => {
  for (const value of ["../main","/abs","name..sub","a//b","hello world","x.lock","a/","🦄",""]) {
    assert.equal(validChronicleRef(value),false,value);
  }
  for (const value of ["main","feat/safe-name","release/v1.0","test_1"]) {
    assert.equal(validChronicleRef(value),true,value);
  }
});
test("observes verified public branch list, with no forwarded credentials",async ()=>{
  const f=mock(records());
  const result=await readChronicleBranches(repo,f,()=>Date.parse("2026-11-04T11:00:00Z"));
  assert.equal(result.repository,repo.full_name);
  assert.equal(result.defaultBranch,"main");
  assert.equal(result.branches.length,2);
  assert.equal(result.partial,false);
  assert.equal(result.readOnly,true);
  assert.equal(f.calls.length,2);
});
test("default branch is retained when it falls outside the first page",async ()=>{
  const many=Array.from({length:20},(_,i)=>({
    name:"test/branch-"+i,commit:{sha:b}
  }));
  const f=mock({...records(),[base+"/branches?per_page=20"]:many});
  const result=await readChronicleBranches(repo,f);
  assert.equal(result.partial,true);
  assert.ok(result.branches.some(branch=>branch.name==="main" && branch.sha===null));
});
test("repo identity mismatch, private repos and examples fail closed",async ()=>{
  for (const meta of [
    {...repoMeta,id:370},{...repoMeta,private:true},
    {...repoMeta,full_name:"someone/other"}
  ]) await assert.rejects(readChronicleBranches(repo,
    mock({...records(),[base]:meta})),/CHRONICLE_REPOSITORY_MISMATCH/);
  await assert.rejects(readChronicleBranches({...repo,exampleOnly:true},
    mock(records())),/PUBLIC_REPOSITORY_IDENTITY_REQUIRED/);
});
test("loads commit window anchored to exact observed SHA",async ()=>{
  const f=mock(records());
  const result=await readChronicleHistory(repo,"main",f);
  assert.equal(result.headSha,a);
  assert.equal(result.commits[0].parentSha,b);
  assert.match(result.commits[0].url,/commit\/a{40}$/);
  assert.equal(result.partial,false);
  assert.ok(f.calls.some(v=>v.url.includes("commits?sha="+a)));
  assert.ok(!f.calls.some(v=>v.url.includes("commits?sha=main")));
});
test("reject branch movement or invalid head commit listing",async ()=>{
  const moved={...records(),[base+"/commits?sha="+a+"&per_page=25"]:[commits[1]]};
  await assert.rejects(readChronicleHistory(repo,"main",mock(moved)),
    /CHRONICLE_HEAD_LIST_MISMATCH/);
  await assert.rejects(readChronicleHistory(repo,"main",mock({
    ...records(),[base+"/branches/main"]:{name:"other",commit:{sha:a}}
  })),/CHRONICLE_BRANCH_HEAD_INVALID/);
});
test("commit detail verifies selected SHA and first parent before patches",async ()=>{
  const result=await readChronicleChange(repo,a,b,mock(records()));
  assert.equal(result.files.length,1);
  assert.equal(result.files[0].patch,detail.files[0].patch);
  assert.equal(result.compareUrl,"https://github.com/MichaelWave369/PhiMadaPrime/compare/"+b+"..."+a);
  assert.equal(result.mergeAuthorized,false);
  await assert.rejects(readChronicleChange(repo,a,c,mock(records())),
    /CHRONICLE_COMMIT_DETAIL_MISMATCH/);
  await assert.rejects(readChronicleChange(repo,"broken",b,mock(records())),
    /CHRONICLE_COMMIT_ID_INVALID/);
});
test("untrusted file paths omitted, binary or oversized patches never invented",async ()=>{
  const files=[...detail.files,
    {...detail.files[0],filename:"../../secret"},
    {...detail.files[0],filename:"binary.png",patch:undefined},
    {...detail.files[0],filename:"large.jsx",patch:"x".repeat(120001)}];
  const result=await readChronicleChange(repo,a,b,mock({
    ...records(),[base+"/commits/"+a+"?per_page=40"]:{...detail,files}
  }));
  assert.equal(result.skipped,1);
  assert.equal(result.files.length,3);
  assert.equal(result.files.find(f=>f.path==="binary.png").patch,null);
  assert.equal(result.files.find(f=>f.path==="large.jsx").patch,null);
});
test("partial commit windows and changed-file lists are explicitly marked",async ()=>{
  const long=Array.from({length:25},(_,i)=>({
    ...commits[0],sha:i===0?a:((i+1).toString(16).padStart(40,"0"))
  }));
  const full=await readChronicleHistory(repo,"main",mock({
    ...records(),[base+"/commits?sha="+a+"&per_page=25"]:long
  }));
  assert.equal(full.partial,true);
  const result=await readChronicleChange(repo,a,b,mock({
    ...records(),[base+"/commits/"+a+"?per_page=40"]:{
      ...detail,files:Array.from({length:40},(_,i)=>({
        ...detail.files[0],filename:"src/file"+i+".mjs"
      }))
    }
  }));
  assert.equal(result.partial,true);
});
test("observation flow never implies execution or release authority",async ()=>{
  const bi=await readChronicleBranches(repo,mock(records()));
  const hi=await readChronicleHistory(repo,"main",mock(records()));
  const diff=await readChronicleChange(repo,a,b,mock(records()));
  const initial=chronicleFlow(repo,null,null,null);
  assert.equal(initial.stages[0].status,"OBSERVED");
  assert.equal(initial.stages[3].status,"NOT OBSERVED");
  const full=chronicleFlow(repo,bi,hi,diff,true);
  assert.equal(full.stages[3].status,"OBSERVED");
  assert.equal(full.stages[4].status,"LOCAL ONLY");
  assert.equal(full.stages[5].status,"EXTERNAL");
  assert.equal(full.nodes.length,6);
  assert.equal(full.edges.length,5);
});
test("review handoff includes exact SHA and rejects an unrelated change",async ()=>{
  const hi=await readChronicleHistory(repo,"main",mock(records()));
  const diff=await readChronicleChange(repo,a,b,mock(records()));
  const text=chronicleHandoff(hi,diff,"src/main.jsx");
  assert.match(text,new RegExp(a));
  assert.match(text,/no job executed, restoration attempted/);
  assert.throws(()=>chronicleHandoff(hi,diff,"secrets.txt"),
    /CHRONICLE_SELECTION_MISMATCH/);
  assert.throws(()=>chronicleHandoff(hi,{...diff,parentSha:c},"src/main.jsx"),
    /CHRONICLE_SELECTION_MISMATCH/);
});
