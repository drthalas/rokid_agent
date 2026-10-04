import { approvalDescriptor, APPROVAL_NOTICES } from './approval-ui.js';
import { boundedHistory } from './history.js';
function contractError(code, check, stage) {
  return Object.assign(new Error(code), { check, stage });
}
function requestStage(method, route) {
  if (route === '/v1/health') return 'health';
  if (route === '/v1/stt') return 'stt';
  if (route.endsWith('/turns')) return 'turn_ack';
  if (route.endsWith('/sessions')) return 'session_ack';
  if (route.includes('/approvals/')) return 'approval_ack';
  if (route.endsWith('/stop')) return 'stop_ack';
  return method === 'GET' ? 'refresh' : 'diagnostics';
}
export function validConfig(c) {
  if (!c || typeof c.origin !== 'string' || typeof c.token !== 'string') throw new Error('connection_not_configured');
  const u = new URL(c.origin);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('https_origin_required');
  if (!/^[A-Za-z0-9_-]{43,}$/.test(c.token)) throw new Error('device_token_required');
  if (c.project && !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(c.project)) throw new Error('invalid_project_alias');
  if (c.sessionId && !/^[a-f0-9-]{36}$/.test(c.sessionId)) throw new Error('invalid_gateway_session');
  return { ...c, origin: u.origin };
}
export function createTransport(wx, config) {
  const c = validConfig(config), tasks = new Set();
  return {
    request(method, route, data, audio = false) {
      if (!/^\/v1\/(health|stt|diagnostics|sessions(?:\/[a-f0-9-]{36}(?:\/(turns|stop|approvals\/[a-f0-9-]{36}))?)?)$/.test(route)) return Promise.reject(new Error('invalid_route'));
      return new Promise((resolve, reject) => {
        let task; const startedAt = Date.now();
        task = wx.request({ url: c.origin + route, method, data,
          header: { authorization: 'Bearer ' + c.token, 'content-type': audio ? 'audio/wav' : 'application/json' },
          // wx defaults to arraybuffer, even with dataType=json. Both must be explicit.
          responseType: 'text', dataType: 'json', timeout: audio ? 100000 : 35000,
          success(res) {
            let body = res.data;
            const invalid = check => reject(contractError('invalid_response', check, requestStage(method, route)));
            if (typeof body === 'string') { try { body = JSON.parse(body); } catch { invalid('response_json'); return; } }
            if (!body || typeof body !== 'object' || Array.isArray(body) || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) { invalid('response_object'); return; }
            if (res.statusCode !== 200) {
              const error = new Error(typeof body.error === 'string' && /^[a-z_]+$/.test(body.error) ? body.error : 'gateway_error');
              error.status = res.statusCode; error.stage = requestStage(method, route); reject(error);
            } else { Object.defineProperties(body, { _startedAt: {value:startedAt}, _receivedAt: {value:Date.now()} }); resolve(body); }
          },
          fail() { reject(Object.assign(new Error('network_or_tls_error'), {stage:requestStage(method, route)})); },
          complete() { tasks.delete(task); }
        });
        tasks.add(task);
      });
    },
    decisionOnExit(route, data) { return createTransport(wx,c).request('POST',route,data); },
    close() { for (const task of tasks) { try { task.abort(); } catch {} } tasks.clear(); }
  };
}
export class Conversation {
  constructor({ config, transport, storage, id, render, diagnostics = null, schedule = setTimeout, unschedule = clearTimeout }) {
    this.config = validConfig(config); this.transport = transport; this.storage = storage;
    Object.assign(this, { id, render, schedule, unschedule, diagnostics });
    this.key = 'mac-codex-session:' + this.config.origin;
    this.saved = storage.get(this.key) || { sessionId: null, seed: '', pending: null };
    if (this.config.sessionId && this.saved.seed !== this.config.sessionId) {
      if (this.saved.pending) throw new Error('pending_request_needs_review');
      this.saved = { sessionId: this.config.sessionId, seed: this.config.sessionId, pending: null };
    }
    // Local cached text from older builds is not authoritative and is never sent to the gateway.
    delete this.saved.history; this.history = {sessionId:this.saved.sessionId,threadId:this.saved.threadId || '',exchanges:[]};
    this.active = false; this.generation = 0; this.poll = null; this.busy = false; this.retryMs = 1000; this.operation = false; this.phase = 'READY'; this.cancelRequested = false; this.readySnapshot = null;
  }
  emit(value) { this.phase = value.state; this.render({ ...value, sessionId: this.saved.sessionId, history: this.history.exchanges.map(e => ({ ...e })) }); }
  persist() { this.storage.set(this.key, this.saved); }
  assertLive(g) { if (!this.active || g !== this.generation) throw new Error('page_closed'); }
  canSubmit() { return this.active && !this.operation && !this.busy && !this.saved.pending && !!this.readySnapshot; }
  async recover() {
    if (!this.active || this.operation) return;
    if (!this.canSubmit()) return this.open();
    // Only a fully validated, explicitly certain terminal snapshot allows local dismissal.
    // This tap acknowledges the error; it neither records nor submits a task.
    this.clearPoll();
    const s = this.readySnapshot, current = this.history.exchanges.find(e => e.turnId === s.turnId);
    this.emit({state:'READY', ready:true, busy:false, restoring:true, turnId:s.turnId,
      previousError:current?.outcome==='no_answer'?'no_final_answer':s.error || (s.status==='Error'?'turn_failed':'')});
  }
  async open() {
    if (this.operation) return;
    this.clearPoll(); this.active = true; const g = ++this.generation; this.operation = true; this.last=null; this.readySnapshot=null;
    this.emit({ state: 'THINKING', detail: '', ready: false });
    try {
      const health = await this.transport.request('GET', '/v1/health'); this.assertLive(g); this.diagnostics?.clock(health);
      if (!health.codex || !health.loggedIn) throw new Error('codex_not_ready');
      const resumingPending = !!this.saved.pending;
      if (resumingPending) await this.replay(g);
      if (resumingPending && this.cancelRequested) await this.transport.request('POST', '/v1/sessions/' + this.saved.sessionId + '/stop', {});
      this.assertLive(g);
      if (!this.saved.sessionId) await this.mutate('/v1/sessions', { requestId: this.id(), ...(this.config.project ? { project: this.config.project } : {}) }, g);
      await this.refresh(g, !resumingPending);
    } catch (e) { this.failure(e, g); }
    finally { if (g === this.generation) this.operation = false; }
  }
  async mutate(route, body, g) {
    this.readySnapshot = null;
    this.saved.pending = { route, body }; this.persist(); // write before any network send
    if (route.endsWith('/turns')) this.diagnostics?.correlate({sessionId:this.saved.sessionId,threadId:this.saved.threadId,requestId:body.requestId});
    if (route.endsWith('/turns')) this.emit({state:'THINKING', ready:false});
    return this.replay(g);
  }
  async replay(g) {
    const p = this.saved.pending;
    const result = await this.transport.request('POST', p.route, p.body);
    // Persist ACK even if hidden; reopen must not replace a successfully created session.
    const stage = requestStage('POST', p.route);
    this.validateSnapshot(result, stage);
    this.acceptHistory(result, stage);
    this.saved.sessionId = result.id;
    this.saved.pending = null; this.persist();
    if (p.route.endsWith('/turns')) { this.diagnostics?.correlate({sessionId:result.id,threadId:result.threadId,turnId:result.turnId,requestId:p.body.requestId}); this.diagnostics?.server(result); }
    this.assertLive(g); return result;
  }
  validateSnapshot(s, stage = 'refresh') {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw contractError('invalid_snapshot', 'snapshot_object', stage);
    if (typeof s.id !== 'string' || !/^[a-f0-9-]{36}$/.test(s.id)) throw contractError('invalid_snapshot', 'snapshot_id', stage);
    if (typeof s.threadId !== 'string' || !s.threadId) throw contractError('invalid_snapshot', 'snapshot_thread', stage);
    if (!['Thinking', 'Working', 'Done', 'Error'].includes(s.status)) throw contractError('invalid_snapshot', 'snapshot_status', stage);
    if (typeof s.uncertain !== 'boolean') throw contractError('invalid_snapshot', 'snapshot_uncertain', stage);
    if (this.history.threadId && s.id === this.history.sessionId && s.threadId !== this.history.threadId) throw new Error('thread_mismatch');
    if (this.saved.sessionId && s.id !== this.saved.sessionId && !this.saved.pending?.route?.endsWith('/sessions')) throw new Error('session_mismatch');
  }
  acceptHistory(s, stage = 'refresh') {
    if (!s.history || typeof s.history !== 'object' || Array.isArray(s.history)) throw contractError('gateway_history_unavailable', 'history_object', stage);
    if (s.history.sessionId !== s.id || s.history.threadId !== s.threadId) throw contractError('gateway_history_unavailable', 'history_identity', stage);
    if (!Array.isArray(s.history.exchanges)) throw contractError('gateway_history_unavailable', 'history_exchanges', stage);
    this.history = boundedHistory(s.history, s.id, this.config.token);
    this.saved.threadId = s.threadId;
  }
  async refresh(g = this.generation, restoring = false) {
    try {
      const s = await this.transport.request('GET', '/v1/sessions/' + this.saved.sessionId);
      this.assertLive(g); this.validateSnapshot(s);
      if(this.last?.id===s.id&&Number.isFinite(s.revision)&&Number.isFinite(this.last.revision)&&s.revision<this.last.revision)return this.last;
      this.acceptHistory(s); this.persist();
      const active=s.status==='Working'||s.status==='Thinking';
      this.busy=active||s.uncertain===true;
      this.retryMs = 1000;
      const approval=approvalDescriptor(s.approval,s.turnId);
      if(approval)approval.remainingMs=Math.max(0,Math.min(30000,approval.expiresAt-(Number.isFinite(s.clock?.sent)?s.clock.sent:Date.now())));
      if(s.pendingApproval&&!approval)throw new Error('approval_unavailable');
      this.last = s;
      this.readySnapshot = !this.busy && !this.saved.pending && !approval && !s.pendingApproval ? s : null;
      const current=this.history.exchanges.find(e=>e.turnId===s.turnId);
      const denied=!!(s.approvalNotice||current?.approvalNotice);
      const phase = approval ? 'APPROVAL' : denied&&active&&s.approvalStopping!==false?'STOPPING':s.uncertain?'ERROR':denied&&!active?'CANCELLED':current?.outcome==='no_answer'?'ERROR':s.status === 'Thinking' ? 'THINKING' : s.status === 'Working' ? 'WORKING' : s.status === 'Done' ? 'DONE' : 'ERROR';
      const idleRestore = restoring && !!this.readySnapshot;
      if (this.diagnostics?.sample?.requestId && this.diagnostics.sample.requestId === s.timing?.requestId) {
        this.diagnostics.correlate({sessionId:s.id,threadId:s.threadId,turnId:s.turnId}); this.diagnostics.server(s);
        if (s.status === 'Done' && !idleRestore) this.diagnostics.mark('T9');
      }
      this.emit({ state: idleRestore ? 'READY' : (s.error === 'turn_interrupted'&&!denied&&!this.busy ? 'READY' : phase),
        detail: idleRestore ? '' : (current?.outcome==='no_answer'?'no_final_answer':s.error || ''),
        ready: !!this.readySnapshot, recovery:this.readySnapshot?'continue':s.uncertain?'reconcile':'reconnect',
        previousError:idleRestore?(current?.outcome==='no_answer'?'no_final_answer':s.error || (s.status==='Error'?'turn_failed':'')):'',
        text: idleRestore ? '' : (s.text || ''), project: s.project, threadId: s.threadId, turnId: s.turnId,
        pendingApproval: s.pendingApproval === true, approval, restoring, busy:active, outcome:current?.outcome, approvalReason:s.approvalNotice, approvalMessage: Object.hasOwn(APPROVAL_NOTICES,s.approvalNotice)?APPROVAL_NOTICES[s.approvalNotice]:'' });
      if (this.busy) this.poll = this.schedule(() => { this.refresh(g).catch(e => this.failure(e, g)); }, 1000);
      return s;
    } catch (error) {
      if (g === this.generation) this.readySnapshot = null;
      throw error;
    }
  }
  async decideApproval(id,decision,confirmation,exiting=false) {
    const a=this.last?.approval;
    if(!a||a.id!==id||!this.saved.sessionId)throw new Error('approval_not_current');
    const route='/v1/sessions/'+this.saved.sessionId+'/approvals/'+id;
    const body={decision,...(confirmation!==undefined?{confirmation}:{})};
    // Never save/replay an accept as a pending mutation. On ambiguous ACK refresh only.
    if(exiting)return this.transport.decisionOnExit ? this.transport.decisionOnExit(route,body) : this.transport.request('POST',route,body);
    const g=this.generation;this.clearPoll();
    try {
      const result=await this.transport.request('POST',route,body);this.assertLive(g);
      if(result.requiresConfirmation){
        if(typeof result.confirmation!=='string'||!/^[a-f0-9-]{36}$/.test(result.confirmation))throw new Error('invalid_response');
        this.poll=this.schedule(()=>{this.refresh(g).catch(e=>this.failure(e,g))},1000);
        return result;
      }
      await this.refresh(g);return result;
    } catch(e) {
      if(this.active&&g===this.generation){try{await this.refresh(g)}catch(error){this.failure(error,g)}}
      throw e;
    }
  }
  async submit(text) {
    if (!this.canSubmit()) return;
    if (typeof text !== 'string' || !text.trim() || text.length > 8000) throw new Error('invalid_prompt');
    this.clearPoll(); this.operation = true; const g = this.generation;
    this.cancelRequested = false;
    this.emit({ state: 'THINKING', detail: '', text: '', ready: false });
    try {
      await this.mutate('/v1/sessions/' + this.saved.sessionId + '/turns', { requestId: this.id(), text: text.trim() }, g);
      if (this.cancelRequested) {
        this.emit({ state: 'WORKING', detail: 'Останавливаю…', ready: false });
        await this.transport.request('POST', '/v1/sessions/' + this.saved.sessionId + '/stop', {});
      }
      await this.refresh(g);
    } catch (e) { this.failure(e, g); }
    finally { if (g === this.generation) this.operation = false; }
  }
  async audio(wav) {
    if (!this.canSubmit()) return;
    const g = this.generation; this.operation = true;
    this.emit({ state: 'TRANSCRIBING', detail: '', text: '', ready: false });
    let transcript;
    try {
      this.diagnostics?.mark('T1');
      const result = await this.transport.request('POST', '/v1/stt', wav, true); this.assertLive(g); this.diagnostics?.server(result);
      if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('no_speech');
      transcript = result.text;
    } catch (e) { this.failure(e, g); }
    finally { if (g === this.generation) this.operation = false; }
    if (transcript && this.active && g === this.generation) await this.submit(transcript);
  }
  async stop() {
    if (!this.active || !this.saved.sessionId) return;
    if (this.phase === 'TRANSCRIBING') {
      this.generation++; this.transport.close(); this.clearPoll(); this.operation = false; this.busy = false;
      this.emit({ state: 'READY', detail: '', text: '', ready: true }); return;
    }
    if (this.operation) { this.cancelRequested = true; return; }
    if (!this.busy) return;
    const g = this.generation; this.clearPoll(); this.operation = true;
    try { await this.transport.request('POST', '/v1/sessions/' + this.saved.sessionId + '/stop', {}); await this.refresh(g); }
    catch (e) { this.failure(e, g); } finally { if (g === this.generation) this.operation = false; }
  }
  failure(error, g) {
    if (!this.active || g !== this.generation) return;
    this.readySnapshot = null;
    const pending = this.saved.pending;
    this.emit({ state: 'ERROR', detail: /^[a-z_]+$/.test(error.message) ? error.message : 'client_error', text: '', ready: false,
      recovery:this.last?.uncertain?'reconcile':'reconnect',
      diagnostic:{stage:error.stage,check:error.check,sessionId:this.saved.sessionId,threadId:this.saved.threadId,
        turnId:pending?undefined:this.last?.turnId,requestId:pending?.body?.requestId || this.last?.timing?.requestId} });
    this.clearPoll();
    // Only a GET/retained UUID is retried, never mint a new turn id after a lost ACK.
    if (!error.status && error.message === 'network_or_tls_error') {
      this.poll = this.schedule(() => this.open(), this.retryMs); this.retryMs = Math.min(this.retryMs * 2, 10000);
    }
  }
  clearPoll() { if (this.poll) this.unschedule(this.poll); this.poll = null; }
  close() { this.active = false; this.generation++; this.operation = false; this.clearPoll(); this.transport.close(); }
}
