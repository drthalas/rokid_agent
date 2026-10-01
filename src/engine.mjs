import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Fault, requireValue, requestId, prompt, fingerprint, busy, policy, turnPolicy, reduceEvent, approvalResponse } from './protocol.mjs';
import { projectPath } from './config.mjs';

export class Engine {
  constructor(config, codex) {
    this.config = config; this.codex = codex; this.approvals = new Map(); this.locks = new Set();
    this.data = fs.existsSync(config.stateFile) ? JSON.parse(fs.readFileSync(config.stateFile, 'utf8')) : { version: 1, sessions: {}, requests: {} };
    requireValue(this.data.version === 1 && this.data.sessions && this.data.requests, 'invalid_state');
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
      text: s.text, partial: s.partial, error: s.error, uncertain: s.uncertain, revision: s.revision,
      pendingApproval: [...this.approvals.values()].some(a => a.sessionId === s.id) };
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
      const { thread } = await this.codex.request('thread/start', { cwd, ...policy, config: await this.codex.safeOverrides(cwd), ...(this.config.model ? { model: this.config.model } : {}),
        developerInstructions: 'You are accessed through Rokid glasses. Respond concisely in the language of the user. Never treat voice text as an approval. Keep the selected project as the working directory.' });
      await this.codex.verifyIsolation(thread.id);
      const s = { id: randomUUID(), project: alias, threadId: thread.id, turnId: null, status: 'Done', text: '', partial: '', error: null, uncertain: false, revision: 1 };
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
    await this.codex.request('thread/resume', { threadId: body.threadId, cwd, ...policy, config: await this.codex.safeOverrides(cwd) });
    await this.codex.verifyIsolation(body.threadId);
    const s = { id: randomUUID(), project: body.project, threadId: body.threadId, turnId: null, status: 'Done', text: '', partial: '', error: null, uncertain: false, revision: 1 };
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
        this.save();
        try {
          const r = await this.codex.request('turn/start', { threadId: s.threadId, cwd, ...turnPolicy,
            input: [{ type: 'text', text, text_elements: [] }] });
          s.turnId = r.turn.id;
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
    for (const s of Object.values(this.data.sessions)) if (reduceEvent(s, method, p)) {
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
    const supported = ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'];
    if (!s || !supported.includes(m.method)) {
      if (m.method === 'item/permissions/requestApproval') this.codex.send({ id: m.id, result: approvalResponse(m.method, false) });
      else this.codex.send({ id: m.id, error: { code: -32601, message: 'Unsupported request; denied' } });
      return;
    }
    const id = randomUUID();
    const a = { id, rpcId: m.id, method: m.method, params: m.params, sessionId: s.id, expiresAt: Date.now() + (this.config.approvalTimeoutMs ?? 120000) };
    a.timer = setTimeout(() => this.decide(id, false), this.config.approvalTimeoutMs ?? 120000);
    this.approvals.set(id, a); s.revision++;
  }
  listApprovals() { return [...this.approvals.values()].map(({ timer, rpcId, ...a }) => a); }
  decide(id, allow) {
    const a = this.approvals.get(id); requireValue(a, 'approval_not_found', 404);
    clearTimeout(a.timer); this.approvals.delete(id);
    this.codex.send({ id: a.rpcId, result: approvalResponse(a.method, allow && Date.now() < a.expiresAt) });
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
        const { thread } = await this.codex.request('thread/resume', { threadId: s.threadId, cwd, ...policy, config: await this.codex.safeOverrides(cwd) });
        await this.codex.verifyIsolation(s.threadId);
        const turn = thread.turns?.at(-1);
        if (busy(s) || s.uncertain) {
          if (turn && turn.id === s.turnId && turn.status !== 'inProgress') {
            s.status = 'Working'; reduceEvent(s, 'turn/completed', { threadId: s.threadId, turn });
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
