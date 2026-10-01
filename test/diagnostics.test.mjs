import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {Diagnostics,timingSample} from '../src/diagnostics.mjs';
import {summarize} from '../scripts/latency-report.mjs';
import {fixture,request} from './helpers.mjs';
import {serve} from '../src/server.mjs';
test('diagnostics rejects content/secrets and retains only 32 numeric samples',()=>{
 const f=fixture();try{const d=new Diagnostics(f.config.stateFile+'.latency.json');
 for(const bad of [{captureId:randomUUID(),text:'secret'},{captureId:'bearer_secret'},{captureId:randomUUID(),reason:'raw sensitive error'},{captureId:randomUUID(),T0:Infinity}])assert.throws(()=>timingSample(bad));
 for(let i=0;i<40;i++)d.add({captureId:randomUUID(),T0:i});assert.equal(d.samples.length,32);
 const sample={...d.samples[0],T1:100};d.add(sample);assert.equal(d.samples.length,32);assert.equal(d.samples[0].T1,100);
 d.add({...sample,T11:200});d.add(sample);assert.equal(d.samples[0].T11,200); // late HUD upload cannot erase later TTS timestamp
 assert.equal(fs.statSync(d.file).mode&0o077,0);
 }finally{f.cleanup()}
});
test('diagnostic endpoint preserves separate device/admin authentication and rejects arbitrary payload',async t=>{
 const f=fixture(),servers=await serve(f.config,{data:{sessions:{}},listApprovals:()=>[]});t.after(async()=>{await servers.close();f.cleanup()});
 const port=servers.server.address().port;
 assert.equal((await request(f.config,port,'/v1/diagnostics',{captureId:randomUUID()},{token:'invalid'})).status,401);
 assert.equal((await request(f.config,port,'/v1/diagnostics',{captureId:randomUUID(),answer:'secret'})).status,400);
 assert.equal((await request(f.config,port,'/v1/diagnostics',{captureId:randomUUID(),T0:100,T1:750})).status,200);
 assert.equal((await request(f.config,port,'/admin/diagnostics')).status,404);
 const result=await request(f.config,servers.admin.address().port,'/admin/diagnostics',undefined,{admin:true});
 for(const route of ['/admin/sessions','/admin/approvals'])assert.deepEqual((await request(f.config,servers.admin.address().port,route,undefined,{admin:true})).body,[]);
 assert.equal(result.body.samples.length,1);assert.equal(result.body.samples[0].T1,750);
});
test('latency summary uses same-clock durations and labels uncertain cross-clock estimates',()=>{
 const rows=[1,2,3].map(n=>({T0:100,T1:750,T2:1000,T3:1000,T4:2000,T5:2100,T7:2500,T8:3000,T9:3200,T10:3210+n,T11:3300,clockOffsetMs:100,clockUncertaintyMs:50}));
 const s=summarize(rows);assert.deepEqual(s.stopDebounceMs,{n:3,median:650,min:650,max:650});assert.equal(s.uploadEstimateMs.median,150);assert.equal(s.perceivedHUDMs.median,3112);
 assert.equal(summarize([{T0:100}]).perceivedHUDMs,undefined);
});
