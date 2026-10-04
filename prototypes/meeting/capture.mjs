// Host-testable RecorderManager controller. Requires a platform byte encoder at RV101 integration.
import { LIMITS, check, digest } from './store.mjs';
export class MeetingCapture {
  constructor({ recorder, transport, id, format = 'pcm16', onState = () => {}, queueLimit = LIMITS.queue, stopTimeoutMs = 10000 }) {
    check(recorder && ['pcm16', 'opus'].includes(format), 'recorder_unavailable');
    Object.assign(this, { recorder, transport, id, format, onState, queueLimit, stopTimeoutMs });
    this.queue = []; this.queuedBytes = 0; this.nextSeq = 0; this.state = 'idle'; this.reason = 'stop'; this.stopped = false; this.header = false; this.durationMs = 0;
    recorder.onHeader?.((format, bytes) => { if (format !== 'opus' || this.format !== 'opus' || this.header) return this.fail('error'); this.header = true; this.frame(bytes, 'header', 0); });
    recorder.onFrameRecorded(({ frameBuffer }) => {
      if (this.format === 'opus' && !this.header) return this.fail('error');
      this.frame(frameBuffer, 'audio', this.format === 'pcm16' ? frameBuffer.byteLength / 32 : 1000);
    });
    recorder.onStop(() => { if (!this.stopRequested) this.reason = 'interrupted'; this.stopped = true; clearTimeout(this.timer); void this.drain(); });
    recorder.onError(() => this.fail('error'));
    recorder.onInterruptionBegin?.(() => this.fail('interrupted'));
  }
  notify(state) { this.state = state; this.onState({ state, queuedBytes: this.queuedBytes, reason: this.reason }); }
  async start() {
    check(this.state === 'idle', 'capture_already_started');
    await this.transport.create(this.id, this.format); this.notify('recording');
    try { await this.recorder.start({ sampleRate: 16000, numberOfChannels: 1, format: this.format === 'pcm16' ? 'pcm' : 'opus', frameSize: 1000 }); }
    catch { this.fail('error'); }
  }
  frame(buffer, kind, durationMs) {
    if (!['recording', 'stopping', 'paused'].includes(this.state) || this.stopped) return;
    if (this.nextSeq >= LIMITS.chunks || this.queue.length >= LIMITS.queueRecords || this.durationMs + durationMs > LIMITS.duration || !buffer?.byteLength || buffer.byteLength > LIMITS.chunk || this.queuedBytes + Math.ceil(buffer.byteLength / 3) * 4 > this.queueLimit) { this.fail('overflow'); return; }
    if (!Number.isFinite(durationMs) || (kind === 'audio' && durationMs <= 0)) { this.fail('error'); return; }
    this.durationMs += durationMs;
    const bytes = Buffer.from(new Uint8Array(buffer)); // own callback bytes; native buffers may be reused
    this.queue.push({ seq: this.nextSeq++, size: Math.ceil(bytes.length / 3) * 4,
      record: { kind, durationMs, data: bytes.toString('base64'), sha256: digest(bytes) } });
    this.queuedBytes += Math.ceil(bytes.length / 3) * 4; void this.drain();
  }
  stop() {
    if (this.stopRequested || ['idle', 'complete', 'incomplete'].includes(this.state)) return;
    this.stopRequested = true; this.notify('stopping');
    this.timer = setTimeout(() => { this.reason = 'timeout'; this.stopped = true; void this.drain(); }, this.stopTimeoutMs);
    Promise.resolve().then(() => this.recorder.stop()).catch(() => { this.reason = 'error'; this.stopped = true; clearTimeout(this.timer); void this.drain(); });
  }
  fail(reason) { if (['idle', 'complete', 'incomplete'].includes(this.state)) return; this.reason = reason; this.stop(); }
  interrupt() { this.fail('interrupted'); }
  async resume() { this.networkPaused = false; await this.drain(); }
  async drain() {
    if (this.flight || this.networkPaused) return this.flight;
    this.flight = (async () => {
      try {
        while (this.queue.length) {
          const item = this.queue[0];
          const ack = await this.transport.append(this.id, item.seq, item.record);
          check(ack.nextSeq === item.seq + 1, 'unexpected_ack');
          this.queue.shift(); this.queuedBytes -= item.size;
        }
        if (this.stopped && !this.closed) {
          if (this.nextSeq === 0 || (this.format === 'opus' && this.nextSeq === 1)) this.reason = 'error';
          const complete = this.reason === 'stop';
          await this.transport.close(this.id, { chunkCount: this.nextSeq, complete, reason: this.reason });
          this.closed = true; this.notify(complete ? 'complete' : 'incomplete');
        } else if (!this.stopRequested) this.notify('recording');
      } catch { this.networkPaused = true; this.notify('paused'); }
    })();
    try { await this.flight; } finally { this.flight = null; }
  }
}
