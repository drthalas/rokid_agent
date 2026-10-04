// Dormant ALE-466 prototype. Never imported by the production gateway.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const LIMITS = Object.freeze({ chunk: 65536, body: 98304, queue: 8 * 1024 * 1024, queueRecords: 256,
  archive: 256 * 1024 * 1024, duration: 7200000, sessions: 32, chunks: 30000 });
export class MeetingError extends Error { constructor(code, status = 400) { super(code); this.status = status; } }
export function check(ok, code, status) { if (!ok) throw new MeetingError(code, status); }
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function decodeChunk(record, format, seq) {
  check(record && typeof record === 'object', 'invalid_chunk');
  const { kind, durationMs, data, sha256 } = record;
  check(typeof data === 'string' && data.length <= Math.ceil(LIMITS.chunk / 3) * 4, 'chunk_size');
  const bytes = Buffer.from(data, 'base64');
  check(bytes.length > 0 && bytes.length <= LIMITS.chunk && bytes.toString('base64') === data, 'invalid_base64');
  check(typeof sha256 === 'string' && digest(bytes) === sha256, 'checksum');
  check(Number.isFinite(durationMs), 'duration');
  if (format === 'opus' && seq === 0) check(kind === 'header' && durationMs === 0, 'opus_header_required');
  else {
    check(kind === 'audio' && durationMs > 0 && durationMs <= 10000, 'duration');
    if (format === 'pcm16') check(bytes.length % 2 === 0 && durationMs === bytes.length / 32, 'pcm_duration');
  }
  return bytes;
}
async function syncDir(dir) { const f = await fs.open(dir, 'r'); try { await f.sync(); } finally { await f.close(); } }
export async function atomic(file, bytes) {
  const tmp = file + '.tmp';
  const f = await fs.open(tmp, 'w', 0o600);
  try { await f.writeFile(bytes); await f.sync(); } finally { await f.close(); }
  await fs.rename(tmp, file); await syncDir(path.dirname(file));
}
export class RecordingStore {
  constructor(root) { this.root = root; this.sessions = new Map(); this.bytes = 0; this.tail = Promise.resolve(); }
  async init() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    check(((await fs.stat(this.root)).mode & 0o077) === 0, 'private_directory_required');
    this.sessions.clear(); this.bytes = 0;
    for (const id of await fs.readdir(this.root)) {
      check(uuid.test(id), 'invalid_archive');
      const dir = path.join(this.root, id);
      // An interrupted create with no metadata is not acknowledged; remove only that empty shell.
      let meta;
      try { meta = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8')); }
      catch (e) {
        if (e.code !== 'ENOENT') throw e;
        const orphan = await fs.readdir(dir);
        check(orphan.every(name => name === 'meta.json.tmp'), 'invalid_archive');
        for (const name of orphan) await fs.unlink(path.join(dir, name));
        await fs.rmdir(dir); continue;
      }
      check(meta.id === id && typeof meta.owner === 'string' && ['pcm16', 'opus'].includes(meta.format), 'invalid_archive');
      const session = { ...meta, chunks: [], durationMs: 0, close: null };
      const names = (await fs.readdir(dir)).filter(n => /^\d{5}\.json$/.test(n)).sort();
      for (const name of names) {
        const seq = session.chunks.length;
        check(name === this.chunkName(seq), 'archive_gap');
        const record = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
        decodeChunk(record, meta.format, seq);
        session.chunks.push({ sha256: record.sha256, durationMs: record.durationMs, kind: record.kind });
        session.durationMs += record.durationMs;
      }
      try { session.close = JSON.parse(await fs.readFile(path.join(dir, 'close.json'), 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (session.close) this.validateClose(session, session.close);
      check(session.durationMs <= LIMITS.duration && session.chunks.length <= LIMITS.chunks, 'invalid_archive');
      for (const name of await fs.readdir(dir)) {
        if (/^(meta|close|\d{5})\.json\.tmp$/.test(name)) { await fs.unlink(path.join(dir, name)); continue; }
        // Derived output is quota-accounted too on restart.
        this.bytes += (await fs.stat(path.join(dir, name))).size;
      }
      this.sessions.set(id, session);
    }
    check(this.sessions.size <= LIMITS.sessions && this.bytes <= LIMITS.archive, 'archive_quota');
    return this;
  }
  chunkName(seq) { return String(seq).padStart(5, '0') + '.json'; }
  exclusive(fn) { const task = this.tail.then(fn); this.tail = task.catch(() => {}); return task; }
  owned(id, owner) { check(uuid.test(id), 'invalid_id'); const s = this.sessions.get(id); check(s && s.owner === owner, 'not_found', 404); return s; }
  status(id, owner) { const s = this.owned(id, owner); return { nextSeq: s.chunks.length, durationMs: s.durationMs, state: s.close ? 'closed' : 'open', complete: s.close?.complete ?? false }; }
  async write(id, name, object) {
    const json = JSON.stringify(object);
    check(this.bytes + Buffer.byteLength(json) <= LIMITS.archive, 'archive_quota', 507);
    await atomic(path.join(this.root, id, name), json); this.bytes += Buffer.byteLength(json);
  }
  create(id, owner, format) { return this.exclusive(async () => {
    check(uuid.test(id) && typeof owner === 'string' && owner.length > 0 && owner.length <= 128, 'invalid_identity');
    check(['pcm16', 'opus'].includes(format), 'format');
    if (this.sessions.has(id)) { const s = this.owned(id, owner); check(s.format === format, 'format_conflict', 409); return this.status(id, owner); }
    check(this.sessions.size < LIMITS.sessions, 'session_quota', 507);
    await fs.mkdir(path.join(this.root, id), { mode: 0o700 }); await syncDir(this.root);
    const meta = { id, owner, format, createdAt: new Date().toISOString() };
    await this.write(id, 'meta.json', meta);
    this.sessions.set(id, { ...meta, chunks: [], durationMs: 0, close: null });
    return this.status(id, owner);
  }); }
  append(id, owner, seq, record) { return this.exclusive(async () => {
    const s = this.owned(id, owner);
    check(Number.isInteger(seq) && seq >= 0 && seq < LIMITS.chunks, 'sequence');
    decodeChunk(record, s.format, seq);
    const entry = { sha256: record.sha256, durationMs: record.durationMs, kind: record.kind };
    if (seq < s.chunks.length) { check(JSON.stringify(s.chunks[seq]) === JSON.stringify(entry), 'chunk_conflict', 409); return this.status(id, owner); }
    check(!s.close, 'closed', 409); check(seq === s.chunks.length, 'sequence_gap', 409);
    check(s.durationMs + record.durationMs <= LIMITS.duration, 'duration_limit', 413);
    await this.write(id, this.chunkName(seq), { ...entry, data: record.data });
    s.chunks.push(entry); s.durationMs += record.durationMs; return this.status(id, owner);
  }); }
  validateClose(s, close) {
    check(close && close.chunkCount === s.chunks.length && close.chunkCount >= 0, 'tail_missing', 409);
    check(typeof close.complete === 'boolean' && ['stop', 'interrupted', 'overflow', 'error', 'timeout'].includes(close.reason), 'invalid_close');
    check(!close.complete || (close.reason === 'stop' && s.durationMs > 0), 'invalid_close');
  }
  close(id, owner, close) { return this.exclusive(async () => {
    const s = this.owned(id, owner); this.validateClose(s, close);
    const value = { chunkCount: close.chunkCount, complete: close.complete, reason: close.reason };
    if (s.close) check(JSON.stringify(s.close) === JSON.stringify(value), 'close_conflict', 409);
    else { await this.write(id, 'close.json', value); s.close = value; }
    return this.status(id, owner);
  }); }
  async *records(id, owner) {
    const s = this.owned(id, owner); check(s.close?.complete, 'recording_incomplete', 409);
    for (let seq = 0; seq < s.chunks.length; seq++) {
      const record = JSON.parse(await fs.readFile(path.join(this.root, id, this.chunkName(seq)), 'utf8'));
      yield { ...record, bytes: decodeChunk(record, s.format, seq) };
    }
  }
}
