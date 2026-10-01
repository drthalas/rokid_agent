import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fixture } from './helpers.mjs';
import { serve } from '../src/server.mjs';
import { Stt } from '../src/stt.mjs';
function wav() {
  const b = Buffer.alloc(64044); b.write('RIFF'); b.writeUInt32LE(b.length-8,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(16000,24); b.writeUInt32LE(32000,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(b.length-44,40); return b;
}
test('authenticated audio endpoint invokes STT without submitting a Codex turn; errors are redacted', async t => {
  const f = fixture();
  const executable = path.join(f.dir, 'fake-whisper');
  fs.writeFileSync(executable, '#!/bin/sh\nwhile [ "$1" != "-of" ]; do shift; done\nprintf "Посмотри README" > "$2.txt"\n', { mode: 0o700 });
  f.config.stt = { binary: executable, model: 'fixture' };
  const servers = await serve(f.config, {});
  t.after(async () => { await servers.close(); f.cleanup(); });
  const post = bytes => new Promise((resolve, reject) => {
    const req = https.request({ hostname:'127.0.0.1', port:servers.server.address().port, path:'/v1/stt', method:'POST', servername:'localhost',ca:fs.readFileSync(f.config.certFile),
      headers:{authorization:'Bearer '+fs.readFileSync(f.config.tokenFile,'utf8'),'content-type':'audio/wav'} }, res => {
      const parts=[];res.on('data',b=>parts.push(b));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(parts))}));
    });req.on('error',reject);req.end(bytes);
  });
  assert.equal((await post(Buffer.alloc(4))).status,400);
  const result=(await post(wav())).body;assert.equal(result.text,'Посмотри README');
  assert.ok(result.timing.T2<=result.timing.T3);assert.ok(result.timing.T3<=result.timing.T4);assert.ok(result.clock.sent>=result.timing.T4);
  assert.equal(result.timing.sttLoadMs,undefined);assert.ok(!JSON.stringify(result).includes('stderr'));
  await assert.rejects(new Stt({binary:'/missing/SECRET',model:'SECRET'}).transcribe(wav()), e => e.message === 'stt_failed' && !('stderr' in e));
});
