import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Codex } from '../src/codex.mjs';
import { Engine } from '../src/engine.mjs';
import { fixture, mockCodex, delay } from './helpers.mjs';

test('recovery accepts a >8 MiB history without replaying an uncertain completed turn', async t => {
  const f = fixture(), mock = await mockCodex();
  const codex = new Codex({ port: mock.port, attach: true });
  let engine = new Engine(f.config, codex);
  t.after(async () => { engine.close(); await codex.close(); await mock.close(); f.cleanup(); });
  await codex.start(); await engine.recover();
  const session = await engine.create({ requestId: randomUUID() });
  const requestId = randomUUID();
  await engine.turn(session.id, { requestId, text: 'synthetic request' });
  mock.finish(session.threadId, 'preserved final answer'); await delay(20);
  engine.close();
  for (const event of ['notification', 'request', 'offline', 'reconnected']) codex.removeAllListeners(event);
  const saved = JSON.parse(fs.readFileSync(f.config.stateFile));
  saved.sessions[session.id].status = 'Error';
  saved.sessions[session.id].error = 'resume_failed';
  saved.sessions[session.id].uncertain = true;
  fs.writeFileSync(f.config.stateFile, JSON.stringify(saved));
  const thread = mock.threads.get(session.threadId);
  thread.turns[0].items.unshift({ type: 'mcpToolCall', result: 'x'.repeat(9_974_764) });
  const bytes = Buffer.byteLength(JSON.stringify({ thread }));
  assert.ok(bytes > 8 * 1024 * 1024 && bytes < 16 * 1024 * 1024);
  engine = new Engine(f.config, codex); await engine.recover();
  const recovered = engine.get(session.id);
  assert.equal(recovered.threadId, session.threadId);
  assert.equal(recovered.turnId, saved.sessions[session.id].turnId);
  assert.equal(recovered.status, 'Done'); assert.equal(recovered.uncertain, false);
  assert.equal(recovered.text, 'preserved final answer');
  assert.equal(recovered.history.length, 1);
  assert.equal(recovered.history[0].assistant, 'preserved final answer');
  await engine.turn(session.id, { requestId, text: 'synthetic request' });
  assert.equal(mock.calls.filter(c => c.method === 'turn/start').length, 1);
  assert.ok(codex.ready);
});

test('loopback history payload remains bounded at 16 MiB', async t => {
  const mock = await mockCodex(), codex = new Codex({ port: mock.port, attach: true });
  t.after(async () => { await codex.close(); await mock.close(); });
  mock.threads.set('oversized', { id: 'oversized', turns: [], padding: 'x'.repeat(16 * 1024 * 1024) });
  await codex.start();
  await assert.rejects(codex.request('thread/read', { threadId: 'oversized', includeTurns: true }),
    error => error.code === 'codex_disconnected');
  assert.equal(codex.ready, false);
});
