import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Codex } from '../src/codex.mjs';
import { Engine } from '../src/engine.mjs';
import { serve } from '../src/server.mjs';
import { fixture, mockCodex, request, delay } from './helpers.mjs';

test('HTTPS → gateway → actual mock WebSocket: continuity, safety, dedupe, recovery', async t => {
  const f = fixture(), mock = await mockCodex();
  const codex = new Codex({ port: mock.port, attach: true });
  let engine = new Engine(f.config, codex), server;
  t.after(async () => { engine.close(); await server?.close(); await codex.close(); await mock.close(); f.cleanup(); });
  await codex.start(); await engine.recover(); server = await serve(f.config, engine);
  const call = (route, body, options) => request(f.config, server.server.address().port, route, body, options);
  const admin = (route, body) => request(f.config, server.admin.address().port, route, body, { admin: true });
  assert.equal(server.admin.address().address, '127.0.0.1');
  assert.equal((await call('/v1/health', null, { token: 'wrong' })).status, 401);
  assert.equal((await call('/admin/approvals')).status, 404);
  assert.equal((await call('/v1/health')).body.loggedIn, true);
  assert.deepEqual((await call('/v1/projects')).body.projects, ['demo']);
  assert.equal((await call('/v1/sessions', { requestId: randomUUID(), project: '../' })).status, 403);
  assert.equal((await call('/v1/sessions', { requestId: randomUUID(), cwd: '/tmp' })).status, 400);
  const createId = randomUUID();
  const created = await call('/v1/sessions', { requestId: createId }); assert.equal(created.status, 200);
  const s = created.body;
  assert.equal((await call('/v1/sessions', { requestId: createId })).body.id, s.id);
  assert.equal(mock.calls.filter(m => m.method === 'thread/start').length, 1);
  assert.equal(mock.calls.find(m => m.method === 'thread/start').params.config['mcp_servers.risky.enabled'], false);
  const id = randomUUID(), route = `/v1/sessions/${s.id}`;
  const first = await call(route + '/turns', { requestId: id, text: 'Read README' }); assert.equal(first.body.status, 'Working');
  await call(route + '/turns', { requestId: id, text: 'Read README' });
  assert.equal(mock.calls.filter(m => m.method === 'turn/start').length, 1);
  assert.equal((await call(route + '/turns', { requestId: id, text: 'different' })).status, 409);
  assert.equal((await call(route + '/turns', { requestId: randomUUID(), text: 'concurrent' })).status, 409);
  mock.send({ id: 900, method: 'item/permissions/requestApproval', params: { threadId: s.threadId, permissions: { network: { enabled: true } } } });
  await delay(20); assert.deepEqual(mock.responses.find(r => r.id === 900).result.permissions, {});
  mock.send({ id: 901, method: 'item/commandExecution/requestApproval', params: { threadId: s.threadId, command: 'rm example', cwd: f.dir } });
  await delay(10); assert.equal((await call(route)).body.pendingApproval, true);
  assert.equal(mock.responses.some(r => r.id === 901), false);
  await delay(90); assert.equal(mock.responses.find(r => r.id === 901).result.decision, 'decline');
  mock.send({ id: 902, method: 'item/commandExecution/requestApproval', params: { threadId: s.threadId, command: 'echo approved', cwd: f.dir } });
  await delay(10); const approval = (await admin('/admin/approvals')).body[0];
  assert.equal((await admin('/admin/approvals/' + approval.id, { decision: 'accept' })).status, 200);
  await delay(10); assert.equal(mock.responses.find(r => r.id === 902).result.decision, 'accept');
  assert.equal((await admin('/admin/approvals/' + approval.id, { decision: 'accept' })).status, 404);
  mock.finish(s.threadId); await delay(20);
  assert.equal((await call(route)).body.text, 'final answer');
  await call(route + '/turns', { requestId: randomUUID(), text: 'Now find TODO' });
  const turns = mock.calls.filter(m => m.method === 'turn/start');
  assert.equal(turns.length, 2); assert.equal(turns[0].params.threadId, turns[1].params.threadId);
  assert.equal(turns[1].params.sandboxPolicy.type, 'readOnly');
  await call(route + '/stop', {}); await delay(10); assert.equal((await call(route)).body.error, 'turn_interrupted');
  assert.equal(fs.statSync(f.config.stateFile).mode & 0o777, 0o600);
  // Recover into a new engine, as on a daemon restart. No old prompt is replayed.
  engine.close(); codex.removeAllListeners('notification'); codex.removeAllListeners('request'); codex.removeAllListeners('offline'); codex.removeAllListeners('reconnected');
  engine = new Engine(f.config, codex); await engine.recover();
  assert.equal(engine.get(s.id).threadId, s.threadId);
  assert.equal(mock.calls.filter(m => m.method === 'turn/start').length, 2);
  assert.ok(mock.calls.some(m => m.method === 'thread/resume'));
});

