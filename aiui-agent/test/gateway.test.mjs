import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Conversation, createTransport, validConfig } from '../lib/gateway.js';
import { pcmToWav } from '../lib/wav.js';
import { validateWav } from '../../src/stt.mjs';
const config = { origin: 'https://codex.example.com', token: 'a'.repeat(43), project: 'demo' };
function fixture() {
  const db = new Map(), calls = [], views = [];
  let current = null, lostAck = false;
  const seen = new Set(), exchanges=[]; let turns = 0;
  const snapshot=()=>({...current,history:{sessionId:current.id,threadId:current.threadId,exchanges:structuredClone(exchanges.slice(-6))}});
  const transport = { close() {}, async request(method, route, data) {
    calls.push({method,route,data});
    if (route === '/v1/health') return {codex:true,loggedIn:true};
    if (method === 'POST' && route === '/v1/sessions') {
      current ||= {id:randomUUID(), threadId:'thread-one',status:'Done',uncertain:false,text:'',project:'demo'}; return snapshot();
    }
    if (route.endsWith('/turns')) {
      if (!seen.has(data.requestId)) { turns++; seen.add(data.requestId); exchanges.push({requestId:data.requestId,turnId:'turn-'+turns,user:data.text,assistant:'answer '+turns,completed:true}); }
      current.status = 'Done'; current.text = `answer ${turns}`; current.turnId = 'turn-'+turns;
      if (lostAck) { lostAck=false; throw new Error('network_or_tls_error'); }
    }
    if (route === '/v1/stt') { validateWav(Buffer.from(data)); return {text:'А теперь найди TODO'}; }
    return snapshot();
  }};
  const storage = {get:k=>db.get(k),set:(k,v)=>db.set(k,structuredClone(v))};
  const make = () => new Conversation({ config, transport, storage, id:randomUUID, render:v=>views.push(v), schedule:()=>1, unschedule:()=>{} });
  return {make,calls,views,db,transport,storage,lose:()=>lostAck=true,turns:()=>turns};
}
test('two prompts, close/reopen and lost ACK preserve session and turn identity', async()=>{
  const f=fixture(), a=f.make();await a.open();await a.submit('Посмотри README');const id=a.saved.sessionId;
  a.close(); const b=f.make();await b.open();assert.equal(b.saved.sessionId,id);
  f.lose();await b.submit('А теперь TODO');assert.ok(b.saved.pending);
  const request=b.saved.pending.body.requestId;
  await b.open();assert.equal(b.saved.pending,null);assert.equal(f.turns(),2);
  assert.equal(f.calls.filter(x=>x.route==='/v1/sessions').length,1);
  assert.equal(f.calls.filter(x=>x.route.endsWith('/turns')).at(-1).data.requestId,request);
  assert.equal(f.views.at(-1).state,'DONE');
});
test('WAV path conforms to existing gateway and only submits transcript', async()=>{
  const f=fixture(), c=f.make();await c.open();const wav=pcmToWav(new Uint8Array(6400));await c.audio(wav);
  assert.equal(f.calls.find(x=>x.route.endsWith('/turns')).data.text,'А теперь найди TODO');
  assert.throws(()=>pcmToWav(new Uint8Array(12)));assert.throws(()=>pcmToWav(new Uint8Array(960002)));
});
test('persist failure happens before sending prompt', async()=>{
  const f=fixture(), c=f.make();await c.open();f.storage.set=()=>{throw new Error('disk_full')};await c.submit('do work');
  assert.equal(f.turns(),0);assert.equal(f.views.at(-1).state,'ERROR');
});
test('configured existing session is used without creating a thread', async()=>{
  const id=randomUUID(), calls=[];
  const c=new Conversation({config:{...config,sessionId:id},id:randomUUID,storage:{get:()=>null,set:()=>{}},render:()=>{},
    transport:{close(){},async request(m,r){calls.push(r);return r==='/v1/health'?{codex:true,loggedIn:true}:{id,threadId:'existing',status:'Done',uncertain:false,history:{sessionId:id,threadId:'existing',exchanges:[]}};}}});
  await c.open();assert.deepEqual(calls,['/v1/health','/v1/sessions/'+id]);
});
test('wx request selects parsed JSON explicitly and no token enters URL', async()=>{
  let options;
  const wx={request(o){options=o;queueMicrotask(()=>{o.success({statusCode:200,data:{codex:true}});o.complete()});return{abort(){}}}};
  const t=createTransport(wx,config);assert.deepEqual(await t.request('GET','/v1/health'),{codex:true});
  assert.equal(options.responseType,'text');assert.equal(options.dataType,'json');assert.equal(options.header.authorization,'Bearer '+config.token);
  assert.equal(options.url,config.origin+'/v1/health');
  await assert.rejects(t.request('POST','/admin/approvals'),/invalid_route/);
  assert.throws(()=>validConfig({...config,origin:'http://192.168.1.66:8443'}));
  assert.throws(()=>validConfig({...config,origin:'https://user:pass@example.com'}));
});

