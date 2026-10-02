import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Fault, requireValue, object } from './protocol.mjs';
import { Diagnostics } from './diagnostics.mjs';
import { Stt, MAX_AUDIO } from './stt.mjs';

function authorized(req, token) {
  const expected = Buffer.from(`Bearer ${token}`), actual = Buffer.from(req.headers.authorization ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function body(req, limit, json = true) {
  let size = 0; const parts = [];
  for await (const chunk of req) { size += chunk.length; requireValue(size <= limit, 'body_too_large', 413); parts.push(chunk); }
  const b = Buffer.concat(parts);
  if (!json) return b;
  requireValue(req.headers['content-type']?.split(';')[0] === 'application/json', 'json_required', 415);
  try { return JSON.parse(b.toString('utf8')); } catch { throw new Fault('invalid_json'); }
}
export async function serve(config, engine) {
  const token = fs.readFileSync(config.tokenFile, 'utf8').trim(), adminToken = fs.readFileSync(config.adminTokenFile, 'utf8').trim();
  requireValue(token.length >= 43 && adminToken.length >= 43 && token !== adminToken, 'invalid_tokens');
  const stt = new Stt(config.stt);
  const diagnostics = new Diagnostics(config.stateFile + '.latency.json');
  let inflight = 0;
  const handler = admin => async (req, res) => {
    const received = Date.now();
    const reply = (status, data) => { if (status === 200 && !Array.isArray(data)) data = { ...data, clock: { received, sent: Date.now() } }; res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(data)); };
    if (!authorized(req, admin ? adminToken : token)) { reply(401, { error: 'unauthorized' }); req.resume(); return; }
    if (req.headers.origin) { reply(403, { error: 'browser_origin_forbidden' }); req.resume(); return; }
    if (inflight >= 16) { reply(429, { error: 'busy' }); req.resume(); return; }
    inflight++;
    try {
      const url = new URL(req.url, 'https://gateway.invalid'); requireValue(!url.search, 'query_not_supported');
      const p = url.pathname; let result;
      if (admin) {
        if (req.method === 'GET' && p === '/admin/tool-events') result = {events:engine.toolEvents};
        else if (req.method === 'GET' && p === '/admin/diagnostics') result = { samples: diagnostics.samples };
        else if (req.method === 'GET' && p === '/admin/approvals') result = engine.listApprovals();
        else if (req.method === 'GET' && p === '/admin/sessions') result = Object.values(engine.data.sessions).map(s => engine.snapshot(s));
        else if (req.method === 'POST' && p === '/admin/import') result = await engine.importThread(object(await body(req, 32768), ['project', 'threadId']));
        else if (req.method === 'POST' && p === '/admin/reconcile') { await engine.recover(); result = { ok: true }; }
        else if (req.method === 'POST' && /^\/admin\/approvals\/[a-f0-9-]+$/.test(p)) {
          const b = object(await body(req, 32768), ['decision']); requireValue(['accept', 'decline'].includes(b.decision), 'invalid_decision');
          result = engine.decide(p.split('/').at(-1), b.decision === 'accept');
        } else throw new Fault('not_found', 404);
      } else if (req.method === 'GET' && p === '/v1/health') {
        let loggedIn = false;
        if (engine.codex.ready) { const account = await engine.codex.request('account/read', { refreshToken: false }); loggedIn = !!account.account; }
        result = { protocol: 1, codex: engine.codex.ready && engine.recovered, loggedIn, stt: !!config.stt?.model };
      } else if (req.method === 'GET' && p === '/v1/projects') result = { projects: Object.keys(config.projects), defaultProject: config.defaultProject };
      else if (req.method === 'POST' && p === '/v1/diagnostics') result = diagnostics.add(await body(req, 4096));
      else if (req.method === 'POST' && p === '/v1/stt') {
        requireValue(req.headers['content-type'] === 'audio/wav', 'wav_required', 415);
        const audio = await body(req, MAX_AUDIO, false), T2 = Date.now();
        result = await stt.transcribe(audio); result.timing.T2 = T2;
      } else if (req.method === 'POST' && p === '/v1/sessions') result = await engine.create(object(await body(req, 32768), ['requestId', 'project']));
      else {
        const match = /^\/v1\/sessions\/([a-f0-9-]{36})(?:\/(turns|stop))?$/.exec(p);
        requireValue(match, 'not_found', 404);
        if (req.method === 'GET' && !match[2]) result = engine.snapshot(engine.get(match[1]));
        else if (req.method === 'POST' && match[2] === 'turns') result = await engine.turn(match[1], object(await body(req, 32768), ['requestId', 'text']));
        else if (req.method === 'POST' && match[2] === 'stop') { object(await body(req, 32768), []); result = await engine.stop(match[1]); }
        else throw new Fault('not_found', 404);
      }
      reply(200, result);
    } catch (e) { if (!res.headersSent) reply(e instanceof Fault ? e.status : 500, { error: e instanceof Fault ? e.code : 'internal_error' }); }
    finally { inflight--; }
  };
  const server = https.createServer({ cert: fs.readFileSync(config.certFile), key: fs.readFileSync(config.keyFile), minVersion: 'TLSv1.2' }, handler(false));
  const admin = http.createServer(handler(true));
  for (const s of [server, admin]) { s.requestTimeout = 100000; s.headersTimeout = 10000; s.maxHeadersCount = 30; }
  const listen = (s, port, host) => new Promise((resolve, reject) => { s.once('error', reject); s.listen(port, host, resolve); });
  try { await listen(admin, config.adminPort, '127.0.0.1'); await listen(server, config.port, config.host); }
  catch (e) { server.close(); admin.close(); throw e; }
  return { server, admin, close: async () => { await Promise.all([server, admin].map(s => new Promise(r => { s.close(r); s.closeAllConnections(); }))); } };
}
