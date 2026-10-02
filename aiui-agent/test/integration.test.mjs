import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { Conversation, createTransport } from '../lib/gateway.js';
import { Codex } from '../../src/codex.mjs';
import { Engine } from '../../src/engine.mjs';
import { serve } from '../../src/server.mjs';
import { fixture, mockCodex, delay } from '../../test/helpers.mjs';

test('AIUI wx adapter → unchanged HTTPS gateway → mock app-server, three turns, bounded history and reconnect', async t => {
  const f=fixture(), mock=await mockCodex(), codex=new Codex({port:mock.port,attach:true});
  const engine=new Engine(f.config,codex);let servers,client;
  t.after(async()=>{client?.close();engine.close();await servers?.close();await codex.close();await mock.close();f.cleanup()});
  await codex.start();await engine.recover();servers=await serve(f.config,engine);
  // This shim trusts the test CA. It does NOT claim AIUI can trust a private CA on RV101.
  const wx={request(o){
    const url=new URL(o.url);
    const req=https.request({hostname:'127.0.0.1',port:url.port,path:url.pathname,method:o.method,
      servername:'localhost',ca:fs.readFileSync(f.config.certFile),headers:o.header},res=>{
      const parts=[];res.on('data',p=>parts.push(p));res.on('end',()=>{o.success({statusCode:res.statusCode,data:JSON.parse(Buffer.concat(parts))});o.complete()});
    });req.on('error',()=>{o.fail({errMsg:'network'});o.complete()});
    req.end(o.data ? JSON.stringify(o.data):undefined);return{abort:()=>req.destroy()};
  }};
  const config={origin:`https://localhost:${servers.server.address().port}`,token:fs.readFileSync(f.config.tokenFile,'utf8')};
  const db=new Map(), storage={get:k=>db.get(k),set:(k,v)=>db.set(k,structuredClone(v))};
  const build=()=>new Conversation({config,transport:createTransport(wx,config),storage,id:randomUUID,render:()=>{},schedule:()=>1,unschedule:()=>{}});
  client=build();await client.open();const id=client.saved.sessionId;
  await client.submit('Read README');const first=engine.get(id).threadId;
  mock.finish(first,'README answer');await delay(10);await client.refresh();client.close();
  client=build();await client.open();await client.submit('Now find TODO');mock.finish(first,'TODO answer');await delay(10);await client.refresh();
  await client.submit('Third follow-up');mock.finish(first,'Third answer');await delay(10);await client.refresh();
  assert.equal(client.history.exchanges.length,3);assert.equal(new Set(client.history.exchanges.map(e=>e.turnId)).size,3);
  assert.ok(client.last.timing.T5);assert.ok(client.last.timing.T6);assert.ok(client.last.timing.T7);assert.ok(client.last.timing.T8);
  assert.equal(client.saved.sessionId,id);assert.equal(client.last.text,'Third answer');assert.equal(client.last.threadId,first);
  const starts=mock.calls.filter(x=>x.method==='turn/start');assert.equal(starts.length,3);assert.equal(starts[0].params.threadId,starts[1].params.threadId);
});