test('30 second capture bound and cancellation prevent a late audio submission', async()=>{
  const {OneShotAudioSession}=await import('../lib/one-shot-audio.js');
  let timer,timeout,stops=0,sends=0;
  const s=new OneShotAudioSession({limits:{sampleRate:16000,channels:1,bytesPerSample:2,maxDurationMs:30000,maxBytes:960000},
    schedule:(f,ms)=>{timer=f;timeout=ms;return 1},unschedule:()=>{}});
  s.begin({requestId:randomUUID(),stopRecorder:()=>stops++});assert.equal(timeout,30000);
  s.appendFrame(new Uint8Array(640));timer();assert.equal(stops,1);assert.equal(s.phase,'stopping');
  s.cancel('hidden');assert.equal(s.recorderStopped(()=>sends++),null);assert.equal(sends,0);
});

test('cancel while STT is outstanding prevents a turn even if recognition returns late', async()=>{
 const f=fixture(),c=f.make();await c.open();let resolveStt;
 const original=f.transport.request.bind(f.transport);
 f.transport.request=(m,r,d)=>r==='/v1/stt'?new Promise(resolve=>resolveStt=resolve):original(m,r,d);
 const pending=c.audio(pcmToWav(new Uint8Array(6400)));assert.equal(c.phase,'TRANSCRIBING');
 await c.stop();resolveStt({text:'must not execute'});await pending;assert.equal(f.turns(),0);assert.equal(c.phase,'READY');
});

test('cancel while turn start ACK is pending waits for ACK, then interrupts the same session',async()=>{
 const f=fixture(),c=f.make();await c.open();let release;
 const original=f.transport.request.bind(f.transport);
 f.transport.request=async(m,r,d)=>{const answer=await original(m,r,d);if(r.endsWith('/turns'))await new Promise(resolve=>release=resolve);return answer};
 const pending=c.submit('test');await Promise.resolve();await c.stop();assert.equal(c.cancelRequested,true);release();await pending;
 assert.equal(f.calls.filter(x=>x.route.endsWith('/stop')).length,1);assert.equal(f.turns(),1);
});

test('six exchanges survive reopen/listening; replay does not duplicate; session changes isolate history',async()=>{
 const f=fixture(),c=f.make();await c.open();
 for(let i=0;i<8;i++)await c.submit('question '+i);
 assert.equal(c.history.exchanges.length,6);assert.equal(c.history.exchanges[0].user,'question 2');
 assert.equal(c.history.exchanges.at(-1).assistant,'answer 8');
 await c.refresh();assert.equal(c.history.exchanges.length,6);c.close();
 const reopened=f.make();await reopened.open();assert.equal(f.views.at(-1).state,'READY');
 assert.equal(f.views.at(-1).history.length,6);
 f.lose();await reopened.submit('lost ack question');await reopened.open();
 assert.equal(reopened.history.exchanges.filter(e=>e.user==='lost ack question').length,1);
 assert.equal(reopened.history.exchanges.at(-1).assistant,'answer 9');
 const other=new Conversation({config:{...config,sessionId:randomUUID()},transport:f.transport,storage:f.storage,id:randomUUID,render:()=>{}});
 assert.deepEqual(other.history.exchanges,[]);
});
test('history bounds/redaction and thread mismatch are enforced without creating a new session',async()=>{
 const {boundedHistory}=await import('../lib/history.js');const sid=randomUUID();
 const h=boundedHistory({sessionId:sid,threadId:'t',exchanges:[{requestId:randomUUID(),user:config.token,assistant:'Bearer abcsecret '+ 'x'.repeat(20000),completed:true}]},sid,config.token);
 assert.ok(!JSON.stringify(h).includes(config.token));assert.ok(!JSON.stringify(h).includes('abcsecret'));
 assert.equal(h.exchanges[0].assistant.length,16000);
 const f=fixture(),c=f.make();await c.open();
 assert.throws(()=>c.validateSnapshot({id:c.saved.sessionId,threadId:'different',status:'Done',uncertain:false}),/thread_mismatch/);
 assert.equal(f.calls.filter(x=>x.route==='/v1/sessions').length,1);
});

