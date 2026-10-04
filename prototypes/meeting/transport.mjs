import https from 'node:https';
import { timingSafeEqual } from 'node:crypto';
import { LIMITS, MeetingError, check } from './store.mjs';
export async function listenPrototype({ store, key, cert, credentials }) {
  check(credentials instanceof Map && credentials.size > 0 && [...credentials.keys()].every(k => typeof k === 'string' && k.length >= 32), 'prototype_credentials');
  let active = 0;
  const server = https.createServer({ key, cert, minVersion: 'TLSv1.2', maxHeaderSize: 8192 }, async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', connection: 'close' }); res.end(JSON.stringify(value)); };
    if (active >= 4) { reply(429, { error: 'busy' }); return; }
    active++;
    try {
      check(/^Bearer [^\s]+$/.test(req.headers.authorization ?? ''), 'unauthorized', 401);
      const token = req.headers.authorization.slice(7);
      let owner;
      for (const [candidate, identity] of credentials) if (Buffer.byteLength(token) === Buffer.byteLength(candidate) && timingSafeEqual(Buffer.from(token), Buffer.from(candidate))) owner = identity;
      check(owner, 'unauthorized', 401);
      const match = /^\/recordings\/([0-9a-f-]+)(?:\/(chunks\/(\d+)|close))?$/.exec(req.url);
      check(match, 'not_found', 404);
      const [, id, operation, seq] = match;
      if (req.method === 'GET' && !operation) { reply(200, store.status(id, owner)); return; }
      check((req.method === 'PUT' && (!operation || seq !== undefined)) || (req.method === 'POST' && operation === 'close'), 'method', 405);
      check(req.headers['content-type'] === 'application/json', 'content_type', 415);
      const chunks = []; let size = 0;
      for await (const bytes of req) { size += bytes.length; check(size <= LIMITS.body, 'body_limit', 413); chunks.push(bytes); }
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new MeetingError('invalid_json'); }
      check(body && typeof body === 'object' && !Array.isArray(body), 'invalid_body');
      const result = !operation ? await store.create(id, owner, body.format) : seq !== undefined
        ? await store.append(id, owner, Number(seq), body) : await store.close(id, owner, body);
      reply(200, result);
    } catch (e) { if (!res.destroyed) reply(e instanceof MeetingError ? e.status : 500, { error: e instanceof MeetingError ? e.message : 'storage_failed' }); }
    finally { active--; }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.timeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server;
}
export function createTransport({ origin, token, ca }) {
  const url = new URL(origin);
  check(url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'https_origin_required');
  check(typeof token === 'string' && token.length >= 32, 'prototype_credentials');
  const request = (method, route, body) => new Promise((resolve, reject) => {
    const json = body === undefined ? null : JSON.stringify(body);
    const req = https.request(new URL(route, origin), { method, ca, rejectUnauthorized: true,
      headers: { authorization: 'Bearer ' + token, ...(json ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) } : {}) } }, res => {
      const pieces = []; let size = 0;
      res.on('data', bytes => { size += bytes.length; if (size > 4096) res.destroy(new MeetingError('response_limit')); else pieces.push(bytes); });
      res.on('error', reject);
      res.on('end', () => {
        let result; try { result = JSON.parse(Buffer.concat(pieces).toString('utf8')); } catch { reject(new MeetingError('invalid_response')); return; }
        if (res.statusCode !== 200) reject(new MeetingError(result.error || 'transport_failed', res.statusCode)); else resolve(result);
      });
    });
    req.setTimeout(10000, () => req.destroy(new MeetingError('transport_timeout'))); req.on('error', reject); req.end(json);
  });
  const route = id => { check(/^[0-9a-f-]{36}$/.test(id), 'invalid_id'); return '/recordings/' + id; };
  return { create: (id, format) => request('PUT', route(id), { format }), status: id => request('GET', route(id)),
    append: (id, seq, record) => request('PUT', route(id) + '/chunks/' + seq, record),
    close: (id, closure) => request('POST', route(id) + '/close', closure) };
}
