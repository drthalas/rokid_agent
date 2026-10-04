import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Latency} from '../lib/latency.js';
import {timingSample} from '../../src/diagnostics.mjs';
test('timing collector is bounded/content-free, clock-aware and best-effort',async()=>{
 let now=1000;const writes=[],posts=[];
 const d=new Latency({storage:{set:(k,v)=>writes.push(structuredClone(v))},transport:{request:async(m,r,v)=>{posts.push({...v});throw Error('offline')}},id:randomUUID,now:()=>now});
 d.clock({clock:{received:1500,sent:1510},_startedAt:900,_receivedAt:1000});
 for(let i=0;i<15;i++){d.begin();now+=650;d.mark('T1');d.correlate({sessionId:randomUUID(),threadId:randomUUID(),turnId:randomUUID(),requestId:randomUUID(),token:'secret'});
 d.server({timing:{T2:1800,T3:1801,T4:2000,text:'not copied'},clock:{received:1700,sent:2000},_startedAt:1600,_receivedAt:1950});d.mark('T9');d.mark('T10');d.finish();}
 await Promise.resolve();assert.equal(d.rows.length,12);assert.ok(posts.every(p=>!JSON.stringify(p).includes('secret')));
 assert.ok(posts.every(p=>timingSample(p)));assert.ok(d.sample.clockUncertaintyMs>=0);
});


test('local error diagnostics are precise without a capture and omit payloads and unvalidated fields',async()=>{
 const writes=new Map(),posts=[],sid=randomUUID(),rid=randomUUID();
 const d=new Latency({storage:{set:(k,v)=>writes.set(k,structuredClone(v))},transport:{request:async(m,r,v)=>posts.push(v)},id:randomUUID,now:()=>123});
 d.error('invalid_snapshot',{stage:'refresh',check:'snapshot_status',sessionId:sid,requestId:rid,threadId:'secret',text:'private text',token:'secret'});
 assert.deepEqual(writes.get('mac-codex-last-error'),{code:'invalid_snapshot',at:123,stage:'refresh',check:'snapshot_status',sessionId:sid,requestId:rid});
 assert.equal(posts.length,0);
 d.begin();d.correlate({turnId:randomUUID()});d.error('invalid_response',{stage:'turn_ack',check:'response_json',turnId:undefined,requestId:rid});
 assert.equal(writes.get('mac-codex-last-error').turnId,undefined);assert.equal(writes.get('mac-codex-last-error').captureId,d.sample.captureId);
 assert.equal(posts.at(-1).reason,'invalid_response');assert.ok(timingSample(posts.at(-1)));assert.ok(!('check' in posts.at(-1)));
 d.error('private native exception',{stage:'secret',check:'secret',url:'https://private.invalid'});
 assert.equal(writes.get('mac-codex-last-error').code,'client_error');assert.ok(!JSON.stringify([...writes]).includes('secret'));
 d.error('turn_failed');assert.equal(posts.at(-1).reason,'client_error');assert.ok(timingSample(posts.at(-1)));
});
