// Content-free, bounded measurement. Dates from different clocks carry uncertainty.
const TIMES = [...Array.from({length:12},(_,i)=>'T'+i),'sttPrepareMs','sttProcessMs','sttReadMs','sttLoadMs','sttInternalMs'];
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
