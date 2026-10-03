// Explicit owner authorization required: isolated Calculator controls read only, never production.
import assert from 'node:assert/strict';import net from 'node:net';import {randomUUID} from 'node:crypto';
import {Codex} from '../src/codex.mjs';import {Engine} from '../src/engine.mjs';import {serve} from '../src/server.mjs';
import {fixture,request,delay} from '../test/helpers.mjs';
if(!process.argv.includes('--calculator-read-authorized'))throw Error('explicit_calculator_read_authorization_required');
const f=fixture();delete f.config.approvalTimeoutMs;
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const codex=new Codex({port,experimentalApi:true}),engine=new Engine(f.config,codex);let server,threadId;
const rpc=codex.request.bind(codex);codex.request=(method,params)=>rpc(method,method==='thread/start'?{...params,ephemeral:true}:params);
const proof=[];
try{
 await codex.start();await engine.recover();server=await serve(f.config,engine);
 const s=await engine.create({requestId:randomUUID()});threadId=s.threadId;
 for(const decision of ['accept','decline']){
  let controls=false;
  const observe=m=>{if(m.method==='item/completed'&&m.params.threadId===threadId&&m.params.item?.type==='mcpToolCall'){
   const i=m.params.item,text=JSON.stringify(i.result??{});if(i.server==='cua_repl'&&i.status==='completed'&&/Calculator|Калькулятор/.test(text)&&/button|кнопка/.test(text))controls=true;
  }};codex.on('notification',observe);
  await engine.turn(s.id,{requestId:randomUUID(),text:'Isolated owner-authorized read-only Calculator approval test. Use only cua_repl to select Calculator with cua.getApp("Calculator") and read its initial controls. No reset needed; use a fresh variable if needed. Do not click, type, calculate, take screenshots, access clipboard, other apps/providers, shell or files. Stop on denied permission, no retry. Return only whether controls were accessible.'});
  const deadline=Date.now()+90000;let decisions=0;
  while(Date.now()<deadline){
   const snapshot=engine.snapshot(engine.get(s.id));
   if(snapshot.approval){assert.equal(snapshot.approval.kind,'computer-use');assert.equal(snapshot.approval.risk,'low');assert.equal(decisions,0,'unexpected repeated native request');
    const r=await request(f.config,server.server.address().port,`/v1/sessions/${s.id}/approvals/${snapshot.approval.id}`,{decision});assert.equal(r.status,200);decisions++;
   }
   if(!['Working','Thinking'].includes(snapshot.status))break;await delay(100);
  }
  codex.off('notification',observe);assert.equal(decisions,1);assert.equal(controls,decision==='accept');assert.ok(!engine.snapshot(engine.get(s.id)).pendingApproval);
  assert.equal(engine.get(s.id).uncertain,false);proof.push({decision,decisions,controls,status:engine.get(s.id).status,sameThread:engine.get(s.id).threadId===threadId});
 }
 await rpc('thread/unsubscribe',{threadId});console.log(JSON.stringify({pass:true,proof,ephemeral:true,unsubscribed:true}));
}finally{engine.close();await server?.close();await codex.close();f.cleanup()}
