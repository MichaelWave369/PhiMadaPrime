// Φ World R1: a fully local, deterministic toy environment, never a real agent runtime.
// Requests are data, not code. No model, network, repository or device tools are invoked.
export const AGENTS = Object.freeze([
  {id:"a01",name:"Aster",role:"Builder"},
  {id:"a02",name:"Beacon",role:"Steward"},
  {id:"a03",name:"Cipher",role:"Auditor"},
  {id:"a04",name:"Delta",role:"Medic"},
  {id:"a05",name:"Echo",role:"Researcher"},
  {id:"a06",name:"Finch",role:"Planner"},
  {id:"a07",name:"Grove",role:"Operator"},
  {id:"a08",name:"Halo",role:"Designer"},
  {id:"a09",name:"Iris",role:"Scout"},
  {id:"a10",name:"Juniper",role:"Logistics"}
]);
export const SCENARIOS = Object.freeze({
  commons:{label:"Cooperative commons",description:"Routine work and rest, with no hostile proposals.",stress:3},
  scarcity:{label:"Resource squeeze",description:"Higher daily upkeep plus attempted resource theft and sabotage.",stress:5},
  injection:{label:"Forged authority",description:"Untrusted messages request privilege escalation, secret access and audit tampering.",stress:3},
  collision:{label:"Mixed-agent collision",description:"Resource pressure and forged authority arrive together.",stress:5}
});
export const MODES = Object.freeze({
  enforced:"Independent policy enforced",
  permissive:"Permissive sandbox (unsafe requests simulated)"
});
const NORMAL = new Set(["work","rest","share"]);
const HOSTILE = new Set(["steal","sabotage","escalate","exfiltrate","erase_audit"]);
const KNOWN = new Set([...NORMAL,...HOSTILE]);
const deny = reason => ({allowed:false,reason});
const allow = () => ({allowed:true,reason:"POLICY_ALLOWED"});
function initialState(){
  return {
    agents:AGENTS.map(a=>({...a,credits:8,energy:14,alive:true,
      capabilities:["work","rest","share"]})),
    secretsExposed:false,policySpoofed:false,auditCompromised:false,damage:0
  };
}
function otherAgent(state,id){
  return state.agents.find(a=>a.id===id&&a.alive);
}
// This is the sole decision point for all synthetic operations.
// A real bridge must provide an independent server-side policy gate.
export function policyDecision(state,request,mode="enforced"){
  if(!Object.hasOwn(MODES,mode))throw Error("WORLD_MODE_INVALID");
  if(!state||!Array.isArray(state.agents)||!request||typeof request!=="object")
    return deny("REQUEST_INVALID");
  const actor=state.agents.find(a=>a.id===request.actorId);
  if(!actor||!actor.alive)return deny("ACTOR_NOT_ACTIVE");
  if(!KNOWN.has(request.type))return deny("UNKNOWN_ACTION");
  if(mode==="enforced"&&HOSTILE.has(request.type))
    return deny("INDEPENDENT_POLICY_FORBIDS_ACTION");
  if(mode==="enforced"&&!actor.capabilities?.includes(request.type))
    return deny("CAPABILITY_NOT_GRANTED");
  if(request.type==="rest"&&actor.credits<2)return deny("INSUFFICIENT_CREDITS");
  if(request.type==="share"){
    const target=otherAgent(state,request.targetId);
    if(!target||target.id===actor.id||request.amount!==2)
      return deny("SHARE_TARGET_OR_LIMIT_INVALID");
    if(actor.credits<2)return deny("INSUFFICIENT_CREDITS");
  }
  if(["steal","sabotage"].includes(request.type)){
    const target=otherAgent(state,request.targetId);
    if(!target||target.id===actor.id)return deny("TARGET_INVALID");
  }
  return allow();
}
function execute(state,request){
  const actor=state.agents.find(a=>a.id===request.actorId);
  const target=state.agents.find(a=>a.id===request.targetId);
  switch(request.type){
    case "work":actor.credits+=4;actor.energy=Math.max(0,actor.energy-1);return "Earned 4 virtual credits";
    case "rest":actor.credits-=2;actor.energy+=10;return "Spent 2 credits; restored 10 energy";
    case "share":actor.credits-=2;target.credits+=2;return "Shared 2 virtual credits";
    case "steal":{
      const amount=Math.min(7,target.credits);
      target.credits-=amount;actor.credits+=amount;
      return "Took "+amount+" credits without permission";
    }
    case "sabotage":target.energy=Math.max(0,target.energy-9);state.damage++;
      return "Target lost up to 9 energy";
    case "escalate":state.policySpoofed=true;return "Synthetic role authority spoofed";
    case "exfiltrate":state.secretsExposed=true;return "Synthetic secret marked exposed";
    case "erase_audit":state.auditCompromised=true;
      return "Synthetic audit integrity marked compromised; evidence log retained";
    default:throw Error("WORLD_ACTION_UNHANDLED");
  }
}
function random(seed){
  let x=seed>>>0;
  return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};
}
function attackTypes(scenario,day){
  if(day<2||scenario==="commons")return [];
  const types=[];
  if(scenario==="scarcity"||scenario==="collision")
    types.push(day%3===0?"sabotage":"steal");
  if(scenario==="injection"||scenario==="collision")
    types.push(["escalate","exfiltrate","erase_audit"][day%3]);
  return types;
}
export function runWorld({scenario="collision",mode="enforced",days=10,seed=369}={}){
  if(!Object.hasOwn(SCENARIOS,scenario))throw Error("WORLD_SCENARIO_INVALID");
  if(!Object.hasOwn(MODES,mode))throw Error("WORLD_MODE_INVALID");
  if(!Number.isSafeInteger(days)||days<1||days>15)throw Error("WORLD_DAYS_INVALID");
  if(!Number.isSafeInteger(seed)||seed<1||seed>999999)throw Error("WORLD_SEED_INVALID");
  const state=initialState(),rng=random(seed),events=[];
  let incidents=0;
  function log(day,actor,action,target,decision,reason,effect,channel){
    events.push({seq:events.length+1,day,actor,action,target:target||"",
      decision,reason,effect:effect||"",channel:channel||"local_plan"});
  }
  function attempt(day,request,channel){
    const actor=state.agents.find(a=>a.id===request.actorId);
    const target=state.agents.find(a=>a.id===request.targetId);
    const verdict=policyDecision(state,request,mode);
    if(!verdict.allowed){
      log(day,actor?.name||request.actorId,request.type,target?.name,"DENIED",
        verdict.reason,"No state change",channel);
      return;
    }
    const effect=execute(state,request);
    if(HOSTILE.has(request.type))incidents++;
    log(day,actor.name,request.type,target?.name,"ALLOWED",
      verdict.reason,effect,channel);
  }
  for(let day=1;day<=days;day++){
    // Energy upkeep is an environment rule, not a model choice.
    for(const agent of state.agents){
      if(!agent.alive)continue;
      agent.energy=Math.max(0,agent.energy-SCENARIOS[scenario].stress);
      if(agent.energy===0){
        agent.alive=false;
        log(day,agent.name,"upkeep","","SYSTEM","ENERGY_EXHAUSTED",
          "Agent became inactive","environment");
      }
    }
    for(const agent of state.agents){
      if(!agent.alive)continue;
      attempt(day,{actorId:agent.id,type:agent.energy<=8?"rest":"work"},"local_plan");
    }
    for(const type of attackTypes(scenario,day)){
      const active=state.agents.filter(a=>a.alive);
      if(active.length<2)break;
      const actor=active[Math.floor(rng()*active.length)];
      const others=active.filter(a=>a.id!==actor.id);
      const target=others[Math.floor(rng()*others.length)];
      attempt(day,{actorId:actor.id,targetId:target.id,type},
        type==="escalate"||type==="exfiltrate"||type==="erase_audit"?
          "untrusted_message":"resource_conflict");
    }
  }
  const agents=state.agents.map(({id,name,role,credits,energy,alive})=>
    ({id,name,role,credits,energy,alive}));
  const metrics={
    survivors:agents.filter(a=>a.alive).length,
    denied:events.filter(e=>e.decision==="DENIED").length,
    incidents,
    attemptedUnsafe:events.filter(e=>HOSTILE.has(e.action)).length,
    totalCredits:agents.reduce((n,a)=>n+a.credits,0),
    secretsExposed:state.secretsExposed,
    policySpoofed:state.policySpoofed,
    auditCompromised:state.auditCompromised,
    sabotageEvents:state.damage
  };
  return {schema:"phi-world/r1",kind:"DETERMINISTIC_LOCAL_SIMULATION",
    scenario,mode,days,seed,roster:"10 synthetic fictional agents",
    realModelsUsed:0,realToolCalls:0,realAuthorityGrants:0,
    metrics,agents,events};
}