test('fresh device restores gateway history and never trusts stale local transcript cache',async()=>{
 const f=fixture(),first=f.make();await first.open();await first.submit('canonical question');const sessionId=first.saved.sessionId;first.close();
 f.db.clear();const restored=new Conversation({config:{...config,sessionId},transport:f.transport,storage:f.storage,id:randomUUID,render:v=>f.views.push(v),schedule:()=>1});
 await restored.open();assert.equal(restored.history.exchanges[0].user,'canonical question');assert.equal(restored.history.exchanges[0].assistant,'answer 1');
 assert.equal(restored.saved.history,undefined);
 const stored=f.db.get(restored.key);stored.history={sessionId,threadId:'thread-one',exchanges:[{requestId:randomUUID(),user:'invented local text',assistant:'untrusted',completed:true}]};
 restored.close();const again=f.make();await again.open();assert.equal(again.history.exchanges.length,1);assert.equal(again.history.exchanges[0].user,'canonical question');
});
test('old gateway without authoritative history fails visibly instead of silently using local history',async()=>{
 const f=fixture(),c=f.make();const request=f.transport.request.bind(f.transport);f.transport.request=async(...a)=>{const v=await request(...a);delete v.history;return v};
 await c.open();assert.equal(f.views.at(-1).detail,'gateway_history_unavailable');assert.deepEqual(c.history.exchanges,[]);
});

test('device approval lost ACK refreshes only and never persists/replays accept',async()=>{
 const f=fixture(),c=f.make();await c.open();const id=randomUUID(),turnId='approval-turn';
 const approval={id,turnId,kind:'computer-use',title:'Computer Use',action:'Просмотр окна / снимок',target:'com.apple.calculator',scope:'app',risk:'low',allowOnGlasses:true,expiresAt:Date.now()+30000};
 const original=f.transport.request;let pending=true,posts=0;
 f.transport.request=async(m,r,b)=>{if(r.includes('/approvals/')){posts++;pending=false;throw Error('network_or_tls_error')};const s=await original(m,r,b);return{...s,turnId,status:'Working',pendingApproval:pending,approval:pending?approval:null}};
 await c.refresh();assert.equal(f.views.at(-1).state,'APPROVAL');
 await assert.rejects(c.decideApproval(id,'accept'),/network/);assert.equal(posts,1);assert.equal(c.saved.pending,null);assert.equal(f.views.at(-1).state,'WORKING');
 c.close();await c.open();assert.equal(posts,1);c.close();
});

test('reopen clears stale in-flight snapshot ordering without replacing the saved session',async()=>{
 const f=fixture(),c=f.make();await c.open();const id=c.saved.sessionId;c.last={...c.last,revision:999};const original=f.transport.request;
 f.transport.request=async(...args)=>({...await original(...args),revision:1});await c.open();assert.equal(c.saved.sessionId,id);assert.equal(c.last.revision,1);assert.equal(f.views.at(-1).state,'READY');c.close();
});

