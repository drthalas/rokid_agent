import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Codex } from '../src/codex.mjs';
import { Engine } from '../src/engine.mjs';
import { policy } from '../src/protocol.mjs';
import { serve } from '../src/server.mjs';
import { fixture, request, delay } from '../test/helpers.mjs';
import { smokeModel } from './smoke-model.mjs';
const model = smokeModel();
console.log(`smoke_model=${model}`);
const f = fixture();
f.config.model = model;
const marker = 'ROKID_' + randomUUID().slice(0, 8);
fs.writeFileSync(path.join(f.dir, 'README.md'), `# ${marker}\nInteractive Rokid voice terminal for local Codex on Mac.\n`);
fs.writeFileSync(path.join(f.dir, 'work.txt'), 'TODO: verify glasses microphone\nTODO: verify reconnect\n');
let codex = new Codex({ port: Number(process.env.ROKID_SMOKE_PORT ?? 18390) });
let engine = new Engine(f.config, codex); let servers;
try {
  await codex.start(); await engine.recover(); servers = await serve(f.config, engine);
  const call = (route, body) => request(f.config, servers.server.address().port, route, body);
  const health = await call('/v1/health'); if (!health.body.loggedIn) throw new Error('codex_not_logged_in');
  const start = await call('/v1/sessions', { requestId: randomUUID() });
  if (start.status !== 200) throw new Error(start.body.error);
  const id = start.body.id, threadId = start.body.threadId;
  const responses = [];
  for (const text of ['Посмотри README текущего проекта и скажи, что это за проект. Назови его точное название.', 'А теперь найди основные TODO. Назови также проект из нашего предыдущего сообщения, не перечитывая README.']) {
    const sent = await call(`/v1/sessions/${id}/turns`, { requestId: randomUUID(), text });
    if (sent.status !== 200) throw new Error(sent.body.error);
    const deadline = Date.now() + 180000;
    let finished = false;
    while (Date.now() < deadline) {
      const { body: s } = await call(`/v1/sessions/${id}`);
      if (s.pendingApproval) { for (const a of engine.listApprovals()) engine.decide(a.id, false); }
      if (s.status === 'Error') throw new Error(s.error);
      if (s.status === 'Done') {
        if (s.threadId !== threadId || !s.text.trim()) throw new Error('missing_continuity_or_answer');
        responses.push(s.text); finished = true; break;
      }
      await delay(500);
    }
    if (!finished) throw new Error('smoke_timeout');
    console.log(`turn_${responses.length}_completed`);
    if (responses.length === 1) {
      engine.close(); await servers.close(); await codex.close();
      codex = new Codex({ port: Number(process.env.ROKID_SMOKE_PORT ?? 18390) });
      engine = new Engine(f.config, codex);
      await codex.start(); await engine.recover(); servers = await serve(f.config, engine);
      console.log('gateway_and_app_server_restarted_same_thread');
    }
  }
  if (!responses[0].includes(marker) || !responses[1].includes(marker) || !/microphone|микрофон/i.test(responses[1])) throw new Error('semantic_continuity_failed');
  const resumed = await codex.request('thread/resume', { threadId, cwd: f.config.projects.demo, ...policy, model });
  if (resumed.model !== model) throw new Error('smoke_model_mismatch');
  const read = await codex.request('thread/read', { threadId, includeTurns: true });
  console.log(JSON.stringify({ pass: true, threadId, turns: read.thread.turns.length, responses }, null, 2));
} finally { engine.close(); await servers?.close(); await codex.close(); f.cleanup(); }
