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
  const seen = new Set(); let turns = 0;
  const transport = { close() {}, async request(method, route, data) {
    calls.push({method,route,data});
    if (route === '/v1/health') return {codex:true,loggedIn:true};
    if (method === 'POST' && route === '/v1/sessions') {
      current ||= {id:randomUUID(), threadId:'thread-one',status:'Done',text:'',project:'demo'}; return {...current};
    }
    if (route.endsWith('/turns')) {
      if (!seen.has(data.requestId)) { turns++; seen.add(data.requestId); }
      current.status = 'Done'; current.text = `answer ${turns}`;
      if (lostAck) { lostAck=false; throw new Error('network_or_tls_error'); }
    }
    if (route === '/v1/stt') { validateWav(Buffer.from(data)); return {text:'А теперь найди TODO'}; }
    return {...current};
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
    transport:{close(){},async request(m,r){calls.push(r);return r==='/v1/health'?{codex:true,loggedIn:true}:{id,threadId:'existing',status:'Done'};}}});
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
