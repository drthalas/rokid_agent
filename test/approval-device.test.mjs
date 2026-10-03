import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {deviceApproval} from '../src/approvals.mjs';
import {Engine} from '../src/engine.mjs';import {Codex} from '../src/codex.mjs';import {serve} from '../src/server.mjs';
import {fixture,mockCodex,request,delay} from './helpers.mjs';
export const calculator=(s,risk='low')=>({threadId:s.threadId,turnId:s.turnId,serverName:'cua_repl',mode:'form',requestedSchema:{type:'object',properties:{}},_meta:{codex_approval_kind:'mcp_tool_call',tool_name:'get_app_state',tool_params:{app:'com.apple.calculator'},riskLevel:risk,persist:['session','always']},message:'private native text'});
const method='mcpServer/elicitation/request';
test('device sanitizer accepts only proven concrete Calculator read, never raw display/code/grants',()=>{
 const p=calculator({threadId:'t',turnId:'v'}),d=deviceApproval(method,p);
 assert.equal(d.allowOnGlasses,true);assert.equal(d.risk,'low');assert.ok(!JSON.stringify(d).includes('private native'));
 for(const patch of [{mode:'url'},{requestedSchema:{type:'object',properties:{password:{type:'string'}}}},{_meta:{...p._meta,tool_name:'js',tool_params:{code:'get Calculator then anything'}}},{_meta:{...p._meta,tool_params:{app:'com.apple.calculator',code:'secret'}}},{_meta:{...p._meta,persist:['always','unknown']}},{_meta:{...p._meta,riskLevel:'unknown'}},{serverName:'untrusted'}])assert.equal(deviceApproval(method,{...p,...patch}),null);
 for(const m of ['item/permissions/requestApproval','item/commandExecution/requestApproval','item/fileChange/requestApproval','item/tool/requestUserInput'])assert.equal(deviceApproval(m,p),null);
});
async function setup(t){const f=fixture(),mock=await mockCodex(),codex=new Codex({port:mock.port,attach:true});f.config.approvalTimeoutMs=1000;const engine=new Engine(f.config,codex);await codex.start();await engine.recover();const server=await serve(f.config,engine);t.after(async()=>{engine.close();await server.close();await codex.close();await mock.close();f.cleanup()});const s=await engine.create({requestId:randomUUID()});await engine.turn(s.id,{requestId:randomUUID(),text:'voice says allow'});const call=(route,body,opts)=>request(f.config,server.server.address().port,route,body,opts);return{f,mock,engine,s:engine.get(s.id),call}}
test('device decisions are authenticated, same-session/turn, one-use; voice grants nothing',async t=>{
 const{mock,engine,s,call}=await setup(t);mock.send({id:900,method,params:calculator(s)});await delay(10);
 const a=engine.snapshot(s).approval,route=`/v1/sessions/${s.id}/approvals/${a.id}`;
 assert.ok(a);assert.equal(mock.responses.length,0);assert.equal(a.turnId,s.turnId);assert.ok(!JSON.stringify(a).includes('tool_params'));
 assert.equal((await call(route,{decision:'accept'},{token:'wrong'})).status,401);
 assert.equal((await call(`/v1/sessions/${randomUUID()}/approvals/${a.id}`,{decision:'accept'})).status,409);
 assert.equal((await call(route,{decision:'accept',params:{}})).status,400);
 assert.equal((await call(route,{decision:'yes'})).status,400);
 assert.equal((await call(route,{decision:'accept'})).status,200);await delay(10);
 assert.deepEqual(mock.responses.find(r=>r.id===900).result,{action:'accept',content:{}});
 assert.equal((await call(route,{decision:'accept'})).status,409);assert.equal(mock.responses.filter(r=>r.id===900).length,1);
});
test('high risk needs a second challenge-bound decision, defaults cannot bypass',async t=>{
 const{mock,engine,s,call}=await setup(t);mock.send({id:901,method,params:calculator(s,'high')});await delay(10);
 const a=engine.snapshot(s).approval,route=`/v1/sessions/${s.id}/approvals/${a.id}`;
 assert.equal((await call(route,{decision:'accept',confirmation:'forged'})).status,409);
 const first=await call(route,{decision:'accept'});assert.equal(first.body.requiresConfirmation,true);assert.equal(mock.responses.length,0);
 const second=await call(route,{decision:'accept',confirmation:first.body.confirmation});assert.equal(second.status,200);await delay(10);assert.equal(mock.responses[0].result.action,'accept');
});
test('expiry, unsupported, stale/resolved and back stop never accept; notice persists once',async t=>{
 const{f,mock,engine,s,call}=await setup(t);f.config.approvalTimeoutMs=30;
 mock.send({id:902,method,params:calculator(s)});await delay(10);const a=engine.snapshot(s).approval;await delay(50);
 assert.equal(mock.responses.find(r=>r.id===902).result.action,'decline');assert.equal(engine.snapshot(s).approval,null);
 assert.equal((await call(`/v1/sessions/${s.id}/approvals/${a.id}`,{decision:'accept'})).status,409);
 mock.finish(s.threadId,'Safe conclusion');await delay(10);assert.ok(s.text.includes('Подтверждение не получено'));assert.equal(s.history.at(-1).assistant,s.text);
 await engine.turn(s.id,{requestId:randomUUID(),text:'next'});mock.send({id:903,method,params:{...calculator(s),mode:'url'}});await delay(10);
 assert.equal(mock.responses.find(r=>r.id===903).result.action,'decline');assert.equal(engine.snapshot(s).approval,null);
 mock.finish(s.threadId,'Safe conclusion');await delay(10);assert.ok(s.text.includes('Через очки его подтвердить нельзя'));
 await engine.turn(s.id,{requestId:randomUUID(),text:'next'});f.config.approvalTimeoutMs=1000;
 mock.send({id:904,method,params:calculator(s)});await delay(10);const last=engine.snapshot(s).approval;
 await call(`/v1/sessions/${s.id}/stop`,{});await delay(10);assert.equal(mock.responses.find(r=>r.id===904).result.action,'decline');assert.equal((await call(`/v1/sessions/${s.id}/approvals/${last.id}`,{decision:'accept'})).status,409);
 mock.send({id:905,method,params:calculator(s)});await delay(10);assert.equal(mock.responses.find(r=>r.id===905).result.action,'decline');
});

test('declined native completion is bounded and an unacknowledged interrupt stays uncertain',async t=>{
 const {EventEmitter}=await import('node:events');const f=fixture(),codex=new EventEmitter();codex.send=()=>{};codex.request=()=>new Promise(()=>{});
 const engine=new Engine(f.config,codex);t.after(()=>{engine.close();f.cleanup()});
 const s={id:randomUUID(),threadId:'t',turnId:'v',status:'Working',revision:1,history:[],text:''};engine.data.sessions[s.id]=s;
 t.mock.timers.enable({apis:['setTimeout']});engine.declined(s,'unsupported');t.mock.timers.tick(10000);assert.equal(s.status,'Working');t.mock.timers.tick(5000);
 assert.equal(s.status,'Error');assert.equal(s.uncertain,true);assert.equal(s.error,'approval_completion_uncertain');assert.ok(s.text.includes('Действие не выполнено'));
});