test('ambiguous transport failure is durable and never resubmits prompt', async t => {
  const f = fixture(), mock = await mockCodex(), codex = new Codex({ port: mock.port, attach: true });
  const engine = new Engine(f.config, codex);
  t.after(async () => { engine.close(); await codex.close(); await mock.close(); f.cleanup(); });
  await codex.start(); await engine.recover(); const s = await engine.create({ requestId: randomUUID() });
  const request = codex.request.bind(codex);
  codex.request = async (method, params) => { if (method === 'turn/start') throw new Error('lost ACK'); return request(method, params); };
  const body = { requestId: randomUUID(), text: 'hello' };
  assert.equal((await engine.turn(s.id, body)).uncertain, true);
  assert.equal((await engine.turn(s.id, body)).error, 'turn_delivery_uncertain');
  await assert.rejects(engine.turn(s.id, { requestId: randomUUID(), text: 'again' }), /session_busy/);
  await engine.recover(); assert.equal(engine.get(s.id).uncertain, true);
});

test('MCP isolation failure prevents accepting a new session', async t => {
  const f = fixture(), mock = await mockCodex(), codex = new Codex({ port: mock.port, attach: true });
  const engine = new Engine(f.config, codex);
  t.after(async () => { engine.close(); await codex.close(); await mock.close(); f.cleanup(); });
  await codex.start(); await engine.recover();
  const request = codex.request.bind(codex);
  codex.request = (method, params) => method === 'mcpServerStatus/list'
    ? Promise.resolve({ data: [{ runtimeStatus: 'connected', tools: { dangerous: {} } }] }) : request(method, params);
  await assert.rejects(engine.create({ requestId: randomUUID() }), /mcp_isolation_failed/);
  assert.equal(Object.keys(engine.data.sessions).length, 0);
  assert.equal(mock.calls.filter(m => m.method === 'turn/start').length, 0);
});

test('socket reconnect resumes active turn, invalidates approval and consumes later completion', async t => {
  const f = fixture(), mock = await mockCodex(), codex = new Codex({ port: mock.port, attach: true });
  f.config.approvalTimeoutMs = 5000;
  const engine = new Engine(f.config, codex);
  t.after(async () => { engine.close(); await codex.close(); await mock.close(); f.cleanup(); });
  await codex.start(); await engine.recover(); const s = await engine.create({ requestId: randomUUID() });
  await engine.turn(s.id, { requestId: randomUUID(), text: 'hello' });
  mock.send({ id: 99, method: 'item/commandExecution/requestApproval', params: { threadId: s.threadId, command: 'example' } });
  await delay(20); const a = engine.listApprovals()[0]; assert.ok(a);
  const reconnected = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('reconnect timeout')), 4000); codex.once('reconnected', () => { clearTimeout(timer); resolve(); }); });
  mock.disconnect(); await reconnected; await delay(30);
  assert.throws(() => engine.decide(a.id, true), /approval_not_found/);
  assert.equal(engine.get(s.id).status, 'Working');
  mock.finish(s.threadId, 'after reconnect'); await delay(20);
  assert.equal(engine.get(s.id).text, 'after reconnect');
  assert.equal(mock.calls.filter(m => m.method === 'turn/start').length, 1);
});
