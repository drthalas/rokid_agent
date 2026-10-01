import { createHash } from 'node:crypto';

export class Fault extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export function requireValue(condition, code, status = 400) {
  if (!condition) throw new Fault(code, status);
}
export function object(value, keys) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 'invalid_body');
  requireValue(Object.keys(value).every(k => keys.includes(k)), 'unknown_field');
  return value;
}
export function requestId(value) {
  requireValue(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(value), 'invalid_request_id');
  return value;
}
export function prompt(value) {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= 8000 && !value.includes('\0'), 'invalid_prompt');
  return value.trim();
}
export function fingerprint(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export const busy = s => ['Thinking', 'Working'].includes(s.status);
export const policy = Object.freeze({ sandbox: 'read-only', approvalPolicy: 'on-request', approvalsReviewer: 'user' });
export const turnPolicy = Object.freeze({ approvalPolicy: 'on-request', approvalsReviewer: 'user', sandboxPolicy: { type: 'readOnly', networkAccess: false } });

// Adapted from Anezium/Rokid-Nexus agentd/src/codex/monitor.ts (Apache-2.0).
// No session-wide approvals or permission expansion in this MVP.
export function approvalResponse(method, allow) {
  if (method === 'item/permissions/requestApproval') return { permissions: {}, scope: 'turn' };
  return { decision: allow ? 'accept' : 'decline' };
}
export function reduceEvent(s, method, p) {
  if (!busy(s) || p.threadId !== s.threadId) return false;
  const turnId = p.turnId ?? p.turn?.id;
  if (s.turnId && turnId && s.turnId !== turnId) return false;
  if (method === 'turn/started') { s.turnId = p.turn.id; s.status = 'Working'; }
  else if (method === 'item/agentMessage/delta') {
    s.status = 'Working';
    s.partial = ((s.partial ?? '') + (typeof p.delta === 'string' ? p.delta : '')).slice(-16000);
  } else if (method === 'item/completed' && p.item?.type === 'agentMessage') {
    if (p.item.phase !== 'commentary') s.text = String(p.item.text ?? '').slice(0, 16000);
  } else if (method === 'turn/completed') {
    s.turnId = p.turn.id;
    const final = p.turn.items?.filter(i => i.type === 'agentMessage' && i.phase !== 'commentary').at(-1);
    if (final) s.text = String(final.text ?? '').slice(0, 16000);
    s.status = p.turn.status === 'completed' ? 'Done' : 'Error';
    s.error = s.status === 'Done' ? null : `turn_${p.turn.status}`;
    s.uncertain = false;
    s.partial = '';
  } else if (method === 'error' && p.willRetry === false) {
    s.status = 'Error'; s.error = 'codex_turn_failed'; s.uncertain = true;
  } else return false;
  s.revision++;
  return true;
}