test('approval countdown uses server clock despite device skew and cannot exceed native 30s',async()=>{
 const f=fixture(),c=f.make();await c.open();const sid=c.saved.sessionId;
 const original=f.transport.request.bind(f.transport);let duration=25000;
 f.transport.request=async(m,r,d)=>{const s=await original(m,r,d);if(r==='/v1/sessions/'+sid)return{...s,status:'Working',turnId:'approval-turn',pendingApproval:true,clock:{sent:100000},approval:{id:randomUUID(),turnId:'approval-turn',kind:'computer-use',title:'Computer Use',action:'Нажатие элемента',target:'com.apple.calculator',risk:'low',scope:'app',allowOnGlasses:true,expiresAt:100000+duration}};return s};
 await c.refresh();assert.equal(f.views.at(-1).approval.remainingMs,25000);duration=90000;await c.refresh();assert.equal(f.views.at(-1).approval.remainingMs,30000);c.close();
});


test('terminal ERROR tap returns READY without rereading or replaying; next turn keeps history and identity',async()=>{
 const f=fixture(),c=f.make();await c.open();await c.submit('failed request');const sid=c.saved.sessionId,thread=c.saved.threadId;
 const original=f.transport.request;let failed=true;
 f.transport.request=async(...args)=>{const s=await original(...args);if(!s.id||!failed)return s;return{...s,status:'Error',uncertain:false,error:'turn_failed',history:{...s.history,exchanges:s.history.exchanges.map(e=>({...e,completed:false,outcome:'failed',assistant:'Useful failure explanation'}))}}};
 await c.refresh();assert.equal(c.phase,'ERROR');assert.equal(f.views.at(-1).recovery,'continue');
 const count=f.calls.length;await c.recover();assert.equal(c.phase,'READY');assert.equal(f.calls.length,count);
 assert.equal(f.views.at(-1).previousError,'turn_failed');assert.equal(c.history.exchanges[0].assistant,'Useful failure explanation');
 failed=false;await c.submit('next request');assert.equal(f.turns(),2);assert.equal(c.saved.sessionId,sid);assert.equal(c.saved.threadId,thread);
 assert.equal(f.calls.filter(x=>x.route==='/v1/sessions').length,1);c.close();
});
test('uncertain interruption stays ERROR and cannot submit even after repeated recovery',async()=>{
 const f=fixture(),c=f.make();await c.open();const original=f.transport.request;
 f.transport.request=async(...args)=>{const s=await original(...args);return s.id?{...s,status:'Error',uncertain:true,error:'turn_interrupted'}:s};
 await c.refresh();assert.equal(c.phase,'ERROR');assert.equal(f.views.at(-1).ready,false);
 for(let i=0;i<2;i++){await c.recover();await c.submit('must not run');assert.equal(c.phase,'ERROR');}
 assert.equal(f.turns(),0);c.close();
});
test('malformed read invalidates old idle state; recovery waits for a valid same-session snapshot',async()=>{
 const f=fixture(),c=f.make();await c.open();const original=f.transport.request;let broken=true;
 f.transport.request=async(...args)=>{const s=await original(...args);return s.id&&broken?{...s,status:'invalid'}:s};
 await c.open();assert.equal(c.phase,'ERROR');await c.submit('must not run');assert.equal(f.turns(),0);
 await c.recover();assert.equal(c.phase,'ERROR');broken=false;await c.recover();assert.equal(c.phase,'READY');
 assert.equal(f.calls.filter(x=>x.route==='/v1/sessions').length,1);c.close();
});
test('malformed turn ACK retains its UUID across recovery and never duplicates the mutation',async()=>{
 const f=fixture(),c=f.make();await c.open();const original=f.transport.request;let broken=true;
 f.transport.request=async(m,r,d)=>{const s=await original(m,r,d);return r.endsWith('/turns')&&broken?{...s,history:null}:s};
 await c.submit('only once');const pending=structuredClone(c.saved.pending);assert.ok(pending);
 await c.recover();await c.submit('blocked');assert.deepEqual(c.saved.pending,pending);assert.equal(f.turns(),1);
 broken=false;await c.recover();assert.equal(c.saved.pending,null);assert.equal(f.turns(),1);
 assert.ok(f.calls.filter(x=>x.route.endsWith('/turns')).every(x=>x.data.requestId===pending.body.requestId));c.close();
});


