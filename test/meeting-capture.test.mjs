import test from 'node:test';
import assert from 'node:assert/strict';
import { MeetingCapture } from '../prototypes/meeting/capture.mjs';
const tick = () => new Promise(r => setImmediate(r));
function setup(options = {}) {
  const callbacks = {}, sent = [], closures = [], states = [];
  const recorder = { onHeader: f => callbacks.header = f, onFrameRecorded: f => callbacks.frame = f,
    onStop: f => callbacks.stop = f, onError: f => callbacks.error = f, onInterruptionBegin: f => callbacks.interrupt = f,
    start: async opts => { recorder.options = opts; }, stop: async () => { recorder.stopCount = (recorder.stopCount || 0) + 1; } };
  const transport = { create: async () => ({}), append: async (_, seq, record) => { sent.push({ seq, record }); return { nextSeq: seq + 1 }; }, close: async (_, close) => closures.push(close) };
  const capture = new MeetingCapture({ recorder, transport, id: 'fixture', onState: state => states.push(state), ...options });
  return { capture, callbacks, recorder, transport, sent, closures, states };
}
test('stop waits for onStop, includes tail, ignores isLastFrame and copies native buffer', async () => {
  const f = setup(); await f.capture.start(); assert.equal(f.recorder.options.frameSize, 1000);
  const frame = new Uint8Array(32000).fill(7); f.callbacks.frame({ frameBuffer: frame.buffer, isLastFrame: false }); frame.fill(9);
  f.capture.stop(); await tick(); assert.equal(f.closures.length, 0);
  f.callbacks.frame({ frameBuffer: new Uint8Array(3200).buffer, isLastFrame: false }); f.callbacks.stop(); await tick();
  assert.equal(f.capture.state, 'complete'); assert.equal(f.closures[0].chunkCount, 2);
  assert.equal(Buffer.from(f.sent[0].record.data, 'base64')[0], 7);
});
test('lost ACK replays same sequence and drains on explicit reconnect', async () => {
  const f = setup(); let fail = true;
  f.transport.append = async (_, seq, record) => { f.sent.push({ seq, record }); if (fail) { fail = false; throw Error('lost ack'); } return { nextSeq: seq + 1 }; };
  await f.capture.start(); f.callbacks.frame({ frameBuffer: new Uint8Array(32000).buffer }); await tick();
  assert.equal(f.capture.state, 'paused'); f.capture.stop(); f.callbacks.stop(); await tick();
  assert.equal(f.closures.length, 0); await f.capture.resume(); assert.equal(f.capture.state, 'complete');
  assert.deepEqual(f.sent[0], f.sent[1]); assert.equal(f.capture.queuedBytes, 0);
});
test('bounded queue overflow, interruption and missing stop callback remain incomplete', async () => {
  const f = setup({ queueLimit: 45000 }); f.transport.append = async () => { throw Error('offline'); };
  await f.capture.start(); f.callbacks.frame({ frameBuffer: new Uint8Array(32000).buffer }); await tick();
  f.callbacks.frame({ frameBuffer: new Uint8Array(32000).buffer }); f.callbacks.stop(); await tick();
  assert.ok(f.capture.queuedBytes <= 45000); assert.equal(f.capture.reason, 'overflow');
  f.transport.append = async (_, seq) => ({ nextSeq: seq + 1 }); await f.capture.resume(); assert.equal(f.capture.state, 'incomplete');
  const g = setup(); await g.capture.start(); g.callbacks.frame({ frameBuffer: new Uint8Array(32000).buffer }); g.callbacks.interrupt(); g.callbacks.stop(); await tick();
  assert.equal(g.capture.state, 'incomplete'); assert.equal(g.closures[0].reason, 'interrupted');
  const h = setup({ stopTimeoutMs: 5 }); await h.capture.start(); h.callbacks.frame({ frameBuffer: new Uint8Array(32000).buffer }); h.capture.stop();
  await new Promise(r => setTimeout(r, 20)); assert.equal(h.capture.state, 'incomplete'); assert.equal(h.closures[0].reason, 'timeout');
});
test('Opus header precedes payload; missing header cannot report complete', async () => {
  const f = setup({ format: 'opus' }); await f.capture.start();
  f.callbacks.header('opus', new Uint8Array([1, 2, 3]).buffer); f.callbacks.frame({ frameBuffer: new Uint8Array([4, 5]).buffer }); f.capture.stop(); f.callbacks.stop(); await tick();
  assert.equal(f.sent[0].record.kind, 'header'); assert.equal(f.sent[0].record.durationMs, 0); assert.equal(f.sent[1].record.kind, 'audio');
  const g = setup({ format: 'opus' }); await g.capture.start(); g.callbacks.frame({ frameBuffer: new Uint8Array([4]).buffer }); g.callbacks.stop(); await tick(); assert.equal(g.capture.state, 'incomplete');
});
test('unexpected native stop and empty recording close incomplete', async () => {
  const f = setup(); await f.capture.start(); f.callbacks.frame({ frameBuffer: new Uint8Array(32000).buffer }); f.callbacks.stop(); await tick();
  assert.equal(f.capture.state, 'incomplete'); assert.equal(f.closures[0].reason, 'interrupted');
  const g = setup(); await g.capture.start(); g.capture.stop(); g.callbacks.stop(); await tick();
  assert.equal(g.capture.state, 'incomplete'); assert.equal(g.closures[0].chunkCount, 0);
});
test('fractional-millisecond PCM tail is preserved and queue record count is bounded', async () => {
  const f = setup(); await f.capture.start(); f.callbacks.frame({ frameBuffer: new Uint8Array(32002).buffer }); f.capture.stop(); f.callbacks.stop(); await tick();
  assert.equal(f.sent[0].record.durationMs, 1000.0625); assert.equal(f.capture.state, 'complete');
  const g = setup(); g.transport.append = async () => { throw Error('offline'); }; await g.capture.start();
  for (let n = 0; n < 257; n++) g.callbacks.frame({ frameBuffer: new Uint8Array(32).buffer });
  g.callbacks.stop(); await tick(); assert.ok(g.capture.queue.length <= 256); assert.equal(g.capture.reason, 'overflow');
});
