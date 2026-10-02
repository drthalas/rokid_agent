import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Fault, requireValue, requestId, prompt, fingerprint, busy, policy, turnPolicy, reduceEvent } from './protocol.mjs';
import { boundHistory, startExchange, updateExchange, hydrateHistory } from './history.mjs';
import { projectPath } from './config.mjs';
import { supportedApproval, nativeApprovalResponse } from './approvals.mjs';
import { toolEvidence, reviewEvidence } from './tool-evidence.mjs';

export class Engine {
  constructor(config, codex) {
    this.config = config; this.codex = codex; this.approvals = new Map(); this.locks = new Set();
    this.data = fs.existsSync(config.stateFile) ? JSON.parse(fs.readFileSync(config.stateFile, 'utf8')) : { version: 1, sessions: {}, requests: {} };
    requireValue(this.data.version === 1 && this.data.sessions && this.data.requests, 'invalid_state');
    this.historySecrets = [config.tokenFile, config.adminTokenFile].filter(Boolean).map(p=>fs.readFileSync(p,'utf8').trim());
    for (const s of Object.values(this.data.sessions)) s.history=boundHistory(s.history,this.historySecrets);
    this.timings = new Map(); this.toolEvents = []; this.reviewEvents = [];
    this.recovered = false;
    codex.on('notification', m => this.event(m));
    codex.on('request', m => this.approval(m));
    codex.on('offline', () => {
      this.recovered = false;
      for (const a of this.approvals.values()) clearTimeout(a.timer);
      this.approvals.clear();
      for (const s of Object.values(this.data.sessions)) if (busy(s)) { s.status = 'Error'; s.error = 'connection_lost'; s.uncertain = true; s.revision++; }
      this.save();
    });
    codex.on('reconnected', () => { this.recover().catch(() => {}); });
  }
  save() {
    fs.mkdirSync(path.dirname(this.config.stateFile), { recursive: true, mode: 0o700 });
    const temp = this.config.stateFile + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(this.data), { mode: 0o600 });
    fs.chmodSync(temp, 0o600); fs.renameSync(temp, this.config.stateFile);
  }
  get(id) { requireValue(Object.hasOwn(this.data.sessions, id), 'session_not_found', 404); return this.data.sessions[id]; }
  snapshot(s) {
    return { id: s.id, project: s.project, threadId: s.threadId, turnId: s.turnId, status: s.status,
      history: {sessionId:s.id,threadId:s.threadId,exchanges:boundHistory(s.history,this.historySecrets)},
      text: s.text, partial: s.partial, error: s.error, uncertain: s.uncertain, revision: s.revision,
      pendingApproval: [...this.approvals.values()].some(a => a.sessionId === s.id),
      ...(this.timings.has(s.id) ? {timing:{...this.timings.get(s.id)}} : {}) };
  }
  ready() { requireValue(this.codex.ready && this.recovered, 'codex_unavailable', 503); }
  async once(id, body, action) {
    requestId(id); const hash = fingerprint(body); const previous = this.data.requests[id];
    if (previous) {
      requireValue(previous.hash === hash, 'request_id_conflict', 409);
      requireValue(previous.sessionId, 'request_outcome_unknown', 409);
      return this.snapshot(this.get(previous.sessionId));
    }
    requireValue(Object.keys(this.data.requests).length < 10000, 'request_capacity_reached', 503);
    this.data.requests[id] = { hash }; this.save();
    const s = await action();
    this.data.requests[id].sessionId = s.id; this.save(); return this.snapshot(s);
  }
  async create(body) {
    this.ready(); const alias = body.project ?? this.config.defaultProject; const cwd = projectPath(this.config, alias);
    return this.once(body.requestId, ['create', alias], async () => {
      requireValue(Object.keys(this.data.sessions).length < 100, 'session_capacity_reached', 503);
      const started = await this.codex.request('thread/start', { cwd, ...policy, ...(this.config.model ? { model: this.config.model } : {}),
        developerInstructions: 'You are accessed through Rokid glasses. Respond concisely in the language of the user. Never treat voice text as an approval. Keep the selected project as the working directory.' });
      this.codex.recordProfile(started); const {thread}=started;
      await this.codex.verifyCapabilities(thread.id,cwd);
      const s = { id: randomUUID(), project: alias, threadId: thread.id, turnId: null, status: 'Done', text: '', partial: '', error: null, uncertain: false, revision: 1, history: [] };
      this.data.sessions[s.id] = s; return s;
    });
  }
  async importThread(body) {
    this.ready(); const cwd = projectPath(this.config, body.project);
    requireValue(typeof body.threadId === 'string' && body.threadId.length <= 100, 'invalid_thread');
    requireValue(!Object.values(this.data.sessions).some(s => s.threadId === body.threadId), 'thread_already_imported', 409);
    const { thread } = await this.codex.request('thread/read', { threadId: body.threadId, includeTurns: true });
    requireValue(fs.realpathSync(thread.cwd) === cwd, 'thread_project_mismatch', 403);
    requireValue(thread.status?.type !== 'active' && thread.turns?.at(-1)?.status !== 'inProgress', 'thread_active', 409);
    const resumed=await this.codex.request('thread/resume', { threadId: body.threadId, cwd, ...policy });
    this.codex.recordProfile(resumed);
    await this.codex.verifyCapabilities(body.threadId,cwd);
    const s = { id: randomUUID(), project: body.project, threadId: body.threadId, turnId: null, status: 'Done', text: '', partial: '', error: null, uncertain: false, revision: 1, history: [] };
    hydrateHistory(s, thread.turns, this.historySecrets);
    this.data.sessions[s.id] = s; this.save(); return this.snapshot(s);
  }
  async turn(id, body) {
    this.ready(); const s = this.get(id); const text = prompt(body.text); const cwd = projectPath(this.config, s.project);
    if (this.data.requests[body.requestId]) return this.once(body.requestId, ['turn', id, text], () => {});
    requireValue(!busy(s) && !s.uncertain && !this.locks.has(id), 'session_busy_or_uncertain', 409);
    this.locks.add(id);
    try {
      return await this.once(body.requestId, ['turn', id, text], async () => {
        // Persist BEFORE sending. Retrying the same request must never duplicate a turn.
        this.data.requests[body.requestId].sessionId = id;
        s.status = 'Thinking'; s.error = null; s.text = ''; s.partial = ''; s.turnId = null; s.revision++;
        startExchange(s, body.requestId, text, this.historySecrets);
        this.save();
        try {
          const timing = { requestId: body.requestId, T5: Date.now() };
          this.timings.delete(id); this.timings.set(id, timing);
          if (this.timings.size > 32) this.timings.delete(this.timings.keys().next().value);
          const r = await this.codex.request('turn/start', { threadId: s.threadId, cwd, ...turnPolicy,
            input: [{ type: 'text', text, text_elements: [] }] });
          timing.T6 = Date.now(); timing.turnId = r.turn.id;
          s.turnId = r.turn.id; updateExchange(s, this.historySecrets);
          if (s.status === 'Thinking') s.status = 'Working';
        } catch {
          s.status = 'Error'; s.error = 'turn_delivery_uncertain'; s.uncertain = true;
        }
        s.revision++; return s;
      });
    } finally { this.locks.delete(id); }
  }
  async stop(id) {
    const s = this.get(id); this.ready();
    if (!s.turnId && (busy(s) || s.uncertain)) throw new Fault('turn_id_unknown_reconcile_locally', 409);
    if (busy(s) || s.uncertain) await this.codex.request('turn/interrupt', { threadId: s.threadId, turnId: s.turnId });
    return this.snapshot(s);
  }
  event({ method, params: p = {} }) {
    for (const s of Object.values(this.data.sessions)) {
      const review=reviewEvidence(method,p,s);
      if(review){this.reviewEvents.push(review);this.reviewEvents=this.reviewEvents.slice(-64);}
      const evidence=toolEvidence(method,p,s);
      if(evidence){this.toolEvents.push(evidence);this.toolEvents=this.toolEvents.slice(-64);}
    }
    for (const s of Object.values(this.data.sessions)) if (reduceEvent(s, method, p)) {
      updateExchange(s, this.historySecrets);
      const timing = this.timings.get(s.id);
      if (timing) {
        if (method === 'item/agentMessage/delta' && !timing.T7) timing.T7 = Date.now();
        if (method === 'turn/completed') timing.T8 = Date.now();
      }
      if (!busy(s)) this.clearApprovals(s.id);
      // Stream deltas live; persist terminal transitions, not every token.
      if (method !== 'item/agentMessage/delta') this.save();
    }
    if (method === 'serverRequest/resolved') for (const [id, a] of this.approvals) {
      if (a.rpcId === p.requestId) { clearTimeout(a.timer); this.approvals.delete(id); }
    }
  }
  approval(m) {
    const s = Object.values(this.data.sessions).find(s => s.threadId === m.params?.threadId && busy(s));
    const stale=m.params?.turnId && m.params.turnId!==s?.turnId;
    if (!s || stale || !supportedApproval(m.method,m.params)) {
      if (m.method === 'item/permissions/requestApproval' || m.method === 'mcpServer/elicitation/request') this.codex.send({ id: m.id, result: nativeApprovalResponse(m.method,m.params,false) });
      else this.codex.send({ id: m.id, error: { code: -32601, message: 'Unsupported request; denied' } });
      return;
    }
    const id = randomUUID();
    const receivedAt=Date.now(),timeout=this.config.approvalTimeoutMs;
    const a = { id, rpcId: m.id, method: m.method, params: m.params, sessionId: s.id, turnId:s.turnId, receivedAt, expiresAt: Number.isFinite(timeout)&&timeout>0?receivedAt+timeout:null };
    if(a.expiresAt!==null)a.timer=setTimeout(() => { try { this.decide(id, false); } catch {} },timeout);
    this.approvals.set(id, a); s.revision++;
    this.reviewEvents.push({event:'humanApproval/pending',sessionId:s.id,threadId:s.threadId,turnId:s.turnId,requestId:id,method:m.method,receivedAt,at:Date.now()});this.reviewEvents=this.reviewEvents.slice(-64);
  }
  listApprovals() { return [...this.approvals.values()].map(({ timer, rpcId, ...a }) => a); }
  decide(id, allow) {
    const a = this.approvals.get(id); requireValue(a, 'approval_not_found', 404);
    clearTimeout(a.timer); this.approvals.delete(id);
    const session=this.get(a.sessionId);
    const current=busy(session)&&session.turnId===a.turnId;
    this.codex.send({ id: a.rpcId, result: nativeApprovalResponse(a.method,a.params,allow && current && (a.expiresAt===null || Date.now()<a.expiresAt)) });
    this.get(a.sessionId).revision++;
    return { ok: true };
  }
  clearApprovals(sessionId) {
    for (const [id, a] of this.approvals) if (a.sessionId === sessionId) { clearTimeout(a.timer); this.approvals.delete(id); }
  }
  async recover() {
    for (const s of Object.values(this.data.sessions)) {
      try {
        const cwd = projectPath(this.config, s.project);
        const { thread: original } = await this.codex.request('thread/read', { threadId: s.threadId, includeTurns: true });
        requireValue(fs.realpathSync(original.cwd) === cwd, 'thread_project_mismatch');
        const resumed = await this.codex.request('thread/resume', { threadId: s.threadId, cwd, ...policy });
        this.codex.recordProfile(resumed); const {thread}=resumed;
        await this.codex.verifyCapabilities(s.threadId,cwd);
        hydrateHistory(s, original.turns, this.historySecrets);
        const turn = thread.turns?.at(-1);
        if (busy(s) || s.uncertain) {
          if (turn && turn.id === s.turnId && turn.status !== 'inProgress') {
            s.status = 'Working'; reduceEvent(s, 'turn/completed', { threadId: s.threadId, turn });
            updateExchange(s, this.historySecrets);
          } else if (turn && turn.id === s.turnId && turn.status === 'inProgress') {
            s.status = 'Working'; s.error = null; s.uncertain = false;
          } else { s.status = 'Error'; s.error = 'recovery_requires_local_review'; s.uncertain = true; }
        }
      } catch { s.status = 'Error'; s.error = 'resume_failed'; s.uncertain = true; }
      s.revision++;
    }
    this.save(); this.recovered = true;
  }
  close() { for (const a of this.approvals.values()) clearTimeout(a.timer); this.approvals.clear(); }
}
