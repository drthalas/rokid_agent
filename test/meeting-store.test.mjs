import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RecordingStore, digest, LIMITS } from '../prototypes/meeting/store.mjs';
const pcm = (size = 32000, fill = 1) => { const b = Buffer.alloc(size, fill); return { kind: 'audio', durationMs: size / 32, data: b.toString('base64'), sha256: digest(b) }; };
async function fixture(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ale466-store-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return { root, store: await new RecordingStore(root).init(), id: randomUUID() }; }
test('durable retry, owner isolation, gaps/conflicts, restart and close barrier', async t => {
  let { root, store, id } = await fixture(t); await store.create(id, 'owner', 'pcm16');
  await assert.rejects(store.append(id, 'other', 0, pcm()), /not_found/);
  await assert.rejects(store.append(id, 'owner', 1, pcm()), /sequence_gap/);
  await store.append(id, 'owner', 0, pcm());
  store = await new RecordingStore(root).init();
  assert.equal((await store.append(id, 'owner', 0, pcm())).nextSeq, 1);
  await assert.rejects(store.append(id, 'owner', 0, pcm(32000, 2)), /chunk_conflict/);
  await assert.rejects(store.close(id, 'owner', { chunkCount: 2, complete: true, reason: 'stop' }), /tail_missing/);
  const close = { chunkCount: 1, complete: true, reason: 'stop' }; await store.close(id, 'owner', close); await store.close(id, 'owner', close);
  await assert.rejects(store.append(id, 'owner', 1, pcm()), /closed/);
  store = await new RecordingStore(root).init(); assert.equal(store.status(id, 'owner').complete, true);
  for await (const r of store.records(id, 'owner')) assert.equal(r.sha256, pcm().sha256);
  assert.equal((await fs.stat(path.join(root, id, '00000.json'))).mode & 0o777, 0o600);
});
test('60-minute PCM archive is bounded, contiguous and byte-identical after restart', async t => {
  let { root, store, id } = await fixture(t); await store.create(id, 'owner', 'pcm16');
  const record = pcm(64000); // 2 seconds, 1800 chunks = 115.2 MB raw, no giant buffer
  for (let seq = 0; seq < 1800; seq++) await store.append(id, 'owner', seq, record);
  await store.close(id, 'owner', { chunkCount: 1800, complete: true, reason: 'stop' });
  store = await new RecordingStore(root).init(); assert.equal(store.status(id, 'owner').durationMs, 3600000);
  let bytes = 0, count = 0; for await (const r of store.records(id, 'owner')) { assert.equal(r.sha256, record.sha256); bytes += r.bytes.length; count++; }
  assert.equal(count, 1800); assert.equal(bytes, 115200000); assert.ok(store.bytes < LIMITS.archive);
});
test('invalid payload, size, quota, incomplete and tampered archive fail closed', async t => {
  const { root, store, id } = await fixture(t); await store.create(id, 'owner', 'pcm16');
  await assert.rejects(store.append(id, 'owner', 0, { ...pcm(), sha256: 'bad' }), /checksum/);
  await assert.rejects(store.append(id, 'owner', 0, pcm(65568)), /chunk_size/);
  await assert.rejects(store.append(id, 'owner', 0, { ...pcm(), durationMs: 9 }), /pcm_duration/);
  const before = store.bytes; store.bytes = LIMITS.archive; await assert.rejects(store.append(id, 'owner', 0, pcm()), /archive_quota/); store.bytes = before;
  await store.append(id, 'owner', 0, pcm()); await store.close(id, 'owner', { chunkCount: 1, complete: false, reason: 'interrupted' });
  await assert.rejects(async () => { for await (const unused of store.records(id, 'owner')) void unused; }, /recording_incomplete/);
  await fs.writeFile(path.join(root, id, '00000.json'), JSON.stringify({ ...pcm(), sha256: 'bad' }));
  await assert.rejects(new RecordingStore(root).init(), /checksum/);
});
test('Opus header ordering, duration cap, session cap and conflicting close are enforced', async t => {
  const { store, id } = await fixture(t); await store.create(id, 'owner', 'opus');
  await assert.rejects(store.append(id, 'owner', 0, pcm()), /opus_header_required/);
  const header = { ...pcm(32), kind: 'header', durationMs: 0 }; await store.append(id, 'owner', 0, header);
  const s = store.owned(id, 'owner'); s.durationMs = LIMITS.duration;
  await assert.rejects(store.append(id, 'owner', 1, pcm()), /duration_limit/); s.durationMs = 0;
  await store.append(id, 'owner', 1, pcm()); await store.close(id, 'owner', { chunkCount: 2, complete: true, reason: 'stop' });
  await assert.rejects(store.close(id, 'owner', { chunkCount: 2, complete: false, reason: 'error' }), /close_conflict/);
  for (let n = 1; n < LIMITS.sessions; n++) await store.create(randomUUID(), 'owner', 'pcm16');
  await assert.rejects(store.create(randomUUID(), 'owner', 'pcm16'), /session_quota/);
});
test('restart preserves unknown orphan contents and recovers only interrupted metadata creation', async t => {
  const { root } = await fixture(t), id = randomUUID(), dir = path.join(root, id); await fs.mkdir(dir, { mode: 0o700 });
  await fs.writeFile(path.join(dir, 'unrelated.txt'), 'preserve');
  await assert.rejects(new RecordingStore(root).init(), /invalid_archive/);
  assert.equal(await fs.readFile(path.join(dir, 'unrelated.txt'), 'utf8'), 'preserve');
  await fs.unlink(path.join(dir, 'unrelated.txt')); await fs.writeFile(path.join(dir, 'meta.json.tmp'), '{}');
  await new RecordingStore(root).init(); await assert.rejects(fs.stat(dir), /ENOENT/);
});
