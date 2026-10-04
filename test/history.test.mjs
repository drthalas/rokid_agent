import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Codex} from '../src/codex.mjs';
import {Engine} from '../src/engine.mjs';
import {fixture,mockCodex,delay} from './helpers.mjs';
import {hydrateHistory} from '../src/history.mjs';

test('structured assistant text survives persisted gateway state and Codex resume',async t=>{
 const fixtureText=JSON.parse(fs.readFileSync(new URL('./fixtures/linear-answer.json',import.meta.url)));
 const answer=fixtureText.answer+'\n\n'+fixtureText.namesAndUrl;
 const f=fixture(),mock=await mockCodex(),codex=new Codex({port:mock.port,attach:true});let engine=new Engine(f.config,codex);
 t.after(async()=>{engine.close();await codex.close();await mock.close();f.cleanup()});
 await codex.start();await engine.recover();const s=await engine.create({requestId:randomUUID()});
 const instructions=mock.calls.find(c=>c.method==='thread/start').params.developerInstructions;
 assert.match(instructions,/one compact bullet or numbered item per line/);assert.match(instructions,/Preserve IDs, names and URLs exactly/);
 await engine.turn(s.id,{requestId:randomUUID(),text:fixtureText.question});mock.finish(s.threadId,answer);await delay(20);
 assert.equal(engine.snapshot(engine.get(s.id)).history.exchanges[0].assistant,answer);
 assert.equal(JSON.parse(fs.readFileSync(f.config.stateFile)).sessions[s.id].history[0].assistant,answer);
 engine.close();for(const event of ['notification','request','offline','reconnected'])codex.removeAllListeners(event);
 engine=new Engine(f.config,codex);await engine.recover();assert.equal(engine.snapshot(engine.get(s.id)).history.exchanges[0].assistant,answer);
});

test('gateway owns six exchanges, dedupes requests, redacts tokens and restores after restart',async t=>{
 const f=fixture(),mock=await mockCodex(),codex=new Codex({port:mock.port,attach:true});let engine=new Engine(f.config,codex);
 t.after(async()=>{engine.close();await codex.close();await mock.close();f.cleanup()});
 await codex.start();await engine.recover();const s=await engine.create({requestId:randomUUID()});
 const ids=[];
 for(let i=0;i<8;i++){
  const requestId=randomUUID();await engine.turn(s.id,{requestId,text:'question '+i});
  await engine.turn(s.id,{requestId,text:'question '+i});
  mock.finish(s.threadId,'answer '+i);await delay(10);const snap=engine.snapshot(engine.get(s.id));ids.push(snap.turnId);
  assert.equal(snap.history.threadId,s.threadId);assert.equal(snap.history.sessionId,s.id);
 }
 assert.equal(new Set(ids).size,8);assert.equal(mock.calls.filter(c=>c.method==='turn/start').length,8);
 let h=engine.snapshot(engine.get(s.id)).history.exchanges;assert.equal(h.length,6);assert.equal(h[0].user,'question 2');assert.equal(h.at(-1).assistant,'answer 7');
 const token=fs.readFileSync(f.config.adminTokenFile,'utf8').trim();await engine.turn(s.id,{requestId:randomUUID(),text:'value '+token});mock.finish(s.threadId,token);await delay(10);
 assert.ok(!JSON.stringify(engine.get(s.id).history).includes(token));
 engine.close();for(const event of ['notification','request','offline','reconnected'])codex.removeAllListeners(event);
 engine=new Engine(f.config,codex);await engine.recover();h=engine.snapshot(engine.get(s.id)).history.exchanges;
 assert.equal(h.length,6);assert.equal(h.at(-1).assistant,'[скрыто]');assert.equal(engine.get(s.id).threadId,s.threadId);
 const other=await engine.create({requestId:randomUUID()});assert.deepEqual(other.history.exchanges,[]);
 assert.equal(fs.statSync(f.config.stateFile).mode&0o077,0);
});
test('legacy same-thread history extracts text only and keeps uncertain pending request separate',()=>{
 const s={history:[{requestId:'pending-1',turnId:'',user:'uncertain question',assistant:'',completed:false}]};
 const turns=[{id:'turn-1',status:'completed',items:[{type:'userMessage',content:[{type:'text',text:'visible user'},{type:'image',url:'private-media'}]},{type:'agentMessage',phase:'commentary',text:'not final'},{type:'commandExecution',aggregatedOutput:'private tool output'},{type:'agentMessage',phase:'final_answer',text:'visible assistant'}]}];
 hydrateHistory(s,turns,[]);assert.equal(s.history.length,2);assert.equal(s.history[0].user,'visible user');assert.equal(s.history[0].assistant,'visible assistant');
 assert.equal(s.history[1].turnId,'');assert.ok(!JSON.stringify(s.history).includes('private'));
 hydrateHistory(s,turns,[]);assert.equal(s.history.length,2);
});
test('legacy gateway state backfills three Codex turns without starting new ones',async t=>{
 const f=fixture(),mock=await mockCodex(),codex=new Codex({port:mock.port,attach:true});let engine=new Engine(f.config,codex);
 t.after(async()=>{engine.close();await codex.close();await mock.close();f.cleanup()});await codex.start();await engine.recover();
 const s=await engine.create({requestId:randomUUID()});const thread=mock.threads.get(s.threadId);
 thread.turns=[1,2,3].map(n=>({id:'old-turn-'+n,status:'completed',items:[{type:'userMessage',content:[{type:'text',text:'old question '+n}]},{type:'agentMessage',phase:'final_answer',text:'old answer '+n}]}));
 delete engine.get(s.id).history;engine.save();engine.close();for(const event of ['notification','request','offline','reconnected'])codex.removeAllListeners(event);
 engine=new Engine(f.config,codex);await engine.recover();const h=engine.snapshot(engine.get(s.id)).history;
 assert.equal(h.exchanges.length,3);assert.equal(h.exchanges[2].user,'old question 3');assert.equal(h.exchanges[2].assistant,'old answer 3');assert.equal(h.threadId,s.threadId);
 assert.equal(mock.calls.filter(c=>c.method==='turn/start').length,0);
});

