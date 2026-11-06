// R44: public branch-policy inventory, separate from the GMED merge-commit
// second opinion. Observing a required context is NOT a merge authorization.
// Public GitHub rulesets and classic branch protection are separate sources.
// A 403/404 for classic protection is UNKNOWN, not "no checks required".
const BASE="https://api.github.com";
const SHA=/^[a-f0-9]{40}$/;
const OWNER="michaelwave369";
const REPO=/^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$/;
const MAX_PAGES=3, MAX_RULES=300, MAX_REQUIRED=100;
const OTHER_MERGE_GATES=new Set([
  "workflows","required_workflows","pull_request","required_signatures",
  "required_deployments","required_deployment_environments",
  "code_scanning","code_quality","code_coverage","required_linear_history",
  "required_reviewers","required_code_scanning"
]);

export const NO_POLICY_AUTHORITY=Object.freeze({
  provider:"GITHUB_PUBLIC_API_SAME_PROVIDER",
  issuer_signature_verified:false,
  all_required_checks_verified:false,
  ruleset_enforcement_authoritatively_proven:false,
  required_workflows_executed:false,
  test_commands_replayed:false,
  merge_authorized:false,
  deployment_authorized:false,
  permissions:[]
});
function held(state,extra={}){
  return {
    report_kind:"PHI_REQUIRED_CHECK_POLICY_OBSERVATION_V1",
    mode:"EXPLICIT_PUBLIC_READ_ONLY",
    state,
    policy_coverage:"UNKNOWN",
    protection_access:"NOT_ATTEMPTED",
    rule_count:0,
    required_contexts:[],
    context_checks:[],
    unsupported_merge_rules:[],
    same_provider_as_gmed:true,
    ...NO_POLICY_AUTHORITY,
    warning:"Public branch policy and observed check names are only partial GitHub metadata. They do not prove test execution, source identity, complete merge rules, signed provenance or permission to merge.",
    ...extra
  };
}
function goodBranch(ref){
  return typeof ref==="string"&&BRANCH.test(ref)&&
    !ref.includes("..")&&!ref.includes("//")&&!ref.includes("@{")&&
    !ref.endsWith("/")&&!ref.endsWith(".");
}
function hasNext(link){
  return /<[^>]+>;\s*rel="next"/.test(link||"");
}
async function publicGet(path,fetcher,{allowError=false}={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetcher(BASE+path,{
      method:"GET",credentials:"omit",redirect:"error",
      headers:{Accept:"application/vnd.github+json",
        "X-GitHub-Api-Version":"2022-11-28"},
      signal:controller.signal
    });
    if(!response||!Number.isInteger(response.status))throw Error("GitHub response unavailable");
    if(!response.ok){
      if(allowError&&[403,404].includes(response.status))
        return {status:response.status,value:null,link:""};
      throw Error("GitHub policy endpoint unavailable (HTTP "+response.status+")");
    }
    return {status:response.status,value:await response.json(),
      link:response.headers?.get?.("link")||""};
  }finally{clearTimeout(timeout);}
}
async function rulesForBranch(base,branch,fetcher){
  const rules=[];
  for(let page=1;page<=MAX_PAGES;page++){
    const endpoint=base+"/rules/branches/"+encodeURIComponent(branch)+
      "?per_page=100&page="+page;
    const result=await publicGet(endpoint,fetcher);
    if(!Array.isArray(result.value)||result.value.length>100)
      throw Error("GitHub branch rules payload is invalid");
    rules.push(...result.value);
    if(rules.length>MAX_RULES)throw Error("Branch policy rule count exceeded cap");
    if(!hasNext(result.link))return rules;
  }
  throw Error("Branch rules pagination incomplete");
}
function ruleContexts(rules){
  const requirements=[];
  const unsupported=new Set();
  const allTypes=new Set();
  for(const rule of rules){
    if(!rule||typeof rule!=="object"||typeof rule.type!=="string"||
       rule.type.length>100)throw Error("Malformed active branch rule");
    allTypes.add(rule.type);
    if(rule.type==="required_status_checks"){
      const params=rule.parameters;
      if(!params||!Array.isArray(params.required_status_checks)||
         params.required_status_checks.length>MAX_REQUIRED)
        throw Error("Malformed required-status-check rule");
      for(const item of params.required_status_checks){
        if(typeof item?.context!=="string"||!item.context.trim()||
           item.context.length>256||
           (item.integration_id!==undefined&&
            (!Number.isSafeInteger(item.integration_id)||item.integration_id<0)))
          throw Error("Malformed required context or app identity");
        requirements.push({context:item.context,kind:"ruleset",
          integration_id:item.integration_id??null});
      }
    }else if(OTHER_MERGE_GATES.has(rule.type)){
      unsupported.add(rule.type);
    }else{
      // Unknown new rule types must not be interpreted as complete coverage.
      unsupported.add("UNCLASSIFIED:"+rule.type);
    }
  }
  return {requirements,unsupported:[...unsupported].sort(),types:[...allTypes].sort()};
}
function classicContexts(body){
  if(!body||typeof body!=="object"||
     !Array.isArray(body.contexts)||body.contexts.length>MAX_REQUIRED ||
     (body.checks!==undefined&&
       (!Array.isArray(body.checks)||body.checks.length>MAX_REQUIRED)))
    throw Error("Malformed classic required status-checks policy");
  const checks=body.checks||[];
  const requirements=body.contexts.map(context=>{
    if(typeof context!=="string"||!context.trim()||context.length>256)
      throw Error("Malformed classic context");
    return {context,kind:"classic",integration_id:null};
  });
  for(const check of checks){
    if(typeof check?.context!=="string"||!check.context.trim()||
       check.context.length>256||
       (check.app_id!==undefined&&check.app_id!==null&&
        (!Number.isSafeInteger(check.app_id)||check.app_id<0)))
      throw Error("Malformed classic required check");
    requirements.push({context:check.context,kind:"classic",
      integration_id:check.app_id??null});
  }
  return requirements;
}
function checkContext(name,rows,requirement){
  const candidates=rows.filter(r=>r?.name===name&&
    (r.kind==="check"||r.kind==="status"));
  const genuineSuccess=candidates.length===1&&(
    (candidates[0].kind==="check"&&
      candidates[0].status==="completed"&&candidates[0].conclusion==="success")||
    (candidates[0].kind==="status"&&candidates[0].status==="success")
  );
  const appCheckNotProven=requirement.integration_id!==null;
  return {
    name,required_from:[...requirement.origins].sort(),
    app_binding_present:appCheckNotProven,
    observed_rows:candidates.length,
    check_run_or_status_success:genuineSuccess,
    app_identity_verified:false,
    result:!candidates.length?"MISSING":
      candidates.length!==1?"AMBIGUOUS_DUPLICATES":
      !genuineSuccess?"NOT_SUCCESS":"OBSERVED_SUCCESS_NOT_AUTHENTICATED"
  };
}
function combineRequirements(inputs){
  const merged=new Map();
  for(const item of inputs){
    let entry=merged.get(item.context);
    if(!entry){
      entry={origins:new Set(),integration_id:null,appIds:new Set()};
      merged.set(item.context,entry);
    }
    entry.origins.add(item.kind);
    if(item.integration_id!==null)entry.appIds.add(item.integration_id);
  }
  if(merged.size>MAX_REQUIRED)throw Error("Too many required contexts");
  return [...merged].sort(([a],[b])=>a.localeCompare(b)).map(([name,entry])=>({
    name,origins:entry.origins,
    integration_id:entry.appIds.size?[...entry.appIds][0]:null,
    conflicting_app_ids:entry.appIds.size>1
  }));
}

