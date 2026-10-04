import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RecordingStore, digest } from '../prototypes/meeting/store.mjs';
import { processRecording, summarize, validateSummary } from '../prototypes/meeting/process.mjs';
test('PCM master preserved; bounded transcription windows retain offsets and no-speech', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ale466-process-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = await new RecordingStore(path.join(dir, 'archive')).init(), id = randomUUID();
  await store.create(id, 'owner', 'pcm16'); const bytes = Buffer.alloc(32000, 1);
  for (let seq = 0; seq < 61; seq++) await store.append(id, 'owner', seq, { kind: 'audio', durationMs: 1000, data: bytes.toString('base64'), sha256: digest(bytes) });
  await store.close(id, 'owner', { chunkCount: 61, complete: true, reason: 'stop' });
  let calls = 0;
  const result = await processRecording(store, id, 'owner', { output: path.join(dir, 'out'), stt: { transcribe: async wav => {
    assert.ok(wav.length <= 960044); calls++; if (calls === 2) throw Error('no_speech'); return { text: 'Synthetic transcript' };
  } } });
  assert.equal(calls, 3); assert.deepEqual(result.transcript.segments.map(s => [s.startMs, s.endMs]), [[0, 30000], [30000, 60000], [60000, 61000]]);
  assert.equal(result.transcript.segments[1].status, 'no_speech');
  const master = await fs.readFile(result.master); assert.equal(master.length, 61 * 32000 + 44); assert.ok(master.subarray(44).every(x => x === 1));
  await assert.rejects(processRecording(store, id, 'owner', { output: path.join(dir, 'failed'), stt: { transcribe: async () => { throw Error('private diagnostic'); } } }), /transcription_failed/);
  assert.equal((await fs.stat(path.join(dir, 'failed', 'master.wav'))).size, master.length);
});
test('summary requires known nonempty evidence, explicit unknown owner/due date, no extra authority', async () => {
  const transcript = { segments: [{ id: 0, text: 'We decided to test reconnect.', status: 'transcribed' }] };
  const value = { summary: [{ text: 'Reconnect testing agreed.', segmentIds: [0] }], decisions: [], actions: [{ text: 'Test reconnect.', segmentIds: [0], owner: null, dueDate: null }] };
  assert.deepEqual(await summarize(transcript, async request => { assert.match(request.instructions, /No tools/); return JSON.stringify(value); }), value);
  assert.throws(() => validateSummary({ ...value, sendEmail: true }, transcript), /invalid_summary/);
  assert.throws(() => validateSummary({ ...value, decisions: [{ text: 'Invented', segmentIds: [5] }] }, transcript), /invalid_evidence/);
  assert.throws(() => validateSummary({ ...value, actions: [{ text: 'Unspecified', segmentIds: [0] }] }, transcript), /invalid_summary/);
});
test('processing refuses incomplete/Opus and preserves unrelated output files', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ale466-output-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = await new RecordingStore(path.join(dir, 'archive')).init(), id = randomUUID(); await store.create(id, 'owner', 'pcm16');
  const options = { output: path.join(dir, 'out'), stt: { transcribe: async () => ({ text: 'synthetic' }) } };
  await assert.rejects(processRecording(store, id, 'owner', options), /recording_incomplete/);
  const b = Buffer.alloc(32000); await store.append(id, 'owner', 0, { kind: 'audio', durationMs: 1000, data: b.toString('base64'), sha256: digest(b) });
  await store.close(id, 'owner', { chunkCount: 1, complete: true, reason: 'stop' });
  await fs.mkdir(options.output, { mode: 0o700 }); await fs.writeFile(path.join(options.output, 'unrelated.txt'), 'preserve'); await fs.writeFile(path.join(options.output, 'master.wav.tmp'), 'preserve too');
  await assert.rejects(processRecording(store, id, 'owner', options), /output_not_empty/);
  assert.equal(await fs.readFile(path.join(options.output, 'unrelated.txt'), 'utf8'), 'preserve'); assert.equal(await fs.readFile(path.join(options.output, 'master.wav.tmp'), 'utf8'), 'preserve too');
  const clean = { ...options, output: path.join(dir, 'clean') }; await processRecording(store, id, 'owner', clean);
  await assert.rejects(processRecording(store, id, 'owner', { ...clean, stt: { transcribe: async () => { throw Error('fail'); } } }), /transcription_failed/);
  await assert.rejects(fs.access(path.join(clean.output, 'transcript.json')), /ENOENT/);
  assert.ok(await fs.stat(path.join(clean.output, 'master.wav')));
  store.owned(id, 'owner').format = 'opus'; await assert.rejects(processRecording(store, id, 'owner', clean), /opus_decoder_unproven/);
});
