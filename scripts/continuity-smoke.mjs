// Explicit real-account smoke against the existing gateway; never print message content.
import fs from 'node:fs';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
const c = JSON.parse(fs.readFileSync(process.env.ROKID_CONFIG ?? '.local/config.json', 'utf8'));
const token = fs.readFileSync(c.tokenFile, 'utf8').trim();
const call = (route, body) => new Promise((resolve, reject) => {
  const req = https.request({ hostname: c.host === '0.0.0.0' ? '127.0.0.1' : c.host, port: c.port,
    servername: 'rokid-mac-gateway', ca: fs.readFileSync(c.certFile), path: route, method: body ? 'POST' : 'GET',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' } }, res => {
    const parts = []; res.on('data', b => parts.push(b)); res.on('end', () => {
      try { const data = JSON.parse(Buffer.concat(parts)); res.statusCode === 200 ? resolve(data) : reject(new Error('gateway_request_failed')); }
      catch { reject(new Error('invalid_response')); }
    });
  }); req.setTimeout(40000, () => req.destroy()); req.on('error', () => reject(new Error('gateway_unreachable')));
  req.end(body ? JSON.stringify(body) : undefined);
});
try {
  const h = await call('/v1/health'); if (!h.codex || !h.loggedIn) throw new Error('backend_not_ready');
  const s = await call('/v1/sessions', { requestId: randomUUID() });
  const marker = 'CHECK_' + randomUUID().slice(0, 8), rows = [];
  const prompts = [`Запомни контрольное слово ${marker}. Ответь только этим словом. Не используй инструменты.`,
    'Какое контрольное слово я попросил запомнить? Ответь только им, без инструментов.',
    'Повтори то же контрольное слово ещё раз. Ответь только им, без инструментов.'];
  for (let i = 0; i < prompts.length; i++) {
    const started = Date.now();
    await call(`/v1/sessions/${s.id}/turns`, { requestId: randomUUID(), text: prompts[i] });
    const deadline = Date.now() + 180000;
    let done;
    while (Date.now() < deadline) {
      const v = await call(`/v1/sessions/${s.id}`);
      if (v.pendingApproval || v.status === 'Error') throw new Error('turn_not_completed');
      if (v.status === 'Done') { done = v; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    if (!done || done.id !== s.id || done.threadId !== s.threadId || !done.turnId || !done.text.includes(marker)) throw new Error('continuity_failed');
    const row = { turn: i + 1, sessionId: done.id, threadId: done.threadId, turnId: done.turnId, observedMs: Date.now() - started };
    rows.push(row); console.log(JSON.stringify(row));
  }
  if (new Set(rows.map(r => r.turnId)).size !== 3) throw new Error('turn_identity_failed');
  console.log(JSON.stringify({ continuity: 'PASS', semanticMemory: 'PASS', source: 'real_gateway_text_smoke_not_physical', turns: 3 }));
} catch (e) { console.error(['gateway_unreachable', 'backend_not_ready', 'turn_not_completed', 'continuity_failed', 'turn_identity_failed'].includes(e.message) ? e.message : 'continuity_smoke_failed'); process.exitCode = 1; }