/** Only a fresh R43 second observation can request this separate policy read. */
export async function inspectRequiredCheckPolicy(second,{
  fetcher=fetch,clock=()=>new Date()
}={}){
  const at=clock();
  if(!(at instanceof Date)||!Number.isFinite(at.getTime()))
    return held("INVALID_CLOCK");
  const repo=second?.repository,parts=typeof repo==="string"?repo.split("/"):[];
  const branch=second?.observed_base_branch;
  const inspected=Date.parse(second?.reobserved_at||"");
  const age=at.getTime()-inspected;
  if(second?.kind!=="PHI_GMED_SECOND_OPINION_V1"||
     second?.state!=="SECOND_OBSERVATION_GMED_AGREEMENT"||
     second?.matching_github_evidence!==true||
     second?.github_observed_state!=="GMED"||
     !SHA.test(second?.github_observed_merge_sha||"")||
     second.imported_sha!==second.github_observed_merge_sha||
     !Array.isArray(second.observed_signals)||
     second.observed_signals.length>1000||
     second.observed_signals.length!==second.github_observed_signal_count||
     parts.length!==2||parts[0].toLowerCase()!==OWNER||
     !REPO.test(parts[1])||parts[1]==="."||parts[1]===".."||
     !goodBranch(branch)||
     !Number.isSafeInteger(second.pr_number)||second.pr_number<1||
     !Number.isFinite(age)||age< -300000||age>15*60000)
    return held("FRESH_GMED_REOBSERVATION_REQUIRED");

  const metadata={
    repository:repo,base_branch:branch,pr_number:second.pr_number,
    observed_merge_sha:second.github_observed_merge_sha,
    reobserved_at:second.reobserved_at,
    policy_checked_at:at.toISOString()
  };
  const path="/repos/"+encodeURIComponent(parts[0])+"/"+encodeURIComponent(parts[1]);
  try{
    const [rules,classic]=await Promise.all([
      rulesForBranch(path,branch,fetcher),
      publicGet(path+"/branches/"+encodeURIComponent(branch)+
        "/protection/required_status_checks",fetcher,{allowError:true})
    ]);
    const info=ruleContexts(rules);
    const classicRequirements=classic.status===200?classicContexts(classic.value):[];
    const required=combineRequirements([
      ...info.requirements,...classicRequirements
    ]);
    const contextChecks=required.map(x=>checkContext(x.name,second.observed_signals,x));
    // An integration ID is an app-source restriction; the normalized GMED
    // reports do NOT contain independently checked app provenance.
    const missing=contextChecks.filter(x=>x.result==="MISSING").map(x=>x.name);
    const notSuccessful=contextChecks.filter(x=>x.result!=="MISSING"&&
      !x.check_run_or_status_success).map(x=>x.name);
    const appUnverified=contextChecks.filter(x=>x.app_binding_present).map(x=>x.name);
    const conflicts=required.filter(x=>x.conflicting_app_ids).map(x=>x.name);
    const coverage=classic.status===200?"BOTH_ENDPOINTS_READ":
      classic.status===403?"CLASSIC_PROTECTION_DENIED":
      "CLASSIC_PROTECTION_NOT_EXPOSED";
    const condition=required.length===0?"NO_REQUIRED_CONTEXTS_DISCLOSED":
      missing.length||notSuccessful.length?"REQUIRED_CONTEXTS_NOT_SUCCESSFUL":
      coverage!=="BOTH_ENDPOINTS_READ"?"POLICY_COVERAGE_INCOMPLETE":
      appUnverified.length||conflicts.length?"APP_SOURCE_UNVERIFIED":
      info.unsupported.length?"OTHER_MERGE_GATES_NOT_EVALUATED":
      "DECLARED_CONTEXTS_OBSERVED_SUCCESS";
    return held(condition,{
      ...metadata,policy_coverage:coverage,protection_access:
        classic.status===200?"READ":classic.status===403?"DENIED":"NOT_EXPOSED",
      rule_count:rules.length,active_rule_types:info.types,
      required_contexts:required.map(x=>x.name),
      context_checks:contextChecks,missing_contexts:missing,
      not_successful_contexts:notSuccessful,
      app_source_unverified_contexts:appUnverified,
      conflicting_source_constraints:conflicts,
      unsupported_merge_rules:info.unsupported,
      observed_contexts_with_success:contextChecks.filter(x=>
        x.check_run_or_status_success).length,
      status_checks_only_match:
        required.length>0&&missing.length===0&&notSuccessful.length===0,
      // Even full policy reads cannot authenticate the imported receipt or
      // independently attest required job executions, app IDs or deployment.
      all_required_checks_verified:false,merge_authorized:false
    });
  }catch(error){
    return held("POLICY_OBSERVATION_UNAVAILABLE",{
      ...metadata,
      error:error instanceof Error?error.message.slice(0,240):
        "GitHub branch policy read failed"
    });
  }
}
