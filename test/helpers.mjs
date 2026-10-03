import { WebSocketServer } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export async function mockCodex() {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise(r => wss.once('listening', r));
  const threads = new Map(), calls = [], responses = [];
  let serial = 0, peer;
  wss.on('connection', ws => {
    peer = ws;
    ws.on('message', raw => {
      const m = JSON.parse(raw); if (!m.method) { responses.push(m); return }
      calls.push(m); let result = {};
      const send = (method, params) => ws.send(JSON.stringify({ method, params }));
      switch (m.method) {
        case 'config/read': result = { config: { mcp_servers: { risky: { enabled: true } } } }; break;
        case 'mcpServerStatus/list': result = { data: [{ name: 'risky', runtimeStatus: 'disabled', tools: {} }], nextCursor: null }; break;
        case 'account/read': result = { account: { type: 'chatgpt' } }; break;
        case 'thread/start': {
          const thread = { id: 'thread-' + ++serial, cwd: m.params.cwd, turns: [], status: { type: 'idle' } };
          threads.set(thread.id, thread); result = { thread, approvalPolicy:m.params.approvalPolicy,approvalsReviewer:m.params.approvalsReviewer,sandbox:{type:'workspaceWrite',writableRoots:[],networkAccess:false,excludeSlashTmp:false,excludeTmpdirEnvVar:false} }; break;
        }
        case 'thread/read': case 'thread/resume': result = { thread: threads.get(m.params.threadId),approvalPolicy:m.params.approvalPolicy,approvalsReviewer:m.params.approvalsReviewer,sandbox:{type:'workspaceWrite',writableRoots:[],networkAccess:false,excludeSlashTmp:false,excludeTmpdirEnvVar:false} }; break;
        case 'turn/start': {
          const thread = threads.get(m.params.threadId);
          const turn = { id: 'turn-' + ++serial, status: 'inProgress', items: [] };
          thread.turns.push(turn); result = { turn };
          send('turn/started', { threadId: thread.id, turn });
          send('item/agentMessage/delta', { threadId: thread.id, turnId: turn.id, delta: 'partial' });
          break;
        }
        case 'turn/interrupt': {
          const t = threads.get(m.params.threadId).turns.at(-1); t.status = 'interrupted';
          send('turn/completed', { threadId: m.params.threadId, turn: t }); break;
        }
      }
      if (m.id !== undefined) ws.send(JSON.stringify({ id: m.id, result }));
    });
  });
  return { port: wss.address().port, calls, responses, threads,
    send: m => peer.send(JSON.stringify(m)),
    disconnect: () => peer.terminate(),
    finish(id, text = 'final answer', status = 'completed') {
      const t = threads.get(id).turns.at(-1); t.status = status; t.items = [{ type: 'agentMessage', phase: 'final_answer', text }];
      peer.send(JSON.stringify({ method: 'turn/completed', params: { threadId: id, turn: t } }));
    },
    close: async () => { for (const c of wss.clients) c.terminate(); await new Promise(r => wss.close(r)); }
  };
}
export function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rokid-test-'));
  for (const f of ['device-token', 'admin-token']) fs.writeFileSync(path.join(dir, f), randomBytes(32).toString('base64url'), { mode: 0o600 });
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  fs.chmodSync(path.join(dir, 'key.pem'), 0o600);
  const config = { host: '127.0.0.1', port: 0, adminPort: 0, projects: { demo: fs.realpathSync(dir) }, defaultProject: 'demo', stateFile: path.join(dir, 'state.json'),
    tokenFile: path.join(dir, 'device-token'), adminTokenFile: path.join(dir, 'admin-token'), certFile: path.join(dir, 'cert.pem'), keyFile: path.join(dir, 'key.pem'), approvalTimeoutMs: 60 };
  return { dir, config, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
export function request(config, port, route, body, { admin = false, token, method } = {}) {
  return new Promise((resolve, reject) => {
    const req = (admin ? http : https).request({ hostname: '127.0.0.1', port, path: route, method: method ?? (body ? 'POST' : 'GET'),
      ca: fs.readFileSync(config.certFile), servername: 'localhost',
      headers: { Authorization: 'Bearer ' + (token ?? fs.readFileSync(admin ? config.adminTokenFile : config.tokenFile, 'utf8').trim()), 'Content-Type': 'application/json' }
    }, res => { const chunks = []; res.on('data', b => chunks.push(b)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks)) })); });
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
}
export const delay = ms => new Promise(r => setTimeout(r, ms));

export const calculatorApproval = s => ({threadId:s.threadId,turnId:s.turnId,serverName:'cua_repl',mode:'form',requestedSchema:{type:'object',properties:{}},_meta:{codex_approval_kind:'mcp_tool_call',tool_name:'get_app_state',tool_params:{app:'com.apple.calculator'},riskLevel:'low',persist:['session','always']}});
