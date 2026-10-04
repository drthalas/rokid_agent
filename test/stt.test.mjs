import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fixture } from './helpers.mjs';
import { serve } from '../src/server.mjs';
import { Stt, validateWav, MAX_AUDIO } from '../src/stt.mjs';
function wav() {
  const b = Buffer.alloc(64044); b.write('RIFF'); b.writeUInt32LE(b.length-8,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(16000,24); b.writeUInt32LE(32000,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(b.length-44,40); return b;
}
test('STT keeps canonical 16 kHz mono PCM16 and maximum 30 second bounds',()=>{
 const valid=wav();assert.doesNotThrow(()=>validateWav(valid));
 for(const [offset,value] of [[20,3],[22,2],[24,44100],[34,8]]) {const bad=Buffer.from(valid);bad.writeUInt16LE(value,offset);assert.throws(()=>validateWav(bad),/invalid_wav/);}
 const max=Buffer.alloc(MAX_AUDIO);valid.copy(max,0,0,44);max.writeUInt32LE(max.length-8,4);max.writeUInt32LE(max.length-44,40);
 assert.doesNotThrow(()=>validateWav(max));assert.throws(()=>validateWav(Buffer.concat([max,Buffer.alloc(2)])),/invalid_audio_size/);
});
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

test('STT prompt is one literal argument; GPU is explicit; one job and temp cleanup survive failures', async t => {
  const f = fixture(); t.after(f.cleanup);
  const capture = path.join(f.dir, 'args.json'), executable = path.join(f.dir, 'whisper-fixture');
  fs.writeFileSync(executable, `#!${process.execPath}
const fs=require('fs');const args=process.argv.slice(2);fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(args));
const input=args[args.indexOf('-f')+1];if((fs.statSync(input).mode&0o077)!==0||(fs.statSync(require('path').dirname(input)).mode&0o077)!==0)process.exit(2);
setTimeout(()=>{if(args.includes('fail')){console.error('SECRET TRANSCRIPT');process.exit(1)}fs.writeFileSync(args[args.indexOf('-of')+1]+'.txt','Контрольный ответ');console.error('whisper_print_timings: load time = 12.3 ms');},100);
`, { mode:0o700 });
  const prompt = 'Jarvis, $(touch NEVER), --no-gpu';
  const stt = new Stt({binary:executable,model:'fixture',language:'ru',gpu:true,prompt});
  const pending = stt.transcribe(wav());
  await assert.rejects(stt.transcribe(wav()), e=>e.code==='stt_busy');
  const result = await pending;
  const args = JSON.parse(fs.readFileSync(capture));
  assert.equal(args[args.indexOf('--prompt')+1],prompt); assert.ok(!args.includes('-ng'));
  assert.equal(result.text,'Контрольный ответ'); assert.equal(result.timing.sttLoadMs,12.3);
  assert.ok(!JSON.stringify(result).includes(prompt));
  assert.ok(!fs.existsSync(path.dirname(args[args.indexOf('-f')+1])));
  assert.equal(stt.running,false);
  for (const model of ['fixture','fail']) {
    const cpu = new Stt({binary:executable,model,prompt:''});
    if(model==='fail')await assert.rejects(cpu.transcribe(wav()), e=>e.code==='stt_failed'&&!('stderr' in e)&&!e.message.includes('SECRET'));
    else await cpu.transcribe(wav());
    const cpuArgs=JSON.parse(fs.readFileSync(capture));assert.ok(cpuArgs.includes('-ng'));assert.ok(!cpuArgs.includes('--prompt'));
    assert.ok(!fs.existsSync(path.dirname(cpuArgs[cpuArgs.indexOf('-f')+1])));assert.equal(cpu.running,false);
  }
  assert.ok(!fs.existsSync(path.join(f.dir,'NEVER')));
});
