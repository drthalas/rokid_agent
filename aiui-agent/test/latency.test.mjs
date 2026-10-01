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
