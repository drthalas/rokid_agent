import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Codex} from '../src/codex.mjs';
import {Engine} from '../src/engine.mjs';
import {loadConfig} from '../src/config.mjs';
import {fixture,mockCodex} from './helpers.mjs';
import {serve} from '../src/server.mjs';
import {request} from './helpers.mjs';
import {classifyThread,classifyTempDir} from '../scripts/diagnostic-audit.mjs';

test('trusted local flag makes diagnostics ephemeral while production default remains durable', async t => {
  const f=fixture(), mock=await mockCodex(), codex=new Codex({port:mock.port,attach:true});
  t.after(async()=>{await codex.close();await mock.close();f.cleanup()});
  await codex.start();
  f.config.diagnosticThreadName='rokid-test ALE-464 unit-smoke';
  const diagnostic=new Engine(f.config,codex);await diagnostic.recover();
  await diagnostic.create({requestId:randomUUID()});diagnostic.close();
  assert.equal(mock.calls.find(c=>c.method==='thread/start').params.ephemeral,true);
  assert.equal(mock.calls.find(c=>c.method==='thread/name/set').params.name,f.config.diagnosticThreadName);
  delete f.config.ephemeralThreads;
  delete f.config.diagnosticThreadName;
  const production=new Engine(f.config,codex);await production.recover();
  await production.create({requestId:randomUUID()});production.close();
  assert.equal(mock.calls.filter(c=>c.method==='thread/start').at(-1).params.ephemeral,undefined);
});

test('diagnostic mode is validated only as local configuration', t => {
  const f=fixture();t.after(f.cleanup);
  const file=path.join(f.dir,'config.json');
  const load=value=>{fs.writeFileSync(file,JSON.stringify({...f.config,port:8443,adminPort:8791,codexPort:8390,ephemeralThreads:value}));return loadConfig(file)};
  assert.equal(load(true).ephemeralThreads,true);
  assert.throws(()=>load('true'),/invalid_ephemeral_threads/);
  fs.writeFileSync(file,JSON.stringify({...f.config,port:8443,adminPort:8791,codexPort:8390,diagnosticThreadName:'Jarvis production'}));
  assert.throws(()=>loadConfig(file),/invalid_diagnostic_thread_name/);
});

test('device creation cannot request ephemeral mode',async t=>{
  const f=fixture(),mock=await mockCodex(),codex=new Codex({port:mock.port,attach:true});
  const engine=new Engine(f.config,codex);await codex.start();await engine.recover();const servers=await serve(f.config,engine);
  t.after(async()=>{engine.close();await servers.close();await codex.close();await mock.close();f.cleanup()});
  const result=await request(f.config,servers.server.address().port,'/v1/sessions',{requestId:randomUUID(),ephemeral:true});
  assert.equal(result.status,400);
  assert.equal(mock.calls.filter(c=>c.method==='thread/start').length,0);
});

test('dry-run inventory requires corroboration and never labels unrelated or active chats as archive candidates',()=>{
  const cwd=path.join(fs.realpathSync(os.tmpdir()),'rokid-test-abc123');
  const base={id:randomUUID(),cwd,name:'rokid-test ALE-464 root-smoke',status:{type:'notLoaded'}};
  assert.equal(classifyThread(base).plan,'archive-candidate-review');
  assert.equal(classifyThread({...base,name:null}).plan,'hold-for-review');
  assert.equal(classifyThread({...base,status:{type:'active'}}).plan,'hold-for-review');
  assert.equal(classifyThread({...base,cwd:'/Users/example/Projects/Rikid-agent'}).plan,'hold-for-review');
  assert.equal(classifyThread({...base,cwd:'/Users/example/Projects/Rikid-agent',name:'Jarvis'}),null);
  assert.equal(classifyTempDir('rokid-test-abc123'),true);
  assert.equal(classifyTempDir('rokid-test-../other'),false);
});
