// WebSocket lifecycle adapted from Rokid-Nexus agentd/src/codex/monitor.ts.
// Source: 49128717b635783a5859dda307284f2d1eafd3eb; Apache-2.0, see licenses/.
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { Fault } from './protocol.mjs';

export function spawnSpec(binary, port) {
  return { command: binary, args: ['app-server', '--listen', `ws://127.0.0.1:${port}`,
    '-c', 'sandbox_mode="read-only"', '-c', 'approval_policy="on-request"',
    '-c', 'approvals_reviewer="user"', '-c', 'mcp_servers={}',
    '-c', 'features.apps=false', '-c', 'features.plugins=false', '-c', 'features.hooks=false'],
  options: { shell: false, stdio: 'ignore' } };
}
function childEnv() {
  return Object.fromEntries(['HOME', 'CODEX_HOME', 'PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'SHELL', 'USER', 'LOGNAME',
    'SSL_CERT_FILE', 'SSL_CERT_DIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
}
export class Codex extends EventEmitter {
  constructor({ binary = 'codex', port = 8390, attach = false, timeout = 30000 }) {
    super(); Object.assign(this, { binary, port, attach, timeout });
    this.pending = new Map(); this.seq = 0; this.ready = false; this.stopped = false;
  }
  async start() {
    if (!this.attach) {
      // Never silently attach to a possibly more privileged, externally owned server.
      const net = await import('node:net');
      await new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', () => reject(new Fault('codex_port_in_use', 503)));
        probe.listen(this.port, '127.0.0.1', () => probe.close(resolve));
      });
      const spec = spawnSpec(this.binary, this.port);
      this.child = spawn(spec.command, spec.args, { ...spec.options, env: childEnv() });
      this.child.on('error', () => { this.childFailed = true; });
      this.child.on('exit', () => { this.childFailed = true; this.socket?.terminate(); if (!this.stopped) this.emit('processExit'); });
    }
    await this.connectWithRetry();
  }
  async connectWithRetry() {
    if (this.connecting) throw new Fault('codex_connecting', 503);
    this.connecting = true;
    try {
      for (let n = 0; n < 30 && !this.stopped; n++) {
        if (this.childFailed) throw new Fault('codex_process_failed', 503);
        try { await this.connect(); return; } catch { await new Promise(r => setTimeout(r, 200)); }
      }
      throw new Fault('codex_unavailable', 503);
    } finally { this.connecting = false; }
  }
  scheduleReconnect() {
    if (this.stopped || this.childFailed || this.retry || this.connecting) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.connectWithRetry().then(() => this.emit('reconnected')).catch(() => { this.emit('offline'); this.scheduleReconnect(); });
    }, 1000);
  }
  async connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${this.port}`, { maxPayload: 8 * 1024 * 1024 });
    ws.on('error', () => {});
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.terminate(); reject(new Fault('codex_connect_timeout')); }, 800);
      ws.once('open', () => { clearTimeout(timer); resolve(); });
      ws.once('error', () => { clearTimeout(timer); reject(new Fault('codex_connect_failed')); });
    });
    this.socket = ws;
    ws.on('message', data => this.message(data));
    ws.once('close', () => {
      if (this.socket !== ws) return;
      this.ready = false; this.socket = null;
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Fault('codex_disconnected', 503)); }
      this.pending.clear(); this.emit('offline');
      this.scheduleReconnect();
    });
    try {
      await this.request('initialize', { clientInfo: { name: 'rokid_mac_gateway', title: 'Rokid Mac Gateway', version: '0.1.0' }, capabilities: { experimentalApi: false } });
      this.send({ method: 'initialized' });
      // Empty TOML tables merge with local settings rather than deleting them.
      // Disable each configured MCP server explicitly before any thread is loaded.
      const effective = await this.request('config/read', { includeLayers: false });
      this.safeConfig = Object.fromEntries(Object.keys(effective.config?.mcp_servers ?? {}).map(name => [`mcp_servers.${name}.enabled`, false]));
      this.ready = true;
    } catch (error) { ws.terminate(); throw error; }
  }
  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Fault('codex_unavailable', 503);
    this.socket.send(JSON.stringify(message));
  }
  request(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Fault('codex_rpc_timeout', 503)); }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }
  async safeOverrides(cwd) {
    const effective = await this.request('config/read', { includeLayers: false, cwd });
    return Object.fromEntries(Object.keys(effective.config?.mcp_servers ?? {}).map(name => [`mcp_servers.${name}.enabled`, false]));
  }
  async verifyIsolation(threadId) {
    let cursor = null;
    do {
      const result = await this.request('mcpServerStatus/list', { threadId, limit: 100, cursor });
      if (!Array.isArray(result.data) || result.data.some(s => s.runtimeStatus !== 'disabled' || Object.keys(s.tools ?? {}).length)) {
        throw new Fault('mcp_isolation_failed', 503);
      }
      cursor = result.nextCursor;
    } while (cursor);
  }
  message(data) {
    let m; try { m = JSON.parse(data.toString()); } catch { return; }
    if (m.method) { this.emit(m.id !== undefined ? 'request' : 'notification', m); return; }
    const p = this.pending.get(m.id); if (!p) return;
    this.pending.delete(m.id); clearTimeout(p.timer);
    if (m.error) p.reject(new Fault('codex_rpc_rejected', 502)); else p.resolve(m.result);
  }
  async close() {
    this.stopped = true; clearTimeout(this.retry); this.socket?.terminate();
    if (this.child && this.child.exitCode === null) {
      const child = this.child;
      await new Promise(resolve => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
        child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM');
      });
    }
  }
}
