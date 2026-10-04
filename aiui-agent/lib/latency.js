// Content-free, bounded measurement. Dates from different clocks carry uncertainty.
import { errorView } from './voice-ui.js';
const TIMES = [...Array.from({length:12},(_,i)=>'T'+i),'sttPrepareMs','sttProcessMs','sttReadMs','sttLoadMs','sttInternalMs'];
const ERROR_STAGES = ['health','stt','session_ack','turn_ack','refresh','stop_ack','approval_ack'];
const ERROR_CHECKS = ['response_json','response_object','snapshot_object','snapshot_id','snapshot_thread','snapshot_status','snapshot_uncertain','history_object','history_identity','history_exchanges'];
export class Latency {
  constructor({ storage, transport, id, now = Date.now }) { Object.assign(this,{storage,transport,id,now}); this.key='mac-codex-latency-v1'; this.rows=[]; }
  begin() { this.sample={captureId:this.id(),T0:this.now()}; }
  mark(key) { if (this.sample && TIMES.includes(key) && this.sample[key] === undefined) this.sample[key]=this.now(); }
  correlate(value) {
    if (!this.sample) return;
    for (const key of ['sessionId','threadId','turnId','requestId']) if (/^[a-f0-9-]{36}$/i.test(value[key] || '')) this.sample[key]=value[key];
  }
  clock(body) {
    const c=body.clock, start=body._startedAt, end=body._receivedAt;
    if (!c || ![c.received,c.sent,start,end].every(Number.isFinite)) return;
    const low=c.sent-end, high=c.received-start;
    if (high < low) return;
    const estimate={clockOffsetMs:(low+high)/2,clockUncertaintyMs:(high-low)/2};
    if (!this.calibration || estimate.clockUncertaintyMs < this.calibration.clockUncertaintyMs) this.calibration=estimate;
    if (this.sample) Object.assign(this.sample,this.calibration);
  }
  server(body) {
    if (!this.sample) return;
    this.clock(body);
    for (const key of TIMES) if (key in (body.timing || {}) && Number.isFinite(body.timing[key])) this.sample[key]=body.timing[key];
  }
  error(reason, context = {}) {
    const code = errorView(reason).code;
    // Never store response bodies, routes or native errors.
    const record = {code,at:this.now()};
    if (ERROR_STAGES.includes(context.stage)) record.stage=context.stage;
    if (ERROR_CHECKS.includes(context.check)) record.check=context.check;
    for (const key of ['captureId','sessionId','threadId','turnId','requestId']) {
      const value = Object.hasOwn(context,key) ? context[key] : this.sample?.[key];
      if (typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) record[key]=value;
    }
    try { this.storage.set('mac-codex-last-error',record); } catch {}
    // Rich diagnostics stay local; keep the existing gateway timing contract unchanged.
    this.finish(['turn_failed','codex_turn_failed','request_outcome_unknown','request_id_conflict'].includes(code)?'client_error':code);
  }
  finish(reason) {
    if (!this.sample) return;
    if (reason) this.sample.reason=reason;
    const sample={...this.sample};
    const i=this.rows.findIndex(r=>r.captureId===sample.captureId);
    if(i>=0)this.rows[i]=sample;else this.rows.push(sample);
    this.rows=this.rows.slice(-12);
    try{this.storage.set(this.key,this.rows);}catch{}
    // Best effort after HUD update; telemetry failure never changes UI/task state.
    try { this.transport.request('POST','/v1/diagnostics',sample).catch(()=>{}); } catch {}
  }
}