test('failed poll revokes cached readiness; no STT or turn can be sent until reconciliation',async()=>{
 const f=fixture(),c=f.make();await c.open();const original=f.transport.request;
 f.transport.request=async()=>{throw Error('network_or_tls_error')};
 await assert.rejects(c.refresh(),/network/);await c.audio(pcmToWav(new Uint8Array(6400)));await c.submit('blocked');
 assert.equal(f.turns(),0);assert.equal(f.calls.filter(x=>x.route==='/v1/stt').length,0);
 f.transport.request=original;await c.recover();assert.equal(c.phase,'READY');c.close();
});
test('snapshot and history diagnostics identify the failing field and never allow continuation',async()=>{
 const cases=[['snapshot_id',s=>({...s,id:undefined})],['snapshot_thread',s=>({...s,threadId:null})],
  ['snapshot_status',s=>({...s,status:'Broken'})],['snapshot_uncertain',s=>({...s,uncertain:undefined})],
  ['history_object',s=>({...s,history:null})],['history_identity',s=>({...s,history:{...s.history,threadId:'other'}})],
  ['history_exchanges',s=>({...s,history:{...s.history,exchanges:{}}})]];
 for(const [check,damage]of cases){const f=fixture(),c=f.make();await c.open();const original=f.transport.request;
  f.transport.request=async(...args)=>{const s=await original(...args);return s.id?damage(s):s};
  await c.open();assert.equal(c.phase,'ERROR',check);assert.equal(f.views.at(-1).diagnostic.check,check);assert.equal(f.views.at(-1).diagnostic.stage,'refresh');
  await c.submit('blocked');assert.equal(f.turns(),0);c.close();
 }
});
test('transport distinguishes malformed JSON from non-object responses without retaining content',async()=>{
 for(const [data,check]of [['sensitive invalid JSON','response_json'],['null','response_object'],[[], 'response_object'],[new ArrayBuffer(4),'response_object'],[new Uint8Array(4),'response_object']]){
  const wx={request(o){queueMicrotask(()=>{o.success({statusCode:200,data});o.complete()});return{abort(){}}}};
  const transport=createTransport(wx,config);
  await assert.rejects(transport.request('POST','/v1/sessions/'+randomUUID()+'/turns',{requestId:randomUUID(),text:'private'}),e=>{
   assert.equal(e.message,'invalid_response');assert.equal(e.check,check);assert.equal(e.stage,'turn_ack');
   assert.ok(!JSON.stringify(e).includes('sensitive'));assert.ok(!JSON.stringify(e).includes('private'));return true;
  });
 }
});
test('lost ACK correlation keeps request ID before validation and reconnection never starts a replacement session',async()=>{
 const f=fixture(),c=f.make(),correlations=[];c.diagnostics={correlate:v=>correlations.push(v),server(){},clock(){}};
 await c.open();f.lose();await c.submit('only once');const pending=structuredClone(c.saved.pending);
 assert.equal(correlations.at(-1).requestId,pending.body.requestId);assert.equal(f.views.at(-1).diagnostic.requestId,pending.body.requestId);
 c.close();const reopened=f.make();await reopened.open();assert.equal(f.turns(),1);assert.equal(reopened.saved.pending,null);
 assert.equal(f.calls.filter(x=>x.route==='/v1/sessions').length,1);reopened.close();
});
test('uncertainty can only be released by a later certain snapshot; no-answer can be acknowledged',async()=>{
 const f=fixture(),c=f.make();await c.open();await c.submit('question');const original=f.transport.request;let uncertain=true;
 f.transport.request=async(...args)=>{const s=await original(...args);return s.id?{...s,status:'Error',uncertain,error:uncertain?'turn_delivery_uncertain':null,history:{...s.history,exchanges:s.history.exchanges.map(e=>({...e,outcome:uncertain?'uncertain':'no_answer',completed:false,assistant:'No final answer'}))}}:s};
 await c.refresh();assert.equal(c.phase,'ERROR');await c.recover();assert.equal(c.phase,'ERROR');assert.equal(c.canSubmit(),false);
 uncertain=false;await c.refresh();assert.equal(c.phase,'ERROR');assert.equal(f.views.at(-1).detail,'no_final_answer');
 await c.recover();assert.equal(c.phase,'READY');assert.equal(f.views.at(-1).previousError,'no_final_answer');assert.equal(f.turns(),1);c.close();
});
