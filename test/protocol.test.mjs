import test from 'node:test';
import assert from 'node:assert/strict';
import { prompt, requestId, object, reduceEvent, approvalResponse } from '../src/protocol.mjs';
import { spawnSpec } from '../src/codex.mjs';
import { validateWav } from '../src/stt.mjs';
const session = () => ({ threadId: 'a', turnId: 't', status: 'Working', revision: 1, text: '' });
test('strict envelope and bounded prompt', () => {
  for (const p of ['', '  ', 'a'.repeat(8001), 'x\0y', 3]) assert.throws(() => prompt(p));
  assert.equal(prompt('  привет  '), 'привет'); assert.throws(() => requestId('x'));
  assert.throws(() => object({ text: 'x', cwd: '/tmp' }, ['text']));
});
test('foreign turn/thread and late deltas cannot corrupt final answer', () => {
  const s = session(); assert.equal(reduceEvent(s, 'item/agentMessage/delta', { threadId: 'b', turnId: 't', delta: 'bad' }), false);
  assert.equal(reduceEvent(s, 'item/agentMessage/delta', { threadId: 'a', turnId: 'other', delta: 'bad' }), false);
  reduceEvent(s, 'turn/completed', { threadId: 'a', turn: { id: 't', status: 'completed', items: [{ type: 'agentMessage', text: 'answer' }] } });
  reduceEvent(s, 'item/agentMessage/delta', { threadId: 'a', turnId: 't', delta: 'late' });
  assert.equal(s.status, 'Done'); assert.equal(s.text, 'answer'); assert.equal(s.partial, '');
});
test('failed and interrupted are errors; commentary is not final', () => {
  for (const status of ['failed', 'interrupted']) { const s = session(); reduceEvent(s, 'turn/completed', { threadId: 'a', turn: { id: 't', status } }); assert.equal(s.status, 'Error'); }
  const s = session(); reduceEvent(s, 'item/completed', { threadId: 'a', item: { type: 'agentMessage', phase: 'commentary', text: 'working' } }); assert.equal(s.text, '');
});
test('loopback is fixed and approval never grants broad permissions', () => {
  const spec = spawnSpec('/opt/homebrew/bin/codex', 8390);
  assert.ok(spec.args.includes('ws://127.0.0.1:8390')); assert.equal(spec.options.shell, false);
  assert.ok(!spec.args.some(a=>/mcp_servers=|features\.(apps|plugins|hooks)=false/.test(a)));
  assert.ok(spec.args.includes('approvals_reviewer="user"'));
  assert.ok(!spec.args.some(a=>a.startsWith('apps._default.default_tools_approval_mode=')), 'do not mask a stricter inherited prompt policy');
  assert.deepEqual(approvalResponse('item/permissions/requestApproval', true), { permissions: {}, scope: 'turn' });
  assert.deepEqual(approvalResponse('item/fileChange/requestApproval', false), { decision: 'decline' });
});
test('audio parser rejects forged, oversized and non-PCM inputs', () => {
  for (const b of [Buffer.alloc(0), Buffer.alloc(44), Buffer.alloc(960046), Buffer.alloc(4000)]) assert.throws(() => validateWav(b));
  const b = Buffer.alloc(64044); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(b.length - 44, 40);
  validateWav(b); b.writeUInt32LE(48000, 24); assert.throws(() => validateWav(b));
});
