// Synthetic-only local smoke. Never reads production config or microphone audio.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { RecordingStore, digest } from './store.mjs';
import { processRecording } from './process.mjs';
import { Stt } from '../../src/stt.mjs';
const run = promisify(execFile);
const [binary, model] = process.argv.slice(2);
if (!binary || !model || !path.isAbsolute(binary) || !path.isAbsolute(model)) throw Error('usage: node prototypes/meeting/smoke.mjs /absolute/whisper-cli /absolute/model.bin');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ale466-synthetic-'));
try {
  const started = Date.now();
  const phrase = 'Это проверка записи встречи. Мы решили проверить восстановление соединения. Анна подготовит отчёт к пятнице.';
  await run('/usr/bin/say', ['-v', 'Milena', '-r', '155', '-o', path.join(dir, 'speech.aiff'), phrase], { timeout: 30000 });
  const { stdout: speech } = await run('ffmpeg', ['-loglevel', 'error', '-i', path.join(dir, 'speech.aiff'), '-ar', '16000', '-ac', '1', '-f', 's16le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 4 * 1024 * 1024, timeout: 30000 });
  assert.ok(speech.length > 32000);
  const store = await new RecordingStore(path.join(dir, 'archive')).init(), id = randomUUID(); await store.create(id, 'synthetic-owner', 'pcm16');
  // Repeat only this generated phrase to exactly 65 seconds; no external/private input permitted.
  for (let seq = 0; seq < 65; seq++) {
    const bytes = Buffer.alloc(32000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = speech[(seq * 32000 + i) % speech.length];
    await store.append(id, 'synthetic-owner', seq, { kind: 'audio', durationMs: 1000, data: bytes.toString('base64'), sha256: digest(bytes) });
  }
  await store.close(id, 'synthetic-owner', { chunkCount: 65, complete: true, reason: 'stop' });
  const result = await processRecording(store, id, 'synthetic-owner', { output: path.join(dir, 'output'), stt: new Stt({ binary, model, language: 'ru', gpu: true, prompt: 'Русская речь. Названия: Jarvis, Rokid, Codex, Gmail, Google Drive, Linear, GitHub, AIX, Computer Use, Mac mini.' }) });
  assert.equal(result.transcript.durationMs, 65000); assert.equal(result.transcript.segments.length, 3);
  assert.ok(result.transcript.segments.every(s => s.status === 'transcribed' && s.text.length > 0));
  assert.equal((await fs.stat(result.master)).size, 2080044);
  console.log(JSON.stringify({ pass: true, source: 'synthetic-Milena-only', durationMs: 65000, segments: result.transcript.segments.map(s => ({ startMs: s.startMs, endMs: s.endMs, status: s.status, text: s.text })), wallMs: Date.now() - started, productionAccess: false, masterBytes: 2080044 }, null, 2));
} finally { await fs.rm(dir, { recursive: true, force: true }); }
