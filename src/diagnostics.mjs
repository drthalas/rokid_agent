// Strict, bounded, content-free device timing collection. Never accept arbitrary fields/text.
import fs from 'node:fs';
import { Fault } from './protocol.mjs';
const ids = new Set(['captureId', 'sessionId', 'threadId', 'turnId', 'requestId']);
const numbers = new Set([...Array.from({length:12},(_,i)=>'T'+i), 'clockOffsetMs', 'clockUncertaintyMs', 'sttProcessMs', 'sttLoadMs', 'sttInternalMs', 'sttPrepareMs', 'sttReadMs']);
const codes = new Set(['client_error','codex_not_ready','codex_unavailable','resume_failed','network_or_tls_error','unauthorized','stt_failed','stt_not_configured','stt_busy','no_speech','microphone_unavailable','recording_failed','invalid_audio_size','session_busy_or_uncertain','turn_delivery_uncertain','recovery_requires_local_review','pending_request_needs_review','session_mismatch','thread_mismatch','session_not_found','connection_not_configured','invalid_response','invalid_snapshot','gateway_error','turn_interrupted']);
export function timingSample(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Fault('invalid_diagnostic');
  const out = {};
  for (const [k,v] of Object.entries(input)) {
    if (ids.has(k)) {
      // UUIDs only; cannot be repurposed to store an arbitrary token/message.
      if (typeof v !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)) throw new Fault('invalid_diagnostic');
    } else if (numbers.has(k)) {
      if (!Number.isFinite(v) || Math.abs(v) > 1e14 || (k !== 'clockOffsetMs' && v < 0)) throw new Fault('invalid_diagnostic');
    } else if (k !== 'reason' || !codes.has(v)) throw new Fault('invalid_diagnostic');
    out[k] = v;
  }
  if (!out.captureId) throw new Fault('invalid_diagnostic');
  return out;
}
export class Diagnostics {
  constructor(file) { this.file = file; this.samples = []; }
  add(input) {
    const value = timingSample(input), i = this.samples.findIndex(s => s.captureId === value.captureId);
    if (i >= 0) this.samples[i] = {...this.samples[i], ...value}; else this.samples.push(value);
    this.samples = this.samples.slice(-32);
    // Diagnostics are best-effort and must never influence execution/state persistence.
    try { fs.writeFileSync(this.file, JSON.stringify({version:1,samples:this.samples}), {mode:0o600}); fs.chmodSync(this.file,0o600); } catch {}
    return {ok:true};
  }
}
