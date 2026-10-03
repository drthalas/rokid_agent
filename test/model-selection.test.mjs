import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Codex } from '../src/codex.mjs';
import { Engine } from '../src/engine.mjs';
import { loadConfig } from '../src/config.mjs';
import { smokeModel } from '../scripts/smoke-model.mjs';
import { fixture, mockCodex, delay } from './helpers.mjs';

test('smoke uses explicit runtime model, override wins, missing/empty selection fails before inference', t => {
  const f = fixture(); t.after(f.cleanup);
  const file = path.join(f.dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify({ model: 'gpt-6-astra' }));
  assert.equal(smokeModel({ configFile: file }), 'gpt-6-astra');
  assert.equal(smokeModel({ model: 'unsupported-model', configFile: 'missing-file' }), 'unsupported-model');
  for (const model of ['', ' ', 1, null]) {
    fs.writeFileSync(file, JSON.stringify({ model }));
    assert.throws(() => smokeModel({ configFile: file }), /smoke_model_required/);
  }
  fs.writeFileSync(file, '{}');
  assert.throws(() => smokeModel({ configFile: file }), /smoke_model_required/);
  assert.throws(() => smokeModel({ model: '', configFile: file }), /smoke_model_required/);
});

test('gateway config retains optional inheritance but rejects malformed explicit model', t => {
  const f = fixture(); t.after(f.cleanup);
  const file = path.join(f.dir, 'config.json');
  const config = { ...f.config, port: 8443, adminPort: 8791, codexPort: 8390 };
  fs.writeFileSync(file, JSON.stringify(config));
  assert.equal(loadConfig(file).model, undefined);
  for (const model of ['', ' ', null, 42]) {
    fs.writeFileSync(file, JSON.stringify({ ...config, model }));
    assert.throws(() => loadConfig(file), /invalid_model/);
  }
  fs.writeFileSync(file, JSON.stringify({ ...config, model: 'unsupported-model' }));
  assert.equal(loadConfig(file).model, 'unsupported-model');
});

test('configured model pins creation, turns, recovery and imported threads; provider failure never falls back', async t => {
  const f = fixture(), mock = await mockCodex();
  f.config.model = 'gpt-6-astra';
  const codex = new Codex({ port: mock.port, attach: true });
  const engine = new Engine(f.config, codex);
  t.after(async () => { engine.close(); await codex.close(); await mock.close(); f.cleanup(); });
  await codex.start(); await engine.recover();
  const s = await engine.create({ requestId: randomUUID() });
  await engine.turn(s.id, { requestId: randomUUID(), text: 'safe fixture request' });
  mock.finish(s.threadId); await delay(20);
  await engine.recover();
  const external = await codex.request('thread/start', { cwd: f.dir, model: 'old-model' });
  await engine.importThread({ project: 'demo', threadId: external.thread.id });
  for (const call of mock.calls.filter(m => ['thread/start', 'thread/resume', 'turn/start'].includes(m.method) && m.params.model !== 'old-model')) {
    assert.equal(call.params.model, 'gpt-6-astra', call.method);
  }
  f.config.model = 'unsupported-model';
  await engine.turn(s.id, { requestId: randomUUID(), text: 'provider failure fixture' });
  mock.finish(s.threadId, '', 'failed'); await delay(20);
  assert.equal(engine.get(s.id).status, 'Error');
  assert.equal(engine.get(s.id).error, 'turn_failed');
  const turns = mock.calls.filter(m => m.method === 'turn/start');
  assert.equal(turns.length, 2);
  assert.equal(turns[1].params.model, 'unsupported-model');
});