test('approval outcomes survive failed/interrupted completion, next turn and hydration',async()=>{
 const {startExchange,updateExchange}=await import('../src/history.mjs');
 for(const status of ['failed','interrupted']){
  const s={history:[],status:'Working',turnId:'turn-1',text:'',approvalNotice:'unsupported',error:null};startExchange(s,'request-1','request',[]);updateExchange(s,[]);
  s.status='Error';s.error='turn_'+status;updateExchange(s,[]);
  assert.equal(s.history[0].completed,false);assert.ok(s.history[0].assistant.includes('Действие не выполнено'));assert.equal(s.history[0].approvalNotice,'unsupported');
  s.approvalNotice=null;startExchange(s,'request-2','next',[]);
  hydrateHistory(s,[{id:'turn-1',status,items:[]}],[]);
  assert.ok(s.history.find(e=>e.turnId==='turn-1').assistant.includes('Действие не выполнено'));
 }
});
test('denial plus final response survives hydration without duplicate; empty Done is never blank',async()=>{
 const {startExchange,updateExchange}=await import('../src/history.mjs');
 const s={history:[],status:'Working',turnId:'turn-1',text:'',approvalNotice:'declined'};startExchange(s,'request-1','request',[]);updateExchange(s,[]);s.status='Done';s.text='Safe final';updateExchange(s,[]);
 hydrateHistory(s,[{id:'turn-1',status:'completed',items:[{type:'agentMessage',phase:'final_answer',text:'Safe final'}]}],[]);
 assert.ok(s.history[0].assistant.includes('Разрешение отклонено'));assert.equal(s.history[0].assistant.match(/Safe final/g).length,1);
 const empty={history:[],status:'Working',turnId:'empty',text:''};startExchange(empty,'request-empty','question',[]);updateExchange(empty,[]);empty.status='Done';updateExchange(empty,[]);
 assert.ok(empty.history[0].assistant.length>0);assert.equal(empty.history[0].outcome,'no_answer');
});
