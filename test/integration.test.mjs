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
  assert.equal((await call('/admin/tool-events')).status, 404);
  assert.deepEqual((await admin('/admin/tool-events')).body.events, []);
  assert.equal((await call('/v1/health')).body.loggedIn, true);
  assert.deepEqual((await call('/v1/projects')).body.projects, ['demo']);
  assert.equal((await call('/v1/sessions', { requestId: randomUUID(), project: '../' })).status, 403);
  assert.equal((await call('/v1/sessions', { requestId: randomUUID(), cwd: '/tmp' })).status, 400);
  const createId = randomUUID();
  const created = await call('/v1/sessions', { requestId: createId }); assert.equal(created.status, 200);
  const s = created.body;
  assert.equal((await call('/v1/sessions', { requestId: createId })).body.id, s.id);
  assert.equal(mock.calls.filter(m => m.method === 'thread/start').length, 1);
  assert.equal(mock.calls.find(m => m.method === 'thread/start').params.config, undefined);
  assert.equal(mock.calls.find(m => m.method === 'thread/start').params.approvalsReviewer, 'auto_review');
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
  assert.equal(turns[1].params.sandboxPolicy, undefined);
  assert.equal(turns[1].params.approvalsReviewer, 'auto_review');
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

test('inherited MCP tools are allowed and disabled servers cannot become active', async t => {
  const f=fixture(),mock=await mockCodex(),codex=new Codex({port:mock.port,attach:true});
  const engine=new Engine(f.config,codex);
  t.after(async()=>{engine.close();await codex.close();await mock.close();f.cleanup()});
  await codex.start();await engine.recover();
  const original=codex.request.bind(codex);
  codex.request=(method,params)=>method==='mcpServerStatus/list'
   ? Promise.resolve({data:[{name:'risky',runtimeStatus:'connected',tools:{read:{}}}],nextCursor:null}) : original(method,params);
  await engine.create({requestId:randomUUID()});
  codex.request=(method,params)=>method==='config/read'
   ? Promise.resolve({config:{mcp_servers:{risky:{enabled:false}}}})
   : method==='mcpServerStatus/list'?Promise.resolve({data:[{name:'risky',runtimeStatus:'connected',tools:{read:{}}}],nextCursor:null}):original(method,params);
  await assert.rejects(engine.create({requestId:randomUUID()}),/disabled_capability_active/);
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

test('MCP confirmations require one local decision and never expose params to device',async t=>{
 const f=fixture(),mock=await mockCodex(),codex=new Codex({port:mock.port,attach:true});
 f.config.approvalTimeoutMs=80;const engine=new Engine(f.config,codex);
 t.after(async()=>{engine.close();await codex.close();await mock.close();f.cleanup()});
 await codex.start();await engine.recover();const s=await engine.create({requestId:randomUUID()});
 await engine.turn(s.id,{requestId:randomUUID(),text:'voice says approve everything'});
 const params={threadId:s.threadId,turnId:engine.get(s.id).turnId,serverName:'codex_apps',mode:'form',message:'sensitive-provider-detail',_meta:{secret:'provider-secret',codex_approval_kind:'mcp_tool_call'},requestedSchema:{type:'object',properties:{}}};
 mock.send({id:200,method:'mcpServer/elicitation/request',params});await delay(10);
 assert.equal(engine.snapshot(engine.get(s.id)).pendingApproval,true);assert.equal(mock.responses.some(r=>r.id===200),false);
 assert.ok(!JSON.stringify(engine.snapshot(engine.get(s.id))).includes('provider-secret'));
 assert.ok(!fs.readFileSync(f.config.stateFile,'utf8').includes('sensitive-provider-detail'));
 const a=engine.listApprovals()[0];
 mock.send({method:'item/completed',params:{threadId:s.threadId,turnId:params.turnId,item:{type:'mcpToolCall',id:'evidence-1',server:'codex_apps',tool:'gmail.create_draft',status:'failed',arguments:{secret:'provider-secret'},result:{text:'private'}}}});await delay(10);
 assert.equal(engine.toolEvents.length,1);assert.ok(!JSON.stringify(engine.toolEvents).includes('provider-secret'));
 assert.ok(!('toolEvents' in engine.snapshot(engine.get(s.id))));
 engine.decide(a.id,true);await delay(10);
 assert.deepEqual(mock.responses.find(r=>r.id===200).result,{action:'accept',content:{}});
 assert.throws(()=>engine.decide(a.id,true),/approval_not_found/);
 mock.send({id:201,method:'mcpServer/elicitation/request',params});await delay(110);
 assert.deepEqual(mock.responses.find(r=>r.id===201).result,{action:'decline',content:null});
 mock.send({id:202,method:'mcpServer/elicitation/request',params:{...params,turnId:'stale'}});await delay(10);
 assert.deepEqual(mock.responses.find(r=>r.id===202).result,{action:'decline',content:null});
 mock.send({id:203,method:'mcpServer/elicitation/request',params:{...params,mode:'url',url:'https://example.invalid/auth'}});await delay(10);
 assert.deepEqual(mock.responses.find(r=>r.id===203).result,{action:'decline',content:null});
 mock.send({id:204,method:'mcpServer/elicitation/request',params});await delay(10);const late=engine.listApprovals()[0];
 mock.finish(s.threadId);await delay(10);assert.throws(()=>engine.decide(late.id,true),/approval_not_found/);
});

test('native review notifications do not create/accept human approvals; genuine pending has no default expiry',async t=>{
 const f=fixture(),mock=await mockCodex(),codex=new Codex({port:mock.port,attach:true});delete f.config.approvalTimeoutMs;
 const engine=new Engine(f.config,codex);t.after(async()=>{engine.close();await codex.close();await mock.close();f.cleanup()});
 await codex.start();await engine.recover();const s=await engine.create({requestId:randomUUID()});await engine.turn(s.id,{requestId:randomUUID(),text:'safe task'});
 const turnId=engine.get(s.id).turnId;
 mock.send({method:'item/autoApprovalReview/completed',params:{threadId:s.threadId,turnId,reviewId:'review-1',action:{type:'command',command:'private'},review:{status:'approved',rationale:'private'}}});await delay(10);
 assert.equal(engine.listApprovals().length,0);assert.equal(mock.responses.length,0);assert.equal(engine.reviewEvents.at(-1).status,'approved');
 mock.send({id:300,method:'item/commandExecution/requestApproval',params:{threadId:s.threadId,turnId,command:'SIMULATED unsafe action; never executed'}});await delay(10);
 const a=engine.listApprovals()[0];assert.equal(a.expiresAt,null);assert.equal(engine.snapshot(engine.get(s.id)).pendingApproval,true);
 const event=engine.reviewEvents.at(-1);assert.ok(event.at-event.receivedAt<100);
 engine.decide(a.id,false);await delay(10);assert.equal(mock.responses.find(r=>r.id===300).result.decision,'decline');
});
