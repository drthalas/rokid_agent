import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import https from 'node:https';
import { RecordingStore, digest } from '../prototypes/meeting/store.mjs';
import { listenPrototype, createTransport } from '../prototypes/meeting/transport.mjs';
import { MeetingCapture } from '../prototypes/meeting/capture.mjs';
test('isolated HTTPS capture/reconnect persists only authenticated chunks, verifies TLS and closes', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ale466-https-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const config = path.join(dir, 'openssl.cnf');
  await fs.writeFile(config, '[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=IP:127.0.0.1\n');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'), '-days', '1', '-config', config], { stdio: 'ignore' });
  const key = await fs.readFile(path.join(dir, 'key.pem')), cert = await fs.readFile(path.join(dir, 'cert.pem'));
  const root = path.join(dir, 'archive'), id = randomUUID(), token = randomBytes(32).toString('hex'), other = randomBytes(32).toString('hex');
  const credentials = new Map([[token, 'owner'], [other, 'other']]);
  let store = await new RecordingStore(root).init(); let server = await listenPrototype({ store, key, cert, credentials });
  t.after(() => new Promise(r => server.close(r)));
  let origin = `https://127.0.0.1:${server.address().port}`;
  let client = createTransport({ origin, token, ca: cert });
  await assert.rejects(createTransport({ origin, token: other, ca: cert }).status(id), /not_found/);
  await assert.rejects(createTransport({ origin, token }).create(id, 'pcm16'), /self-signed/);
  await assert.rejects(createTransport({ origin, token: 'x'.repeat(32), ca: cert }).create(id, 'pcm16'), /unauthorized/);
  const callbacks = {}; const recorder = { onFrameRecorded: f => callbacks.frame = f, onStop: f => callbacks.stop = f, onError: () => {}, start: async () => {}, stop: async () => callbacks.stop() };
  let drop = true;
  const transport = { create: (...args) => client.create(...args), close: (...args) => client.close(...args), append: async (...args) => {
    const ack = await client.append(...args); if (drop) { drop = false; throw Error('lost acknowledgment'); } return ack;
  } };
  const capture = new MeetingCapture({ recorder, transport, id }); await capture.start();
  callbacks.frame({ frameBuffer: new Uint8Array(32000).fill(3).buffer }); await capture.flight;
  assert.equal(capture.state, 'paused');
  await new Promise(r => server.close(r)); store = await new RecordingStore(root).init(); server = await listenPrototype({ store, key, cert, credentials });
  origin = `https://127.0.0.1:${server.address().port}`; client = createTransport({ origin, token, ca: cert });
  await capture.resume(); capture.stop(); await new Promise(r => setTimeout(r, 20)); if (capture.flight) await capture.flight;
  assert.equal(capture.state, 'complete'); assert.equal((await client.status(id)).nextSeq, 1);
  for await (const record of store.records(id, 'owner')) assert.equal(record.sha256, digest(Buffer.alloc(32000, 3)));
  const status = await new Promise((resolve, reject) => {
    const req = https.request(origin + '/recordings/' + id, { ca: cert, headers: { authorization: token } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); req.on('error', reject); req.end();
  }); assert.equal(status, 401);
  const oversized = await new Promise((resolve, reject) => {
    const req = https.request(origin + '/recordings/' + id, { method: 'PUT', ca: cert, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end(JSON.stringify({ format: 'pcm16', padding: 'x'.repeat(100000) }));
  }); assert.equal(oversized, 413);
});
